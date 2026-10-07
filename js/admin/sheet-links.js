/* Group -> Google Sheets register (workbook id + tab id). Written by scripts/registru-import/google/build-registers.js for the demo registers;
   with the real registers the sync fills the same shape. A group or teacher without an entry has no register yet. */
(function () {
  const L = window.AdminSheetLinks = {
 "groups": {
  "g017": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1039537573,
   "tab": "Marți/Joi 16:00-18:00 (Vară)"
  },
  "g010": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1200769721,
   "tab": "Miercuri/Vineri 09:00-11:00"
  },
  "g143": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1205135264,
   "tab": "Miercuri 11:00-12:00"
  },
  "g003": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1425008692,
   "tab": "Miercuri/Vineri 12:00-13:00"
  },
  "g038": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1978948101,
   "tab": "Miercuri 15:00-17:00 (Vară)"
  },
  "g126": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 816573670,
   "tab": "Joi 09:00-10:00"
  },
  "g182": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 32781272,
   "tab": "Joi 11:00-12:00 (Vară)"
  },
  "g092": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 618451388,
   "tab": "Vineri 16:00-17:00"
  },
  "g156": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1788028187,
   "tab": "Vineri 19:00-20:00"
  },
  "g091": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 208195552,
   "tab": "Sâmbătă 11:00-12:00"
  },
  "g120": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1025784633,
   "tab": "Duminică 11:00-13:00 (Vară)"
  },
  "g111": {
   "teacher": "t26",
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0",
   "gid": 1374486006,
   "tab": "Duminică 17:00-18:00"
  }
 },
 "teachers": {
  "t26": {
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0"
  }
 }
};
  const base = id => 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  /* the link to a group's tab (or null), and to a teacher's workbook (or null) */
  L.groupUrl = gid => { const g = L.groups[gid]; return g ? base(g.ssid) + '#gid=' + g.gid : null; };
  L.teacherUrl = tid => { const t = L.teachers[tid]; return t ? base(t.ssid) : null; };
})();
