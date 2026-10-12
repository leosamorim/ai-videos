#!/usr/bin/env node
import { join } from 'node:path';
import { auditPublicRepo, exportPublicRepo } from './lib/public-repo.mjs';
import { ROOT, parseArgs } from './lib/util.mjs';

const { flags } = parseArgs(process.argv.slice(2), { booleans: ['export'] });
try {
  if (flags.export) {
    const result = exportPublicRepo(ROOT, flags.output ?? join(ROOT, 'dist/github-ready'));
    console.log(`${result.files} arquivos públicos exportados para ${result.destination}. Nenhum push executado.`);
  } else {
    const result = auditPublicRepo(ROOT);
    console.log(`${result.files.length} arquivos públicos; ${result.errors.length} problema(s).`);
    for (const error of result.errors) console.error(error);
    process.exitCode = result.errors.length ? 1 : 0;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
