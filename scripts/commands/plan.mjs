import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileStoryboard, DEFAULT_THEME, themeCss } from '../lib/storyboard.mjs';
import { fileHash } from '../lib/fingerprint.mjs';
import { finishStage, loadProject, rel } from '../lib/project.mjs';
import { fail, parseArgs, readJson } from '../lib/util.mjs';
import { validateStrategyBoard } from '../lib/strategy.mjs';
import { auditGraphicReading } from '../lib/choreography.mjs';

export function plan(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['init'] });
  const project = loadProject(positional[0]);
  const path = join(project.paths.plan, 'storyboard.json');
  if (flags.init && !existsSync(path)) {
    writeFileSync(path, JSON.stringify({ schema: 1, intent: '', hook_options: [], chosen_hook: '', references: [], beats: [], cards: [], reframes: [], caption_zones: [], intentional_holds: [] }, null, 2) + '\n');
    return console.log(`Preencha ${rel(path)}. Use âncoras source_word para sincronizar gráficos à fala.`);
  }
  if (project.data.stages.cut !== 'done') fail('conclua a revisão do corte antes do storyboard');
  if (!existsSync(path)) fail('rode plan --init e preencha o storyboard');
  const raw = readJson(path);
  if (!raw.intent?.trim()) fail('storyboard: descreva a intenção da montagem');
  const compiled = compileStoryboard(raw, readJson(join(project.paths.cut, 'transcript.json')).words, readJson(join(project.paths.cut, 'edl.json')).edited_duration);
  const strategyPath = join(project.dir, 'strategy.json');
  if (existsSync(strategyPath)) {
    validateStrategyBoard(readJson(strategyPath), compiled);
    compiled.strategy_sha256 = fileHash(strategyPath);
  }
  const themePath = join(project.dir, 'theme.json');
  const theme = existsSync(themePath) ? readJson(themePath) : DEFAULT_THEME;
  themeCss(theme, project.data.format);
  const refsPath = join(project.paths.references, 'manifest.json');
  const refs = existsSync(refsPath) ? readJson(refsPath).references ?? [] : [];
  if (refs.length) {
    const direction = readJson(join(project.paths.references, 'direction.json'));
    if (!direction.reviewed || !direction.reference_ids?.length) fail('examine as referências e registre sua direção em 00-references/direction.json');
    for (const id of [...direction.reference_ids, ...(theme.source_ids ?? []), ...(raw.references ?? [])]) if (!refs.some((r) => r.id === id)) fail(`referência desconhecida no tema/storyboard: ${id}`);
  }
  compiled.edl_sha256 = fileHash(join(project.paths.cut, 'edl.json'));
  writeFileSync(join(project.paths.plan, 'resolved.json'), JSON.stringify(compiled, null, 2) + '\n');
  const reading = auditGraphicReading(compiled);
  writeFileSync(join(project.paths.plan, 'reading.json'), JSON.stringify({ ...reading, storyboard_sha256: fileHash(path) }, null, 2) + '\n');
  finishStage(project, 'plan', 'âncoras e tema validados; produzir prévia antes do acabamento');
  console.log(`Storyboard compilado: ${rel(join(project.paths.plan, 'resolved.json'))}`);
  const warnings = reading.blocks.filter((b) => b.warnings.length).length;
  if (warnings) console.log(`Leitura: ${warnings} janela(s) para revisar em 03-plan/reading.json (avisos, sem aprovação automática).`);
}
