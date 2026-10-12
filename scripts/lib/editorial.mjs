import { digest, fileHash } from './fingerprint.mjs';
import { isAbsolute, join } from 'node:path';
import { ROOT } from './util.mjs';

export function sourceSignature(project) {
  return digest({ source: fileHash(join(project.dir, project.data.source.file)), transcript: fileHash(join(project.paths.transcript, 'transcript.raw.json')) });
}

const intersects = (a, b) => a.start < b.end && b.start < a.end;
const norm = (s) => s.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N} ]/gu, '');

/** Suggestions only. Silence, repetition and gaze never prove off-performance on their own. */
export function candidateWindows(words, duration) {
  const windows = [];
  if (words[0]?.start > 0.4) windows.push({ start: 0, end: words[0].start, cue: 'pre-roll: verificar preparação ou abertura visual intencional' });
  for (let i = 1; i < words.length; i++) {
    if (words[i].start - words[i - 1].end > 0.6) windows.push({ start: Math.max(0, words[i - 1].end - 0.3), end: Math.min(duration, words[i].start + 0.3), cue: 'pausa: distinguir respiração, demonstração, preparação e retomada' });
  }
  const starts = new Map();
  for (let i = 0; i <= words.length - 5; i++) {
    const key = norm(words.slice(i, i + 5).map((w) => w.text).join(' '));
    const previous = starts.get(key);
    if (previous !== undefined && words[i].start - words[previous].start > 3) windows.push({ start: Math.max(0, words[i].start - 0.5), end: Math.min(duration, words[Math.min(i + 10, words.length - 1)].end + 0.4), cue: 'possível retomada; comparar completude e entrega, sem preferir automaticamente a última', alternate_start: words[previous].start });
    starts.set(key, i);
  }
  if (words.at(-1)?.end < duration - 0.4) windows.push({ start: words.at(-1).end, end: duration, cue: 'post-roll: verificar fim da atuação e fechamento intencional' });
  return windows.filter((w, i, all) => !all.slice(0, i).some((p) => Math.abs(p.start - w.start) < 0.5)).sort((a, b) => a.start - b.start);
}

export function emptyEditPlan(signature, duration) {
  return { schema: 2, source_signature: signature, reviewer: '', intent: '',
    review: { transcript_reviewed: false, visual_reviewed: false, visual_method: '', observations: [], uncertainties: [] },
    segments: [], discarded: [], protected: [],
    candidates: [{ start: 0, end: duration, decision: 'review', reason: 'selecionar takes após ler a fala e examinar o vídeo' }] };
}

/** Ordered keeps + explicit removals cover the source. Reordering does not lose word provenance. */
export function validateEditPlan(plan, evidence, words, duration, signature) {
  const errors = [];
  const add = (condition, message) => { if (!condition) errors.push(message); };
  add(plan.schema === 2, 'edit-plan precisa de schema 2');
  add(plan.source_signature === signature && evidence.source_signature === signature, 'evidências/plano desatualizados: rode analyze e revise');
  add(Boolean(plan.reviewer?.trim()), 'informe reviewer (pessoa ou agente que examinou as evidências)');
  add(plan.review?.transcript_reviewed === true && plan.review?.visual_reviewed === true, 'revisão da fala e do vídeo ainda não concluída');
  add(['playback', 'frames', 'multimodal-video'].includes(plan.review?.visual_method), 'declare visual_method: playback | frames | multimodal-video');
  add(Array.isArray(plan.review?.uncertainties) && plan.review.uncertainties.length === 0, 'resolva as incertezas; na dúvida preserve o trecho');
  add(Array.isArray(plan.segments) && plan.segments.length > 0, 'selecione ao menos um trecho');
  const observations = new Map((plan.review?.observations ?? []).map((o) => [o.evidence_id, o]));
  const items = new Map((evidence.items ?? []).map((e) => [e.id, e]));
  for (const e of items.values()) if (e.type === 'contact-sheet') add(Boolean(observations.get(e.id)?.observation?.trim()), `falta examinar a cobertura geral: ${e.id}`);
  const selected = plan.segments ?? [];
  const removed = plan.discarded ?? [];
  const ids = new Set();
  for (const [kind, list] of [['manter', selected], ['remover', removed]]) for (const s of list) {
    const label = s.id ?? `${s.start}–${s.end}`;
    add(typeof s.id === 'string' && !ids.has(s.id), `${label}: id ausente/duplicado`); ids.add(s.id);
    add([s.start, s.end].every(Number.isFinite) && s.start >= 0 && s.end <= duration + 0.001 && s.end > s.start, `${label}: intervalo inválido`);
    add(Boolean(s.reason?.trim()), `${label}: explique a decisão de ${kind}`);
    add(s.decision !== 'review' && s.confidence !== 'low', `${label}: decisão ainda incerta`);
    const refs = (s.evidence_ids ?? []).map((id) => items.get(id));
    add(refs.length > 0 && refs.every(Boolean), `${label}: evidência ausente/desconhecida`);
    add(refs.some((e) => e && intersects(e, s)), `${label}: evidência fora do trecho`);
    for (const id of s.evidence_ids ?? []) add(Boolean(observations.get(id)?.observation?.trim()), `${label}: falta observação visual para ${id}`);
    if (kind === 'remover' && ['setup', 'off-performance', 'retake', 'post-roll'].includes(s.kind)) {
      add(refs.some((e) => e?.type === 'motion-clip' && e.start <= s.start + 0.25 && e.end >= s.end - 0.25), `${label}: descarte de atuação requer clip do intervalo (vid inspect)`);
    }
  }
  for (const a of selected) for (const b of removed) add(!intersects(a, b), `${a.id}/${b.id}: trecho mantido e removido ao mesmo tempo`);
  const intervals = [...selected, ...removed].filter((r) => [r.start, r.end].every(Number.isFinite)).sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const r of intervals) { add(r.start <= cursor + 0.04, `trecho sem decisão: ${cursor.toFixed(2)}–${r.start.toFixed(2)}`); cursor = Math.max(cursor, r.end); }
  add(cursor >= duration - 0.04, `fim sem decisão: ${cursor.toFixed(2)}–${duration.toFixed(2)}`);
  for (const p of plan.protected ?? []) add(selected.some((s) => s.start <= p.start && s.end >= p.end), 'trecho protegido foi removido ou fragmentado');
  for (const s of selected) for (const w of words) {
    if (!intersects(s, w)) continue;
    const clipped = Math.max(0, s.start - w.start) + Math.max(0, w.end - s.end);
    add(clipped <= 0.06, `${s.id}: borda corta a palavra ${w.i} (${w.text}); ajuste o intervalo ou corrija o alinhamento`);
  }
  return [...new Set(errors)];
}

export function evidenceFileErrors(evidence) {
  return (evidence.items ?? []).flatMap((e) => {
    if (!e.path || !e.sha256) return [`${e.id}: arquivo/hash de evidência ausente`];
    const path = isAbsolute(e.path) ? e.path : join(ROOT, e.path);
    const errors = fileHash(path) === e.sha256 ? [] : [`${e.id}: evidência foi removida ou alterada; regenere e revise`];
    for (const [sheet, hash] of Object.entries(e.sheet_hashes ?? {})) {
      if (fileHash(isAbsolute(sheet) ? sheet : join(ROOT, sheet)) !== hash) errors.push(`${e.id}: folha foi removida ou alterada; regenere e revise`);
    }
    return errors;
  });
}
