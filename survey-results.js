/*
 * survey-results.html 用の公開結果ページスクリプト。
 * 最終スナップショットを優先し、静的JSONが未配置（404）または取得不能の場合だけ
 * 既存の公開集計GASへフォールバックする。
 */
window.__SurveyResults = {};

(function () {
  'use strict';

  var FINAL_RESULTS_URL = 'data/survey-results-final.json';
  var GAS_RESULTS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx4AZkbIbJwpMUeraaKQGOtbd7dEYGWjXAgSlkAd-AR1f39XMxVCxaXSVfm6wEWl7qy2Q/exec';

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
    var v = Number(pct);
    return Math.round((isFinite(v) ? v : 0) * 1000) / 10 + '%';
  }

  function barWidth(pct) {
    var v = Number(pct);
    if (!isFinite(v) || v <= 0) return 0;
    return Math.min(100, Math.round(v * 1000) / 10);
  }

  function optionRow(name, count, pct) {
    return h('div', { class: 'opt-row' },
      h('div', { class: 'opt-meta' },
        h('span', { class: 'opt-name', text: name }),
        h('span', { class: 'opt-num', text: count + '人（' + pctText(pct) + '）' })),
      h('div', { class: 'result-bar-track', 'aria-hidden': 'true' },
        h('div', { class: 'result-bar-fill', style: 'width:' + barWidth(pct) + '%' })));
  }

  function optionsByCountDesc(options) {
    return (options || []).map(function (o, i) {
      return { o: o, i: i, c: Number(o.count) || 0 };
    }).sort(function (a, b) { return (b.c - a.c) || (a.i - b.i); })
      .map(function (x) { return x.o; });
  }

  function renderOptionList(block) {
    var wrap = h('div');
    optionsByCountDesc(block.options).forEach(function (o) {
      wrap.appendChild(optionRow(o.value, o.count, o.pct));
    });
    if (block.otherSmall) {
      wrap.appendChild(optionRow('その他少数', block.otherSmall.count, block.otherSmall.pct));
    }
    if (!(block.options || []).length && !block.otherSmall) {
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

  function fetchGasResults() {
    return fetch(GAS_RESULTS_ENDPOINT + '?action=results').then(function (res) {
      if (!res.ok) throw new Error('results_http_error');
      return res.json();
    });
  }

  function fetchResults() {
    return fetch(FINAL_RESULTS_URL).then(function (res) {
      if (res.ok) return res.json();
      if (res.status === 404) return fetchGasResults();
      throw new Error('final_results_http_error');
    }, function () {
      return fetchGasResults();
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
    FINAL_RESULTS_URL: FINAL_RESULTS_URL,
    GAS_RESULTS_ENDPOINT: GAS_RESULTS_ENDPOINT,
    fetchResults: fetchResults,
    renderResultData: renderResultData,
    init: init
  };

  if (typeof document !== 'undefined' && document.getElementById) init();
})();
