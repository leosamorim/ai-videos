import { existsSync, realpathSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { fail, run } from './util.mjs';
import { fileHash } from './fingerprint.mjs';

/** Inspect frozen local assets once per call; no generation, downloads or playback. */
export function inspectSoundCues(board, dir) {
  const assets = new Map();
  return board.sound_cues.map((cue) => {
    const path = join(dir, cue.asset);
    if (!existsSync(path)) fail(`${cue.id}: falta ${cue.asset}; coloque o som local antes de compose/check`);
    const rel = relative(realpathSync(join(dir, 'assets')), realpathSync(path));
    if (rel.startsWith('..') || isAbsolute(rel)) fail(`${cue.id}: asset aponta para fora de assets/`);
    if (!assets.has(path)) {
      const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]).stdout);
      const audio = info.streams.find((s) => s.codec_type === 'audio');
      const duration = Number(audio?.duration ?? info.format?.duration);
      if (!audio || !Number.isFinite(duration) || duration <= 0) fail(`${cue.id}: asset sem áudio/duração verificável`);
      assets.set(path, { sha256: fileHash(path), duration });
    }
    const asset = assets.get(path);
    if (cue.duration > asset.duration + 0.025) fail(`${cue.id}: duração do cue excede o arquivo de áudio`);
    return { ...cue, asset_sha256: asset.sha256, asset_duration: asset.duration, attack_method: 'declared-in-frozen-asset' };
  });
}
