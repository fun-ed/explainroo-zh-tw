# explainroo 台灣版 (zh-TW)

[English](#english) · [繁體中文](#繁體中文)

這是 [vincentsch/explainroo](https://github.com/vincentsch/explainroo) 的 fork。
上游會用你的 coding agent 寫腳本、畫動畫，最後輸出有旁白的 MP4 解說影片。
這個 fork 讓它可以做出**全程繁體中文**的影片：台灣口音的語音、台灣用語、繁中與中英雙語字幕。

---

## 繁體中文

### 跟上游有什麼不同

| 功能 | 上游 | 台灣版 |
|---|---|---|
| 旁白語音 | Kokoro 英文語音 | 另外加上台灣口音的 Edge 神經語音（`zh-TW-HsiaoChenNeural` 等），以及 macOS 內建的 zh_TW 語音 |
| 字詞時間點 | Whisper 英文辨識 | 中文直接用語音服務回傳的斷詞時間，逐字對齊 |
| 腳本 | 以空白切詞 | 中文逐字切開，`s.cue('雷達')` 可以對到中文 |
| 字幕 | 英文 | 繁中字幕，句尾不放「，」「。」；加上 `[en: ...]` 就是中英雙語 |
| 畫面文字 | 只在空白處換行 | 中文可以逐字換行，字型會退回 PingFang TC 或 Noto Sans TC |
| 檢查 | 版面、時間、英文發音 | 另外檢查簡體字和中國用語，例如「视频」會建議改成「影片」 |
| 新專案 | `init` | `init --lang zh-TW` 會用台灣語音、開字幕、關 watermark |

### 快速開始

```bash
git clone https://github.com/fun-ed/explainroo-zh-tw.git
cd explainroo-zh-tw
npm install
node bin/explainroo.js doctor --fetch     # 會檢查 zh-TW 語音能不能用

node bin/explainroo.js init videos/demo --lang zh-TW --theme paper --title "點連結之後"
node bin/explainroo.js voice videos/demo
node bin/explainroo.js check videos/demo
node bin/explainroo.js render videos/demo
```

也可以直接跟 coding agent 說：「用 explainroo 做一支 3 分鐘的繁體中文影片，主題是……」。
agent 會讀 [AGENTS.md](AGENTS.md) 裡的「Traditional Chinese (Taiwan) videos」一節，照那裡的流程做。

### 腳本範例

```markdown
## hook
1976 年 7 月，收音機突然傳出奇怪的聲音。[en: In July 1976, radios picked up a strange sound.]
[#tap] 它叫做 {Duga|杜加}，俄文的意思是「弧」。[en: It was called Duga, which means arc.]
```

- `[en: ...]` 寫在句子後面，是那一句的英文字幕。不寫的話就只有中文字幕。
- `{畫面文字|念法}` 可以修正英文名字的念法，也可以修正念錯的破音字。
- 中文之間的空白（例如 `[#marker]` 前後）不會變成字幕裡的空格。

### 語音選擇

| 語音 | 說明 |
|---|---|
| `zh-TW-HsiaoChenNeural`（預設） | 女聲，Microsoft Edge 線上語音，有精確的時間點 |
| `zh-TW-HsiaoYuNeural`、`zh-TW-YunJheNeural` | 女聲、男聲，同一個服務 |
| `say:Meijia`、`say:Flo`、`say:Eddy`… | macOS 內建，離線可用，時間點用字數估算 |

Edge 語音需要網路和 Python 套件 `edge-tts`。有裝 `uv` 的話，會自動用固定版本執行。
**旁白文字會送到 Microsoft 的語音服務。** 如果內容不能外流，請改用 `say:` 開頭的離線語音。

### 已知限制

- 語音辨識檢查（Whisper base.en）只懂英文，所以中文影片不會自動驗證發音，請自己聽一遍。
- 簡體字和中國用語檢查只用常見字表，沒有接完整的繁簡轉換。
- 中文字型依賴系統。macOS 有 PingFang TC，其他系統需要安裝 Noto Sans TC。

### 維護

- 同步上游：[zh-tw/sync-operation.md](zh-tw/sync-operation.md)
- 加新功能：[zh-tw/feature-workflow.md](zh-tw/feature-workflow.md)、待辦清單 [zh-tw/TASKS.md](zh-tw/TASKS.md)
- 版本紀錄：[zh-tw/CHANGELOG.md](zh-tw/CHANGELOG.md)

### 授權

MIT，跟上游相同。原作者是 Vincent Schmalbach，見 [LICENSE](LICENSE)。
這個 fork 的改動也用 MIT 授權。

---

## English

A fork of [vincentsch/explainroo](https://github.com/vincentsch/explainroo) that makes
**fully Traditional Chinese (Taiwan) explainer videos**: Taiwan Mandarin narration, Taiwan
wording, and Traditional Chinese or bilingual Chinese/English captions.

### What this fork adds

- **Taiwan Mandarin voices.** Microsoft Edge neural voices (`zh-TW-HsiaoChenNeural`,
  `zh-TW-HsiaoYuNeural`, `zh-TW-YunJheNeural`) through the `edge-tts` Python package, plus the
  offline macOS `zh_TW` voices (`say:Meijia`, ...).
- **Per-character timing.** Chinese narration is split per character and timed from the voice's
  own word boundaries, so `s.cue('雷達')` and `[#markers]` work in Chinese.
- **Bilingual captions.** Write `[en: ...]` after a sentence to show its English line under the
  Chinese caption. Captions drop ，and 。 the way Taiwanese subtitles do.
- **Chinese screen text.** Chinese titles and labels wrap between characters, `*stars*` work
  inside Chinese, and text falls back to a Traditional Chinese font.
- **Taiwan wording check.** `check` flags Simplified characters and common mainland words.
- **`init --lang zh-TW`** sets the voice, turns captions on and the watermark off.

### Quick start

```bash
npm install
node bin/explainroo.js init videos/demo --lang zh-TW --title "點連結之後"
node bin/explainroo.js render videos/demo
```

The Edge voices send the narration text to Microsoft's speech service and need internet. Use a
`say:` voice to stay offline on macOS.

### Known limits

The speech check (Whisper base.en) is English only, so Chinese narration is not checked
automatically. The wording check uses a short list, not a full converter.

### Maintenance

[Syncing upstream](zh-tw/sync-operation.md) · [Feature workflow](zh-tw/feature-workflow.md) ·
[Tasks](zh-tw/TASKS.md) · [Changelog](zh-tw/CHANGELOG.md)

MIT licensed, like upstream (© Vincent Schmalbach). See [LICENSE](LICENSE).
