/*
 * 公開集計API（Issue #104）の5人未満マスキング・補完的抑制・100件ゲート・
 * Q1/Q3公開表示バケット化・Q20 A〜D独立サブブロック判定の検証。
 */
'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var pub = require('../scripts/lib/public-aggregate');

var schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'survey-schema.json'), 'utf8'));

function mkRow(over) {
  var base = {
    excluded: false,
    q1_age: '25〜29歳', q2_gender: '男性', q3_region: '東京都', q4_interest: '興味がある',
    q15_gate: 'はい', q11_uniform: '野球', q22_visit: '日程が合えば'
  };
  Object.keys(over || {}).forEach(function (k) { base[k] = over[k]; });
  return base;
}

function rowsOf(n, over) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(mkRow(over));
  return out;
}

/* ── maskSingleSelect ── */

test('5人未満のセルは正確な件数・割合を公開しない（4人はマスク、5人は公開）', function () {
  var r = pub.maskSingleSelect(['A', 'B'], { A: 4, B: 96 }, 100);
  assert.deepStrictEqual(r.options.map(function (o) { return o.value; }), []);
  var r5 = pub.maskSingleSelect(['A', 'B', 'C'], { A: 5, B: 90, C: 5 }, 100);
  var values = r5.options.map(function (o) { return o.value; });
  assert.ok(values.indexOf('A') !== -1 && values.indexOf('B') !== -1 && values.indexOf('C') !== -1);
});

test('単一選択で非公開セルが1つだけだと、残差から正確な人数が復元できるため、次に小さい公開セルも追加で抑制する', function () {
  /* A=4(非公開) B=10 C=86, target=100。Bだけ抑制すればAの4人が残差(4)として一意に復元できる。 */
  var r = pub.maskSingleSelect(['A', 'B', 'C'], { A: 4, B: 10, C: 86 }, 100);
  var values = r.options.map(function (o) { return o.value; });
  assert.strictEqual(values.length, 1, 'Bも追加で抑制され、公開セルはCのみになる');
  assert.strictEqual(values[0], 'C');
  assert.ok(r.otherSmall, 'その他少数バケットがある');
  assert.strictEqual(r.otherSmall.count, 14, 'A(4)+B(10)の合計');
});

test('補完的抑制の追加対象はschemaの選択肢順で決定的に選ばれる（同数タイはschema順で先勝ち）', function () {
  var r1 = pub.maskSingleSelect(['A', 'B', 'C', 'D'], { A: 3, B: 6, C: 6, D: 20 }, 35);
  var r2 = pub.maskSingleSelect(['A', 'B', 'C', 'D'], { A: 3, B: 6, C: 6, D: 20 }, 35);
  assert.deepStrictEqual(r1, r2, '同じ入力に対して常に同じ結果になる（決定的）');
  var values = r1.options.map(function (o) { return o.value; });
  assert.ok(values.indexOf('B') === -1 && values.indexOf('C') !== -1, 'schema順で先に現れるBが追加抑制される');
});

test('それでも公開セルが残らない場合は設問ブロック全体を非公開にする', function () {
  var r = pub.maskSingleSelect(['Yes', 'No'], { Yes: 96, No: 4 }, 100);
  /* 2カテゴリで一方が4人のみ：残る片方(96)も巻き込んで合算されるため個々の値は開示されない */
  assert.strictEqual(r.hidden, false);
  assert.deepStrictEqual(r.options, []);
  assert.strictEqual(r.otherSmall.count, 100);
});

/* PR #110レビュー対応: 「その他少数」自体が5人未満のまま公開されてはいけない */
test('複数の非公開セルを合算しても5人未満のままなら、その合算値（その他少数）自体を公開せず、追加で公開セルを巻き込んで5人以上にする', function () {
  var r = pub.maskSingleSelect(['A', 'B', 'C'], { A: 1, B: 1, C: 98 }, 100);
  /* A(1)+B(1)=2人（5人未満）のまま「その他少数」として公開してはいけない。
     Cを追加で巻き込んで合算が5人以上になるまで抑制を続ける。 */
  assert.strictEqual(r.hidden, false);
  assert.deepStrictEqual(r.options, [], 'Cも追加で抑制されるため、個別に公開される選択肢は残らない');
  assert.strictEqual(r.otherSmall.count, 100);
  assert.ok(r.otherSmall.count >= 5, 'その他少数として公開する値は必ず5以上');
});

test('複数の非公開セル（0件のバケットを含む）を合算しても5人未満なら、公開可能な選択肢を1つだけ追加で巻き込む（最小限の犠牲）', function () {
  /* A=1,B=1,C=1(すべて非公開・合算3人)、D=5(公開可)、E=91(公開可)。
     合算(3)が5未満の間だけ、最小のD(5)を1つ追加すれば5+3=8で5人以上に達するため、
     Eまでは巻き込まない（必要最小限の追加抑制であることを確認する）。 */
  var r = pub.maskSingleSelect(['A', 'B', 'C', 'D', 'E'], { A: 1, B: 1, C: 1, D: 5, E: 91 }, 99);
  var values = r.options.map(function (o) { return o.value; });
  assert.deepStrictEqual(values, ['E'], 'Dだけ追加で抑制され、Eは公開されたまま残る');
  assert.strictEqual(r.otherSmall.count, 8, 'A(1)+B(1)+C(1)+D(5)');
});

test('すべての選択肢を合算しても5人未満なら（全体が極端な低N）、設問ブロック全体を非公開にする', function () {
  var r = pub.maskSingleSelect(['A', 'B', 'C'], { A: 1, B: 1, C: 1 }, 3);
  assert.strictEqual(r.hidden, true, '合算しても3人しかおらず、公開できる値が1つも作れない');
});

test('決定的：A=1,B=1,C=98の同じ入力に対し、maskSingleSelectは常に同じ結果を返す', function () {
  var r1 = pub.maskSingleSelect(['A', 'B', 'C'], { A: 1, B: 1, C: 98 }, 100);
  var r2 = pub.maskSingleSelect(['A', 'B', 'C'], { A: 1, B: 1, C: 98 }, 100);
  assert.deepStrictEqual(r1, r2);
});

test('追加で抑制する公開セルが1つも存在しない場合は設問ブロック全体を完全非公開(hidden)にする', function () {
  /* 選択肢が1つしかなく、かつ5人未満：抑制対象を merge する相手の公開セルが存在しないため、
     残差復元を防ぐ手段がなく設問ブロック全体を非公開にする。 */
  var r = pub.maskSingleSelect(['OnlyOption'], { OnlyOption: 3 }, 3);
  assert.strictEqual(r.hidden, true);
});

/* ── maskMultiSelect ── */

test('複数選択はtargetCountとの残差から少数セルを逆算するロジックを使わない（otherSmallを持たない）', function () {
  var r = pub.maskMultiSelect(['a', 'b', 'c', 'd'], { a: 10, b: 2, c: 0, d: 6 }, 40);
  assert.strictEqual(r.otherSmall, undefined);
  assert.deepStrictEqual(r.options.map(function (o) { return o.value; }), ['a', 'd']);
  assert.strictEqual(r.omittedOptionCount, 2);
});

/* ── applyHalfRule ── */

test('公開可能な選択肢が定義済み選択肢数の半数以下なら設問ブロック全体を非公開にする（ちょうど半数も非公開）', function () {
  var masked = pub.maskMultiSelect(['a', 'b', 'c', 'd'], { a: 10, b: 2, c: 0, d: 6 }, 40); // 2/4 = ちょうど半数
  var result = pub.applyHalfRule(masked, 4);
  assert.strictEqual(result.hidden, true);
});

test('公開可能な選択肢が半数を超えていれば非公開にしない', function () {
  var masked = pub.maskMultiSelect(['a', 'b', 'c', 'd', 'e'], { a: 10, b: 8, c: 6, d: 2, e: 0 }, 40); // 3/5
  var result = pub.applyHalfRule(masked, 5);
  assert.strictEqual(result.hidden, false);
});

/* ── buildPublicResult: 100件ゲート ── */

test('有効回答数が100件では詳細結果を公開しない（detailキー自体が存在しない）', function () {
  var rows = rowsOf(100);
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(result.gateOpen, false);
  assert.strictEqual('detail' in result, false, '100件ちょうどではdetailキー自体が存在しない');
  assert.strictEqual(JSON.stringify(result).indexOf('Q5'), -1, 'Q5相当のキーがレスポンス文字列に一切含まれない');
});

test('有効回答数が101件になった瞬間からdetailキーが解放される', function () {
  var rows = rowsOf(101);
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(result.gateOpen, true);
  assert.ok('detail' in result);
  assert.ok(result.detail.Q5, 'Q5が詳細公開対象に含まれる');
});

test('100件以下のレスポンスにQ24〜Q26（admin_only）相当のキーが一切存在しない', function () {
  var rows = rowsOf(50);
  var result = pub.buildPublicResult(rows, schema);
  var json = JSON.stringify(result);
  ['Q24', 'Q25', 'Q26'].forEach(function (id) { assert.strictEqual(json.indexOf(id), -1, id); });
});

test('101件以上でもQ24〜Q26（admin_only）は公開レスポンスに一切含まれない', function () {
  var rows = rowsOf(150);
  var result = pub.buildPublicResult(rows, schema);
  var json = JSON.stringify(result);
  ['Q24', 'Q25', 'Q26'].forEach(function (id) { assert.strictEqual(json.indexOf(id), -1, id); });
});

test('excluded=trueの行は有効回答数・公開集計から除外される', function () {
  var rows = rowsOf(100).concat(rowsOf(5, { excluded: true }));
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(result.effectiveCount, 100);
  assert.strictEqual(result.gateOpen, false);
});

/* ── Q1/Q3の公開表示バケット化 ── */

test('Q1は50〜59歳・60歳以上を「50歳以上」へ統合して公開する', function () {
  /* 他の年代バケットにも十分な人数（>=5）を割り当て、0件バケットの追加抑制に
     巻き込まれず「50歳以上」バケットがそのまま公開されることを検証する。 */
  var rows = rowsOf(60, { q1_age: '50〜59歳' })
    .concat(rowsOf(50, { q1_age: '60歳以上' }))
    .concat(rowsOf(10, { q1_age: '18〜24歳' }))
    .concat(rowsOf(10, { q1_age: '25〜29歳' }))
    .concat(rowsOf(10, { q1_age: '30〜34歳' }))
    .concat(rowsOf(10, { q1_age: '35〜39歳' }))
    .concat(rowsOf(10, { q1_age: '40〜49歳' }))
    .concat(rowsOf(10, { q1_age: '回答しない' }));
  var result = pub.buildPublicResult(rows, schema);
  var values = result.overview.Q1.options.map(function (o) { return o.value; });
  assert.ok(values.indexOf('50歳以上') !== -1);
  assert.ok(values.indexOf('50〜59歳') === -1 && values.indexOf('60歳以上') === -1);
  var bucket = result.overview.Q1.options.filter(function (o) { return o.value === '50歳以上'; })[0];
  assert.strictEqual(bucket.count, 110);
});

test('Q3は大分類（東海/関東/関西/その他国内/海外）へ丸めて公開し、自由記述地域名は含まれない', function () {
  /* 5バケットすべてに十分な人数（>=5）を割り当てることで、少人数マスキング（複数の
     0件バケットをまとめるための追加抑制）に巻き込まれず、バケット化そのものを検証する。 */
  var rows = rowsOf(60, { q3_region: '愛知県・名古屋市' })
    .concat(rowsOf(50, { q3_region: '東京都', q3_region_other: '秘密の地名' }))
    .concat(rowsOf(10, { q3_region: '関西' }))
    .concat(rowsOf(10, { q3_region: '北海道' }))
    .concat(rowsOf(10, { q3_region: '海外' }));
  var result = pub.buildPublicResult(rows, schema);
  var values = result.overview.Q3.options.map(function (o) { return o.value; });
  assert.ok(values.indexOf('東海') !== -1);
  assert.ok(values.indexOf('関東') !== -1);
  assert.ok(values.indexOf('関西') !== -1);
  assert.ok(values.indexOf('その他国内') !== -1);
  assert.ok(values.indexOf('海外') !== -1);
  assert.strictEqual(result.overview.Q3.otherSmall, null, '全バケットが5人以上なのでその他少数は発生しない');
  assert.strictEqual(JSON.stringify(result).indexOf('秘密の地名'), -1);
});

/* ── 許可リスト方式 ── */

test('公開レスポンスに response_id・自由記述本文・leads関連キーが一切含まれない', function () {
  var rows = rowsOf(150, { response_id: 'SECRET-ID', q4_other: '秘密のその他自由記述', q27_message: '内緒のメッセージ' });
  var result = pub.buildPublicResult(rows, schema);
  var json = JSON.stringify(result);
  assert.strictEqual(json.indexOf('SECRET-ID'), -1);
  assert.strictEqual(json.indexOf('秘密のその他自由記述'), -1);
  assert.strictEqual(json.indexOf('内緒のメッセージ'), -1);
  assert.strictEqual(json.indexOf('lead'), -1);
});

/* ── Q20 A〜Dの独立サブブロック判定 ── */

test('Q20はA〜Dが独立したサブブロックとして低N判定される（Aだけ十分な人数、B〜Dは非公開になり得る）', function () {
  /* Q20Aは7選択肢中4つに30人ずつ割り当てる（4/7は半数超なので非公開にならない）。
     Q20Bは1選択肢に3人だけ（5人未満マスキング後、公開可能選択肢0/2で非公開になる）。 */
  var q20aOptions = [
    'ユニフォーム姿のまま格好よく縛られたい', '写真作品として格好よく撮られたい',
    '縄とユニフォームの組合せを作品として残したい', 'ユニフォーム姿の男性を美しく縛りたい'
  ];
  var rows = [];
  for (var i = 0; i < 150; i++) {
    rows.push(mkRow({
      q15_gate: 'はい',
      q20a: i < 120 ? q20aOptions[Math.floor(i / 30)] : '',
      q20b: i < 3 ? '吊られる感覚を体験したい' : ''
    }));
  }
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(result.detail.Q20A.hidden, false, 'Q20Aは十分な人数がいるため公開される');
  assert.strictEqual(result.detail.Q20A.options.length, 4);
  assert.strictEqual(result.detail.Q20B.hidden, true, 'Q20Bは少人数のため非公開になる');
});

/* ── targetCount ── */

test('詳細ブロックにはtargetCount（到達対象者数）が含まれる', function () {
  var rows = rowsOf(150);
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(typeof result.detail.Q7.targetCount, 'number');
});

test('101件以上のdetailブロックにはAPI側で組み立てたlabel（Q20はsubLabel込み）が含まれ、survey-results.js側で別途ラベルを持つ必要がない', function () {
  var rows = rowsOf(150);
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(result.detail.Q7.label, '現在または過去に経験したスポーツ');
  assert.strictEqual(result.detail.Q20C.label, '男性向け企画で関心のある詳細内容（C. SM・性的な責め）');
});

test('低N（大部分が5人未満マスキング）の場合、overviewLowNフラグが立つ', function () {
  var rows = rowsOf(2, { q1_age: '25〜29歳', q3_region: '東京都', q4_interest: '興味がある' })
    .concat(rowsOf(1, { q1_age: '30〜34歳', q3_region: '関西', q4_interest: '苦手' }));
  var result = pub.buildPublicResult(rows, schema);
  assert.strictEqual(result.overviewLowN, true);
});
