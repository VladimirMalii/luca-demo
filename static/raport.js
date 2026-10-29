/* LUCA demo: printable unit report (/rapoarte/{id}). Google figures, sample label,
   Aprecieri / Aspecte de verificat / Acțiuni propuse from the prepared analysis,
   the sample reviews with their state in the app, print and e-mail preview.
   Google Business Profile indicators: a labelled SIMULATION block, same numbers as /rapoarte. */
(function () {
  "use strict";

  var L = window.LUCA;
  var esc = L.esc;
  var ic = L.icon;
  var IDENTIC = "Mulțumim, Echipa LUCA";
  /* Fixed footnote, soft-hyphenated once with app/demo/silabe.py (ro). */
  var NOTA_SUBSOL =
    "Nota și nu\u00ADmă\u00ADrul de re\u00ADcen\u00ADzii pro\u00ADvin din Google; res\u00ADtul ci\u00ADfre\u00ADlor, din eșan\u00ADtion. Res\u00ADpon\u00ADsa\u00ADbi\u00ADlii și ter\u00ADme\u00ADne\u00ADle sunt pro\u00ADpu\u00ADneri, de va\u00ADli\u00ADdat de echi\u00ADpa LUCA.";
  var STARI = {
    de_raspuns: ["De răspuns", "state"],
    propunere: ["Propunere pregătită", "prop"],
    aprobat: ["Aprobat", "ok"],
    verificare_interna: ["La verificare internă", "wait"],
    verificat_intern: ["Verificat intern", "ok"],
    publicat_demo: ["Aprobat · publicare oprită în demonstrație", "state"],
  };
  var STEA =
    '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/></svg>';

  /* SIM-GBP:START. Keep this block identical in rapoarte.js and raport.js (a script compares them).
     Google Business Profile indicators, SIMULATION: illustrative figures, never LUCA data, always
     shown with the "Simulare" label. Deterministic (no Math.random): one seeded PRNG per unit
     (FNV-1a of the unit id, then mulberry32). Scale from the unit's public Google review count
     (sublinear), a small per-unit trend, mild seasonality and noise. */
  var SHY = String.fromCharCode(173);
  var MINUS = String.fromCharCode(8722);
  var SIM = {
    sare: "gbp-sim:",
    an: 2026,
    luni: ["aprilie", "mai", "iunie", "iulie", "august", "septembrie"],
    scurt: ["apr.", "mai", "iun.", "iul.", "aug.", "sept."],
    sezon: [0.97, 0.99, 1.02, 1.01, 0.99, 1.01],
    baza: 1500, // impressions per month = baza + factor * reviews^exp, times the unit factor
    factor: 90,
    exp: 0.75,
    minRecenzii: 10,
    nivel: [0.85, 0.3], // per-unit level factor: min, span
    panta: [-0.01, 0.035], // per-unit monthly trend: min, span
    rata: [
      [1, 0],
      [0.008, 0.008],
      [0.0012, 0.0012],
      [0.0025, 0.0025],
    ], // share of impressions
    zgomot: [0.05, 0.08, 0.15, 0.1], // relative noise per metric
    minim: [100, 1, 1, 1],
    metrici: [
      {
        t: "Afișări în Căutare și Hărți",
        b: "Afișări",
        u: ["afișare", "afișări"],
      },
      {
        t: "Cereri de indicații",
        b: "Cereri de indicații",
        u: ["cerere de indicații", "cereri de indicații"],
      },
      { t: "Apeluri", b: "Apeluri", u: ["apel", "apeluri"] },
      {
        t: "Clicuri pe site",
        b: "Clicuri pe site",
        u: ["clic pe site", "clicuri pe site"],
      },
    ],
    /* soft hyphens ("|") from app/demo/silabe.py (ro); "Google" kept whole */
    text: "Date ilus|tra|ti|ve, nu sunt ale LUCA. In|di|ca|to|rii reali apar după co|nec|ta|rea Pro|fi|lu|lui de com|pa|nie Google.",
  };
  var SIM_TAG = '<span class="sim-tag">simulare</span>';
  var SIM_SAGETI = {
    up: '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
    down: '<path d="m7 7 10 10"/><path d="M17 7v10H7"/>',
    flat: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  };

  function simSeed(s) {
    var h = 0x811c9dc5;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function simPrng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* One unit: 4 metrics x 6 months of integers, [metric][month], oldest month first. */
  function simUnitate(id, count) {
    var r = simPrng(simSeed(SIM.sare + id));
    var c = Math.max(SIM.minRecenzii, Number(count) || 0);
    var nivel =
      (SIM.baza + SIM.factor * Math.pow(c, SIM.exp)) *
      (SIM.nivel[0] + SIM.nivel[1] * r());
    var panta = SIM.panta[0] + SIM.panta[1] * r();
    var rata = SIM.rata.map(function (x) {
      return x[1] ? x[0] + x[1] * r() : x[0];
    });
    var n = SIM.luni.length;
    var out = rata.map(function () {
      return [];
    });
    for (var m = 0; m < n; m++) {
      var b =
        nivel *
        Math.pow(1 + panta, m - (n - 1)) *
        (SIM.sezon[m] / SIM.sezon[n - 1]);
      for (var j = 0; j < rata.length; j++) {
        var v = b * rata[j] * (1 + SIM.zgomot[j] * (2 * r() - 1));
        out[j].push(Math.max(SIM.minim[j], Math.round(v)));
      }
    }
    return out;
  }

  /* Change of the last month vs the one before, as a fraction (null when undefined). */
  function simDelta(a) {
    var p = a[a.length - 2];
    var v = a[a.length - 1];
    return p > 0 ? (v - p) / p : null;
  }

  /* Romanian percent with a sign: +4,3%, minus sign (U+2212) for decreases, 0,0% when flat. */
  function simPct(x) {
    if (x === null || x === undefined || !isFinite(x)) return "";
    var s = Math.abs(x * 100)
      .toFixed(1)
      .replace(".", ",");
    if (s === "0,0") return "0,0%";
    return (x > 0 ? "+" : MINUS) + s + "%";
  }

  function simDir(pct) {
    if (!pct || pct === "0,0%") return "flat";
    return pct.charAt(0) === "+" ? "up" : "down";
  }

  function simSageata(dir) {
    return (
      '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (SIM_SAGETI[dir] || SIM_SAGETI.flat) +
      "</svg>"
    );
  }

  function simLuna(i) {
    return SIM.luni[i] + " " + SIM.an;
  }

  function simBanner() {
    return (
      '<div class="sim-banner"><span class="badge sim">Simulare</span><p class="just">' +
      esc(SIM.text.split("|").join(SHY)) +
      "</p></div>"
    );
  }

  /* Sparkline over the 6 months: grey line, last month in blue, end dot (HTML, never stretched). */
  function simSpark(a, m) {
    var min = Math.min.apply(null, a);
    var max = Math.max.apply(null, a);
    var span = max - min || 1;
    var pts = a.map(function (v, i) {
      return [
        Math.round((i / (a.length - 1)) * 1000) / 10,
        Math.round((3 + (1 - (v - min) / span) * 24) * 10) / 10,
      ];
    });
    var str = function (p) {
      return p
        .map(function (q) {
          return q[0] + "," + q[1];
        })
        .join(" ");
    };
    var ultim = pts[pts.length - 1];
    var lista = a
      .map(function (v, i) {
        return SIM.luni[i] + " " + L.fmtNr(v);
      })
      .join(", ");
    return (
      '<span class="gt-sp"><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<polyline class="sp-l" points="' +
      str(pts) +
      '"/><polyline class="sp-c" points="' +
      str(pts.slice(-2)) +
      '"/></svg><span class="sp-dot" aria-hidden="true" style="top:' +
      Math.round((ultim[1] / 30) * 1000) / 10 +
      '%"></span><span class="sr-only">' +
      esc(
        m.t +
          ", din " +
          SIM.luni[0] +
          " până în " +
          simLuna(a.length - 1) +
          ": " +
          lista,
      ) +
      "</span></span>"
    );
  }

  /* Stat tile: last month's value, change vs the month before, 6-month sparkline, "simulare" tag. */
  function simTile(m, a) {
    var pct = simPct(simDelta(a));
    var dir = simDir(pct);
    return (
      '<div class="gtile"><div class="gt-top"><span class="gt-v">' +
      esc(L.fmtNr(a[a.length - 1])) +
      "</span>" +
      SIM_TAG +
      '</div><div class="gt-k">' +
      esc(m.t) +
      '</div><div class="gt-d ' +
      dir +
      '">' +
      simSageata(dir) +
      "<b>" +
      esc(pct) +
      "</b><span>față de " +
      esc(SIM.luni[a.length - 2]) +
      "</span></div>" +
      simSpark(a, m) +
      '<div class="gt-ax" aria-hidden="true"><span>' +
      esc(SIM.scurt[0]) +
      "</span><span>" +
      esc(SIM.scurt[a.length - 1]) +
      "</span></div></div>"
    );
  }
  /* SIM-GBP:END */

  /* Unit report block: the same 4 indicators for this unit (same seed and count as /rapoarte). */
  function indicatoriSim(id, count) {
    var s = simUnitate(id, count);
    var luna = simLuna(SIM.luni.length - 1);
    return (
      '<section class="grp gsim-rep"><h2 class="gh">' +
      ic("chart") +
      "Indicatori Google (simulare)</h2>" +
      simBanner() +
      '<p class="gsim-sub">' +
      esc(
        luna.charAt(0).toUpperCase() +
          luna.slice(1) +
          ", cu evoluția din " +
          SIM.luni[0] +
          " până în " +
          SIM.luni[SIM.luni.length - 1] +
          ".",
      ) +
      '</p><div class="gsim-tiles">' +
      SIM.metrici
        .map(function (m, j) {
          return simTile(m, s[j]);
        })
        .join("") +
      "</div></section>"
    );
  }

  function $(id) {
    return document.getElementById(id);
  }

  function idUnitate() {
    /* online: raport.html?id=N (no server routes on a static site) */
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  /* Paragraph text: the server adds "<key>_afisare" with soft hyphens next to paragraph keys. */
  function par(obj, cheie) {
    if (!obj) return "";
    var v = obj[cheie + "_afisare"];
    return typeof v === "string" && v ? v : obj[cheie] || "";
  }

  function numar(x) {
    if (x === null || x === undefined) return null;
    if (typeof x === "number") return x;
    if (typeof x === "object") {
      var v =
        x.n !== undefined ? x.n : x.numar !== undefined ? x.numar : x.count;
      return typeof v === "number" ? v : null;
    }
    var n = Number(x);
    return isFinite(n) ? n : null;
  }

  /* Tile: figure, label, colour = what the figure says (tinted on screen, white in print). */
  function tile(vHtml, eticheta, cls, iconHtml) {
    return (
      '<div class="tile' +
      (cls ? " " + cls : "") +
      '"><div class="v">' +
      vHtml +
      '</div><div class="k">' +
      esc(eticheta) +
      "</div>" +
      (iconHtml
        ? '<span class="t-ic" aria-hidden="true">' + iconHtml + "</span>"
        : "") +
      "</div>"
    );
  }

  function din(a, n) {
    var v = numar(a);
    if (v === null) return "";
    return (
      esc(L.fmtNr(v)) +
      (n !== null && n !== undefined
        ? "<small> din " + esc(L.fmtNr(n)) + "</small>"
        : "")
    );
  }

  /* Language of a quoted example: the sample review it comes from, when it can be found. */
  function limbaCitat(t, recenzii) {
    var q = L.fold(String(t || ""))
      .replace(/^[\s„"“«….]+|[\s”"»….]+$/g, "")
      .trim();
    if (q.length < 8) return null;
    var cheie = q.slice(0, 40);
    for (var i = 0; i < recenzii.length; i++) {
      if (L.fold(recenzii[i].comment || "").indexOf(cheie) !== -1)
        return L.langAttr(recenzii[i].limba);
    }
    return null;
  }

  function citat(t, recenzii) {
    if (!t) return "";
    var s = String(t).trim();
    if (!s) return "";
    var lang = limbaCitat(s, recenzii || []);
    var strain = lang && lang !== "ro";
    return (
      '<p class="iq ' +
      (strain ? "just-auto" : "just") +
      '"' +
      (strain ? ' lang="' + esc(lang) + '"' : "") +
      ">" +
      esc(/^[„"“«]/.test(s) ? s : "„" + s + "”") +
      "</p>"
    );
  }

  function grup(cls, titlu, icon, lista, fn) {
    var arr = Array.isArray(lista) ? lista.filter(Boolean) : [];
    return (
      '<section class="grp ' +
      cls +
      '"><h2 class="gh">' +
      ic(icon) +
      esc(titlu) +
      "</h2>" +
      (arr.length
        ? arr
            .map(function (x, i) {
              return '<div class="item">' + fn(x, i) + "</div>";
            })
            .join("")
        : '<p class="muted">Nimic de semnalat în acest eșantion.</p>') +
      "</section>"
    );
  }

  function analiza(ins, mesaj, recenzii) {
    if (!ins || typeof ins !== "object") {
      return (
        '<section class="grp"><p class="pending">' +
        ic("clock") +
        "<span>" +
        esc(mesaj || "Analiza se pregătește.") +
        "</span></p></section>"
      );
    }
    var out = "";
    var rezumat = par(ins, "rezumat");
    if (rezumat) out += '<p class="rep-summary just">' + esc(rezumat) + "</p>";
    out += grup(
      "tari",
      "Aprecieri",
      "check-circle",
      ins.aprecieri,
      function (x) {
        var d = par(x, "descriere");
        return (
          '<p class="il">' +
          esc(x.tema || "") +
          "</p>" +
          (d ? '<p class="id just">' + esc(d) + "</p>" : "") +
          citat(x.exemplu, recenzii)
        );
      },
    );
    out += grup(
      "slabe",
      "Aspecte de verificat",
      "alert",
      ins.aspecte_de_verificat,
      function (x) {
        var d = par(x, "descriere");
        var v = par(x, "verificare_propusa");
        return (
          '<p class="il">' +
          esc(x.tema || "") +
          "</p>" +
          (d ? '<p class="id just">' + esc(d) + "</p>" : "") +
          citat(x.exemplu, recenzii) +
          (v
            ? '<p class="im"><b>Verificare propusă:</b> ' + esc(v) + "</p>"
            : "")
        );
      },
    );
    out += grup(
      "reco",
      "Acțiuni propuse",
      "list",
      ins.actiuni_propuse,
      function (x, i) {
        var meta = [
          ["Responsabil propus", x.responsabil_propus],
          ["Termen propus", x.termen_propus],
          ["Indicator", par(x, "indicator")],
        ]
          .filter(function (m) {
            return m[1];
          })
          .map(function (m) {
            return "<b>" + esc(m[0]) + ":</b> " + esc(m[1]);
          })
          .join('<span class="sep" aria-hidden="true">·</span>');
        return (
          '<p class="il just">' +
          (i + 1) +
          ". " +
          esc(par(x, "actiune")) +
          "</p>" +
          (meta ? '<p class="im">' + meta + "</p>" : "")
        );
      },
    );
    return out;
  }

  function recenzie(it) {
    // "De răspuns" next to an existing public reply reads as a contradiction: badge only after an action.
    var st =
      it.stare && it.stare !== "de_raspuns" ? STARI[it.stare] || null : null;
    var sens = !!(it.alerta === true || (it.sensibil && it.sensibil.flag));
    var r = it.raspuns_public_actual;
    var textR = r ? String(r.text_afisare || r.text || "").trim() : "";
    var text = String(it.comment_afisare || it.comment || "").trim();
    var lim = String(it.limba || "").toLowerCase();
    var limR =
      r && r.limba
        ? L.langAttr(r.limba)
        : it.tara === "RO"
          ? "ro"
          : L.langAttr(lim);
    var cat = sens && it.sensibil ? L.categorieNume(it.sensibil.categorie) : "";
    return (
      '<div class="srev"><div class="srev-h">' +
      L.stele(it.stele) +
      '<span class="rev-author">' +
      esc(it.reviewer || "Anonim") +
      "</span>" +
      (it.data_relativa
        ? '<span class="dot" aria-hidden="true">·</span><span>' +
          esc(it.data_relativa) +
          "</span>"
        : "") +
      (lim ? L.cipLimba(lim) : "") +
      (st
        ? '<span class="badge ' + st[1] + '">' + esc(st[0]) + "</span>"
        : "") +
      (sens
        ? '<span class="badge sens">' +
          ic("alert") +
          esc(cat || "Sensibilă") +
          "</span>"
        : "") +
      "</div>" +
      (text
        ? '<p class="srev-t just" lang="' +
          esc(L.langAttr(lim)) +
          '">' +
          esc(text) +
          "</p>"
        : '<p class="srev-none">Recenzie fără text, doar cu notă.</p>') +
      (textR
        ? '<div class="srev-r"><p class="srev-rt just"><b>Răspunsul public de azi:</b> <span lang="' +
          esc(limR) +
          '">' +
          esc(textR) +
          "</span></p></div>"
        : '<p class="srev-none">Fără răspuns public azi.</p>') +
      "</div>"
    );
  }

  function randeaza(d, ctx) {
    var u = d.unitate && typeof d.unitate === "object" ? d.unitate : {};
    var rd = d.rand || {};
    var titlu =
      u.title ||
      rd.title ||
      (typeof d.unitate === "string" ? d.unitate : "Unitate");
    document.title = "Raport · " + titlu;
    var dataC =
      (ctx && ctx.data_culegere_afisata) ||
      L.dataRo(ctx && ctx.data_culegere) ||
      "29.10.2026";
    var recenzii = Array.isArray(d.recenzii) ? d.recenzii : [];
    var n =
      rd.esantion_n !== null && rd.esantion_n !== undefined
        ? rd.esantion_n
        : recenzii.length;
    var eticheta =
      d.esantion_eticheta ||
      u.esantion_eticheta ||
      "Eșantion: " +
        L.nr(n, "recenzie publică", "recenzii publice") +
        ", Google Maps, " +
        dataC;
    var adresa = [u.address, L.taraNume(u.tara || rd.tara)]
      .filter(Boolean)
      .join(" · ");
    var rating = Number(u.rating !== undefined ? u.rating : rd.rating);
    var clsNota =
      isFinite(rating) && rating < 3.5
        ? "k-red"
        : rd.sub_4 || (isFinite(rating) && rating < 4)
          ? "k-orange"
          : "k-green";
    var nota = rd.rating_afisat || u.rating_afisat || L.fmtNota(rating);
    var numarG =
      rd.count_afisat ||
      u.count_afisat ||
      L.fmtNr(u.count !== undefined ? u.count : rd.count);
    var identic = rd.raspuns_identic_text || IDENTIC;
    var idU =
      u.id !== undefined ? u.id : rd.id !== undefined ? rd.id : idUnitate();
    var unitati =
      ctx && Array.isArray(ctx.unitati) && ctx.unitati.length
        ? ctx.unitati
        : [{ id: idU, title: titlu }];
    var ini = L.initialeUnitati(unitati).get(String(idU)) || L.initiale(titlu);

    var html =
      '<div class="rep-brand"><span class="rep-brand-t"><span class="rep-mark">LUCA</span>Recenzii &amp; reputație</span>' +
      '<span class="badge demo">Demonstrație</span></div>' +
      '<header class="rep-top"><div class="rep-id">' +
      L.avatarUnitate(idU, ini) +
      '<div><h1 class="rep-title">' +
      esc(titlu) +
      "</h1>" +
      (adresa ? '<p class="rep-addr">' + esc(adresa) + "</p>" : "") +
      "</div></div>" +
      '<div class="rep-side"><b>Raportul recenziilor</b>' +
      esc(L.azi()) +
      "</div></header>" +
      '<p class="rep-sample"><span class="badge sample">' +
      esc(eticheta) +
      "</span></p>" +
      '<div class="tiles rep-tiles">' +
      tile(
        esc(nota),
        rd.sub_4 ? "nota Google, sub 4,0" : "nota Google",
        clsNota,
        STEA,
      ) +
      tile(esc(numarG), "recenzii pe Google", "k-dark", ic("message-text")) +
      tile(
        din(rd.cu_raspuns_public, n),
        "cu răspuns public azi, în eșantion",
        "k-blue",
        ic("message"),
      ) +
      tile(
        din(rd.raspuns_identic, n),
        "cu răspunsul „" + identic + "”",
        "k-amber",
        ic("copy"),
      ) +
      "</div>" +
      analiza(d.insights, d.mesaj_insights, recenzii) +
      (d.indicatori_google
        ? ""
        : indicatoriSim(idU, rd.count !== undefined ? rd.count : u.count)) +
      (recenzii.length
        ? '<section class="grp sample"><h2 class="gh">' +
          ic("message-text") +
          'Recenziile din eșantion</h2><div class="srev-list">' +
          recenzii.map(recenzie).join("") +
          "</div></section>"
        : "") +
      '<footer class="rep-foot"><p class="foot">Softmed Labs · demonstrație online · recenzii publice Google culese pe ' +
      esc(dataC) +
      "</p>" +
      '<div class="sig"><span class="l just">' +
      esc(NOTA_SUBSOL) +
      "</span>" +
      '<span class="r">SOFTMED LABS · ' +
      esc(L.lunaAn().toUpperCase()) +
      "</span></div></footer>";

    var foaie = $("raport");
    foaie.innerHTML = html;
    foaie.setAttribute("aria-busy", "false");
  }

  function eroare(msg) {
    var foaie = $("raport");
    foaie.setAttribute("aria-busy", "false");
    foaie.innerHTML =
      '<p class="loading">' +
      esc(msg) +
      ' <a href="rapoarte.html">Înapoi la rapoarte</a></p>';
  }

  async function trimiteEmail(id) {
    var b = $("btnEmail");
    if (b.disabled) return;
    L.ocupa(b, "Se pregătește…");
    try {
      var unitId = /^\d+$/.test(id) ? Number(id) : id;
      var r = await L.api("api/rapoarte/email", {
        method: "POST",
        body: { unit_id: unitId },
        timeoutMs: 20000,
      });
      if (r.ok && r.data) {
        L.arataEmail(r.data, {
          title: "Previzualizare e-mail: raportul unității",
          returnFocus: function () {
            return $("btnEmail");
          },
        });
      } else {
        L.toast(
          L.mesajDin(r.data) ||
            "Previzualizarea e-mailului nu a putut fi pregătită.",
          "err",
        );
      }
    } catch (e) {
      if (e.kind !== "auth") L.toast(L.mesajEroare(e), "err");
    } finally {
      L.elibereaza(b);
    }
  }

  async function init() {
    var id = idUnitate();
    $("btnPrint").addEventListener("click", function () {
      window.print();
    });
    $("btnEmail").addEventListener("click", function () {
      trimiteEmail(id);
    });
    var ctxP = L.initChrome();
    var r;
    try {
      r = await L.api("api/rapoarte/unitate/" + encodeURIComponent(id));
    } catch (e) {
      if (e.kind !== "auth") eroare(L.mesajEroare(e));
      return;
    }
    if (r.status === 404) {
      eroare("Unitatea nu există în demonstrație.");
      return;
    }
    if (!r.ok || !r.data) {
      eroare(L.mesajDin(r.data) || "Raportul nu a putut fi încărcat.");
      return;
    }
    var ctx = await ctxP;
    randeaza(r.data, ctx);
    $("btnPrint").disabled = false;
    $("btnEmail").disabled = false;
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
