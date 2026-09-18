# ataru_survey_public（公開・回答保存Web App + 公開集計API）

Issue #104 で追加する、`survey.html` / `survey.js` のPOST先となる**回答保存Web App**と、
`survey-results.html` が読む**公開集計API**。

`gas/ataru_survey_admin/`（非公開・読み取り専用の管理者ダッシュボード。Issue #106）とは
**別のApps Scriptプロジェクト**として運用する。互いのコードを参照・importしない。

## ファイル構成

- `Code.gs` — `doGet`（公開集計API） / `doPost`（回答保存・リード保存）
- `PublicSchema.gs` — **自動生成**。base_public / gated_public の設問のみ
  （`generated/survey-schema.public.gs` と同一内容）。`doGet`（公開集計）だけがこれを読む。
- `PublicAggregate.gs` — **自動生成**。5人未満マスキング・補完的抑制・Q1/Q3公開表示バケット化・
  100件ゲート判定・Q20 A〜D独立サブブロック化を含む集計ロジック本体
  （`scripts/lib/public-aggregate.js` を埋め込んだもの）。
- `FullSchema.gs` — **自動生成**。admin_only（Q24〜Q26）を含む全34設問＋leads列定義。
  `doPost`（回答保存）だけがこれを読む。公開集計関数（`buildPublicResult`）からは
  一切参照されない（`test/public-gas-privacy.test.js`で検証）。
- `ResponseNormalize.gs` — **自動生成**。保存時にdisplayConditionを再評価し、
  非到達設問の値を破棄してから保存行を組み立てるロジック（`scripts/lib/response-normalize.js`）。
- `appsscript.json` — マニフェスト（Web Appアクセス設定を含む）

`PublicSchema.gs` / `PublicAggregate.gs` / `FullSchema.gs` / `ResponseNormalize.gs` は
`node scripts/sync-survey-schema.js` が `survey-schema.json` から生成する。直接編集しないこと。

## デプロイ設定（重要）

- **実行ユーザー（Execute as）**: Me（自分）
- **アクセスできるユーザー（Who has access）**: Anyone（匿名を含む全員。公開Web Appのため）

管理者ダッシュボード（`gas/ataru_survey_admin/`）とはSpreadsheet IDだけを共有し、
コード・デプロイは完全に分ける。このプロジェクトに管理用画面・管理用APIを追加しないこと。

## セットアップ手順

1. 新規のGoogle Apps Scriptプロジェクトを作成し、このディレクトリ配下のファイル
   （`Code.gs`, `PublicSchema.gs`, `PublicAggregate.gs`, `FullSchema.gs`,
   `ResponseNormalize.gs`, `appsscript.json`）をコピーする。
2. `gas/ataru_survey_admin/` と同じ、ataru-nagoya専用Google SpreadsheetのIDを
   スクリプトプロパティへ設定する。

   | プロパティ名 | 値 |
   | --- | --- |
   | `SPREADSHEET_ID` | 対象SpreadsheetのID |

3. `responses` / `leads` シートは、初回の回答保存・リード保存時に存在しなければ
   自動作成され、ヘッダ行（`schema/responses-columns.json` / `schema/leads-columns.json`
   の列名）も自動で設定される（`Code.gs` の `getOrCreateSheet_()`）。既存シートを流用する
   場合は、ヘッダ名が両ファイルの `columns[].name` と一致していることを確認すること。
4. snb-community側のGASプロジェクト・Spreadsheetとは**完全に別**であることを確認する
   （このプロジェクトはSNBCのSpreadsheet IDを一切参照しない）。
5. Webアプリとして新規デプロイし、上記の「デプロイ設定」の通りに設定する。
6. デプロイ後のWeb App URLを `survey.js` の `GAS_ENDPOINT` 定数、
   `survey-results.js` の `GAS_RESULTS_ENDPOINT` 定数へ設定する。

## API仕様

### `GET ?action=results`

公開集計JSON（`buildPublicResult(responses, PublicSurveySchema)`）を返す。個票は返さない。
有効回答数が100件以下の間は `detail` キー自体をレスポンスへ含めない
（`null`・空配列・空オブジェクト・`hidden:true`での温存もしない）。

### `POST`（`Content-Type: text/plain` でJSON文字列を送る。理由はCORSの節を参照）

```json
{ "action": "save_response", "answers": { "q1_age": "...", ... }, "clientResponseId": "..." }
```

`response_id` は常にサーバー側で新規生成する（`Utilities.getUuid()`）。
`clientResponseId` は相関用の参考値に過ぎず、保存用IDとしては採用しない。
戻り値：`{ "ok": true, "response_id": "...", "saved_at": "...", "completion_stage": "...", "excluded": false }`

```json
{ "action": "save_lead", "response_id": "...(任意。localStorageの値)", "x_account": "...", "email": "...", "requested_content": "..." }
```

`response_id` が指定されていても、`responses` シートに実在しなければ `link_status` は
`unlinked` になる（クライアントの自己申告をそのまま信用しない）。
戻り値：`{ "ok": true, "link_status": "linked" | "unlinked" }`

## CORS（GitHub Pages → GAS Web App）

GitHub Pages（別オリジン）から `Content-Type: application/json` でクロスオリジンPOSTすると
プリフライト（OPTIONS）が発生するが、GAS Web AppはOPTIONSへのカスタムCORSヘッダ応答を
安定して行えない。そのため `survey.js` / `survey-results.js` は
**`Content-Type: text/plain;charset=utf-8` でJSON文字列をPOST**し（「シンプルリクエスト」として
プリフライトを発生させない）、`doPost` 側は `e.postData.contents` を `JSON.parse` する。
`ContentService` 経由のレスポンスは、GAS側の挙動としてクロスオリジンからの読み取りが
許可される（`doGet`/`doPost` にカスタムヘッダ設定APIは存在せず、追加のCORS設定はできない）。

**この挙動は実際にデプロイしたWeb App URLに対し、GitHub Pages上のブラウザから
fetchして手動確認が必要**（下記チェックリスト参照）。ローカルのNode実行だけでは
実際のブラウザ⇔GASのCORS挙動を検証できない。

## 公開集計とleadsシート・admin_onlyの分離

- `doGet`（公開集計API）が呼ぶのは `getPublicResults_()` → `buildPublicResult(rows, PublicSurveySchema)` のみ。
  `PublicSurveySchema` は `PublicSchema.gs`（生成物）にあり、admin_only（Q24〜Q26）・
  never_public（Q2/Q27/自由記述本文）を一切含まない。
- 公開集計のコードパスは `leads` シートを読む関数（`saveLead_` 内のresponse_id実在確認）を
  一切呼ばない。`test/public-gas-privacy.test.js` が静的・実行の両方で検証する。

## テストの実行

```
node --test test/
```

- `test/public-aggregate.test.js` — 5人未満マスキング・補完的抑制・100件ゲート・
  Q1/Q3バケット化・Q20 A〜D独立サブブロック判定のロジック検証
- `test/response-normalize.test.js` — サーバー側での表示条件再検証（性自認分岐・Q15分岐・
  Q4低関心分岐で非到達設問の値が破棄されること）の検証
- `test/public-gas-runtime.test.js` — 生成済み`.gs`ファイル自体をvm実行し、
  `buildPublicResult` / `buildStorageRow` がReferenceErrorなく動作することを検証
- `test/public-gas-privacy.test.js` — 公開集計コードパスがleads・admin_onlyへ
  一切アクセスしないことの静的・実行検証

## デプロイ後の手動確認（実Spreadsheet・実デプロイが前提のため、コードレビュー時点では確認不能）

- [ ] `responses` / `leads` シートが自動作成され、ヘッダが期待通りであること
- [ ] GitHub Pages上の `survey.html` から実際にPOSTでき、CORSエラーが出ないこと
- [ ] GitHub Pages上の `survey-results.html` から実際に `GET` でき、CORSエラーが出ないこと
- [ ] 有効回答数が100件以下の間、`detail` キーがレスポンスに含まれないこと（実データで確認）
- [ ] 101件目の保存直後から `detail` が返り始めること
- [ ] SNBC側Spreadsheet・GASプロジェクトに一切書き込まれていないこと
- [ ] Web Appが「Anyone」設定で、ログインなしでもPOST/GETできること
- [ ] Script Propertiesの`SPREADSHEET_ID`が管理者GAS側と同一のSpreadsheetを指していること
