// Lógica de corte: proposta de silêncios, resolução dos cortes em tempos, EDL e
// re-temporização da transcrição. Funções puras, cobertas por tests/cuts.test.mjs.
//
// Convenções:
//  - Todo tempo de entrada está na linha do tempo do vídeo bruto (segundos).
//  - `words` é [{ i, text, start, end }], em ordem.
//  - `silences` é o silêncio acústico medido no áudio, [{ start, end }]. Ele é a
//    referência para posicionar cortes, porque o tempo por palavra da transcrição
//    pode errar algumas dezenas de milissegundos.
import { round } from './util.mjs';
import { audioTimelineFilter } from './media.mjs';

export const DEFAULTS = {
  gap: 0.5,           // pausa mínima (s) para ser reduzida
  keepShort: 0.16,    // respiro mantido numa pausa comum
  keepSentence: 0.22, // respiro mantido depois de fim de frase
  keepLong: 0.26,     // respiro mantido numa pausa de 2 s ou mais
  headPad: 0.15,      // folga antes da primeira palavra
  tailPad: 0.35,      // folga depois da última palavra
  leadRatio: 0.55,    // fração do respiro que fica colada na palavra anterior
  minKeep: 0.12,      // trecho mantido menor que isto, sem palavra dentro, é absorvido
};

const mid = (word) => (word.start + word.end) / 2;
const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
const overlap = (a, b) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

/** Uma palavra "está dentro" de um intervalo quando pelo menos metade dela cai nele. */
function mostlyInside(word, range) {
  const length = Math.max(word.end - word.start, 0.04);
  return overlap(word, range) >= length * 0.5;
}

/**
 * Corrige o fim das palavras usando o áudio. Modelos de fala costumam esticar a última
 * palavra antes de uma pausa até a palavra seguinte; aqui o fim recua para onde o som
 * realmente acaba. O início das palavras é mantido.
 */
export function tightenWords(words, silences) {
  const long = silences.filter((s) => s.end - s.start >= 0.2);
  return words.map((word) => {
    const silence = long.find((s) => s.start > word.start + 0.06 && s.start < word.end);
    return silence ? { ...word, end: round(silence.start) } : word;
  });
}

/**
 * Une silêncios separados por um ruído curto (clique, respiração) quando nenhuma palavra
 * acontece ali. Sem isso, uma pausa longa vira vários cortes pequenos com ruído entre eles.
 */
export function mergeSilences(silences, words, maxBlip = 0.3) {
  const merged = [];
  for (const silence of silences) {
    const last = merged.at(-1);
    const blip = last ? { start: last.end, end: silence.start } : null;
    const speech = blip && words.some((w) => overlap(w, blip) > 0.03 || (w.start >= blip.start - 0.05 && w.start <= blip.end + 0.05));
    if (last && blip.end - blip.start < maxBlip && !speech) last.end = silence.end;
    else merged.push({ ...silence });
  }
  return merged;
}

/**
 * Silêncios acústicos que ficam entre o fim de uma palavra e o início da seguinte.
 * Entre duas falas pode haver mais de um, separados por ruído (respiração, roupa, clique).
 */
function silencesBetween(silences, leftEnd, rightStart, tolerance = 0.12) {
  return silences.filter((s) => s.end - s.start >= 0.05 && s.start >= leftEnd - tolerance && s.end <= rightStart + tolerance);
}

/**
 * Propõe cortes de silêncio: início e fim sem fala, e pausas longas reduzidas a um respiro.
 * Um corte que cairia sobre uma palavra da transcrição sai como "flagged" e não é aplicado
 * até alguém revisar.
 */
export function proposeSilenceCuts({ silences: measured, words, duration, params = {} }) {
  const p = { ...DEFAULTS, ...params };
  if (!words.length) return [];
  const silences = mergeSilences(measured, words);
  const cuts = [];
  const first = words[0];
  const last = words.at(-1);

  // Início: prefere a borda do silêncio acústico perto da primeira palavra.
  const headSilence = silences.find((s) => s.end > first.start - 0.4 && s.end < first.start + 0.15);
  const headEnd = (headSilence ? headSilence.end : first.start) - p.headPad;
  if (headEnd > 0.1) {
    cuts.push({ kind: 'silence', start: 0, end: round(headEnd), reason: 'antes da primeira fala', status: 'auto' });
  }

  const tailSilence = silences.find((s) => s.start > last.end - 0.15 && s.start < last.end + 0.4);
  const tailStart = (tailSilence ? tailSilence.start : last.end) + p.tailPad;
  const hasTail = duration - tailStart > 0.1;

  for (const s of silences) {
    const length = s.end - s.start;
    if (length < p.gap) continue;
    if (s.start < Math.max(headEnd, 0) || s.end > (hasTail ? tailStart : duration)) continue;
    const before = words.findLast((w) => w.end <= s.start + 0.2);
    const sentenceEnd = /[.!?…]["')\]]?$/.test(before?.text ?? '');
    const keep = length >= 2 ? p.keepLong : sentenceEnd ? p.keepSentence : p.keepShort;
    const start = s.start + keep * p.leadRatio;
    const end = s.end - keep * (1 - p.leadRatio);
    if (end - start < 0.08) continue;
    const spoken = words.filter((w) => overlap(w, { start, end }) > 0.02);
    cuts.push({
      kind: 'silence',
      start: round(start),
      end: round(end),
      reason: `pausa de ${length.toFixed(2)}s reduzida a ${keep.toFixed(2)}s`,
      status: spoken.length ? 'flagged' : 'auto',
      ...(spoken.length
        ? { flag: `a transcrição coloca "${spoken.map((w) => w.text).join(' ')}" dentro deste silêncio; confira antes de aprovar` }
        : {}),
    });
  }

  if (hasTail) {
    cuts.push({ kind: 'silence', start: round(tailStart), end: round(duration), reason: 'depois da última fala', status: 'auto' });
  }

  // Som isolado entre duas palavras: não é silêncio nem texto transcrito, e está separado das
  // duas falas por silêncio (respiração, hesitação, ruído de roupa). O modelo de fala costuma
  // omitir "é...", "hum"; é assim que eles aparecem. Fica para decisão, nunca automático.
  for (let i = 1; i < words.length; i++) {
    const left = words[i - 1];
    const right = words[i];
    const between = silencesBetween(silences, left.end, right.start);
    if (between.length < 2) continue;
    let sound = 0;
    for (let k = 1; k < between.length; k++) sound += between[k].start - between[k - 1].end;
    if (sound < 0.35) continue;
    cuts.push({
      kind: 'noise',
      start: round(between[0].start + p.keepShort * p.leadRatio),
      end: round(between.at(-1).end - p.keepShort * (1 - p.leadRatio)),
      reason: `${sound.toFixed(2)}s de som sem fala transcrita entre "${left.text}" e "${right.text}"`,
      status: 'flagged',
      flag: 'pode ser respiração, hesitação ("é...") ou ruído; veja os quadros desse trecho e decida',
    });
  }

  cuts.sort((a, b) => a.start - b.start);
  return cuts.map((cut, n) => ({ id: `${cut.kind === 'noise' ? 'n' : 's'}${String(n + 1).padStart(3, '0')}`, ...cut }));
}

/**
 * Converte um corte em [start, end] na linha do tempo do bruto.
 * Cortes de erro vêm como índices de palavra (from_word..to_word, inclusive); as bordas
 * são colocadas dentro do silêncio vizinho quando existe, ou no meio do intervalo entre palavras.
 */
export function resolveCut(cut, { words, silences, duration, params = {} }) {
  const p = { ...DEFAULTS, ...params };
  if (cut.kind !== 'mistake') return { start: cut.start, end: cut.end };

  const from = cut.from_word;
  const to = cut.to_word ?? from;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to >= words.length || to < from) {
    throw new Error(`corte ${cut.id}: from_word/to_word fora do intervalo 0..${words.length - 1}`);
  }
  const lead = p.keepShort * p.leadRatio;
  const trail = p.keepShort * (1 - p.leadRatio);

  // Início do corte: logo depois da última palavra mantida (primeiro silêncio após ela).
  let start = 0;
  const prev = words[from - 1];
  if (prev) {
    const first = silencesBetween(silences, prev.end, words[from].start)[0];
    start = first ? clamp(first.start + lead, first.start, first.end - 0.02) : (prev.end + words[from].start) / 2;
  }

  // Fim do corte: logo antes da próxima palavra mantida (último silêncio antes dela).
  // Assim o ruído entre duas tomadas sai junto com a tomada descartada.
  let end = duration;
  const next = words[to + 1];
  if (next) {
    const last = silencesBetween(silences, words[to].end, next.start).at(-1);
    end = last ? clamp(last.end - trail, last.start + 0.02, last.end) : (words[to].end + next.start) / 2;
  }
  return { start: round(start), end: round(Math.max(end, start)) };
}

/** Junta os cortes aplicáveis (auto ou approved) em intervalos de remoção sem sobreposição. */
export function mergeDeletes(cuts, context) {
  const ranges = cuts
    .filter((cut) => cut.status === 'auto' || cut.status === 'approved')
    .map((cut) => ({ ...resolveCut(cut, context), ids: [cut.id] }))
    .filter((r) => r.end - r.start > 0.001)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const range of ranges) {
    const lastRange = merged.at(-1);
    if (lastRange && range.start <= lastRange.end) {
      lastRange.end = Math.max(lastRange.end, range.end);
      lastRange.ids.push(...range.ids);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/**
 * Monta a lista de trechos mantidos, alinhada à grade de quadros para que vídeo e áudio
 * tenham exatamente a mesma duração em cada trecho.
 */
export function buildEdl({ deletes = [], selections, duration, fps, words = [], params = {} }) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0) throw new Error('duração/fps inválidos');
  const p = { ...DEFAULTS, ...params };
  let raw = [];
  let cursor = 0;
  for (const del of deletes) {
    if (del.start > cursor) raw.push({ start: cursor, end: del.start });
    cursor = Math.max(cursor, del.end);
  }
  if (cursor < duration) raw.push({ start: cursor, end: duration });
  if (selections) raw = selections;

  // Exclusive frame bound: a ten-second, 30-fps clip contains 300 frames.
  const lastFrame = Math.round(duration * fps);
  const keep = [];
  let outFrames = 0;
  for (const range of raw) {
    if (![range.start, range.end].every(Number.isFinite) || range.start < 0 || range.end > duration + 0.001 || range.end <= range.start) throw new Error('intervalo de corte inválido');
    const hasWord = words.some((w) => mostlyInside(w, range));
    if (range.end - range.start < p.minKeep && !hasWord) continue;
    const startFrame = Math.round(range.start * fps);
    const endFrame = Math.min(Math.round(range.end * fps), lastFrame);
    if (endFrame - startFrame < 2) continue;
    const previous = keep.at(-1);
    if (!selections && previous && startFrame <= previous.end_frame) {
      // O arredondamento colou dois trechos: viram um só.
      outFrames += endFrame - previous.end_frame;
      previous.end_frame = endFrame;
      previous.end = round(endFrame / fps, 4);
      continue;
    }
    keep.push({
      ...(range.id ? { segment_id: range.id } : {}),
      start: round(startFrame / fps, 4),
      end: round(endFrame / fps, 4),
      start_frame: startFrame,
      end_frame: endFrame,
      out_start: round(outFrames / fps, 4),
    });
    outFrames += endFrame - startFrame;
  }
  return { fps, keep, edited_duration: round(outFrames / fps, 4), source_duration: duration };
}

/** Leva as palavras para a linha do tempo do vídeo cortado. Palavras removidas somem. */
export function retimeWords(words, keep) {
  const out = [];
  for (const range of keep) for (const word of words.filter((w) => mostlyInside(w, range))) {
    const length = range.end - range.start;
    out.push({
      i: out.length,
      text: word.text,
      start: round(range.out_start + clamp(word.start - range.start, 0, length)),
      end: round(range.out_start + clamp(word.end - range.start, 0, length)),
      source_i: word.i,
      source_start: word.start,
      source_end: word.end,
      segment_id: range.segment_id ?? null,
      ...(word.confidence !== undefined ? { confidence: word.confidence } : {}),
      ...(word.speaker_id !== undefined ? { speaker_id: word.speaker_id } : {}),
    });
  }
  return out;
}

/** Tempo no vídeo cortado correspondente a um tempo do bruto, ou null se foi removido. */
export function toEditedTime(time, keep) {
  const range = keep.find((k) => time >= k.start && time < k.end);
  return range ? round(range.out_start + time - range.start) : null;
}

/**
 * Filtergraph do ffmpeg que faz o corte e a normalização numa única codificação.
 * Depois de `fps`, cada quadro tem pts n/fps, e o `trim` arredonda seus tempos para essa
 * mesma grade. Por isso os limites são passados exatamente em múltiplos de 1/fps: qualquer
 * folga de meio quadro cai no ponto de arredondamento e inclui um quadro a mais.
 */
export function buildCutFilter({ keep, fps, post, fade = 0.008, duration, audioOffset = 0 }) {
  const n = keep.length;
  const lines = [];
  const labels = (prefix) => keep.map((_, i) => `[${prefix}${i}]`).join('');
  duration ??= Math.max(...keep.map((k) => k.end));
  lines.push(`[0:v]setpts=PTS-STARTPTS,fps=${fps}:start_time=0,tpad=stop_mode=clone:stop_duration=1,trim=end_frame=${Math.round(duration * fps)},split=${n}${labels('vs')};`);
  lines.push(`[0:a]${audioTimelineFilter({ offset: audioOffset, duration })},asplit=${n}${labels('as')};`);
  keep.forEach((k, i) => {
    const vStart = (k.start_frame / fps).toFixed(6);
    const vEnd = (k.end_frame / fps).toFixed(6);
    const length = (k.end_frame - k.start_frame) / fps;
    lines.push(`[vs${i}]trim=start_frame=${k.start_frame}:end_frame=${k.end_frame},setpts=PTS-STARTPTS[v${i}];`);
    lines.push(
      `[as${i}]atrim=start_sample=${Math.round(k.start_frame / fps * 48000)}:end_sample=${Math.round(k.end_frame / fps * 48000)},asetpts=PTS-STARTPTS,` +
        `afade=t=in:st=0:d=${fade},afade=t=out:st=${Math.max(0, length - fade).toFixed(5)}:d=${fade}[a${i}];`,
    );
  });
  lines.push(`${keep.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${n}:v=1:a=1[vc][a];`);
  lines.push(`[vc]${post}[v]`);
  return lines.join('\n');
}

/**
 * Cadeia de filtros que leva a imagem ao tamanho final e, se a fonte for HDR,
 * converte para SDR (BT.709). Sem isso, HLG/PQ de celular sai lavado.
 */
export function buildPostChain({ source, width, height, tonemap = 'hable' }) {
  const scale = Math.max(width / source.width, height / source.height);
  const even = (value) => Math.ceil(value / 2) * 2;
  const w = Math.max(width, even(source.width * scale));
  const h = Math.max(height, even(source.height * scale));
  const crop = `crop=${width}:${height}`;
  if (!source.hdr) return `scale=${w}:${h}:flags=lanczos,${crop},format=yuv420p,setsar=1`;
  return [
    `zscale=w=${w}:h=${h}:filter=lanczos:t=linear:npl=100`,
    'format=gbrpf32le',
    'zscale=p=bt709',
    `tonemap=tonemap=${tonemap}:desat=0`,
    'zscale=t=bt709:m=bt709:r=tv',
    'format=yuv420p',
    crop,
    'setsar=1',
  ].join(',');
}
