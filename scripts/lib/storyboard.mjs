import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, fail } from './util.mjs';
import { compileChoreography } from './choreography.mjs';

/** Famílias com arquivo local declarado em brand/fonts/fonts.json. */
export function localFontFamilies() {
  const manifest = join(ROOT, 'brand/fonts/fonts.json');
  if (!existsSync(manifest)) return ['Inter'];
  return [...new Set(JSON.parse(readFileSync(manifest, 'utf8')).map((font) => font.family))];
}

export function resolveAnchor(anchor, words) {
  const matches = words.filter((w) => w.source_i === anchor.source_word && (!anchor.segment_id || w.segment_id === anchor.segment_id));
  if (matches.length !== 1) fail(`âncora ${anchor.source_word}: palavra removida ou repetida; informe segment_id e revise o storyboard`);
  const first = matches[0];
  const last = anchor.end_source_word === undefined ? first : words.find((w) => w.source_i === anchor.end_source_word && w.segment_id === first.segment_id);
  if (!last || last.end < first.start) fail('fim da âncora não pertence ao mesmo trecho');
  const start = first.start + (anchor.offset ?? 0);
  return { start, end: anchor.duration !== undefined ? start + anchor.duration : last.end + (anchor.tail ?? 0.4) };
}

export function compileStoryboard(board, words, duration) {
  const ids = new Set();
  const compile = (item) => {
    if (!/^[A-Za-z][\w-]*$/.test(item.id ?? '') || ids.has(item.id)) fail('storyboard: ids precisam ser únicos e válidos para HTML');
    ids.add(item.id);
    const span = item.anchor ? resolveAnchor(item.anchor, words) : { start: item.start, end: item.end };
    if (![span.start, span.end].every(Number.isFinite) || span.start < 0 || span.end > duration + 0.001 || span.end <= span.start) fail(`storyboard ${item.id}: tempos inválidos`);
    if (!item.purpose?.trim()) fail(`storyboard ${item.id}: explique o propósito visual`);
    return { ...item, ...span };
  };
  const result = { ...board, duration, beats: (board.beats ?? []).map(compile), cards: (board.cards ?? []).map(compile), reframes: (board.reframes ?? []).map(compile), caption_zones: (board.caption_zones ?? []).map(compile) };
  for (const r of result.reframes) if (!(r.scale >= 1 && r.scale <= 3) || ![r.x ?? 0, r.y ?? 0].every(Number.isFinite)) fail(`${r.id}: reframe precisa de scale 1–3 e x/y numéricos`);
  for (const z of result.caption_zones) if (!z.hidden && !Number.isFinite(z.y)) fail(`${z.id}: zona precisa de y ou hidden:true`);
  return compileChoreography(result, (anchor) => resolveAnchor({ ...anchor, duration: 0 }, words).start, ids);
}

export function reframeScript(board) {
  const commands = [];
  let previousEnd = -1;
  for (const r of [...board.reframes].sort((a, b) => a.start - b.start)) {
    if (r.start < previousEnd) fail('reenquadramentos se sobrepõem');
    previousEnd = r.end;
    const easeTime = Math.min(r.transition ?? 0.2, (r.end - r.start) / 2);
    commands.push(`tl.to('#video-wrap', ${JSON.stringify({ scale: r.scale, x: r.x ?? 0, y: r.y ?? 0, duration: easeTime, ease: 'power2.inOut' })}, ${r.start});`);
    commands.push(`tl.to('#video-wrap', {scale:1,x:0,y:0,duration:${easeTime},ease:'power2.inOut'}, ${r.end - easeTime});`);
  }
  return `// Generated from storyboard.json; times use edited speech.\nwindow.applyEditorialReframes = function(tl) {\n${commands.join('\n')}\n};\n`;
}

export const DEFAULT_THEME = {
  name: 'neutral', source_ids: [], palette: { bg: '#f5f3ef', surface: '#ffffff', text: '#252525', muted: '#606060', accent: '#355b50', 'accent-2': '#314a67', positive: '#28654c', negative: '#a33838' },
  fontFamily: 'Inter', safe: { top: 0.10, bottom: 0.18, left: 0.06, right: 0.12 },
  captions: { uppercase: false, fontWeight: 600, fontSize: 64, maxWords: 6, maxChars: 36, pop: false, highlight: '#FFFFFF' },
};

export function themeCss(theme = {}, format) {
  const t = { ...DEFAULT_THEME, ...theme, palette: { ...DEFAULT_THEME.palette, ...theme.palette }, safe: { ...DEFAULT_THEME.safe, ...theme.safe } };
  const families = localFontFamilies();
  if (!families.includes(t.fontFamily)) fail(`theme.fontFamily precisa ter uma fonte local declarada em brand/fonts/fonts.json (${families.join(', ')})`);
  const tokens = [];
  for (const [key, value] of Object.entries(t.palette)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key) || !/^#[0-9a-f]{6}$/i.test(value)) fail(`cor inválida no tema: ${key}`);
    tokens.push(`--${key}: ${value};`);
  }
  for (const [side, fraction] of Object.entries(t.safe)) {
    if (!['top', 'bottom', 'left', 'right'].includes(side) || !(fraction >= 0 && fraction < 0.5)) fail('margem segura inválida');
    tokens.push(`--safe-${side}: ${Math.round(fraction * (['top', 'bottom'].includes(side) ? format.height : format.width))}px;`);
  }
  return `:root { ${tokens.join(' ')} --font-family: "${t.fontFamily}"; --radius: 16px; }`;
}
