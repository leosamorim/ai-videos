import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditPublicRepo, exportPublicRepo, isPublicPath, publicFiles } from '../scripts/lib/public-repo.mjs';
import { ROOT } from '../scripts/lib/util.mjs';

test('public export contains only engine files, preserves safe links, and rejects forced private Git entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vid-public-'));
  const root = join(dir, 'source'), out = join(dir, 'export');
  const write = (path, text = 'fixture') => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    write('README.md', '# Synthetic engine');
    write('.gitignore', readFileSync(join(ROOT, '.gitignore')));
    write('scripts/fixture.mjs', 'export const synthetic = true;');
    write('.claude/skills/example/SKILL.md', 'example');
    mkdirSync(join(root, '.agents/skills'), { recursive: true });
    symlinkSync('../../.claude/skills/example', join(root, '.agents/skills/example'));
    for (const path of ['videos/client/project.json', '.local/welcome.json', 'brand/fonts/fonts.json', 'output/notes.md', 'library/references/private.md', '.claude/settings.local.json', 'private.mp4', 'docs/RESEARCH-local.md', 'scripts/.env', '.claude/skills/example/assets/sound.mp3']) write(path);
    execFileSync('git', ['init', '-q', root]);
    assert.deepEqual(auditPublicRepo(root).errors, []);
    const result = exportPublicRepo(root, out);
    assert.ok(result.files >= 4);
    assert.equal(existsSync(join(out, 'videos')), false);
    assert.equal(existsSync(join(out, 'brand')), false);
    assert.equal(existsSync(join(out, '.local')), false);
    assert.equal(readlinkSync(join(out, '.agents/skills/example')), '../../.claude/skills/example');
    assert.equal(JSON.parse(readFileSync(join(out, '.release-manifest.json'))).files.length, result.files);
    assert.throws(() => exportPublicRepo(root, out), /já existe/);
    execFileSync('git', ['add', '-f', 'videos/client/project.json'], { cwd: root });
    assert.ok(auditPublicRepo(root).errors.some((e) => e.includes('fora da lista pública')));
    assert.throws(() => exportPublicRepo(root, join(dir, 'blocked')), /fora da lista/);
    assert.equal(existsSync(join(dir, 'blocked')), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('publication rules reject private areas, vendor media and external symlinks', () => {
  for (const path of ['.codex/auth.json', 'brand/README.md', 'videos/project.json', 'library/references/client.json', 'docs/private/report.md', '../README.md', '.claude/skills/x/font.woff2']) assert.equal(isPublicPath(path), false, path);
  assert.equal(isPublicPath('templates/fonts/inter-latin-600-normal.woff2'), true);
  const dir = mkdtempSync(join(tmpdir(), 'vid-links-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    symlinkSync(join(ROOT, 'package.json'), join(dir, 'scripts/external.json'));
    assert.ok(auditPublicRepo(dir).errors.some((e) => e.includes('link não permitido')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Git candidate files and public export agree for this workspace', () => {
  assert.deepEqual(auditPublicRepo(ROOT).errors, []);
  if (existsSync(join(ROOT, '.git'))) {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
    assert.deepEqual([...new Set(files)].sort(), publicFiles(ROOT));
  }
});
