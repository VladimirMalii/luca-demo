/* LUCA demo: shared helpers for every page (fetch wrapper, Romanian formatting,
   icons, unit identity, toasts, modal dialogs, e-mail preview, app chrome).
   Plain browser JS, no libraries. Exposed as window.LUCA. All calls go to the local
   demo API (same origin). */
(function () {
  "use strict";

  var LIMBI = {
    ro: "română",
    pl: "poloneză",
    en: "engleză",
    de: "germană",
    fr: "franceză",
    it: "italiană",
    es: "spaniolă",
    hu: "maghiară",
    uk: "ucraineană",
    ru: "rusă",
    el: "greacă",
    tr: "turcă",
  };
  var TARI = { RO: "România", PL: "Polonia" };
  var CATEGORII = {
    siguranta_alimentara: "Siguranță alimentară",
    igiena: "Igienă",
    comportament_personal: "Comportamentul personalului",
  };
  var LUNI = [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
  ];
  var MSG = {
    retea: "Aplicația nu răspunde. Verificați că serverul local rulează.",
    timp: "Serverul a răspuns prea târziu. Încercați din nou.",
    generic: "Acțiunea nu a reușit. Încercați din nou.",
  };

  /* Pre-hyphenated words for the few dynamic parts of fixed paragraphs (repo module silabe.py). */
  var SHY_RO = {
    unitate: "uni\u00ADta\u00ADte",
    unități: "uni\u00ADtăți",
    unitățile: "uni\u00ADtă\u00ADți\u00ADle",
    România: "Ro\u00ADmâ\u00ADnia",
    Polonia: "Po\u00ADlo\u00ADnia",
    "persoana desemnată LUCA": "per\u00ADsoa\u00ADna de\u00ADsem\u00ADna\u00ADtă LUCA",
  };

  /* ------------------------------------------------------------- icons */

  /* One stroke icon set (24 grid, stroke 1.75, round joins), drawn inline: no font, no CDN. */
  var ICONS = {
    refresh:
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>' +
      '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    history:
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    alert:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "check-circle":
      '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    eye:
      '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/>' +
      '<circle cx="12" cy="12" r="3"/>',
    file:
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
      '<path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    print:
      '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>' +
      '<path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    logout:
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    inbox:
      '<path d="M22 12h-6l-2 3h-4l-2-3H2"/>' +
      '<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    message:
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "message-text":
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7.5 8h9"/><path d="M7.5 12h5"/>',
    nodes:
      '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/>' +
      '<path d="M8.5 6.2 15.5 6.8"/><path d="m7.1 8.2 3.8 7.6"/><path d="m16.8 9.2-3.6 6.6"/>',
    lock: '<rect width="16" height="11" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pencil:
      '<path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18"/>',
    copy: '<rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    store:
      '<path d="M3 10 4.5 4h15L21 10"/><path d="M5 10v10h14V10"/><path d="M3 10h18"/><path d="M10 20v-5h4v5"/>',
    chart:
      '<path d="M3 3v18h18"/><path d="M7.5 17v-3"/><path d="M11.5 17v-7"/><path d="M15.5 17v-5"/><path d="M19.5 17V7"/>',
    list: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4.5 6h.01"/><path d="M4.5 12h.01"/><path d="M4.5 18h.01"/>',
    "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  };

  function icon(nume, cls) {
    var p = ICONS[nume];
    if (!p) return "";
    return (
      '<svg class="ic' +
      (cls ? " " + cls : "") +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      p +
      "</svg>"
    );
  }

  /* ------------------------------------------------------------ basics */

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  function eroare(kind) {
    var e = new Error(kind);
    e.kind = kind;
    return e;
  }

  /* fetch wrapper: JSON in, {ok, status, data} out; 401 sends the browser to /login;
     network failure or timeout throws an Error with .kind = 'retea' | 'timp' | 'auth'. */
  async function api(path, opts) {
    opts = opts || {};
    var method = opts.method || "GET";
    var init = {
      method: method,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (method !== "GET") {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body === undefined ? {} : opts.body);
    }
    var timer = null;
    if (opts.timeoutMs && typeof AbortController === "function") {
      var ctrl = new AbortController();
      init.signal = ctrl.signal;
      timer = setTimeout(function () {
        ctrl.abort();
      }, opts.timeoutMs);
    }
    var res;
    try {
      res = await fetch(path, init);
    } catch (e) {
      if (timer) clearTimeout(timer);
      throw eroare(e && e.name === "AbortError" ? "timp" : "retea");
    }
    try {
      if (res.status === 401) {
        window.location.assign("login.html");
        throw eroare("auth");
      }
      var ct = res.headers.get("content-type") || "";
      var data = null;
      if (ct.indexOf("json") !== -1) {
        try {
          data = await res.json();
        } catch (e) {
          data = null;
        }
      } else {
        try {
          var t = await res.text();
          data = t ? { text: t } : null;
        } catch (e) {
          data = null;
        }
      }
      return { ok: res.ok, status: res.status, data: data };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* Message from an API answer: {mesaj}, {detail: "..."} or {detail: {mesaj}}. */
  function mesajDin(data) {
    if (!data || typeof data !== "object") return null;
    if (typeof data.mesaj === "string" && data.mesaj.trim()) return data.mesaj;
    var d = data.detail;
    if (typeof d === "string" && d.trim()) return d;
    if (d && typeof d === "object" && typeof d.mesaj === "string")
      return d.mesaj;
    return null;
  }

  function mesajEroare(e) {
    return (e && MSG[e.kind]) || MSG.generic;
  }

  /* Accept either a bare list or an object wrapping it under one of the given keys. */
  function asList(data, keys) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      for (var i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]])) return data[keys[i]];
      }
    }
    return null;
  }

  /* sessionStorage that never throws (private mode, blocked storage): per-tab conveniences only. */
  function ssGet(k) {
    try {
      return window.sessionStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function ssSet(k, v) {
    try {
      window.sessionStorage.setItem(k, v);
    } catch (e) {
      /* storage full or blocked: the in-memory copy still works */
    }
  }
  function ssDel(k) {
    try {
      window.sessionStorage.removeItem(k);
    } catch (e) {
      /* ignore */
    }
  }
  function ssClearPrefix(p) {
    try {
      var s = window.sessionStorage;
      var chei = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(p) === 0) chei.push(k);
      }
      chei.forEach(function (k) {
        s.removeItem(k);
      });
    } catch (e) {
      /* ignore */
    }
  }

  /* ------------------------------------------------- Romanian formatting */

  function fmtNr(n) {
    var x = Number(n);
    if (n === null || n === undefined || n === "" || !isFinite(x)) return "";
    var s = String(Math.round(Math.abs(x))).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      ".",
    );
    return (x < 0 ? "-" : "") + s;
  }

  function fmtNota(x) {
    var v = Number(x);
    if (x === null || x === undefined || x === "" || !isFinite(v)) return "";
    return v.toFixed(1).replace(".", ",");
  }

  /* Romanian numerals: 20 and above take "de" unless the last two digits are 01-19. */
  function cuDe(n) {
    var v = Math.abs(Math.floor(Number(n) || 0));
    var r = v % 100;
    return v >= 20 && (r === 0 || r >= 20) ? "de " : "";
  }

  function nr(n, singular, plural) {
    var v = Number(n) || 0;
    return fmtNr(v) + " " + (v === 1 ? singular : cuDe(v) + plural);
  }

  /* Soft-hyphenated form of a known word (dynamic parts of justified paragraphs), else unchanged. */
  function shy(s) {
    var k = String(s == null ? "" : s);
    return Object.prototype.hasOwnProperty.call(SHY_RO, k) ? SHY_RO[k] : k;
  }

  function stele(n, cls) {
    var k = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return (
      '<span class="' +
      (cls || "stars") +
      '" role="img" aria-label="' +
      k +
      ' din 5 stele">' +
      '<span class="on" aria-hidden="true">' +
      "★".repeat(k) +
      "</span>" +
      '<span class="off" aria-hidden="true">' +
      "★".repeat(5 - k) +
      "</span></span>"
    );
  }

  /* Rating band of a review: 1-2 stars low, 3 mid, 4-5 high (accent bar colour). */
  function bandaNota(n) {
    var k = Math.round(Number(n) || 0);
    if (k <= 2) return "r-low";
    if (k === 3) return "r-mid";
    return "r-high";
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function parseData(iso) {
    if (!iso) return null;
    var d = new Date(String(iso));
    return isNaN(d.getTime()) ? null : d;
  }

  function ora(iso) {
    if (!iso) return "";
    var d = parseData(iso);
    if (d) return pad(d.getHours()) + ":" + pad(d.getMinutes());
    var m = String(iso).match(/(\d{2}):(\d{2})/);
    return m ? m[1] + ":" + m[2] : "";
  }

  function zi(d) {
    return (
      pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear()
    );
  }

  /* "14:05" for today, "28.10.2026, 14:05" otherwise. */
  function oraZi(iso) {
    var d = parseData(iso);
    if (!d) return ora(iso);
    var acum = new Date();
    var azi =
      d.getFullYear() === acum.getFullYear() &&
      d.getMonth() === acum.getMonth() &&
      d.getDate() === acum.getDate();
    return (
      (azi ? "" : zi(d) + ", ") + pad(d.getHours()) + ":" + pad(d.getMinutes())
    );
  }

  function dataRo(s) {
    if (!s) return "";
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + "." + m[2] + "." + m[1] : String(s);
  }

  function azi() {
    return zi(new Date());
  }

  function acumOra() {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function lunaAn() {
    var d = new Date();
    return LUNI[d.getMonth()] + " " + d.getFullYear();
  }

  function limbaNume(c) {
    c = String(c || "").toLowerCase();
    return LIMBI[c] || c.toUpperCase();
  }

  function limbaCod(c) {
    return String(c || "").toUpperCase();
  }

  function langAttr(c) {
    c = String(c || "").toLowerCase();
    return /^[a-z]{2,3}$/.test(c) ? c : "ro";
  }

  /* Language chip, tinted per language (RO blue, PL red, EN violet); text keeps AA contrast. */
  function cipLimba(c, titlu) {
    c = String(c || "").toLowerCase();
    if (!c) return "";
    var cls = /^(ro|pl|en)$/.test(c) ? " l-" + c : "";
    return (
      '<span class="chip-lang' +
      cls +
      '" title="' +
      esc(titlu || "Recenzie în " + limbaNume(c)) +
      '"><span class="sr-only">Limba: </span>' +
      esc(limbaCod(c)) +
      "</span>"
    );
  }

  function taraNume(c) {
    return TARI[c] || c || "";
  }

  function categorieNume(c) {
    if (!c) return "";
    if (CATEGORII[c]) return CATEGORII[c];
    var s = String(c).replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* The category badge already names the problem: drop a leading "Posibilă problemă de …: ". */
  function motivScurt(motiv) {
    var s = String(motiv || "").trim();
    var t = s.replace(/^Posibil[ăa] problem[ăa] de [^:]{1,80}:\s*/i, "");
    if (!t || t === s) return s;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* Lowercase, no diacritics, no soft hyphens: for text search. */
  function fold(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l")
      .replace(/\u00AD/g, "");
  }

  function domId(id) {
    return "r-" + String(id).replace(/[^A-Za-z0-9_-]/g, "_");
  }

  function primaLitera(s) {
    var t = String(s || "").replace(/[^\p{L}]/gu, "");
    return t ? t.charAt(0).toUpperCase() : "?";
  }

  function initiale(nume) {
    return String(nume || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (p) {
        return primaLitera(p);
      })
      .join("");
  }

  /* ------------------------------------------------------ unit identity */

  var CUVINTE_MICI = /^(de|din|la|si|și|cu|pe|al|a|i|w|z|na|ul|the|of|and)$/i;

  function cuvinteUnitate(title) {
    return String(title || "")
      .replace(/^\s*LUCA\s+/i, "")
      .split(/[\s\-.,/]+/)
      .map(function (w) {
        return w.replace(/[^\p{L}]/gu, "");
      })
      .filter(function (w) {
        return w && !CUVINTE_MICI.test(w);
      });
  }

  function doua(w) {
    var l = Array.from(w);
    return (l[0] || "").toUpperCase() + (l[1] || "").toUpperCase();
  }

  /* Unit initials ("LUCA Gara de Nord" -> "GN"), unique across the given units: on a clash
     (two "Warszawa ..." units) the distinctive last word is used ("CE", "CH"). */
  function initialeUnitati(unitati) {
    var lista = (unitati || []).map(function (u) {
      var w = cuvinteUnitate(u.title);
      var prima =
        w.length >= 2
          ? (Array.from(w[0])[0] + Array.from(w[1])[0]).toUpperCase()
          : w.length
            ? doua(w[0])
            : "?";
      return { id: String(u.id), w: w, ini: prima };
    });
    var numar = {};
    lista.forEach(function (x) {
      numar[x.ini] = (numar[x.ini] || 0) + 1;
    });
    var out = new Map();
    lista.forEach(function (x) {
      var ini = x.ini;
      if (numar[ini] > 1 && x.w.length) ini = doua(x.w[x.w.length - 1]);
      out.set(x.id, ini);
    });
    return out;
  }

  /* Deterministic unit colour: one of 10 hues (same OKLCH lightness and chroma), stride 3 so that
     neighbouring ids never get neighbouring hues. Colours live in luca.css (.u-c0 ... .u-c9). */
  function clsUnitate(id) {
    var n = parseInt(id, 10);
    if (!isFinite(n)) {
      n = 0;
      String(id || "")
        .split("")
        .forEach(function (ch) {
          n = (n * 31 + ch.charCodeAt(0)) >>> 0;
        });
    }
    return "u-c" + (((((n - 1) * 3) % 10) + 10) % 10);
  }

  function avatarUnitate(id, ini, cls) {
    return (
      '<span class="u-av ' +
      clsUnitate(id) +
      (cls ? " " + cls : "") +
      '" aria-hidden="true">' +
      esc(ini || "?") +
      "</span>"
    );
  }

  function reduceMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* --------------------------------------------------- busy buttons */

  /* Busy state that keeps the button width: the label stays (hidden), a spinner sits on top,
     screen readers get the busy text. */
  var continut = new WeakMap();

  function ocupa(btn, eticheta) {
    if (!btn || btn.classList.contains("is-busy")) return;
    continut.set(btn, btn.innerHTML);
    btn.disabled = true;
    btn.classList.add("is-busy");
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML =
      '<span class="btn-l">' +
      btn.innerHTML +
      '</span><span class="spin" aria-hidden="true"></span><span class="sr-only">' +
      esc(eticheta || "Se lucrează…") +
      "</span>";
  }

  function elibereaza(btn) {
    if (!btn) return;
    if (continut.has(btn)) {
      btn.innerHTML = continut.get(btn);
      continut.delete(btn);
    }
    btn.disabled = false;
    btn.classList.remove("is-busy");
    btn.removeAttribute("aria-busy");
  }

  /* ------------------------------------------------------------ toasts */

  var ICON_TOAST = {
    ok: "check-circle",
    err: "alert",
    warn: "alert",
    info: "info",
  };

  function toast(text, kind, ms) {
    var box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.className = "toasts";
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    kind = ICON_TOAST[kind] ? kind : "info";
    var el = document.createElement("div");
    el.className = "toast " + kind;
    if (kind === "err") el.setAttribute("role", "alert");
    var ic = document.createElement("span");
    ic.className = "toast-ic";
    ic.innerHTML = icon(ICON_TOAST[kind]);
    var p = document.createElement("p");
    p.textContent = text;
    var x = document.createElement("button");
    x.type = "button";
    x.className = "toast-x";
    x.setAttribute("aria-label", "Închide mesajul");
    x.innerHTML = icon("x");
    el.appendChild(ic);
    el.appendChild(p);
    el.appendChild(x);
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstElementChild);

    var t = setTimeout(scoate, ms || (kind === "err" ? 9000 : 6500));
    function scoate() {
      clearTimeout(t);
      if (!el.parentNode) return;
      el.classList.add("out");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 180);
    }
    x.addEventListener("click", scoate);
    el.addEventListener("mouseenter", function () {
      clearTimeout(t);
    });
    el.addEventListener("mouseleave", function () {
      clearTimeout(t);
      t = setTimeout(scoate, 2500);
    });
    return scoate;
  }

  /* ----------------------------------------------------------- dialogs */

  var stiva = [];
  var contor = 0;

  function focusabile(root) {
    var sel =
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), " +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(
      root.querySelectorAll(sel),
      function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      },
    );
  }

  /* o: {title, html, node, actions: [{label, cls, icon, close, onClick(ctx, btn)}], wide, side,
         initial (selector), returnFocus (fn returning an element), onClose (fn)} */
  function deschide(o) {
    var opener = document.activeElement;
    var id = "dlg" + ++contor;
    var deschisLa = Date.now();
    var overlay = document.createElement("div");
    overlay.className = "overlay" + (o.side ? " side" : "");
    var box = document.createElement("div");
    box.className = o.side
      ? "drawer"
      : "dialog" + (o.wide ? " wide" : "") + (o.xl ? " xl" : "");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", id + "-t");
    box.innerHTML =
      '<div class="dialog-h"><h2 class="dialog-title" id="' +
      id +
      '-t">' +
      esc(o.title || "") +
      "</h2>" +
      '<button type="button" class="x" data-x aria-label="Închide">' +
      icon("x") +
      "</button></div>" +
      '<div class="dialog-b"></div>' +
      (o.actions && o.actions.length ? '<div class="dialog-f"></div>' : "");
    var body = box.querySelector(".dialog-b");
    if (o.node) body.appendChild(o.node);
    else body.innerHTML = o.html || "";

    var inchis = false;
    var ctx = { el: box, body: body, close: inchide };
    var foot = box.querySelector(".dialog-f");
    (o.actions || []).forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + (a.cls || "ghost");
      b.innerHTML = (a.icon ? icon(a.icon) : "") + esc(a.label);
      b.addEventListener("click", function () {
        if (a.onClick) a.onClick(ctx, b);
        if (a.close) inchide();
      });
      foot.appendChild(b);
    });

    overlay.appendChild(box);
    /* A double click on the opener lands its second click on the new backdrop: ignore it
       (second click of a double click, or within 400 ms of opening). */
    var apasatPeFundal = false;
    overlay.addEventListener("mousedown", function (e) {
      apasatPeFundal =
        e.target === overlay &&
        (e.detail || 1) < 2 &&
        Date.now() - deschisLa > 400;
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay && apasatPeFundal) inchide();
      apasatPeFundal = false;
    });
    box.querySelector("[data-x]").addEventListener("click", inchide);

    function laTasta(e) {
      if (stiva[stiva.length - 1] !== ctx) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        inchide();
        return;
      }
      if (e.key !== "Tab") return;
      var f = focusabile(box);
      if (!f.length) {
        e.preventDefault();
        return;
      }
      var primul = f[0];
      var ultimul = f[f.length - 1];
      var inauntru = box.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primul || !inauntru)) {
        e.preventDefault();
        ultimul.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === ultimul || !inauntru)
      ) {
        e.preventDefault();
        primul.focus();
      }
    }
    document.addEventListener("keydown", laTasta, true);
    document.body.appendChild(overlay);
    if (stiva.length === 0) {
      var app = document.getElementById("app");
      if (app) app.inert = true;
      document.documentElement.classList.add("modal-open");
    }
    stiva.push(ctx);

    var tinta =
      (o.initial && box.querySelector(o.initial)) ||
      box.querySelector(".dialog-f .btn") ||
      box.querySelector("[data-x]");
    if (tinta) tinta.focus();

    function inchide() {
      if (inchis) return;
      inchis = true;
      document.removeEventListener("keydown", laTasta, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      var i = stiva.indexOf(ctx);
      if (i !== -1) stiva.splice(i, 1);
      if (stiva.length === 0) {
        var app = document.getElementById("app");
        if (app) app.inert = false;
        document.documentElement.classList.remove("modal-open");
      }
      if (o.onClose) o.onClose();
      var inapoi =
        (o.returnFocus && o.returnFocus()) ||
        (opener && document.contains(opener) ? opener : null);
      if (inapoi && typeof inapoi.focus === "function")
        inapoi.focus({ preventScroll: true });
    }
    return ctx;
  }

  /* E-mail preview (never sent in the demo): {catre, subiect, corp, nota}. */
  function arataEmail(email, o) {
    o = o || {};
    email = email || {};
    function rand(eticheta, val) {
      var v = Array.isArray(val) ? val.join(", ") : val;
      return (
        '<div class="mail-row"><dt>' +
        esc(eticheta) +
        "</dt><dd>" +
        esc(v || "") +
        "</dd></div>"
      );
    }
    var corp = esc(String(email.corp || "").trim());
    // Same-origin "Deschide în platformă" link becomes a real link (opens the review or report).
    var link = typeof email.link === "string" ? email.link : "";
    var acasa = window.LUCA_BAZA || window.location.origin + "/";
    if (link && (link.charAt(0) === "/" || link.indexOf(acasa) === 0)) {
      var linkEsc = esc(link);
      var ancora = '<a href="' + linkEsc + '">Deschide în platformă</a>';
      var cuEticheta = esc("Deschide în platformă: ") + linkEsc;
      if (corp.indexOf(cuEticheta) !== -1)
        corp = corp.split(cuEticheta).join(ancora);
      else if (corp.indexOf(linkEsc) !== -1)
        corp = corp.split(linkEsc).join(ancora);
    }
    var html =
      '<div class="mail"><div class="mail-top">' +
      '<span class="mail-ic">' +
      icon("mail") +
      "</span><dl>" +
      rand(
        "Către",
        email.catre_rol && email.catre
          ? email.catre_rol + " (" + email.catre + ")"
          : email.catre,
      ) +
      rand("Subiect", email.subiect) +
      "</dl></div>" +
      '<div class="mail-body just-auto" lang="ro">' +
      corp +
      "</div></div>" +
      (email.nota
        ? '<p class="mail-note">' +
          icon("info") +
          "<span>" +
          esc(email.nota) +
          "</span></p>"
        : "");
    return deschide({
      title: o.title || "Previzualizare e-mail",
      html: html,
      wide: true,
      actions: [{ label: "Închide", cls: "blue", close: true }],
      returnFocus: o.returnFocus,
    });
  }

  /* --------------------------------------------------------- app chrome */

  var ctxPromise = null;

  function context() {
    if (!ctxPromise) {
      ctxPromise = api("api/demo/context")
        .then(function (r) {
          return r.ok ? r.data : null;
        })
        .catch(function () {
          return null;
        });
    }
    return ctxPromise;
  }

  function numeUtilizator(u) {
    if (!u) return "";
    if (typeof u === "string") return u;
    return (
      u.nume_afisat ||
      u.display_name ||
      u.nume ||
      u.afisare ||
      u.name ||
      u.username ||
      ""
    );
  }

  function initChrome() {
    return context().then(function (ctx) {
      var nume = ctx ? numeUtilizator(ctx.utilizator) : "";
      var el = document.getElementById("userName");
      if (el) el.textContent = nume;
      var av = document.getElementById("userAvatar");
      if (av) {
        av.textContent = initiale(nume);
        av.hidden = !nume;
      }
      return ctx;
    });
  }

  window.LUCA = {
    api: api,
    esc: esc,
    icon: icon,
    mesajDin: mesajDin,
    mesajEroare: mesajEroare,
    asList: asList,
    ssGet: ssGet,
    ssSet: ssSet,
    ssDel: ssDel,
    ssClearPrefix: ssClearPrefix,
    fmtNr: fmtNr,
    fmtNota: fmtNota,
    cuDe: cuDe,
    nr: nr,
    shy: shy,
    stele: stele,
    bandaNota: bandaNota,
    ora: ora,
    oraZi: oraZi,
    dataRo: dataRo,
    azi: azi,
    acumOra: acumOra,
    lunaAn: lunaAn,
    limbaNume: limbaNume,
    limbaCod: limbaCod,
    langAttr: langAttr,
    cipLimba: cipLimba,
    taraNume: taraNume,
    categorieNume: categorieNume,
    motivScurt: motivScurt,
    fold: fold,
    domId: domId,
    primaLitera: primaLitera,
    initiale: initiale,
    initialeUnitati: initialeUnitati,
    clsUnitate: clsUnitate,
    avatarUnitate: avatarUnitate,
    reduceMotion: reduceMotion,
    ocupa: ocupa,
    elibereaza: elibereaza,
    toast: toast,
    deschide: deschide,
    arataEmail: arataEmail,
    context: context,
    initChrome: initChrome,
  };
})();
