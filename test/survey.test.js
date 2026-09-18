/*
 * survey.js のロジックテスト（Issue #107）。
 * 依存追加なしで `node --test test/survey.test.js` として実行できるよう、
 * Node組み込みの node:test / node:assert と、test/dom-stub.js の最小限DOMスタブのみを使う。
 */
'use strict';

var test = require('node:test');
/* node:assert/strict の deepStrictEqual はプロトタイプ(realm)の一致まで見るため、
   vmコンテキスト側で生成された配列と、このテストファイル（外側realm）のリテラル配列を
   比較すると内容が同じでも常に失敗する。そのため、内容ベースで比較する非strict版を使う。 */
var assert = require('node:assert');
var dom = require('./dom-stub');
var fs = require('fs');
var path = require('path');

function clickStart(ctx) { dom.fire(ctx.document.getElementById('btn-start'), 'click'); }
function clickNext(ctx) { dom.fire(ctx.document.getElementById('btn-next'), 'click'); }
function clickBack(ctx) { dom.fire(ctx.document.getElementById('btn-back'), 'click'); }
function currentStep(ctx) {
  var st = ctx.S.engine.getState();
  return st.plannedSteps[st.currentIndex];
}
function planIds(ctx) {
  return ctx.S.engine.getState().plannedSteps.map(function (s) { return s.id; });
}
function assertCurrentIs(ctx, id) {
  var step = currentStep(ctx);
  assert.equal(step && step.id, id, 'current step should be ' + id + ' but was ' + (step && step.id));
}

/* q1〜q3, bondage_intro, q4〜q6-A まで進める共通ヘルパー。
   Q4〜Q6-Aは全ジェンダー共通設問なので、性自認による分岐が起きる直前まで使い回せる。 */
function driveToGenderBranch(ctx, opts) {
  opts = opts || {};
  var a = ctx.S.engine.answers;
  clickStart(ctx);
  assertCurrentIs(ctx, 'q1');
  a.q1_age = opts.age || '25〜29歳';
  clickNext(ctx);

  assertCurrentIs(ctx, 'q2');
  a.q2_gender = opts.gender || '男性';
  if (a.q2_gender === 'その他') a.q2_gender_other = 'テスト自由記述';
  clickNext(ctx);

  assertCurrentIs(ctx, 'q3');
  a.q3_region = '東京都';
  clickNext(ctx);

  assertCurrentIs(ctx, 'bondage_intro');
  clickNext(ctx);

  assertCurrentIs(ctx, 'q4');
  a.q4_interest = opts.q4 || '興味がある';
  clickNext(ctx);

  assertCurrentIs(ctx, 'q5');
  clickNext(ctx); // Q5は任意なので未回答のまま次へ

  assertCurrentIs(ctx, 'q6');
  clickNext(ctx); // Q6も任意

  assertCurrentIs(ctx, 'q6a');
  clickNext(ctx); // Q6-Aも任意
}

test('17歳以下はQ2以降へ進まず、underage画面が表示される', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  clickStart(ctx);
  assertCurrentIs(ctx, 'q1');
  a.q1_age = '17歳以下';
  clickNext(ctx);
  assert.equal(ctx.S.nav.screens.underage.hidden, false);
  assert.equal(ctx.S.nav.screens.survey.hidden, true);
});

test('女性・その他はQ6-A回答後にQ27へ進み、Q7〜Q26が一切表示されない', function () {
  ['女性', 'その他'].forEach(function (gender) {
    var ctx = dom.loadSurvey();
    driveToGenderBranch(ctx, { gender: gender });
    assertCurrentIs(ctx, 'female_other_end');
    clickNext(ctx);
    assertCurrentIs(ctx, 'q27');

    var ids = planIds(ctx);
    var maleOnlyIds = ['q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q13a', 'q13b', 'q14a', 'q14b',
      'q15_intro', 'q15', 'q16', 'q17', 'q18', 'q19', 'play_intro', 'q20a', 'q20b', 'q20c', 'q20d',
      'q21', 'q22', 'q23', 'q24', 'price_announce', 'q25', 'q26'];
    maleOnlyIds.forEach(function (id) {
      assert.equal(ids.indexOf(id), -1, gender + ' の回答計画に ' + id + ' が含まれてはいけない');
    });
  });
});

test('男性はQ6-Aの後、Q7（スポーツ経験）へ進む', function () {
  var ctx = dom.loadSurvey();
  driveToGenderBranch(ctx, { gender: '男性' });
  assertCurrentIs(ctx, 'q7');
});

test('Q15「興味はない」でQ16〜Q26をスキップしてQ27へ進む', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '男性' });

  a.q7_sports = ['野球・ソフトボール'];
  clickNext(ctx); // q7 -> q8
  a.q8_exercise = '定期的にスポーツをしている';
  clickNext(ctx); // q8 -> q9
  a.q9_gym = '週2〜3回';
  clickNext(ctx); // q9 -> q10
  clickNext(ctx); // q10(任意) -> q11
  a.q11_uniform = ['野球'];
  clickNext(ctx); // q11 -> q13 (候補1件なのでq12は自動スキップ)
  assertCurrentIs(ctx, 'q13');
  clickNext(ctx); // q13(任意)
  clickNext(ctx); // q13a(任意)
  clickNext(ctx); // q13b(任意)
  clickNext(ctx); // q14a(任意)
  clickNext(ctx); // q14b(任意)
  assertCurrentIs(ctx, 'q15_intro');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q15');
  a.q15_gate = '興味はない';
  clickNext(ctx);
  assertCurrentIs(ctx, 'q27');

  var ids = planIds(ctx);
  ['q16', 'q17', 'q18', 'q19', 'q20a', 'q20b', 'q20c', 'q20d', 'q21', 'q22', 'q23', 'q24', 'q25', 'q26'].forEach(function (id) {
    assert.equal(ids.indexOf(id), -1, '興味はない後は ' + id + ' が計画に含まれてはいけない');
  });
});

function driveMaleToGatePassed(ctx, q4value) {
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '男性', q4: q4value });
  a.q7_sports = ['野球・ソフトボール'];
  clickNext(ctx);
  a.q8_exercise = '定期的にスポーツをしている';
  clickNext(ctx);
  a.q9_gym = '週2〜3回';
  clickNext(ctx);
  clickNext(ctx); // q10
  a.q11_uniform = ['野球'];
  clickNext(ctx); // -> q13 (単一候補なのでq12自動セット)
  clickNext(ctx); // q13
  clickNext(ctx); // q13a
  clickNext(ctx); // q13b
  clickNext(ctx); // q14a
  clickNext(ctx); // q14b
  clickNext(ctx); // q15_intro
  assertCurrentIs(ctx, 'q15');
  a.q15_gate = 'はい';
  clickNext(ctx);
}

test('Q4低関心（あまり興味はない／苦手／よく分からない）ではQ18〜Q21のみスキップし、Q16/Q17は表示される', function () {
  ['あまり興味はない', '苦手', 'よく分からない'].forEach(function (q4value) {
    var ctx = dom.loadSurvey();
    var a = ctx.S.engine.answers;
    driveMaleToGatePassed(ctx, q4value);

    assertCurrentIs(ctx, 'q16');
    clickNext(ctx); // q16(任意)
    assertCurrentIs(ctx, 'q17');
    a.q17_experience = ['未経験'];
    clickNext(ctx);
    // Q4低関心なのでq18〜q21・play_introを飛ばしてq22へ
    assertCurrentIs(ctx, 'q22');

    var ids = planIds(ctx);
    ['q18', 'q19', 'play_intro', 'q20a', 'q20b', 'q20c', 'q20d', 'q21'].forEach(function (id) {
      assert.equal(ids.indexOf(id), -1, 'Q4=' + q4value + ' では ' + id + ' が計画に含まれてはいけない');
    });
  });
});

test('Q4が高関心ならQ18〜Q21（Q20はA〜D）が表示される', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveMaleToGatePassed(ctx, '興味がある');
  assertCurrentIs(ctx, 'q16');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q17');
  a.q17_experience = ['未経験'];
  clickNext(ctx);
  assertCurrentIs(ctx, 'q18');
  a.q18_combo = 'ぜひ体験したい';
  clickNext(ctx);
  assertCurrentIs(ctx, 'q19');
  clickNext(ctx);
  assertCurrentIs(ctx, 'play_intro');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q20a');
  assert.equal(currentStep(ctx).q20Group, 'A');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q20b');
  assert.equal(currentStep(ctx).q20Group, 'B');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q20c');
  assert.equal(currentStep(ctx).q20Group, 'C');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q20d');
  assert.equal(currentStep(ctx).q20Group, 'D');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q21');
});

test('Q11で選択した内容だけがQ12/Q13-A/Q13-Bの候補になる', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '男性' });
  a.q7_sports = ['野球・ソフトボール'];
  clickNext(ctx);
  a.q8_exercise = '定期的にスポーツをしている';
  clickNext(ctx);
  a.q9_gym = '週2〜3回';
  clickNext(ctx);
  clickNext(ctx); // q10
  a.q11_uniform = ['野球', 'サッカー'];
  clickNext(ctx);
  assertCurrentIs(ctx, 'q12'); // 候補2件なのでQ12が表示される
  var q12options = ctx.S.engine.stepOptions(currentStep(ctx));
  assert.deepEqual(q12options, ['野球', 'サッカー']);
  a.q12_favorite = '野球';
  clickNext(ctx);

  assertCurrentIs(ctx, 'q13');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q13a');
  var q13aOptions = ctx.S.engine.stepOptions(currentStep(ctx));
  assert.deepEqual(q13aOptions, ['野球', 'サッカー']);
});

test('Q6: 「縛る・縛られる両方」は「縛られる側」「縛る側」と同時選択できない', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '男性' }); // driveToGenderBranchはq6の前で止まらないので直接ステップ定義から描画する

  var step = ctx.S.STEPS.filter(function (s) { return s.id === 'q6'; })[0];
  var result = ctx.S.renderStep(step);
  var inputs = dom.collectInputs(result.el);

  dom.check(inputs, '縛られる側に興味がある');
  assert.deepEqual(a.q6_role, ['縛られる側に興味がある']);

  dom.check(inputs, '縛る・縛られる両方に興味がある');
  assert.deepEqual(a.q6_role, ['縛る・縛られる両方に興味がある']);

  dom.check(inputs, '縛る側に興味がある');
  // 「両方」を選んでいた状態から「縛る側」を選ぶと、両方は競合解除で外れる
  assert.deepEqual(a.q6_role.sort(), ['縛る側に興味がある'].sort());
});

test('Q6: 「まだ分からない」「回答しない」は他の選択肢と同時選択できない（既存exclusive機構）', function () {
  var ctx = dom.loadSurvey();
  var step = ctx.S.STEPS.filter(function (s) { return s.id === 'q6'; })[0];
  var result = ctx.S.renderStep(step);
  var inputs = dom.collectInputs(result.el);

  dom.check(inputs, '見るだけで楽しみたい');
  dom.check(inputs, 'まだ分からない');
  assert.deepEqual(ctx.S.engine.answers.q6_role, ['まだ分からない']);
});

test('Q20: 旧Q19の6グループではなく4グループ(A〜D)で、D「まだ分からない/回答しない」はA〜Cと同時選択できない', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  var stepA = ctx.S.STEPS.filter(function (s) { return s.id === 'q20a'; })[0];
  var stepD = ctx.S.STEPS.filter(function (s) { return s.id === 'q20d'; })[0];

  var resultA = ctx.S.renderStep(stepA);
  var inputsA = dom.collectInputs(resultA.el);
  dom.check(inputsA, 'ユニフォーム姿のまま格好よく縛られたい');
  assert.deepEqual(a.q20a, ['ユニフォーム姿のまま格好よく縛られたい']);

  var resultD = ctx.S.renderStep(stepD);
  var inputsD = dom.collectInputs(resultD.el);
  dom.check(inputsD, 'まだ分からない');
  // Dで排他値を選ぶと、A〜Dの他グループがクリアされる
  assert.deepEqual(a.q20a, []);
  assert.deepEqual(a.q20d, ['まだ分からない']);

  // 再度Aへ何か選ぶと、Dの排他値は外れる
  var resultA2 = ctx.S.renderStep(stepA);
  var inputsA2 = dom.collectInputs(resultA2.el);
  dom.check(inputsA2, '縛られている男性を見たい');
  assert.deepEqual(a.q20d, []);
});

test('Q20Cの性的項目とQ21「性的な接触なし」は矛盾として排除されない', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  var stepC = ctx.S.STEPS.filter(function (s) { return s.id === 'q20c'; })[0];
  var stepQ21 = ctx.S.STEPS.filter(function (s) { return s.id === 'q21'; })[0];

  var resultC = ctx.S.renderStep(stepC);
  dom.check(dom.collectInputs(resultC.el), 'SM的な責めを受けたい');

  var result21 = ctx.S.renderStep(stepQ21);
  dom.check(dom.collectInputs(result21.el), '性的な接触なし');

  assert.deepEqual(a.q20c, ['SM的な責めを受けたい']);
  assert.deepEqual(a.q21_conditions, ['性的な接触なし']);
  assert.equal(result21.validate(), true);
});

test('Q24回答前は3,000円企画が計画に含まれず、回答後に初めて表示される', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveMaleToGatePassed(ctx, '興味がある');
  clickNext(ctx); // q16
  a.q17_experience = ['未経験'];
  clickNext(ctx); // q17
  a.q18_combo = 'ぜひ体験したい';
  clickNext(ctx); // q18
  clickNext(ctx); // q19
  clickNext(ctx); // play_intro
  clickNext(ctx); // q20a
  clickNext(ctx); // q20b
  clickNext(ctx); // q20c
  clickNext(ctx); // q20d
  clickNext(ctx); // q21
  assertCurrentIs(ctx, 'q22');
  a.q22_visit = '日程が合えば';
  clickNext(ctx);
  assertCurrentIs(ctx, 'q23');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q24');
  assert.equal(planIds(ctx).indexOf('price_announce'), -1, 'Q24回答前はprice_announceが計画に含まれてはいけない');

  a.q24_price = '3,000円程度';
  clickNext(ctx);
  assertCurrentIs(ctx, 'price_announce');
  assert.notEqual(planIds(ctx).indexOf('price_announce'), -1, 'Q24回答後はprice_announceが計画に含まれる');
});

test('戻る操作で入力済みの値が保持される', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '男性', q4: 'とても好き' });
  a.q7_sports = ['野球・ソフトボール'];
  clickNext(ctx);
  assertCurrentIs(ctx, 'q8');

  clickBack(ctx);
  assertCurrentIs(ctx, 'q7');
  assert.deepEqual(a.q7_sports, ['野球・ソフトボール'], '戻ってもQ7の回答が保持されている');

  clickBack(ctx); // q6a
  clickBack(ctx); // q6
  clickBack(ctx); // q5
  clickBack(ctx); // q4
  assert.equal(a.q4_interest, 'とても好き', '戻ってもQ4の回答が保持されている');
});

test('「その他」を外すと自由記述がクリアされる', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  var step = ctx.S.STEPS.filter(function (s) { return s.id === 'q6a'; })[0];
  var result = ctx.S.renderStep(step);
  var inputs = dom.collectInputs(result.el);

  dom.check(inputs, 'その他');
  a.q6a_other = 'テスト自由記述';
  assert.equal(a.q6a_other, 'テスト自由記述');

  dom.uncheck(inputs, 'その他');
  assert.equal(a.q6a_other, '', '「その他」を外すと自由記述はクリアされる');
});

test('分岐で非表示になった設問の値はrecomputePlanでクリアされる', function () {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '男性' });
  a.q7_sports = ['野球・ソフトボール'];
  clickNext(ctx); // q7 -> q8。この時点でplannedStepsにq7が含まれた状態が記録される
  assertCurrentIs(ctx, 'q8');
  assert.deepEqual(a.q7_sports, ['野球・ソフトボール']);

  // 性自認を女性に変更してから戻る・進むを行うと、Q7は計画から外れ値がクリアされるはず
  a.q2_gender = '女性';
  clickBack(ctx); // recomputePlanが走り、q7が計画から消える
  var ids = planIds(ctx);
  assert.equal(ids.indexOf('q7'), -1, '性自認変更後はq7が計画に含まれない');
  assert.deepEqual(a.q7_sports, [], '非表示になったQ7の値はクリアされる');
});

test('computeScore() / rankFromScore() は新保存キーのみで動作する（男性のみスコアを算出）', function () {
  var ctx = dom.loadSurvey();
  var answers = ctx.S.engine.defaultAnswers();
  answers.q2_gender = '男性';
  answers.q1_age = '25〜29歳';
  answers.q8_exercise = '定期的にスポーツをしている';
  answers.q9_gym = '週4回以上';
  answers.q14a_self = ['筋肉質だと思う', '自分が短髪・ベリーショート', '体育会系の雰囲気だと言われる'];
  answers.q14b_pref = ['短髪の男性を見たい'];
  answers.q15_gate = 'はい';
  answers.q12_favorite = '野球';
  answers.q4_interest = 'とても好き';
  answers.q6_role = ['縛られる側に興味がある'];
  answers.q22_visit = '日程が合えば';
  answers.q25_intent = '日程が合えば参加したい';

  var score = ctx.S.scoring.computeScore(answers);
  // 2(若年)+2(運動)+3(ジム週4)+2(筋肉質)+1(短髪)+1(相手短髪好み)+2(ゲートはい)
  // +1(体育会系)+3(野球favorite)+3(緊縛高関心)+2(立場)+3(来訪)+3(参加意向) = 28
  assert.equal(score, 28);
  assert.equal(ctx.S.scoring.rankFromScore(score), '最優先');

  var lowScore = ctx.S.scoring.computeScore(Object.assign(ctx.S.engine.defaultAnswers(), { q2_gender: '男性' }));
  assert.equal(lowScore, 0);
  assert.equal(ctx.S.scoring.rankFromScore(lowScore), '一般回答');
});

/* PR #108レビュー指摘: Q4/Q6が全ジェンダー共通設問になったことで、女性・その他の回答にも
   Q4/Q6由来の加点だけが乗ってしまい、「男性ユニ見込み層」という本来の意味を持たない
   スコア・ランクが生成される副作用があった。女性・その他にはスコア自体を算出しないことで防ぐ。 */
test('女性・その他にはcomputeScore()/rankFromScore()がスコア・ランクを生成しない（内部判定の副作用防止）', function () {
  ['女性', 'その他'].forEach(function (gender) {
    var ctx = dom.loadSurvey();
    var answers = ctx.S.engine.defaultAnswers();
    // レビューコメントで指摘された再現条件そのもの：
    // 25〜29歳(+2) + 緊縛に興味がある(+3) + 縛られる側に興味がある(+2) = 男性なら7点になってしまう入力
    answers.q2_gender = gender;
    answers.q1_age = '25〜29歳';
    answers.q4_interest = '興味がある';
    answers.q6_role = ['縛られる側に興味がある'];

    var score = ctx.S.scoring.computeScore(answers);
    assert.equal(score, null, gender + 'の回答にはスコアを算出しない');
    assert.equal(ctx.S.scoring.rankFromScore(score), null, gender + 'の回答にはランクを算出しない');

    // 連絡先送信時の+3点加点（safeComputeScore経由）でも同様にnullのまま
    var baseScore = ctx.S.scoring.safeComputeScore(answers);
    var finalScore = baseScore === null ? null : baseScore + 3;
    assert.equal(finalScore, null, '連絡先送信の加点後も' + gender + 'にはスコアが生成されない（誤って「育成候補」等にならない）');
  });
});

test('女性・その他としてアンケートを送信すると、GASへの保存POSTのみが行われ、メール通知は送信されない', function (t, done) {
  var ctx = dom.loadSurvey();
  var a = ctx.S.engine.answers;
  driveToGenderBranch(ctx, { gender: '女性', q4: '興味がある' });
  // Q6（立場）はdriveToGenderBranch内では未回答のまま次へ進んでいるので、ここで明示的に選ぶ
  a.q6_role = ['縛られる側に興味がある'];

  assertCurrentIs(ctx, 'female_other_end');
  clickNext(ctx);
  assertCurrentIs(ctx, 'q27');
  clickNext(ctx); // 送信実行

  setTimeout(function () {
    try {
      /* アンケート回答の送信はGASへの保存POSTのみで完結し、回答内容をメール通知する
         処理（旧FormSubmit連携）は行わない。 */
      assert.equal(ctx.fetchCalls.length, 1, 'GASへの保存POST以外は送信されない');
      assert.equal(ctx.fetchCalls[0].url, ctx.S.GAS_ENDPOINT, '唯一のPOST先はGAS保存エンドポイント');
      done();
    } catch (e) {
      done(e);
    }
  }, 10);
});

/* computeScore()は全フィールドを `|| []` 等で防御しているため、通常の入力では
   例外が起きない（これ自体が正しい実装）。「それでも万一例外が起きた場合にnullを
   返す」というsafeComputeScore/safeRankFromScoreの安全網をテストするため、特定
   フィールドへのアクセス自体が例外を投げるgetterを注入してcomputeScore内部だけを
   ピンポイントで故障させる。Array.prototype.indexOfを丸ごと壊すと、
   recomputePlan()（ナビゲーション自体）まで巻き込んで壊れてしまうため使わない。 */
function injectThrowingField(answers, field) {
  Object.defineProperty(answers, field, {
    configurable: true,
    get: function () { throw new Error('boom: ' + field + ' accessor failed'); }
  });
}

test('スコア計算で例外が発生してもsafeComputeScore/safeRankFromScoreはnullを返す', function () {
  var ctx = dom.loadSurvey();
  var answers = ctx.S.engine.defaultAnswers();
  answers.q2_gender = '男性'; // 性自認ガード(男性以外はnull即返し)より先に、例外パス自体を確実に通す
  injectThrowingField(answers, 'q14a_self');

  var score = ctx.S.scoring.safeComputeScore(answers);
  assert.equal(score, null, '例外時はnullを返す');
  var rank = ctx.S.scoring.safeRankFromScore(score);
  assert.equal(rank, null);

  // 素のcomputeScore()は例外をそのまま投げる（safe版でだけ吸収する設計）ことも確認する
  assert.throws(function () { ctx.S.scoring.computeScore(answers); });
});

test('GA4へ送るtrackイベントのparamsには回答内容が含まれない（form_name/error_typeのみ）', function () {
  var ctx = dom.loadSurvey();
  var calls = [];
  ctx.setAnalyticsSpy(calls);
  var a = ctx.S.engine.answers;

  driveToGenderBranch(ctx, { gender: '男性', q4: 'とても好き' });
  a.q7_sports = ['野球・ソフトボール'];
  clickNext(ctx);

  // バリデーションエラーも発生させてform_errorのparamsを確認する
  clickNext(ctx); // q8は必須。未回答のまま次へ進もうとしてエラーになるはず

  var allowedKeys = ['form_name', 'error_type'];
  assert.ok(calls.length > 0, '何らかのイベントが発火している');
  calls.forEach(function (c) {
    Object.keys(c.params).forEach(function (k) {
      assert.ok(allowedKeys.indexOf(k) !== -1, 'GA4パラメータに回答内容らしきキー「' + k + '」が含まれている（イベント: ' + c.name + '）');
    });
  });
});

/* ファイル冒頭の旧→新保存キー対応表コメント（Issueが要求している開発ドキュメント）には
   意図的に旧番号・旧フィールド名を残しているため、コメントを除いた「実コード」部分だけを
   対象に旧ロジック・旧保存キーが残っていないか検査する。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('survey.js の実コードに旧Q19（6グループ）前提のロジック・表示が残っていない', function () {
  var code = stripComments(fs.readFileSync(path.join(__dirname, '..', 'survey.js'), 'utf8'));
  ['Q19_GROUP_FIELDS', 'q19group', 'Q19（', '6グループ'].forEach(function (needle) {
    assert.equal(code.indexOf(needle), -1, 'survey.js の実コードに旧Q19前提の文字列が残っている: ' + needle);
  });
});

test('survey.js の実コードに旧PR#105の保存キー名が残っていない', function () {
  var code = stripComments(fs.readFileSync(path.join(__dirname, '..', 'survey.js'), 'utf8'));
  var oldKeys = ['q9_favorite', 'q12_gate', 'q15_level', 'q11a_self', 'q11b_pref', 'q16_role', 'q21_visit', 'q24_intent', 'q10_wear_self', 'q10_wear_others'];
  oldKeys.forEach(function (key) {
    var re = new RegExp('\\b' + key + '\\b');
    assert.equal(re.test(code), false, 'survey.js の実コードに旧保存キー ' + key + ' の参照が残っている（対応表コメント欄を除き禁止）');
  });
});
