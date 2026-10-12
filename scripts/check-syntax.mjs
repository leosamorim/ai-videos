import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { publicFiles } from './lib/public-repo.mjs';
import { ROOT } from './lib/util.mjs';
const files = publicFiles(ROOT).filter((p) => /^(scripts|tests|templates)\/.+\.(mjs|cjs|js)$/.test(p));
for (const file of files) execFileSync(process.execPath, ['--check', join(ROOT, file)], { stdio: 'pipe' });
console.log(`${files.length} arquivos JavaScript com sintaxe válida.`);
const pythonFiles = publicFiles(ROOT).filter((p) => /^(scripts|tests)\/.+\.py$/.test(p));
if (pythonFiles.length) {
  if (spawnSync('python3', ['--version']).status === 0) {
    execFileSync('python3', ['-c', 'import ast, pathlib, sys; [ast.parse(pathlib.Path(p).read_text(), filename=p) for p in sys.argv[1:]]', ...pythonFiles.map((p) => join(ROOT, p))], { stdio: 'pipe' });
    console.log(`${pythonFiles.length} arquivo(s) Python com sintaxe válida (sem importar extras).`);
  } else console.log('Python opcional ausente; sintaxe do worker não conferida nesta máquina.');
}
