import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { acknowledgeWelcome, welcomeState } from '../scripts/lib/welcome.mjs';
import { ROOT } from '../scripts/lib/util.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'vid-welcome-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function cliFixture(t) {
  const root = fixture(t);
  for (const path of ['scripts/vid.mjs', 'scripts/lib/util.mjs', 'scripts/lib/welcome.mjs', 'scripts/commands/welcome.mjs', 'templates/WELCOME.md']) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    copyFileSync(join(ROOT, path), join(root, path));
  }
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [join(root, 'scripts/vid.mjs'), 'welcome', '--json', ...args], { encoding: 'utf8', cwd: tmpdir() }));
  return { root, run };
}

test('empty workspace detection is repeatable and read-only, including uninitialized folders', (t) => {
  const root = fixture(t);
  const expected = { should_show: true, has_projects: false, already_shown: false };
  assert.deepEqual(welcomeState(root), expected);
  assert.deepEqual(readdirSync(root), []);
  mkdirSync(join(root, 'videos', 'not-a-project'), { recursive: true });
  writeFileSync(join(root, 'videos', 'note.txt'), 'synthetic');
  assert.deepEqual(welcomeState(root), expected);
  assert.equal(existsSync(join(root, '.local')), false);
});

test('existing projects suppress onboarding without parsing, repairing or changing their manifests', (t) => {
  const root = fixture(t);
  const project = join(root, 'videos', 'existing');
  mkdirSync(project, { recursive: true });
  const file = join(project, 'project.json');
  writeFileSync(file, '{legacy or incomplete');
  assert.equal(welcomeState(root).should_show, false);
  assert.equal(acknowledgeWelcome(root).has_projects, true);
  assert.equal(readFileSync(file, 'utf8'), '{legacy or incomplete');
  assert.equal(existsSync(join(root, '.local')), false);
  // A linked project also counts; discovery must not treat it as a new workspace.
  const linkedRoot = fixture(t);
  mkdirSync(join(linkedRoot, 'videos'));
  symlinkSync(project, join(linkedRoot, 'videos', 'linked'));
  assert.equal(welcomeState(linkedRoot).has_projects, true);
});

test('welcome CLI runs before npm install; reading does not acknowledge and explicit ack persists once', (t) => {
  const { root, run } = cliFixture(t);
  const before = run();
  assert.equal(before.should_show, true);
  assert.ok(before.message.length > 0);
  assert.deepEqual(run(), before);
  assert.equal(existsSync(join(root, '.local')), false);
  assert.deepEqual(run('--ack'), { should_show: false, has_projects: false, already_shown: true, message: null });
  const marker = readFileSync(join(root, '.local/welcome.json'), 'utf8');
  assert.equal(run().message, null);
  assert.equal(run('--preview').message, before.message);
  run('--ack');
  assert.equal(readFileSync(join(root, '.local/welcome.json'), 'utf8'), marker);
});

test('invalid markers do not hide first-use help and invalid CLI arguments cannot acknowledge', (t) => {
  const { root } = cliFixture(t);
  mkdirSync(join(root, '.local'));
  const marker = join(root, '.local/welcome.json');
  for (const text of ['{broken', 'null', '{}', '{"schema":1,"shown":false}']) {
    writeFileSync(marker, text);
    assert.equal(welcomeState(root).should_show, true);
    assert.equal(readFileSync(marker, 'utf8'), text);
  }
  for (const args of [['--ack', '--preview'], ['--ack', 'unexpected'], ['--ack', '--unknown', 'value']]) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/vid.mjs'), 'welcome', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(welcomeState(root).already_shown, false);
  }
  assert.equal(acknowledgeWelcome(root).already_shown, true);
});
