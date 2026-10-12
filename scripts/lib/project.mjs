// Padrão de pastas de um projeto de vídeo e o estado guardado em project.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { ROOT, fail } from './util.mjs';
import { invalidate, refresh, stageSignature } from './fingerprint.mjs';

export const VIDEOS = join(ROOT, 'videos');

/** Subpastas fixas de videos/<slug>/. A ordem numérica é a ordem do pipeline. */
export const DIRS = {
  source: '00-source',
  transcript: '01-transcript',
  analysis: '01-analysis',
  references: '00-references',
  cut: '02-cut',
  plan: '03-plan',
  composition: '04-composition',
  renders: '05-renders',
  review: '06-review',
};

/** Etapas do pipeline, na ordem. As que têm `gate` só fecham com aprovação humana. */
export const STAGES = [
  { id: 'intake', label: 'E0 Entrada e briefing' },
  { id: 'transcript', label: 'E1 Transcrição' },
  { id: 'analysis', label: 'E1b Evidências audiovisuais' },
  { id: 'cut', label: 'E2 Corte', gate: 'cut' },
  { id: 'plan', label: 'E3 Storyboard', gate: 'plan' },
  { id: 'composition', label: 'E4 Composição' },
  { id: 'review', label: 'E5 Draft e verificação', gate: 'draft' },
  { id: 'final', label: 'E6 Render final' },
];

export const GATES = ['cut', 'plan', 'draft'];

export function assertSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '')) {
    fail(`slug inválido: "${slug}". Use minúsculas, números e hífen (ex.: 2026-10-10-dica-de-prompt).`);
  }
}

/** Aceita "meu-video" ou "videos/meu-video" e devolve os caminhos do projeto. */
export function locate(slugOrPath) {
  if (!slugOrPath) fail('informe o slug do projeto (pasta dentro de videos/).');
  const slug = basename(slugOrPath.replace(/\/+$/, ''));
  const dir = isAbsolute(slugOrPath) ? slugOrPath : join(VIDEOS, slug);
  const paths = Object.fromEntries(Object.entries(DIRS).map(([key, name]) => [key, join(dir, name)]));
  return { slug, dir, paths, file: join(dir, 'project.json') };
}

export function loadProject(slugOrPath) {
  const project = locate(slugOrPath);
  if (!existsSync(project.file)) {
    fail(`projeto não encontrado: ${project.dir}\nCrie com: node scripts/vid.mjs new <slug> --source <video>`);
  }
  const loaded = { ...project, data: JSON.parse(readFileSync(project.file, 'utf8')) };
  loaded.data.stages.analysis ??= 'pending';
  loaded.data.review_policy ??= 'assisted';
  ensureDirs(loaded);
  if (refresh(loaded)) saveProject(loaded);
  return loaded;
}

export function saveProject(project) {
  project.data.updated = new Date().toISOString();
  writeFileSync(project.file, JSON.stringify(project.data, null, 2) + '\n');
}

/** Marca uma etapa e registra uma linha no histórico do projeto. */
export function setStage(project, stage, status, note) {
  if (status === 'in-progress' || status === 'pending') invalidate(project, stage, note);
  project.data.stages[stage] = status;
  project.data.snapshots ??= {};
  if (['done', 'awaiting-approval'].includes(status)) {
    project.data.snapshots[stage] = stageSignature(project, stage);
    delete project.data.stale?.[stage];
  }
  project.data.log.push({ at: new Date().toISOString(), stage, status, ...(note ? { note } : {}) });
  saveProject(project);
}

export function finishStage(project, stage, note) {
  const gated = STAGES.find((s) => s.id === stage)?.gate;
  setStage(project, stage, gated && project.data.review_policy !== 'autonomous' ? 'awaiting-approval' : 'done', note);
}

export function ensureDirs(project) {
  for (const dir of Object.values(project.paths)) mkdirSync(dir, { recursive: true });
}

/** Caminho relativo à raiz do repo, para mensagens que o usuário pode clicar. */
export function rel(path) {
  const absolute = resolve(path);
  return absolute.startsWith(ROOT + '/') ? absolute.slice(ROOT.length + 1) : absolute;
}

/** Próxima ação do pipeline, considerando etapas concluídas e aprovações pendentes. */
export function nextStep(data) {
  for (const stage of STAGES) {
    const status = data.stages[stage.id];
    if (status === 'done') continue;
    if (stage.gate && status === 'awaiting-approval') {
      return { stage, waiting: true, text: `aguardando sua aprovação (${stage.gate})` };
    }
    return { stage, waiting: false, text: status === 'in-progress' ? 'em andamento' : 'a fazer' };
  }
  return null;
}
