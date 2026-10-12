// Comandos de projeto: criar, ver estado, registrar aprovações.
import { constants, copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { GATES, STAGES, VIDEOS, assertSlug, ensureDirs, loadProject, locate, nextStep, rel, saveProject, setStage } from '../lib/project.mjs';
import { probe } from '../lib/media.mjs';
import { ROOT, fail, numberFlag, parseArgs } from '../lib/util.mjs';
import { DEFAULT_THEME } from '../lib/storyboard.mjs';
import { stageSignature } from '../lib/fingerprint.mjs';
import { reference } from './references.mjs';

const TARGET = { width: 1080, height: 1920, fps: 30 };

function fill(text, values) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
}

export async function newProject(args) {
  const { flags, positional } = parseArgs(args);
  const [slug] = positional;
  assertSlug(slug);
  const format = { width: numberFlag(flags, 'width', TARGET.width), height: numberFlag(flags, 'height', TARGET.height), fps: numberFlag(flags, 'fps', TARGET.fps) };
  if (![format.width, format.height].every((n) => Number.isInteger(n) && n >= 64 && n % 2 === 0) || !(format.fps >= 1 && format.fps <= 120)) fail('use dimensões pares ≥64 e fps entre 1 e 120');
  const policy = flags.review ?? 'assisted';
  if (!['assisted', 'autonomous'].includes(policy)) fail('--review: assisted | autonomous');
  if (!flags.source) fail('informe o vídeo bruto: --source <caminho>');
  const source = resolve(flags.source);
  if (!existsSync(source)) fail(`vídeo não encontrado: ${source}`);

  const project = locate(slug);
  if (existsSync(project.dir)) fail(`já existe: ${rel(project.dir)}. Escolha outro slug.`);
  ensureDirs(project);

  // Cópia do bruto. Em btrfs/xfs o FICLONE faz a cópia sem duplicar os dados em disco.
  const rawName = `raw${extname(source).toLowerCase() || '.mp4'}`;
  const raw = join(project.paths.source, rawName);
  copyFileSync(source, raw, constants.COPYFILE_FICLONE);
  const info = probe(raw);
  writeFileSync(join(project.paths.source, 'source.json'), JSON.stringify({ original_path: source, ...info }, null, 2) + '\n');

  const today = new Date().toISOString().slice(0, 10);
  const values = { slug, date: today, title: flags.title ?? slug, duration: info.duration.toFixed(1), ...format };
  const templates = join(ROOT, 'templates/project');
  for (const name of readdirSync(templates)) {
    writeFileSync(join(project.dir, name), fill(readFileSync(join(templates, name), 'utf8'), values));
  }

  project.data = {
    schema: 2,
    slug,
    title: values.title,
    created: today,
    language: flags.lang ?? 'pt',
    source: { file: `00-source/${rawName}`, original_path: source, duration: info.duration },
    format,
    review_policy: policy,
    transcription: { provider: flags.provider ?? 'local' },
    stages: Object.fromEntries(STAGES.map((s) => [s.id, 'pending'])),
    gates: Object.fromEntries(GATES.map((g) => [g, null])),
    renders: [],
    log: [],
  };
  project.data.stages.intake = 'in-progress';
  saveProject(project);
  writeFileSync(join(project.dir, 'theme.json'), JSON.stringify(DEFAULT_THEME, null, 2) + '\n');
  writeFileSync(join(project.dir, 'glossary.json'), JSON.stringify({ terms: [], corrections: [], note: 'Corrija texto após conferir a fala; não transforme dimensões incertas em fatos.' }, null, 2) + '\n');
  writeFileSync(join(project.paths.references, 'manifest.json'), JSON.stringify({ schema: 1, references: [] }, null, 2) + '\n');
  writeFileSync(join(project.paths.references, 'direction.json'), JSON.stringify({ reviewed: false, theme: '', audience: '', visual_decisions: [], supported_claims: [], avoid: [], reference_ids: [] }, null, 2) + '\n');
  if (flags.site) await reference([slug, flags.site, '--role', 'brand']);

  console.log(`Projeto criado: ${rel(project.dir)}`);
  console.log(`  bruto: ${info.video.width}x${info.video.height} · ${info.video.fps} fps · ${info.duration}s · ${info.video.codec}`);
  if (info.video.hdr) console.log('  fonte em HDR: o corte converte para SDR automaticamente.');
  if (info.video.variable_frame_rate) console.log(`  taxa de quadros variável: o corte fixa em ${TARGET.fps} fps.`);
  if (info.video.width > info.video.height) {
    console.log('  ATENÇÃO: a fonte é horizontal. O corte central para 9:16 descarta as laterais; confira o enquadramento.');
  }
  console.log(`\nPróximo: preencher ${rel(join(project.dir, 'BRIEF.md'))} e rodar \`node scripts/vid.mjs transcribe ${slug}\`.`);
}

export function status(args) {
  const project = loadProject(args[0]);
  const { data } = project;
  console.log(`${data.slug}: ${data.title}`);
  console.log(`  bruto ${data.source.duration}s · alvo ${data.format.width}x${data.format.height}@${data.format.fps} · idioma ${data.language}\n`);
  const marks = { done: '✔', 'in-progress': '…', 'awaiting-approval': '⏸', pending: ' ' };
  for (const stage of STAGES) {
    const state = data.stages[stage.id];
    const gate = stage.gate ? data.gates[stage.gate] : null;
    const approved = gate ? `  aprovado em ${gate.approved_at.slice(0, 10)}${gate.note ? ` (${gate.note})` : ''}` : '';
    console.log(`  [${marks[state] ?? '?'}] ${stage.label.padEnd(26)} ${state}${approved}`);
  }
  const next = nextStep(data);
  console.log(next ? `\nPróximo: ${next.stage.label}: ${next.text}` : '\nProjeto concluído.');
  if (data.renders.length) console.log(`Último render: ${data.renders.at(-1).file}`);
}

export function list() {
  if (!existsSync(VIDEOS)) return console.log('Nenhum projeto.');
  const slugs = readdirSync(VIDEOS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(VIDEOS, e.name, 'project.json')))
    .map((e) => e.name)
    .sort();
  if (!slugs.length) return console.log('Nenhum projeto em videos/.');
  for (const slug of slugs) {
    const { data } = loadProject(slug);
    const next = nextStep(data);
    console.log(`${slug.padEnd(36)} ${next ? `${next.stage.label} (${next.text})` : 'concluído'}`);
  }
}

/** Uma etapa com portão só fecha depois que a pessoa aprova. O agente registra a aprovação aqui. */
export function gate(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['approve', 'reopen'] });
  const [slug, name] = positional;
  if (!GATES.includes(name)) fail(`portão inválido: "${name}". Use ${GATES.join(' | ')}.`);
  const project = loadProject(slug);
  const stage = STAGES.find((s) => s.gate === name);

  if (flags.reopen) {
    project.data.gates[name] = null;
    setStage(project, stage.id, 'in-progress', flags.note ?? 'reaberto');
    return console.log(`Portão "${name}" reaberto.`);
  }
  if (!flags.approve) fail('use --approve (depois que a pessoa aprovar) ou --reopen.');
  if (project.data.stages[stage.id] !== 'awaiting-approval') {
    fail(`a etapa ${stage.label} está "${project.data.stages[stage.id]}", não "awaiting-approval". Gere o material de revisão antes.`);
  }
  project.data.gates[name] = { approved_at: new Date().toISOString(), signature: stageSignature(project, stage.id), ...(flags.note ? { note: flags.note } : {}) };
  setStage(project, stage.id, 'done', `aprovado${flags.note ? `: ${flags.note}` : ''}`);
  console.log(`Portão "${name}" aprovado. Etapa ${stage.label} concluída.`);
}

export function stage(args) {
  const { flags, positional } = parseArgs(args);
  const [slug, id, state] = positional;
  const allowed = ['pending', 'in-progress', 'awaiting-approval', 'done'];
  const found = STAGES.find((s) => s.id === id);
  if (!found) fail(`etapa inválida: "${id}". Use ${STAGES.map((s) => s.id).join(' | ')}.`);
  if (!allowed.includes(state)) fail(`estado inválido: "${state}". Use ${allowed.join(' | ')}.`);
  if (found.gate && state === 'done') fail(`a etapa ${found.label} tem portão. Use \`vid gate ${slug} ${found.gate} --approve\`.`);
  const project = loadProject(slug);
  setStage(project, id, state, flags.note);
  console.log(`${found.label}: ${state}`);
}

export { newProject as new };
