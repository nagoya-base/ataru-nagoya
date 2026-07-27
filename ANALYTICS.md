# アクセス解析（Google Analytics 4）

測定 ID: `G-8K1TJG0S9Y`（`index.html` / `main.html` / `profile.html` に設定済み）

計測ヘルパーは `analytics.js`（`window.AtaruAnalytics`）です。

## 成果イベント（キーイベント）の現状

**現時点で GA4 管理画面でキーイベントとして ON にするイベントはありません。**

`reservation_submit` / `reservation_complete` / `generate_lead` は実装していません。
理由は次のとおりです。

| イベント名 | 実装しない理由 |
| --- | --- |
| `reservation_submit` | 当サイトに予約フォームが存在しない。予約導線はメールリンクと X のリンクのみで、リンクを開いたことは分かっても実際に送信されたかをサイト側で判定できない |
| `reservation_complete` | 予約完了ページ・完了状態が存在しない |
| `generate_lead` | 問い合わせフォームが存在しない。メール・X のクリックを成果として扱うと、実際には送信せず離脱した人まで成果に計上してしまう |

メール・X のクリックは、分析用イベント `mail_click` /
`consultation_x_click` として計測しています。

### 成果イベントを計測できるようにするには

予約・問い合わせフォーム（送信成功を JavaScript で判定できるもの）を設置する必要が
あります。設置後、送信の **POST が成功した時だけ** 次を送信するよう実装してください。

- 予約フォーム → `reservation_submit`
- 問い合わせフォーム → `generate_lead`

その際は、送信ボタンのクリックだけでは発火させないこと、バリデーションエラー時は
発火させないこと、送信操作ごとのトークンで二重計測を防ぐことを守ってください。
同系列リポジトリの `Studio-nagoya-base/scripts/analytics.js`、
`snb-community/analytics.js` が実装例です。

実装した後、GA4 管理画面 →「管理」→「データの表示」→「イベント」→ 一覧から
該当イベントを探し、「キーイベントとしてマークを付ける」を ON にします。
イベントが一覧に表示されるのは、実際に 1 回以上計測された後です（最大 24 時間程度）。

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
| `mail_click` | メールリンクをクリックした時 |
| `consultation_x_click` | X のリンクをクリックした時 |

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
