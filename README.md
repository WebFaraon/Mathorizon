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
