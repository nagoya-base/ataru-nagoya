/*
 * 公開系生成物（generated/survey-schema.public.gs）に、admin_only設問・leads・
 * 自由記述本文フィールドが混入していないことを検証する（Issue #106 15章）。
 * また、公開系生成物にendpoint/doGet/doPostを実装していないことも確認する
 * （Issue #106はendpointを作らず、生成済みschema定義だけを用意する）。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var extractGsObject = require('./helpers/extract-gs-object').extractGsObject;

var ROOT = path.join(__dirname, '..');
var publicContent = fs.readFileSync(path.join(ROOT, 'generated/survey-schema.public.gs'), 'utf8');
var publicDef = extractGsObject(publicContent, 'PublicSurveySchema');

test('公開系生成物にQ24〜Q26（admin_only）が含まれない', function () {
  var ids = publicDef.questions.map(function (q) { return q.id; });
  ['Q24', 'Q25', 'Q26'].forEach(function (id) {
    assert.ok(ids.indexOf(id) === -1, id + ' が公開系生成物に混入している');
  });
});

test('公開系生成物にQ2/Q27（never_public）が含まれない', function () {
  var ids = publicDef.questions.map(function (q) { return q.id; });
  ['Q2', 'Q27'].forEach(function (id) {
    assert.ok(ids.indexOf(id) === -1, id + ' が公開系生成物に混入している');
  });
});

test('公開系生成物のどの設問にもfreeTextFields（自由記述本文フィールド）が含まれない', function () {
  publicDef.questions.forEach(function (q) {
    assert.strictEqual(q.freeTextFields, undefined, q.id + ' にfreeTextFieldsが残っている');
  });
});

test('公開系生成物のデータ定義にleadsColumns等のleads関連キーが一切含まれない', function () {
  assert.strictEqual(publicDef.leadsColumns, undefined);
  assert.strictEqual(Object.keys(publicDef).indexOf('leadsColumns'), -1);
  Object.keys(publicDef).forEach(function (k) { assert.ok(!/lead/i.test(k), k); });
});

test('公開系生成物にdoGet/doPost/endpointの実装がない（Issue #106の範囲外）', function () {
  assert.ok(!/function\s+doGet\s*\(/.test(publicContent));
  assert.ok(!/function\s+doPost\s*\(/.test(publicContent));
  assert.ok(!/UrlFetchApp/.test(publicContent));
});

test('公開系生成物のfixedCrossTabsに、admin_onlyを軸に持つクロス(Q22×Q24, Q24×Q25)が含まれない', function () {
  var crossIds = publicDef.fixedCrossTabs.map(function (t) { return t.id; });
  ['q22_x_q24', 'q24_x_q25'].forEach(function (id) {
    assert.ok(crossIds.indexOf(id) === -1, id + ' が公開系fixedCrossTabsに混入している');
  });
});

test('公開系生成物のどこにもadmin_only設問ID（Q24/Q25/Q26）が文字列として一切出現しない（questions/fixedCrossTabs/crossAxes等を再帰走査）', function () {
  var ADMIN_ONLY_IDS = ['Q24', 'Q25', 'Q26'];
  var found = [];

  function walk(value, pathLabel) {
    if (typeof value === 'string') {
      if (ADMIN_ONLY_IDS.indexOf(value) !== -1) found.push(pathLabel + ' = ' + value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(function (v, i) { walk(v, pathLabel + '[' + i + ']'); });
      return;
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) { walk(value[k], pathLabel + '.' + k); });
    }
  }

  walk(publicDef, 'PublicSurveySchema');
  assert.deepStrictEqual(found, [], 'admin_only設問IDが公開系生成物に残存: ' + found.join(', '));
});

test('公開系生成物のfixedCrossTabsのaxisA/axisBは、すべてpublicDef.questionsに実在するIDのみを参照する（#104側でのundefined参照防止）', function () {
  var publicIds = publicDef.questions.map(function (q) { return q.id; });
  publicDef.fixedCrossTabs.forEach(function (t) {
    assert.ok(publicIds.indexOf(t.axisA) !== -1, t.id + '.axisA=' + t.axisA + ' が公開questionsに存在しない');
    assert.ok(publicIds.indexOf(t.axisB) !== -1, t.id + '.axisB=' + t.axisB + ' が公開questionsに存在しない');
  });
});

test('管理GAS生成物（SurveySchema.gs）にはadmin_only設問とleadsColumnsが含まれる（対比確認）', function () {
  var adminContent = fs.readFileSync(path.join(ROOT, 'gas/ataru_survey_admin/SurveySchema.gs'), 'utf8');
  var adminDef = extractGsObject(adminContent, 'SurveySchema');
  var ids = adminDef.questions.map(function (q) { return q.id; });
  assert.ok(ids.indexOf('Q24') !== -1);
  assert.ok(adminContent.indexOf('leadsColumns') !== -1);
});
