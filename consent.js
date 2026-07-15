/* =====================================================================
   Visorium Studio – Cookie-samtycke (GDPR/ePrivacy)
   ---------------------------------------------------------------------
   Fristående: injicerar egen banner, egna stilar och egen logik.
   Lägg bara in <script src="consent.js?v=1"></script> före </body>.

   >>> SÅ HÄR AKTIVERAR DU SPÅRNING NÄR DU ÄR REDO <<<
   Fyll i ID:na nedan. Tills de är ifyllda laddas INGET spårningsskript
   (sajten fungerar precis som nu). När de är ifyllda laddas de först
   EFTER att besökaren godkänt rätt kategori.
   ===================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    gaId:      '',   // Google Analytics 4, t.ex. 'G-XXXXXXXXXX'  -> kategori: analys
    fbPixelId: ''    // Facebook/Instagram-pixel, t.ex. '123456789012345' -> kategori: marknadsföring
  };

  var STORAGE_KEY = 'visorium-consent';
  var VERSION = 1; // höj om du ändrar kategorierna -> tvingar omval

  // ---- Lagring -------------------------------------------------------
  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || c.v !== VERSION) return null;
      return c;
    } catch (e) { return null; }
  }
  function saveConsent(analytics, marketing) {
    var c = { v: VERSION, analytics: !!analytics, marketing: !!marketing, ts: Date.now() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  // ---- Spårningsskript (laddas bara efter samtycke) ------------------
  var loaded = { analytics: false, marketing: false };

  function loadGA() {
    if (loaded.analytics || !CONFIG.gaId) return;
    loaded.analytics = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CONFIG.gaId);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', CONFIG.gaId, { anonymize_ip: true });
  }

  function loadFBPixel() {
    if (loaded.marketing || !CONFIG.fbPixelId) return;
    loaded.marketing = true;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', CONFIG.fbPixelId);
    window.fbq('track', 'PageView');
  }

  function applyConsent(c) {
    if (!c) return;
    if (c.analytics) loadGA();
    if (c.marketing) loadFBPixel();
    processGates();
  }

  // ---- Gate: inbäddade videor/kartor/chatt ---------------------------
  // Använd så här i HTML (laddas först efter samtycke):
  //   <div data-consent-embed="marketing"
  //        data-embed-src="https://www.youtube.com/embed/XXXX"
  //        data-embed-title="Vår film"
  //        data-embed-ratio="56.25"></div>
  // Kategori "marketing" passar video/kartor; "analytics" finns också.
  function buildIframe(el, src, title, ratio) {
    var frame = document.createElement('iframe');
    frame.src = src;
    frame.title = title || 'Inbäddat innehåll';
    frame.loading = 'lazy';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:14px';
    el.style.position = 'relative';
    el.style.width = '100%';
    el.style.height = '0';
    el.style.paddingBottom = (ratio || '56.25') + '%';
    el.innerHTML = '';
    el.appendChild(frame);
    el.setAttribute('data-consent-loaded', '1');
  }

  function renderGatePlaceholder(el, cat) {
    var label = cat === 'analytics' ? 'statistik' : 'marknadsföring';
    el.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'vc-gate';
    box.innerHTML = '<strong>Innehåll kräver samtycke</strong>' +
      '<span>Det här innehållet laddas först när du godkänt cookies för ' + label + '.</span>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Godkänn och visa';
    btn.addEventListener('click', function () {
      var c = readConsent() || { v: VERSION, analytics: false, marketing: false };
      c[cat] = true;
      saveConsent(c.analytics, c.marketing);
      applyConsent(readConsent());
    });
    box.appendChild(btn);
    el.appendChild(box);
  }

  function processGates() {
    var nodes = document.querySelectorAll('[data-consent-embed]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-consent-loaded') === '1') continue;
      var cat = el.getAttribute('data-consent-embed') || 'marketing';
      var src = el.getAttribute('data-embed-src');
      if (!src) continue;
      var c = readConsent();
      if (c && c[cat]) {
        buildIframe(el, src, el.getAttribute('data-embed-title'), el.getAttribute('data-embed-ratio'));
      } else {
        renderGatePlaceholder(el, cat);
      }
    }
  }

  // Publikt API (för ev. manuell användning)
  //   window.VisoriumConsent.has('marketing')
  window.VisoriumConsent = {
    has: function (cat) { var c = readConsent(); return !!(c && c[cat]); },
    open: function () { openBanner(true); },
    refresh: function () { processGates(); }
  };

  // ---- UI ------------------------------------------------------------
  var STYLE = '\
  .vc-wrap{position:fixed;inset:auto 0 0 0;z-index:9999;display:flex;justify-content:center;padding:16px;pointer-events:none}\
  .vc-card{pointer-events:auto;width:100%;max-width:560px;background:#141414;color:#f4f5f7;\
    border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 24px 60px -20px rgba(0,0,0,.8);\
    padding:22px 22px 18px;font-family:Inter,-apple-system,system-ui,"Segoe UI",sans-serif;font-size:14.5px;line-height:1.55;\
    transform:translateY(12px);opacity:0;transition:transform .35s cubic-bezier(.2,.7,.2,1),opacity .35s}\
  .vc-wrap.vc-in .vc-card{transform:translateY(0);opacity:1}\
  .vc-title{font-family:"Space Grotesk",Inter,sans-serif;font-weight:700;font-size:1.05rem;margin:0 0 6px}\
  .vc-text{color:#c4c7cd;margin:0 0 14px}\
  .vc-text a{color:#5FE0FF;text-decoration:underline}\
  .vc-actions{display:flex;flex-wrap:wrap;gap:8px}\
  .vc-btn{cursor:pointer;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;border:1px solid transparent;font-family:inherit}\
  .vc-accept{background:#2D8EFF;color:#06101f;flex:1 1 auto}\
  .vc-accept:hover{background:#1B6FE0}\
  .vc-reject{background:transparent;color:#f4f5f7;border-color:rgba(255,255,255,.22)}\
  .vc-reject:hover{border-color:rgba(255,255,255,.45)}\
  .vc-custom{background:transparent;color:#a8acb5;border-color:transparent;text-decoration:underline;padding:10px 8px}\
  .vc-custom:hover{color:#f4f5f7}\
  .vc-prefs{margin:4px 0 14px;border-top:1px solid rgba(255,255,255,.1);padding-top:12px}\
  .vc-row{display:flex;align-items:flex-start;gap:12px;padding:8px 0}\
  .vc-row h4{margin:0 0 2px;font-size:14px;font-family:Inter,sans-serif;font-weight:600}\
  .vc-row p{margin:0;color:#9aa0a8;font-size:12.5px}\
  .vc-row .vc-grow{flex:1}\
  .vc-sw{position:relative;width:42px;height:24px;flex:0 0 auto;margin-top:2px}\
  .vc-sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}\
  .vc-sw input:disabled{cursor:not-allowed}\
  .vc-track{position:absolute;inset:0;background:#3a3a3a;border-radius:999px;transition:background .2s}\
  .vc-track:before{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:50%;transition:transform .2s}\
  .vc-sw input:checked + .vc-track{background:#2D8EFF}\
  .vc-sw input:checked + .vc-track:before{transform:translateX(18px)}\
  .vc-sw input:disabled + .vc-track{background:#2D8EFF;opacity:.55}\
  @media(max-width:520px){.vc-accept{flex:1 1 100%}.vc-reject{flex:1 1 100%}}\
  .vc-gate{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;\
    min-height:200px;padding:24px;background:#171717;border:1px dashed rgba(255,255,255,.18);border-radius:14px;\
    color:#c4c7cd;font-family:Inter,-apple-system,system-ui,sans-serif;font-size:14px}\
  .vc-gate strong{color:#f4f5f7;font-family:"Space Grotesk",Inter,sans-serif}\
  .vc-gate button{cursor:pointer;border:none;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:600;\
    background:#2D8EFF;color:#06101f;font-family:inherit}\
  .vc-gate button:hover{background:#1B6FE0}';

  var bannerEl = null;
  var showingPrefs = false;

  function buildBanner() {
    var style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.className = 'vc-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie-samtycke');
    wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = '\
      <div class="vc-card">\
        <h3 class="vc-title">Vi värnar om din integritet</h3>\
        <p class="vc-text">Vi använder nödvändiga cookies för att sajten ska fungera. Med ditt samtycke använder vi även cookies för statistik och marknadsföring. Läs mer i vår <a href="integritetspolicy.html">integritetspolicy</a>.</p>\
        <div class="vc-prefs" hidden>\
          <div class="vc-row">\
            <div class="vc-grow"><h4>Nödvändiga</h4><p>Krävs för att sajten ska fungera. Kan inte stängas av.</p></div>\
            <label class="vc-sw"><input type="checkbox" checked disabled aria-label="Nödvändiga (alltid på)"><span class="vc-track"></span></label>\
          </div>\
          <div class="vc-row">\
            <div class="vc-grow"><h4>Statistik</h4><p>Hjälper oss förstå hur sajten används (t.ex. Google Analytics).</p></div>\
            <label class="vc-sw"><input type="checkbox" id="vc-analytics" aria-label="Statistik"><span class="vc-track"></span></label>\
          </div>\
          <div class="vc-row">\
            <div class="vc-grow"><h4>Marknadsföring</h4><p>Används för annonser och mätning (t.ex. Facebook/Instagram-pixel).</p></div>\
            <label class="vc-sw"><input type="checkbox" id="vc-marketing" aria-label="Marknadsföring"><span class="vc-track"></span></label>\
          </div>\
        </div>\
        <div class="vc-actions">\
          <button class="vc-btn vc-accept" type="button">Acceptera alla</button>\
          <button class="vc-btn vc-reject" type="button">Endast nödvändiga</button>\
          <button class="vc-btn vc-custom" type="button">Anpassa</button>\
        </div>\
      </div>';
    document.body.appendChild(wrap);
    bannerEl = wrap;

    var prefs = wrap.querySelector('.vc-prefs');
    var saveBtn = wrap.querySelector('.vc-accept');
    var rejectBtn = wrap.querySelector('.vc-reject');
    var customBtn = wrap.querySelector('.vc-custom');
    var aIn = wrap.querySelector('#vc-analytics');
    var mIn = wrap.querySelector('#vc-marketing');

    function close() {
      wrap.classList.remove('vc-in');
      setTimeout(function () { wrap.remove(); bannerEl = null; }, 350);
    }

    customBtn.addEventListener('click', function () {
      showingPrefs = !showingPrefs;
      prefs.hidden = !showingPrefs;
      if (showingPrefs) {
        saveBtn.textContent = 'Spara val';
        customBtn.textContent = 'Acceptera alla';
        customBtn.classList.remove('vc-custom'); customBtn.classList.add('vc-reject');
      } else {
        saveBtn.textContent = 'Acceptera alla';
        customBtn.textContent = 'Anpassa';
        customBtn.classList.add('vc-custom'); customBtn.classList.remove('vc-reject');
      }
    });

    saveBtn.addEventListener('click', function () {
      var c;
      if (showingPrefs) c = saveConsent(aIn.checked, mIn.checked);
      else c = saveConsent(true, true);
      applyConsent(c); close();
    });

    rejectBtn.addEventListener('click', function () {
      // I prefs-läge blir denna "Acceptera alla"
      if (showingPrefs) { var c = saveConsent(true, true); applyConsent(c); close(); return; }
      var c2 = saveConsent(false, false); applyConsent(c2); close();
    });

    requestAnimationFrame(function () { wrap.classList.add('vc-in'); });
  }

  function openBanner(force) {
    if (bannerEl) return;            // redan öppen
    showingPrefs = false;
    buildBanner();
    if (force) {                     // förifyll med befintliga val
      var c = readConsent();
      if (c) {
        var a = bannerEl.querySelector('#vc-analytics');
        var m = bannerEl.querySelector('#vc-marketing');
        if (a) a.checked = c.analytics;
        if (m) m.checked = c.marketing;
        bannerEl.querySelector('.vc-custom').click(); // visa panelen direkt
      }
    }
  }

  // Footer-länk(ar): valfritt element med [data-cookie-settings]
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (t) { e.preventDefault(); openBanner(true); }
  });

  // ---- Start ---------------------------------------------------------
  function init() {
    var c = readConsent();
    if (c) { applyConsent(c); }      // tidigare val: ladda direkt, ingen banner
    else { openBanner(false); }      // inget val än: visa banner
    processGates();                  // rendera platshållare/iframes oavsett
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
