#!/usr/bin/env node
// Espelha .claude/skills/ em .agents/skills/ (onde o Codex procura) com um symlink por skill.
// .claude/skills/ é a fonte; nunca edite dentro de .agents/skills/.
//
// Uso: node scripts/sync-agent-skills.mjs [--check]
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/util.mjs';

const source = join(ROOT, '.claude/skills');
const target = join(ROOT, '.agents/skills');
const check = process.argv.includes('--check');
const names = existsSync(source)
  ? readdirSync(source, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(source, e.name, 'SKILL.md'))).map((e) => e.name)
  : [];

let problems = 0;
if (!check) mkdirSync(target, { recursive: true });

for (const name of names) {
  const link = join(target, name);
  const wanted = join('..', '..', '.claude', 'skills', name);
  const stat = lstatSync(link, { throwIfNoEntry: false });
  const ok = stat?.isSymbolicLink() && readlinkSync(link) === wanted;
  if (ok) continue;
  if (check) { console.error(`fora de sincronia: .agents/skills/${name}`); problems++; continue; }
  if (stat && !stat.isSymbolicLink()) {
    console.error(`.agents/skills/${name} é uma pasta real, não um link. Mova o conteúdo para .claude/skills/ e remova.`);
    problems++;
    continue;
  }
  if (stat) rmSync(link);
  symlinkSync(wanted, link, 'dir');
}

// Links que apontam para skills que não existem mais.
if (existsSync(target)) {
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (names.includes(entry.name)) continue;
    if (!entry.isSymbolicLink()) { console.error(`sem origem em .claude/skills: .agents/skills/${entry.name}`); problems++; continue; }
    if (check) { console.error(`link órfão: .agents/skills/${entry.name}`); problems++; }
    else rmSync(join(target, entry.name));
  }
}

console.log(`${check ? 'Conferidas' : 'Sincronizadas'} ${names.length} skills; ${problems} problema(s).`);
process.exitCode = problems ? 1 : 0;
