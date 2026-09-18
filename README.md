# Mathorizon

Platformă de pregătire pentru BAC la matematică.

## Rulare locală

Un singur server de dezvoltare, care servește atât fișierele statice cât și
rutele `/api/*`:

```bash
node server.js
# sau
npm start
```

La pornire, terminalul afișează URL-ul de deschis și confirmă că API-ul e activ:

```
  Mathorizon dev server
  → open:  http://localhost:8080
  → API:   enabled  (all /api/* routes are live on this port)
```

Deschide **http://localhost:8080**.

> Nu mai există un al doilea server static-only (`devserver.js`). Exista
> anterior pentru servire rapidă de fișiere statice, dar nu avea rutele
> `/api/*` — orice funcționalitate care depinde de backend (ex: formularul de
> waitlist) dădea 404 pe acel port. A fost eliminat ca să nu mai existe
> ambiguitate despre „pe care server rulez".

## Pagina Capitole — React + TypeScript

Paginile sunt în continuare fișiere `.html` statice. Singura excepție e
**capitole.html**, unde tot conținutul de sub bara de navigare (hero,
statistici, cardurile de capitole, banner-ul Simulare BAC) e o „insulă"
React montată în `<div id="root">`. Restul taburilor (Simulare, Antrenament,
Clase, Pachete) rămân vanilla; bara de navigare e comună tuturor și nu e
migrată.

- sursa: `src/capitole/` (React 19 + TypeScript, Framer Motion, lucide-react)
- build: `npm run build:react` → `assets/react/capitole-<hash>.js|css`
- în timpul dezvoltării: `npm run dev:react` (rebuild la fiecare salvare)
- verificare de tipuri: `npm run typecheck`

Bundle-ul din `assets/react/` **se comite în git**: producția servește
fișierele din repo, fără pas de build. Scriptul de build e denumit
`build:react`, nu `build`, tocmai ca hostingul static să nu-l pornească
singur la deploy și să schimbe felul în care e publicat site-ul.

Numele fișierelor conțin un hash de conținut, așa că tag-urile
`<link>`/`<script>` din capitole.html sunt **generate**: după fiecare build,
`scripts/sync-react-tags.js` rescrie blocurile marcate cu
`REACT-ISLAND-CSS` / `REACT-ISLAND-JS`. Nu le edita manual — și nu șterge
comentariile-marker, fără ele scriptul se oprește cu eroare.

Datele sunt aceleași ca înainte: React citește prin `window.BM`
(`js/data.js`, `js/storage.js`) și se reîmprospătează pe evenimentele
`bmauth:synced` / `bmauth:streak-updated` emise de `js/auth.js`, care e cel
care sincronizează Supabase → localStorage pe toate paginile. Nu există un
al doilea strat de acces la Supabase în `src/`.

## Variabile de mediu

`server.js` citește `.env` (via `dotenv`). Cheile necesare pentru rutele API:

- `GEMINI_API_KEY` — generare exerciții (Gemini)
- `SUPABASE_SERVICE_ROLE_KEY` — operații server-side pe Supabase (înregistrare
  cu nume de utilizator, waitlist, citire date admin)

Opționale, pentru reglarea apelurilor Gemini (`api/_gemini-retry.js`):

- `GEMINI_TIMEOUT_MS` — limita unei singure încercări (implicit `90000`).
  Ține-o sub `maxDuration` al funcției de pe host (ex. `50000` la o limită de
  60s), ca eroarea noastră în română să ajungă la browser înaintea paginii de
  504 a gateway-ului.
- `GEMINI_BUDGET_MS` — limita totală a unui apel, cu tot cu reîncercări
  (implicit `200000`).
- `GEMINI_RETRIES` — câte reîncercări după prima (implicit `1`).

Verificarea planului cheii:

```bash
node scripts/check-gemini-key.js              # doar validează cheia (gratis)
node scripts/check-gemini-key.js --generate   # + o generare reală, arată tier-ul
```

> **Atenție la planul cheii Gemini.** Pe planul gratuit, `gemini-3.5-flash`
> permite ~20 de cereri **pe zi** per proiect, iar cererile sunt servite cu
> prioritate scăzută (același apel poate dura 8s sau 250s). Când cota zilnică
> se termină, API-ul răspunde 429 și platforma afișează mesajul
> „Cota ZILNICĂ Gemini a fost epuizată…". Facturarea se activează pe proiectul
> Google AI Studio căruia îi aparține cheia.

- `PORT` — portul serverului de dezvoltare (implicit `8080`).
