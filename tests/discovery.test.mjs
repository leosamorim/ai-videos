import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cachedDiscovery, KINDS, localReferences, memoryPath, openverseSearch, rank, readMemory, remember, validateMemory } from '../scripts/lib/discovery.mjs';
import { referenceExtension } from '../scripts/lib/references.mjs';
import { reference } from '../scripts/commands/references.mjs';
import { ROOT } from '../scripts/lib/util.mjs';

const entry = (file) => ({ schema: 1, id: 'comparison', title: 'Comparação com respiro', kinds: ['editing'], tags: ['demonstração'], source: { file }, context: 'Explicação longa com detalhe útil.', inspection: { method: 'frames', notes: 'Synthetic frames; no continuous playback.' }, borrow: 'Segurar o plano para observar o detalhe.', avoid: 'Zoom arbitrário em cada frase.', feedback: { by: 'agent', verdict: 'mixed', evidence: 'Synthetic editorial assessment, not human approval.' }, rights: { use: 'reference-only', status: 'unverified', notes: 'Estudar, não reutilizar o clip.' } });
const temp = () => mkdtempSync(join(tmpdir(), 'vid-discovery-'));

test('source routes use valid unique IDs, inspected provenance and usable entry points', () => {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'library/sources.json'), 'utf8'));
  const ids = new Set();
  for (const source of catalog.sources) {
    assert.ok(!ids.has(source.id)); ids.add(source.id);
    assert.ok(source.kinds.length && source.kinds.every((kind) => KINDS.includes(kind)));
    assert.ok(['https:', 'http:'].includes(new URL(source.url).protocol));
    assert.ok(source.access && source.check_method && source.checked_on && source.license_url);
  }
  const audio = rank(catalog.sources, 'clique discreto', { kind: 'sfx', limit: 3 });
  assert.ok(audio.every((r) => r.kinds.includes('sfx')));
  assert.ok(audio.some((r) => r.id === 'kenney-audio'));
});

test('local matching respects accents, kind and relevance without inventing semantic search', () => {
  const items = [{ id: 'a', title: 'Comparação', kinds: ['editing'], tags: [], priority: 2 }, { id: 'b', title: 'Comparação de fontes', kinds: ['typography'], tags: [], priority: 0 }];
  assert.equal(rank(items, 'comparacao', { kind: 'editing' })[0].id, 'a');
  assert.equal(rank(items, 'sem correspondência')[0].match_score, 0);
});

test('learned references distinguish unverified inspiration from assets and preserve revisions', () => {
  const root = temp(); writeFileSync(join(root, 'clip.mp4'), 'first bytes');
  try {
    const value = entry('clip.mp4');
    value.rights.use = 'asset';
    assert.throws(() => validateMemory(value, root), /direitos conferidos/);
    value.rights.use = 'reference-only';
    remember(value, { root });
    assert.equal(readMemory(value.id, root).feedback.by, 'agent');
    assert.throws(() => remember(value, { root }), /já existe/);
    const initial = readFileSync(memoryPath(value.id, root), 'utf8');
    value.avoid = 'Outro limite contextual';
    remember(value, { root, replace: true });
    const history = join(root, 'library/references/.history');
    assert.equal(readFileSync(join(history, readdirSync(history)[0]), 'utf8'), initial);
    writeFileSync(join(root, 'clip.mp4'), 'changed bytes');
    assert.throws(() => readMemory(value.id, root), /arquivo mudou/);
    assert.throws(() => memoryPath('../escape', root), /inválido/);
    assert.throws(() => memoryPath(123, root), /inválido/);
    value.feedback.evidence = '';
    assert.throws(() => validateMemory(value, root), /aprovação humana/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('local search reads existing projects without changing state or promoting final renders', () => {
  const root = temp();
  const project = join(root, 'videos', 'example');
  mkdirSync(join(project, '00-references'), { recursive: true });
  writeFileSync(join(project, 'final.mp4'), 'synthetic render');
  writeFileSync(join(project, 'project.json'), JSON.stringify({ title: 'Example', final: { file: 'final.mp4' }, stages: { final: 'done' }, review_policy: 'autonomous' }));
  writeFileSync(join(project, '00-references/manifest.json'), JSON.stringify({ references: [{ id: 'ref-001', title: 'Ritmo', role: 'editing', file: 'somewhere.mp4', review: 'pending' }] }));
  const before = readFileSync(join(project, 'project.json'), 'utf8');
  try {
    const result = localReferences({ root });
    assert.equal(result.results.length, 2);
    assert.equal(result.results.find((r) => r.origin === 'project-render').feedback.verdict, 'neutral');
    assert.equal(readFileSync(join(project, 'project.json'), 'utf8'), before);
    assert.equal(localReferences({ root, project: 'another' }).results.length, 0);
    writeFileSync(join(project, '00-references/manifest.json'), JSON.stringify({ references: [{ id: 'legacy-audio', title: 'Track', role: 'editing', file: 'old.mp3', note: 'Flauta discreta' }] }));
    const legacyMusic = rank(localReferences({ root }).results, 'flauta', { kind: 'music' });
    assert.equal(legacyMusic[0].id, 'example/legacy-audio');
    assert.ok(legacyMusic[0].match_score > 0);
    writeFileSync(join(project, '00-references/manifest.json'), '{"references":{}}');
    assert.ok(localReferences({ root }).warnings.length > 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Openverse filters reported rights, normalizes audio units, and does not approve reuse', async () => {
  const output = await openverseSearch('paper & wood', { kind: 'sfx', limit: 3, fetchImpl: async (url) => {
    assert.equal(url.searchParams.get('q'), 'paper & wood');
    assert.equal(url.searchParams.get('license'), 'cc0,by');
    assert.equal(url.pathname, '/v1/audio/');
    return new Response(JSON.stringify({ results: [
      { id: 'ok', title: 'Paper', license: 'by', duration: 2500, foreign_landing_url: 'https://example.com/item', url: 'https://example.com/preview.mp3', attribution: 'Author' },
      { id: 'nc', license: 'by-nc' }, { id: 'adult', license: 'cc0', mature: true },
    ] }));
  } });
  assert.equal(output.length, 1);
  assert.equal(output[0].duration_seconds, 2.5);
  assert.equal(output[0].rights.status, 'unverified');
  assert.equal(output[0].rights.credit, 'Author');
  assert.equal(output[0].inspection, 'not-inspected');
  await assert.rejects(openverseSearch('test', { kind: 'video' }), /use --kind/);
});

test('provider rate limits and oversized payloads stop rather than retrying indefinitely', async () => {
  let count = 0;
  await assert.rejects(openverseSearch('test', { kind: 'image', fetchImpl: async () => { count++; return new Response('limited', { status: 429, headers: { 'retry-after': '60' } }); } }), /429.*Retry-After 60/);
  assert.equal(count, 1);
  await assert.rejects(openverseSearch('test', { kind: 'image', fetchImpl: async () => new Response('{}', { headers: { 'content-length': String(3 * 1024 * 1024) } }) }), /excede/);
  await assert.rejects(openverseSearch('test', { kind: 'image', fetchImpl: async () => new Response('x'.repeat(3 * 1024 * 1024)) }), /excede/);
});

test('cache is reusable but marks old data explicitly on network failure and isolates queries', async () => {
  const root = temp(); let requests = 0;
  const fetch = async () => { requests++; return [{ id: 'result' }]; };
  try {
    assert.equal((await cachedDiscovery('a', fetch, { root, now: 100, ttl: 100 })).status, 'live');
    assert.equal((await cachedDiscovery('a', fetch, { root, now: 150, ttl: 100 })).status, 'cached');
    assert.equal(requests, 1);
    const stale = await cachedDiscovery('a', async () => { throw new Error('offline'); }, { root, now: 250, ttl: 100 });
    assert.equal(stale.status, 'stale-cache'); assert.equal(stale.error, 'offline');
    assert.equal(stale.results[0].id, 'result');
    const missing = await cachedDiscovery('b', async () => { throw new Error('offline'); }, { root, now: 250 });
    assert.equal(missing.status, 'unavailable'); assert.deepEqual(missing.results, []);
    await cachedDiscovery('a', fetch, { root, now: 160, ttl: 100, refresh: true });
    assert.equal(requests, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reference media capture preserves audio bytes/type and failed requests leave no partial reference', async () => {
  const root = temp();
  const bytes = Buffer.from('synthetic audio payload');
  writeFileSync(join(root, 'project.json'), JSON.stringify({ source: { file: 'raw.mp4' }, stages: { intake: 'done', plan: 'done' }, renders: [], log: [] }));
  const server = createServer((req, res) => {
    if (req.url === '/fail') { res.statusCode = 503; res.end('unavailable'); }
    else { res.setHeader('content-type', 'audio/mpeg'); res.end(bytes); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(reference([root, `${base}/fail`, '--role', 'audio']), /503/);
    assert.deepEqual(readdirSync(join(root, '00-references')), []);
    assert.equal(JSON.parse(readFileSync(join(root, 'project.json'), 'utf8')).stages.plan, 'done');
    await reference([root, `${base}/ok`, '--role', 'audio']);
    const manifest = JSON.parse(readFileSync(join(root, '00-references/manifest.json'), 'utf8'));
    const result = manifest.references[0];
    assert.equal(result.role, 'audio'); assert.ok(result.file.endsWith('material.mp3'));
    assert.deepEqual(readFileSync(result.file), bytes);
    assert.equal(result.review, 'pending'); assert.equal(result.usage_rights, 'unreviewed');
    assert.equal(referenceExtension('image/webp; charset=binary'), '.webp');
    assert.equal(referenceExtension('video/mp4'), '.mp4');
    assert.equal(referenceExtension('application/octet-stream'), '.bin');
  } finally { await new Promise((resolve) => server.close(resolve)); rmSync(root, { recursive: true, force: true }); }
});

test('a learned record imports as a frozen project reference, without transferring prior approval', async () => {
  const root = temp(); const id = `test-discovery-${process.pid}`;
  const recordPath = memoryPath(id);
  const file = join(root, 'example.txt'); writeFileSync(file, 'a factual reference');
  writeFileSync(join(root, 'project.json'), JSON.stringify({ source: { file: 'raw.mp4' }, stages: { intake: 'done', plan: 'done' }, renders: [], log: [] }));
  try {
    const value = entry(file); value.id = id; remember(value);
    await reference([root, '--library', id, '--role', 'editing']);
    const manifest = JSON.parse(readFileSync(join(root, '00-references/manifest.json'), 'utf8'));
    const imported = manifest.references[0];
    assert.equal(imported.library_id, id);
    assert.equal(imported.review, 'pending');
    assert.equal(imported.usage_rights, 'unreviewed');
    assert.equal(JSON.parse(readFileSync(resolve(ROOT, imported.library_record), 'utf8')).feedback.by, 'agent');
    assert.ok(imported.library_sha256);
    assert.equal(readFileSync(resolve(ROOT, imported.file), 'utf8'), 'a factual reference');
    writeFileSync(file, 'changed source');
    await assert.rejects(reference([root, '--library', id, '--role', 'editing']), /arquivo mudou/);
    assert.equal(JSON.parse(readFileSync(join(root, '00-references/manifest.json'), 'utf8')).references.length, 1);
  } finally { rmSync(recordPath, { force: true }); rmSync(root, { recursive: true, force: true }); }
});
