import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strategyTemplate, validateStrategy, validateStrategyBoard } from '../scripts/lib/strategy.mjs';
import { compileStoryboard } from '../scripts/lib/storyboard.mjs';
import { DEPENDENTS, refresh, stageSignature } from '../scripts/lib/fingerprint.mjs';
import { DIRS } from '../scripts/lib/project.mjs';
import { ROOT } from '../scripts/lib/util.mjs';
import { strategy as command } from '../scripts/commands/strategy.mjs';
import { review } from '../scripts/commands/review.mjs';

const example = () => JSON.parse(readFileSync(join(ROOT, 'templates/strategy.example.json'), 'utf8'));
const board = () => ({ beats: [
  { id: 'b-hook', purpose: 'orientar', anchor: { source_word: 4, duration: 1 } },
  { id: 'b-payoff', purpose: 'demonstrar', anchor: { source_word: 8, duration: 2 } },
  { id: 'b-cta', purpose: 'convite', start: 4, end: 5 },
], cards: [], reframes: [] });
const words = [{ source_i: 4, start: 0, end: 0.5, segment_id: 'first' }, { source_i: 8, start: 1, end: 2, segment_id: 'last' }];

test('strategy needs evidence, a payoff, measurable definitions and a supported CTA', () => {
  assert.equal(validateStrategy(example()).objective, 'education');
  assert.throws(() => validateStrategy(strategyTemplate()), /objective/);
  for (const [change, error] of [
    [(s) => { s.beats[1].evidence_ids = ['invented']; }, /evidência desconhecida/],
    [(s) => { s.beats[1].role = 'context'; }, /payoff/],
    [(s) => { s.beats.pop(); }, /beat cta/],
    [(s) => { s.beats[1].id = s.beats[0].id; }, /repetidos/],
    [(s) => { s.platforms[0].primary_metric.denominator = ''; }, /denominator/],
    [(s) => { s.hook.spoken = s.hook.visual = s.hook.on_screen = ''; }, /pelo menos um canal/],
  ]) {
    const s = example(); change(s); assert.throws(() => validateStrategy(s), error);
  }
});

test('a long demonstration needs neither effects, all hook channels nor a CTA', () => {
  const s = example();
  s.cta = { action: 'none', why: 'A demonstração encerra a resposta.' };
  s.hook.spoken = s.hook.on_screen = '';
  s.beats = s.beats.slice(0, 2);
  const b = compileStoryboard({ beats: [
    { id: 'b-hook', purpose: 'mostrar o resultado primeiro', start: 0, end: 3 },
    { id: 'b-payoff', purpose: 'permitir observar a demonstração', start: 0, end: 40 },
  ] }, [], 40);
  assert.doesNotThrow(() => validateStrategyBoard(s, b));
  assert.deepEqual(b.cards, []);
});

test('strategic beats follow source anchors and cannot silently lose the payoff', () => {
  const b = board();
  const compiled = compileStoryboard(b, words, 5);
  assert.equal(validateStrategyBoard(example(), compiled).beats[1].start, 1);
  assert.equal(compileStoryboard(b, words.map((w) => w.source_i === 8 ? { ...w, start: 2, end: 3 } : w), 5).beats[1].start, 2);
  assert.throws(() => compileStoryboard(b, words.slice(0, 1), 5), /removida/);
  const absent = { ...compiled, beats: compiled.beats.filter((x) => x.id !== 'b-payoff') };
  assert.throws(() => validateStrategyBoard(example(), absent), /b-payoff sem tempo/);
  assert.throws(() => validateStrategyBoard(example(), { ...compiled, beats: [...compiled.beats, { id: 'extra' }] }), /não pertence/);
});

test('effects support a real timed function; there is no mandatory effect per beat', () => {
  const b = board();
  b.cards = [{ id: 'label', purpose: 'identificar controle', beat_id: 'b-payoff', start: 1, end: 2 }];
  assert.doesNotThrow(() => validateStrategyBoard(example(), compileStoryboard(b, words, 5)));
  b.cards[0].beat_id = 'missing';
  assert.throws(() => validateStrategyBoard(example(), compileStoryboard(b, words, 5)), /beat_id válido/);
  b.cards[0].beat_id = 'b-payoff'; b.cards[0].start = 3; b.cards[0].end = 4;
  assert.throws(() => validateStrategyBoard(example(), compileStoryboard(b, words, 5)), /não coincide/);
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'vid-strategy-'));
  const paths = Object.fromEntries(Object.entries(DIRS).map(([k, v]) => [k, join(dir, v)]));
  Object.values(paths).forEach((p) => mkdirSync(p, { recursive: true }));
  const data = { source: { file: 'raw.mp4' }, format: { width: 1080, height: 1920, fps: 30 },
    stages: Object.fromEntries(Object.keys(DEPENDENTS).map((key) => [key, 'done'])),
    gates: { plan: { approved: true }, draft: { approved: true } }, snapshots: {}, renders: [], log: [] };
  const project = { dir, paths, data };
  writeFileSync(join(dir, 'project.json'), JSON.stringify(data));
  return project;
}
function snapshot(p) {
  for (const key of Object.keys(DEPENDENTS)) {
    p.data.stages[key] = 'done';
    p.data.snapshots[key] = stageSignature(p, key);
  }
}

test('strategy addition/change/removal invalidates derivatives, while analytics leave delivery current', () => {
  const p = fixture(); const path = join(p.dir, 'strategy.json');
  try {
    snapshot(p);
    const legacy = stageSignature(p, 'plan');
    const preserved = ['intake', 'transcript', 'analysis', 'cut'].map((s) => stageSignature(p, s));
    writeFileSync(path, JSON.stringify(example()));
    assert.equal(refresh(p), true);
    for (const stage of ['plan', 'composition', 'review', 'final']) assert.equal(p.data.stages[stage], 'pending');
    assert.equal(p.data.gates.draft, null);
    assert.deepEqual(['intake', 'transcript', 'analysis', 'cut'].map((s) => stageSignature(p, s)), preserved);
    snapshot(p);
    const changed = example(); changed.promise = 'A different honest promise';
    writeFileSync(path, JSON.stringify(changed));
    assert.equal(refresh(p), true);
    assert.equal(p.data.stages.final, 'pending');
    snapshot(p);
    rmSync(path);
    assert.equal(refresh(p), true);
    assert.equal(stageSignature(p, 'plan'), legacy);
    snapshot(p);
    writeFileSync(join(p.paths.review, 'learning.md'), 'Insights captured after publication.');
    assert.equal(refresh(p), false);
    assert.equal(p.data.stages.final, 'done');
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('strategy init is non-destructive and only touches the requested project', () => {
  const p = fixture(); const path = join(p.dir, 'strategy.json');
  try {
    command([p.dir, '--init']);
    assert.ok(existsSync(path));
    assert.throws(() => command([p.dir]), /objective/);
    writeFileSync(path, JSON.stringify(example()));
    const saved = readFileSync(path, 'utf8');
    command([p.dir, '--init']);
    assert.equal(readFileSync(path, 'utf8'), saved);
    assert.doesNotThrow(() => command([p.dir]));
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});

test('the same render cannot reuse approval after its strategy changes', () => {
  const p = fixture(); const path = join(p.dir, 'strategy.json');
  const reviewPath = join(p.paths.review, 'review.json');
  // No media analysis here: the initializer only binds checks to file bytes.
  writeFileSync(join(p.paths.cut, 'clean.mp4'), 'synthetic bytes');
  try {
    review([p.dir]);
    const legacy = JSON.parse(readFileSync(reviewPath, 'utf8'));
    assert.equal(legacy.checks.strategy, undefined);
    writeFileSync(path, JSON.stringify(example()));
    review([p.dir]);
    const initial = JSON.parse(readFileSync(reviewPath, 'utf8'));
    assert.equal(initial.file_hash, legacy.file_hash);
    assert.equal(initial.checks.strategy.ok, false);
    initial.complete = true;
    initial.checks.strategy = { ok: true, notes: 'Synthetic contract fixture.' };
    writeFileSync(reviewPath, JSON.stringify(initial));
    const changed = example(); changed.payoff = 'Another deliverable';
    writeFileSync(path, JSON.stringify(changed));
    assert.throws(() => review([p.dir, '--complete']), /estratégia mudou/);
    review([p.dir]);
    const revised = JSON.parse(readFileSync(reviewPath, 'utf8'));
    assert.notEqual(revised.strategy_hash, initial.strategy_hash);
    assert.equal(revised.complete, false);
    assert.equal(revised.checks.strategy.ok, false);
    rmSync(path);
    assert.throws(() => review([p.dir, '--complete']), /estratégia mudou/);
    review([p.dir]);
    assert.equal(JSON.parse(readFileSync(reviewPath, 'utf8')).checks.strategy, undefined);
  } finally { rmSync(p.dir, { recursive: true, force: true }); }
});
