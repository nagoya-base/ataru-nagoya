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

var conditionEval = require('./condition-eval');
var aggregateLib = require('./aggregate');

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
    var block = applyHalfRule(masked, optionLabels.length);
    /* 設問名（label/subLabel）はこのdetailオブジェクト経由でのみ公開する。detail自体が
       gateOpen=trueのときしかレスポンスへ含まれないため、100件以下ではQ5〜Q23の設問名も
       一切露出しない。survey-results.js（フロント）は設問名をハードコードしない
       （Issue #104 追加指示8・PR #110レビュー対応）。 */
    block.label = q.subLabel ? q.label + '（' + q.subLabel + '）' : q.label;
    detail[q.id] = block;
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

module.exports = {
  MIN_PUBLIC_CELL: MIN_PUBLIC_CELL,
  GATE_THRESHOLD: GATE_THRESHOLD,
  AGE_BUCKETS: AGE_BUCKETS,
  REGION_BUCKETS: REGION_BUCKETS,
  maskSingleSelect: maskSingleSelect,
  maskMultiSelect: maskMultiSelect,
  applyHalfRule: applyHalfRule,
  buildOverview: buildOverview,
  buildDetail: buildDetail,
  buildPublicResult: buildPublicResult
};
