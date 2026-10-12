// Transcrição com tempo por palavra. Dois provedores, um formato de saída:
//   { schema, provider, model, language, audio_duration_secs, words: [{ i, text, start, end }], events: [] }
//
//  - local:      `hyperframes transcribe` (Parakeet ou Whisper na máquina). Grátis e privado.
//  - elevenlabs: Scribe. Pago, envia o áudio para a nuvem, mantém hesitações ("é", "hum")
//                e marca eventos como risos, o que ajuda a decidir cortes.
import { existsSync, mkdtempSync, openAsBlob, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { HYPERFRAMES, ROOT, clock, fail, loadEnv, round, run } from './util.mjs';
import { audioTimelineFilter, probe } from './media.mjs';
import { readCache, writeCache, toolVersions } from './cache.mjs';
import { fileHash } from './fingerprint.mjs';

/** Áudio mono 16 kHz: é o que os modelos de fala esperam e deixa o upload pequeno. */
export function extractAudio(video, out) {
  const info = probe(video);
  if (!info.audio) fail('fonte sem áudio: use um fluxo visual, sem transcrição');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-vn', '-af',
    audioTimelineFilter({ offset: info.timeline.audio_offset, duration: info.duration, sampleRate: 16000 }),
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', out]);
  return info.timeline;
}

function normalizeWords(list) {
  const words = [];
  for (const raw of list) {
    if (raw.type && raw.type !== 'word') continue;
    const text = String(raw.text ?? raw.word ?? '').trim();
    const start = Number(raw.start);
    const end = Number(raw.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end)) continue;
    words.push({ i: words.length, text, original_text: text, start: round(start), end: round(Math.max(end, start)),
      ...Object.fromEntries(['confidence', 'logprob', 'speaker_id'].filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]])) });
  }
  return words;
}

export function localAsrOptions({ language = 'pt', engine = 'auto', model } = {}) {
  const code = language.toLowerCase().split('-')[0];
  if (code !== 'en' && model?.endsWith('.en')) fail('modelo .en só suporta inglês; use large-v3 ou Parakeet para português');
  return { language: code, engine, model: model ?? (code === 'en' ? 'small.en' : 'large-v3') };
}

function transcribeLocal(audio, options) {
  const { language, engine, model } = localAsrOptions(options);
  const work = mkdtempSync(join(tmpdir(), 'vid-asr-'));
  try {
    const args = ['transcribe', audio, '-d', work, '--json', '--language', language];
    if (engine) args.push('--engine', engine);
    if (model) args.push('--model', model);
    const result = run(HYPERFRAMES, args, { cwd: ROOT, env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' }, allowFail: true });
    const line = result.stdout.trim().split('\n').reverse().find((l) => l.startsWith('{'));
    const report = line ? JSON.parse(line) : null;
    const path = report?.transcriptPath ?? join(work, 'transcript.json');
    if (result.status !== 0 || report?.ok === false || !existsSync(path)) {
      fail(
        `transcrição local falhou: ${report?.error ?? result.stderr.trim().split('\n').slice(-4).join(' ')}\n` +
          'Instale o modelo com `node scripts/hf.mjs models install parakeet` ou use --provider elevenlabs.',
      );
    }
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return {
      model: report?.model ?? report?.engine ?? engine ?? 'auto',
      words: normalizeWords(Array.isArray(data) ? data : data.words ?? []),
      events: [],
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

async function transcribeElevenLabs(audio, { language, model = 'scribe_v2', keyterms = [] }) {
  loadEnv();
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) fail('ELEVENLABS_API_KEY não definida. Copie .env.example para .env e preencha, ou use --provider local.');
  const form = new FormData();
  form.append('file', await openAsBlob(audio), basename(audio));
  form.append('model_id', model);
  form.append('timestamps_granularity', 'word');
  form.append('language_code', language);
  form.append('diarize', 'false');
  form.append('tag_audio_events', 'true');
  if (model === 'scribe_v2') {
    form.append('no_verbatim', 'false');
    for (const term of keyterms) form.append('keyterms', term);
  }
  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });
  if (!response.ok) fail(`ElevenLabs respondeu ${response.status}: ${(await response.text()).slice(0, 400)}`);
  const data = await response.json();
  const events = (data.words ?? [])
    .filter((w) => w.type === 'audio_event')
    .map((w) => ({ text: w.text, start: round(Number(w.start)), end: round(Number(w.end)) }));
  return { model, words: normalizeWords(data.words ?? []), events };
}

export async function transcribe(audio, { provider, language, engine, model, duration, keyterms = [] }) {
  const result = provider === 'elevenlabs'
    ? await transcribeElevenLabs(audio, { language, model, keyterms })
    : transcribeLocal(audio, { language, engine, model });
  if (!result.words.length) fail('a transcrição voltou vazia. O áudio tem fala? O idioma está certo?');
  return {
    schema: 2,
    timeline: 'source-video',
    provider,
    model: result.model,
    language,
    audio_duration_secs: duration,
    words: result.words,
    events: result.events,
  };
}

/** Cache only unedited ASR output. Expected/corrected words never form the cached verdict. */
export async function cachedTranscribe(audio, options, { force = false, runner = transcribe, cacheRoot } = {}) {
  const provider = options.provider ?? 'local';
  if (!['local', 'elevenlabs'].includes(provider)) fail('provedor ASR inválido');
  const settings = provider === 'local' ? localAsrOptions(options)
    : { language: options.language, model: options.model ?? 'scribe_v2', keyterms: options.keyterms ?? [] };
  const input = { revision: 1, audio: fileHash(audio), duration: options.duration, provider, settings, tools: toolVersions() };
  const cached = !force && readCache('asr', input, cacheRoot);
  if (cached) return { transcript: JSON.parse(readFileSync(join(cached.dir, 'transcript.json'), 'utf8')), cache_hit: true };
  const transcript = await runner(audio, { ...options, provider });
  const work = mkdtempSync(join(tmpdir(), 'vid-asr-cache-'));
  try {
    const path = join(work, 'transcript.json');
    writeFileSync(path, JSON.stringify(transcript));
    writeCache('asr', input, { files: { 'transcript.json': path }, replace: force }, cacheRoot);
  } finally { rmSync(work, { recursive: true, force: true }); }
  return { transcript, cache_hit: false };
}

/**
 * Visão de leitura da transcrição: uma frase por linha, com o intervalo de índices de
 * palavra e a pausa anterior. É o que o agente lê para escolher cortes sem gastar
 * contexto com o JSON inteiro.
 */
export function packTranscript(transcript, { title, pause = 0.5 } = {}) {
  const { words } = transcript;
  const lines = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current.at(-1);
    const previous = words[first.i - 1];
    const gap = previous ? first.start - previous.end : first.start;
    const range = `${String(first.i).padStart(3, '0')}-${String(last.i).padStart(3, '0')}`;
    const gapNote = gap >= pause ? ` · pausa ${gap.toFixed(2)}s` : '';
    lines.push(`[${range}] ${clock(first.start)}–${clock(last.end)}${gapNote} · ${current.map((w) => w.text).join(' ')}`);
    current = [];
  };
  for (const word of words) {
    const previous = words[word.i - 1];
    if (previous && (word.start - previous.end >= pause || /[.!?…]["')\]]?$/.test(previous.text) || current.length >= 14)) flush();
    current.push(word);
  }
  flush();
  return [
    `# ${title ?? 'Transcrição'}`,
    '',
    `${words.length} palavras · ${(transcript.audio_duration_secs ?? words.at(-1)?.end ?? 0).toFixed(2)}s · ${transcript.provider ?? 'não informado'} (${transcript.model ?? 'não informado'}) · idioma ${transcript.language}`,
    '',
    'Cada linha: `[palavra inicial-final] início–fim · pausa antes (se ≥ 0,5s) · texto`.',
    'Os índices são os que entram em `from_word` / `to_word` nos cortes.',
    'Para ver palavra por palavra: `node scripts/vid.mjs words <slug> --from N --to M`.',
    '',
    ...lines,
    '',
  ].join('\n');
}
