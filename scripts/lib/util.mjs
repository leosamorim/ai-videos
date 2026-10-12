// Utilidades compartilhadas pelos scripts: raiz do repo, execução de processos, formatação.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HYPERFRAMES = join(ROOT, 'node_modules', '.bin', 'hyperframes');

export class UserError extends Error {}

export function fail(message) {
  throw new UserError(message);
}

/** Roda um binário e devolve stdout/stderr; lança erro legível se sair com código != 0. */
export function run(cmd, args, { cwd, allowFail = false, env, input, maxBuffer = 256 * 1024 * 1024 } = {}) {
  const result = spawnSync(cmd, args, { cwd, env: env ?? process.env, input, encoding: 'utf8', maxBuffer });
  if (result.error) fail(`não consegui executar ${cmd}: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    const tail = (result.stderr || result.stdout || '').trim().split('\n').slice(-12).join('\n');
    fail(`${cmd} saiu com código ${result.status}:\n${tail}`);
  }
  return result;
}

export function readJson(path) {
  if (!existsSync(path)) fail(`arquivo necessário não encontrado: ${path}`);
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { fail(`JSON inválido em ${path}: ${error.message}`); }
}

export function round(value, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** 83.456 -> "01:23.46" */
export function clock(seconds) {
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, '0')}:${(seconds - m * 60).toFixed(2).padStart(5, '0')}`;
}

/** Lê KEY=valor do .env da raiz sem sobrescrever o ambiente já definido. */
export function loadEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith('#')) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

/** Interpreta `--flag valor`, `--flag` e argumentos posicionais. */
export function parseArgs(argv, { booleans = [] } = {}) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (booleans.includes(key)) flags[key] = true;
    else if (i + 1 >= argv.length) fail(`--${key} precisa de um valor`);
    else flags[key] = argv[++i];
  }
  return { flags, positional };
}

export function numberFlag(flags, key, fallback) {
  if (flags[key] === undefined) return fallback;
  const value = Number(flags[key]);
  if (!Number.isFinite(value)) fail(`--${key} precisa ser um número (recebi "${flags[key]}")`);
  return value;
}
