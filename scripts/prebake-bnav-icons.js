#!/usr/bin/env node
'use strict';
/* Rewrites the ICON table of js/bnav.js (the seven tab pictures as data URIs) from assets/images/tabs/*.svg.
   Run it after changing one of those SVG files:  node scripts/prebake-bnav-icons.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const tabs = ['profil', 'invata', 'exercitii', 'simulare', 'antrenament', 'clase', 'misiuni'];
const file = path.join(root, 'js', 'bnav.js');
let js = fs.readFileSync(file, 'utf8');
const nl = js.includes('\r\n') ? '\r\n' : '\n';
const rows = tabs.map((t) => `    '${t}': 'data:image/svg+xml;base64,${fs.readFileSync(path.join(root, 'assets', 'images', 'tabs', t + '.svg')).toString('base64')}'`);
const re = /(  var ICON = \{\r?\n)[\s\S]*?(\r?\n  \};)/;
if (!re.test(js)) { console.error('ICON table not found in js/bnav.js'); process.exit(1); }
js = js.replace(re, (_, a, b) => a + rows.join(',' + nl) + b);
fs.writeFileSync(file, js);
console.log('js/bnav.js updated');
