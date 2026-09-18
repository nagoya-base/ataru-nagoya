/*
 * survey-results.html 用の公開結果ページスクリプト（Issue #104）。
 *
 * ブラウザへは公開集計API（gas/ataru_survey_public/ の doGet）が返す集計済みJSONだけを表示する。
 * 個票は一切扱わない。有効回答数が100件以下の間はAPIレスポンス自体にdetailキーが
 * 存在しないため、このスクリプトも「存在しないものは描画しない」だけで、
 * Q5〜Q26相当の設問名・見出し・カテゴリ名・「準備中」カード等をフロント側で一切構築しない
 * （フロント側でハードコードした非公開設問一覧を後から隠す実装はしない）。
 *
 * 5人未満マスキング・補完的抑制・100件ゲート・半数以下ブロック非公開の判定はすべて
 * 公開API側（scripts/lib/public-aggregate.js）で完了済みの値をそのまま表示するだけで、
 * このスクリプトはマスキング前の値を一切持たない。
 */
window.__SurveyResults = {};

(function () {
  'use strict';

  /* gas/ataru_survey_public/ をWebアプリとしてデプロイしたURL（survey.jsのGAS_ENDPOINTと同一）。
     デプロイ後に実際のURLへ置き換えること（手動設定が必要）。 */
  var GAS_RESULTS_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_WITH_DEPLOYED_ATARU_SURVEY_PUBLIC_ID/exec';

  /* 詳細設問の表示ラベル・表示順は、このファイルにハードコードしない。
     公開集計APIは有効回答数が100件以下の間は`detail`キー自体をレスポンスに含めず、
     101件を超えてから初めて `detail.Q5.label` のように設問ごとのラベルを返す
     （scripts/lib/public-aggregate.js の buildDetail() 参照）。そのため、100件以下の
     クライアントに対しては設問名を推測できる情報がこのスクリプト自身にも一切存在しない
     （Issue #104 追加指示8・PR #110レビュー対応）。表示順は `data.detail` オブジェクトの
     キー挿入順（=schemaのQ5〜Q23の定義順。buildDetail()がschema.questionsを順に走査して
     組み立てるため）をそのまま使う。 */

  function h(tag, props) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    children.forEach(function (c) {
      if (c === null || c === undefined) return;
      if (Array.isArray(c)) { c.forEach(function (cc) { if (cc) node.appendChild(cc); }); return; }
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function pctText(pct) {
    return Math.round((pct || 0) * 1000) / 10 + '%';
  }

  function renderOptionList(block) {
    var wrap = h('div');
    (block.options || []).forEach(function (o) {
      wrap.appendChild(h('div', { class: 'opt-row' },
        h('span', { class: 'opt-name', text: o.value }),
        h('span', { class: 'opt-num', text: o.count + '人（' + pctText(o.pct) + '）' })
      ));
    });
    if (block.otherSmall) {
      wrap.appendChild(h('div', { class: 'opt-row' },
        h('span', { class: 'opt-name', text: 'その他少数' }),
        h('span', { class: 'opt-num', text: block.otherSmall.count + '人（' + pctText(block.otherSmall.pct) + '）' })
      ));
    }
    if (!block.options.length && !block.otherSmall) {
      wrap.appendChild(h('p', { class: 'hidden-note', text: 'まだ回答数が少ないため、内訳は表示していません。' }));
    }
    return wrap;
  }

  function renderOverviewBlock(title, block) {
    var section = h('div', { class: 'q-block' }, h('h2', { text: title }));
    if (!block || block.hidden) {
      section.appendChild(h('p', { class: 'hidden-note', text: 'まだ回答数が少ないため、内訳は表示していません。' }));
      return section;
    }
    section.appendChild(renderOptionList(block));
    return section;
  }

  function renderDetailBlock(id, block) {
    var section = h('div', { class: 'q-block' }, h('h2', { text: block.label || id }));
    if (block.hidden) {
      section.appendChild(h('p', { class: 'hidden-note', text: 'この設問は、まだ内訳を公開できる人数に達していません。' }));
      return section;
    }
    section.appendChild(renderOptionList(block));
    section.appendChild(h('p', { class: 'target-note' },
      '対象回答者：' + block.targetCount + '人',
      h('br'),
      '※この設問は、アンケートの分岐条件によりこの質問へ到達した人だけを分母にしています。'
    ));
    return section;
  }

  /* 公開集計APIレスポンス（data）だけを根拠にDOMを組み立てる純粋関数。
     テストしやすいよう、fetch呼び出しとは分離している。 */
  function renderResultData(root, data) {
    root.innerHTML = '';

    root.appendChild(h('p', { class: 'stat-line' }, '有効回答数：', h('strong', { text: String(data.effectiveCount) }), '人'));

    if (data.overviewLowN) {
      root.appendChild(h('div', { class: 'notice-box' },
        h('p', { text: 'まだ回答数が少ないため、内訳は一部表示していません。回答が集まり次第、公開できる範囲を更新します。' })
      ));
    }

    if (!data.gateOpen) {
      root.appendChild(h('div', { class: 'notice-box' },
        h('p', { text: '現在は回答への影響を避けるため、概要のみ公開しています。詳細結果は回答数が100件を超えた時点で公開します。' })
      ));
    }

    var overviewWrap = h('div', { class: 'card', style: 'margin-top:1rem;padding:1.5rem;' });
    overviewWrap.appendChild(renderOverviewBlock('年代', data.overview && data.overview.Q1));
    overviewWrap.appendChild(renderOverviewBlock('居住地域', data.overview && data.overview.Q3));
    overviewWrap.appendChild(renderOverviewBlock('緊縛・ロープ表現への関心', data.overview && data.overview.Q4));
    root.appendChild(overviewWrap);

    if (data.detail) {
      var detailWrap = h('div', { class: 'card', style: 'margin-top:1rem;padding:1.5rem;' }, h('h2', { text: '詳細結果' }));
      /* data.detail のキー順は公開API側（buildDetail()）がschemaの定義順で組み立てたもの。
         フロント側で表示順を別途持たない。 */
      Object.keys(data.detail).forEach(function (id) {
        detailWrap.appendChild(renderDetailBlock(id, data.detail[id]));
      });
      root.appendChild(detailWrap);
    }

    if (data.suppressionApplied) {
      root.appendChild(h('div', { class: 'notice-box' },
        h('p', { text: 'プライバシー保護のため、回答数が少ない選択肢は非表示またはまとめて表示しています。そのため、表示されている内訳の合計が有効回答数と一致しない場合があります。' })
      ));
    }
  }

  function fetchResults() {
    return fetch(GAS_RESULTS_ENDPOINT + '?action=results').then(function (res) {
      if (!res.ok) throw new Error('results_http_error');
      return res.json();
    });
  }

  function init() {
    var loading = document.getElementById('loading-state');
    var errorEl = document.getElementById('error-state');
    var root = document.getElementById('result-root');
    if (!root) return;

    fetchResults().then(function (data) {
      loading.hidden = true;
      root.hidden = false;
      renderResultData(root, data);
    }).catch(function () {
      loading.hidden = true;
      errorEl.hidden = false;
    });
  }

  window.__SurveyResults = {
    GAS_RESULTS_ENDPOINT: GAS_RESULTS_ENDPOINT,
    renderResultData: renderResultData,
    init: init
  };

  if (typeof document !== 'undefined' && document.getElementById) init();
})();
