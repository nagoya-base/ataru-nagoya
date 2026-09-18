/*
 * targetCount / crossTargetCount / 単純集計を、survey-schema.json の
 * conditions・questions定義だけから機械的に計算する共通実装。
 * 管理者GAS（Code.gs）はこのロジックを個別に手書きせず、
 * scripts/sync-survey-schema.js が生成する SurveySchema.gs 経由でこの実装を使う。
 */
'use strict';

var conditionEval = require('./condition-eval');

function isExcluded(row) {
  return row.excluded === true || row.excluded === 'true' || row.excluded === 'TRUE';
}

/* excluded=true の行を除いた「有効回答」だけを返す。 */
function effectiveRows(rows) {
  return rows.filter(function (r) { return !isExcluded(r); });
}

/* 1設問の保存値を、single/multi・delimiter区切り文字列/配列のいずれでも
   常に「選択された値の配列（重複なし）」として取り出す。 */
function valuesOf(row, field, delimiter) {
  var raw = row[field];
  if (raw === undefined || raw === null || raw === '') return [];
  var arr = Array.isArray(raw) ? raw.slice() : String(raw).split(delimiter || '|');
  var seen = {};
  var out = [];
  arr.forEach(function (v) {
    var val = String(v).trim();
    if (!val || seen[val]) return;
    seen[val] = true;
    out.push(val);
  });
  return out;
}

/* その設問が定義されている表示条件・targetCount条件を満たす有効回答者数。
   schemaの`questions[].targetCountCondition`を評価するだけで、
   分母ロジックを呼び出し側（管理GAS等）へ個別に手書きさせない。 */
function countTarget(rows, conditions, conditionId) {
  var eff = effectiveRows(rows);
  return eff.filter(function (r) { return conditionEval.evaluateCondition(conditions, conditionId, r); }).length;
}

/* 2つの設問それぞれのtargetCountConditionの交差集合（両方に到達した有効回答者数）。
   クロス集計の分母を全有効回答数にせず、両軸の到達条件の交差集合にするための実装。 */
function crossTargetCount(rows, conditions, conditionIdA, conditionIdB) {
  var eff = effectiveRows(rows);
  return eff.filter(function (r) { return conditionEval.evaluateIntersection(conditions, conditionIdA, conditionIdB, r); }).length;
}

/* 単純集計：targetCountConditionを満たす有効回答者の中で、
   各選択肢を選んだ人数を数える（複数選択でも同一回答者・同一選択肢の二重カウントはしない）。 */
function tallySingleQuestion(rows, conditions, question, delimiter) {
  var eff = effectiveRows(rows).filter(function (r) {
    return conditionEval.evaluateCondition(conditions, question.targetCountCondition, r);
  });
  var counts = {};
  eff.forEach(function (r) {
    valuesOf(r, question.storageField, delimiter).forEach(function (v) {
      counts[v] = (counts[v] || 0) + 1;
    });
  });
  return { targetCount: eff.length, counts: counts };
}

/* 2設問のクロス集計。分母(crossTargetCount)は両軸のtargetCountConditionの交差集合。
   複数選択同士でも、同一回答者が同じ(a,b)組合せを複数回持つことはない
   （valuesOfで回答者内の重複を除去した上でユニークな組合せだけを数える）。 */
function crossTab(rows, conditions, questionA, questionB, delimiter) {
  var eff = effectiveRows(rows).filter(function (r) {
    return conditionEval.evaluateIntersection(conditions, questionA.targetCountCondition, questionB.targetCountCondition, r);
  });
  var cells = {};
  eff.forEach(function (r) {
    var as = valuesOf(r, questionA.storageField, delimiter);
    var bs = valuesOf(r, questionB.storageField, delimiter);
    var seenPairs = {};
    as.forEach(function (a) {
      bs.forEach(function (b) {
        var key = a + '' + b;
        if (seenPairs[key]) return;
        seenPairs[key] = true;
        if (!cells[a]) cells[a] = {};
        cells[a][b] = (cells[a][b] || 0) + 1;
      });
    });
  });
  return { crossTargetCount: eff.length, cells: cells };
}

module.exports = {
  isExcluded: isExcluded,
  effectiveRows: effectiveRows,
  valuesOf: valuesOf,
  countTarget: countTarget,
  crossTargetCount: crossTargetCount,
  tallySingleQuestion: tallySingleQuestion,
  crossTab: crossTab
};
