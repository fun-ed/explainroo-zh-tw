// Burned-in captions built from the narration's word timings. The current
// phrase is shown; words light up as they are spoken.
import { fontString } from './themes.js';
import { clamp, ease } from './util.js';

const HAN = /\p{Script=Han}/u;
// Chinese characters are about twice as wide as Latin letters.
const visualLength = (str) => [...str].reduce((n, c) => n + (HAN.test(c) || /[，。！？、；：「」『』（）]/.test(c) ? 2 : 1), 0);

// Taiwanese subtitles leave out commas and full stops and use a space instead.
function captionText(text) {
  const m = /^(.*?)([，、；。]+)$/.exec(text);
  return m && HAN.test(m[1]) ? { text: m[1], gapAfter: true } : { text, gapAfter: false };
}

export function buildPhrases(timeline, maxChars) {
  const phrases = [];
  for (const sc of timeline.scenes) {
    let cur = null;
    const flush = () => {
      if (cur && cur.words.length) phrases.push(cur);
      cur = null;
    };
    sc.words.forEach((w, i) => {
      const g = { text: w.text, start: sc.start + w.start, end: sc.start + w.end, space: w.space !== false, sent: w.sent ?? 0 };
      if (cur) {
        const len = cur.words.reduce((n, x) => n + visualLength(x.text) + (x.space ? 1 : 0), 0) + visualLength(g.text);
        const gapBefore = g.start - cur.words[cur.words.length - 1].end;
        if (len > maxChars || gapBefore > 0.55) flush();
      }
      if (!cur) cur = { words: [], start: g.start, en: sc.subs?.[g.sent] || null };
      cur.words.push(g);
      cur.end = g.end;
      if (/[.!?;:。！？；：]["'’)」』）]*$/.test(g.text) || (/,$/.test(g.text) && cur.words.length >= 4) || (/[，、]$/.test(g.text) && visualLength(cur.words.map((x) => x.text).join('')) >= 16)) flush();
    });
    flush();
  }
  phrases.forEach((p, i) => {
    const next = phrases[i + 1];
    p.until = next ? Math.min(next.start, p.end + 0.9) : p.end + 0.9;
  });
  return phrases;
}

// `area` ({ cx, bottom, maxWidth }) places the captions inside a platform's
// safe area, right above the band the app covers with its own text.
export function drawCaptions(ctx, phrases, T, theme, W, H, area = null) {
  const ph = phrases.find((p) => T >= p.start - 0.08 && T < p.until);
  if (!ph) return;
  const vertical = H > W;
  const size = vertical ? 58 : 44;
  const font = fontString(theme, 'body', size, theme.fonts.body.family === 'Inter' ? 600 : undefined);
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const space = ctx.measureText(' ').width;
  // Chinese words carry no space before them; a dropped comma leaves one.
  const shown = ph.words.map((w) => captionText(w.text));
  const texts = shown.map((x) => x.text);
  const gaps = ph.words.map((w, i) => (i === 0 ? 0 : w.space || shown[i - 1].gapAfter ? space : 0));
  const widths = texts.map((t) => ctx.measureText(t).width);
  const maxLine = area ? area.maxWidth - size * 1.1 : W * (vertical ? 0.8 : 0.7);
  const lines = [[]];
  let lw = 0;
  ph.words.forEach((w, i) => {
    const add = (lines[lines.length - 1].length ? gaps[i] : 0) + widths[i];
    if (lw + add > maxLine && lines[lines.length - 1].length) {
      lines.push([]);
      lw = 0;
    }
    lines[lines.length - 1].push(i);
    lw += (lines[lines.length - 1].length > 1 ? gaps[i] : 0) + widths[i];
  });
  const lineWidth = (l) => l.reduce((a, i, k) => a + widths[i] + (k ? gaps[i] : 0), 0);
  const lh = size * 1.3;
  // An [en: ...] line under the Chinese one, shrunk to fit on one line.
  let enSize = Math.round(size * 0.72);
  let enFont = fontString(theme, 'body', enSize);
  if (ph.en) {
    ctx.font = enFont;
    const w = ctx.measureText(ph.en).width;
    if (w > maxLine) {
      enSize = Math.max(22, Math.floor((enSize * maxLine) / w));
      enFont = fontString(theme, 'body', enSize);
      ctx.font = enFont;
    }
    ctx.font = font;
  }
  const enW = ph.en ? (ctx.font = enFont, ctx.measureText(ph.en).width) : 0;
  ctx.font = font;
  const enH = ph.en ? enSize * 1.3 : 0;
  const boxW = Math.max(enW, ...lines.map(lineWidth)) + size * 1.1;
  const boxH = lines.length * lh + enH + size * 0.55;
  const cx = area ? area.cx : W / 2;
  const cy = area ? area.bottom - boxH / 2 : vertical ? H * 0.74 : H - Math.max(96, H * 0.1) - boxH / 2 + lh / 2;
  const fadeIn = ease.out(clamp((T - (ph.start - 0.08)) / 0.15));
  const fadeOut = 1 - clamp((T - (ph.until - 0.15)) / 0.15);
  ctx.globalAlpha = Math.min(fadeIn, fadeOut);
  ctx.fillStyle = theme.caption.bg;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, Math.min(22, boxH / 2));
  ctx.fill();
  lines.forEach((l, li) => {
    let x = cx - lineWidth(l) / 2;
    const y = cy - boxH / 2 + size * 0.275 + lh * li + lh / 2;
    l.forEach((i, k) => {
      if (k) x += gaps[i];
      const w = ph.words[i];
      ctx.fillStyle = T >= w.start ? theme.caption.active : theme.caption.fg;
      ctx.fillText(texts[i], x, y);
      x += widths[i];
    });
  });
  if (ph.en) {
    ctx.font = enFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.caption.fg;
    ctx.fillText(ph.en, cx, cy - boxH / 2 + size * 0.275 + lh * lines.length + enH / 2);
  }
  ctx.restore();
}
