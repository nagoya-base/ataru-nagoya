/*
 * excluded=true の回答が有効集計（targetCount / 単純集計 / crossTargetCount）から
 * 除外されること、かつ行自体は削除されず総保存回答数・除外回答数として把握可能なことを検証する。
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
var q11 = schema.questions.filter(function (q) { return q.id === 'Q11'; })[0];
var q4 = schema.questions.filter(function (q) { return q.id === 'Q4'; })[0];

test('excludedRowsは行として存在し続けるが、effectiveRowsからは除外される', function () {
  assert.strictEqual(rows.length, 8, '総保存回答数（テストデータ）');
  var effective = aggregate.effectiveRows(rows);
  assert.strictEqual(effective.length, 7);
  assert.ok(effective.every(function (r) { return r.response_id !== 'R6_excluded'; }));
});

test('excluded行はtargetCount（male_only）に含まれない', function () {
  var withExcluded = rows.filter(function (r) { return r.response_id === 'R6_excluded' || !r.excluded; });
  assert.strictEqual(aggregate.countTarget(withExcluded, conditions, 'male_only'), 5);
});

test('excluded行は単純集計の選択肢カウントにも含まれない', function () {
  var result = aggregate.tallySingleQuestion(rows, conditions, q11, schema.multiValueDelimiter);
  /* R6_excludedも「野球」を選んでいるが、除外されているためカウントに影響しない（3のまま）。 */
  assert.strictEqual(result.counts['野球'], 3);
});

test('excluded行はcrossTargetCountにも含まれない', function () {
  var count = aggregate.crossTargetCount(rows, conditions, q11.targetCountCondition, q4.targetCountCondition);
  assert.strictEqual(count, 5);
});
