import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEdl, proposeSilenceCuts, retimeWords } from '../scripts/lib/cuts.mjs';
import { candidateWindows, emptyEditPlan, validateEditPlan } from '../scripts/lib/editorial.mjs';
import { compileStoryboard, themeCss } from '../scripts/lib/storyboard.mjs';
import { captionZones, chunkWords } from '../scripts/lib/captions.mjs';
import { compareSpeech } from '../scripts/lib/speech-review.mjs';
import { extractPage } from '../scripts/lib/references.mjs';
import { refresh, stageSignature } from '../scripts/lib/fingerprint.mjs';
import { sequenceShots } from '../scripts/lib/frames.mjs';
import { DIRS } from '../scripts/lib/project.mjs';
import { localAsrOptions } from '../scripts/lib/transcribe.mjs';

const word = (i, text, start, end) => ({ i, text, start, end });
test('Portuguese never silently falls back to an English-only Whisper model', () => {
  assert.equal(localAsrOptions({ language: 'pt-BR' }).model, 'large-v3');
  assert.equal(localAsrOptions({ language: 'pt-BR' }).language, 'pt');
  assert.throws(() => localAsrOptions({ language: 'pt', model: 'small.en' }), /só suporta inglês/);
});
test('no-cut EDL keeps all 300 frames; sub-frame durations are quantized once', () => {
  assert.equal(buildEdl({ duration: 10, fps: 30 }).keep[0].end_frame, 300);
  assert.equal(buildEdl({ duration: 10, fps: 30 }).edited_duration, 10);
  assert.equal(buildEdl({ duration: 1.017, fps: 30 }).keep[0].end_frame, 31);
});
test('reordered keeps reorder words and preserve source/segment identity', () => {
  const edl = buildEdl({ duration: 4, fps: 30, selections: [{ id: 'b', start: 2, end: 4 }, { id: 'a', start: 0, end: 2 }] });
  const words = retimeWords([word(0, 'início', 0.5, 1), word(1, 'fim', 2.5, 3)], edl.keep);
  assert.deepEqual(words.map((w) => [w.text, w.start, w.source_i, w.segment_id]), [['fim', 0.5, 1, 'b'], ['início', 2.5, 0, 'a']]);
});
test('silence proposal flags a cut touching speech even if most of the word is outside', () => {
  const cuts = proposeSilenceCuts({ duration: 4, words: [word(0, 'fala', 0, 1.5), word(1, 'fim', 3, 3.4)], silences: [{ start: 1.3, end: 2.7 }] });
  assert.ok(cuts.some((c) => c.status === 'flagged'));
});
test('audiovisual plan requires observations, full coverage and detailed off-performance evidence', () => {
  const plan = emptyEditPlan('sig', 4);
  const evidence = { source_signature: 'sig', items: [{ id: 'overview', type: 'contact-sheet', start: 0, end: 4 }, { id: 'setup', type: 'motion-clip', start: 0, end: 1 }] };
  plan.reviewer = 'agent'; plan.review = { transcript_reviewed: true, visual_reviewed: true, visual_method: 'frames', uncertainties: [], observations: [{ evidence_id: 'overview', observation: 'fala contínua' }, { evidence_id: 'setup', observation: 'mão inicia gravação antes da fala' }] };
  plan.segments = [{ id: 'take', start: 1, end: 4, reason: 'explicação completa', evidence_ids: ['overview'] }];
  plan.discarded = [{ id: 'pre', start: 0, end: 1, kind: 'setup', reason: 'preparação', evidence_ids: ['setup'] }];
  assert.deepEqual(validateEditPlan(plan, evidence, [word(0, 'fala', 1.2, 1.5)], 4, 'sig'), []);
  plan.discarded[0].evidence_ids = ['overview'];
  assert.ok(validateEditPlan(plan, evidence, [], 4, 'sig').some((e) => e.includes('requer clip')));
  plan.segments[0].start = 2;
  assert.ok(validateEditPlan(plan, evidence, [], 4, 'sig').some((e) => e.includes('sem decisão')));
});
test('kept word boundaries cannot silently clip syllables', () => {
  const plan = emptyEditPlan('sig', 1);
  plan.segments = [{ id: 'a', start: 0.2, end: 1, reason: 'x', evidence_ids: [] }];
  assert.ok(validateEditPlan(plan, { source_signature: 'sig', items: [] }, [word(0, 'teste', 0.1, 0.4)], 1, 'sig').some((e) => e.includes('borda corta')));
});
test('heuristic candidates remain suggestions, including post-roll and repeated starts', () => {
  const words = 'um armário para sua casa um armário para sua casa'.split(' ').map((text, i) => word(i, text, i + 1, i + 1.5));
  const candidates = candidateWindows(words, 14);
  assert.ok(candidates.some((c) => c.alternate_start !== undefined));
  assert.ok(candidates.some((c) => c.cue.startsWith('post-roll')));
  assert.ok(candidates.every((c) => !c.decision));
});
test('word anchors move with the edit and reject removed or ambiguous source words', () => {
  const board = { cards: [{ id: 'width', purpose: 'mostrar largura', anchor: { source_word: 8, duration: 1 } }] };
  assert.equal(compileStoryboard(board, [{ source_i: 8, start: 2, end: 2.2 }], 5).cards[0].start, 2);
  assert.throws(() => compileStoryboard(board, [], 5), /removida/);
});
test('caption changes in the middle of a block do not cover graphics', () => {
  assert.deepEqual(captionZones([{ start: 0, end: 3, words: [] }], [{ from: 1, to: 2, hidden: true }]).map(({ start, end }) => [start, end]), [[0, 1], [2, 3]]);
  const words = [word(0, 'Largura', 0, 0.2), word(1, '20', 0.2, 0.4), word(2, 'cm', 0.4, 0.6)];
  assert.ok(chunkWords(words, { maxWords: 2 }).some((c) => c.words.some((w) => w.text === '20') && c.words.some((w) => w.text === 'cm')));
});
test('ASR comparison exposes omissions and extra speech', () => {
  const report = compareSpeech([{ text: 'armário' }, { text: 'estreito' }], [{ text: 'armario' }, { text: 'grande' }, { text: 'teste' }]);
  assert.equal(report.edit_distance, 2);
  assert.equal(report.issues.length, 2);
});
test('reference extraction omits executable content and keeps semantic text', () => {
  const page = extractPage('<title>Projeto &amp; Casa</title><script>steal()</script><style>:root{color:#112233}</style><h1>Armário</h1><p>20 cm</p>', 'https://example.com');
  assert.equal(page.title, 'Projeto & Casa');
  assert.ok(!page.text.includes('steal'));
  assert.ok(page.text.includes('20 cm'));
  assert.deepEqual(page.palette_candidates, ['#112233']);
  assert.throws(() => themeCss({ palette: { bg: 'url(remote)' } }, { width: 1080, height: 1920 }), /cor inválida/);
});
test('changes invalidate downstream approvals while preserving unrelated transcription', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vid-state-'));
  try {
    const paths = Object.fromEntries(Object.entries(DIRS).map(([k, v]) => [k, join(dir, v)]));
    Object.values(paths).forEach((p) => mkdirSync(p, { recursive: true }));
    writeFileSync(join(dir, 'BRIEF.md'), 'first');
    const p = { dir, paths, data: { source: { file: 'raw.mp4' }, stages: { intake: 'done', transcript: 'done', plan: 'done', composition: 'done', review: 'done', final: 'done' }, gates: { plan: { approved: true }, draft: { approved: true } }, snapshots: {} } };
    p.data.snapshots.intake = stageSignature(p, 'intake');
    writeFileSync(join(dir, 'BRIEF.md'), 'changed');
    assert.equal(refresh(p), true);
    assert.equal(p.data.stages.transcript, 'done');
    assert.equal(p.data.stages.final, 'pending');
    assert.equal(p.data.gates.draft, null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('sequence shots cover every frame of an interval and seek inside each frame', () => {
  const shots = sequenceShots(12.6, 12.7667, 30);
  assert.deepEqual(shots.map((s) => s.label.split(' ')[0]), ['q378', 'q379', 'q380', 'q381', 'q382', 'q383']);
  shots.forEach((s, i) => assert.ok(s.time > (377 + i) / 30 && s.time < (378 + i) / 30));
  assert.equal(sequenceShots(0, 1, 30, 10).length, 4);
  assert.equal(sequenceShots(0, 0.1, 30)[0].time, 0);
  assert.throws(() => sequenceShots(2, 1, 30), /intervalo/);
  assert.throws(() => sequenceShots(0, 1, 30, 0.5), /step/);
});
test('composition signature ignores inspection snapshots but not composition files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vid-sig-'));
  try {
    const paths = Object.fromEntries(Object.entries(DIRS).map(([k, v]) => [k, join(dir, v)]));
    Object.values(paths).forEach((p) => mkdirSync(p, { recursive: true }));
    writeFileSync(join(paths.composition, 'index.html'), '<html></html>');
    const p = { dir, paths, data: { source: { file: 'raw.mp4' }, format: { width: 1080, height: 1920, fps: 30 }, stages: {}, snapshots: {} } };
    const before = stageSignature(p, 'composition');
    mkdirSync(join(paths.composition, 'snapshots'));
    writeFileSync(join(paths.composition, 'snapshots', 'frame-00.png'), 'inspection only');
    assert.equal(stageSignature(p, 'composition'), before);
    writeFileSync(join(paths.composition, 'index.html'), '<html><body>changed</body></html>');
    assert.notEqual(stageSignature(p, 'composition'), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
