/*
 * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * 生成元: survey-schema.json
 * 再生成: node scripts/sync-survey-schema.js
 * このファイルを直接編集しても、次回の同期で上書きされる。
 *
 * Issue #104 公開集計API向けの集計・マスキングロジック本体。
 * scripts/lib/public-aggregate.js をそのまま埋め込んだもので、5人未満マスキング・
 * 補完的抑制・Q1/Q3公開表示バケット化・100件ゲート判定・Q20 A〜D独立サブブロック化を
 * 個別に手書きしない。呼び出し側（Code.gs）は buildPublicResult(rows, PublicSurveySchema)
 * だけを呼ぶ。
 */

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


var conditionEval = {
  evaluateCondition: evaluateCondition,
  evaluateIntersection: evaluateIntersection
};

/*
 * targetCount / crossTargetCount / 単純集計を、survey-schema.json の
 * conditions・questions定義だけから機械的に計算する共通実装。
 * 管理者GAS（Code.gs）はこのロジックを個別に手書きせず、
 * scripts/sync-survey-schema.js が生成する SurveySchema.gs 経由でこの実装を使う。
 */
'use strict';


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


var aggregateLib = {
  isExcluded: isExcluded,
  effectiveRows: effectiveRows,
  valuesOf: valuesOf,
  countTarget: countTarget,
  crossTargetCount: crossTargetCount,
  tallySingleQuestion: tallySingleQuestion,
  crossTab: crossTab
};

/*
 * 公開集計API（Issue #104）が返すJSONを、survey-schema.json の conditions・questions定義
 * と生データ（responses）だけから機械的に組み立てる共通実装。
 *
 * 許可リスト方式：保存データから禁止項目を後から削るのではなく、
 * publicationClass=base_public（常時公開）/ gated_public（101件以上で公開）の設問だけを
 * 起点にレスポンスを組み立てる。admin_only・never_public・leadsは一切参照しない。
 *
 * 5人未満マスキング・補完的抑制・Q1/Q3の公開表示バケット化・Q20 A〜Dの独立サブブロック化・
 * 100件ゲートの判定をすべてこのファイルに集約し、Node（テスト・sync script）とGAS
 * （scripts/sync-survey-schema.js が埋め込んで生成する）の両方から同じロジックで使う。
 * ここを直接編集し、生成物（gas/ataru_survey_public/PublicAggregate.gs）は
 * `node scripts/sync-survey-schema.js` で再生成すること。
 */
'use strict';


var MIN_PUBLIC_CELL = 5;
var GATE_THRESHOLD = 100;

/* Q1公開表示バケット：50〜59歳と60歳以上を「50歳以上」へ統合する（Issue #104 4章A）。
   17歳以下は有効回答に含まれないため、ここには現れない。 */
var AGE_BUCKETS = [
  { label: '18〜24歳', match: ['18〜24歳'] },
  { label: '25〜29歳', match: ['25〜29歳'] },
  { label: '30〜34歳', match: ['30〜34歳'] },
  { label: '35〜39歳', match: ['35〜39歳'] },
  { label: '40〜49歳', match: ['40〜49歳'] },
  { label: '50歳以上', match: ['50〜59歳', '60歳以上'] },
  { label: '回答しない', match: ['回答しない'] }
];

/* Q3公開表示バケット：大分類へ丸める（Issue #104 4章B）。自由記述の地域名・国名は含めない。 */
var REGION_BUCKETS = [
  { label: '東海', match: ['静岡県', '愛知県・名古屋市', '愛知県・尾張地域（名古屋市以外）', '愛知県・三河地域', '岐阜県', '三重県'] },
  { label: '関東', match: ['東京都', '関東（東京都以外）'] },
  { label: '関西', match: ['関西'] },
  { label: 'その他国内', match: ['北海道', '東北', '甲信越・北陸', '中国', '四国', '九州', '沖縄県', 'その他'] },
  { label: '海外', match: ['海外'] }
];

function bucketLabelOf(rawValue, buckets) {
  for (var i = 0; i < buckets.length; i++) {
    if (buckets[i].match.indexOf(rawValue) !== -1) return buckets[i].label;
  }
  return null;
}

/* rows（有効回答）を指定フィールドの値でバケット化して集計する。 */
function bucketTally(rows, buckets, field) {
  var counts = {};
  buckets.forEach(function (b) { counts[b.label] = 0; });
  var n = 0;
  rows.forEach(function (r) {
    var raw = r[field];
    if (!raw) return;
    var label = bucketLabelOf(raw, buckets);
    if (label === null) return;
    counts[label] += 1;
    n += 1;
  });
  return { counts: counts, total: n };
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

function toOption(entry, targetCount) {
  return {
    value: entry.label,
    count: entry.count,
    pct: targetCount > 0 ? round4(entry.count / targetCount) : 0
  };
}

function toEntries(orderedLabels, counts) {
  return orderedLabels.map(function (label, idx) {
    return { label: label, count: counts[label] || 0, order: idx };
  });
}

function smallestEntry(list) {
  return list.slice().sort(function (a, b) {
    if (a.count !== b.count) return a.count - b.count;
    return a.order - b.order; /* 決定的なタイブレーク：schemaの選択肢順 */
  })[0];
}

function byOrder(a, b) { return a.order - b.order; }

/*
 * 単一選択設問の5人未満マスキング＋補完的抑制（Issue #104 8章）。
 *  1. count<5 のセルは非公開にする
 *  2. 単一選択は合計=targetCountのため、非公開セルが1つだけだと残差から正確な人数が
 *     一意に復元できてしまう。その場合、次に小さい公開セルも追加で「その他少数」へ含め、
 *     残差を一意に復元できない状態にする
 *  3. それでも公開セルが1つも残らない（=これ以上足せない）場合は設問ブロック全体を非公開にする
 * 同じ入力に対して常に同じ結果になるよう、タイブレークはschemaの選択肢順で固定する
 * （Object列挙順・ランダムに依存しない）。
 */
function maskSingleSelect(orderedLabels, counts, targetCount) {
  var entries = toEntries(orderedLabels, counts);
  var visible = entries.filter(function (e) { return e.count >= MIN_PUBLIC_CELL; });
  var suppressed = entries.filter(function (e) { return e.count < MIN_PUBLIC_CELL; });

  if (suppressed.length === 0) {
    return {
      hidden: false,
      targetCount: targetCount,
      options: visible.sort(byOrder).map(function (e) { return toOption(e, targetCount); }),
      otherSmall: null
    };
  }

  if (suppressed.length === 1) {
    if (visible.length === 0) {
      return { hidden: true, targetCount: targetCount };
    }
    var moved = smallestEntry(visible);
    visible = visible.filter(function (e) { return e !== moved; });
    suppressed = suppressed.concat([moved]);
  }

  var otherSmallCount = suppressed.reduce(function (s, e) { return s + e.count; }, 0);
  return {
    hidden: false,
    targetCount: targetCount,
    options: visible.sort(byOrder).map(function (e) { return toOption(e, targetCount); }),
    otherSmall: { count: otherSmallCount, pct: targetCount > 0 ? round4(otherSmallCount / targetCount) : 0 }
  };
}

/*
 * 複数選択設問の5人未満マスキング（Issue #104 8章）。
 * 複数選択は選択率合計が100%を超え得るため、targetCountとの差分から少数セルを推定する
 * 残差ロジックは使わない。非公開セルは「その他少数」へまとめず、単に公開しない
 * （公開APIが「全選択数」等の推定材料を返さないことで残差推定自体を成立させない）。
 */
function maskMultiSelect(orderedLabels, counts, targetCount) {
  var entries = toEntries(orderedLabels, counts);
  var visible = entries.filter(function (e) { return e.count >= MIN_PUBLIC_CELL; });
  return {
    hidden: false,
    targetCount: targetCount,
    options: visible.sort(byOrder).map(function (e) { return toOption(e, targetCount); }),
    omittedOptionCount: entries.length - visible.length
  };
}

/* 「半数以下」判定（Issue #104 6章）。分母はその設問ブロックに定義されている公開対象の
   選択肢数（その他・回答しない・まだ分からない・0件だった選択肢を含む。自由記述欄自体は含めない）。
   ちょうど半数でも非公開にする（"以下"）。 */
function applyHalfRule(masked, totalDefinedOptions) {
  if (masked.hidden) return masked;
  if (totalDefinedOptions <= 0) return masked;
  var visibleCount = (masked.options || []).length;
  if (visibleCount <= totalDefinedOptions / 2) {
    return { hidden: true, targetCount: masked.targetCount };
  }
  return masked;
}

function resolveOptionLabels(question, questionsById) {
  if (question.options && question.options.length) return question.options;
  if (question.optionsSource === 'dynamic:Q11') return questionsById.Q11.options;
  return [];
}

/* overview（base_public: Q1/Q3/Q4）は常時表示するため半数以下ルールを適用しない
   （低N時は「低N時の結果ページ」専用表示で扱う。Issue #104 8章）。 */
function buildOverview(effRows, schema) {
  var byId = {};
  schema.questions.forEach(function (q) { byId[q.id] = q; });
  var effectiveCount = effRows.length;

  var q1Tally = bucketTally(effRows, AGE_BUCKETS, 'q1_age');
  var q3Tally = bucketTally(effRows, REGION_BUCKETS, 'q3_region');
  var q4 = byId.Q4;
  var q4Tally = aggregateLib.tallySingleQuestion(effRows, schema.conditions, q4, schema.multiValueDelimiter);

  return {
    Q1: maskSingleSelect(AGE_BUCKETS.map(function (b) { return b.label; }), q1Tally.counts, effectiveCount),
    Q3: maskSingleSelect(REGION_BUCKETS.map(function (b) { return b.label; }), q3Tally.counts, effectiveCount),
    Q4: maskSingleSelect(q4.options, q4Tally.counts, q4Tally.targetCount)
  };
}

/* detail（gated_public）は101件以上で解放。各設問・各Q20サブグループを独立ブロックとして
   半数以下ルールを適用する（Issue #104 6章・11章）。 */
function buildDetail(effRows, schema) {
  var byId = {};
  schema.questions.forEach(function (q) { byId[q.id] = q; });
  var detail = {};
  schema.questions.forEach(function (q) {
    if (q.publicationClass !== 'gated_public') return;
    var tally = aggregateLib.tallySingleQuestion(effRows, schema.conditions, q, schema.multiValueDelimiter);
    var optionLabels = resolveOptionLabels(q, byId);
    var masked = q.type === 'single'
      ? maskSingleSelect(optionLabels, tally.counts, tally.targetCount)
      : maskMultiSelect(optionLabels, tally.counts, tally.targetCount);
    detail[q.id] = applyHalfRule(masked, optionLabels.length);
  });
  return detail;
}

function blockHasSuppression(block) {
  if (!block) return false;
  if (block.hidden) return true;
  if (block.otherSmall) return true;
  if (block.omittedOptionCount) return true;
  return false;
}

function isLowN(block) {
  return !block || block.hidden || !block.options || block.options.length === 0;
}

/*
 * 公開集計APIレスポンス本体を組み立てる唯一の実装。
 * gateOpen=false（有効回答数<=100）の間は `detail` キー自体をレスポンスへ一切含めない
 * （null・空配列・空オブジェクト・hiddenフラグでの温存も禁止：Issue #104 5章）。
 */
function buildPublicResult(rows, schema) {
  var effRows = aggregateLib.effectiveRows(rows);
  var effectiveCount = effRows.length;
  var gateOpen = effectiveCount > GATE_THRESHOLD;

  var overview = buildOverview(effRows, schema);
  var overviewBlocks = [overview.Q1, overview.Q3, overview.Q4];
  var lowNCount = overviewBlocks.filter(isLowN).length;

  var result = {
    surveyVersion: schema.surveyVersion,
    effectiveCount: effectiveCount,
    gateThreshold: GATE_THRESHOLD,
    gateOpen: gateOpen,
    overviewLowN: lowNCount >= 2,
    overview: overview
  };

  var suppressionApplied = overviewBlocks.some(blockHasSuppression);

  if (gateOpen) {
    var detail = buildDetail(effRows, schema);
    result.detail = detail;
    suppressionApplied = suppressionApplied || Object.keys(detail).some(function (id) { return blockHasSuppression(detail[id]); });
  }

  result.suppressionApplied = suppressionApplied;
  return result;
}

