/*
 * ataru_survey_admin — 非公開・読み取り専用の管理者ダッシュボード（Issue #106）。
 *
 * このプロジェクトは ataru-nagoya の公開アンケート／将来の公開集計API（Issue #104）とは
 * 完全に別のApps Scriptプロジェクトとして運用する。
 *
 * 重要：このファイルにSpreadsheetへの書き込みAPIを一切追加しないこと。
 * 禁止: appendRow / setValue / setValues / clear / clearContent /
 *       deleteRow / deleteRows / deleteSheet / insertRow / insertRows / 回答変更・削除API
 * test/admin-readonly.test.js が gas/ataru_survey_admin/*.gs 全体をこのルールで静的検査する。
 *
 * デプロイ設定（README.md参照）：
 *   Execute as: Me
 *   Who has access: Only myself
 */
'use strict';

var SHEET_NAMES = { RESPONSES: 'responses', LEADS: 'leads' };

function getSpreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Script Properties に SPREADSHEET_ID が設定されていません。README.mdを参照してください。');
  return id;
}

function openSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

/* ヘッダ名ベースで1シートを読み取り、オブジェクト配列にする（列番号は固定しない・読み取り専用）。 */
function readSheetAsObjects_(sheetName) {
  var sheet = openSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var isEmpty = row.every(function (v) { return v === '' || v === null; });
    if (isEmpty) continue;
    var obj = {};
    headers.forEach(function (h, colIdx) {
      if (!h) return;
      obj[h] = row[colIdx];
    });
    rows.push(obj);
  }
  return rows;
}

function getResponseRows_() { return readSheetAsObjects_(SHEET_NAMES.RESPONSES); }
function getLeadRows_() { return readSheetAsObjects_(SHEET_NAMES.LEADS); }

/* ── 基本表示（Issue #106 5章「基本」） ── */
function computeSummary_(rows) {
  var totalSaved = rows.length;
  var excludedCount = rows.filter(isExcluded).length;
  var effective = effectiveRows(rows);
  var byDate = {};
  effective.forEach(function (r) {
    var d = toDateKey_(r.saved_at);
    if (!d) return;
    byDate[d] = (byDate[d] || 0) + 1;
  });
  var stageCounts = {};
  effective.forEach(function (r) {
    var stage = r.completion_stage || '(未設定)';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });
  var lastResponseAt = rows.reduce(function (max, r) {
    var t = r.saved_at ? new Date(r.saved_at).getTime() : NaN;
    if (isNaN(t)) return max;
    return (max === null || t > max) ? t : max;
  }, null);
  return {
    totalSaved: totalSaved,
    excludedCount: excludedCount,
    effectiveCount: effective.length,
    byDate: byDate,
    completionStageCounts: stageCounts,
    lastResponseAt: lastResponseAt ? new Date(lastResponseAt).toISOString() : null
  };
}

function toDateKey_(value) {
  if (!value) return null;
  var d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate());
}
function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/* ── 単純集計（Q1〜Q26。Q2/Q27はnever_publicのためカード化しない） ── */
function computeSimpleAggregates_(rows, schema) {
  var out = {};
  schema.questions.forEach(function (q) {
    if (q.publicationClass === 'never_public') return;
    if (q.type === 'text') return;
    out[q.id] = tallySingleQuestion(rows, schema.conditions, q, schema.multiValueDelimiter);
  });
  return out;
}

/* ── クロス集計：固定クロス + 軸×設問。分母は両軸のtargetCountConditionの交差集合（crossTargetCount）。 ── */
function computeCrossTabs_(rows, schema) {
  var fixed = schema.fixedCrossTabs.map(function (spec) {
    var qa = schema.questionsById[spec.axisA];
    var qb = schema.questionsById[spec.axisB];
    var result = crossTab(rows, schema.conditions, qa, qb, schema.multiValueDelimiter);
    return { id: spec.id, label: spec.label, axisA: spec.axisA, axisB: spec.axisB,
      crossTargetCount: result.crossTargetCount, cells: result.cells };
  });

  var axisTabs = [];
  schema.questions.forEach(function (q) {
    if (q.publicationClass === 'never_public' || q.type === 'text') return;
    schema.crossAxes.forEach(function (axisId) {
      if (axisId === q.id) return;
      var axisQ = schema.questionsById[axisId];
      var result = crossTab(rows, schema.conditions, q, axisQ, schema.multiValueDelimiter);
      axisTabs.push({ questionId: q.id, axisId: axisId,
        crossTargetCount: result.crossTargetCount, cells: result.cells });
    });
  });

  return { fixed: fixed, byAxis: axisTabs };
}

/* ── 自由記述（トップの単純集計カードとは分離して折りたたみ表示する） ── */
function computeFreeText_(rows, schema) {
  var effective = effectiveRows(rows);
  var q27 = effective.map(function (r) { return r.q27_message; }).filter(function (v) { return v && String(v).trim(); });
  var otherTexts = {};
  schema.questions.forEach(function (q) {
    (q.freeTextFields || []).forEach(function (ft) {
      var values = effective.map(function (r) { return r[ft.field]; }).filter(function (v) { return v && String(v).trim(); });
      if (values.length) otherTexts[q.id + ':' + ft.field] = values;
    });
  });
  return { q27Messages: q27, otherFreeText: otherTexts };
}

/* ── leads：集計値のみ。Xアカウント・emailを回答クロスへ出さない（Issue #106 17章）。 ── */
function computeLeadsSummary_(leadRows) {
  var total = leadRows.length;
  var linked = leadRows.filter(function (r) { return r.link_status === 'linked'; }).length;
  var unlinked = leadRows.filter(function (r) { return r.link_status === 'unlinked'; }).length;
  var byRequestedContent = {};
  leadRows.forEach(function (r) {
    var v = r.requested_content || '(未設定)';
    byRequestedContent[v] = (byRequestedContent[v] || 0) + 1;
  });
  return { total: total, linked: linked, unlinked: unlinked, byRequestedContent: byRequestedContent };
}

/* google.script.run から呼ぶ唯一のデータ取得エントリポイント（読み取りのみ）。 */
function getDashboardData() {
  var responseRows = getResponseRows_();
  var leadRows = getLeadRows_();
  return {
    surveyVersion: SurveySchema.surveyVersion,
    summary: computeSummary_(responseRows),
    simpleAggregates: computeSimpleAggregates_(responseRows, SurveySchema),
    crossTabs: computeCrossTabs_(responseRows, SurveySchema),
    freeText: computeFreeText_(responseRows, SurveySchema),
    leadsSummary: computeLeadsSummary_(leadRows),
    questions: SurveySchema.questions,
    fixedCrossTabs: SurveySchema.fixedCrossTabs
  };
}

function doGet() {
  return HtmlService.createTemplateFromFile('Dashboard')
    .evaluate()
    .setTitle('ataru-nagoya 管理者ダッシュボード')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
