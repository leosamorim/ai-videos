import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/util.mjs';
import { readReferenceUrl } from '../scripts/lib/references.mjs';
import { fileHash } from '../scripts/lib/fingerprint.mjs';

test('site intake captures supplied HTTP content with a size limit', async () => {
  const server = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<title>Casa</title><p>Projeto</p>'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/`;
    const result = await readReferenceUrl(url);
    assert.ok(result.bytes.toString().includes('Projeto'));
    await assert.rejects(readReferenceUrl(url, { maxBytes: 4 }), /limite|grande/);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('CLI flow joins evidence, references, selections, anchored graphics and stale-state detection', { timeout: 180000 }, () => {
  const temp = mkdtempSync(join(tmpdir(), 'vid-workflow-'));
  const slug = `test-workflow-${process.pid}`;
  const dir = join(ROOT, 'videos', slug);
  assert.equal(existsSync(dir), false);
  const cli = (...args) => execFileSync(process.execPath, [join(ROOT, 'scripts/vid.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
  const read = (path) => JSON.parse(readFileSync(join(dir, path), 'utf8'));
  const write = (path, value) => writeFileSync(join(dir, path), JSON.stringify(value, null, 2));
  try {
    const source = join(temp, 'source.mkv');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x284:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'ffv1', '-c:a', 'pcm_s16le', source]);
    cli('new', slug, '--source', source, '--review', 'autonomous');
    const reference = join(temp, 'brief.txt'); writeFileSync(reference, 'Fixture: cores neutras; explicar a largura.');
    cli('reference', slug, reference, '--role', 'brand');
    assert.equal(read('00-references/manifest.json').references[0].role, 'brand');
    write('00-references/direction.json', { reviewed: true, reference_ids: ['ref-001'], theme: 'fixture', visual_decisions: [] });
    cli('stage', slug, 'intake', 'done');
    write('01-transcript/transcript.raw.json', { schema: 2, timeline: 'source-video', language: 'pt', words: [{ i: 0, text: 'Armário', start: 0.5, end: 1 }, { i: 1, text: 'estreito.', start: 1.1, end: 1.6 }] });
    cli('stage', slug, 'transcript', 'done');
    const beforeResume = readFileSync(join(dir, 'project.json'), 'utf8');
    const compact = cli('resume', slug, '--chars', '5000', '--json');
    assert.equal(JSON.parse(compact).project, slug);
    assert.ok(compact.length < 8000);
    assert.equal(readFileSync(join(dir, 'project.json'), 'utf8'), beforeResume, 'resume must not write state');
    cli('analyze', slug, '--every', '1');
    cli('inspect', slug, '--from', '0', '--to', '0.3');
    cli('inspect', slug, '--from', '2.7', '--to', '3');
    const evidence = read('01-analysis/evidence.json');
    const plan = read('02-cut/edit-plan.json');
    plan.reviewer = 'synthetic integration fixture';
    plan.review = { transcript_reviewed: true, visual_reviewed: true, visual_method: 'frames', uncertainties: [], observations: evidence.items.map((e) => ({ evidence_id: e.id, observation: 'synthetic fixture with known generated timeline' })) };
    plan.segments = [{ id: 'main', start: 0.3, end: 2.7, reason: 'fixture keep interval', evidence_ids: ['overview-1'] }];
    plan.discarded = [{ id: 'setup', start: 0, end: 0.3, reason: 'fixture trim head', kind: 'setup', evidence_ids: ['detail-0-300'] }, { id: 'tail', start: 2.7, end: 3, reason: 'fixture trim tail', kind: 'post-roll', evidence_ids: ['detail-2700-3000'] }];
    write('02-cut/edit-plan.json', plan);
    cli('editorial', slug);
    cli('cut', slug, '--dry-run');
    assert.equal(existsSync(join(dir, '02-cut/master.mp4')), false);
    cli('cut', slug);
    assert.equal(read('02-cut/edl.json').edited_duration, 2.4);
    assert.deepEqual(read('06-review/cut-boundaries/manifest.json').frame_indices, [0, 71]);
    cli('frames', slug, '--clean', '--cuts', '--context', '0.1', '--boundary', 'end', '--name', 'ending-test');
    assert.deepEqual(read('06-review/ending-test/manifest.json').frame_indices, [69, 70, 71]);
    assert.throws(() => cli('frames', slug, '--cuts', '--context', '-1'), /context/);
    assert.throws(() => cli('frames', slug, '--boundary', 'end'), /exigem --cuts/);
    assert.throws(() => cli('frames', slug, '--cuts', '--seq', '0-1'), /separado/);
    assert.throws(() => cli('frames', slug, '--cuts', '--file', source), /relógios diferentes/);
    const originalMaster = fileHash(join(dir, '02-cut/master.mp4'));
    const originalSheet = evidence.items.find((e) => e.type === 'contact-sheet').sha256;
    const corrected = read('01-transcript/transcript.raw.json'); corrected.words[0].text = 'Móvel';
    write('01-transcript/transcript.raw.json', corrected);
    cli('stage', slug, 'transcript', 'done');
    assert.match(cli('analyze', slug, '--every', '1'), /reaproveitados/);
    const refreshedEvidence = read('01-analysis/evidence.json');
    assert.equal(refreshedEvidence.items.find((e) => e.type === 'contact-sheet').sha256, originalSheet);
    assert.ok(refreshedEvidence.items.some((e) => e.id === 'detail-0-300'));
    assert.throws(() => cli('editorial', slug), /desatualizados/);
    plan.source_signature = refreshedEvidence.source_signature;
    write('02-cut/edit-plan.json', plan); // Synthetic re-review, not an automatic approval.
    assert.match(cli('cut', slug), /reaproveitados/);
    assert.equal(fileHash(join(dir, '02-cut/master.mp4')), originalMaster);
    assert.equal(read('02-cut/transcript.json').words[0].text, 'Móvel');
    cli('plan', slug, '--init');
    const board = read('03-plan/storyboard.json'); board.intent = 'integration fixture';
    board.reframes = [{ id: 'closer', purpose: 'inspect subject', anchor: { source_word: 0, duration: 1 }, scale: 1.1 }];
    write('03-plan/storyboard.json', board);
    cli('plan', slug);
    cli('compose', slug);
    assert.equal(read('04-composition/metadata.json').media_tier, 'master');
    cli('compose', slug, '--media', 'proxy');
    assert.equal(read('04-composition/metadata.json').media_tier, 'proxy');
    assert.equal(fileHash(join(dir, '04-composition/assets/clean.mp4')), fileHash(join(dir, '02-cut/clean.mp4')));
    cli('compose', slug, '--media', 'master');
    assert.ok(readFileSync(join(dir, '04-composition/editorial.generated.js'), 'utf8').includes('"start":0.2'));
    // Legacy projects work without strategy; opt-in connects the new contract
    // to real FFmpeg output and the same HyperFrames render path.
    cli('strategy', slug, '--init');
    const strategy = JSON.parse(readFileSync(join(ROOT, 'templates/strategy.example.json'), 'utf8'));
    strategy.cta = { action: 'none', why: 'Synthetic pipeline fixture, no marketing delivery.' };
    strategy.beats = strategy.beats.slice(0, 2);
    write('strategy.json', strategy);
    cli('strategy', slug);
    assert.equal(read('project.json').stages.cut, 'done');
    assert.equal(read('project.json').stages.plan, 'pending');
    assert.throws(() => cli('plan', slug), /sem tempo no storyboard/);
    board.beats = [
      { id: 'b-hook', purpose: 'Synthetic opening', anchor: { source_word: 0, duration: 1 } },
      { id: 'b-payoff', purpose: 'Synthetic payoff', anchor: { source_word: 1, duration: 1 } },
    ];
    board.reframes[0].beat_id = 'b-hook';
    write('03-plan/storyboard.json', board);
    cli('plan', slug);
    assert.ok(read('03-plan/resolved.json').strategy_sha256);
    cli('compose', slug);
    assert.ok(readFileSync(join(dir, '04-composition/editorial.generated.js'), 'utf8').includes('"b-payoff"'));
    if (process.env.HF_RENDER_SMOKE === '1') {
      const captionConfig = read('04-composition/captions.config.json');
      captionConfig.plate = { color: '#000000', radius: 12, paddingX: 18, paddingY: 10 };
      write('04-composition/captions.config.json', captionConfig);
      const index = join(dir, '04-composition/index.html');
      let html = readFileSync(index, 'utf8');
      html = html.replace('<!-- CARDS:START -->', `<!-- CARDS:START -->
        <div id="fixture-button" style="position:absolute;left:100px;top:150px;width:400px;height:120px;background:#233a31;color:white;font:56px Inter">
          <span id="fixture-label" style="position:absolute;left:25px;top:20px">Seguir</span>
          <span id="fixture-done" style="position:absolute;left:25px;top:20px;opacity:0">Seguindo</span>
          <svg id="fixture-cursor" viewBox="0 0 24 24" style="position:absolute;left:300px;top:75px;width:48px;height:48px;opacity:0"><path d="M3 2 L20 13 L12 14 L9 22 Z" fill="white" stroke="black" stroke-width="1.5" /></svg>
        </div>
        <svg style="position:absolute;left:100px;top:300px;width:400px;height:60px"><path id="fixture-line" d="M10 30 L380 30" fill="none" stroke="#fafafa" stroke-width="5" pathLength="1" /></svg>`);
      html = html.replace('window.applyEditorialReframes(tl);', `window.applyEditorialReframes(tl);
        VidMotion.enter(tl, '#fixture-button', {id:'fixture-entry',start:0.1,duration:0.3});
        VidMotion.draw(tl, '#fixture-line', {id:'fixture-draw',start:0.2,duration:0.6,length:1});
        VidMotion.click(tl, {button:'#fixture-button',cursor:'#fixture-cursor',label:'#fixture-label',doneLabel:'#fixture-done'}, {id:'fixture-click',start:1,duration:1});`);
      writeFileSync(index, html);
      write('04-composition/motion-plan.json', { motions: [
        { id: 'fixture-entry', start: 0.1, end: 0.4 }, { id: 'fixture-draw', start: 0.2, end: 0.8 },
        { id: 'fixture-click', start: 1, end: 2 }, { id: 'closer', start: 0.2, end: 1.2 },
      ] });
      cli('compose', slug, '--media', 'proxy');
      console.log(cli('check', slug));
      console.log(cli('render', slug, '--quality', 'draft', '--workers', '1'));
      assert.equal(read('project.json').renders.at(-1).media_tier, 'proxy');
      assert.throws(() => cli('finalize', slug, '--force'), /master/);
      cli('compose', slug, '--media', 'master');
      console.log(cli('check', slug));
      console.log(cli('render', slug, '--quality', 'looks', '--workers', '1'));
      console.log(cli('verify', slug));
      cli('review', slug);
      const review = read('06-review/review.json');
      assert.equal(review.checks.strategy.ok, false);
      review.reviewer = 'integration test'; review.method = 'human-playback';
      for (const item of Object.values(review.checks)) { item.ok = true; item.notes = 'Synthetic fixture; exercising delivery contract, not artistic approval.'; }
      write('06-review/review.json', review);
      cli('review', slug, '--complete');
      const renderFile = join(dir, read('project.json').renders.at(-1).file);
      const beforeDiffReview = readFileSync(join(dir, '06-review/review.json'), 'utf8');
      assert.match(cli('diff', slug, '--from', renderFile, '--review', join(dir, '06-review/review.json')), /72\/72 quadros idênticos/);
      const hash = fileHash(renderFile).slice(0, 12);
      const diffPath = `06-review/diff-${hash}-${hash}.json`;
      assert.equal(read(diffPath).evidence_reuse_eligible, true);
      assert.equal(read(diffPath).complete, false);
      assert.match(cli('frames', slug, '--diff', join(dir, diffPath)), /Nenhum quadro alterado/);
      assert.equal(readFileSync(join(dir, '06-review/review.json'), 'utf8'), beforeDiffReview);
      cli('finalize', slug);
      assert.equal(read('project.json').stages.final, 'done');
      cli('verify', slug, '--file', join(dir, '05-renders/final.mp4'));
      cli('status', slug);
      assert.equal(read('project.json').stages.final, 'done', 'final verification must not invalidate the approved render');
      writeFileSync(join(dir, '06-review/learning.md'), 'Synthetic post-publication observation.');
      cli('status', slug);
      assert.equal(read('project.json').stages.final, 'done', 'analytics notes must not invalidate the export');
    }
    writeFileSync(join(dir, 'theme.json'), JSON.stringify({ ...read('theme.json'), name: 'changed reference direction' }));
    cli('status', slug);
    assert.equal(read('project.json').stages.composition, 'pending');
    assert.throws(() => cli('render', slug), /corte\/storyboard|desatualizado|composição/);
  } catch (error) {
    if (error.stderr) error.message += '\n' + error.stderr.toString();
    throw error;
  } finally { rmSync(temp, { recursive: true, force: true }); rmSync(dir, { recursive: true, force: true }); }
});
