/*
 * 複数選択設問で、同一回答者・同一選択肢を二重カウントしないことを検証する。
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

test('valuesOf は同一回答内の重複選択肢を除去する', function () {
  var values = aggregate.valuesOf({ q11_uniform: '野球|野球|ラグビー・アメフト' }, 'q11_uniform', '|');
  assert.deepStrictEqual(values, ['野球', 'ラグビー・アメフト']);
});

test('Q11の単純集計で、保存値が重複していても回答者1人につき1カウントしかされない', function () {
  var result = aggregate.tallySingleQuestion(rows, conditions, q11, schema.multiValueDelimiter);
  /* R7の保存値は「野球|野球|ラグビー・アメフト」だが、野球は1件としてしかカウントされない。
     野球を選んだのは R1, R2, R7 の3人 → 3（4ではない）。 */
  assert.strictEqual(result.counts['野球'], 3);
  assert.strictEqual(result.targetCount, 5);
});

test('配列で保存された場合でも重複が除去される（将来ストレージ実装の互換性）', function () {
  var values = aggregate.valuesOf({ f: ['野球', '野球', 'サッカー'] }, 'f', '|');
  assert.deepStrictEqual(values, ['野球', 'サッカー']);
});
