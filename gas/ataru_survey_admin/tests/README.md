# tests

Google Apps Script は `node:test` を直接実行できないため、この管理者GAS
プロジェクトに関する自動テストの実体はリポジトリルートの `test/` に置いている。

- `test/admin-readonly.test.js` — このディレクトリの `.gs` ファイルへ、禁止された
  書き込みメソッド（`appendRow` / `setValue` / `setValues` / `clear` /
  `clearContent` / `deleteRow` / `deleteRows` / `deleteSheet` / `insertRow` /
  `insertRows`）が存在しないことを静的検査する。
- `test/schema.test.js` / `test/sync.test.js` / `test/target-count.test.js` /
  `test/cross-target-count.test.js` — `SurveySchema.gs` の生成元である
  `survey-schema.json` 自体と、そこから導出される集計ロジックを検証する。

実行方法（リポジトリルートから）：

```
node --test test/
```
