/* What the service account can see in Drive: names only (no content). node scripts/registru-import/google/whoami.js */
'use strict';
const { api } = require('./auth');
(async () => {
  const q = new URLSearchParams({ fields: 'files(id,name,mimeType,owners(emailAddress),capabilities(canEdit,canAddChildren),parents)', pageSize: '100', q: 'trashed=false' });
  const r = await api('GET', 'https://www.googleapis.com/drive/v3/files?' + q);
  if (!r.files.length) console.log('Contul nu vede niciun fișier: partajările nu au ajuns.');
  r.files.forEach(f => console.log(`${f.mimeType.includes('folder') ? 'FOLDER' : f.mimeType.includes('spreadsheet') ? 'SHEET ' : 'FILE  '} ${f.name} | editare: ${f.capabilities.canEdit ? 'da' : 'nu'} | proprietar: ${(f.owners || []).map(o => o.emailAddress).join(',')} | ${f.id}`));
})().catch(e => { console.error(e.message); process.exit(1); });
