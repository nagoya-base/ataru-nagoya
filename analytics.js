/*
 * アタル GA4 計測ヘルパー。
 * ビルドなしの静的サイトのため、グローバルスクリプトとして読み込む。
 *
 * 送信するのはカテゴリ値のみ。氏名・メールアドレス・Xアカウント・希望メニュー・
 * 希望日時・自由記述などは一切送信しない（そもそも当サイトに入力フォームはない）。
 * 作例画像の実パス・ファイル名も送信しない。
 * gtag が未定義でも黙って何もしないため、計測がページ機能を止めることはない。
 *
 * 3リポジトリ（snb-community / Studio-nagoya-base / ataru-nagoya）共通の
 * イベント設計に統一している。新規にイベント名を追加する場合は、共通設計から
 * 外れていないか確認すること。
 *
 * 【成果イベント（キーイベント）について】
 * 現時点で generate_lead は実装しない。
 * 当サイトには予約・問い合わせフォームが存在せず、導線はメールリンクと X のリンクのみ。
 * リンクを開いたことは分かっても、実際に送信されたかをサイト側で判定できないため。
 * メール・X のクリックを成果イベントとして扱うと、送信していない離脱まで
 * 成果として計上してしまう。クリックは補助成果イベント outbound_contact_click
 * として計測する。
 *
 * 問い合わせフォームを設置した時点で、その送信成功をもって generate_lead を実装すること。
 */
(function () {
  'use strict';

  var isDebug = /(?:^|[?&])debug_mode=true(?:&|$)/.test(window.location.search);
  var sentOnce = {};

  function siteSection() {
    return (document.body && document.body.getAttribute('data-site-section')) || 'session';
  }

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
      site_brand: 'ataru',
      site_section: siteSection()
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

  /* セクションが画面に入ったら1回だけ section_view を送信する（section_id で判別）。
     threshold は 0 固定（背の高い可変セクションでも、上端が少しでも見えた時点で発火させるため）。 */
  function observeSectionOnce(selector, sectionId) {
    var target = document.querySelector(selector);
    if (!target || typeof window.IntersectionObserver !== 'function') return;

    var observer = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          trackOnce('section_view:' + sectionId, 'section_view', { section_id: sectionId });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0 });

    observer.observe(target);
  }

  /* リンククリック計測。data-ga-event を持つ要素をイベント委譲でまとめて拾う。 */
  function handleDelegatedClick(event) {
    var el = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-ga-event]')
      : null;
    if (!el) return;

    var eventName = el.getAttribute('data-ga-event');
    var location = el.getAttribute('data-ga-location') || 'other';
    var params = { cta_location: location };

    if (eventName === 'outbound_contact_click') {
      params.channel = el.getAttribute('data-ga-channel') || 'unknown';
    } else if (eventName === 'cta_click') {
      params.cta_name = el.getAttribute('data-ga-type') || 'unknown';
    }

    track(eventName, params);
  }

  function initFaqOpenTracking() {
    var items = document.querySelectorAll('.faq-item[data-ga-faq-id]');
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (item.open) track('faq_open', { faq_id: item.getAttribute('data-ga-faq-id') });
      });
    });
  }

  /* 作例画像を開いた時（補助イベント）。画像パスは送らずカテゴリと並び順のみ送る。 */
  function initGalleryOpenTracking() {
    var items = document.querySelectorAll('.gallery-item');
    items.forEach(function (item, index) {
      item.addEventListener('click', function () {
        track('gallery_open', {
          gallery_category: item.getAttribute('data-ga-category') || 'unknown',
          gallery_item: index + 1
        });
      });
    });
  }

  document.addEventListener('click', handleDelegatedClick);

  observeSectionOnce('#session', 'session');
  observeSectionOnce('#pricing', 'price');
  observeSectionOnce('#gallery', 'gallery');
  observeSectionOnce('#schedule', 'access');
  observeSectionOnce('#notice', 'notice');
  observeSectionOnce('#faq', 'faq');
  observeSectionOnce('#contact', 'contact');
  initFaqOpenTracking();
  initGalleryOpenTracking();

  window.AtaruAnalytics = { track: track };
})();
