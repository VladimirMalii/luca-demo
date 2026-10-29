# LUCA · Recenzii & reputație: versiunea online de prezentare

Copie statică a simulatorului demo LUCA, pentru GitHub Pages
(`https://vladimirmalii.github.io/luca-demo/`). Aceleași ecrane, același aspect și aceleași
reguli ca demonstrația locală: recenzii, propunerea sistemului cu analiza, aprobare, publicare
simulată, fluxul pentru recenzii sensibile cu e-mailul de verificare internă, istoric, memoria
rețelei, rapoarte pe rețea și pe unități, export Excel.

## Ce conține și ce nu conține

- Doar fișiere statice: pagini HTML, CSS, JavaScript de interfață, fonturi locale și un
  instantaneu de date (`data/demo-data.js`, plus fișierul Excel din `data/`).
- Datele sunt cele 50 de recenzii publice Google ale celor 10 unități LUCA, culese pe
  29.10.2026, cu recenzenții reduși la inițiale, și rapoartele pregătite pe ele.
- Propunerile de răspuns și analizele au fost pregătite de sistem dinainte, pe aceleași recenzii
  publice. În platformă, generarea rulează live. O bară de informare spune acest lucru pe fiecare
  pagină.
- NU conține codul platformei (server, integrarea cu Google, baza de date), instrucțiunile
  modelului AI, chei sau alte date de acces. Nu face nicio cerere în afara site-ului: fără CDN,
  fără analytics, fără API extern.
- Nimic nu se publică și niciun e-mail nu pleacă: totul rulează în browser.

## Cum funcționează

- `static/mock-api.js` răspunde în browser la aceleași cereri ca serverul demo (`api/...`), cu
  aceleași stări, mesaje și coduri. Starea demonstrației (propuneri, aprobări, verificări,
  istoric, memoria rețelei) se păstrează în `sessionStorage`, doar în fila respectivă, și revine la
  starea inițială cu „Resetează demonstrația”.
- „Regenerează” afișează aceeași propunere pregătită (versiunea online are o singură variantă
  pentru fiecare recenzie) și spune asta pe ecran.
- Exportul Excel descarcă fișierul pregătit din `data/`, la starea inițială a demonstrației.
- `static/acces.js` și `static/login.js`: o parolă simplă, verificată în browser, care ține
  departe vizitatorii întâmplători. Nu este un mecanism de securitate. Parola nu apare în
  fișiere, doar amprenta ei SHA-256.
- Fiecare pagină are `noindex, nofollow`; `robots.txt` interzice indexarea.

Softmed Labs · demonstrație online · recenzii publice Google culese pe 29.10.2026
