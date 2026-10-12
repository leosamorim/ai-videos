import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCache, restoreCache, writeCache } from '../scripts/lib/cache.mjs';
import { cachedTranscribe } from '../scripts/lib/transcribe.mjs';
import { compareSpeech } from '../scripts/lib/speech-review.mjs';
import { compareIdentities, decodedIdentity } from '../scripts/lib/render-diff.mjs';
import { contactSheets, sequenceShots } from '../scripts/lib/frames.mjs';
import { fileHash } from '../scripts/lib/fingerprint.mjs';

const temp = () => mkdtempSync(join(tmpdir(), 'vid-economy-'));
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 32 * 1024 * 1024 });

test('shared cache validates bytes, isolates parameters and never accepts damaged artifacts', () => {
  const dir = temp();
  try {
    const source = join(dir, 'source.json'); writeFileSync(source, '{"words":[1]}');
    const input = { source: 'hash', model: 'same' };
    const entry = writeCache('fixture', input, { files: { 'data.json': source } }, dir);
    assert.ok(readCache('fixture', input, dir));
    assert.equal(readCache('fixture', { ...input, model: 'different' }, dir), null);
    const restored = join(dir, 'other-project', 'data.json');
    restoreCache(entry, 'data.json', restored);
    assert.equal(fileHash(restored), fileHash(source));
    writeFileSync(join(entry.dir, 'data.json'), 'damaged');
    assert.equal(readCache('fixture', input, dir), null);
    assert.throws(() => restoreCache(entry, 'data.json', restored), /changed/);
    assert.ok(writeCache('fixture', input, { files: { 'data.json': source } }, dir));
    assert.throws(() => writeCache('../escape', input, { files: { 'data.json': source } }, dir), /namespace/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ASR runs once for identical audio; changed expected words are still compared and force refreshes', async () => {
  const dir = temp();
  try {
    const audio = join(dir, 'audio.wav'); writeFileSync(audio, 'synthetic ASR runner input');
    let calls = 0;
    const runner = async () => { calls++; return { words: [{ text: `palavra${calls}`, start: 0, end: 1 }] }; };
    const options = { provider: 'local', language: 'pt', duration: 1 };
    const policy = { runner, cacheRoot: dir };
    const first = await cachedTranscribe(audio, options, policy);
    first.transcript.words[0].text = 'correção local';
    const second = await cachedTranscribe(audio, options, policy);
    assert.equal(calls, 1);
    assert.equal(second.cache_hit, true);
    assert.equal(second.transcript.words[0].text, 'palavra1');
    assert.equal(compareSpeech(second.transcript.words, second.transcript.words).issues.length, 0);
    assert.ok(compareSpeech([{ text: 'outra', start: 0, end: 1 }], second.transcript.words).issues.length);
    await cachedTranscribe(audio, options, { ...policy, force: true });
    assert.equal((await cachedTranscribe(audio, options, policy)).transcript.words[0].text, 'palavra2');
    await cachedTranscribe(audio, { ...options, model: 'different' }, policy);
    assert.equal(calls, 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('decoded diff detects exact changed frames, expands whole motion, and separates audio-only changes', () => {
  const dir = temp();
  try {
    const before = join(dir, 'before.mkv'), after = join(dir, 'after.mkv'), audio = join(dir, 'audio.mkv');
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=160x284:rate=12:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:v', 'ffv1', '-c:a', 'pcm_s16le', before]);
    ff(['-i', before, '-vf', "drawbox=x=50:y=100:w=20:h=20:color=red:t=fill:enable='between(n,8,9)'", '-c:v', 'ffv1', '-c:a', 'copy', after]);
    ff(['-i', before, '-af', 'volume=0.5', '-c:v', 'copy', '-c:a', 'pcm_s16le', audio]);
    const a = decodedIdentity(before, { cacheRoot: dir });
    const b = decodedIdentity(after, { cacheRoot: dir });
    const diff = compareIdentities(a, b, { motions: [{ id: 'entire', start: 0.4, end: 1.2 }] });
    assert.equal(diff.compatible_timeline, true);
    assert.equal(diff.changed_frames, 2);
    assert.deepEqual(diff.changed_ranges, [{ from: 8, to: 9 }]);
    assert.deepEqual(diff.affected_motion_ids, ['entire']);
    assert.ok(diff.required_ranges[0].from < 6 && diff.required_ranges[0].to > 14);
    assert.equal(diff.audio_equal, true);
    assert.equal(diff.complete, false);
    const onlyAudio = compareIdentities(a, decodedIdentity(audio, { cacheRoot: dir }));
    assert.equal(onlyAudio.changed_frames, 0);
    assert.equal(onlyAudio.audio_equal, false);
    assert.deepEqual(decodedIdentity(before, { cacheRoot: dir }), a);
    const changedClock = structuredClone(b); changedClock.frames[0].pts = '1/10';
    assert.equal(compareIdentities(a, changedClock).changed_frames, 24);
    const changedColor = structuredClone(a); changedColor.video.color_range = 'pc';
    assert.equal(compareIdentities(a, changedColor).changed_frames, 24);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('batch frame extraction respects exact order/duplicates and reuses only intact sheets', () => {
  const dir = temp();
  try {
    const video = join(dir, 'source.mkv');
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=160x284:rate=12:duration=2', '-c:v', 'ffv1', video]);
    const shots = [8, 2, 8, 12].map((frame) => ({ frame, time: frame / 12, label: `q${frame}` }));
    const out = join(dir, 'sheets');
    const sheets = contactSheets(video, shots, out, { columns: 2, rows: 2, thumbWidth: 160 });
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'manifest.json'))).frame_indices, [8, 2, 8, 12]);
    const bottom = (file) => ff(['-i', file, '-vf', 'crop=160:200:0:70,format=rgb24', '-f', 'rawvideo', '-']);
    assert.deepEqual(bottom(join(out, 'frames/0000.png')), bottom(join(out, 'frames/0002.png')));
    assert.notDeepEqual(bottom(join(out, 'frames/0000.png')), bottom(join(out, 'frames/0001.png')));
    const mtime = statSync(sheets[0]).mtimeMs;
    assert.deepEqual(contactSheets(video, shots, out, { columns: 2, rows: 2, thumbWidth: 160 }), sheets);
    assert.equal(statSync(sheets[0]).mtimeMs, mtime);
    writeFileSync(sheets[0], 'damaged');
    const regenerated = contactSheets(video, shots, out, { columns: 2, rows: 2, thumbWidth: 160 });
    assert.ok(existsSync(regenerated[0]));
    assert.notEqual(fileHash(regenerated[0]), fileHash(sheets[0]));
    assert.equal(sequenceShots(0.5, 1, 12).length, 7);
    assert.throws(() => contactSheets(video, [{ frame: 999, time: 99 }], join(dir, 'invalid')), /quadro|ENOENT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
