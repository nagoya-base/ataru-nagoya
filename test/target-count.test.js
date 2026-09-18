/*
 * targetCount（各設問へ到達し得た有効回答者数）が、survey-schema.jsonの条件定義から
 * 正しく計算されることを検証する（Issue #106 12章）。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var aggregate = require('../scripts/lib/aggregate');
var rows = require('./fixtures/sample-responses');

var schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'survey-schema.json'), 'utf8'));
var conditions = schema.conditions;

/* fixtureでの手計算（有効回答=excluded以外の7件: R1,R2,R3,R4,R5,R7,R8）:
   male_only（R1,R2,R3,R7,R8）= 5
   male_gate_passed（R1,R2,R7,R8。R3は「興味はない」なので対象外）= 4
   male_gate_passed_and_not_low_interest（R1,R8。R2,R7はQ4が低関心）= 2 */

test('Q15のtargetCountはmale_only（男性としてQ15へ到達した人数）と一致する', function () {
  assert.strictEqual(aggregate.countTarget(rows, conditions, 'male_only'), 5);
});

test('Q16/Q17のtargetCountはmale_gate_passed（Q15=はい/内容による）と一致する', function () {
  assert.strictEqual(aggregate.countTarget(rows, conditions, 'male_gate_passed'), 4);
});

test('Q18〜Q21のtargetCountはQ4低関心分岐を除外したmale_gate_passed_and_not_low_interestと一致する', function () {
  assert.strictEqual(aggregate.countTarget(rows, conditions, 'male_gate_passed_and_not_low_interest'), 2);
});

test('Q22〜Q26のtargetCountはmale_gate_passedと一致する', function () {
  assert.strictEqual(aggregate.countTarget(rows, conditions, 'male_gate_passed'), 4);
});

test('全設問のtargetCountConditionは実データに対して例外なく評価できる', function () {
  schema.questions.forEach(function (q) {
    assert.doesNotThrow(function () { aggregate.countTarget(rows, conditions, q.targetCountCondition); }, q.id);
  });
});
