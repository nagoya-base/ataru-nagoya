/*
 * 回答保存GAS（Issue #104）が、クライアントから届いた回答オブジェクトを
 * survey-schema.json の displayCondition だけを根拠に再検証し、保存用の行データへ
 * 正規化する共通実装。
 *
 * 目的（Issue #104 追加指示3「保存時はクライアント値を信用しすぎない」）：
 * クライアントの表示制御をバイパスして非到達設問の値を送ってきた場合でも、
 * GAS側でも同じ表示条件（displayCondition）をschemaから再評価し、非到達設問の値は
 * 保存前に破棄する。性自認分岐・Q15分岐・Q4低関心分岐を個別に手書きしない
 * （schemaのconditionsを評価するだけで、あらゆる分岐に同じロジックで対応する）。
 *
 * 公開Web Appは匿名で誰でもPOSTできるため、ブラウザUIのバリデーションだけに依存しない。
 * 以下はすべてschema定義から機械的に再検証し、フロントで成立しない回答状態を保存しない
 * （PR #110レビュー対応）。
 *  - 到達した設問のうち required:true の設問が未回答
 *  - 「その他」等のトリガー選択肢を選んだのに対応する自由記述（freeTextFields）が空
 *  - exclusiveOptions（例: Q5の「回答しない」）を、他の通常選択肢と同時選択している
 *  - conflictPairs（例: Q6の「両方」と「縛られる側」）を同時選択している
 *  - q20CrossExclusive（Q20Dの「まだ分からない」「回答しない」とQ20A〜Cの他の選択肢の
 *    同時選択）に違反している
 *
 * Node（テスト・sync script）とGAS（scripts/sync-survey-schema.js が埋め込んで生成する
 * gas/ataru_survey_public/ResponseNormalize.gs）の両方から同じロジックで使う。
 */
'use strict';

var conditionEval = require('./condition-eval');

function clampText(v, maxLen) {
  if (v === undefined || v === null) return '';
  var s = String(v).trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/* survey.js の q11DerivedOptions() と同じ導出ロジック。Q12/Q13-A/Q13-B
   （optionsSource: "dynamic:Q11"）の選択肢は、回答者が実際にQ11で選んだ値
   （「その他」は自由記述込みの表示ラベル）から動的に決まる。ここをGAS側でも
   同じ計算で再現し、固定の許可リストではなく「その回答者にとって有効な選択肢」で
   厳密に検証する（クライアント値を信用しない）。 */
function q11DerivedOptions(row) {
  return (row.q11_uniform || []).map(function (v) {
    return v === 'その他' ? (row.q11_other ? 'その他：' + row.q11_other : 'その他') : v;
  });
}

function normalizeQuestionValue(question, rawAnswers, dynamicAllowed) {
  var raw = rawAnswers ? rawAnswers[question.storageField] : undefined;
  var allowed = question.optionsSource
    ? dynamicAllowed
    : ((question.options && question.options.length) ? question.options : null);

  if (question.type === 'multi') {
    if (!Array.isArray(raw)) return [];
    var seen = {};
    var out = [];
    raw.forEach(function (v) {
      var s = clampText(v, 200);
      if (!s) return;
      if (allowed && allowed.indexOf(s) === -1) return;
      if (seen[s]) return;
      seen[s] = true;
      out.push(s);
    });
    return out;
  }

  if (question.type === 'text') {
    return clampText(raw, 2000);
  }

  /* single */
  var s = clampText(raw, 200);
  if (!s) return '';
  if (allowed && allowed.indexOf(s) === -1) return '';
  return s;
}

function resolveCompletionStage(conditions, row) {
  if (row.q1_age === '17歳以下') return 'underage_end';
  if (conditionEval.evaluateCondition(conditions, 'female_or_other', row)) return 'female_other_end';
  if (conditionEval.evaluateCondition(conditions, 'male_only', row)) {
    if (row.q15_gate === '興味はない') return 'gate_not_interested';
    if (conditionEval.evaluateCondition(conditions, 'male_gate_passed_and_not_low_interest', row)) return 'completed_full';
    if (conditionEval.evaluateCondition(conditions, 'male_gate_passed', row)) return 'completed_low_interest';
    return 'male_no_gate_answer';
  }
  return 'unknown';
}

function isFilled(question, value) {
  return question.type === 'multi' ? (Array.isArray(value) && value.length > 0) : !!value;
}

/* exclusiveOptions（例: Q5の「まだ分からない/特にない/回答しない」）は、選ばれた場合
   他のどの選択肢とも同時選択できない（survey.jsのapplyExclusive()と同じ制約）。 */
function violatesExclusiveOptions(question, value) {
  if (!question.exclusiveOptions || !question.exclusiveOptions.length || !Array.isArray(value)) return false;
  var hasExclusive = value.some(function (v) { return question.exclusiveOptions.indexOf(v) !== -1; });
  return hasExclusive && value.length > 1;
}

/* conflictPairs（例: Q6の「縛る・縛られる両方」と「縛られる側」）は、ペア単位で
   同時選択できない（survey.jsのapplyConflictPairs()と同じ制約）。 */
function violatesConflictPairs(question, value) {
  if (!question.conflictPairs || !question.conflictPairs.length || !Array.isArray(value)) return false;
  return question.conflictPairs.some(function (pair) {
    return value.indexOf(pair[0]) !== -1 && value.indexOf(pair[1]) !== -1;
  });
}

/* q20CrossExclusive：Q20A〜DのいずれかにexclusiveValues（「まだ分からない」「回答しない」）が
   含まれる場合、Q20A〜Dの他のどの選択肢（他の設問・自分自身の他の値問わず）も
   同時に選択できない（survey.jsのenforceQ20CrossExclusive()と同じ制約）。
   どのメンバー設問がexclusiveValuesを持つかを決め打ちせず、spec（schema定義）だけから
   汎用的に判定する。 */
function violatesQ20CrossExclusive(schema, row) {
  var spec = schema.q20CrossExclusive;
  if (!spec) return false;
  var byId = {};
  schema.questions.forEach(function (q) { byId[q.id] = q; });
  var memberValues = spec.memberQuestionIds.map(function (id) {
    var q = byId[id];
    return q ? (row[q.storageField] || []) : [];
  });
  var hasExclusive = memberValues.some(function (arr) {
    return arr.some(function (v) { return spec.exclusiveValues.indexOf(v) !== -1; });
  });
  if (!hasExclusive) return false;
  var nonExclusiveCount = 0;
  memberValues.forEach(function (arr) {
    arr.forEach(function (v) { if (spec.exclusiveValues.indexOf(v) === -1) nonExclusiveCount += 1; });
  });
  return nonExclusiveCount > 0;
}

/*
 * schema.questions を先頭から順に処理し、各設問のdisplayConditionを
 * 「ここまでに確定した行データ」だけを根拠に評価する。survey-schema.jsonの設問順は
 * 分岐の依存関係（例：Q2→Q7、Q4→Q18、Q15→Q16、Q11→Q12）に対して常に前方参照のため、
 * 1回の前方走査だけで非到達設問を正しく判定できる（個別設問への分岐ロジック手書きは不要）。
 *
 * schema: 完全なschema（admin_only含む。survey-schema.json相当の全設問定義）。
 * rawAnswers: クライアントから届いた回答オブジェクト（信頼しない）。
 * 戻り値: { row, completionStage, excluded, excludedReason, valid, missingRequired, invalidCombinations }
 */
function buildStorageRow(schema, rawAnswers) {
  var row = {};
  var safeRaw = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  var missingRequired = [];
  var invalidCombinations = [];

  schema.questions.forEach(function (q) {
    var visible = conditionEval.evaluateCondition(schema.conditions, q.displayCondition, row);
    if (!visible) {
      row[q.storageField] = q.type === 'multi' ? [] : '';
      (q.freeTextFields || []).forEach(function (ft) { row[ft.field] = ''; });
      return;
    }

    var dynamicAllowed = q.optionsSource === 'dynamic:Q11' ? q11DerivedOptions(row) : null;
    var value = normalizeQuestionValue(q, safeRaw, dynamicAllowed);
    row[q.storageField] = value;
    (q.freeTextFields || []).forEach(function (ft) {
      var triggered = q.type === 'multi' ? (Array.isArray(value) && value.indexOf(ft.trigger) !== -1) : value === ft.trigger;
      var freeTextValue = triggered ? clampText(safeRaw[ft.field], 2000) : '';
      row[ft.field] = freeTextValue;
      /* 「その他」等のトリガーを選んだのに自由記述が空欄なのは、survey.js側では
         「〜を入力してください」で先へ進めない状態。GAS直POSTではこの制約も
         再検証する（クライアント値を信用しない）。 */
      if (triggered && !freeTextValue) missingRequired.push(ft.field);
    });

    /* Q12はsurvey.js（q11DerivedOptions(a).length > 1）と同じ動的条件でのみ
       実際に「必須の設問として表示」される。Q11の候補が1件以下の場合は
       ステップ自体が計画に含まれず（0件なら回答不要、1件ならクライアントが
       自動でその値を補完する）、必須違反として扱わない。 */
    var required = q.required;
    if (q.id === 'Q12') required = dynamicAllowed.length > 1;

    if (required && !isFilled(q, value)) missingRequired.push(q.id);
    if (violatesExclusiveOptions(q, value)) invalidCombinations.push(q.id + ':exclusive_options');
    if (violatesConflictPairs(q, value)) invalidCombinations.push(q.id + ':conflict_pair');
  });

  if (violatesQ20CrossExclusive(schema, row)) invalidCombinations.push('Q20:cross_exclusive');

  var completionStage = resolveCompletionStage(schema.conditions, row);
  var excluded = row.q1_age === '17歳以下';

  return {
    row: row,
    completionStage: completionStage,
    excluded: excluded,
    excludedReason: excluded ? 'underage' : '',
    valid: missingRequired.length === 0 && invalidCombinations.length === 0,
    missingRequired: missingRequired,
    invalidCombinations: invalidCombinations
  };
}

module.exports = {
  clampText: clampText,
  q11DerivedOptions: q11DerivedOptions,
  normalizeQuestionValue: normalizeQuestionValue,
  resolveCompletionStage: resolveCompletionStage,
  violatesExclusiveOptions: violatesExclusiveOptions,
  violatesConflictPairs: violatesConflictPairs,
  violatesQ20CrossExclusive: violatesQ20CrossExclusive,
  buildStorageRow: buildStorageRow
};
