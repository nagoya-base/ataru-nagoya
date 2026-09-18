/*
 * ataru_survey_public — 公開の回答保存Web App + 公開集計API（Issue #104）。
 *
 * このプロジェクトは gas/ataru_survey_admin/（非公開・読み取り専用の管理者ダッシュボード）とは
 * 完全に別のApps Scriptプロジェクトとして運用する（Issue #104 追加指示2）。
 * 互いのコードを参照・import しない。
 *
 * デプロイ設定（README.md参照）：
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * 重要な設計上の分離：
 * - 公開集計（doGet action=results）は PublicSurveySchema（PublicSchema.gs。base_public /
 *   gated_public の設問のみ）だけを参照する。FullSurveySchema・leadsシートには一切アクセスしない
 *   （test/public-gas-privacy.test.js が静的に検証する）。
 * - 回答保存（doPost action=save_response）は FullSurveySchema（admin_only含む全設問）を使う。
 * - リード保存（doPost action=save_lead）は response_id の実在確認のため responses シートを
 *   読むが、公開集計関数（buildPublicResult等）からは一切呼ばれない。
 *
 * CORS（Issue #104 追加指示16）：
 * GitHub Pages（別オリジン）からのfetchで、Content-Type: application/json を指定した
 * クロスオリジンPOSTはプリフライト(OPTIONS)が発生するが、GAS Web AppはOPTIONSへの
 * カスタムCORSヘッダ応答を安定して行えない。そのため survey.js 側は
 * Content-Type: text/plain;charset=utf-8 でJSON文字列をPOSTする（「シンプルリクエスト」として
 * プリフライトを発生させない）。doPost側は e.postData.contents をJSON.parseする。
 * ContentService経由のレスポンスはGAS側で自動的にクロスオリジン読み取りが許可されるため、
 * 追加のCORSヘッダ設定は行っていない（doGet/doPostにカスタムヘッダAPIが存在しないため設定不可）。
 * 実際のブラウザ⇔デプロイ済みWeb AppでのCORS挙動は、デプロイ後に手動確認が必要
 * （README.mdの手動確認チェックリスト参照）。
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

function headerNamesOf_(columnsDef) {
  return columnsDef.map(function (c) { return c.name; });
}

function getOrCreateSheet_(sheetName, headers) {
  var ss = openSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    return sheet;
  }
  var firstRow = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  var isEmpty = firstRow.every(function (v) { return v === '' || v === null; });
  if (isEmpty) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

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

/* headers順に、dataObjの値を1行の配列へ変換する。配列値はmultiValueDelimiterで連結する。 */
function rowArrayFromObject_(headers, dataObj, delimiter) {
  return headers.map(function (name) {
    var v = dataObj[name];
    if (Array.isArray(v)) return v.join(delimiter);
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v;
    return v;
  });
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('リクエスト本文がありません。');
  return JSON.parse(e.postData.contents);
}

/* ── 回答保存（doPost action=save_response） ──
   response_idは常にサーバー側で新規生成する。クライアントが送ってきた値
   （clientResponseId。相関目的の参考値に過ぎない）は保存用IDとして採用しない
   （Issue #104 追加指示4）。

   公開Web Appは匿名で誰でもPOSTできるため、ブラウザUIのバリデーション・17歳以下
   ブロックだけに依存しない（レビュー指摘対応）。
   - 17歳以下は行を追加せず保存自体を拒否する（有効回答数には含まれないだけでなく、
     未成年の回答をresponsesシートへ一切残さない）
   - 到達した設問のうちrequired:trueが未回答なら保存を拒否する
     （buildStorageRow()がdisplayCondition・Q12の動的必須条件まで含めて判定する）
   - 「その他」等のトリガー選択肢を選んだのに対応する自由記述が空、exclusiveOptions
     （例: Q5の「回答しない」）を他の選択肢と同時選択、conflictPairs（例: Q6の
     「両方」と「縛られる側」）の同時選択、q20CrossExclusive（Q20Dの「まだ分からない」
     等とQ20A〜Cの同時選択）のいずれかに該当する場合も保存を拒否する
     （フロントUIでは成立しない回答状態を匿名直POSTで作れないようにする） */
function saveResponse_(payload) {
  var normalized = buildStorageRow(FullSurveySchema, payload && payload.answers);

  if (normalized.excluded && normalized.excludedReason === 'underage') {
    return { ok: false, error: 'underage_not_saved' };
  }
  if (!normalized.valid) {
    return { ok: false, error: 'invalid_answers', missing: normalized.missingRequired, invalidCombinations: normalized.invalidCombinations };
  }

  var responseId = Utilities.getUuid();
  var savedAt = new Date().toISOString();

  var headers = headerNamesOf_(FullSurveySchema.responsesManagementColumns.concat(
    /* schema/responses-columns.json と同じ並び：管理列 → 各設問storageField → freeTextFields */
    buildResponsesQuestionColumns_(FullSurveySchema)
  ));
  var sheet = getOrCreateSheet_(SHEET_NAMES.RESPONSES, headers);

  var dataObj = {};
  Object.keys(normalized.row).forEach(function (k) { dataObj[k] = normalized.row[k]; });
  dataObj.response_id = responseId;
  dataObj.survey_version = FullSurveySchema.surveyVersion;
  dataObj.saved_at = savedAt;
  dataObj.completion_stage = normalized.completionStage;
  dataObj.excluded = normalized.excluded;
  dataObj.excluded_reason = normalized.excludedReason;

  sheet.appendRow(rowArrayFromObject_(headers, dataObj, FullSurveySchema.multiValueDelimiter));

  return {
    ok: true,
    response_id: responseId,
    survey_version: FullSurveySchema.surveyVersion,
    saved_at: savedAt,
    completion_stage: normalized.completionStage,
    excluded: normalized.excluded
  };
}

/* schema/responses-columns.json 相当の「設問storageField + freeTextField」列名一覧を、
   FullSurveySchema.questionsから機械的に組み立てる（列名リストを個別に手書きしない）。 */
function buildResponsesQuestionColumns_(schema) {
  var cols = [];
  schema.questions.forEach(function (q) {
    cols.push({ name: q.storageField });
    (q.freeTextFields || []).forEach(function (ft) { cols.push({ name: ft.field }); });
  });
  return cols;
}

/* ── リード保存（doPost action=save_lead） ──
   再訪リードのlink_statusは、クライアントから送られてきたresponse_idが実際に
   responsesシートに存在するかをGAS側で確認してから決める（Issue #104 追加指示13）。
   存在しない・未指定なら unlinked。 */
function saveLead_(payload) {
  var p = payload || {};
  var xAccount = (p.x_account || '').toString().trim();
  var email = (p.email || '').toString().trim();
  var requestedContent = (p.requested_content || '').toString().trim();
  var claimedResponseId = (p.response_id || '').toString().trim();

  if (!xAccount && !email) {
    return { ok: false, error: 'x_account または email のいずれかが必要です。' };
  }

  var linkStatus = 'unlinked';
  var linkedResponseId = '';
  if (claimedResponseId) {
    var existing = readSheetAsObjects_(SHEET_NAMES.RESPONSES).some(function (r) {
      return String(r.response_id || '') === claimedResponseId;
    });
    if (existing) {
      linkStatus = 'linked';
      linkedResponseId = claimedResponseId;
    }
  }

  var headers = headerNamesOf_(FullSurveySchema.leadsColumns);
  var sheet = getOrCreateSheet_(SHEET_NAMES.LEADS, headers);
  var dataObj = {
    lead_id: Utilities.getUuid(),
    response_id: linkedResponseId,
    received_at: new Date().toISOString(),
    x_account: xAccount,
    email: email,
    requested_content: requestedContent,
    link_status: linkStatus
  };
  sheet.appendRow(rowArrayFromObject_(headers, dataObj, FullSurveySchema.multiValueDelimiter));

  return { ok: true, link_status: linkStatus };
}

/* ── 公開集計API（doGet action=results） ──
   PublicSurveySchema（base_public / gated_public のみ）だけを渡す。
   leadsシート・FullSurveySchema・admin_only設問には一切アクセスしない。 */
function getPublicResults_() {
  var rows = readSheetAsObjects_(SHEET_NAMES.RESPONSES);
  return buildPublicResult(rows, PublicSurveySchema);
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : 'results';
  if (!action || action === 'results') {
    return jsonOutput_(getPublicResults_());
  }
  return jsonOutput_({ ok: false, error: 'unknown action: ' + action });
}

function doPost(e) {
  var payload;
  try {
    payload = parsePostBody_(e);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'invalid request body' });
  }

  try {
    if (payload.action === 'save_response') {
      return jsonOutput_(saveResponse_(payload));
    }
    if (payload.action === 'save_lead') {
      return jsonOutput_(saveLead_(payload));
    }
    return jsonOutput_({ ok: false, error: 'unknown action: ' + payload.action });
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'internal error' });
  }
}
