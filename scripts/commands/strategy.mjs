import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadProject, rel } from '../lib/project.mjs';
import { strategyTemplate, validateStrategy } from '../lib/strategy.mjs';
import { fail, parseArgs, readJson } from '../lib/util.mjs';

export function strategy(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['init'] });
  const project = loadProject(positional[0]);
  const path = join(project.dir, 'strategy.json');
  if (flags.init) {
    if (!existsSync(path)) writeFileSync(path, JSON.stringify(strategyTemplate(), null, 2) + '\n');
    return console.log(`Estratégia: ${rel(path)}. Preencha com evidências; guia: docs/MARKETING.md. Arquivos existentes são preservados.`);
  }
  if (!existsSync(path)) fail('rode strategy --init para uma edição orgânica com direção de marketing');
  const value = validateStrategy(readJson(path));
  console.log(`Estratégia consistente: ${value.objective}; ${value.beats.length} beats; ${value.platforms.map((p) => p.platform).join(', ')}.\nO storyboard e a revisão ainda precisam demonstrar a entrega da promessa; este check não estima alcance.`);
}
