/*
 * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * 生成元: survey-schema.json
 * 再生成: node scripts/sync-survey-schema.js
 * このファイルを直接編集しても、次回の同期で上書きされる。
 *
 * survey.js のフロント定義との一致をtest/front-consistency.test.jsで検証するための
 * 参照データ。survey.js自体はこのファイルをロードしない（大規模なUI改修を避けるため）。
 */
'use strict';

var SurveySchemaFront = {
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
      "frontStepId": "q1",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "base_public",
      "publicBlock": "overview",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q2",
      "frontStepId": "q2",
      "storageField": "q2_gender",
      "type": "single",
      "required": true,
      "options": [
        "男性",
        "女性",
        "その他"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q2_gender_other"
        }
      ],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "never_public",
      "publicBlock": "internal",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q3",
      "frontStepId": "q3",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "海外",
          "field": "q3_country"
        },
        {
          "trigger": "その他",
          "field": "q3_region_other"
        }
      ],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "base_public",
      "publicBlock": "overview",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q4",
      "frontStepId": "q4",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "base_public",
      "publicBlock": "overview",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q5",
      "frontStepId": "q5",
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
      "exclusiveOptions": [
        "まだ分からない",
        "特にない",
        "回答しない"
      ],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q5_other"
        }
      ],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "gated_public",
      "publicBlock": "bondage_detail",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q6",
      "frontStepId": "q6",
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
      "exclusiveOptions": [
        "まだ分からない",
        "回答しない"
      ],
      "conflictPairs": [
        [
          "縛る・縛られる両方に興味がある",
          "縛られる側に興味がある"
        ],
        [
          "縛る・縛られる両方に興味がある",
          "縛る側に興味がある"
        ]
      ],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q6_other"
        }
      ],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "gated_public",
      "publicBlock": "bondage_detail",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q6-A",
      "frontStepId": "q6a",
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
      "exclusiveOptions": [
        "今回はアンケート回答のみ",
        "まだ分からない"
      ],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q6a_other"
        }
      ],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "gated_public",
      "publicBlock": "bondage_detail",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q7",
      "frontStepId": "q7",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q7_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q8",
      "frontStepId": "q8",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q8_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q9",
      "frontStepId": "q9",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q9_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q10",
      "frontStepId": "q10",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q10_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "sports",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q11",
      "frontStepId": "q11",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q11_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q12",
      "frontStepId": "q12",
      "storageField": "q12_favorite",
      "type": "single",
      "required": true,
      "options": [],
      "optionsSource": "dynamic:Q11",
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q13",
      "frontStepId": "q13",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q13_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q13-A",
      "frontStepId": "q13a",
      "storageField": "q13a_wear_self",
      "type": "multi",
      "required": false,
      "options": [],
      "optionsSource": "dynamic:Q11",
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q13-B",
      "frontStepId": "q13b",
      "storageField": "q13b_wear_others",
      "type": "multi",
      "required": false,
      "options": [],
      "optionsSource": "dynamic:Q11",
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "uniform",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q14A",
      "frontStepId": "q14a",
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
      "exclusiveOptions": [
        "回答しない"
      ],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q14a_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "body",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q14B",
      "frontStepId": "q14b",
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
      "exclusiveOptions": [
        "回答しない"
      ],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q14b_other"
        }
      ],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "body",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q15",
      "frontStepId": "q15",
      "storageField": "q15_gate",
      "type": "single",
      "required": true,
      "options": [
        "はい",
        "内容による",
        "興味はない"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_only",
      "targetCountCondition": "male_only",
      "publicationClass": "gated_public",
      "publicBlock": "men",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q16",
      "frontStepId": "q16",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q16_other"
        }
      ],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "men",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q17",
      "frontStepId": "q17",
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
      "exclusiveOptions": [
        "未経験",
        "回答しない"
      ],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q17_other"
        }
      ],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "men",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q18",
      "frontStepId": "q18",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q19",
      "frontStepId": "q19",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q19_other"
        }
      ],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q20A",
      "frontStepId": "q20a",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "A"
    },
    {
      "id": "Q20B",
      "frontStepId": "q20b",
      "storageField": "q20b",
      "type": "multi",
      "required": false,
      "options": [
        "吊られる感覚を体験したい",
        "強度のある緊縛を体験したい"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "B"
    },
    {
      "id": "Q20C",
      "frontStepId": "q20c",
      "storageField": "q20c",
      "type": "multi",
      "required": false,
      "options": [
        "SM的な責めを受けたい",
        "言葉責めをされたい",
        "その他の性的なプレイにも興味がある"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "C"
    },
    {
      "id": "Q20D",
      "frontStepId": "q20d",
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
      "exclusiveOptions": [
        "まだ分からない",
        "回答しない"
      ],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q20d_other"
        }
      ],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": "Q20",
      "q20SubGroup": "D"
    },
    {
      "id": "Q21",
      "frontStepId": "q21",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q21_other"
        }
      ],
      "displayCondition": "male_gate_passed_and_not_low_interest",
      "targetCountCondition": "male_gate_passed_and_not_low_interest",
      "publicationClass": "gated_public",
      "publicBlock": "play",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q22",
      "frontStepId": "q22",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "visit",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q23",
      "frontStepId": "q23",
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
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q23_other"
        }
      ],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "gated_public",
      "publicBlock": "visit",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q24",
      "frontStepId": "q24",
      "storageField": "q24_price",
      "type": "single",
      "required": true,
      "options": [
        "2,000円以下",
        "3,000円程度",
        "4,000円程度",
        "5,000円程度",
        "内容次第で5,000円以上",
        "価格より内容・安全性",
        "参加しない"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "admin_only",
      "publicBlock": "admin",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q25",
      "frontStepId": "q25",
      "storageField": "q25_intent",
      "type": "single",
      "required": true,
      "options": [
        "日程が合えば参加したい",
        "東京・大阪など遠方からでも内容次第で参加したい",
        "開催案内が欲しい",
        "写真や詳しい説明を見て考えたい",
        "個別相談したい",
        "友人と一緒なら参加したい",
        "見学してから考えたい",
        "今回は参加しない"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "admin_only",
      "publicBlock": "admin",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q26",
      "frontStepId": "q26",
      "storageField": "q26_format",
      "type": "multi",
      "required": false,
      "options": [
        "1対1",
        "友人と2人",
        "3〜4人の体験会",
        "見学後に判断",
        "個別相談",
        "まだ分からない",
        "その他"
      ],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [
        {
          "trigger": "その他",
          "field": "q26_other"
        }
      ],
      "displayCondition": "male_gate_passed",
      "targetCountCondition": "male_gate_passed",
      "publicationClass": "admin_only",
      "publicBlock": "admin",
      "group": null,
      "q20SubGroup": null
    },
    {
      "id": "Q27",
      "frontStepId": "q27",
      "storageField": "q27_message",
      "type": "text",
      "required": false,
      "options": [],
      "optionsSource": null,
      "exclusiveOptions": [],
      "conflictPairs": [],
      "freeTextFields": [],
      "displayCondition": "all_adults",
      "targetCountCondition": "all_adults",
      "publicationClass": "never_public",
      "publicBlock": "internal",
      "group": null,
      "q20SubGroup": null
    }
  ],
  "q20CrossExclusive": {
    "group": "Q20",
    "exclusiveValues": [
      "まだ分からない",
      "回答しない"
    ],
    "memberQuestionIds": [
      "Q20A",
      "Q20B",
      "Q20C",
      "Q20D"
    ],
    "note": "Q20D の「まだ分からない」「回答しない」はQ20A〜Dの他の全選択肢と同時選択不可。"
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SurveySchemaFront;
}
