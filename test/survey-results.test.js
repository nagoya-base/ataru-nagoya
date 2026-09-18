/*
 * survey-results.html 用スクリプト（Issue #104）のテスト。
 * 公開APIレスポンス（JSON）だけを根拠に、非公開設問のキー・カテゴリ名を一切
 * フロント側で構築しないこと、5人未満マスキング・100件ゲート・半数以下非公開の
 * 表示が正しく反映されることを検証する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function createElement(tag) {
  var listeners = {};
  var el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    attributes: {},
    hidden: false,
    textContent: '',
    className: '',
    parentNode: null,
    addEventListener: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    appendChild: function (child) { this.children.push(child); child.parentNode = this; return child; },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return this._innerHTML || ''; },
    set: function (v) { this._innerHTML = v; if (v === '') this.children = []; }
  });
  return el;
}

function textOf(el) {
  if (!el) return '';
  if (el.textContent) return el.textContent;
  return (el.children || []).map(textOf).join('');
}

function findAll(el, predicate, acc) {
  acc = acc || [];
  if (predicate(el)) acc.push(el);
  (el.children || []).forEach(function (c) { findAll(c, predicate, acc); });
  return acc;
}

function loadResultsScript(fetchImpl) {
  var idMap = {};
  var document = {
    getElementById: function (id) {
      if (!idMap[id]) { idMap[id] = createElement('div'); idMap[id].id = id; idMap[id].hidden = (id === 'error-state' || id === 'result-root'); }
      return idMap[id];
    },
    createElement: function (tag) { return createElement(tag); },
    createTextNode: function (text) { return { nodeType: 3, textContent: text }; }
  };
  var sandbox = { document: document, console: console };
  sandbox.window = sandbox;
  sandbox.fetch = fetchImpl;
  var context = vm.createContext(sandbox);
  var code = fs.readFileSync(path.join(__dirname, '..', 'survey-results.js'), 'utf8');
  vm.runInContext(code, context, { filename: 'survey-results.js' });
  return { window: sandbox.window, document: document, R: sandbox.window.__SurveyResults };
}

function fakeFetchOk(data) {
  return function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve(data); } }); };
}

test('gateOpen=falseのデータではdetailセクション（「詳細結果」見出し）が一切描画されない', function () {
  var ctx = loadResultsScript(fakeFetchOk({}));
  var root = ctx.document.getElementById('result-root');
  var data = {
    surveyVersion: 'v1', effectiveCount: 42, gateThreshold: 100, gateOpen: false, overviewLowN: false,
    overview: {
      Q1: { hidden: false, targetCount: 42, options: [{ value: '25〜29歳', count: 20, pct: 0.4762 }], otherSmall: null },
      Q3: { hidden: false, targetCount: 42, options: [{ value: '東海', count: 30, pct: 0.7143 }], otherSmall: null },
      Q4: { hidden: false, targetCount: 42, options: [{ value: '興味がある', count: 25, pct: 0.5952 }], otherSmall: null }
    },
    suppressionApplied: false
  };
  ctx.R.renderResultData(root, data);
  var headings = findAll(root, function (el) { return el.tagName === 'H2'; }).map(textOf);
  assert.strictEqual(headings.indexOf('詳細結果'), -1, 'detailキーが無い場合は「詳細結果」見出し自体が存在しない');
  var fullText = textOf(root);
  assert.strictEqual(fullText.indexOf('Q5'), -1, 'Q5等の文字列がどこにも出現しない');
  assert.ok(fullText.indexOf('42') !== -1, '有効回答数は表示される');
});

test('gateOpen=trueかつdetailがある場合、DETAIL_ORDERにあるキーだけ「詳細結果」配下に描画される', function () {
  var ctx = loadResultsScript(fakeFetchOk({}));
  var root = ctx.document.getElementById('result-root');
  var data = {
    effectiveCount: 150, gateOpen: true, overviewLowN: false,
    overview: { Q1: { hidden: false, targetCount: 150, options: [], otherSmall: null }, Q3: { hidden: false, targetCount: 150, options: [], otherSmall: null }, Q4: { hidden: false, targetCount: 150, options: [], otherSmall: null } },
    detail: {
      Q7: { hidden: false, targetCount: 60, options: [{ value: '野球・ソフトボール', count: 10, pct: 0.1667 }] },
      Q20B: { hidden: true, targetCount: 5 }
    },
    suppressionApplied: false
  };
  ctx.R.renderResultData(root, data);
  var headings = findAll(root, function (el) { return el.tagName === 'H2'; }).map(textOf);
  assert.ok(headings.indexOf('詳細結果') !== -1);
  assert.ok(headings.indexOf('現在または過去に経験したスポーツ（男性）') !== -1, 'Q7のラベルが表示される');
  var fullText = textOf(root);
  assert.ok(fullText.indexOf('対象回答者：60人') !== -1, 'targetCountが表示される');
  assert.ok(fullText.indexOf('分岐条件によりこの質問へ到達した人だけを分母') !== -1);
  assert.ok(fullText.indexOf('まだ内訳を公開できる人数に達していません') !== -1, 'hiddenなQ20Bの案内が表示される');
});

test('overviewLowN=trueの場合、低N専用の案内文が表示される', function () {
  var ctx = loadResultsScript(fakeFetchOk({}));
  var root = ctx.document.getElementById('result-root');
  var data = {
    effectiveCount: 3, gateOpen: false, overviewLowN: true,
    overview: { Q1: { hidden: true, targetCount: 3 }, Q3: { hidden: true, targetCount: 3 }, Q4: { hidden: false, targetCount: 3, options: [], otherSmall: { count: 3, pct: 1 } } },
    suppressionApplied: true
  };
  ctx.R.renderResultData(root, data);
  var fullText = textOf(root);
  assert.ok(fullText.indexOf('まだ回答数が少ないため、内訳は一部表示していません') !== -1);
  assert.ok(fullText.indexOf('プライバシー保護のため') !== -1, 'suppressionApplied時の注記が表示される');
});

test('100件以下のゲート未解放案内文が表示される', function () {
  var ctx = loadResultsScript(fakeFetchOk({}));
  var root = ctx.document.getElementById('result-root');
  ctx.R.renderResultData(root, { effectiveCount: 80, gateOpen: false, overviewLowN: false, overview: { Q1: { hidden: false, targetCount: 80, options: [], otherSmall: null }, Q3: { hidden: false, targetCount: 80, options: [], otherSmall: null }, Q4: { hidden: false, targetCount: 80, options: [], otherSmall: null } }, suppressionApplied: false });
  var fullText = textOf(root);
  assert.ok(fullText.indexOf('詳細結果は回答数が100件を超えた時点で公開します') !== -1);
});

test('fetch失敗時はエラー表示になり、result-rootは表示されない（init()経由）', function (t, done) {
  var ctx = loadResultsScript(function () { return Promise.reject(new Error('network')); });
  setTimeout(function () {
    try {
      assert.strictEqual(ctx.document.getElementById('error-state').hidden, false);
      assert.strictEqual(ctx.document.getElementById('result-root').hidden, true);
      done();
    } catch (e) { done(e); }
  }, 10);
});

test('APIレスポンスを正常取得した場合、init()経由でresult-rootが表示される', function (t, done) {
  var data = { effectiveCount: 10, gateOpen: false, overviewLowN: false, overview: { Q1: { hidden: false, targetCount: 10, options: [], otherSmall: null }, Q3: { hidden: false, targetCount: 10, options: [], otherSmall: null }, Q4: { hidden: false, targetCount: 10, options: [], otherSmall: null } }, suppressionApplied: false };
  var ctx = loadResultsScript(fakeFetchOk(data));
  setTimeout(function () {
    try {
      assert.strictEqual(ctx.document.getElementById('result-root').hidden, false);
      assert.strictEqual(ctx.document.getElementById('loading-state').hidden, true);
      done();
    } catch (e) { done(e); }
  }, 10);
});
