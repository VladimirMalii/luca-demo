/* LUCA demo, online version: the demo API answered in the browser (GitHub Pages has no server).
   Loaded before common.js on every protected page. window.fetch is wrapped: requests to the site's
   own api/* paths (and login / logout) are answered here, from window.LUCA_DATA (a snapshot taken
   from the live backend by tools/build_online.py) plus a client-side state kept in sessionStorage
   (survives page navigation in the tab, cleared by "Resetează demonstrația"). Anything else goes to
   the browser's own fetch. The rules are those of the live backend (app/demo/app.py, stare.py,
   rapoarte.py): same states, status codes, messages, history entries and learned memory.
   Differences, by design: the proposals and analyses were prepared beforehand without memory
   examples (memorie_folosita [] and din_memorie ""; only a closing the team corrected is applied, as
   on the server), "Regenerează" shows the same prepared
   proposal again with a note, the e-mail links point to this site. Nothing leaves the browser. */
(function () {
  "use strict";

  var D = window.LUCA_DATA;
  var nativ =
    typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  if (!D || !Array.isArray(D.recenzii)) {
    window.LUCA_MOCK_INDISPONIBIL = true;
    return;
  }

  var script = document.currentScript;
  var BAZA = new URL(
    "../",
    script && script.src
      ? script.src
      : new URL("static/x", window.location.href),
  ).href;
  window.LUCA_BAZA = BAZA;

  var CHEIE_ACCES = "luca-online-acces";
  var CHEIE_STARE = "luca-online-stare:" + (D.build || "0");
  var SURSA = "pregatita"; // proposals prepared beforehand (the live app says "live" or uses its reserve)
  var LINK_TOKEN = "{{LINK}}";
  var LIMITA_RASPUNS = 4096;
  var LIMITA_NOTA = 1000;
  var LIMITA_ID = 200;
  var LIMITA_FRAGMENT = 120;
  var REFERINTA_ID = /^[+-]?\d+$/;

  var M = {
    publica:
      "Demonstrație: răspunsul nu se publică. În producție pleacă pe profilul Google al unității, după ce acordați acces.",
    aiEsuat: "Nu am putut pregăti propunerea. Încercați din nou.",
    login: "Sesiunea a expirat. Autentificați-vă din nou.",
    neasteptat: "A apărut o eroare neașteptată. Încercați din nou.",
    cerere: "Cerere invalidă.",
    unitate: "Unitatea nu există.",
    lipsaId: "Lipsește reviewId.",
    blocatSens:
      "Recenzie sensibilă: publicarea necesită confirmarea verificării interne.",
    aprobaSens:
      "Recenzie sensibilă: răspunsul nu se aprobă direct. Folosiți „Trimite la verificare internă”.",
    dejaPublicat:
      "Răspunsul a fost deja publicat în demonstrație. Pentru a relua, folosiți „Resetează demonstrația”.",
    negasita: "Recenzia nu a fost găsită.",
    doarSens: "Doar recenziile sensibile se trimit la verificare internă.",
    netrimisa: "Recenzia nu a fost trimisă la verificare internă.",
    textModificat:
      "Textul a fost modificat după verificarea internă. Trimiteți din nou la verificare internă.",
    gol: "Răspunsul este gol.",
    lung:
      "Răspunsul depășește limita Google de " +
      LIMITA_RASPUNS +
      " de caractere.",
    invalid: "Textul conține caractere invalide.",
    nota: "Nota trebuie să fie text.",
    notaEmail: "În demonstrație e-mailul nu se trimite.",
    motivImplicit: "Recenzie marcată ca sensibilă.",
    regenerare:
      "Versiunea online are o singură propunere pregătită pentru fiecare recenzie, așa că Regenerează o afișează din nou. În platformă, Regenerează scrie o variantă nouă.",
    loginGresit: "Date de autentificare greșite.",
    negasitRuta: "Not Found",
    metoda: "Method Not Allowed",
  };

  var DE_RASPUNS = "de_raspuns";
  var PROPUNERE = "propunere";
  var APROBAT = "aprobat";
  var VERIFICARE_INTERNA = "verificare_interna";
  var VERIFICAT_INTERN = "verificat_intern";
  var PUBLICAT_DEMO = "publicat_demo";
  var A_TRIMIS = "trimis_verificare";
  var A_CONFIRMAT = "confirmat_intern";
  var POLARITATI = ["negativ", "mixt", "pozitiv"];

  var CAMPURI_ITEM = [
    "reviewId",
    "unit_id",
    "unitate",
    "oras",
    "tara",
    "limba",
    "reviewer",
    "stele",
    "comment",
    "comment_afisare",
    "data_relativa",
    "createTime",
    "raspuns_public_actual",
    "sensibil",
  ];
  var CAMPURI_STARE = [
    "stare",
    "propunere",
    "propunere_sursa",
    "propunere_model",
    "analiza",
    "raspuns",
    "aprobat_de",
    "aprobat_la",
    "trimis_la",
    "trimis_catre",
    "confirmat_la",
    "confirmat_de",
    "nota",
    "publicat_la",
    "noua",
    "editat_manual",
    "memorie_folosita",
  ];

  var REC = {};
  var ORDINE = [];
  D.recenzii.forEach(function (r) {
    REC[r.reviewId] = r;
    ORDINE.push(r.reviewId);
  });
  var PROP = D.propuneri || {};
  var CTX = D.context || {};
  var PERSOANA = CTX.persoana_desemnata || {};
  var DE_CATRE = D.de_catre || CTX.utilizator || "Echipa Softmed";
  var ROL = D.rol_verificare || PERSOANA.rol || "Persoana desemnată LUCA";
  var EMAIL_VERIFICARE = D.email_verificare || PERSOANA.email_demo || null;

  /* ----------------------------------------------------------- helpers */

  function copie(v) {
    return v === undefined ? null : JSON.parse(JSON.stringify(v));
  }
  function are(o, k) {
    return Object.prototype.hasOwnProperty.call(o, k);
  }
  function norm(t) {
    return String(t == null ? "" : t)
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  /* Local time, ISO 8601 with offset, seconds precision (as the backend's acum_iso). */
  function acumIso() {
    var d = new Date();
    var off = -d.getTimezoneOffset();
    var semn = off >= 0 ? "+" : "-";
    off = Math.abs(off);
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds()) +
      semn +
      pad(Math.floor(off / 60)) +
      ":" +
      pad(off % 60)
    );
  }
  function caractere(s) {
    return Array.from(String(s));
  }
  function esteSensibila(item) {
    var s = item && item.sensibil;
    return !!(s && typeof s === "object" && s.flag);
  }
  function formatNumar(n) {
    return String(Math.trunc(Number(n) || 0)).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ".",
    );
  }
  function cuDe(n) {
    return n >= 20 && (n % 100 === 0 || n % 100 >= 20);
  }
  function numarRo(n, singular, plural) {
    if (n === 1) return "1 " + singular;
    return formatNumar(n) + " " + (cuDe(n) ? "de " : "") + plural;
  }
  function steleRo(n) {
    return numarRo(n, "stea", "stele");
  }

  function Eroare(status, mesaj) {
    this.status = status;
    this.mesaj = mesaj;
  }
  function E(status, mesaj) {
    return new Eroare(status, mesaj);
  }

  /* Lone surrogates refused (the live backend cannot store them), U+FFFE / U+FFFF dropped. */
  function textSigur(t) {
    if (
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
        t,
      )
    )
      throw E(400, M.invalid);
    return t.replace(/[￾￿]/g, "");
  }
  function textValid(t) {
    if (typeof t !== "string") throw E(400, M.gol);
    t = textSigur(t).trim();
    if (!t) throw E(400, M.gol);
    if (caractere(t).length > LIMITA_RASPUNS) throw E(400, M.lung);
    return t;
  }
  function corpObiect(data) {
    if (data === null || data === undefined) return {};
    return data;
  }
  function idRecenzie(data) {
    var rid = data.reviewId;
    if (
      typeof rid !== "string" ||
      !rid.trim() ||
      caractere(rid).length > LIMITA_ID
    )
      throw E(400, M.lipsaId);
    return rid.trim();
  }

  /* ------------------------------------------------------------- state */

  function stareInitiala() {
    return {
      stare: DE_RASPUNS,
      propunere: null,
      propunere_sursa: null,
      propunere_model: null,
      analiza: null,
      raspuns: null,
      aprobat_de: null,
      aprobat_la: null,
      trimis_la: null,
      trimis_catre: null,
      confirmat_la: null,
      confirmat_de: null,
      nota: null,
      publicat_la: null,
      noua: false,
      editat_manual: false,
      memorie_folosita: [],
    };
  }

  function stareNoua() {
    var st = {};
    ORDINE.forEach(function (rid) {
      st[rid] = stareInitiala();
    });
    return {
      build: D.build || "0",
      st: st,
      istoric: [],
      nextId: 0,
      actualizat: false,
      memorie: {},
      memorieSeq: {},
      nrExemple: 0,
      seq: 0,
    };
  }

  function citesteStare() {
    var brut = null;
    try {
      brut = window.sessionStorage.getItem(CHEIE_STARE);
    } catch (e) {
      brut = null;
    }
    if (!brut) return stareNoua();
    try {
      var s = JSON.parse(brut);
      var bun =
        s &&
        s.build === (D.build || "0") &&
        s.st &&
        Array.isArray(s.istoric) &&
        s.memorie &&
        s.memorieSeq &&
        ORDINE.every(function (rid) {
          return s.st[rid] && typeof s.st[rid].stare === "string";
        });
      return bun ? s : stareNoua();
    } catch (e) {
      return stareNoua();
    }
  }

  var S = citesteStare();

  function salveaza() {
    try {
      window.sessionStorage.setItem(CHEIE_STARE, JSON.stringify(S));
    } catch (e) {
      /* storage full or blocked: the state lives until the page changes */
    }
  }

  function areAcces() {
    if (window.LUCA_ACCES && typeof window.LUCA_ACCES.areAcces === "function")
      return window.LUCA_ACCES.areAcces();
    try {
      return window.sessionStorage.getItem(CHEIE_ACCES) === "1";
    } catch (e) {
      return false;
    }
  }

  function vizibila(rid) {
    var rec = REC[rid];
    if (!rec) return false;
    return S.actualizat || !rec.rezervata;
  }
  function numarVizibile() {
    return ORDINE.filter(vizibila).length;
  }

  function recenzie(rid) {
    if (typeof rid !== "string" || !vizibila(rid)) throw E(404, M.negasita);
    return REC[rid];
  }

  /* Display copies with soft hyphens for the prepared text (the UI uses them when the text matches). */
  function afisare(rid, text) {
    var p = PROP[rid];
    if (!p || !text || typeof p.raspuns_afisare !== "string") return null;
    return norm(text) === norm(p.raspuns) ? p.raspuns_afisare : null;
  }

  function vedere(rid) {
    var rec = REC[rid];
    var st = S.st[rid];
    var out = {};
    CAMPURI_ITEM.forEach(function (k) {
      out[k] = copie(rec[k]);
    });
    out.address = rec.address || "";
    CAMPURI_STARE.forEach(function (k) {
      out[k] = copie(st[k]);
    });
    out.alerta = esteSensibila(rec);
    var pa = afisare(rid, st.propunere);
    if (pa) out.propunere_afisare = pa;
    var ra = afisare(rid, st.raspuns);
    if (ra) out.raspuns_afisare = ra;
    return out;
  }

  function listaVizibile() {
    return ORDINE.filter(vizibila).map(vedere);
  }

  function editat(rid, text) {
    return norm(text) !== norm(S.st[rid].propunere);
  }

  /* History entry (stare.py _intrare); analiza and memorie_folosita on proposal entries only. */
  function intrare(rid, actiune, raspuns, deCatre, analiza) {
    var rec = REC[rid];
    var st = S.st[rid];
    S.nextId += 1;
    var e = {
      id: S.nextId,
      cand: acumIso(),
      reviewId: rid,
      unit_id: rec.unit_id,
      unitate: rec.unitate,
      oras: rec.oras,
      recenzent: rec.reviewer,
      stele: rec.stele,
      limba: rec.limba,
      actiune: actiune,
      de_catre: deCatre || DE_CATRE,
      raspuns: raspuns,
      sursa_propunere: st.propunere_sursa,
      editat_manual: actiune !== PROPUNERE ? st.editat_manual : false,
      sensibil: esteSensibila(rec) ? copie(rec.sensibil) : null,
      analiza: actiune === PROPUNERE ? copie(analiza) : null,
      memorie_folosita: actiune === PROPUNERE ? copie(st.memorie_folosita) : [],
    };
    var af = afisare(rid, raspuns);
    if (af) e.raspuns_afisare = af;
    S.istoric.push(e);
    return copie(e);
  }

  /* ---------------------------------------------- learned memory (stare.py) */

  function grupaStele(stele) {
    if (
      typeof stele !== "number" ||
      !Number.isInteger(stele) ||
      stele < 1 ||
      stele > 5
    )
      return null;
    return stele <= 2 ? 0 : stele === 3 ? 1 : 2;
  }

  function temeDinAnaliza(analiza) {
    var subiecte =
      analiza && typeof analiza === "object" ? analiza.subiecte : null;
    if (!Array.isArray(subiecte)) return [];
    var teme = [];
    subiecte.forEach(function (s) {
      var tema = s && typeof s === "object" ? s.tema : null;
      if (
        typeof tema === "string" &&
        tema.trim() &&
        teme.indexOf(tema.trim()) === -1
      )
        teme.push(tema.trim());
    });
    return teme;
  }

  function polaritateExemplu(analiza, stele) {
    var pol =
      analiza && typeof analiza === "object" ? analiza.polaritate : null;
    if (POLARITATI.indexOf(pol) !== -1) return pol;
    var g = grupaStele(stele);
    return g === 0 ? "negativ" : g === 2 ? "pozitiv" : "mixt";
  }

  function fragmentExemplu(analiza, comment) {
    var fr = analiza && typeof analiza === "object" ? analiza.fragmente : null;
    if (Array.isArray(fr)) {
      for (var i = 0; i < fr.length; i++) {
        var t = fr[i] && typeof fr[i] === "object" ? fr[i].text : null;
        if (typeof t === "string" && t.trim()) return t.trim();
      }
    }
    var text = caractere(norm(comment));
    if (text.length <= LIMITA_FRAGMENT) return text.join("");
    var taiat = text.slice(0, LIMITA_FRAGMENT).join("");
    if (text[LIMITA_FRAGMENT] !== " " && taiat.indexOf(" ") !== -1)
      taiat = taiat.slice(0, taiat.lastIndexOf(" "));
    return taiat.replace(/[ ,;:.\-]+$/, "") + "…";
  }

  function continutExemplu(e) {
    return JSON.stringify([
      norm(e.raspuns_aprobat),
      norm(e.propunere_initiala),
      !!e.editat_manual,
      e.teme || [],
      e.polaritate,
      e.fragment,
    ]);
  }

  function exempleRecente() {
    return Object.keys(S.memorie)
      .sort(function (a, b) {
        return S.memorieSeq[b] - S.memorieSeq[a];
      })
      .map(function (rid) {
        return S.memorie[rid];
      });
  }

  function rezultatMemorie(nou, actualizat) {
    var toate = Object.keys(S.memorie).map(function (k) {
      return S.memorie[k];
    });
    return {
      nou: copie(nou),
      actualizat: actualizat,
      total: toate.length,
      editate: toate.filter(function (e) {
        return e.editat_manual;
      }).length,
    };
  }

  function exemplu(rid, text, sursa, id) {
    var rec = REC[rid];
    var st = S.st[rid];
    var propunere = st.propunere || "";
    return {
      id: id,
      cand: acumIso(),
      reviewId: rid,
      unit_id: rec.unit_id,
      unitate: rec.unitate,
      limba: String(rec.limba || "")
        .trim()
        .toLowerCase(),
      stele: rec.stele,
      teme: temeDinAnaliza(st.analiza),
      polaritate: polaritateExemplu(st.analiza, rec.stele),
      fragment: fragmentExemplu(st.analiza, rec.comment),
      propunere_initiala: propunere,
      raspuns_aprobat: text,
      editat_manual: norm(text) !== norm(propunere),
      sursa: sursa,
    };
  }

  /* One example per review: new (next id), updated in place when what it teaches changed, else nothing. */
  function invata(rid, text, sursa) {
    var vechi = are(S.memorie, rid) ? S.memorie[rid] : null;
    var ex = exemplu(rid, text, sursa, vechi ? vechi.id : "");
    if (vechi && continutExemplu(vechi) === continutExemplu(ex))
      return rezultatMemorie(null, false);
    if (!vechi) {
      S.nrExemple += 1;
      ex.id = "m" + S.nrExemple;
    }
    S.memorie[rid] = ex;
    S.seq += 1;
    S.memorieSeq[rid] = S.seq;
    return rezultatMemorie(ex, !!vechi);
  }

  /* Learned closing (stare.py incheiere_invatata): the closing the team corrected by hand on an
     approved example, i.e. its last line, or a short line ending in "," added above an unchanged
     signature. It must name LUCA: an added sentence or a note to the team is not a signature. */
  function liniiText(t) {
    return String(t || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(function (l) {
        return l.replace(/\s+$/, "");
      })
      .filter(function (l) {
        return l.trim();
      });
  }

  function incheiereInvatata(ex) {
    if (!ex || ex.editat_manual !== true) return null;
    var a = liniiText(ex.raspuns_aprobat);
    var i = liniiText(ex.propunere_initiala);
    if (a.length < 2 || !i.length) return null;
    var inch;
    if (a[a.length - 1].trim() !== i[i.length - 1].trim()) {
      inch = a[a.length - 1].trim();
    } else {
      var pen = a[a.length - 2].trim();
      var dinInitiala = i.some(function (x) {
        return x.trim() === pen;
      });
      if (!/,$/.test(pen) || a[a.length - 2].length > 60 || dinInitiala)
        return null;
      inch = pen + "\n" + a[a.length - 1].trim();
    }
    if (inch.toLowerCase().indexOf("luca") === -1) return null;
    return inch.length <= 120 ? inch : null;
  }

  /* The newest example (never the review's own) in the same language and star bucket whose closing
     the team corrected: { ex, incheiere } or null. */
  function exempluCuIncheiere(rid) {
    var rec = REC[rid];
    var limba = String(rec.limba || "")
      .trim()
      .toLowerCase();
    var grupa = grupaStele(rec.stele);
    var lista = exempleRecente();
    for (var k = 0; k < lista.length; k++) {
      var ex = lista[k];
      if (
        ex.reviewId === rid ||
        ex.limba !== limba ||
        grupaStele(ex.stele) !== grupa
      )
        continue;
      var inch = incheiereInvatata(ex);
      if (inch) return { ex: ex, incheiere: inch };
    }
    return null;
  }

  /* ------------------------------------------------------ e-mail previews */

  function linkSite(rel) {
    return new URL(rel, BAZA).href;
  }

  function emailVerificare(item, raspuns) {
    var s = item.sensibil || {};
    var motiv = s.motiv || M.motivImplicit;
    var link = linkSite(
      "index.html?recenzie=" + encodeURIComponent(item.reviewId),
    );
    var corp = [
      "Bună ziua,",
      "",
      "O recenzie publică de la " +
        item.unitate +
        " (" +
        item.oras +
        ") a fost marcată ca sensibilă. Răspunsul propus nu se publică până nu confirmați verificarea internă.",
      "",
      "Unitatea: " + item.unitate + ", " + item.oras,
      "Nota: " + steleRo(item.stele),
      "Recenzent: " + item.reviewer,
      "Data recenziei: " + (item.data_relativa || "-"),
      "Motivul marcării: " + motiv,
      "",
      "Recenzia:",
      "„" + (item.comment || "") + "”",
      "",
      "Răspunsul propus:",
      "„" + raspuns + "”",
      "",
      "După verificare, confirmați în platformă. Deschide în platformă: " +
        link,
      "",
      "Mulțumim,",
      DE_CATRE,
    ].join("\n");
    return {
      catre: PERSOANA.email_demo === undefined ? null : PERSOANA.email_demo,
      catre_rol: PERSOANA.rol === undefined ? null : PERSOANA.rol,
      subiect:
        "Recenzie de verificat intern: " +
        item.unitate +
        ", " +
        steleRo(item.stele),
      corp: corp,
      link: link,
      nota: M.notaEmail,
    };
  }

  function emailRaport(sablon) {
    var e = copie(sablon);
    var link = linkSite(e.link_rel || "rapoarte.html");
    e.corp = String(e.corp || "")
      .split(LINK_TOKEN)
      .join(link);
    e.link = link;
    delete e.link_rel;
    return e;
  }

  /* ------------------------------------------------------------ delays */

  function intarziere(min, max) {
    if (window.LUCA_MOCK_FARA_INTARZIERE === true) return 0;
    return Math.round(min + Math.random() * (max - min));
  }

  function asteapta(ms, semnal) {
    return new Promise(function (resolve, reject) {
      if (semnal && semnal.aborted) {
        reject(abandon());
        return;
      }
      var t = setTimeout(function () {
        if (semnal) semnal.removeEventListener("abort", laAbort);
        resolve();
      }, ms);
      function laAbort() {
        clearTimeout(t);
        reject(abandon());
      }
      if (semnal) semnal.addEventListener("abort", laAbort);
    });
  }

  function abandon() {
    try {
      return new DOMException("The operation was aborted.", "AbortError");
    } catch (e) {
      var x = new Error("The operation was aborted.");
      x.name = "AbortError";
      return x;
    }
  }

  /* After a regeneration the UI shows the same prepared text: say so, once the network settles. */
  function notaRegenerare() {
    if (window.LUCA_MOCK_FARA_INTARZIERE === true) return;
    setTimeout(function () {
      if (window.LUCA && typeof window.LUCA.toast === "function")
        window.LUCA.toast(M.regenerare, "info", 11000);
    }, 1500);
  }

  /* ------------------------------------------------------------ handlers */

  function hContext() {
    var c = copie(CTX);
    c.vizibile = numarVizibile();
    c.noi_disponibile = ORDINE.length - c.vizibile;
    c.total_recenzii = ORDINE.length;
    return c;
  }

  function hRecenzii() {
    return listaVizibile();
  }

  function hActualizeaza() {
    if (S.actualizat) {
      return {
        noi: 0,
        mesaj: "Nicio recenzie nouă.",
        reviewIds: [],
        vizibile: numarVizibile(),
      };
    }
    S.actualizat = true;
    var noi = ORDINE.filter(function (rid) {
      return REC[rid].rezervata;
    });
    noi.forEach(function (rid) {
      S.st[rid].noua = true;
    });
    salveaza();
    var n = noi.length;
    var mesaj =
      n === 0
        ? "Nicio recenzie nouă."
        : n === 1
          ? "O recenzie nouă adusă din Google."
          : numarRo(n, "recenzie nouă", "recenzii noi") + " aduse din Google.";
    return { noi: n, mesaj: mesaj, reviewIds: noi, vizibile: numarVizibile() };
  }

  function verificaPoatePropune(rid) {
    recenzie(rid);
    if (S.st[rid].stare === PUBLICAT_DEMO) throw E(409, M.dejaPublicat);
  }

  async function hRaspuns(data, cerere) {
    data = corpObiect(data);
    var rid = idRecenzie(data);
    verificaPoatePropune(rid);
    var p = PROP[rid];
    var t0 = Date.now();
    var regen = !!(
      S.st[rid].propunere ||
      (typeof data.anterior === "string" && data.anterior.trim())
    );
    if (!p || typeof p.raspuns !== "string" || !p.raspuns.trim()) {
      await asteapta(intarziere(1200, 1800), cerere.semnal);
      throw E(503, M.aiEsuat);
    }
    var durata = typeof p.durata_ms === "number" ? p.durata_ms : 3500;
    var tinta = Math.min(4500, Math.max(2500, durata));
    await asteapta(intarziere(tinta - 150, tinta + 150), cerere.semnal);
    verificaPoatePropune(rid);
    var text = textValid(p.raspuns);
    var analiza =
      p.analiza && typeof p.analiza === "object" ? copie(p.analiza) : null;
    if (analiza) analiza.din_memorie = ""; // prepared without memory examples
    var folosite = [];
    var invatat = exempluCuIncheiere(rid); // the team's corrected closing replaces the signature
    if (invatat) {
      text = liniiText(text)
        .slice(0, -1)
        .concat([invatat.incheiere])
        .join("\n");
      folosite = [
        {
          id: invatat.ex.id,
          unitate: invatat.ex.unitate,
          limba: invatat.ex.limba,
          stele: invatat.ex.stele,
          teme: (invatat.ex.teme || []).slice(),
          editat_manual: true,
        },
      ];
      if (analiza)
        analiza.din_memorie = (
          "Încheierea corectată de echipă: «" +
          invatat.incheiere.replace(/\n/g, " ") +
          "»."
        ).slice(0, 300);
    }
    var st = S.st[rid];
    st.stare = PROPUNERE;
    st.propunere = text;
    st.propunere_sursa = SURSA;
    st.propunere_model = p.model || null;
    st.analiza = analiza;
    st.raspuns = null;
    st.aprobat_de = null;
    st.aprobat_la = null;
    st.trimis_la = null;
    st.trimis_catre = null;
    st.confirmat_la = null;
    st.confirmat_de = null;
    st.nota = null;
    st.editat_manual = false;
    st.memorie_folosita = folosite;
    var e = intrare(rid, PROPUNERE, text, null, analiza);
    salveaza();
    if (regen) notaRegenerare();
    var item = REC[rid];
    var s = item.sensibil || {};
    return {
      raspuns: e.raspuns,
      sursa: SURSA,
      model: p.model || null,
      durata_ms:
        typeof p.durata_ms === "number" && Number.isInteger(p.durata_ms)
          ? p.durata_ms
          : Date.now() - t0,
      limba: item.limba,
      alerta: esteSensibila(item),
      categorie: s.categorie === undefined ? null : s.categorie,
      motiv: s.motiv === undefined ? null : s.motiv,
      stare: PROPUNERE,
      analiza: copie(st.analiza),
      memorie_folosita: copie(folosite),
      istoric: e,
    };
  }

  function hAproba(data) {
    data = corpObiect(data);
    var rid = idRecenzie(data);
    var text = textValid(data.raspuns);
    var rec = recenzie(rid);
    var st = S.st[rid];
    if (esteSensibila(rec)) throw E(409, M.aprobaSens);
    if (st.stare === PUBLICAT_DEMO) throw E(409, M.dejaPublicat);
    st.stare = APROBAT;
    st.raspuns = text;
    st.aprobat_de = DE_CATRE;
    st.aprobat_la = acumIso();
    st.editat_manual = editat(rid, text);
    var e = intrare(rid, APROBAT, text);
    var mem = invata(rid, text, "aprobare");
    salveaza();
    return {
      stare: APROBAT,
      aprobat_de: st.aprobat_de,
      aprobat_la: st.aprobat_la,
      editat_manual: st.editat_manual,
      istoric: e,
      memorie: mem,
    };
  }

  function hVerificare(data) {
    data = corpObiect(data);
    var rid = idRecenzie(data);
    var text = textValid(data.raspuns);
    var rec = recenzie(rid);
    var st = S.st[rid];
    if (!esteSensibila(rec)) throw E(409, M.doarSens);
    if (st.stare === PUBLICAT_DEMO) throw E(409, M.dejaPublicat);
    st.stare = VERIFICARE_INTERNA;
    st.raspuns = text;
    st.trimis_la = acumIso();
    st.trimis_catre = EMAIL_VERIFICARE;
    st.confirmat_la = null;
    st.confirmat_de = null;
    st.nota = null;
    st.editat_manual = editat(rid, text);
    var e = intrare(rid, A_TRIMIS, text);
    salveaza();
    return {
      stare: VERIFICARE_INTERNA,
      email: emailVerificare(vedere(rid), e.raspuns),
      trimis_la: st.trimis_la,
      trimis_catre: st.trimis_catre,
      istoric: e,
    };
  }

  function hConfirma(data) {
    data = corpObiect(data);
    var rid = idRecenzie(data);
    var nota = are(data, "nota") ? data.nota : null;
    if (nota !== null) {
      if (typeof nota !== "string") throw E(400, M.nota);
      nota =
        caractere(textSigur(nota).trim()).slice(0, LIMITA_NOTA).join("") ||
        null;
    }
    recenzie(rid);
    var st = S.st[rid];
    var e = null;
    if (st.stare !== VERIFICAT_INTERN) {
      if (st.stare !== VERIFICARE_INTERNA) throw E(409, M.netrimisa);
      st.stare = VERIFICAT_INTERN;
      st.confirmat_la = acumIso();
      st.confirmat_de = ROL;
      st.nota = nota;
      e = intrare(rid, A_CONFIRMAT, st.raspuns, ROL);
      salveaza();
    }
    return {
      stare: VERIFICAT_INTERN,
      confirmat_la: st.confirmat_la,
      confirmat_de: st.confirmat_de,
      istoric: e,
    };
  }

  function hPublica(data) {
    data = corpObiect(data);
    var rid = idRecenzie(data);
    var text = textValid(data.raspuns);
    var rec = recenzie(rid);
    var st = S.st[rid];
    var sens = esteSensibila(rec);
    if (st.stare === PUBLICAT_DEMO) {
      if (norm(text) === norm(st.raspuns)) {
        var ultima = null;
        for (var i = S.istoric.length - 1; i >= 0; i--) {
          if (
            S.istoric[i].reviewId === rid &&
            S.istoric[i].actiune === PUBLICAT_DEMO
          ) {
            ultima = S.istoric[i];
            break;
          }
        }
        return {
          status: "demo",
          mesaj: M.publica,
          stare: PUBLICAT_DEMO,
          publicat_la: st.publicat_la,
          istoric: copie(ultima),
          memorie: rezultatMemorie(null, false),
        };
      }
      if (sens) throw E(409, M.textModificat);
    } else if (sens) {
      if (st.stare !== VERIFICAT_INTERN) throw E(409, M.blocatSens);
      if (norm(text) !== norm(st.raspuns)) throw E(409, M.textModificat);
    }
    var acum = acumIso();
    if (st.stare !== APROBAT || norm(text) !== norm(st.raspuns)) {
      // publishing a text that was not explicitly approved = implicit approval by the user
      st.aprobat_de = DE_CATRE;
      st.aprobat_la = acum;
    }
    st.stare = PUBLICAT_DEMO;
    st.raspuns = text;
    st.publicat_la = acum;
    st.editat_manual = editat(rid, text);
    var e = intrare(rid, PUBLICAT_DEMO, text);
    var mem = invata(rid, text, "publicare");
    salveaza();
    return {
      status: "demo",
      mesaj: M.publica,
      stare: PUBLICAT_DEMO,
      publicat_la: st.publicat_la,
      istoric: e,
      memorie: mem,
    };
  }

  function hIstoric() {
    return S.istoric.slice().reverse().map(copie);
  }

  function hMemorie() {
    var exemple = exempleRecente().map(copie);
    var numar = {};
    exemple.forEach(function (e) {
      (e.teme || []).forEach(function (t) {
        numar[t] = (numar[t] || 0) + 1;
      });
    });
    var teme = {};
    Object.keys(numar)
      .map(function (k) {
        return [k, numar[k]];
      })
      .sort(function (a, b) {
        return b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
      })
      .forEach(function (kv) {
        teme[kv[0]] = kv[1];
      });
    return {
      exemple: exemple,
      total: exemple.length,
      editate: exemple.filter(function (e) {
        return e.editat_manual;
      }).length,
      teme: teme,
    };
  }

  function hAlerte() {
    return listaVizibile()
      .filter(function (r) {
        return r.alerta;
      })
      .map(function (r) {
        r.rezolvata = r.stare === PUBLICAT_DEMO;
        return r;
      });
  }

  function hReset() {
    S = stareNoua();
    try {
      window.sessionStorage.removeItem(CHEIE_STARE);
    } catch (e) {
      /* ignore */
    }
    return { status: "ok" };
  }

  function hRaportRetea() {
    return copie(D.rapoarte_retea);
  }

  function hRaportUnitate(data, cerere) {
    var brut = cerere.m[1];
    if (!REFERINTA_ID.test(brut)) throw E(422, M.cerere);
    var id = parseInt(brut, 10);
    var p = D.rapoarte_unitate && D.rapoarte_unitate[String(id)];
    if (!p) throw E(404, M.unitate);
    var out = copie(p);
    out.recenzii = ORDINE.filter(function (rid) {
      return REC[rid].unit_id === id;
    }).map(vedere);
    return out;
  }

  function hRaportEmail(data) {
    data = corpObiect(data);
    var u = data.unit_id;
    if (typeof u === "string" && /^\d+$/.test(u.trim()))
      u = parseInt(u.trim(), 10);
    if (u === undefined || u === null || u === "")
      return emailRaport(D.email_retea);
    if (
      typeof u !== "number" ||
      !Number.isInteger(u) ||
      !D.email_unitate[String(u)]
    )
      throw E(404, M.unitate);
    return emailRaport(D.email_unitate[String(u)]);
  }

  function hExport(data, cerere) {
    if (!nativ) throw E(404, M.negasitRuta);
    return nativ(new URL(D.export, BAZA).href, { signal: cerere.semnal });
  }

  function hLogin(data, cerere) {
    var f = new URLSearchParams(
      typeof cerere.corp === "string" ? cerere.corp : "",
    );
    var A = window.LUCA_ACCES;
    if (!A || typeof A.verifica !== "function") throw E(401, M.loginGresit);
    return A.verifica(f.get("username"), f.get("parola")).then(function (ok) {
      if (!ok || !A.intra()) throw E(401, M.loginGresit);
      return { status: "ok" };
    });
  }

  function hLogout() {
    if (window.LUCA_ACCES) window.LUCA_ACCES.iese();
    else {
      try {
        window.sessionStorage.removeItem(CHEIE_ACCES);
      } catch (e) {
        /* ignore */
      }
    }
    return { status: "ok" };
  }

  /* [method, path regex, handler, delay range ms, needs the session flag, JSON body] */
  var RUTE = [
    ["GET", /^api\/demo\/context$/, hContext, [30, 80], true],
    ["GET", /^api\/recenzii$/, hRecenzii, [60, 140], true],
    [
      "POST",
      /^api\/demo\/actualizeaza$/,
      hActualizeaza,
      [650, 950],
      true,
      false,
    ],
    ["POST", /^api\/raspuns$/, hRaspuns, [0, 0], true, true],
    ["POST", /^api\/aproba$/, hAproba, [160, 300], true, true],
    ["POST", /^api\/verificare_interna$/, hVerificare, [220, 380], true, true],
    [
      "POST",
      /^api\/verificare_interna\/confirma$/,
      hConfirma,
      [160, 300],
      true,
      true,
    ],
    ["POST", /^api\/publica$/, hPublica, [220, 380], true, true],
    ["GET", /^api\/istoric$/, hIstoric, [30, 80], true],
    ["GET", /^api\/memorie$/, hMemorie, [30, 80], true],
    ["GET", /^api\/alerte$/, hAlerte, [30, 80], true],
    ["POST", /^api\/demo\/reset$/, hReset, [200, 350], true, false],
    ["GET", /^api\/rapoarte\/retea$/, hRaportRetea, [80, 180], true],
    [
      "GET",
      /^api\/rapoarte\/unitate\/([^/]+)$/,
      hRaportUnitate,
      [80, 180],
      true,
    ],
    ["POST", /^api\/rapoarte\/email$/, hRaportEmail, [180, 320], true, true],
    ["GET", /^api\/export\.xlsx$/, hExport, [0, 0], true],
    ["POST", /^login$/, hLogin, [120, 220], false],
    ["POST", /^logout$/, hLogout, [60, 120], false],
    ["GET", /^logout$/, hLogout, [60, 120], false],
  ];

  function raspunsJson(status, corp) {
    return new Response(JSON.stringify(corp), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  function raspunsEroare(status, mesaj) {
    return raspunsJson(status, {
      status: status === 409 ? "blocat" : "eroare",
      mesaj: mesaj,
      detail: mesaj,
    });
  }

  function corpJson(brut) {
    if (brut === undefined || brut === null || brut === "") return null;
    var v;
    try {
      v = JSON.parse(String(brut));
    } catch (e) {
      throw E(422, M.cerere);
    }
    if (v === null) return null;
    if (typeof v !== "object" || Array.isArray(v)) throw E(422, M.cerere);
    return v;
  }

  async function trateaza(cale, metoda, corpBrut, semnal) {
    var potrivite = RUTE.filter(function (r) {
      return r[1].test(cale);
    });
    if (!potrivite.length) return raspunsEroare(404, M.negasitRuta);
    var ruta = potrivite.filter(function (r) {
      return r[0] === metoda;
    })[0];
    if (!ruta) return raspunsEroare(405, M.metoda);
    var cerere = { m: cale.match(ruta[1]), semnal: semnal, corp: corpBrut };
    try {
      await asteapta(intarziere(ruta[3][0], ruta[3][1]), semnal);
      if (ruta[4] && !areAcces()) throw E(401, M.login);
      var data = ruta[5] ? corpJson(corpBrut) : null;
      var rez = await ruta[2](data, cerere);
      if (rez instanceof Response) return rez;
      return raspunsJson(200, rez);
    } catch (e) {
      if (e instanceof Eroare) return raspunsEroare(e.status, e.mesaj);
      if (e && e.name === "AbortError") throw e;
      if (window.console) console.warn("[demo online] eroare neasteptata:", e);
      return raspunsEroare(500, M.neasteptat);
    }
  }

  /* The site-relative path of a request (api/..., login, logout), or null for anything else. */
  function caleSite(input) {
    var url;
    try {
      url = new URL(
        typeof input === "string"
          ? input
          : (input && input.url) || String(input),
        window.location.href,
      );
    } catch (e) {
      return null;
    }
    var fara = url.href.split("#")[0].split("?")[0];
    if (fara.indexOf(BAZA) !== 0) return null;
    var cale = fara.slice(BAZA.length);
    return /^(api\/|login$|logout$)/.test(cale) ? cale : null;
  }

  async function citesteCorp(input, init) {
    if (init && init.body !== undefined && init.body !== null) {
      var b = init.body;
      if (typeof b === "string") return b;
      if (b instanceof URLSearchParams) return b.toString();
      if (typeof FormData !== "undefined" && b instanceof FormData)
        return new URLSearchParams(b).toString();
      return String(b);
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      try {
        return await input.clone().text();
      } catch (e) {
        return "";
      }
    }
    return "";
  }

  window.fetch = async function (input, init) {
    var cale = caleSite(input);
    if (cale === null) {
      if (!nativ) throw new TypeError("fetch indisponibil");
      return nativ(input, init);
    }
    var metoda = String(
      (init && init.method) ||
        (typeof Request !== "undefined" && input instanceof Request
          ? input.method
          : "") ||
        "GET",
    ).toUpperCase();
    var semnal = (init && init.signal) || (input && input.signal) || null;
    var corp =
      metoda === "GET" || metoda === "HEAD"
        ? ""
        : await citesteCorp(input, init);
    return trateaza(cale, metoda, corp, semnal);
  };

  window.LUCA_MOCK = {
    baza: BAZA,
    build: D.build,
    stare: function () {
      return copie(S);
    },
  };
})();
