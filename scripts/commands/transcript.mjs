// E1: transcrição com tempo por palavra.
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadProject, rel, saveProject, setStage } from '../lib/project.mjs';
import { extractAudio, packTranscript, cachedTranscribe } from '../lib/transcribe.mjs';
import { clock, fail, numberFlag, parseArgs, readJson } from '../lib/util.mjs';
import { digest, fileHash } from '../lib/fingerprint.mjs';

export async function transcribe(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['force', 'keyterms'] });
  const project = loadProject(positional[0]);
  const { data, paths } = project;
  const out = join(paths.transcript, 'transcript.raw.json');
  const provider = flags.provider ?? data.transcription?.provider ?? 'local';
  if (!['local', 'elevenlabs'].includes(provider)) fail('--provider deve ser local ou elevenlabs.');
  const source = join(project.dir, data.source.file);
  const glossary = join(project.dir, 'glossary.json');
  const settings = { provider, language: flags.lang ?? data.language, engine: flags.engine, model: flags.model, keyterms: Boolean(flags.keyterms) };
  const legacySignature = digest({ source: fileHash(source), settings, glossary: fileHash(glossary), clock: 2 });
  const inputSignature = digest({ source: fileHash(source), settings, glossary: flags.keyterms && provider === 'elevenlabs' ? fileHash(glossary) : null, clock: 2 });

  // A transcrição é cara e determinada pelo bruto: só refaz se pedirem.
  if (existsSync(out) && !flags.force) {
    const cached = readJson(out);
    if (cached.input_signature === inputSignature || cached.input_signature === legacySignature) {
      console.log(`Transcrição em cache (${cached.words.length} palavras). Use --force para refazer.`);
      return;
    }
    fail('transcrição existente usa outros insumos/relógio; use --force para regenerar preservando o original no histórico');
  }

  const audio = join(paths.transcript, 'audio.wav');
  console.log('Extraindo áudio...');
  setStage(project, 'transcript', 'in-progress');
  const timeline = extractAudio(source, audio);
  console.log(`Transcrevendo com ${provider} (idioma ${flags.lang ?? data.language})...`);
  const { transcript, cache_hit } = await cachedTranscribe(audio, {
    provider,
    language: flags.lang ?? data.language,
    engine: flags.engine,
    model: flags.model,
    duration: data.source.duration,
    keyterms: flags.keyterms && existsSync(glossary) ? readJson(glossary).terms ?? [] : [],
  }, { force: Boolean(flags.force) });
  if (cache_hit) console.log('ASR idêntico reaproveitado do cache local compartilhado.');
  transcript.input_signature = inputSignature;
  transcript.source_timeline = timeline;

  if (existsSync(out)) copyFileSync(out, join(paths.transcript, `transcript.before-${Date.now()}.json`));
  writeFileSync(out, JSON.stringify(transcript, null, 2) + '\n');
  writeFileSync(join(paths.transcript, 'transcript.raw.md'), packTranscript(transcript, { title: `Transcrição bruta: ${data.slug}` }));
  data.transcription = { provider, model: transcript.model, words: transcript.words.length };
  saveProject(project);
  setStage(project, 'transcript', 'done', `${transcript.words.length} palavras via ${provider}`);

  console.log(`${transcript.words.length} palavras → ${rel(out)}`);
  console.log(`Leia ${rel(join(paths.transcript, 'transcript.raw.md'))} e corrija nomes próprios errados no JSON (só o campo "text").`);
  console.log(`Próximo: node scripts/vid.mjs silences ${data.slug}`);
}

/** Uma palavra por linha, com índice. Use para achar os limites exatos de um corte. */
export function words(args) {
  const { flags, positional } = parseArgs(args, { booleans: ['edited'] });
  const project = loadProject(positional[0]);
  const path = flags.edited
    ? join(project.paths.cut, 'transcript.json')
    : join(project.paths.transcript, 'transcript.raw.json');
  if (!existsSync(path)) fail(`não existe: ${rel(path)}`);
  const list = readJson(path).words;
  const from = Math.max(0, numberFlag(flags, 'from', 0));
  const to = Math.min(list.length - 1, numberFlag(flags, 'to', list.length - 1));
  for (let i = from; i <= to; i++) {
    const word = list[i];
    const gap = i > 0 ? word.start - list[i - 1].end : word.start;
    const pause = gap >= 0.3 ? `  ← pausa ${gap.toFixed(2)}s` : '';
    console.log(`${String(i).padStart(4)}  ${clock(word.start)}–${clock(word.end)}  ${word.text}${pause}`);
  }
}
