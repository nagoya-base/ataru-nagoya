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

test('rawAnswersがnull/undefinedでも例外を投げず、全フィールドが空で返る', function () {
  assert.doesNotThrow(function () { norm.buildStorageRow(schema, null); });
  var res = norm.buildStorageRow(schema, undefined);
  assert.strictEqual(res.row.q1_age, '');
});
