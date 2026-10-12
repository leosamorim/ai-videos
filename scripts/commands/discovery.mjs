import { join } from 'node:path';
import { cachedDiscovery, KINDS, localReferences, openverseSearch, rank, remember as saveMemory } from '../lib/discovery.mjs';
import { ROOT, fail, parseArgs, readJson, run } from '../lib/util.mjs';

export async function discover(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['json', 'refresh'] });
  const query = positional.join(' ').trim();
  const kind = flags.kind;
  if (kind && !KINDS.includes(kind)) fail(`--kind: ${KINDS.join(' | ')}`);
  const limit = Number(flags.limit ?? 6);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) fail('--limit precisa ficar entre 1 e 20');
  if (flags.project && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(flags.project)) fail('--project precisa ser o slug de um projeto');
  if (flags.online && !['openverse', 'catalog'].includes(flags.online)) fail('--online: openverse | catalog');
  if (flags.online && !query) fail('informe uma consulta curta para busca online');
  if (flags.online === 'openverse' && !['image', 'texture', 'sfx', 'music'].includes(kind)) fail('Openverse: use --kind image | texture | sfx | music');
  const catalog = readJson(join(ROOT, 'library/sources.json'));
  const local = localReferences({ project: flags.project });
  const matches = rank(local.results, query, { kind, limit: local.results.length }).filter((r) => !query || r.match_score > 0).slice(0, limit);
  const sources = rank(catalog.sources, query, { kind, limit }).map((source) => ({ ...source, search_query: source.domain ? `site:${source.domain} ${query || source.tags[0]}` : query, result_type: 'source-route-not-a-searched-example' }));
  const result = { query, kind: kind ?? 'all', local: matches, sources, warnings: local.warnings, online: null };
  if (flags.online) result.online = await cachedDiscovery({ provider: flags.online, query, kind, limit, ...(flags.online === 'catalog' ? { cli_version: readJson(join(ROOT, 'package.json')).devDependencies.hyperframes } : {}) }, async () => {
    if (flags.online === 'openverse') return openverseSearch(query, { kind, limit });
    const raw = JSON.parse(run(process.execPath, [join(ROOT, 'scripts/hf.mjs'), 'catalog', '--query', query, '--json']).stdout);
    return (raw.results ?? []).slice(0, limit).map((item) => ({ ...item, provider: 'hyperframes', tier: raw.tier, inspection: 'not-inspected', install_status: 'catalog-entry-not-installed' }));
  }, { refresh: Boolean(flags.refresh) });
  if (flags.json) return console.log(JSON.stringify(result, null, 2));
  console.log(`Consulta: ${query || '(inventário)'} · ${kind ?? 'todos'}\nLocais: ${matches.length}`);
  for (const r of matches) console.log(`  ${r.id}: ${r.title}\n    ${r.source?.file ?? r.source?.url} · ${r.context}${r.feedback ? ` · feedback ${r.feedback.by}/${r.feedback.verdict}` : ''}`);
  console.log('Rotas externas (ainda não são exemplos inspecionados):');
  for (const s of sources) console.log(`  ${s.id}: ${s.title} · ${s.access}\n    ${s.url ?? s.command}\n    Buscar: ${s.search_query}\n    ${s.purpose}`);
  if (result.online) console.log(JSON.stringify({ online: result.online }, null, 2));
  for (const w of result.warnings) console.log(`Aviso: ${w}`);
}

export function remember(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['replace'] });
  if (!positional[0]) fail('informe um JSON de referência analisada; formato em library/SOURCES.md');
  const value = saveMemory(readJson(positional[0]), { replace: Boolean(flags.replace) });
  console.log(`Referência registrada: library/references/${value.id}.json · feedback ${value.feedback.by}/${value.feedback.verdict}`);
}
