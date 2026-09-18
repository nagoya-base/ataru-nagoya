/*
 * gas/ataru_survey_public/ の生成済み.gsファイル自体をvmで実行し、
 * 公開集計API・回答保存が実際に呼ぶ関数がReferenceErrorなく動作することを検証する
 * （PR #109で発生した「Node版は通るが生成GASが壊れる」問題の再発防止。Issue #104 追加指示15）。
 * Code.gs自体はSpreadsheetApp等のGAS組み込みサービスに依存するため、ここでは
 * PublicAggregate.gs / PublicSchema.gs / FullSchema.gs / ResponseNormalize.gs という
 * 「Spreadsheetに依存しない集計・検証ロジック」の生成物を直接vm実行して検証する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var DIR = path.join(ROOT, 'gas', 'ataru_survey_public');

function loadPublicGasSandbox() {
  var sandbox = {};
  vm.createContext(sandbox);
  ['PublicAggregate.gs', 'PublicSchema.gs', 'FullSchema.gs', 'ResponseNormalize.gs'].forEach(function (f) {
    var p = path.join(DIR, f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p });
  });
  return sandbox;
}

var SAMPLE_ROWS = [
  { response_id: 'R1', excluded: false, q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある', q15_gate: 'はい', q11_uniform: '野球' },
  { response_id: 'R2', excluded: false, q1_age: '30〜34歳', q2_gender: '女性', q3_region: '関西', q4_interest: '苦手', q15_gate: '', q11_uniform: '' },
  { response_id: 'R3_excluded', excluded: true, q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある', q15_gate: 'はい', q11_uniform: '野球' }
];

test('PublicAggregate.gs はvm実行時にReferenceErrorを起こさず、buildPublicResultが動作する', function () {
  var sandbox = loadPublicGasSandbox();
  assert.strictEqual(typeof sandbox.buildPublicResult, 'function');
  var result;
  assert.doesNotThrow(function () { result = sandbox.buildPublicResult(SAMPLE_ROWS, sandbox.PublicSurveySchema); });
  assert.strictEqual(result.effectiveCount, 2);
  assert.strictEqual(result.gateOpen, false);
  assert.strictEqual('detail' in result, false);
});

test('PublicSchema.gs（PublicSurveySchema）にadmin_only設問・leadsColumnsが一切含まれない', function () {
  var sandbox = loadPublicGasSandbox();
  var ids = sandbox.PublicSurveySchema.questions.map(function (q) { return q.id; });
  ['Q24', 'Q25', 'Q26', 'Q2', 'Q27'].forEach(function (id) { assert.ok(ids.indexOf(id) === -1, id); });
  assert.strictEqual(sandbox.PublicSurveySchema.leadsColumns, undefined);
});

test('FullSchema.gs（FullSurveySchema）はadmin_only設問・leadsColumnsを含む完全な定義を持つ', function () {
  var sandbox = loadPublicGasSandbox();
  var ids = sandbox.FullSurveySchema.questions.map(function (q) { return q.id; });
  assert.ok(ids.indexOf('Q24') !== -1);
  assert.ok(Array.isArray(sandbox.FullSurveySchema.leadsColumns) && sandbox.FullSurveySchema.leadsColumns.length > 0);
});

test('FullSchema.gs（FullSurveySchema）はq20CrossExclusiveを含む（欠落するとQ20の同時選択チェックがGAS実行時に無効化されてしまうため）', function () {
  var sandbox = loadPublicGasSandbox();
  var spec = sandbox.FullSurveySchema.q20CrossExclusive;
  assert.ok(spec, 'FullSurveySchema.q20CrossExclusiveが存在しない');
  assert.deepEqual(spec.memberQuestionIds, ['Q20A', 'Q20B', 'Q20C', 'Q20D']);
  assert.deepEqual(spec.exclusiveValues, ['まだ分からない', '回答しない']);
});

test('ResponseNormalize.gs の buildStorageRow がvm実行時にReferenceErrorを起こさず動作する（FullSurveySchemaを使用）', function () {
  var sandbox = loadPublicGasSandbox();
  assert.strictEqual(typeof sandbox.buildStorageRow, 'function');
  var res;
  assert.doesNotThrow(function () {
    res = sandbox.buildStorageRow(sandbox.FullSurveySchema, {
      q1_age: '25〜29歳', q2_gender: '女性', q3_region: '東京都', q4_interest: '興味がある',
      q7_sports: ['野球・ソフトボール'], q24_price: '3,000円程度'
    });
  });
  /* vmサンドボックス（別realm）で生成された配列のため、realmまで見るdeepStrictEqualではなく
     内容ベースの非strict deepEqualで比較する（test/front-consistency.test.js等と同じ方針）。 */
  assert.deepEqual(res.row.q7_sports, [], '女性はQ7に非到達のためGAS実行時も保存されない');
  assert.strictEqual(res.row.q24_price, '');
  assert.strictEqual(res.completionStage, 'female_other_end');
});

test('101件以上でbuildPublicResultがdetailを返し、admin_onlyキーを含まない（vm実行）', function () {
  var sandbox = loadPublicGasSandbox();
  var rows = [];
  for (var i = 0; i < 150; i++) {
    rows.push({ excluded: false, q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある', q15_gate: 'はい', q11_uniform: '野球' });
  }
  var result = sandbox.buildPublicResult(rows, sandbox.PublicSurveySchema);
  assert.strictEqual(result.gateOpen, true);
  var json = JSON.stringify(result);
  ['Q24', 'Q25', 'Q26'].forEach(function (id) { assert.strictEqual(json.indexOf(id), -1, id); });
});
