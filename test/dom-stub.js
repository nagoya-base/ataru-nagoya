/*
 * survey.js は素の DOM API（document.getElementById 等）に直接依存する
 * ビルドレスの静的スクリプトなので、npm への依存を増やさずにNode単体で
 * ロードできるよう、必要最小限のDOMスタブをここで用意する。
 * jsdom 等は使わず、Node組み込みの `vm` モジュールだけで完結させる。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function createElement(tag) {
  var listeners = {};
  var el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    attributes: {},
    style: {},
    _listeners: listeners,
    hidden: false,
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    className: '',
    parentNode: null,
    addEventListener: function (type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener: function () {},
    appendChild: function (child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    /* setAttribute はプレーンオブジェクトの property にも鏡写しする。
       実ブラウザの <input value="..."> のような初期値の反映を簡易的に再現するため。 */
    setAttribute: function (k, v) {
      this.attributes[k] = String(v);
      this[k] = v;
    },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
    },
    focus: function () {},
    scrollIntoView: function () {},
    closest: function () { return null; },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    remove: function () {}
  };
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return this._innerHTML || ''; },
    set: function (v) { this._innerHTML = v; if (v === '') this.children = []; }
  });
  return el;
}

function createDocument() {
  var idMap = {};
  /* survey.html の静的マークアップにある name="lead-request" の3つのラジオボタンは、
     survey.js側でgetElementById()を使わずquerySelectorAll(name属性)だけで取得している。
     このスタブはsurvey.htmlをパースしないため、実際のマークアップと同じ3値を
     あらかじめ用意しておく（Issue #104のリードフォームテストで必要）。 */
  var leadRequestRadios = ['開催案内', '個別相談', '両方'].map(function (v) {
    var el = createElement('input');
    el.type = 'radio';
    el.name = 'lead-request';
    el.value = v;
    el.checked = false;
    return el;
  });
  var doc = {
    /* survey.htmlの静的マークアップでは screen-intro 以外の画面セクション
       （screen-underage/screen-survey/screen-complete）に最初から hidden 属性が
       付いている。JS側のshowOnly()呼び出し前の初期状態をテストで検証できるよう、
       このスタブでも同じ初期hidden状態を再現する。 */
    getElementById: function (id) {
      if (!idMap[id]) {
        idMap[id] = createElement('div');
        idMap[id].id = id;
        if (id === 'screen-underage' || id === 'screen-survey' || id === 'screen-complete') {
          idMap[id].hidden = true;
        }
      }
      return idMap[id];
    },
    createElement: function (tag) { return createElement(tag); },
    createTextNode: function (text) { return { nodeType: 3, textContent: text }; },
    querySelectorAll: function (selector) {
      if (selector === 'input[name="lead-request"]') return leadRequestRadios;
      return [];
    },
    addEventListener: function () {},
    body: createElement('body')
  };
  return doc;
}

/* Cookie/localStorageによる重複回答抑止（Issue #104）のテスト用に、
   最小限のin-memory localStorageスタブを用意する。 */
function createLocalStorage() {
  var store = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { store = {}; }
  };
}

/* survey.js を新しいスタブDOM上でロードし、window/document/収集したfetch呼び出しを返す。
   テストごとに独立した状態(answers等)で始められるよう、呼び出すたびに新しいVMコンテキストを作る。
   opts.cookie / opts.localStorage で、スクリプト読み込み前（＝survey.js自身の重複回答チェックが
   走る前）にCookie/localStorageの状態を再現できる。 */
function loadSurvey(opts) {
  opts = opts || {};
  var document = createDocument();
  var fetchCalls = [];
  var fetchImpl = null;

  /* Array/Object/JSON等はここで明示的に渡さない。vm.createContext()が生成する
     新しいレルムには標準組み込み(Array, Object, Math, JSON, Promise等)が
     自動的に備わっており、それこそがsurvey.js内の配列リテラル等が実際に使う
     プロトタイプになる。ここで外側realmのArrayを渡してしまうと、
     survey.js内で作られる配列は依然としてvm自身のArray.prototypeを使うため、
     テスト側からのプロトタイプ操作（breakArrayIndexOf等）が効かなくなる。 */
  var sandbox = {
    document: document,
    console: console,
    setTimeout: setTimeout
  };
  sandbox.window = sandbox;
  sandbox.window.crypto = { randomUUID: function () { return 'test-uuid-0000-0000'; } };
  sandbox.window.location = { protocol: 'https:', hostname: 'example.com', search: '' };
  sandbox.window.AtaruAnalytics = undefined;
  sandbox.window.localStorage = createLocalStorage();
  if (opts.localStorage) {
    Object.keys(opts.localStorage).forEach(function (k) { sandbox.window.localStorage.setItem(k, opts.localStorage[k]); });
  }
  document.cookie = opts.cookie || '';

  function FakeFormData() { this._data = []; }
  FakeFormData.prototype.append = function (k, v) { this._data.push([k, v]); };
  sandbox.FormData = FakeFormData;
  sandbox.window.FormData = FakeFormData;

  sandbox.fetch = function (url, opts) {
    fetchCalls.push({ url: url, opts: opts });
    if (typeof fetchImpl === 'function') return fetchImpl(url, opts);
    /* GAS_ENDPOINT宛のPOSTはデフォルトで保存成功のJSONを返す（テストごとに
       setFetchImpl()で上書きしない限り、GAS保存成功→FormSubmit通知の流れを
       そのまま再現できるようにするため）。それ以外（FormSubmit等）は従来通り空JSON。 */
    if (url === sandbox.window.__Survey.GAS_ENDPOINT) {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, response_id: 'stub-server-response-id', saved_at: new Date().toISOString(), completion_stage: 'completed_full', excluded: false }); } });
    }
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
  };
  sandbox.window.fetch = sandbox.fetch;

  var context = vm.createContext(sandbox);
  var code = fs.readFileSync(path.join(__dirname, '..', 'survey.js'), 'utf8');
  vm.runInContext(code, context, { filename: 'survey.js' });

  return {
    window: sandbox.window,
    document: document,
    S: sandbox.window.__Survey,
    fetchCalls: fetchCalls,
    setFetchImpl: function (fn) { fetchImpl = fn; },
    setAnalyticsSpy: function (calls) {
      sandbox.window.AtaruAnalytics = {
        track: function (name, params) { calls.push({ name: name, params: params || {} }); },
        trackGenerateLead: function (token, intent, params) {
          calls.push({ name: 'generate_lead', params: Object.assign({}, params, { lead_type: intent }) });
        }
      };
    }
  };
}

function fire(el, type) {
  var handlers = (el._listeners && el._listeners[type]) || [];
  handlers.forEach(function (fn) { fn.call(el, { target: el }); });
}

function collectInputs(el, acc) {
  acc = acc || [];
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') acc.push(el);
  (el.children || []).forEach(function (c) { collectInputs(c, acc); });
  return acc;
}

function findInputByValue(inputs, value) {
  return inputs.filter(function (i) { return i.value === value; })[0] || null;
}

/* チェックボックス/ラジオを「クリックした」状態にして change イベントを発火する */
function check(inputs, value) {
  var el = findInputByValue(inputs, value);
  if (!el) throw new Error('option not found: ' + value);
  el.checked = true;
  fire(el, 'change');
  return el;
}

function uncheck(inputs, value) {
  var el = findInputByValue(inputs, value);
  if (!el) throw new Error('option not found: ' + value);
  el.checked = false;
  fire(el, 'change');
  return el;
}

module.exports = {
  loadSurvey: loadSurvey,
  fire: fire,
  collectInputs: collectInputs,
  findInputByValue: findInputByValue,
  check: check,
  uncheck: uncheck
};
