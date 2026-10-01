/*
 * アンケート仮締め（Issue #119 PR A）のテスト。
 * 2026-10-05 00:00 JST を境にフロントを終了画面へ切り替える。GASは対象外。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var dom = require('./dom-stub');

var BEFORE = Date.parse('2026-10-04T23:59:59.999+09:00');
var AT = Date.parse('2026-10-05T00:00:00.000+09:00');
var AFTER = Date.parse('2026-10-05T09:00:00+09:00');

function screens(ctx) {
  var d = ctx.document;
  return {
    intro: !d.getElementById('screen-intro').hidden,
    survey: !d.getElementById('screen-survey').hidden,
    complete: !d.getElementById('screen-complete').hidden,
    closed: !d.getElementById('screen-closed').hidden
  };
}

test('A. 締切直前(2026-10-04T23:59:59.999+09:00)は open', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  assert.equal(ctx.S.closing.isSurveyClosed(BEFORE), false);
  assert.deepEqual(screens(ctx), { intro: true, survey: false, complete: false, closed: false });
});

test('B. 締切境界(2026-10-05T00:00:00.000+09:00)は closed', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  assert.equal(ctx.S.closing.isSurveyClosed(AT), true);
  assert.equal(ctx.S.closing.isSurveyClosed(AT - 1), false);
});

test('C. 締切後は closed', function () {
  var ctx = dom.loadSurvey({ now: AFTER });
  assert.equal(ctx.S.closing.isSurveyClosed(AFTER), true);
  assert.equal(ctx.S.closing.isSurveyClosed(AFTER + 365 * 86400000), true);
});

['UTC', 'America/Los_Angeles', 'Asia/Tokyo'].forEach(function (tz) {
  test('D/E. TZ=' + tz + ' でも判定が変わらない', function () {
    var script =
      "var dom=require('./test/dom-stub');" +
      "var c=dom.loadSurvey({now:" + BEFORE + "});" +
      "var f=c.S.closing.isSurveyClosed;" +
      "console.log(JSON.stringify([f(" + BEFORE + "),f(" + AT + "),f(" + AFTER + ")]));";
    var out = cp.execFileSync(process.execPath, ['-e', script], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, { TZ: tz })
    }).toString().trim();
    assert.equal(out, '[false,true,true]');
  });
});

test('F. 締切前から screen-survey 中のタブは締切後も継続・送信できる', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  dom.fire(ctx.document.getElementById('btn-start'), 'click');
  assert.equal(screens(ctx).survey, true);
  ctx.setNow(AFTER);
  ctx.S.closing.enforce();
  dom.fire(ctx.document, 'visibilitychange');
  assert.equal(screens(ctx).survey, true);
  assert.equal(screens(ctx).closed, false);
  /* 締切後でも次へ進める（入力途中タブは送信完了まで継続） */
  ctx.S.engine.answers.q1_age = '25〜29歳';
  dom.fire(ctx.document.getElementById('btn-next'), 'click');
  assert.equal(screens(ctx).closed, false);
  assert.equal(screens(ctx).survey, true);
});

test('F2. 継続権は永続保存されない（localStorage/cookie を使わない）', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  var keysBefore = JSON.stringify(Object.keys(ctx.window.localStorage));
  var cookieBefore = ctx.document.cookie;
  dom.fire(ctx.document.getElementById('btn-start'), 'click');
  ctx.setNow(AFTER);
  /* 再読み込み・再訪・新規タブ相当：締切後に新しくロードすれば終了画面 */
  var reloaded = dom.loadSurvey({ now: AFTER, cookie: ctx.document.cookie, localStorage: {} });
  assert.deepEqual(screens(reloaded), { intro: false, survey: false, complete: false, closed: true });
  assert.equal(JSON.stringify(Object.keys(ctx.window.localStorage)), keysBefore);
  assert.equal(ctx.document.cookie, cookieBefore);
});

test('G. 締切前から開いているが screen-survey 未到達のタブは締切後に終了画面', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  assert.equal(screens(ctx).intro, true);
  ctx.setNow(AFTER);
  ctx.S.closing.enforce();
  assert.deepEqual(screens(ctx), { intro: false, survey: false, complete: false, closed: true });
});

test('G2. 締切後に（未更新の）イントロから「はじめる」を押しても開始できず終了画面', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  ctx.setNow(AFTER);
  dom.fire(ctx.document.getElementById('btn-start'), 'click');
  assert.deepEqual(screens(ctx), { intro: false, survey: false, complete: false, closed: true });
});

test('H. 締切後の新規ロードは終了画面（フォーム非表示）', function () {
  var ctx = dom.loadSurvey({ now: AFTER });
  assert.deepEqual(screens(ctx), { intro: false, survey: false, complete: false, closed: true });
});

test('I. visibilitychange 復帰時に締切が再判定される', function () {
  var ctx = dom.loadSurvey({ now: BEFORE });
  assert.equal((ctx.document._listeners.visibilitychange || []).length, 1);
  ctx.setNow(AFTER);
  assert.equal(screens(ctx).intro, true, '再判定イベント前はまだイントロ');
  ctx.document.visibilityState = 'hidden';
  dom.fire(ctx.document, 'visibilitychange');
  assert.equal(screens(ctx).intro, true, 'hidden への遷移では切り替えない');
  ctx.document.visibilityState = 'visible';
  dom.fire(ctx.document, 'visibilitychange');
  assert.equal(screens(ctx).closed, true);
  assert.equal(screens(ctx).intro, false);
});

test('終了画面のCTAは既存GA4属性（cta_click / results_link / survey_closed）で survey-results.html へ', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'survey.html'), 'utf8');
  var m = html.match(/<section id="screen-closed"[\s\S]*?<\/section>/);
  assert.ok(m, 'screen-closed が存在する');
  assert.match(m[0], /href="survey-results\.html"/);
  assert.match(m[0], /data-ga-event="cta_click"/);
  assert.match(m[0], /data-ga-type="results_link"/);
  assert.match(m[0], /data-ga-location="survey_closed"/);
  assert.match(m[0], /回答受付は終了しました/);
});

test('締切日時は survey.js の1か所だけで管理され、HTMLに重複しない', function () {
  var root = path.join(__dirname, '..');
  var js = fs.readFileSync(path.join(root, 'survey.js'), 'utf8');
  var html = fs.readFileSync(path.join(root, 'survey.html'), 'utf8');
  assert.equal(js.split('2026-10-05T00:00:00+09:00').length - 1, 1);
  assert.equal(html.indexOf('2026-10-05'), -1);
});
