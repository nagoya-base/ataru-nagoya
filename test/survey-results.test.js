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
      Q7: { hidden: false, targetCount: 60, options: [{ value: '野球・ソフトボール', count: 10, pct: 0.1667 }], label: '現在または過去に経験したスポーツ' },
      Q20B: { hidden: true, targetCount: 5, label: '男性向け企画で関心のある詳細内容（B. 吊り・強度）' }
    },
    suppressionApplied: false
  };
  ctx.R.renderResultData(root, data);
  var headings = findAll(root, function (el) { return el.tagName === 'H2'; }).map(textOf);
  assert.ok(headings.indexOf('詳細結果') !== -1);
  assert.ok(headings.indexOf('現在または過去に経験したスポーツ') !== -1, 'APIレスポンスのdetail.Q7.labelがそのまま見出しに使われる');
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

test('survey-results.jsのソース自体に、Q5〜Q23相当の詳細設問名がハードコードされていない（PR #110レビュー対応）', function () {
  var source = fs.readFileSync(path.join(__dirname, '..', 'survey-results.js'), 'utf8');
  /* 100件以下でも誰でも取得できる静的ファイルなので、非公開設問の存在自体（設問名）を
     このファイル自身が知っていてはならない。survey-schema.jsonのgated_public設問の
     labelから抜粋した固有の文言が一切含まれないことを確認する。 */
  ['緊縛の楽しみ方', 'ユニフォーム・ウェア', 'SM・性的な責め', '緊縛・ロープの経験', '名古屋での参加可能性'].forEach(function (phrase) {
    assert.strictEqual(source.indexOf(phrase), -1, phrase + ' がsurvey-results.jsに埋め込まれている');
  });
  assert.strictEqual(/DETAIL_LABELS|DETAIL_ORDER/.test(source), false, '静的なラベル・順序一覧を持たない（APIレスポンスのlabel/キー順をそのまま使う）');
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

/* ---- 棒グラフ＋人数降順表示 ---- */
function renderBlocks(overviewQ1, extra) {
  var ctx = loadResultsScript(fakeFetchOk({}));
  var root = ctx.document.getElementById('result-root');
  var hid = { hidden: true, targetCount: 3 };
  ctx.R.renderResultData(root, Object.assign({
    effectiveCount: 200, gateOpen: false, overviewLowN: false,
    overview: { Q1: overviewQ1, Q3: hid, Q4: hid }, suppressionApplied: false
  }, extra || {}));
  return root;
}
function cls(el, c) { return !!el.className && el.className.split(' ').indexOf(c) >= 0; }
function rows(root) { return findAll(root, function (e) { return cls(e, 'opt-row'); }); }
function rowName(r) { return textOf(findAll(r, function (e) { return cls(e, 'opt-name'); })[0]); }
function rowNum(r) { return textOf(findAll(r, function (e) { return cls(e, 'opt-num'); })[0]); }
function rowWidth(r) { return findAll(r, function (e) { return cls(e, 'result-bar-fill'); })[0].attributes.style; }
function opts(list) { return list.map(function (x) { return { value: x[0], count: x[1], pct: x[2] }; }); }

test('options: count降順・同数は元順維持・0件も残り・元配列は不変', function () {
  var options = opts([['A', 10, 0.1], ['B', 50, 0.5], ['C', 30, 0.3], ['D', 30, 0.3], ['E', 0, 0]]);
  var root = renderBlocks({ hidden: false, targetCount: 100, options: options, otherSmall: null });
  assert.deepStrictEqual(rows(root).map(rowName), ['B', 'C', 'D', 'A', 'E']);
  assert.deepStrictEqual(options.map(function (o) { return o.value; }), ['A', 'B', 'C', 'D', 'E']);
});

test('棒: pct=0.5→50%、pct=0→0%、異常値でも0〜100%、人数・割合テキストも残る', function () {
  var root = renderBlocks({ hidden: false, targetCount: 100, otherSmall: null,
    options: opts([['半分', 50, 0.5], ['ゼロ', 0, 0], ['超過', 40, 1.7], ['非数', 1, NaN], ['無限', 1, Infinity], ['負', 1, -0.2]]) });
  var byName = {};
  rows(root).forEach(function (r) { byName[rowName(r)] = r; });
  assert.strictEqual(rowWidth(byName['半分']), 'width:50%');
  assert.strictEqual(rowWidth(byName['ゼロ']), 'width:0%');
  assert.strictEqual(rowWidth(byName['超過']), 'width:100%');
  assert.strictEqual(rowWidth(byName['非数']), 'width:0%');
  assert.strictEqual(rowWidth(byName['無限']), 'width:0%');
  assert.strictEqual(rowWidth(byName['負']), 'width:0%');
  assert.strictEqual(rowNum(byName['半分']), '50人（50%）');
  findAll(root, function (e) { return cls(e, 'result-bar-track'); }).forEach(function (t) {
    assert.strictEqual(t.attributes['aria-hidden'], 'true');
  });
  assert.ok(!/NaN|Infinity/.test(textOf(root)));
});

test('otherSmallは人数が最大でも末尾固定で、棒も出る', function () {
  var root = renderBlocks({ hidden: false, targetCount: 100,
    options: opts([['A', 5, 0.05], ['B', 20, 0.2]]), otherSmall: { count: 60, pct: 0.6 } });
  var r = rows(root);
  assert.deepStrictEqual(r.map(rowName), ['B', 'A', 'その他少数']);
  assert.strictEqual(rowNum(r[2]), '60人（60%）');
  assert.strictEqual(rowWidth(r[2]), 'width:60%');
});

test('hidden blockは棒を生成しない', function () {
  var root = renderBlocks({ hidden: true, targetCount: 3 });
  assert.strictEqual(rows(root).length, 0);
  assert.strictEqual(findAll(root, function (e) { return cls(e, 'result-bar-fill'); }).length, 0);
});

test('detailブロックも降順で棒表示される', function () {
  var root = renderBlocks({ hidden: true, targetCount: 3 }, {
    gateOpen: true,
    detail: { Q7: { hidden: false, targetCount: 60, label: 'L', otherSmall: null, options: opts([['x', 1, 0.1], ['y', 9, 0.9]]) } }
  });
  assert.deepStrictEqual(rows(root).map(rowName), ['y', 'x']);
});
