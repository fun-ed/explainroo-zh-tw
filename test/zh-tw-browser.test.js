import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome } from '../src/browser.js';
import { loadProject } from '../src/project.js';
import { withEngine } from '../src/pipeline.js';

let chrome;
try { chrome = findChrome(); } catch {}

test('typed Han text finishes every character, including Japanese and mixed Latin text', { skip: !chrome }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-zh-type-'));
  try {
    const texts = ['你好世界', 'グレゴリオ暦は', 'REST API 測試'];
    fs.writeFileSync(path.join(dir, 'video.json'), JSON.stringify({ language: 'zh-TW', theme: 'clean', captions: false, watermark: false, camera: 'still' }));
    fs.writeFileSync(path.join(dir, 'script.md'), texts.map((_, i) => `## s${i}\n`).join('\n'));
    fs.writeFileSync(path.join(dir, 'scenes.js'), `export default { ${texts.map((text, i) => `s${i}(s) { s.text(${JSON.stringify(text)}, {enter:'type', at:0, dur:1}); }`).join(',')} };`);
    const project = loadProject(dir);
    const timeline = { duration: 12, frames: 360, fps: 30, width: 1920, height: 1080, transitionSeconds: 0, language: 'zh-TW',
      scenes: texts.map((_, i) => ({ id: `s${i}`, index: i, start: i * 4, dur: 4, words: [], marks: {}, voice: null, transition: 'none' })) };
    await withEngine(project, timeline, {}, async (page) => {
      const drawn = await page.evaluate(async () => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        const result = [];
        let words = [];
        CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { words.push(text); return original.call(this, text, ...args); };
        try {
          for (const T of [2, 6, 10]) {
            words = [];
            await window.explainroo.stills([{ T, path: `out/type-${T}.png` }]);
            result.push(words.join(''));
          }
        } finally { CanvasRenderingContext2D.prototype.fillText = original; }
        return result;
      });
      assert.deepEqual(drawn, texts.map((text) => text.replaceAll(' ', '')));
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
