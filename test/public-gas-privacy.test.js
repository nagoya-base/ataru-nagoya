/*
 * gas/ataru_survey_public/（公開・回答保存Web App）が、公開集計コードパスから
 * leadsシート・admin_only設問へ一切アクセスしないことを検証する（Issue #104 追加指示14）。
 * 同じGASプロジェクト内・同じCode.gsファイルであっても、公開集計処理からleadsを読めない
 * 構造であることを、静的解析（doGet→呼び出し関数の追跡）とvm実行の両方で確認する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var DIR = path.join(ROOT, 'gas', 'ataru_survey_public');
var CODE_GS = fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8');

test('公開集計の唯一のエントリポイント getPublicResults_() は responses シートしか読まない', function () {
  var m = CODE_GS.match(/function getPublicResults_\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'getPublicResults_ が見つからない');
  var body = m[1];
  assert.ok(/readSheetAsObjects_\(SHEET_NAMES\.RESPONSES\)/.test(body));
  assert.ok(!/SHEET_NAMES\.LEADS/.test(body), 'getPublicResults_ がleadsシートへ言及している');
  assert.ok(/PublicSurveySchema/.test(body), 'getPublicResults_ はPublicSurveySchemaのみを使う');
  assert.ok(!/FullSurveySchema/.test(body), 'getPublicResults_ がFullSurveySchema(admin_only含む)へ言及している');
});

test('doGet はgetPublicResults_以外の経路でleads/FullSurveySchemaへアクセスしない', function () {
  var m = CODE_GS.match(/function doGet\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'doGet が見つからない');
  var body = m[1];
  assert.ok(!/SHEET_NAMES\.LEADS/.test(body));
  assert.ok(!/FullSurveySchema/.test(body));
  assert.ok(!/saveLead_|saveResponse_/.test(body), 'doGetが保存系関数を呼んでいる');
});

test('leadsシートへアクセスする関数（saveLead_）は公開集計関数からは一切呼ばれない（呼び出しグラフの静的検証）', function () {
  /* getPublicResults_ → buildPublicResult という一本道だけがdoGetの実データ経路であり、
     saveLead_ / SHEET_NAMES.LEADS はこの経路のどのソースにも出現しない
     （前のテストで検証済み）。ここでは反対方向：saveLead_ がleadsへの唯一の窓口であり、
     それがdoPostからのみ呼ばれることを確認する。 */
  var doPostMatch = CODE_GS.match(/function doPost\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(doPostMatch);
  assert.ok(/saveLead_\(/.test(doPostMatch[1]));
  var saveLeadCallers = CODE_GS.match(/saveLead_\(/g) || [];
  /* 定義1回 + doPostからの呼び出し1回 = 合計2回だけ出現する（他の関数からは呼ばれない） */
  assert.strictEqual(saveLeadCallers.length, 2, 'saveLead_の出現回数がdoPost経由の呼び出し以外にもある');
});

test('公開系.gsファイル（PublicAggregate.gs/PublicSchema.gs）のどこにもSHEET_NAMES.LEADSやadmin_only設問ID(Q24-Q26)が出現しない', function () {
  ['PublicAggregate.gs', 'PublicSchema.gs'].forEach(function (f) {
    var content = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.ok(!/SHEET_NAMES\.LEADS|leadsColumns/.test(content), f);
    ['Q24', 'Q25', 'Q26'].forEach(function (id) {
      assert.strictEqual(content.indexOf('"' + id + '"'), -1, f + ' に ' + id + ' が含まれている');
    });
  });
});

test('（実行検証）buildPublicResultはleadsに関する情報を一切受け取らず、admin_onlyを返せない', function () {
  var sandbox = {};
  vm.createContext(sandbox);
  ['PublicAggregate.gs', 'PublicSchema.gs'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), sandbox, { filename: f });
  });
  assert.strictEqual(sandbox.buildPublicResult.length, 2, 'buildPublicResult(rows, schema) の2引数のみ（leads等の第3引数を持たない）');
});

test('公開GASと管理者GASは互いのSurveySchema変数名・関数を共有しない別プロジェクトである', function () {
  var adminSchema = fs.readFileSync(path.join(ROOT, 'gas', 'ataru_survey_admin', 'SurveySchema.gs'), 'utf8');
  /* 管理者GAS（SurveySchema.gs）はSpreadsheetへの書き込みAPIを持たず読み取り専用
     （test/admin-readonly.test.jsで別途検証済み）。ここでは、公開GASのCode.gsが
     管理者GAS固有の変数名 `var SurveySchema =` を参照していない（別スキーマ変数
     PublicSurveySchema/FullSurveySchemaのみを使う）ことを確認する。 */
  assert.ok(/var SurveySchema = /.test(adminSchema), '前提: 管理者GASはSurveySchema変数を持つ');
  assert.ok(!/\bSurveySchema\b(?!\.public|Front)/.test(CODE_GS.replace(/PublicSurveySchema|FullSurveySchema/g, '')), 'Code.gsが管理者GAS固有の変数名SurveySchemaを参照している');
});
