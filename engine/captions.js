// Burned-in captions built from the narration's word timings. The current
// phrase is shown; words light up as they are spoken.
import { fontString } from './themes.js';
import { clamp, ease } from './util.js';

const HAN = /\p{Script=Han}/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
// Chinese characters are about twice as wide as Latin letters.
const visualLength = (str) => [...str].reduce((n, c) => n + (HAN.test(c) || /[，。！？、；：「」『』（）]/.test(c) ? 2 : 1), 0);

// Some words belong to the word before them, so a phrase or line should not
// start with one: Japanese particles and verb endings, Chinese particles, and
// counters after a number.
const JAPANESE_ENDINGS = /^(ませ|まし|でし|です|ます|しょう|られ|させ|され|なかっ|ながら|ような|ように|という|として|について|によって|くらい|ぐらい)/;
export function clingsToPrevious(language) {
  const counter = (text, before) => /\d$/.test(before) && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
  if (language === 'ja') {
    return (text, before = '') => {
      const word = text.replace(/[、。！？「」『』（）]+$/, '');
      const ending = /^[\u3041-\u3096]+$/.test(word) && (word.length <= 2 || JAPANESE_ENDINGS.test(word));
      const suffix = /^\p{Script=Han}$/u.test(word) && /[\p{Script=Han}\p{Script=Katakana}]$/u.test(before);
      return ending || suffix || counter(text, before);
    };
  }
  if (['zh', 'zh-TW'].includes(language)) return (text, before = '') => /^[的了吗嗎呢吧啊着著过過得地们們][，。！？、]*$/.test(text) || counter(text, before);
  return () => false;
}

function captionText(text, language) {
  if (language !== 'zh-TW') return { text, gapAfter: false };
  const m = /^(.*?)([，、；。]+)$/.exec(text);
  return m && HAN.test(m[1]) ? { text: m[1], gapAfter: true } : { text, gapAfter: false };
}

export function buildPhrases(timeline, maxChars) {
  const language = timeline.language || 'en';
  const zh = language === 'zh-TW';
  const cjk = ['ja', 'zh', 'zh-TW'].includes(language);
  const sentenceEnd = zh ? /[.!?;:।。！？；：]["'’)」』）]*$/ : cjk ? /[.!?;:।。！？]["'’)」』）]*$/ : /[.!?;:।]["'’)]*$/;
  if (cjk) maxChars = Math.min(maxChars, 18);
  const phrases = [];
  for (const sc of timeline.scenes) {
    // A sentence (or a run of words between long pauses) is split into as few
    // phrases as fit, balanced in length, so no phrase is one lonely word.
    let run = [];
    let sent = 0;
    const flush = () => {
      const en = zh ? sc.subs?.[sent] || null : null;
      for (const words of balancePhrases(run, maxChars, cjk ? '' : ' ', clingsToPrevious(language))) {
        phrases.push({ words, ...(cjk ? { separator: '' } : {}), ...(zh ? { en } : {}), language, start: words[0].start, end: words[words.length - 1].end });
      }
      run = [];
    };
    for (const w of sc.words) {
      const previous = run[run.length - 1];
      const g = { text: w.text, start: sc.start + w.start, end: sc.start + w.end, space: cjk && previous && CJK.test(previous.text) && CJK.test(w.text) ? false : w.space, sent: w.sent ?? 0 };
      if (run.length && (g.start - run[run.length - 1].end > 0.55 || (zh && g.sent !== sent))) flush();
      if (!run.length) sent = g.sent;
      run.push(g);
      const text = run.map((x) => x.text).join('');
      if (sentenceEnd.test(g.text) || (zh && /[，、]$/.test(g.text) && visualLength(text) >= 16)) flush();
    }
    if (run.length) flush();
  }
  phrases.forEach((p, i) => {
    const next = phrases[i + 1];
    p.until = next ? Math.min(next.start, p.end + 0.9) : p.end + 0.9;
  });
  return phrases;
}

// Splits words into the fewest phrases of at most maxChars characters, with
// lengths as even as possible and breaks after commas where they fit, never
// before a word that clings to the one before it if that can be helped.
export function balancePhrases(words, maxChars, separator = ' ', clings = () => false) {
  if (!words.length) return [];
  const len = (a, b) => words.slice(a, b).reduce((n, w) => n + w.text.length + separator.length, -separator.length);
  if (len(0, words.length) <= maxChars) return [words];
  const punctuation = separator === '' ? /[,;:–—、，；：]["'’)」』）]*$/ : /[,;:–—]["'’)]*$/;
  const n = words.length;
  const best = [{ parts: 0, cost: 0, from: -1 }];
  for (let b = 1; b <= n; b++) {
    best[b] = null;
    for (let a = b - 1; a >= 0; a--) {
      const l = len(a, b);
      if (l > maxChars && b - a > 1) break;
      if (!best[a]) continue;
      const comma = b < n && punctuation.test(words[b - 1].text) ? 150 : 0;
      const glued = b < n && !comma && clings(words[b].text, words[b - 1].text) ? 250 : 0;
      const c = { parts: best[a].parts + 1, cost: best[a].cost + (maxChars - l) ** 2 - comma + glued, from: a };
      if (!best[b] || c.parts < best[b].parts || (c.parts === best[b].parts && c.cost < best[b].cost)) best[b] = c;
    }
  }
  const out = [];
  for (let b = n; b > 0; b = best[b].from) out.unshift(words.slice(best[b].from, b));
  return out;
}

// `area` ({ cx, bottom, maxWidth }) places the captions inside a platform's
// safe area, right above the band the app covers with its own text.
export function drawCaptions(ctx, phrases, T, theme, W, H, area = null) {
  const ph = phrases.find((p) => T >= p.start - 0.08 && T < p.until);
  if (!ph) return;
  const vertical = H > W;
  const size = vertical ? 58 : 44;
  const font = fontString(theme, 'body', size, theme.fonts.body.family === 'Inter' ? 600 : undefined, ph.language);
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const space = ctx.measureText(' ').width;
  // Chinese words carry no space before them; a dropped comma leaves one.
  const shown = ph.words.map((w) => captionText(w.text, ph.language));
  const texts = shown.map((x) => x.text);
  const gaps = ph.words.map((w, i) => (i === 0 ? 0 : ((w.space ?? (ph.separator !== '')) || shown[i - 1].gapAfter ? space : 0)));
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
  let enFont = fontString(theme, 'body', enSize, undefined, ph.language);
  if (ph.en) {
    ctx.font = enFont;
    const w = ctx.measureText(ph.en).width;
    if (w > maxLine) {
      enSize = Math.max(22, Math.floor((enSize * maxLine) / w));
      enFont = fontString(theme, 'body', enSize, undefined, ph.language);
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
