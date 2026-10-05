// Taiwan Mandarin narration. Kokoro has no Taiwan voice, so Chinese videos use
// Microsoft Edge's zh-TW neural voices (online, through the edge-tts Python
// package) or the zh_TW voices built into macOS (offline). Edge reports when
// each word is spoken; macOS does not, so its word times are estimated.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegPath } from './ffmpeg.js';

export const ZH_VOICES = {
  'zh-TW-HsiaoChenNeural': 'Taiwan Mandarin, female (Edge, online, exact word timing)',
  'zh-TW-HsiaoYuNeural': 'Taiwan Mandarin, female (Edge, online, exact word timing)',
  'zh-TW-YunJheNeural': 'Taiwan Mandarin, male (Edge, online, exact word timing)',
  'say:Meijia': 'Taiwan Mandarin, female (macOS, offline, estimated word timing)',
  'say:Flo': 'Taiwan Mandarin, female (macOS, offline, estimated word timing)',
  'say:Sandy': 'Taiwan Mandarin, female (macOS, offline, estimated word timing)',
  'say:Shelley': 'Taiwan Mandarin, female (macOS, offline, estimated word timing)',
  'say:Eddy': 'Taiwan Mandarin, male (macOS, offline, estimated word timing)',
  'say:Reed': 'Taiwan Mandarin, male (macOS, offline, estimated word timing)',
  'say:Rocko': 'Taiwan Mandarin, male (macOS, offline, estimated word timing)',
};
export const ZH_DEFAULT_VOICE = 'zh-TW-HsiaoChenNeural';
const EDGE_TTS_VERSION = '7.2.8';
const SAMPLE_RATE = 24000;
const HAN = /\p{Script=Han}/u;

export function isZhVoice(voice) {
  return voice in ZH_VOICES;
}

// The Python that runs scripts/edge_tts.py: $EXPLAINROO_PYTHON, a python3
// with edge-tts installed, or uv with a pinned edge-tts.
let edgeCommand = null;
export function edgeTTSCommand() {
  if (edgeCommand) return edgeCommand;
  const works = (cmd, args) => spawnSync(cmd, [...args, '-c', 'import edge_tts'], { stdio: 'ignore' }).status === 0;
  const py = process.env.EXPLAINROO_PYTHON || 'python3';
  if (works(py, [])) edgeCommand = [py];
  else if (spawnSync('uv', ['--version'], { stdio: 'ignore' }).status === 0) edgeCommand = ['uv', 'run', '--quiet', '--no-project', '--with', `edge-tts==${EDGE_TTS_VERSION}`, 'python'];
  else throw new Error(`the zh-TW voices need the edge-tts Python package: run "pip install edge-tts==${EDGE_TTS_VERSION}" or install uv, or use an offline voice like "say:Meijia"`);
  return edgeCommand;
}

function decode(file) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${String(r.stderr).slice(-300)}`);
  const buf = r.stdout;
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

// Returns { audio: Float32Array at 24 kHz, boundaries: [{ text, start, end }], approximate }.
export async function zhSpeak(text, voice, speed = 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'explainroo-zh-'));
  try {
    if (voice.startsWith('say:')) {
      const name = voice.slice(4) === 'Meijia' ? 'Meijia' : `${voice.slice(4)} (Chinese (Taiwan))`;
      const out = path.join(dir, 'say.aiff');
      // ponytail: 190 words a minute is a guess at the macOS default; tune with "speed".
      const r = spawnSync('say', ['-v', name, '-r', String(Math.round(190 * speed)), '-o', out, text], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`macOS say failed for voice "${name}": ${r.stderr || 'is this a Mac with that voice installed?'}`);
      return { audio: decode(out), boundaries: [], approximate: true };
    }
    const out = path.join(dir, 'edge.mp3');
    const pct = Math.round((speed - 1) * 100);
    const [cmd, ...pre] = edgeTTSCommand();
    const script = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'scripts', 'edge_speak.py');
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = spawnSync(cmd, [...pre, script, voice, `${pct >= 0 ? '+' : ''}${pct}%`, out], { input: text, encoding: 'utf8', maxBuffer: 1 << 26 });
      if (r.status === 0) break;
      await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
    }
    if (r.status !== 0) throw new Error(`edge-tts failed (it needs internet access): ${String(r.stderr).trim().split('\n').slice(-3).join(' ')}`);
    return { audio: decode(out), boundaries: JSON.parse(r.stdout), approximate: false };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const isPunct = (c) => !/[\p{L}\p{N}]/u.test(c);

// Gives every script word a start and end time from the voice's word
// boundaries. Boundaries are matched to the script character by character;
// words without a boundary (or all words, for macOS voices) are spread by
// character count between their timed neighbours.
export function alignChars(words, boundaries, duration, approximate = false) {
  const chars = [];
  words.forEach((w, wi) => {
    for (const c of String(w.spoken)) if (!/\s/.test(c)) chars.push({ c, wi, start: null, end: null });
  });
  const flat = chars.map((x) => x.c).join('');
  let ptr = 0;
  for (const b of boundaries) {
    const t = String(b.text).replace(/\s+/g, '');
    if (!t) continue;
    const k = flat.indexOf(t, ptr);
    if (k === -1 || k - ptr > 40) continue;
    const per = (b.end - b.start) / [...t].length;
    [...t].forEach((_, q) => {
      chars[k + q].start = Math.max(0, b.start + q * per);
      chars[k + q].end = b.start + (q + 1) * per;
    });
    ptr = k + t.length;
  }
  const spans = words.map((w, wi) => {
    const own = chars.filter((x) => x.wi === wi && x.start !== null);
    return own.length ? { start: own[0].start, end: own[own.length - 1].end } : null;
  });
  const need = chars.filter((x) => !isPunct(x.c));
  const hit = need.filter((x) => x.start !== null).length;
  const out = words.map((w, wi) => ({ start: 0, end: 0, matched: approximate || (!!spans[wi] && chars.every((x) => x.wi !== wi || isPunct(x.c) || x.start !== null)) }));
  const weight = words.map((w) => Math.max(1, [...String(w.spoken)].filter((c) => !isPunct(c)).length * (HAN.test(w.spoken) ? 1 : 0.5)));
  let k = 0;
  while (k < words.length) {
    if (spans[k]) {
      out[k].start = spans[k].start;
      out[k].end = Math.max(spans[k].end, spans[k].start + 0.05);
      k++;
      continue;
    }
    let e = k;
    while (e < words.length && !spans[e]) e++;
    const from = k > 0 ? out[k - 1].end : 0;
    const to = e < words.length ? spans[e].start : duration;
    const total = weight.slice(k, e).reduce((a, b) => a + b, 0);
    let t = from;
    for (let q = k; q < e; q++) {
      const d = (Math.max(0, to - from) * weight[q]) / total;
      out[q].start = t;
      out[q].end = t + d;
      t += d;
    }
    k = e;
  }
  return { words: out, matchRate: approximate ? 1 : need.length ? hit / need.length : 1 };
}
