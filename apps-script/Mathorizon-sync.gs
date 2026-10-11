/**
 * Mathorizon: citirea registrelor in secunde, nu in minute (docs/apps-script.md).
 *
 * Un proiect Apps Script SEPARAT, al contului de administrare (nu e in registrele profesorilor: profesorii nu il vad si nu stiu cheia).
 * Pentru fiecare registru din lista are un declansator "la editare": cand cineva schimba o celula, scriptul spune platformei ce fila s-a schimbat
 * (functia Supabase `registru-sync`), iar platforma citeste doar acea fila (cam o secunda). Daca platforma nu raspunde, nu se pierde nimic: cron-ul
 * ei citeste oricum registrele in cateva minute (si fila noua, randurile inserate, formatarea se vad la cron, nu au nevoie de script).
 *
 * Setari (Setarile proiectului > Proprietati script):
 *   HOOK_URL     https://tfflpivehrrzmklvcyhe.supabase.co/functions/v1/registru-sync
 *   HOOK_SECRET  cheia registrelor (REG_HOOK_SECRET din Supabase); poate cere doar citirea unui registru, nimic altceva
 *   REGISTERS    lista de registre ale acestui proiect, ca JSON: ["<id fisier Google>", ...]  (cel mult 20: Google da 20 de declansatoare per proiect, unul pe registru)
 *
 * Functii de rulat din editor, in ordine: testPing, installTriggers. Apoi status oricand. removeTriggers le scoate.
 */

var WINDOW_MS = 3000;          // cate o citire la cel mult 3 secunde pentru aceeasi fila; editarile dintre ele se aduna intr-o singura citire
var MAX_TRIGGERS = 20;          // limita Google: declansatoare per utilizator per proiect

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }

function registers_() {
  var raw = prop_('REGISTERS');
  if (!raw) throw new Error('Lipseste proprietatea REGISTERS (lista de registre, JSON).');
  var list = JSON.parse(raw);
  if (!Array.isArray(list) || !list.length) throw new Error('REGISTERS trebuie sa fie o lista de id-uri de registre.');
  return list.map(String);
}

/* ---------------- ce se intampla la o editare ---------------- */

/** Declansator "la editare": o celula s-a schimbat intr-un registru. */
function onSheetEdit(e) {
  if (!e || !e.range || !e.source) return;
  var sheet = e.range.getSheet();
  notify_(e.source.getId(), { sheet_id: sheet.getSheetId(), tab: sheet.getName() }, 'e' + sheet.getSheetId());
}

/**
 * Trimite cererea, dar nu mai des de o data pe WINDOW_MS pentru aceeasi fila. Prima editare pleaca imediat. Daca vin altele in fereastra, UN singur
 * executie asteapta pana la capatul ferestrei si trimite pentru toate (celelalte se opresc pe loc: nu ocupa executii care dorm, limita Google e 30).
 */
function notify_(spreadsheetId, what, slot) {
  var cache = CacheService.getScriptCache(), lock = LockService.getScriptLock();
  var key = spreadsheetId + '|' + slot, role = 'send', waitMs = 0;
  if (lock.tryLock(3000)) {
    try {
      var now = Date.now(), last = Number(cache.get('sent|' + key) || 0);
      if (cache.get('sleep|' + key)) { cache.put('dirty|' + key, '1', 60); role = 'skip'; }
      else if (now - last >= WINDOW_MS) { cache.put('sent|' + key, String(now), 120); }
      else { cache.put('sleep|' + key, '1', 30); role = 'wait'; waitMs = WINDOW_MS - (now - last); }
    } finally { lock.releaseLock(); }
  }
  if (role === 'skip') return;
  if (role === 'wait') {
    Utilities.sleep(waitMs);
    cache.remove('dirty|' + key);
    cache.put('sent|' + key, String(Date.now()), 120);
  }
  post_(spreadsheetId, what);
  if (role === 'wait') {
    // o editare venita in timp ce se trimitea: inca o citire, ca ultima schimbare sa nu ramana afara
    if (cache.get('dirty|' + key)) { cache.remove('dirty|' + key); Utilities.sleep(1000); post_(spreadsheetId, what); }
    cache.remove('sleep|' + key);
  }
}

function post_(spreadsheetId, what) {
  var body = { spreadsheet_id: spreadsheetId };
  for (var k in what) body[k] = what[k];
  body.force = true;
  var props = PropertiesService.getScriptProperties();
  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      var res = UrlFetchApp.fetch(prop_('HOOK_URL'), {
        method: 'post', contentType: 'application/json', headers: { 'x-hook-secret': prop_('HOOK_SECRET') },
        payload: JSON.stringify(body), muteHttpExceptions: true
      });
      var code = res.getResponseCode();
      if (code >= 200 && code < 300) { props.setProperty('LAST', new Date().toISOString() + ' ok ' + code + ' ' + (what.tab || 'registru intreg')); return; }
      props.setProperty('LAST', new Date().toISOString() + ' EROARE ' + code + ' ' + String(res.getContentText()).slice(0, 200));
      if (code < 500) return;                         // cheie gresita sau cerere refuzata: a doua incercare nu ajuta
    } catch (err) {
      props.setProperty('LAST', new Date().toISOString() + ' EROARE ' + String(err).slice(0, 200));
    }
    Utilities.sleep(800);
  }
}

/* ---------------- instalare ---------------- */

/** Verifica adresa si cheia cu o cerere inofensiva (citirea completa a primului registru din lista). */
function testPing() {
  var id = registers_()[0];
  var res = UrlFetchApp.fetch(prop_('HOOK_URL'), {
    method: 'post', contentType: 'application/json', headers: { 'x-hook-secret': prop_('HOOK_SECRET') },
    payload: JSON.stringify({ spreadsheet_id: id, full: true }), muteHttpExceptions: true
  });
  Logger.log('HTTP ' + res.getResponseCode() + ' ' + String(res.getContentText()).slice(0, 300));
  if (res.getResponseCode() === 401) throw new Error('Cheia (HOOK_SECRET) nu e primita de platforma.');
}

/** Pune un declansator "la editare" pe fiecare registru din lista. Poate fi rulata din nou: nu dubleaza nimic. */
function installTriggers() {
  var ids = registers_();
  if (ids.length > MAX_TRIGGERS) throw new Error('Un proiect are loc de ' + MAX_TRIGGERS + ' registre. Ai ' + ids.length + ': imparte lista in mai multe proiecte (npm run apps-script:lists).');
  removeTriggers();
  ids.forEach(function (id) {
    var ss = SpreadsheetApp.openById(id);                   // arunca daca contul nu are acces la registru
    ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  });
  Logger.log('Declansatoare puse pentru ' + ids.length + ' registre.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'onSheetEdit') ScriptApp.deleteTrigger(t);
  });
}

/** Cate declansatoare sunt, cate registre in lista, ultimul raspuns al platformei. */
function status() {
  var n = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'onSheetEdit'; }).length;
  Logger.log('Registre in lista: ' + registers_().length + ' | declansatoare: ' + n + ' (asteptat ' + registers_().length + ')');
  Logger.log('Ultimul apel: ' + (prop_('LAST') || '(niciunul inca)'));
}
