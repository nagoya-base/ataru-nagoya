# ataru_survey_admin（非公開・読み取り専用 管理者ダッシュボード）

Issue #106 で追加する、ataru-nagoya専用アンケートの**運営者専用・非公開クロス集計ダッシュボード**。

公開アンケート（`survey.html` / `survey.js`）や、将来Issue #104が実装する回答保存Web App・
公開集計APIとは**別のApps Scriptプロジェクト**として運用する。このプロジェクトからは
Spreadsheetへの書き込みを一切行わない（読み取り専用）。

## ファイル構成

- `Code.gs` — 読み取り専用のサーバーサイド処理（doGet / 集計ロジック呼び出し）
- `SurveySchema.gs` — **自動生成**。`survey-schema.json` から
  `node scripts/sync-survey-schema.js` で生成する。直接編集しないこと。
- `Dashboard.html` / `DashboardStyles.html` / `DashboardScript.html` — ダッシュボードUI
- `appsscript.json` — マニフェスト（Web Appアクセス設定を含む）
- `tests/` — このGASプロジェクト固有の自動テストの実行方法（`README.md`参照。実体はリポジトリ
  ルートの `test/admin-readonly.test.js` 等）

## デプロイ設定（重要）

Webアプリとしてデプロイする際は、必ず次の設定にすること。

- **実行ユーザー（Execute as）**: Me（自分）
- **アクセスできるユーザー（Who has access）**: Only myself（自分のみ）

公開アンケート側のGAS（Issue #104で実装予定）へは、次を一切追加しないこと。

- `?view=admin` のようなクエリパラメータ分岐
- 管理用HTML・管理用API
- 秘密トークン認証によるURL秘密性での分離

このダッシュボードはURLの秘密性ではなく、**別GASプロジェクト＋Googleアカウント権限**で
アクセスを分離する。

## セットアップ手順

1. 新規のGoogle Apps Scriptプロジェクトを作成し、このディレクトリ配下のファイル
   （`Code.gs`, `SurveySchema.gs`, `Dashboard.html`, `DashboardStyles.html`,
   `DashboardScript.html`, `appsscript.json`）をコピーする。
2. ataru-nagoya専用のGoogle Spreadsheet（Issue #104で作成予定）のIDを、
   スクリプトプロパティ（Script Properties）へ設定する。

   | プロパティ名 | 値 |
   | --- | --- |
   | `SPREADSHEET_ID` | 対象SpreadsheetのID |

   コード内にSpreadsheet IDを直書きしないこと（`Code.gs` の `getSpreadsheetId_()` が
   `PropertiesService.getScriptProperties()` からのみ読む）。

3. Spreadsheetに次の2シートを用意し、1行目に**ヘッダ名**を設定する
   （列番号は固定しない。ヘッダ名ベースで読み取る）。

   - シート名 `responses`：`schema/responses-columns.json` の `columns[].name` を
     1行目にそのまま並べる（管理列 `response_id` / `survey_version` / `saved_at` /
     `completion_stage` / `excluded` / `excluded_reason` ＋ Q1〜Q27正規化列）。
   - シート名 `leads`：`schema/leads-columns.json` の `columns[].name` を
     1行目にそのまま並べる（`lead_id` / `response_id` / `received_at` / `x_account` /
     `email` / `requested_content` / `link_status`）。

   このIssueではこれらのシートへの書き込み処理（初期ヘッダ作成を含む）は実装しない。
   シート自体・ヘッダ行は運用側で用意すること。

4. Webアプリとして新規デプロイし、上記の「デプロイ設定」の通りに設定する。

## 読み取り専用であることの保証

- `Code.gs` は `SpreadsheetApp` の読み取り系メソッド
  （`getDataRange()` / `getValues()` / `getSheetByName()`）のみを使用する。
- `appendRow` / `setValue` / `setValues` / `clear` / `clearContent` / `deleteRow` /
  `deleteRows` / `deleteSheet` / `insertRow` / `insertRows` は、このディレクトリの
  どの `.gs` ファイルにも存在しない。
- `test/admin-readonly.test.js` が上記メソッド名の不在をリポジトリのCIで静的検査する。
- 除外フラグ（`excluded`）をUIから変更する機能はこのIssueでは実装しない
  （閲覧のみ。運用変更が必要な場合はSpreadsheet側で直接編集する）。

## テストの実行

自動テストはリポジトリルートから実行する（Apps Scriptランタイムではなく、
Node.jsの `node:test` でロジックを検証する）。

```
node --test test/
```

`test/admin-readonly.test.js` はこのディレクトリの `.gs` ファイルを静的に読み、
禁止メソッドが存在しないことを検証する。

## デプロイ後の手動確認（Issue #106より）

- [ ] 管理Web Appが「自分のみ」アクセス可能であること
- [ ] 自分以外のGoogleアカウントでアクセスできないこと
- [ ] 実Spreadsheetでダッシュボードが正しく表示されること
- [ ] 公開集計（将来のIssue #104）と管理集計の傾向が矛盾しないこと
- [ ] 管理画面から回答を編集・削除できないこと
