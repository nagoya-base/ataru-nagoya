# アクセス解析（Google Analytics 4）

測定 ID: `<<NEW_ATARU_ID>>`（`index.html` / `main.html` / `profile.html` に設定済み）。
SNBC（snb-community）と共用していた `G-8K1TJG0S9Y` からアタル専用プロパティに
分離した。切替日より前の計測データには SNBC 分のトラフィックが混在している。

計測ヘルパーは `analytics.js`（`window.AtaruAnalytics`）です。
3リポジトリ（snb-community / Studio-nagoya-base / ataru-nagoya）共通のイベント
設計に統一しています。

## 成果イベント（キーイベント）の現状

**現時点で GA4 管理画面でキーイベントとして ON にするイベントはありません。**

`generate_lead` は実装していません。理由は次のとおりです。

| イベント名 | 実装しない理由 |
| --- | --- |
| `generate_lead` | 予約・問い合わせフォームが存在しない。導線はメールリンクと X のリンクのみで、リンクを開いたことは分かっても実際に送信されたかをサイト側で判定できない。メール・X のクリックを成果として扱うと、実際には送信せず離脱した人まで成果に計上してしまう |

メール・X のクリックは、補助成果イベント `outbound_contact_click`
（`channel: mail` / `x`）として計測しています。

### 成果イベントを計測できるようにするには

問い合わせフォーム（送信成功を JavaScript で判定できるもの）を設置する必要が
あります。設置後、送信の **POST が成功した時だけ** `generate_lead` を送信するよう
実装してください。

送信ボタンのクリックだけでは発火させないこと、バリデーションエラー時は
発火させないこと、送信操作ごとのトークンで二重計測を防ぐことを守ってください。
同系列リポジトリの `Studio-nagoya-base/scripts/analytics.js`、
`snb-community/analytics.js` が実装例です。

実装した後、GA4 管理画面 →「管理」→「データの表示」→「イベント」→ 一覧から
該当イベントを探し、「キーイベントとしてマークを付ける」を ON にします。
イベントが一覧に表示されるのは、実際に 1 回以上計測された後です（最大 24 時間程度）。

## 分析用イベント・補助成果イベント（キーイベントにしない）

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
| `outbound_contact_click`（`channel: mail`） | メールリンクをクリックした時（補助成果） |
| `outbound_contact_click`（`channel: x`） | X のリンクをクリックした時（補助成果） |
| `cta_click`（`cta_name: age_verified`） | 年齢確認ページで「入る」を押した時 |

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
- `cta_location`：`contact` / `age_gate` など
- `channel`：`mail` / `x`
- `faq_id`：`faq_01` 形式の連番
- `gallery_category`：`bondage` / `suspension`、`gallery_item`：並び順の番号

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
- メール・X などの外部導線には
  `data-ga-event="outbound_contact_click"` / `data-ga-location` /
  `data-ga-channel`（`mail` / `x`）を付ける
- サイト内CTAには `data-ga-event="cta_click"` / `data-ga-location` /
  `data-ga-type`（`cta_name` として送信）を付ける
