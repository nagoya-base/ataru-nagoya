/*
 * 管理者ダッシュボード（DashboardScript.html）の描画テスト（Issue #121）。
 * <script>内のJSをvmでロードし、google.script.runのスタブ経由で
 * getDashboardData()相当のデータを流して、生成されたDOMを検証する。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var DIR = path.join(__dirname, '..', 'gas', 'ataru_survey_admin');

function loadDashboard(data) {
  var html = fs.readFileSync(path.join(DIR, 'DashboardScript.html'), 'utf8');
  var code = html.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');
  var ids = {};
  var document = {
    getElementById: function (id) {
      if (!ids[id]) { ids[id] = document.createElement('div'); ids[id].id = id; }
      return ids[id];
    },
    createElement: function (tag) {
      var e = { tagName: tag.toUpperCase(), children: [], attributes: {}, className: '', textContent: '', hidden: false, parentNode: null };
      e.appendChild = function (c) { e.children.push(c); return c; };
      e.setAttribute = function (k, v) { e.attributes[k] = String(v); };
      return e;
    },
    createTextNode: function (t) { return { nodeType: 3, textContent: t }; }
  };
  var run = {
    withSuccessHandler: function (fn) { run._ok = fn; return run; },
    withFailureHandler: function () { return run; },
    getDashboardData: function () { run._ok(data); }
  };
  var sandbox = { document: document, google: { script: { run: run } }, Date: Date };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { document: document, ids: ids };
}

function walk(node, fn) {
  fn(node);
  (node.children || []).forEach(function (c) { walk(c, fn); });
}
function byClass(root, cls) {
  var out = [];
  walk(root, function (n) { if (n.className && n.className.split(' ').indexOf(cls) >= 0) out.push(n); });
  return out;
}
function text(node) {
  if (node.nodeType === 3) return node.textContent;
  return (node.textContent || '') + (node.children || []).map(text).join('');
}
function width(fill) { return fill.attributes.style; }

function baseData(over) {
  var d = {
    summary: { totalSaved: 5, effectiveCount: 4, excludedCount: 1, lastResponseAt: null, completionStageCounts: { completed_full: 4 }, byDate: { '2026-09-23': 39, '2026-09-22': 78, '2026-09-24': 0 } },
    questions: [
      { id: 'Q1', label: '設問A', publicationClass: 'base_public' },
      { id: 'Q2', label: '設問B', publicationClass: 'admin_only' }
    ],
    simpleAggregates: {
      Q1: { targetCount: 100, counts: { 野球ユニフォーム: 50, サッカー: 0 } },
      Q2: { targetCount: 0, counts: { なし: 3 } }
    },
    crossTabs: {
      fixed: [{ label: '固定X', crossTargetCount: 7, cells: { a: { b: 2 } } }],
      byAxis: [{ questionId: 'Q1', axisId: 'age', crossTargetCount: 7, cells: { a: { b: 3 } } }]
    },
    leadsSummary: { total: 2, linked: 1, unlinked: 1, byRequestedContent: { 開催案内: 2 } },
    freeText: { q27Messages: ['hello'], otherFreeText: { Q1_other: ['x'] } }
  };
  return Object.assign(d, over || {});
}

test('単純集計: bar要素・幅・人数/割合/badge/targetCountが描画される (A,B,E,F,G)', function () {
  var r = loadDashboard(baseData());
  var cards = byClass(r.ids['simple-cards'], 'q-card');
  assert.strictEqual(cards.length, 2);
  var items = byClass(cards[0], 'bar-item');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(width(byClass(items[0], 'bar-fill')[0]), 'width:50%');
  assert.strictEqual(text(byClass(items[0], 'bar-value')[0]), '50人 / 50%');
  assert.strictEqual(text(byClass(items[0], 'bar-label')[0]), '野球ユニフォーム');
  assert.strictEqual(byClass(items[0], 'bar-track')[0].attributes['aria-hidden'], 'true');
  assert.ok(byClass(cards[0], 'badge-base').length === 1);
  assert.ok(byClass(cards[1], 'badge-admin').length === 1);
  assert.ok(text(cards[0]).indexOf('対象回答者数（targetCount）: 100人') >= 0);
  assert.strictEqual(byClass(cards[0], 'agg-table').length, 0);
});

test('targetCount=0 は0%でNaN/Infinityなし (C)', function () {
  var r = loadDashboard(baseData());
  var card = byClass(r.ids['simple-cards'], 'q-card')[1];
  assert.strictEqual(width(byClass(card, 'bar-fill')[0]), 'width:0%');
  assert.ok(!/NaN|Infinity/.test(text(card)));
});

test('count > targetCount でも幅は100%を超えない (D)', function () {
  var d = baseData();
  d.simpleAggregates.Q1 = { targetCount: 10, counts: { 異常: 25 } };
  var r = loadDashboard(d);
  var card = byClass(r.ids['simple-cards'], 'q-card')[0];
  assert.strictEqual(width(byClass(card, 'bar-fill')[0]), 'width:100%');
});

test('日別回答数: 昇順・最大値比・件数テキスト (H,I)', function () {
  var r = loadDashboard(baseData());
  var items = byClass(r.ids['stage-counts'], 'bar-item');
  assert.deepStrictEqual(items.map(function (i) { return text(byClass(i, 'bar-label')[0]); }), ['2026-09-22', '2026-09-23', '2026-09-24']);
  assert.deepStrictEqual(items.map(function (i) { return width(byClass(i, 'bar-fill')[0]); }), ['width:100%', 'width:50%', 'width:0%']);
  assert.strictEqual(text(byClass(items[0], 'bar-value')[0]), '78件');
});

test('日別回答数: 最大値0でも壊れない (J)', function () {
  var d = baseData();
  d.summary.byDate = { '2026-09-22': 0, '2026-09-23': 0 };
  var r = loadDashboard(d);
  var items = byClass(r.ids['stage-counts'], 'bar-item');
  assert.strictEqual(items.length, 2);
  items.forEach(function (i) {
    assert.strictEqual(width(byClass(i, 'bar-fill')[0]), 'width:0%');
    assert.ok(!/NaN|Infinity/.test(text(i)));
  });
});

test('completion_stageは表のまま維持される', function () {
  var r = loadDashboard(baseData());
  var tables = byClass(r.ids['stage-counts'], 'agg-table');
  assert.strictEqual(tables.length, 1);
  assert.ok(text(tables[0]).indexOf('completed_full') >= 0);
});

test('固定・設問別クロス集計は従来どおりtable描画 (K)', function () {
  var r = loadDashboard(baseData());
  var fixed = byClass(r.ids['fixed-cross-tables'], 'cross-table-wrap');
  assert.strictEqual(fixed.length, 1);
  assert.strictEqual(byClass(fixed[0], 'agg-table').length, 1);
  assert.ok(text(fixed[0]).indexOf('固定X（crossTargetCount: 7人）') >= 0);
  assert.strictEqual(byClass(r.ids['axis-cross-accordion'], 'bar-item').length, 0);
  assert.strictEqual(byClass(r.ids['axis-cross-accordion'], 'cross-table-wrap').length, 1);
});

test('leads / freeText は従来どおり描画 (L)', function () {
  var r = loadDashboard(baseData());
  assert.strictEqual(byClass(r.ids['leads-summary'], 'stat-box').length, 3);
  assert.ok(text(r.ids['leads-summary']).indexOf('開催案内') >= 0);
  assert.strictEqual(byClass(r.ids['freetext-body'], 'freetext-list').length, 2);
  assert.ok(text(r.ids['freetext-body']).indexOf('Q27（1件）') >= 0);
});

test('スタイル: スマホ用メディアクエリと横スクロール維持', function () {
  var css = fs.readFileSync(path.join(DIR, 'DashboardStyles.html'), 'utf8');
  assert.ok(/@media \(max-width: 640px\)/.test(css));
  assert.ok(/\.cross-table-wrap \{[^}]*overflow-x: auto/.test(css));
  assert.ok(/\.bar-fill/.test(css));
});
