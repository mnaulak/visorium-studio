/* ===================================================================
   Visorium Studio — experience.js
   JS-lagret för de filmiska interaktionerna som CSS inte klarar själv:

     1. Scroll-progressbar  — fallback för webbläsare utan CSS scroll-timeline
                              (Safari/Firefox); uppdaterar --scrollp på <html>.
     2. 3D-tilt + glans     — alla kort lutar mot muspekaren med en ljusglans
                              som följer pekaren (insane 3D interactions).
     3. Magnetiska knappar  — primära knappar dras mjukt mot pekaren.
     4. Count-up-siffror    — statistik som "10+" räknas upp när den syns.
     5. Aurora-glöd         — ett mjukt ljus som följer muspekaren över sidan.

   Allt är progressiv förbättring: pekskärmar och prefers-reduced-motion
   får en lugn, statisk upplevelse utan att något går sönder.
   =================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  /* ----------------------------------------------------------------
   * 1. Scroll-progressbar — JS-fallback via CSS-variabeln --scrollp.
   *    I webbläsare med scroll-timeline vinner CSS-animationen ändå.
   * ---------------------------------------------------------------- */
  (function progressBar() {
    if (reduced) return;
    var raf = 0;
    function update() {
      raf = 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      document.documentElement.style.setProperty('--scrollp', p.toFixed(4));
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();

  /* ----------------------------------------------------------------
   * 2. 3D-tilt med glans på alla kort (.card, .work).
   *    Kortet lutar mot pekaren; en radial ljusglans följer med.
   * ---------------------------------------------------------------- */
  (function tiltCards() {
    if (reduced || !finePointer) return;
    var MAX_TILT = 6; // grader – tydligt 3D men aldrig svajigt

    function attach(el) {
      var glare = document.createElement('span');
      glare.className = 'tilt-glare';
      glare.setAttribute('aria-hidden', 'true');
      el.appendChild(glare);

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        var rx = (0.5 - py) * MAX_TILT * 2;
        var ry = (px - 0.5) * MAX_TILT * 2;
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px)';
        el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    }

    var els = document.querySelectorAll('.card, .work');
    Array.prototype.forEach.call(els, attach);
  })();

  /* ----------------------------------------------------------------
   * 3. Magnetiska knappar — primära CTA:er dras mjukt mot pekaren.
   * ---------------------------------------------------------------- */
  (function magneticButtons() {
    if (reduced || !finePointer) return;
    var STRENGTH = 5; // px max-förflyttning – subtil men levande

    Array.prototype.forEach.call(document.querySelectorAll('.btn-accent, .to-top, .aig-launch'), function (el) {
      el.classList.add('magnetic');
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        var dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        el.style.setProperty('--mag-x', (dx * STRENGTH).toFixed(1) + 'px');
        el.style.setProperty('--mag-y', (dy * STRENGTH).toFixed(1) + 'px');
      });
      el.addEventListener('mouseleave', function () {
        el.style.setProperty('--mag-x', '0px');
        el.style.setProperty('--mag-y', '0px');
      });
    });
  })();

  /* ----------------------------------------------------------------
   * 4. Count-up — siffror som "10+" räknas upp när de blir synliga.
   *    Endast rena tal (ev. med +) animeras; text som "B2B" lämnas.
   * ---------------------------------------------------------------- */
  (function countUp() {
    var els = document.querySelectorAll('.stat-num');
    if (!els.length) return;

    function animate(el, end, suffix) {
      var DURATION = 1400;
      var t0 = null;
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / DURATION);
        var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = Math.round(end * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    var targets = [];
    Array.prototype.forEach.call(els, function (el) {
      var m = /^(\d+)(\+?)$/.exec(el.textContent.trim());
      if (m) targets.push({ el: el, end: parseInt(m[1], 10), suffix: m[2] });
    });
    if (!targets.length) return;

    if (reduced || !('IntersectionObserver' in window)) return; // originaltexten står redan där

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var t = null;
        targets.forEach(function (x) { if (x.el === en.target) t = x; });
        if (t) { t.el.textContent = '0' + t.suffix; animate(t.el, t.end, t.suffix); }
      });
    }, { threshold: 0.5 });
    targets.forEach(function (t) { io.observe(t.el); });
  })();

  /* ----------------------------------------------------------------
   * 4b. Aura-integration: EN bakgrundsvideo bakom HELA sidan (fixed).
   *     "Spiralen" följer med från topp till botten, konsekvent nyans.
   *     Ett ljust lager läggs över så sajten förblir ljus och läsbar.
   *     Hoppar över spardata-läge och reducerad rörelse (där räcker den
   *     stillsamma varma bas-gradienten). Desktop/tablet – på små
   *     telefoner hålls basen stilla för prestanda/datasparande.
   * ---------------------------------------------------------------- */
  (function siteBackground() {
    if (reduced) return;
    if (window.innerWidth < 768) return;
    var conn = navigator.connection;
    if (conn && conn.saveData) return;
    if (document.querySelector('.site-bgfx')) return;
    var SRC = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4';
    var wrap = document.createElement('div');
    wrap.className = 'site-bgfx';
    wrap.setAttribute('aria-hidden', 'true');
    var v = document.createElement('video');
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    // Dekorativ bakgrund: inga kontroller, ingen Picture-in-Picture, ingen
    // cast/skip-knapp – de svarta symbolerna ska aldrig dyka upp.
    v.controls = false;
    v.disablePictureInPicture = true;
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('disableremoteplayback', '');
    v.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback noplaybackrate');
    v.setAttribute('tabindex', '-1');
    v.style.pointerEvents = 'none';
    v.src = SRC;
    var veil = document.createElement('div');
    veil.className = 'site-bgfx-veil';
    wrap.appendChild(v);
    wrap.appendChild(veil);
    document.body.insertBefore(wrap, document.body.firstChild);
    v.addEventListener('canplay', function () { v.classList.add('is-on'); });
    v.play().catch(function () { /* autoplay-block: varma basen racker */ });
  })();

  /* ----------------------------------------------------------------
   * 5. Aurora-glöd som följer muspekaren över hela sidan.
   *    Mjuk lerp så ljuset "flyter" efter istället för att rycka.
   * ---------------------------------------------------------------- */
  (function auroraCursor() {
    if (reduced || !finePointer) return;
    var glow = document.createElement('div');
    glow.className = 'aura-cursor';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    var mx = window.innerWidth / 2, my = window.innerHeight / 3;
    var gx = mx, gy = my;
    var running = false;

    function frame() {
      gx += (mx - gx) * 0.08;
      gy += (my - gy) * 0.08;
      glow.style.transform = 'translate(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px)';
      if (Math.abs(mx - gx) + Math.abs(my - gy) > 0.5) {
        requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      glow.classList.add('is-on');
      if (!running) { running = true; requestAnimationFrame(frame); }
    }, { passive: true });
  })();
})();
