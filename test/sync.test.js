/*
 * scripts/sync-survey-schema.js の再生成結果が、コミット済みの生成物と一致することを検証する。
 * これにより「正本→各実装への反映」が自動化されており、手で複製していないことを保証する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.join(__dirname, '..');
var sync = require('../scripts/sync-survey-schema');
var extractGsObject = require('./helpers/extract-gs-object').extractGsObject;

test('sync-survey-schema.js が生成する内容は、コミット済みファイルと一致する', function () {
  var schema = sync.loadSchema();
  var list = sync.targets(schema);
  list.forEach(function (t) {
    assert.ok(fs.existsSync(t.file), path.relative(ROOT, t.file) + ' が存在しない');
    var existing = fs.readFileSync(t.file, 'utf8');
    assert.strictEqual(existing, t.content, path.relative(ROOT, t.file) + ' が survey-schema.json との再生成結果と一致しない（node scripts/sync-survey-schema.js を実行してください）');
  });
});

test('node scripts/sync-survey-schema.js --check は差分なしで正常終了する', function () {
  var result = childProcess.spawnSync(process.execPath, [path.join(ROOT, 'scripts/sync-survey-schema.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
});

test('生成物すべてに AUTO-GENERATED 明記がある', function () {
  var files = [
    path.join(ROOT, 'schema/responses-columns.json'),
    path.join(ROOT, 'schema/leads-columns.json'),
    path.join(ROOT, 'generated/survey-schema.front.js'),
    path.join(ROOT, 'generated/survey-schema.public.gs'),
    path.join(ROOT, 'gas/ataru_survey_admin/SurveySchema.gs')
  ];
  files.forEach(function (f) {
    var content = fs.readFileSync(f, 'utf8');
    assert.match(content, /AUTO-GENERATED/, path.relative(ROOT, f) + ' にAUTO-GENERATED表記がない');
  });
});

test('front / public / admin 生成物のquestion id集合がschemaの分類と一致する', function () {
  var schema = sync.loadSchema();
  var frontDef = require('../generated/survey-schema.front.js');
  var frontIds = frontDef.questions.map(function (q) { return q.id; }).sort();
  var allIds = schema.questions.map(function (q) { return q.id; }).sort();
  assert.deepStrictEqual(frontIds, allIds, 'front定義のquestion id集合が正本と不一致');

  var publicContent = fs.readFileSync(path.join(ROOT, 'generated/survey-schema.public.gs'), 'utf8');
  var publicIds = extractGsObject(publicContent, 'PublicSurveySchema').questions.map(function (q) { return q.id; }).sort();
  var expectedPublicIds = schema.questions.filter(function (q) {
    return q.publicationClass === 'base_public' || q.publicationClass === 'gated_public';
  }).map(function (q) { return q.id; }).sort();
  assert.deepStrictEqual(publicIds, expectedPublicIds, '公開系生成物のquestion id集合が base_public/gated_public と不一致');

  var adminContent = fs.readFileSync(path.join(ROOT, 'gas/ataru_survey_admin/SurveySchema.gs'), 'utf8');
  var adminIds = extractGsObject(adminContent, 'SurveySchema').questions.map(function (q) { return q.id; }).sort();
  assert.deepStrictEqual(adminIds, allIds, '管理GAS生成物のquestion id集合が正本と不一致');
});

test('front / admin 生成物の options / required / branch condition / publicationClass が正本と一致する', function () {
  var schema = sync.loadSchema();
  var frontDef = require('../generated/survey-schema.front.js');
  var byIdFront = {};
  frontDef.questions.forEach(function (q) { byIdFront[q.id] = q; });

  schema.questions.forEach(function (q) {
    var f = byIdFront[q.id];
    assert.deepStrictEqual(f.options, q.options, q.id + '.options');
    assert.strictEqual(f.required, q.required, q.id + '.required');
    assert.strictEqual(f.displayCondition, q.displayCondition, q.id + '.displayCondition');
    assert.strictEqual(f.targetCountCondition, q.targetCountCondition, q.id + '.targetCountCondition');
    assert.strictEqual(f.publicationClass, q.publicationClass, q.id + '.publicationClass');
  });
});

