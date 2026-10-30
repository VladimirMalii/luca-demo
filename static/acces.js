/* LUCA demo, online version: simple access gate (owner decision). It only keeps casual visitors
   out: the check runs in the browser, so it is NOT security. The password is never stored here,
   only a salted SHA-256 fingerprint. Loaded synchronously first on every page:
   - protected pages (no data-pagina="login" on this script): without the session flag the browser
     goes to login.html?next=<this page>, also when the page comes back from the back/forward cache;
   - "Ieșire" (a form with data-iesire) clears the flag and returns to login.html.
   Exposed as window.LUCA_ACCES for login.js and the mock API. */
(function () {
  "use strict";

  var CHEIE = "luca-online-acces";
  var UTILIZATOR = "demo";
  var SARE = "luca-demo-online|";
  var AMPRENTA =
    "39a582425c5633e3d4ce79bda95f0d391d57894ffcf391bfba149dc71d9acb95";
  /* The pages login.html may send the visitor to (relative, same folder). */
  var PAGINI = /^(index|rapoarte|raport)\.html(\?[^#]*)?(#.*)?$/;

  var script = document.currentScript;
  var publica = !!(script && script.getAttribute("data-pagina") === "login");

  function areAcces() {
    try {
      return window.sessionStorage.getItem(CHEIE) === "1";
    } catch (e) {
      return false;
    }
  }

  function intra() {
    try {
      window.sessionStorage.setItem(CHEIE, "1");
      return true;
    } catch (e) {
      return false;
    }
  }

  function iese() {
    try {
      window.sessionStorage.removeItem(CHEIE);
    } catch (e) {
      /* storage blocked: nothing to clear */
    }
  }

  function paginaCurenta() {
    var p = window.location.pathname.split("/").pop() || "index.html";
    return p + window.location.search + window.location.hash;
  }

  function urmatoarea() {
    var n = "";
    try {
      n = new URLSearchParams(window.location.search).get("next") || "";
    } catch (e) {
      n = "";
    }
    return PAGINI.test(n) ? n : "index.html";
  }

  function spreLogin() {
    document.documentElement.style.visibility = "hidden";
    var p = paginaCurenta();
    window.location.replace(
      "login.html" + (PAGINI.test(p) ? "?next=" + encodeURIComponent(p) : ""),
    );
  }

  /* ---------------------------------------------------------------- SHA-256 */

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  /* Pure JS fallback (a page opened from disk or over plain http has no crypto.subtle). */
  function sha256Js(bytes) {
    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ];
    var l = bytes.length;
    var n = ((l + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(n);
    m.set(bytes);
    m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(n - 8, Math.floor((l * 8) / 4294967296));
    dv.setUint32(n - 4, (l * 8) >>> 0);
    var w = new Array(64);
    for (var off = 0; off < n; off += 64) {
      var i;
      for (i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = H[0];
      var b = H[1];
      var c = H[2];
      var d = H[3];
      var e = H[4];
      var f = H[5];
      var g = H[6];
      var h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }
    return H.map(function (x) {
      return ("00000000" + x.toString(16)).slice(-8);
    }).join("");
  }

  function hex(buf) {
    return Array.prototype.map
      .call(new Uint8Array(buf), function (x) {
        return ("0" + x.toString(16)).slice(-2);
      })
      .join("");
  }

  function sha256(text) {
    var bytes = new TextEncoder().encode(text);
    var subtle = window.crypto && window.crypto.subtle;
    if (subtle && window.isSecureContext !== false) {
      return subtle.digest("SHA-256", bytes).then(hex, function () {
        return sha256Js(bytes);
      });
    }
    return Promise.resolve(sha256Js(bytes));
  }

  /* Promise<boolean>: user "demo" (any case, spaces trimmed) and the password's fingerprint. */
  function verifica(utilizator, parola) {
    if (
      String(utilizator || "")
        .trim()
        .toLowerCase() !== UTILIZATOR
    )
      return Promise.resolve(false);
    return sha256(SARE + String(parola || "")).then(function (h) {
      return h === AMPRENTA;
    });
  }

  window.LUCA_ACCES = {
    cheie: CHEIE,
    areAcces: areAcces,
    intra: intra,
    iese: iese,
    verifica: verifica,
    urmatoarea: urmatoarea,
    _sha256Js: sha256Js,
  };

  if (publica) return;

  if (!areAcces()) {
    spreLogin();
    return;
  }
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && !areAcces()) spreLogin();
  });
  document.addEventListener(
    "submit",
    function (e) {
      var f = e.target;
      if (!f || !f.hasAttribute || !f.hasAttribute("data-iesire")) return;
      e.preventDefault();
      iese();
      window.location.replace("login.html");
    },
    true,
  );
})();
