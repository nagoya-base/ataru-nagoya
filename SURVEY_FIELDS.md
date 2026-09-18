# survey.html 保存キー対応表（Issue #107）

`survey.js` の内部保存フィールド名は、Issue #107 で PR #105 時点の設問構成から
Q1〜Q27 の新構成へ改修したのに合わせて、旧番号を画面表示だけ読み替えるのではなく
実データとして新しいQ番号へ揃えている。Issue #106 で `survey-schema.json` を
正本化する際は、このファイルの対応表をそのまま出発点にできる。

同じ対応表は `survey.js` 冒頭のコメントにも残している（実装と一緒に読めるように）。
このファイルはIssue横断で参照しやすいよう独立させたもの。

## 全体構成の変更点

- 旧：スポーツ・ユニフォームを主とし、後半に成人男性向け緊縛設問（Q12ゲート以降）
- 新：Q4〜Q6-Aで18歳以上の全ジェンダー共通の緊縛・ロープ関心を先に聞き、
  Q2（性自認）が男性の回答者だけがQ7以降のスポーツ・ユニフォーム・成人向け設問へ進む

## フィールド対応表

| 新Q番号 | 新フィールド | 旧フィールド（PR #105） | 備考 |
| --- | --- | --- | --- |
| Q1 | `q1_age` | `q1_age` | 変更なし |
| Q2 | `q2_gender` / `q2_gender_other` | 同左 | 変更なし |
| Q3 | `q3_region` / `q3_country` / `q3_region_other` | 同左 | 変更なし |
| Q4 | `q4_interest` | `q15_level` | 全ジェンダー共通の設問へ移動 |
| Q5 | `q5_enjoy` / `q5_other` | （新設） | 緊縛の楽しみ方 |
| Q6 | `q6_role` / `q6_other` | `q16_role`（一部統合） | 立場（縛られる／縛る／両方／見学／撮影） |
| Q6-A | `q6a_involvement` / `q6a_other` | （新設） | 今後の企画との関わり方 |
| Q7 | `q7_sports` / `q7_other` | `q4_sports` / `q4_other` | |
| Q8 | `q8_exercise` / `q8_other` | `q5_exercise` / `q5_other` | |
| Q9 | `q9_gym` / `q9_other` | `q6_gym` / `q6_other` | |
| Q10 | `q10_motivation` / `q10_other` | `q7_motivation` / `q7_other` | |
| Q11 | `q11_uniform` / `q11_other` | `q8_uniform` / `q8_other` | |
| Q12 | `q12_favorite` | `q9_favorite` | Q11選択肢から動的生成 |
| Q13 | `q13_enjoy` / `q13_other` | `q10_enjoy` / `q10_other` | |
| Q13-A | `q13a_wear_self` | `q10_wear_self` | 独立フィールド |
| Q13-B | `q13b_wear_others` | `q10_wear_others` | 独立フィールド |
| Q14A | `q14a_self` / `q14a_other` | `q11a_self` / `q11a_other` | 独立フィールド |
| Q14B | `q14b_pref` / `q14b_other` | `q11b_pref` / `q11b_other` | 独立フィールド・選択肢拡張 |
| Q15 | `q15_gate` | `q12_gate` | 文言変更（性的指向を問わない表現へ） |
| Q16 | `q16_interest` / `q16_other` | `q13_interest` / `q13_other` | ゲート「興味はない」時の候補フィルタは廃止 |
| Q17 | `q17_experience` / `q17_other` | `q14_experience` / `q14_other` | |
| Q18 | `q18_combo` | `q17_combo` | |
| Q19 | `q19_range` / `q19_other` | `q18_range` / `q18_other` | |
| Q20A | `q20a` | `q19a` + 一部 `q19c` | ユニフォーム・作品表現 |
| Q20B | `q20b` | `q19d` | 吊り・強度 |
| Q20C | `q20c` | `q19e` | SM・性的な責め（任意） |
| Q20D | `q20d` / `q20d_other` | `q19f` / `q19f_other` | その他 |
| Q21 | `q21_conditions` / `q21_other` | `q20_conditions` / `q20_other` | |
| Q22 | `q22_visit` | `q21_visit` | |
| Q23 | `q23_schedule` / `q23_other` | `q22_schedule` / `q22_other` | |
| Q24 | `q24_price` | `q23_price` | |
| Q25 | `q25_intent` | `q24_intent` | |
| Q26 | `q26_format` / `q26_other` | `q25_format` / `q25_other` | |
| Q27 | `q27_message` | `q26_message` | |

旧 `q19b`（縄の感触・締まり・拘束感・身を任せる）は、新Q5（全ジェンダー共通の
緊縛の楽しみ方）に統合されたため独立フィールドとしては存在しない。
旧 `q19c` の一部（縄をかける技術・縛りたい・見たい・撮りたい）も同様にQ5/Q6へ
吸収され、Q20Aには作品・撮影寄りの項目だけを残した。

## 分岐ロジック（`survey.js` の `helpers`）

- `isMaleAny(a)`: `a.q2_gender === '男性'`
- `isFemaleOther(a)`: `a.q2_gender === '女性' || a.q2_gender === 'その他'`
- `isLowInterest(a)`: `a.q4_interest` が「あまり興味はない／苦手／よく分からない」
- `gatePassed(a)`: 男性かつ `a.q15_gate` が「はい」または「内容による」
- `showDetailBlock(a)`: `gatePassed(a) && !isLowInterest(a)`（Q18〜Q21の表示条件）

女性・その他はQ6-A回答後、Q7〜Q26を一切表示せずQ27へ進む。
男性はQ7〜Q14Bへ進み、Q15ゲートで「興味はない」ならQ16〜Q26をスキップしてQ27へ、
「はい／内容による」ならQ16・Q17を表示したうえで、Q4が低関心の場合のみQ18〜Q21を
スキップしてQ22へ進む。Q22〜Q26はゲート通過者全員が到達する。

3,000円体験案内（`price_announce`）はQ24回答後（`!!a.q24_price`）にのみ計画へ含まれる。

## computeScore() / rankFromScore()

新Q番号の保存キーのみを参照する（旧保存キーは一切参照しない）。配列フィールドは
必ず `|| []` を経由してから `.indexOf()` を呼び、未定義値による例外を防ぐ。
スコア計算自体で例外が発生しても、`realSubmit()` は `safeComputeScore` /
`safeRankFromScore` を通すことで送信処理を継続する（スコア関連フィールドを
省略して送信する）。
