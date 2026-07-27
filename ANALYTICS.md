# アクセス解析（Google Analytics 4）

測定 ID: `G-8K1TJG0S9Y`（`index.html` / `main.html` / `profile.html` に設定済み）。
ストリーム名は `ataru-Nagoya`、対象 URL は
`https://nagoya-base.github.io/ataru-nagoya/`。

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
- `lead_type`：`ataru_booking` / `ataru_consultation`
- `form_name`：`ataru_contact`
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
