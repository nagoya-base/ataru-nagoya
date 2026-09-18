/*
 * survey.js（PR #108で確定した実装）と survey-schema.json（正本）の整合性検証（Issue #106 6章）。
 * survey.js自体は改修しないため、STEPS定義から実際のoptions/required/表示条件を取り出し、
 * 生成済みのgenerated/survey-schema.front.jsおよびconditions評価結果と比較する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var dom = require('./dom-stub');
var conditionEval = require('../scripts/lib/condition-eval');
var frontDef = require('../generated/survey-schema.front.js');

/* Q12/Q13-A/Q13-Bは選択肢がQ11回答から動的生成されるため、options比較の対象外とする。 */
var DYNAMIC_OPTIONS_IDS = ['Q12', 'Q13-A', 'Q13-B'];

function stepById(steps, frontStepId) {
  return steps.filter(function (s) { return s.id === frontStepId; })[0];
}

/* stepの「その他」自由記述フィールドを、survey.js内部表現(subTexts / otherField)から正規化する。 */
function normalizeFreeTextFields(step) {
  if (step.subTexts) {
    return step.subTexts.map(function (st) { return { trigger: st.trigger, field: st.field }; }).sort(function (a, b) { return a.trigger < b.trigger ? -1 : 1; });
  }
  if (step.otherField) {
    return [{ trigger: 'その他', field: step.otherField }];
  }
  return [];
}

test('survey.jsの全STEPS(質問)がsurvey-schema.jsonのquestionsに1対1で対応する', function () {
  var ctx = dom.loadSurvey();
  var answerableSteps = ctx.S.STEPS.filter(function (s) { return s.type !== 'info'; });
  var schemaFrontStepIds = frontDef.questions.map(function (q) { return q.frontStepId; });
  var stepIds = answerableSteps.map(function (s) { return s.id; });
  /* stepIds はvmサンドボックス(survey.js)側のArrayなので、realmが異なりdeepStrictEqualは
     常に失敗する。内容比較には非strictのdeepEqualを使う（test/survey.test.js の既存方針と同じ）。 */
  assert.deepEqual(stepIds.slice().sort(), schemaFrontStepIds.slice().sort());
});

test('storageField / required / options がsurvey.jsとschemaで一致する', function () {
  var ctx = dom.loadSurvey();
  frontDef.questions.forEach(function (q) {
    var step = stepById(ctx.S.STEPS, q.frontStepId);
    assert.ok(step, q.id + ' に対応するSTEPSが見つからない');
    assert.strictEqual(step.field, q.storageField, q.id + '.storageField');
    assert.strictEqual(!!step.required, q.required, q.id + '.required');
    if (DYNAMIC_OPTIONS_IDS.indexOf(q.id) === -1) {
      assert.deepEqual(step.options || [], q.options, q.id + '.options');
    }
  });
});

test('「その他」自由記述フィールドがsurvey.jsとschemaで一致する', function () {
  var ctx = dom.loadSurvey();
  frontDef.questions.forEach(function (q) {
    var step = stepById(ctx.S.STEPS, q.frontStepId);
    var actual = normalizeFreeTextFields(step);
    var expected = (q.freeTextFields || []).slice().sort(function (a, b) { return a.trigger < b.trigger ? -1 : 1; });
    assert.deepEqual(actual, expected, q.id + '.freeTextFields');
  });
});

/* 代表的な回答パターンごとに、survey.jsのvisible()関数とschemaのdisplayCondition評価が
   一致することを検証する。Q1（年齢自体が前提のため常にtrue）とQ12/Q13-A/Q13-B（Q11の
   選択状況にも依存する動的可視性を持つ）は対象外とする。 */
var SCENARIOS = {
  male_full: { q2_gender: '男性', q4_interest: '興味がある', q15_gate: 'はい' },
  male_low_interest: { q2_gender: '男性', q4_interest: '苦手', q15_gate: 'はい' },
  male_gate_no: { q2_gender: '男性', q4_interest: '興味がある', q15_gate: '興味はない' },
  female: { q2_gender: '女性', q4_interest: '興味がある', q15_gate: '' },
  other: { q2_gender: 'その他', q4_interest: '興味がある', q15_gate: '' }
};
var SKIP_BEHAVIOR_IDS = ['Q1', 'Q12', 'Q13-A', 'Q13-B'];

test('displayConditionの評価結果が、survey.jsのvisible()と全シナリオで一致する', function () {
  var ctx = dom.loadSurvey();
  frontDef.questions.forEach(function (q) {
    if (SKIP_BEHAVIOR_IDS.indexOf(q.id) !== -1) return;
    var step = stepById(ctx.S.STEPS, q.frontStepId);
    Object.keys(SCENARIOS).forEach(function (name) {
      var answers = SCENARIOS[name];
      var expected = !!step.visible(answers);
      var actual = conditionEval.evaluateCondition(frontDef.conditions, q.displayCondition, answers);
      assert.strictEqual(actual, expected, q.id + ' (' + name + ') displayCondition=' + q.displayCondition);
    });
  });
});

test('Q20クロス排他（D「まだ分からない」「回答しない」がA〜Cと同時選択不可）がsurvey.jsに実装されている', function () {
  var ctx = dom.loadSurvey();
  var q20d = stepById(ctx.S.STEPS, 'q20d');
  assert.strictEqual(q20d.crossExclusive, 'q20');
});
