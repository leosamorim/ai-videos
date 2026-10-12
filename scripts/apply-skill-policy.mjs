import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/util.mjs';
import { applyRepositoryPolicy } from './lib/skill-policy.mjs';
const config = JSON.parse(readFileSync(join(ROOT, 'vendor/skills.config.json')));
for (const name of config.skills) applyRepositoryPolicy(join(ROOT, '.claude/skills', name), name);
console.log('Política local aplicada às skills técnicas.');
