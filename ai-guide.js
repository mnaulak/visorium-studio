// ===== Visorium Studio — AI-guide (regelbaserad paketrekommendation) =====
// Fristående widget. Ändrar inget i script.js – den läser/skriver bara i DOM:en
// (kryssar rätt typ, fyller beskrivning, byter läge och skrollar till kontakt).
(function () {
  'use strict';

  // Kategorier per läge. "typ" MÅSTE matcha checkbox-värdena i offertformuläret exakt.
  var CATS = {
    foretag: [
      { id: 'reklamfilm',       label: 'Reklamfilm',        typ: 'Filmproduktion' },
      { id: 'foretagsfilm',     label: 'Företagsfilm',      typ: 'Företagsfilm / kommunikationsfilm' },
      { id: 'event',            label: 'Event / konferens', typ: 'Event / konferens' },
      { id: 'produktfoto',      label: 'Produktfoto',       typ: 'Produktfoto' },
      { id: 'foretagsportratt', label: 'Företagsporträtt',  typ: 'Företagsporträtt' },
      { id: 'fotofilm',         label: 'Foto + film',       typ: 'Foto + film i kombination' },
      { id: 'annat',            label: 'Annat',             typ: 'Annat' }
    ],
    privat: [
      { id: 'portratt', label: 'Porträtt',            typ: 'Porträtt / personligt varumärke' },
      { id: 'familj',   label: 'Familj & barn',       typ: 'Familjefotografering' },
      { id: 'gravid',   label: 'Gravid / nyfödd',     typ: 'Gravid / nyfödd' },
      { id: 'brollop',  label: 'Bröllop',             typ: 'Bröllop' },
      { id: 'kalas',    label: 'Event / kalas',       typ: 'Event (dop, kalas, examen)' },
      { id: 'annat',    label: 'Annat',               typ: 'Annat' }
    ]
  };

  var PKGS = {
    foretag: {
      signature: { name: 'Signature', price: 'från 6 000 kr' },
      essential: { name: 'Essential', price: 'från 9 000 kr' },
      prestige:  { name: 'Prestige',  price: 'från 13 500 kr' }
    },
    privat: {
      portratt: { name: 'Porträtt',        price: 'från 2 500 kr' },
      familj:   { name: 'Familj & barn',   price: 'från 4 000 kr' },
      brollop:  { name: 'Bröllop & event', price: 'timbaserat · pris per timme' }
    }
  };

  // Budgetalternativ per läge (matchar formulärets select-texter så vi kan förifylla).
  var BUDGETS = {
    foretag: ['Under 6 000 kr', '6 000 – 9 000 kr', '9 000 – 13 500 kr', '13 500 – 25 000 kr', 'Osäker / vill ha råd'],
    privat:  ['Under 2 500 kr', '2 500 – 4 000 kr', '4 000 – 10 000 kr', '10 000 kr + (bröllop & event, timbaserat)', 'Osäker / vill ha råd']
  };

  // Nyckelord som pekar mot ett större/mer omfattande paket.
  var BIG_WORDS = /(kampanj|lansering|flera videor|reels|heldag|hela dagen|stort event|mässa|drönare|flera platser|serie|återkommande|webshop|hela teamet|många produkter)/i;
  var SMALL_WORDS = /(enkel|snabb|litet|en bild|några bilder|bara ett|kort|test|liten budget)/i;

  // ---- Rekommendationsmotor ----
  function recommend(mode, cat, text, budget) {
    text = text || '';
    var big = BIG_WORDS.test(text);
    var small = SMALL_WORDS.test(text);
    var reasons = [];
    var key;

    if (mode === 'foretag') {
      var base = { reklamfilm: 'essential', foretagsfilm: 'essential', event: 'essential',
        produktfoto: 'signature', foretagsportratt: 'signature', fotofilm: 'essential', annat: 'essential' };
      key = base[cat.id] || 'essential';

      if (budget === 'Under 6 000 kr') key = 'signature';
      else if (budget === '13 500 – 25 000 kr') key = 'prestige';
      if (big && key !== 'prestige') key = key === 'signature' ? 'essential' : 'prestige';
      if (small && key === 'essential') key = 'signature';

      reasons.push('Passar ' + cat.label.toLowerCase() + ' – rätt balans mellan foto och film för ändamålet.');
      if (key === 'prestige') reasons.push('Fullt produktionspaket med flera videor och kampanjmaterial för alla kanaler.');
      else if (key === 'essential') reasons.push('Mest innehåll för pengarna – populärast för kampanjer och löpande behov.');
      else reasons.push('Ett komplett startskott utan att överinvestera – enkelt att skala upp senare.');
    } else {
      var pbase = { portratt: 'portratt', familj: 'familj', gravid: 'familj', brollop: 'brollop', kalas: 'brollop', annat: 'portratt' };
      key = pbase[cat.id] || 'portratt';

      reasons.push(cat.label + ' ingår i vårt ' + PKGS.privat[key].name + '-paket – handredigerade, högupplösta bilder.');
      if (key === 'brollop') reasons.push('Timbaserat upplägg – ni betalar per timme och vi räknar fram en offert utifrån er dag. Förmöte ingår.');
      else if (key === 'familj') reasons.push('Avslappnat tempo som funkar bra även med barn, privat galleri att dela med släkten.');
      else reasons.push('Personlig guidning under passet – perfekt för CV, LinkedIn och sociala medier.');
    }

    if (budget && budget !== 'Osäker / vill ha råd') reasons.push('Ligger i linje med din budget (' + budget + ').');
    else if (budget === 'Osäker / vill ha råd') reasons.push('Osäker på budget? Vi går igenom upplägget tillsammans utan kostnad.');
    if (big) reasons.push('Vi läste att projektet är lite större – förslaget täcker det med marginal.');

    return { key: key, pkg: PKGS[mode][key], reasons: reasons };
  }

  // ---- Bygg widget ----
  var launcher = document.getElementById('aigLaunch');
  var modal = document.getElementById('aiGuide');
  if (!launcher || !modal) return;

  var body = modal.querySelector('.aig-body');
  var dots = Array.prototype.slice.call(modal.querySelectorAll('.aig-dot'));

  var state = { mode: null, cat: null, text: '', budget: '' };
  var lastFocus = null;

  function setDots(i) { dots.forEach(function (d, idx) { d.classList.toggle('active', idx <= i); }); }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Steg 1: privat eller företag
  function renderStep1() {
    setDots(0);
    body.innerHTML =
      '<div class="aig-step active">' +
      '<p class="aig-q">Vem gör du det här för?</p>' +
      '<div class="aig-bigchoice">' +
        '<button type="button" data-mode="foretag"><span class="aig-bc-title">Företag</span><span class="aig-bc-sub">Reklam, event, film & foto för verksamheten</span></button>' +
        '<button type="button" data-mode="privat"><span class="aig-bc-title">Privat</span><span class="aig-bc-sub">Porträtt, familj, bröllop & event</span></button>' +
      '</div></div>';
    body.querySelectorAll('[data-mode]').forEach(function (b) {
      b.addEventListener('click', function () { state.mode = b.getAttribute('data-mode'); state.cat = null; renderStep2(); });
    });
  }

  // Steg 2: kategori
  function renderStep2() {
    setDots(1);
    var chips = CATS[state.mode].map(function (c) {
      return '<button type="button" class="aig-chip' + (state.cat && state.cat.id === c.id ? ' selected' : '') +
        '" data-cat="' + c.id + '">' + esc(c.label) + '</button>';
    }).join('');
    body.innerHTML =
      '<div class="aig-step active">' +
      '<p class="aig-q">Vad gäller det?</p>' +
      '<div class="aig-chips">' + chips + '</div>' +
      '<div class="aig-nav">' +
        '<button type="button" class="aig-btn aig-btn-ghost" data-back>← Tillbaka</button>' +
        '<button type="button" class="aig-btn aig-btn-accent" data-next disabled>Nästa →</button>' +
      '</div></div>';
    var nextBtn = body.querySelector('[data-next]');
    body.querySelectorAll('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        body.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
        state.cat = CATS[state.mode].filter(function (c) { return c.id === b.getAttribute('data-cat'); })[0];
        nextBtn.disabled = false;
      });
    });
    body.querySelector('[data-back]').addEventListener('click', renderStep1);
    nextBtn.addEventListener('click', function () { if (state.cat) renderStep3(); });
  }

  // Steg 3: beskrivning + budget
  function renderStep3() {
    setDots(2);
    var opts = '<option value="">Välj budget (valfritt)</option>' +
      BUDGETS[state.mode].map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('');
    body.innerHTML =
      '<div class="aig-step active">' +
      '<p class="aig-q">Beskriv kort ditt projekt</p>' +
      '<label class="aig-field"><span>Vad vill du ha hjälp med?</span>' +
        '<textarea id="aigText" rows="4" placeholder="' +
        (state.mode === 'foretag'
          ? 'T.ex. lanseringsfilm för ny produkt + bilder till webben och LinkedIn...'
          : 'T.ex. familjefoto utomhus i september, vi är två vuxna och två barn...') +
        '"></textarea></label>' +
      '<label class="aig-field"><span>Ungefärlig budget</span><select id="aigBudget">' + opts + '</select></label>' +
      '<div class="aig-nav">' +
        '<button type="button" class="aig-btn aig-btn-ghost" data-back>← Tillbaka</button>' +
        '<button type="button" class="aig-btn aig-btn-accent" data-next>Ge mig ett förslag →</button>' +
      '</div></div>';
    var ta = body.querySelector('#aigText');
    ta.value = state.text;
    body.querySelector('[data-back]').addEventListener('click', renderStep2);
    body.querySelector('[data-next]').addEventListener('click', function () {
      state.text = ta.value.trim();
      state.budget = body.querySelector('#aigBudget').value;
      renderResult();
    });
    ta.focus();
  }

  // Resultat
  function renderResult() {
    setDots(2);
    var r = recommend(state.mode, state.cat, state.text, state.budget);
    var reasons = r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    body.innerHTML =
      '<div class="aig-result">' +
      '<div class="aig-result-card">' +
        '<span class="aig-badge">Vår rekommendation</span>' +
        '<h3>' + esc(r.pkg.name) + '</h3>' +
        '<p class="aig-price">' + esc(r.pkg.price) + '</p>' +
        '<ul class="aig-reasons">' + reasons + '</ul>' +
      '</div>' +
      '<div class="aig-result-actions">' +
        '<button type="button" class="aig-btn aig-btn-accent" data-apply>Ta med till offertförfrågan →</button>' +
        '<button type="button" class="aig-btn aig-btn-ghost" data-seepkg>Se paketen</button>' +
      '</div>' +
      '<p class="aig-hint">Förslaget är en vägledning – vi skräddarsyr alltid efter dina exakta behov.</p>' +
      '<button type="button" class="aig-restart" data-restart>Börja om</button>' +
      '</div>';
    body.querySelector('[data-apply]').addEventListener('click', function () { applyToForm(); });
    body.querySelector('[data-seepkg]').addEventListener('click', function () { gotoSection('paket'); });
    body.querySelector('[data-restart]').addEventListener('click', function () {
      state = { mode: null, cat: null, text: '', budget: '' }; renderStep1();
    });
  }

  // ---- Integration med sidan ----
  function gotoSection(key) {
    close();
    var mode = state.mode || 'foretag';
    var modeBtn = document.querySelector('.mode-toggle [data-mode="' + mode + '"]');
    if (modeBtn) modeBtn.click();
    setTimeout(function () {
      var navEl = document.querySelector('.nav [data-nav="' + key + '"]') || document.querySelector('[data-nav="' + key + '"]');
      if (navEl) navEl.click();
    }, 90);
  }

  function applyToForm() {
    var mode = state.mode, cat = state.cat;
    close();
    var modeBtn = document.querySelector('.mode-toggle [data-mode="' + mode + '"]');
    if (modeBtn) modeBtn.click();
    setTimeout(function () {
      var view = document.querySelector('.mode-view[data-view="' + mode + '"]');
      if (view && cat) {
        var cb = null;
        view.querySelectorAll('input[name="typ"]').forEach(function (i) {
          if (i.value === cat.typ) cb = i;
        });
        if (cb && !cb.checked) cb.checked = true;

        if (state.budget) {
          var sel = view.querySelector('select[name="budget"]');
          if (sel) Array.prototype.slice.call(sel.options).forEach(function (o) {
            if (o.textContent === state.budget || o.value === state.budget) sel.value = o.value;
          });
        }
        var ta = view.querySelector('textarea[name="beskrivning"]');
        if (ta && state.text) ta.value = state.text;
      }
      var navEl = document.querySelector('.nav [data-nav="kontakt"]') || document.querySelector('[data-nav="kontakt"]');
      if (navEl) navEl.click();
    }, 110);
  }

  // ---- Öppna / stäng ----
  function open() {
    lastFocus = document.activeElement;
    state = { mode: null, cat: null, text: '', budget: '' };
    renderStep1();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var c = modal.querySelector('.aig-close');
    if (c) c.focus();
  }
  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  launcher.addEventListener('click', open);
  modal.querySelector('.aig-close').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
})();
