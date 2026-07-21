/* ===================================================================
   Visorium Studio — network.js
   "Från tysta, isolerade datakluster till ett levande ekosystem."

   Ett dekorativt nod-nätverk som väcks till liv i hero-bakgrunden.
   Ren, modulär arkitektur:
     • Node        — en enskild punkt (position, drift, puls, vaknande).
     • Signal      — ett dataflöde som färdas längs en länk mellan två noder.
     • Network     — ekosystemet: håller noder, hittar grannar, föder signaler.
     • Renderer    — ritar allt på <canvas> (ingen DOM-logik blandas in här).
     • NetworkScene — limmar ihop allt mot en hero + hanterar livscykeln.

   Körs helt i webbläsaren, inga beroenden. Respekterar prefers-reduced-motion.
   =================================================================== */
(function () {
  'use strict';

  var PALETTE = {
    node:       'rgba(45, 100, 175, ',   // dämpad brand-blå – syns på ljus bakgrund
    nodeQuiet:  'rgba(90, 106, 133, ',   // dämpad skiffer innan noden vaknat
    link:       'rgba(70, 95, 140, ',    // länklinjer
    signal:     'rgba(27, 111, 224, '    // blått dataflöde
  };

  // ---- Liten matematik-hjälp -------------------------------------------------
  function rand(min, max) { return min + Math.random() * (max - min); }
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  // ---------------------------------------------------------------------------
  //  Node — en ensam punkt som väntar på att kopplas samman.
  // ---------------------------------------------------------------------------
  function Node(x, y) {
    this.x = x; this.y = y;
    this.vx = rand(-0.045, 0.045); // mycket långsam, knappt märkbar drift
    this.vy = rand(-0.045, 0.045);
    this.baseR = rand(1.1, 2.0);
    this.phase = rand(0, Math.PI * 2);   // egen puls-fas → nätverket andas asynkront
    this.pulseSpeed = rand(0.3, 0.7);
    this.awake = 0;                 // 0 = tyst/isolerad, 1 = fullt levande
    this.wakeTarget = 0;
    this.degree = 0;                // antal grannar just nu (styr ljusstyrka)
  }

  Node.prototype.update = function (dt, w, h, t) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    // Mjuk studs mot hero-kanterna så noderna stannar i bild
    if (this.x < 0 || this.x > w) { this.vx *= -1; this.x = Math.max(0, Math.min(w, this.x)); }
    if (this.y < 0 || this.y > h) { this.vy *= -1; this.y = Math.max(0, Math.min(h, this.y)); }
    // Vaknar gradvis mot sitt mål (nätverket tänds inifrån och ut)
    this.awake += (this.wakeTarget - this.awake) * Math.min(1, dt * 0.04);
    this.pulse = 0.5 + 0.5 * Math.sin(t * 0.001 * this.pulseSpeed + this.phase);
  };

  // ---------------------------------------------------------------------------
  //  Signal — ett dataflöde: en nod söker en annan och skickar en puls dit.
  // ---------------------------------------------------------------------------
  function Signal(from, to) {
    this.from = from; this.to = to;
    this.p = 0;                     // 0→1 längs länken
    this.speed = rand(0.22, 0.45);
    this.dead = false;
  }
  Signal.prototype.update = function (dt) {
    this.p += this.speed * dt * 0.0016;   // ~1–2 s resa längs länken
    if (this.p >= 1) this.dead = true;
  };
  Signal.prototype.pos = function () {
    return { x: this.from.x + (this.to.x - this.from.x) * this.p,
             y: this.from.y + (this.to.y - this.from.y) * this.p };
  };

  // ---------------------------------------------------------------------------
  //  Network — ekosystemet. Vet inget om ritning; bara struktur & liv.
  // ---------------------------------------------------------------------------
  function Network(opts) {
    this.linkDist = opts.linkDist;
    this.linkDist2 = opts.linkDist * opts.linkDist;
    this.maxSignals = opts.maxSignals;
    this.signalRate = opts.signalRate;     // sannolikhet/frame att en ny signal föds
    this.nodes = [];
    this.signals = [];
    this.links = [];                       // återanvänds varje frame (undviker GC-tryck)
  }

  Network.prototype.populate = function (count, w, h) {
    this.nodes = [];
    for (var i = 0; i < count; i++) this.nodes.push(new Node(rand(0, w), rand(0, h)));
    // Väck noder inifrån mitten och utåt → känslan av något som sprider sig
    var cx = w / 2, cy = h / 2;
    this.nodes.forEach(function (n) {
      var d = Math.sqrt(dist2(n.x, n.y, cx, cy));
      n.wakeDelay = d;                     // längre bort = vaknar senare
    });
  };

  Network.prototype.wake = function (radius) {
    // Kallas löpande: allt inom "radius" (växande) börjar leva
    this.nodes.forEach(function (n) {
      if (n.wakeDelay <= radius) n.wakeTarget = 1;
    });
  };

  Network.prototype.update = function (dt, w, h, t) {
    var i, j, a, b;
    for (i = 0; i < this.nodes.length; i++) this.nodes[i].update(dt, w, h, t);

    // Bygg om länklistan + nollställ grannräkning
    this.links.length = 0;
    for (i = 0; i < this.nodes.length; i++) this.nodes[i].degree = 0;
    for (i = 0; i < this.nodes.length; i++) {
      a = this.nodes[i];
      for (j = i + 1; j < this.nodes.length; j++) {
        b = this.nodes[j];
        var d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 < this.linkDist2) {
          var strength = (1 - Math.sqrt(d2) / this.linkDist) * Math.min(a.awake, b.awake);
          if (strength > 0.02) {
            this.links.push({ a: a, b: b, s: strength });
            a.degree++; b.degree++;
          }
        }
      }
    }

    // Föd nya signaler: en levande, väl förbunden nod söker en granne att tala med
    if (this.signals.length < this.maxSignals && Math.random() < this.signalRate && this.links.length) {
      var link = this.links[(Math.random() * this.links.length) | 0];
      if (link.s > 0.35) this.signals.push(new Signal(link.a, link.b));
    }

    // Uppdatera & städa döda signaler
    for (i = this.signals.length - 1; i >= 0; i--) {
      this.signals[i].update(dt);
      if (this.signals[i].dead) this.signals.splice(i, 1);
    }
  };

  // ---------------------------------------------------------------------------
  //  Renderer — översätter nätverkets tillstånd till ljus på canvasen.
  // ---------------------------------------------------------------------------
  function Renderer(ctx) { this.ctx = ctx; }

  Renderer.prototype.draw = function (net, w, h) {
    var ctx = this.ctx, i;
    ctx.clearRect(0, 0, w, h);

    // 1) Länkar — nervbanorna
    for (i = 0; i < net.links.length; i++) {
      var l = net.links[i];
      ctx.strokeStyle = PALETTE.link + (l.s * 0.22).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y);
      ctx.lineTo(l.b.x, l.b.y);
      ctx.stroke();
    }

    // 2) Signaler — dataflöden som pulserar längs banorna
    for (i = 0; i < net.signals.length; i++) {
      var s = net.signals[i], p = s.pos();
      var fade = Math.sin(s.p * Math.PI);        // tänds och slocknar mjukt
      ctx.fillStyle = PALETTE.signal + (fade * 0.45).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) Noder — hjärtslagen. Ljusare ju mer förbundna & vakna de är.
    for (i = 0; i < net.nodes.length; i++) {
      var n = net.nodes[i];
      var life = n.awake;
      var glow = 0.3 + 0.7 * n.pulse + Math.min(0.5, n.degree * 0.08);
      var r = n.baseR * (0.7 + 0.3 * n.pulse) * (0.5 + 0.5 * life);
      var col = (life > 0.5 ? PALETTE.node : PALETTE.nodeQuiet);
      ctx.fillStyle = col + (Math.min(1, glow) * (0.12 + 0.4 * life)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ---------------------------------------------------------------------------
  //  NetworkScene — livscykel: koppla mot en hero, starta/stoppa, resize.
  // ---------------------------------------------------------------------------
  function NetworkScene(heroBg) {
    this.host = heroBg;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'net-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    heroBg.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.renderer = new Renderer(this.ctx);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0; this.h = 0;
    this.raf = null;
    this.last = 0;
    this.wakeRadius = 0;
    this.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var density = 1 / 13000;                    // noder per px² → skalar med hero-yta
    this.resize(true);
    var count = Math.round(Math.max(26, Math.min(90, this.w * this.h * density)));
    this.net = new Network({
      linkDist: Math.max(110, Math.min(170, this.w * 0.13)),
      maxSignals: this.reduced ? 0 : 5,
      signalRate: 0.02
    });
    this.net.populate(count, this.w, this.h);
    this.maxWake = Math.sqrt(this.w * this.w + this.h * this.h);
  }

  NetworkScene.prototype.resize = function (initial) {
    var rect = this.host.getBoundingClientRect();
    var prevW = this.w, prevH = this.h;
    this.w = rect.width; this.h = rect.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.maxWake = Math.sqrt(this.w * this.w + this.h * this.h);
    if (!initial && this.net) {
      if (prevW < 2 || prevH < 2) {
        // Heron var dold vid start (0-yta, t.ex. Privat-vyn) → fördela noderna nu
        this.net.populate(this.net.nodes.length, this.w, this.h);
      } else {
        // Håll noderna inom nya gränserna
        this.net.nodes.forEach(function (n) {
          if (n.x > rect.width) n.x = rect.width;
          if (n.y > rect.height) n.y = rect.height;
        });
      }
    }
  };

  NetworkScene.prototype.frame = function (t) {
    if (!this.last) this.last = t;
    var dt = Math.min(48, t - this.last);        // ms, klampad så flikbyten inte hoppar
    this.last = t;

    // Nätverket vaknar: väckningsradien växer utåt tills allt lever
    if (this.wakeRadius < this.maxWake) this.wakeRadius += dt * 0.15;
    this.net.wake(this.wakeRadius);

    this.net.update(dt, this.w, this.h, t);
    this.renderer.draw(this.net, this.w, this.h);

    if (!this.reduced) this.raf = requestAnimationFrame(this.frame.bind(this));
  };

  NetworkScene.prototype.start = function () {
    // Synkront första utseende (gate:a aldrig bakom rAF – vissa miljöer strypa rAF)
    this.canvas.classList.add('is-live');
    if (this.reduced) {
      // Statisk, lugn bild: väck allt direkt och rita en enda ruta
      this.wakeRadius = this.maxWake;
      this.net.wake(this.maxWake);
      for (var k = 0; k < 40; k++) this.net.update(16, this.w, this.h, k * 16);
      this.renderer.draw(this.net, this.w, this.h);
      return;
    }
    // Rita en första ruta direkt, starta sedan den löpande loopen
    this.net.update(16, this.w, this.h, 0);
    this.renderer.draw(this.net, this.w, this.h);
    this.raf = requestAnimationFrame(this.frame.bind(this));
  };

  NetworkScene.prototype.stop = function () {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  };

  // ---------------------------------------------------------------------------
  //  Bootstrap — starta en scen per startsidans hero (Företag + Privat).
  //  Endast .hero (startsidan). Pausar när sidan inte syns → sparar batteri.
  // ---------------------------------------------------------------------------
  function init() {
    var heroes = document.querySelectorAll('.hero .hero-bg');
    if (!heroes.length || !document.createElement('canvas').getContext) return;

    var scenes = [];
    heroes.forEach(function (bg) {
      try {
        var scene = new NetworkScene(bg);
        scene.start();
        scenes.push(scene);
      } catch (e) { /* dekorativt – tyst fallback om canvas strular */ }
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { scenes.forEach(function (s) { s.resize(false); }); }, 200);
    });

    // Dolda heroer (t.ex. Privat-vyn) har 0-yta vid start. Mät om dem när de
    // blir synliga så nätverket fyller ytan korrekt vid lägesväxling.
    if ('ResizeObserver' in window) {
      scenes.forEach(function (s) {
        var ro = new ResizeObserver(function () {
          var r = s.host.getBoundingClientRect();
          if (r.width > 2 && Math.abs(r.width - s.w) > 1) {
            s.resize(false);
            if (!s.reduced && !s.raf) { s.last = 0; s.raf = requestAnimationFrame(s.frame.bind(s)); }
            else if (s.reduced) s.renderer.draw(s.net, s.w, s.h);
          }
        });
        ro.observe(s.host);
      });
    }

    // Pausa animationen när fliken är dold (prestanda/batteri)
    document.addEventListener('visibilitychange', function () {
      scenes.forEach(function (s) {
        if (document.hidden) { s.stop(); }
        else if (!s.reduced && !s.raf) { s.last = 0; s.raf = requestAnimationFrame(s.frame.bind(s)); }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
