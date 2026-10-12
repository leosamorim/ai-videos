import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { digest, fileHash } from './fingerprint.mjs';
import { readCache, restoreCache, toolVersions, writeCache } from './cache.mjs';
import { sourceSignature } from './editorial.mjs';
import { audioTimelineFilter, probe } from './media.mjs';
import { SIGNAL_HOME, SIGNAL_LOCK, SIGNAL_WORKER, runSignalWorker, signalRuntimeStatus } from './signal-runtime.mjs';
import { ROOT, fail, readJson, run } from './util.mjs';

export const AUDIO_CONFIG = { on: 0.5, off: 0.35, silence: 0.2, padding: 0.12, step: 0.032 };
const write = (path, data) => {
  mkdirSync(join(path, '..'), { recursive: true });
  const temporary = `${path}.${process.pid}.pending`;
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n');
  renameSync(temporary, path);
};
const rawPath = (project) => join(project.dir, project.data.source.file);
function summaryInputs(project) {
  const hash = (folder, name) => folder && existsSync(join(folder, name)) ? fileHash(join(folder, name)) : null;
  return { transcript: hash(project.paths.transcript, 'transcript.raw.json'), plan: hash(project.paths.cut, 'edit-plan.json') };
}

export function mergeWindows(windows, duration) {
  if (!Number.isFinite(duration) || duration <= 0) fail('duração inválida');
  const sorted = windows.map(({ start, end }) => {
    if (![start, end].every(Number.isFinite) || start < 0 || end <= start || end > duration + 0.001) fail('janela fora do relógio da fonte');
    return { start, end: Math.min(end, duration) };
  }).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const window of sorted) {
    const previous = merged.at(-1);
    if (previous && window.start <= previous.end) previous.end = Math.max(previous.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

export function boundaryWindows(segments, duration, context = 1) {
  if (!Number.isFinite(context) || context < 0.2 || context > 10) fail('--context deve ficar entre 0.2 e 10 segundos');
  mergeWindows(segments, duration); // Validate before clamping context.
  return mergeWindows(segments.flatMap(({ start, end }) => [start, end].map((time) => ({
    start: Math.max(0, time - context), end: Math.min(duration, time + context),
  }))), duration);
}

/** Hysteresis and padding describe probable speech, never a keep/delete EDL. Short speech is retained. */
export function speechRegions(rows, duration, config = AUDIO_CONFIG) {
  const { on, off, silence, padding, step } = config;
  if (!(on > off && on <= 1 && off >= 0 && silence >= 0 && padding >= 0 && step > 0)) fail('configuração VAD inválida');
  const spans = [];
  let start = null, quiet = null;
  for (const [time, probability] of rows) {
    if (start === null && probability >= on) start = time;
    if (start === null) continue;
    if (probability < off) {
      quiet ??= time;
      if (time + step - quiet >= silence) {
        spans.push({ start: Math.max(0, start - padding), end: Math.min(duration, quiet + padding) });
        start = quiet = null;
      }
    } else quiet = null;
  }
  if (start !== null) spans.push({ start: Math.max(0, start - padding), end: duration });
  return mergeWindows(spans, duration);
}

export function validateSignalReport(report, input) {
  if (report.schema !== 1 || report.clock !== 'source-video' || report.kind !== input.kind || !Array.isArray(report.rows) || !report.rows.length) fail('relatório de sinais inválido');
  let previous = -1;
  for (const row of report.rows) {
    const time = input.kind === 'audio' ? row[0] : row.time;
    if (!Number.isFinite(time) || time <= previous || time < 0 || time >= input.duration + 0.0001) fail('relatório fora do relógio da fonte');
    if (input.kind === 'audio' && !(Number.isFinite(row[1]) && row[1] >= 0 && row[1] <= 1)) fail('probabilidade inválida');
    if (input.kind === 'face' && (typeof row.face !== 'boolean' || !input.windows.some((w) => time >= w.start - 0.0001 && time < w.end + 0.0001))) fail('amostra visual fora das janelas');
    previous = time;
  }
  if (input.kind === 'audio' && (report.sample_rate !== 16000 || report.samples !== Math.round(input.duration * 16000) || report.rows.length !== Math.ceil(report.samples / 512))) fail('PCM ou cobertura VAD divergente');
  if (input.kind === 'audio' && report.rows.some(([time], i) => Math.abs(time - i * 0.032) > 0.00001)) fail('grade temporal VAD divergente');
  if (input.kind === 'face') {
    const expected = input.windows.flatMap((w) => {
      const first = Math.ceil(w.start * 30 - 1e-6), stop = Math.ceil(w.end * 30 - 1e-6), step = 30 / input.fps;
      return Array.from({ length: Math.ceil((stop - first) / step) }, (_, i) => (first + i * step) / 30);
    });
    if (report.fps !== input.fps || digest(report.windows) !== digest(input.windows) || report.rows.length !== expected.length || report.rows.some((r, i) => Math.abs(r.time - expected[i]) > 0.00001 || (input.pose && typeof r.pose !== 'boolean'))) fail('cobertura visual divergente');
  }
  return report;
}

/** Pure inference identity: transcript corrections and take ordering do not invalidate measurements. */
export function signalInput({ media, duration, offset, runtime, kind, proxy = null, windows = [], pose = false, fps = 5 }) {
  return { revision: 1, kind, media, duration, offset, proxy, windows, pose, fps,
    audio_config: AUDIO_CONFIG, models: SIGNAL_LOCK.models, runtime: runtime.versions,
    worker: fileHash(SIGNAL_WORKER), tools: toolVersions() };
}

/** Read-only; unavailable, changed or corrupt measurements cannot masquerade as current evidence. */
export function readSignals(project) {
  const path = join(project.paths.analysis, 'signals.json');
  if (!existsSync(path)) return { reports: [], warnings: [] };
  try {
    const index = readJson(path), media = fileHash(rawPath(project));
    if (index.schema !== 1 || index.clock !== 'source-video' || index.media !== media) throw new Error('fonte mudou');
    const reports = [], warnings = [];
    for (const entry of index.reports ?? []) {
      try {
        const file = resolve(project.paths.analysis, entry.path), local = relative(project.paths.analysis, file);
        if (isAbsolute(local) || local.startsWith('..') || fileHash(file) !== entry.sha256) throw new Error('artefato ausente ou alterado');
        const report = readJson(file), input = report.input;
        if (digest(input) !== entry.key || input.media !== media || input.worker !== fileHash(SIGNAL_WORKER) || digest(input.models) !== digest(SIGNAL_LOCK.models)) throw new Error('origem/modelo mudou');
        if (input.kind === 'face') {
          const evidence = readJson(join(project.paths.analysis, 'evidence.json'));
          if (evidence.source_signature !== sourceSignature(project) || fileHash(resolve(ROOT, evidence.preview)) !== input.proxy) throw new Error('proxy/evidências mudou');
        }
        reports.push(validateSignalReport(report, input));
      } catch (error) { warnings.push(`${entry.kind}: sinais ignorados (${error.message})`); }
    }
    const summaryPath = join(project.paths.analysis, 'SIGNALS.md');
    const state = digest({ reports: reports.map((r) => digest(r.input)), warnings });
    const summaryCurrent = Boolean(index.summary?.signal_state === state && digest(index.summary.inputs) === digest(summaryInputs(project)) && existsSync(summaryPath) && index.summary.sha256 === fileHash(summaryPath));
    return { reports, warnings, signal_state: state, summary_current: summaryCurrent };
  } catch (error) { return { reports: [], warnings: [`sinais ignorados (${error.message})`] }; }
}

export function boundarySignalNotes(reports, segments) {
  const audio = reports.find((r) => r.kind === 'audio'), faces = reports.filter((r) => r.kind === 'face');
  const notes = [];
  segments.forEach((segment, index) => {
    for (const [edge, time] of [['entrada', segment.start], ['saída', segment.end]]) {
      const label = `${segment.id ?? `take-${index + 1}`} ${edge} ${time.toFixed(3)}s (bruto)`;
      const activity = audio?.rows.filter(([t]) => t >= time - 0.096 && t <= time + 0.096) ?? [];
      if (activity.length >= 5 && activity[0][0] < time - 0.06 && activity.at(-1)[0] > time + 0.06 && activity.every(([, p]) => p >= 0.65)) {
        notes.push(`${label}: atividade vocal atravessa a borda; conferir sílabas e contexto.`);
      }
      const nearby = faces.flatMap((r) => r.rows.filter((row) => Math.abs(row.time - time) <= 0.25));
      if (nearby.length >= 2 && nearby.every((row) => !row.face)) notes.push(`${label}: rosto não detectado nas amostras próximas; abrir sequência (não significa erro de atuação).`);
    }
  });
  return [...new Set(notes)];
}

/** Rank local changes for inspection, without assigning performance quality or emotion. */
export function visualChangeCues(report, audio) {
  const changes = [];
  for (let i = 1; i < report.rows.length; i++) {
    const a = report.rows[i - 1], b = report.rows[i];
    if (b.time - a.time > 1 / report.fps + 0.001 || !report.windows.some((w) => a.time >= w.start && b.time < w.end)) continue;
    const probabilities = audio?.rows.filter(([t]) => t >= a.time && t <= b.time).map(([, p]) => p) ?? [];
    const speech = probabilities.length ? Math.max(...probabilities) : null;
    if (a.orientation_degrees && b.orientation_degrees) {
      const delta = Math.hypot(...a.orientation_degrees.map((v, axis) => ((b.orientation_degrees[axis] - v + 540) % 360) - 180));
      changes.push({ start: a.time, end: b.time, kind: 'head', delta, speech });
    }
    if (a.wrists && b.wrists) {
      const distances = a.wrists.flatMap((w, hand) => w[2] >= 0.7 && b.wrists[hand][2] >= 0.7 ? [Math.hypot(w[0] - b.wrists[hand][0], w[1] - b.wrists[hand][1])] : []);
      if (distances.length) changes.push({ start: a.time, end: b.time, kind: 'wrists', delta: Math.max(...distances), speech });
    }
  }
  // Spread suggestions in time: several samples of the same movement need one context inspection.
  const selected = [];
  for (const kind of ['head', 'wrists']) {
    for (const cue of changes.filter((c) => c.kind === kind).sort((a, b) => b.delta - a.delta)) {
      if (selected.filter((c) => c.kind === kind).length >= 3) break;
      if (selected.some((c) => c.kind === kind && Math.abs(c.start - cue.start) < 1)) continue;
      selected.push(cue);
    }
  }
  return selected;
}

export function signalPreflight(project, segments) {
  const { reports, warnings } = readSignals(project);
  return [...warnings, ...boundarySignalNotes(reports, segments)];
}

function summary(project, index) {
  const { reports, warnings } = readSignals(project);
  const wordsPath = join(project.paths.transcript, 'transcript.raw.json');
  const transcript = existsSync(wordsPath) ? readJson(wordsPath) : null;
  const words = transcript?.timeline === 'source-video' ? transcript.words : [];
  const lines = ['# Sinais para orientar inspeção', '',
    'Relógio: bruto / source-video. Medições automáticas, sem escuta ou interpretação editorial. Não aprovam cortes.', '', ...warnings];
  const audio = reports.find((r) => r.kind === 'audio');
  if (audio) {
    const regions = speechRegions(audio.rows, index.duration);
    let cursor = 0;
    const gaps = [];
    for (const region of [...regions, { start: index.duration, end: index.duration }]) {
      if (region.start - cursor >= 0.4) gaps.push({ start: cursor, end: region.start });
      cursor = region.end;
    }
    lines.push(`Silero: ${regions.length} regiões de fala provável; ${gaps.length} intervalos ≥0,4s fora delas.`,
      'Amostras completas nos JSON; ausência de fala não indica ausência de ação útil. Lista limitada aos 12 maiores intervalos:', '');
    for (const gap of gaps.sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, 12)) {
      const overlap = words.filter((w) => w.start < gap.end && w.end > gap.start);
      lines.push(`- ${gap.start.toFixed(3)}–${gap.end.toFixed(3)}s: inspecionar ação${overlap.length ? `; ${overlap.length} palavra(s) da transcrição sobrepõem o intervalo — divergência a conferir` : ''}.`);
    }
  }
  for (const face of reports.filter((r) => r.kind === 'face')) {
    lines.push('', `MediaPipe: ${face.rows.filter((r) => r.face).length}/${face.rows.length} amostras com rosto; janelas ${face.input.windows.map((w) => `${w.start}–${w.end}s`).join(', ')}.`,
      'Orientação da cabeça não mede olhar/intenção; falhas de detecção não justificam descarte. Pose, quando solicitada, registra punhos para localizar gestos.');
    for (const cue of visualChangeCues(face, audio)) lines.push(`- ${cue.start.toFixed(3)}–${cue.end.toFixed(3)}s: uma das maiores variações locais de ${cue.kind === 'head' ? 'orientação' : 'punhos'} nesta janela (${cue.delta.toFixed(3)} ${cue.kind === 'head' ? 'graus estimados' : 'coordenadas normalizadas'}); pico de probabilidade vocal ${cue.speech === null ? 'não medido' : cue.speech.toFixed(2)}. Abrir contexto para entender a ação; não é indicação de descarte.`);
  }
  const planPath = join(project.paths.cut, 'edit-plan.json');
  if (existsSync(planPath)) lines.push('', '## Bordas propostas', ...boundarySignalNotes(reports, readJson(planPath).segments ?? []).map((s) => `- ${s}`));
  lines.push('', 'Sem aviso não significa corte seguro. Abra o clip e quadros densos com inspect; confira o corte montado com frames --clean --cuts --context 0.5.', '',
    `Índice verificável: signals.json (${index.reports.length} relatório(s)). Nunca anexar estes JSON como evidência visual já examinada.`, '');
  writeFileSync(join(project.paths.analysis, 'SIGNALS.md'), lines.join('\n'));
}

export function generateSignals(project, { face = false, pose = false, windows = [], fps = 5, force = false, home = SIGNAL_HOME } = {}) {
  if (![2, 3, 5, 6, 10, 15, 30].includes(fps)) fail('--fps deve ser 2, 3, 5, 6, 10, 15 ou 30 (amostragem, não precisão de corte)');
  const runtime = signalRuntimeStatus({ face, pose, home });
  if (!runtime.ok) fail(`${runtime.reason}. ${runtime.hint}`);
  const raw = rawPath(project), media = fileHash(raw), info = probe(raw);
  const kind = face || pose ? 'face' : 'audio';
  let proxy = null, normalized = [];
  if (kind === 'audio' && !info.audio) fail('fonte sem áudio');
  if (kind === 'face') {
    normalized = mergeWindows(windows, info.duration);
    if (!normalized.length) fail('MediaPipe requer --from/--to ou --boundaries; evite análise visual integral por padrão');
    const evidence = readJson(join(project.paths.analysis, 'evidence.json'));
    if (evidence.source_signature !== sourceSignature(project)) fail('rode analyze para atualizar o proxy');
    proxy = resolve(ROOT, evidence.preview);
    const item = evidence.items.find((e) => e.type === 'overview-video' && resolve(ROOT, e.path) === proxy);
    if (!item || item.sha256 !== fileHash(proxy)) fail('proxy alterado; rode analyze --force');
  }
  const input = signalInput({ media, duration: info.duration, offset: info.timeline.audio_offset,
    runtime, kind, proxy: proxy ? fileHash(proxy) : null, windows: normalized, pose, fps });
  const key = digest(input), dir = join(project.paths.analysis, 'signals', key);
  mkdirSync(dir, { recursive: true });
  const destination = join(dir, 'report.json');
  const cached = !force && readCache('signals', input);
  if (cached) restoreCache(cached, 'report.json', destination);
  else {
    mkdirSync(join(SIGNAL_HOME, 'work'), { recursive: true });
    const work = mkdtempSync(join(SIGNAL_HOME, 'work', 'infer-'));
    try {
      let source = proxy;
      if (kind === 'audio') {
        source = join(work, 'source.wav');
        const alignment = audioTimelineFilter({ offset: info.timeline.audio_offset, duration: info.duration, sampleRate: 16000 });
        run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-map', '0:a:0', '-vn', '-af', `${alignment},apad,atrim=end_sample=${Math.round(info.duration * 16000)}`,
          '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', source]);
      }
      const report = validateSignalReport(runSignalWorker(runtime, { kind, input: source, windows: normalized, fps, pose }, work), input);
      write(destination, { ...report, input });
      writeCache('signals', input, { files: { 'report.json': destination }, replace: force });
    } finally { rmSync(work, { recursive: true, force: true }); }
  }
  validateSignalReport(readJson(destination), input);
  const path = join(project.paths.analysis, 'signals.json');
  let previous;
  try { previous = readJson(path); } catch { previous = null; }
  // Keep independently sampled visual windows. Replace audio globally and the exact visual request.
  const reports = previous?.media === media ? (previous.reports ?? []).filter((r) => r.key !== key && !(kind === 'audio' && r.kind === 'audio')) : [];
  reports.push({ kind, key, path: relative(project.paths.analysis, destination), sha256: fileHash(destination) });
  const index = { schema: 1, clock: 'source-video', media, duration: info.duration, reports };
  write(path, index);
  summary(project, index);
  index.summary = { inputs: summaryInputs(project), signal_state: readSignals(project).signal_state,
    sha256: fileHash(join(project.paths.analysis, 'SIGNALS.md')) };
  write(path, index);
  console.log(`Signals ${kind}: ${cached ? 'cache íntegro' : 'medido localmente'} → ${relative(ROOT, join(project.paths.analysis, 'SIGNALS.md'))}`);
  return { input, cached: Boolean(cached), report: readJson(destination) };
}

export function analyzeSignals(project, mode = 'auto', force = false) {
  if (!['auto', 'required', 'off'].includes(mode)) fail('--signals deve ser auto, required ou off');
  if (mode === 'off') return;
  try { return generateSignals(project, { force }); }
  catch (error) {
    if (mode === 'required') throw error;
    console.warn(`Aviso: Silero não executado nesta análise (${error.message}). Fluxo audiovisual continua; não presumir sinais atualizados.`);
  }
}
