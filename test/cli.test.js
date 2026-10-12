import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.js';

// Run the CLI in-process and collect what it wrote to stderr.
async function run(args) {
  const write = process.stderr.write;
  let err = '';
  process.stderr.write = (chunk) => { err += chunk; return true; };
  try {
    const code = await main(args);
    return { code, err };
  } finally {
    process.stderr.write = write;
  }
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-cli-'));
}

test('init rejects an unknown theme and creates no folder', async () => {
  const base = tempDir();
  const target = path.join(base, 'video');
  const r = await run(['init', target, '--theme', 'nope']);
  assert.equal(r.code, 1);
  assert.match(r.err, /theme must be one of/);
  assert.equal(fs.existsSync(target), false);
});

test('init rejects a bad pace without leaving a folder behind', async () => {
  const base = tempDir();
  const target = path.join(base, 'video');
  const r = await run(['init', target, '--pace', 'fast']);
  assert.equal(r.code, 1);
  assert.match(r.err, /--pace must be a number/);
  assert.equal(fs.existsSync(target), false);
});

test('init names a text flag that was given without a value', async () => {
  const base = tempDir();
  const target = path.join(base, 'video');
  const r = await run(['init', target, '--title']);
  assert.equal(r.code, 1);
  assert.match(r.err, /--title needs a value/);
  assert.equal(fs.existsSync(target), false);
});

test('init with valid settings writes video.json and the starter files', async () => {
  const base = tempDir();
  const target = path.join(base, 'my-first-video');
  const r = await run(['init', target, '--theme', 'clean', '--pace', '1.2']);
  assert.equal(r.code, 0);
  const config = JSON.parse(fs.readFileSync(path.join(target, 'video.json'), 'utf8'));
  assert.equal(config.theme, 'clean');
  assert.equal(config.pace, 1.2);
  assert.equal(config.title, 'My first video');
  assert.ok(fs.existsSync(path.join(target, 'assets')));
  assert.ok(fs.existsSync(path.join(target, 'script.md')));
});
