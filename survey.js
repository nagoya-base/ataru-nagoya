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
 */
window.__Survey = {};

(function () {
  'use strict';

  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/nagoyabase2023@gmail.com';

  var OPT = {
    q1: ['17歳以下','18〜24歳','25〜29歳','30〜34歳','35〜39歳','40〜49歳','50〜59歳','60歳以上','回答しない'],
    q2: ['男性','女性','その他'],
    q3: ['北海道','東北','関東（東京都以外）','東京都','甲信越・北陸','静岡県','愛知県・名古屋市','愛知県・尾張地域（名古屋市以外）','愛知県・三河地域','岐阜県','三重県','関西','中国','四国','九州','沖縄県','海外','その他'],
    q4: ['野球・ソフトボール','サッカー・フットサル','ラグビー・アメリカンフットボール','バスケットボール','バレーボール','陸上競技','水泳','テニス・ラケット競技','格闘技・武道','筋力トレーニング・ボディメイク','特にない','その他'],
    q5: ['定期的にスポーツをしている','不定期にスポーツをしている','ジムや自宅でトレーニングしている','スポーツとトレーニングの両方をしている','現在はしていない','その他'],
    q6: ['週4回以上','週2〜3回','週1回程度','月に数回','ほとんどしていない','現在はしていない','その他'],
    q7: ['健康を維持したい','筋肉をつけたい','体型を維持・改善したい','スポーツの競技力を高めたい','見た目に自信を持ちたい','モテたい','写真映えする身体になりたい','ユニフォームやスポーツウェアを格好よく着たい','同じ趣味の人と交流したい','特にない','その他'],
    q8: ['野球','サッカー','ラグビー・アメフト','バスケットボール','バレーボール','陸上','競泳・競パン','レスリング・シングレット','ジャージ','体操服','学校・部活動制服','スーツ','作業着・職業制服','特にない','その他'],
    q10: ['自分で着たい','人が着ている姿を見たい','ユニフォーム姿でスポーツをしたい','ユニフォーム姿を撮影したい','ユニフォーム姿で撮られたい','ユニフォームのフィット感や着心地を楽しみたい','背番号・ソックス・ベルト・サポーターなどの組合せを楽しみたい','試合前の緊張感や、練習後の汗・着崩れた雰囲気が好き','ロッカールーム・部室の雰囲気を楽しみたい','同じ趣味の人と交流したい','少しフェチ的な表現も楽しみたい','その他'],
    q11a: ['現在、チーム・クラブ・競技団体に所属している','過去に運動部・チームへ所属していた','現在もスポーツを続けている','定期的にジムへ通っている','筋肉質だと思う','がっしりした体格だと思う','標準的な体格だと思う','細身だと思う','自分が短髪・ベリーショート','体育会系の雰囲気だと言われる','体育会系ではないが憧れがある','回答しない','その他'],
    q11b: ['短髪・坊主・スポーツ刈りの男性が好き','短髪の男性を見たい','短髪の男性を撮影したい','特にこだわりはない','回答しない','その他'],
    q12: ['はい','内容による','興味はない'],
    q13: ['ユニフォーム交流','軽いスポーツ','選手名鑑風撮影','練習・試合前後風撮影','教室・部室・ロッカールーム風撮影','身体やユニフォームのラインを生かした撮影','フェチ撮影','ロープ撮影','緊縛撮影','特にない','その他'],
    q14: ['未経験','写真・動画を見たことがある','緊縛を見学したことがある','着衣で軽く縛られたことがある','床縄・部分吊りを体験したことがある','本吊りを体験したことがある','人を縛ったことがある','緊縛を撮影したことがある','その他','回答しない'],
    q15: ['とても好き','興味がある','軽い内容なら興味がある','写真や詳しい内容を見てから考えたい','自分では体験しないが見ることには興味がある','あまり興味はない','苦手','よく分からない'],
    q16: ['縛られてみたい','縛ってみたい','縛る・縛られる両方に興味がある','見学したい','撮影する側として関わりたい','まだ分からない','その他'],
    q17: ['ぜひ体験したい','軽い内容なら体験したい','詳細を見て判断','見学して判断','撮影側なら興味あり','興味なし'],
    q18: ['手首など一部分だけロープを使う','ユニフォームを着たままの着衣緊縛','ユニフォームの上から軽く縛る','ユニフォーム姿のまま本格的に縛る','立った状態での緊縛','床や椅子を使った緊縛','部分吊り','本吊り','まず説明だけ聞きたい','まだ決められない','その他'],
    q19a: ['美しく縛られたい','ユニフォーム姿のまま格好よく縛られたい','写真作品として格好よく撮られたい','縄とユニフォームの組合せを作品として残したい'],
    q19b: ['縄の感触を心ゆくまで感じたい','縄の締まりや圧迫感を感じたい','強く拘束され、動けない感覚を味わいたい','相手に身を任せたい'],
    q19c: ['ユニフォーム姿の男性を美しく縛りたい','縄をかける技術や構成を楽しみたい','縛られている男性を見たい','縛られている男性を撮影したい','緊縛作品の演出をしたい'],
    q19d: ['吊られる感覚を体験したい','強度のある緊縛を体験したい'],
    q19e: ['SM的な責めを受けたい','言葉責めをされたい','その他の性的なプレイにも興味がある'],
    q19f: ['縄だけを楽しみたい','撮影だけを楽しみたい','まだ分からない','その他','回答しない'],
    q20: ['完全個室','1対1','服を着たまま','性的な接触なし','吊りなし','顔を撮影しない','SNSへ掲載しない','内容や強さを自分で選べる','途中で中止できる','事前説明がある','NG項目を事前に伝えられる','友人と一緒に参加できる','見学してから決められる','その他'],
    q21: ['日程が合えば','内容が合えば','参加者や雰囲気を確認できれば','友人と一緒なら','宿泊を伴っても','名古屋は難しい','分からない'],
    q22: ['土曜昼','土曜夜','日曜昼','日曜夜','祝日昼','平日夜','個別相談','その他'],
    q23: ['2,000円以下','3,000円程度','4,000円程度','5,000円程度','内容次第で5,000円以上','価格より内容・安全性','参加しない'],
    q24: ['日程が合えば参加したい','東京・大阪など遠方からでも内容次第で参加したい','開催案内が欲しい','写真や詳しい説明を見て考えたい','個別相談したい','友人と一緒なら参加したい','見学してから考えたい','今回は参加しない'],
    q25: ['1対1','友人と2人','3〜4人の体験会','見学後に判断','個別相談','まだ分からない','その他']
  };

  var TXT = {
    femaleOtherEnd: 'ご回答ありがとうございます。今回検討している詳しい撮影・体験企画は、成人男性を主な対象としているため、個別の嗜好に関する質問は以上です。最後に任意のメッセージ欄があります。',
    adultMenIntro: 'ここから先は、成人男性同士で行う表現・撮影・体験についての質問です。希望しない場合は、詳しい質問を飛ばして回答を完了できます。',
    playSectionIntro: '以下は関心・需要を把握するための質問です。選んだ内容の提供を約束するものではありません。実際に企画化する場合は、成人同士の明確な同意、安全性、法令、衛生面を確認したうえで内容を決定します。',
    q19eNotice: '以下の性的な項目は任意です。興味がなければ選ばずに進めます。ここでの回答は需要調査のためのものであり、実際の提供内容を約束するものではありません。',
    priceAnnounce: '名古屋・上前津の完全個室スタジオで、ユニフォーム姿の初心者向けロープ撮影を3,000円から体験できる企画を検討しています。\nユニフォームを着たまま、吊りなし、顔出し・SNS掲載なしでも参加可能。希望しない内容は断れます。\n回答しただけで申込みにはなりません。',
    q26Hint: '企画に期待すること、こんな内容なら参加したいというご要望、主催者への激励・応援メッセージなど、内容は自由です。'
  };

  var SECTION = {
    basic: '基本情報・地域',
    sports: 'スポーツ・身体づくり',
    uniform: 'ユニフォーム嗜好',
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

  function proceededPastGate(a) { return a.q2_gender === '男性' && (a.q12_gate === 'はい' || a.q12_gate === '内容による'); }
  function isLowInterest(a) { return a.q15_level === 'あまり興味はない' || a.q15_level === '苦手'; }
  function isMaleFull(a) { return proceededPastGate(a) && !!a.q15_level && !isLowInterest(a); }
  function isMaleAny(a) { return a.q2_gender === '男性'; }
  function isFemaleOther(a) { return a.q2_gender === '女性' || a.q2_gender === 'その他'; }

  /* Q12で「興味はない」を選んだ場合、Q13から緊縛系の項目（ロープ撮影・緊縛撮影）を
     除いた一般項目だけを候補にする。「緊縛・プレイ詳細を飛ばし、一般企画の関心へ」
     というIssueの意図どおり、興味なしと答えた直後に緊縛の話を再提示しないため。 */
  var Q13_KINK_OPTIONS = ['ロープ撮影', '緊縛撮影'];
  function q13Options(a) {
    if (a.q12_gate === '興味はない') {
      return OPT.q13.filter(function (v) { return Q13_KINK_OPTIONS.indexOf(v) === -1; });
    }
    return OPT.q13;
  }

  function q8DerivedOptions(a) {
    return (a.q8_uniform || []).map(function (v) {
      return v === 'その他' ? (a.q8_other ? 'その他：' + a.q8_other : 'その他') : v;
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

    { id: 'q4', section: SECTION.sports, type: 'checkbox', title: 'Q4. 現在または過去に経験したスポーツ', required: true, options: OPT.q4, field: 'q4_sports', otherField: 'q4_other', emailKey: 'Q4_経験スポーツ', otherEmailKey: 'Q4_その他',
      visible: function () { return true; } },

    { id: 'q5', section: SECTION.sports, type: 'radio', title: 'Q5. 現在の運動状況', required: true, options: OPT.q5, field: 'q5_exercise', otherField: 'q5_other', emailKey: 'Q5_運動状況', otherEmailKey: 'Q5_その他',
      visible: function () { return true; } },

    { id: 'q6', section: SECTION.sports, type: 'radio', title: 'Q6. ジム・筋力トレーニング頻度', required: true, options: OPT.q6, field: 'q6_gym', otherField: 'q6_other', emailKey: 'Q6_ジム頻度', otherEmailKey: 'Q6_その他',
      visible: function () { return true; } },

    { id: 'q7', section: SECTION.sports, type: 'checkbox', title: 'Q7. スポーツ・身体づくりの動機', required: false, options: OPT.q7, field: 'q7_motivation', otherField: 'q7_other', emailKey: 'Q7_動機', otherEmailKey: 'Q7_その他',
      visible: function () { return true; } },

    { id: 'q8', section: SECTION.uniform, type: 'checkbox', title: 'Q8. 好きなユニフォーム・ウェア', required: true, options: OPT.q8, field: 'q8_uniform', otherField: 'q8_other', emailKey: 'Q8_好きなユニフォーム', otherEmailKey: 'Q8_その他',
      visible: function () { return true; } },

    { id: 'q9', section: SECTION.uniform, type: 'radio', title: 'Q9. 最も好きなもの', required: true, field: 'q9_favorite', emailKey: 'Q9_最も好きなもの',
      dynamicOptions: q8DerivedOptions,
      visible: function (a) { return q8DerivedOptions(a).length > 1; } },

    { id: 'q10', section: SECTION.uniform, type: 'checkbox', title: 'Q10. 楽しみ方', required: false, options: OPT.q10, field: 'q10_enjoy', otherField: 'q10_other', emailKey: 'Q10_楽しみ方', otherEmailKey: 'Q10_その他',
      visible: function () { return true; } },

    { id: 'q10a', section: SECTION.uniform, type: 'checkbox', title: 'Q10-A. 自分で着たいユニフォーム', hint: '任意です。Q8で選んだものの中から選べます。', required: false, field: 'q10_wear_self', emailKey: 'Q10_自分で着たいユニフォーム',
      dynamicOptions: q8DerivedOptions,
      visible: function (a) { return q8DerivedOptions(a).length > 0; } },

    { id: 'q10b', section: SECTION.uniform, type: 'checkbox', title: 'Q10-B. 人に着てほしい・見たいユニフォーム', hint: '任意です。Q8で選んだものの中から選べます。', required: false, field: 'q10_wear_others', emailKey: 'Q10_人に着てほしいユニフォーム',
      dynamicOptions: q8DerivedOptions,
      visible: function (a) { return q8DerivedOptions(a).length > 0; } },

    { id: 'female_other_end', section: SECTION.end, type: 'info', title: 'ご案内', body: TXT.femaleOtherEnd,
      visible: function (a) { return isFemaleOther(a); } },

    { id: 'adult_men_intro', section: SECTION.men, type: 'info', title: 'ここからのご案内', body: TXT.adultMenIntro,
      visible: function (a) { return a.q2_gender === '男性'; } },

    { id: 'q11a', section: SECTION.men, type: 'checkbox', title: 'Q11A. 自分に当てはまる特徴', required: false, options: OPT.q11a, otherField: 'q11a_other', field: 'q11a_self', exclusive: ['回答しない'], emailKey: 'Q11A_自分の特徴', otherEmailKey: 'Q11A_その他',
      visible: function (a) { return a.q2_gender === '男性'; } },

    { id: 'q11b', section: SECTION.men, type: 'checkbox', title: 'Q11B. 相手の見た目についての好み', required: false, options: OPT.q11b, otherField: 'q11b_other', field: 'q11b_pref', exclusive: ['回答しない'], emailKey: 'Q11B_相手の好み', otherEmailKey: 'Q11B_その他',
      visible: function (a) { return a.q2_gender === '男性'; } },

    { id: 'q12', section: SECTION.men, type: 'radio', title: 'Q12. 成人男性同士の企画を前提に、この先の質問へ回答しますか', required: true, options: OPT.q12, field: 'q12_gate', emailKey: 'Q12_成人男性企画ゲート',
      visible: function (a) { return a.q2_gender === '男性'; } },

    /* Q12で「興味はない」を選んだ場合でも、Q13は緊縛系以外の一般項目（ユニフォーム交流・
       軽いスポーツ・撮影企画など）への関心を拾うための設問として表示を続ける。
       緊縛系の項目を選ぶかどうかは回答者の任意選択に委ねる（Issueの選択肢構成どおり）。 */
    { id: 'q13', section: SECTION.men, type: 'checkbox', title: 'Q13. 興味のある企画', required: false, dynamicOptions: q13Options, otherField: 'q13_other', field: 'q13_interest', emailKey: 'Q13_興味のある企画', otherEmailKey: 'Q13_その他',
      visible: function (a) { return a.q2_gender === '男性' && !!a.q12_gate; } },

    { id: 'q14', section: SECTION.men, type: 'checkbox', title: 'Q14. 緊縛・ロープの経験', required: true, options: OPT.q14, otherField: 'q14_other', field: 'q14_experience', exclusive: ['未経験', '回答しない'], emailKey: 'Q14_緊縛経験', otherEmailKey: 'Q14_その他',
      visible: function (a) { return proceededPastGate(a); } },

    { id: 'q15', section: SECTION.men, type: 'radio', title: 'Q15. 緊縛・ロープ表現への関心', required: true, options: OPT.q15, field: 'q15_level', emailKey: 'Q15_緊縛への関心',
      visible: function (a) { return proceededPastGate(a); } },

    { id: 'q16', section: SECTION.men, type: 'checkbox', title: 'Q16. 興味のある立場', required: false, options: OPT.q16, otherField: 'q16_other', field: 'q16_role', emailKey: 'Q16_興味のある立場', otherEmailKey: 'Q16_その他',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q17', section: SECTION.men, type: 'radio', title: 'Q17. ユニフォーム姿と緊縛を組み合わせた撮影', required: true, options: OPT.q17, field: 'q17_combo', emailKey: 'Q17_ユニフォーム緊縛撮影',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q18', section: SECTION.men, type: 'checkbox', title: 'Q18. 興味のある緊縛範囲', required: false, options: OPT.q18, otherField: 'q18_other', field: 'q18_range', emailKey: 'Q18_緊縛範囲', otherEmailKey: 'Q18_その他',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'play_intro', section: SECTION.play, type: 'info', title: 'ここからのご案内', body: TXT.playSectionIntro,
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q19a', section: SECTION.play, type: 'checkbox', title: 'Q19. 緊縛体験で求めるもの', subTitle: 'A. 見た目・作品として楽しみたい', required: false, options: OPT.q19a, field: 'q19a', emailKey: 'Q19A_見た目作品', q19group: 1,
      visible: function (a) { return isMaleFull(a); } , crossExclusive: 'q19' },

    { id: 'q19b', section: SECTION.play, type: 'checkbox', title: 'Q19. 緊縛体験で求めるもの', subTitle: 'B. 縄そのもの・拘束感を味わいたい', required: false, options: OPT.q19b, field: 'q19b', emailKey: 'Q19B_縄拘束感', q19group: 2,
      visible: function (a) { return isMaleFull(a); } , crossExclusive: 'q19' },

    { id: 'q19c', section: SECTION.play, type: 'checkbox', title: 'Q19. 緊縛体験で求めるもの', subTitle: 'C. 縛る・見る・撮る側として楽しみたい', required: false, options: OPT.q19c, field: 'q19c', emailKey: 'Q19C_縛る見る撮る', q19group: 3,
      visible: function (a) { return isMaleFull(a); } , crossExclusive: 'q19' },

    { id: 'q19d', section: SECTION.play, type: 'checkbox', title: 'Q19. 緊縛体験で求めるもの', subTitle: 'D. 吊り・強度を楽しみたい', required: false, options: OPT.q19d, field: 'q19d', emailKey: 'Q19D_吊り強度', q19group: 4,
      visible: function (a) { return isMaleFull(a); } , crossExclusive: 'q19' },

    { id: 'q19e', section: SECTION.play, type: 'checkbox', title: 'Q19. 緊縛体験で求めるもの', subTitle: 'E. SM・性的な責めにも関心がある', notice: TXT.q19eNotice, required: false, options: OPT.q19e, field: 'q19e', emailKey: 'Q19E_SM性的責め', q19group: 5,
      visible: function (a) { return isMaleFull(a); } , crossExclusive: 'q19' },

    { id: 'q19f', section: SECTION.play, type: 'checkbox', title: 'Q19. 緊縛体験で求めるもの', subTitle: 'F. その他', required: false, options: OPT.q19f, otherField: 'q19f_other', field: 'q19f', exclusive: ['まだ分からない', '回答しない'], emailKey: 'Q19F_その他選択', otherEmailKey: 'Q19F_その他', q19group: 6,
      visible: function (a) { return isMaleFull(a); } , crossExclusive: 'q19' },

    { id: 'q20', section: SECTION.play, type: 'checkbox', title: 'Q20. 体験時に重視する条件', required: false, options: OPT.q20, otherField: 'q20_other', field: 'q20_conditions', emailKey: 'Q20_重視条件', otherEmailKey: 'Q20_その他',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q21', section: SECTION.visit, type: 'radio', title: 'Q21. 名古屋での参加可能性', required: true, options: OPT.q21, field: 'q21_visit', emailKey: 'Q21_名古屋参加可能性',
      visible: function (a) { return isMaleAny(a); } },

    { id: 'q22', section: SECTION.visit, type: 'checkbox', title: 'Q22. 参加しやすい曜日・時間', required: false, options: OPT.q22, otherField: 'q22_other', field: 'q22_schedule', emailKey: 'Q22_参加曜日時間', otherEmailKey: 'Q22_その他',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q23', section: SECTION.visit, type: 'radio', title: 'Q23. 初心者向け短時間体験の参加しやすい価格', required: true, options: OPT.q23, field: 'q23_price', emailKey: 'Q23_価格',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'price_announce', section: SECTION.invite, type: 'info', title: '体験のご案内', body: TXT.priceAnnounce,
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q24', section: SECTION.invite, type: 'radio', title: 'Q24. 現在の参加意向', required: true, options: OPT.q24, field: 'q24_intent', emailKey: 'Q24_参加意向',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q25', section: SECTION.invite, type: 'checkbox', title: 'Q25. 希望参加形式', required: false, options: OPT.q25, otherField: 'q25_other', field: 'q25_format', emailKey: 'Q25_参加形式', otherEmailKey: 'Q25_その他',
      visible: function (a) { return isMaleFull(a); } },

    { id: 'q26', section: SECTION.end, type: 'text', title: 'Q26. その他、ご意見・ご要望・激励・応援メッセージ', hint: TXT.q26Hint, required: false, field: 'q26_message', emailKey: 'Q26_メッセージ',
      visible: function () { return true; } }
  ];

  window.__Survey.STEPS = STEPS;
  window.__Survey.helpers = { proceededPastGate: proceededPastGate, isLowInterest: isLowInterest, isMaleFull: isMaleFull, isMaleAny: isMaleAny, isFemaleOther: isFemaleOther, q8DerivedOptions: q8DerivedOptions, q13Options: q13Options };
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
      q4_sports: [], q4_other: '',
      q5_exercise: '', q5_other: '',
      q6_gym: '', q6_other: '',
      q7_motivation: [], q7_other: '',
      q8_uniform: [], q8_other: '',
      q9_favorite: '',
      q10_enjoy: [], q10_other: '',
      q10_wear_self: [], q10_wear_others: [],
      q11a_self: [], q11a_other: '',
      q11b_pref: [], q11b_other: '',
      q12_gate: '',
      q13_interest: [], q13_other: '',
      q14_experience: [], q14_other: '',
      q15_level: '',
      q16_role: [], q16_other: '',
      q17_combo: '',
      q18_range: [], q18_other: '',
      q19a: [], q19b: [], q19c: [], q19d: [], q19e: [],
      q19f: [], q19f_other: '',
      q20_conditions: [], q20_other: '',
      q21_visit: '',
      q22_schedule: [], q22_other: '',
      q23_price: '',
      q24_intent: '',
      q25_format: [], q25_other: '',
      q26_message: ''
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
    /* Q9/Q10サブ設問: Q8の選択肢が変わって候補から外れた値を除去する */
    var validQ9 = S.helpers.q8DerivedOptions(answers);
    if (answers.q9_favorite && validQ9.indexOf(answers.q9_favorite) === -1) answers.q9_favorite = '';
    if (validQ9.length === 1 && !answers.q9_favorite) answers.q9_favorite = validQ9[0];
    answers.q10_wear_self = (answers.q10_wear_self || []).filter(function (v) { return validQ9.indexOf(v) !== -1; });
    answers.q10_wear_others = (answers.q10_wear_others || []).filter(function (v) { return validQ9.indexOf(v) !== -1; });

    /* Q12を「興味はない」に変更した後（戻って変更した場合を含む）、
       Q13で以前選んでいたロープ撮影・緊縛撮影が候補から消えても回答値に
       残らないよう、候補外の選択値を除去する。 */
    var validQ13 = S.helpers.q13Options(answers);
    answers.q13_interest = (answers.q13_interest || []).filter(function (v) { return validQ13.indexOf(v) !== -1; });

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

  var Q19_GROUP_FIELDS = ['q19a', 'q19b', 'q19c', 'q19d', 'q19e', 'q19f'];
  var Q19_EXCLUSIVE_VALUES = ['まだ分からない', '回答しない'];

  /* Q19は6画面（A〜F）に分けて表示しているが、設問としては1つ。
     Fの「まだ分からない」「回答しない」は、A〜Eを含むQ19全体の他の選択肢と
     同時選択できないようにする（Issueの受入条件）。 */
  function enforceQ19CrossExclusive(changedField) {
    var fHasExclusive = (answers.q19f || []).some(function (v) { return Q19_EXCLUSIVE_VALUES.indexOf(v) !== -1; });
    if (changedField === 'q19f') {
      if (fHasExclusive) {
        Q19_GROUP_FIELDS.forEach(function (f) { if (f !== 'q19f') answers[f] = []; });
      }
      return;
    }
    if ((answers[changedField] || []).length > 0 && fHasExclusive) {
      answers.q19f = answers.q19f.filter(function (v) { return Q19_EXCLUSIVE_VALUES.indexOf(v) === -1; });
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
        if (step.crossExclusive === 'q19') enforceQ19CrossExclusive(step.field);
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
    var ta = h('textarea', { class: 'q26', 'aria-label': step.title });
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

    if (step.q19group) {
      subprogress.hidden = false;
      subprogress.textContent = 'Q19（' + step.q19group + '/6グループ）';
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

  function computeScore(a) {
    var score = 0;
    var youngAges = ['18〜24歳', '25〜29歳', '30〜34歳', '35〜39歳'];
    if (youngAges.indexOf(a.q1_age) !== -1) score += 2;
    if (a.q5_exercise === '定期的にスポーツをしている' || a.q5_exercise === 'スポーツとトレーニングの両方をしている') score += 2;
    if (a.q6_gym === '週4回以上') score += 3;
    else if (a.q6_gym === '週2〜3回') score += 2;
    if (a.q11a_self.indexOf('筋肉質だと思う') !== -1 || a.q11a_self.indexOf('がっしりした体格だと思う') !== -1) score += 2;
    if (a.q11a_self.indexOf('自分が短髪・ベリーショート') !== -1) score += 1;
    if (a.q11b_pref.indexOf('短髪・坊主・スポーツ刈りの男性が好き') !== -1 || a.q11b_pref.indexOf('短髪の男性を見たい') !== -1 || a.q11b_pref.indexOf('短髪の男性を撮影したい') !== -1) score += 1;
    if (a.q12_gate === 'はい') score += 2;
    else if (a.q12_gate === '内容による') score += 1;
    if (a.q11a_self.indexOf('体育会系の雰囲気だと言われる') !== -1) score += 1;
    if (a.q9_favorite === '野球') score += 3;
    /* 「野球ユニを着たい／撮られたい」は自分で着たい（Q10-A）と、
       野球が関心対象（Q8/Q9）かつユニフォーム姿で撮られたい（Q10）の両方を拾う。 */
    var baseballWear = a.q10_wear_self.indexOf('野球') !== -1;
    var baseballPortrait = (a.q8_uniform.indexOf('野球') !== -1 || a.q9_favorite === '野球') &&
      a.q10_enjoy.indexOf('ユニフォーム姿で撮られたい') !== -1;
    if (baseballWear || baseballPortrait) score += 2;
    if (a.q15_level === 'とても好き' || a.q15_level === '興味がある') score += 3;
    if (a.q16_role.indexOf('縛られてみたい') !== -1 || a.q16_role.indexOf('縛る・縛られる両方に興味がある') !== -1) score += 2;
    var visitOk = ['日程が合えば', '内容が合えば', '参加者や雰囲気を確認できれば', '友人と一緒なら', '宿泊を伴っても'];
    if (visitOk.indexOf(a.q21_visit) !== -1) score += 3;
    if (a.q24_intent === '東京・大阪など遠方からでも内容次第で参加したい') score += 2;
    if (a.q24_intent === '日程が合えば参加したい' || a.q24_intent === '東京・大阪など遠方からでも内容次第で参加したい') score += 3;
    return score;
  }

  function rankFromScore(score) {
    if (score >= 18) return '最優先';
    if (score >= 13) return '有望';
    if (score >= 8) return '育成候補';
    return '一般回答';
  }

  /* 連絡先フォーム側（別モジュール）から、連絡希望+3の加点後スコアを再計算できるよう公開する。
     回答者の画面には一切表示しない（管理側のメール本文にのみ含める）。 */
  S.scoring = { computeScore: computeScore, rankFromScore: rankFromScore };

  function branchLabel(a) {
    if (a.q1_age === '17歳以下') return 'underage';
    if (a.q2_gender === '女性' || a.q2_gender === 'その他') return 'female_other';
    if (a.q2_gender === '男性') {
      if (a.q12_gate === '興味はない') return 'male_gate_no';
      if (a.q15_level === 'あまり興味はない' || a.q15_level === '苦手') return 'male_low_interest';
      return 'male_full';
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
    var score = computeScore(answers);
    fd.append('_subject', '【アタル】アンケート回答');
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fd.append('_honey', '');
    fd.append('response_id', rid);
    fd.append('送信日時', new Date().toISOString());
    fd.append('到達分岐', branchLabel(answers));
    fd.append('内部スコア', String(score));
    fd.append('内部判定', rankFromScore(score));

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
       含める（response_idでアンケート側のメールと突き合わせられる）。回答者には非表示。 */
    var baseScore = S.scoring.computeScore(E.answers);
    var finalScore = baseScore + 3;

    var fd = new FormData();
    fd.append('_subject', '【アタル】アンケート回答者からの連絡先希望');
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fd.append('response_id', E.getResponseId());
    if (xVal) fd.append('Xアカウント', xVal);
    if (emailVal) fd.append('メールアドレス', emailVal);
    fd.append('希望内容', reqType);
    fd.append('内部スコア_連絡先加点後', String(finalScore));
    fd.append('内部判定_連絡先加点後', S.scoring.rankFromScore(finalScore));

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
