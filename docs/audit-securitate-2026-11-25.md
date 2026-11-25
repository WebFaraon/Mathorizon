# Audit de securitate, 25 noiembrie 2026

Făcut doar prin citire: codul, baza de date reală (numai interogări de citire), funcțiile de pe server și site-ul public. Nu s-a atacat nimic și nu s-a scris nimic în baza de date.

## Ce s-a găsit și ce s-a făcut

| # | Gravitate | Problema | Stare |
|---|---|---|---|
| 1 | Mare | Textul exercițiilor (enunț, soluție, barem) și figurile se afișau ca HTML brut. Un cont de profesor rău intenționat putea ascunde cod într-un exercițiu și acesta rula în browserul oricărui elev care îl deschidea (cu acces la sesiunea lui). | Reparat în cod (`BM.sanitizeHtml`, `BM.sanitizeSvg` în `js/utils.js`). Intră în vigoare la publicare. |
| 2 | Mare | Funcția de notificări `send-class-push` nu verifica cine o cheamă. Cu cheia publică a site-ului, oricine putea trimite orice text, în numele oricui, către toți elevii unei clase. | Reparat în cod: cere cont conectat, membru al clasei; temele și simulările doar profesorul sau adminul; numele afișat e al celui care trimite. **Trebuie pusă pe server** (comanda mai jos). |
| 3 | Mediu | Un elev își putea scrie singur oricâte tokenuri de simulare dorea (`exam_tokens`). | Migrare: numărul poate doar să scadă pentru un elev. |
| 4 | Mediu | Un elev putea scrie singur nota și confirmarea la propria temă predată. | Migrare: elevul poate schimba doar fișierele lui. |
| 5 | Mediu | XP, serie și misiuni sunt scrise direct de browser, deci un elev priceput își poate trișa locul în clasament. Nu afectează bani sau date ale altora. | NU reparat: cere funcții pe server care acordă XP (decizie de proiectare, de făcut înainte să existe premii reale). |
| 6 | Mediu | Crearea de conturi nu are nicio limită sau verificare anti-robot (nume de utilizator și Google). | NU reparat: se pornește CAPTCHA în Supabase (Authentication, Attack Protection). |
| 7 | Mediu | Lipseau antetele de securitate ale site-ului (nu putea fi pus într-un cadru străin, tipuri de fișiere, politica de referință). | Reparat: fișierul nou `vercel.json`. |
| 8 | Mic | Protecția împotriva parolelor compromise e oprită în Supabase. | De pornit din panou (Authentication, Passwords); poate cere planul Pro. |
| 9 | Mic | `handle_new_user` și `rls_auto_enable` puteau fi chemate de oricine; 17 funcții fără schemă fixată. | Migrare. |
| 10 | Mic | Spațiile `avatars` și `assignment-files` sunt publice și fără limită de mărime. | Migrare: limite de mărime. Pozele temelor rămân publice (adresă greu de ghicit): ideal ar fi private, cu adrese temporare, dar asta schimbă cod. |
| 11 | Mic | `plan-dezvoltare.html` e public (nu e legat de nicăieri) și arată cifre de afacere. | De hotărât: scos sau pus în spatele contului de admin. |
| 12 | Mic | Funcțiile `registru-apply`, `registru-replace`, `registru-config` compară cheia cu `===` (nu în timp constant, `registru-sync` și `telegram-bot` o fac corect). | Risc foarte mic; se repară la următoarea modificare a acestor funcții. |
| 13 | Mic | Patru rute `api/` întorc textul brut al erorii; `Access-Control-Allow-Origin: *` pe rutele și funcțiile care se autentifică cu jeton (fără cookie-uri, deci risc mic). | Doar `register-username` repară acum mesajul. |

## Ce e în regulă (verificat)

- **Chei secrete:** în codul trimis în browser și în toate cele 678 de commit-uri nu apare nicio cheie secretă, nicio cheie privată Google, niciun token de bot. Singura cheie găsită e cea „anon” a Supabase, care e publică prin construcție (apare în F12 la orice site Supabase); ce o face sigură sunt regulile din baza de date. Cheia `service_role` și celelalte sunt doar variabile de mediu pe server (Vercel și Supabase), stocate criptat de acești furnizori.
- **Fișiere private pe site:** `.env`, `CLAUDE.md`, `supabase/`, `package.json`, scripturile Apps Script dau 404 pe site.
- **Baza de date:** toate tabelele au reguli RLS; vizitatorii fără cont nu au drept pe nicio tabelă în afară de exerciții și grilele pregătite; un utilizator nu poate schimba singur rolul sau statusul (nu are drept de actualizare pe profil, iar la creare un profesor sau manager intră „în așteptare”).
- **SQL injection:** cererile prin site sunt parametrizate. Singura evaluare dinamică pe date de la utilizator este corectarea răspunsurilor la simulări (`_sim_eval_expr`): acceptă doar cifre, `+ - * / ^ ( )`, `sqrt` și `pi`, fără ghilimele, spații sau punct și virgulă, deci nu se poate injecta nimic; puteri uriașe sunt oprite de baza de date în aproximativ 75 ms.
- **Funcțiile de pe server fără jeton Supabase:** fiecare își verifică singură apelantul (cheie secretă sau cont de admin/manager activ). `send-class-push` era singura fără.
- **Conectarea cu Google:** `oauth-guard` verifică pe server jetonul și șterge doar contul creat chiar atunci de acea conectare.
- **Transfer:** tot traficul e prin HTTPS (HSTS activ).

## Ce NU s-a putut verifica

- Setările din panourile Supabase și Vercel (adrese de redirecționare Google, durata sesiunilor, CAPTCHA, valorile variabilelor de mediu).
- Politicile pe canalele private ale tablei (`realtime.messages`) și pe spațiul `wb-files`: scrise, dar neexersate cu conturi reale.
- Nicio încercare de atac real asupra site-ului.

## De făcut de utilizator

1. Rulează migrarea `supabase/migrations/20261125100000_securizare_audit.sql` în SQL Editor, apoi interogarea de verificare de la sfârșitul fișierului (trebuie să dea zero rânduri).
2. Pune funcția pe server:
   `npx supabase functions deploy send-class-push --project-ref tfflpivehrrzmklvcyhe --use-api`
   (aceasta rămâne cu verificarea de jeton Supabase, fără `--no-verify-jwt`, ca până acum).
3. Din panoul Supabase: pornește CAPTCHA și protecția împotriva parolelor compromise.
