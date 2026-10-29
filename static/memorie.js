/* LUCA demo: the network's memory ("Memoria rețelei").
   The language model is not retrained: what learns is our layer. Every reply the team approves
   (a sensitive review: when it is published, after the internal check) becomes an EXAMPLE kept by
   the server (GET /api/memorie, emptied by the demo reset). Later proposals receive the most
   relevant examples in the same model call, and the model says what it took from them.
   This file shows that memory:
   - the widget in the page head: a small cluster, one node per example (colour = the review's
     polarity, a dark ring when the team corrected the proposal), faint links to its topics;
   - the learning moment: after Aprobă / Publică the reply leaves the card as a small pill and
     flies into the cluster, where it becomes the new node (into a dock under the bar when the
     widget is scrolled away); with reduced motion the widget simply updates;
   - the drawer "Ce a învățat rețeaua": every example, the team's corrections as a word diff;
   - the guess of the examples a proposal will receive (the server's own scoring), drawn by the
     network while it works and replaced by the server's list when the answer arrives.
   Every figure comes from the server. No endpoint (older server, 404): no widget, the page works
   as before. Plain browser JS, no libraries. Exposed as window.LUCA.memorie. */
(function () {
  "use strict";

  var L = window.LUCA;
  if (!L) return;
  var esc = L.esc;
  var SHY = String.fromCharCode(173);

  /* Soft hyphens are written "|" below (app/demo/silabe.py, ro) and inserted at load. */
  function hy(s) {
    return s.split("|").join(SHY);
  }
  var HY = {
    sub: hy(
      "În|vă|ța|re con|ti|nuă: cu fi|e|ca|re răs|puns apro|bat, re|țea|ua de|vi|ne mai spe|ci|fi|că pe vocea bran|du|lui LUCA.",
    ),
    gol: hy(
      "Me|mo|ria e goală: pri|mul răs|puns apro|bat por|neș|te în|vă|ța|rea vocii LUCA.",
    ),
    corectat: hy("Pro|pu|ne|rea sis|te|mu|lui și co|rec|tu|ri|le echi|pei:"),
  };
  var TOAST_NOU = "Rețeaua a învățat din răspunsul aprobat.";
  var TOAST_ACT = "Rețeaua a actualizat exemplul.";

  var POL = { negativ: "neg", mixt: "mix", pozitiv: "poz" };
  var MAX_EXEMPLE = 200;
  var MAX_NODURI = 16;
  var MAX_TEME = 4;
  var MAX_CUVINTE_DIFF = 600;
  /* The cluster, drawn 1:1 (viewBox = CSS size): a sunflower spiral, the oldest example in the
     middle, each new one further out; topic labels in a column on the right. */
  var V = {
    w: 150,
    h: 100,
    cx: 38,
    cy: 50,
    pas: 8,
    rot: -0.6,
    rn: 3.25,
    rr: 5.5,
    lx: 90,
  };
  var UNGHI = Math.PI * (3 - Math.sqrt(5)); // golden angle: no two nodes on one ray
  var ZBOR_MS = 700;
  var NUMAR_MS = 240;
  var DOCK_MS = 1700;
  var RECONCILIERE_MS = 1800;

  var S = {
    el: null,
    cap: null,
    ini: null,
    unitDupaNume: null,
    disponibil: false,
    gata: false,
    exemple: [], // most recent first
    total: 0,
    editate: 0,
    afisat: null, // counts on screen {n, m, gol}: the counter rolls from these
    zbor: new Set(), // examples whose pill is still flying: their node waits, hidden
    cerere: 0,
    dock: null,
    dockT: null,
    reconT: null,
    sertar: null,
    ease: null,
  };

  /* ------------------------------------------------------------ helpers */

  function r1(v) {
    return Math.round(v * 10) / 10;
  }

  function sir(v, max) {
    if (typeof v !== "string") return "";
    var t = v.split(SHY).join("").trim();
    return max && t.length > max ? t.slice(0, max) : t;
  }

  function numar(v) {
    return typeof v === "number" && isFinite(v) && v >= 0
      ? Math.floor(v)
      : null;
  }

  function nrId(id) {
    var m = /(\d+)\s*$/.exec(String(id));
    return m ? Number(m[1]) : 0;
  }

  function polDinStele(n) {
    n = Math.round(Number(n) || 0);
    if (n < 1 || n > 5) return "";
    return n <= 2 ? "negativ" : n === 3 ? "mixt" : "pozitiv";
  }

  function clsPol(p) {
    return POL[p] || "neu";
  }

  function faraLuca(nume) {
    return String(nume || "")
      .replace(/^\s*LUCA\s+/i, "")
      .trim();
  }

  function forEach(list, fn) {
    Array.prototype.forEach.call(list || [], fn);
  }

  function teme(v) {
    var out = [];
    (Array.isArray(v) ? v : []).forEach(function (t) {
      t = sir(t, 40);
      if (t && out.indexOf(t) === -1 && out.length < 6) out.push(t);
    });
    return out;
  }

  /* Curves from the codebase tokens (luca.css :root), read once the stylesheet is in. */
  function curbe() {
    if (S.ease) return S.ease;
    var cs = null;
    try {
      cs = window.getComputedStyle(document.documentElement);
    } catch (e) {
      cs = null;
    }
    function v(nume, implicit) {
      var x = cs ? String(cs.getPropertyValue(nume) || "").trim() : "";
      return x || implicit;
    }
    S.ease = {
      out: v("--ease-out", "cubic-bezier(0.2, 0.8, 0.2, 1)"),
      inOut: v("--ease-in-out", "cubic-bezier(0.77, 0, 0.175, 1)"),
    };
    return S.ease;
  }

  function poateAnima() {
    return (
      !L.reduceMotion() &&
      typeof Element !== "undefined" &&
      typeof Element.prototype.animate === "function"
    );
  }

  /* Resolves when the animation ends, is cancelled, or after `max` ms whatever happens. */
  function finalizat(anim, max) {
    return new Promise(function (res) {
      var gata = false;
      function f() {
        if (gata) return;
        gata = true;
        res();
      }
      if (anim && anim.finished && typeof anim.finished.then === "function")
        anim.finished.then(f, f);
      else if (anim) {
        anim.onfinish = f;
        anim.oncancel = f;
      }
      setTimeout(f, max || 1200);
    });
  }

  function barJos() {
    var a = document.querySelector(".appbar");
    return a ? Math.max(0, a.getBoundingClientRect().bottom) : 0;
  }

  /* ------------------------------------------------------- data (server) */

  /* Defensive copy of one example of GET /api/memorie (or of memorie.nou); null when unusable. */
  function exemplu(e) {
    if (!e || typeof e !== "object" || Array.isArray(e)) return null;
    var id = e.id == null ? "" : String(e.id).slice(0, 40);
    if (!id) return null;
    var stele = Math.round(Number(e.stele));
    if (!(stele >= 1 && stele <= 5)) stele = 0;
    var pol = String(e.polaritate || "").toLowerCase();
    if (!POL[pol]) pol = polDinStele(stele);
    return {
      id: id,
      cand: sir(e.cand, 40),
      reviewId: e.reviewId == null ? "" : String(e.reviewId),
      unit_id: e.unit_id == null ? "" : String(e.unit_id),
      unitate: sir(e.unitate, 120),
      limba: sir(e.limba, 12).toLowerCase(),
      stele: stele,
      teme: teme(e.teme),
      polaritate: pol,
      fragment: sir(e.fragment, 400),
      propunere_initiala: sir(e.propunere_initiala, 6000),
      raspuns_aprobat: sir(e.raspuns_aprobat, 6000),
      editat_manual: e.editat_manual === true,
      sursa: e.sursa === "publicare" ? "publicare" : "aprobare",
    };
  }

  /* memorie_folosita of POST /api/raspuns and GET /api/recenzii: at most 3, never twice the same. */
  function folosite(v) {
    if (!Array.isArray(v)) return [];
    var vazut = new Set();
    var out = [];
    v.forEach(function (m) {
      if (out.length >= 3 || !m || typeof m !== "object") return;
      var id = m.id == null ? "" : String(m.id).slice(0, 40);
      if (!id || vazut.has(id)) return;
      vazut.add(id);
      var stele = Math.round(Number(m.stele));
      out.push({
        id: id,
        unitate: sir(m.unitate, 120),
        limba: sir(m.limba, 12).toLowerCase(),
        stele: stele >= 1 && stele <= 5 ? stele : 0,
        teme: teme(m.teme),
        editat_manual: m.editat_manual === true,
      });
    });
    return out;
  }

  /* Most recent first (the drawer, the tie-break of the scoring). */
  function ordoneaza() {
    S.exemple.sort(function (a, b) {
      if (a.cand !== b.cand) return a.cand < b.cand ? 1 : -1;
      return nrId(b.id) - nrId(a.id);
    });
  }

  function dupaId(id) {
    id = id == null ? "" : String(id);
    for (var i = 0; i < S.exemple.length; i++)
      if (S.exemple[i].id === id) return S.exemple[i];
    return null;
  }

  function dupaReview(rid) {
    rid = rid == null ? "" : String(rid);
    for (var i = 0; i < S.exemple.length; i++)
      if (S.exemple[i].reviewId === rid) return S.exemple[i];
    return null;
  }

  function pune(e) {
    var vechi = dupaId(e.id);
    if (vechi) S.exemple[S.exemple.indexOf(vechi)] = e;
    else S.exemple.unshift(e);
    ordoneaza();
    if (S.exemple.length > MAX_EXEMPLE) S.exemple.length = MAX_EXEMPLE;
  }

  function editateLocal() {
    return S.exemple.filter(function (e) {
      return e.editat_manual;
    }).length;
  }

  function aplica(d) {
    var vazut = new Set();
    var ex = [];
    d.exemple.forEach(function (x) {
      var e = exemplu(x);
      if (!e || vazut.has(e.id) || ex.length >= MAX_EXEMPLE) return;
      vazut.add(e.id);
      ex.push(e);
    });
    S.exemple = ex;
    ordoneaza();
    var t = numar(d.total);
    var m = numar(d.editate);
    S.total = t !== null ? t : ex.length;
    S.editate = m !== null ? m : editateLocal();
  }

  function semnatura() {
    return (
      S.total +
      "|" +
      S.editate +
      "|" +
      S.exemple
        .map(function (e) {
          return [
            e.id,
            e.cand,
            e.polaritate,
            e.editat_manual ? 1 : 0,
            e.teme.join(","),
            e.raspuns_aprobat.length,
          ].join(":");
        })
        .join(";")
    );
  }

  /* ------------------------------------------- scoring (same as the server) */

  /* Up to 3 examples a proposal for `it` will likely receive, never its own review: same language
     +3, same star band (1-2 / 3 / 4-5) +2, a topic shared with this review's previous analysis +2,
     same unit +1, corrected by the team +1, then the most recent. A guess for the animation only:
     the answer's memorie_folosita replaces it. */
  function scor(e, it, temeRecenzie) {
    var s = 0;
    var lim = String((it && it.limba) || "").toLowerCase();
    if (e.limba && e.limba === lim) s += 3;
    if (
      e.stele &&
      it &&
      it.stele &&
      L.bandaNota(e.stele) === L.bandaNota(it.stele)
    )
      s += 2;
    if (
      temeRecenzie.length &&
      e.teme.some(function (t) {
        return temeRecenzie.indexOf(t) !== -1;
      })
    )
      s += 2;
    if (e.unit_id !== "" && it && e.unit_id === String(it.unit_id)) s += 1;
    if (e.editat_manual) s += 1;
    return s;
  }

  function probabile(it, temeRecenzie) {
    if (!it || !S.exemple.length) return [];
    var t = Array.isArray(temeRecenzie) ? temeRecenzie : [];
    var rid = String(it.reviewId);
    return S.exemple
      .filter(function (e) {
        return e.reviewId !== rid;
      })
      .map(function (e, i) {
        return { e: e, s: scor(e, it, t), i: i };
      })
      .sort(function (a, b) {
        return b.s - a.s || a.i - b.i;
      })
      .slice(0, 3)
      .map(function (x) {
        return x.e;
      });
  }

  /* ------------------------------------------------------ display tokens */

  function initialeEx(e, unit) {
    var ini = "";
    if (unit !== null && unit !== undefined && unit !== "" && S.ini)
      ini = S.ini(unit);
    if (!ini || ini === "?") ini = L.initiale(faraLuca(e && e.unitate));
    return ini || "?";
  }

  /* One example as the network pill and the analysis chip show it: unit initials and name, first
     topic, polarity, team correction (the learned example when known, else what the answer said). */
  function token(m) {
    if (!m) return null;
    var ex = dupaId(m.id);
    var unit = ex && ex.unit_id !== "" ? ex.unit_id : null;
    if (unit === null && S.unitDupaNume) unit = S.unitDupaNume(m.unitate || "");
    var nume = faraLuca(m.unitate || (ex && ex.unitate) || "");
    var lista = m.teme && m.teme.length ? m.teme : ex ? ex.teme : [];
    var pol = (ex && ex.polaritate) || m.polaritate || polDinStele(m.stele);
    var ed = !!m.editat_manual;
    var stele = m.stele || (ex && ex.stele) || 0;
    return {
      id: String(m.id),
      ini: initialeEx({ unitate: m.unitate || (ex && ex.unitate) }, unit),
      nume: nume,
      tema: lista[0] || "",
      pol: clsPol(pol),
      polNume: POL[pol] ? pol : "",
      ed: ed,
      titlu: [
        m.unitate || (ex && ex.unitate) || "",
        stele ? L.nr(stele, "stea", "stele") : "",
        POL[pol] ? pol : "",
        lista.join(", "),
        ed ? "corectat de echipă" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  function tokeni(list) {
    return (Array.isArray(list) ? list : []).map(token).filter(Boolean);
  }

  /* --------------------------------------------------------- the cluster */

  function pozitie(k) {
    if (k <= 0) return { x: V.cx, y: V.cy };
    var r = V.pas * Math.sqrt(k);
    var a = k * UNGHI + V.rot;
    return { x: V.cx + r * Math.cos(a), y: V.cy + r * Math.sin(a) };
  }

  /* Nodes in creation order (m1, m2...): an updated example keeps its place. */
  function noduri() {
    var cron = S.exemple.slice().sort(function (a, b) {
      return (
        nrId(a.id) - nrId(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
    });
    if (cron.length > MAX_NODURI) cron = cron.slice(cron.length - MAX_NODURI);
    return cron.map(function (e, k) {
      var p = pozitie(k);
      return { e: e, x: p.x, y: p.y };
    });
  }

  /* The topics with the most examples, at most 4, evenly spaced on the right. */
  function eticheteTeme(nds) {
    var nr = {};
    var prima = {};
    nds.forEach(function (n, k) {
      n.e.teme.forEach(function (t) {
        nr[t] = (nr[t] || 0) + 1;
        if (!(t in prima)) prima[t] = k;
      });
    });
    var chei = Object.keys(nr)
      .sort(function (a, b) {
        return nr[b] - nr[a] || prima[a] - prima[b];
      })
      .slice(0, MAX_TEME);
    var pas = 21;
    var y0 = V.cy - ((chei.length - 1) * pas) / 2;
    return chei.map(function (t, i) {
      return { t: t, n: nr[t], y: y0 + i * pas };
    });
  }

  function curba(x1, y1, x2, y2) {
    var k = Math.max(0, (x2 - x1) * 0.5);
    return (
      "M" +
      r1(x1) +
      " " +
      r1(y1) +
      "C" +
      r1(x1 + k) +
      " " +
      r1(y1) +
      " " +
      r1(x2 - k) +
      " " +
      r1(y2) +
      " " +
      r1(x2) +
      " " +
      r1(y2)
    );
  }

  function scurt(t) {
    return t.length > 11 ? t.slice(0, 10) + "…" : t;
  }

  function titluExemplu(e) {
    return [
      e.unitate,
      e.stele ? L.nr(e.stele, "stea", "stele") : "",
      e.polaritate,
      e.teme.join(", "),
      e.editat_manual ? "corectat de echipă" : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function descriere(nds, et) {
    if (!nds.length) return "Memoria rețelei este goală.";
    var n = { negativ: 0, mixt: 0, pozitiv: 0 };
    nds.forEach(function (x) {
      if (n[x.e.polaritate] !== undefined) n[x.e.polaritate]++;
    });
    var ton = Object.keys(n)
      .filter(function (k) {
        return n[k];
      })
      .map(function (k) {
        return k + " " + n[k];
      })
      .join(", ");
    var tm = et
      .map(function (x) {
        return x.t + " " + x.n;
      })
      .join(", ");
    return (
      "Exemple după ton: " +
      (ton || "nedefinit") +
      "." +
      (tm ? " Teme: " + tm + "." : "")
    );
  }

  function htmlNod(n, nou, astept) {
    var e = n.e;
    return (
      '<g class="mem-nd p-' +
      clsPol(e.polaritate) +
      (e.editat_manual ? " is-ed" : "") +
      (nou ? " is-nou" : "") +
      (astept ? " is-wait" : "") +
      '" data-mid="' +
      esc(e.id) +
      '" transform="translate(' +
      r1(n.x) +
      " " +
      r1(n.y) +
      ')"><title>' +
      esc(titluExemplu(e)) +
      "</title>" +
      (nou ? '<circle class="mem-rip" r="' + V.rn + '"/>' : "") +
      '<g class="mem-nd-in">' +
      (e.editat_manual ? '<circle class="mem-ring" r="' + V.rr + '"/>' : "") +
      '<circle class="mem-dot" r="' +
      V.rn +
      '"/></g></g>'
    );
  }

  function svgGol() {
    return (
      '<circle class="mem-gol-c" cx="' +
      V.cx +
      '" cy="' +
      V.cy +
      '" r="24"/><circle class="mem-gol-d" cx="' +
      V.cx +
      '" cy="' +
      V.cy +
      '" r="2.5"/><path class="mem-gol-l" d="M' +
      (V.lx - 4) +
      " " +
      (V.cy - 10) +
      "h40M" +
      (V.lx - 4) +
      " " +
      (V.cy + 10) +
      'h26"/>'
    );
  }

  /* o: {nou: id of the node that just landed, temeVechi: labels on screen before this render} */
  function svg(o) {
    o = o || {};
    var nds = noduri();
    var et = eticheteTeme(nds);
    var dupaTema = {};
    et.forEach(function (x) {
      dupaTema[x.t] = x;
    });
    var lin = [];
    var nod = [];
    nds.forEach(function (n) {
      var id = n.e.id;
      var nou = o.nou === id;
      var astept = S.zbor.has(id);
      n.e.teme.forEach(function (t) {
        var l = dupaTema[t];
        if (!l) return;
        lin.push(
          '<path class="mem-l' +
            (nou ? " is-nou" : "") +
            (astept ? " is-wait" : "") +
            '" data-mid="' +
            esc(id) +
            '" pathLength="1" d="' +
            curba(n.x + V.rn + 1.5, n.y, V.lx - 8, l.y) +
            '"/>',
        );
      });
      nod.push(htmlNod(n, nou, astept));
    });
    var tv = o.temeVechi || null;
    return (
      '<svg class="mem-svg" viewBox="0 0 ' +
      V.w +
      " " +
      V.h +
      '" width="' +
      V.w +
      '" height="' +
      V.h +
      '" role="img" aria-label="' +
      esc(descriere(nds, et)) +
      '" focusable="false">' +
      (nds.length ? "" : svgGol()) +
      '<g class="mem-ls">' +
      lin.join("") +
      '</g><g class="mem-ts">' +
      et
        .map(function (x) {
          return (
            '<g class="mem-t' +
            (tv && !tv[x.t] ? " is-nou" : "") +
            '" data-tema="' +
            esc(x.t) +
            '"><circle class="mem-port" cx="' +
            (V.lx - 6) +
            '" cy="' +
            r1(x.y) +
            '" r="2"/><text x="' +
            V.lx +
            '" y="' +
            r1(x.y) +
            '" dy="0.35em">' +
            esc(scurt(x.t)) +
            "</text></g>"
          );
        })
        .join("") +
      '</g><g class="mem-ns">' +
      nod.join("") +
      "</g></svg>"
    );
  }

  /* ------------------------------------------------------------- widget */

  function cuvinteExemple(n) {
    return n === 1 ? "exemplu învățat" : L.cuDe(n) + "exemple învățate";
  }

  function textExemple(n) {
    return L.fmtNr(n) + " " + cuvinteExemple(n);
  }

  function textCorecturi(m) {
    if (!m) return "nicio corectură a echipei";
    if (m === 1) return "o corectură a echipei";
    return L.fmtNr(m) + " " + L.cuDe(m) + "corecturi ale echipei";
  }

  function eGoala() {
    return !S.total && !S.exemple.length;
  }

  /* o: svg options + {txtNou: the counts replace the empty line, edNou: the corrections changed} */
  function htmlWidget(o) {
    o = o || {};
    var txt = eGoala()
      ? '<p class="mem-gol just" lang="ro">' + esc(HY.gol) + "</p>"
      : '<p class="mem-n"><b class="mem-num">' +
        esc(L.fmtNr(S.total)) +
        '</b> <span class="mem-w">' +
        esc(cuvinteExemple(S.total)) +
        '</span></p><p class="mem-ed' +
        (o.edNou ? " is-nou" : "") +
        '">' +
        esc(textCorecturi(S.editate)) +
        "</p>";
    return (
      '<div class="mem-in' +
      (o.txtNou ? " is-nou" : "") +
      '"><div class="mem-viz">' +
      svg(o) +
      '</div><div class="mem-txt"><h2 class="mem-title" id="memTitlu">' +
      L.icon("nodes") +
      "Memoria rețelei</h2>" +
      txt +
      '</div><button type="button" class="btn link sm mem-btn" data-mem-sertar aria-haspopup="dialog">Ce a învățat rețeaua</button></div>'
    );
  }

  function randeaza(o) {
    if (!S.el) return;
    S.el.innerHTML = htmlWidget(o);
    S.el.removeAttribute("aria-busy");
    S.afisat = { n: S.total, m: S.editate, gol: eGoala() };
  }

  function arata(da) {
    if (!S.el) return;
    S.el.hidden = !da;
    if (S.cap) S.cap.classList.toggle("has-mem", !!da);
  }

  function indisponibil() {
    S.disponibil = false;
    arata(false);
  }

  /* --------------------------------------------------------- server I/O */

  /* o: {liniste} a background refresh: never hides the widget, redraws only on a change. */
  function incarca(o) {
    o = o || {};
    if (!S.el) return Promise.resolve();
    var ver = ++S.cerere;
    return L.api("api/memorie", { timeoutMs: 15000 }).then(
      function (r) {
        if (ver !== S.cerere) return;
        var d = r && r.ok ? r.data : null;
        if (!d || typeof d !== "object" || !Array.isArray(d.exemple)) {
          if (!S.gata) indisponibil();
          return;
        }
        var inainte = S.gata ? semnatura() : null;
        aplica(d);
        S.gata = true;
        if (!S.disponibil) {
          S.disponibil = true;
          arata(true);
        }
        if (
          o.liniste &&
          inainte === semnatura() &&
          S.el.querySelector(".mem-svg")
        )
          return;
        randeaza();
      },
      function (e) {
        if (ver !== S.cerere || (e && e.kind === "auth")) return;
        if (!S.gata) indisponibil();
      },
    );
  }

  /* After a learning moment: one quiet GET once every pill has landed (the server is the truth). */
  function programeaza() {
    clearTimeout(S.reconT);
    S.reconT = setTimeout(function () {
      if (S.zbor.size) {
        programeaza();
        return;
      }
      incarca({ liniste: true });
    }, RECONCILIERE_MS);
  }

  /* --------------------------------------------------- the learning moment */

  function punctPornire(btn) {
    if (!btn || !btn.isConnected) return null;
    var r = btn.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    if (y < barJos() || y > window.innerHeight || x < 0 || x > vw) return null;
    return { x: x, y: y };
  }

  function pozitiaNodului(id) {
    var nds = noduri();
    for (var i = 0; i < nds.length; i++) if (nds[i].e.id === id) return nds[i];
    return null;
  }

  /* The new node's place in the widget when it is on screen, else the dock under the bar. */
  function tintaZbor(ex) {
    var s = S.el && !S.el.hidden ? S.el.querySelector(".mem-svg") : null;
    var p = pozitiaNodului(ex.id);
    if (s && p) {
      var r = s.getBoundingClientRect();
      var x = r.left + p.x;
      var y = r.top + p.y;
      if (r.width && y >= barJos() + 8 && y <= window.innerHeight - 8)
        return { x: x, y: y, dock: false };
    }
    return arataDock();
  }

  /* The pill that flies (also the token of the network's "din memorie" group). */
  function pastila(ex) {
    var tema = ex.teme[0] || "";
    return (
      '<span class="mem-fly-p"><span class="mt p-' +
      clsPol(ex.polaritate) +
      (ex.editat_manual ? " is-ed" : "") +
      '"></span><span><b>' +
      esc(initialeEx(ex, ex.unit_id)) +
      "</b>" +
      (tema ? " · " + esc(tema) : "") +
      "</span></span>"
    );
  }

  /* Card -> memory: x eases in and out, y eases out, so the pill rises first and then glides in;
     it shrinks into the node's size on the way and is gone when the node takes its place. */
  function zboara(a, b, ex) {
    var c = curbe();
    var el = document.createElement("div");
    el.className = "mem-fly";
    el.setAttribute("aria-hidden", "true");
    el.style.left = r1(a.x) + "px";
    el.style.top = r1(a.y) + "px";
    el.innerHTML = '<div class="mem-fly-y">' + pastila(ex) + "</div>";
    document.body.appendChild(el);
    var y = el.firstChild;
    var p = y.firstChild;
    var dx = r1(b.x - a.x);
    var dy = r1(b.y - a.y);
    var ax;
    try {
      ax = el.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(" + dx + "px)" },
        ],
        { duration: ZBOR_MS, easing: c.inOut, fill: "forwards" },
      );
      y.animate(
        [
          { transform: "translateY(0)" },
          { transform: "translateY(" + dy + "px)" },
        ],
        { duration: ZBOR_MS, easing: c.out, fill: "forwards" },
      );
      p.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.86)", opacity: 0 },
          {
            transform: "translate(-50%, -50%) scale(1)",
            opacity: 1,
            offset: 0.12,
          },
          {
            transform: "translate(-50%, -50%) scale(0.92)",
            opacity: 1,
            offset: 0.6,
          },
          {
            transform: "translate(-50%, -50%) scale(0.42)",
            opacity: 1,
            offset: 0.9,
          },
          { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
        ],
        { duration: ZBOR_MS, easing: "linear", fill: "forwards" },
      );
    } catch (e) {
      ax = null;
    }
    return finalizat(ax, ax ? ZBOR_MS + 500 : 0).then(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  /* The figure ticks: the old value leaves upwards, the new one comes in from below. */
  function rula(el, de, la, sus) {
    if (!el || de === la || !poateAnima()) {
      if (el) el.textContent = la;
      return;
    }
    el.innerHTML =
      '<span class="mem-roll" aria-hidden="true"><span class="mem-roll-o">' +
      esc(de) +
      '</span><span class="mem-roll-n">' +
      esc(la) +
      '</span></span><span class="sr-only">' +
      esc(la) +
      "</span>";
    var o = el.querySelector(".mem-roll-o");
    var n = el.querySelector(".mem-roll-n");
    var d = sus ? -0.5 : 0.5;
    var opt = { duration: NUMAR_MS, easing: curbe().out, fill: "both" };
    var anim = null;
    try {
      o.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(" + d + "em)", opacity: 0 },
        ],
        opt,
      );
      anim = n.animate(
        [
          { transform: "translateY(" + -d + "em)", opacity: 0 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        opt,
      );
    } catch (e) {
      anim = null;
    }
    finalizat(anim, NUMAR_MS + 300).then(function () {
      if (el.isConnected) el.textContent = la;
    });
  }

  function ruleazaContor(vechi) {
    if (!vechi || vechi.gol || !S.el) return;
    var el = S.el.querySelector(".mem-num");
    if (el && vechi.n !== S.total)
      rula(el, L.fmtNr(vechi.n), L.fmtNr(S.total), S.total > vechi.n);
  }

  function pulseaza(el) {
    if (!el) return;
    el.classList.remove("is-puls");
    void el.offsetWidth; // restart the ring
    el.classList.add("is-puls");
    setTimeout(function () {
      el.classList.remove("is-puls");
    }, 900);
  }

  function temeAfisate() {
    var t = {};
    if (S.el)
      forEach(S.el.querySelectorAll(".mem-t[data-tema]"), function (g) {
        t[g.getAttribute("data-tema")] = true;
      });
    return t;
  }

  function randeazaInvatat(ex, vechi) {
    var gol = !vechi || vechi.gol;
    randeaza({
      nou: ex.id,
      temeVechi: temeAfisate(),
      txtNou: gol && !eGoala(),
      edNou: !gol && vechi.m !== S.editate,
    });
  }

  /* The dock: a small copy of the widget under the bar, for a learning moment off screen. */
  function arataDock() {
    var d = S.dock;
    if (!d) {
      d = document.createElement("div");
      d.className = "mem-dock";
      d.setAttribute("aria-hidden", "true");
      d.innerHTML =
        '<span class="mem-dock-viz"><svg viewBox="0 0 40 40" width="40" height="40" focusable="false">' +
        '<circle class="mem-gol-c" cx="20" cy="20" r="13"/><g class="mem-dock-ns"></g></svg></span>' +
        '<span class="mem-dock-t"><span class="mem-dock-h">Memoria rețelei</span>' +
        '<span class="mem-dock-n"><span class="mem-num"></span> <span class="mem-w"></span></span></span>';
      document.body.appendChild(d);
      void d.offsetWidth; // the entrance transition needs a first style
      S.dock = d;
    }
    clearTimeout(S.dockT);
    var w = S.el && !S.el.hidden ? S.el.getBoundingClientRect() : null;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    d.style.right =
      Math.max(12, Math.round(w && w.width ? vw - w.right : 24)) + "px";
    d.style.top = Math.round(barJos() + 12) + "px";
    var n = S.afisat ? S.afisat.n : 0;
    d.querySelector(".mem-num").textContent = L.fmtNr(n);
    d.querySelector(".mem-w").textContent = cuvinteExemple(n);
    d.querySelector(".mem-dock-ns").innerHTML = "";
    var intra = !d.classList.contains("is-in");
    d.classList.add("is-in");
    var r = d.querySelector(".mem-dock-viz").getBoundingClientRect();
    // measured at the start of its 6 px entrance: aim where it settles
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2 + (intra ? 6 : 0),
      dock: true,
    };
  }

  function aterizeazaDock(ex, vechi) {
    var d = S.dock;
    if (!d) return;
    d.querySelector(".mem-dock-ns").innerHTML =
      '<g class="mem-nd p-' +
      clsPol(ex.polaritate) +
      (ex.editat_manual ? " is-ed" : "") +
      ' is-nou" transform="translate(20 20)"><circle class="mem-rip" r="4.5"/><g class="mem-nd-in">' +
      (ex.editat_manual ? '<circle class="mem-ring" r="7.5"/>' : "") +
      '<circle class="mem-dot" r="4.5"/></g></g>';
    d.querySelector(".mem-w").textContent = cuvinteExemple(S.total);
    var num = d.querySelector(".mem-num");
    if (vechi && !vechi.gol && vechi.n !== S.total)
      rula(num, L.fmtNr(vechi.n), L.fmtNr(S.total), S.total > vechi.n);
    else num.textContent = L.fmtNr(S.total);
    pulseaza(d);
    clearTimeout(S.dockT);
    S.dockT = setTimeout(ascundeDock, DOCK_MS);
  }

  function ascundeDock() {
    var d = S.dock;
    if (!d) return;
    d.classList.remove("is-in");
    S.dockT = setTimeout(function () {
      if (d.classList.contains("is-in")) return;
      if (d.parentNode) d.parentNode.removeChild(d);
      if (S.dock === d) S.dock = null;
    }, 240);
  }

  /* o: {act: an update of an existing example, vechi: counts on screen, buton: where it starts} */
  function invata(ex, o) {
    var mesaj = o.act ? TOAST_ACT : TOAST_NOU;
    var start = poateAnima() ? punctPornire(o.buton) : null;
    if (!start) {
      // reduced motion (or nothing to start from): the widget updates, the toast says what changed
      if (poateAnima()) {
        randeazaInvatat(ex, o.vechi);
        ruleazaContor(o.vechi);
        pulseaza(S.el);
      } else randeaza();
      L.toast(mesaj, "ok");
      programeaza();
      return;
    }
    if (!S.el.querySelector(".mem-svg")) randeaza(); // the skeleton has no cluster to aim at
    S.zbor.add(ex.id);
    var tinta = tintaZbor(ex);
    zboara(start, tinta, ex).then(function () {
      S.zbor.delete(ex.id);
      randeazaInvatat(ex, o.vechi);
      if (tinta.dock) aterizeazaDock(ex, o.vechi);
      else {
        ruleazaContor(o.vechi);
        pulseaza(S.el);
      }
      L.toast(mesaj, "ok");
      programeaza();
    });
  }

  /* The "memorie" of POST /api/aproba and /api/publica: {nou, actualizat, total, editate}.
     o: {reviewId, buton (the clicked button: the pill starts there)} */
  function dinRaspuns(mem, o) {
    if (!S.el || !mem || typeof mem !== "object" || Array.isArray(mem)) return;
    o = o || {};
    S.cerere++; // a GET /api/memorie still on its way must not undo this
    var vechi = S.afisat
      ? { n: S.afisat.n, m: S.afisat.m, gol: S.afisat.gol }
      : null;
    var nou = exemplu(mem.nou);
    var act = mem.actualizat === true;
    var tinta = null;
    if (nou) {
      pune(nou);
      tinta = nou;
    } else if (act) tinta = dupaReview(o.reviewId);
    var t = numar(mem.total);
    var m = numar(mem.editate);
    S.total = t !== null ? t : Math.max(S.total, S.exemple.length);
    S.editate = m !== null ? m : editateLocal();
    S.gata = true;
    if (!S.disponibil) {
      S.disponibil = true;
      arata(true);
    }
    if (!tinta) {
      // nothing new to show as a node: the counts follow the server
      if (
        !vechi ||
        vechi.n !== S.total ||
        vechi.m !== S.editate ||
        !S.el.querySelector(".mem-svg")
      )
        randeaza();
      if (act) L.toast(TOAST_ACT, "ok");
      programeaza(); // an answer without a usable example: the quiet GET brings the server's truth
      return;
    }
    invata(tinta, { act: act, vechi: vechi, buton: o.buton });
  }

  /* --------------------------------------------- pointing (widget, chips) */

  /* One example lit in the widget (its node and links), the rest dimmed; null = none. */
  function aprinde(mid, on) {
    if (!S.el) return;
    var s = S.el.querySelector(".mem-svg");
    if (!s) return;
    mid = mid == null ? "" : String(mid);
    var gasit = false;
    if (on && mid)
      forEach(s.querySelectorAll(".mem-nd"), function (n) {
        if (n.getAttribute("data-mid") === mid) gasit = true;
      });
    S.el.classList.toggle("mem-focus", gasit);
    forEach(s.querySelectorAll(".mem-nd, .mem-l"), function (x) {
      x.classList.toggle("is-on", gasit && x.getAttribute("data-mid") === mid);
    });
  }

  function leaga(root, sel) {
    root.addEventListener("mouseover", function (e) {
      var t = e.target.closest && e.target.closest(sel);
      if (t) aprinde(t.getAttribute("data-mid"), true);
    });
    root.addEventListener("mouseout", function (e) {
      var t = e.target.closest && e.target.closest(sel);
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget)))
        aprinde(null, false);
    });
  }

  /* "Din memorie" chips in the cards light their node in the widget. */
  function leagaHover(root) {
    if (!root || root.__memHover) return;
    root.__memHover = true;
    leaga(root, ".an-mem-c[data-mid]");
  }

  /* ------------------------------------------------------------- drawer */

  function jetoane(t) {
    var out = [];
    var re = /(\S+)(\s*)/g;
    var s = String(t || "")
      .split(SHY)
      .join("");
    var m;
    while ((m = re.exec(s))) out.push({ w: m[1], s: m[2] });
    return out;
  }

  /* Longest common subsequence of words, then the edit script (old -> new). */
  function lcs(a, b) {
    var n = a.length;
    var m = b.length;
    var w = m + 1;
    var T = new Uint16Array((n + 1) * w);
    var i;
    var j;
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        T[i * w + j] =
          a[i].w === b[j].w
            ? T[(i + 1) * w + j + 1] + 1
            : Math.max(T[(i + 1) * w + j], T[i * w + j + 1]);
      }
    }
    var ops = [];
    i = 0;
    j = 0;
    while (i < n && j < m) {
      if (a[i].w === b[j].w) {
        ops.push(["=", b[j]]);
        i++;
        j++;
      } else if (T[(i + 1) * w + j] >= T[i * w + j + 1])
        ops.push(["-", a[i++]]);
      else ops.push(["+", b[j++]]);
    }
    while (i < n) ops.push(["-", a[i++]]);
    while (j < m) ops.push(["+", b[j++]]);
    return ops;
  }

  /* Runs of one kind; inside a change, what was removed comes before what was added. */
  function grupe(ops) {
    var out = [];
    var k = 0;
    while (k < ops.length) {
      if (ops[k][0] === "=") {
        var eq = [];
        while (k < ops.length && ops[k][0] === "=") eq.push(ops[k++][1]);
        out.push({ op: "=", t: eq });
        continue;
      }
      var del = [];
      var ins = [];
      while (k < ops.length && ops[k][0] !== "=")
        (ops[k][0] === "-" ? del : ins).push(ops[k++][1]);
      if (del.length) out.push({ op: "-", t: del });
      if (ins.length) out.push({ op: "+", t: ins });
    }
    return out;
  }

  /* Word-level diff as escaped HTML: removed words in <del>, added ones in <ins>, the approved
     text's own spacing and line breaks. "" when there is nothing sensible to compare. */
  function htmlDiff(vechi, nou) {
    var a = jetoane(vechi);
    var b = jetoane(nou);
    if (
      !a.length ||
      !b.length ||
      a.length > MAX_CUVINTE_DIFF ||
      b.length > MAX_CUVINTE_DIFF
    )
      return "";
    var g = grupe(lcs(a, b));
    var out = "";
    var liber = true; // the output ends with a space or a line break
    g.forEach(function (x, gi) {
      if (!liber) out += " ";
      var buc = x.t
        .map(function (t, i) {
          if (i === x.t.length - 1) return esc(t.w);
          return esc(t.w) + esc(x.op === "-" ? " " : t.s || " ");
        })
        .join("");
      if (x.op === "=") out += buc;
      else if (x.op === "-")
        out += '<del><span class="sr-only">scos: </span>' + buc + "</del>";
      else
        out += '<ins><span class="sr-only">adăugat: </span>' + buc + "</ins>";
      var coada =
        x.op === "-" || gi === g.length - 1 ? "" : x.t[x.t.length - 1].s;
      out += esc(coada);
      liber = coada.length > 0;
    });
    return out;
  }

  function corpExemplu(e, lang) {
    var aprobat = e.raspuns_aprobat;
    if (e.editat_manual && e.propunere_initiala && aprobat) {
      var d = htmlDiff(e.propunere_initiala, aprobat);
      if (d)
        return (
          '<p class="mem-dh just" lang="ro">' +
          esc(HY.corectat) +
          '</p><p class="mem-key" aria-hidden="true"><del>scos de echipă</del><ins>adăugat de echipă</ins></p>' +
          '<p class="hist-text mem-diff just-auto" lang="' +
          esc(lang) +
          '">' +
          d +
          "</p>"
        );
    }
    return aprobat
      ? '<p class="hist-text just-auto" lang="' +
          esc(lang) +
          '">' +
          esc(aprobat) +
          "</p>"
      : "";
  }

  function htmlExemplu(e) {
    var lang = L.langAttr(e.limba);
    var unit = e.unit_id !== "" ? e.unit_id : null;
    var sursa =
      e.sursa === "publicare"
        ? '<span class="badge state">' +
          L.icon("send") +
          "Publicat în demonstrație</span>"
        : '<span class="badge ok">' + L.icon("check") + "Aprobat</span>";
    var pol = POL[e.polaritate]
      ? '<li class="an-pol p-' +
        POL[e.polaritate] +
        '">' +
        esc(e.polaritate) +
        "</li>"
      : "";
    var tm = e.teme
      .map(function (t) {
        return '<li class="mem-tema">' + esc(t) + "</li>";
      })
      .join("");
    return (
      '<li class="hist-item mem-item" data-mid="' +
      esc(e.id) +
      '"><div class="hist-top">' +
      (e.cand
        ? '<span class="hist-time">' + esc(L.oraZi(e.cand)) + "</span>"
        : "") +
      sursa +
      (e.editat_manual
        ? '<span class="badge prop">' +
          L.icon("pencil") +
          "Corectat de echipă</span>"
        : "") +
      '</div><div class="hist-rev">' +
      (unit !== null ? L.avatarUnitate(unit, initialeEx(e, unit), "xs") : "") +
      "<span>" +
      esc(e.unitate || "Unitate") +
      "</span>" +
      (e.stele ? L.stele(e.stele) : "") +
      (e.limba ? L.cipLimba(e.limba) : "") +
      "</div>" +
      (pol || tm
        ? '<ul class="mem-teme" aria-label="Ton și teme">' + pol + tm + "</ul>"
        : "") +
      (e.fragment
        ? '<p class="mem-frag just-auto" lang="' +
          esc(lang) +
          '">„' +
          esc(e.fragment) +
          "”</p>"
        : "") +
      corpExemplu(e, lang) +
      "</li>"
    );
  }

  function randeazaSertar() {
    if (!S.sertar) return;
    var b = S.sertar.body;
    var ol = b.querySelector("#memLista");
    var sum = b.querySelector("#memSum");
    if (!ol || !sum) return;
    if (!S.exemple.length) {
      sum.hidden = true;
      ol.innerHTML =
        '<li class="hist-empty just" lang="ro">' + esc(HY.gol) + "</li>";
      return;
    }
    sum.hidden = false;
    sum.textContent = textExemple(S.total) + " · " + textCorecturi(S.editate);
    ol.innerHTML = S.exemple.map(htmlExemplu).join("");
  }

  function deschideSertar() {
    if (S.sertar) return;
    S.sertar = L.deschide({
      side: true,
      title: "Ce a învățat rețeaua",
      html:
        '<p class="drawer-sub mem-sub just" lang="ro">' +
        esc(HY.sub) +
        '</p><p class="mem-sum" id="memSum" hidden></p><ol class="hist mem-list" id="memLista"></ol>',
      actions: [{ label: "Închide", cls: "ghost", close: true }],
      onClose: function () {
        S.sertar = null;
      },
      returnFocus: function () {
        return S.el && S.el.querySelector("[data-mem-sertar]");
      },
    });
    randeazaSertar();
    incarca({ liniste: true }).then(randeazaSertar, randeazaSertar);
  }

  /* --------------------------------------------------------------- init */

  /* o: {el (#memorie), cap (.pagehead), ini (unit id -> initials), unitate (name -> unit id)} */
  function init(o) {
    o = o || {};
    S.el = o.el || null;
    S.cap = o.cap || null;
    S.ini = typeof o.ini === "function" ? o.ini : null;
    S.unitDupaNume = typeof o.unitate === "function" ? o.unitate : null;
    if (!S.el) {
      if (S.cap) S.cap.classList.remove("has-mem");
      return Promise.resolve();
    }
    S.el.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-mem-sertar]"))
        deschideSertar();
    });
    leaga(S.el, ".mem-nd[data-mid]");
    return incarca();
  }

  L.memorie = {
    init: init,
    incarca: incarca,
    probabile: probabile,
    folosite: folosite,
    tokeni: tokeni,
    exemplu: dupaId,
    dinRaspuns: dinRaspuns,
    aprinde: aprinde,
    leagaHover: leagaHover,
    deschide: deschideSertar,
    /* pure parts, for the tests */
    _t: {
      htmlDiff: htmlDiff,
      cuvinteExemple: cuvinteExemple,
      textCorecturi: textCorecturi,
      pozitie: pozitie,
      noduri: noduri,
      eticheteTeme: eticheteTeme,
      exemplu: exemplu,
      stare: S,
      V: V,
    },
  };
})();
