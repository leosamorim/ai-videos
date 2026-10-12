import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkWords, renderCaptions, auditCaptions } from '../scripts/lib/captions.mjs';
import { compileStoryboard } from '../scripts/lib/storyboard.mjs';
import { cardShots } from '../scripts/lib/frames.mjs';

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
