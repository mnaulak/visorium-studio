// ===== Visorium Studio — interactivity (single-page, Företag/Privat) =====
(function () {
  'use strict';

  /* =====================================================================
   *  ⚙️  INSTÄLLNINGAR — byt bara dessa två rader
   * ---------------------------------------------------------------------
   *  1) FORMSPREE_ENDPOINT: din formulär-endpoint från https://formspree.io
   *  2) CALENDLY_URL: din boknings-länk, t.ex. https://calendly.com/visoriumstudio/30min
   *  3) CONFIRM_EMAIL: din mejladress – används för att skicka gratis
   *     bekräftelsemejl till kunden via FormSubmit. Töm strängen ('') för att stänga av.
   * ===================================================================== */
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mpqgaqby';
  var CALENDLY_URL  = 'https://calendly.com/visoriumstudio/intro';
  var CONFIRM_EMAIL = 'visoriumstudio@gmail.com';
  /* ===================================================================== */

  // Skickar ett automatiskt bekräftelsemejl till kunden (gratis via FormSubmit).
  // Fire-and-forget: ev. fel ignoreras så att tackrutan ändå visas.
  function sendConfirmation(data) {
    if (!CONFIRM_EMAIL) return;
    var text = 'Hej och tack för att du hörde av dig!\n\n'
      + 'Vad roligt att du vill jobba med oss – det betyder mycket att du valde Visorium Studio. '
      + 'Vi har tagit emot din förfrågan och hör personligen av oss inom 24 timmar för att ta reda på '
      + 'precis vad du behöver och hur vi bäst kan hjälpa dig.\n\n'
      + 'Vill du komma igång snabbare? Då är du varmt välkommen att boka en tid direkt här:\n'
      + CALENDLY_URL + '\n\n'
      + 'Har du en tanke eller fråga under tiden är det bara att svara på det här mejlet, '
      + 'eller höra av dig till ' + CONFIRM_EMAIL + '. Vi ser fram emot att höra mer!\n\n'
      + 'Varma hälsningar,\nTeamet på Visorium Studio\n'
      + 'Foto & film med känsla – för företag, organisationer och privatpersoner\nStockholm & Gävleborg';
    fetch('https://formsubmit.co/ajax/' + encodeURIComponent(CONFIRM_EMAIL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        name: data['Namn'],
        email: data['E-post'],
        _subject: 'Tack för din förfrågan – Visorium Studio',
        _autoresponse: text,
        _captcha: 'false'
      })
    }).catch(function () {});
  }

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Boknings-knappar → Calendly popup-widget (kunden stannar kvar på sidan)
  // Integritet/prestanda: Calendlys skript laddas INTE i <head> längre, utan först
  // när besökaren faktiskt klickar på en boknings-knapp (ingen tredjepartsanrop i onödan).
  var calendlyReady = function () { return window.Calendly && typeof window.Calendly.initPopupWidget === 'function'; };
  var calendlyLoading = false;
  var calendlyQueue = [];
  function loadCalendly(onReady, onError) {
    if (calendlyReady()) { onReady(); return; }
    calendlyQueue.push(onReady);
    if (calendlyLoading) return;
    calendlyLoading = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(link);
    var script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = function () {
      calendlyQueue.forEach(function (fn) { fn(); });
      calendlyQueue = [];
    };
    script.onerror = function () {
      calendlyLoading = false;
      calendlyQueue = [];
      if (onError) onError();
    };
    document.head.appendChild(script);
  }
  $$('.book-btn').forEach(function (b) {
    b.setAttribute('href', CALENDLY_URL);
    b.setAttribute('target', '_blank');
    b.setAttribute('rel', 'noopener');
    b.addEventListener('click', function (e) {
      e.preventDefault();
      loadCalendly(function () {
        window.Calendly.initPopupWidget({ url: CALENDLY_URL });
      }, function () {
        // Om skriptet inte kunde laddas (nät/adblock): öppna Calendly direkt istället.
        window.open(CALENDLY_URL, '_blank', 'noopener');
      });
    });
  });

  // Egen tack-ruta när bokningen är klar (ersätter Calendlys "Open Invitation"-skärm)
  var bookedOverlay = document.getElementById('bookedOverlay');
  function openBooked() {
    if (!bookedOverlay) return;
    bookedOverlay.classList.add('open');
    bookedOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeBooked() {
    if (!bookedOverlay) return;
    bookedOverlay.classList.remove('open');
    bookedOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  if (bookedOverlay) {
    var bc = document.getElementById('bookedClose');
    var bd = document.getElementById('bookedDone');
    if (bc) bc.addEventListener('click', closeBooked);
    if (bd) bd.addEventListener('click', closeBooked);
    bookedOverlay.addEventListener('click', function (e) { if (e.target === bookedOverlay) closeBooked(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBooked(); });
  }
  // Lyssna på Calendlys signal om genomförd bokning (fungerar även på gratisplan)
  window.addEventListener('message', function (e) {
    if (e.origin && e.origin.indexOf('calendly.com') === -1) return;
    var d = e.data;
    if (d && d.event === 'calendly.event_scheduled') {
      if (window.Calendly && typeof window.Calendly.closePopupWidget === 'function') {
        window.Calendly.closePopupWidget();
      }
      setTimeout(openBooked, 300);
    }
  });

  // Årtal i sidfot
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===================================================================
  //  LÄGE: Företag / Privat (visar rätt vy på samma sida)
  // ===================================================================
  var views = $$('.mode-view');
  var modeButtons = $$('.mode-toggle [data-mode]');

  function currentView() { return $('.mode-view:not([hidden])') || views[0]; }

  function revealAll(root) {
    $$('.reveal', root).forEach(function (el) { el.classList.add('in'); });
  }

  function setMode(mode, opts) {
    opts = opts || {};
    views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== mode; });
    modeButtons.forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    try { localStorage.setItem('visorium-mode', mode); } catch (e) {}

    var shown = $('.mode-view[data-view="' + mode + '"]');
    if (shown && !opts.initial) revealAll(shown);   // säkerställ att den nyvisade vyn syns
    if (!opts.initial && !opts.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  modeButtons.forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
  });

  // ===================================================================
  //  NAVIGERING: skrolla till rätt sektion i den AKTIVA vyn
  // ===================================================================
  var header = document.getElementById('header');

  function scrollToSection(key) {
    if (!key || key === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var view = currentView();
    var target = $('[data-section="' + key + '"]', view);
    if (!target) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var offset = (header ? header.offsetHeight : 0) + 10;
    var y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  // Alla länkar/knappar med data-nav (header, hero-knappar, kort, sidfot)
  $$('[data-nav]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      // Sidfotslänkar kan byta läge först
      var modeLink = el.getAttribute('data-mode-link');
      if (modeLink && currentView().getAttribute('data-view') !== modeLink) {
        setMode(modeLink, { keepScroll: true });
      }
      var key = el.getAttribute('data-nav');
      // liten fördröjning om vi precis bytt vy så layouten hinner uppdateras
      if (modeLink) { setTimeout(function () { scrollToSection(key); }, 60); }
      else { scrollToSection(key); }
      closeMenu();
    });
  });

  // ===================================================================
  //  Sticky header + till-toppen
  // ===================================================================
  var toTop = document.getElementById('toTop');
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('scrolled', y > 20);
    if (toTop) toTop.classList.toggle('show', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ===================================================================
  //  Mobilmeny
  // ===================================================================
  var menuToggle = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');
  function closeMenu() {
    if (!nav || !menuToggle) return;
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ===================================================================
  //  Scroll reveal
  // ===================================================================
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 60 + 'ms';
      io.observe(el);
    });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // ===================================================================
  //  FAQ-dragspel (scoped per .faq-grupp)
  // ===================================================================
  $$('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var group = q.closest('.faq');
      var item = q.parentElement;
      var answer = item.querySelector('.faq-a');
      var open = q.getAttribute('aria-expanded') === 'true';
      $$('.faq-q', group).forEach(function (other) {
        if (other !== q) {
          other.setAttribute('aria-expanded', 'false');
          other.parentElement.querySelector('.faq-a').style.maxHeight = null;
        }
      });
      if (open) {
        q.setAttribute('aria-expanded', 'false');
        answer.style.maxHeight = null;
      } else {
        q.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // ===================================================================
  //  Portfolio: filter (per sektion) + delad lightbox
  // ===================================================================
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lightboxImg');
  var lbVid = document.getElementById('lightboxVid');
  var lbCap = document.getElementById('lightboxCap');
  var lbClose = document.getElementById('lightboxClose');

  function openLightbox(work) {
    if (!lb) return;
    var img = work.querySelector('img');
    var title = work.querySelector('.work-title');
    var video = work.getAttribute('data-video');
    if (video && lbVid) {
      lbImg.style.display = 'none';
      lbImg.src = '';
      lbVid.style.display = '';
      lbVid.src = video;
      lbVid.play().catch(function () {});
    } else {
      if (lbVid) { lbVid.pause(); lbVid.removeAttribute('src'); lbVid.style.display = 'none'; }
      lbImg.style.display = '';
      lbImg.src = img.src;
      lbImg.alt = img.alt;
    }
    lbCap.textContent = title ? title.textContent : '';
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
  }
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    lbImg.src = '';
    if (lbVid) { lbVid.pause(); lbVid.removeAttribute('src'); lbVid.load(); lbVid.style.display = 'none'; }
  }
  if (lb) {
    lbClose.addEventListener('click', closeLightbox);
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.classList.contains('open')) closeLightbox();
    });
  }

  $$('.port-grid').forEach(function (grid) {
    var section = grid.closest('[data-section]') || grid.parentElement;
    var works = $$('.work', grid);

    $$('.port-filter', section).forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.port-filter', section).forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.getAttribute('data-filter');
        works.forEach(function (w) {
          var show = f === 'alla' || w.getAttribute('data-cat') === f;
          w.classList.toggle('hide', !show);
        });
      });
    });

    works.forEach(function (w) {
      w.addEventListener('click', function () { openLightbox(w); });
    });
  });

  // ===================================================================
  //  Flerstegsformulär (per .quote-formulär)
  // ===================================================================
  $$('form.quote').forEach(function (form) {
    var steps = $$('.quote-step', form);
    var dots = $$('.qp-step', form);
    var current = 0;

    function showStep(i) {
      steps.forEach(function (s, idx) { s.classList.toggle('active', idx === i); });
      dots.forEach(function (d, idx) {
        d.classList.toggle('active', idx === i);
        d.classList.toggle('done', idx < i);
      });
      current = i;
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setError(stepEl, msg) {
      var el = stepEl.querySelector('[data-error]');
      if (el) el.textContent = msg || '';
    }

    function validateStep(i) {
      var stepEl = steps[i];
      setError(stepEl, '');
      if (i === 0) {
        var anyChecked = $$('input[name="typ"]:checked', form).length > 0;
        if (!anyChecked) { setError(stepEl, 'Välj minst en typ av uppdrag.'); return false; }
        if (form.budget && !form.budget.value) { setError(stepEl, 'Välj en budgetram.'); form.budget.focus(); return false; }
      }
      if (i === 2) {
        var namn = form.namn.value.trim();
        var epost = form.epost.value.trim();
        var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost);
        if (!namn) { setError(stepEl, 'Ange ditt namn.'); form.namn.focus(); return false; }
        if (!emailOk) { setError(stepEl, 'Ange en giltig e-postadress.'); form.epost.focus(); return false; }
        var telefon = form.telefon.value.trim();
        if (!telefon) { setError(stepEl, 'Ange ditt telefonnummer.'); form.telefon.focus(); return false; }
        var consent = form.samtycke;
        if (consent && !consent.checked) { setError(stepEl, 'Du behöver godkänna integritetspolicyn för att skicka.'); return false; }
      }
      return true;
    }

    $$('[data-next]', form).forEach(function (btn) {
      btn.addEventListener('click', function () { if (validateStep(current)) showStep(current + 1); });
    });
    $$('[data-prev]', form).forEach(function (btn) {
      btn.addEventListener('click', function () { showStep(current - 1); });
    });

    function collectData() {
      var typ = $$('input[name="typ"]:checked', form).map(function (c) { return c.value; }).join(', ');
      return {
        'Typ av uppdrag': typ || '-',
        'Budget': form.budget.value || '-',
        'Beskrivning': form.beskrivning.value || '-',
        'Önskad tidpunkt': form.tidpunkt.value || '-',
        'Plats': form.plats.value || '-',
        'Namn': form.namn.value,
        'Företag': form.foretag.value || '-',
        'E-post': form.epost.value,
        'Telefon': form.telefon.value || '-'
      };
    }

    function showDone() {
      form.querySelector('.quote-progress').style.display = 'none';
      steps.forEach(function (s) { s.classList.remove('active'); });
      form.querySelector('[data-done]').hidden = false;
    }

    function mailtoFallback(data) {
      var lines = Object.keys(data).map(function (k) { return k + ': ' + data[k]; });
      var mailto = 'mailto:visoriumstudio@gmail.com'
        + '?subject=' + encodeURIComponent('Offertförfrågan – ' + data['Namn'])
        + '&body=' + encodeURIComponent(lines.join('\n'));
      showDone();
      window.location.href = mailto;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(current)) return;

      // Säkerställ alltid samtycke innan inskick, oavsett vilket steg som är aktivt
      var consent = form.samtycke;
      if (consent && !consent.checked) {
        showStep(2);
        setError(steps[2], 'Du behöver godkänna integritetspolicyn för att skicka.');
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');

      // Botskydd: är honeypot ifylld är det en bot → låtsas lyckas, skicka inget.
      var hp = form.company_website;
      if (hp && hp.value) { showDone(); return; }

      // Race-skydd: blockera dubbelklick / parallella submits.
      if (submitBtn && submitBtn.disabled) return;

      var data = collectData();
      var endpointSet = FORMSPREE_ENDPOINT && FORMSPREE_ENDPOINT.indexOf('formspree.io/f/') !== -1;

      if (!endpointSet) { mailtoFallback(data); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Skickar…';
      setError(steps[2], '');

      var payload = {
        _subject: 'Ny offertförfrågan – ' + data['Namn'],
        email: data['E-post']   // Formspree använder fältet "email" som svarsadress
      };
      Object.keys(data).forEach(function (k) { payload[k] = data[k]; });

      fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          if (r.ok) { sendConfirmation(data); showDone(); return; }
          return r.json().then(function (res) {
            throw new Error((res.errors && res.errors[0] && res.errors[0].message) || 'fel');
          });
        })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Skicka förfrågan <span aria-hidden="true">→</span>';
          setError(steps[2], 'Något gick fel. Försök igen eller mejla visoriumstudio@gmail.com.');
        });
    });
  });

  // ===================================================================
  //  Startläge: alltid Företag, om inte ?mode=... uttryckligen anges i URL
  //  (t.ex. direktlänkar från footern eller kundresa.html?mode=privat)
  // ===================================================================
  var startMode = 'foretag';
  try {
    var p = new URLSearchParams(location.search).get('mode');
    if (p === 'foretag' || p === 'privat') startMode = p;
  } catch (e) {}
  setMode(startMode, { initial: true });

  // ===================================================================
  //  Hopp till sektion via #hash (t.ex. från kundresa.html → index.html#paket)
  // ===================================================================
  if (location.hash.length > 1) {
    var hashKey = decodeURIComponent(location.hash.slice(1));
    var jumpToHash = function () { scrollToSection(hashKey); };
    // Tidigt hopp (ungefärligt) + korrigering när allt (bilder) laddats
    setTimeout(jumpToHash, 120);
    window.addEventListener('load', function () { setTimeout(jumpToHash, 80); });
  }
})();
