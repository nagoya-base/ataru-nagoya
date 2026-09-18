# アクセス解析（Google Analytics 4）

測定 ID: `G-5Z48YLCKNG`（`index.html` / `main.html` / `profile.html` に設定済み）。
SNBC（snb-community）と共用していた `G-8K1TJG0S9Y` からアタル専用プロパティに
分離した。切替日より前の計測データには SNBC 分のトラフィックが混在している。

計測ヘルパーは `analytics.js`（`window.AtaruAnalytics`）です。
3リポジトリ（snb-community / Studio-nagoya-base / ataru-nagoya）共通のイベント
設計に統一しています。

## 成果イベント（キーイベント）

`#contact` の予約・相談フォーム設置に伴い、送信成功イベントを実装しました。
GA4 管理画面 →「管理」→「データの表示」→「イベント」→ 一覧から
`generate_lead` を探し、「キーイベントとしてマークを付ける」を ON にしてください。
イベントが一覧に表示されるのは、実際に 1 回以上計測された後です（最大 24 時間程度）。

| イベント名 | 発火条件 |
| --- | --- |
| `generate_lead`（`lead_type: ataru_booking`） | お問い合わせ内容で「日程を決めて予約したい」を選んだ状態でフォーム送信のPOSTが成功した時だけ、1回 |
| `generate_lead`（`lead_type: ataru_consultation`） | 予約以外（相談・質問・作品撮り・その他）を選んだ状態でフォーム送信のPOSTが成功した時だけ、1回 |
| `generate_lead`（`lead_type: ataru_survey_lead`） | `survey.html` 完了画面の任意連絡先フォームのPOSTが成功した時だけ、1回（詳細は後述） |

送信ボタンのクリックやバリデーションエラーでは発火しません（`form_error`を送信）。
`reservation_complete` は実装していません。当サイトには送信完了ページが存在せず、
送信成功と完了メッセージの表示が同一の瞬間に起きるため、`generate_lead` と両方送ると
1件の送信を二重に計上することになります。

二重計測は、送信操作ごとに採番するトークンで防いでいます。

## 分析用イベント（キーイベントにしない）

| イベント名 | 発火条件 |
| --- | --- |
| `page_view` | GA4 標準 |
| `scroll` | GA4 拡張計測機能 |
| `section_view`（`section_id: session`） | 「どんな体験ができる？」（`#session`）が画面に入った時、1 回 |
| `section_view`（`section_id: price`） | 「料金・プラン」（`#pricing`）が画面に入った時、1 回 |
| `section_view`（`section_id: gallery`） | 作例ギャラリー（`#gallery`）が画面に入った時、1 回 |
| `section_view`（`section_id: access`） | 「日程・場所」（`#schedule`）が画面に入った時、1 回 |
| `section_view`（`section_id: notice`） | 「来店時のお願い」（`#notice`）が画面に入った時、1 回 |
| `section_view`（`section_id: faq`） | 「よくある質問」（`#faq`）が画面に入った時、1 回 |
| `section_view`（`section_id: contact`） | 「ご予約・お問い合わせ」（`#contact`）が画面に入った時、1 回 |
| `faq_open` | FAQ の各項目を開いた時 |
| `gallery_open` | 作例画像を開いた時 |
| `outbound_contact_click`（`channel: mail`） | メールリンクをクリックした時（補助成果）。送信エラー時の最終手段リンクも含む |
| `outbound_contact_click`（`channel: x`） | X のリンクをクリックした時（補助成果）。送信エラー時の最終手段リンクも含む |
| `cta_click`（`cta_name: age_verified`） | 年齢確認ページで「入る」を押した時 |
| `cta_click`（`cta_name: contact_form`） | ヒーロー・料金・FAQ等の「予約・相談する」系CTAをクリックした時 |
| `form_start`（`form_name: ataru_contact`） | フォームの最初の入力・選択をした時、1 回 |
| `form_error`（`form_name: ataru_contact`） | フォーム送信のバリデーションエラー時（`error_type: required`）・送信失敗時（`server` / `network`） |

`flow_view` は実装していません。当サイトに独立した「流れ」セクションが存在せず、
該当する内容は `#contact` と `#notice` に含まれるためです。

`profile.html` は現在 `index.html` へ即時リダイレクトするだけのスタブページで、
クリック可能な要素が存在しない。`analytics.js` は将来のために読み込んでいるが、
`cta_click` / `outbound_contact_click` を発火させる導線は未実装。ページに実導線を
追加した時点で、メインページへの遷移（`cta_click`）とXクリック
（`outbound_contact_click`）の計測を追加すること。

## 送信するパラメータ

個人情報（氏名・メールアドレス・X アカウント・希望メニュー・希望日時・自由記述）は
一切送信しません。メールアドレスや画像ファイル名も送信しません。

- `site_brand`：`ataru` 固定
- `site_section`：`session`（`index.html` / `main.html`）/ `profile`（`profile.html`）
- `page_type`：`age_gate`（`index.html`）/ `form`（`main.html`）/ `redirect`（`profile.html`）。`<body>` の `data-page-type` から自動的に付与（未設定時は `top`）
- `cta_location`：`contact` / `age_gate` など
- `channel`：`mail` / `x`
- `faq_id`：`faq_01` 形式の連番
- `gallery_category`：`bondage` / `suspension`、`gallery_item`：並び順の番号
- `lead_type`：`ataru_booking` / `ataru_consultation` / `ataru_survey_lead`
- `form_name`：`ataru_contact` / `ataru_survey` / `ataru_survey_lead`
- `error_type`：`required` / `server` / `network`

## 発火確認の手順

1. 確認したいページを `?debug_mode=true` 付きで開きます
   （例：`https://nagoya-base.github.io/ataru-nagoya/main.html?debug_mode=true`）
2. ブラウザの開発者ツールのコンソールに `[AtaruAnalytics]` から始まるログが出力され、
   イベント名とパラメータを確認できます
3. GA4 管理画面 →「管理」→「DebugView」でも同じイベントをリアルタイムに確認できます
4. セクション閲覧イベントはページを下までスクロールすると順に発火します。
   同じイベントは 1 ページ表示につき 1 回だけです

`file://` での直接表示と `localhost` では、誤計測を防ぐため送信されません
（`?debug_mode=true` を付けた場合を除く）。

## ページを追加するとき

- GA4 タグ（`gtag.js`）と `analytics.js` の読み込みを追加する
- `<body>` に `data-site-section` と `data-page-type` を付ける（省略時は `session` / `top` になる）
- 閲覧イベントを取りたいセクションには、上表と同じ `id` を付ける
- メール・X などの外部導線には
  `data-ga-event="outbound_contact_click"` / `data-ga-location` /
  `data-ga-channel`（`mail` / `x`）を付ける
- サイト内CTAには `data-ga-event="cta_click"` / `data-ga-location` /
  `data-ga-type`（`cta_name` として送信）を付ける

## survey.html（成人向けアンケート）の計測

`survey.html` は `data-site-section="survey"` / `data-page-type="survey"` を使う、
独立したステップ式アンケートページ。年齢・性自認・緊縛嗜好などの回答内容、
自由記述、連絡先（Xアカウント・メールアドレス）は一切GA4へ送らない。
送信するのはフォーム名・エラー種別などカテゴリ値のみで、既存の3リポジトリ共通の
イベント設計（`form_start` / `form_error` / `generate_lead`）と、既存のアンケート系
実装（`snb-community/baseball/enquete_202609.html` 等）が使う `survey_submit` を
そのまま使う。survey.html専用の新規イベント名は追加していない。

| イベント名 | 発火条件 |
| --- | --- |
| `form_start`（`form_name: ataru_survey`） | 最初の設問に回答（選択・入力）した時、1回 |
| `survey_submit`（`form_name: ataru_survey`） | 回答保存Web App（`gas/ataru_survey_public/`）へのPOSTが保存成功を返した時だけ、1回。参加確定を意味しないため`generate_lead`とは分けて送る。回答内容・分岐・スコア・`response_id`は含めない |
| `generate_lead`（`lead_type: ataru_survey_lead`） | 完了画面（回答済み再訪画面を含む）の任意連絡先フォームが、回答保存Web AppへのリードPOSTで保存成功を返した時だけ、1回。既存の`ataru_booking` / `ataru_consultation`と同じ`trackGenerateLead`ヘルパーを使う |
| `form_error`（`form_name`, `error_type: required` / `server` / `network`） | アンケート・連絡先フォームそれぞれのバリデーションエラー・送信失敗時 |
| `cta_click`（`cta_name: results_link`） | 「結果を見る」リンク（アンケート開始前・回答完了後・回答済み再訪画面）のクリック時。既存の`cta_click`をそのまま使い、新規イベント名は追加していない |

段階表示のステップごとの閲覧イベント（step_view相当）は、既存の共通設計に
存在しないため追加していない。ページ表示自体はGA4標準の`page_view`で計測される。

**Issue #104での変更**：回答完了・重複回答抑止（Cookie/localStorage）・`survey_submit`の
基準は、GAS（`gas/ataru_survey_public/`）への保存成功に一本化した。`response_id`も
常にGAS側で新規発行する（クライアント生成のIDは相関用の参考値に過ぎない）。
FormSubmitは通知補助のベストエフォート送信へ完全に下げており、GAS保存成功後に
送信する（失敗しても回答完了状態・GA4計測には一切影響しない）。
アンケート回答と任意の連絡先は別々のPOSTで送信し、個人情報を含まない`response_id`
でのみ関連づける。再訪リードの`response_id`は、Cookie/localStorageから復元できる
値をクライアントが「申告」するだけで、実際にresponsesシートに存在するかはGAS側が
確認してから`link_status`（`linked` / `unlinked`）を決める。

内部トリアージ用スコア・判定は送信データ（メール本文）にのみ含め、
回答者の画面やGA4には一切表示・送信しない。連絡先フォーム送信時（+3点）は
アンケート送信時点のスコアを事後に書き換えられないため、連絡先メール側に
加点後の最終スコア・判定を別途含める。
