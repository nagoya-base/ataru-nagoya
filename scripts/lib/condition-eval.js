/*
 * survey-schema.json の `conditions` を評価する唯一の実装。
 * Node（テスト・sync script）と GAS（scripts/sync-survey-schema.js が
 * このファイルの内容を埋め込んで生成する）の両方から同じロジックで使う。
 * ここを直接編集し、生成物（generated/*, gas/ataru_survey_admin/SurveySchema.gs）は
 * `node scripts/sync-survey-schema.js` で再生成すること。
 */
'use strict';

function evalNode(node, row, conditions) {
  switch (node.op) {
    case 'true':
      return true;
    case 'eq':
      return row[node.field] === node.value;
    case 'in':
      return (node.values || []).indexOf(row[node.field]) !== -1;
    case 'not_in':
      return (node.values || []).indexOf(row[node.field]) === -1;
    case 'and':
      return (node.args || []).every(function (n) { return evalNode(n, row, conditions); });
    case 'or':
      return (node.args || []).some(function (n) { return evalNode(n, row, conditions); });
    case 'not':
      return !evalNode(node.arg, row, conditions);
    case 'ref':
      return evaluateCondition(conditions, node.id, row);
    default:
      throw new Error('unknown condition op: ' + node.op);
  }
}

/* conditions: survey-schema.json の `conditions` オブジェクト。
   conditionId: 評価したい条件ID（例: "male_gate_passed"）。
   row: 1回答分のオブジェクト（保存列名をキーとする）。 */
function evaluateCondition(conditions, conditionId, row) {
  var node = conditions[conditionId];
  if (!node) throw new Error('unknown condition id: ' + conditionId);
  return evalNode(node, row, conditions);
}

/* 2つの条件IDの交差（AND）をその場で評価する。crossTargetCount用。
   named conditionとして事前定義しなくても、任意の2条件の交差集合を
   schemaの条件定義だけから機械的に評価できるようにするためのヘルパー。 */
function evaluateIntersection(conditions, conditionIdA, conditionIdB, row) {
  return evaluateCondition(conditions, conditionIdA, row) && evaluateCondition(conditions, conditionIdB, row);
}

module.exports = {
  evaluateCondition: evaluateCondition,
  evaluateIntersection: evaluateIntersection
};
