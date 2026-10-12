import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileHash } from './fingerprint.mjs';
import { ROOT, fail, readJson, run } from './util.mjs';

export const SIGNAL_HOME = join(ROOT, '.cache/vid-tools/signals');
export const SIGNAL_LOCK = readJson(join(ROOT, 'scripts/analysis/models.lock.json'));
export const SIGNAL_WORKER = join(ROOT, 'scripts/analysis/signals.py');
export const signalPython = (home = SIGNAL_HOME) => join(home, 'venv/bin/python');

function pythonRun(executable, args, timeout = 900000) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1', OMP_NUM_THREADS: '1' } });
  if (result.error || result.status !== 0) fail(`signals: ${result.error?.message ?? result.signal ?? result.status}\n${result.stderr?.slice(-1800) ?? ''}`);
  return result.stdout;
}

export function signalRuntimeStatus({ face = false, pose = false, home = SIGNAL_HOME } = {}) {
  try {
    const python = signalPython(home);
    if (!existsSync(python)) throw new Error('runtime não instalado');
    const versions = JSON.parse(pythonRun(python, [SIGNAL_WORKER, '--versions'], 15000));
    if (!versions.python.startsWith(`${SIGNAL_LOCK.python}.`)) throw new Error(`use Python ${SIGNAL_LOCK.python}`);
    const required = [...SIGNAL_LOCK.packages.audio, ...(face || pose ? SIGNAL_LOCK.packages.face : [])];
    for (const spec of required) {
      const [name, version] = spec.split('==');
      if (versions.packages[name] !== version) throw new Error(`${spec} ausente ou divergente`);
    }
    const kinds = ['audio', ...(face || pose ? ['face'] : []), ...(pose ? ['pose'] : [])];
    const models = {};
    for (const kind of kinds) {
      const model = SIGNAL_LOCK.models[kind], path = join(home, 'models', model.file);
      if (!existsSync(path) || fileHash(path) !== model.sha256) throw new Error(`modelo ${kind} ausente ou checksum divergente`);
      models[kind] = path;
    }
    return { ok: true, python, versions, models };
  } catch (error) { return { ok: false, reason: error.message, hint: `node scripts/vid.mjs signals setup${pose ? ' --pose' : face ? ' --face' : ''} --python python3.12` }; }
}

export function runSignalWorker(runtime, request, work) {
  mkdirSync(work, { recursive: true });
  const input = join(work, 'request.json'), output = join(work, 'report.json');
  writeFileSync(input, JSON.stringify({ ...request, models: runtime.models }));
  pythonRun(runtime.python, [SIGNAL_WORKER, input, output]);
  return readJson(output);
}

export async function setupSignals({ python = 'python3.12', face = false, pose = false, home = SIGNAL_HOME } = {}) {
  const version = pythonRun(python, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], 15000).trim();
  if (version !== SIGNAL_LOCK.python) fail(`runtime validado com Python ${SIGNAL_LOCK.python}; informe --python CAMINHO para essa versão`);
  mkdirSync(home, { recursive: true });
  if (!existsSync(signalPython(home))) pythonRun(python, ['-m', 'venv', join(home, 'venv')]);
  console.log('Instalando dependências opcionais em .cache/vid-tools/signals…');
  pythonRun(signalPython(home), ['-m', 'pip', 'install', '--disable-pip-version-check',
    ...SIGNAL_LOCK.packages.audio, ...(face || pose ? SIGNAL_LOCK.packages.face : [])]);
  const kinds = ['audio', ...(face || pose ? ['face'] : []), ...(pose ? ['pose'] : [])];
  mkdirSync(join(home, 'models'), { recursive: true });
  for (const kind of kinds) {
    const model = SIGNAL_LOCK.models[kind], destination = join(home, 'models', model.file);
    if (existsSync(destination) && fileHash(destination) === model.sha256) continue;
    console.log(`Baixando modelo fixado: ${kind}`);
    const response = await fetch(model.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) fail(`download ${kind}: HTTP ${response.status}`);
    const temporary = `${destination}.${process.pid}.pending`;
    try {
      writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
      if (fileHash(temporary) !== model.sha256) fail(`checksum inválido: ${kind}`);
      renameSync(temporary, destination);
    } finally { rmSync(temporary, { force: true }); }
  }
  const runtime = signalRuntimeStatus({ home, face, pose });
  if (!runtime.ok) fail(runtime.reason);
  const work = mkdtempSync(join(home, 'selftest-'));
  try {
    const audio = join(work, 'silence.wav');
    run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '0.5', '-c:a', 'pcm_s16le', audio]);
    runSignalWorker(runtime, { kind: 'audio', input: audio }, join(work, 'audio'));
    if (face || pose) {
      const video = join(work, 'black.mp4');
      run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=black:s=160x160:r=30:d=0.5', '-c:v', 'libx264', video]);
      runSignalWorker(runtime, { kind: 'face', input: video, pose, fps: 5, windows: [{ start: 0, end: 0.5 }] }, join(work, 'face'));
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
  console.log(`Signals pronto: ${kinds.join(', ')}; modelos carregados em CPU. Nenhuma mídia de projeto foi enviada.`);
}
