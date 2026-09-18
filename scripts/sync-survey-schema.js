#!/usr/bin/env node
/*
 * survey-schema.json（正本）から、次の生成物を作る/検証するスクリプト（Issue #106）。
 *
 *   1. schema/responses-columns.json … responsesシートの列定義
 *   2. schema/leads-columns.json      … leadsシートの列定義
 *   3. generated/survey-schema.front.js  … survey.jsとの一致検証に使うフロント定義
 *   4. generated/survey-schema.public.gs … 将来Issue #104が使う公開/保存GAS向け定義
 *      （admin_only / never_public 設問・leadsは含まない）
 *   5. gas/ataru_survey_admin/SurveySchema.gs … 管理者GAS向けの完全な定義+集計ロジック
 *   6. gas/ataru_survey_public/PublicSchema.gs      … 公開集計API(Issue #104)が読む定義（3と同一内容）
 *   7. gas/ataru_survey_public/PublicAggregate.gs   … 公開集計API(Issue #104)向けの集計・マスキングロジック
 *   8. gas/ataru_survey_public/FullSchema.gs        … 回答保存Web App(Issue #104)が使う完全なschema定義
 *      （admin_only含む。公開集計APIの関数からは一切参照しない＝leads/admin_only分離を構造で保証）
 *   9. gas/ataru_survey_public/ResponseNormalize.gs … 回答保存時のサーバー側表示条件再検証ロジック
 *
 * 使い方:
 *   node scripts/sync-survey-schema.js          生成物を書き込む
 *   node scripts/sync-survey-schema.js --check  再生成して既存ファイルと差分がないか検証する
 *      （CIはこちらを使う。差分があれば非ゼロで終了する）
 *
 * 依存パッケージは追加しない（Node標準機能のみ）。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SCHEMA_PATH = path.join(ROOT, 'survey-schema.json');

var AUTO_GEN_NOTICE =
  'AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.\n' +
  '生成元: survey-schema.json\n' +
  '再生成: node scripts/sync-survey-schema.js\n' +
  'このファイルを直接編集しても、次回の同期で上書きされる。';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

/* scripts/lib/*.js のNode専用部分（require/module.exports）を取り除き、
   GAS(.gs)ファイルへそのまま埋め込めるプレーンな関数群にする。 */
function embedLibSource(source) {
  var lines = source.split('\n').filter(function (line) {
    return !/^\s*var\s+\w+\s*=\s*require\(/.test(line);
  });
  var joined = lines.join('\n');
  return joined.replace(/\n\s*module\.exports\s*=[\s\S]*$/, '\n');
}

function loadSchema() {
  return readJson(SCHEMA_PATH);
}

/* ── 1. schema/responses-columns.json ── */
function buildResponsesColumns(schema) {
  var columns = schema.responsesManagementColumns.map(function (c) {
    return {
      name: c.name, type: c.type, required: c.required,
      questionId: null, publicationClass: 'never_public', multiValue: false,
      description: c.description
    };
  });
  schema.questions.forEach(function (q) {
    columns.push({
      name: q.storageField, type: q.type, required: q.required,
      questionId: q.id, publicationClass: q.publicationClass, multiValue: q.type === 'multi',
      description: q.label + (q.subLabel ? '（' + q.subLabel + '）' : '')
    });
    (q.freeTextFields || []).forEach(function (ft) {
      columns.push({
        name: ft.field, type: 'string', required: false,
        questionId: q.id, publicationClass: 'never_public', multiValue: false,
        description: q.id + ' 「' + ft.trigger + '」選択時の自由記述本文（never_public）'
      });
    });
  });
  return {
    $notice: AUTO_GEN_NOTICE,
    sheetName: 'responses',
    multiValueDelimiter: schema.multiValueDelimiter,
    hiddenQuestionPolicy: schema.storagePolicy.hiddenQuestionPolicy,
    contradictionPolicy: schema.storagePolicy.contradictionPolicy,
    columns: columns
  };
}

/* ── 2. schema/leads-columns.json ── */
function buildLeadsColumns(schema) {
  return {
    $notice: AUTO_GEN_NOTICE,
    sheetName: 'leads',
    note: 'responsesとは物理的に別シート。公開系定義（survey-schema.public.gs）からは参照できない。',
    columns: schema.leadsColumns
  };
}

/* ── 3. generated/survey-schema.front.js ── */
function buildFrontJs(schema) {
  var payload = {
    surveyVersion: schema.surveyVersion,
    multiValueDelimiter: schema.multiValueDelimiter,
    conditions: schema.conditions,
    questions: schema.questions.map(function (q) {
      return {
        id: q.id, frontStepId: q.frontStepId, storageField: q.storageField,
        type: q.type, required: q.required, options: q.options,
        optionsSource: q.optionsSource || null,
        exclusiveOptions: q.exclusiveOptions || [], conflictPairs: q.conflictPairs || [],
        freeTextFields: q.freeTextFields || [],
        displayCondition: q.displayCondition, targetCountCondition: q.targetCountCondition,
        publicationClass: q.publicationClass, publicBlock: q.publicBlock,
        group: q.group, q20SubGroup: q.q20SubGroup
      };
    }),
    q20CrossExclusive: schema.q20CrossExclusive
  };
  return (
    '/*\n * ' + AUTO_GEN_NOTICE.split('\n').join('\n * ') + '\n' +
    ' *\n * survey.js のフロント定義との一致をtest/front-consistency.test.jsで検証するための\n' +
    ' * 参照データ。survey.js自体はこのファイルをロードしない（大規模なUI改修を避けるため）。\n */\n' +
    "'use strict';\n\n" +
    'var SurveySchemaFront = ' + JSON.stringify(payload, null, 2) + ';\n\n' +
    'if (typeof module !== \'undefined\' && module.exports) {\n' +
    '  module.exports = SurveySchemaFront;\n' +
    '}\n'
  );
}

/* ── 4. generated/survey-schema.public.gs ──
   公開/保存GAS（将来のIssue #104）が import/コピーして使う想定の生成済み定義。
   admin_only / never_public の設問、leadsは一切含めない。endpointやdoGet/doPostは作らない。 */
function buildPublicGs(schema) {
  var publicQuestions = schema.questions
    .filter(function (q) { return q.publicationClass === 'base_public' || q.publicationClass === 'gated_public'; })
    .map(function (q) {
      return {
        id: q.id, label: q.label, subLabel: q.subLabel || null,
        storageField: q.storageField, type: q.type, required: q.required,
        options: q.options, optionsSource: q.optionsSource || null,
        displayCondition: q.displayCondition, targetCountCondition: q.targetCountCondition,
        publicationClass: q.publicationClass, publicBlock: q.publicBlock,
        group: q.group, q20SubGroup: q.q20SubGroup
        /* otherField・freeTextFieldsは公開系定義に含めない（自由記述本文は常にnever_public）。
           label/subLabelは含める：gated_publicの設問名は101件以上でのみ公開APIレスポンスへ
           露出させ（buildDetail()参照）、survey-results.js側に設問名をハードコードしない
           （Issue #104 追加指示8・PR #110レビュー対応）。 */
      };
    });
  var publicQuestionIds = {};
  publicQuestions.forEach(function (q) { publicQuestionIds[q.id] = true; });
  /* fixedCrossTabsは両軸ともbase_public/gated_publicの設問だけを残す。
     admin_only（Q24〜Q26）を軸に持つクロス（Q22×Q24, Q24×Q25）は公開系定義へ混入させない。 */
  var publicFixedCrossTabs = schema.fixedCrossTabs.filter(function (spec) {
    return publicQuestionIds[spec.axisA] && publicQuestionIds[spec.axisB];
  });
  var evaluator = embedLibSource(readText(path.join(ROOT, 'scripts/lib/condition-eval.js')));
  var payload = {
    surveyVersion: schema.surveyVersion,
    multiValueDelimiter: schema.multiValueDelimiter,
    conditions: schema.conditions,
    questions: publicQuestions,
    crossAxes: schema.crossAxes,
    fixedCrossTabs: publicFixedCrossTabs
  };
  return (
    '/*\n * ' + AUTO_GEN_NOTICE.split('\n').join('\n * ') + '\n' +
    ' *\n * Issue #104（回答保存Web App・公開集計API）が将来import/コピーして使うための\n' +
    ' * 生成済みschema定義。本ファイルはIssue #106の範囲外であるendpoint・doGet/doPostを\n' +
    ' * 一切実装しない。base_public / gated_public の設問のみを含み、admin_only /\n' +
    ' * never_public の設問・leadsは含まない。\n */\n\n' +
    evaluator + '\n' +
    'var PublicSurveySchema = ' + JSON.stringify(payload, null, 2) + ';\n'
  );
}

/* ── 5. gas/ataru_survey_admin/SurveySchema.gs ──
   管理者GAS向け完全定義（admin_onlyを含む）+ 条件評価・集計ロジック。
   leadsColumnsも含むが、書き込みAPIは一切生成しない（読み取り専用）。 */
function buildAdminGs(schema) {
  var evaluator = embedLibSource(readText(path.join(ROOT, 'scripts/lib/condition-eval.js')));
  var aggregate = embedLibSource(readText(path.join(ROOT, 'scripts/lib/aggregate.js')));
  /* aggregate.js はNode側で `var conditionEval = require('./condition-eval'); conditionEval.evaluateCondition(...)`
     という参照方式のまま書かれている。embedLibSource()はrequire()行とmodule.exportsだけを取り除くため、
     evaluateCondition/evaluateIntersectionはトップレベル関数として展開されるが、aggregate側の
     `conditionEval.evaluateCondition(...)` という呼び出し自体は書き換えていない。
     そのままではGAS実行時に `conditionEval is not defined` になるため、
     evaluator関数を指すconditionEvalオブジェクトをここで補う。 */
  var conditionEvalShim =
    '\nvar conditionEval = {\n' +
    '  evaluateCondition: evaluateCondition,\n' +
    '  evaluateIntersection: evaluateIntersection\n' +
    '};\n';
  var questionsById = {};
  schema.questions.forEach(function (q) { questionsById[q.id] = q; });
  var payload = {
    surveyVersion: schema.surveyVersion,
    multiValueDelimiter: schema.multiValueDelimiter,
    conditions: schema.conditions,
    questions: schema.questions,
    questionsById: questionsById,
    crossAxes: schema.crossAxes,
    fixedCrossTabs: schema.fixedCrossTabs,
    q20CrossExclusive: schema.q20CrossExclusive,
    responsesManagementColumns: schema.responsesManagementColumns,
    leadsColumns: schema.leadsColumns
  };

  return (
    '/*\n * ' + AUTO_GEN_NOTICE.split('\n').join('\n * ') + '\n' +
    ' *\n * ataru_survey_admin（読み取り専用・非公開管理者ダッシュボード）向けの完全なschema定義と\n' +
    ' * 集計ロジック（targetCount / crossTargetCount / 単純集計）。admin_only設問・leads列定義を含む。\n' +
    ' * このファイルにSpreadsheetへの書き込みAPI（appendRow/setValue等）は一切含まれない。\n */\n\n' +
    evaluator + '\n' +
    conditionEvalShim + '\n' +
    aggregate + '\n' +
    'var SurveySchema = ' + JSON.stringify(payload, null, 2) + ';\n'
  );
}

/* ── 6. gas/ataru_survey_public/PublicSchema.gs ──
   公開/保存GAS（Issue #104: gas/ataru_survey_public/）が実際に使うschema定義。
   generated/survey-schema.public.gs と内容は同一（生成元・生成ロジックを共有し、
   条件評価・公開区分の正本を二重に手書きしない）。 */
function buildPublicSchemaForPublicApp(schema) {
  return buildPublicGs(schema).replace(
    '生成済みschema定義。本ファイルはIssue #106の範囲外であるendpoint・doGet/doPostを\n' +
    ' * 一切実装しない。base_public / gated_public の設問のみを含み、admin_only /\n' +
    ' * never_public の設問・leadsは含まない。',
    '生成済みschema定義。doGet/doPost実装は gas/ataru_survey_public/Code.gs にある。\n' +
    ' * base_public / gated_public の設問のみを含み、admin_only / never_public の設問・\n' +
    ' * leadsは含まない（このファイル自体にSpreadsheetアクセスは一切ない）。'
  );
}

/* ── 7. gas/ataru_survey_public/PublicAggregate.gs ──
   公開集計API（Issue #104）が使う、5人未満マスキング・補完的抑制・Q1/Q3バケット化・
   100件ゲート判定・Q20 A〜D独立サブブロック化を含む集計ロジック本体。
   scripts/lib/public-aggregate.js をそのまま埋め込む（GAS側への個別手書きを禁止する）。 */
function buildPublicAggregateGs(schema) {
  var conditionEvaluator = embedLibSource(readText(path.join(ROOT, 'scripts/lib/condition-eval.js')));
  var aggregate = embedLibSource(readText(path.join(ROOT, 'scripts/lib/aggregate.js')));
  var conditionEvalShim =
    '\nvar conditionEval = {\n' +
    '  evaluateCondition: evaluateCondition,\n' +
    '  evaluateIntersection: evaluateIntersection\n' +
    '};\n';
  var publicAggregateSource = embedLibSource(readText(path.join(ROOT, 'scripts/lib/public-aggregate.js')));
  /* public-aggregate.js は Node側で
       var conditionEval = require('./condition-eval');
       var aggregateLib = require('./aggregate');
     という参照方式のまま書かれている。embedLibSource()はrequire()行とmodule.exportsだけを
     取り除くため、aggregateLib.effectiveRows(...) 等の呼び出しがそのまま残る。
     GAS実行時に `aggregateLib is not defined` にならないよう、aggregate.js が展開する
     トップレベル関数を指す aggregateLib オブジェクトをここで補う
     （test/admin-gs-runtime.test.js と同種の埋め込み変換をpublic-aggregate.js側にも適用）。 */
  var aggregateLibShim =
    '\nvar aggregateLib = {\n' +
    '  isExcluded: isExcluded,\n' +
    '  effectiveRows: effectiveRows,\n' +
    '  valuesOf: valuesOf,\n' +
    '  countTarget: countTarget,\n' +
    '  crossTargetCount: crossTargetCount,\n' +
    '  tallySingleQuestion: tallySingleQuestion,\n' +
    '  crossTab: crossTab\n' +
    '};\n';

  return (
    '/*\n * ' + AUTO_GEN_NOTICE.split('\n').join('\n * ') + '\n' +
    ' *\n * Issue #104 公開集計API向けの集計・マスキングロジック本体。\n' +
    ' * scripts/lib/public-aggregate.js をそのまま埋め込んだもので、5人未満マスキング・\n' +
    ' * 補完的抑制・Q1/Q3公開表示バケット化・100件ゲート判定・Q20 A〜D独立サブブロック化を\n' +
    ' * 個別に手書きしない。呼び出し側（Code.gs）は buildPublicResult(rows, PublicSurveySchema)\n' +
    ' * だけを呼ぶ。\n */\n\n' +
    conditionEvaluator + '\n' +
    conditionEvalShim + '\n' +
    aggregate + '\n' +
    aggregateLibShim + '\n' +
    publicAggregateSource + '\n'
  );
}

/* ── 8. gas/ataru_survey_public/FullSchema.gs ──
   回答保存Web App（doPost）が使う完全なschema定義（admin_only含む。全34設問＋leads列）。
   条件評価関数は埋め込まない（PublicAggregate.gsが同一GASプロジェクト内で既に定義するため、
   同じ関数をファイル間で二重宣言しない）。公開集計API（buildPublicResult）はこのファイルの
   変数（FullSurveySchema）を一切参照しない＝構造的にadmin_only/leadsを公開集計から分離する。 */
function buildFullSchemaForPublicApp(schema) {
  var questionsById = {};
  schema.questions.forEach(function (q) { questionsById[q.id] = q; });
  var payload = {
    surveyVersion: schema.surveyVersion,
    multiValueDelimiter: schema.multiValueDelimiter,
    conditions: schema.conditions,
    questions: schema.questions,
    questionsById: questionsById,
    responsesManagementColumns: schema.responsesManagementColumns,
    leadsColumns: schema.leadsColumns
  };
  return (
    '/*\n * ' + AUTO_GEN_NOTICE.split('\n').join('\n * ') + '\n' +
    ' *\n * 回答保存Web App（gas/ataru_survey_public/Code.gs の doPost）が使う完全なschema定義。\n' +
    ' * admin_only設問（Q24〜Q26）とleadsColumnsを含む＝保存には全設問の定義が必要なため。\n' +
    ' * 公開集計API（buildPublicResult, PublicAggregate.gs）はこの変数を一切参照しない。\n' +
    ' * このファイル自体はデータ定義のみで、条件評価関数は含まない\n' +
    ' * （PublicAggregate.gsが同一GASプロジェクト内で定義するevaluateCondition等を共用する）。\n */\n\n' +
    'var FullSurveySchema = ' + JSON.stringify(payload, null, 2) + ';\n'
  );
}

/* ── 9. gas/ataru_survey_public/ResponseNormalize.gs ──
   回答保存時に、クライアントが送ってきた値をdisplayConditionだけを根拠に再検証し、
   非到達設問の値を破棄してから保存行を組み立てるロジック（Issue #104 追加指示3）。 */
function buildResponseNormalizeGs(schema) {
  var normalizeSource = embedLibSource(readText(path.join(ROOT, 'scripts/lib/response-normalize.js')));
  return (
    '/*\n * ' + AUTO_GEN_NOTICE.split('\n').join('\n * ') + '\n' +
    ' *\n * 回答保存Web Appが、クライアントの回答をdisplayCondition基準で再検証し、\n' +
    ' * 非到達設問の値を破棄してから保存行を組み立てるための唯一の実装。\n' +
    ' * 性自認分岐・Q15分岐・Q4低関心分岐等を個別に手書きしない（schemaのconditionsを\n' +
    ' * 評価するだけで対応する）。conditionEval（PublicAggregate.gsが定義）に依存する。\n */\n\n' +
    normalizeSource + '\n'
  );
}

function targets(schema) {
  return [
    { file: path.join(ROOT, 'schema/responses-columns.json'), content: JSON.stringify(buildResponsesColumns(schema), null, 2) + '\n' },
    { file: path.join(ROOT, 'schema/leads-columns.json'), content: JSON.stringify(buildLeadsColumns(schema), null, 2) + '\n' },
    { file: path.join(ROOT, 'generated/survey-schema.front.js'), content: buildFrontJs(schema) },
    { file: path.join(ROOT, 'generated/survey-schema.public.gs'), content: buildPublicGs(schema) },
    { file: path.join(ROOT, 'gas/ataru_survey_admin/SurveySchema.gs'), content: buildAdminGs(schema) },
    { file: path.join(ROOT, 'gas/ataru_survey_public/PublicSchema.gs'), content: buildPublicSchemaForPublicApp(schema) },
    { file: path.join(ROOT, 'gas/ataru_survey_public/PublicAggregate.gs'), content: buildPublicAggregateGs(schema) },
    { file: path.join(ROOT, 'gas/ataru_survey_public/FullSchema.gs'), content: buildFullSchemaForPublicApp(schema) },
    { file: path.join(ROOT, 'gas/ataru_survey_public/ResponseNormalize.gs'), content: buildResponseNormalizeGs(schema) }
  ];
}

function main() {
  var check = process.argv.indexOf('--check') !== -1;
  var schema = loadSchema();
  var list = targets(schema);
  var mismatches = [];

  list.forEach(function (t) {
    fs.mkdirSync(path.dirname(t.file), { recursive: true });
    if (check) {
      var existing = fs.existsSync(t.file) ? readText(t.file) : null;
      if (existing !== t.content) mismatches.push(t.file);
    } else {
      fs.writeFileSync(t.file, t.content);
    }
  });

  if (check) {
    if (mismatches.length) {
      console.error('sync-survey-schema --check: 以下の生成物が survey-schema.json と一致しません（先に `node scripts/sync-survey-schema.js` を実行してください）:');
      mismatches.forEach(function (f) { console.error('  - ' + path.relative(ROOT, f)); });
      process.exit(1);
    }
    console.log('sync-survey-schema --check: OK（全生成物がsurvey-schema.jsonと一致）');
  } else {
    console.log('sync-survey-schema: 生成完了');
    list.forEach(function (t) { console.log('  - ' + path.relative(ROOT, t.file)); });
  }
}

if (require.main === module) {
  main();
}

module.exports = { loadSchema: loadSchema, targets: targets };
