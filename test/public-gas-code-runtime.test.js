/*
 * gas/ataru_survey_public/Code.gs 自体を、最小限のGASサービススタブ（SpreadsheetApp /
 * PropertiesService / Utilities / ContentService）付きでvm実行し、doGet/doPostが
 * 実際にend-to-endで動作することを検証する（Issue #104 追加指示15・16）。
 * PR #109で発生した「Node版ロジックは通るが生成GASが壊れる」問題を、Code.gs自体の
 * 実行という最も生成物に近いレイヤーで再発防止する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var DIR = path.join(ROOT, 'gas', 'ataru_survey_public');

/* ── 最小限のin-memory GASサービススタブ ── */
function createFakeSheet(name) {
  var rows = []; // rows[0] = header
  return {
    name: name,
    _rows: rows,
    getDataRange: function () {
      var self = this;
      return { getValues: function () { return self._rows.map(function (r) { return r.slice(); }); } };
    },
    getLastColumn: function () { return rows.length ? rows[0].length : 0; },
    getRange: function (r1, c1, numRows, numCols) {
      return {
        getValues: function () {
          var out = [];
          for (var i = 0; i < numRows; i++) {
            var srcRow = rows[r1 - 1 + i] || [];
            var row = [];
            for (var j = 0; j < numCols; j++) row.push(srcRow[c1 - 1 + j] !== undefined ? srcRow[c1 - 1 + j] : '');
            out.push(row);
          }
          return out;
        },
        setValues: function (values) {
          values.forEach(function (row, i) { rows[r1 - 1 + i] = row.slice(); });
        }
      };
    },
    appendRow: function (arr) { rows.push(arr.slice()); }
  };
}

function createFakeSpreadsheet() {
  var sheets = {};
  return {
    getSheetByName: function (name) { return sheets[name] || null; },
    insertSheet: function (name) {
      var s = createFakeSheet(name);
      sheets[name] = s;
      return s;
    },
    _sheets: sheets
  };
}

function loadCodeGsSandbox() {
  var ss = createFakeSpreadsheet();
  var uuidSeq = 0;

  var sandbox = {
    console: console,
    PropertiesService: {
      getScriptProperties: function () {
        return { getProperty: function (key) { return key === 'SPREADSHEET_ID' ? 'FAKE_SPREADSHEET_ID' : null; } };
      }
    },
    SpreadsheetApp: { openById: function () { return ss; } },
    Utilities: { getUuid: function () { uuidSeq += 1; return 'fake-uuid-' + uuidSeq; } },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: function (text) {
        var mime = null;
        return {
          setMimeType: function (m) { mime = m; return this; },
          getContent: function () { return text; },
          _mimeType: function () { return mime; }
        };
      }
    }
  };
  vm.createContext(sandbox);

  ['PublicAggregate.gs', 'PublicSchema.gs', 'FullSchema.gs', 'ResponseNormalize.gs', 'Code.gs'].forEach(function (f) {
    var p = path.join(DIR, f);
    vm.runInContext(fs.readFileSync(p, 'utf8'), sandbox, { filename: p });
  });

  return { sandbox: sandbox, spreadsheet: ss };
}

function makePostEvent(payload) {
  return { postData: { contents: JSON.stringify(payload) } };
}

test('doPost(action=save_response) は responses シートへ1行保存し、response_idをサーバー側で発行する', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある', q15_gate: 'はい', q24_price: '3,000円程度' },
    clientResponseId: 'client-side-fake-id-should-not-be-used'
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.response_id, 'fake-uuid-1', 'response_idはUtilities.getUuid()で新規発行される');
  assert.notStrictEqual(json.response_id, 'client-side-fake-id-should-not-be-used', 'クライアント申告のIDは採用しない');

  var sheet = ctx.spreadsheet.getSheetByName('responses');
  assert.ok(sheet, 'responsesシートが自動作成される');
  assert.strictEqual(sheet._rows.length, 2, 'ヘッダ+1件');
  var header = sheet._rows[0];
  var dataRow = sheet._rows[1];
  var idIdx = header.indexOf('response_id');
  var priceIdx = header.indexOf('q24_price');
  assert.strictEqual(dataRow[idIdx], 'fake-uuid-1');
  assert.strictEqual(dataRow[priceIdx], '3,000円程度', 'admin_only(Q24)も保存はされる（公開されないだけ）');
});

test('doPost(action=save_response) は非到達設問の注入値を保存しない（サーバー側再検証）', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: { q1_age: '25〜29歳', q2_gender: '女性', q3_region: '東京都', q4_interest: '興味がある', q7_sports: ['野球・ソフトボール'], q24_price: '3,000円程度' }
  }));
  var sheet = ctx.spreadsheet.getSheetByName('responses');
  var header = sheet._rows[0];
  var dataRow = sheet._rows[1];
  assert.strictEqual(dataRow[header.indexOf('q7_sports')], '', '女性はQ7非到達のため空で保存される');
  assert.strictEqual(dataRow[header.indexOf('q24_price')], '');
});

test('doGet(action=results) は保存直後（1件）では詳細を含まない公開集計を返す', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' } }));
  var out = ctx.sandbox.doGet({ parameter: { action: 'results' } });
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.effectiveCount, 1);
  assert.strictEqual(json.gateOpen, false);
  assert.strictEqual('detail' in json, false);
});

test('doGet(action=results) は101件保存後、詳細結果を含む（admin_only・leadsは含まない）', function () {
  var ctx = loadCodeGsSandbox();
  for (var i = 0; i < 101; i++) {
    ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある', q15_gate: 'はい', q24_price: '3,000円程度' } }));
  }
  var out = ctx.sandbox.doGet({ parameter: { action: 'results' } });
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.effectiveCount, 101);
  assert.strictEqual(json.gateOpen, true);
  assert.ok(json.detail);
  var rawText = out.getContent();
  ['Q24', 'Q25', 'Q26'].forEach(function (id) { assert.strictEqual(rawText.indexOf(id), -1, id); });
  assert.strictEqual(ctx.spreadsheet.getSheetByName('leads'), null, 'save_leadを一度も呼んでいないのでleadsシートは存在しない');
});

test('doPost(action=save_lead) はresponse_idが実在すればlinked、実在しなければunlinkedになる', function () {
  var ctx = loadCodeGsSandbox();
  var saveOut = ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' } }));
  var realResponseId = JSON.parse(saveOut.getContent()).response_id;

  var linkedOut = ctx.sandbox.doPost(makePostEvent({ action: 'save_lead', response_id: realResponseId, x_account: '@example', requested_content: '開催案内' }));
  assert.strictEqual(JSON.parse(linkedOut.getContent()).link_status, 'linked');

  var unlinkedOut = ctx.sandbox.doPost(makePostEvent({ action: 'save_lead', response_id: 'this-id-does-not-exist', x_account: '@example2', requested_content: '個別相談' }));
  assert.strictEqual(JSON.parse(unlinkedOut.getContent()).link_status, 'unlinked', '存在しないresponse_idを自己申告してもunlinkedになる（クライアント申告を信用しない）');

  var noIdOut = ctx.sandbox.doPost(makePostEvent({ action: 'save_lead', email: 'a@example.com', requested_content: '両方' }));
  assert.strictEqual(JSON.parse(noIdOut.getContent()).link_status, 'unlinked', 'response_id未指定でも送信自体は成功しunlinkedになる');
  assert.strictEqual(JSON.parse(noIdOut.getContent()).ok, true);
});

test('save_lead はresponsesシートへは一切書き込まない（読み取りのみ）', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' } }));
  var responsesRowCountBefore = ctx.spreadsheet.getSheetByName('responses')._rows.length;
  ctx.sandbox.doPost(makePostEvent({ action: 'save_lead', x_account: '@example', requested_content: '開催案内' }));
  var responsesRowCountAfter = ctx.spreadsheet.getSheetByName('responses')._rows.length;
  assert.strictEqual(responsesRowCountAfter, responsesRowCountBefore);
});

test('responsesシートのヘッダ順は schema/responses-columns.json の列順と完全一致する', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' } }));
  var header = ctx.spreadsheet.getSheetByName('responses')._rows[0];
  var expected = require(path.join(ROOT, 'schema/responses-columns.json')).columns.map(function (c) { return c.name; });
  assert.deepEqual(header, expected);
});

test('leadsシートのヘッダ順は schema/leads-columns.json の列順と完全一致する', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_lead', x_account: '@example', requested_content: '開催案内' }));
  var header = ctx.spreadsheet.getSheetByName('leads')._rows[0];
  var expected = require(path.join(ROOT, 'schema/leads-columns.json')).columns.map(function (c) { return c.name; });
  assert.deepEqual(header, expected);
});

test('不正なリクエストボディでも例外を投げずにエラーJSONを返す', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost({ postData: { contents: 'not-json' } });
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
});

test('未知のactionはエラーJSONを返す', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({ action: 'delete_everything' }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
});
