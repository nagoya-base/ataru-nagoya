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
  var doc = {
    getElementById: function (id) {
      if (!idMap[id]) {
        idMap[id] = createElement('div');
        idMap[id].id = id;
      }
      return idMap[id];
    },
    createElement: function (tag) { return createElement(tag); },
    createTextNode: function (text) { return { nodeType: 3, textContent: text }; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
    body: createElement('body')
  };
  return doc;
}

/* survey.js を新しいスタブDOM上でロードし、window/document/収集したfetch呼び出しを返す。
   テストごとに独立した状態(answers等)で始められるよう、呼び出すたびに新しいVMコンテキストを作る。 */
function loadSurvey() {
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

  function FakeFormData() { this._data = []; }
  FakeFormData.prototype.append = function (k, v) { this._data.push([k, v]); };
  sandbox.FormData = FakeFormData;
  sandbox.window.FormData = FakeFormData;

  sandbox.fetch = function (url, opts) {
    fetchCalls.push({ url: url, opts: opts });
    if (typeof fetchImpl === 'function') return fetchImpl(url, opts);
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
