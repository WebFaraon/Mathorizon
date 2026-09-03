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
