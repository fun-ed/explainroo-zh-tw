import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhrases, clingsToPrevious, drawCaptions } from '../engine/captions.js';
import { fontString, getTheme } from '../engine/themes.js';
import { UI } from '../engine/ui.js';
import { Stage } from '../engine/stage.js';

test('zh-TW captions strip Chinese punctuation, retain spacing, and show the English line', () => {
  const timeline = {
    language: 'zh-TW',
    scenes: [{
      start: 0,
      subs: { 0: 'The world is changing.' },
      words: ['你', '好，', '世', '界。'].map((text, i) => ({ text, start: i * 0.2, end: i * 0.2 + 0.2, space: false, sent: 0 })),
    }],
  };
  const phrases = buildPhrases(timeline, 46);
  const drawn = [];
  const ctx = new Proxy({
    measureText: text => ({ width: text.length * 10 }),
    fillText: (text, x) => drawn.push({ text, x }),
  }, { get: (target, key) => target[key] ?? (() => {}) });

  drawCaptions(ctx, phrases, 0.1, getTheme('clean'), 1920, 1080);
  assert.deepEqual(drawn.map(({ text }) => text), ['你', '好', '世', '界', 'The world is changing.']);
  assert.deepEqual(drawn.slice(1, 4).map(({ x }, i) => x - drawn[i].x), [10, 20, 10]);
});

test('zh-TW cues match per-character fork timings and upstream CJK word timings', () => {
  const makeStage = (language, words) => Object.assign(Object.create(Stage.prototype), { engine: { config: { language } }, words, id: 'demo' });
  const fork = makeStage('zh-TW', [{ text: '解', start: 0.1, end: 0.2 }, { text: '析', start: 0.2, end: 0.4 }, { text: '地', start: 0.4, end: 0.6 }, { text: '址。', start: 0.6, end: 0.8 }]);
  assert.equal(fork.cue('解析'), 0.1);
  assert.equal(fork.cueEnd('解析地址'), 0.8);
  const upstream = makeStage('zh', [{ text: '解析', start: 0.1, end: 0.5 }, { text: '地址。', start: 0.5, end: 0.9 }]);
  assert.equal(upstream.cue('解析'), 0.1);
  assert.equal(upstream.cueEnd('解析地址'), 0.9);
  assert.throws(() => upstream.cue('析地'), /not in the narration/);
});

test('zh-TW subtitle particles and counters stay with the word before them', () => {
  const clings = clingsToPrevious('zh-TW');
  for (const [text, before] of [['的', '密碼'], ['嗎', '這樣'], ['著', '看'], ['年', '4']]) assert.equal(clings(text, before), true, text);
  assert.equal(clings('密碼', '保存'), false);
});

test('engine font fallbacks prioritize Traditional Chinese only for zh-TW', () => {
  const theme = getTheme('clean');
  const ui = language => UI.prototype.fontString.call({ font: 'Inter', s: { engine: { config: { language } } } }, 24);
  const tw = [fontString(theme, 'body', 48, undefined, 'zh-TW'), ui('zh-TW')];
  const ja = [fontString(theme, 'body', 48, undefined, 'ja'), ui('ja')];
  for (const font of [...tw, ...ja]) {
    assert.match(font, /Noto Sans Devanagari/);
    assert.match(font, /Noto Sans JP.*Noto Sans SC/);
    assert.match(font, /PingFang TC.*Noto Sans TC.*Microsoft JhengHei/);
  }
  assert.ok(tw.every(font => font.indexOf('PingFang TC') < font.indexOf('Noto Sans JP')));
  assert.ok(ja.every(font => font.indexOf('Noto Sans JP') < font.indexOf('PingFang TC')));
});

test('non-CJK caption commas do not leave a lonely last word', () => {
  const words = 'When the user arrives, stop.'.split(' ').map((text, i) => ({ text, start: i * 0.3, end: (i + 1) * 0.3 }));
  for (const language of ['en', 'es', 'hi']) {
    const phrases = buildPhrases({ language, scenes: [{ start: 0, words }] }, 46);
    assert.equal(phrases.length, 1);
    assert.equal(phrases[0].words.map((w) => w.text).join(' '), 'When the user arrives, stop.');
  }
});
