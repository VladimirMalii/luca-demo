/* LUCA demo: network reports ("Rapoarte"). Counted facts from the sample, themes from the
   prepared analysis, per-unit table with Google figures, Excel export, e-mail preview.
   Google Business Profile indicators: until the profile is connected, a labelled SIMULATION
   (illustrative numbers, "Simulare" badge and a "simulare" tag on every tile, chart and table). */
(function () {
  "use strict";

  var L = window.LUCA;
  var esc = L.esc;
  var ic = L.icon;
  var IDENTIC = "Mulțumim, Echipa LUCA";
  /* Fixed intro, soft-hyphenated once with app/demo/silabe.py (ro); the date goes in between. */
  var LEDE_A =
    "Nota și nu\u00ADmă\u00ADrul de re\u00ADcen\u00ADzii sunt cele afi\u00ADșa\u00ADte pu\u00ADblic de Google pe";
  var LEDE_B =
    "Res\u00ADtul ci\u00ADfre\u00ADlor sunt nu\u00ADmă\u00ADra\u00ADte în eșan\u00ADtion: re\u00ADcen\u00ADzi\u00ADi\u00ADle pu\u00ADbli\u00ADce afi\u00ADșa\u00ADte im\u00ADpli\u00ADcit de Google pen\u00ADtru fie\u00ADca\u00ADre uni\u00ADta\u00ADte.";
  var INI = new Map();

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

  function $(id) {
    return document.getElementById(id);
  }

  /* Paragraph text: the server adds "<key>_afisare" with soft hyphens next to paragraph keys. */
  function par(obj, cheie) {
    if (!obj) return "";
    var v = obj[cheie + "_afisare"];
    return typeof v === "string" && v ? v : obj[cheie] || "";
  }

  function citat(t) {
    return "„" + t + "”";
  }

  function din(a, b) {
    if (a === null || a === undefined || a === "") return "";
    return (
      esc(L.fmtNr(a)) +
      (b !== null && b !== undefined
        ? "<small> din " + esc(L.fmtNr(b)) + "</small>"
        : "")
    );
  }

  /* Tile: figure, label, coloured icon disc (colour = what the figure is about). */
  function tile(vHtml, eticheta, cls, icon) {
    return (
      '<div class="tile' +
      (cls ? " " + cls : "") +
      '"><div class="v">' +
      vHtml +
      '</div><div class="k">' +
      esc(eticheta) +
      "</div>" +
      (icon
        ? '<span class="t-ic" aria-hidden="true">' + ic(icon) + "</span>"
        : "") +
      "</div>"
    );
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

  function fapte(e) {
    var t = [];
    var identic = e.raspuns_identic_text || IDENTIC;
    if (e.n !== null && e.n !== undefined) {
      t.push(
        tile(
          din(e.cu_raspuns_public, e.n),
          "recenzii cu răspuns public azi",
          "k-blue",
          "message",
        ),
      );
      t.push(
        tile(
          din(e.fara_raspuns_public, e.n),
          "recenzii fără răspuns public",
          "k-orange",
          "inbox",
        ),
      );
    }
    if (e.cinci_stele !== null && e.cinci_stele !== undefined) {
      t.push(
        tile(
          din(e.cinci_stele_raspuns_identic, e.cinci_stele),
          "recenzii de 5 stele cu același răspuns: " + citat(identic),
          "k-amber",
          "copy",
        ),
      );
    }
    if (e.sensibile !== null && e.sensibile !== undefined) {
      t.push(
        tile(
          esc(L.fmtNr(e.sensibile)),
          "recenzii sensibile: siguranță alimentară, igienă, personal",
          "k-red",
          "alert",
        ),
      );
    }
    var limbi =
      e.limbi && typeof e.limbi === "object"
        ? Object.keys(e.limbi)
            .map(function (k) {
              return [k, Number(e.limbi[k]) || 0];
            })
            .sort(function (a, b) {
              return b[1] - a[1];
            })
        : [];
    if (limbi.length) {
      t.push(
        tile(
          esc(L.nr(limbi.length, "limbă", "limbi")),
          limbi
            .map(function (x) {
              return L.limbaNume(x[0]) + " " + L.fmtNr(x[1]);
            })
            .join(" · "),
          "k-violet",
          "globe",
        ),
      );
    }
    return t.join("");
  }

  function cipUnitate(id, nume) {
    return (
      '<span class="u-chip">' +
      L.avatarUnitate(id, INI.get(String(id)) || L.initiale(nume), "xs") +
      esc(nume) +
      "</span>"
    );
  }

  function teme(ins, rows, mesaj) {
    var gol =
      '<p class="pending">' +
      ic("clock") +
      "<span>" +
      esc(mesaj || "Analiza se pregătește.") +
      "</span></p>";
    if (!ins || typeof ins !== "object") return gol;
    var nume = new Map(
      rows.map(function (r) {
        return [String(r.id), r.title];
      }),
    );
    var out = "";
    var rezumat = par(ins, "rezumat");
    if (rezumat)
      out += '<p class="themes-summary just">' + esc(rezumat) + "</p>";
    var lista = Array.isArray(ins.teme) ? ins.teme.filter(Boolean) : [];
    if (lista.length) {
      out +=
        '<div class="themes">' +
        lista
          .map(function (t) {
            var ids = Array.isArray(t.unitati) ? t.unitati : [];
            var descriere = par(t, "descriere");
            return (
              '<div class="theme"><h3 class="theme-t">' +
              esc(t.tema || "") +
              "</h3>" +
              (descriere
                ? '<p class="theme-d just">' + esc(descriere) + "</p>"
                : "") +
              (ids.length
                ? '<div class="theme-u">' +
                  ids
                    .map(function (id) {
                      return cipUnitate(id, nume.get(String(id)) || String(id));
                    })
                    .join("") +
                  "</div>"
                : "") +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    }
    var obs = Array.isArray(ins.observatii_afisare)
      ? ins.observatii_afisare
      : ins.observatii;
    obs = Array.isArray(obs) ? obs.filter(Boolean) : [];
    if (obs.length) {
      out +=
        '<div class="obs"><h3 class="obs-h">Observații</h3><ul>' +
        obs
          .map(function (o) {
            return '<li class="just">' + esc(o) + "</li>";
          })
          .join("") +
        "</ul></div>";
    }
    return out || gol;
  }

  function celula(a, n, accent) {
    var v = numar(a);
    if (v === null) return "";
    return (
      '<span class="' +
      (v ? "hi" + (accent ? " " + accent : "") : "zero") +
      '">' +
      esc(L.fmtNr(v)) +
      "</span>" +
      (n !== null && n !== undefined
        ? '<span class="of"> din ' + esc(L.fmtNr(n)) + "</span>"
        : "")
    );
  }

  /* Coverage: "3 din 5" in text, plus a thin bar (decorative, the text carries the value). */
  function acoperire(a, n) {
    var v = numar(a);
    if (v === null) return "";
    var tot = Number(n);
    var pct = isFinite(tot) && tot > 0 ? Math.max(0, Math.min(1, v / tot)) : 0;
    return (
      '<span class="cov"><span>' +
      celula(v, n) +
      '</span><span class="cov-bar" aria-hidden="true"><span style="width:' +
      Math.round(pct * 100) +
      '%"></span></span></span>'
    );
  }

  function rand(r) {
    var rating = Number(r.rating);
    var cls =
      isFinite(rating) && rating < 3.5
        ? "bad"
        : r.sub_4 || (isFinite(rating) && rating < 4)
          ? "warn"
          : "good";
    var n = r.esantion_n;
    var sens = numar(r.sensibile) || 0;
    var limbi = Array.isArray(r.limbi) ? r.limbi : [];
    return (
      '<tr><th class="u" scope="row"><div class="u-cell">' +
      L.avatarUnitate(r.id, INI.get(String(r.id)), "sm") +
      '<div><div class="u-name">' +
      esc(r.title || "") +
      "</div>" +
      '<div class="u-place">' +
      esc([r.oras, L.taraNume(r.tara)].filter(Boolean).join(", ")) +
      "</div>" +
      (r.sub_4 ? '<span class="flag">sub 4,0</span>' : "") +
      "</div></div></th>" +
      '<td><span class="rating-pill ' +
      cls +
      '">' +
      esc(r.rating_afisat || L.fmtNota(r.rating)) +
      "</span></td>" +
      '<td class="hi">' +
      esc(r.count_afisat || L.fmtNr(r.count)) +
      "</td>" +
      "<td>" +
      acoperire(r.cu_raspuns_public, n) +
      "</td>" +
      "<td>" +
      celula(r.fara_raspuns_public, n) +
      "</td>" +
      "<td>" +
      celula(r.raspuns_identic, n, "amber") +
      "</td>" +
      "<td>" +
      (sens > 0
        ? '<span class="sens-dot">' + esc(L.fmtNr(sens)) + "</span>"
        : '<span class="zero">0</span>') +
      "</td>" +
      '<td><span class="langs">' +
      limbi
        .map(function (l) {
          return L.cipLimba(l, L.limbaNume(l));
        })
        .join("") +
      "</span></td>" +
      '<td><a class="rowlink" href="raport.html?id=' +
      encodeURIComponent(r.id) +
      '">' +
      ic("file") +
      'Raport<span class="sr-only"> pentru ' +
      esc(r.title || "") +
      "</span></a></td>" +
      "</tr>"
    );
  }

  function tabel(rows) {
    var n0 = rows[0] && rows[0].esantion_n;
    var laFel = rows.every(function (r) {
      return r.esantion_n === n0;
    });
    var grupE =
      "Eșantion" +
      (laFel && n0
        ? ": " +
          L.nr(n0, "recenzie publică", "recenzii publice") +
          " pe unitate"
        : "");
    var identic = (rows[0] && rows[0].raspuns_identic_text) || IDENTIC;
    return (
      '<table class="score">' +
      '<caption class="sr-only">Situația pe unități: nota și numărul de recenzii afișate de Google, apoi faptele numărate în eșantion</caption>' +
      '<thead><tr class="grp"><th class="u" rowspan="2" scope="col">Unitate</th>' +
      '<th class="g" colspan="2" scope="colgroup">Google</th>' +
      '<th class="g" colspan="5" scope="colgroup">' +
      esc(grupE) +
      "</th>" +
      '<th rowspan="2" scope="col"><span class="sr-only">Raport</span></th></tr>' +
      '<tr><th scope="col">Nota</th><th scope="col">Recenzii</th>' +
      '<th scope="col">Cu răspuns public</th><th scope="col">Fără răspuns public</th>' +
      '<th scope="col">Răspuns identic<span class="th-sub">' +
      esc(citat(identic)) +
      "</span></th>" +
      '<th scope="col">Sensibile</th><th scope="col">Limbi</th></tr></thead>' +
      "<tbody>" +
      rows.map(rand).join("") +
      "</tbody></table>"
    );
  }

  /* ---- Google indicators on the network page (simulation): tiles, 6-month chart, per unit ---- */
  var GRAF = { tot: null, m: 0, w: 0, geo: null, gata: false };

  function simSuma(serii) {
    var t = SIM.metrici.map(function () {
      return SIM.luni.map(function () {
        return 0;
      });
    });
    serii.forEach(function (s) {
      s.forEach(function (a, j) {
        a.forEach(function (v, i) {
          t[j][i] += v;
        });
      });
    });
    return t;
  }

  function unitateSim(m, v) {
    return v === 1 ? m.u[0] : L.cuDe(v) + m.u[1];
  }

  /* Table cell: last month's value and a small trend arrow (the change is in title + sr text). */
  function celulaSim(a) {
    var pct = simPct(simDelta(a));
    var dir = simDir(pct);
    var t = pct + " față de " + SIM.luni[a.length - 2];
    return (
      '<td><span class="gc"><span class="gv">' +
      esc(L.fmtNr(a[a.length - 1])) +
      '</span><span class="ga ' +
      dir +
      '" title="' +
      esc(t) +
      '">' +
      simSageata(dir) +
      '<span class="sr-only">' +
      esc(t) +
      "</span></span></span></td>"
    );
  }

  function tabelSim(date, tot) {
    var u = SIM.luni.length - 1;
    var ord = date.slice().sort(function (a, b) {
      return b.s[0][u] - a.s[0][u];
    });
    return (
      '<div class="gsim-block"><div class="gsim-bh"><div><h3 class="gsim-h">Pe unități, ' +
      esc(simLuna(u)) +
      '</h3><p class="gsim-sub">Ordonate după afișări. Săgeata arată schimbarea față de ' +
      esc(SIM.luni[u - 1]) +
      ".</p></div>" +
      SIM_TAG +
      '</div><div class="tablewrap"><table class="gsim-t">' +
      '<caption class="sr-only">Simulare, date ilustrative: indicatorii Google pe unități, ' +
      esc(simLuna(u)) +
      '</caption><thead><tr><th class="u" scope="col">Unitate</th>' +
      SIM.metrici
        .map(function (m) {
          return '<th scope="col">' + esc(m.t) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      ord
        .map(function (x) {
          var r = x.r;
          return (
            '<tr><th class="u" scope="row"><div class="u-cell">' +
            L.avatarUnitate(r.id, INI.get(String(r.id)), "sm") +
            '<div><a class="u-name gsim-u" href="raport.html?id=' +
            encodeURIComponent(r.id) +
            '">' +
            esc(r.title || "") +
            '</a><div class="u-place">' +
            esc([r.oras, L.taraNume(r.tara)].filter(Boolean).join(", ")) +
            "</div></div></div></th>" +
            x.s.map(celulaSim).join("") +
            "</tr>"
          );
        })
        .join("") +
      '</tbody><tfoot><tr><th class="u" scope="row">Toată rețeaua</th>' +
      tot.map(celulaSim).join("") +
      "</tr></tfoot></table></div></div>"
    );
  }

  /* Chart block: one metric at a time (one axis, never two scales), switcher, table twin. */
  function blocGrafic(tot, n) {
    var u = SIM.luni.length - 1;
    return (
      '<div class="gsim-block"><div class="gsim-bh"><div><h3 class="gsim-h">Evoluția pe 6 luni, toată rețeaua</h3>' +
      '<p class="gsim-sub">Totalul lunar pentru ' +
      esc(L.nr(n, "unitate", "unități")) +
      ", din " +
      esc(SIM.luni[0]) +
      " până în " +
      esc(simLuna(u)) +
      ".</p></div>" +
      '<div class="seg gsim-seg" role="group" aria-label="Indicatorul din grafic">' +
      SIM.metrici
        .map(function (m, j) {
          return (
            '<button type="button" class="seg-b" data-gsim="' +
            j +
            '" aria-pressed="' +
            (j === GRAF.m) +
            '">' +
            esc(m.b) +
            "</button>"
          );
        })
        .join("") +
      '</div></div><div class="gsim-plot" id="gsimPlot"></div>' +
      /* hidden wrapper, not a hidden table: a table ignores width: 1px and widens the page */
      '<div class="sr-only"><table><caption>Simulare, date ilustrative: totalul lunar al rețelei</caption>' +
      '<thead><tr><th scope="col">Luna</th>' +
      SIM.metrici
        .map(function (m) {
          return '<th scope="col">' + esc(m.t) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      SIM.luni
        .map(function (l, i) {
          return (
            '<tr><th scope="row">' +
            esc(simLuna(i)) +
            "</th>" +
            tot
              .map(function (a) {
                return "<td>" + esc(L.fmtNr(a[i])) + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div></div>"
    );
  }

  /* Clean axis: about 4 steps of 1/2/2.5/5 x 10^k, always above the maximum. */
  function scara(max) {
    var brut = max / 4 || 1;
    var mag = Math.pow(10, Math.floor(Math.log(brut) / Math.LN10));
    var f = brut / mag;
    var pas = Math.max(
      1,
      (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag,
    );
    var sus = Math.ceil(max / pas) * pas;
    if (sus <= max) sus += pas;
    return { sus: sus, pas: pas };
  }

  function etichetaPunct(i) {
    var m = SIM.metrici[GRAF.m];
    var a = GRAF.tot[GRAF.m];
    var t = simLuna(i) + ": " + L.fmtNr(a[i]) + " " + unitateSim(m, a[i]);
    if (i > 0)
      t +=
        ", " +
        simPct((a[i] - a[i - 1]) / a[i - 1]) +
        " față de " +
        SIM.luni[i - 1];
    return t + " (simulare)";
  }

  /* Line chart (2px line, 10% area wash, ringed dots, last value labelled), drawn at the real
     pixel width so text never scales; redrawn on resize. Values also in the sr-only table. */
  function deseneazaGrafic() {
    var el = $("gsimPlot");
    if (!el || !GRAF.tot) return;
    GRAF.w = Math.round(el.clientWidth);
    var W = Math.max(280, GRAF.w);
    var H = Math.max(200, Math.round(el.clientHeight) || 260);
    var m = SIM.metrici[GRAF.m];
    var a = GRAF.tot[GRAF.m];
    var n = a.length;
    var sc = scara(Math.max.apply(null, a));
    var ticks = [];
    for (var t = 0; t <= sc.sus + 1e-9; t += sc.pas) ticks.push(Math.round(t));
    var lat = Math.max.apply(
      null,
      ticks.map(function (v) {
        return L.fmtNr(v).length;
      }),
    );
    var ml = Math.round(lat * 7.4 + 14);
    var mr = 14;
    var mt = 30;
    var mb = 30;
    var pad = Math.min(24, Math.round(W / 20));
    var ph = H - mt - mb;
    var pas = (W - ml - mr - 2 * pad) / (n - 1);
    var f = function (x) {
      return Math.round(x * 10) / 10;
    };
    var X = function (i) {
      return f(ml + pad + i * pas);
    };
    var Y = function (v) {
      return f(mt + ph - (v / sc.sus) * ph);
    };
    var luni = W >= 560 ? SIM.luni : SIM.scurt;
    var s =
      '<svg width="' +
      W +
      '" height="' +
      H +
      '" viewBox="0 0 ' +
      W +
      " " +
      H +
      '" role="group" aria-label="' +
      esc("Grafic, simulare: " + m.t + ", totalul rețelei pe 6 luni") +
      '">';
    ticks.forEach(function (v) {
      var y = Math.round(Y(v)) + 0.5;
      s +=
        '<line class="' +
        (v ? "gs-grid" : "gs-base") +
        '" x1="' +
        ml +
        '" x2="' +
        (W - mr) +
        '" y1="' +
        y +
        '" y2="' +
        y +
        '"/><text class="gs-tick" x="' +
        (ml - 10) +
        '" y="' +
        (y + 4) +
        '" text-anchor="end">' +
        esc(L.fmtNr(v)) +
        "</text>";
    });
    luni.forEach(function (l, i) {
      s +=
        '<text class="gs-month' +
        (i === n - 1 ? " on" : "") +
        '" x="' +
        X(i) +
        '" y="' +
        (H - 9) +
        '" text-anchor="middle">' +
        esc(l) +
        "</text>";
    });
    var pts = a.map(function (v, i) {
      return X(i) + "," + Y(v);
    });
    s +=
      '<path class="gs-area" d="M' +
      pts.join(" L") +
      " L" +
      X(n - 1) +
      "," +
      Y(0) +
      " L" +
      X(0) +
      "," +
      Y(0) +
      ' Z"/><polyline class="gs-line" points="' +
      pts.join(" ") +
      '"/><line class="gs-cross" x1="0" x2="0" y1="' +
      mt +
      '" y2="' +
      (mt + ph) +
      '" visibility="hidden"/>';
    a.forEach(function (v, i) {
      s += '<circle class="gs-dot" cx="' + X(i) + '" cy="' + Y(v) + '" r="4"/>';
    });
    s += '<circle class="gs-ring" cx="0" cy="0" r="10" visibility="hidden"/>';
    s +=
      '<text class="gs-val" x="' +
      f(X(n - 1) + 6) +
      '" y="' +
      f(Y(a[n - 1]) - 12) +
      '" text-anchor="end">' +
      esc(L.fmtNr(a[n - 1])) +
      "</text>";
    a.forEach(function (v, i) {
      var x0 = Math.max(ml, X(i) - pas / 2);
      var x1 = Math.min(W - mr, X(i) + pas / 2);
      s +=
        '<rect class="gs-hit" data-i="' +
        i +
        '" x="' +
        f(x0) +
        '" y="' +
        mt +
        '" width="' +
        f(x1 - x0) +
        '" height="' +
        ph +
        '" tabindex="0" role="img" aria-label="' +
        esc(etichetaPunct(i)) +
        '"/>';
    });
    el.innerHTML = SIM_TAG + s + '</svg><div class="gs-tip" hidden></div>';
    el.querySelector(".sim-tag").style.left = ml + pad - 4 + "px";
    GRAF.geo = {
      x: a.map(function (v, i) {
        return X(i);
      }),
      y: a.map(function (v) {
        return Y(v);
      }),
      W: W,
    };
  }

  /* Crosshair + tooltip (value first, then label); built with textContent. */
  function arataPunct(i) {
    var el = $("gsimPlot");
    var g = GRAF.geo;
    if (!el || !g) return;
    var m = SIM.metrici[GRAF.m];
    var a = GRAF.tot[GRAF.m];
    var x = Math.round(g.x[i]) + 0.5;
    var cross = el.querySelector(".gs-cross");
    cross.setAttribute("x1", x);
    cross.setAttribute("x2", x);
    cross.setAttribute("visibility", "visible");
    el.querySelectorAll(".gs-dot").forEach(function (d, k) {
      d.setAttribute("r", k === i ? 6 : 4);
    });
    var ring = el.querySelector(".gs-ring");
    ring.setAttribute("cx", g.x[i]);
    ring.setAttribute("cy", g.y[i]);
    ring.setAttribute("visibility", "visible");
    var tip = el.querySelector(".gs-tip");
    tip.textContent = "";
    var luna = document.createElement("span");
    luna.className = "gs-tip-l";
    luna.textContent = simLuna(i) + ", simulare";
    var rand = document.createElement("span");
    rand.className = "gs-tip-v";
    var val = document.createElement("b");
    val.textContent = L.fmtNr(a[i]);
    rand.appendChild(val);
    rand.appendChild(document.createTextNode(" " + unitateSim(m, a[i])));
    tip.appendChild(luna);
    tip.appendChild(rand);
    if (i > 0) {
      var pct = simPct((a[i] - a[i - 1]) / a[i - 1]);
      var d = document.createElement("span");
      d.className = "gs-tip-d " + simDir(pct);
      d.textContent = pct + " față de " + SIM.luni[i - 1];
      tip.appendChild(d);
    }
    tip.hidden = false;
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var left = g.x[i] + 14;
    if (left + tw > g.W - 4) left = g.x[i] - 14 - tw;
    tip.style.left = Math.max(0, Math.round(left)) + "px";
    /* below the point: the last value is labelled above its dot and must stay readable */
    tip.style.top =
      Math.max(
        0,
        Math.min(Math.round(g.y[i] + 16), el.clientHeight - th - 32),
      ) + "px";
  }

  function ascundePunct() {
    var el = $("gsimPlot");
    if (!el) return;
    var cross = el.querySelector(".gs-cross");
    if (cross) cross.setAttribute("visibility", "hidden");
    el.querySelectorAll(".gs-dot").forEach(function (d) {
      d.setAttribute("r", 4);
    });
    var ring = el.querySelector(".gs-ring");
    if (ring) ring.setAttribute("visibility", "hidden");
    var tip = el.querySelector(".gs-tip");
    if (tip) tip.hidden = true;
  }

  function graficInit() {
    var el = $("gsimPlot");
    if (!el || !GRAF.tot) return;
    deseneazaGrafic();
    if (GRAF.gata) return;
    GRAF.gata = true;
    el.addEventListener("pointermove", function (e) {
      var g = GRAF.geo;
      if (!g) return;
      var x = e.clientX - el.getBoundingClientRect().left;
      var best = 0;
      for (var i = 1; i < g.x.length; i++)
        if (Math.abs(g.x[i] - x) < Math.abs(g.x[best] - x)) best = i;
      arataPunct(best);
    });
    el.addEventListener("pointerleave", ascundePunct);
    el.addEventListener("focusin", function (e) {
      var i =
        e.target && e.target.getAttribute && e.target.getAttribute("data-i");
      if (i === null || i === undefined) return;
      el.classList.add("is-key");
      arataPunct(Number(i));
    });
    el.addEventListener("focusout", function () {
      el.classList.remove("is-key");
      ascundePunct();
    });
    var raf = 0;
    var redraw = function () {
      if (Math.round(el.clientWidth) === GRAF.w) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(deseneazaGrafic);
    };
    if (window.ResizeObserver) new ResizeObserver(redraw).observe(el);
    else window.addEventListener("resize", redraw);
  }

  function alegeMetrica(e) {
    var b = e.target.closest && e.target.closest("[data-gsim]");
    if (!b) return;
    GRAF.m = Number(b.getAttribute("data-gsim")) || 0;
    $("indicatoriContinut")
      .querySelectorAll("[data-gsim]")
      .forEach(function (x) {
        x.setAttribute("aria-pressed", String(x === b));
      });
    deseneazaGrafic();
  }

  function indicatori(ind, rows) {
    if (ind && typeof ind === "object" && Object.keys(ind).length) {
      return (
        '<div class="tiles">' +
        Object.keys(ind)
          .map(function (k) {
            return tile(
              esc(String(ind[k])),
              k.replace(/_/g, " "),
              "k-blue",
              "chart",
            );
          })
          .join("") +
        "</div>"
      );
    }
    var unit = (rows || []).filter(function (r) {
      return r && r.id !== null && r.id !== undefined;
    });
    if (!unit.length)
      return (
        simBanner() +
        '<p class="muted">Simularea apare după încărcarea unităților.</p>'
      );
    var date = unit.map(function (r) {
      return { r: r, s: simUnitate(r.id, r.count) };
    });
    var tot = simSuma(
      date.map(function (x) {
        return x.s;
      }),
    );
    GRAF.tot = tot;
    var luna = simLuna(SIM.luni.length - 1);
    return (
      simBanner() +
      '<h3 class="gsim-h gsim-lead">' +
      esc(
        luna.charAt(0).toUpperCase() +
          luna.slice(1) +
          ", toată rețeaua (" +
          L.nr(unit.length, "unitate", "unități") +
          ")",
      ) +
      '</h3><div class="gsim-tiles">' +
      SIM.metrici
        .map(function (m, j) {
          return simTile(m, tot[j]);
        })
        .join("") +
      "</div>" +
      blocGrafic(tot, unit.length) +
      tabelSim(date, tot)
    );
  }

  function randeaza(d, ctx) {
    var e = d.esantion || {};
    var rows = Array.isArray(d.scorecard) ? d.scorecard : [];
    INI = L.initialeUnitati(
      ctx && Array.isArray(ctx.unitati) && ctx.unitati.length
        ? ctx.unitati
        : rows,
    );
    var data =
      (ctx && ctx.data_culegere_afisata) ||
      L.dataRo(ctx && ctx.data_culegere) ||
      "29.10.2026";
    $("lede").textContent = LEDE_A + " " + data + ". " + LEDE_B;
    $("esantion").innerHTML = e.eticheta
      ? '<span class="badge sample">' + esc(e.eticheta) + "</span>"
      : "";
    var f = $("fapte");
    f.innerHTML = fapte(e);
    f.setAttribute("aria-busy", "false");
    f.hidden = !f.innerHTML;
    $("temeContinut").innerHTML = teme(
      d.insights_retea,
      rows,
      d.mesaj_insights,
    );
    $("tabel").innerHTML = rows.length
      ? tabel(rows)
      : '<p class="muted">Nicio unitate de afișat.</p>';
    $("indicatoriContinut").innerHTML = indicatori(d.indicatori_google, rows);
    graficInit();
  }

  function eroareIncarcare(msg) {
    $("fapte").hidden = true;
    $("temeContinut").innerHTML = '<p class="muted">' + esc(msg) + "</p>";
    $("tabel").innerHTML =
      '<p class="muted"><button type="button" class="btn ghost" data-reincarca>' +
      ic("refresh") +
      "Reîncearcă</button></p>";
    $("indicatoriContinut").innerHTML = indicatori(null, []);
  }

  async function trimiteEmail() {
    var b = $("btnEmail");
    if (b.disabled) return;
    L.ocupa(b, "Se pregătește…");
    try {
      var r = await L.api("api/rapoarte/email", {
        method: "POST",
        body: {},
        timeoutMs: 20000,
      });
      if (r.ok && r.data) {
        L.arataEmail(r.data, {
          title: "Previzualizare e-mail: raportul rețelei",
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
    $("btnEmail").addEventListener("click", trimiteEmail);
    $("btnExport").addEventListener("click", function () {
      L.toast(
        "Fișierul Excel se descarcă: recenziile și unitățile. În versiunea online, fișierul arată starea inițială a demonstrației.",
        "ok",
        5000,
      );
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-reincarca]"))
        window.location.reload();
    });
    $("indicatoriContinut").addEventListener("click", alegeMetrica);
    var ctxP = L.initChrome();
    var r;
    try {
      r = await L.api("api/rapoarte/retea");
    } catch (e) {
      if (e.kind !== "auth") eroareIncarcare(L.mesajEroare(e));
      return;
    }
    if (!r.ok || !r.data) {
      eroareIncarcare(L.mesajDin(r.data) || "Raportul nu a putut fi încărcat.");
      return;
    }
    var ctx = await ctxP;
    randeaza(r.data, ctx);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
