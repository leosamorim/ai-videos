import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AUDIO_CONFIG, analyzeSignals, boundarySignalNotes, boundaryWindows, generateSignals, mergeWindows, readSignals, signalInput, speechRegions, validateSignalReport, visualChangeCues } from '../scripts/lib/signals.mjs';
import { SIGNAL_LOCK, SIGNAL_WORKER, signalRuntimeStatus } from '../scripts/lib/signal-runtime.mjs';
import { audioTimelineFilter } from '../scripts/lib/media.mjs';
import { digest, fileHash } from '../scripts/lib/fingerprint.mjs';
import { ROOT } from '../scripts/lib/util.mjs';

const temporary = () => mkdtempSync(join(tmpdir(), 'vid-signals-'));
const write = (path, value) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, JSON.stringify(value)); };
const cli = (...args) => execFileSync(process.execPath, [join(ROOT, 'scripts/vid.mjs'), ...args], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const rows = (probability, duration = 1) => Array.from({ length: Math.ceil(duration / 0.032) }, (_, i) => [i * 0.032, typeof probability === 'function' ? probability(i) : probability]);

test('VAD preserves brief vocal activity and uncertainty; its regions are not an EDL', () => {
  const brief = speechRegions(rows((i) => i === 10 ? 0.9 : 0), 1);
  assert.equal(brief.length, 1);
  assert.ok(brief[0].start < 0.32 && brief[0].end > 0.352);
  assert.deepEqual(speechRegions(rows(0), 1), []);
  assert.deepEqual(speechRegions(rows(0.9), 1), [{ start: 0, end: 1 }]);
  assert.equal(speechRegions(rows((i) => i > 10 && i < 14 ? 0.1 : 0.9), 1).length, 1);
  assert.throws(() => speechRegions([], 1, { ...AUDIO_CONFIG, off: 0.9 }), /configuração/);
  assert.ok(!('keep' in brief) && !('discarded' in brief));
});

test('visual windows merge and clamp context independently of take order, including opening and ending', () => {
  const segments = [{ start: 3, end: 5 }, { start: 0, end: 1 }];
  const windows = boundaryWindows(segments, 5, 0.5);
  assert.deepEqual(windows, [{ start: 0, end: 1.5 }, { start: 2.5, end: 3.5 }, { start: 4.5, end: 5 }]);
  assert.deepEqual(windows, boundaryWindows([...segments].reverse(), 5, 0.5));
  for (const bad of [-1, NaN, 30]) assert.throws(() => boundaryWindows(segments, 5, bad), /context/);
  assert.throws(() => mergeWindows([{ start: 4, end: 6 }], 5), /janela/);
});

test('boundary warnings are contextual read-only cues, not decisions or expression thresholds', () => {
  const keep = [{ id: 'selected', start: 0.5, end: 0.8 }], before = structuredClone(keep);
  const audio = { kind: 'audio', rows: rows(0.95) };
  assert.equal(boundarySignalNotes([audio], keep).length, 2);
  assert.deepEqual(keep, before);
  assert.deepEqual(boundarySignalNotes([{ ...audio, rows: rows(0) }], keep), []);
  assert.deepEqual(boundarySignalNotes([], keep), []);
  const face = { kind: 'face', rows: [{ time: 0.4, face: true, orientation_degrees: [80, 0, 0] }, { time: 0.6, face: true }] };
  assert.deepEqual(boundarySignalNotes([face], keep), [], 'head angle is not a defect');
});

test('visual ranking cannot bridge unsampled intervals or treat invisible wrists as movement', () => {
  const face = { fps: 5, windows: [{ start: 0, end: 0.4 }, { start: 1, end: 1.4 }], rows: [
    { time: 0, orientation_degrees: [179, 0, 0], wrists: [[0, 0, 0], [0, 0, 0]] },
    { time: 0.2, orientation_degrees: [-179, 0, 0], wrists: [[1, 1, 0], [1, 1, 0]] },
    { time: 1, orientation_degrees: [0, 0, 0] }, { time: 1.2, orientation_degrees: [5, 0, 0] },
  ] };
  const cues = visualChangeCues(face, { rows: rows(0.8, 2) });
  assert.ok(cues.every((cue) => cue.kind === 'head' && cue.delta <= 5 && cue.speech === 0.8));
  assert.ok(cues.some((cue) => cue.delta === 2), 'orientation wraps around 180 degrees');
});

test('model readiness fails without installing, and off/auto/required have distinct behavior', () => {
  const dir = temporary(), missing = join(dir, 'uninstalled');
  try {
    assert.equal(signalRuntimeStatus({ home: missing }).ok, false);
    assert.equal(existsSync(missing), false);
    assert.doesNotThrow(() => analyzeSignals(null, 'off'));
    const warn = console.warn; console.warn = () => {};
    try { assert.doesNotThrow(() => analyzeSignals(null, 'auto')); }
    finally { console.warn = warn; }
    assert.throws(() => analyzeSignals(null, 'required'));
    assert.throws(() => analyzeSignals(null, 'typo'), /signals/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('inference identity changes with media, clock, model runtime and sampling, not text or take ordering', () => {
  const args = { media: 'same bytes', duration: 2, offset: 0.107, runtime: { versions: { onnx: 'fixture' } }, kind: 'audio' };
  const first = signalInput(args);
  assert.deepEqual(first, signalInput({ ...args, transcript: 'spelling corrected' }));
  for (const patch of [{ media: 'other' }, { offset: 0 }, { duration: 3 }, { fps: 10 }, { runtime: { versions: { onnx: 'changed' } } }]) assert.notEqual(digest(first), digest(signalInput({ ...args, ...patch })));
});

test('report validation and reader reject wrong clocks, corrupt bytes and a changed source', () => {
  const dir = temporary();
  try {
    const project = { dir, data: { source: { file: 'raw.bin' } }, paths: { analysis: join(dir, 'analysis') } };
    writeFileSync(join(dir, 'raw.bin'), 'source fixture');
    const input = { kind: 'audio', media: fileHash(join(dir, 'raw.bin')), duration: 1, worker: fileHash(SIGNAL_WORKER), models: SIGNAL_LOCK.models };
    const report = { schema: 1, clock: 'source-video', kind: 'audio', sample_rate: 16000, samples: 16000, rows: rows(0), input };
    assert.doesNotThrow(() => validateSignalReport(report, input));
    assert.throws(() => validateSignalReport({ ...report, samples: 15999 }, input), /PCM/);
    assert.throws(() => validateSignalReport({ ...report, clock: 'edited' }, input), /inválido/);
    assert.throws(() => validateSignalReport({ ...report, rows: [[-1, 0]] }, input), /relógio/);
    const reportPath = join(project.paths.analysis, 'report.json'); write(reportPath, report);
    const index = { schema: 1, clock: 'source-video', media: input.media, reports: [{ kind: 'audio', key: digest(input), path: 'report.json', sha256: fileHash(reportPath) }] };
    write(join(project.paths.analysis, 'signals.json'), index);
    assert.equal(readSignals(project).reports.length, 1);
    writeFileSync(reportPath, 'corrupt');
    assert.equal(readSignals(project).reports.length, 0);
    assert.equal(readSignals(project).warnings.length, 1);
    write(reportPath, report);
    writeFileSync(join(dir, 'raw.bin'), 'changed source');
    assert.equal(readSignals(project).reports.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('PCM alignment preserves positive and negative audio offsets to the exact sample', () => {
  const dir = temporary();
  try {
    const input = join(dir, 'pulse.wav');
    ff('-f', 'lavfi', '-i', 'aevalsrc=if(between(t\\,0.3\\,0.31)\\,0.8\\,0):s=16000:d=1', '-c:a', 'pcm_s16le', input);
    for (const offset of [0.107375, -0.1]) {
      const bytes = ff('-i', input, '-af', audioTimelineFilter({ offset, duration: 1, sampleRate: 16000 }), '-f', 's16le', '-');
      assert.equal(bytes.length, 32000);
      let first = -1;
      for (let i = 0; i < bytes.length / 2; i++) if (bytes.readInt16LE(i * 2) > 1000) { first = i; break; }
      assert.equal(first, Math.round((0.3 + offset) * 16000));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('real models, caches and CLI keep project decisions immutable', { skip: !process.env.VID_SIGNALS_SMOKE, timeout: 180000 }, () => {
  assert.equal(signalRuntimeStatus({ pose: true }).ok, true, 'run signals setup --pose first');
  const dir = temporary(), slug = `test-signals-${process.pid}`, projectDir = join(ROOT, 'videos', slug);
  assert.equal(existsSync(projectDir), false);
  try {
    const source = join(dir, 'source.mkv');
    ff('-f', 'lavfi', '-i', 'testsrc2=s=160x284:r=30:d=2', '-itsoffset', '0.107', '-f', 'lavfi', '-i', 'sine=f=440:r=16000:d=1.8', '-c:v', 'ffv1', '-c:a', 'pcm_s16le', source);
    cli('new', slug, '--source', source, '--review', 'autonomous');
    const transcriptPath = join(projectDir, '01-transcript/transcript.raw.json');
    write(transcriptPath, { schema: 2, timeline: 'source-video', words: [] });
    cli('analyze', slug, '--every', '1', '--signals', 'required');
    const read = (path) => JSON.parse(readFileSync(join(projectDir, path)));
    const project = { dir: projectDir, data: read('project.json'), paths: { analysis: join(projectDir, '01-analysis'), transcript: join(projectDir, '01-transcript'), cut: join(projectDir, '02-cut') } };
    const before = ['project.json', '02-cut/edit-plan.json', '01-analysis/evidence.json'].map((path) => fileHash(join(projectDir, path)));
    assert.equal(readSignals(project).reports[0].samples, 32000);
    assert.equal(readSignals(project).summary_current, true);
    assert.ok(readSignals(project).reports[0].input.offset > 0.1);
    assert.equal(generateSignals(project).cached, true);
    cli('signals', slug, '--pose', '--from', '0.2', '--to', '1.8');
    const face = readSignals(project).reports.find((r) => r.kind === 'face');
    assert.equal(face.rows.length, 8);
    assert.ok(face.rows.every((r) => typeof r.face === 'boolean' && typeof r.pose === 'boolean'), 'execution contract, not an accuracy assertion on a test pattern');
    assert.match(cli('signals', slug, '--pose', '--from', '0.2', '--to', '1.8'), /cache íntegro/);
    assert.deepEqual(['project.json', '02-cut/edit-plan.json', '01-analysis/evidence.json'].map((path) => fileHash(join(projectDir, path))), before);
    const plan = read('02-cut/edit-plan.json');
    plan.segments = [{ id: 'later', start: 1, end: 1.6 }, { id: 'earlier', start: 0.2, end: 0.6 }];
    write(join(projectDir, '02-cut/edit-plan.json'), plan);
    assert.equal(readSignals(project).summary_current, false, 'new boundaries make the old prose stale');
    const planHash = fileHash(join(projectDir, '02-cut/edit-plan.json'));
    cli('signals', slug, '--face', '--boundaries', '--context', '0.2');
    assert.equal(readSignals(project).summary_current, true);
    assert.equal(fileHash(join(projectDir, '02-cut/edit-plan.json')), planHash);
    assert.deepEqual(readSignals(project).reports.at(-1).input.windows, boundaryWindows(plan.segments, 2, 0.2));
    const firstAudio = readSignals(project).reports.find((r) => r.kind === 'audio');
    assert.deepEqual(generateSignals(project, { force: true }).report.rows, firstAudio.rows);
    write(transcriptPath, { schema: 2, timeline: 'source-video', words: [{ text: 'synthetic', start: 0.4, end: 0.6 }] });
    assert.equal(generateSignals(project).cached, true, 'text changes do not run inference again');
    assert.equal(readSignals(project).reports.some((r) => r.kind === 'face'), false, 'stale semantic proxy requires analyze refresh');
    assert.equal(readSignals(project).summary_current, true, 'fresh summary can honestly report unavailable old visual measurements');
    assert.equal(fileHash(join(projectDir, 'project.json')), before[0]);
    cli('analyze', slug, '--every', '1', '--signals', 'off');
    assert.match(cli('inspect', slug, '--from', '0.2', '--to', '0.6', '--face'), /Signals face/);
    assert.match(cli('inspect', slug, '--from', '0.2', '--to', '0.6', '--face'), /cache íntegro/);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(projectDir, { recursive: true, force: true }); }
});
