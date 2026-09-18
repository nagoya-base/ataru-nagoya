/*
 * 管理者GAS（gas/ataru_survey_admin/）が読み取り専用であることの静的検証。
 * Spreadsheetへの書き込みメソッドが1つでも存在すれば失敗する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');

var ADMIN_DIR = path.join(__dirname, '..', 'gas', 'ataru_survey_admin');

var FORBIDDEN_PATTERNS = [
  /\.appendRow\s*\(/,
  /\.setValue\s*\(/,
  /\.setValues\s*\(/,
  /\.clear\s*\(/,
  /\.clearContent\s*\(/,
  /\.deleteRow\s*\(/,
  /\.deleteRows\s*\(/,
  /\.deleteSheet\s*\(/,
  /\.insertRow\s*\(/,
  /\.insertRows\s*\(/
];

function gsFiles() {
  return fs.readdirSync(ADMIN_DIR).filter(function (f) { return f.endsWith('.gs'); }).map(function (f) { return path.join(ADMIN_DIR, f); });
}

test('gas/ataru_survey_admin/ に .gs ファイルが存在する', function () {
  assert.ok(gsFiles().length > 0);
});

test('管理者GASのどの.gsファイルにも書き込みメソッド呼び出しが存在しない', function () {
  gsFiles().forEach(function (file) {
    var content = fs.readFileSync(file, 'utf8');
    FORBIDDEN_PATTERNS.forEach(function (re) {
      assert.ok(!re.test(content), path.basename(file) + ' に禁止された書き込みメソッドが含まれている: ' + re);
    });
  });
});

test('Code.gs はSpreadsheetの読み取り系メソッドのみを使用する', function () {
  var content = fs.readFileSync(path.join(ADMIN_DIR, 'Code.gs'), 'utf8');
  assert.match(content, /getDataRange\s*\(/);
  assert.match(content, /getValues\s*\(/);
});

test('Code.gs に回答変更・削除・excluded変更のAPIが存在しない', function () {
  var content = fs.readFileSync(path.join(ADMIN_DIR, 'Code.gs'), 'utf8');
  assert.ok(!/function\s+(updateResponse|deleteResponse|setExcluded|editResponse)\w*\s*\(/i.test(content));
});
