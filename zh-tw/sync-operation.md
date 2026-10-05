# 同步上游 (Sync operation)

這份文件說明怎麼把 [vincentsch/explainroo](https://github.com/vincentsch/explainroo) 的更新手動合併回這個 fork，以及平常怎麼維護才能讓同步順利。

## Remote 設定

| Remote | URL | 用途 |
|---|---|---|
| `origin` | `https://github.com/fun-ed/explainroo-zh-tw.git` | 這個 fork，可以 push |
| `upstream` | `https://github.com/vincentsch/explainroo.git` | 上游，只 fetch |

第一次 clone 之後要設定 upstream：

```bash
git remote add upstream https://github.com/vincentsch/explainroo.git
git remote set-url --push upstream DISABLED   # 避免不小心 push 到上游
git remote -v
```

## 分支規則

- `main`：fork 的主線，等於「上游 main ＋ 台灣版改動」。
- 用 **merge** 同步上游，**不要 rebase、不要 force push**。`main` 已經公開，改寫歷史會弄壞別人的 clone。
- 每次同步都開一條 `sync/upstream-YYYYMMDD` 分支，確認沒問題後再併回 `main`。

## 同步步驟

```bash
# 1. 確認工作區乾淨
git status --short
git switch main
git pull --ff-only origin main

# 2. 看上游多了什麼
git fetch upstream
git log --oneline main..upstream/main
git diff --stat main...upstream/main

# 3. 在同步分支上合併
git switch -c "sync/upstream-$(date +%Y%m%d)"
git merge --no-ff upstream/main -m "Merge upstream explainroo $(git rev-parse --short upstream/main)"

# 4. 有衝突就照下面的「衝突熱點」處理，然後
git add -A && git commit        # 只有衝突時才需要

# 5. 驗證（見下一節）

# 6. 併回 main 並 push
git switch main
git merge --ff-only "sync/upstream-$(date +%Y%m%d)"
git push origin main
git branch -d "sync/upstream-$(date +%Y%m%d)"
```

最後在 [CHANGELOG.md](CHANGELOG.md) 記下這次同步到的上游版本和 commit。

## 驗證清單

每次同步後都要跑，全部通過才能 push：

```bash
npm install                      # 上游可能改了相依套件
npm test                         # 包含 test/zh.test.js
node bin/explainroo.js doctor

# 英文流程沒壞
node bin/explainroo.js init videos/sync-en --title "Sync check"
node bin/explainroo.js render videos/sync-en --draft

# 中文流程沒壞
node bin/explainroo.js init videos/sync-zh --lang zh-TW --title "同步檢查"
node bin/explainroo.js check videos/sync-zh
node bin/explainroo.js still videos/sync-zh steps@5
```

打開 `videos/sync-zh/out/stills/steps@5.png`，確認以下幾點：

- 中文字幕正常，沒有出現 `[object Object]`，沒有多餘的空格。
- 有寫 `[en:]` 的句子，英文字幕顯示在中文下面。
- 畫面上的中文標題沒有變成方塊或亂碼。

`videos/` 已經寫在 `.gitignore`，驗證用的專案不會被 commit。

## 衝突熱點

台灣版的改動盡量放在**新檔案**，上游檔案只留下很小的「掛勾」。發生衝突時，原則是**先接受上游的版本，再把我們的掛勾加回去**。

### 只屬於 fork 的檔案（上游不會改）

| 檔案 | 內容 |
|---|---|
| `src/zhvoice.js` | zh-TW 語音、Edge 和 macOS say、逐字對齊 `alignChars` |
| `src/zhlint.js` | 簡體字和中國用語檢查 |
| `scripts/edge_speak.py` | 呼叫 edge-tts 並輸出斷詞時間。檔名不能叫 `edge_tts.py`，否則會蓋掉套件名稱 |
| `templates/starter-zh/` | 繁中範本 |
| `test/zh.test.js` | 中文相關測試 |
| `zh-tw/` | fork 的維護文件 |

### 有掛勾的上游檔案

| 檔案 | 我們改了什麼 | 衝突時怎麼處理 |
|---|---|---|
| `src/script.js` | `HAN`、`ZH_PIECE`、`SENTENCE_END` 常數；`normWord` 保留漢字；`tokenizeNarration` 逐字切中文、`[en:]` 單元、中文之間不加空格；`parseScript` 產生 `sent` 和 `subs`；`speechChunks` 中文不加空格 | 最容易衝突。保留上游的新邏輯，再把這幾處加回去。`test/zh.test.js` 第一個測試會抓到漏掉的地方 |
| `src/voice.js` | `PIPELINE` 版本號加 1；中文語音不用 Kokoro 和 Whisper；words 帶 `space` 和 `sent` | `PIPELINE` 取「上游值＋1」，讓語音快取重建 |
| `src/models.js` | `VOICES` 合併 `ZH_VOICES` | 上游新增語音時，保留 `...ZH_VOICES` 這一行 |
| `src/project.js` | zh 語音預設 `speed` 為 1 | 只有一行 |
| `src/qa.js` | `check` 呼叫 `zhIssues`；`verify` 對中文語音跳過英文語音檢查 | 保留兩個 `isZhVoice` 判斷 |
| `src/timeline.js` | words 帶 `space` 和 `sent`；scene 帶 `subs` | 只有兩行 |
| `src/cli.js` | `init --lang zh-TW`、`say` 支援 zh、`doctor` 檢查 edge-tts、`voices` 欄寬 | 上游改 CLI 時重新套用 |
| `engine/captions.js` | `visualLength`、`captionText`、雙語第二行、`gaps` | 上游改字幕繪製時要整段重新檢查 |
| `engine/text.js` | `parseRich` 遇到漢字逐字切開；`layoutText` 中文字之間不加間距（`tight`） | |
| `engine/util.js`、`engine/stage.js` | `normWord` 保留漢字；新增 `cueTokens`；`_cue` 改用它 | |
| `engine/themes.js`、`engine/ui.js` | 字型 fallback 加上 `CJK_FONTS` | |
| `AGENTS.md` | 「Traditional Chinese (Taiwan) videos」一整節，放在「Sizes for each platform」前面 | 保留上游內容，把整節貼回去 |
| `README.md` | 整份改寫成 fork 的雙語 README | 一律保留我們的版本：`git checkout --ours README.md`。再看一下上游 README 的 diff，有新的安裝需求或指令就補進來 |

### 找出所有掛勾

```bash
git diff upstream/main...main --stat
git diff upstream/main...main -- src engine | less
```

## 出問題時怎麼還原

| 狀況 | 指令 |
|---|---|
| 合併到一半想放棄 | `git merge --abort` |
| 同步分支還沒併回 main | 直接刪掉分支：`git switch main && git branch -D sync/upstream-YYYYMMDD` |
| 已經 push 到 main 才發現壞了 | `git revert -m 1 <merge-commit>`，然後 push。不要 reset 或 force push |

## 讓同步變輕鬆的習慣

1. 新功能盡量寫在新檔案，上游檔案只加 import 和一兩行呼叫。
2. 每個掛勾都要有測試覆蓋（`test/zh.test.js`）。這樣同步後漏掉的掛勾會讓測試失敗，不會悄悄壞掉。
3. 不重新排版上游檔案，不改上游的命名。
4. 可以通用的修正（例如跟中文無關的 bug），考慮直接回饋給上游，fork 就能少維護一段 diff。
5. 定期同步，例如每月一次或上游發新版時。差距越小，衝突越少。
