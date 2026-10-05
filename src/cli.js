// explainroo command line.
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, ProjectError, THEMES, MUSIC_STYLES, FORMATS, resolveSize, normalizeConfig } from './project.js';
import { layoutAreas } from '../engine/layout.js';
import { ScriptError } from './script.js';
import { prepare, makeState } from './pipeline.js';
import { render } from './render.js';
import { check, stills, sheet, verify } from './qa.js';
import { startServer, ROOT } from './server.js';
import { VOICES, loadTTS, loadASR, cacheRoot, ttsDtype, TTS_SAMPLE_RATE } from './models.js';
import { writeWav } from './wav.js';
import { isZhVoice, zhSpeak, edgeTTSCommand, ZH_DEFAULT_VOICE } from './zhvoice.js';
import { ffmpegVersion } from './ffmpeg.js';
import { findChrome } from './browser.js';
import { generateImage, imageLog, imageSpend, IMAGE_MODELS } from './images.js';

const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const HELP = `explainroo ${VERSION}: narrated explainer videos from code

Usage: explainroo <command> [project] [options]

Make a video
  init <dir>            create a project (--theme, --size, --pace, --voice, --title, --lang zh-TW)
  voice [project]       generate narration and word timings (cached)
  preview [project]     live preview in your browser, reloads on save (--port)
  still [project] [t…]  PNG stills: "12.5", "scene", "scene@2.4" (default: end of every scene)
  sheet [project]       contact sheet of the whole video (--scene id, --every s)
  check [project]       find layout, timing and pronunciation problems (--view-width pixels)
  render [project]      write out/video.mp4 (--draft, --from s, --to s, --workers n, --out file)
  verify [project]      check the rendered file: loudness, black frames, narration

Images (optional, needs an OpenRouter API key)
  image [project] <name> "<what to draw>"   save an illustration as assets/<name>.png
                        (--model best|cheap, --aspect 16:9, --ref assets/a.png,assets/b.png, --no-style)
  images [project]      list generated images and what they cost

Reference
  voices                list voices (and the zh_TW voices installed on this Mac); "explainroo say 'text' --voice am_michael" to hear one
  themes                list looks
  formats               list sizes for YouTube, Shorts, TikTok, Reels, Instagram, LinkedIn
  icons <word…>         search the 1,800+ built-in icons
  doctor                check ffmpeg, Chrome and the speech models (--fetch downloads them)

Options: --json for machine-readable output. The project defaults to the current folder.
Docs: AGENTS.md (for coding agents) and https://www.explainroo.com/docs/`;

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--') && !BOOL.has(a.slice(2))) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else if (a === '-h') flags.help = true;
    else pos.push(a);
  }
  return { pos, flags };
}
const BOOL = new Set(['json', 'draft', 'force', 'fetch', 'help', 'version', 'quiet', 'open', 'no-style']);

function num(v, name) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ProjectError(`--${name} must be a number`);
  return n;
}

export async function main(argv) {
  const { pos, flags } = parseArgs(argv);
  const cmd = pos.shift();
  const json = !!flags.json;
  const log = json || flags.quiet ? () => {} : (m) => process.stderr.write(`${m}\n`);
  const print = (human, data) => {
    if (json) process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    else if (human) process.stdout.write(human + '\n');
  };

  if (!cmd || cmd === 'help' || flags.help) {
    process.stdout.write(HELP + '\n');
    return 0;
  }
  if (cmd === 'version' || flags.version) {
    print(VERSION, { version: VERSION });
    return 0;
  }

  try {
    switch (cmd) {
      case 'init': return init(pos[0], flags, print);
      case 'voice': {
        const project = loadProject(pos[0]);
        const { voices, timeline } = await prepare(project, { log, force: !!flags.force });
        const rows = project.script.scenes.map((s) => {
          const v = voices[s.id];
          return { scene: s.id, voice: v.duration, confirmed: v.matchRate, unconfirmed: v.unmatched, marks: v.marks };
        });
        print(rows.map((r) => `${r.scene.padEnd(18)} ${r.voice.toFixed(1).padStart(5)}s  ${Math.round(r.confirmed * 100)}% confirmed${r.unconfirmed.length ? '  unconfirmed: ' + r.unconfirmed.slice(0, 6).join(', ') : ''}`).join('\n') + `\ntotal ${timeline.duration.toFixed(1)}s`, { scenes: rows, duration: timeline.duration });
        return 0;
      }
      case 'preview': return preview(pos[0], flags, log);
      case 'still': {
        const isProject = pos[0] && fs.existsSync(path.join(pos[0], 'video.json'));
        const project = loadProject(isProject ? pos.shift() : undefined);
        const list = await stills(project, pos, { log, scale: num(flags.scale, 'scale') ?? 1 });
        print(list.map((s) => `${s.label.padEnd(24)} ${s.file}`).join('\n'), { stills: list });
        return 0;
      }
      case 'sheet': {
        const project = loadProject(pos[0]);
        const r = await sheet(project, { scene: flags.scene, every: num(flags.every, 'every'), cols: num(flags.cols, 'cols'), log });
        print(`${r.file} (${r.frames} frames)`, r);
        return 0;
      }
      case 'check': {
        const project = loadProject(pos[0]);
        const r = await check(project, { log, step: num(flags.step, 'step') ?? 0.25, viewWidth: num(flags['view-width'], 'view-width') ?? null });
        const errors = r.issues.filter((i) => i.level === 'error').length;
        const human = r.issues.length
          ? r.issues.map((i) => `${i.level.toUpperCase().padEnd(5)} ${i.scene ?? ''}${i.t !== null && i.t !== undefined ? ' @' + i.t + 's' : ''}: ${i.message}`).join('\n') + `\n${errors} error(s), ${r.issues.length - errors} other finding(s) in ${r.scenes} scenes (${r.duration.toFixed(1)}s)`
          : `no problems found in ${r.scenes} scenes (${r.duration.toFixed(1)}s)`;
        print(human, r);
        return errors ? 1 : 0;
      }
      case 'render': {
        const project = loadProject(pos[0]);
        const r = await render(project, { log, draft: !!flags.draft, from: num(flags.from, 'from'), to: num(flags.to, 'to'), workers: num(flags.workers, 'workers'), scale: num(flags.scale, 'scale'), out: flags.out });
        print(r.out, r);
        return 0;
      }
      case 'verify': {
        const project = loadProject(pos[0]);
        const r = await verify(project, { file: flags.file, log });
        const lines = [
          `${r.file}: ${r.duration}s, ${r.video ? `${r.video.width}x${r.video.height}` : 'no video'}, loudness ${r.loudness?.integrated ?? '?'} LUFS, true peak ${r.loudness?.truePeak ?? '?'} dBFS`,
          r.speech ? `narration understood: ${Math.round(r.speech.matchRate * 100)}%` : '',
          ...r.issues.map((i) => `${i.level.toUpperCase().padEnd(5)} ${i.message}`),
        ].filter(Boolean);
        print(lines.join('\n'), r);
        return r.issues.some((i) => i.level === 'error') ? 1 : 0;
      }
      case 'image': {
        const isProject = pos[0] && fs.existsSync(path.join(pos[0], 'video.json'));
        const project = loadProject(isProject ? pos.shift() : undefined);
        const [name, ...rest] = pos;
        const r = await generateImage(project, {
          name,
          prompt: rest.join(' '),
          model: flags.model,
          aspect: flags.aspect,
          refs: flags.ref ? String(flags.ref).split(',').map((x) => x.trim()).filter(Boolean) : [],
          style: flags['no-style'] ? false : flags.style,
          log,
        });
        print(`${r.file}  ${r.model}  ${r.cost_usd !== null ? '$' + r.cost_usd.toFixed(4) : 'cost unknown'}  (images so far: $${r.total_usd.toFixed(4)})\nOpen the image and check it before you use it.`, r);
        return 0;
      }
      case 'images': {
        const project = loadProject(pos[0]);
        const list = imageLog(project);
        const total = imageSpend(project);
        print(list.length ? list.map((e) => `${e.time.slice(0, 16)}  ${e.file.padEnd(28)} ${e.model.padEnd(32)} ${e.cost_usd !== null ? '$' + e.cost_usd.toFixed(4) : '?'}`).join('\n') + `\n${list.length} image request(s), $${total.toFixed(4)}` : 'no images generated yet', { images: list, total_usd: total, models: IMAGE_MODELS });
        return 0;
      }
      case 'voices': {
        print(Object.entries(VOICES).map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n'), { voices: VOICES });
        return 0;
      }
      case 'say': return say(pos.join(' '), flags, log, print);
      case 'themes': {
        const desc = {
          paper: 'hand-drawn marker on warm paper; brush transitions; warm music',
          clean: 'crisp flat product style, cards and soft shadows; slide transitions; upbeat music',
          chalk: 'chalk on a green board with hatched fills; brush transitions; calm music',
          blueprint: 'white technical drafting on blueprint blue with a grid; wipe transitions; tech music',
          midnight: 'dark developer look with glowing accents; zoom transitions; tech music',
        };
        print(THEMES.map((t) => `${t.padEnd(10)} ${desc[t]}`).join('\n') + `\n\nmusic styles: ${MUSIC_STYLES.join(', ')}`, { themes: desc, music: MUSIC_STYLES });
        return 0;
      }
      case 'formats': {
        // The free area for content with the defaults (watermark on, captions
        // as "auto" decides), the same box scenes get as s.safe.
        const info = Object.entries(FORMATS).map(([name, f]) => {
          const cfg = normalizeConfig({ size: name });
          const { safe } = layoutAreas(cfg, cfg.width, cfg.height);
          return { name, width: f.size[0], height: f.size[1], use: f.use, captions: cfg.captions, content: { x: safe.x, y: safe.y, w: safe.w, h: safe.h } };
        });
        const rows = info.map((r) => `${r.name.padEnd(10)} ${`${r.width}x${r.height}`.padEnd(10)} ${r.use}\n${''.padEnd(22)}content area ${r.content.w}x${r.content.h} at ${r.content.x},${r.content.y}${r.captions ? ', captions below it' : ''}`);
        print(rows.join('\n') + '\n\nAlso: 16:9, 9:16, 1:1, 4:5 or WIDTHxHEIGHT. Set it with "size" in video.json or init --size.', { formats: info });
        return 0;
      }
      case 'icons': return icons(pos, print);
      case 'doctor': return doctor(flags, log, print);
      default:
        process.stderr.write(`unknown command "${cmd}"\n\n${HELP}\n`);
        return 2;
    }
  } catch (e) {
    if (e instanceof ProjectError || e instanceof ScriptError) {
      if (json) print(null, { error: e.message });
      else process.stderr.write(`error: ${e.message}\n`);
      return 1;
    }
    if (json) print(null, { error: e.message, stack: e.stack });
    else process.stderr.write(`error: ${e.message}\n`);
    if (process.env.EXPLAINROO_DEBUG) process.stderr.write(`${e.stack}\n`);
    return 1;
  }
}

function init(dir, flags, print) {
  if (!dir) throw new ProjectError('usage: explainroo init <dir> [--theme paper] [--size youtube|tiktok|linkedin|...] [--pace 1.2] [--voice af_heart] [--title "..."]');
  const target = path.resolve(dir);
  if (fs.existsSync(path.join(target, 'video.json'))) throw new ProjectError(`${target} already has a video.json`);
  const theme = flags.theme || 'paper';
  if (!THEMES.includes(theme)) throw new ProjectError(`theme must be one of ${THEMES.join(', ')}`);
  const lang = flags.lang || 'en';
  if (!['en', 'zh-TW'].includes(lang)) throw new ProjectError('lang must be "en" or "zh-TW"');
  const zh = lang === 'zh-TW';
  const voice = flags.voice || (zh ? ZH_DEFAULT_VOICE : 'af_heart');
  if (!VOICES[voice]) throw new ProjectError(`voice "${voice}" does not exist. Run "explainroo voices".`);
  const title = flags.title || path.basename(target).replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  fs.mkdirSync(path.join(target, 'assets'), { recursive: true });
  const tpl = path.join(ROOT, 'templates', zh ? 'starter-zh' : 'starter');
  const size = flags.size || '16:9';
  resolveSize(size);
  // Chinese videos: Traditional Chinese captions on, no watermark.
  const config = zh ? { title, theme, size, voice, music: true, captions: true, watermark: false } : { title, theme, size, voice, music: true, captions: 'auto' };
  if (flags.pace !== undefined) config.pace = num(flags.pace, 'pace');
  normalizeConfig(config);
  fs.writeFileSync(path.join(target, 'video.json'), JSON.stringify(config, null, 2) + '\n');
  fs.writeFileSync(path.join(target, 'script.md'), fs.readFileSync(path.join(tpl, 'script.md'), 'utf8').replace('{{title}}', title));
  fs.writeFileSync(path.join(target, 'scenes.js'), fs.readFileSync(path.join(tpl, 'scenes.js'), 'utf8').replace(/\{\{title\}\}/g, title.replace(/'/g, "\\'")));
  fs.writeFileSync(path.join(target, '.gitignore'), 'build/\nout/\n');
  print(`created ${target}\nnext: edit script.md and scenes.js, then run "explainroo preview ${dir}" or "explainroo render ${dir} --draft"`, { dir: target });
  return 0;
}

async function preview(dir, flags, log) {
  let project = loadProject(dir);
  let { timeline } = await prepare(project, { log });
  let state = makeState(project, timeline);
  let lastError = null;
  const server = await startServer({ projectDir: project.dir, getState: () => (lastError ? { ...state, error: lastError } : state), port: num(flags.port, 'port') ?? 4400 });
  log(`preview: ${server.url}  (Ctrl+C to stop)`);
  const watched = ['video.json', 'script.md'];
  const stamp = () => watched.map((f) => { try { return fs.statSync(path.join(project.dir, f)).mtimeMs; } catch { return 0; } }).join(':');
  let last = stamp();
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    const now = stamp();
    busy = true;
    try {
      if (now !== last) {
        last = now;
        log('script or settings changed, updating narration');
        project = loadProject(project.dir);
        ({ timeline } = await prepare(project, { log }));
        lastError = null;
      }
      state = makeState(project, timeline);
    } catch (e) {
      lastError = e.message;
      log(`error: ${e.message}`);
    } finally {
      busy = false;
    }
  }, 700);
  await new Promise((resolve) => {
    const stop = () => resolve();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
  clearInterval(timer);
  await server.close();
  return 0;
}

async function say(text, flags, log, print) {
  if (!text) throw new ProjectError('usage: explainroo say "text to speak" [--voice af_heart] [--speed 1] [--pitch 0 (Hz, zh-TW voices)] [--out sample.wav]');
  const voice = flags.voice || 'af_heart';
  if (!VOICES[voice]) throw new ProjectError(`voice "${voice}" does not exist. Run "explainroo voices".`);
  const speed = num(flags.speed, 'speed') ?? 1;
  const out = path.resolve(flags.out || `${voice.replace(/[^\w-]/g, '_')}.wav`);
  if (isZhVoice(voice)) {
    writeWav(out, (await zhSpeak(text, voice, speed, num(flags.pitch, 'pitch') ?? 0)).audio, TTS_SAMPLE_RATE);
  } else {
    const tts = await loadTTS({ log });
    const audio = await tts.generate(text, { voice, speed });
    writeWav(out, audio.audio, audio.sampling_rate || TTS_SAMPLE_RATE);
  }
  print(out, { file: out, voice });
  return 0;
}

function icons(words, print) {
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine', 'icons', 'lucide-tags.json'), 'utf8'));
  const { aliases = {} } = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine', 'icons', 'lucide.json'), 'utf8'));
  for (const [alias, target] of Object.entries(aliases)) all[target] = [...(all[target] || []), alias.replace(/-/g, ' ')];
  const q = words.map((w) => w.toLowerCase());
  if (!q.length) {
    print(`${Object.keys(all).length} icons. Search with: explainroo icons <word…>`, { count: Object.keys(all).length });
    return 0;
  }
  const scored = Object.entries(all)
    .map(([name, tags]) => {
      let score = 0;
      for (const w of q) {
        if (name === w) score += 10;
        else if (name.split('-').includes(w)) score += 6;
        else if (name.includes(w)) score += 3;
        if (tags.some((t) => t === w)) score += 4;
        else if (tags.some((t) => t.includes(w))) score += 1;
      }
      return { name, score, tags };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 40);
  print(scored.map((x) => `${x.name.padEnd(28)} ${x.tags.slice(0, 6).join(', ')}`).join('\n') || 'no matches', { icons: scored.map((x) => x.name) });
  return 0;
}

async function doctor(flags, log, print) {
  const rows = [];
  const add = (name, ok, detail) => rows.push({ name, ok, detail });
  // The voice library (kokoro-js) needs import.meta.dirname, added in Node 20.11.
  const [maj, min] = process.versions.node.split('.').map(Number);
  const nodeOk = maj > 20 || (maj === 20 && min >= 11);
  add('node', nodeOk, `v${process.versions.node}${nodeOk ? '' : ' (need 20.11 or newer)'}`);
  const ff = ffmpegVersion();
  add('ffmpeg', !!ff, ff || 'not found; install ffmpeg or set EXPLAINROO_FFMPEG');
  try {
    add('chrome', true, findChrome());
  } catch (e) {
    add('chrome', false, e.message);
  }
  const models = path.join(cacheRoot(), 'models', 'onnx-community');
  const has = (n) => fs.existsSync(path.join(models, n));
  if (flags.fetch) {
    log('downloading speech models (about 400 MB the first time)');
    await loadTTS({ log });
    await loadASR({ log });
  }
  add('voice model', has('Kokoro-82M-v1.0-ONNX'), has('Kokoro-82M-v1.0-ONNX') ? `Kokoro 82M (${ttsDtype()}) in ${models}` : 'not downloaded yet; "explainroo doctor --fetch" or the first voice run fetches it');
  add('speech check model', has('whisper-base.en_timestamped'), has('whisper-base.en_timestamped') ? 'Whisper base.en' : 'not downloaded yet; fetched on first use');
  try {
    add('zh-TW voices', true, `edge-tts through: ${edgeTTSCommand().slice(0, 6).join(' ')}`);
  } catch (e) {
    add('zh-TW voices', false, `${e.message} (optional, only for Chinese videos)`);
  }
  const ok = rows.every((r) => r.ok || r.name.includes('model') || r.name.startsWith('zh-TW'));
  print(rows.map((r) => `${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(20)} ${r.detail}`).join('\n'), { ok, checks: rows });
  return ok ? 0 : 1;
}
