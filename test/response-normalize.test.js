/*
 * 回答保存GAS（Issue #104）のサーバー側表示条件再検証の検証。
 * クライアントの表示制御をバイパスして非到達設問の値を送ってきた場合でも、
 * displayConditionの再評価だけで非到達設問の値を破棄できることを確認する
 * （性自認分岐・Q15分岐・Q4低関心分岐を個別に手書きしていないことの検証）。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var norm = require('../scripts/lib/response-normalize');

var schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'survey-schema.json'), 'utf8'));

test('性自認分岐：女性が男性専用設問（Q7・Q24）の値を注入しても保存されない', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '女性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q15_gate: 'はい', q24_price: '3,000円程度'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.deepStrictEqual(res.row.q7_sports, []);
  assert.strictEqual(res.row.q24_price, '');
  assert.strictEqual(res.row.q15_gate, '', 'Q15自体も女性は非到達のため保存されない');
  assert.strictEqual(res.completionStage, 'female_other_end');
});

test('Q15分岐：Q15「興味はない」の男性がQ16以降の値を注入しても保存されない', function () {
  var raw = {
    q1_age: '30〜34歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q15_gate: '興味はない', q16_interest: ['ユニフォーム交流'], q22_visit: '日程が合えば', q24_price: '3,000円程度'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.deepStrictEqual(res.row.q16_interest, []);
  assert.strictEqual(res.row.q22_visit, '');
  assert.strictEqual(res.row.q24_price, '');
  assert.strictEqual(res.completionStage, 'gate_not_interested');
});

test('Q4低関心分岐：Q4が低関心の男性がQ18〜Q21・Q20A〜Dの値を注入しても保存されない（Q22以降は保存される）', function () {
  var raw = {
    q1_age: '30〜34歳', q2_gender: '男性', q3_region: '東京都', q4_interest: 'あまり興味はない',
    q15_gate: 'はい',
    q18_combo: 'ぜひ体験したい', q19_range: ['本吊り'], q20a: ['ユニフォーム姿のまま格好よく縛られたい'],
    q21_conditions: ['完全個室'], q22_visit: '日程が合えば', q24_price: '3,000円程度'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.row.q18_combo, '');
  assert.deepStrictEqual(res.row.q19_range, []);
  assert.deepStrictEqual(res.row.q20a, []);
  assert.deepStrictEqual(res.row.q21_conditions, []);
  assert.strictEqual(res.row.q22_visit, '日程が合えば', 'Q22はQ4低関心でも到達する（male_gate_passedのみが条件）');
  assert.strictEqual(res.row.q24_price, '3,000円程度');
  assert.strictEqual(res.completionStage, 'completed_low_interest');
});

test('到達している設問の値はそのまま保存される（正常系の回帰防止）', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: 'とても好き',
    q15_gate: 'はい', q16_interest: ['ユニフォーム交流'], q18_combo: 'ぜひ体験したい',
    q22_visit: '日程が合えば', q24_price: '3,000円程度'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.deepStrictEqual(res.row.q16_interest, ['ユニフォーム交流']);
  assert.strictEqual(res.row.q18_combo, 'ぜひ体験したい');
  assert.strictEqual(res.row.q22_visit, '日程が合えば');
  assert.strictEqual(res.row.q24_price, '3,000円程度');
  assert.strictEqual(res.completionStage, 'completed_full');
});

test('自由記述の「その他」本文は、そのトリガー選択肢が実際に選ばれている場合のみ保存される', function () {
  var raw = { q1_age: '25〜29歳', q2_gender: 'その他', q2_gender_other: 'INJECTED', q3_region: '東京都', q4_interest: '興味がある' };
  var res = norm.buildStorageRow(schema, raw);
  /* q2_gender_otherはq2_genderが「その他」の時だけ許可される。ここではQ2の値自体は
     「その他」なので許可されるべきケース（対照として、トリガー不一致のケースも検証する）。 */
  assert.strictEqual(res.row.q2_gender_other, 'INJECTED');

  var raw2 = { q1_age: '25〜29歳', q2_gender: '男性', q2_gender_other: 'INJECTED', q3_region: '東京都', q4_interest: '興味がある' };
  var res2 = norm.buildStorageRow(schema, raw2);
  assert.strictEqual(res2.row.q2_gender_other, '', 'トリガー（その他）が選ばれていないため保存されない');
});

test('未定義の選択肢値（schemaに存在しない文字列）は単一選択で空文字列に丸められる', function () {
  var raw = { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: 'こんな選択肢はない' };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.row.q4_interest, '');
});

test('複数選択は許可されていない値を除外し、重複も除去する', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール', '野球・ソフトボール', '不正な値']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.deepStrictEqual(res.row.q7_sports, ['野球・ソフトボール']);
});

test('17歳以下はexcluded=trueかつexcluded_reason=undergeとなり、completionStageはunderage_end', function () {
  var raw = { q1_age: '17歳以下' };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.excluded, true);
  assert.strictEqual(res.excludedReason, 'underage');
  assert.strictEqual(res.completionStage, 'underage_end');
});

/* ── フロントで成立しない回答状態の拒否（PR #110レビュー対応その2） ── */

test('トリガー選択肢（Q2「その他」）を選んだのに対応する自由記述が空なら無効になる', function () {
  var raw = { q1_age: '25〜29歳', q2_gender: 'その他', q3_region: '東京都', q4_interest: '興味がある' };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, false);
  assert.ok(res.missingRequired.indexOf('q2_gender_other') !== -1, JSON.stringify(res.missingRequired));
});

test('Q3「海外」を選んだのに国名が空なら無効、「その他」を選んだのに地域名が空なら無効', function () {
  var res1 = norm.buildStorageRow(schema, { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '海外', q4_interest: '興味がある' });
  assert.ok(res1.missingRequired.indexOf('q3_country') !== -1, JSON.stringify(res1.missingRequired));

  var res2 = norm.buildStorageRow(schema, { q1_age: '25〜29歳', q2_gender: '男性', q3_region: 'その他', q4_interest: '興味がある' });
  assert.ok(res2.missingRequired.indexOf('q3_region_other') !== -1, JSON.stringify(res2.missingRequired));
});

test('複数選択で「その他」を選び自由記述も入力していれば有効になる', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q5_enjoy: ['その他'], q5_other: '縄の匂いが好き'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.row.q5_other, '縄の匂いが好き');
  assert.ok(res.missingRequired.indexOf('q5_other') === -1);
});

test('exclusiveOptions（Q5「回答しない」）を通常選択肢と同時送信すると無効になる', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q5_enjoy: ['回答しない', '縄の感触を感じたい']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, false);
  assert.ok(res.invalidCombinations.indexOf('Q5:exclusive_options') !== -1, JSON.stringify(res.invalidCombinations));
});

test('exclusiveOptionsを単独で選んでいれば有効になる', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q5_enjoy: ['回答しない']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.invalidCombinations.indexOf('Q5:exclusive_options'), -1);
});

test('conflictPairs（Q6「縛る・縛られる両方」と「縛られる側」）を同時送信すると無効になる', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q6_role: ['縛る・縛られる両方に興味がある', '縛られる側に興味がある']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, false);
  assert.ok(res.invalidCombinations.indexOf('Q6:conflict_pair') !== -1, JSON.stringify(res.invalidCombinations));
});

test('conflictPairsに該当しない組合せは有効', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q6_role: ['縛られる側に興味がある', '見るだけで楽しみたい']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.invalidCombinations.indexOf('Q6:conflict_pair'), -1);
});

test('q20CrossExclusive: Q20Dの「回答しない」とQ20Aの選択肢を同時送信すると無効になる', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球'], q15_gate: 'はい', q17_experience: ['未経験'], q18_combo: 'ぜひ体験したい',
    q22_visit: '日程が合えば', q24_price: '3,000円程度', q25_intent: '日程が合えば参加したい',
    q20a: ['ユニフォーム姿のまま格好よく縛られたい'], q20d: ['回答しない']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, false);
  assert.ok(res.invalidCombinations.indexOf('Q20:cross_exclusive') !== -1, JSON.stringify(res.invalidCombinations));
});

test('q20CrossExclusive: Q20Dの「回答しない」だけを送り、A〜Cが空なら有効', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球'], q15_gate: 'はい', q17_experience: ['未経験'], q18_combo: 'ぜひ体験したい',
    q22_visit: '日程が合えば', q24_price: '3,000円程度', q25_intent: '日程が合えば参加したい',
    q20d: ['回答しない']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.invalidCombinations.indexOf('Q20:cross_exclusive'), -1, JSON.stringify(res.invalidCombinations));
});

test('rawAnswersがnull/undefinedでも例外を投げず、全フィールドが空で返る', function () {
  assert.doesNotThrow(function () { norm.buildStorageRow(schema, null); });
  var res = norm.buildStorageRow(schema, undefined);
  assert.strictEqual(res.row.q1_age, '');
});

/* ── 匿名直POSTによる必須未回答の蓄積防止（PR #110レビュー対応） ── */

test('到達した必須設問(required:true)が未回答だとvalid=falseになり、missingRequiredにIDが入る', function () {
  var raw = { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, false);
  ['Q7', 'Q8', 'Q9', 'Q11', 'Q15'].forEach(function (id) {
    assert.ok(res.missingRequired.indexOf(id) !== -1, id + ' がmissingRequiredに含まれる: ' + JSON.stringify(res.missingRequired));
  });
});

test('非到達の必須設問はmissingRequiredに含まれない（女性はQ7〜Q26が非到達のため必須違反にならない）', function () {
  var raw = { q1_age: '25〜29歳', q2_gender: '女性', q3_region: '東京都', q4_interest: '興味がある' };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, true);
  assert.deepStrictEqual(res.missingRequired, []);
});

test('Q15「興味はない」の男性はQ16以降が未回答でもvalid=true（Q7〜Q9・Q11・Q15が揃っていれば良い）', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球'], q15_gate: '興味はない'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.valid, true, JSON.stringify(res.missingRequired));
});

test('Q11の候補が2件以上あるのにQ12が未回答だとmissingRequiredにQ12が入る（動的必須条件）', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球', 'サッカー'], q15_gate: '興味はない'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.ok(res.missingRequired.indexOf('Q12') !== -1, JSON.stringify(res.missingRequired));
});

test('Q11の候補が1件のみならQ12は必須にならない（クライアントの自動補完と同じ挙動）', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球'], q15_gate: '興味はない'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.ok(res.missingRequired.indexOf('Q12') === -1, JSON.stringify(res.missingRequired));
});

/* ── Q12/Q13-A/Q13-B: Q11由来の動的許可リストでの検証（PR #110レビュー対応） ── */

test('q11DerivedOptions()はQ11で選んだ値をそのまま返し、「その他」は自由記述込みのラベルへ変換する', function () {
  assert.deepStrictEqual(norm.q11DerivedOptions({ q11_uniform: ['野球', 'サッカー'] }), ['野球', 'サッカー']);
  assert.deepStrictEqual(norm.q11DerivedOptions({ q11_uniform: ['その他'], q11_other: 'カヌー部の服' }), ['その他：カヌー部の服']);
  assert.deepStrictEqual(norm.q11DerivedOptions({ q11_uniform: ['その他'] }), ['その他']);
  assert.deepStrictEqual(norm.q11DerivedOptions({}), []);
});

test('Q12はQ11で実際に選んだ値のみを許可し、それ以外は空文字列に丸められる', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q11_uniform: ['野球', 'サッカー'], q12_favorite: 'ラグビー・アメフト'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.row.q12_favorite, '', 'Q11で選んでいない値は無効化される');
  assert.ok(res.missingRequired.indexOf('Q12') !== -1, '結果として必須未回答扱いになる');
});

test('Q12はQ11の「その他」自由記述込みラベルとの完全一致でのみ許可される', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q11_uniform: ['その他', '野球'], q11_other: 'カヌー部の服', q12_favorite: 'その他：カヌー部の服'
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.strictEqual(res.row.q12_favorite, 'その他：カヌー部の服');
});

test('Q13-A/Q13-BもQ11由来の許可リストでフィルタされる（必須ではないが範囲外の値は除外される）', function () {
  var raw = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q11_uniform: ['野球'], q13a_wear_self: ['野球', 'サッカー'], q13b_wear_others: ['サッカー']
  };
  var res = norm.buildStorageRow(schema, raw);
  assert.deepStrictEqual(res.row.q13a_wear_self, ['野球'], 'Q11で選んでいない「サッカー」は除外される');
  assert.deepStrictEqual(res.row.q13b_wear_others, [], 'Q11で選んでいない値だけの場合は空配列になる');
});
