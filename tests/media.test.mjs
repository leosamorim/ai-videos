import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCutFilter, buildEdl } from '../scripts/lib/cuts.mjs';
import { extractAudio } from '../scripts/lib/transcribe.mjs';
import { filterFileArgs, probe } from '../scripts/lib/media.mjs';

test('FFmpeg preserves exact frame count and source audio offset through extraction and cuts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vid-media-'));
  const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  try {
    const source = join(dir, 'source.mkv');
    ff(['-f', 'lavfi', '-i', 'testsrc2=size=160x284:rate=30:duration=2', '-itsoffset', '0.2', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1.8', '-c:v', 'ffv1', '-c:a', 'pcm_s16le', source]);
    const info = probe(source);
    assert.ok(Math.abs(info.timeline.audio_offset - 0.2) < 0.002);
    const wav = join(dir, 'audio.wav');
    extractAudio(source, wav);
    const energy = (file, from, to) => {
      const pcm = ff(['-i', file, '-af', `atrim=start=${from}:end=${to}`, '-f', 'f32le', '-ac', '1', 'pipe:1']);
      let sum = 0;
      for (let i = 0; i < pcm.length; i += 4) sum += pcm.readFloatLE(i) ** 2;
      return sum / (pcm.length / 4);
    };
    assert.ok(energy(wav, 0, 0.15) < 1e-8, 'leading source silence remains in PCM');
    assert.ok(energy(wav, 0.3, 0.5) > 1e-4, 'tone starts after its original offset');
    const edl = buildEdl({ duration: 2, fps: 30 });
    const filter = join(dir, 'cut.txt');
    writeFileSync(filter, buildCutFilter({ keep: edl.keep, fps: 30, post: 'format=yuv420p', audioOffset: info.timeline.audio_offset, duration: 2 }));
    const output = join(dir, 'out.mp4');
    ff(['-i', source, ...filterFileArgs(filter), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', output]);
    const result = probe(output);
    assert.equal(result.video.frames, 60);
    assert.ok(Math.abs(result.duration - 2) < 0.001);
    assert.ok(energy(output, 0, 0.15) < 1e-7);
    assert.ok(energy(output, 0.3, 0.5) > 1e-4);
    const reordered = buildEdl({ duration: 2, fps: 30, selections: [{ id: 'tail', start: 1, end: 2 }, { id: 'head', start: 0, end: 0.5 }] });
    writeFileSync(filter, buildCutFilter({ keep: reordered.keep, fps: 30, post: 'format=yuv420p', audioOffset: 0.2, duration: 2 }));
    ff(['-i', source, ...filterFileArgs(filter), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', output]);
    assert.equal(probe(output).video.frames, 45);
    assert.ok(energy(output, 1.03, 1.15) < 1e-7, 'reordered source silence maps to the correct output segment');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
