# アクセス解析（Google Analytics 4）

測定 ID: `G-8K1TJG0S9Y`（`index.html` / `main.html` / `profile.html` に設定済み）

計測ヘルパーは `analytics.js`（`window.AtaruAnalytics`）です。

## 成果イベント（キーイベント）

`#contact` の予約・相談フォーム設置に伴い、送信成功イベントを実装しました。
GA4 管理画面 →「管理」→「データの表示」→「イベント」→ 一覧から
`ataru_form_submit_booking` / `ataru_form_submit_consult` を探し、
「キーイベントとしてマークを付ける」を ON にしてください。
イベントが一覧に表示されるのは、実際に 1 回以上計測された後です（最大 24 時間程度）。

| イベント名 | 発火条件 |
| --- | --- |
| `ataru_form_submit_booking` | お問い合わせ内容で「日程を決めて予約したい」を選んだ状態でフォーム送信のPOSTが成功した時だけ、1回 |
| `ataru_form_submit_consult` | 予約以外（相談・質問・作品撮り・その他）を選んだ状態でフォーム送信のPOSTが成功した時だけ、1回 |

送信ボタンのクリックやバリデーションエラーでは発火しません。`reservation_complete` /
`generate_lead` は実装していません。当サイトには送信完了ページが存在せず、送信成功と
完了メッセージの表示が同一の瞬間に起きるため、`ataru_form_submit_*` と両方送ると
1件の送信を二重に計上することになります。

## 分析用イベント（キーイベントにしない）

| イベント名 | 発火条件 |
| --- | --- |
| `page_view` | GA4 標準 |
| `scroll` | GA4 拡張計測機能 |
| `age_verified` | 年齢確認ページで「入る」を押した時 |
| `menu_view` | 「どんな体験ができる？」（`#session`）が画面に入った時、1 回 |
| `pricing_view` | 「料金・プラン」（`#pricing`）が画面に入った時、1 回 |
| `gallery_view` | 作例ギャラリー（`#gallery`）が画面に入った時、1 回 |
| `access_view` | 「日程・場所」（`#schedule`）が画面に入った時、1 回 |
| `notice_view` | 「来店時のお願い」（`#notice`）が画面に入った時、1 回 |
| `faq_view` | 「よくある質問」（`#faq`）が画面に入った時、1 回 |
| `contact_view` | 「ご予約・お問い合わせ」（`#contact`）が画面に入った時、1 回 |
| `faq_open` | FAQ の各項目を開いた時 |
| `gallery_open` | 作例画像を開いた時 |
| `mail_click` | 送信エラー時の最終手段としてメールリンクをクリックした時 |
| `consultation_x_click` | 送信エラー時の最終手段としてXのリンクをクリックした時 |
| `ataru_form_view` | `#contact` のフォームが画面に入った時、1 回 |
| `ataru_form_start` | フォームの最初の入力・選択をした時、1 回 |
| `ataru_form_select_intent` | 「お問い合わせ内容」を選択・変更した時 |
| `ataru_form_success` | フォーム送信が成功した時（成功メッセージ表示と同時） |
| `ataru_form_error` | フォーム送信が失敗した時 |
| `contact_cta_click` | ヒーロー・料金・FAQ等の「予約・相談する」系CTAをクリックした時 |

`flow_view` は実装していません。当サイトに独立した「流れ」セクションが存在せず、
該当する内容は `#contact` と `#notice` に含まれるためです。

## 送信するパラメータ

個人情報（氏名・メールアドレス・X アカウント・希望メニュー・希望日時・自由記述）は
一切送信しません。メールアドレスや画像ファイル名も送信しません。

- `site_section`：`ataru` 固定
- `page_path`：`location.pathname`
- `cta_location`：`contact` / `age_gate` など
- `link_destination`：`mail` / `x`
- `faq_id`：`faq_01` 形式の連番
- `gallery_category`：`bondage` / `suspension`、`gallery_index`：並び順の番号
- `contact_intent`：`booking` / `consult` / `question` / `artwork` / `other`（お問い合わせ種別のカテゴリのみ。自由記述・氏名・連絡先は送らない）

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
- 閲覧イベントを取りたいセクションには、上表と同じ `id` を付ける
- リンククリックを取りたい要素には
  `data-ga-event` / `data-ga-location` / `data-ga-destination` を付ける
