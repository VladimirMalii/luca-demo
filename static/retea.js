/* LUCA demo: the "neural network" layer of the approval screen.
   While a proposal is being prepared, the panel draws the processing as a small network: words
   from the review -> five analysis nodes -> the proposal, with signals travelling left to right.
   When the answer arrives with the model's analysis (POST /api/raspuns "analiza"), the nodes take
   its real values, then the card shows "Ce a înțeles sistemul", the phrases the model cited are
   highlighted in the review and joined to their topic by connector lines.
   Honest by construction: every value shown comes from the model; the motion only visualises the
   wait. No analysis (old entry, parse failure) = no block, no highlights. Plain browser JS, no
   libraries. Exposed as window.LUCA.retea; aprobare.js degrades to its skeleton without it.
   The network's memory (memorie.js): when the team has approved replies, a fourth input group
   "din memorie" shows the examples the proposal will likely receive (the server's scoring, done in
   the browser), their signals enter the tone and approach nodes, and the first step names the
   search; when the answer arrives the group takes the server's own list (memorie_folosita) and
   the analysis gains the row "Din memorie" with the model's sentence about what it took. */
(function () {
  "use strict";

  var L = window.LUCA;
  if (!L) return;
  var esc = L.esc;
  var SHY = String.fromCharCode(173);
  var NS = "http://www.w3.org/2000/svg";
  /* en/em dash and cedilla letters are built from code points: they never sit in the source */
  var LINIE = new RegExp(
    "\\s*[" + String.fromCharCode(0x2013, 0x2014) + "]\\s*",
    "g",
  );
  var CEDILA = [
    [String.fromCharCode(0x15f), "ș"],
    [String.fromCharCode(0x163), "ț"],
    [String.fromCharCode(0x15e), "Ș"],
    [String.fromCharCode(0x162), "Ț"],
  ];

  var PAS_MS = 1200; // one processing step: status line + the nodes it lights
  var MIN_MS = 1600; // the network stays at least this long (a prepared answer is instant)
  var MIN_REGEN_MS = 1000;
  var MIN_EROARE_MS = 700; // an error never flashes the network for a few milliseconds
  var ASEZARE_MS = 900; // nodes hold the real values before the panel changes
  var IESIRE_MS = 170;

  var STATUS = [
    "Rețeaua neuronală citește recenzia…",
    "Identifică limba și tonul…",
    "Leagă frazele de subiecte…",
    "Verifică riscul…",
    "Formulează răspunsul…",
  ];
  /* the memory step comes first: the server picks the examples before it calls the model */
  var STATUS_MEM = "Caută în memorie exemple asemănătoare…";
  var MEM_H = "din memorie";
  /* the examples shape wording and structure (tone, approach), never the reading of the review */
  var DIN_MEMORIE = ["ton", "abordare"];
  var POL_MEM = { neg: "negativ", mix: "mixt", poz: "pozitiv" };
  var GATA = "Analiza este gata.";
  var NODURI = [
    { k: "limba", l: "Limbă" },
    { k: "ton", l: "Ton" },
    { k: "subiecte", l: "Subiecte" },
    { k: "risc", l: "Risc" },
    { k: "abordare", l: "Abordare" },
  ];
  /* soft-hyphenated once with app/demo/silabe.py (ro); justified like every paragraph */
  var NOTA =
    "Ana\u00ADli\u00ADză fă\u00ADcu\u00ADtă de mo\u00ADde\u00ADlul de lim\u00ADbaj (rețea neu\u00ADro\u00ADna\u00ADlă) pe tex\u00ADtul aces\u00ADtei re\u00ADcen\u00ADzii.";
  var LEGATE = "legate de frazele marcate în recenzie";
  /* "|" = soft hyphen (silabe.py, ro), inserted at load */
  var NIMIC = "Nimic pre|lu|at din exem|ple|le con|sul|ta|te."
    .split("|")
    .join(SHY);

  var POL = { negativ: "neg", pozitiv: "poz", neutru: "neu", mixt: "mix" };
  var SEMN = {
    neg: '<svg viewBox="0 0 12 12" focusable="false"><path d="M3.2 6h5.6"/></svg>',
    poz: '<svg viewBox="0 0 12 12" focusable="false"><path d="M3.2 6h5.6M6 3.2v5.6"/></svg>',
    neu: '<svg viewBox="0 0 12 12" focusable="false"><circle cx="6" cy="6" r="1.7"/></svg>',
  };

  /* Function words never make a good "input" pill (folded: lowercase, no diacritics). */
  var STOP = new Set(
    (
      "acest aceasta aceste acesta acestea acestui acestei acolo acum aici avea aveam aveti avut " +
      "aceeasi acelasi atat atata atunci care cand cate catre ceea chiar cine cineva ceva cumva " +
      "deja despre dintre dintr doar dumneavoastra dupa este eram erau fara fiecare foarte fost " +
      "inca intre intr langa mereu mult multa multe multi niciodata nimic noastra nostru oricum " +
      "orice pana pentru peste prin putin sunt spre totul toate toata toti unde voastra vostru " +
      "asta astia astea aceia acele asemenea altfel alta altul altele nici sint " +
      "bardzo bylo byla byli bede jest jestem jako jednak kiedy ktora ktore ktory ktorzy moze " +
      "mozna przez przy sobie tego tylko tutaj wiec wszystko zawsze jeszcze gdzie mnie mamy " +
      "takze oraz albo lecz nawet bylam bylem jesli zeby trzeba ponad prawie jego jej ich " +
      "about after again also always because been before being could does doing done during " +
      "every from have having here into just more most much only other over really should some " +
      "than that their them then there these they this those very were what when where which " +
      "while will with would your yours still even"
    ).split(" "),
  );

  var stari = new Map();

  /* ------------------------------------------------------------ helpers */

  function pauza(ms) {
    return new Promise(function (r) {
      setTimeout(r, Math.max(0, ms || 0));
    });
  }

  function r1(v) {
    return Math.round(v * 10) / 10;
  }

  function faraShy(t) {
    return String(t == null ? "" : t)
      .split(SHY)
      .join("");
  }

  /* Model text for display: no soft hyphens, comma-below letters, no long dashes, one line. */
  function curat(s, max) {
    if (typeof s !== "string") return "";
    var t = faraShy(s).replace(LINIE, ", ");
    CEDILA.forEach(function (p) {
      t = t.split(p[0]).join(p[1]);
    });
    t = t.replace(/\s+/g, " ").trim();
    if (max && t.length > max)
      t = t.slice(0, max - 1).replace(/[\s,.;:]+\S*$/, "") + "…";
    return t;
  }

  function lista(v) {
    return Array.isArray(v) ? v : [];
  }

  function curba(x1, y1, x2, y2, f) {
    var k = Math.max(0, (x2 - x1) * (f || 0.5));
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

  function cardDupaId(id) {
    return document.getElementById(L.domId(id));
  }

  function reteaDin(id) {
    var c = cardDupaId(id);
    return c ? c.querySelector(".nn") : null;
  }

  /* ----------------------------------------------------- input words */

  /* The longest distinctive words of the review, in reading order (placeholders while waiting). */
  function cuvinteCheie(text, max) {
    var t = faraShy(text);
    var toate = t.match(/\p{L}[\p{L}\p{M}'’]*/gu) || [];
    if (!max) max = toate.length > 45 ? 6 : toate.length > 18 ? 5 : 4;
    function aduna(minim) {
      var vazut = new Set();
      var out = [];
      toate.forEach(function (w, i) {
        var c = w.replace(/['’]+$/, "");
        var k = L.fold(c);
        var n = Array.from(c).length;
        if (n < minim || STOP.has(k) || vazut.has(k)) return;
        vazut.add(k);
        out.push({ w: c, i: i, n: n });
      });
      return out;
    }
    var cand = aduna(4);
    if (cand.length < 2) cand = aduna(2);
    cand.sort(function (a, b) {
      return b.n - a.n || a.i - b.i;
    });
    return cand
      .slice(0, max)
      .sort(function (a, b) {
        return a.i - b.i;
      })
      .map(function (x) {
        return x.w;
      });
  }

  /* ------------------------------------------------- analysis (model) */

  function polSubiect(p) {
    p = String(p || "").toLowerCase();
    return p === "negativ" || p === "pozitiv" ? p : "neutru";
  }

  /* Defensive copy of the API's "analiza": null when missing or unusable (UI behaves as before). */
  function valideaza(a) {
    if (!a || typeof a !== "object" || Array.isArray(a)) return null;
    var subiecte = lista(a.subiecte)
      .map(function (s) {
        if (!s || typeof s !== "object") return null;
        var tema = curat(s.tema, 40);
        if (!tema) return null;
        return {
          tema: tema,
          detaliu: curat(s.detaliu, 120),
          polaritate: polSubiect(s.polaritate),
        };
      })
      .filter(Boolean)
      .slice(0, 4);
    var fragmente = lista(a.fragmente)
      .map(function (f) {
        if (!f || typeof f !== "object" || typeof f.text !== "string")
          return null;
        var t = faraShy(f.text).trim();
        if (Array.from(t).length < 2) return null;
        return {
          text: t,
          tema: curat(f.tema, 40),
          polaritate: polSubiect(f.polaritate),
        };
      })
      .filter(Boolean)
      .slice(0, 5);
    var abordare = lista(a.abordare)
      .map(function (x) {
        return curat(x, 90);
      })
      .filter(Boolean)
      .slice(0, 4);
    var pol = String(a.polaritate || "").toLowerCase();
    var out = {
      limba: curat(a.limba, 30),
      ton: curat(a.ton, 90),
      polaritate:
        pol === "negativ" || pol === "mixt" || pol === "pozitiv" ? pol : "",
      subiecte: subiecte,
      fragmente: fragmente,
      risc:
        String(a.risc || "").toLowerCase() === "sensibil"
          ? "sensibil"
          : "normal",
      risc_motiv: curat(a.risc_motiv, 220),
      abordare: abordare,
      // what the model took from the examples it was given ("" = none given, or nothing taken)
      din_memorie: curat(a.din_memorie, 300),
    };
    // the server sends null when the model gave nothing usable; anything else is shown as is
    if (
      !out.ton &&
      !out.polaritate &&
      !out.subiecte.length &&
      !out.abordare.length
    )
      return null;
    return out;
  }

  /* --------------------------------------- highlights in the review text */

  /* Spans of the displayed text (with U+00AD) matching each fragment of the original comment.
     The match runs on the text without soft hyphens, then maps back, so a soft hyphen may sit
     between any two characters. Not found = skipped; overlapping fragments keep the first. */
  function potriviri(afisat, fragmente) {
    var t = String(afisat || "");
    var plain = "";
    var harta = [];
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (ch === SHY) continue;
      harta.push(i);
      plain += ch;
    }
    var mic = plain.toLowerCase();
    var spans = [];
    lista(fragmente).forEach(function (f) {
      var q = faraShy(f && f.text).trim();
      if (q.length < 2) return;
      var la = plain.indexOf(q);
      var lung = q.length;
      if (la === -1 && mic.length === plain.length) {
        var qm = q.toLowerCase();
        if (qm.length === q.length) la = mic.indexOf(qm);
      }
      if (la === -1) {
        // same words, different spacing or line breaks
        var parti = q
          .split(/\s+/)
          .filter(Boolean)
          .map(function (p) {
            return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          });
        if (parti.length > 1) {
          var m = new RegExp(parti.join("\\s+"), "u").exec(plain);
          if (m) {
            la = m.index;
            lung = m[0].length;
          }
        }
      }
      if (la === -1 || !lung) return;
      spans.push({
        s: harta[la],
        e: harta[la + lung - 1] + 1,
        tema: f.tema || "",
        pol: polSubiect(f.polaritate),
      });
    });
    spans.sort(function (a, b) {
      return a.s - b.s || b.e - a.e;
    });
    var out = [];
    var capat = -1;
    spans.forEach(function (sp) {
      if (sp.s < capat) return;
      out.push(sp);
      capat = sp.e;
    });
    return out;
  }

  function numarPotriviri(afisat, fragmente) {
    return potriviri(afisat, fragmente).length;
  }

  /* Escaped HTML of the displayed review text with <mark class="hl"> around each fragment. */
  function evidentiaza(afisat, fragmente) {
    var t = String(afisat || "");
    var spans = potriviri(t, fragmente);
    if (!spans.length) return esc(t);
    var out = "";
    var poz = 0;
    spans.forEach(function (sp, k) {
      out +=
        esc(t.slice(poz, sp.s)) +
        '<mark class="hl p-' +
        POL[sp.pol] +
        '" data-tema="' +
        esc(sp.tema) +
        '" data-pol="' +
        esc(sp.pol) +
        '" style="--h:' +
        k +
        '">' +
        esc(t.slice(sp.s, sp.e)) +
        "</mark>";
      poz = sp.e;
    });
    return out + esc(t.slice(poz));
  }

  /* ------------------------------------------------ the analysis block */

  function chip(s) {
    var p = POL[s.polaritate] || "neu";
    return (
      '<li class="an-chip p-' +
      p +
      '" data-tema="' +
      esc(s.tema) +
      '" data-pol="' +
      esc(s.polaritate) +
      '"><span class="an-sg" aria-hidden="true">' +
      SEMN[p] +
      '</span><span class="an-chip-t"><span class="sr-only">' +
      esc(s.polaritate) +
      ": </span><b>" +
      esc(s.tema) +
      "</b>" +
      (s.detaliu ? ": " + esc(s.detaliu) : "") +
      "</span></li>"
    );
  }

  function risc(an) {
    var sens = an.risc === "sensibil";
    return (
      '<span class="an-risc ' +
      (sens ? "r-sens" : "r-ok") +
      '">' +
      L.icon(sens ? "alert" : "check") +
      (sens ? "sensibil" : "normal") +
      "</span>" +
      (an.risc_motiv
        ? '<span class="an-risc-m">' + esc(an.risc_motiv) + "</span>"
        : "")
    );
  }

  /* ------------------------------------------- the network's memory */

  /* Display tokens built by memorie.js (LUCA.memorie.tokeni): {id, ini, nume, tema, pol, polNume,
     ed, titlu}. Defensive copy, at most 3: anything else is dropped. */
  function tokeniMemorie(v) {
    var out = [];
    lista(v).forEach(function (t) {
      if (out.length >= 3 || !t || typeof t !== "object") return;
      var id = t.id == null ? "" : String(t.id);
      if (!id) return;
      var pol = POL_MEM[t.pol] ? t.pol : "neu";
      out.push({
        id: id,
        ini: curat(t.ini, 6) || "?",
        nume: curat(t.nume, 60),
        tema: curat(t.tema, 40),
        pol: pol,
        polNume: POL_MEM[pol] || "",
        ed: t.ed === true,
        titlu: curat(t.titlu, 200),
      });
    });
    return out;
  }

  /* The example's node, as in the widget: polarity colour, a ring when the team corrected it. */
  function semnMemorie(t) {
    return (
      '<span class="mt p-' +
      t.pol +
      (t.ed ? " is-ed" : "") +
      '" aria-hidden="true"></span>'
    );
  }

  function htmlMp(t) {
    return (
      '<li class="nn-mp" data-mid="' +
      esc(t.id) +
      '"' +
      (t.titlu ? ' title="' + esc(t.titlu) + '"' : "") +
      ">" +
      semnMemorie(t) +
      '<span class="nn-mp-l"><b>' +
      esc(t.ini) +
      "</b>" +
      (t.tema ? " · " + esc(t.tema) : "") +
      "</span></li>"
    );
  }

  /* "Din memorie": the model's sentence, then one chip per example it received (unit · first
     topic, "corectat" when the team edited it); pointing at a chip lights its node in the widget. */
  function htmlDinMemorie(fraza, mem) {
    return (
      (fraza
        ? '<p class="an-mem-s just-auto" lang="ro">' + esc(fraza) + "</p>"
        : '<p class="an-mem-s an-mem-0 just" lang="ro">' +
          esc(NIMIC) +
          "</p>") +
      '<ul class="an-mem">' +
      mem
        .map(function (t) {
          return (
            '<li class="an-mem-c" data-mid="' +
            esc(t.id) +
            '"' +
            (t.titlu ? ' title="' + esc(t.titlu) + '"' : "") +
            ">" +
            semnMemorie(t) +
            '<span class="an-mem-t">' +
            (t.polNume
              ? '<span class="sr-only">exemplu ' + esc(t.polNume) + ": </span>"
              : "") +
            esc(t.nume || t.ini) +
            (t.tema ? " · <b>" + esc(t.tema) + "</b>" : "") +
            "</span>" +
            (t.ed
              ? '<span class="an-mem-b">' + L.icon("pencil") + "corectat</span>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  /* o: {did, ascunsa, reveal, limba (review code, fallback for the language), marcate,
         memorie (tokens of the examples this proposal received; [] = no "Din memorie" row)} */
  function htmlAnaliza(an, o) {
    o = o || {};
    var did = o.did || "an";
    var randuri = [];
    function rand(cls, eticheta, continut) {
      randuri.push(
        '<div class="an-row' +
          (cls ? " " + cls : "") +
          '" style="--i:' +
          randuri.length +
          '"><dt>' +
          esc(eticheta) +
          "</dt><dd>" +
          continut +
          "</dd></div>",
      );
    }
    rand("", "Limba", esc(an.limba || L.limbaNume(o.limba)));
    if (an.ton || an.polaritate)
      rand(
        "",
        "Ton",
        (an.ton ? '<span class="an-ton">' + esc(an.ton) + "</span>" : "") +
          (an.polaritate
            ? '<span class="an-pol p-' +
              POL[an.polaritate] +
              '">' +
              esc(an.polaritate) +
              "</span>"
            : ""),
      );
    if (an.subiecte.length)
      rand(
        "an-row-sub",
        "Subiecte",
        (o.marcate ? '<span class="an-cap">' + esc(LEGATE) + "</span>" : "") +
          '<ul class="an-chips">' +
          an.subiecte.map(chip).join("") +
          "</ul>",
      );
    rand("", "Risc", risc(an));
    if (an.abordare.length)
      rand(
        "an-row-do",
        "Răspunsul va",
        '<ul class="an-do">' +
          an.abordare
            .map(function (a) {
              return (
                "<li>" + L.icon("check") + "<span>" + esc(a) + "</span></li>"
              );
            })
            .join("") +
          "</ul>",
      );
    var mem = tokeniMemorie(o.memorie);
    if (mem.length)
      rand("an-row-mem", "Din memorie", htmlDinMemorie(an.din_memorie, mem));
    var ascunsa = !!o.ascunsa;
    return (
      '<section class="an' +
      (o.reveal ? " is-reveal" : "") +
      '" aria-labelledby="' +
      did +
      '-an-h">' +
      '<div class="an-head"><h4 class="an-title" id="' +
      did +
      '-an-h">' +
      L.icon("nodes") +
      "Ce a înțeles sistemul</h4>" +
      '<button type="button" class="btn link sm an-tg" data-an-toggle aria-expanded="' +
      !ascunsa +
      '" aria-controls="' +
      did +
      '-an-b">' +
      (ascunsa ? "Arată analiza" : "Ascunde analiza") +
      "</button></div>" +
      '<div class="an-body" id="' +
      did +
      '-an-b"><dl class="an-rows">' +
      randuri.join("") +
      "</dl>" +
      '<p class="an-foot just" lang="ro">' +
      esc(NOTA) +
      "</p></div></section>"
    );
  }

  /* --------------------------------------- the network (while waiting) */

  /* o: {regen, memorie (tokens of the examples the proposal will likely receive)} */
  function incepe(id, o) {
    termina(id);
    var mem = tokeniMemorie(o && o.memorie);
    var seq = mem.length ? ["m", 0, 1, 2, 3, 4] : [0, 1, 2, 3, 4];
    var st = {
      t0: Date.now(),
      k: 0,
      seq: seq,
      faza: seq[0],
      mem: mem,
      memGol: false,
      regen: !!(o && o.regen),
      gata: false,
      valori: null,
      cuv: null,
      timer: null,
    };
    st.timer = setInterval(function () {
      pas(id);
    }, PAS_MS);
    stari.set(id, st);
  }

  function activ(id) {
    return stari.has(id);
  }

  function termina(id) {
    var st = stari.get(id);
    if (st && st.timer) clearInterval(st.timer);
    stari.delete(id);
  }

  function seteazaStatus(nn, text) {
    var el = nn.querySelector(".nn-st");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("is-new");
    void el.offsetWidth; // restart the short entrance of the new line
    el.classList.add("is-new");
  }

  function textFaza(f) {
    return f === "m" ? STATUS_MEM : STATUS[f] || STATUS[0];
  }

  function pas(id) {
    var st = stari.get(id);
    if (!st || st.gata) return;
    st.k = (st.k + 1) % st.seq.length;
    st.faza = st.seq[st.k];
    var nn = reteaDin(id);
    if (!nn) return;
    nn.setAttribute("data-faza", String(st.faza));
    seteazaStatus(nn, textFaza(st.faza));
  }

  function valoriNoduri(an, limba) {
    return {
      limba: an.limba || L.limbaNume(limba),
      ton: an.ton || an.polaritate || "",
      subiecte: String(an.subiecte.length),
      risc: an.risc,
      abordare: String(an.abordare.length),
    };
  }

  /* o: {inaltime} reserved height (regenerate: the old analysis + text, so the card keeps still) */
  function htmlRetea(it, o) {
    o = o || {};
    var st = stari.get(it.reviewId);
    var mem = st ? st.mem : [];
    // with the memory group the review keeps 4 words: both groups fit the same stage
    if (st && !st.cuv) st.cuv = cuvinteCheie(it.comment, mem.length ? 4 : 0);
    var cuv = (st && st.cuv) || cuvinteCheie(it.comment);
    if (!cuv.length) cuv = ["recenzie"];
    var gata = !!(st && st.gata && st.valori);
    var v = gata ? st.valori : {};
    var faza = st ? st.faza : 0;
    var h = Math.round(Number(o.inaltime) || 0);
    var pastile = cuv
      .map(function (w) {
        return '<li class="nn-pill" title="' + esc(w) + '">' + esc(w) + "</li>";
      })
      .join("");
    var intrare = mem.length
      ? '<div class="nn-col nn-in has-mem"><ul class="nn-words">' +
        pastile +
        '</ul><div class="nn-memg"><span class="nn-mem-h">' +
        esc(MEM_H) +
        '</span><ul class="nn-mems">' +
        mem.map(htmlMp).join("") +
        "</ul></div></div>"
      : '<ul class="nn-col nn-in">' + pastile + "</ul>";
    return (
      '<div class="nn' +
      (gata ? " is-gata" : "") +
      (st && st.memGol ? " mem-gol" : "") +
      '" data-faza="' +
      (gata ? "gata" : faza) +
      '"' +
      (h > 0 ? ' style="min-height:' + h + 'px"' : "") +
      ">" +
      '<div class="nn-stage" aria-hidden="true">' +
      '<svg class="nn-edges" focusable="false"></svg>' +
      intrare +
      '<ul class="nn-col nn-mid">' +
      NODURI.map(function (n, i) {
        var val = v[n.k] || "";
        return (
          '<li class="nn-node' +
          (n.k === "risc" && val === "sensibil" ? " is-sens" : "") +
          '" data-k="' +
          n.k +
          '" style="--i:' +
          i +
          '"' +
          (val ? ' title="' + esc(n.l + ": " + val) + '"' : "") +
          '><span class="nn-dot"></span><span class="nn-l">' +
          esc(n.l) +
          '</span><span class="nn-v">' +
          esc(val) +
          "</span></li>"
        );
      }).join("") +
      "</ul>" +
      '<div class="nn-col nn-out"><span class="nn-node nn-fin"><span class="nn-dot"></span>' +
      L.icon("check") +
      '<span class="nn-l">Propunere</span></span></div>' +
      "</div>" +
      '<p class="nn-status">' +
      L.icon("nodes") +
      '<span class="nn-st" aria-hidden="true">' +
      esc(gata ? GATA : textFaza(faza)) +
      '</span><span class="sr-only" role="status">Se pregătește propunerea…</span></p>' +
      "</div>"
    );
  }

  /* Pulses never start in sync: a fixed spread over the 2.4 s cycle, already in flight. */
  function intarziere(n) {
    return -((n * 389) % 2400);
  }

  /* Edges between the columns, measured from the laid-out nodes (any width, any font). */
  function deseneazaRetea(nn) {
    var stage = nn.querySelector(".nn-stage");
    var svg = nn.querySelector(".nn-edges");
    if (!stage || !svg) return;
    var sr = stage.getBoundingClientRect();
    if (sr.width < 40 || sr.height < 40) return;
    function rel(el) {
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return {
        l: r.left - sr.left,
        r: r.right - sr.left,
        y: r.top + r.height / 2 - sr.top,
      };
    }
    var P = Array.prototype.map
      .call(stage.querySelectorAll(".nn-pill"), rel)
      .filter(Boolean);
    var M = Array.prototype.map.call(
      stage.querySelectorAll(".nn-mid .nn-node"),
      rel,
    );
    var fin = stage.querySelector(".nn-fin");
    var F = fin ? rel(fin) : null;
    var baza = [];
    var puls = [];
    var n = 0;
    P.forEach(function (p, i) {
      M.forEach(function (m, j) {
        if (!m) return;
        var d = curba(p.r + 2, p.y, m.l - 2, m.y);
        var k = NODURI[j].k;
        baza.push('<path class="nn-e" data-m="' + k + '" d="' + d + '"/>');
        puls.push(
          '<path class="nn-p ' +
            ((i + j) % 2 ? "b" : "a") +
            '" data-m="' +
            k +
            '" pathLength="100" style="animation-delay:' +
            intarziere(n++) +
            'ms" d="' +
            d +
            '"/>',
        );
      });
    });
    if (F)
      M.forEach(function (m, j) {
        if (!m) return;
        var d = curba(m.r + 2, m.y, F.l - 2, F.y);
        var k = NODURI[j].k;
        baza.push(
          '<path class="nn-e" data-m="' + k + '" data-o="1" d="' + d + '"/>',
        );
        puls.push(
          '<path class="nn-p ' +
            (j % 2 ? "b" : "a") +
            '" data-m="' +
            k +
            '" data-o="1" pathLength="100" style="animation-delay:' +
            intarziere(n++ + 7) +
            'ms" d="' +
            d +
            '"/>',
        );
      });
    // the examples from memory feed the tone and the approach (data-mm: never lit with the words)
    Array.prototype.map
      .call(stage.querySelectorAll(".nn-mp"), rel)
      .filter(Boolean)
      .forEach(function (p) {
        M.forEach(function (m, j) {
          var k = NODURI[j].k;
          if (!m || DIN_MEMORIE.indexOf(k) === -1) return;
          var d = curba(p.r + 2, p.y, m.l - 2, m.y);
          baza.push('<path class="nn-e" data-mm="' + k + '" d="' + d + '"/>');
          puls.push(
            '<path class="nn-p c" data-mm="' +
              k +
              '" pathLength="100" style="animation-delay:' +
              intarziere(n++ + 3) +
              'ms" d="' +
              d +
              '"/>',
          );
        });
      });
    svg.setAttribute("viewBox", "0 0 " + r1(sr.width) + " " + r1(sr.height));
    svg.innerHTML = baza.join("") + puls.join("");
  }

  function monteaza(root) {
    if (!root) return;
    var el =
      root.classList && root.classList.contains("nn")
        ? [root]
        : root.querySelectorAll(".nn");
    Array.prototype.forEach.call(el, deseneazaRetea);
  }

  /* Height the regenerated panel keeps while the network runs (analysis block + text area). */
  function inaltimeRezervata(card) {
    if (!card) return 0;
    var area = card.querySelector(".prop-area");
    var an = card.querySelector(".an");
    var h = area ? area.offsetHeight : 0;
    if (an) h += an.offsetHeight + 10;
    return h;
  }

  /* Minimum display: a prepared answer is instant, the network still reads as a step. */
  function asteapta(id, eroare) {
    var st = stari.get(id);
    if (!st) return Promise.resolve();
    var min = eroare ? MIN_EROARE_MS : st.regen ? MIN_REGEN_MS : MIN_MS;
    return pauza(min - (Date.now() - st.t0));
  }

  /* The network settles: the middle nodes take the model's values, the proposal node fills. */
  function aseaza(id, an, o) {
    var st = stari.get(id);
    if (!st || !an) return Promise.resolve();
    o = o || {};
    st.gata = true;
    st.valori = valoriNoduri(an, o.limba);
    if (st.timer) clearInterval(st.timer);
    st.timer = null;
    var nn = reteaDin(id);
    if (!nn) return Promise.resolve();
    Array.prototype.forEach.call(
      nn.querySelectorAll(".nn-mid .nn-node"),
      function (nod) {
        var k = nod.getAttribute("data-k");
        var val = st.valori[k] || "";
        var v = nod.querySelector(".nn-v");
        if (v) v.textContent = val;
        if (val)
          nod.title = nod.querySelector(".nn-l").textContent + ": " + val;
        if (k === "risc") nod.classList.toggle("is-sens", val === "sensibil");
      },
    );
    if (st.mem.length && Array.isArray(o.memorie))
      aseazaMemoria(nn, st, o.memorie);
    nn.setAttribute("data-faza", "gata");
    nn.classList.add("is-gata");
    seteazaStatus(nn, GATA);
    return pauza(L.reduceMotion() ? 700 : ASEZARE_MS);
  }

  /* The guess gives way to the server's list (o.memorie = the answer's memorie_folosita as
     tokens): the examples the model really received; none = the group fades, its edges go. */
  function aseazaMemoria(nn, st, lista) {
    var reale = tokeniMemorie(lista);
    st.memGol = !reale.length;
    if (reale.length) st.mem = reale;
    nn.classList.toggle("mem-gol", st.memGol);
    var ul = nn.querySelector(".nn-mems");
    if (ul && reale.length) ul.innerHTML = reale.map(htmlMp).join("");
    try {
      deseneazaRetea(nn);
    } catch (e) {
      /* edges are decoration */
    }
  }

  function iese(id) {
    var nn = reteaDin(id);
    if (!nn || L.reduceMotion()) return Promise.resolve();
    nn.classList.add("is-iese");
    return pauza(IESIRE_MS);
  }

  /* ------------------------------------------------- connector lines */

  /* Layout position inside the card, transforms ignored (rows may still be sliding in). */
  function pozitie(el, card, ox, oy) {
    var x = 0;
    var y = 0;
    var e = el;
    while (e && e !== card) {
      x += e.offsetLeft;
      y += e.offsetTop;
      e = e.offsetParent;
    }
    if (e === card)
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    var r = el.getBoundingClientRect();
    return { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height };
  }

  function alegeChip(chips, tema, pol) {
    var dupaTema = -1;
    for (var i = 0; i < chips.length; i++) {
      if (chips[i].getAttribute("data-tema") !== tema) continue;
      if (chips[i].getAttribute("data-pol") === pol) return i;
      if (dupaTema === -1) dupaTema = i;
    }
    return dupaTema;
  }

  /* A wire drops in the gutter between the columns, then runs straight along the chip's row
     (whose label cell is empty there): it never crosses the review text or another label. */
  function fir(l) {
    var xg = Math.max(l.x1 + 8, Math.min(l.xg, l.x2));
    return (
      curba(l.x1, l.y1, xg, l.y2, 0.5) +
      (l.x2 > xg ? "L" + r1(l.x2) + " " + r1(l.y2) : "")
    );
  }

  function scoateLegaturi(card) {
    var vechi = card.querySelector(":scope > .an-links");
    if (vechi) vechi.remove();
  }

  /* Each highlighted phrase -> its topic chip: a curve from the text column's edge (at the
     phrase's last visible line) to the chip. Skipped when the phrase is in the clamped part,
     when the columns are stacked (narrow screens) or when the analysis is hidden.
     o: {anim} draw the lines in (first reveal only). */
  function leaga(card, o) {
    if (!card) return;
    o = o || {};
    var text = card.querySelector(".rev-text");
    var an = card.querySelector(".an");
    var marks = text ? text.querySelectorAll("mark.hl") : [];
    var chips = an ? an.querySelectorAll(".an-chip") : [];
    Array.prototype.forEach.call(marks, function (m) {
      var c = alegeChip(
        chips,
        m.getAttribute("data-tema"),
        m.getAttribute("data-pol"),
      );
      if (c === -1) m.removeAttribute("data-c");
      else m.setAttribute("data-c", String(c));
    });
    Array.prototype.forEach.call(chips, function (c, i) {
      c.setAttribute("data-c", String(i));
    });
    var body = an && an.querySelector(".an-body");
    if (
      !marks.length ||
      !chips.length ||
      !body ||
      body.offsetParent === null ||
      card.closest(".an-off")
    ) {
      scoateLegaturi(card);
      return;
    }
    var cr = card.getBoundingClientRect();
    var ox = cr.left + card.clientLeft;
    var oy = cr.top + card.clientTop;
    var tb = text.getBoundingClientRect();
    var xText = tb.right - ox;
    var anPoz = pozitie(an, card, ox, oy);
    if (anPoz.x < xText + 12) {
      scoateLegaturi(card); // stacked columns: the highlights and chips still speak for themselves
      return;
    }
    var linii = [];
    var folosit = {};
    Array.prototype.forEach.call(marks, function (m) {
      var ci = m.getAttribute("data-c");
      if (ci === null) return;
      var rs = m.getClientRects();
      var r = null;
      for (var i = rs.length - 1; i >= 0; i--) {
        var q = rs[i];
        if (q.width > 0.5 && q.top >= tb.top - 1 && q.bottom <= tb.bottom + 1) {
          r = q;
          break;
        }
      }
      if (!r) return; // inside the clamped (hidden) part of the text
      var cp = pozitie(chips[Number(ci)], card, ox, oy);
      var y1 = r.top + r.height / 2 - oy;
      var cheie = Math.round(y1);
      while (folosit[cheie]) cheie += 5; // two phrases on one line: ports side by side
      folosit[cheie] = true;
      linii.push({
        x1: xText + 7,
        y1: cheie + (y1 - Math.round(y1)),
        xg: anPoz.x - 1,
        x2: cp.x - 5,
        y2: cp.y + cp.h / 2,
        p: m.getAttribute("data-pol"),
        c: ci,
        tema: m.getAttribute("data-tema") || "",
      });
    });
    if (!linii.length) {
      scoateLegaturi(card);
      return;
    }
    var svg = card.querySelector(":scope > .an-links");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "an-links");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      card.appendChild(svg);
    }
    var w = card.clientWidth;
    var h = card.clientHeight;
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.classList.toggle("is-anim", !!o.anim && !L.reduceMotion());
    svg.innerHTML = linii
      .map(function (l, k) {
        return (
          '<g class="an-wg p-' +
          (POL[l.p] || "neu") +
          '" data-c="' +
          l.c +
          '" style="--k:' +
          k +
          '"><path class="an-w" pathLength="1" d="' +
          fir(l) +
          '"/><circle class="an-port" cx="' +
          r1(l.x1) +
          '" cy="' +
          r1(l.y1) +
          '" r="3"/><circle class="an-port an-port-e" cx="' +
          r1(l.x2) +
          '" cy="' +
          r1(l.y2) +
          '" r="3"/></g>'
        );
      })
      .join("");
  }

  function legaToate(root) {
    if (!root) return;
    Array.prototype.forEach.call(
      root.querySelectorAll(".rev-card"),
      function (c) {
        if (c.querySelector(".an") || c.querySelector(":scope > .an-links"))
          leaga(c);
      },
    );
  }

  /* Pointing at a chip or a phrase lights the pair (and its line), dims the rest. Never while the
     analysis is hidden: the hover would otherwise tint a phrase the page says it does not mark. */
  function aprinde(el, on) {
    var card = el.closest(".rev-card");
    if (!card) return;
    var c = el.getAttribute("data-c");
    var aprins = !!on && c !== null && !card.closest(".an-off");
    card.classList.toggle("an-focus", aprins);
    Array.prototype.forEach.call(
      card.querySelectorAll(".an-chip, mark.hl, .an-wg"),
      function (x) {
        x.classList.toggle("is-on", aprins && x.getAttribute("data-c") === c);
      },
    );
  }

  function activeazaHover(root) {
    if (!root || root.__anHover) return;
    root.__anHover = true;
    root.addEventListener("mouseover", function (e) {
      var t = e.target.closest && e.target.closest(".an-chip, mark.hl");
      if (t) aprinde(t, true);
    });
    root.addEventListener("mouseout", function (e) {
      var t = e.target.closest && e.target.closest(".an-chip, mark.hl");
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget)))
        aprinde(t, false);
    });
  }

  L.retea = {
    cuvinteCheie: cuvinteCheie,
    valideaza: valideaza,
    potriviri: potriviri,
    numarPotriviri: numarPotriviri,
    evidentiaza: evidentiaza,
    htmlAnaliza: htmlAnaliza,
    htmlRetea: htmlRetea,
    monteaza: monteaza,
    inaltimeRezervata: inaltimeRezervata,
    incepe: incepe,
    activ: activ,
    asteapta: asteapta,
    aseaza: aseaza,
    iese: iese,
    termina: termina,
    leaga: leaga,
    legaToate: legaToate,
    activeazaHover: activeazaHover,
  };
})();
