/* LUCA demo, online version: the login form, checked in the browser by acces.js (no server).
   Success: session flag + the page the visitor asked for (login.html?next=...), else index.html.
   Wrong data: the page's own error message, the password field emptied. */
(function () {
  "use strict";

  var A = window.LUCA_ACCES;

  function init() {
    var form = document.getElementById("formLogin");
    var eroare = document.getElementById("eroare");
    if (!form || !A) return;
    if (A.areAcces()) {
      window.location.replace(A.urmatoarea());
      return;
    }
    var buton = form.querySelector('button[type="submit"]');
    var lucreaza = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (lucreaza) return;
      lucreaza = true;
      if (buton) buton.disabled = true;
      var u = form.querySelector('[name="username"]');
      var p = form.querySelector('[name="parola"]');
      A.verifica(u ? u.value : "", p ? p.value : "")
        .then(function (ok) {
          if (ok && A.intra()) {
            window.location.replace(A.urmatoarea());
            return;
          }
          if (eroare) eroare.hidden = false;
          if (p) {
            p.value = "";
            p.focus();
          }
        })
        .catch(function () {
          if (eroare) eroare.hidden = false;
        })
        .then(function () {
          lucreaza = false;
          if (buton) buton.disabled = false;
        });
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
