import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadProject, rel } from '../lib/project.mjs';
import { compareIdentities, decodedIdentity } from '../lib/render-diff.mjs';
import { fileHash } from '../lib/fingerprint.mjs';
import { fail, numberFlag, parseArgs, readJson, ROOT } from '../lib/util.mjs';

export function diff(args) {
  const { flags, positional } = parseArgs(args);
  const project = loadProject(positional[0]);
  if (!flags.from) fail('informe --from caminho/do/render-anterior.mp4');
  const from = resolve(ROOT, flags.from);
  const to = flags.to ? resolve(ROOT, flags.to) : project.data.renders?.length ? join(project.dir, project.data.renders.at(-1).file) : null;
  if (!existsSync(from) || !to || !existsSync(to)) fail('renders de comparação ausentes');
  const boundaryFrames = numberFlag(flags, 'boundary', 2);
  if (!Number.isInteger(boundaryFrames) || boundaryFrames < 1 || boundaryFrames > 60) fail('--boundary deve ser inteiro entre 1 e 60');
  const motionFile = flags.motion ? resolve(ROOT, flags.motion) : join(project.paths.composition, 'motion-plan.json');
  const raw = existsSync(motionFile) ? readJson(motionFile) : [];
  const motions = Array.isArray(raw) ? raw : raw.motions;
  const ids = new Set();
  if (!Array.isArray(motions) || motions.some((m) => !m.id || ids.has(m.id) || !ids.add(m.id) || !Number.isFinite(m.start) || !Number.isFinite(m.end) || m.start < 0 || m.end <= m.start)) fail('motion-plan precisa de motions com id único, start e end em segundos');
  const result = compareIdentities(decodedIdentity(from), decodedIdentity(to), { motions, boundaryFrames });
  const previousPath = flags.review ? resolve(ROOT, flags.review) : null;
  const previous = previousPath ? readJson(previousPath) : null;
  const oldChecks = ['meaning', 'performance', 'seams', 'captions', 'visuals', 'audio', 'references'];
  result.prior_review_verified = Boolean(previous?.complete && previous.file_hash === result.before_hash && previous.reviewer?.trim()
    && oldChecks.every((k) => previous.checks?.[k]?.ok && previous.checks[k].notes?.trim()));
  result.prior_review_hash = previousPath ? fileHash(previousPath) : null;
  result.strategy_unchanged = (previous?.strategy_hash ?? null) === fileHash(join(project.dir, 'strategy.json'));
  result.motion_plan_hash = existsSync(motionFile) ? fileHash(motionFile) : null;
  result.coverage_warning = 'O mapa precisa incluir toda animação, inclusive customizada; a ferramenta não prova sua completude.';
  result.evidence_reuse_eligible = result.compatible_timeline && result.prior_review_verified && result.strategy_unchanged;
  const path = join(project.paths.review, `diff-${result.before_hash.slice(0, 12)}-${result.after_hash.slice(0, 12)}.json`);
  writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
  console.log(`${result.equal_frames}/${result.total_frames} quadros idênticos; ${result.changed_frames} alterados; áudio ${result.audio_equal ? 'idêntico' : 'alterado'}.`);
  console.log(`Relatório: ${rel(path)}\nReaproveitamento de evidências: ${result.evidence_reuse_eligible ? 'elegível com observações documentadas' : 'não autorizado por este relatório'}. Nenhuma revisão foi aprovada.`);
}
