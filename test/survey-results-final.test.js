'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

function loadResultsScript(fetchImpl) {
  var document = {
    getElementById: function () { return null; },
    createElement: function (tag) {
      return {
        tagName: String(tag || 'div').toUpperCase(), children: [], attributes: {},
        className: '', textContent: '', hidden: false,
        appendChild: function (child) { this.children.push(child); return child; },
        setAttribute: function (k, v) { this.attributes[k] = String(v); }
      };
    },
    createTextNode: function (text) { return { nodeType: 3, textContent: text }; }
  };
  var sandbox = { document: document, console: console, fetch: fetchImpl };
  sandbox.window = sandbox;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'survey-results.js'), 'utf8'), vm.createContext(sandbox));
  return sandbox.window.__SurveyResults;
}

function response(ok, status, data) {
  return { ok: ok, status: status, json: function () { return Promise.resolve(data); } };
}

test('最終JSONを最優先し、取得成功時はGASへアクセスしない', async function () {
  var calls = [];
  var finalData = { effectiveCount: 193, snapshot: { closed_at: '2026-10-05T14:47:46+09:00' } };
  var R = loadResultsScript(function (url) {
    calls.push(url);
    return Promise.resolve(response(true, 200, finalData));
  });
  var got = await R.fetchResults();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0], 'data/survey-results-final.json');
  assert.strictEqual(got, finalData);
});

test('最終JSONが404の場合だけGASへフォールバックする', async function () {
  var calls = [];
  var gasData = { effectiveCount: 193 };
  var R = loadResultsScript(function (url) {
    calls.push(url);
    if (calls.length === 1) return Promise.resolve(response(false, 404, null));
    return Promise.resolve(response(true, 200, gasData));
  });
  var got = await R.fetchResults();
  assert.strictEqual(calls[0], 'data/survey-results-final.json');
  assert.ok(/\?action=results$/.test(calls[1]));
  assert.strictEqual(got, gasData);
});

test('最終JSONのfetch自体が失敗した場合はGASへフォールバックする', async function () {
  var calls = [];
  var R = loadResultsScript(function (url) {
    calls.push(url);
    if (calls.length === 1) return Promise.reject(new Error('network'));
    return Promise.resolve(response(true, 200, { effectiveCount: 193 }));
  });
  var got = await R.fetchResults();
  assert.strictEqual(calls.length, 2);
  assert.ok(/\?action=results$/.test(calls[1]));
  assert.strictEqual(got.effectiveCount, 193);
});

test('最終JSONが404以外のHTTPエラーならGASへ黙って切り替えない', async function () {
  var calls = [];
  var R = loadResultsScript(function (url) {
    calls.push(url);
    return Promise.resolve(response(false, 500, null));
  });
  await assert.rejects(R.fetchResults(), /final_results_http_error/);
  assert.deepStrictEqual(calls, ['data/survey-results-final.json']);
});

test('最終JSONは公開集計トップレベルのホワイトリスト内だけで、snapshot以外の生データを持たない', function () {
  var file = path.join(ROOT, 'data', 'survey-results-final.json');
  var data = JSON.parse(fs.readFileSync(file, 'utf8'));
  var allowedTop = [
    'surveyVersion', 'effectiveCount', 'gateThreshold', 'gateOpen', 'overviewLowN',
    'overview', 'detail', 'suppressionApplied', 'snapshot'
  ];
  Object.keys(data).forEach(function (key) {
    assert.ok(allowedTop.indexOf(key) !== -1, 'unexpected top-level key: ' + key);
  });
  assert.strictEqual(data.effectiveCount, 193);
  assert.deepStrictEqual(data.snapshot, {
    closed_at: '2026-10-05T14:47:46+09:00',
    source: 'ataru_survey_public?action=results'
  });
  assert.deepStrictEqual(Object.keys(data.overview).sort(), ['Q1', 'Q3', 'Q4']);

  var serialized = JSON.stringify(data);
  ['response_id', 'clientResponseId', 'x_account', 'email', 'leads', 'responses'].forEach(function (forbidden) {
    assert.strictEqual(serialized.indexOf(forbidden), -1, forbidden + ' must not appear in final public JSON');
  });
});

test('最終結果ページは受付終了・最終集計の文言で、回答CTAを出さない', function () {
  var html = fs.readFileSync(path.join(ROOT, 'survey-results.html'), 'utf8');
  assert.ok(html.indexOf('回答受付は終了しました') !== -1);
  assert.ok(html.indexOf('最終集計結果') !== -1);
  assert.strictEqual(html.indexOf('アンケートに回答する'), -1);
});
