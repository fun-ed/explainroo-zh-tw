import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome } from '../src/browser.js';
import { loadProject } from '../src/project.js';
import { withEngine } from '../src/pipeline.js';

// Regression test for long renders failing with ERR_STRING_TOO_LONG while the
// soundtrack was uploaded: an ArrayBuffer request body is copied into the
// DevTools event that Playwright reads as one string. The upload must arrive
// intact, in bounded pieces, without its bytes travelling through the driver.
let chrome;
try { chrome = findChrome(); } catch {}
test('engine uploads go up in bounded pieces that never pass through the driver', { skip: !chrome }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-upload-'));
  try {
    fs.writeFileSync(path.join(dir, 'video.json'), JSON.stringify({ theme: 'clean', captions: false, music: false, sfx: false }));
    fs.writeFileSync(path.join(dir, 'script.md'), '## demo\nA sound.');
    fs.writeFileSync(path.join(dir, 'scenes.js'), 'export default { demo(s) { s.text("demo", { at: 0 }); } };');
    const project = loadProject(dir);
    const timeline = { pace: 1, duration: 1, frames: 30, fps: 30, width: 1920, height: 1080, transitionSeconds: 0,
      scenes: [{ id: 'demo', index: 0, start: 0, dur: 1, words: [], marks: {}, voice: null, lead: 0, transition: 'none' }] };
    await withEngine(project, timeline, { scale: 0.25 }, async (page) => {
      const puts = [];
      page.on('request', (r) => {
        if (r.method() === 'PUT') puts.push({ url: r.url(), driverBytes: r.postDataBuffer()?.length ?? 0 });
      });
      // 5 MB of pseudo-random bytes as an ArrayBuffer, like an encoded WAV, in 1 MB pieces
      const size = 5 * 1024 * 1024 + 123;
      const digest = await page.evaluate(async ({ size }) => {
        const { upload } = await import('/engine/upload.js');
        const bytes = new Uint8Array(size);
        let x = 2463534242;
        for (let i = 0; i < size; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; bytes[i] = x & 255; }
        await upload('build/big.bin', bytes.buffer, { chunkBytes: 1024 * 1024 });
        const hash = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
      }, { size });
      const written = fs.readFileSync(path.join(dir, 'build', 'big.bin'));
      assert.equal(written.length, size);
      assert.equal(crypto.createHash('sha256').update(written).digest('hex'), digest);
      assert.equal(puts.length, 6);
      assert.deepEqual(puts.map((p) => Number(new URL(p.url).searchParams.get('offset'))), [0, 1, 2, 3, 4, 5].map((k) => k * 1024 * 1024));
      assert.equal(new URL(puts.at(-1).url).searchParams.get('last'), '1');
      const ids = new Set(puts.map((p) => new URL(p.url).searchParams.get('upload')));
      assert.equal(ids.size, 1);
      assert.match([...ids][0], /^[0-9a-f]{32}$/);
      assert.ok(puts.every((p) => p.driverBytes === 0), 'request bodies must not be copied into the driver protocol');
      assert.deepEqual(fs.readdirSync(path.join(dir, 'build')).filter((n) => n.endsWith('.part')), []);
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
