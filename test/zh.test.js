import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScript, speechChunks, normWord } from '../src/script.js';
import { alignChars } from '../src/zhvoice.js';
import { zhIssues } from '../src/zhlint.js';
import { cueTokens } from '../engine/util.js';
import { parseRich } from '../engine/text.js';
import { buildPhrases } from '../engine/captions.js';

test('Chinese narration is split per character and joined without spaces', () => {
  const sc = parseScript('## a\n接著 [#two] 跟它要網頁。[en: Then it asks.] 叫做 {Duga|杜加}雷達，很大。\n').scenes[0];
  const words = sc.units.filter((u) => u.type === 'word');
  assert.deepEqual(words.map((w) => w.display), ['接', '著', '跟', '它', '要', '網', '頁。', '叫', '做', 'Duga', '雷', '達，', '很', '大。']);
  assert.equal(words[2].space, false, 'a space around a marker between Chinese characters is no gap');
  assert.equal(words[9].space, true, 'Latin words keep their spaces');
  assert.deepEqual(sc.subs, { 0: 'Then it asks.' });
  assert.deepEqual(speechChunks(sc.units).map((c) => c.text), ['接著跟它要網頁。', '叫做 杜加雷達，很大。']);
});

test('cues and text layout work on Chinese', () => {
  assert.equal(normWord('達，'), '達');
  assert.deepEqual(cueTokens('雷達 radar'), ['雷', '達', 'radar']);
  const pieces = parseRich('超視距*雷達*，很大').map((w) => [w.text, w.accent, !!w.tight]);
  assert.deepEqual(pieces[3], ['雷', true, true]);
  assert.deepEqual(pieces[4], ['達，', true, true]);
  assert.equal(parseRich('hello world')[1].tight, undefined, 'English is unchanged');
});

test('voice word boundaries give every character a time', () => {
  const words = ['冷', '戰', '時', '期，', 'Duga'].map((spoken) => ({ spoken }));
  const r = alignChars(words, [{ text: '冷戰', start: 0.1, end: 0.5 }, { text: '時期', start: 0.5, end: 1.0 }, { text: 'Duga', start: 1.2, end: 1.6 }], 2);
  assert.equal(r.matchRate, 1);
  assert.deepEqual(r.words.map((w) => Math.round(w.start * 100) / 100), [0.1, 0.3, 0.5, 0.75, 1.2]);
  const approx = alignChars(words, [], 2, true);
  assert.ok(approx.words.every((w, i) => i === 0 || w.start >= approx.words[i - 1].end - 1e-9));
});

test('captions drop Chinese commas and carry the English line', () => {
  const tl = { scenes: [{ start: 0, subs: { 0: 'Hi there.' }, words: [['你', 0], ['好，', 0.2], ['世', 0.4], ['界。', 0.6]].map(([text, start]) => ({ text, start, end: start + 0.2, space: false, sent: 0 })) }] };
  const [ph] = buildPhrases(tl, 46);
  assert.equal(ph.en, 'Hi there.');
  assert.equal(ph.words.length, 4);
});

test('the Taiwan check finds Simplified characters and mainland words', () => {
  const project = { script: parseScript('## a\n这个视频很好。\n') };
  const msgs = zhIssues(project, "s.text('軟件');").map((i) => i.message).join('\n');
  assert.match(msgs, /视频.*影片/);
  assert.match(msgs, /这→這/);
  assert.match(msgs, /軟件.*軟體/);
});

test('pitch is a zh-TW voice setting in Hz', async () => {
  const { normalizeConfig } = await import('../src/project.js');
  assert.equal(normalizeConfig({ voice: 'zh-TW-HsiaoChenNeural', pitch: -20 }).pitch, -20);
  assert.throws(() => normalizeConfig({ voice: 'zh-TW-HsiaoChenNeural', pitch: 80 }), /pitch must be/);
  assert.throws(() => normalizeConfig({ voice: 'af_heart', pitch: 10 }), /only works with the zh-TW voices/);
});

test('a trailing-off …… pauses longer and keeps the English line on its sentence', () => {
  const sc = parseScript('## a\n這個……其實很簡單。[en: This is simple.] 結果——它爆炸了。\n').scenes[0];
  assert.deepEqual(sc.subs, { 0: 'This is simple.' });
  const chunks = speechChunks(sc.units, { sentenceGap: 0.3 });
  assert.deepEqual(chunks.map((c) => [c.gapBefore, c.text]), [[0, '這個……'], [0.5, '其實很簡單。'], [0.3, '結果——它爆炸了。']]);
});

test('the Taiwan check flags half-width punctuation, quotes and mainland slang', () => {
  const project = { script: parseScript('## a\n咱們看看,這是啥.他說"好"...\n') };
  const msgs = zhIssues(project, '').map((i) => i.message).join('\n');
  assert.match(msgs, /咱們.*我們/);
  assert.match(msgs, /啥.*什麼/);
  assert.match(msgs, /half-width punctuation/);
  assert.match(msgs, /「」/);
  assert.match(msgs, /……/);
});
