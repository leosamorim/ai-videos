#!/usr/bin/env node
// Chama o HyperFrames fixado no package.json sem deixá-lo mexer nas skills globais.
//   node scripts/hf.mjs <comando> [args]      (ou: npm run hf -- <comando> [args])
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { HYPERFRAMES, ROOT } from './lib/util.mjs';

const args = process.argv.slice(2);
if (args[0] === 'skills') {
  console.error('Bloqueado: `hyperframes skills` instala em ~/.claude/skills e ~/.agents/skills.');
  console.error('As skills deste repo ficam em .claude/skills/. Para atualizar: npm run skills:vendor');
  process.exit(1);
}
if (!existsSync(HYPERFRAMES)) { console.error('HyperFrames fixado não instalado. Rode npm ci.'); process.exit(1); }
const result = spawnSync(HYPERFRAMES, args, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' },
});
process.exit(result.status ?? 1);
