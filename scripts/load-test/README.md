# Test de încărcare: câte persoane suportă platforma în același timp

Două teste și o verificare a instrumentelor. **Se rulează doar pe un proiect Supabase separat, făcut pentru test, niciodată pe cel real** (scripturile refuză să pornească dacă adresa e cea a proiectului real).

| Test | Ce măsoară | Comandă |
|---|---|---|
| Tabla live | Câte conexiuni și câte mesaje pe secundă ține Supabase când mai multe clase scriu pe tablă în același timp: conectări reușite, întârzierea unui mesaj de la profesor la elevi, mesaje pierdute, erorile serverului | `npm run load:live` |
| Cereri obișnuite | Cât de repede răspunde baza de date când mulți elevi fac lecții în același timp (profil, progres, XP, serie, clasament) | `npm run load:rest` |
| Verificarea instrumentelor | Pornește un server fals pe calculatorul tău și arată că măsurătorile sunt corecte (nu spune nimic despre Supabase) | `npm run load:selftest` |

## Pregătire (o singură dată)

1. În Supabase creează un proiect nou, de exemplu `teorema-test` (regiune: aceeași, `eu-central-1`).
2. Planul contează: **limitele sunt ale planului proiectului de test**. Ca să afli ce suportă planul Pro, treci proiectul de test pe Pro (se plătește pe zile), rulezi testele și apoi îl ștergi. Pe Free vezi limitele planului gratuit.
3. Din Settings, API ia adresa (`SUPABASE_URL`) și cheia publică (`SUPABASE_ANON_KEY`). Pentru testul de cereri mai ai nevoie și de cheia de serviciu (`SUPABASE_SERVICE_KEY`), a proiectului **de test**. Nu le pune în fișiere din repo: le dai doar în terminal.
4. Pentru testul de cereri aplici migrările din `supabase/migrations` pe proiectul de test, în ordine (`npx supabase link --project-ref <proiectul-de-test>` apoi `npx supabase db push`, sau pe rând din SQL Editor). Pentru testul tablei live nu e nevoie de nimic.
5. Calculatorul de pe care rulezi: laptop sau server cu internet bun, pe cablu dacă se poate. Peste 500 de conexiuni deodată pe Linux sau Mac: `ulimit -n 4096` înainte de rulare. Urmărește procesorul: dacă e la 100%, numerele ies mai rele decât sunt (calculatorul de test e limita, nu Supabase).

## Testul tablei live

```bash
export SUPABASE_URL=https://<proiectul-de-test>.supabase.co
export SUPABASE_ANON_KEY=<cheia publica>
npm run load:live -- --steps 2,5,10,15,20,30 --students 20 --duration 90
```

Fiecare pas pornește N clase, fiecare cu 1 profesor și 20 de elevi (conexiuni separate, ca niște browsere). Profesorul scrie 35% din timp, la 25 de mesaje pe secundă cât scrie (ca tabla reală). Testul crește pașii până când se pierd peste 5% din mesaje, întârzierea p95 trece de 1,5 secunde sau peste 2% din conexiuni eșuează. Pot fi schimbate: `--duty 0.6` (profesorul scrie mai mult), `--writers 0.2` (20% din elevi scriu și ei), `--stop-loss`, `--stop-p95`.

**Cum citești rezultatul.** La final scrie "Ultimul pas în regulă: N clase (M persoane)". Asta e numărul de spus. Coloana `trimise_pe_sec` e câte mesaje trimit clienții, `primite_pe_sec` e câte mesaje ajung la destinatari: dacă pașii se strică când crește `primite_pe_sec` și nu `trimise_pe_sec`, limita numără și destinatarii. Erorile serverului (de exemplu limita de mesaje sau de conexiuni) apar sub tabel.

## Testul de cereri

```bash
export SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=...
npm run load:rest -- --seed 100          # o singura data: face 100 de conturi de test
npm run load:rest -- --steps 25,50,100,200,400 --duration 60
```

Fiecare elev virtual deschide pagina (profil, progres, clasament de două ori ca pe site), apoi termină lecții (acordare de XP, scriere de progres, serie) la 40 până la 80 de secunde. Jetoanele conturilor sunt valabile cam o oră (apoi refaci `--seed`). Cu `--think 0.25` ritmul e de patru ori mai des (test de stres). Conturile sunt `lt-N@loadtest.invalid`; proiectul de test se șterge la sfârșit.

**Cum citești rezultatul.** Coloanele `p95_ms` și `erori_pct`: sub 500 ms și 0% erori e foarte bine, peste 1500 ms sau peste 2% erori e limita. `clasament_p95_ms` arată cererea cea mai grea. Codurile `429` înseamnă limită de cereri, `5xx` înseamnă baza de date suprasolicitată.

## Ce NU acoperă

- **Corectarea cu AI la simulări** (30 de simulări terminate deodată): lovește Gemini și funcțiile Vercel, costă bani și are nevoie de o cheie de test. Se face separat, cu 5 până la 10 apeluri deodată, pe un deploy de test.
- Postgres Changes cu utilizatori reali în clase (inserarea unui rând pe tablă). Mesajele "live" ale tablei (cele mai multe) sunt acoperite; scrierea liniilor terminate (aproximativ una pe secundă pe clasă) nu.
- Un test cu browsere reale (desenatul efectiv pe tablă). Aici se măsoară serverul, nu telefonul sau laptopul elevului.
- Rețele proaste (telefoane cu semnal slab): toți clienții de test au internetul calculatorului de test.

## După test

Șterge proiectul de test (Settings, General, Delete project) ca să nu mai fie plătit. Fișierele `rezultat-*.json` și `.tokens.json` din acest director nu intră în git.
