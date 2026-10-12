// Local, content-addressed artifacts. A hit requires intact bytes, not just a path.
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { digest, fileHash } from './fingerprint.mjs';
import { ROOT, run } from './util.mjs';

export const CACHE_ROOT = join(ROOT, '.cache', 'vid', 'v1');
let versions;
export function toolVersions() {
  return versions ??= {
    ffmpeg: run('ffmpeg', ['-version']).stdout.split('\n')[0],
    hyperframes: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies.hyperframes,
  };
}
function address(namespace, input, root) {
  if (!/^[a-z][a-z0-9-]*$/.test(namespace)) throw new Error('invalid cache namespace');
  return join(root, namespace, digest(input));
}
function safeName(name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) throw new Error('invalid cache artifact name');
  return name;
}
export function readCache(namespace, input, root = CACHE_ROOT) {
  const dir = address(namespace, input, root);
  try {
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    if (manifest.key !== digest(input) || manifest.schema !== 1 || !Object.keys(manifest.files).length) return null;
    for (const [name, hash] of Object.entries(manifest.files)) {
      if (fileHash(join(dir, safeName(name))) !== hash) return null;
    }
    return { dir, ...manifest };
  } catch { return null; }
}
export function writeCache(namespace, input, { files, metadata = {}, replace = false }, root = CACHE_ROOT) {
  const hit = readCache(namespace, input, root);
  if (hit && !replace) return hit;
  const dir = address(namespace, input, root);
  mkdirSync(dirname(dir), { recursive: true });
  const work = mkdtempSync(join(dirname(dir), '.writing-'));
  try {
    const hashes = {};
    for (const [name, source] of Object.entries(files)) {
      copyFileSync(source, join(work, safeName(name)), constants.COPYFILE_FICLONE);
      hashes[name] = fileHash(join(work, name));
    }
    if (!Object.keys(hashes).length) throw new Error('empty cache entry');
    writeFileSync(join(work, 'manifest.json'), JSON.stringify({ schema: 1, key: digest(input), files: hashes, metadata }));
    // Preserve a concurrent valid writer; replace only an invalid entry.
    if (existsSync(dir) && (replace || !readCache(namespace, input, root))) rmSync(dir, { recursive: true, force: true });
    try { renameSync(work, dir); }
    catch (error) { if (!readCache(namespace, input, root)) throw error; }
    return readCache(namespace, input, root);
  } finally { rmSync(work, { recursive: true, force: true }); }
}
export function restoreCache(entry, name, destination) {
  safeName(name);
  if (!entry?.files[name] || fileHash(join(entry.dir, name)) !== entry.files[name]) throw new Error('cache artifact changed');
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(entry.dir, name), destination, constants.COPYFILE_FICLONE);
}
