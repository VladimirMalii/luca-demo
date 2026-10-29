/* LUCA demo: approval screen ("Recenzii"). KPI strip and filters with live counters,
   review cards with the proposal flow, sensitive-review alerts, history drawer, Google preview,
   demo reset. Every action calls the local demo API; nothing is published anywhere. */
(function () {
  "use strict";

  var L = window.LUCA;
  var esc = L.esc;
  var ic = L.icon;
  /* retea.js: the network while a proposal is prepared + the model's analysis (optional layer) */
  var R = L.retea || null;
  /* memorie.js: the network's memory (approved replies become examples; optional layer) */
  var M = L.memorie || null;

  var STARI = [
    { key: "toate", label: "Toate" },
    { key: "de_tratat", label: "De tratat", title: "Recenzii încă neaprobate" },
    {
      key: "cu_raspuns",
      label: "Cu răspuns public azi",
      title: "Recenzii care au deja un răspuns public pe Google",
    },
    {
      key: "sensibile",
      label: "Sensibile",
      title: "Siguranță alimentară, igienă sau comportamentul personalului",
    },
    {
      key: "aprobate",
      label: "Aprobate",
      title: "Aprobate sau verificate intern, încă nepublicate",
    },
    {
      key: "publicate",
      label: "Publicate în demonstrație",
      title: "Aprobate; publicarea este oprită în demonstrație",
    },
  ];
  /* KPI strip: the same state filter as the segment buttons (kept in sync), colour = meaning. */
  var KPI = [
    { key: "de_tratat", label: "De tratat", cls: "k-amber", icon: "inbox" },
    { key: "sensibile", label: "Sensibile", cls: "k-red", icon: "alert" },
    {
      key: "cu_raspuns",
      label: "Cu răspuns public azi",
      cls: "k-blue",
      icon: "message",
    },
    {
      key: "aprobate",
      label: "Aprobate",
      cls: "k-green",
      icon: "check-circle",
    },
    {
      key: "publicate",
      label: "Publicate în demonstrație",
      cls: "k-dark",
      icon: "send",
    },
  ];
  var PUBLICA_DEMO =
    "Demonstrație: răspunsul nu se publică. În producție pleacă pe profilul Google al unității, după ce acordați acces.";
  /* "Pro|pu|ne|ri|le" -> the same text with soft hyphens (new paragraphs are written this way) */
  function hy(s) {
    return s.split("|").join(String.fromCharCode(173));
  }
  /* Fixed justified paragraphs, soft-hyphenated once with app/demo/silabe.py (ro). */
  var HY = {
    publica:
      "De\u00ADmon\u00ADstra\u00ADție: răs\u00ADpun\u00ADsul nu se pu\u00ADbli\u00ADcă. În pro\u00ADduc\u00ADție plea\u00ADcă pe pro\u00ADfi\u00ADlul Google al uni\u00ADtă\u00ADții, după ce acor\u00ADdați acces.",
    ledeA: "Re\u00ADcen\u00ADzii pu\u00ADbli\u00ADce Google pen\u00ADtru",
    ledeC: "cu\u00ADle\u00ADse pe",
    ledeD:
      "Re\u00ADcen\u00ADzen\u00ADții apar doar cu ini\u00ADția\u00ADle. În de\u00ADmon\u00ADstra\u00ADție nu se pu\u00ADbli\u00ADcă nimic.",
    alertA:
      "Re\u00ADcen\u00ADzi\u00ADi\u00ADle des\u00ADpre si\u00ADgu\u00ADran\u00ADța ali\u00ADmen\u00ADta\u00ADră, igie\u00ADnă sau com\u00ADpor\u00ADta\u00ADmen\u00ADtul per\u00ADso\u00ADna\u00ADlu\u00ADlui ajung la",
    alertB:
      "îna\u00ADin\u00ADte de orice răs\u00ADpuns pu\u00ADblic. Pu\u00ADblic se co\u00ADmu\u00ADni\u00ADcă doar ce s-a con\u00ADfir\u00ADmat in\u00ADtern.",
    // "|" = soft hyphen (the reset also empties the network's memory)
    reset: hy(
      "Pro|pu|ne|ri|le, apro|bă|ri|le, ve|ri|fi|că|ri|le in|ter|ne, is|to|ri|cul și me|mo|ria re|țe|lei revin la sta|rea ini|ția|lă. Re|cen|zi|i|le aduse din Google se as|cund din nou, ca la în|ce|put.",
    ),
    gcap: "Așa ar apă\u00ADrea răs\u00ADpun\u00ADsul pe Google după pu\u00ADbli\u00ADca\u00ADre. În de\u00ADmon\u00ADstra\u00ADție nu se pu\u00ADbli\u00ADcă nimic.",
    trimis: "Tri\u00ADmis la",
    debloc:
      "Pu\u00ADbli\u00ADca\u00ADrea se de\u00ADblo\u00ADchea\u00ADză după con\u00ADfir\u00ADma\u00ADrea ve\u00ADri\u00ADfi\u00ADcă\u00ADrii in\u00ADter\u00ADne.",
    conf: "Ve\u00ADri\u00ADfi\u00ADca\u00ADre in\u00ADter\u00ADnă con\u00ADfir\u00ADma\u00ADtă",
    confB: "Pu\u00ADbli\u00ADca\u00ADrea este de\u00ADblo\u00ADca\u00ADtă.",
    aprobB: "Ur\u00ADmea\u00ADză pu\u00ADbli\u00ADca\u00ADrea.",
    histEmpty:
      "Nicio ac\u00ADțiu\u00ADne încă. Aici apar pro\u00ADpu\u00ADne\u00ADri\u00ADle, apro\u00ADbă\u00ADri\u00ADle, ve\u00ADri\u00ADfi\u00ADcă\u00ADri\u00ADle in\u00ADter\u00ADne și pu\u00ADbli\u00ADcă\u00ADri\u00ADle, cu per\u00ADsoa\u00ADna și ora.",
  };
  var MSG_409 = "Acțiunea nu este disponibilă în starea curentă a recenziei.";
  var MSG_404 = "Recenzia nu mai este disponibilă. Lista a fost actualizată.";
  var PREF_DRAFT = "luca-draft:";
  var PREF_EMAIL = "luca-email:";
  /* the model's analysis per review (kept for a reload) and the page's "Ascunde analiza" choice */
  var PREF_AN = "luca-analiza:";
  var PREF_AN_ASCUNSA = "luca-analiza-ascunsa";
  var CULORI_AVATAR = [
    "#1a73e8",
    "#c5221f",
    "#188038",
    "#8430ce",
    "#b06000",
    "#007b83",
    "#5f6368",
  ];
  var ACTIUNI = {
    propunere: ["Propunere pregătită", "prop", "nodes"],
    aprobat: ["Aprobat", "ok", "check"],
    trimis_verificare: ["Trimis la verificare internă", "wait", "clock"],
    confirmat_intern: ["Verificat intern", "ok", "check"],
    publicat_demo: ["Publicat în demonstrație", "state", "send"],
  };

  var S = {
    items: [],
    byId: new Map(),
    unitati: new Map(),
    ini: new Map(),
    ctx: null,
    alerte: null,
    istoric: [],
    activ: null,
    pending: new Map(),
    drafts: new Map(),
    propuneri: new Map(),
    limbaProp: new Map(),
    emailuri: new Map(),
    trimisLocal: new Map(),
    extinse: new Set(),
    flash: new Set(),
    inaltimi: new Map(),
    analize: new Map(),
    memFol: new Map(),
    reveal: new Set(),
    anAscunsa: false,
    publicaMesaj: null,
    drawer: null,
    f: {
      unit: "",
      tara: "",
      oras: "",
      stele: new Set(),
      stare: "toate",
      tokens: [],
    },
  };

  function $(id) {
    return document.getElementById(id);
  }
  function cardEl(id) {
    return document.getElementById(L.domId(id));
  }

  /* ------------------------------------------------------------ predicates */

  function stare(it) {
    return (it && it.stare) || "de_raspuns";
  }
  function eSens(it) {
    return !!(it && (it.alerta === true || (it.sensibil && it.sensibil.flag)));
  }
  function areRaspuns(it) {
    var r = it && it.raspuns_public_actual;
    return !!(r && String(r.text || r.text_afisare || "").trim());
  }
  function faraShy(t) {
    return String(t == null ? "" : t).replace(/\u00AD/g, "");
  }
  function norm(t) {
    return faraShy(t).split(/\s+/).filter(Boolean).join(" ");
  }
  function primaMica(s) {
    s = String(s || "");
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  /* Published text, and the text sent to internal verification, can no longer change. */
  function textBlocat(it) {
    var s = stare(it);
    return (
      s === "publicat_demo" ||
      (eSens(it) && (s === "verificare_interna" || s === "verificat_intern"))
    );
  }

  function textCurent(it) {
    if (!it) return "";
    var id = it.reviewId;
    if (textBlocat(it))
      return it.raspuns || S.drafts.get(id) || it.propunere || "";
    if (S.drafts.has(id)) return S.drafts.get(id);
    return it.raspuns || it.propunere || "";
  }
  function areText(it) {
    return !!String(textCurent(it)).trim();
  }

  function inGenerare(id) {
    var p = S.pending.get(id);
    return p === "propune" || p === "regenereaza";
  }

  /* The model's analysis of the current proposal: this tab's last answer, else the list's copy. */
  function analizaPentru(it) {
    if (!R || !it) return null;
    if (S.analize.has(it.reviewId)) return S.analize.get(it.reviewId);
    return R.valideaza(it.analiza);
  }

  /* The examples from the network's memory that this proposal received: this tab's last answer,
     else the list's copy (memorie_folosita). [] = no "Din memorie" row. */
  function memorieFolosita(it) {
    if (!M || !it) return [];
    if (S.memFol.has(it.reviewId)) return S.memFol.get(it.reviewId);
    return M.folosite(it.memorie_folosita);
  }

  /* Topics of the review's current analysis: the scoring prefers examples that share one. */
  function temeAnaliza(it) {
    var an = analizaPentru(it);
    return an
      ? an.subiecte.map(function (s) {
          return s.tema;
        })
      : [];
  }

  /* Shown next to a proposal only (never while a new one is being prepared). */
  function analizaAfisata(it) {
    if (!it || inGenerare(it.reviewId)) return null;
    if (stare(it) === "de_raspuns" && !areText(it)) return null;
    return analizaPentru(it);
  }

  function textAfisat(it) {
    return String(it.comment_afisare || it.comment || "").trim();
  }

  function potrivesteStare(it, k) {
    var s = stare(it);
    switch (k) {
      case "de_tratat":
        return (
          s === "de_raspuns" || s === "propunere" || s === "verificare_interna"
        );
      case "cu_raspuns":
        return areRaspuns(it);
      case "sensibile":
        return eSens(it);
      case "aprobate":
        return s === "aprobat" || s === "verificat_intern";
      case "publicate":
        return s === "publicat_demo";
      default:
        return true;
    }
  }

  function potrivesteRest(it) {
    var f = S.f;
    if (f.unit && String(it.unit_id) !== f.unit) return false;
    if (f.tara && it.tara !== f.tara) return false;
    if (f.oras && it.oras !== f.oras) return false;
    if (f.stele.size && !f.stele.has(Number(it.stele))) return false;
    if (f.tokens.length) {
      var r = it.raspuns_public_actual || {};
      var fan = L.fold(
        [
          it.comment,
          r.text,
          it.unitate,
          it.oras,
          it.reviewer,
          textCurent(it),
        ].join(" \n "),
      );
      for (var i = 0; i < f.tokens.length; i++) {
        if (fan.indexOf(f.tokens[i]) === -1) return false;
      }
    }
    return true;
  }

  function filtrate() {
    return S.items.filter(function (it) {
      return potrivesteRest(it) && potrivesteStare(it, S.f.stare);
    });
  }

  /* ------------------------------------------------------------------ data */

  function ordoneaza(arr) {
    var noi = [];
    var rest = [];
    arr.forEach(function (x) {
      (x.noua ? noi : rest).push(x);
    });
    return noi.concat(rest);
  }

  function seteazaItems(arr) {
    S.items = ordoneaza(arr);
    S.byId = new Map(
      S.items.map(function (x) {
        return [x.reviewId, x];
      }),
    );
  }

  async function incarcaRecenzii() {
    var r = await L.api("api/recenzii");
    var lista = r.ok ? L.asList(r.data, ["recenzii", "items"]) : null;
    if (!lista) {
      var e = new Error("date");
      e.kind = "date";
      throw e;
    }
    seteazaItems(lista);
  }

  async function sincronizeaza() {
    try {
      await incarcaRecenzii();
      return true;
    } catch (e) {
      return false;
    }
  }

  function unitatiLista() {
    if (S.unitati.size) return Array.from(S.unitati.values());
    var m = new Map();
    S.items.forEach(function (it) {
      var k = String(it.unit_id);
      if (!m.has(k))
        m.set(k, {
          id: it.unit_id,
          title: it.unitate,
          oras: it.oras,
          tara: it.tara,
          address: it.address,
        });
    });
    return Array.from(m.values());
  }

  function unic(arr) {
    var vazut = new Set();
    return arr.filter(function (x) {
      if (!x || vazut.has(x)) return false;
      vazut.add(x);
      return true;
    });
  }

  function locText(it) {
    return [it.oras, L.taraNume(it.tara)].filter(Boolean).join(", ");
  }

  function ini(id) {
    return S.ini.get(String(id)) || "?";
  }

  /* Unit id from a unit name (memorie_folosita carries the name only), else null. */
  function unitDupaNume(nume) {
    var n = L.fold(String(nume || "").trim());
    if (!n) return null;
    var u = unitatiLista().filter(function (x) {
      return L.fold(x.title) === n;
    })[0];
    return u ? u.id : null;
  }

  function culoareAvatar(s) {
    var h = 0;
    s = String(s || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return CULORI_AVATAR[h % CULORI_AVATAR.length];
  }

  function listaRo(a) {
    if (a.length < 2) return a.join("");
    return a.slice(0, -1).join(", ") + " și " + a[a.length - 1];
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, ms);
    };
  }

  function rolDesemnat() {
    var p = S.ctx && S.ctx.persoana_desemnata;
    var rol = p && p.rol ? String(p.rol) : "Persoana desemnată LUCA";
    return primaMica(rol);
  }

  function mesajPublicare() {
    return !S.publicaMesaj || norm(S.publicaMesaj) === norm(PUBLICA_DEMO)
      ? HY.publica
      : S.publicaMesaj;
  }

  /* --------------------------------------- per-tab memory (sessionStorage) */

  /* Unapproved edits survive a reload (the server keeps proposals, not keystrokes). */
  function salveazaDraft(id, text) {
    L.ssSet(PREF_DRAFT + id, text);
  }
  function uitaDraft(id) {
    L.ssDel(PREF_DRAFT + id);
  }
  /* After a successful send the server holds the text: drop the copy unless the user kept typing. */
  function uitaDraftDacaTrimis(id, trimis) {
    var d = S.drafts.get(id);
    if (d === undefined || norm(d) === norm(trimis)) uitaDraft(id);
  }

  function restaureazaLocal() {
    S.items.forEach(function (it) {
      var id = it.reviewId;
      var d = L.ssGet(PREF_DRAFT + id);
      if (d !== null) {
        if (!textBlocat(it) && it.propunere && stare(it) !== "de_raspuns")
          S.drafts.set(id, d);
        else uitaDraft(id);
      }
      var e = L.ssGet(PREF_EMAIL + id);
      if (e !== null) {
        var em = null;
        if (stare(it) === "verificare_interna") {
          try {
            em = JSON.parse(e);
          } catch (x) {
            em = null;
          }
        }
        if (em && typeof em === "object") S.emailuri.set(id, em);
        else L.ssDel(PREF_EMAIL + id);
      }
      // The list's own "analiza" wins; this tab's copy only fills in when the field is absent.
      var a = L.ssGet(PREF_AN + id);
      if (a === null) return;
      var an = null;
      if (
        R &&
        !Object.prototype.hasOwnProperty.call(it, "analiza") &&
        (it.propunere || stare(it) !== "de_raspuns")
      ) {
        try {
          an = R.valideaza(JSON.parse(a));
        } catch (x) {
          an = null;
        }
      }
      if (an) S.analize.set(id, an);
      else L.ssDel(PREF_AN + id);
    });
  }

  /* "Ascunde analiza" / "Arată analiza": one choice for the page, kept for this tab. */
  function aplicaVizibilitateAnaliza() {
    var lista = $("lista");
    lista.classList.toggle("an-off", S.anAscunsa);
    Array.prototype.forEach.call(
      lista.querySelectorAll("[data-an-toggle]"),
      function (b) {
        b.textContent = S.anAscunsa ? "Arată analiza" : "Ascunde analiza";
        b.setAttribute("aria-expanded", String(!S.anAscunsa));
      },
    );
  }

  function comutaAnaliza() {
    S.anAscunsa = !S.anAscunsa;
    if (S.anAscunsa) L.ssSet(PREF_AN_ASCUNSA, "1");
    else L.ssDel(PREF_AN_ASCUNSA);
    aplicaVizibilitateAnaliza();
    if (R) R.legaToate($("lista"));
  }

  /* ----------------------------------------------------------- card markup */

  function cardHtml(it) {
    var id = it.reviewId;
    var did = L.domId(id);
    var sens = eSens(it);
    var lim = String(it.limba || "").toLowerCase();
    var cls =
      "card rev-card " +
      L.bandaNota(it.stele) +
      (sens ? " is-sens" : "") +
      (S.activ === id ? " is-active" : "") +
      (S.flash.has(id) ? " flash" : "") +
      (S.reveal.has(id) ? " is-reveal" : "") +
      // wider gutter for the connector lines; kept while regenerating (no reflow of the text)
      (analizaPentru(it) && (inGenerare(id) || analizaAfisata(it))
        ? " has-an"
        : "");
    return (
      '<article class="' +
      cls +
      '" id="' +
      did +
      '" data-id="' +
      esc(id) +
      '" tabindex="-1" aria-labelledby="' +
      did +
      '-h">' +
      (sens ? sensHtml(it) : "") +
      '<header class="rev-head">' +
      L.avatarUnitate(it.unit_id, ini(it.unit_id)) +
      '<div class="rev-who">' +
      '<h3 class="rev-unit" id="' +
      did +
      '-h">' +
      esc(it.unitate || "Unitate") +
      '<span class="rev-place"> · ' +
      esc(locText(it)) +
      "</span></h3>" +
      '<div class="rev-meta">' +
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
      "</div></div>" +
      '<div class="rev-badges">' +
      badgeuri(it) +
      "</div>" +
      "</header>" +
      '<div class="rev-grid"><div class="rev-col">' +
      textHtml(it, did) +
      publicHtml(it, did) +
      "</div>" +
      propHtml(it, did) +
      "</div>" +
      "</article>"
    );
  }

  function cuOra(text, iso) {
    var o = L.ora(iso);
    return o ? text + " la " + o : text;
  }

  function oraTrimis(it) {
    return L.ora(it.trimis_la) || S.trimisLocal.get(it.reviewId) || "";
  }

  function badgeuri(it) {
    var s = stare(it);
    var out = [];
    if (it.noua) out.push('<span class="badge new">Nouă</span>');
    if (s === "propunere")
      out.push('<span class="badge prop">Propunere pregătită</span>');
    else if (s === "aprobat")
      out.push(
        '<span class="badge ok">' +
          ic("check") +
          esc(cuOra("Aprobat", it.aprobat_la)) +
          "</span>",
      );
    else if (s === "verificare_interna") {
      var o = oraTrimis(it);
      out.push(
        '<span class="badge wait">' +
          ic("clock") +
          "La verificare internă" +
          (o ? " · trimis la " + esc(o) : "") +
          "</span>",
      );
    } else if (s === "verificat_intern")
      out.push(
        '<span class="badge ok">' +
          ic("check") +
          esc(cuOra("Verificat intern", it.confirmat_la)) +
          "</span>",
      );
    else if (s === "publicat_demo")
      out.push(
        '<span class="badge state">Aprobat · publicare oprită în demonstrație</span>',
      );
    return out.join("");
  }

  /* Sensitive: light red strip across the top of the card, the category and the reason. */
  function sensHtml(it) {
    var c = it.sensibil || {};
    var cat = L.categorieNume(c.categorie);
    var motiv = L.motivScurt(c.motiv);
    return (
      '<div class="sens-head">' +
      ic("alert") +
      '<div class="sens-txt"><span class="sens-cat">' +
      esc(cat ? "Sensibilă · " + cat : "Recenzie sensibilă") +
      "</span>" +
      (motiv ? '<span class="sens-motiv">' + esc(motiv) + "</span>" : "") +
      "</div></div>"
    );
  }

  function maiMultBtn(tid, extins) {
    return (
      '<button type="button" class="btn link sm more" data-more="' +
      tid +
      '" aria-controls="' +
      tid +
      '" aria-expanded="' +
      extins +
      '"' +
      (extins ? "" : " hidden") +
      ">" +
      (extins ? "Mai puțin" : "Mai mult") +
      "</button>"
    );
  }

  function textHtml(it, did) {
    var t = textAfisat(it);
    if (!t)
      return '<p class="rev-empty-text">Recenzie fără text, doar cu notă.</p>';
    var tid = did + "-txt";
    var ext = S.extinse.has(tid);
    var an = analizaAfisata(it);
    // The phrases the model cited, highlighted in place (same justified paragraph).
    var corp =
      an && an.fragmente.length ? R.evidentiaza(t, an.fragmente) : esc(t);
    return (
      '<p class="rev-text just' +
      (ext ? "" : " clamp") +
      '" id="' +
      tid +
      '" lang="' +
      esc(L.langAttr(it.limba)) +
      '" data-clamp>' +
      corp +
      "</p>" +
      maiMultBtn(tid, ext)
    );
  }

  function publicHtml(it, did) {
    if (!areRaspuns(it))
      return '<div class="today none"><p class="today-none">Fără răspuns public azi.</p></div>';
    var r = it.raspuns_public_actual;
    var tid = did + "-pub";
    var ext = S.extinse.has(tid);
    var lang = r.limba
      ? L.langAttr(r.limba)
      : it.tara === "RO"
        ? "ro"
        : L.langAttr(it.limba);
    return (
      '<div class="today"><div class="today-h">' +
      ic("message") +
      "<span>Răspunsul public de azi" +
      (r.data_relativa
        ? '<span class="today-when">, publicat ' +
          esc(r.data_relativa) +
          "</span>"
        : "") +
      "</span></div>" +
      '<p class="today-t just' +
      (ext ? "" : " clamp") +
      '" id="' +
      tid +
      '" lang="' +
      esc(lang) +
      '" data-clamp>' +
      esc(String(r.text_afisare || r.text).trim()) +
      "</p>" +
      maiMultBtn(tid, ext) +
      "</div>"
    );
  }

  function linii() {
    return ["94%", "100%", "97%", "88%", "62%"]
      .map(function (w) {
        return (
          '<span class="skel-line" aria-hidden="true" style="width:' +
          w +
          '"></span>'
        );
      })
      .join("");
  }

  function propHtml(it, did) {
    var id = it.reviewId;
    var s = stare(it);
    var sens = eSens(it);
    var p = S.pending.get(id);
    var generare = p === "propune" || p === "regenereaza";
    var text = textCurent(it);
    var cuText = !!String(text).trim();
    var arie;
    var reveal = S.reveal.has(id);
    if (generare && R) {
      // The network while the model works; on Regenerează it keeps the old panel's height.
      arie = R.htmlRetea(it, { inaltime: S.inaltimi.get(id) || 0 });
    } else if (generare) {
      // First proposal on a 1-3 star review is long: reserve its height up front (no jump).
      var h = S.inaltimi.get(id) || (Number(it.stele) <= 3 ? 230 : 0);
      arie =
        '<div class="prop-skel"' +
        (h ? ' style="min-height:' + h + 'px"' : "") +
        ">" +
        '<p class="prop-skel-h" role="status">' +
        ic("nodes") +
        "Se pregătește propunerea…</p>" +
        linii() +
        "</div>";
    } else if (cuText || s !== "de_raspuns") {
      // Read-only only when the text is locked; a pending action keeps the buttons disabled instead.
      arie =
        '<textarea class="prop-text' +
        (reveal ? " is-reveal" : "") +
        '" id="' +
        did +
        '-t" lang="' +
        esc(L.langAttr(S.limbaProp.get(id) || it.limba)) +
        '" spellcheck="false" aria-labelledby="' +
        did +
        '-pt"' +
        (textBlocat(it) ? " readonly" : "") +
        ">" +
        esc(text) +
        "</textarea>";
    } else {
      arie =
        '<div class="prop-empty">' +
        (sens
          ? "Recenzie sensibilă: propunerea trece prin verificarea internă înainte de orice răspuns public."
          : "Propunerea apare aici, în limba recenziei. O puteți edita înainte de aprobare.") +
        "</div>";
    }
    var baza = S.propuneri.get(id) || it.propunere || "";
    var editata =
      cuText &&
      !generare &&
      ((baza && norm(text) !== norm(baza)) ||
        (!S.drafts.has(id) && it.editat_manual === true));
    var lim = S.limbaProp.get(id) || it.limba;
    var meta =
      '<span class="prop-meta"><span class="prop-edited"' +
      (editata ? "" : " hidden") +
      ">" +
      ic("pencil") +
      "Editată manual</span>" +
      (lim
        ? "<span>în limba recenziei: " + esc(L.limbaNume(lim)) + "</span>"
        : "") +
      "</span>";
    // "Ce a înțeles sistemul": the model's reading of the review, above the proposal it explains.
    var an = analizaAfisata(it);
    var bloc = an
      ? R.htmlAnaliza(an, {
          did: did,
          ascunsa: S.anAscunsa,
          reveal: reveal,
          limba: it.limba,
          marcate: R.numarPotriviri(textAfisat(it), an.fragmente) > 0,
          memorie: M ? M.tokeni(memorieFolosita(it)) : [],
        })
      : "";
    return (
      '<div class="prop">' +
      '<div class="prop-head"><span class="prop-title" id="' +
      did +
      '-pt">' +
      ic("nodes") +
      'Propunerea sistemului<span class="chip-ai">AI</span></span>' +
      meta +
      "</div>" +
      bloc +
      '<div class="prop-area">' +
      arie +
      "</div>" +
      '<div class="prop-actions">' +
      butoane(it, did) +
      "</div>" +
      nota(it, did) +
      "</div>"
    );
  }

  /* Only the active card shows the amber "Publică", and only when publishing is the next step. */
  function clsPublica(it, activ) {
    var s = stare(it);
    return activ && (s === "aprobat" || s === "verificat_intern")
      ? "brand"
      : "ghost";
  }

  function butoane(it, did) {
    var id = it.reviewId;
    var s = stare(it);
    var sens = eSens(it);
    var p = S.pending.get(id);
    var ocupat = !!p;
    var activ = S.activ === id;
    var out = [];
    // Busy: the label stays (hidden) so the button keeps its width; the spinner sits on top.
    function b(act, eticheta, cls, eticOcupat, icon) {
      var acum = p === act;
      return (
        '<button type="button" class="btn ' +
        cls +
        (acum ? " is-busy" : "") +
        '" data-act="' +
        act +
        '"' +
        (ocupat ? " disabled" : "") +
        (acum ? ' aria-busy="true"' : "") +
        '><span class="btn-l">' +
        (icon ? ic(icon) : "") +
        esc(eticheta) +
        "</span>" +
        (acum
          ? '<span class="spin" aria-hidden="true"></span><span class="sr-only">' +
            esc(eticOcupat || eticheta) +
            "</span>"
          : "") +
        "</button>"
      );
    }
    if (s === "publicat_demo")
      return (
        '<span class="prop-done">' +
        ic("check-circle") +
        esc(cuOra("Publicat în demonstrație", it.publicat_la)) +
        "</span>" +
        b("preview", "Previzualizează pe Google", "link", null, "eye")
      );
    if (s === "de_raspuns" && !areText(it))
      return b(
        "propune",
        "Propune răspuns",
        "outline",
        "Se pregătește propunerea…",
        "nodes",
      );

    if (!sens) {
      if (s === "aprobat") {
        out.push(
          b("publica", "Publică", clsPublica(it, activ), "Se publică…", "send"),
        );
      } else {
        out.push(b("aproba", "Aprobă", "blue", "Se aprobă…", "check"));
        out.push(
          b("publica", "Publică", clsPublica(it, activ), "Se publică…", "send"),
        );
      }
    } else if (s === "verificat_intern") {
      out.push(
        b("publica", "Publică", clsPublica(it, activ), "Se publică…", "send"),
      );
    } else {
      if (s === "verificare_interna")
        out.push(
          b(
            "confirma",
            "Marchează verificat intern",
            "blue",
            "Se confirmă…",
            "check",
          ),
        );
      else
        out.push(
          b(
            "verificare",
            "Trimite la verificare internă",
            "blue",
            "Se trimite…",
            "mail",
          ),
        );
      out.push(
        '<button type="button" class="btn ghost" data-act="publica" data-blocat disabled aria-describedby="' +
          did +
          '-lock"><span class="btn-l">' +
          ic("lock") +
          "Publică</span></button>",
      );
    }
    out.push(b("preview", "Previzualizează pe Google", "link", null, "eye"));
    if (s === "propunere" || s === "aprobat" || s === "de_raspuns") {
      out.push(
        b(
          "regenereaza",
          "Regenerează",
          "ghost",
          "Se pregătește propunerea…",
          "refresh",
        ),
      );
    }
    if (s === "verificare_interna" && S.emailuri.has(id))
      out.push(b("email", "Vezi e-mailul", "link", null, "mail"));
    return out.join("");
  }

  function nota(it, did) {
    var s = stare(it);
    if (eSens(it)) {
      if (s === "verificare_interna") {
        return (
          '<p class="prop-note just" id="' +
          did +
          '-lock">' +
          esc(HY.trimis) +
          " " +
          esc(L.shy(rolDesemnat())) +
          ". " +
          esc(HY.debloc) +
          "</p>"
        );
      }
      if (s === "propunere" || (s === "de_raspuns" && areText(it))) {
        return (
          '<p class="prop-note just" id="' +
          did +
          '-lock">' +
          esc(HY.debloc) +
          "</p>"
        );
      }
    }
    if (s === "publicat_demo")
      return '<p class="prop-note info just">' + esc(mesajPublicare()) + "</p>";
    if (s === "verificat_intern") {
      return (
        '<p class="prop-note just">' +
        esc(HY.conf) +
        (it.confirmat_de
          ? " de " + esc(L.shy(primaMica(it.confirmat_de)))
          : "") +
        ". " +
        esc(HY.confB) +
        "</p>"
      );
    }
    if (s === "aprobat" && it.aprobat_de)
      return (
        '<p class="prop-note just">Aprobat de ' +
        esc(it.aprobat_de) +
        ". " +
        esc(HY.aprobB) +
        "</p>"
      );
    return "";
  }

  /* ------------------------------------------------------------- rendering */

  /* Grow textareas to their content; keep the page where it was (no jump while typing). */
  function autoInaltime(tas) {
    tas = Array.prototype.slice.call(tas);
    if (!tas.length) return;
    var x = window.scrollX;
    var y = window.scrollY;
    tas.forEach(function (ta) {
      ta.style.height = "auto";
    });
    var h = tas.map(function (ta) {
      return ta.scrollHeight;
    });
    tas.forEach(function (ta, i) {
      ta.style.height = h[i] + 2 + "px";
    });
    if (window.scrollY !== y || window.scrollX !== x) window.scrollTo(x, y);
  }

  /* Show "Mai mult" only where the clamped text really overflows (all reads first, then writes). */
  function verificaClamp(root) {
    var els = Array.prototype.slice.call(root.querySelectorAll("[data-clamp]"));
    var masuri = els.map(function (el) {
      return S.extinse.has(el.id)
        ? true
        : el.scrollHeight > el.clientHeight + 2;
    });
    els.forEach(function (el, i) {
      var b = root.querySelector('[data-more="' + el.id + '"]');
      if (b) b.hidden = !masuri[i];
    });
  }

  /* Re-measure after a resize or once the web font has loaded (line breaks change). */
  function remasoara() {
    var lista = $("lista");
    if (!lista) return;
    autoInaltime(lista.querySelectorAll(".prop-text"));
    verificaClamp(lista);
    if (R) {
      R.monteaza(lista);
      R.legaToate(lista);
    }
  }

  /* Network edges and connector lines are measured on the laid-out card; the first render after
     an answer plays the reveal once (rows, highlights, lines, text), later renders are static. */
  function legaturi(c) {
    if (!R) return;
    var id = c.dataset.id;
    var reveal = S.reveal.has(id);
    S.reveal.delete(id);
    try {
      R.monteaza(c);
      R.leaga(c, { anim: reveal });
    } catch (x) {
      /* edges and lines are decoration: a measuring failure never blocks the card */
    }
    if (!reveal) return;
    setTimeout(function () {
      var el = cardEl(id);
      if (!el) return;
      el.classList.remove("is-reveal");
      Array.prototype.forEach.call(
        el.querySelectorAll(".is-reveal, .an-links.is-anim"),
        function (x) {
          x.classList.remove("is-reveal", "is-anim");
        },
      );
    }, 2600);
  }

  function dupaRender(cards, root) {
    var tas = [];
    cards.forEach(function (c) {
      var ta = c.querySelector(".prop-text");
      if (ta) tas.push(ta);
    });
    autoInaltime(tas);
    verificaClamp(root);
    cards.forEach(legaturi);
    cards.forEach(function (c) {
      var id = c.dataset.id;
      if (!S.flash.has(id)) return;
      setTimeout(function () {
        S.flash.delete(id);
        var el = cardEl(id);
        if (el) el.classList.remove("flash");
      }, 3000);
    });
  }

  /* "12 din 50 de recenzii" under the filters: shared by the list and the counters. */
  function actualizeazaContor() {
    var total = S.items.length;
    var n = filtrate().length;
    $("fCount").textContent =
      n === total
        ? L.nr(total, "recenzie", "recenzii")
        : n + " din " + L.nr(total, "recenzie", "recenzii");
  }

  function renderNumaratori() {
    var baza = S.items.filter(potrivesteRest);
    var numar = {};
    STARI.forEach(function (s) {
      numar[s.key] = baza.filter(function (it) {
        return potrivesteStare(it, s.key);
      }).length;
      var b = $("fStare").querySelector('[data-stare="' + s.key + '"]');
      if (!b) return;
      b.querySelector(".n").textContent = numar[s.key];
      b.setAttribute("aria-pressed", String(S.f.stare === s.key));
      if (s.key === "sensibile")
        b.classList.toggle("has-sens", numar[s.key] > 0);
    });
    KPI.forEach(function (k) {
      var t = $("kpis").querySelector('[data-stare="' + k.key + '"]');
      if (!t) return;
      var n = numar[k.key] || 0;
      t.querySelector(".kpi-v").textContent = n;
      t.setAttribute("aria-pressed", String(S.f.stare === k.key));
      t.classList.toggle("has-n", n > 0);
    });
    actualizeazaContor();
  }

  function renderLista() {
    var lista = $("lista");
    var arr = filtrate();
    lista.setAttribute("aria-busy", "false");
    actualizeazaContor();
    if (!arr.length) {
      lista.innerHTML =
        '<div class="card empty"><p>Nicio recenzie pentru filtrele alese.</p>' +
        '<button type="button" class="btn ghost" data-clear>Șterge filtrele</button></div>';
      return;
    }
    lista.innerHTML = arr.map(cardHtml).join("");
    dupaRender(
      Array.prototype.slice.call(lista.querySelectorAll(".rev-card")),
      lista,
    );
  }

  function aplicaFiltre() {
    renderNumaratori();
    renderLista();
    var f = S.f;
    $("fClear").hidden = !(
      f.unit ||
      f.tara ||
      f.oras ||
      f.stele.size ||
      f.tokens.length ||
      f.stare !== "toate"
    );
  }

  function focuseaza(card, tinta) {
    if (!card) return;
    var el = null;
    if (tinta === "text") el = card.querySelector(".prop-text:not([readonly])");
    else if (tinta)
      el = card.querySelector(
        'button[data-act="' + tinta + '"]:not([disabled])',
      );
    if (!el)
      el = card.querySelector(".prop-actions button:not([disabled])") || card;
    el.focus({ preventScroll: true });
  }

  /* Re-render one card in place. Focus moves only if it was inside the card (or lost). */
  function randeazaCard(id, o) {
    o = o || {};
    var it = S.byId.get(id);
    var vechi = cardEl(id);
    if (!it || !vechi) return null;
    var ae = document.activeElement;
    var aveaFocus = vechi.contains(ae);
    var pierdut = !ae || ae === document.body;
    var tmp = document.createElement("div");
    tmp.innerHTML = cardHtml(it);
    var nou = tmp.firstElementChild;
    vechi.replaceWith(nou);
    dupaRender([nou], nou);
    if (o.pastreaza) {
      if (aveaFocus) nou.focus({ preventScroll: true });
    } else if (o.focus && (aveaFocus || pierdut || ae === nou)) {
      focuseaza(nou, o.focus);
    }
    return nou;
  }

  function seteazaActiv(id) {
    if (S.activ === id) return;
    var vechi = S.activ;
    S.activ = id;
    [vechi, id].forEach(function (x) {
      if (!x) return;
      var card = cardEl(x);
      var it = S.byId.get(x);
      if (!card || !it) return;
      card.classList.toggle("is-active", x === id);
      var pb = card.querySelector(
        'button[data-act="publica"]:not([data-blocat])',
      );
      if (pb) {
        pb.classList.remove("brand", "ghost");
        pb.classList.add(clsPublica(it, x === id));
      }
    });
  }

  /* --------------------------------------------------------------- filters */

  function actualizeazaOrase() {
    var orase = unic(
      unitatiLista()
        .filter(function (u) {
          return !S.f.tara || u.tara === S.f.tara;
        })
        .map(function (u) {
          return u.oras;
        }),
    );
    if (S.f.oras && orase.indexOf(S.f.oras) === -1) S.f.oras = "";
    $("fOras").innerHTML =
      '<option value="">Toate orașele</option>' +
      orase
        .map(function (o) {
          return (
            '<option value="' +
            esc(o) +
            '"' +
            (o === S.f.oras ? " selected" : "") +
            ">" +
            esc(o) +
            "</option>"
          );
        })
        .join("");
  }

  function actualizeazaUnitati() {
    var lista = unitatiLista().filter(function (u) {
      return (
        (!S.f.tara || u.tara === S.f.tara) && (!S.f.oras || u.oras === S.f.oras)
      );
    });
    if (
      S.f.unit &&
      !lista.some(function (u) {
        return String(u.id) === S.f.unit;
      })
    )
      S.f.unit = "";
    $("fUnit").innerHTML =
      '<option value="">Toate unitățile (' +
      lista.length +
      ")</option>" +
      lista
        .map(function (u) {
          return (
            '<option value="' +
            esc(u.id) +
            '"' +
            (String(u.id) === S.f.unit ? " selected" : "") +
            ">" +
            esc(u.title) +
            (u.oras ? " · " + esc(u.oras) : "") +
            "</option>"
          );
        })
        .join("");
  }

  function construiesteKpi() {
    var box = $("kpis");
    box.innerHTML = KPI.map(function (k) {
      var s =
        STARI.filter(function (x) {
          return x.key === k.key;
        })[0] || {};
      // Label first in the DOM (accessible name "De tratat 12"); the grid shows the figure on top.
      return (
        '<button type="button" class="kpi ' +
        k.cls +
        '" data-stare="' +
        k.key +
        '" aria-pressed="false"' +
        (s.title ? ' title="' + esc(s.title) + '"' : "") +
        '><span class="kpi-k">' +
        esc(k.label) +
        '</span><span class="kpi-v">0</span><span class="kpi-ic" aria-hidden="true">' +
        ic(k.icon) +
        "</span></button>"
      );
    }).join("");
    box.setAttribute("aria-busy", "false");
  }

  function construiesteFiltre() {
    var tari = unic(
      unitatiLista().map(function (u) {
        return u.tara;
      }),
    );
    $("fTara").innerHTML =
      '<option value="">Toate țările</option>' +
      tari
        .map(function (t) {
          return (
            '<option value="' + esc(t) + '">' + esc(L.taraNume(t)) + "</option>"
          );
        })
        .join("");
    actualizeazaOrase();
    actualizeazaUnitati();
    $("fStare").innerHTML = STARI.map(function (s) {
      return (
        '<button type="button" class="seg-b" data-stare="' +
        s.key +
        '" aria-pressed="' +
        (s.key === S.f.stare) +
        '"' +
        (s.title ? ' title="' + esc(s.title) + '"' : "") +
        ">" +
        esc(s.label) +
        '<span class="n">0</span></button>'
      );
    }).join("");
    construiesteKpi();
  }

  function reseteazaFiltre() {
    S.f.unit = "";
    S.f.tara = "";
    S.f.oras = "";
    S.f.stele.clear();
    S.f.stare = "toate";
    S.f.tokens = [];
    $("fTara").value = "";
    $("fText").value = "";
    actualizeazaOrase();
    actualizeazaUnitati();
    Array.prototype.forEach.call(
      document.querySelectorAll(".tg"),
      function (b) {
        b.setAttribute("aria-pressed", "false");
      },
    );
    aplicaFiltre();
  }

  /* --------------------------------------------------------------- actions */

  function dupaActiune() {
    renderNumaratori();
    reimprospateazaAlerte();
    reimprospateazaIstoric();
  }

  /* The review vanished (404) or changed state elsewhere (409): reload the list, keep focus near. */
  async function reiaDupaConflict(id, act) {
    await sincronizeaza();
    aplicaFiltre();
    var c = cardEl(id);
    if (c) focuseaza(c, act);
    reimprospateazaAlerte();
    reimprospateazaIstoric();
  }

  async function propune(id, regen) {
    var it = S.byId.get(id);
    if (!it || S.pending.has(id)) return;
    var corp = { reviewId: id };
    if (regen) {
      var anterior = faraShy(textCurent(it)).trim();
      if (anterior) corp.anterior = anterior;
      // The network keeps the old panel's height (analysis + text): the page does not jump.
      var rez = R ? R.inaltimeRezervata(cardEl(id)) : 0;
      var ta = $(L.domId(id) + "-t");
      if (rez) S.inaltimi.set(id, rez);
      else if (ta) S.inaltimi.set(id, ta.offsetHeight);
    } else {
      S.inaltimi.delete(id);
    }
    var act = regen ? "regenereaza" : "propune";
    // the examples the server will likely pick (its own scoring), drawn by the network meanwhile
    var probabile = M && R ? M.tokeni(M.probabile(it, temeAnaliza(it))) : [];
    S.pending.set(id, act);
    if (R) R.incepe(id, { regen: regen, memorie: probabile });
    randeazaCard(id, { pastreaza: true });
    var r;
    try {
      r = await L.api("api/raspuns", {
        method: "POST",
        body: corp,
        timeoutMs: 60000,
      });
    } catch (e) {
      if (R && e.kind !== "auth") await R.asteapta(id, true);
      S.pending.delete(id);
      if (R) R.termina(id);
      if (e.kind === "auth") return;
      randeazaCard(id, { focus: act });
      L.toast(
        e.kind === "timp"
          ? "Propunerea nu a sosit la timp. Încercați din nou."
          : L.mesajEroare(e),
        "err",
      );
      return;
    }
    var d = r.data || {};
    if (r.ok && typeof d.raspuns === "string" && d.raspuns.trim()) {
      // Values come from the model only; null analysis = no block, no highlights (as before).
      var an = R ? R.valideaza(d.analiza) : null;
      S.drafts.set(id, d.raspuns);
      uitaDraft(id);
      S.propuneri.set(id, d.raspuns);
      if (d.limba) S.limbaProp.set(id, d.limba);
      S.analize.set(id, an);
      if (an) L.ssSet(PREF_AN + id, JSON.stringify(an));
      else L.ssDel(PREF_AN + id);
      // the examples the model really received (older server: no field, no "Din memorie" row)
      var folosite = M ? M.folosite(d.memorie_folosita) : [];
      S.memFol.set(id, folosite);
      it.propunere = d.raspuns;
      it.raspuns = null;
      it.stare = d.stare || "propunere";
      var sync = sincronizeaza(); // the list refresh runs while the network settles
      if (R) {
        try {
          await R.asteapta(id);
          if (an)
            await R.aseaza(id, an, {
              limba: d.limba || it.limba,
              memorie:
                M && Array.isArray(d.memorie_folosita)
                  ? M.tokeni(folosite)
                  : null,
            });
          await R.iese(id);
        } catch (x) {
          /* the network is decoration: a failure there never holds the proposal back */
        }
      }
      await sync;
      S.pending.delete(id);
      if (R) R.termina(id);
      // The reveal plays for a new analysis only; without one the text shows at once, as before.
      if (R && an) S.reveal.add(id);
      randeazaCard(id, { focus: "text" });
      dupaActiune();
      return;
    }
    if (R) await R.asteapta(id, true);
    S.pending.delete(id);
    if (R) R.termina(id);
    if (r.status === 404 || r.status === 409) {
      await reiaDupaConflict(id, act);
      L.toast(
        L.mesajDin(d) || (r.status === 404 ? MSG_404 : MSG_409),
        "info",
        9000,
      );
      return;
    }
    randeazaCard(id, { focus: act });
    L.toast(
      L.mesajDin(d) || "Propunerea nu a putut fi pregătită. Încercați din nou.",
      "err",
    );
  }

  async function ruleaza(id, act, cale, corp, laSucces) {
    if (S.pending.has(id)) return null;
    S.pending.set(id, act);
    randeazaCard(id, { pastreaza: true });
    var r;
    try {
      r = await L.api(cale, { method: "POST", body: corp, timeoutMs: 30000 });
    } catch (e) {
      S.pending.delete(id);
      if (e.kind === "auth") return null;
      randeazaCard(id, { focus: act });
      L.toast(L.mesajEroare(e), "err");
      return null;
    }
    S.pending.delete(id);
    var d = r.data || {};
    if (r.ok) {
      var urmator = laSucces(d);
      await sincronizeaza();
      randeazaCard(id, { focus: urmator });
      dupaActiune();
      return d;
    }
    if (r.status === 404) {
      await reiaDupaConflict(id, act);
      L.toast(L.mesajDin(d) || MSG_404, "info", 9000);
      return null;
    }
    if (r.status === 409) {
      await sincronizeaza();
      randeazaCard(id, { focus: act });
      dupaActiune();
      L.toast(L.mesajDin(d) || MSG_409, "info", 9000);
      return null;
    }
    randeazaCard(id, { focus: act });
    L.toast(L.mesajDin(d) || "Acțiunea nu a reușit. Încercați din nou.", "err");
    return null;
  }

  /* Text sent to the API: never the soft hyphens used for display. */
  function textPentru(id, ceFel) {
    var it = S.byId.get(id);
    var text = faraShy(textCurent(it)).trim();
    if (!text) {
      L.toast(
        "Scrieți sau propuneți un răspuns înainte de " + ceFel + ".",
        "warn",
      );
      focuseaza(cardEl(id), "text");
      return null;
    }
    return text;
  }

  function aproba(id) {
    var text = textPentru(id, "aprobare");
    if (text === null) return;
    ruleaza(
      id,
      "aproba",
      "api/aproba",
      { reviewId: id, raspuns: text },
      function (d) {
        var it = S.byId.get(id);
        if (it) {
          it.stare = d.stare || "aprobat";
          it.raspuns = text;
        }
        uitaDraftDacaTrimis(id, text);
        L.toast("Răspuns aprobat. Îl puteți publica.", "ok");
        invataDin(id, d, "aproba");
        return "publica";
      },
    );
  }

  /* The server learned from this reply (d.memorie): it flies from the clicked button into the
     network's memory. Before the card re-renders: the busy button is still where the click was. */
  function invataDin(id, d, act) {
    if (!M || !d) return;
    var c = cardEl(id);
    try {
      // no "memorie" in the answer: one quiet GET (an older server answers 404, nothing shows)
      if (!d.memorie || typeof d.memorie !== "object") {
        M.incarca({ liniste: true });
        return;
      }
      M.dinRaspuns(d.memorie, {
        reviewId: id,
        buton: c && c.querySelector('button[data-act="' + act + '"]'),
      });
    } catch (e) {
      /* the memory is a layer on top: a failure there never holds the approval back */
    }
  }

  function publica(id) {
    var text = textPentru(id, "publicare");
    if (text === null) return;
    ruleaza(
      id,
      "publica",
      "api/publica",
      { reviewId: id, raspuns: text },
      function (d) {
        var it = S.byId.get(id);
        if (it) {
          it.stare = d.stare || "publicat_demo";
          it.raspuns = text;
        }
        uitaDraftDacaTrimis(id, text);
        if (d.mesaj) S.publicaMesaj = d.mesaj;
        L.toast(d.mesaj || PUBLICA_DEMO, "info", 10000);
        invataDin(id, d, "publica");
        return "preview";
      },
    );
  }

  function arataEmailVerificare(id, email) {
    L.arataEmail(email, {
      title: "E-mailul pentru verificare internă",
      returnFocus: function () {
        var c = cardEl(id);
        return (
          c &&
          (c.querySelector('button[data-act="confirma"]:not([disabled])') || c)
        );
      },
    });
  }

  async function trimiteVerificare(id) {
    var text = textPentru(id, "trimitere");
    if (text === null) return;
    var d = await ruleaza(
      id,
      "verificare",
      "api/verificare_interna",
      { reviewId: id, raspuns: text },
      function (d) {
        var it = S.byId.get(id);
        if (it) {
          it.stare = d.stare || "verificare_interna";
          it.raspuns = text;
        }
        uitaDraftDacaTrimis(id, text);
        S.trimisLocal.set(id, L.acumOra());
        if (d.email) {
          S.emailuri.set(id, d.email);
          L.ssSet(PREF_EMAIL + id, JSON.stringify(d.email));
        } else L.toast("Trimis la verificare internă.", "ok");
        return "confirma";
      },
    );
    if (d && d.email) arataEmailVerificare(id, d.email);
  }

  function confirma(id) {
    ruleaza(
      id,
      "confirma",
      "api/verificare_interna/confirma",
      { reviewId: id },
      function (d) {
        var it = S.byId.get(id);
        if (it) it.stare = d.stare || "verificat_intern";
        L.ssDel(PREF_EMAIL + id);
        L.toast(
          "Verificare internă confirmată. Publicarea este deblocată.",
          "ok",
        );
        return "publica";
      },
    );
  }

  /* Display text for a reply: the server's soft-hyphenated copy when it matches, else plain. */
  function afisareRaspuns(it, text) {
    var n = norm(text);
    if (
      it.raspuns &&
      typeof it.raspuns_afisare === "string" &&
      it.raspuns_afisare &&
      norm(it.raspuns) === n
    )
      return { t: it.raspuns_afisare, cls: "just" };
    if (
      it.propunere &&
      typeof it.propunere_afisare === "string" &&
      it.propunere_afisare &&
      norm(it.propunere) === n
    )
      return { t: it.propunere_afisare, cls: "just" };
    return { t: text, cls: "just-auto" };
  }

  /* Stylized map beside the review, as in the September simulation (decorative only). */
  function hartaGoogle(nume) {
    var forme = [
      ["blk", "top:6%;left:8%;width:20%;height:14%"],
      ["blk", "top:54%;left:6%;width:16%;height:18%"],
      ["blk", "top:70%;left:52%;width:26%;height:16%"],
      ["park", "top:8%;right:6%;width:32%;height:22%"],
      [
        "road",
        "top:30%;left:-5%;width:110%;height:7px;transform:rotate(-4deg)",
      ],
      ["road", "top:64%;left:-5%;width:110%;height:6px;transform:rotate(3deg)"],
      ["road", "left:28%;top:-5%;height:110%;width:6px;transform:rotate(4deg)"],
      [
        "ave",
        "left:66%;top:-12%;height:130%;width:11px;transform:rotate(-18deg)",
      ],
    ];
    return (
      '<div class="g-map" aria-hidden="true">' +
      forme
        .map(function (f) {
          return '<span class="' + f[0] + '" style="' + f[1] + '"></span>';
        })
        .join("") +
      '<span class="g-pin"><svg width="30" height="30" viewBox="0 0 24 24" focusable="false">' +
      '<path fill="#EA4335" stroke="#B31412" stroke-width="0.6" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/>' +
      '<circle cx="12" cy="9" r="2.6" fill="#7B0F0A"/></svg>' +
      '<span class="g-plabel">' +
      esc(nume) +
      "</span></span></div>"
    );
  }

  function previzualizeaza(id) {
    var it = S.byId.get(id);
    if (!it) return;
    var text = String(textCurent(it)).trim();
    if (!text) {
      L.toast("Nu există încă un răspuns de previzualizat.", "warn");
      return;
    }
    var af = afisareRaspuns(it, text);
    var u = S.unitati.get(String(it.unit_id)) || {};
    var adresa = u.address || it.address || "";
    var coment = String(it.comment_afisare || it.comment || "").trim();
    var rating =
      u.rating !== null && u.rating !== undefined
        ? '<div class="g-rate"><b>' +
          esc(u.rating_afisat || L.fmtNota(u.rating)) +
          "</b>" +
          L.stele(u.rating, "g-stars") +
          (u.count !== null && u.count !== undefined
            ? "<span>" + esc(L.nr(u.count, "recenzie", "recenzii")) + "</span>"
            : "") +
          "</div>"
        : "";
    var nume = it.unitate || u.title || "";
    var html =
      '<div class="gcard"><div class="g-left">' +
      '<div class="g-search" aria-hidden="true">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" focusable="false"><path fill="#5f6368" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>' +
      '<span class="g-q">' +
      esc([nume, it.oras].filter(Boolean).join(" ")) +
      "</span></div>" +
      '<div class="g-name">' +
      esc(nume) +
      "</div>" +
      rating +
      (adresa ? '<div class="g-addr">' + esc(adresa) + "</div>" : "") +
      '<div class="g-tabs" aria-hidden="true"><span>Prezentare generală</span><span class="sel">Recenzii</span><span>Despre</span></div>' +
      '<div class="g-rev"><div class="g-avatar" aria-hidden="true" style="background:' +
      culoareAvatar(it.reviewer) +
      '">' +
      esc(L.primaLitera(it.reviewer)) +
      "</div>" +
      '<div class="g-body"><div class="g-author">' +
      esc(it.reviewer || "Anonim") +
      "</div>" +
      '<div class="g-meta">' +
      L.stele(it.stele, "g-stars") +
      "<span>" +
      esc(it.data_relativa || "") +
      "</span></div>" +
      (coment
        ? '<p class="g-text just" lang="' +
          esc(L.langAttr(it.limba)) +
          '">' +
          esc(coment) +
          "</p>"
        : "") +
      '<div class="g-owner"><div class="g-owner-h">Răspuns de la proprietar<span class="g-when">acum</span></div>' +
      '<p class="g-owner-t ' +
      af.cls +
      '" lang="' +
      esc(L.langAttr(S.limbaProp.get(id) || it.limba)) +
      '">' +
      esc(af.t) +
      "</p></div>" +
      "</div></div></div>" +
      hartaGoogle(nume) +
      "</div>" +
      '<p class="g-cap just">' +
      esc(HY.gcap) +
      "</p>";
    L.deschide({
      title: "Previzualizare pe Google",
      html: html,
      wide: true,
      xl: true,
      actions: [{ label: "Închide", cls: "blue", close: true }],
      returnFocus: function () {
        var c = cardEl(id);
        return c && (c.querySelector('button[data-act="preview"]') || c);
      },
    });
  }

  function comutaMaiMult(btn) {
    var tid = btn.getAttribute("data-more");
    var el = document.getElementById(tid);
    if (!el) return;
    var ext = !S.extinse.has(tid);
    if (ext) S.extinse.add(tid);
    else S.extinse.delete(tid);
    el.classList.toggle("clamp", !ext);
    btn.textContent = ext ? "Mai puțin" : "Mai mult";
    btn.setAttribute("aria-expanded", String(ext));
    var card = btn.closest(".rev-card");
    // Phrases revealed (or hidden again) by the clamp gain (or lose) their connector line.
    if (R && card) R.leaga(card);
    if (!ext) {
      var bara = document.querySelector(".appbar");
      var sus = bara ? bara.getBoundingClientRect().bottom : 0;
      if (card && card.getBoundingClientRect().top < sus) {
        card.scrollIntoView({
          block: "start",
          behavior: L.reduceMotion() ? "auto" : "smooth",
        });
      }
    }
  }

  /* ---------------------------------------------------------------- alerts */

  async function reimprospateazaAlerte() {
    var lista = null;
    try {
      var r = await L.api("api/alerte");
      if (r.ok) lista = L.asList(r.data, ["alerte", "recenzii", "items"]);
    } catch (e) {
      if (e.kind === "auth") return;
    }
    S.alerte = lista;
    randeazaAlerte();
  }

  /* Open alerts: visible sensitive reviews not yet published (same rule as the API's "rezolvata"). */
  function alerteDeschise() {
    var surse = S.alerte
      ? S.alerte.map(function (a) {
          var it = a && S.byId.get(a.reviewId);
          return it ? Object.assign({}, a, it) : a;
        })
      : S.items.filter(eSens);
    return surse.filter(function (a) {
      return a && stare(a) !== "publicat_demo";
    });
  }

  function stareAlerta(a) {
    var s = stare(a);
    if (s === "verificare_interna") {
      var o = oraTrimis(a);
      return (
        '<span class="badge wait">' +
        ic("clock") +
        "La verificare internă" +
        (o ? " · trimis la " + esc(o) : "") +
        "</span>"
      );
    }
    if (s === "verificat_intern")
      return (
        '<span class="badge ok">' +
        ic("check") +
        "Verificat intern · se poate publica</span>"
      );
    if (s === "propunere")
      return '<span class="badge prop">Propunere pregătită</span>';
    return '<span class="badge state">Netrimisă la verificare</span>';
  }

  function randAlerta(a) {
    var c = a.sensibil || {};
    var cat = L.categorieNume(c.categorie || a.categorie) || "Sensibilă";
    var motiv = L.motivScurt(c.motiv || a.motiv || "");
    return (
      '<li class="alert-row"><span class="badge sens">' +
      ic("alert") +
      esc(cat) +
      "</span>" +
      '<span class="alert-unit">' +
      L.avatarUnitate(a.unit_id, ini(a.unit_id), "xs") +
      "<span>" +
      esc(a.unitate || "") +
      "</span>" +
      L.stele(a.stele) +
      "</span>" +
      '<span class="alert-motiv">' +
      esc(motiv) +
      "</span>" +
      '<span class="alert-state">' +
      stareAlerta(a) +
      "</span>" +
      '<button type="button" class="btn link sm" data-vezi="' +
      esc(a.reviewId) +
      '">' +
      ic("eye") +
      "Vezi recenzia" +
      '<span class="sr-only">, ' +
      esc(a.unitate || "") +
      ", " +
      esc(a.reviewer || "") +
      "</span></button></li>"
    );
  }

  function randeazaAlerte() {
    var box = $("alerte");
    var lista = alerteDeschise();
    if (!lista.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    var max = 4;
    box.innerHTML =
      '<div class="alerts-head"><span class="alerts-ic" aria-hidden="true">' +
      ic("alert") +
      '</span><div class="alerts-txt">' +
      '<h2 class="alerts-title" id="alerteTitlu">Alerte: recenzii sensibile<span class="badge sens">' +
      lista.length +
      "</span></h2>" +
      '<p class="alerts-sub just">' +
      esc(HY.alertA) +
      " " +
      esc(L.shy(rolDesemnat())) +
      " " +
      esc(HY.alertB) +
      "</p></div></div>" +
      '<ul class="alert-list">' +
      lista.slice(0, max).map(randAlerta).join("") +
      "</ul>" +
      (lista.length > max
        ? '<div class="alerts-more"><button type="button" class="btn link sm" data-toate-sens>Vezi toate cele ' +
          lista.length +
          "</button></div>"
        : "");
    box.hidden = false;
  }

  function mergiLa(id) {
    var el = cardEl(id);
    if (!el && S.byId.has(id)) {
      reseteazaFiltre();
      el = cardEl(id);
    }
    if (!el) return;
    S.flash.add(id);
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
    setTimeout(function () {
      S.flash.delete(id);
      var c = cardEl(id);
      if (c) c.classList.remove("flash");
    }, 3000);
    el.scrollIntoView({
      block: "start",
      behavior: L.reduceMotion() ? "auto" : "smooth",
    });
    el.focus({ preventScroll: true });
  }

  /* --------------------------------------------------------------- history */

  async function reimprospateazaIstoric() {
    try {
      var r = await L.api("api/istoric");
      if (!r.ok) return;
      var lista = L.asList(r.data, ["istoric", "items"]);
      if (!lista) return;
      S.istoric = lista;
    } catch (e) {
      return;
    }
    var n = $("istoricN");
    n.textContent = S.istoric.length;
    n.hidden = !S.istoric.length;
    if (S.drawer) randeazaIstoric();
  }

  function randIstoric(h) {
    var a = ACTIUNI[h.actiune] || [String(h.actiune || "Acțiune"), "state"];
    var sens = h.sensibil === true || !!(h.sensibil && h.sensibil.flag);
    var flags =
      (h.editat_manual
        ? '<span class="badge state">' + ic("pencil") + "Editat manual</span>"
        : "") +
      (sens
        ? '<span class="badge sens">' + ic("alert") + "Sensibilă</span>"
        : "");
    // "de persoana desemnată LUCA": the role reads lower-case after "de".
    var cine = h.de_catre ? String(h.de_catre) : "";
    if (cine && h.actiune === "confirmat_intern") cine = primaMica(cine);
    var af =
      typeof h.raspuns_afisare === "string" && h.raspuns_afisare
        ? { t: h.raspuns_afisare, cls: "just" }
        : { t: h.raspuns, cls: "just-auto" };
    return (
      '<li class="hist-item"><div class="hist-top"><span class="hist-time">' +
      esc(L.oraZi(h.cand)) +
      "</span>" +
      '<span class="badge ' +
      a[1] +
      '">' +
      (a[2] ? ic(a[2]) : "") +
      esc(a[0]) +
      "</span></div>" +
      (cine ? '<div class="hist-who">de ' + esc(cine) + "</div>" : "") +
      '<div class="hist-rev">' +
      (h.unit_id !== undefined && h.unit_id !== null
        ? L.avatarUnitate(h.unit_id, ini(h.unit_id), "xs")
        : "") +
      "<span>" +
      esc(h.unitate || "") +
      "</span>" +
      (h.stele !== null && h.stele !== undefined ? L.stele(h.stele) : "") +
      (h.recenzent ? "<span>" + esc(h.recenzent) + "</span>" : "") +
      "</div>" +
      (h.raspuns
        ? '<p class="hist-text ' +
          af.cls +
          '" lang="' +
          esc(L.langAttr(h.limba)) +
          '">' +
          esc(String(af.t).trim()) +
          "</p>"
        : "") +
      (flags ? '<div class="hist-flags">' + flags + "</div>" : "") +
      "</li>"
    );
  }

  function randeazaIstoric() {
    var ol = document.getElementById("istoricLista");
    if (!ol) return;
    if (!S.istoric.length) {
      ol.innerHTML =
        '<li class="hist-empty just">' + esc(HY.histEmpty) + "</li>";
      return;
    }
    ol.innerHTML = S.istoric.map(randIstoric).join("");
  }

  function deschideIstoric() {
    S.drawer = L.deschide({
      side: true,
      title: "Istoric",
      html: '<p class="drawer-sub">Cine, când, ce acțiune și ce text, de la cea mai nouă.</p><ol class="hist" id="istoricLista"></ol>',
      actions: [{ label: "Închide", cls: "ghost", close: true }],
      onClose: function () {
        S.drawer = null;
      },
      returnFocus: function () {
        return $("btnIstoric");
      },
    });
    randeazaIstoric();
    reimprospateazaIstoric();
  }

  /* ------------------------------------------------- update, reset, chrome */

  async function actualizeaza() {
    var btn = $("btnActualizeaza");
    if (btn.disabled) return;
    L.ocupa(btn, "Se actualizează…");
    var inainte = new Set(
      S.items.map(function (x) {
        return x.reviewId;
      }),
    );
    try {
      var r = await L.api("api/demo/actualizeaza", {
        method: "POST",
        timeoutMs: 30000,
      });
      if (!r.ok) {
        L.toast(
          L.mesajDin(r.data) || "Actualizarea nu a reușit. Încercați din nou.",
          "err",
        );
        return;
      }
      var d = r.data || {};
      await sincronizeaza();
      var ids = Array.isArray(d.reviewIds) ? d.reviewIds : [];
      var noi = S.items.filter(function (x) {
        return ids.indexOf(x.reviewId) !== -1 || !inainte.has(x.reviewId);
      });
      if (noi.length) {
        noi.forEach(function (x) {
          if (x.noua === undefined) x.noua = true;
          S.flash.add(x.reviewId);
        });
        seteazaItems(S.items);
        var ascunse = noi.some(function (x) {
          return !(potrivesteRest(x) && potrivesteStare(x, S.f.stare));
        });
        if (ascunse) reseteazaFiltre();
        else aplicaFiltre();
        reimprospateazaAlerte();
        var prima = cardEl(noi[0].reviewId);
        if (prima)
          prima.scrollIntoView({
            block: "start",
            behavior: L.reduceMotion() ? "auto" : "smooth",
          });
      }
      L.toast(
        d.mesaj ||
          (noi.length
            ? L.nr(noi.length, "recenzie nouă adusă", "recenzii noi aduse") +
              " din Google."
            : "Nicio recenzie nouă."),
        noi.length ? "ok" : "info",
      );
    } catch (e) {
      if (e.kind !== "auth") L.toast(L.mesajEroare(e), "err");
    } finally {
      L.elibereaza(btn);
    }
  }

  function confirmaReset() {
    L.deschide({
      title: "Resetați demonstrația?",
      html: '<p class="dialog-text just">' + esc(HY.reset) + "</p>",
      actions: [
        { label: "Anulează", cls: "ghost", close: true },
        {
          label: "Resetează",
          cls: "danger",
          icon: "refresh",
          onClick: async function (ctx, b) {
            L.ocupa(b, "Se resetează…");
            try {
              var r = await L.api("api/demo/reset", {
                method: "POST",
                timeoutMs: 20000,
              });
              if (r.ok) {
                L.ssClearPrefix(PREF_DRAFT);
                L.ssClearPrefix(PREF_EMAIL);
                L.ssClearPrefix(PREF_AN);
                L.ssDel(PREF_AN_ASCUNSA);
                window.scrollTo(0, 0);
                window.location.replace("index.html");
                return;
              }
              L.toast(
                L.mesajDin(r.data) ||
                  "Resetarea nu a reușit. Încercați din nou.",
                "err",
              );
            } catch (e) {
              if (e.kind === "auth") return;
              L.toast(L.mesajEroare(e), "err");
            }
            L.elibereaza(b);
          },
        },
      ],
      returnFocus: function () {
        return $("btnReset");
      },
    });
  }

  function actualizeazaLede() {
    if (!S.ctx) return;
    var un = unitatiLista();
    var tari = unic(
      un.map(function (u) {
        return u.tara;
      }),
    ).map(L.taraNume);
    var data =
      S.ctx.data_culegere_afisata ||
      L.dataRo(S.ctx.data_culegere) ||
      "29.10.2026";
    var n = un.length;
    $("lede").textContent =
      HY.ledeA +
      " " +
      (n > 1
        ? "cele " + L.fmtNr(n) + " " + L.cuDe(n) + L.shy("unități") + " LUCA"
        : L.shy("unitățile") + " LUCA") +
      (tari.length ? " din " + listaRo(tari.map(L.shy)) : "") +
      ", " +
      HY.ledeC +
      " " +
      data +
      ". " +
      HY.ledeD;
  }

  function arataEroareIncarcare() {
    var l = $("lista");
    l.setAttribute("aria-busy", "false");
    l.innerHTML =
      '<div class="card empty"><p>Recenziile nu au putut fi încărcate.</p>' +
      '<button type="button" class="btn ghost" data-reincarca>' +
      ic("refresh") +
      "Reîncearcă</button></div>";
    $("kpis").hidden = true;
  }

  /* Deep link from the verification e-mail: /?recenzie=<reviewId>. */
  function deschideDinLink() {
    var p = new URLSearchParams(window.location.search);
    var id = p.get("recenzie");
    if (!id) return;
    if (window.history && window.history.replaceState)
      window.history.replaceState(null, "", window.location.pathname);
    if (S.byId.has(id)) {
      seteazaActiv(id);
      mergiLa(id);
    }
  }

  /* ---------------------------------------------------------------- events */

  function laClickLista(e) {
    var t = e.target;
    if (t.closest("[data-clear]")) {
      reseteazaFiltre();
      return;
    }
    if (t.closest("[data-reincarca]")) {
      window.location.reload();
      return;
    }
    var more = t.closest("[data-more]");
    if (more) {
      comutaMaiMult(more);
      return;
    }
    if (t.closest("[data-an-toggle]")) {
      comutaAnaliza();
      return;
    }
    var btn = t.closest("button[data-act]");
    if (!btn || btn.disabled) return;
    var card = btn.closest(".rev-card");
    if (!card) return;
    var id = card.dataset.id;
    seteazaActiv(id);
    switch (btn.dataset.act) {
      case "propune":
        propune(id, false);
        break;
      case "regenereaza":
        propune(id, true);
        break;
      case "aproba":
        aproba(id);
        break;
      case "publica":
        publica(id);
        break;
      case "verificare":
        trimiteVerificare(id);
        break;
      case "confirma":
        confirma(id);
        break;
      case "preview":
        previzualizeaza(id);
        break;
      case "email": {
        var em = S.emailuri.get(id);
        if (em) arataEmailVerificare(id, em);
        break;
      }
      default:
        break;
    }
  }

  function laInput(e) {
    var ta = e.target;
    if (!ta.classList || !ta.classList.contains("prop-text")) return;
    var card = ta.closest(".rev-card");
    if (!card) return;
    var id = card.dataset.id;
    var it = S.byId.get(id);
    S.drafts.set(id, ta.value);
    salveazaDraft(id, ta.value);
    autoInaltime([ta]);
    var ed = card.querySelector(".prop-edited");
    var baza = S.propuneri.get(id) || (it && it.propunere) || "";
    if (ed) {
      var inainte = ed.hidden;
      ed.hidden = !(baza && norm(ta.value) !== norm(baza));
      // The flag can wrap the proposal header onto a second line, moving the analysis chips.
      if (R && ed.hidden !== inainte) R.leaga(card);
    }
  }

  function laFocus(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains("prop-text")) return;
    var card = t.closest(".rev-card");
    if (card) seteazaActiv(card.dataset.id);
  }

  function leagaEvenimente() {
    var lista = $("lista");
    lista.addEventListener("click", laClickLista);
    lista.addEventListener("input", laInput);
    lista.addEventListener("focusin", laFocus);
    if (R) R.activeazaHover(lista);
    if (M) M.leagaHover(lista);

    $("alerte").addEventListener("click", function (e) {
      var v = e.target.closest("[data-vezi]");
      if (v) {
        var id = v.getAttribute("data-vezi");
        seteazaActiv(id);
        mergiLa(id);
        return;
      }
      if (e.target.closest("[data-toate-sens]")) {
        reseteazaFiltre();
        S.f.stare = "sensibile";
        aplicaFiltre();
        $("lista").scrollIntoView({
          block: "start",
          behavior: L.reduceMotion() ? "auto" : "smooth",
        });
      }
    });

    $("kpis").addEventListener("click", function (e) {
      var b = e.target.closest(".kpi[data-stare]");
      if (!b) return;
      var k = b.getAttribute("data-stare");
      // A pressed tile toggles back to "Toate", like a filter chip.
      S.f.stare = S.f.stare === k ? "toate" : k;
      aplicaFiltre();
    });

    $("fUnit").addEventListener("change", function () {
      S.f.unit = this.value;
      aplicaFiltre();
    });
    $("fTara").addEventListener("change", function () {
      S.f.tara = this.value;
      actualizeazaOrase();
      actualizeazaUnitati();
      aplicaFiltre();
    });
    $("fOras").addEventListener("change", function () {
      S.f.oras = this.value;
      actualizeazaUnitati();
      aplicaFiltre();
    });
    document.querySelector(".tg-group").addEventListener("click", function (e) {
      var b = e.target.closest(".tg");
      if (!b) return;
      var n = Number(b.getAttribute("data-stele"));
      if (S.f.stele.has(n)) S.f.stele.delete(n);
      else S.f.stele.add(n);
      b.setAttribute("aria-pressed", String(S.f.stele.has(n)));
      aplicaFiltre();
    });
    $("fStare").addEventListener("click", function (e) {
      var b = e.target.closest(".seg-b");
      if (!b) return;
      S.f.stare = b.getAttribute("data-stare");
      aplicaFiltre();
    });
    var cauta = debounce(function (v) {
      S.f.tokens = L.fold(v).split(/\s+/).filter(Boolean);
      aplicaFiltre();
    }, 160);
    $("fText").addEventListener("input", function () {
      cauta(this.value);
    });
    $("fClear").addEventListener("click", reseteazaFiltre);

    $("btnActualizeaza").addEventListener("click", actualizeaza);
    $("btnIstoric").addEventListener("click", deschideIstoric);
    $("btnReset").addEventListener("click", confirmaReset);

    window.addEventListener("resize", debounce(remasoara, 200));
  }

  /* The memory widget loads with the page (GET /api/memorie; the demo reset reloads the page,
     so it loads again empty). Without memorie.js the widget and its room in the head go away. */
  function initMemorie() {
    var el = $("memorie");
    var cap = document.querySelector(".pagehead");
    if (M) {
      M.init({ el: el, cap: cap, ini: ini, unitate: unitDupaNume });
      return;
    }
    if (el) el.hidden = true;
    if (cap) cap.classList.remove("has-mem");
  }

  async function init() {
    leagaEvenimente();
    initMemorie();
    var ctxP = L.initChrome();
    try {
      await incarcaRecenzii();
    } catch (e) {
      if (e.kind === "auth") return;
      arataEroareIncarcare();
      return;
    }
    S.ctx = await ctxP;
    if (S.ctx && Array.isArray(S.ctx.unitati)) {
      S.unitati = new Map(
        S.ctx.unitati.map(function (u) {
          return [String(u.id), u];
        }),
      );
    }
    S.ini = L.initialeUnitati(unitatiLista());
    restaureazaLocal();
    S.anAscunsa = L.ssGet(PREF_AN_ASCUNSA) === "1";
    $("lista").classList.toggle("an-off", S.anAscunsa);
    actualizeazaLede();
    construiesteFiltre();
    randeazaAlerte(); // from S.items, before the list: the panel never pushes the cards down later
    aplicaFiltre();
    deschideDinLink();
    reimprospateazaAlerte();
    reimprospateazaIstoric();
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(remasoara);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
