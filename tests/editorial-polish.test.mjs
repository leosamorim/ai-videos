import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkWords, renderCaptions, auditCaptions } from '../scripts/lib/captions.mjs';
import { compileStoryboard } from '../scripts/lib/storyboard.mjs';
import { cardShots, cutBoundaries, cutBoundaryShots } from '../scripts/lib/frames.mjs';
import { buildEdl } from '../scripts/lib/cuts.mjs';

test('cut inspection uses output frame boundaries even when source takes are reordered', () => {
  const edl = buildEdl({ duration: 5, fps: 30, selections: [{ id: 'later', start: 3, end: 4 }, { id: 'earlier', start: 1, end: 3 }] });
  assert.deepEqual(cutBoundaries(edl), [{ id: 'start', frame: 0, time: 0 }, { id: 'c01', frame: 30, time: 1 }, { id: 'end', frame: 90, time: 3 }]);
  assert.deepEqual(cutBoundaryShots(edl).map((s) => s.frame), [0, 29, 30, 89]);
  const context = cutBoundaryShots(edl, { context: 0.5, boundary: 'c01' });
  assert.deepEqual(context.map((s) => s.frame), Array.from({ length: 30 }, (_, i) => i + 15));
  assert.ok(context.every((s) => s.time === s.frame / 30));
});

test('edge windows clamp to actual frames and include single-take opening and ending', () => {
  const edl = buildEdl({ duration: 0.2, fps: 30 });
  assert.deepEqual(cutBoundaryShots(edl).map((s) => s.frame), [0, 5]);
  for (const boundary of ['start', 'end']) {
    assert.deepEqual(cutBoundaryShots(edl, { context: 0.5, boundary }).map((s) => s.frame), [0, 1, 2, 3, 4, 5]);
  }
  assert.throws(() => cutBoundaryShots(edl, { boundary: 'c01' }), /borda desconhecida/);
});

test('fractional frame rates and sub-frame context keep exact consecutive indices', () => {
  const fps = 30000 / 1001;
  const edl = buildEdl({ duration: 10, fps, selections: [{ start: 2, end: 3.07 }, { start: 6, end: 7 }] });
  const boundary = cutBoundaries(edl)[1];
  assert.equal(boundary.frame, edl.keep[0].end_frame - edl.keep[0].start_frame);
  const shots = cutBoundaryShots(edl, { context: 0.001, boundary: 'c01' });
  assert.deepEqual(shots.map((s) => s.frame), [boundary.frame - 1, boundary.frame]);
});

test('boundary inspection refuses invalid EDL clocks/options and limits work before allocation', () => {
  const edl = buildEdl({ duration: 100, fps: 30 });
  for (const context of [-1, Infinity, NaN]) assert.throws(() => cutBoundaryShots(edl, { context }), /context/);
  assert.throws(() => cutBoundaryShots(edl, { context: 100 }), /boundary/);
  assert.equal(cutBoundaryShots(edl, { context: 0.5, boundary: 'end' }).length, 15);
  assert.throws(() => cutBoundaries({ ...edl, fps: 0 }), /fps/);
  assert.throws(() => cutBoundaries({ ...edl, keep: [] }), /trechos/);
  assert.throws(() => cutBoundaries({ ...edl, keep: [{ ...edl.keep[0], end_frame: 1.5 }] }), /limites/);
  assert.throws(() => cutBoundaries({ ...edl, keep: [{ ...edl.keep[0], out_start: 1 }] }), /relógio/);
});

const words = ['um', 'armário', 'para', 'sua', 'casa'].map((text, i) => ({ text, source_i: 30 + i, segment_id: 'take', start: i * 0.3, end: (i + 1) * 0.3 }));
test('a spoken list need not flash one caption per comma', () => {
  const list = words.slice(0, 3).map((w, i) => ({ ...w, text: ['vassoura,', 'rodo,', 'limpeza.'][i] }));
  assert.equal(chunkWords(list).length, 3);
  assert.equal(chunkWords(list, { breakOnPunctuation: 'sentence' }).length, 1);
});
test('editorial caption boundaries follow source words after retiming', () => {
  const moved = words.map((w) => ({ ...w, start: w.start + 7, end: w.end + 7 }));
  const blocks = chunkWords(moved, { phraseStarts: [32] });
  assert.deepEqual(blocks.map((b) => b.words.map((w) => w.text).join(' ')), ['um armário', 'para sua casa']);
  assert.equal(blocks[1].start, 7.6);
  assert.throws(() => chunkWords(moved.slice(3), { phraseStarts: [32] }), /removida/);
  assert.throws(() => chunkWords([...words, ...words], { phraseStarts: [32] }), /ambígua/);
  const repeated = [...words, ...moved.map((w) => ({ ...w, segment_id: 'repeat' }))];
  assert.doesNotThrow(() => chunkWords(repeated, { phraseStarts: [{ source_i: 32, segment_id: 'repeat' }] }));
});
test('captions never carry words from another take into the same block', () => {
  const input = words.map((w, i) => ({ ...w, segment_id: i < 2 ? 'first' : 'second' }));
  assert.ok(chunkWords(input).every((b) => new Set(b.words.map((w) => w.segment_id)).size === 1));
  assert.deepEqual(chunkWords(input).flatMap((b) => b.words.map((w) => w.source_i)), words.map((w) => w.source_i));
});
test('selective emphasis is static and rejects stale source references', () => {
  const html = renderCaptions(words, { highlightMode: 'selected', emphasis: [31], highlight: '#ddb892' }, { duration: 2, width: 1080, height: 1920 });
  assert.match(html, /style="color:#ddb892">armário<\/span>/);
  assert.equal((html.match(/style="color:#ddb892"/g) ?? []).length, 1);
  assert.ok(!html.includes('tl.set(word, { color:'));
  assert.throws(() => renderCaptions(words, { emphasis: [500] }, {}), /removida/);
  assert.throws(() => renderCaptions(words, { highlightMode: 'unknown' }, {}), /highlightMode/);
  const audit = auditCaptions(words, { phraseStarts: [32] });
  assert.equal(audit.length, 2);
  assert.deepEqual(audit[1].source_words, [32, 33, 34]);
});
test('underline marks only referenced words and role entrance tells emphasis blocks apart', () => {
  const frame = { duration: 2, width: 1080, height: 1920 };
  const html = renderCaptions(words, { highlightMode: 'selected', emphasis: [31], underline: [31], entrance: 'role' }, frame);
  assert.equal((html.match(/class="cap-ul-in"/g) ?? []).length, 1);
  assert.match(html, /data-ul="1"[^>]*>armário<span class="cap-ul">/);
  assert.match(html, /if \(chunk\[4\]\)/);
  assert.ok(!renderCaptions(words, {}, frame).includes('cap-ul'));
  assert.throws(() => renderCaptions(words, { underline: [500] }, frame), /removida/);
  assert.throws(() => renderCaptions(words, { entrance: 'spin' }, frame), /entrance/);
});
test('card inspection resolves anchors and samples inside even short cards', () => {
  const board = compileStoryboard({ cards: [{ id: 'cabinet', purpose: 'mostrar', anchor: { source_word: 31, duration: 0.04 } }] }, words, 2);
  const shots = cardShots(board.cards);
  assert.equal(shots.length, 3);
  assert.ok(shots.every((s) => Number.isFinite(s.time) && s.time >= 0.3 && s.time < 0.34));
  assert.throws(() => cardShots([{ id: 'bad' }]), /não compilados/);
});
