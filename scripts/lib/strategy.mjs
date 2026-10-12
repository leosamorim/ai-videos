import { fail } from './util.mjs';

const goals = ['discovery', 'education', 'trust', 'community', 'conversion'];
const roles = ['hook', 'context', 'explanation', 'proof', 'payoff', 'cta'];
const actions = ['follow', 'save', 'share', 'comment', 'visit', 'contact', 'none', 'other'];
const text = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) fail(`strategy: preencha ${path}`);
};
const list = (value, path, min = 0) => {
  if (!Array.isArray(value) || value.length < min) fail(`strategy: ${path} precisa de uma lista com pelo menos ${min} item(ns)`);
  return value;
};
const choice = (value, allowed, path) => {
  if (!allowed.includes(value)) fail(`strategy: ${path} deve ser ${allowed.join(' | ')}`);
};
const uniqueIds = (items, path) => {
  const ids = new Set();
  for (const item of items) {
    if (!/^[A-Za-z][\w-]*$/.test(item?.id ?? '') || ids.has(item.id)) fail(`strategy: ids inválidos ou repetidos em ${path}`);
    ids.add(item.id);
  }
  return ids;
};

/** Incomplete on purpose: an initializer cannot infer audience, evidence or a promise. */
export function strategyTemplate() {
  return {
    schema: 1, objective: '', business_outcome: '',
    audience: { who: '', situation: '', desired_change: '' },
    promise: '', payoff: '', hook: { spoken: '', visual: '', on_screen: '', why: '' },
    evidence: [], beats: [],
    cta: { action: 'none', copy: '', why: '' },
    platforms: [], assumptions: [], guardrails: [],
  };
}

/** Validates traceability, not truth, artistic quality or predicted reach. */
export function validateStrategy(strategy) {
  if (strategy?.schema !== 1) fail('strategy: schema deve ser 1');
  choice(strategy.objective, goals, 'objective');
  for (const key of ['business_outcome', 'promise', 'payoff']) text(strategy[key], key);
  for (const key of ['who', 'situation', 'desired_change']) text(strategy.audience?.[key], `audience.${key}`);
  text(strategy.hook?.why, 'hook.why');
  for (const key of ['spoken', 'visual', 'on_screen']) {
    if (typeof strategy.hook?.[key] !== 'string') fail(`strategy: hook.${key} deve ser texto (vazio se não usado)`);
  }
  if (!['spoken', 'visual', 'on_screen'].some((key) => strategy.hook[key].trim())) fail('strategy: o gancho precisa de pelo menos um canal');
  const evidence = list(strategy.evidence, 'evidence', 1);
  const evidenceIds = uniqueIds(evidence, 'evidence');
  for (const item of evidence) {
    choice(item.kind, ['footage', 'reference', 'brief'], `evidence.${item.id}.kind`);
    text(item.source, `evidence.${item.id}.source`);
    text(item.observation, `evidence.${item.id}.observation`);
  }
  const beats = list(strategy.beats, 'beats', 1);
  uniqueIds(beats, 'beats');
  for (const beat of beats) {
    choice(beat.role, roles, `beats.${beat.id}.role`);
    text(beat.viewer_need, `beats.${beat.id}.viewer_need`);
    text(beat.decision, `beats.${beat.id}.decision`);
    for (const id of list(beat.evidence_ids, `beats.${beat.id}.evidence_ids`, 1)) {
      if (!evidenceIds.has(id)) fail(`strategy: evidência desconhecida ${id} no beat ${beat.id}`);
    }
  }
  for (const role of ['hook', 'payoff']) if (!beats.some((b) => b.role === role)) fail(`strategy: falta beat com role ${role}`);
  choice(strategy.cta?.action, actions, 'cta.action');
  text(strategy.cta.why, 'cta.why');
  if (strategy.cta.action !== 'none') {
    text(strategy.cta.copy, 'cta.copy');
    if (!beats.some((b) => b.role === 'cta')) fail('strategy: CTA escolhido precisa de um beat cta');
  }
  const platforms = list(strategy.platforms, 'platforms', 1);
  const names = new Set();
  for (const item of platforms) {
    choice(item?.platform, ['instagram', 'tiktok', 'youtube-shorts', 'other'], 'platforms.platform');
    if (names.has(item.platform)) fail(`strategy: plataforma repetida ${item.platform}`);
    names.add(item.platform);
    text(item.discovery, `${item.platform}.discovery`);
    text(item.adaptation, `${item.platform}.adaptation`);
    for (const key of ['name', 'definition', 'denominator', 'window']) text(item.primary_metric?.[key], `${item.platform}.primary_metric.${key}`);
  }
  for (const item of list(strategy.assumptions, 'assumptions')) text(item, 'assumptions[]');
  for (const item of list(strategy.guardrails, 'guardrails', 1)) text(item, 'guardrails[]');
  return strategy;
}

/** Every promised function survives into an actual timed portion of the edit.
 * Beats are annotations: they require neither cuts nor generated graphics. */
export function validateStrategyBoard(strategy, board) {
  validateStrategy(strategy);
  const timed = new Map((board.beats ?? []).map((beat) => [beat.id, beat]));
  const expected = new Set(strategy.beats.map((beat) => beat.id));
  for (const id of expected) if (!timed.has(id)) fail(`strategy: beat ${id} sem tempo no storyboard; confira o que sobreviveu ao corte`);
  for (const id of timed.keys()) if (!expected.has(id)) fail(`strategy: beat ${id} do storyboard não pertence à estratégia`);
  for (const item of [...(board.cards ?? []), ...(board.reframes ?? [])]) {
    const beat = timed.get(item.beat_id);
    if (!beat) fail(`strategy: ${item.id} precisa de beat_id válido para justificar o elemento`);
    if (item.end <= beat.start || item.start >= beat.end) fail(`strategy: ${item.id} não coincide com seu beat ${beat.id}`);
  }
  return board;
}
