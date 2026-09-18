/*
 * survey.html 用のステップフォームエンジン。
 * 個人情報・回答内容はGA4へ送らない（form_name等のカテゴリ値のみ）。
 *
 * アンケート回答と任意連絡先は別々のPOST（別件名のメール）に分離し、
 * 個人情報を含まないresponse_idのみで突き合わせる。ただし現状は同一の
 * FormSubmitエンドポイント（同じ受信メールアドレス）宛てであり、メール本文が
 * 分かれるだけで、別サービス・別受信先への分離ではない。真に別の送信先が
 * 必要な場合は、連絡先用の別メールアドレスをFormSubmitで有効化した上で
 * FORM_ENDPOINT_LEAD 定数を分ける対応が必要（要運用判断）。
 *
 * ─────────────────────────────────────────────────────────────
 * Issue #107: 全ジェンダー共通の緊縛設問＋男性向けスポーツ／ユニ分岐への改修
 *
 * 保存キー対応表（旧 PR #105 → 新 Issue #107）
 * このファイル内の保存フィールド名は、旧番号を画面上だけ読み替えるのではなく、
 * 新しいQ番号に完全に合わせて付け替えている。Issue #106でのスキーマ正本化を
 * 見据え、フィールド名は "qN_項目名" 形式に統一した。
 *
 *   旧フィールド                新フィールド              備考
 *   q1_age                  → q1_age                  変更なし
 *   q2_gender/_other         → q2_gender/_other         変更なし
 *   q3_region/_country/_other→ q3_region/_country/_other 変更なし
 *   （新規）                  → q4_interest              旧Q15(緊縛への関心)を全ジェンダー共通の新Q4へ
 *   （新規）                  → q5_enjoy/_other          新設（緊縛の楽しみ方）
 *   （新規）                  → q6_role/_other           新設。旧Q16(立場)の選択肢を統合
 *   （新規）                  → q6a_involvement/_other   新設（今後の企画との関わり方）
 *   q4_sports/_other         → q7_sports/_other
 *   q5_exercise/_other       → q8_exercise/_other
 *   q6_gym/_other            → q9_gym/_other
 *   q7_motivation/_other     → q10_motivation/_other
 *   q8_uniform/_other        → q11_uniform/_other
 *   q9_favorite              → q12_favorite
 *   q10_enjoy/_other         → q13_enjoy/_other
 *   q10_wear_self            → q13a_wear_self           独立フィールド
 *   q10_wear_others          → q13b_wear_others         独立フィールド
 *   q11a_self/_other         → q14a_self/_other         独立フィールド
 *   q11b_pref/_other         → q14b_pref/_other         独立フィールド（選択肢を拡張）
 *   q12_gate                 → q15_gate
 *   q13_interest/_other      → q16_interest/_other      興味なし時の候補フィルタは廃止
 *                                                       （Q15興味なしは丸ごとQ27へスキップするため不要）
 *   q14_experience/_other    → q17_experience/_other
 *   q17_combo                → q18_combo
 *   q18_range/_other         → q19_range/_other
 *   q19a〜q19f（6グループ）    → q20a〜q20d（4グループ）   A/B/C/Dへ再編。q19bの内容はQ5に統合、
 *                                                       q19cの一部もQ20Aへ統合
 *   q20_conditions/_other    → q21_conditions/_other
 *   q21_visit                → q22_visit
 *   q22_schedule/_other      → q23_schedule/_other
 *   q23_price                → q24_price
 *   q24_intent                → q25_intent
 *   q25_format/_other        → q26_format/_other
 *   q26_message              → q27_message
 *
 * computeScore() / rankFromScore() もすべて上表の新フィールド名のみを参照する
 * （旧フィールド名は一切残していない）。配列フィールドは `|| []` で安全に扱い、
 * undefined.indexOf() のような例外を起こさない。さらに、スコア計算自体で例外が
 * 発生しても回答送信を止めないよう、呼び出し側（realSubmit）でtry/catchする。
 * ─────────────────────────────────────────────────────────────
 */
window.__Survey = {};

(function () {
  'use strict';

  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/nagoyabase2023@gmail.com';

  var OPT = {
    q1: ['17歳以下','18〜24歳','25〜29歳','30〜34歳','35〜39歳','40〜49歳','50〜59歳','60歳以上','回答しない'],
    q2: ['男性','女性','その他'],
    q3: ['北海道','東北','関東（東京都以外）','東京都','甲信越・北陸','静岡県','愛知県・名古屋市','愛知県・尾張地域（名古屋市以外）','愛知県・三河地域','岐阜県','三重県','関西','中国','四国','九州','沖縄県','海外','その他'],

    /* Q4〜Q6-A：18歳以上の全ジェンダー共通・緊縛/ロープへの関心 */
    q4: ['とても好き','興味がある','軽い内容なら興味がある','写真や詳しい内容を見てから考えたい','自分では体験しないが見ることには興味がある','あまり興味はない','苦手','よく分からない'],
    q5: ['縄の感触を感じたい','縄の締まりや圧迫感を感じたい','拘束されて動けない感覚を味わいたい','相手に身を任せる感覚を味わいたい','美しく縛られたい','美しく縛ることに興味がある','緊縛を見た目・作品として楽しみたい','緊縛されている人を見ることに興味がある','緊縛を撮影することに興味がある','縄をかける技術や構成を楽しみたい','まだ分からない','特にない','回答しない','その他'],
    q6: ['縛られる側に興味がある','縛る側に興味がある','縛る・縛られる両方に興味がある','見るだけで楽しみたい','撮影する側として関わりたい','まだ分からない','回答しない','その他'],
    q6a: ['自分で体験することに興味がある','縛る側として関わることに興味がある','見学したい','撮影する側として関わりたい','作品・活動を見るだけでよい','今回はアンケート回答のみ','まだ分からない','その他'],

    /* Q7〜Q14B：男性のみ・スポーツ／ユニフォーム／身体特徴（旧Q4〜Q11B相当） */
    q7: ['野球・ソフトボール','サッカー・フットサル','ラグビー・アメリカンフットボール','バスケットボール','バレーボール','陸上競技','水泳','テニス・ラケット競技','格闘技・武道','筋力トレーニング・ボディメイク','特にない','その他'],
    q8: ['定期的にスポーツをしている','不定期にスポーツをしている','ジムや自宅でトレーニングしている','スポーツとトレーニングの両方をしている','現在はしていない','その他'],
    q9: ['週4回以上','週2〜3回','週1回程度','月に数回','ほとんどしていない','現在はしていない','その他'],
    q10: ['健康を維持したい','筋肉をつけたい','体型を維持・改善したい','スポーツの競技力を高めたい','見た目に自信を持ちたい','モテたい','写真映えする身体になりたい','ユニフォームやスポーツウェアを格好よく着たい','同じ趣味の人と交流したい','特にない','その他'],
    q11: ['野球','サッカー','ラグビー・アメフト','バスケットボール','バレーボール','陸上','競泳・競パン','レスリング・シングレット','ジャージ','体操服','学校・部活動制服','スーツ','作業着・職業制服','特にない','その他'],
    q13: ['自分で着たい','人が着ている姿を見たい','ユニフォーム姿でスポーツをしたい','ユニフォーム姿を撮影したい','ユニフォーム姿で撮られたい','ユニフォームのフィット感や着心地を楽しみたい','背番号・ソックス・ベルト・サポーターなどの組合せを楽しみたい','試合前の緊張感や、練習後の汗・着崩れた雰囲気が好き','ロッカールーム・部室の雰囲気を楽しみたい','同じ趣味の人と交流したい','少しフェチ的な表現も楽しみたい','その他'],
    q14a: ['現在、チーム・クラブ・競技団体に所属している','過去に運動部・チームへ所属していた','現在もスポーツを続けている','定期的にジムへ通っている','筋肉質だと思う','がっしりした体格だと思う','標準的な体格だと思う','細身だと思う','自分が短髪・ベリーショート','体育会系の雰囲気だと言われる','体育会系ではないが憧れがある','回答しない','その他'],
    q14b: ['短髪・坊主・スポーツ刈りの男性が好き','短髪の男性を見たい','短髪の男性を撮影したい','筋肉質・がっしりした体格に惹かれる','細身・引き締まった体格に惹かれる','体毛のある男性に惹かれる','体毛が少ない男性に惹かれる','若々しい雰囲気に惹かれる','落ち着いた年齢感に惹かれる','体育会系・ノンケ寄りの雰囲気に惹かれる','特にこだわりはない','回答しない','その他'],

    /* Q15〜Q26：男性のみ・成人男性向け企画（旧Q12〜Q25相当） */
    q15: ['はい','内容による','興味はない'],
    q16: ['ユニフォーム交流','軽いスポーツ','選手名鑑風撮影','練習・試合前後風撮影','教室・部室・ロッカールーム風撮影','身体やユニフォームのラインを生かした撮影','フェチ撮影','ロープ撮影','緊縛撮影','特にない','その他'],
    q17: ['未経験','写真・動画を見たことがある','緊縛を見学したことがある','着衣で軽く縛られたことがある','床縄・部分吊りを体験したことがある','本吊りを体験したことがある','人を縛ったことがある','緊縛を撮影したことがある','その他','回答しない'],
    q18: ['ぜひ体験したい','軽い内容なら体験したい','詳細を見て判断','見学して判断','撮影側なら興味あり','興味なし'],
    q19: ['手首など一部分だけロープを使う','ユニフォームを着たままの着衣緊縛','ユニフォームの上から軽く縛る','ユニフォーム姿のまま本格的に縛る','立った状態での緊縛','床や椅子を使った緊縛','部分吊り','本吊り','まず説明だけ聞きたい','まだ決められない','その他'],
    q20a: ['ユニフォーム姿のまま格好よく縛られたい','写真作品として格好よく撮られたい','縄とユニフォームの組合せを作品として残したい','ユニフォーム姿の男性を美しく縛りたい','縛られている男性を見たい','縛られている男性を撮影したい','緊縛作品の演出をしたい'],
    q20b: ['吊られる感覚を体験したい','強度のある緊縛を体験したい'],
    q20c: ['SM的な責めを受けたい','言葉責めをされたい','その他の性的なプレイにも興味がある'],
    q20d: ['縄だけを楽しみたい','撮影だけを楽しみたい','まだ分からない','その他','回答しない'],
    q21: ['完全個室','1対1','服を着たまま','性的な接触なし','吊りなし','顔を撮影しない','SNSへ掲載しない','内容や強さを自分で選べる','途中で中止できる','事前説明がある','NG項目を事前に伝えられる','友人と一緒に参加できる','見学してから決められる','その他'],
    q22: ['日程が合えば','内容が合えば','参加者や雰囲気を確認できれば','友人と一緒なら','宿泊を伴っても','名古屋は難しい','分からない'],
    q23: ['土曜昼','土曜夜','日曜昼','日曜夜','祝日昼','平日夜','個別相談','その他'],
    q24: ['2,000円以下','3,000円程度','4,000円程度','5,000円程度','内容次第で5,000円以上','価格より内容・安全性','参加しない'],
    q25: ['日程が合えば参加したい','東京・大阪など遠方からでも内容次第で参加したい','開催案内が欲しい','写真や詳しい説明を見て考えたい','個別相談したい','友人と一緒なら参加したい','見学してから考えたい','今回は参加しない'],
    q26: ['1対1','友人と2人','3〜4人の体験会','見学後に判断','個別相談','まだ分からない','その他']
  };

  var TXT = {
    bondageIntro: 'ここから、緊縛・ロープ表現への関心についてお聞きします。ご回答は任意です。答えたくない項目は「回答しない」等の選択肢がある場合はそちらを選べます。',
    femaleOtherEnd: '緊縛・ロープについてのご回答ありがとうございます。今回の詳しい企画検討は、男性の身体表現・ユニフォームを中心にしています。見る・縛る・撮るなど、関わり方についてのご意見があれば、最後の自由記述でもぜひお聞かせください。',
    q15GateIntro: '今回詳しく検討しているのは、成人男性がユニフォーム姿で参加する撮影・ロープ体験です。この前提で、続く企画について回答しますか。',
    playSectionIntro: '以下は関心・需要を把握するための質問です。選んだ内容の提供を約束するものではありません。実際に企画化する場合は、成人同士の明確な同意、安全性、法令、衛生面を確認したうえで内容を決定します。',
    q20cNotice: '以下の性的な項目は任意です。興味がなければ選ばずに進めます。ここでの回答は需要調査のためのものであり、実際の提供内容を約束するものではありません。',
    priceAnnounce: '名古屋・上前津の完全個室スタジオで、ユニフォーム姿の初心者向けロープ撮影を3,000円から体験できる企画を検討しています。\nユニフォームを着たまま、吊りなし、顔出し・SNS掲載なしでも参加可能。希望しない内容は断れます。\n回答しただけで申込みにはなりません。',
    q27Hint: '企画に期待すること、こんな内容なら参加したいというご要望、主催者への激励・応援メッセージなど、内容は自由です。'
  };

  var SECTION = {
    basic: '基本情報・地域',
    bondage: '緊縛・ロープへの関心',
    sports: 'スポーツ・身体づくり',
    uniform: 'ユニフォーム嗜好',
    body: '身体・好みについて',
    men: '成人男性向け設問',
    play: '望む体験・プレイ',
    visit: '名古屋への来訪・価格',
    invite: '体験のご案内',
    end: '最後に'
  };

  window.__Survey.OPT = OPT;
  window.__Survey.TXT = TXT;
  window.__Survey.SECTION = SECTION;
  window.__Survey.FORM_ENDPOINT = FORM_ENDPOINT;
})();

(function () {
  'use strict';
  var OPT = window.__Survey.OPT;
  var TXT = window.__Survey.TXT;
  var SECTION = window.__Survey.SECTION;

  function isMaleAny(a) { return a.q2_gender === '男性'; }
  function isFemaleOther(a) { return a.q2_gender === '女性' || a.q2_gender === 'その他'; }

  /* Q4（緊縛・ロープ表現への関心）が低関心3択の場合、Q18〜Q21（詳細な体験内容）を
     スキップしてQ22（名古屋での参加可能性）へ進める。Q16/Q17は表示する。 */
  function isLowInterest(a) { return ['あまり興味はない', '苦手', 'よく分からない'].indexOf(a.q4_interest) !== -1; }

  /* Q15ゲートで「はい」「内容による」を選んだ場合のみ、Q16以降（〜Q26）へ進む。
     「興味はない」はQ16〜Q26を一切表示せずQ27へ直行する。 */
  function gatePassed(a) { return isMaleAny(a) && (a.q15_gate === 'はい' || a.q15_gate === '内容による'); }

  /* Q18〜Q21（体験内容の詳細）は、ゲート通過かつQ4が低関心でない場合のみ表示する。 */
  function showDetailBlock(a) { return gatePassed(a) && !isLowInterest(a); }

  function q11DerivedOptions(a) {
    return (a.q11_uniform || []).map(function (v) {
      return v === 'その他' ? (a.q11_other ? 'その他：' + a.q11_other : 'その他') : v;
    });
  }

  var STEPS = [
    { id: 'q1', section: SECTION.basic, type: 'radio', title: 'Q1. 年齢', required: true, options: OPT.q1, field: 'q1_age', emailKey: 'Q1_年齢', visible: function () { return true; } },

    { id: 'q2', section: SECTION.basic, type: 'radio', title: 'Q2. 性自認', required: true, options: OPT.q2, field: 'q2_gender', emailKey: 'Q2_性自認',
      subTexts: [{ trigger: 'その他', field: 'q2_gender_other', label: '性自認（自由記述）', emailKey: 'Q2_性自認その他' }],
      visible: function () { return true; } },

    { id: 'q3', section: SECTION.basic, type: 'radio', title: 'Q3. 居住地域', required: true, options: OPT.q3, field: 'q3_region', emailKey: 'Q3_居住地域',
      subTexts: [
        { trigger: '海外', field: 'q3_country', label: '国名', emailKey: 'Q3_海外国名' },
        { trigger: 'その他', field: 'q3_region_other', label: '地域名', emailKey: 'Q3_地域その他' }
      ],
      visible: function () { return true; } },

    { id: 'bondage_intro', section: SECTION.bondage, type: 'info', title: 'ここからのご案内', body: TXT.bondageIntro,
      visible: function () { return true; } },

    { id: 'q4', section: SECTION.bondage, type: 'radio', title: 'Q4. 緊縛・ロープ表現への関心', required: true, options: OPT.q4, field: 'q4_interest', emailKey: 'Q4_緊縛への関心',
      visible: function () { return true; } },

    { id: 'q5', section: SECTION.bondage, type: 'checkbox', title: 'Q5. 緊縛では、どんな楽しみ方に関心がありますか', required: false, options: OPT.q5, otherField: 'q5_other', field: 'q5_enjoy', exclusive: ['まだ分からない', '特にない', '回答しない'], emailKey: 'Q5_楽しみ方', otherEmailKey: 'Q5_その他',
      visible: function () { return true; } },

    { id: 'q6', section: SECTION.bondage, type: 'checkbox', title: 'Q6. 緊縛では、どの立場に関心がありますか', required: false, options: OPT.q6, otherField: 'q6_other', field: 'q6_role', exclusive: ['まだ分からない', '回答しない'],
      conflictPairs: [['縛る・縛られる両方に興味がある', '縛られる側に興味がある'], ['縛る・縛られる両方に興味がある', '縛る側に興味がある']],
      emailKey: 'Q6_興味のある立場', otherEmailKey: 'Q6_その他',
      visible: function () { return true; } },

    { id: 'q6a', section: SECTION.bondage, type: 'checkbox', title: 'Q6-A. 今後の企画との関わり方', required: false, options: OPT.q6a, otherField: 'q6a_other', field: 'q6a_involvement', exclusive: ['今回はアンケート回答のみ', 'まだ分からない'], emailKey: 'Q6A_今後の関わり方', otherEmailKey: 'Q6A_その他',
      visible: function () { return true; } },

    { id: 'female_other_end', section: SECTION.end, type: 'info', title: 'ご案内', body: TXT.femaleOtherEnd,
      visible: function (a) { return isFemaleOther(a); } },

    { id: 'q7', section: SECTION.sports, type: 'checkbox', title: 'Q7. 現在または過去に経験したスポーツ', required: true, options: OPT.q7, field: 'q7_sports', otherField: 'q7_other', emailKey: 'Q7_経験スポーツ', otherEmailKey: 'Q7_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q8', section: SECTION.sports, type: 'radio', title: 'Q8. 現在の運動状況', required: true, options: OPT.q8, field: 'q8_exercise', otherField: 'q8_other', emailKey: 'Q8_運動状況', otherEmailKey: 'Q8_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q9', section: SECTION.sports, type: 'radio', title: 'Q9. ジム・筋力トレーニング頻度', required: true, options: OPT.q9, field: 'q9_gym', otherField: 'q9_other', emailKey: 'Q9_ジム頻度', otherEmailKey: 'Q9_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q10', section: SECTION.sports, type: 'checkbox', title: 'Q10. スポーツ・身体づくりの動機', required: false, options: OPT.q10, field: 'q10_motivation', otherField: 'q10_other', emailKey: 'Q10_動機', otherEmailKey: 'Q10_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q11', section: SECTION.uniform, type: 'checkbox', title: 'Q11. 好きなユニフォーム・ウェア', required: true, options: OPT.q11, field: 'q11_uniform', otherField: 'q11_other', emailKey: 'Q11_好きなユニフォーム', otherEmailKey: 'Q11_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q12', section: SECTION.uniform, type: 'radio', title: 'Q12. 最も好きなもの', required: true, field: 'q12_favorite', emailKey: 'Q12_最も好きなもの',
      dynamicOptions: q11DerivedOptions,
      visible: function (a) { return isMaleAny(a) && q11DerivedOptions(a).length > 1; } },

    { id: 'q13', section: SECTION.uniform, type: 'checkbox', title: 'Q13. ユニフォームの楽しみ方', required: false, options: OPT.q13, field: 'q13_enjoy', otherField: 'q13_other', emailKey: 'Q13_楽しみ方', otherEmailKey: 'Q13_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q13a', section: SECTION.uniform, type: 'checkbox', title: 'Q13-A. 自分で着たいユニフォーム', hint: '任意です。Q11で選んだものの中から選べます。', required: false, field: 'q13a_wear_self', emailKey: 'Q13A_自分で着たいユニフォーム',
      dynamicOptions: q11DerivedOptions,
      visible: function (a) { return isMaleAny(a) && q11DerivedOptions(a).length > 0; } },

    { id: 'q13b', section: SECTION.uniform, type: 'checkbox', title: 'Q13-B. 人に着てほしい・見たいユニフォーム', hint: '任意です。Q11で選んだものの中から選べます。', required: false, field: 'q13b_wear_others', emailKey: 'Q13B_人に着てほしいユニフォーム',
      dynamicOptions: q11DerivedOptions,
      visible: function (a) { return isMaleAny(a) && q11DerivedOptions(a).length > 0; } },

    { id: 'q14a', section: SECTION.body, type: 'checkbox', title: 'Q14-A. 自分に当てはまる特徴', required: false, options: OPT.q14a, otherField: 'q14a_other', field: 'q14a_self', exclusive: ['回答しない'], emailKey: 'Q14A_自分の特徴', otherEmailKey: 'Q14A_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q14b', section: SECTION.body, type: 'checkbox', title: 'Q14-B. 相手の見た目についての好み', required: false, options: OPT.q14b, otherField: 'q14b_other', field: 'q14b_pref', exclusive: ['回答しない'], emailKey: 'Q14B_相手の好み', otherEmailKey: 'Q14B_その他',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q15_intro', section: SECTION.men, type: 'info', title: 'ここでの確認', body: TXT.q15GateIntro,
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q15', section: SECTION.men, type: 'radio', title: 'Q15. 続く企画についての質問へ回答しますか', required: true, options: OPT.q15, field: 'q15_gate', emailKey: 'Q15_企画ゲート',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q16', section: SECTION.men, type: 'checkbox', title: 'Q16. 興味のある企画', required: false, options: OPT.q16, otherField: 'q16_other', field: 'q16_interest', emailKey: 'Q16_興味のある企画', otherEmailKey: 'Q16_その他',
      visible: function (a) { return gatePassed(a); } },

    { id: 'q17', section: SECTION.men, type: 'checkbox', title: 'Q17. 緊縛・ロープの経験', required: true, options: OPT.q17, otherField: 'q17_other', field: 'q17_experience', exclusive: ['未経験', '回答しない'], emailKey: 'Q17_緊縛経験', otherEmailKey: 'Q17_その他',
      visible: function (a) { return gatePassed(a); } },

    { id: 'q18', section: SECTION.men, type: 'radio', title: 'Q18. ユニフォーム姿と緊縛を組み合わせた撮影', required: true, options: OPT.q18, field: 'q18_combo', emailKey: 'Q18_ユニフォーム緊縛撮影',
      visible: function (a) { return showDetailBlock(a); } },

    { id: 'q19', section: SECTION.men, type: 'checkbox', title: 'Q19. 興味のある緊縛範囲', required: false, options: OPT.q19, otherField: 'q19_other', field: 'q19_range', emailKey: 'Q19_緊縛範囲', otherEmailKey: 'Q19_その他',
      visible: function (a) { return showDetailBlock(a); } },

    { id: 'play_intro', section: SECTION.play, type: 'info', title: 'ここからのご案内', body: TXT.playSectionIntro,
      visible: function (a) { return showDetailBlock(a); } },

    { id: 'q20a', section: SECTION.play, type: 'checkbox', title: 'Q20. 男性向け企画で関心のある詳細内容', subTitle: 'A. ユニフォーム・作品表現', required: false, options: OPT.q20a, field: 'q20a', emailKey: 'Q20A_ユニフォーム作品表現', q20Group: 'A',
      visible: function (a) { return showDetailBlock(a); }, crossExclusive: 'q20' },

    { id: 'q20b', section: SECTION.play, type: 'checkbox', title: 'Q20. 男性向け企画で関心のある詳細内容', subTitle: 'B. 吊り・強度', required: false, options: OPT.q20b, field: 'q20b', emailKey: 'Q20B_吊り強度', q20Group: 'B',
      visible: function (a) { return showDetailBlock(a); }, crossExclusive: 'q20' },

    { id: 'q20c', section: SECTION.play, type: 'checkbox', title: 'Q20. 男性向け企画で関心のある詳細内容', subTitle: 'C. SM・性的な責め', notice: TXT.q20cNotice, required: false, options: OPT.q20c, field: 'q20c', emailKey: 'Q20C_SM性的責め', q20Group: 'C',
      visible: function (a) { return showDetailBlock(a); }, crossExclusive: 'q20' },

    { id: 'q20d', section: SECTION.play, type: 'checkbox', title: 'Q20. 男性向け企画で関心のある詳細内容', subTitle: 'D. その他', required: false, options: OPT.q20d, otherField: 'q20d_other', field: 'q20d', exclusive: ['まだ分からない', '回答しない'], emailKey: 'Q20D_その他選択', otherEmailKey: 'Q20D_その他', q20Group: 'D',
      visible: function (a) { return showDetailBlock(a); }, crossExclusive: 'q20' },

    { id: 'q21', section: SECTION.play, type: 'checkbox', title: 'Q21. 体験時に重視する条件', required: false, options: OPT.q21, otherField: 'q21_other', field: 'q21_conditions', emailKey: 'Q21_重視条件', otherEmailKey: 'Q21_その他',
      visible: function (a) { return showDetailBlock(a); } },

    { id: 'q22', section: SECTION.visit, type: 'radio', title: 'Q22. 名古屋での参加可能性', required: true, options: OPT.q22, field: 'q22_visit', emailKey: 'Q22_名古屋参加可能性',
      visible: function (a) { return gatePassed(a); } },

    { id: 'q23', section: SECTION.visit, type: 'checkbox', title: 'Q23. 参加しやすい曜日・時間', required: false, options: OPT.q23, otherField: 'q23_other', field: 'q23_schedule', emailKey: 'Q23_参加曜日時間', otherEmailKey: 'Q23_その他',
      visible: function (a) { return gatePassed(a); } },

    { id: 'q24', section: SECTION.visit, type: 'radio', title: 'Q24. 初心者向け短時間体験の参加しやすい価格', required: true, options: OPT.q24, field: 'q24_price', emailKey: 'Q24_価格',
      visible: function (a) { return gatePassed(a); } },

    /* Q24（価格）回答完了後に初めて3,000円企画を表示する（価格アンカリング回避）。
       !!a.q24_price を条件にすることで、Q24回答前はこのステップが計画に含まれない。 */
    { id: 'price_announce', section: SECTION.invite, type: 'info', title: '体験のご案内', body: TXT.priceAnnounce,
      visible: function (a) { return gatePassed(a) && !!a.q24_price; } },

    { id: 'q25', section: SECTION.invite, type: 'radio', title: 'Q25. 現在の参加意向', required: true, options: OPT.q25, field: 'q25_intent', emailKey: 'Q25_参加意向',
      visible: function (a) { return gatePassed(a); } },

    { id: 'q26', section: SECTION.invite, type: 'checkbox', title: 'Q26. 希望参加形式', required: false, options: OPT.q26, otherField: 'q26_other', field: 'q26_format', emailKey: 'Q26_参加形式', otherEmailKey: 'Q26_その他',
      visible: function (a) { return gatePassed(a); } },

    { id: 'q27', section: SECTION.end, type: 'text', title: 'Q27. その他、ご意見・ご要望・激励・応援メッセージ', hint: TXT.q27Hint, required: false, field: 'q27_message', emailKey: 'Q27_メッセージ',
      visible: function () { return true; } }
  ];

  window.__Survey.STEPS = STEPS;
  window.__Survey.helpers = { isMaleAny: isMaleAny, isFemaleOther: isFemaleOther, isLowInterest: isLowInterest, gatePassed: gatePassed, showDetailBlock: showDetailBlock, q11DerivedOptions: q11DerivedOptions };
})();

/* ── エンジン本体 ── */
(function () {
  'use strict';
  var S = window.__Survey;
  var STEPS = S.STEPS;

  function defaultAnswers() {
    return {
      q1_age: '', q2_gender: '', q2_gender_other: '',
      q3_region: '', q3_country: '', q3_region_other: '',
      q4_interest: '',
      q5_enjoy: [], q5_other: '',
      q6_role: [], q6_other: '',
      q6a_involvement: [], q6a_other: '',
      q7_sports: [], q7_other: '',
      q8_exercise: '', q8_other: '',
      q9_gym: '', q9_other: '',
      q10_motivation: [], q10_other: '',
      q11_uniform: [], q11_other: '',
      q12_favorite: '',
      q13_enjoy: [], q13_other: '',
      q13a_wear_self: [],
      q13b_wear_others: [],
      q14a_self: [], q14a_other: '',
      q14b_pref: [], q14b_other: '',
      q15_gate: '',
      q16_interest: [], q16_other: '',
      q17_experience: [], q17_other: '',
      q18_combo: '',
      q19_range: [], q19_other: '',
      q20a: [], q20b: [], q20c: [],
      q20d: [], q20d_other: '',
      q21_conditions: [], q21_other: '',
      q22_visit: '',
      q23_schedule: [], q23_other: '',
      q24_price: '',
      q25_intent: '',
      q26_format: [], q26_other: '',
      q27_message: ''
    };
  }

  var answers = defaultAnswers();
  var plannedSteps = [];
  var currentIndex = 0;
  var surveyStarted = false;
  var responseId = null;

  function makeResponseId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    var s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return s.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function h(tag, props) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else if (k.indexOf('on') === 0 && typeof props[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), props[k]);
        else node.setAttribute(k, props[k]);
      });
    }
    children.forEach(function (c) {
      if (c === null || c === undefined) return;
      if (Array.isArray(c)) { c.forEach(function (cc) { if (cc) node.appendChild(cc); }); return; }
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function track(name, params) {
    if (window.AtaruAnalytics) window.AtaruAnalytics.track(name, params);
  }

  function stepOptions(step) {
    return step.dynamicOptions ? step.dynamicOptions(answers) : (step.options || []);
  }

  /* ステップが再選択されなくなった時、その回答値をクリアする（非表示設問の値を送らない対策） */
  function clearStepAnswers(step) {
    if (step.field !== undefined) {
      answers[step.field] = Array.isArray(answers[step.field]) ? [] : '';
    }
    if (step.otherField) answers[step.otherField] = '';
    if (step.subTexts) step.subTexts.forEach(function (st) { answers[st.field] = ''; });
  }

  function recomputePlan() {
    var prevIds = plannedSteps.map(function (s) { return s.id; });
    var next;
    if (answers.q1_age === '17歳以下') {
      next = [STEPS[0]];
    } else {
      next = STEPS.filter(function (s) { return s.visible(answers); });
    }
    /* Q12/Q13-A/Q13-B: Q11の選択肢が変わって候補から外れた値を除去する */
    var validQ12 = S.helpers.q11DerivedOptions(answers);
    if (answers.q12_favorite && validQ12.indexOf(answers.q12_favorite) === -1) answers.q12_favorite = '';
    if (validQ12.length === 1 && !answers.q12_favorite) answers.q12_favorite = validQ12[0];
    answers.q13a_wear_self = (answers.q13a_wear_self || []).filter(function (v) { return validQ12.indexOf(v) !== -1; });
    answers.q13b_wear_others = (answers.q13b_wear_others || []).filter(function (v) { return validQ12.indexOf(v) !== -1; });

    var nextIds = next.map(function (s) { return s.id; });
    prevIds.forEach(function (id) {
      if (nextIds.indexOf(id) === -1) {
        var dropped = STEPS.filter(function (s) { return s.id === id; })[0];
        if (dropped) clearStepAnswers(dropped);
      }
    });
    plannedSteps = next;
    return plannedSteps;
  }

  window.__Survey.engine = {
    answers: answers,
    defaultAnswers: defaultAnswers,
    recomputePlan: recomputePlan,
    makeResponseId: makeResponseId,
    h: h,
    track: track,
    stepOptions: stepOptions,
    getResponseId: function () { if (!responseId) responseId = makeResponseId(); return responseId; },
    getState: function () { return { plannedSteps: plannedSteps, currentIndex: currentIndex, surveyStarted: surveyStarted }; },
    setCurrentIndex: function (i) { currentIndex = i; },
    setSurveyStarted: function (v) { surveyStarted = v; },
    /* 既存の共通GA4設計に合わせ、form_startは「はじめる」クリック時ではなく
       実際に最初の回答（入力・選択）をした瞬間に1回だけ送る。 */
    markFormStarted: (function () {
      var started = false;
      return function () {
        if (started) return;
        started = true;
        track('form_start', { form_name: 'ataru_survey' });
      };
    })()
  };
})();

/* ── ステップ描画 ── */
(function () {
  'use strict';
  var S = window.__Survey;
  var E = S.engine;
  var h = E.h;
  var answers = E.answers;

  function badge(required) {
    return h('span', { class: 'q-badge ' + (required ? 'q-badge--required' : 'q-badge--optional') }, required ? '必須' : '任意');
  }

  function makeErrorEl() {
    return h('p', { class: 'q-error', role: 'alert' });
  }

  function showError(errEl, focusEl, message) {
    errEl.textContent = message;
    errEl.hidden = false;
    if (focusEl) {
      focusEl.focus();
      focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    E.track('form_error', { form_name: 'ataru_survey', error_type: 'required' });
  }

  function clearError(errEl) { errEl.hidden = true; errEl.textContent = ''; }

  /* サブテキスト（その他の自由記述、海外国名など）を条件付きで表示する部品 */
  function buildSubTextBlock(field, label, onInput) {
    var input = h('input', { type: 'text', id: 'sub-' + field, 'aria-label': label, onInput: function () {
      answers[field] = input.value;
      if (onInput) onInput();
    } });
    input.value = answers[field] || '';
    var wrap = h('div', { class: 'q-other' }, h('label', { for: 'sub-' + field, text: label + '（自由記述・必須）' }), input);
    return { wrap: wrap, input: input };
  }

  function renderRadio(step) {
    var panel = h('div');
    panel.appendChild(h('p', { class: 'q-title' }, step.title, badge(step.required)));
    if (step.notice) panel.appendChild(h('div', { class: 'notice-box' }, h('p', { text: step.notice })));
    if (step.hint) panel.appendChild(h('p', { class: 'q-hint', text: step.hint }));
    var errEl = makeErrorEl();
    var optGroup = h('div', { class: 'opt-group' });
    var radios = [];
    var subBlocks = {};
    /* otherField（ラジオ用の簡易「その他」指定）は、内部的にsubTextsと同じ仕組みへ正規化する */
    var subTexts = step.subTexts || (step.otherField ? [{ trigger: 'その他', field: step.otherField, label: 'その他', emailKey: step.otherEmailKey }] : null);

    function syncSubTexts() {
      if (!subTexts) return;
      subTexts.forEach(function (st) {
        var active = answers[step.field] === st.trigger;
        subBlocks[st.trigger].wrap.hidden = !active;
        if (!active) { answers[st.field] = ''; subBlocks[st.trigger].input.value = ''; }
        else { subBlocks[st.trigger].input.value = answers[st.field] || ''; }
      });
    }

    var options = E.stepOptions(step);
    options.forEach(function (opt, i) {
      var id = step.id + '-opt-' + i;
      var input = h('input', { type: 'radio', name: step.id, id: id, value: opt });
      input.checked = answers[step.field] === opt;
      input.addEventListener('change', function () {
        answers[step.field] = opt;
        E.markFormStarted();
        clearError(errEl);
        syncSubTexts();
      });
      radios.push(input);
      optGroup.appendChild(h('label', { class: 'opt-option', for: id }, input, ' ' + opt));
    });
    panel.appendChild(optGroup);

    if (subTexts) {
      subTexts.forEach(function (st) {
        var block = buildSubTextBlock(st.field, st.label, function () { clearError(errEl); });
        block.wrap.hidden = answers[step.field] !== st.trigger;
        subBlocks[st.trigger] = block;
        panel.appendChild(block.wrap);
      });
    }
    panel.appendChild(errEl);

    return {
      el: panel,
      validate: function () {
        if (step.required && !answers[step.field]) {
          showError(errEl, radios[0], 'この質問に回答してください。');
          return false;
        }
        if (subTexts) {
          for (var i = 0; i < subTexts.length; i++) {
            var st = subTexts[i];
            if (answers[step.field] === st.trigger && !(answers[st.field] || '').trim()) {
              showError(errEl, subBlocks[st.trigger].input, st.label + 'を入力してください。');
              return false;
            }
          }
        }
        clearError(errEl);
        return true;
      }
    };
  }

  var Q20_GROUP_FIELDS = ['q20a', 'q20b', 'q20c', 'q20d'];
  var Q20_EXCLUSIVE_VALUES = ['まだ分からない', '回答しない'];

  /* Q20はA〜D（4画面）に分けて表示しているが、設問としては1つ。
     Dの「まだ分からない」「回答しない」は、A〜Cを含むQ20全体の他の選択肢と
     同時選択できないようにする（Issue #107の受入条件）。 */
  function enforceQ20CrossExclusive(changedField) {
    var dHasExclusive = (answers.q20d || []).some(function (v) { return Q20_EXCLUSIVE_VALUES.indexOf(v) !== -1; });
    if (changedField === 'q20d') {
      if (dHasExclusive) {
        Q20_GROUP_FIELDS.forEach(function (f) { if (f !== 'q20d') answers[f] = []; });
      }
      return;
    }
    if ((answers[changedField] || []).length > 0 && dHasExclusive) {
      answers.q20d = answers.q20d.filter(function (v) { return Q20_EXCLUSIVE_VALUES.indexOf(v) === -1; });
    }
  }

  function renderCheckbox(step) {
    var panel = h('div');
    if (step.subTitle) {
      panel.appendChild(h('p', { class: 'q-hint', style: 'font-weight:700;color:var(--accent);margin-bottom:0.2rem;' }, step.title));
      panel.appendChild(h('p', { class: 'q-title' }, step.subTitle, badge(step.required)));
    } else {
      panel.appendChild(h('p', { class: 'q-title' }, step.title, badge(step.required)));
    }
    if (step.notice) panel.appendChild(h('div', { class: 'notice-box' }, h('p', { text: step.notice })));
    if (step.hint) panel.appendChild(h('p', { class: 'q-hint', text: step.hint }));

    var errEl = makeErrorEl();
    var optGroup = h('div', { class: 'opt-group' });
    var checks = [];
    var otherBlock = null;

    function currentArr() { return answers[step.field] || []; }

    function syncOther() {
      if (!step.otherField) return;
      var active = currentArr().indexOf('その他') !== -1;
      otherBlock.wrap.hidden = !active;
      if (!active) { answers[step.otherField] = ''; otherBlock.input.value = ''; }
    }

    function applyExclusive(changedValue, isChecked) {
      if (!step.exclusive) return;
      var arr = currentArr().slice();
      if (isChecked && step.exclusive.indexOf(changedValue) !== -1) {
        arr = [changedValue];
      } else if (isChecked && step.exclusive.indexOf(changedValue) === -1) {
        arr = arr.filter(function (v) { return step.exclusive.indexOf(v) === -1; });
      }
      answers[step.field] = arr;
      checks.forEach(function (c) { c.checked = arr.indexOf(c.value) !== -1; });
    }

    /* 特定の選択肢同士だけを排他にする（例: Q6「縛る・縛られる両方」は
       「縛られる側」「縛る側」と同時選択できない）。exclusiveのような全体排他とは異なり、
       ペア単位で衝突する組合せだけを解除する。 */
    function applyConflictPairs(changedValue, isChecked) {
      if (!step.conflictPairs || !isChecked) return;
      var toRemove = [];
      step.conflictPairs.forEach(function (pair) {
        if (pair[0] === changedValue) toRemove.push(pair[1]);
        else if (pair[1] === changedValue) toRemove.push(pair[0]);
      });
      if (!toRemove.length) return;
      var arr = currentArr().filter(function (v) { return toRemove.indexOf(v) === -1; });
      answers[step.field] = arr;
      checks.forEach(function (c) { c.checked = arr.indexOf(c.value) !== -1; });
    }

    var options = E.stepOptions(step);
    options.forEach(function (opt, i) {
      var id = step.id + '-opt-' + i;
      var input = h('input', { type: 'checkbox', id: id, value: opt });
      input.checked = currentArr().indexOf(opt) !== -1;
      input.addEventListener('change', function () {
        var arr = currentArr().slice();
        if (input.checked) { if (arr.indexOf(opt) === -1) arr.push(opt); }
        else { arr = arr.filter(function (v) { return v !== opt; }); }
        answers[step.field] = arr;
        E.markFormStarted();
        applyExclusive(opt, input.checked);
        applyConflictPairs(opt, input.checked);
        if (step.crossExclusive === 'q20') enforceQ20CrossExclusive(step.field);
        clearError(errEl);
        syncOther();
      });
      checks.push(input);
      optGroup.appendChild(h('label', { class: 'opt-option', for: id }, input, ' ' + opt));
    });
    panel.appendChild(optGroup);

    if (step.otherField) {
      otherBlock = buildSubTextBlock(step.otherField, 'その他', function () { clearError(errEl); });
      otherBlock.wrap.hidden = currentArr().indexOf('その他') === -1;
      panel.appendChild(otherBlock.wrap);
    }
    panel.appendChild(errEl);

    return {
      el: panel,
      validate: function () {
        if (step.required && currentArr().length === 0) {
          showError(errEl, checks[0], 'いずれかを選択してください。');
          return false;
        }
        if (step.otherField && currentArr().indexOf('その他') !== -1 && !(answers[step.otherField] || '').trim()) {
          showError(errEl, otherBlock.input, 'その他の内容を入力してください。');
          return false;
        }
        clearError(errEl);
        return true;
      }
    };
  }

  function renderText(step) {
    var panel = h('div');
    panel.appendChild(h('p', { class: 'q-title' }, step.title, badge(step.required)));
    if (step.hint) panel.appendChild(h('p', { class: 'q-hint', text: step.hint }));
    var ta = h('textarea', { class: 'q27', 'aria-label': step.title });
    ta.value = answers[step.field] || '';
    ta.addEventListener('input', function () { answers[step.field] = ta.value; E.markFormStarted(); });
    panel.appendChild(ta);
    return { el: panel, validate: function () { return true; } };
  }

  function renderInfo(step) {
    var panel = h('div');
    panel.appendChild(h('p', { class: 'q-title', text: step.title }));
    var lines = step.body.split('\n');
    var box = h('div', { class: 'notice-box' });
    lines.forEach(function (line) { box.appendChild(h('p', { text: line })); });
    panel.appendChild(box);
    return { el: panel, validate: function () { return true; } };
  }

  function renderStep(step) {
    if (step.type === 'radio') return renderRadio(step);
    if (step.type === 'checkbox') return renderCheckbox(step);
    if (step.type === 'text') return renderText(step);
    return renderInfo(step);
  }

  S.renderStep = renderStep;
})();

/* ── ナビゲーション制御 ── */
(function () {
  'use strict';
  var S = window.__Survey;
  var E = S.engine;
  var answers = E.answers;

  var screenIntro = document.getElementById('screen-intro');
  var screenUnderage = document.getElementById('screen-underage');
  var screenSurvey = document.getElementById('screen-survey');
  var screenComplete = document.getElementById('screen-complete');
  var stepPanel = document.getElementById('step-panel');
  var btnBack = document.getElementById('btn-back');
  var btnNext = document.getElementById('btn-next');
  var progressSection = document.getElementById('progress-section');
  var progressCount = document.getElementById('progress-count');
  var progressFill = document.getElementById('progress-fill');
  var subprogress = document.getElementById('subprogress');

  var currentValidate = null;

  function showOnly(el) {
    [screenIntro, screenUnderage, screenSurvey, screenComplete].forEach(function (s) { s.hidden = (s !== el); });
  }

  function renderCurrent() {
    var plan = E.recomputePlan();
    var st = E.getState();
    var idx = st.currentIndex;
    if (plan.length === 1 && plan[0].id === 'q1' && answers.q1_age === '17歳以下') {
      showOnly(screenUnderage);
      return;
    }
    var step = plan[idx];
    if (!step) { submitSurveyFlow(); return; }

    stepPanel.innerHTML = '';
    var result = S.renderStep(step);
    currentValidate = result.validate;
    stepPanel.appendChild(result.el);

    progressSection.textContent = step.section;
    progressCount.textContent = 'ステップ ' + (idx + 1) + ' / ' + plan.length;
    progressFill.style.width = Math.round(((idx + 1) / plan.length) * 100) + '%';

    if (step.q20Group) {
      subprogress.hidden = false;
      subprogress.textContent = 'Q20（' + step.q20Group + '/4グループ）';
    } else {
      subprogress.hidden = true;
    }

    btnBack.hidden = idx === 0;
    btnNext.textContent = (idx === plan.length - 1) ? '回答を送信する' : '次へ';

    showOnly(screenSurvey);
  }

  function goNext() {
    if (!currentValidate || currentValidate()) {
      var st = E.getState();
      var curId = st.plannedSteps[st.currentIndex] ? st.plannedSteps[st.currentIndex].id : null;
      var plan = E.recomputePlan();

      if (answers.q1_age === '17歳以下') {
        showOnly(screenUnderage);
        return;
      }
      var idxInNew = plan.findIndex(function (s) { return s.id === curId; });
      var nextIndex = (idxInNew === -1 ? st.currentIndex : idxInNew) + 1;
      if (nextIndex >= plan.length) {
        submitSurveyFlow();
        return;
      }
      E.setCurrentIndex(nextIndex);
      renderCurrent();
    }
  }

  function goBack() {
    var plan = E.recomputePlan();
    var st = E.getState();
    var newIndex = Math.max(0, st.currentIndex - 1);
    E.setCurrentIndex(newIndex);
    renderCurrent();
  }

  document.getElementById('btn-start').addEventListener('click', function () {
    E.setSurveyStarted(true);
    E.setCurrentIndex(0);
    renderCurrent();
  });

  btnNext.addEventListener('click', goNext);
  btnBack.addEventListener('click', goBack);

  S.nav = { showOnly: showOnly, screens: { intro: screenIntro, underage: screenUnderage, survey: screenSurvey, complete: screenComplete } };
  window.__submitSurveyFlowRef = function (fn) { submitSurveyFlow = fn; };
  var submitSurveyFlow = function () { /* placeholder, replaced by submit module */ };
})();

/* ── 回答送信 ── */
(function () {
  'use strict';
  var S = window.__Survey;
  var E = S.engine;
  var answers = E.answers;
  var FORM_ENDPOINT = S.FORM_ENDPOINT;

  var btnNext = document.getElementById('btn-next');
  var btnBack = document.getElementById('btn-back');
  var submitError = document.getElementById('submit-error');
  var screenComplete = document.getElementById('screen-complete');

  var submitting = false;

  function collectFieldsForPlan(plan) {
    var fd = new FormData();
    plan.forEach(function (step) {
      if (step.type === 'info') return;
      if (step.field !== undefined && step.emailKey) {
        var v = answers[step.field];
        if (Array.isArray(v)) { if (v.length) fd.append(step.emailKey, v.join('、')); }
        else if (v) { fd.append(step.emailKey, v); }
      }
      if (step.otherField && step.otherEmailKey && answers[step.otherField]) {
        fd.append(step.otherEmailKey, answers[step.otherField]);
      }
      if (step.subTexts) {
        step.subTexts.forEach(function (st) {
          if (answers[st.field]) fd.append(st.emailKey, answers[st.field]);
        });
      }
    });
    return fd;
  }

  /* 内部トリアージ用スコア。新Q番号の保存キーのみを参照する（旧保存キーは参照しない）。
     配列フィールドは `|| []` で必ず配列化してから .indexOf() を呼び、
     undefined.indexOf() のような例外を起こさない。 */
  function computeScore(a) {
    var score = 0;
    var youngAges = ['18〜24歳', '25〜29歳', '30〜34歳', '35〜39歳'];
    var q14a = a.q14a_self || [];
    var q14b = a.q14b_pref || [];
    var q13a = a.q13a_wear_self || [];
    var q11 = a.q11_uniform || [];
    var q13 = a.q13_enjoy || [];
    var q6 = a.q6_role || [];

    if (youngAges.indexOf(a.q1_age) !== -1) score += 2;
    if (a.q8_exercise === '定期的にスポーツをしている' || a.q8_exercise === 'スポーツとトレーニングの両方をしている') score += 2;
    if (a.q9_gym === '週4回以上') score += 3;
    else if (a.q9_gym === '週2〜3回') score += 2;
    if (q14a.indexOf('筋肉質だと思う') !== -1 || q14a.indexOf('がっしりした体格だと思う') !== -1) score += 2;
    if (q14a.indexOf('自分が短髪・ベリーショート') !== -1) score += 1;
    if (q14b.indexOf('短髪・坊主・スポーツ刈りの男性が好き') !== -1 || q14b.indexOf('短髪の男性を見たい') !== -1 || q14b.indexOf('短髪の男性を撮影したい') !== -1) score += 1;
    if (a.q15_gate === 'はい') score += 2;
    else if (a.q15_gate === '内容による') score += 1;
    if (q14a.indexOf('体育会系の雰囲気だと言われる') !== -1) score += 1;
    if (a.q12_favorite === '野球') score += 3;
    /* 「野球ユニを着たい／撮られたい」は自分で着たい（Q13-A）と、
       野球が関心対象（Q11/Q12）かつユニフォーム姿で撮られたい（Q13）の両方を拾う。 */
    var baseballWear = q13a.indexOf('野球') !== -1;
    var baseballPortrait = (q11.indexOf('野球') !== -1 || a.q12_favorite === '野球') && q13.indexOf('ユニフォーム姿で撮られたい') !== -1;
    if (baseballWear || baseballPortrait) score += 2;
    if (a.q4_interest === 'とても好き' || a.q4_interest === '興味がある') score += 3;
    if (q6.indexOf('縛られる側に興味がある') !== -1 || q6.indexOf('縛る・縛られる両方に興味がある') !== -1) score += 2;
    var visitOk = ['日程が合えば', '内容が合えば', '参加者や雰囲気を確認できれば', '友人と一緒なら', '宿泊を伴っても'];
    if (visitOk.indexOf(a.q22_visit) !== -1) score += 3;
    if (a.q25_intent === '東京・大阪など遠方からでも内容次第で参加したい') score += 2;
    if (a.q25_intent === '日程が合えば参加したい' || a.q25_intent === '東京・大阪など遠方からでも内容次第で参加したい') score += 3;
    return score;
  }

  function rankFromScore(score) {
    if (score >= 18) return '最優先';
    if (score >= 13) return '有望';
    if (score >= 8) return '育成候補';
    return '一般回答';
  }

  /* スコア計算は送信補助情報であり、必須条件ではない。例外が起きても
     回答送信そのものは止めない（呼び出し側でnullを返し、以降はスコアなしで進める）。 */
  function safeComputeScore(a) {
    try { return computeScore(a); } catch (e) { return null; }
  }
  function safeRankFromScore(score) {
    if (score === null || score === undefined) return null;
    try { return rankFromScore(score); } catch (e) { return null; }
  }

  /* 連絡先フォーム側（別モジュール）から、連絡希望+3の加点後スコアを再計算できるよう公開する。
     回答者の画面には一切表示しない（管理側のメール本文にのみ含める）。 */
  S.scoring = { computeScore: computeScore, rankFromScore: rankFromScore, safeComputeScore: safeComputeScore, safeRankFromScore: safeRankFromScore };

  function branchLabel(a) {
    if (a.q1_age === '17歳以下') return 'underage';
    if (a.q2_gender === '女性' || a.q2_gender === 'その他') return 'female_other';
    if (a.q2_gender === '男性') {
      if (a.q15_gate === '興味はない') return 'male_gate_no';
      if (S.helpers.isLowInterest(a)) return 'male_low_interest';
      if (S.helpers.gatePassed(a)) return 'male_full';
      return 'male_no_gate_answer';
    }
    return 'unknown';
  }

  function realSubmit() {
    if (submitting) return;
    submitting = true;
    btnNext.disabled = true;
    btnBack.disabled = true;
    btnNext.textContent = '送信中…';
    submitError.hidden = true;

    var plan = E.recomputePlan();
    var fd = collectFieldsForPlan(plan);
    var rid = E.getResponseId();
    /* スコア計算で例外が発生しても送信データ自体は組み立てを継続する（#12） */
    var score = safeComputeScore(answers);
    var rank = safeRankFromScore(score);
    fd.append('_subject', '【アタル】アンケート回答');
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fd.append('_honey', '');
    fd.append('response_id', rid);
    fd.append('送信日時', new Date().toISOString());
    fd.append('到達分岐', branchLabel(answers));
    if (score !== null) fd.append('内部スコア', String(score));
    if (rank !== null) fd.append('内部判定', rank);

    fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) { var e = new Error('failed'); e.errorType = 'server'; throw e; }
        return res.json();
      })
      .then(function () {
        /* 共通GA4設計のsurvey_submit（アンケート回答の成功）。参加確定や成果を意味しないため
           generate_leadとは分けて送る。回答内容・分岐・スコアは含めない。 */
        E.track('survey_submit', { form_name: 'ataru_survey' });
        submitting = false;
        btnNext.disabled = false;
        btnBack.disabled = false;
        S.nav.showOnly(screenComplete);
      })
      .catch(function (err) {
        submitting = false;
        btnNext.disabled = false;
        btnBack.disabled = false;
        btnNext.textContent = '回答を送信する';
        E.track('form_error', { form_name: 'ataru_survey', error_type: (err && err.errorType) || 'network' });
        submitError.hidden = false;
        submitError.focus();
        submitError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
  }

  window.__submitSurveyFlowRef(realSubmit);
})();

/* ── 任意連絡先フォーム ── */
(function () {
  'use strict';
  var S = window.__Survey;
  var E = S.engine;
  var FORM_ENDPOINT = S.FORM_ENDPOINT;

  var toggleBtn = document.getElementById('btn-lead-toggle');
  var leadForm = document.getElementById('lead-form');
  var leadFields = document.getElementById('lead-fields');
  var xField = document.getElementById('lead-x');
  var emailField = document.getElementById('lead-email');
  var requestRadios = document.querySelectorAll('input[name="lead-request"]');
  var errorEl = document.getElementById('lead-error');
  var submitBtn = document.getElementById('btn-lead-submit');
  var resultEl = document.getElementById('lead-result');
  var honey = document.getElementById('lead-honey');

  var revealed = false;
  var submitting = false;
  var leadSubmissionSeq = 0;

  toggleBtn.addEventListener('click', function () {
    revealed = !revealed;
    leadForm.hidden = !revealed;
    if (revealed) xField.focus();
  });

  function getRequestType() {
    for (var i = 0; i < requestRadios.length; i++) if (requestRadios[i].checked) return requestRadios[i].value;
    return '';
  }

  function showLeadError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  submitBtn.addEventListener('click', function () {
    if (submitting) return;
    var xVal = xField.value.trim();
    var emailVal = emailField.value.trim();
    var reqType = getRequestType();

    if (honey.value) return; /* ハニーポット：Bot対策。人間には見えないため、値があれば送信しない */

    if (!xVal && !emailVal) {
      showLeadError('Xアカウントまたはメールアドレスのどちらかを入力してください。');
      xField.focus();
      E.track('form_error', { form_name: 'ataru_survey_lead', error_type: 'required' });
      return;
    }
    if (!reqType) {
      showLeadError('希望内容を選択してください。');
      E.track('form_error', { form_name: 'ataru_survey_lead', error_type: 'required' });
      return;
    }
    errorEl.hidden = true;

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';
    resultEl.hidden = true;

    /* Issueのスコア定義「連絡希望＋連絡先送信：+3」。アンケート送信時点のスコアは
       確定済みで書き換えられないため、この連絡先メール側にのみ加点後の最終スコアを
       含める（response_idでアンケート側のメールと突き合わせられる）。回答者には非表示。
       スコア計算例外時（safeComputeScoreがnullを返す場合）は加点後スコアも送らない。 */
    var baseScore = S.scoring.safeComputeScore(E.answers);
    var finalScore = baseScore === null ? null : baseScore + 3;
    var finalRank = S.scoring.safeRankFromScore(finalScore);

    var fd = new FormData();
    fd.append('_subject', '【アタル】アンケート回答者からの連絡先希望');
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fd.append('response_id', E.getResponseId());
    if (xVal) fd.append('Xアカウント', xVal);
    if (emailVal) fd.append('メールアドレス', emailVal);
    fd.append('希望内容', reqType);
    if (finalScore !== null) fd.append('内部スコア_連絡先加点後', String(finalScore));
    if (finalRank !== null) fd.append('内部判定_連絡先加点後', finalRank);

    leadSubmissionSeq += 1;
    var submissionToken = 'survey_lead_' + leadSubmissionSeq;

    fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) { var e = new Error('failed'); e.errorType = 'server'; throw e; }
        return res.json();
      })
      .then(function () {
        /* 共通GA4設計のgenerate_lead（主成果）。lead_type: ataru_survey_lead。 */
        if (window.AtaruAnalytics) {
          window.AtaruAnalytics.trackGenerateLead(submissionToken, 'survey', { form_name: 'ataru_survey_lead' });
        }
        submitting = false;
        leadFields.hidden = true;
        resultEl.className = 'result-box result-box--success';
        resultEl.textContent = 'ご連絡先を送信しました。ありがとうございました。';
        resultEl.hidden = false;
      })
      .catch(function (err) {
        submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = '送信する';
        E.track('form_error', { form_name: 'ataru_survey_lead', error_type: (err && err.errorType) || 'network' });
        resultEl.className = 'result-box result-box--error';
        resultEl.textContent = '送信に失敗しました。入力内容はそのままですので、時間をおいて再度お試しください。';
        resultEl.hidden = false;
      });
  });
})();
