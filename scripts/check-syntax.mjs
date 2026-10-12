import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { publicFiles } from './lib/public-repo.mjs';
import { ROOT } from './lib/util.mjs';
const files = publicFiles(ROOT).filter((p) => /^(scripts|tests|templates)\/.+\.(mjs|cjs|js)$/.test(p));
for (const file of files) execFileSync(process.execPath, ['--check', join(ROOT, file)], { stdio: 'pipe' });
console.log(`${files.length} arquivos JavaScript com sintaxe válida.`);
