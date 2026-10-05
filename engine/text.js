// Text layout: *accent* runs, word wrapping, and per-word positions so text
// can be revealed by line, by character or word by word.

const HAN = /\p{Script=Han}/u;
const CJK_PIECE = /\*|[「『（《〈“‘]*\p{Script=Han}[，。！？、；：」』）》〉”’…]*|[^\s*\p{Script=Han}]+/gu;

// "Every site has an *address*" -> words with an accent flag.
export function parseRich(str) {
  const words = [];
  let accent = false;
  const paragraphs = String(str).split('\n');
  paragraphs.forEach((para, pi) => {
    const tokens = para.split(/(\s+)/).filter((t) => t.length && !/^\s+$/.test(t));
    for (let tok of tokens) {
      // Chinese has no spaces: every Han character is its own word, so lines
      // can wrap between characters and reveals go character by character.
      // Punctuation stays with its character, so no line starts with "，".
      if (HAN.test(tok)) {
        (tok.match(CJK_PIECE) || []).forEach((piece, k) => {
          const prev = words[words.length - 1];
          if (piece === '*') accent = !accent;
          else if (k > 0 && prev && !prev.br && /^[，。！？、；：」』）》〉”’…]+$/.test(piece)) prev.text += piece;
          else words.push({ text: piece, accent, tight: k > 0 });
        });
        continue;
      }
      let startAccent = accent;
      let endToggle = false;
      if (tok.startsWith('*') && tok.length > 1) {
        startAccent = !accent;
        tok = tok.slice(1);
      }
      if (tok.endsWith('*') && tok.length > 0) {
        tok = tok.slice(0, -1);
        endToggle = true;
      } else {
        const m = /^(.*?)\*([.,;:!?)"'’]*)$/.exec(tok);
        if (m) {
          tok = m[1] + m[2];
          endToggle = true;
        }
      }
      accent = startAccent;
      if (tok) words.push({ text: tok, accent });
      if (endToggle) accent = !accent;
    }
    if (pi < paragraphs.length - 1) words.push({ text: '\n', br: true });
  });
  return words;
}

// Returns { lines: [{ words: [{ text, accent, x, w, index }], width, y }], width, height, lineHeight, ascent }
// with x relative to the line start and y the baseline relative to the block top.
export function layoutText(ctx, { str, font, size, maxWidth = Infinity, lineHeight = 1.22 }) {
  ctx.save();
  ctx.font = font;
  const words = parseRich(str);
  const space = ctx.measureText(' ').width;
  const lines = [];
  let cur = { words: [], width: 0 };
  let index = 0;
  for (const w of words) {
    if (w.br) {
      lines.push(cur);
      cur = { words: [], width: 0 };
      continue;
    }
    const ww = ctx.measureText(w.text).width;
    const gap = w.tight ? 0 : space;
    const next = cur.words.length ? cur.width + gap + ww : ww;
    if (cur.words.length && next > maxWidth) {
      lines.push(cur);
      cur = { words: [], width: 0 };
    }
    const x = cur.words.length ? cur.width + gap : 0;
    cur.words.push({ text: w.text, accent: w.accent, x, w: ww, index: index++ });
    cur.width = x + ww;
  }
  lines.push(cur);
  const m = ctx.measureText('Hxgy');
  ctx.restore();
  const ascent = m.actualBoundingBoxAscent || size * 0.75;
  const descent = m.actualBoundingBoxDescent || size * 0.22;
  const lh = size * lineHeight;
  lines.forEach((l, i) => {
    l.y = ascent + i * lh;
  });
  const width = Math.max(0, ...lines.map((l) => l.width));
  const height = ascent + descent + (lines.length - 1) * lh;
  return { lines, width, height, lineHeight: lh, ascent, descent, count: index, space };
}

export function lineStartX(line, blockWidth, align) {
  if (align === 'left') return 0;
  if (align === 'right') return blockWidth - line.width;
  return (blockWidth - line.width) / 2;
}
