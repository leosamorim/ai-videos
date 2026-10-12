import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { locate, nextStep } from '../lib/project.mjs';
import { refresh } from '../lib/fingerprint.mjs';
import { packTranscript } from '../lib/transcribe.mjs';
import { fail, numberFlag, parseArgs, readJson } from '../lib/util.mjs';
import { readSignals } from '../lib/signals.mjs';

// Deliberately read-only: resuming does not reapprove, migrate or rewrite projects.
export function resume(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['json'] });
  const project = locate(positional[0]);
  project.data = readJson(project.file);
  refresh(project);
  const limit = numberFlag(flags, 'chars', 12000);
  if (!Number.isInteger(limit) || limit < 2000 || limit > 40000) fail('--chars deve ser inteiro entre 2000 e 40000');
  const read = (path, max, tail = false) => {
    if (!existsSync(path)) return null;
    const text = readFileSync(path, 'utf8');
    return { path, text: tail && text.length > max ? text.slice(0, Math.floor(max / 2)) + '\n[…]\n' + text.slice(-Math.floor(max / 2)) : text.slice(0, max), truncated: text.length > max };
  };
  const transcript = join(project.paths.transcript, 'transcript.raw.json');
  const next = nextStep(project.data);
  const signals = readSignals(project);
  const report = {
    project: project.slug, review_policy: project.data.review_policy ?? 'assisted',
    stages: project.data.stages, stale: project.data.stale ?? {},
    next: next ? { stage: next.stage.id, text: next.text } : null,
    latest_render: project.data.renders?.at(-1) ?? null,
    signals: { reports: signals.reports.map((r) => ({ kind: r.kind, samples: r.rows.length, window_count: r.input.windows.length })), warnings: signals.warnings,
      summary_current: Boolean(signals.summary_current), ...(!signals.summary_current && signals.reports.length ? { next: 'signals SLUG atualiza o resumo usando o cache, sem refazer decisões' } : {}) },
    brief: read(join(project.dir, 'BRIEF.md'), Math.floor(limit * 0.22)),
    decisions: read(join(project.dir, 'NOTES.md'), Math.floor(limit * 0.12), true),
    strategy: read(join(project.dir, 'strategy.json'), Math.floor(limit * 0.14)),
    transcript: existsSync(transcript) ? packTranscript(readJson(transcript)).slice(0, Math.floor(limit * 0.28)) : null,
    consult: ['00-references/direction.md', ...(signals.summary_current ? ['01-analysis/SIGNALS.md'] : []), '02-cut/edit-plan.json', '03-plan/storyboard.json', '06-review/review.json']
      .filter((path) => existsSync(join(project.dir, path))),
    recent_events: (project.data.log ?? []).slice(-3).map(({ at, stage, status, note }) => ({ at, stage, status, ...(note ? { note: String(note).slice(0, 240) } : {}) })),
    note: 'Resumo limitado; consulte os arquivos indicados para decisões completas. Quadros e áudio ainda exigem inspeção. Nenhuma etapa foi alterada.',
  };
  if (flags.json) return console.log(JSON.stringify(report));
  console.log(JSON.stringify(report, null, 2));
}
