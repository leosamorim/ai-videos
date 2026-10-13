import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileStoryboard } from '../scripts/lib/storyboard.mjs';
import { auditGraphicReading, syncSoundCueMarkup } from '../scripts/lib/choreography.mjs';
import { inspectSoundCues } from '../scripts/lib/sound-cues.mjs';
import { applyRepositoryPolicy } from '../scripts/lib/skill-policy.mjs';

const words = [{ source_i: 8, segment_id: 'take', start: 1, end: 1.2 }];
const input = () => ({
  cards: [{ id: 'card', purpose: 'show result', anchor: { source_word: 8, segment_id: 'take', duration: 3 },
    direction: { mode: 'explanation', focus: 'result', takeaway: 'understand the change', order: ['action', 'hold'] },
    reads: [{ id: 'label', text: 'Resultado claro', from: 0.4, to: 2.8, min_hold: 1, max_cps: 18 }] }],
  events: [{ id: 'contact', purpose: 'visible contact', at: { item_id: 'card', offset: 1 } }],
  sound_cues: [{ id: 'click', event_id: 'contact', asset: 'assets/click.wav', attack: 0.1, duration: 0.35, volume: 0.2 }],
});
const compile = (board = input(), transcript = words) => compileStoryboard(board, transcript, 8);

test('word edits move image, sound attack and reading windows together without modifying the input', () => {
  const board = input(), original = JSON.stringify(board);
  const a = compile(board), b = compile(board, [{ ...words[0], start: 4, end: 4.2 }]);
  assert.equal(JSON.stringify(board), original);
  for (const compiled of [a, b]) {
    const cue = compiled.sound_cues[0];
    assert.ok(Math.abs(cue.start + cue.attack - compiled.events[0].time) < 1e-9);
    assert.equal(compiled.cards[0].reads[0].start, compiled.cards[0].start + 0.4);
  }
  assert.ok(Math.abs(b.sound_cues[0].start - a.sound_cues[0].start - 3) < 1e-9);
  assert.throws(() => compile(board, []), /removida/);
  board.events = [{ id: 'word-event', purpose: 'spoken word', anchor: { source_word: 8, offset: 0.2 } }];
  board.sound_cues = [];
  assert.equal(compile(board).events[0].time, 1.2);
  assert.throws(() => compile(board, [...words, { ...words[0], segment_id: 'repeat' }]), /repetida/);
  board.events[0].anchor.segment_id = 'take';
  assert.equal(compile(board, [...words, { ...words[0], segment_id: 'repeat' }]).events[0].time, 1.2);
});

test('events fail early for unknown, ambiguous, nonnumeric and out-of-range timing', () => {
  const cases = [
    (b) => { b.events[0].at.item_id = 'missing'; },
    (b) => { b.events[0].at.offset = 4; },
    (b) => { b.events[0].time = 2; },
    (b) => { b.events[0].id = 'card'; },
    (b) => { b.events.push({ ...b.events[0] }); },
    (b) => { b.events[0] = { id: 'contact', purpose: 'x', time: '2' }; },
    (b) => { b.events[0] = { id: 'contact', purpose: 'x', time: 9 }; },
    (b) => { b.events[0] = { id: 'contact', purpose: 'x', anchor: { source_word: 8, duration: 2 } }; },
    (b) => { b.sound_cues[0].event_id = 'missing'; },
    (b) => { b.sound_cues.push({ ...b.sound_cues[0] }); },
    (b) => { b.sound_cues[0].attack = 0.4; },
    (b) => { b.sound_cues[0].offset = -2; },
    (b) => { b.sound_cues[0].offset = 7; },
    (b) => { b.sound_cues[0].duration = NaN; },
    (b) => { delete b.sound_cues[0].volume; },
    (b) => { b.sound_cues[0].playback_rate = 2; },
    (b) => { b.sound_cues[0].asset = 'assets/../outside.wav'; },
    (b) => { b.sound_cues[0].asset = 'https://example.com/remote.wav'; },
    (b) => { b.cards[0].direction.mode = 'always-moving'; },
    (b) => { b.cards[0].reads[0].to = 4; },
    (b) => { b.cards[0].reads[0].to = b.cards[0].reads[0].from; },
    (b) => { b.cards[0].reads.push({ ...b.cards[0].reads[0] }); },
    (b) => { b.cards[0].reads[0].max_cps = 0; },
  ];
  for (const mutate of cases) { const board = input(); mutate(board); assert.throws(() => compile(board), undefined, mutate.toString()); }
  const intentional = input(); intentional.sound_cues[0].offset = -0.1;
  const cue = compile(intentional).sound_cues[0];
  assert.ok(Math.abs(cue.start + cue.attack - 1.9) < 1e-9);
});

test('reading audit reports useful holds and unassessed cards, never a perceptual pass', () => {
  const board = input();
  board.cards[0].reads[0] = { id: 'first', text: 'Ação concluída', from: 0.5, to: 0.8, min_hold: 1, max_cps: 18 };
  board.cards[0].reads.push({ id: 'second', text: 'Novo estado', from: 1, to: 2.8 });
  board.cards.push({ id: 'image', purpose: 'detail', start: 5, end: 6 });
  const audit = auditGraphicReading(compile(board));
  assert.equal(audit.blocks[0].hold, 0.3);
  assert.deepEqual(audit.blocks[0].warnings, ['hold_below_declared_minimum', 'above_declared_reading_speed']);
  assert.equal(audit.blocks[1].status, 'declared-only');
  assert.deepEqual(audit.unchecked_cards, ['image']);
  assert.equal(audit.advisory, true);
  assert.equal(audit.status, 'needs-review');
  assert.equal(auditGraphicReading(compileStoryboard({}, [], 4)).status, 'not-checked');
});

test('managed audio is idempotent, resynchronizes/removes cues and preserves authored content', () => {
  const original = '<html><body><div id="root"><audio id="authored" src="assets/music.wav"></audio><div id="card"></div></div></body></html>';
  const board = compile();
  const first = syncSoundCueMarkup(original, board);
  assert.equal(syncSoundCueMarkup(first, board), first);
  assert.equal((first.match(/id="sfx-click"/g) ?? []).length, 1);
  assert.ok(first.includes('data-start="1.9"'));
  board.sound_cues[0].start = 2;
  const updated = syncSoundCueMarkup(first, board);
  assert.ok(updated.includes('data-start="2"'));
  const removed = syncSoundCueMarkup(updated, { sound_cues: [] });
  assert.ok(removed.includes('<audio id="authored"'));
  assert.ok(!removed.includes('sfx-click'));
  assert.throws(() => syncSoundCueMarkup(first.replace('<!-- EVENT-SOUNDS:END -->', ''), board), /incompleto/);
  assert.throws(() => syncSoundCueMarkup(first + '<!-- EVENT-SOUNDS:END -->', board), /duplicado/);
});

test('frozen sound inspection checks real audio duration, provenance and asset confinement', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vid-cues-'));
  mkdirSync(join(dir, 'assets'));
  const board = compile();
  try {
    assert.throws(() => inspectSoundCues(board, dir), /falta/);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=2000:duration=0.35', '-c:a', 'pcm_s16le', join(dir, 'assets/click.wav')]);
    const report = inspectSoundCues(board, dir);
    assert.equal(report[0].asset_duration, 0.35);
    assert.match(report[0].asset_sha256, /^[a-f0-9]{64}$/);
    board.sound_cues[0].duration = 1;
    assert.throws(() => inspectSoundCues(board, dir), /excede/);
    writeFileSync(join(dir, 'outside.wav'), 'not audio');
    symlinkSync(join(dir, 'outside.wav'), join(dir, 'assets/link.wav'));
    board.sound_cues[0].asset = 'assets/link.wav';
    assert.throws(() => inspectSoundCues(board, dir), /fora/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('vendor policy is idempotent and reapplies scope while preserving technical references', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vid-policy-'));
  try {
    const skill = '---\nname: hyperframes-creative\ndescription: fixture\n---\n# Creative\n';
    const technical = '# Motion Principles\n\n```js\ntl.set(target, {x:0}, 0);\n```\n';
    mkdirSync(join(dir, 'references'));
    writeFileSync(join(dir, 'SKILL.md'), skill);
    writeFileSync(join(dir, 'references/motion-principles.md'), technical);
    applyRepositoryPolicy(dir, 'hyperframes-creative');
    const result = readFileSync(join(dir, 'references/motion-principles.md'), 'utf8');
    assert.ok(result.endsWith(technical.slice(technical.indexOf('\n') + 1)));
    const entry = readFileSync(join(dir, 'SKILL.md'), 'utf8');
    applyRepositoryPolicy(dir, 'hyperframes-creative');
    assert.equal(readFileSync(join(dir, 'SKILL.md'), 'utf8'), entry);
    assert.equal(readFileSync(join(dir, 'references/motion-principles.md'), 'utf8'), result);
    writeFileSync(join(dir, 'references/motion-principles.md'), technical);
    applyRepositoryPolicy(dir, 'hyperframes-creative');
    assert.equal(readFileSync(join(dir, 'references/motion-principles.md'), 'utf8'), result);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
