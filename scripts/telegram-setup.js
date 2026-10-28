/* One-time setup of the Telegram bot, after BotFather made it.
     1. BotFather: /newbot, then the token it gives goes in .env as TELEGRAM_BOT_TOKEN=...  (the file stays local, it is not in git)
     2. node scripts/telegram-setup.js
   What it does: asks Telegram who the bot is (getMe), makes the webhook's secret (kept in _import/telegram-webhook-secret.txt), points the webhook at the
   telegram-bot function, sets the bot's commands and description, writes the bot's name in the database (the profile page builds the t.me link from it), and
   writes two local files for the steps that need the secrets:
     _import/telegram-secrets-command.txt   the `supabase secrets set` command with the real values
     _import/cron-telegram-dispatch.sql     the pg_cron job (every minute) to run once in the Supabase SQL editor
   It prints no secret. Run it again any time (it reuses the webhook secret). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
require(path.join(root, 'node_modules', 'dotenv')).config({ path: path.join(root, '.env') });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL_ = process.env.SUPABASE_URL || 'https://tfflpivehrrzmklvcyhe.supabase.co';
const REF = URL_.replace(/^https:\/\//, '').split('.')[0];
if (!TOKEN) { console.error('Lipsește TELEGRAM_BOT_TOKEN din .env (tokenul de la BotFather).'); process.exit(1); }
if (!SK) { console.error('Lipsește SUPABASE_SERVICE_ROLE_KEY din .env.'); process.exit(1); }

const tg = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(`${method}: ${j.description || r.status}`);
  return j.result;
};

(async () => {
  const me = await tg('getMe');
  console.log('Botul:', '@' + me.username, '(' + me.first_name + ')');

  const secretFile = path.join(root, '_import', 'telegram-webhook-secret.txt');
  let secret = fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : '';
  if (!secret) { secret = crypto.randomBytes(30).toString('hex'); fs.writeFileSync(secretFile, secret + '\n'); console.log('Secretul webhook-ului a fost făcut (în _import/telegram-webhook-secret.txt).'); }

  const hook = `${URL_}/functions/v1/telegram-bot`;
  await tg('setWebhook', { url: hook, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
  console.log('Webhook:', hook);

  await tg('setMyCommands', { commands: [
    { command: 'start', description: 'Conectează contul Mathorizon' },
    { command: 'ajutor', description: 'Ce face botul' },
    { command: 'stop', description: 'Oprește mesajele' }
  ] });
  await tg('setMyDescription', { description: 'Botul Mathorizon. Îți scriu când o grupă a ta e gata de start și te întreb dacă confirmi startul.' }).catch(() => {});
  await tg('setMyShortDescription', { short_description: 'Confirmi startul grupelor tale.' }).catch(() => {});

  const r = await fetch(`${URL_}/rest/v1/telegram_bot?on_conflict=id`, { method: 'POST', headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, username: me.username, set_at: new Date().toISOString() }) });
  console.log(r.ok ? 'Numele botului e în baza de date.' : 'NU am putut scrie numele botului în baza de date (' + r.status + '): rulează migrarea 20261029120000_telegram_starturi.sql și repetă scriptul.');

  let syncSecret = '';
  try { syncSecret = fs.readFileSync(path.join(root, '_import', 'reg-sync-secret.txt'), 'utf8').trim(); } catch (e) { /* the cron file below says so */ }
  fs.writeFileSync(path.join(root, '_import', 'telegram-secrets-command.txt'), `npx supabase secrets set TELEGRAM_BOT_TOKEN=${TOKEN} TELEGRAM_WEBHOOK_SECRET=${secret} --project-ref ${REF}\n`);
  fs.writeFileSync(path.join(root, '_import', 'cron-telegram-dispatch.sql'), syncSecret
    ? `select cron.unschedule('telegram-dispatch') where exists (select 1 from cron.job where jobname = 'telegram-dispatch');\n\nselect cron.schedule(\n  'telegram-dispatch',\n  '* * * * *',\n  $$ select net.http_post(\n       url := '${URL_}/functions/v1/telegram-bot',\n       headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', '${syncSecret}'),\n       body := '{"action":"dispatch"}'::jsonb\n     ) $$\n);\n`
    : '-- Lipsește _import/reg-sync-secret.txt: pune în x-sync-secret aceeași valoare ca la cron-ul registru-sync.\n');
  console.log('\nGata. Fișiere locale făcute (nu intră în git):');
  console.log('  _import/telegram-secrets-command.txt  -> rulează comanda din el în terminal');
  console.log('  _import/cron-telegram-dispatch.sql    -> rulează-l o dată în Supabase SQL');
  console.log('Apoi, în profilul unui profesor: „Conectează Telegram”.');
})().catch(e => { console.error('Eroare:', e.message); process.exit(1); });
