# 待辦清單 (Backlog)

這裡列出台灣版接下來可以做的功能。動工前先照 [feature-workflow.md](feature-workflow.md) 寫 plan。
優先順序：P1 最重要，P3 有空再做。

| # | 優先 | 功能 | 為什麼需要 | 初步想法 |
|---|---|---|---|---|
| 1 | P1 | 中文發音自動檢查 | 現在 `verify` 對中文會跳過，破音字念錯只能靠人耳聽出來 | 換用多語版 Whisper（例如 `whisper-small_timestamped`）並指定 `language: 'zh'`，辨識結果轉成繁體後逐字比對。要先評估模型大小和速度 |
| 2 | P1 | 完整的繁簡和用語檢查 | 目前的 `src/zhlint.js` 只有常見字表 | 評估 `opencc-js`（Apache-2.0）的 `cn→tw` 和 `tw→twp` 轉換：轉換前後有差異就表示有簡體字或中國用語 |
| 3 | P2 | 隨附 Noto Sans TC 字型 | 非 macOS 環境的中文字型不一定一樣，render 出來的結果會不同 | 在 `fonts/` 放子集化的 Noto Sans TC（OFL 授權），由 `CJK_FONTS` 優先使用 |
| 4 | P2 | 破音字字典 | 「行」「長」「重」等字常念錯，每次都要手寫 `{字|念法}` | 專案可以放一個 `pronunciations.json`，`voice` 送出前自動替換 |
| 5 | P2 | 匯出 SRT 字幕 | YouTube 可以上傳 CC 字幕，比燒進畫面更好用 | 從 timeline 的 words 和 subs 輸出 `out/video.zh-TW.srt`、`out/video.en.srt` |
| 6 | P3 | 直式影片的雙語字幕版面 | Shorts 和 Reels 的字幕區比較窄，英文行可能被縮得太小 | 英文行可以換成兩行；`layout.js` 的字幕區高度要跟著調整 |
| 7 | P3 | 台語、客語旁白 | 台灣在地內容可能需要 | 先查有沒有可用的 TTS 和授權，例如 Edge 目前沒有台語語音 |
| 8 | P3 | 逐句語氣標記 | Edge 台灣語音沒有情緒風格，整支影片只能用同一個 `pitch` 和速度 | 例如 `[tone up]`、`[rate +10%]` 這類句內標記，一個 chunk 用一組 rate 和 pitch。要先實測聽感 |
| 9 | P3 | 中文 `enter: 'sync'` 驗證 | 程式碼看起來可以逐字同步，但沒有實際驗證 | 用範例專案拍幾張截圖確認 |

## 已完成

| 版本 | 功能 |
|---|---|
| 0.1.1-zh.1 | zh-TW 語音、逐字對齊、雙語字幕、中文換行、台灣用語檢查、`init --lang zh-TW` |
| 0.1.1-zh.2 | `pitch` 設定、自動偵測 macOS 已安裝的 zh_TW 語音、`……` 停頓、標點和口語檢查、台灣口語寫作規則、README 改寫 |
