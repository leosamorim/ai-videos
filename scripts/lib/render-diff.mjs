import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCache, toolVersions, writeCache } from './cache.mjs';
import { fileHash } from './fingerprint.mjs';
import { probe } from './media.mjs';
import { run } from './util.mjs';

function fraction(numerator, denominator) {
  let a = BigInt(numerator), b = BigInt(denominator);
  const gcd = (x, y) => y ? gcd(y, x % y) : x;
  const g = gcd(a < 0n ? -a : a, b);
  return `${a / g}/${b / g}`;
}
export function parseFrameHashes(text) {
  const base = text.match(/^#tb 0:\s*(\d+)\/(\d+)/m);
  if (!base) throw new Error('framehash sem time base');
  return text.split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const [, , pts, duration, size, sha256] = line.split(',').map((s) => s.trim());
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('framehash inválido');
    const time = (v) => fraction(BigInt(v) * BigInt(base[1]), base[2]);
    return { pts: time(pts), duration: time(duration), size: Number(size), sha256 };
  });
}

/** Full resolution, no scaling, no lossy perceptual threshold. Audio uses native-rate PCM. */
export function decodedIdentity(video, { cacheRoot } = {}) {
  const input = { revision: 2, file: fileHash(video), tools: toolVersions() };
  const cached = readCache('decoded-identity', input, cacheRoot);
  if (cached) return JSON.parse(readFileSync(join(cached.dir, 'identity.json'), 'utf8'));
  const info = probe(video);
  const frames = parseFrameHashes(run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-copyts', '-i', video,
    '-map', '0:v:0', '-an', '-c:v', 'rawvideo', '-enc_time_base:v', info.video.time_base, '-fps_mode', 'passthrough', '-f', 'framehash', '-hash', 'sha256', '-']).stdout);
  let audio = null;
  if (info.audio) {
    const sha256 = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', video, '-map', '0:a:0', '-vn',
      '-c:a', 'pcm_f64le', '-f', 'hash', '-hash', 'sha256', '-']).stdout.trim();
    audio = { sha256, sample_rate: info.audio.sample_rate, channels: info.audio.channels, channel_layout: info.audio.channel_layout, offset: info.timeline.audio_offset };
  }
  const identity = { file_hash: input.file, video: info.video, duration: info.duration, frames, audio };
  const dir = mkdtempSync(join(tmpdir(), 'vid-identity-'));
  try {
    const path = join(dir, 'identity.json');
    writeFileSync(path, JSON.stringify(identity));
    writeCache('decoded-identity', input, { files: { 'identity.json': path } }, cacheRoot);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return identity;
}
export function indexRanges(indices) {
  const ranges = [];
  for (const frame of indices) {
    if (ranges.length && frame === ranges.at(-1).to + 1) ranges.at(-1).to = frame;
    else ranges.push({ from: frame, to: frame });
  }
  return ranges;
}
export function compareIdentities(before, after, { motions = [], boundaryFrames = 2 } = {}) {
  const fields = ['width', 'height', 'rotation', 'pix_fmt', 'fps', 'start_time', 'sample_aspect_ratio', 'color_space', 'color_range', 'chroma_location', 'field_order', 'color_transfer', 'color_primaries'];
  const compatible = fields.every((k) => before.video[k] === after.video[k]) && before.frames.length === after.frames.length
    && before.frames.every((f, i) => f.pts === after.frames[i].pts && f.duration === after.frames[i].duration);
  const changed = after.frames.flatMap((frame, i) => !compatible || frame.sha256 !== before.frames[i].sha256 || frame.size !== before.frames[i].size ? [i] : []);
  const required = new Set(changed);
  for (const frame of changed) for (let i = Math.max(0, frame - boundaryFrames); i <= Math.min(after.frames.length - 1, frame + boundaryFrames); i++) required.add(i);
  // Repeat until fixed point: a boundary or overlapping effect can touch another full animation.
  const affected = new Set();
  const seconds = (value) => { const [n, d] = value.split('/').map(Number); return n / d; };
  const origin = after.frames.length ? seconds(after.frames[0].pts) : 0;
  const frameTimes = after.frames.map((f) => seconds(f.pts) - origin);
  let grew;
  do {
    grew = false;
    for (const m of motions) {
      if (affected.has(m.id)) continue;
      const first = frameTimes.findIndex((t) => t >= m.start);
      const end = frameTimes.findIndex((t) => t >= m.end);
      if (first < 0) continue;
      const from = Math.max(0, first - boundaryFrames);
      const to = Math.min(after.frames.length - 1, (end < 0 ? after.frames.length - 1 : end) + boundaryFrames);
      if ([...required].some((n) => n >= from && n <= to)) {
        affected.add(m.id); grew = true;
        for (let n = from; n <= to; n++) required.add(n);
      }
    }
  } while (grew);
  const audioEqual = JSON.stringify(before.audio) === JSON.stringify(after.audio);
  return { schema: 1, before_hash: before.file_hash, after_hash: after.file_hash, compatible_timeline: compatible,
    total_frames: after.frames.length, equal_frames: after.frames.length - changed.length, changed_frames: changed.length,
    changed_ranges: indexRanges(changed), required_ranges: indexRanges([...required].sort((a, b) => a - b)),
    affected_motion_ids: [...affected], audio_equal: audioEqual,
    method: 'full-resolution decoded SHA-256; frame timing/format compatibility; native-rate PCM SHA-256',
    complete: false, note: 'Equivalência técnica não é aprovação. Examine os intervalos completos; som alterado exige nova escuta. Mudanças de contexto/estratégia exigem revisão semântica mesmo com pixels iguais.' };
}
