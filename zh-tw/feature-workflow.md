# 新功能流程：Plan → Design → Task

每個新功能都走三個步驟，文件放在 `zh-tw/plans/<日期>-<名稱>.md`，一個功能一個檔案。
小修正（一兩行、沒有行為改變）可以跳過，直接寫進 CHANGELOG。

## 1. Plan：要解決什麼

先把問題講清楚，還不要碰程式碼。

- **問題**：使用者遇到什麼狀況？要舉一個具體例子。
- **目標**：做完之後，什麼事情會變得可以做？
- **不做什麼**：這次明確排除的範圍。
- **怎麼算完成**：可以驗證的條件，例如「`check` 會抓到 X」「影片的字幕會顯示 Y」。

## 2. Design：要怎麼做

- **改哪些檔案**：優先寫新檔案（`src/zh*.js`）。動到上游檔案時，列出每個掛勾，並更新 [sync-operation.md](sync-operation.md) 的「衝突熱點」表格。
- **資料怎麼流**：從 `script.md` 到 voice、timeline、engine，資料在哪一層產生、在哪一層使用。
- **相容性**：英文專案的行為必須完全不變。要說明怎麼確保。
- **外部依賴**：要加新套件或新服務時，說明原因、授權、隱私問題（會不會把資料送到外部），以及離線時的替代方案。
- **其他方案**：想過但沒選的做法，用一兩句說明為什麼不選。

## 3. Task：拆成可以驗證的步驟

每個 task 都要寫驗證方法，做完就打勾。

```markdown
- [ ] T1 在 src/zhxxx.js 加上 ……（驗證：test/zh.test.js 新增的測試會通過）
- [ ] T2 在 src/qa.js 呼叫 ……（驗證：check 對範例專案輸出 ……）
- [ ] T3 更新 AGENTS.md 繁中那一節
- [ ] T4 更新 README.md、CHANGELOG.md
- [ ] T5 跑完 sync-operation.md 的驗證清單
```

## 完成的定義

- `npm test` 全部通過，包含新加的測試。
- 英文 starter 專案的 `render --draft` 跟改動前一樣。
- 中文 starter 專案的 `check` 沒有錯誤，截圖要看過。
- 文件已更新：AGENTS.md（給 agent 看）、README.md（給使用者看）、CHANGELOG.md。
- 如果動到上游檔案，sync-operation.md 的衝突熱點表格也要更新。

## 範本

把下面複製到 `zh-tw/plans/YYYY-MM-DD-<名稱>.md`：

```markdown
# <功能名稱>

狀態：草稿 / 設計中 / 實作中 / 完成
對應任務：TASKS.md 的 #<編號>

## Plan
- 問題：
- 目標：
- 不做什麼：
- 怎麼算完成：

## Design
- 改哪些檔案：
- 資料怎麼流：
- 相容性：
- 外部依賴：
- 其他方案：

## Tasks
- [ ] T1 …（驗證：…）
```
