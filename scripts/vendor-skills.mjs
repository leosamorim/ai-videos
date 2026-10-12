#!/usr/bin/env node
// Copia as skills do HyperFrames para .claude/skills/ a partir de um ref fixo.
//
// Por que não usar `hyperframes skills`: aquele comando instala em ~/.claude/skills e
// ~/.agents/skills (globais) e remove o que considera "não publicado". Aqui as skills
// ficam dentro do repo, na mesma versão do CLI fixado no package.json.
//
// Uso: node scripts/vendor-skills.mjs [--from <checkout-local>]
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/util.mjs';
import { applyRepositoryPolicy } from './lib/skill-policy.mjs';

const config = JSON.parse(readFileSync(join(ROOT, 'vendor/skills.config.json'), 'utf8'));
const lockPath = join(ROOT, 'vendor/skills.lock.json');
const skillsDir = join(ROOT, '.claude/skills');
const fromIndex = process.argv.indexOf('--from');
const localCheckout = fromIndex > -1 ? process.argv[fromIndex + 1] : null;

function git(args, cwd) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`git ${args.join(' ')} falhou: ${run.stderr.trim()}`);
  return run.stdout.trim();
}

let checkout = localCheckout;
let temp = null;
if (!checkout) {
  temp = mkdtempSync(join(tmpdir(), 'hf-skills-'));
  checkout = join(temp, 'src');
  console.log(`Clonando ${config.source} @ ${config.ref} ...`);
  git(['clone', '--depth', '1', '--branch', config.ref, '--quiet', config.source, checkout]);
}
const commit = git(['rev-parse', 'HEAD'], checkout);

const NOTICE = (name) =>
  `> **Skill copiada para este repo** (${config.ref}, commit ${commit.slice(0, 7)}). ` +
  `Não rode \`hyperframes skills ...\` nem \`npx skills add\`: esses comandos instalam nas pastas globais do usuário. ` +
  `Para atualizar \`${name}\`, mude o ref em \`vendor/skills.config.json\` e rode \`npm run skills:vendor\`. ` +
  `Chame o CLI como \`npx hyperframes\` a partir da raiz do repo (versão fixada no package.json).`;

// Troca as instruções de auto-atualização do upstream pelo aviso acima.
function patchSkillMd(path, name) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const out = [];
  let noticed = false;
  for (const line of lines) {
    const isPluginNote = line.startsWith('**Plugin installs:**');
    const isFreshness = line.startsWith('> **First, keep this skill fresh');
    if (isPluginNote || isFreshness) {
      if (!noticed) { out.push(NOTICE(name)); noticed = true; }
      else if (out.at(-1) === '') out.pop();
      continue;
    }
    out.push(line);
  }
  if (!noticed) {
    // Sem preâmbulo conhecido: insere o aviso logo após o frontmatter.
    const end = out.indexOf('---', 1);
    out.splice(end + 1, 0, '', NOTICE(name));
  }
  writeFileSync(path, out.join('\n'));
}

function countFiles(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).length;
}

const previous = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : { skills: {} };
const lock = { source: config.source, ref: config.ref, commit, license: config.license, skills: {} };
mkdirSync(skillsDir, { recursive: true });

for (const name of config.skills) {
  const src = join(checkout, 'skills', name);
  if (!existsSync(join(src, 'SKILL.md'))) throw new Error(`skill ausente no upstream: ${name}`);
  const dest = join(skillsDir, name);
  // Só substitui pastas que este script criou; uma skill sua com o mesmo nome é preservada.
  if (existsSync(dest) && !previous.skills[name]) {
    throw new Error(`.claude/skills/${name} existe e não veio deste script. Renomeie ou remova antes.`);
  }
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, filter: (p) => !/(^|\/)(node_modules|__pycache__|\.DS_Store)$/.test(p) });
  patchSkillMd(join(dest, 'SKILL.md'), name);
  applyRepositoryPolicy(dest, name);
  lock.skills[name] = { files: countFiles(dest) };
  console.log(`  ${name} (${lock.skills[name].files} arquivos)`);
}

// Skills que saíram da lista são removidas, mas só as que este script instalou.
for (const name of Object.keys(previous.skills)) {
  if (!config.skills.includes(name)) {
    rmSync(join(skillsDir, name), { recursive: true, force: true });
    console.log(`  removida: ${name}`);
  }
}

mkdirSync(join(ROOT, 'vendor/licenses'), { recursive: true });
cpSync(join(checkout, 'LICENSE'), join(ROOT, 'vendor/licenses/hyperframes-LICENSE'));
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
if (temp) rmSync(temp, { recursive: true, force: true });

const sync = spawnSync(process.execPath, [join(ROOT, 'scripts/sync-agent-skills.mjs')], { stdio: 'inherit' });
process.exitCode = sync.status ?? 1;
