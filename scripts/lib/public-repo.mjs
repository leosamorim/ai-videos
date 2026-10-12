import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const TOP_FILES = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md',
  'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'SUPPORT.md', 'package.json', 'package-lock.json',
  '.gitignore', '.gitattributes', '.editorconfig', '.env.example', '.release-manifest.json']);
const ROOTS = ['scripts', 'tests', 'templates', 'docs', 'vendor', '.github', '.claude/skills', '.agents/skills'];
const EXTRAS = ['library/SOURCES.md', 'library/sources.json', 'library/references/README.md', '.claude/settings.json', '.codex/config.toml'];
export function isPublicPath(path) {
  if (path.includes('\\') || path.split('/').some((p) => p === '..' || p === '.')) return false;
  if (TOP_FILES.has(path) || EXTRAS.includes(path)) return true;
  if (!ROOTS.some((dir) => path.startsWith(dir + '/'))) return false;
  if (/(^|\/)(node_modules|__pycache__|\.cache|\.env(?:\.[^/]*)?)(\/|$)/.test(path)) return false;
  if (/^docs\/(?:RESEARCH-|private\/)/.test(path)) return false;
  if (/\.(?:mp4|mov|mkv|webm|wav|mp3|aac|m4a|flac|png|jpe?g|webp|gif|log|pyc)$/i.test(path)) return false;
  if (/\.woff2?$/.test(path) && !/^templates\/fonts\/inter-latin-(400|600|700)-normal\.woff2$/.test(path)) return false;
  if (/gsap\.min\.js$/.test(path)) return false;
  if (path.endsWith('/.DS_Store')) return false;
  return /^\.agents\/skills\/[^/]+$/.test(path) || path.startsWith('vendor/licenses/') || path.endsWith('/.gitignore')
    || /\.(?:md|mjs|cjs|js|json|yaml|yml|sh|py|css|html|svg|txt|toml|woff2)$/.test(path);
}
export function publicFiles(root) {
  const files = [];
  function walk(path) {
    const full = join(root, path);
    const stat = lstatSync(full, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isDirectory()) {
      if (/(^|\/)(node_modules|__pycache__|\.cache)$/.test(path)) return;
      for (const name of readdirSync(full).sort()) walk(`${path}/${name}`);
    } else if (isPublicPath(path)) files.push(path);
  }
  for (const path of [...TOP_FILES, ...ROOTS, ...EXTRAS]) walk(path);
  return [...new Set(files)].sort();
}
export function auditPublicRepo(root, { git = true } = {}) {
  const files = publicFiles(root), errors = [];
  for (const path of files) {
    const full = join(root, path), stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      const name = path.split('/').at(-1);
      if (path !== `.agents/skills/${name}` || readlinkSync(full) !== `../../.claude/skills/${name}` || !existsSync(join(full, 'SKILL.md'))) errors.push(`${path}: link não permitido ou quebrado`);
      continue;
    }
    if (stat.size > 2 * 1024 * 1024) errors.push(`${path}: arquivo grande; revisar antes de distribuir`);
    if (/\.woff2$/.test(path)) continue;
    let text = readFileSync(full, 'utf8');
    // Upstream's synthetic Python resolver fixture; do not exempt other vendor text.
    if (path === '.claude/skills/media-use/audio/scripts/lib/python.test.mjs') text = text.replace(/\/home\/u\/\.venvs\/hf\/bin\/python/g, '<upstream-fixture>');
    // Locations only: never echo suspected secrets into CI or chat logs.
    if (/\/(?:home|Users)\/[\w.-]+\//.test(text)) errors.push(`${path}: caminho pessoal absoluto`);
    if (/(?:AKIA[0-9A-Z]{16}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(text)) errors.push(`${path}: possível segredo`);
    if (/20\d{6}_\d{6}\.mp4/i.test(text)) errors.push(`${path}: nome de gravação privada`);
  }
  if (git && existsSync(join(root, '.git'))) {
    const listing = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
    if (listing.status !== 0) errors.push('não foi possível auditar o índice do Git');
    else {
      const candidates = new Set(listing.stdout.split('\0').filter(Boolean));
      for (const path of candidates) if (!isPublicPath(path)) errors.push(`${path}: candidato Git fora da lista pública`);
      for (const path of files) if (!candidates.has(path)) errors.push(`${path}: arquivo público omitido pelas regras do Git`);
    }
    const ignored = spawnSync('git', ['ls-files', '--cached', '--ignored', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
    if (ignored.stdout?.length) errors.push('há arquivos ignorados já rastreados; .gitignore não remove arquivos do histórico/índice');
  }
  return { files, errors: [...new Set(errors)] };
}
export function exportPublicRepo(root, destination) {
  destination = resolve(destination);
  if (existsSync(destination)) throw new Error('destino já existe; escolha uma pasta nova para preservar o conteúdo');
  const report = auditPublicRepo(root);
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  mkdirSync(destination, { recursive: true });
  const manifest = [];
  for (const path of report.files.filter((p) => p !== '.release-manifest.json')) {
    const from = join(root, path), to = join(destination, path);
    mkdirSync(dirname(to), { recursive: true });
    const isLink = lstatSync(from).isSymbolicLink();
    if (isLink) symlinkSync(readlinkSync(from), to);
    else copyFileSync(from, to);
    manifest.push({ path, ...(isLink ? { symlink: readlinkSync(from) } : { sha256: createHash('sha256').update(readFileSync(to)).digest('hex') }) });
  }
  writeFileSync(join(destination, '.release-manifest.json'), JSON.stringify({ schema: 1, files: manifest }, null, 2) + '\n');
  return { destination, files: manifest.length };
}
