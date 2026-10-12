import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadProject, rel, setStage } from '../lib/project.mjs';
import { candidateWindows, emptyEditPlan, evidenceFileErrors, sourceSignature, validateEditPlan } from '../lib/editorial.mjs';
import { buildPostChain, tightenWords } from '../lib/cuts.mjs';
import { audioTimelineFilter, probe } from '../lib/media.mjs';
import { digest, fileHash } from '../lib/fingerprint.mjs';
import { readCache, restoreCache, toolVersions, writeCache } from '../lib/cache.mjs';
import { contactSheets } from '../lib/frames.mjs';
import { ROOT, fail, numberFlag, parseArgs, readJson, run } from '../lib/util.mjs';

const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
function transcript(project) {
  const path = join(project.paths.transcript, 'transcript.raw.json');
  if (!existsSync(path)) fail('rode transcribe antes de analyze');
  const data = readJson(path);
  if (data.timeline !== 'source-video') fail('transcrição antiga: regenere com transcribe --force para alinhar o relógio');
  return data;
}

export function analyze(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['force'] });
  const project = loadProject(positional[0]);
  const words = transcript(project).words;
  const signature = sourceSignature(project);
  const path = join(project.paths.analysis, 'evidence.json');
  const step = numberFlag(flags, 'every', 2);
  if (step < 0.2 || step > 10) fail('--every deve ficar entre 0.2 e 10 segundos');
  const cached = existsSync(path) ? readJson(path) : null;
  if (cached?.source_signature === signature && cached.sampling_step === step && !evidenceFileErrors(cached).length && !flags.force) return console.log(`Evidências em cache: ${rel(path)}. Use inspect para aprofundar intervalos.`);
  setStage(project, 'analysis', 'in-progress');
  const raw = join(project.dir, project.data.source.file);
  const info = probe(raw);
  // Pictures depend on media and sampling, not spelling. Semantic review still uses sourceSignature.
  const visualInput = { revision: 3, media: fileHash(raw), step, tools: toolVersions() };
  const visualKey = digest(visualInput);
  const dir = join(project.paths.analysis, visualKey.slice(0, 12));
  mkdirSync(dir, { recursive: true });
  const preview = join(dir, 'overview.mp4');
  const factor = Math.min(1, 720 / Math.max(info.video.width, info.video.height));
  const width = Math.round(info.video.width * factor / 2) * 2;
  const height = Math.round(info.video.height * factor / 2) * 2;
  const post = buildPostChain({ source: info.video, width, height });
  const mediaCache = !flags.force && readCache('overview', visualInput);
  let sheets;
  if (mediaCache) {
    restoreCache(mediaCache, 'overview.mp4', preview);
    sheets = mediaCache.metadata.sheets.map((name) => {
      const destination = join(dir, 'overview', name);
      restoreCache(mediaCache, name, destination);
      return destination;
    });
    console.log('Imagens e proxy reaproveitados; a decisão editorial continua vinculada à transcrição atual.');
  } else {
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-vf', `setpts=PTS-STARTPTS,fps=30,${post}`, '-af', audioTimelineFilter({ offset: info.timeline.audio_offset, duration: info.duration }),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', preview]);
    const count = probe(preview).video.frames;
    const shots = Array.from({ length: Math.ceil(info.duration / step) }, (_, i) => {
      const frame = Math.min(count - 1, Math.ceil(i * step * 30 - 1e-6));
      return { frame: Math.max(0, frame), time: Math.max(0, frame / 30) };
    });
    sheets = contactSheets(preview, shots, join(dir, 'overview'), { columns: 4, rows: 3, thumbWidth: 270 });
    const names = sheets.map((_, i) => `sheet-${i + 1}.png`);
    writeCache('overview', visualInput, { files: { 'overview.mp4': preview, ...Object.fromEntries(names.map((name, i) => [name, sheets[i]])) }, metadata: { sheets: names }, replace: Boolean(flags.force) });
  }
  const items = sheets.map((p, i) => ({ id: `overview-${i + 1}`, type: 'contact-sheet', start: i * 12 * step, end: Math.min(info.duration, (i + 1) * 12 * step), path: rel(p), sha256: fileHash(p) }));
  items.push({ id: 'source-motion', type: 'overview-video', start: 0, end: info.duration, path: rel(preview), sha256: fileHash(preview) });
  const candidates = candidateWindows(words, info.duration);
  if (cached?.visual_key === visualKey && !flags.force && !evidenceFileErrors(cached).length) {
    items.push(...cached.items.filter((item) => item.type === 'motion-clip'));
  }
  write(path, { schema: 1, source_signature: signature, visual_key: visualKey, sampling_step: step, duration: info.duration, clock: 'source-video', preview: rel(preview), items, candidates });
  const editPath = join(project.paths.cut, 'edit-plan.json');
  if (!existsSync(editPath)) write(editPath, emptyEditPlan(signature, info.duration));
  writeFileSync(join(project.paths.analysis, 'REVIEW.md'), [
    '# Evidências para seleção de takes', '', `Fonte: ${rel(raw)} · ${info.duration}s. Tempos no relógio do vídeo.`,
    '', 'Leia a transcrição e abra TODAS as folhas. Elas não comprovam prosódia ou continuidade do movimento.',
    'Use `vid inspect <projeto> --from S --to E` para examinar preparação, retomadas, fim de atuação e bordas. Assista ao clip se houver reprodução disponível; caso contrário examine a sequência densa e declare essa limitação.',
    'Não remova automaticamente olhar lateral, respiração, gesto, demonstração sem fala ou pausa dramática. Evidências visuais são observações, nunca diagnósticos de intenção.',
    '', ...items.map((e) => `- ${e.id}: ${e.path} (${e.start}–${e.end})`), '',
    '## Candidatos, não decisões', ...candidates.map((c) => `- ${c.start.toFixed(2)}–${c.end.toFixed(2)}: ${c.cue}`), '',
    'Preencha 02-cut/edit-plan.json com keeps na ordem final, descartes que cubram o restante, observações e justificativas. Na dúvida mantenha.',
  ].join('\n'));
  setStage(project, 'analysis', 'done', `${items.length} evidências; seleção editorial pendente`);
  console.log(`Evidências: ${rel(path)}\nLeia ${rel(join(project.paths.analysis, 'REVIEW.md'))}`);
}

export function inspect(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['force'] });
  const project = loadProject(positional[0]);
  const path = join(project.paths.analysis, 'evidence.json');
  if (!existsSync(path)) fail('rode analyze antes de inspect');
  const evidence = readJson(path);
  if (evidence.source_signature !== sourceSignature(project)) fail('evidências antigas: rode analyze');
  const start = numberFlag(flags, 'from', NaN), end = numberFlag(flags, 'to', NaN);
  if (!(start >= 0 && end > start && end <= evidence.duration)) fail('informe --from e --to dentro da duração da fonte');
  const id = `detail-${Math.round(start * 1000)}-${Math.round(end * 1000)}`;
  const step = Math.max(0.1, numberFlag(flags, 'every', 0.25));
  const previous = evidence.items.find((item) => item.id === id);
  if (!flags.force && previous?.sampling_step === step && previous.sheet_hashes && !evidenceFileErrors({ items: [previous] }).length) {
    return console.log(`Inspeção em cache: ${previous.path}\n${previous.sheets.join('\n')}`);
  }
  const dir = join(project.paths.analysis, evidence.source_signature.slice(0, 12), id);
  mkdirSync(dir, { recursive: true });
  const clip = join(dir, 'motion.mp4');
  // Stored paths are repo-relative, independent of shell cwd.
  const source = evidence.preview.startsWith('/') ? evidence.preview : join(ROOT, evidence.preview);
  const detailInput = { revision: 2, preview: fileHash(source), start, end, step, tools: toolVersions() };
  const detailCache = !flags.force && readCache('detail', detailInput);
  let sheets;
  if (detailCache) {
    restoreCache(detailCache, 'motion.mp4', clip);
    sheets = detailCache.metadata.sheets.map((name) => {
      const destination = join(dir, 'frames', name);
      restoreCache(detailCache, name, destination);
      return destination;
    });
  } else {
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-i', source, '-t', String(end - start), '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', clip]);
    const count = probe(clip).video.frames;
    const shots = Array.from({ length: Math.ceil((end - start) / step) }, (_, i) => {
      const frame = Math.max(0, Math.min(count - 1, Math.ceil(i * step * 30 - 1e-6)));
      return { frame, time: frame / 30, label: `${(start + frame / 30).toFixed(2)}s fonte` };
    });
    sheets = contactSheets(clip, shots, join(dir, 'frames'), { columns: 6, rows: 3, thumbWidth: 240 });
    const names = sheets.map((_, i) => `sheet-${i + 1}.png`);
    writeCache('detail', detailInput, { files: { 'motion.mp4': clip, ...Object.fromEntries(names.map((name, i) => [name, sheets[i]])) }, metadata: { sheets: names }, replace: Boolean(flags.force) });
  }
  evidence.items = evidence.items.filter((e) => e.id !== id);
  evidence.items.push({ id, type: 'motion-clip', start, end, path: rel(clip), sha256: fileHash(clip), sampling_step: step, sheets: sheets.map(rel), sheet_hashes: Object.fromEntries(sheets.map((p) => [rel(p), fileHash(p)])) });
  write(path, evidence);
  setStage(project, 'analysis', 'done', id);
  console.log(`${id}: ${rel(clip)}\n${sheets.map(rel).join('\n')}`);
}

export function editorial(args) {
  const project = loadProject(args[0]);
  const planPath = join(project.paths.cut, 'edit-plan.json');
  if (!existsSync(planPath)) fail('rode analyze para preparar edit-plan.json');
  const evidence = readJson(join(project.paths.analysis, 'evidence.json'));
  // Mesmo alinhamento que `cut` usa: o fim das palavras vem do silêncio medido no áudio, quando
  // existe. Sem isso este comando rejeita bordas que o corte aceita, e pede para manter silêncio.
  const silencePath = join(project.paths.cut, 'silences.json');
  const raw = transcript(project).words;
  const words = existsSync(silencePath) ? tightenWords(raw, readJson(silencePath).silences) : raw;
  const errors = [...evidenceFileErrors(evidence), ...validateEditPlan(readJson(planPath), evidence, words, project.data.source.duration, sourceSignature(project))];
  if (errors.length) fail(errors.join('\n'));
  console.log('Plano editorial válido: fala + vídeo revisados, decisões completas e bordas preservadas.');
}
