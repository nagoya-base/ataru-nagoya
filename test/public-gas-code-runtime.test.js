/*
 * gas/ataru_survey_public/Code.gs 自体を、最小限のGASサービススタブ（SpreadsheetApp /
 * PropertiesService / Utilities / ContentService）付きでvm実行し、doGet/doPostが
 * 実際にend-to-endで動作することを検証する（Issue #104 追加指示15・16）。
 * PR #109で発生した「Node版ロジックは通るが生成GASが壊れる」問題を、Code.gs自体の
 * 実行という最も生成物に近いレイヤーで再発防止する。
 *
 * 公開Web Appは匿名で誰でもPOSTできるため、必須設問の未回答・17歳以下の保存拒否も
 * ここで（ブラウザUIを一切経由せず）end-to-endで検証する（PR #110レビュー対応）。
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

/* 女性・その他：Q1〜Q4のみが必須（Q7以降は非到達）。 */
function femaleAnswers(overrides) {
  var base = { q1_age: '25〜29歳', q2_gender: '女性', q3_region: '東京都', q4_interest: '興味がある' };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

/* 男性・Q15「興味はない」：Q7/Q8/Q9/Q11/Q12/Q15までが必須（Q16以降は非到達）。
   Q11は1件だけ選ぶことで、Q12（Q11の候補が2件以上のときだけ必須）を回避する。 */
function maleGateNoAnswers(overrides) {
  var base = {
    q1_age: '30〜34歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球'], q15_gate: '興味はない'
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

/* 男性・ゲート通過（はい）・Q4通常関心：Q17/Q18/Q22/Q24/Q25まで必須。 */
function maleGatePassedAnswers(overrides) {
  var base = {
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q7_sports: ['野球・ソフトボール'], q8_exercise: '定期的にスポーツをしている', q9_gym: '週2〜3回',
    q11_uniform: ['野球'], q15_gate: 'はい',
    q17_experience: ['未経験'], q18_combo: 'ぜひ体験したい',
    q22_visit: '日程が合えば', q24_price: '3,000円程度', q25_intent: '日程が合えば参加したい'
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}

test('doPost(action=save_response) は responses シートへ1行保存し、response_idをサーバー側で発行する', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: maleGatePassedAnswers(),
    clientResponseId: 'client-side-fake-id-should-not-be-used'
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, true, JSON.stringify(json));
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
    answers: femaleAnswers({ q7_sports: ['野球・ソフトボール'], q24_price: '3,000円程度' })
  }));
  var sheet = ctx.spreadsheet.getSheetByName('responses');
  var header = sheet._rows[0];
  var dataRow = sheet._rows[1];
  assert.strictEqual(dataRow[header.indexOf('q7_sports')], '', '女性はQ7非到達のため空で保存される');
  assert.strictEqual(dataRow[header.indexOf('q24_price')], '');
});

/* ── レビュー対応1：匿名POSTによる不完全回答の蓄積防止 ── */

test('必須設問が未回答のPOSTは保存されず、ok:falseとmissingが返る（匿名直POSTによる不完全回答の蓄積防止）', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' }
    /* 男性なのにQ7/Q8/Q9/Q11/Q15を一切送らない */
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.error, 'invalid_answers');
  ['Q7', 'Q8', 'Q9', 'Q11', 'Q15'].forEach(function (id) {
    assert.ok(json.missing.indexOf(id) !== -1, id + ' がmissingに含まれる: ' + JSON.stringify(json.missing));
  });
  assert.strictEqual(ctx.spreadsheet.getSheetByName('responses'), null, '保存を拒否した場合はシート自体を作らない');
});

test('必須設問が未回答のPOSTを繰り返しても有効回答数(effectiveCount)は増えない', function () {
  var ctx = loadCodeGsSandbox();
  for (var i = 0; i < 5; i++) {
    ctx.sandbox.doPost(makePostEvent({
      action: 'save_response',
      answers: { q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある' }
    }));
  }
  var out = ctx.sandbox.doGet({ parameter: { action: 'results' } });
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.effectiveCount, 0);
});

test('Q15「興味はない」で分岐した回答はQ16以降が未回答でも保存される（非到達設問はrequired判定の対象外）', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: maleGateNoAnswers() }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, true, JSON.stringify(json));
});

test('Q11の候補が2件以上あるのにQ12が未回答だと保存を拒否する（Q12の動的必須条件）', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: maleGateNoAnswers({ q11_uniform: ['野球', 'サッカー'] }) /* q12_favorite未指定 */
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.ok(json.missing.indexOf('Q12') !== -1, JSON.stringify(json.missing));
});

test('Q11の候補が2件以上あり、Q12にQ11由来の値を回答すれば保存される', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: maleGateNoAnswers({ q11_uniform: ['野球', 'サッカー'], q12_favorite: 'サッカー' })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, true, JSON.stringify(json));
});

test('Q12にQ11で選んでいない値を注入しても保存されない（Q11由来の動的許可リストで検証）', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: maleGateNoAnswers({ q11_uniform: ['野球', 'サッカー'], q12_favorite: 'ラグビー・アメフト' })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false, 'Q11で選んでいない値はQ12として無効化され、必須未回答として拒否される');
});

/* ── レビュー対応2：17歳以下の保存拒否 ── */

test('17歳以下は保存を拒否し、responsesシートへ一切残さない', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '17歳以下' } }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.error, 'underage_not_saved');
  assert.strictEqual(ctx.spreadsheet.getSheetByName('responses'), null, '17歳以下のPOSTではシート自体を作らない');
});

test('17歳以下のPOSTを繰り返しても保存されず、有効な回答の後にも影響しない', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: { q1_age: '17歳以下' } }));
  var out = ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: femaleAnswers() }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, true);
  var sheet = ctx.spreadsheet.getSheetByName('responses');
  assert.strictEqual(sheet._rows.length, 2, '17歳以下の分は保存されず、有効な1件だけがヘッダ+1行として残る');
});

/* ── レビュー対応その2：exclusiveOptions・conflictPairs・q20CrossExclusive・自由記述必須 ── */

test('Q2「その他」を選んだのに自由記述が空だと保存を拒否する', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: femaleAnswers({ q2_gender: 'その他', q2_gender_other: '' })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.strictEqual(json.error, 'invalid_answers');
  assert.ok(json.missing.indexOf('q2_gender_other') !== -1, JSON.stringify(json.missing));
});

test('Q5のexclusiveOptions（「回答しない」）を通常選択肢と同時送信すると保存を拒否する', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: femaleAnswers({ q5_enjoy: ['回答しない', '縄の感触を感じたい'] })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.ok(json.invalidCombinations.indexOf('Q5:exclusive_options') !== -1, JSON.stringify(json.invalidCombinations));
});

test('Q6のconflictPairs（「両方」と「縛られる側」）を同時送信すると保存を拒否する', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: femaleAnswers({ q6_role: ['縛る・縛られる両方に興味がある', '縛られる側に興味がある'] })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.ok(json.invalidCombinations.indexOf('Q6:conflict_pair') !== -1, JSON.stringify(json.invalidCombinations));
});

test('Q20Dの「回答しない」とQ20Aを同時送信すると保存を拒否する', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: maleGatePassedAnswers({ q20a: ['ユニフォーム姿のまま格好よく縛られたい'], q20d: ['回答しない'] })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, false);
  assert.ok(json.invalidCombinations.indexOf('Q20:cross_exclusive') !== -1, JSON.stringify(json.invalidCombinations));
});

test('フロントで成立する正常な回答（矛盾・欠落なし）は問題なく保存される', function () {
  var ctx = loadCodeGsSandbox();
  var out = ctx.sandbox.doPost(makePostEvent({
    action: 'save_response',
    answers: maleGatePassedAnswers({ q5_enjoy: ['縄の感触を感じたい'], q6_role: ['縛られる側に興味がある'], q20d: ['縄だけを楽しみたい'] })
  }));
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.ok, true, JSON.stringify(json));
});

/* ── 公開集計への影響 ── */

test('doGet(action=results) は保存直後（1件）では詳細を含まない公開集計を返す', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: femaleAnswers() }));
  var out = ctx.sandbox.doGet({ parameter: { action: 'results' } });
  var json = JSON.parse(out.getContent());
  assert.strictEqual(json.effectiveCount, 1);
  assert.strictEqual(json.gateOpen, false);
  assert.strictEqual('detail' in json, false);
});

test('doGet(action=results) は101件保存後、詳細結果を含む（admin_only・leadsは含まない）', function () {
  var ctx = loadCodeGsSandbox();
  for (var i = 0; i < 101; i++) {
    ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: maleGatePassedAnswers() }));
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
  var saveOut = ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: femaleAnswers() }));
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
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: femaleAnswers() }));
  var responsesRowCountBefore = ctx.spreadsheet.getSheetByName('responses')._rows.length;
  ctx.sandbox.doPost(makePostEvent({ action: 'save_lead', x_account: '@example', requested_content: '開催案内' }));
  var responsesRowCountAfter = ctx.spreadsheet.getSheetByName('responses')._rows.length;
  assert.strictEqual(responsesRowCountAfter, responsesRowCountBefore);
});

test('responsesシートのヘッダ順は schema/responses-columns.json の列順と完全一致する', function () {
  var ctx = loadCodeGsSandbox();
  ctx.sandbox.doPost(makePostEvent({ action: 'save_response', answers: femaleAnswers() }));
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
