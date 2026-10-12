// Legendas sincronizadas por palavra, geradas como uma sub-composição do HyperFrames.
// O arquivo de saída é sempre regenerado a partir da transcrição e de captions.config.json;
// para mudar o estilo, edite o config e rode `vid captions`, não o HTML.
import { round } from './util.mjs';

export const CAPTION_DEFAULTS = {
  enabled: true,
  maxWords: 6,          // limite, não obrigação; preserve unidades semânticas
  maxChars: 36,
  pauseBreak: 0.35,     // pausa (s) que força um bloco novo
  hold: 0.3,            // quanto o bloco fica na tela depois da última palavra
  uppercase: false,
  stripPunctuation: false,
  y: 1290,              // centro vertical do bloco, em px (tela de 1920)
  maxWidth: 860,
  fontFamily: 'Inter',
  fontFile: 'assets/fonts/inter-latin-600-normal.woff2',
  fontWeight: 600,
  fontSize: 64,
  color: '#FFFFFF',
  highlight: '#FFFFFF',
  outline: '#000000',
  outlineWidth: 3,
  pop: false,
  fontFaceWeight: null, // faixa de pesos do arquivo quando a fonte é variável, ex.: "100 900"
  letterSpacing: '-0.01em',
  plate: null,          // { color, radius, paddingX, paddingY, shadow }: placa atrás do texto
  singleLine: false,    // um bloco por linha, para a placa abraçar o texto (ajuste maxChars junto)
  upcomingOpacity: 1,   // < 1 deixa mais claras as palavras que ainda não foram ditas
  rise: false,          // bloco entra subindo alguns pixels, em vez de aparecer seco
  phraseStarts: [],     // source_i ou {source_i, segment_id}: início editorial de uma frase
  breakOnPunctuation: 'clause', // clause | sentence | none; listas podem ficar no mesmo bloco
  highlightMode: 'word', // word | selected | none; selected mantém só emphasis em destaque
  emphasis: [],         // mesmas referências de phraseStarts, nunca índices do texto cortado
  emphasisStyle: null,  // { fontFamily, fontFile, fontStyle, fontWeight, scale }: tipografia própria das palavras de emphasis
  textShadow: null,     // sombra CSS completa; substitui o contorno quando a legenda não tem placa
  underline: [],        // mesmas referências de emphasis: traço à mão sob a palavra, riscado quando ela é dita
  underlineStyle: null, // { color, thickness (em), duration (s) }
  entrance: null,       // 'role': bloco com palavra de emphasis estala, os outros sobem de leve; null usa pop/rise
  overrides: [],        // [{ from, to, y }] move as legendas; [{ from, to, hidden: true }] esconde
};

const BREAK_AFTER = /[.!?…,;:]["')\]]?$/;
/** Palavras que introduzem a seguinte e ficam feias sozinhas no fim de um bloco. */
const LINKING = /^(a|as|o|os|um|uma|uns|umas|de|do|da|dos|das|em|no|na|nos|nas|e|ou|que|se|por|pra|para|com|sem|ao|aos|à|às|meu|minha|meus|minhas|seu|sua|seus|suas|esse|essa|esses|essas|aquele|aquela|aqueles|aquelas|mais|bem|já|só|não)$/i;

function referencedWords(words, refs, field) {
  const selected = new Set();
  for (const ref of refs) {
    const id = typeof ref === 'number' ? ref : ref?.source_i;
    if (!Number.isInteger(id)) throw new Error(`${field}: source_i inválido`);
    const matches = words.filter((w) => w.source_i === id && (ref?.segment_id === undefined || w.segment_id === ref.segment_id));
    if (matches.length !== 1) throw new Error(`${field}: palavra ${id} removida ou ambígua; revise a referência/segment_id`);
    selected.add(matches[0]);
  }
  return selected;
}

/** Agrupa palavras em blocos curtos, quebrando em pontuação, pausa ou limite de tamanho. */
export function chunkWords(words, config = {}) {
  const cfg = { ...CAPTION_DEFAULTS, ...config };
  const starts = referencedWords(words, cfg.phraseStarts, 'phraseStarts');
  if (!['clause', 'sentence', 'none'].includes(cfg.breakOnPunctuation)) throw new Error('breakOnPunctuation: use clause, sentence ou none');
  const breaks = (text) => cfg.breakOnPunctuation === 'clause' ? BREAK_AFTER.test(text) : cfg.breakOnPunctuation === 'sentence' && /[.!?…]["')\]]?$/.test(text);
  const groups = [];
  let current = [];
  const length = (list) => list.map((w) => w.text).join(' ').length;
  for (const word of words) {
    const previous = current.at(-1);
    if (previous) {
      if (starts.has(word) || (previous.segment_id !== word.segment_id)) {
        groups.push(current);
        current = [];
      } else {
        const tooLong = current.length >= cfg.maxWords || length([...current, word]) > cfg.maxChars;
        const unit = /^\d+(?:[.,]\d+)?$/.test(previous.text) && /^(cm|mm|m|metros?|centímetros?|milímetros?|%|reais)[.,;:]?$/i.test(word.text);
        if ((tooLong && !unit) || word.start - previous.end >= cfg.pauseBreak || breaks(previous.text)) {
          // Quebra por tamanho: se houver palavra de ligação entre as três últimas do bloco, o bloco
          // termina antes dela e ela desce com o que introduz ("os meus projetos" / "de área de serviço").
          let carry = [];
          if (tooLong && !breaks(previous.text) && word.start - previous.end < cfg.pauseBreak) {
            let from = -1;
            for (let k = current.length - 1; k >= Math.max(1, current.length - 3); k--) if (LINKING.test(current[k].text)) { from = k; break; }
            while (from > 1 && LINKING.test(current[from - 1].text)) from--;
            // O que fica precisa se sustentar sozinho: duas palavras ou mais, sem terminar em ligação.
            const rest = from > 0 ? current.slice(0, from) : [];
            const standsAlone = rest.length >= 2 && length(rest) >= 8 && !LINKING.test(rest.at(-1).text);
            if (standsAlone && length([...current.slice(from), word]) <= cfg.maxChars) carry = current.splice(from);
          }
          groups.push(current);
          current = carry;
        }
      }
    }
    current.push(word);
  }
  if (current.length) groups.push(current);

  return groups.map((group, index) => {
    const start = group[0].start;
    const next = groups[index + 1]?.[0].start ?? Infinity;
    const end = Math.max(Math.min(group.at(-1).end + cfg.hold, next), Math.min(start + 0.2, next));
    return { start: round(start), end: round(end), words: group.map((w) => ({ ...w })) };
  });
}

/** Sinais para revisão, não uma nota automática de qualidade artística. */
export function auditCaptions(words, config = {}) {
  return chunkWords(words, config).map((chunk) => {
    const text = chunk.words.map((w) => w.text).join(' ');
    const duration = chunk.end - chunk.start;
    const cps = text.length / duration;
    return { start: chunk.start, end: chunk.end, text, chars_per_second: round(cps, 1),
      source_words: chunk.words.map((w) => w.source_i),
      flags: [...(duration < 0.65 ? ['short-block'] : []), ...(cps > 22 ? ['fast-reading'] : [])] };
  });
}

function display(text, cfg) {
  let out = text;
  if (cfg.stripPunctuation) out = out.replace(/^[“"'(¿¡—–-]+/, '').replace(/[.,;:"”')\]…]+$/, '');
  return cfg.uppercase ? out.toLocaleUpperCase('pt-BR') : out;
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Split at layout changes, including changes in the middle of a caption block. */
export function captionZones(chunks, zones = []) {
  return chunks.flatMap((chunk) => {
    const boundaries = [...new Set([chunk.start, chunk.end, ...zones.flatMap((z) => [z.from, z.to]).filter((t) => t > chunk.start && t < chunk.end)])].sort((a, b) => a - b);
    return boundaries.slice(0, -1).flatMap((start, i) => {
      const end = boundaries[i + 1];
      if (zones.some((z) => start >= z.from && start < z.to && z.hidden)) return [];
      return [{ ...chunk, start, end }];
    });
  });
}

/** Contorno feito com sombras em círculo: funciona igual em qualquer versão do Chrome. */
function outlineShadow(width, color) {
  const steps = 16;
  const shadows = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    shadows.push(`${(Math.cos(angle) * width).toFixed(2)}px ${(Math.sin(angle) * width).toFixed(2)}px 0 ${color}`);
  }
  shadows.push(`0 ${Math.round(width * 1.2)}px ${Math.round(width * 2.5)}px rgba(0,0,0,0.55)`);
  return shadows.join(', ');
}

/** HTML da sub-composição de legendas. `duration`, `width` e `height` vêm do corte. */
export function renderCaptions(words, config, { duration, width, height }) {
  const cfg = { ...CAPTION_DEFAULTS, ...config };
  if (!['word', 'selected', 'none'].includes(cfg.highlightMode)) throw new Error('highlightMode: use word, selected ou none');
  if (![null, 'role'].includes(cfg.entrance ?? null)) throw new Error("entrance: use 'role' ou null");
  const emphasized = referencedWords(words, cfg.emphasis, 'emphasis');
  const isEmphasized = (w) => words.some((original) => emphasized.has(original) && original.source_i === w.source_i && original.segment_id === w.segment_id);
  const underlined = referencedWords(words, cfg.underline, 'underline');
  const isUnderlined = (w) => words.some((original) => underlined.has(original) && original.source_i === w.source_i && original.segment_id === w.segment_id);
  const ul = { color: cfg.highlight, thickness: 0.085, duration: 0.26, ...cfg.underlineStyle };
  const override = (time) => cfg.overrides.find((o) => time >= o.from && time < o.to);
  const chunks = cfg.enabled ? captionZones(chunkWords(words, cfg), cfg.overrides) : [];
  const left = Math.round((width - cfg.maxWidth) / 2);
  const plate = cfg.plate
    ? { color: '#ffffff', radius: 24, paddingX: 32, paddingY: 18, shadow: '0 10px 30px rgba(0,0,0,0.18)', ...cfg.plate }
    : null;

  const em = cfg.emphasisStyle;
  const blocks = chunks.map((chunk, n) => {
    const y = override(chunk.start)?.y ?? cfg.y;
    const spans = chunk.words
      .map((w, k) => `<span class="cap-w" id="cap-${n}-w${k}"${isUnderlined(w) ? ' data-ul="1"' : ''}${cfg.highlightMode === 'selected' && isEmphasized(w) ? `${cfg.emphasisStyle ? ' data-em="1"' : ''} style="color:${cfg.highlight}"` : ''}>${escapeHtml(display(w.text, cfg))}${isUnderlined(w) ? `<span class="cap-ul"><span class="cap-ul-in" id="cap-${n}-u${k}"></span></span>` : ''}</span>`)
      .join('');
    return `      <div class="cap" id="cap-${n}" style="top:${y}px"><div class="cap-in" id="cap-${n}-in">${spans}</div></div>`;
  });

  // [início, fim, instante de cada palavra, índices das palavras sublinhadas, bloco tem palavra de emphasis]
  const data = chunks.map((chunk) => [chunk.start, chunk.end, chunk.words.map((w) => round(Math.max(w.start, chunk.start))),
    chunk.words.flatMap((w, k) => (isUnderlined(w) ? [k] : [])), chunk.words.some(isEmphasized) ? 1 : 0]);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <!-- GERADO por \`vid captions\`. Não edite: mude captions.config.json e gere de novo. -->
  </head>
  <body>
    <template>
      <style>
        @font-face {
          font-family: "${cfg.fontFamily}";
          src: url("${cfg.fontFile}") format("woff2");
          font-weight: ${cfg.fontFaceWeight ?? cfg.fontWeight};
          font-display: block;
        }
        #captions-root {
          position: absolute;
          inset: 0;
          pointer-events: none;
          font-family: "${cfg.fontFamily}", sans-serif;
        }
        #captions-root .cap {
          position: absolute;
          left: ${left}px;
          width: ${cfg.maxWidth}px;
          height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          /* Cada bloco nasce invisível; a timeline mostra e esconde no tempo exato. */
          visibility: hidden;
          opacity: 0;
        }
        #captions-root .cap-in {
          display: flex;
          flex-wrap: ${cfg.singleLine ? 'nowrap' : 'wrap'};
          justify-content: center;
          gap: 0 0.26em;
          ${plate ? `max-width: ${cfg.maxWidth}px;` : `width: ${cfg.maxWidth}px;`}
          font-size: ${cfg.fontSize}px;
          font-weight: ${cfg.fontWeight};
          line-height: 1.08;
          letter-spacing: ${cfg.letterSpacing};
          text-align: center;
          white-space: ${cfg.singleLine ? 'nowrap' : 'normal'};
          color: ${cfg.color};
          text-shadow: ${cfg.textShadow ?? (cfg.outlineWidth > 0 ? outlineShadow(cfg.outlineWidth, cfg.outline) : 'none')};
          align-items: baseline;
          ${plate ? `padding: ${plate.paddingY}px ${plate.paddingX}px; background: ${plate.color}; border-radius: ${plate.radius}px; box-shadow: ${plate.shadow};` : ''}
        }
        #captions-root .cap-w {
          display: inline-block;
          opacity: ${cfg.upcomingOpacity};
        }
        ${em ? `@font-face {
          font-family: "${em.fontFamily}";
          src: url("${em.fontFile}") format("woff2");
          font-weight: ${em.fontWeight ?? 700};
          font-style: ${em.fontStyle ?? 'normal'};
          font-display: block;
        }
        #captions-root .cap-w[data-em] {
          font-family: "${em.fontFamily}", serif;
          font-style: ${em.fontStyle ?? 'normal'};
          font-weight: ${em.fontWeight ?? 700};
          font-size: ${em.scale ?? 1}em;
          line-height: 1;
        }` : ''}
        ${underlined.size ? `#captions-root .cap-w[data-ul] {
          position: relative;
        }
        /* Traço de marcador: a inclinação fica no invólucro, a timeline só estica o miolo. */
        #captions-root .cap-ul {
          position: absolute;
          left: -3%;
          bottom: -0.1em;
          width: 106%;
          height: ${ul.thickness}em;
          transform: rotate(-1.4deg);
        }
        #captions-root .cap-ul-in {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 60% 40% 55% 45% / 100%;
          background: ${ul.color};
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        }` : ''}
      </style>

      <div id="captions-root" data-composition-id="captions" data-track-kind="captions" data-width="${width}" data-height="${height}">
${blocks.join('\n')}
      </div>

      <script>
        (function () {
          var DATA = ${JSON.stringify(data)};
          var tl = gsap.timeline({ paused: true });
          DATA.forEach(function (chunk, n) {
            var group = "#cap-" + n;
            var start = chunk[0];
            var end = chunk[1];
            var onsets = chunk[2];
            tl.set(group, { visibility: "visible", opacity: 1 }, start);
            ${cfg.entrance === 'role' ? `if (chunk[4]) tl.fromTo(group + "-in", { scale: 0.84, y: 0, opacity: 1 }, { scale: 1, duration: 0.14, ease: "back.out(2)" }, start);
            else tl.fromTo(group + "-in", { y: 12, opacity: 0, scale: 1 }, { y: 0, opacity: 1, duration: 0.14, ease: "power2.out" }, start);` : `${cfg.pop ? `tl.fromTo(group + "-in", { scale: 0.86 }, { scale: 1, duration: 0.1, ease: "back.out(1.8)" }, start);` : ''}
            ${cfg.rise ? `tl.fromTo(group + "-in", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.16, ease: "power2.out" }, start);` : ''}`}
            chunk[3].forEach(function (k) {
              tl.fromTo(group + "-u" + k, { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: ${ul.duration}, ease: "power2.out" }, onsets[k] + 0.06);
            });
            onsets.forEach(function (time, k) {
              var word = group + "-w" + k;
              ${cfg.upcomingOpacity < 1 ? 'tl.set(word, { opacity: 1 }, time);' : ''}
              ${cfg.highlightMode === 'word' ? `tl.set(word, { color: "${cfg.highlight}" }, time);
              if (k < onsets.length - 1) tl.set(word, { color: "${cfg.color}" }, onsets[k + 1]);` : ''}
            });
            // Saída garantida: sem isto um bloco pode reaparecer ao voltar na timeline.
            tl.set(group, { opacity: 0, visibility: "hidden" }, end);
          });
          tl.set({}, {}, ${duration});
          window.__timelines = window.__timelines || {};
          window.__timelines["captions"] = tl;
        })();
      </script>
    </template>
  </body>
</html>
`;
}
