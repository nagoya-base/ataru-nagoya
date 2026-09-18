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

  /* 101件以上で公開API側が返し得る詳細設問の表示ラベル。公開集計APIレスポンス自体には
     ラベルを含めない（レスポンスを構造的に最小化するため）。この一覧はgateOpen=trueの
     ときにAPIが実際に返したキーだけを描画するために使う（未知のキーを推測して表示しない）。
     survey-schema.json（正本）のlabel/subLabelと同じ文言。 */
  var DETAIL_ORDER = [
    'Q5', 'Q6', 'Q6-A',
    'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q13-A', 'Q13-B', 'Q14A', 'Q14B',
    'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20A', 'Q20B', 'Q20C', 'Q20D', 'Q21', 'Q22', 'Q23'
  ];
  var DETAIL_LABELS = {
    'Q5': '緊縛では、どんな楽しみ方に関心がありますか',
    'Q6': '緊縛では、どの立場に関心がありますか',
    'Q6-A': '今後の企画との関わり方',
    'Q7': '現在または過去に経験したスポーツ（男性）',
    'Q8': '現在の運動状況（男性）',
    'Q9': 'ジム・筋力トレーニング頻度（男性）',
    'Q10': 'スポーツ・身体づくりの動機（男性）',
    'Q11': '好きなユニフォーム・ウェア（男性）',
    'Q12': '最も好きなユニフォーム（男性）',
    'Q13': 'ユニフォームの楽しみ方（男性）',
    'Q13-A': '自分で着たいユニフォーム（男性）',
    'Q13-B': '人に着てほしい・見たいユニフォーム（男性）',
    'Q14A': '自分に当てはまる特徴（男性）',
    'Q14B': '相手の見た目についての好み（男性）',
    'Q15': '続く企画への回答意向',
    'Q16': '興味のある企画',
    'Q17': '緊縛・ロープの経験',
    'Q18': 'ユニフォーム姿と緊縛を組み合わせた撮影',
    'Q19': '興味のある緊縛範囲',
    'Q20A': '男性向け企画で関心のある詳細内容（A. ユニフォーム・作品表現）',
    'Q20B': '男性向け企画で関心のある詳細内容（B. 吊り・強度）',
    'Q20C': '男性向け企画で関心のある詳細内容（C. SM・性的な責め）',
    'Q20D': '男性向け企画で関心のある詳細内容（D. その他）',
    'Q21': '体験時に重視する条件',
    'Q22': '名古屋での参加可能性',
    'Q23': '参加しやすい曜日・時間'
  };

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
    var label = DETAIL_LABELS[id] || id;
    var section = h('div', { class: 'q-block' }, h('h2', { text: label }));
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
      DETAIL_ORDER.forEach(function (id) {
        if (!data.detail[id]) return;
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
