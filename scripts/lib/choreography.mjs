import { fail, round } from './util.mjs';

const idPattern = /^[A-Za-z][\w-]*$/;
const modes = ['performance', 'explanation', 'motion'];
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value, name) => {
  if (value !== undefined && !Array.isArray(value)) fail(`${name}: informe uma lista`);
  return value ?? [];
};

/** Optional direction, reading windows and shared events; all use the edited clock. */
export function compileChoreography(board, resolveWord, ids) {
  const items = [...board.beats, ...board.cards, ...board.reframes, ...board.caption_zones];
  const byId = new Map(items.map((item) => [item.id, item]));
  const claim = (id) => {
    if (!idPattern.test(id ?? '') || ids.has(id)) fail(`coreografia: id inválido ou duplicado: ${id}`);
    ids.add(id);
  };
  for (const item of items) {
    if (item.direction !== undefined) {
      const d = item.direction;
      if (!d || !modes.includes(d.mode) || !text(d.focus) || !text(d.takeaway)) fail(`${item.id}: direction precisa de mode, focus e takeaway`);
      if (d.order !== undefined && (!Array.isArray(d.order) || !d.order.length || !d.order.every(text))) fail(`${item.id}: direction.order precisa de etapas de atenção`);
    }
    const readIds = new Set();
    if (item.reads !== undefined) item.reads = list(item.reads, `${item.id}.reads`).map((read) => {
      if (!read || !idPattern.test(read.id ?? '') || readIds.has(read.id) || !text(read.text)) fail(`${item.id}: leitura precisa de id único e text`);
      readIds.add(read.id);
      if (![read.from, read.to].every(Number.isFinite) || read.from < 0 || read.to <= read.from || read.to > item.end - item.start + 0.001) fail(`${item.id}/${read.id}: janela de leitura fora do elemento`);
      for (const key of ['min_hold', 'max_cps']) if (read[key] !== undefined && (!Number.isFinite(read[key]) || read[key] <= 0)) fail(`${item.id}/${read.id}: ${key} precisa ser positivo`);
      return { ...read, start: item.start + read.from, end: item.start + read.to };
    });
  }
  board.events = list(board.events, 'events').map((event) => {
    if (!event) fail('evento inválido');
    claim(event.id);
    if (!text(event.purpose)) fail(`${event.id}: explique o propósito do evento`);
    if (['time', 'anchor', 'at'].filter((k) => event[k] !== undefined).length !== 1) fail(`${event.id}: use exatamente um de time, anchor ou at`);
    let time;
    if (event.anchor !== undefined) {
      if (!event.anchor || Object.keys(event.anchor).some((k) => !['source_word', 'segment_id', 'offset'].includes(k))) fail(`${event.id}: evento pontual aceita source_word, segment_id e offset`);
      time = resolveWord(event.anchor);
    } else if (event.at !== undefined) {
      const item = byId.get(event.at?.item_id), offset = event.at?.offset ?? 0;
      if (!item || !Number.isFinite(offset) || offset < 0 || offset > item.end - item.start + 0.001) fail(`${event.id}: at precisa de item_id existente e offset dentro do elemento`);
      time = item.start + offset;
    } else time = event.time;
    if (!Number.isFinite(time) || time < 0 || time > board.duration) fail(`${event.id}: evento fora da timeline`);
    return { ...event, time };
  });
  const events = new Map(board.events.map((event) => [event.id, event]));
  board.sound_cues = list(board.sound_cues, 'sound_cues').map((cue) => {
    if (!cue) fail('sound_cue inválido');
    claim(cue.id);
    claim(`sfx-${cue.id}`); // Also reserve the generated HTML id.
    const event = events.get(cue.event_id);
    if (!event) fail(`${cue.id}: event_id ausente ou desconhecido`);
    const { duration, attack, volume } = cue, offset = cue.offset ?? 0;
    if (![duration, attack, volume, offset].every(Number.isFinite) || duration <= 0 || attack < 0 || attack >= duration || volume < 0 || volume > 3.98) fail(`${cue.id}: duration, attack e volume explícitos e válidos são necessários`);
    if (cue.playback_rate !== undefined || cue.media_start !== undefined) fail(`${cue.id}: congele trim/retime no asset e meça seu ataque novamente`);
    if (typeof cue.asset !== 'string' || !/^assets\/(?:[\w-]+\/)*[\w.-]+\.(?:wav|mp3|m4a|aac|ogg|flac)$/i.test(cue.asset)) fail(`${cue.id}: asset precisa ser áudio local dentro de assets/ (nome simples)`);
    const start = event.time + offset - attack, end = start + duration;
    if (start < 0 || end > board.duration + 0.001) fail(`${cue.id}: áudio ultrapassa a timeline; ajuste o asset/evento, sem truncar o ataque`);
    return { ...cue, offset, start, end, hit: event.time + offset };
  });
  return board;
}

/** Declared reading budget, not a DOM/occlusion or perceptual approval. */
export function auditGraphicReading(board) {
  const items = [...board.beats, ...board.cards, ...board.reframes, ...board.caption_zones];
  const blocks = items.flatMap((item) => (item.reads ?? []).map((read) => {
    const hold = read.end - read.start;
    const characters = [...read.text.trim()].length;
    const cps = characters / hold;
    const warnings = [];
    if (read.min_hold !== undefined && hold + 0.001 < read.min_hold) warnings.push('hold_below_declared_minimum');
    if (read.max_cps !== undefined && cps > read.max_cps) warnings.push('above_declared_reading_speed');
    return { item_id: item.id, ...read, hold: round(hold), characters, cps: round(cps), warnings, status: warnings.length ? 'needs-review' : 'declared-only' };
  }));
  return { schema: 1, advisory: true, method: 'declared-stable-windows', status: blocks.some((b) => b.warnings.length) ? 'needs-review' : blocks.length ? 'declared-only' : 'not-checked',
    limitations: 'Não mede fonte, contraste, opacidade, oclusão ou texto realmente completo. Conferir no render; ausência de alerta não é aprovação.',
    unchecked_cards: board.cards.filter((c) => !c.reads?.length).map((c) => c.id), blocks };
}

const startMarker = '<!-- EVENT-SOUNDS:START -->';
const endMarker = '<!-- EVENT-SOUNDS:END -->';
export function soundCueMarkup(board) {
  return `${startMarker}\n${board.sound_cues.map((cue, i) => `      <audio id="sfx-${cue.id}" src="${cue.asset}" data-start="${cue.start}" data-duration="${cue.duration}" data-volume="${cue.volume}" data-track-index="${20 + i}"></audio>`).join('\n')}\n      ${endMarker}`;
}

/** Replace only our managed region; preserve all authored audio and graphics. */
export function syncSoundCueMarkup(html, board) {
  const block = soundCueMarkup(board);
  const start = html.indexOf(startMarker), end = html.indexOf(endMarker);
  if ((start === -1) !== (end === -1) || (start !== -1 && (end < start || html.indexOf(startMarker, start + 1) !== -1 || html.indexOf(endMarker, end + 1) !== -1))) fail('bloco EVENT-SOUNDS incompleto/duplicado; restaure os delimitadores');
  if (start !== -1) return html.slice(0, start) + block + html.slice(end + endMarker.length);
  if (!board.sound_cues.length) return html;
  const root = /<[^>]+\bid="root"[^>]*>/;
  if (!root.test(html)) fail('EVENT-SOUNDS: composição sem #root; use o template de compose');
  return html.replace(root, (tag) => `${tag}\n      ${block}`);
}
