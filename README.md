<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/logo-dark.png">
    <img src="docs/media/logo-light.png" alt="explainroo" width="300">
  </picture>
</p>

<p align="center">
  <b>讓 AI agent 幫你做解說影片，支援台灣口音繁中旁白和中英雙語字幕。</b><br>
  Explainer videos made by your AI agent, with Taiwan Mandarin narration and bilingual captions.
</p>

<p align="center">
  <a href="#繁體中文">繁體中文</a> · <a href="#english">English</a> · <a href="AGENTS.md">AGENTS.md</a> ·
  上游 upstream: <a href="https://github.com/vincentsch/explainroo">vincentsch/explainroo</a>
</p>

---

## 繁體中文

這是 [explainroo](https://github.com/vincentsch/explainroo) 的台灣版 fork。
agent 會寫好旁白腳本（`script.md`）和畫面（`scenes.js`），explainroo 負責配音、對時、畫圖、配樂，最後輸出 MP4。

### 1. 安裝

需要先裝好的東西：

| 項目 | 用途 | macOS 安裝方式 |
|---|---|---|
| Node.js 20.11 以上 | 執行 explainroo | `brew install node` |
| ffmpeg | 合成影片 | `brew install ffmpeg` |
| Chrome 或 Chromium | 在背景畫影格 | 已有 Chrome 就不用裝；沒有的話跑 `npx playwright install chromium-headless-shell` |
| uv（做中文影片才需要） | 執行 Edge 中文語音 | `brew install uv`；或改用 `pip install edge-tts==7.2.8` |

```bash
git clone https://github.com/fun-ed/explainroo-zh-tw.git
cd explainroo-zh-tw
npm install
node bin/explainroo.js doctor          # 檢查環境，zh-TW voices 那一行要是 ok
node bin/explainroo.js doctor --fetch  # 只有做英文影片才需要，會下載英文語音模型
```

### 2. 會安裝哪些東西

全部都裝在專案資料夾或使用者的 cache 目錄，不會裝全域套件。

| 東西 | 位置 | 大小 | 什麼時候需要 |
|---|---|---|---|
| npm 套件（Transformers.js、kokoro-js、playwright-core、Rough.js） | `node_modules/` | 約 490 MB | 一定需要 |
| Kokoro 英文語音、Whisper 英文辨識模型 | `~/.cache/explainroo/models/` | 約 400 MB | 只有英文影片需要，中文影片完全不會用到 |
| edge-tts 7.2.8 和它的相依套件（Python） | `~/.cache/uv/`（由 uv 管理） | 很小 | 中文影片第一次產生語音時自動下載 |
| macOS zh_TW 語音（Meijia 等） | 系統內建 | 不用另外裝 | 選擇離線中文語音時才用 |

> [!NOTE]
> Edge 中文語音會把**旁白文字**送到 Microsoft 的語音服務，所以需要網路。
> 內容不能外流的話，請在 `video.json` 改用離線語音 `"voice": "say:Meijia"`。這只在 macOS 上可用，字的時間點是估算的。

### 3. 使用方式

**最簡單的方式：直接跟 coding agent 說。** 在專案資料夾裡啟動 agent（例如 Claude Code），選一種貼上：

```text
# 純繁中字幕
用 explainroo 做一支 3 分鐘的繁體中文解說影片，主題是〔主題〕。
讀 AGENTS.md 的 Traditional Chinese (Taiwan) videos，用 --lang zh-TW，只要繁中字幕。

# 中英雙語字幕
用 explainroo 做一支 3 分鐘的繁體中文解說影片，主題是〔主題〕。
讀 AGENTS.md 的 Traditional Chinese (Taiwan) videos，用 --lang zh-TW，每句加 [en: ...] 英文字幕。
```

**自己下指令：**

```bash
node bin/explainroo.js init videos/demo --lang zh-TW --theme paper --title "點連結之後"
node bin/explainroo.js voice  videos/demo   # 產生語音和每個字的時間點
node bin/explainroo.js check  videos/demo   # 檢查版面、簡體字、中國用語
node bin/explainroo.js sheet  videos/demo   # 一張圖看整部影片的縮圖
node bin/explainroo.js render videos/demo   # 輸出 videos/demo/out/video.mp4
```

`init --lang zh-TW` 會用 HsiaoChen 女聲、開字幕、關 watermark，並建立有中英雙語範例的腳本。

### 4. 腳本寫法：純中文或中英雙語

```markdown
## hook
1976 年 7 月，收音機突然傳出奇怪的聲音。[en: In July 1976, radios picked up a strange sound.]
[#tap] 它叫做 {Duga|杜加}，俄文的意思是「弧」。[en: It was called Duga, which means arc.]
```

| 想要的效果 | 寫法 |
|---|---|
| 純繁中字幕 | 不要寫 `[en: ...]` |
| 中英雙語字幕 | 每一句後面加 `[en: 英文翻譯]` |
| 英文名字念成中文 | `{Duga|杜加}` |
| 修正念錯的破音字 | `{畫面上的字|念法}` |
| 畫面在某個時間點出現 | 句子裡放 `[#name]`，或在 scenes.js 用 `s.cue('雷達')` |

### 5. 讓中文影片更好的小技巧

- **像台灣人在聊天。** 對觀眾說「你」，用「所以、不過、結果、其實」接話。語助詞（喔、啦、耶、齁）一個場景用一兩個就好。
- **用台灣用語。** 寫影片、軟體、網路、資訊、伺服器、飛彈，不寫咱們、啥、咋。`check` 會抓出簡體字、中國用語和半形標點。
- **用標點控制節奏。** ，和 —— 是短暫換氣（約 0.4 秒），…… 是拉長的停頓（0.5 秒），～ 只表示語氣、不會念出來，`[pause 0.8]` 是刻意的停頓。引號用「」。
- **數字和單位寫成念法。** `一百五十公尺`、`七到十九兆赫` 比 `150 m` 念得自然。年份可以直接寫 `1976 年`。
- **句子要短。** 兩個標點之間大約 10 到 20 個字，超過 30 字 `check` 會提醒。字幕會在句尾和逗號處換段，雙語時中文保持一行，英文放在下面。
- **英文字幕也要短。** 太長的英文會被縮小字體塞進一行。
- **長度怎麼算。** 每秒大約 4 到 5 個字，3 分鐘大約 750 字。解說影片的 `pace` 用 1 到 1.1，節奏快的短影音用 1.15 到 1.25。
- **換聲音。** `node bin/explainroo.js voices` 會列出所有語音，包括這台 Mac 已安裝的 zh_TW 語音。男聲用 `zh-TW-YunJheNeural`，另一個女聲是 `zh-TW-HsiaoYuNeural`。
- **調整音高和速度。** 在 `video.json` 設定 `"pitch": -20`（單位 Hz，範圍 -50 到 50），`speed` 和 `pace` 控制語速。Edge 和 macOS 語音都適用，但都沒有情緒風格可以選。
- **讓離線語音更好聽。** 到「系統設定 → 輔助使用 → 朗讀內容 → 系統聲音 → 管理聲音 → 中文（台灣）」下載 Meijia 的加強版或高品質版，再用 `voices` 裡顯示的名稱，例如 `"voice": "say:Meijia (Premium)"`。
- **試聽一句。** `node bin/explainroo.js say "測試句子" --voice zh-TW-HsiaoChenNeural --pitch -20`。
- **直式影片。** 加上 `--size shorts`、`tiktok` 或 `reels`。直式的字幕區比較窄，雙語時英文會比較小。

### 6. 已知限制

- 自動發音檢查只懂英文。中文影片 render 完要自己聽一遍。
- 簡體字和中國用語的檢查只用常見字表，不是完整的轉換器。
- 中文字型依賴系統：macOS 用 PingFang TC，Linux 請裝 Noto Sans TC（`fonts-noto-cjk`）。
- 台灣語音沒有情緒風格（例如開心、嚴肅），語氣只能靠用詞、標點、`pitch` 和速度來調。

### 7. 維護文件

[同步上游](zh-tw/sync-operation.md) · [新功能流程](zh-tw/feature-workflow.md) · [待辦清單](zh-tw/TASKS.md) · [版本紀錄](zh-tw/CHANGELOG.md)

---

## English

A Taiwan fork of [explainroo](https://github.com/vincentsch/explainroo). Your coding agent writes
`script.md` (narration) and `scenes.js` (drawings). explainroo adds the voice, timing, drawings and
music, and renders an MP4. This fork adds Taiwan Mandarin narration, per-character timing,
Traditional Chinese or bilingual captions, and a Taiwan wording check.

### Install

Needs Node.js 20.11+, ffmpeg, and Chrome or Chromium. Chinese videos also need `uv`, or
`pip install edge-tts==7.2.8`.

```bash
git clone https://github.com/fun-ed/explainroo-zh-tw.git
cd explainroo-zh-tw
npm install
node bin/explainroo.js doctor --fetch   # --fetch downloads the English voice models (~400 MB)
```

What gets installed: npm packages in `node_modules/` (~490 MB), English voice and speech models
in `~/.cache/explainroo/models/` (English videos only), and edge-tts in uv's cache on the first
Chinese voice run. Nothing is installed globally.

### Use

Tell your agent, from inside the repo:

```text
Make a 2 minute explainer video about [topic]. Use explainroo: read AGENTS.md and follow the steps.
# Chinese: add "Use --lang zh-TW, with [en: ...] English subtitles" for bilingual captions.
```

Or run it yourself:

```bash
node bin/explainroo.js init videos/demo --title "How DNS works"        # English
node bin/explainroo.js init videos/demo-zh --lang zh-TW --title "DNS"  # Traditional Chinese
node bin/explainroo.js render videos/demo-zh                            # -> out/video.mp4
```

- English videos: Kokoro voices, fully offline. `voices` lists them.
- Chinese videos: Edge zh-TW neural voices send the narration text to Microsoft's speech service.
  `"voice": "say:Meijia"` stays offline on macOS, with estimated word timing.
- Bilingual captions: write `[en: ...]` after each Chinese sentence.
- Voice tuning for zh-TW: `"pitch": -20` (Hz), `speed`, `pace`; punctuation sets pauses (`，` short, `……` 0.5 s). `voices` also lists the macOS zh_TW voices installed, including Premium ones.
- Looks: `paper`, `clean`, `chalk`, `blueprint`, `midnight`. Sizes: `youtube`, `shorts`,
  `tiktok`, `reels`, `instagram`, `square`. Speed: `"pace": 1.2` in `video.json`.
- The watermark is on by default for English projects; `"watermark": false` turns it off.

Full reference for agents: [AGENTS.md](AGENTS.md). Upstream docs: [explainroo.com/docs](https://www.explainroo.com/docs/).

### License

MIT, same as upstream (© Vincent Schmalbach); see [LICENSE](LICENSE). Built on
[Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), [Whisper](https://github.com/openai/whisper)
via [Transformers.js](https://github.com/huggingface/transformers.js),
[edge-tts](https://github.com/rany2/edge-tts), [Rough.js](https://roughjs.com),
[Lucide](https://lucide.dev), [Playwright](https://playwright.dev) and [ffmpeg](https://ffmpeg.org).
Fonts are under the SIL Open Font License.
