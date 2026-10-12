// E5/E6: inspeção técnica, comparação da fala e revisão audiovisual explícita.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { contactSheets, cutBoundaries, cutBoundaryShots, cardShots, sequenceShots } from '../lib/frames.mjs';
import { compileStoryboard } from '../lib/storyboard.mjs';
import { detectSilences, detectVideoDefects, measureLoudness, probe } from '../lib/media.mjs';
import { finishStage, loadProject, rel, saveProject, setStage } from '../lib/project.mjs';
import { fileHash, stageSignature } from '../lib/fingerprint.mjs';
import { compareSpeech } from '../lib/speech-review.mjs';
import { extractAudio, cachedTranscribe } from '../lib/transcribe.mjs';
import { ROOT, clock, fail, numberFlag, parseArgs, readJson, round, run } from '../lib/util.mjs';

/** Vídeo alvo: --file, senão o último render, senão o corte limpo. */
function pickVideo(project, flags) {
  if (flags.file) {
    const path = isAbsolute(flags.file) ? flags.file : resolve(ROOT, flags.file);
    if (!existsSync(path)) fail(`arquivo não encontrado: ${flags.file}`);
    return path;
  }
  if (flags.clean) return join(project.paths.cut, 'clean.mp4');
  const last = project.data.renders.at(-1);
  const path = last ? join(project.dir, last.file) : join(project.paths.cut, 'clean.mp4');
  if (!existsSync(path)) fail('nenhum vídeo para inspecionar ainda. Rode `vid cut` primeiro.');
  return path;
}

export function frames(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['cuts', 'cards', 'clean', 'big'] });
  if ((flags.context !== undefined || flags.boundary !== undefined) && !flags.cuts) fail('--context e --boundary exigem --cuts');
  if (flags.cuts && (flags.diff || flags.seq || flags.cards || flags.at)) fail('use --cuts separado de --diff, --seq, --cards e --at');
  if (flags.cuts && flags.step !== undefined) fail('--cuts --context usa quadros consecutivos; --step pertence a --seq');
  const project = loadProject(positional[0]);
  const video = pickVideo(project, flags);
  const info = probe(video);
  const { duration } = info;
  let shots = [];
  let name = 'overview';

  if (flags.diff) {
    name = 'changed-sequences';
    const report = readJson(resolve(ROOT, flags.diff));
    if (report.after_hash !== fileHash(video)) fail('diff pertence a outro render');
    if (!Array.isArray(report.required_ranges)) fail('diff sem required_ranges');
    for (const range of report.required_ranges) {
      if (![range.from, range.to].every(Number.isInteger) || range.from < 0 || range.to < range.from || range.to >= report.total_frames || range.to - range.from > 20000) fail('intervalo de diff inválido');
      for (let n = range.from; n <= range.to; n++) shots.push({ frame: n, time: n / info.video.fps, label: `q${n}` });
    }
    if (!shots.length) return console.log('Nenhum quadro alterado; confira o áudio e as exigências semânticas no diff.');
  } else if (flags.cuts) {
    name = 'cut-boundaries';
    const edl = readJson(join(project.paths.cut, 'edl.json'));
    try {
      const boundaries = cutBoundaries(edl);
      shots = cutBoundaryShots(edl, { context: numberFlag(flags, 'context', 0), boundary: flags.boundary ?? null });
      // Some containers omit nb_frames. Count decoded frames only in that case;
      // container duration can include an audio tail and is not an exact frame count.
      const totalFrames = info.video.frames ?? Number(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'default=noprint_wrappers=1:nokey=1', video]).stdout.trim());
      if (info.video.variable_frame_rate || Math.abs(info.video.fps - edl.fps) > 0.00051 || totalFrames !== boundaries.at(-1).frame) fail('vídeo e EDL têm relógios diferentes; selecione o corte/render correspondente');
    } catch (error) { fail(error.message); }
  } else if (flags.cards) {
    // Três momentos por card: entrada, quadro-herói (meio) e saída.
    name = 'cards';
    const storyboardPath = join(project.paths.plan, 'storyboard.json');
    if (!existsSync(storyboardPath)) fail(`falta ${rel(storyboardPath)}`);
    const words = readJson(join(project.paths.cut, 'transcript.json')).words;
    const edl = readJson(join(project.paths.cut, 'edl.json'));
    const board = compileStoryboard(readJson(storyboardPath), words, edl.edited_duration);
    shots = cardShots(board.cards, edl.fps);
  } else if (flags.seq) {
    // Quadros consecutivos: é o que mostra se uma animação acontece aos poucos ou surge de uma vez.
    name = 'sequence';
    const [from, to] = String(flags.seq).split(/[-:]/).map(Number);
    try { shots = sequenceShots(from, to, probe(video).video.fps, numberFlag(flags, 'step', 1)); } catch (error) { fail(`--seq: ${error.message}`); }
    if (shots.length > 2000) fail(`--seq daria ${shots.length} quadros; divida o intervalo. Para revisar movimento, preserve --step 1.`);
  } else if (flags.at) {
    name = 'moments';
    shots = String(flags.at).split(',').map(Number).filter(Number.isFinite).map((time) => ({ time }));
  } else {
    const step = numberFlag(flags, 'every', Math.max(1, duration / 18));
    if (step <= 0) fail('--every deve ser positivo');
    for (let t = step / 2; t < duration; t += step) shots.push({ time: t });
  }
  shots = shots.filter((s) => s.frame !== undefined ? s.frame >= 0 && (!info.video.frames || s.frame < info.video.frames) : s.time >= 0 && s.time < duration);
  if (!shots.length) fail('nenhum quadro para extrair com esses parâmetros.');

  let crop = null;
  if (flags.crop) {
    const [x, y, w, h] = String(flags.crop).split(',').map(Number);
    if (![x, y, w, h].every(Number.isInteger)) fail('--crop espera x,y,largura,altura em pixels do vídeo, ex.: --crop 180,520,760,520');
    crop = { x, y, w, h };
  }
  const outDir = join(project.paths.review, flags.name ?? name);
  const layout = flags.big ? { columns: 4, rows: 2, thumbWidth: 540 } : { columns: 6, rows: 3, thumbWidth: 360 };
  let sheets;
  try { sheets = contactSheets(video, shots, outDir, { ...layout, name, crop }); } catch (error) { fail(error.message); }
  console.log(`${shots.length} quadros de ${rel(video)}:`);
  for (const sheet of sheets) console.log(`  ${rel(sheet)}`);
  console.log('Abra cada folha com a ferramenta de leitura de imagem e descreva o que vê antes de concluir qualquer coisa.');
  if (flags.cuts && numberFlag(flags, 'context', 0) === 0) console.log('Resumo estático: use --cuts --context 0.5 (opcional --boundary c01) para conferir a evolução das bordas, incluindo start/end.');
}

export function loudness(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['clean'] });
  const video = positional[0] && existsSync(positional[0]) ? resolve(positional[0]) : pickVideo(loadProject(positional[0]), flags);
  const result = measureLoudness(video);
  console.log(`${rel(video)}: ${result.lufs.toFixed(1)} LUFS · true peak ${result.true_peak.toFixed(1)} dBTP · LRA ${result.lra.toFixed(1)}`);
}

export async function verify(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['clean', 'final', 'speech'] });
  const project = loadProject(positional[0]);
  const { data, paths } = project;
  const video = pickVideo(project, flags);
  const info = probe(video);
  const finalCheck = flags.final || basename(video) === 'final.mp4';
  const checks = [];
  const add = (level, name, ok, detail) => checks.push({ level, name, ok, detail });

  let { width, height, fps } = data.format;
  if (flags.clean) { width = info.video.width; height = info.video.height; }
  add('error', 'formato', info.video.width === width && info.video.height === height, `${info.video.width}x${info.video.height} (esperado ${width}x${height})`);
  add('error', 'taxa de quadros', Math.abs(info.video.fps - fps) < 0.05, `${info.video.fps} fps (esperado ${fps})`);
  add('error', 'pixel format', info.video.pix_fmt === 'yuv420p' && !info.video.hdr, `${info.video.pix_fmt}${info.video.hdr ? ' HDR' : ''} (esperado yuv420p SDR)`);
  add('error', 'trilha de áudio', Boolean(info.audio), info.audio ? `${info.audio.codec} ${info.audio.sample_rate} Hz` : 'ausente');

  const edlPath = join(paths.cut, 'edl.json');
  if (existsSync(edlPath)) {
    const edl = readJson(edlPath);
    const expected = edl.edited_duration;
    const diff = info.duration - expected;
    add(diff < -0.5 ? 'error' : 'warn', 'duração', Math.abs(diff) <= 0.2, `${info.duration}s (corte tem ${expected}s, diferença ${diff.toFixed(2)}s)`);
    const count = edl.keep.reduce((n, k) => n + k.end_frame - k.start_frame, 0);
    if (info.video.frames !== null) add('error', 'contagem de quadros', info.video.frames === count, `${info.video.frames} (esperado ${count})`);
  }

  const defects = detectVideoDefects(video, info.duration);
  const boardPath = join(paths.plan, 'storyboard.json');
  const holds = existsSync(boardPath) ? readJson(boardPath).intentional_holds ?? [] : [];
  defects.frozen = defects.frozen.filter((f) => !holds.some((h) => h.reason?.trim() && h.start <= f.start && h.end >= f.end));
  add('warn', 'tela preta', defects.black.length === 0, defects.black.length ? defects.black.map((b) => `${clock(b.start)}–${clock(b.end)}`).join(', ') : 'nenhuma');
  add('warn', 'imagem congelada', defects.frozen.length === 0, defects.frozen.length
    ? `${defects.frozen.map((f) => `${clock(f.start)}–${clock(f.end)}`).join(', ')} (normal em card estático de tela cheia; confira os quadros)`
    : 'nenhuma');

  if (info.audio) {
    const audio = measureLoudness(video);
    const strict = finalCheck;
    const targetLufs = data.final?.target_lufs ?? -14;
    const inRange = Math.abs(audio.lufs - targetLufs) <= 1.5;
    add(strict ? 'error' : 'warn', 'loudness', strict ? inRange : audio.lufs > -30, `${audio.lufs.toFixed(1)} LUFS${strict ? ` (alvo ${targetLufs} ±1,5)` : ' (a entrega aplica o alvo configurado)'}`);
    add(strict ? 'error' : 'warn', 'true peak', audio.true_peak <= -0.9, `${audio.true_peak.toFixed(1)} dBTP (limite -1,0)`);
    const noise = Math.min(-30, Math.max(-50, Math.round(audio.lufs - 20)));
    const dead = detectSilences(video, { noiseDb: noise, minDuration: 1.0, duration: info.duration });
    add('warn', 'silêncio longo', dead.length === 0, dead.length ? dead.map((s) => `${clock(s.start)} (${(s.end - s.start).toFixed(1)}s)`).join(', ') : 'nenhum acima de 1s');
  }

  mkdirSync(paths.review, { recursive: true });
  let speech = null;
  if (flags.speech) {
    const work = mkdtempSync(join(tmpdir(), 'vid-speech-review-'));
    try {
      const audio = join(work, 'audio.wav');
      extractAudio(video, audio);
      const { transcript: heard, cache_hit } = await cachedTranscribe(audio, { provider: flags.provider ?? 'local', language: data.language, duration: info.duration });
      // Recompute the comparison even on a cache hit: captions/expected words may have changed.
      speech = { ...compareSpeech(readJson(join(paths.cut, 'transcript.json')).words, heard.words), asr_cache_hit: cache_hit };
      add('warn', 'fidelidade da fala', speech.issues.length === 0, `${speech.issues.length} diferenças para revisão; ASR pode errar números e nomes`);
    } finally { rmSync(work, { recursive: true, force: true }); }
  }
  const report = { file: rel(video), file_hash: fileHash(video), composition_signature: stageSignature(project, 'composition'), at: new Date().toISOString(), duration: info.duration, checks, speech };
  const reportPath = join(paths.review, finalCheck ? 'verify.final.json' : 'verify.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`Verificação de ${rel(video)}:`);
  for (const check of checks) console.log(`  ${check.ok ? 'ok  ' : check.level === 'error' ? 'ERRO' : 'aviso'}  ${check.name.padEnd(18)} ${check.detail}`);
  const errors = checks.filter((c) => !c.ok && c.level === 'error');
  const warnings = checks.filter((c) => !c.ok && c.level === 'warn');
  console.log(`\n${errors.length} erro(s), ${warnings.length} aviso(s). Relatório: ${rel(reportPath)}`);
  console.log('Isto confere formato e sinais técnicos. Ritmo, legibilidade e som só a inspeção dos quadros e a pessoa assistindo confirmam.');
  process.exitCode = errors.length ? 1 : 0;
  return report;
}

export async function finalize(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['force'] });
  const project = loadProject(positional[0]);
  const { data, paths } = project;
  if (data.stages.review !== 'done' && !flags.force) {
    fail(`o draft ainda não foi aprovado (etapa "${data.stages.review}"). Depois da aprovação: \`vid gate ${project.slug} draft --approve\`.`);
  }
  const source = pickVideo(project, flags);
  const last = data.renders.at(-1);
  if (!last || last.quality === 'draft' || last.media_tier !== 'master') fail('entrega requer render em qualidade looks a partir do master');
  if (last.composition_signature !== stageSignature(project, 'composition')) fail('render desatualizado: composição mudou');
  const approvedReview = readJson(join(paths.review, 'review.json'));
  if (approvedReview.file_hash !== fileHash(source) || !approvedReview.complete) fail('a revisão não corresponde a este arquivo');
  setStage(project, 'final', 'in-progress', 'normalização e verificação da entrega');
  const target = numberFlag(flags, 'lufs', -14);
  if (target < -70 || target > -5) fail('--lufs precisa ficar entre -70 e -5');
  const spec = `I=${target}:TP=-1.5:LRA=11`;

  // Duas passadas: mede, depois aplica ganho linear com os valores medidos. Uma passada só bombeia o volume.
  const { stderr } = run('ffmpeg', ['-hide_banner', '-nostats', '-i', source, '-vn', '-af', `loudnorm=${spec}:print_format=json`, '-f', 'null', '-']);
  const measured = JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));
  const filter = `loudnorm=${spec}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  const out = join(paths.renders, 'final.mp4');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-map', '0:v:0', '-map', '0:a:0',
    '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out]);

  const result = measureLoudness(out);
  data.final = { file: '05-renders/final.mp4', from: rel(source), target_lufs: target, lufs: round(result.lufs, 1), true_peak: round(result.true_peak, 1), at: new Date().toISOString() };
  saveProject(project);
  const report = await verify([project.dir, '--file', out, '--final']);
  if (report.checks.some((c) => c.level === 'error' && !c.ok)) fail('a entrega falhou na verificação final');
  setStage(project, 'final', 'done', `${result.lufs.toFixed(1)} LUFS`);
  console.log(`Final: ${rel(out)} · ${Number(measured.input_i).toFixed(1)} → ${result.lufs.toFixed(1)} LUFS · true peak ${result.true_peak.toFixed(1)} dBTP`);
  console.log(`Confira com: node scripts/vid.mjs verify ${project.slug} --file ${rel(out)}`);
}

const REVIEW_CHECKS = ['meaning', 'performance', 'seams', 'captions', 'visuals', 'audio', 'references'];
export function review(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['complete'] });
  const project = loadProject(positional[0]);
  const video = pickVideo(project, flags);
  const hash = fileHash(video);
  const path = join(project.paths.review, 'review.json');
  const strategyHash = fileHash(join(project.dir, 'strategy.json'));
  const checks = [...REVIEW_CHECKS, ...(strategyHash ? ['strategy'] : [])];
  if (!flags.complete) {
    if (existsSync(path)) {
      const previous = readJson(path);
      if (previous.file_hash === hash && (previous.strategy_hash ?? null) === strategyHash && checks.every((key) => previous.checks?.[key])) return console.log(rel(path));
    }
    if (existsSync(path)) writeFileSync(join(project.paths.review, `review-${Date.now()}.json`), JSON.stringify(readJson(path), null, 2));
    writeFileSync(path, JSON.stringify({ schema: 1, file: rel(video), file_hash: hash, ...(strategyHash ? { strategy_hash: strategyHash } : {}), complete: false, reviewer: '', method: '', checks: Object.fromEntries(checks.map((key) => [key, { ok: false, notes: '' }])) }, null, 2) + '\n');
    return console.log(`Preencha ${rel(path)} após examinar o render; execute review --complete.`);
  }
  const notes = readJson(path);
  if (notes.file_hash !== hash) fail('revisão pertence a outro render');
  if ((notes.strategy_hash ?? null) !== strategyHash) fail('estratégia mudou: prepare e examine uma nova revisão');
  if (!notes.reviewer?.trim() || !['playback', 'asr-and-frames', 'human-playback'].includes(notes.method)) fail('declare reviewer e method: playback | asr-and-frames | human-playback');
  for (const key of checks) if (!notes.checks?.[key]?.ok || !notes.checks[key].notes?.trim()) fail(`revisão incompleta: ${key}`);
  const technical = readJson(join(project.paths.review, 'verify.json'));
  if (technical.file_hash !== hash || technical.checks.some((c) => c.level === 'error' && !c.ok)) fail('rode verify para este render e corrija erros técnicos');
  if (notes.method === 'asr-and-frames' && !technical.speech) fail('método asr-and-frames requer verify --speech neste render');
  const last = project.data.renders.at(-1);
  if (!last || last.composition_signature !== stageSignature(project, 'composition')) fail('o render não corresponde à composição atual');
  notes.complete = true;
  writeFileSync(path, JSON.stringify(notes, null, 2) + '\n');
  finishStage(project, 'review', 'revisão audiovisual documentada');
  console.log('Revisão concluída e vinculada ao conteúdo deste render.');
}
