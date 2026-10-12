// Folhas de contato: vários quadros do vídeo numa imagem só, cada um com rótulo.
// É como o agente "vê" o resultado. Ele não assiste ao vídeo, lê estas imagens.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clock, run } from './util.mjs';
import { filterFileArgs, probe } from './media.mjs';
import { buildPostChain } from './cuts.mjs';
import { digest, fileHash } from './fingerprint.mjs';
import { toolVersions } from './cache.mjs';

const escapeText = (text) => String(text).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '').replace(/[\r\n]/g, ' ');

/**
 * Extrai um quadro por item de `shots` ({ time, label }) e monta folhas com `columns` por linha.
 * Devolve os caminhos das folhas geradas.
 */
export function contactSheets(video, shots, outDir, { columns = 6, rows = 3, thumbWidth = 360, name = 'sheet', crop = null } = {}) {
  if (!shots.length) return [];
  if (![columns, rows, thumbWidth].every((v) => Number.isInteger(v) && v > 0)) throw new Error('layout inválido');
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('nome de folha inválido');
  const key = digest({ revision: 2, video: fileHash(video), shots, columns, rows, thumbWidth, name, crop, tools: toolVersions() });
  for (const candidate of [outDir, join(outDir, `run-${key.slice(0, 16)}`)]) {
    try {
      const saved = JSON.parse(readFileSync(join(candidate, 'manifest.json'), 'utf8'));
      if (saved.key === key && saved.sheets.length && saved.sheets.every((s) => /^[\w-]+\.png$/.test(s.file) && fileHash(join(candidate, s.file)) === s.sha256)) return saved.sheets.map((s) => join(candidate, s.file));
    } catch { /* missing or damaged output must be regenerated */ }
  }
  if (existsSync(join(outDir, 'index.md'))) outDir = join(outDir, `run-${key.slice(0, 16)}`);
  mkdirSync(join(outDir, 'frames'), { recursive: true });
  const perSheet = columns * rows;
  const sheets = [];
  const full = probe(video).video;
  // `crop` ({x, y, w, h} em pixels do vídeo) amplia uma região: detalhes pequenos somem numa miniatura do quadro inteiro.
  if (crop && !(crop.w > 0 && crop.h > 0 && crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= full.width && crop.y + crop.h <= full.height)) {
    throw new Error(`recorte fora do quadro de ${full.width}x${full.height}`);
  }
  const source = crop ? { ...full, width: crop.w, height: crop.h } : full;
  const height = Math.round(source.height / source.width * thumbWidth / 2) * 2;
  const treatment = (crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : '') + buildPostChain({ source, width: thumbWidth, height });

  // Select decoded frame indices in one pass. Timestamps are read for time-based requests,
  // so variable frame rate footage is never silently treated as CFR.
  let timestamps;
  if (shots.some((s) => s.frame === undefined)) {
    const { stdout } = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'json', video]);
    timestamps = JSON.parse(stdout).frames.map((f) => Number(f.best_effort_timestamp_time));
    if (!timestamps.length || timestamps.some((t) => !Number.isFinite(t))) throw new Error('vídeo sem timestamps de quadros utilizáveis');
    const origin = timestamps[0];
    timestamps = timestamps.map((t) => t - origin);
  }
  const indices = shots.map((shot) => {
    const n = shot.frame ?? timestamps.findIndex((t) => t + 0.000001 >= Math.max(0, shot.time));
    if (!Number.isInteger(n) || n < 0 || (full.frames && n >= full.frames)) throw new Error('quadro solicitado fora do vídeo');
    return n;
  });
  const unique = [...new Set(indices)].sort((a, b) => a - b);
  const rawDir = mkdtempSync(join(outDir, '.raw-'));
  const selectPath = join(outDir, 'select.filter.txt');
  writeFileSync(selectPath, `select='${unique.map((n) => `eq(n,${n})`).join('+')}',${treatment}`);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-an', ...filterFileArgs(selectPath),
    '-fps_mode', 'passthrough', '-frames:v', String(unique.length), '-start_number', '0', join(rawDir, '%06d.png')]);
  // Restore the requested order (including duplicate frames) before labels and tiling.
  const ordered = mkdtempSync(join(outDir, '.ordered-'));
  indices.forEach((n, i) => copyFileSync(join(rawDir, `${String(unique.indexOf(n)).padStart(6, '0')}.png`), join(ordered, `${String(i).padStart(4, '0')}.png`)));
  const labelPath = join(outDir, 'labels.filter.txt');
  writeFileSync(labelPath, shots.map((shot, i) => `drawtext=text='${escapeText(shot.label ?? clock(shot.time))}':expansion=none:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6:x=8:y=8:enable='eq(n,${i})'`).join(','));
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-start_number', '0', '-i', join(ordered, '%04d.png'),
    ...filterFileArgs(labelPath), '-frames:v', String(shots.length), '-start_number', '0', join(outDir, 'frames', '%04d.png')]);
  rmSync(rawDir, { recursive: true, force: true });
  rmSync(ordered, { recursive: true, force: true });

  for (let start = 0, page = 1; start < shots.length; start += perSheet, page++) {
    const count = Math.min(perSheet, shots.length - start);
    const usedRows = Math.ceil(count / columns);
    const out = join(outDir, `${name}-${String(page).padStart(2, '0')}.png`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-start_number', String(start), '-framerate', '1',
      '-i', join(outDir, 'frames', '%04d.png'), '-frames:v', '1',
      '-vf', `tile=${columns}x${usedRows}:nb_frames=${count}:padding=6:color=0x202020`, out]);
    sheets.push(out);
  }

  writeFileSync(
    join(outDir, 'index.md'),
    ['# Quadros extraídos', '', `Vídeo: \`${video}\``, '', ...shots.map((s, i) => `${i + 1}. ${clock(s.time)} · ${s.label ?? ''}`), ''].join('\n'),
  );
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ schema: 1, key, video_hash: fileHash(video), frame_indices: indices, method: 'decoded-frame-select', sheets: sheets.map((path) => ({ file: path.split('/').at(-1), sha256: fileHash(path) })) }, null, 2));
  return sheets;
}

/**
 * Quadros consecutivos de um intervalo (um a cada `step`). É como se confere movimento sem assistir:
 * quadros espaçados mostram começo e fim de uma animação e escondem o que acontece no meio.
 */
export function sequenceShots(from, to, fps, step = 1) {
  if (!(Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to > from)) throw new Error('intervalo inválido: use INICIO-FIM em segundos');
  if (!(Number.isInteger(step) && step >= 1)) throw new Error('step precisa ser um inteiro a partir de 1');
  const shots = [];
  // `frame` is authoritative; keep an interior timestamp for older time-based consumers.
  for (let n = Math.round(from * fps); n <= Math.round(to * fps); n += step) shots.push({ frame: n, time: Math.max(0, (n - 0.25) / fps), label: `q${n} ${(n / fps).toFixed(2)}s` });
  return shots;
}

/** Para cada emenda do corte: o último quadro antes e o primeiro depois, lado a lado. */
export function cutBoundaryShots(edl) {
  const frame = 1 / edl.fps;
  const shots = [];
  edl.keep.slice(1).forEach((range, index) => {
    const t = range.out_start;
    const id = `c${String(index + 1).padStart(2, '0')}`;
    shots.push({ time: t - frame, label: `${id} antes ${clock(t)}` });
    shots.push({ time: t + frame / 2, label: `${id} depois` });
  });
  return shots;
}

/** Cards devem chegar compilados: âncoras do bruto não são tempos do render. */
export function cardShots(cards, fps = 30) {
  return cards.flatMap((card) => {
    if (!Number.isFinite(card.start) || !Number.isFinite(card.end) || card.end <= card.start) throw new Error(`card ${card.id}: tempos não compilados`);
    const inset = Math.min(0.15, (card.end - card.start) / 4);
    const sample = (time, label) => ({ time: Math.max(card.start, Math.min(time, card.end - Math.min(1 / fps, (card.end - card.start) / 2))), label: `${card.id} ${label}` });
    return [sample(card.start + inset, 'entra'), sample((card.start + card.end) / 2, 'meio'), sample(card.end - inset, 'sai')];
  });
}
