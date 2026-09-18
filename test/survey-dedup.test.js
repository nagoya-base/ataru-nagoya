/*
 * 重複回答抑止（Cookie / localStorage）とGAS保存フローのテスト（Issue #104）。
 * - GAS保存成功後だけCookie/localStorageへ回答済み状態を保存する
 * - Cookie / localStorageのどちらか一方だけでも再訪時に通常フォームを開始させない
 * - GAS失敗時は完了画面・回答済み状態・survey_submitを発生させず、入力内容を保持する
 * - GAS成功・FormSubmit失敗でも完了扱いになり、再回答を要求しない
 * - CookieのPathがsurvey.html相当の最小スコープに限定され、Path=/ではない
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var dom = require('./dom-stub');

test('survey.js内のSURVEY_VERSION定数はsurvey-schema.jsonのsurveyVersionと一致する（localStorage保存値の整合性）', function () {
  var schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'survey-schema.json'), 'utf8'));
  var source = fs.readFileSync(path.join(__dirname, '..', 'survey.js'), 'utf8');
  var m = source.match(/var SURVEY_VERSION = '([^']+)'/);
  assert.ok(m, 'survey.js にSURVEY_VERSION定数が見つからない');
  assert.strictEqual(m[1], schema.surveyVersion);
});

function clickStart(ctx) { dom.fire(ctx.document.getElementById('btn-start'), 'click'); }
function clickNext(ctx) { dom.fire(ctx.document.getElementById('btn-next'), 'click'); }

/* 男性・Q15「興味はない」でQ16〜Q26をスキップする最短経路でQ27まで進めて送信する。 */
function driveToSubmit(ctx) {
  var a = ctx.S.engine.answers;
  clickStart(ctx);
  a.q1_age = '25〜29歳'; clickNext(ctx);
  a.q2_gender = '男性'; clickNext(ctx);
  a.q3_region = '東京都'; clickNext(ctx);
  clickNext(ctx); // bondage_intro
  a.q4_interest = '興味がある'; clickNext(ctx);
  clickNext(ctx); // q5
  clickNext(ctx); // q6
  clickNext(ctx); // q6a
  a.q7_sports = ['野球・ソフトボール']; clickNext(ctx);
  a.q8_exercise = '定期的にスポーツをしている'; clickNext(ctx);
  a.q9_gym = '週2〜3回'; clickNext(ctx);
  clickNext(ctx); // q10
  a.q11_uniform = ['野球']; clickNext(ctx); // -> q13 (候補1件のためq12自動スキップ)
  clickNext(ctx); // q13
  clickNext(ctx); // q13a
  clickNext(ctx); // q13b
  clickNext(ctx); // q14a
  clickNext(ctx); // q14b
  clickNext(ctx); // q15_intro
  a.q15_gate = '興味はない'; clickNext(ctx);
  clickNext(ctx); // 送信実行（q27でnextを押す）
}

test('GAS保存成功後にCookie/localStorageへ回答済み状態が保存され、survey_submitが発火し、完了画面が表示される', function (t, done) {
  var ctx = dom.loadSurvey();
  var events = [];
  ctx.setAnalyticsSpy(events);
  driveToSubmit(ctx);

  setTimeout(function () {
    try {
      assert.equal(ctx.S.nav.screens.complete.hidden, false, '完了画面が表示される');
      var cookie = ctx.document.cookie || '';
      assert.match(cookie, /ataru_survey_v1_answered=1/, 'Cookieが設定される');
      assert.match(cookie, /Path=\/ataru-nagoya\/survey\.html/, 'CookieのPathがsurvey.html相当に限定される');
      assert.doesNotMatch(cookie, /Path=\/;/, 'Path=/ ではない');
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Max-Age=31536000/);

      var ls = JSON.parse(ctx.window.localStorage.getItem('ataru_survey_v1'));
      assert.strictEqual(ls.answered, true);
      assert.strictEqual(ls.response_id, 'stub-server-response-id', 'サーバーが発行したresponse_idが保存される（クライアント生成分ではない）');

      var submitEvents = events.filter(function (e) { return e.name === 'survey_submit'; });
      assert.strictEqual(submitEvents.length, 1);
      assert.deepEqual(Object.keys(submitEvents[0].params).sort(), ['form_name']);
      done();
    } catch (e) { done(e); }
  }, 10);
});

test('GAS保存失敗時は完了画面・回答済み状態・survey_submitのいずれも発生させず、入力内容を保持したまま再送できる', function (t, done) {
  var ctx = dom.loadSurvey();
  var events = [];
  ctx.setAnalyticsSpy(events);
  ctx.setFetchImpl(function (url) {
    if (url === ctx.S.GAS_ENDPOINT) return Promise.resolve({ ok: false, json: function () { return Promise.resolve({}); } });
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
  });

  driveToSubmit(ctx);

  setTimeout(function () {
    try {
      assert.equal(ctx.S.nav.screens.complete.hidden, true, 'GAS失敗時は完了画面を表示しない');
      assert.equal(ctx.document.getElementById('submit-error').hidden, false, 'エラーメッセージを表示する');
      assert.strictEqual((ctx.document.cookie || '').indexOf('ataru_survey_v1_answered=1'), -1, 'Cookieを保存しない');
      assert.strictEqual(ctx.window.localStorage.getItem('ataru_survey_v1'), null, 'localStorageを保存しない');
      assert.strictEqual(events.filter(function (e) { return e.name === 'survey_submit'; }).length, 0);
      assert.strictEqual(events.filter(function (e) { return e.name === 'form_error'; }).length, 1);
      /* 入力内容が保持されている（answersがクリアされていない）ことを確認する */
      assert.strictEqual(ctx.S.engine.answers.q2_gender, '男性');
      assert.strictEqual(ctx.S.engine.answers.q7_sports[0], '野球・ソフトボール');
      /* 再送できる：ボタンが再度有効化されている */
      assert.strictEqual(ctx.document.getElementById('btn-next').disabled, false);
      done();
    } catch (e) { done(e); }
  }, 10);
});

test('GAS保存成功・FormSubmit失敗でも完了扱いになり、再回答を要求しない', function (t, done) {
  var ctx = dom.loadSurvey();
  ctx.setFetchImpl(function (url) {
    if (url === ctx.S.GAS_ENDPOINT) {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true, response_id: 'srv-id-1' }); } });
    }
    return Promise.reject(new Error('FormSubmit down'));
  });

  driveToSubmit(ctx);

  setTimeout(function () {
    try {
      assert.equal(ctx.S.nav.screens.complete.hidden, false, 'FormSubmit失敗でも完了画面を表示する');
      assert.match(ctx.document.cookie || '', /ataru_survey_v1_answered=1/);
      done();
    } catch (e) { done(e); }
  }, 10);
});

test('Cookieだけが残っていれば、再訪時に通常フォームを開始させず完了(回答済み)画面を表示する', function () {
  var ctx = dom.loadSurvey({ cookie: 'ataru_survey_v1_answered=1' });
  assert.equal(ctx.S.nav.screens.complete.hidden, false);
  assert.equal(ctx.S.nav.screens.intro.hidden, true);
  var heading = ctx.document.getElementById('complete-heading');
  assert.match(heading.textContent, /すでに回答済み/);
});

test('localStorageだけが残っていれば、再訪時に通常フォームを開始させず完了(回答済み)画面を表示する', function () {
  var ctx = dom.loadSurvey({
    localStorage: { ataru_survey_v1: JSON.stringify({ answered: true, response_id: 'prev-id', answered_at: '2026-01-01T00:00:00.000Z', survey_version: 'v1' }) }
  });
  assert.equal(ctx.S.nav.screens.complete.hidden, false);
  assert.equal(ctx.S.nav.screens.intro.hidden, true);
});

test('Cookie/localStorageのどちらも無ければ、通常通りintro画面から開始できる', function () {
  var ctx = dom.loadSurvey();
  assert.equal(ctx.S.nav.screens.intro.hidden, false);
  assert.equal(ctx.S.nav.screens.complete.hidden, true);
});

test('再訪時：localStorageに保存されたresponse_idが、リード送信時にGASへ引き継がれる', function (t, done) {
  var ctx = dom.loadSurvey({
    localStorage: { ataru_survey_v1: JSON.stringify({ answered: true, response_id: 'restored-response-id', answered_at: '2026-01-01T00:00:00.000Z', survey_version: 'v1' }) }
  });
  dom.fire(ctx.document.getElementById('btn-lead-toggle'), 'click');
  ctx.document.getElementById('lead-x').value = '@example_user';
  var reqInputs = ctx.document.querySelectorAll('input[name="lead-request"]');
  var wantRadio = reqInputs.filter(function (i) { return i.value === '開催案内'; })[0];
  assert.ok(wantRadio, '希望内容ラジオが見つかる');
  wantRadio.checked = true;
  dom.fire(ctx.document.getElementById('btn-lead-submit'), 'click');

  setTimeout(function () {
    try {
      var gasCall = ctx.fetchCalls.filter(function (c) { return c.url === ctx.S.GAS_ENDPOINT; })[0];
      assert.ok(gasCall, 'GASへのリード送信がある');
      var payload = JSON.parse(gasCall.opts.body);
      assert.strictEqual(payload.action, 'save_lead');
      assert.strictEqual(payload.response_id, 'restored-response-id');
      done();
    } catch (e) { done(e); }
  }, 10);
});
