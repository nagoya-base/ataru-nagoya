/*
 * gas/ataru_survey_admin/SurveySchema.gs（生成物）自体をvmで実行し、
 * GAS実行時に実際に呼ばれる集計関数がReferenceErrorなく動作することを検証する。
 *
 * scripts/lib/aggregate.js はNode側で `require('./condition-eval')` を使い
 * `conditionEval.evaluateCondition(...)` という参照方式のまま書かれているため、
 * これをそのままNodeで require() して呼び出すテスト（target-count.test.js等）は
 * Node側のrequire()が生きているぶん、GAS埋め込み後に conditionEval が
 * 未定義になる不具合を検出できない。このテストは生成済みの.gsファイルを
 * 実際にロード・実行することで、その埋め込み変換の正しさを直接検証する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var GS_PATH = path.join(ROOT, 'gas/ataru_survey_admin/SurveySchema.gs');

function loadGeneratedAdminSchema() {
  var source = fs.readFileSync(GS_PATH, 'utf8');
  var sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: GS_PATH });
  return sandbox;
}

var SAMPLE_ROWS = [
  { response_id: 'R1', excluded: false, q2_gender: '男性', q4_interest: '興味がある', q15_gate: 'はい', q11_uniform: '野球|野球|サッカー' },
  { response_id: 'R2', excluded: false, q2_gender: '女性', q4_interest: '興味がある', q15_gate: '', q11_uniform: '' },
  { response_id: 'R3_excluded', excluded: true, q2_gender: '男性', q4_interest: '興味がある', q15_gate: 'はい', q11_uniform: '野球' }
];

test('SurveySchema.gs はvm実行時にconditionEval参照でReferenceErrorを起こさない', function () {
  var sandbox = loadGeneratedAdminSchema();
  var q11 = sandbox.SurveySchema.questionsById.Q11;
  assert.doesNotThrow(function () {
    sandbox.tallySingleQuestion(SAMPLE_ROWS, sandbox.SurveySchema.conditions, q11, sandbox.SurveySchema.multiValueDelimiter);
  });
});

test('SurveySchema.gs内のcountTarget/crossTab/tallySingleQuestionが実際に正しい値を返す', function () {
  var sandbox = loadGeneratedAdminSchema();
  var q11 = sandbox.SurveySchema.questionsById.Q11;
  var q4 = sandbox.SurveySchema.questionsById.Q4;

  assert.strictEqual(sandbox.countTarget(SAMPLE_ROWS, sandbox.SurveySchema.conditions, 'male_only'), 1);

  var tally = sandbox.tallySingleQuestion(SAMPLE_ROWS, sandbox.SurveySchema.conditions, q11, sandbox.SurveySchema.multiValueDelimiter);
  assert.strictEqual(tally.targetCount, 1);
  assert.strictEqual(tally.counts['野球'], 1, '重複保存値「野球|野球|サッカー」でも1カウント');

  var cross = sandbox.crossTab(SAMPLE_ROWS, sandbox.SurveySchema.conditions, q11, q4, sandbox.SurveySchema.multiValueDelimiter);
  assert.strictEqual(cross.crossTargetCount, 1);
  assert.strictEqual(cross.cells['野球']['興味がある'], 1);
});

test('SurveySchema.gs は getDashboardData() が呼ぶ想定の全関数（evaluateCondition/evaluateIntersection含む）を素通しで参照できる', function () {
  var sandbox = loadGeneratedAdminSchema();
  ['evaluateCondition', 'evaluateIntersection', 'isExcluded', 'effectiveRows', 'valuesOf', 'countTarget', 'crossTargetCount', 'tallySingleQuestion', 'crossTab'].forEach(function (fnName) {
    assert.strictEqual(typeof sandbox[fnName], 'function', fnName + ' が関数として存在しない');
  });
  assert.strictEqual(typeof sandbox.conditionEval, 'object', 'conditionEval シムオブジェクトが存在しない');
  assert.strictEqual(sandbox.conditionEval.evaluateCondition, sandbox.evaluateCondition);
  assert.strictEqual(sandbox.conditionEval.evaluateIntersection, sandbox.evaluateIntersection);
});

var CODE_GS_PATH = path.join(ROOT, 'gas/ataru_survey_admin/Code.gs');

/* Code.gsとSurveySchema.gs(生成物)を同一サンドボックスへロードし、GASのSpreadsheetApp等に
   依存しない集計関数（computeSummary_/computeSimpleAggregates_/computeCrossTabs_/
   computeFreeText_/computeLeadsSummary_）を直接呼び出す。これはgetDashboardData()が
   実行時に呼ぶのと同じ関数群であり、SurveySchema.gs単体のテストだけでは検出できない
   Code.gs側の参照ミスも合わせて検証する。 */
function loadDashboardSandbox() {
  var sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(GS_PATH, 'utf8'), sandbox, { filename: GS_PATH });
  vm.runInContext(fs.readFileSync(CODE_GS_PATH, 'utf8'), sandbox, { filename: CODE_GS_PATH });
  return sandbox;
}

test('Code.gsの集計関数群がSurveySchema.gsと組み合わせてReferenceErrorなく動作する', function () {
  var sandbox = loadDashboardSandbox();
  var leadRows = [{ lead_id: 'L1', link_status: 'linked', requested_content: '開催案内' }];

  var summary = sandbox.computeSummary_(SAMPLE_ROWS);
  assert.strictEqual(summary.totalSaved, 3);
  assert.strictEqual(summary.excludedCount, 1);
  assert.strictEqual(summary.effectiveCount, 2);

  var simple = sandbox.computeSimpleAggregates_(SAMPLE_ROWS, sandbox.SurveySchema);
  assert.ok(simple.Q11, 'Q11の単純集計結果がない');
  assert.strictEqual(simple.Q11.targetCount, 1);
  assert.strictEqual(simple.Q2, undefined, 'Q2はnever_publicのためカード化されない');

  var crossTabs = sandbox.computeCrossTabs_(SAMPLE_ROWS, sandbox.SurveySchema);
  assert.ok(Array.isArray(crossTabs.fixed) && crossTabs.fixed.length > 0);
  assert.ok(Array.isArray(crossTabs.byAxis) && crossTabs.byAxis.length > 0);

  assert.doesNotThrow(function () { sandbox.computeFreeText_(SAMPLE_ROWS, sandbox.SurveySchema); });
  var leadsSummary = sandbox.computeLeadsSummary_(leadRows);
  assert.strictEqual(leadsSummary.linked, 1);
});

module.exports = { loadGeneratedAdminSchema: loadGeneratedAdminSchema };
