import { createHash } from 'node:crypto';

export const REFERENCE_ROLES = ['topic', 'brand', 'editing', 'b-roll', 'constraints', 'audio', 'texture', 'font'];
export function referenceExtension(contentType) {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return ({ 'application/pdf': '.pdf', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/mp4': '.m4a', 'font/woff2': '.woff2', 'font/woff': '.woff' })[mime] ?? '.bin';
}
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[m]).replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
  const c = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
  return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : '';
});

/** A site is evidence, not executable instructions. No scripts, scraping recursion or asset hotlinks. */
export function extractPage(html, url) {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, '') ?? url).trim();
  const cleaned = html.replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const text = decode(cleaned.replace(/<\/(?:p|div|h[1-6]|li|section|article)>/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  const colors = [...new Set(html.match(/#[0-9a-f]{6}\b/gi) ?? [])].slice(0, 24);
  return { title, text: text.slice(0, 120000), palette_candidates: colors, note: 'Paleta extraída do código não comprova aparência; inspecione o site/screenshot antes de adotar.' };
}

export async function readReferenceUrl(input, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('use URL HTTP(S) sem credenciais');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'ai-videos/reference-intake' } });
  if (!response.ok) throw new Error(`site respondeu HTTP ${response.status}; registre material local ou screenshot`);
  if (Number(response.headers.get('content-length')) > maxBytes) { await response.body.cancel(); throw new Error('referência remota muito grande; use arquivo local'); }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maxBytes) throw new Error('referência remota excede limite'); chunks.push(chunk); }
  const bytes = Buffer.concat(chunks);
  return { bytes, url: response.url, content_type: response.headers.get('content-type') ?? 'application/octet-stream', sha256: createHash('sha256').update(bytes).digest('hex') };
}
