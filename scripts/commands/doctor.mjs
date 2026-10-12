// Confere se a máquina e o repo têm o que o pipeline precisa.
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HYPERFRAMES, ROOT, loadEnv, readJson, run } from '../lib/util.mjs';
import { signalRuntimeStatus } from '../lib/signal-runtime.mjs';

export function doctor() {
  const rows = [];
  const add = (ok, name, detail, required = true) => rows.push({ ok, name, detail, required });

  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 22, 'Node.js', `v${process.versions.node} (precisa ≥ 22)`);

  const ffmpeg = run('ffmpeg', ['-hide_banner', '-version'], { allowFail: true });
  add(ffmpeg.status === 0, 'ffmpeg', ffmpeg.stdout.split('\n')[0] || 'não encontrado');
  if (ffmpeg.status === 0) {
    const filters = run('ffmpeg', ['-hide_banner', '-filters']).stdout;
    for (const filter of ['silencedetect', 'loudnorm', 'drawtext', 'tile']) {
      add(new RegExp(`\\s${filter}\\s`).test(filters), `filtro ${filter}`, 'necessário');
    }
    const hdr = /\szscale\s/.test(filters) && /\stonemap\s/.test(filters);
    add(hdr, 'filtros zscale + tonemap', hdr ? 'conversão HDR → SDR disponível' : 'sem eles, vídeo HDR de celular sai lavado', false);
  }
  add(run('ffprobe', ['-version'], { allowFail: true }).status === 0, 'ffprobe', 'necessário');

  const pkg = readJson(join(ROOT, 'package.json'));
  const hfPath = join(ROOT, 'node_modules/hyperframes/package.json');
  const installed = existsSync(hfPath) ? readJson(hfPath).version : null;
  add(installed === pkg.devDependencies.hyperframes, 'HyperFrames', installed ? `v${installed} (fixado ${pkg.devDependencies.hyperframes})` : 'não instalado: rode npm install');

  const lockPath = join(ROOT, 'vendor/skills.lock.json');
  if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    const missing = Object.keys(lock.skills).filter((name) => !existsSync(join(ROOT, '.claude/skills', name, 'SKILL.md')));
    add(missing.length === 0 && lock.ref === `v${pkg.devDependencies.hyperframes}`, 'skills do HyperFrames',
      missing.length ? `faltando: ${missing.join(', ')}` : `${Object.keys(lock.skills).length} skills @ ${lock.ref}`);
  } else {
    add(false, 'skills do HyperFrames', 'rode npm run skills:vendor');
  }

  const skills = join(ROOT, '.claude/skills');
  const names = existsSync(skills) ? readdirSync(skills) : [];
  const unlinked = names.filter((name) => !lstatSync(join(ROOT, '.agents/skills', name), { throwIfNoEntry: false })?.isSymbolicLink());
  add(unlinked.length === 0, 'espelho para o Codex', unlinked.length ? `sem link: ${unlinked.join(', ')} (npm run skills:sync)` : `${names.length} skills em .agents/skills`);

  // O instalador do HyperFrames grava skills nas pastas globais. Aqui elas vivem no repo.
  const globals = [join(homedir(), '.claude/skills'), join(homedir(), '.agents/skills')]
    .flatMap((dir) => (existsSync(dir) ? readdirSync(dir).filter((n) => /^hyperframes|^media-use$|^talking-head-recut$|^embedded-captions$/.test(n)).map((n) => join(dir, n)) : []));
  add(globals.length === 0, 'skills globais duplicadas', globals.length ? `encontradas: ${globals.join(', ')} (podem conflitar com as do repo)` : 'nenhuma', false);

  const models = existsSync(HYPERFRAMES) ? run(HYPERFRAMES, ['models', 'list'], { cwd: ROOT, allowFail: true, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1', NO_COLOR: '1' } }) : { stdout: '' };
  const parakeet = /parakeet\S*\s+\S+\s+installed/.test(models.stdout.replace(/\x1b\[[0-9;]*m/g, '')) && !/not installed/.test(models.stdout);
  loadEnv();
  const scribe = Boolean(process.env.ELEVENLABS_API_KEY);
  add(parakeet || scribe, 'transcrição', [
    parakeet ? 'local (Parakeet) instalada' : 'local: rode `node scripts/hf.mjs models install parakeet`',
    scribe ? 'ElevenLabs: chave presente' : 'ElevenLabs: sem chave em .env',
  ].join(' · '));

  add(existsSync(join(ROOT, 'templates/fonts/fonts.json')), 'fontes genéricas', 'templates/fonts/fonts.json; brand/ é opcional e privado');
  const signals = signalRuntimeStatus();
  add(signals.ok, 'Silero (opcional)', signals.ok ? 'runtime e modelo íntegros; analyze usa cache' : signals.hint, false);
  const face = signalRuntimeStatus({ face: true });
  add(face.ok, 'MediaPipe (opcional)', face.ok ? 'runtime e modelo íntegros; usar em janelas duvidosas' : face.hint, false);

  let failed = 0;
  for (const row of rows) {
    const mark = row.ok ? 'ok   ' : row.required ? 'FALTA' : 'aviso';
    if (!row.ok && row.required) failed++;
    console.log(`  ${mark}  ${row.name.padEnd(28)} ${row.detail}`);
  }
  console.log(failed ? `\n${failed} item(ns) obrigatório(s) faltando.` : '\nTudo pronto.');
  process.exitCode = failed ? 1 : 0;
}
