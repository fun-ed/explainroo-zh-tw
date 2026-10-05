# Changelog（台灣版）

這裡只記錄台灣版 fork 自己的改動和同步紀錄。上游的改動請看 [vincentsch/explainroo](https://github.com/vincentsch/explainroo/commits/main)。

版本格式是 `<上游版本>-zh.<fork 序號>`，例如 `0.1.1-zh.1`。
上游發新版後，序號從 1 重新開始。

## [Unreleased]

## [0.1.1-zh.1] - 2026-10-05

基於上游 `0.1.1`（commit `5347905`）。

### Added
- Taiwan Mandarin narration：Edge 神經語音（`zh-TW-HsiaoChenNeural`、`zh-TW-HsiaoYuNeural`、`zh-TW-YunJheNeural`）透過 `edge-tts` 7.2.8 產生，並加上 macOS 內建的 zh_TW 離線語音（`say:Meijia` 等）。
- 中文旁白逐字切開，用語音服務回傳的斷詞時間逐字對齊（`src/zhvoice.js`）。
- `[en: ...]` 語法：在中文字幕下面顯示那一句的英文字幕。
- 繁中字幕照台灣習慣，句尾不放「，」「。」，改用空白隔開。
- 畫面上的中文逐字換行，`*強調*` 在中文裡也能用；字型 fallback 加上 PingFang TC、Noto Sans TC、Microsoft JhengHei。
- `check` 會抓簡體字和常見的中國用語（`src/zhlint.js`）。
- `init --lang zh-TW`：使用台灣語音，開字幕，關 watermark，套用 `templates/starter-zh` 範本。
- `say`、`voices`、`doctor` 支援 zh-TW 語音。
- AGENTS.md 新增「Traditional Chinese (Taiwan) videos」一節。
- `test/zh.test.js` 新增 5 個測試。

### Changed
- `s.cue()` 可以對到中文詞（`cueTokens`）。
- `verify` 對中文語音跳過只懂英文的語音檢查，改成顯示提示。
- 語音快取的 `PIPELINE` 從 7 升到 8，舊專案第一次執行 `voice` 時會重新產生語音。

### Sync
- 從上游 `main` @ `5347905`（v0.1.1）建立 fork。
