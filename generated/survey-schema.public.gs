/*
 * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * 生成元: survey-schema.json
 * 再生成: node scripts/sync-survey-schema.js
 * このファイルを直接編集しても、次回の同期で上書きされる。
 *
 * Issue #104（回答保存Web App・公開集計API）が将来import/コピーして使うための
 * 生成済みschema定義。本ファイルはIssue #106の範囲外であるendpoint・doGet/doPostを
 * 一切実装しない。base_public / gated_public の設問のみを含み、admin_only /
 * never_public の設問・leadsは含まない。
 */

/*
 * survey-schema.json の `conditions` を評価する唯一の実装。
 * Node（テスト・sync script）と GAS（scripts/sync-survey-schema.js が
 * このファイルの内容を埋め込んで生成する）の両方から同じロジックで使う。
 * ここを直接編集し、生成物（generated/*, gas/ataru_survey_admin/SurveySchema.gs）は
 * `node scripts/sync-survey-schema.js` で再生成すること。
 */
'use strict';

function evalNode(node, row, conditions) {
  switch (node.op) {
    case 'true':
      return true;
    case 'eq':
      return row[node.field] === node.value;
    case 'in':
      return (node.values || []).indexOf(row[node.field]) !== -1;
    case 'not_in':
      return (node.values || []).indexOf(row[node.field]) === -1;
    case 'and':
      return (node.args || []).every(function (n) { return evalNode(n, row, conditions); });
    case 'or':
      return (node.args || []).some(function (n) { return evalNode(n, row, conditions); });
    case 'not':
      return !evalNode(node.arg, row, conditions);
    case 'ref':
      return evaluateCondition(conditions, node.id, row);
    default:
      throw new Error('unknown condition op: ' + node.op);
  }
}

/* conditions: survey-schema.json の `conditions` オブジェクト。
   conditionId: 評価したい条件ID（例: "male_gate_passed"）。
   row: 1回答分のオブジェクト（保存列名をキーとする）。 */
function evaluateCondition(conditions, conditionId, row) {
  var node = conditions[conditionId];
  if (!node) throw new Error('unknown condition id: ' + conditionId);
  return evalNode(node, row, conditions);
}

/* 2つの条件IDの交差（AND）をその場で評価する。crossTargetCount用。
   named conditionとして事前定義しなくても、任意の2条件の交差集合を
   schemaの条件定義だけから機械的に評価できるようにするためのヘルパー。 */
function evaluateIntersection(conditions, conditionIdA, conditionIdB, row) {
  return evaluateCondition(conditions, conditionIdA, row) && evaluateCondition(conditions, conditionIdB, row);
}

var PublicSurveySchema = {
  "surveyVersion": "issue107-2026-09-18",
  "multiValueDelimiter": "|",
  "conditions": {
    "all_adults": {
      "op": "true",
      "note": "保存されている回答は17歳以下を除外済みのため、有効回答＝18歳以上の全員を対象とする。"
    },
    "male_only": {
      "op": "eq",
      "field": "q2_gender",
      "value": "男性"
    },
    "female_or_other": {
      "op": "in",
      "field": "q2_gender",
      "values": [
        "女性",
        "その他"
      ]
    },
    "low_interest_q4": {
      "op": "in",
      "field": "q4_interest",
      "values": [
        "あまり興味はない",
        "苦手",
        "よく分からない"
      ]
    },
    "male_gate_answered_yes_or_depends": {
      "op": "in",
      "field": "q15_gate",
      "values": [
        "はい",
        "内容による"
      ]
    },
    "male_gate_passed": {
      "op": "and",
      "args": [
        {
          "op": "ref",
          "id": "male_only"
        },
        {
          "op": "ref",
          "id": "male_gate_answered_yes_or_depends"
        }
      ]
    },
    "male_gate_passed_and_not_low_interest": {
      "op": "and",
      "args": [
        {
          "op": "ref",
          "id": "male_gate_passed"
        },
        {
          "op": "not",
          "arg": {
            "op": "ref",
            "id": "low_interest_q4"
          }
        }
      ]
    }
  },
  "questions": [
    {
      "id": "Q1",
      "label": "年齢",
      "subLabel": null,
      "storageField": "q1_age",
      "type": "single",
      "required": true,
      "options": [
        "17歳以下",
        "18〜24歳",
        "25〜29歳",
        "30〜34歳",
        "35〜39歳",
        "40〜49歳",
        "50〜59歳",
        "60歳以上",
        "回答しない"
      ],
      "optionsSource": null,
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "base_public",
      "publicBlock": "overview",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q3",
      "label": "居住地域",
      "subLabel": null,
      "storageField": "q3_region",
      "type": "single",
      "required": true,
      "options": [
        "北海道",
        "東北",
        "関東（東京都以外）",
        "東京都",
        "甲信越・北陸",
        "静岡県",
        "愛知県・名古屋市",
        "愛知県・尾張地域（名古屋市以外）",
        "愛知県・三河地域",
        "岐阜県",
        "三重県",
        "関西",
        "中国",
        "四国",
        "九州",
        "沖縄県",
        "海外",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "base_public",
      "publicBlock": "overview",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q4",
      "label": "緊縛・ロープ表現への関心",
      "subLabel": null,
      "storageField": "q4_interest",
      "type": "single",
      "required": true,
      "options": [
        "とても好き",
        "興味がある",
        "軽い内容なら興味がある",
        "写真や詳しい内容を見てから考えたい",
        "自分では体験しないが見ることには興味がある",
        "あまり興味はない",
        "苦手",
        "よく分からない"
      ],
      "optionsSource": null,
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "base_public",
      "publicBlock": "overview",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q5",
      "label": "緊縛では、どんな楽しみ方に関心がありますか",
      "subLabel": null,
      "storageField": "q5_enjoy",
      "type": "multi",
      "required": false,
      "options": [
        "縄の感触を感じたい",
        "縄の締まりや圧迫感を感じたい",
        "拘束されて動けない感覚を味わいたい",
        "相手に身を任せる感覚を味わいたい",
        "美しく縛られたい",
        "美しく縛ることに興味がある",
        "緊縛を見た目・作品として楽しみたい",
        "緊縛されている人を見ることに興味がある",
        "緊縛を撮影することに興味がある",
        "縄をかける技術や構成を楽しみたい",
        "まだ分からない",
        "特にない",
        "回答しない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "gated_public",
      "publicBlock": "bondage_detail",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q6",
      "label": "緊縛では、どの立場に関心がありますか",
      "subLabel": null,
      "storageField": "q6_role",
      "type": "multi",
      "required": false,
      "options": [
        "縛られる側に興味がある",
        "縛る側に興味がある",
        "縛る・縛られる両方に興味がある",
        "見るだけで楽しみたい",
        "撮影する側として関わりたい",
        "まだ分からない",
        "回答しない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "gated_public",
      "publicBlock": "bondage_detail",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q6-A",
      "label": "今後の企画との関わり方",
      "subLabel": null,
      "storageField": "q6a_involvement",
      "type": "multi",
      "required": false,
      "options": [
        "自分で体験することに興味がある",
        "縛る側として関わることに興味がある",
        "見学したい",
        "撮影する側として関わりたい",
        "作品・活動を見るだけでよい",
        "今回はアンケート回答のみ",
        "まだ分からない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "gated_public",
      "publicBlock": "bondage_detail",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q7",
      "label": "現在または過去に経験したスポーツ",
      "subLabel": null,
      "storageField": "q7_sports",
      "type": "multi",
      "required": true,
      "options": [
        "野球・ソフトボール",
        "サッカー・フットサル",
        "ラグビー・アメリカンフットボール",
        "バスケットボール",
        "バレーボール",
        "陸上競技",
        "水泳",
        "テニス・ラケット競技",
        "格闘技・武道",
        "筋力トレーニング・ボディメイク",
        "特にない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q8",
      "label": "現在の運動状況",
      "subLabel": null,
      "storageField": "q8_exercise",
      "type": "single",
      "required": true,
      "options": [
        "定期的にスポーツをしている",
        "不定期にスポーツをしている",
        "ジムや自宅でトレーニングしている",
        "スポーツとトレーニングの両方をしている",
        "現在はしていない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q9",
      "label": "ジム・筋力トレーニング頻度",
      "subLabel": null,
      "storageField": "q9_gym",
      "type": "single",
      "required": true,
      "options": [
        "週4回以上",
        "週2〜3回",
        "週1回程度",
        "月に数回",
        "ほとんどしていない",
        "現在はしていない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q10",
      "label": "スポーツ・身体づくりの動機",
      "subLabel": null,
      "storageField": "q10_motivation",
      "type": "multi",
      "required": false,
      "options": [
        "健康を維持したい",
        "筋肉をつけたい",
        "体型を維持・改善したい",
        "スポーツの競技力を高めたい",
        "見た目に自信を持ちたい",
        "モテたい",
        "写真映えする身体になりたい",
        "ユニフォームやスポーツウェアを格好よく着たい",
        "同じ趣味の人と交流したい",
        "特にない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q11",
      "label": "好きなユニフォーム・ウェア",
      "subLabel": null,
      "storageField": "q11_uniform",
      "type": "multi",
      "required": true,
      "options": [
        "野球",
        "サッカー",
        "ラグビー・アメフト",
        "バスケットボール",
        "バレーボール",
        "陸上",
        "競泳・競パン",
        "レスリング・シングレット",
        "ジャージ",
        "体操服",
        "学校・部活動制服",
        "スーツ",
        "作業着・職業制服",
        "特にない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q12",
      "label": "最も好きなユニフォーム",
      "subLabel": null,
      "storageField": "q12_favorite",
      "type": "single",
      "required": true,
      "options": [],
      "optionsSource": "dynamic:Q11",
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q13",
      "label": "ユニフォームの楽しみ方",
      "subLabel": null,
      "storageField": "q13_enjoy",
      "type": "multi",
      "required": false,
      "options": [
        "自分で着たい",
        "人が着ている姿を見たい",
        "ユニフォーム姿でスポーツをしたい",
        "ユニフォーム姿を撮影したい",
        "ユニフォーム姿で撮られたい",
        "ユニフォームのフィット感や着心地を楽しみたい",
        "背番号・ソックス・ベルト・サポーターなどの組合せを楽しみたい",
        "試合前の緊張感や、練習後の汗・着崩れた雰囲気が好き",
        "ロッカールーム・部室の雰囲気を楽しみたい",
        "同じ趣味の人と交流したい",
        "少しフェチ的な表現も楽しみたい",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q13-A",
      "label": "自分で着たいユニフォーム",
      "subLabel": null,
      "storageField": "q13a_wear_self",
      "type": "multi",
      "required": false,
      "options": [],
      "optionsSource": "dynamic:Q11",
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q13-B",
      "label": "人に着てほしい・見たいユニフォーム",
      "subLabel": null,
      "storageField": "q13b_wear_others",
      "type": "multi",
      "required": false,
      "options": [],
      "optionsSource": "dynamic:Q11",
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q14A",
      "label": "自分に当てはまる特徴",
      "subLabel": null,
      "storageField": "q14a_self",
      "type": "multi",
      "required": false,
      "options": [
        "現在、チーム・クラブ・競技団体に所属している",
        "過去に運動部・チームへ所属していた",
        "現在もスポーツを続けている",
        "定期的にジムへ通っている",
        "筋肉質だと思う",
        "がっしりした体格だと思う",
        "標準的な体格だと思う",
        "細身だと思う",
        "自分が短髪・ベリーショート",
        "体育会系の雰囲気だと言われる",
        "体育会系ではないが憧れがある",
        "回答しない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "body",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q14B",
      "label": "相手の見た目についての好み",
      "subLabel": null,
      "storageField": "q14b_pref",
      "type": "multi",
      "required": false,
      "options": [
        "短髪・坊主・スポーツ刈りの男性が好き",
        "短髪の男性を見たい",
        "短髪の男性を撮影したい",
        "筋肉質・がっしりした体格に惹かれる",
        "細身・引き締まった体格に惹かれる",
        "体毛のある男性に惹かれる",
        "体毛が少ない男性に惹かれる",
        "若々しい雰囲気に惹かれる",
        "落ち着いた年齢感に惹かれる",
        "体育会系・ノンケ寄りの雰囲気に惹かれる",
        "特にこだわりはない",
        "回答しない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "body",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q15",
      "label": "続く企画についての質問へ回答しますか",
      "subLabel": null,
      "storageField": "q15_gate",
      "type": "single",
      "required": true,
      "options": [
        "はい",
        "内容による",
        "興味はない"
      ],
      "optionsSource": null,
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "men",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q16",
      "label": "興味のある企画",
      "subLabel": null,
      "storageField": "q16_interest",
      "type": "multi",
      "required": false,
      "options": [
        "ユニフォーム交流",
        "軽いスポーツ",
        "選手名鑑風撮影",
        "練習・試合前後風撮影",
        "教室・部室・ロッカールーム風撮影",
        "身体やユニフォームのラインを生かした撮影",
        "フェチ撮影",
        "ロープ撮影",
        "緊縛撮影",
        "特にない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "men",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q17",
      "label": "緊縛・ロープの経験",
      "subLabel": null,
      "storageField": "q17_experience",
      "type": "multi",
      "required": true,
      "options": [
        "未経験",
        "写真・動画を見たことがある",
        "緊縛を見学したことがある",
        "着衣で軽く縛られたことがある",
        "床縄・部分吊りを体験したことがある",
        "本吊りを体験したことがある",
        "人を縛ったことがある",
        "緊縛を撮影したことがある",
        "その他",
        "回答しない"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "men",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q18",
      "label": "ユニフォーム姿と緊縛を組み合わせた撮影",
      "subLabel": null,
      "storageField": "q18_combo",
      "type": "single",
      "required": true,
      "options": [
        "ぜひ体験したい",
        "軽い内容なら体験したい",
        "詳細を見て判断",
        "見学して判断",
        "撮影側なら興味あり",
        "興味なし"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q19",
      "label": "興味のある緊縛範囲",
      "subLabel": null,
      "storageField": "q19_range",
      "type": "multi",
      "required": false,
      "options": [
        "手首など一部分だけロープを使う",
        "ユニフォームを着たままの着衣緊縛",
        "ユニフォームの上から軽く縛る",
        "ユニフォーム姿のまま本格的に縛る",
        "立った状態での緊縛",
        "床や椅子を使った緊縛",
        "部分吊り",
        "本吊り",
        "まず説明だけ聞きたい",
        "まだ決められない",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q20A",
      "label": "男性向け企画で関心のある詳細内容",
      "subLabel": "A. ユニフォーム・作品表現",
      "storageField": "q20a",
      "type": "multi",
      "required": false,
      "options": [
        "ユニフォーム姿のまま格好よく縛られたい",
        "写真作品として格好よく撮られたい",
        "縄とユニフォームの組合せを作品として残したい",
        "ユニフォーム姿の男性を美しく縛りたい",
        "縛られている男性を見たい",
        "縛られている男性を撮影したい",
        "緊縛作品の演出をしたい"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "A"
    },
    {
      "id": "Q20B",
      "label": "男性向け企画で関心のある詳細内容",
      "subLabel": "B. 吊り・強度",
      "storageField": "q20b",
      "type": "multi",
      "required": false,
      "options": [
        "吊られる感覚を体験したい",
        "強度のある緊縛を体験したい"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "B"
    },
    {
      "id": "Q20C",
      "label": "男性向け企画で関心のある詳細内容",
      "subLabel": "C. SM・性的な責め",
      "storageField": "q20c",
      "type": "multi",
      "required": false,
      "options": [
        "SM的な責めを受けたい",
        "言葉責めをされたい",
        "その他の性的なプレイにも興味がある"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "C"
    },
    {
      "id": "Q20D",
      "label": "男性向け企画で関心のある詳細内容",
      "subLabel": "D. その他",
      "storageField": "q20d",
      "type": "multi",
      "required": false,
      "options": [
        "縄だけを楽しみたい",
        "撮影だけを楽しみたい",
        "まだ分からない",
        "その他",
        "回答しない"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "D"
    },
    {
      "id": "Q21",
      "label": "体験時に重視する条件",
      "subLabel": null,
      "storageField": "q21_conditions",
      "type": "multi",
      "required": false,
      "options": [
        "完全個室",
        "1対1",
        "服を着たまま",
        "性的な接触なし",
        "吊りなし",
        "顔を撮影しない",
        "SNSへ掲載しない",
        "内容や強さを自分で選べる",
        "途中で中止できる",
        "事前説明がある",
        "NG項目を事前に伝えられる",
        "友人と一緒に参加できる",
        "見学してから決められる",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q22",
      "label": "名古屋での参加可能性",
      "subLabel": null,
      "storageField": "q22_visit",
      "type": "single",
      "required": true,
      "options": [
        "日程が合えば",
        "内容が合えば",
        "参加者や雰囲気を確認できれば",
        "友人と一緒なら",
        "宿泊を伴っても",
        "名古屋は難しい",
        "分からない"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "visit",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q23",
      "label": "参加しやすい曜日・時間",
      "subLabel": null,
      "storageField": "q23_schedule",
      "type": "multi",
      "required": false,
      "options": [
        "土曜昼",
        "土曜夜",
        "日曜昼",
        "日曜夜",
        "祝日昼",
        "平日夜",
        "個別相談",
        "その他"
      ],
      "optionsSource": null,
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "visit",
      "group": null,
      "q20SubGroup": null
    }
  ],
  "crossAxes": [
    "Q1",
    "Q3",
    "Q4",
    "Q6",
    "Q8",
    "Q9"
  ],
  "fixedCrossTabs": [
    {
      "id": "q11_x_q4",
      "axisA": "Q11",
      "axisB": "Q4",
      "label": "ユニフォーム嗜好 × 緊縛関心"
    },
    {
      "id": "q12_x_q4",
      "axisA": "Q12",
      "axisB": "Q4",
      "label": "最も好きなユニフォーム × 緊縛関心"
    },
    {
      "id": "q11_x_q6",
      "axisA": "Q11",
      "axisB": "Q6",
      "label": "ユニフォーム嗜好 × 緊縛の立場"
    },
    {
      "id": "q12_x_q6",
      "axisA": "Q12",
      "axisB": "Q6",
      "label": "最も好きなユニフォーム × 緊縛の立場"
    },
    {
      "id": "q4_x_q18",
      "axisA": "Q4",
      "axisB": "Q18",
      "label": "緊縛関心 × ユニ＋緊縛撮影"
    },
    {
      "id": "q4_x_q22",
      "axisA": "Q4",
      "axisB": "Q22",
      "label": "緊縛関心 × 名古屋参加可能性"
    },
    {
      "id": "q5_x_q6",
      "axisA": "Q5",
      "axisB": "Q6",
      "label": "緊縛の楽しみ方 × 立場"
    }
  ]
};
