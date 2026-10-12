// E2: corte. `silences` mede e propõe; `cut` aplica cuts.json e gera o vídeo limpo.
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCutFilter, buildEdl, buildPostChain, DEFAULTS, mergeDeletes, mergeSilences, proposeSilenceCuts, resolveCut, retimeWords, tightenWords } from '../lib/cuts.mjs';
import { contactSheets, cutBoundaryShots } from '../lib/frames.mjs';
import { detectSilences, filterFileArgs, measureLoudness, probe } from '../lib/media.mjs';
import { finishStage, loadProject, rel, saveProject, setStage } from '../lib/project.mjs';
import { evidenceFileErrors, sourceSignature, validateEditPlan } from '../lib/editorial.mjs';
import { readCache, restoreCache, toolVersions, writeCache } from '../lib/cache.mjs';
import { fileHash } from '../lib/fingerprint.mjs';
import { clock, fail, numberFlag, parseArgs, readJson, round, run } from '../lib/util.mjs';

function loadInputs(project) {
  const transcriptPath = join(project.paths.transcript, 'transcript.raw.json');
  if (!existsSync(transcriptPath)) fail(`falta a transcrição. Rode: node scripts/vid.mjs transcribe ${project.slug}`);
  return {
    transcript: readJson(transcriptPath),
    source: readJson(join(project.paths.source, 'source.json')),
    raw: join(project.dir, project.data.source.file),
  };
}

export function silences(args) {
  const { flags, positional } = parseArgs(args);
  const project = loadProject(positional[0]);
  const { transcript, source, raw } = loadInputs(project);
  const audio = join(project.paths.transcript, 'audio.wav');
  const input = existsSync(audio) ? audio : raw;

  // O limiar acompanha o volume da gravação: 20 dB abaixo do loudness da fala, dentro de limites seguros.
  const loudness = measureLoudness(input);
  const auto = Math.min(-30, Math.max(-50, Math.round(loudness.lufs - 20)));
  const noiseDb = numberFlag(flags, 'noise', auto);
  const found = detectSilences(input, { noiseDb, minDuration: 0.12, duration: source.duration });

  const params = { ...DEFAULTS, gap: numberFlag(flags, 'gap', DEFAULTS.gap) };
  const words = tightenWords(transcript.words, found);
  const proposed = proposeSilenceCuts({ silences: found, words, duration: source.duration, params });

  // Preserva decisões já tomadas: cortes de erro e silêncios aprovados ou rejeitados à mão.
  const cutsPath = join(project.paths.cut, 'cuts.json');
  const previous = existsSync(cutsPath) ? readJson(cutsPath).cuts : [];
  const automatic = (c) => c.kind === 'silence' || c.kind === 'noise';
  const decided = previous.filter((c) => automatic(c) && ['approved', 'rejected'].includes(c.status));
  for (const cut of proposed) {
    const match = decided.find((c) => Math.abs(c.start - cut.start) < 0.05 && Math.abs(c.end - cut.end) < 0.05);
    if (match) cut.status = match.status;
  }
  const kept = previous.filter((c) => !automatic(c));

  writeFileSync(join(project.paths.cut, 'silences.json'), JSON.stringify({ noise_db: noiseDb, source_lufs: loudness.lufs, silences: found }, null, 2) + '\n');
  writeFileSync(cutsPath, JSON.stringify({
    schema: 1,
    how_to: 'status: auto | approved | rejected | flagged. Só auto e approved são aplicados. Cortes de erro: kind "mistake" com from_word/to_word (índices de transcript.raw.json, inclusive) e reason.',
    source_duration: source.duration,
    params,
    cuts: [...proposed, ...kept],
  }, null, 2) + '\n');

  const total = proposed.filter((c) => c.status === 'auto').reduce((sum, c) => sum + c.end - c.start, 0);
  const flagged = proposed.filter((c) => c.status === 'flagged');
  console.log(`Fala em ${loudness.lufs.toFixed(1)} LUFS; silêncio = abaixo de ${noiseDb} dB.`);
  console.log(`${found.length} silêncios medidos, ${proposed.length} cortes propostos (${total.toFixed(1)}s de ${source.duration}s).`);
  if (flagged.length) console.log(`${flagged.length} marcados para revisão (flagged): leia o campo "flag" de cada um em cuts.json.`);
  if (kept.length) console.log(`${kept.length} corte(s) manuais preservados.`);
  console.log(`→ ${rel(cutsPath)}`);
  console.log(`Próximo: revisar erros e retakes na transcrição, acrescentar em cuts.json e rodar \`node scripts/vid.mjs cut ${project.slug}\`.`);
}

function reviewDoc({ project, cuts, context, edl, words, edited }) {
  const { duration } = context;
  const removed = duration - edl.edited_duration;
  const text = (from, to) => context.words.slice(from, to + 1).map((w) => w.text).join(' ');
  const lines = [
    `# Revisão do corte: ${project.slug}`,
    '',
    `Bruto ${clock(duration)} → cortado **${clock(edl.edited_duration)}** (${removed.toFixed(1)}s removidos, ${((removed / duration) * 100).toFixed(0)}%), em ${edl.keep.length} trechos.`,
    '',
    'Assista `02-cut/clean.mp4` e leia abaixo. Se algo saiu errado, diga o que mudar; nada segue sem sua aprovação.',
    '',
    '## Falas removidas (erros, retakes, trechos descartados)',
    '',
  ];
  const mistakes = cuts.filter((c) => c.kind !== 'silence' && c.kind !== 'noise' && ['auto', 'approved'].includes(c.status));
  if (!mistakes.length) lines.push('Nenhuma fala removida, só silêncio.');
  for (const cut of mistakes) {
    const { start, end } = resolveCut(cut, context);
    const said = cut.kind === 'mistake' ? `“${text(cut.from_word, cut.to_word ?? cut.from_word)}”` : '(trecho por tempo)';
    lines.push(`- ${clock(start)}–${clock(end)} · ${said}. Motivo: ${cut.reason ?? 'não informado'}`);
  }
  const flagged = cuts.filter((c) => c.status === 'flagged');
  if (flagged.length) {
    lines.push('', '## Pendentes de decisão (não aplicados)', '');
    for (const cut of flagged) lines.push(`- ${cut.id} ${clock(cut.start)}–${clock(cut.end)} · ${cut.flag ?? cut.reason}`);
  }
  const pauses = cuts
    .filter((c) => (c.kind === 'silence' || c.kind === 'noise') && ['auto', 'approved'].includes(c.status))
    .map((c) => ({ ...c, length: c.end - c.start }))
    .sort((a, b) => b.length - a.length)
    .slice(0, 10);
  lines.push('', '## Maiores silêncios removidos', '');
  for (const cut of pauses) lines.push(`- ${clock(cut.start)} · ${cut.length.toFixed(2)}s · ${cut.reason}`);
  lines.push('', '## Texto final (como ficou a fala)', '', words.map((w) => w.text).join(' '), '');
  lines.push(`Palavras: ${context.words.length} no bruto → ${edited} no corte.`, '');
  return lines.join('\n');
}

export function cut(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['dry-run', 'legacy', 'force'] });
  const project = loadProject(positional[0]);
  const { data, paths } = project;
  const { transcript, raw } = loadInputs(project);
  const source = probe(raw);
  if (transcript.timeline !== 'source-video') fail('regenere a transcrição para o relógio source-video antes de cortar');
  const silencePath = join(paths.cut, 'silences.json');
  const measured = existsSync(silencePath) ? readJson(silencePath).silences : [];
  const tight = tightenWords(transcript.words, measured);
  const context = { words: tight, silences: measured, duration: source.duration };
  const planPath = join(paths.cut, 'edit-plan.json');
  let selections, deletes = [], plan;
  if (!flags.legacy) {
    if (!existsSync(planPath)) fail('rode analyze e preencha edit-plan.json com a revisão da fala e do vídeo');
    plan = readJson(planPath);
    const evidence = readJson(join(paths.analysis, 'evidence.json'));
    const errors = [...evidenceFileErrors(evidence), ...validateEditPlan(plan, evidence, tight, source.duration, sourceSignature(project))];
    if (errors.length) fail(errors.join('\n'));
    selections = plan.segments;
  } else {
    const cuts = readJson(join(paths.cut, 'cuts.json'));
    deletes = mergeDeletes(cuts.cuts, { ...context, params: cuts.params });
  }
  const fps = data.format.fps;
  const edl = buildEdl({ selections, deletes, duration: source.duration, fps, words: tight });
  if (!edl.keep.length) fail('nenhum trecho selecionado');
  const words = retimeWords(tight, edl.keep);
  console.log(`Corte: ${clock(source.duration)} → ${clock(edl.edited_duration)} em ${edl.keep.length} trechos.`);
  if (flags['dry-run']) return console.log('Simulação: nenhum arquivo de corte foi gerado.');
  setStage(project, 'cut', 'in-progress', 'compilando seleção editorial');
  const write = (name, value) => writeFileSync(join(paths.cut, name), JSON.stringify(value, null, 2) + '\n');
  write('edl.json', { schema: 2, source: data.source.file, ...data.format, ...edl, deletes, selection_mode: flags.legacy ? 'legacy' : 'audiovisual' });
  write('transcript.json', { schema: 2, timeline: 'edited', language: transcript.language, audio_duration_secs: edl.edited_duration, words });
  writeFileSync(join(paths.cut, 'CUT-REVIEW.md'), [
    `# Corte: ${project.slug}`, '', `${clock(source.duration)} → ${clock(edl.edited_duration)}`, '',
    ...(plan?.segments ?? edl.keep).map((s) => `- Mantido ${s.start}–${s.end}: ${s.reason ?? ''}`),
    ...(plan?.discarded ?? []).map((s) => `- Removido ${s.start}–${s.end}: ${s.reason}`), '',
    '## Fala resultante', words.map((w) => w.text).join(' '), '',
    'Reproduza as emendas e confira sentido, respiração, gestos, início/fim da atuação. A revisão dos quadros não comprova naturalidade sonora.',
  ].join('\n'));
  const master = join(paths.cut, 'master.mp4');
  const pending = join(paths.cut, 'master.pending.mp4');
  const filterPath = join(paths.cut, 'cut.filter.txt');
  const post = buildPostChain({ source: source.video, width: source.video.width, height: source.video.height, tonemap: flags.tonemap });
  const filter = buildCutFilter({ keep: edl.keep, fps, post, duration: source.duration, audioOffset: source.timeline.audio_offset });
  writeFileSync(filterPath, filter);
  const crf = numberFlag(flags, 'crf', 16);
  if (crf < 0 || crf > 51) fail('--crf deve ficar entre 0 e 51');
  const mediaInput = { revision: 1, source: fileHash(raw), filter, fps, crf, tools: toolVersions() };
  const cached = !flags.force && readCache('cut-media', mediaInput);
  const clean = join(paths.cut, 'clean.mp4');
  if (cached) {
    restoreCache(cached, 'master.mp4', master);
    restoreCache(cached, 'proxy.mp4', clean);
    console.log('Master e proxy idênticos reaproveitados; texto e âncoras atualizados separadamente.');
  } else {
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, ...filterFileArgs(filterPath),
      '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
      '-g', String(Math.round(fps)), '-keyint_min', String(Math.round(fps)), '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', pending]);
    renameSync(pending, master);
    const factor = Math.min(1, 1280 / Math.max(source.video.width, source.video.height));
    const w = Math.round(source.video.width * factor / 2) * 2, h = Math.round(source.video.height * factor / 2) * 2;
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', master, '-vf', `scale=${w}:${h}`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-g', String(Math.round(fps)), '-c:a', 'copy', '-movflags', '+faststart', clean]);
    writeCache('cut-media', mediaInput, { files: { 'master.mp4': master, 'proxy.mp4': clean }, replace: Boolean(flags.force) });
  }
  if (edl.keep.length > 1) contactSheets(clean, cutBoundaryShots(edl), join(paths.review, 'cut-boundaries'), { columns: 6, rows: 3, name: 'cuts' });
  data.cut = { edited_duration: edl.edited_duration, segments: edl.keep.length, master: '02-cut/master.mp4', proxy: '02-cut/clean.mp4', source_size: [source.video.width, source.video.height] };
  saveProject(project);
  finishStage(project, 'cut', 'master em resolução original + proxy; revisar emendas');
  console.log(`Master: ${rel(master)}\nPrévia: ${rel(clean)}\nRevisão: ${rel(join(paths.cut, 'CUT-REVIEW.md'))}`);
}
