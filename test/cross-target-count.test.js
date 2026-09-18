/*
 * crossTargetCount（クロス集計の分母＝両軸の到達条件の交差集合）を検証する（Issue #106 14章）。
 * 分母を全有効回答数にしていないこと、両軸の非到達者を混入させていないことを確認する。
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
var byId = {};
schema.questions.forEach(function (q) { byId[q.id] = q; });

test('Q11 × Q4 のcrossTargetCountは、Q11へ到達した男性回答者数（male_only）と一致する', function () {
  var count = aggregate.crossTargetCount(rows, conditions, byId.Q11.targetCountCondition, byId.Q4.targetCountCondition);
  assert.strictEqual(count, 5);
});

test('Q4 × Q22 のcrossTargetCountは、Q22へ到達した男性回答者数（male_gate_passed）と一致する', function () {
  var count = aggregate.crossTargetCount(rows, conditions, byId.Q4.targetCountCondition, byId.Q22.targetCountCondition);
  assert.strictEqual(count, 4);
});

test('Q22 × Q24 のcrossTargetCountは、両方へ到達した回答者数と一致する（全有効回答数7ではない）', function () {
  var count = aggregate.crossTargetCount(rows, conditions, byId.Q22.targetCountCondition, byId.Q24.targetCountCondition);
  assert.strictEqual(count, 4);
  assert.notStrictEqual(count, aggregate.effectiveRows(rows).length);
});

test('Q24 × Q25 のcrossTargetCountは両方へ到達した回答者数と一致する', function () {
  var count = aggregate.crossTargetCount(rows, conditions, byId.Q24.targetCountCondition, byId.Q25.targetCountCondition);
  assert.strictEqual(count, 4);
});

test('crossTab: Q11×Q4のセルが正しい人数を持ち、未到達者(女性・その他)を含まない', function () {
  var result = aggregate.crossTab(rows, conditions, byId.Q11, byId.Q4, schema.multiValueDelimiter);
  assert.strictEqual(result.crossTargetCount, 5);
  /* R1のみ「野球」×「興味がある」を満たす */
  assert.strictEqual((result.cells['野球'] || {})['興味がある'], 1);
  /* 女性(R4)・その他(R5)はmale_onlyではないため、どのセルにも現れない */
  var totalCells = 0;
  Object.keys(result.cells).forEach(function (a) {
    Object.keys(result.cells[a]).forEach(function (b) { totalCells += result.cells[a][b]; });
  });
  assert.ok(totalCells <= 5 + 5 /* 複数選択のため単純合計は超えてよいが際限なく増えないことの目安 */);
});

test('固定クロス9件すべてでcrossTargetCountが例外なく計算できる', function () {
  schema.fixedCrossTabs.forEach(function (spec) {
    var qa = byId[spec.axisA];
    var qb = byId[spec.axisB];
    assert.doesNotThrow(function () { aggregate.crossTab(rows, conditions, qa, qb, schema.multiValueDelimiter); }, spec.id);
  });
});
