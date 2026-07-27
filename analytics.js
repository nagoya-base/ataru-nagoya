/*
 * アタル GA4 計測ヘルパー。
 * ビルドなしの静的サイトのため、グローバルスクリプトとして読み込む。
 *
 * 送信するのはカテゴリ値のみ。氏名・メールアドレス・Xアカウント・希望メニュー・
 * 希望日時・自由記述などは一切送信しない（そもそも当サイトに入力フォームはない）。
 * gtag が未定義でも黙って何もしないため、計測がページ機能を止めることはない。
 *
 * 【成果イベント（キーイベント）について】
 * 現時点で reservation_submit / reservation_complete / generate_lead は実装しない。
 * 当サイトには予約・問い合わせフォームが存在せず、導線はメールリンクと X のリンクのみ。
 * リンクを開いたことは分かっても、実際に送信されたかをサイト側で判定できないため。
 * メール・X のクリックを成果イベントとして扱うと、送信していない離脱まで
 * 成果として計上してしまう。クリックは分析用イベント（mail_click /
 * consultation_x_click）として計測する。
 *
 * 予約・問い合わせフォームを設置した時点で、その送信成功をもって
 * reservation_submit / generate_lead を実装すること。
 */
(function () {
  'use strict';

  var SITE_SECTION = 'ataru';

  var isDebug = /(?:^|[?&])debug_mode=true(?:&|$)/.test(window.location.search);
  var sentOnce = {};
  /* ataru_form_submit_* の二重送信防止用。送信成功1回につき1件だけ記録する。 */
  var submittedTokens = {};

  function isTrackableEnvironment() {
    if (isDebug) return true;
    var protocol = window.location.protocol;
    var hostname = window.location.hostname;
    if (protocol === 'file:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    return true;
  }

  function track(eventName, params) {
    if (!eventName || !isTrackableEnvironment()) return;

    var payload = {
      site_section: SITE_SECTION,
      page_path: window.location.pathname
    };
    if (params) {
      for (var key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) payload[key] = params[key];
      }
    }
    if (isDebug) {
      payload.debug_mode = true;
      console.debug('[AtaruAnalytics]', eventName, payload);
    }

    if (typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', eventName, payload);
    } catch (e) {
      /* GA4送信失敗でもページ機能は継続する */
    }
  }

  function trackOnce(key, eventName, params) {
    if (sentOnce[key]) return;
    sentOnce[key] = true;
    track(eventName, params);
  }

  /* セクションが画面に入ったら1回だけ送信する（閲覧イベント） */
  function observeSectionOnce(selector, eventName, params) {
    var target = document.querySelector(selector);
    if (!target || typeof window.IntersectionObserver !== 'function') return;

    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          trackOnce(eventName, eventName, params);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    observer.observe(target);
  }

  /* リンククリック計測。data-ga-event を持つ要素をイベント委譲でまとめて拾う。 */
  function handleDelegatedClick(event) {
    var el = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-ga-event]')
      : null;
    if (!el) return;

    track(el.getAttribute('data-ga-event'), {
      cta_location: el.getAttribute('data-ga-location') || 'other',
      link_destination: el.getAttribute('data-ga-destination') || 'unknown'
    });
  }

  function initFaqOpenTracking() {
    var items = document.querySelectorAll('.faq-item[data-ga-faq-id]');
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (item.open) track('faq_open', { faq_id: item.getAttribute('data-ga-faq-id') });
      });
    });
  }

  /* 作例画像を開いた時（分析用イベント）。画像パスは送らず並び順のみ送る。 */
  function initGalleryOpenTracking() {
    var items = document.querySelectorAll('.gallery-item');
    items.forEach(function (item, index) {
      item.addEventListener('click', function () {
        track('gallery_open', {
          gallery_category: item.getAttribute('data-ga-category') || 'unknown',
          gallery_index: index + 1
        });
      });
    });
  }

  document.addEventListener('click', handleDelegatedClick);

  observeSectionOnce('#session', 'menu_view', { section_id: 'session' });
  observeSectionOnce('#pricing', 'pricing_view', { section_id: 'pricing' });
  observeSectionOnce('#gallery', 'gallery_view', { section_id: 'gallery' });
  observeSectionOnce('#schedule', 'access_view', { section_id: 'schedule' });
  observeSectionOnce('#notice', 'notice_view', { section_id: 'notice' });
  observeSectionOnce('#faq', 'faq_view', { section_id: 'faq' });
  observeSectionOnce('#contact', 'contact_view', { section_id: 'contact' });
  initFaqOpenTracking();
  initGalleryOpenTracking();

  window.AtaruAnalytics = {
    track: track,
    /* キーイベント。#contact フォームのPOSTが成功した時だけ呼ぶこと。
       送信ボタンのクリックやバリデーション通過、送信開始では呼ばない。
       submissionToken は1回の送信操作ごとに一意な値。同じトークンでは二度送信しない。 */
    trackFormSubmit: function (submissionToken, intent, params) {
      var token = String(submissionToken);
      if (submittedTokens[token]) return;
      submittedTokens[token] = true;

      var eventName = intent === 'booking' ? 'ataru_form_submit_booking' : 'ataru_form_submit_consult';
      track(eventName, params);
    }
  };
})();
