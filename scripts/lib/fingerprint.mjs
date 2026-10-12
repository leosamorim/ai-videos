import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const cache = new Map();
export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function fileHash(path) {
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  if (stat.isDirectory()) return digest(readdirSync(path).sort().filter((n) => !n.startsWith('.')).map((n) => [n, fileHash(join(path, n))]));
  const key = `${path}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  if (cache.has(key)) return cache.get(key);
  const hash = createHash('sha256');
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let length;
    while ((length = readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, length));
  } finally { closeSync(fd); }
  const result = hash.digest('hex');
  cache.set(key, result);
  return result;
}

export const DEPENDENTS = {
  intake: ['cut', 'plan'], transcript: ['analysis'], analysis: ['cut'], cut: ['plan'],
  plan: ['composition'], composition: ['review'], review: ['final'], final: [],
};

export function stageSignature(project, stage) {
  const { paths: p, data: d, dir } = project;
  const files = {
    intake: [join(dir, 'BRIEF.md')],
    transcript: [join(dir, d.source.file), join(p.source, 'source.json'), join(p.transcript, 'transcript.raw.json'), join(dir, 'glossary.json')],
    analysis: [join(p.transcript, 'transcript.raw.json'), join(p.analysis, 'evidence.json')],
    cut: [join(p.cut, 'edit-plan.json'), join(p.cut, 'cuts.json'), join(p.cut, 'edl.json'), join(p.cut, 'transcript.json'), join(p.cut, 'master.mp4')],
    plan: [join(p.plan, 'storyboard.json'), join(dir, 'theme.json'), p.references, join(dir, 'BRIEF.md')],
    composition: [p.composition],
    review: [join(p.review, 'verify.json'), join(p.review, 'review.json'), ...(d.renders?.length ? [join(dir, d.renders.at(-1).file)] : [])],
    final: [join(p.renders, 'final.mp4')],
  }[stage] ?? [];
  // Opt-in: keep legacy hashes identical when the project has no strategy.
  // Adding, editing or removing one invalidates the plan and its descendants.
  if (stage === 'plan' && existsSync(join(dir, 'strategy.json'))) files.push(join(dir, 'strategy.json'));
  const hashArtifact = (path) => {
    if (stage === 'review' && path.endsWith('/verify.json') && existsSync(path)) {
      try { const { at, ...report } = JSON.parse(readFileSync(path, 'utf8')); return digest(report); }
      catch { return fileHash(path); }
    }
    // `hyperframes snapshot` grava por padrão em <composição>/snapshots: são inspeções, não parte da composição.
    // Sem a pasta, o resultado é idêntico ao de fileHash, então projetos existentes mantêm a assinatura.
    if (stage === 'composition' && path === p.composition && existsSync(path) && statSync(path).isDirectory()) {
      return digest(readdirSync(path).sort().filter((n) => !n.startsWith('.') && n !== 'snapshots').map((n) => [n, fileHash(join(path, n))]));
    }
    return fileHash(path);
  };
  const format = ['intake', 'transcript', 'analysis'].includes(stage) ? undefined : stage === 'cut' ? { fps: d.format?.fps } : d.format;
  return digest({ files: files.map((f) => [f, hashArtifact(f)]), format,
    upstream: Object.entries(DEPENDENTS).filter(([, next]) => next.includes(stage)).map(([s]) => [s, stageSignature(project, s)]) });
}

export function invalidate(project, stage, reason = 'insumos alterados', seen = new Set()) {
  if (seen.has(stage)) return;
  seen.add(stage);
  project.data.stages[stage] = 'pending';
  project.data.snapshots ??= {};
  delete project.data.snapshots[stage];
  const gate = stage === 'review' ? 'draft' : stage;
  if (project.data.gates?.[gate]) project.data.gates[gate] = null;
  project.data.stale ??= {};
  project.data.stale[stage] = reason;
  for (const next of DEPENDENTS[stage] ?? []) invalidate(project, next, reason, seen);
}

export function refresh(project) {
  let changed = false;
  for (const stage of Object.keys(DEPENDENTS)) {
    const old = project.data.snapshots?.[stage];
    if (old && old !== stageSignature(project, stage)) {
      invalidate(project, stage, `${stage}: conteúdo mudou desde a última revisão`);
      changed = true;
    }
  }
  return changed;
}
