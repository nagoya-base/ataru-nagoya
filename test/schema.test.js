/*
 * survey-schema.json（正本）自体の構造検証（Issue #106）。
 * 未分類の設問IDが1件でもあれば失敗する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');

var schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'survey-schema.json'), 'utf8'));

var VALID_PUBLICATION_CLASSES = ['base_public', 'gated_public', 'admin_only', 'never_public'];

var EXPECTED_IDS = [
  'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q6-A',
  'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q13-A', 'Q13-B', 'Q14A', 'Q14B',
  'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20A', 'Q20B', 'Q20C', 'Q20D', 'Q21',
  'Q22', 'Q23', 'Q24', 'Q25', 'Q26', 'Q27'
];

var EXPECTED_BASE_PUBLIC = ['Q1', 'Q3', 'Q4'];
var EXPECTED_ADMIN_ONLY = ['Q24', 'Q25', 'Q26'];
var EXPECTED_NEVER_PUBLIC = ['Q2', 'Q27'];
var EXPECTED_GATED_PUBLIC = EXPECTED_IDS.filter(function (id) {
  return EXPECTED_BASE_PUBLIC.indexOf(id) === -1 && EXPECTED_ADMIN_ONLY.indexOf(id) === -1 && EXPECTED_NEVER_PUBLIC.indexOf(id) === -1;
});

function byId(id) {
  return schema.questions.filter(function (q) { return q.id === id; })[0];
}

test('responsesの必須管理列がすべて存在する', function () {
  var names = schema.responsesManagementColumns.map(function (c) { return c.name; });
  ['response_id', 'survey_version', 'saved_at', 'completion_stage', 'excluded', 'excluded_reason'].forEach(function (name) {
    assert.ok(names.indexOf(name) !== -1, 'responsesManagementColumns に ' + name + ' がない');
  });
});

test('leadsの必須列がすべて存在する', function () {
  var names = schema.leadsColumns.map(function (c) { return c.name; });
  ['lead_id', 'response_id', 'received_at', 'x_account', 'email', 'requested_content', 'link_status'].forEach(function (name) {
    assert.ok(names.indexOf(name) !== -1, 'leadsColumns に ' + name + ' がない');
  });
});

test('Q1〜Q27・Q6-A・Q13-A/B・Q14A/B・Q20A〜Dの全IDが存在し、余分・不足がない', function () {
  var actualIds = schema.questions.map(function (q) { return q.id; }).sort();
  var expected = EXPECTED_IDS.slice().sort();
  assert.deepStrictEqual(actualIds, expected);
});

test('全設問に有効なpublicationClassが設定されている（未分類は1件でも失敗）', function () {
  schema.questions.forEach(function (q) {
    assert.ok(q.publicationClass, q.id + ' に publicationClass がない');
    assert.ok(VALID_PUBLICATION_CLASSES.indexOf(q.publicationClass) !== -1, q.id + ' の publicationClass が不正: ' + q.publicationClass);
  });
});

test('Q1 / Q3 / Q4 は base_public', function () {
  EXPECTED_BASE_PUBLIC.forEach(function (id) {
    assert.strictEqual(byId(id).publicationClass, 'base_public', id);
  });
});

test('Q5 / Q6 / Q6-A / Q7〜Q23（Q13-A/B, Q14A/B, Q20A〜D含む）は gated_public', function () {
  EXPECTED_GATED_PUBLIC.forEach(function (id) {
    assert.strictEqual(byId(id).publicationClass, 'gated_public', id);
  });
});

test('Q24〜Q26は admin_only', function () {
  EXPECTED_ADMIN_ONLY.forEach(function (id) {
    assert.strictEqual(byId(id).publicationClass, 'admin_only', id);
  });
});

test('Q2 / Q27 は never_public', function () {
  EXPECTED_NEVER_PUBLIC.forEach(function (id) {
    assert.strictEqual(byId(id).publicationClass, 'never_public', id);
  });
});

test('各設問の「その他」自由記述本文フィールドは常にnever_publicとして扱われる（storage columnを介して検証）', function () {
  var responsesColumns = require('../schema/responses-columns.json').columns;
  schema.questions.forEach(function (q) {
    (q.freeTextFields || []).forEach(function (ft) {
      var col = responsesColumns.filter(function (c) { return c.name === ft.field; })[0];
      assert.ok(col, ft.field + ' の列定義がない');
      assert.strictEqual(col.publicationClass, 'never_public', ft.field + ' はnever_publicであるべき');
    });
  });
});

test('displayCondition / targetCountConditionは常に定義済みのconditions idを参照する', function () {
  schema.questions.forEach(function (q) {
    assert.ok(schema.conditions[q.displayCondition], q.id + '.displayCondition=' + q.displayCondition + ' は未定義');
    assert.ok(schema.conditions[q.targetCountCondition], q.id + '.targetCountCondition=' + q.targetCountCondition + ' は未定義');
  });
});

test('infoBlocksはすべてnever_public', function () {
  schema.infoBlocks.forEach(function (b) {
    assert.strictEqual(b.publicationClass, 'never_public', b.id);
  });
});

test('Q20A〜Dは同じQ20グループ・独立サブグループを持つ', function () {
  ['A', 'B', 'C', 'D'].forEach(function (g) {
    var q = byId('Q20' + g);
    assert.strictEqual(q.group, 'Q20');
    assert.strictEqual(q.q20SubGroup, g);
  });
});

test('Q20Cの注記がQ21との矛盾を除外・補正しない旨を明記している', function () {
  assert.match(schema.storagePolicy.contradictionPolicy, /矛盾/);
});
