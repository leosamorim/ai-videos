// E4: composição em HyperFrames. `compose` prepara a pasta, `captions` gera as legendas,
// `check` valida e `render` produz um draft numerado.
import { spawnSync } from 'node:child_process';
import { closeSync, constants, copyFileSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPTION_DEFAULTS, auditCaptions, chunkWords, renderCaptions } from '../lib/captions.mjs';
import { loadProject, rel, saveProject, setStage } from '../lib/project.mjs';
import { fileHash, stageSignature } from '../lib/fingerprint.mjs';
import { compileStoryboard, DEFAULT_THEME, reframeScript, themeCss } from '../lib/storyboard.mjs';
import { HYPERFRAMES, ROOT, fail, parseArgs, readJson } from '../lib/util.mjs';
import { probe } from '../lib/media.mjs';

function requireCut(project) {
  const edlPath = join(project.paths.cut, 'edl.json');
  const clean = join(project.paths.cut, 'master.mp4');
  if (!existsSync(edlPath) || !existsSync(clean)) fail(`falta o corte. Rode: node scripts/vid.mjs cut ${project.slug}`);
  return { edl: readJson(edlPath), clean, transcript: readJson(join(project.paths.cut, 'transcript.json')) };
}

/**
 * Duração da composição, arredondada para baixo em milissegundos. Arredondar para cima
 * faz o renderizador criar um quadro a mais que o vídeo cortado não tem.
 */
function compositionDuration(edl) {
  return Math.floor(edl.edited_duration * 1000) / 1000;
}

function fontFaces() {
  const brand = join(ROOT, 'brand/fonts/fonts.json');
  const manifest = existsSync(brand) ? brand : join(ROOT, 'templates/fonts/fonts.json');
  return readJson(manifest)
    .map((f) => `      @font-face {\n        font-family: "${f.family}";\n        src: url("assets/fonts/${f.file}") format("woff2");\n        font-weight: ${f.weight};\n        font-style: ${f.style ?? 'normal'};\n        font-display: block;\n      }`)
    .join('\n');
}

function hyperframes(args, { capture = false, logPath } = {}) {
  const fd = logPath ? openSync(logPath, 'w') : null;
  let result;
  try { result = spawnSync(HYPERFRAMES, args, {
    cwd: ROOT,
    env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' },
    stdio: fd !== null ? ['ignore', fd, fd] : capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  }); } finally { if (fd !== null) closeSync(fd); }
  if (result.error) fail(result.error.message);
  if (logPath) {
    console.log(`HyperFrames: ${result.status === 0 ? 'ok' : 'falhou'}. Log: ${rel(logPath)}`);
    if (result.status !== 0) console.error(readFileSync(logPath, 'utf8').slice(-2000));
  }
  return result;
}

function writeCaptions(project, cut, board = { caption_zones: [] }) {
  const dir = project.paths.composition;
  const configPath = join(dir, 'captions.config.json');
  const themePath = join(project.dir, 'theme.json');
  const theme = existsSync(themePath) ? readJson(themePath) : DEFAULT_THEME;
  const config = { ...CAPTION_DEFAULTS, y: Math.round(project.data.format.height * 0.70), maxWidth: Math.round(project.data.format.width * 0.78), ...theme.captions, ...(existsSync(configPath) ? readJson(configPath) : {}) };
  config.overrides = [...(config.overrides ?? []), ...board.caption_zones.map((z) => ({ from: z.start, to: z.end, ...(z.hidden ? { hidden: true } : { y: z.y }) }))];
  mkdirSync(join(dir, 'compositions'), { recursive: true });
  const { format } = project.data;
  const html = renderCaptions(cut.transcript.words, config, {
    duration: compositionDuration(cut.edl),
    width: format.width,
    height: format.height,
  });
  writeFileSync(join(dir, 'compositions/captions.html'), html);
  mkdirSync(project.paths.review, { recursive: true });
  writeFileSync(join(project.paths.review, 'captions.json'), JSON.stringify({
    advisory: true, transcript_hash: fileHash(join(project.paths.cut, 'transcript.json')),
    blocks: auditCaptions(cut.transcript.words, config),
  }, null, 2) + '\n');
  return chunkWords(cut.transcript.words, config).length;
}

export function compose(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['force'] });
  const project = loadProject(positional[0]);
  if (project.data.stages.cut !== 'done') {
    fail(`o corte está pendente ou desatualizado (${project.data.stages.cut}); conclua sua revisão.`);
  }
  if (project.data.stages.plan !== 'done') fail('valide e conclua o storyboard com vid plan antes de compose');
  const cut = requireCut(project);
  const mediaTier = flags.media ?? 'master';
  if (!['master', 'proxy'].includes(mediaTier)) fail('--media deve ser master ou proxy');
  const media = mediaTier === 'proxy' ? join(project.paths.cut, 'clean.mp4') : cut.clean;
  if (!existsSync(media)) fail('proxy ausente: rode cut');
  if (mediaTier === 'proxy') {
    const masterInfo = probe(cut.clean), proxyInfo = probe(media);
    if (masterInfo.video.frames !== proxyInfo.video.frames || masterInfo.video.fps !== proxyInfo.video.fps || Math.abs(masterInfo.duration - proxyInfo.duration) > 0.001) fail('proxy não preserva quadros, duração e fps do master');
  }
  const board = compileStoryboard(readJson(join(project.paths.plan, 'storyboard.json')), cut.transcript.words, cut.edl.edited_duration);
  const themePath = join(project.dir, 'theme.json');
  const theme = existsSync(themePath) ? readJson(themePath) : DEFAULT_THEME;
  setStage(project, 'composition', 'in-progress');
  const dir = project.paths.composition;
  const { format } = project.data;
  for (const sub of ['assets/vendor', 'assets/fonts', 'compositions', 'cards']) mkdirSync(join(dir, sub), { recursive: true });

  // Insumos derivados do corte e da marca: sempre atualizados.
  copyFileSync(media, join(dir, 'assets/clean.mp4'), constants.COPYFILE_FICLONE);
  copyFileSync(join(ROOT, 'node_modules/gsap/dist/gsap.min.js'), join(dir, 'assets/vendor/gsap.min.js'));
  for (const fonts of [join(ROOT, 'templates/fonts'), join(ROOT, 'brand/fonts')]) {
    if (existsSync(fonts)) for (const file of readdirSync(fonts)) if (file.endsWith('.woff2') || file.startsWith('OFL')) copyFileSync(join(fonts, file), join(dir, 'assets/fonts', file));
  }
  copyFileSync(join(ROOT, 'templates/components/motion.js'), join(dir, 'assets/vendor/motion.js'));
  for (const extra of ['logos', 'sfx', 'music']) {
    const from = join(ROOT, 'brand', extra);
    if (existsSync(from)) cpSync(from, join(dir, 'assets', extra), { recursive: true, filter: (p) => !p.endsWith('README.md') });
  }
  // Formato que as skills do HyperFrames esperam: lista plana de palavras e metadados do vídeo.
  writeFileSync(join(dir, 'transcript.json'), JSON.stringify(cut.transcript.words.map(({ text, start, end }) => ({ text, start, end })), null, 2) + '\n');
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify({ duration: compositionDuration(cut.edl), width: format.width, height: format.height, fps: format.fps,
    media_tier: mediaTier, media_hash: fileHash(media), cut_hash: fileHash(join(project.paths.cut, 'edl.json')), plan_hash: fileHash(join(project.paths.plan, 'storyboard.json')), theme_hash: fileHash(themePath) }, null, 2) + '\n');

  if (!existsSync(join(dir, 'hyperframes.json'))) {
    copyFileSync(join(ROOT, 'templates/composition/hyperframes.json'), join(dir, 'hyperframes.json'));
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ id: project.slug, name: project.data.title, createdAt: new Date().toISOString() }, null, 2) + '\n');
  }
  if (!existsSync(join(dir, 'captions.config.json'))) {
    const brand = join(ROOT, 'brand/captions.json');
    writeFileSync(join(dir, 'captions.config.json'), JSON.stringify({ ...CAPTION_DEFAULTS, y: Math.round(format.height * 0.70), maxWidth: Math.round(format.width * 0.78), ...(existsSync(brand) ? readJson(brand) : {}), ...theme.captions }, null, 2) + '\n');
  }

  const index = join(dir, 'index.html');
  if (!existsSync(index) || flags.force) {
    const tokens = themeCss(theme, format);
    const values = {
      WIDTH: format.width,
      HEIGHT: format.height,
      FPS: format.fps,
      DURATION: compositionDuration(cut.edl),
      FONT_FACES: fontFaces(),
      TOKENS: tokens,
    };
    const html = readFileSync(join(ROOT, 'templates/composition/index.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
    writeFileSync(index, html);
    console.log(`Criado ${rel(index)}`);
  } else {
    let html = readFileSync(index, 'utf8');
    for (const id of ['root', 'a-roll', 'captions']) html = html.replace(new RegExp('<[^>]+id="' + id + '"[^>]*>'), (tag) => tag
      .replace(/data-duration="[^"]*"/, `data-duration="${compositionDuration(cut.edl)}"`)
      .replace(/data-width="[^"]*"/, `data-width="${format.width}"`).replace(/data-height="[^"]*"/, `data-height="${format.height}"`).replace(/data-fps="[^"]*"/, `data-fps="${format.fps}"`));
    if (!html.includes('editorial.generated.js')) html = html.replace('</head>', '<script src="editorial.generated.js"></script></head>');
    if (!html.includes('window.applyEditorialReframes(tl)')) html = html.replace('const tl = gsap.timeline({ paused: true });', 'const tl = gsap.timeline({ paused: true });\nwindow.applyEditorialReframes(tl);');
    html = html.replace(/<link[^>]*href="theme.generated.css"[^>]*>/g, '').replace('</head>', '<link rel="stylesheet" href="theme.generated.css" /></head>');
    for (const card of board.cards) html = html.replace(new RegExp('<[^>]+id="' + card.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>'), (tag) => tag
      .replace(/data-start="[^"]*"/, `data-start="${card.start}"`).replace(/data-duration="[^"]*"/, `data-duration="${card.end - card.start}"`));
    writeFileSync(index, html);
    console.log('Tempos gerenciados atualizados; revise animações manuais que ainda usam números fixos.');
  }

  writeFileSync(join(dir, 'theme.generated.css'), themeCss(theme, format));
  writeFileSync(join(dir, 'editorial.generated.js'), `window.editorialTimeline = ${JSON.stringify(board)};\n` + reframeScript(board));
  const blocks = writeCaptions(project, cut, board);
  setStage(project, 'composition', 'in-progress');
  console.log(`Composição pronta em ${rel(dir)} (${blocks} blocos de legenda).`);
  console.log('Próximo: escrever os cards do storyboard em index.html e validar com `node scripts/vid.mjs check ' + project.slug + '`.');
}

export function captions(args) {
  const project = loadProject(args[0]);
  if (!existsSync(join(project.paths.composition, 'index.html'))) fail(`rode antes: node scripts/vid.mjs compose ${project.slug}`);
  assertCurrent(project);
  const cut = requireCut(project);
  const board = compileStoryboard(readJson(join(project.paths.plan, 'storyboard.json')), cut.transcript.words, cut.edl.edited_duration);
  const blocks = writeCaptions(project, cut, board);
  console.log(`${blocks} blocos de legenda → ${rel(join(project.paths.composition, 'compositions/captions.html'))}`);
}

export function check(args) {
  const project = loadProject(args[0]);
  assertCurrent(project);
  const result = hyperframes(['check', project.paths.composition, ...args.slice(1).filter((a) => a !== '--verbose')], {
    logPath: args.includes('--verbose') ? undefined : join(project.paths.review, 'hyperframes-check.log'),
  });
  if (result.status === 0) { project.data.last_check_signature = stageSignature(project, 'composition'); saveProject(project); }
  process.exitCode = result.status ?? 1;
}

/** Quadros da composição atual, sem renderizar: para conferir posição e legibilidade antes de gastar um render. */
export function snapshot(args) {
  const { flags, positional } = parseArgs(args);
  const project = loadProject(positional[0]);
  const { paths } = project;
  if (!existsSync(join(paths.composition, 'index.html'))) fail(`rode antes: node scripts/vid.mjs compose ${project.slug}`);
  if (!flags.at) fail('informe os instantes: --at 1.5,3,7.2 (segundos na linha do tempo editada)');
  const out = join(paths.review, 'snapshots', `run-${Date.now()}`);
  mkdirSync(out, { recursive: true });
  // Saída fora de 04-composition e sem descrição por serviço externo: nenhum quadro sai da máquina.
  const result = hyperframes(['snapshot', paths.composition, '-o', out, '--at', String(flags.at), '--no-end', '--describe', 'false']);
  if (result.status !== 0) fail('a captura falhou. Rode `vid check` e corrija os erros apontados.');
  console.log(`Quadros em ${rel(out)}. Isto mostra instantes isolados; movimento se confere no render com \`vid frames --seq\`.`);
}

export function render(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['verbose'] });
  const project = loadProject(positional[0]);
  const { data, paths } = project;
  if (!existsSync(join(paths.composition, 'index.html'))) fail(`rode antes: node scripts/vid.mjs compose ${project.slug}`);
  mkdirSync(paths.renders, { recursive: true });
  assertCurrent(project);
  if (data.last_check_signature !== stageSignature(project, 'composition')) fail('composição mudou ou ainda não foi validada: rode vid check');
  const number = Math.max(0, ...readdirSync(paths.renders).filter((f) => /^draft-\d+\.mp4$/.test(f)).map((f) => Number(f.match(/\d+/)[0]))) + 1;
  const name = `draft-${String(number).padStart(2, '0')}.mp4`;
  const out = join(paths.renders, name);
  // draft = rápido para iterar; looks = qualidade de entrega (CRF 16).
  const quality = flags.quality ?? 'draft';
  if (!['draft', 'looks', 'delivery'].includes(quality)) fail('--quality deve ser draft, looks ou delivery');

  console.log(`Renderizando ${rel(out)} (qualidade ${quality})...`);
  const extra = flags.workers ? ['--workers', flags.workers] : [];
  const result = hyperframes(['render', paths.composition, '-o', out, '--fps', String(data.format.fps), '--quality', quality, ...extra], {
    logPath: flags.verbose ? undefined : join(paths.review, `${name}.log`),
  });
  if (result.status !== 0 || !existsSync(out)) fail('o render falhou. Rode `vid check` e corrija os erros apontados.');

  data.renders.push({ composition_signature: stageSignature(project, 'composition'), media_tier: readJson(join(paths.composition, 'metadata.json')).media_tier, file: `05-renders/${name}`, quality, at: new Date().toISOString() });
  saveProject(project);
  setStage(project, 'composition', 'done', name);
  setStage(project, 'review', 'in-progress', name);
  console.log(`Pronto: ${rel(out)}`);
  console.log(`Próximo: node scripts/vid.mjs verify ${project.slug}`);
}

function assertCurrent(project) {
  if (project.data.stages.cut !== 'done' || project.data.stages.plan !== 'done') fail('corte/storyboard pendente ou desatualizado');
  const m = readJson(join(project.paths.composition, 'metadata.json'));
  if (m.media_hash && (m.media_hash !== fileHash(join(project.paths.composition, 'assets/clean.mp4')) || m.media_hash !== fileHash(join(project.paths.cut, m.media_tier === 'proxy' ? 'clean.mp4' : 'master.mp4')))) fail('mídia da composição mudou: rode compose');
  if (m.cut_hash !== fileHash(join(project.paths.cut, 'edl.json')) || m.plan_hash !== fileHash(join(project.paths.plan, 'storyboard.json')) || m.theme_hash !== fileHash(join(project.dir, 'theme.json'))) fail('composição desatualizada: rode compose e revise as alterações');
}
