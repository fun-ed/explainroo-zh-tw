import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.js';
import { normalizeConfig, loadProject } from '../src/project.js';
import { subtitleCues } from '../src/subtitles.js';
import { parseScript } from '../src/script.js';
import { buildTimeline } from '../src/timeline.js';
import { buildPhrases } from '../engine/captions.js';

async function run(args) {
  const write = process.stderr.write;
  let err = '';
  process.stderr.write = (chunk) => { err += chunk; return true; };
  try { return { code: await main(args), err }; }
  finally { process.stderr.write = write; }
}

test('legacy Taiwan configs and provider objects retain their language and speed', () => {
  const legacy = normalizeConfig({ voice: 'zh-TW-HsiaoChenNeural', pitch: -20 });
  assert.equal(legacy.language, 'zh-TW');
  assert.equal(legacy.speed, 1);
  assert.equal(normalizeConfig({ language: 'zh-TW' }).voice, legacy.voice);
  assert.equal(normalizeConfig({ language: 'zh' }).voice, 'zf_xiaobei');
  assert.equal(normalizeConfig({ voice: { provider: 'recording', src: 'assets/narration.wav' } }).speed, 1);
  assert.throws(() => normalizeConfig({ language: 'zh', voice: legacy.voice }), /does not speak zh/);
  assert.throws(() => normalizeConfig({ voice: { provider: 'recording', src: 'assets/narration.wav' }, pitch: 1 }), /pitch only works/);
});

test('both Taiwan init flags use the Chinese starter and reject conflicting language flags', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-zh-sync-'));
  try {
    for (const flag of ['--lang', '--language']) {
      const target = path.join(dir, flag.slice(2));
      assert.equal((await run(['init', target, flag, 'zh-TW'])).code, 0);
      const project = loadProject(target);
      assert.equal(project.config.language, 'zh-TW');
      assert.equal(project.config.voice, 'zh-TW-HsiaoChenNeural');
      assert.equal(project.config.captions, true);
      assert.equal(project.config.watermark, false);
      assert.match(project.script.scenes[0].text, /[\p{Script=Han}]/u);
    }
    const target = path.join(dir, 'bad');
    const result = await run(['init', target, '--lang', 'zh-TW', '--language', 'ja']);
    assert.equal(result.code, 1);
    assert.match(result.err, /must agree/);
    assert.equal(fs.existsSync(target), false);
    assert.equal((await run(['init', target, '--lang'])).code, 1);
    assert.equal(fs.existsSync(target), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('Taiwan subtitle export joins characters and splits at Chinese sentence endings', () => {
  const text = '你好。再見。';
  const timeline = { language: 'zh-TW', scenes: [{ start: 0, dur: 5, words: [...text].map((text, i) => ({ text, start: i * 0.3, end: (i + 1) * 0.3 })) }] };
  assert.deepEqual(subtitleCues(timeline).map((c) => c.text), ['你好。', '再見。']);
});

test('real timelines keep Taiwan exports Chinese and English captions unchanged', () => {
  for (const language of ['en', 'zh-TW']) {
    const text = language === 'en' ? 'These words stay together in one caption.' : '你好。再見。';
    const config = normalizeConfig({ language });
    const script = parseScript(`## a\n${text}`, { language });
    const words = script.scenes[0].units.filter((u) => u.type === 'word').map((u, i) => ({
      text: u.display, space: u.space, sent: u.sent, start: i * 0.3, end: (i + 1) * 0.3,
    }));
    const timeline = buildTimeline({ config, script }, { a: { duration: 3, words, marks: {}, chunks: [] } });
    const phrases = buildPhrases(timeline, 46);
    assert.ok(phrases.every((p) => p.language === language));
    assert.deepEqual(subtitleCues(timeline).map((c) => c.text), language === 'en' ? [text] : ['你好。', '再見。']);
    if (language === 'en') assert.equal(phrases.length, 1);
  }
});

test('Taiwan subtitle export keeps spaces within Latin phrases', () => {
  const words = [
    { text: '用', space: true }, { text: 'REST', space: true },
    { text: 'API', space: true }, { text: '查', space: true }, { text: '詢。', space: false },
  ].map((w, i) => ({ ...w, start: i * 0.3, end: (i + 1) * 0.3 }));
  const timeline = { language: 'zh-TW', scenes: [{ start: 0, dur: 3, words }] };
  assert.deepEqual(subtitleCues(timeline).map((c) => c.text), ['用 REST API 查詢。']);
});
