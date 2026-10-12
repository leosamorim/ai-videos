import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileHash } from './fingerprint.mjs';
import { fail, readJson, ROOT } from './util.mjs';

export const KINDS = ['editing', 'motion', 'typography', 'image', 'video', 'texture', 'sfx', 'music', 'icon', 'palette'];
const normalize = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const tokens = (s) => normalize(s).split(/[^a-z0-9]+/).filter((x) => x.length > 1 && !['de', 'do', 'da', 'com', 'para', 'the', 'and', 'with', 'uma', 'um'].includes(x));
const nonempty = (s) => typeof s === 'string' && s.trim();
const safeId = (id) => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
const httpUrl = (value) => {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
};
export function rank(items, query, { kind, limit = 6 } = {}) {
  const terms = tokens(query);
  return items.filter((item) => !kind || item.kinds?.includes(kind))
    .map((item) => ({ ...item, match_score: terms.reduce((n, term) => n + (normalize([item.title, item.id, item.context, item.purpose, ...(item.tags ?? []), item.borrow, item.avoid].join(' ')).includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.match_score - a.match_score || (a.priority ?? 5) - (b.priority ?? 5) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Private learned references, not an implicit list of user-approved styles. */
export function validateMemory(record, root = ROOT, { checkFile = true } = {}) {
  if (record?.schema !== 1 || !safeId(record.id)) fail('referência: schema 1 e id em minúsculas com hífens são necessários');
  for (const key of ['title', 'context', 'borrow', 'avoid']) if (!nonempty(record[key])) fail(`referência: preencha ${key}`);
  if (!Array.isArray(record.kinds) || !record.kinds.length || record.kinds.some((k) => !KINDS.includes(k))) fail('referência: kinds inválidos');
  if (!Array.isArray(record.tags) || record.tags.some((x) => !nonempty(x))) fail('referência: tags precisa de uma lista de textos');
  if (!record.source || (!nonempty(record.source.file) && !httpUrl(record.source.url))) fail('referência: indique source.file ou source.url HTTP(S)');
  if (record.source.url !== undefined && !httpUrl(record.source.url)) fail('referência: URL inválida ou com credenciais');
  if (record.source.file !== undefined && !nonempty(record.source.file)) fail('referência: source.file deve ser um caminho');
  if (checkFile && record.source.file && (!existsSync(resolve(root, record.source.file)) || !statSync(resolve(root, record.source.file)).isFile())) fail('referência: arquivo local não encontrado');
  if (!['page', 'frames', 'playback', 'listening', 'user-feedback'].includes(record.inspection?.method) || !nonempty(record.inspection?.notes)) fail('referência: declare método e observações da inspeção realizada');
  if (!['agent', 'user'].includes(record.feedback?.by) || !['neutral', 'preferred', 'avoid', 'mixed'].includes(record.feedback?.verdict) || !nonempty(record.feedback?.evidence)) fail('referência: feedback precisa de by, verdict e evidence; não inferir aprovação humana');
  if (!['reference-only', 'adapt', 'asset'].includes(record.rights?.use)) fail('referência: rights.use deve ser reference-only | adapt | asset');
  if (!['unverified', 'licensed', 'owned'].includes(record.rights?.status)) fail('referência: rights.status deve ser unverified | licensed | owned');
  if (!nonempty(record.rights?.notes)) fail('referência: registre limites de uso em rights.notes');
  if (record.rights.use !== 'reference-only' && record.rights.status === 'unverified') fail('referência: uso como asset/adaptação requer direitos conferidos; para estudo, use reference-only');
  if (record.rights.status === 'licensed' && (!nonempty(record.rights.license) || !nonempty(record.rights.source))) fail('referência: licença e sua fonte são necessárias');
  return record;
}

export function memoryPath(id, root = ROOT) {
  if (!safeId(id)) fail('ID da biblioteca inválido');
  return join(root, 'library/references', `${id}.json`);
}
export function readMemory(id, root = ROOT) {
  const record = validateMemory(readJson(memoryPath(id, root)), root);
  if (record.source.file && record.source.sha256 !== fileHash(resolve(root, record.source.file))) fail('referência: arquivo mudou desde a inspeção; revise e registre novamente');
  return record;
}
export function remember(record, { root = ROOT, replace = false } = {}) {
  validateMemory(record, root);
  const path = memoryPath(record.id, root);
  mkdirSync(join(root, 'library/references'), { recursive: true });
  if (existsSync(path) && !replace) fail('referência já existe; use --replace para uma revisão explícita');
  const saved = { ...record, source: { ...record.source }, recorded_at: new Date().toISOString() };
  if (saved.source.file) saved.source.sha256 = fileHash(resolve(root, saved.source.file));
  if (existsSync(path)) {
    const history = join(root, 'library/references/.history'); mkdirSync(history, { recursive: true });
    writeFileSync(join(history, `${record.id}-${Date.now()}.json`), readFileSync(path), { flag: 'wx' });
  }
  writeFileSync(path, JSON.stringify(saved, null, 2) + '\n', { flag: replace ? 'w' : 'wx' });
  return saved;
}

const safeRead = (path, warnings) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { warnings.push(`Não foi possível ler ${path}`); return null; }
};
/** Read existing manifests and files; never loadProject(), change gates or scan archives. */
export function localReferences({ root = ROOT, project } = {}) {
  const results = [], warnings = [];
  const memories = join(root, 'library/references');
  if (existsSync(memories)) for (const file of readdirSync(memories).filter((f) => f.endsWith('.json'))) {
    const entry = safeRead(join(memories, file), warnings);
    if (!entry) continue;
    try { validateMemory(entry, root, { checkFile: false }); }
    catch (error) { warnings.push(`${file}: ${error.message}`); continue; }
    const missing = Boolean(entry.source.file && !existsSync(resolve(root, entry.source.file)));
    results.push({ ...entry, origin: 'memory', priority: 0, missing, content_hash_checked: false });
  }
  const projects = join(root, 'videos');
  if (existsSync(projects)) for (const dir of readdirSync(projects, { withFileTypes: true }).filter((d) => d.isDirectory() && (!project || d.name === project))) {
    const base = join(projects, dir.name), path = join(base, '00-references/manifest.json');
    if (existsSync(path)) {
      const manifest = safeRead(path, warnings);
      if (manifest && !Array.isArray(manifest.references)) warnings.push(`Manifesto sem lista de referências: ${path}`);
      for (const item of Array.isArray(manifest?.references) ? manifest.references : []) {
        if (!item || !nonempty(item.id)) { warnings.push(`Entrada inválida em ${path}`); continue; }
        results.push({ id: `${dir.name}/${item.id}`, title: item.title || item.note || item.input || item.id, purpose: item.note, tags: [item.role, dir.name], kinds: roleKinds(item.role, item.file), source: { file: item.file, url: item.resolved_url }, context: `Projeto ${dir.name}; papel ${item.role}. Uso em outro projeto depende de contexto e direitos.`, origin: 'project', priority: 1, review: item.review, rights: { status: item.usage_rights ?? 'unreviewed' }, feedback: { verdict: 'neutral', by: 'unknown' } });
      }
    }
    const statePath = join(base, 'project.json');
    if (existsSync(statePath)) {
      const state = safeRead(statePath, warnings);
      if (nonempty(state?.final?.file) && existsSync(resolve(base, state.final.file))) results.push({ id: `${dir.name}/final`, title: state.title ?? dir.name, kinds: ['editing'], tags: [dir.name], source: { file: resolve(base, state.final.file) }, context: 'Edição anterior disponível para inspeção. Finalização técnica não demonstra preferência do usuário.', origin: 'project-render', priority: 2, feedback: { verdict: 'neutral', by: 'unknown' }, rights: { status: 'unverified' } });
    }
  }
  for (const [folder, kind] of [['fonts', 'typography'], ['logos', 'icon'], ['music', 'music'], ['sfx', 'sfx']]) {
    const dir = join(root, 'brand', folder);
    if (existsSync(dir)) for (const file of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile() && /\.(woff2?|ttf|otf|svg|png|jpe?g|wav|mp3|ogg|flac|m4a)$/i.test(d.name))) results.push({ id: `brand/${folder}/${file.name}`, title: file.name, kinds: [kind], tags: [folder], source: { file: `brand/${folder}/${file.name}` }, context: 'Asset local; conferir licença, marca e adequação antes de reutilizar.', origin: 'brand', priority: 2, rights: { status: 'unverified' } });
  }
  return { results, warnings };
}
function roleKinds(role, file = '') {
  // Older manifests had no audio/font roles. Find their actual media too.
  if (/\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file)) return ['sfx', 'music'];
  if (/\.(woff2?|ttf|otf)$/i.test(file)) return ['typography'];
  if (role === 'audio') return ['sfx', 'music'];
  if (role === 'texture') return ['texture', 'image'];
  if (role === 'font') return ['typography'];
  if (role === 'b-roll') return /\.(mp4|mov|mkv|webm)$/i.test(file) ? ['video'] : ['image'];
  if (role === 'brand') return ['palette', 'typography', 'image'];
  return ['editing'];
}

/** A bounded anonymous metadata request, never a media download or license approval. */
export async function openverseSearch(query, { kind, limit = 6, fetchImpl = fetch } = {}) {
  const type = ['sfx', 'music'].includes(kind) ? 'audio' : ['image', 'texture'].includes(kind) ? 'images' : null;
  if (!type) fail('Openverse: use --kind image | texture | sfx | music');
  const url = new URL(`https://api.openverse.org/v1/${type}/`);
  url.search = new URLSearchParams({ q: query, license: 'cc0,by', page_size: String(limit), mature: 'false' }).toString();
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'ai-videos/reference-discovery' } });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Openverse HTTP ${response.status}${response.headers.get('retry-after') ? `; Retry-After ${response.headers.get('retry-after')}` : ''}; sem retry automático`); }
  const max = 2 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > max) { await response.body?.cancel(); throw new Error('Openverse: resposta excede 2 MB'); }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > max) throw new Error('Openverse: resposta excede 2 MB'); chunks.push(chunk); }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(data.results)) throw new Error('Openverse: formato de resposta inesperado');
  return data.results.filter((r) => ['cc0', 'by'].includes(r.license) && !r.mature).slice(0, limit).map((r) => ({
    id: r.id, title: r.title, kinds: [kind], source: { url: r.foreign_landing_url }, media_url: r.url,
    thumbnail: r.thumbnail, creator: r.creator, provider: r.provider,
    ...(type === 'audio' && Number.isFinite(r.duration) ? { duration_seconds: r.duration / 1000 } : {}),
    rights: { status: 'unverified', reported_license: r.license, version: r.license_version, source: r.license_url, credit: r.attribution },
    inspection: 'not-inspected', note: 'Resultado de índice: conferir original/licença e examinar mídia. O URL de áudio pode ser um preview, não o master.',
  }));
}

export async function cachedDiscovery(key, obtain, { root = ROOT, refresh = false, now = Date.now(), ttl = 86400000 } = {}) {
  const dir = join(root, '.cache/reference-discovery');
  const path = join(dir, `${createHash('sha256').update(JSON.stringify(key)).digest('hex')}.json`);
  let cached;
  if (existsSync(path)) { try { cached = JSON.parse(readFileSync(path, 'utf8')); } catch { /* Refresh corrupted cache. */ } }
  if (cached && (!Number.isFinite(cached.fetched_at) || !Array.isArray(cached.results))) cached = undefined;
  if (cached && !refresh && now - cached.fetched_at < ttl) return { status: 'cached', fetched_at: new Date(cached.fetched_at).toISOString(), results: cached.results };
  try {
    const results = await obtain();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify({ fetched_at: now, results }, null, 2) + '\n');
    return { status: 'live', fetched_at: new Date(now).toISOString(), results };
  } catch (error) {
    return { status: cached ? 'stale-cache' : 'unavailable', ...(cached ? { fetched_at: new Date(cached.fetched_at).toISOString() } : {}), error: error.message, results: cached?.results ?? [], fallback: 'Consultar sources e usar browser/web disponíveis ou outra fonte; não contornar login/bloqueios.' };
  }
}
