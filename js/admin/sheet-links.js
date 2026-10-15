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
  },
  "g004": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1039537573,
   "tab": "Luni 15:00-17:00"
  },
  "g029": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1366259857,
   "tab": "Marți/Joi 10:00-11:00"
  },
  "g039": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1982094457,
   "tab": "Marți 10:00-12:00 (Vară)"
  },
  "g148": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 2133472536,
   "tab": "Marți/Vineri 13:00-14:00"
  },
  "g180": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 217944867,
   "tab": "Miercuri 14:00-15:00"
  },
  "g184": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1919400645,
   "tab": "Joi 17:00-18:00"
  },
  "g116": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1729762145,
   "tab": "Vineri 08:00-10:00 (Vară)"
  },
  "g100": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1720400902,
   "tab": "Vineri 10:00-12:00"
  },
  "g040": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1397223017,
   "tab": "Sâmbătă 13:00-14:00"
  },
  "g049": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1204111119,
   "tab": "Sâmbătă 14:00-16:00"
  },
  "g162": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1796430912,
   "tab": "Sâmbătă 16:00-17:00"
  },
  "g018": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1705120746,
   "tab": "Duminică 09:00-11:00"
  },
  "g121": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 1698502300,
   "tab": "Duminică 11:00-13:00"
  },
  "g160": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 664067444,
   "tab": "Duminică 15:00-16:00"
  },
  "g083": {
   "teacher": "t1",
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8",
   "gid": 881777464,
   "tab": "Duminică 19:00-20:00"
  },
  "g022": {
   "teacher": "t2",
   "ssid": "1T2ynwIwWqBUcXdONirzfYuUjq-qpLHrnpyaTsa9-pbM",
   "gid": 1039537573,
   "tab": "Luni 16:00-17:00"
  },
  "g109": {
   "teacher": "t2",
   "ssid": "1T2ynwIwWqBUcXdONirzfYuUjq-qpLHrnpyaTsa9-pbM",
   "gid": 1054025170,
   "tab": "Miercuri/Vineri 18:00-20:00"
  },
  "g104": {
   "teacher": "t2",
   "ssid": "1T2ynwIwWqBUcXdONirzfYuUjq-qpLHrnpyaTsa9-pbM",
   "gid": 1295311746,
   "tab": "Sâmbătă 11:00-12:00"
  },
  "g044": {
   "teacher": "t2",
   "ssid": "1T2ynwIwWqBUcXdONirzfYuUjq-qpLHrnpyaTsa9-pbM",
   "gid": 1592018346,
   "tab": "Sâmbătă 16:00-17:00"
  },
  "g127": {
   "teacher": "t3",
   "ssid": "1oVQGaUrhkIxxSoo3jQ-68zrtuh35jcbUG9-xPx7tUX8",
   "gid": 1039537573,
   "tab": "Luni/Joi 19:00-21:00"
  },
  "g042": {
   "teacher": "t3",
   "ssid": "1oVQGaUrhkIxxSoo3jQ-68zrtuh35jcbUG9-xPx7tUX8",
   "gid": 1240154972,
   "tab": "Vineri 16:00-18:00"
  },
  "g061": {
   "teacher": "t3",
   "ssid": "1oVQGaUrhkIxxSoo3jQ-68zrtuh35jcbUG9-xPx7tUX8",
   "gid": 1998821935,
   "tab": "Sâmbătă 10:00-12:00"
  },
  "g125": {
   "teacher": "t3",
   "ssid": "1oVQGaUrhkIxxSoo3jQ-68zrtuh35jcbUG9-xPx7tUX8",
   "gid": 981782421,
   "tab": "Sâmbătă 10:00-11:00"
  },
  "g089": {
   "teacher": "t3",
   "ssid": "1oVQGaUrhkIxxSoo3jQ-68zrtuh35jcbUG9-xPx7tUX8",
   "gid": 1381893708,
   "tab": "Sâmbătă 14:00-16:00"
  },
  "g188": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 1039537573,
   "tab": "Luni/Miercuri 09:00-11:00"
  },
  "g023": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 277684019,
   "tab": "Luni/Joi 12:00-13:00"
  },
  "g149": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 638771335,
   "tab": "Marți 12:00-14:00"
  },
  "g185": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 344620399,
   "tab": "Marți 17:00-18:00"
  },
  "g191": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 370743659,
   "tab": "Marți/Vineri 18:00-19:00"
  },
  "g107": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 1381039494,
   "tab": "Miercuri 16:00-17:00"
  },
  "g033": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 798003678,
   "tab": "Joi 18:00-20:00 (Vară)"
  },
  "g134": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 1708482149,
   "tab": "Vineri 15:00-16:00"
  },
  "g110": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 1134181544,
   "tab": "Sâmbătă 14:00-15:00"
  },
  "g161": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 2060129852,
   "tab": "Duminică 09:00-10:00"
  },
  "g154": {
   "teacher": "t4",
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so",
   "gid": 1882728285,
   "tab": "Duminică 18:00-19:00"
  },
  "g168": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 1039537573,
   "tab": "Luni 11:00-12:00"
  },
  "g171": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 590828585,
   "tab": "Luni 12:00-14:00"
  },
  "g108": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 1796954450,
   "tab": "Marți 15:00-16:00"
  },
  "g135": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 1590847659,
   "tab": "Miercuri 14:00-15:00"
  },
  "g122": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 47462391,
   "tab": "Joi 09:00-11:00"
  },
  "g053": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 1169695695,
   "tab": "Vineri 17:00-19:00"
  },
  "g080": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 1679328853,
   "tab": "Vineri 19:00-20:00"
  },
  "g114": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 733931237,
   "tab": "Sâmbătă 12:00-13:00"
  },
  "g141": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 957026134,
   "tab": "Sâmbătă 13:00-14:00"
  },
  "g034": {
   "teacher": "t5",
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY",
   "gid": 1065051309,
   "tab": "Duminică 12:00-14:00"
  },
  "g045": {
   "teacher": "t6",
   "ssid": "1arRGVV-5QKwpb_WZ3-8uz-MSmNgWcU11hNUx0r-x_Aw",
   "gid": 1039537573,
   "tab": "Luni/Miercuri 09:00-11:00"
  },
  "g115": {
   "teacher": "t6",
   "ssid": "1arRGVV-5QKwpb_WZ3-8uz-MSmNgWcU11hNUx0r-x_Aw",
   "gid": 1828207519,
   "tab": "Marți 19:00-20:00 (Vară)"
  },
  "g124": {
   "teacher": "t6",
   "ssid": "1arRGVV-5QKwpb_WZ3-8uz-MSmNgWcU11hNUx0r-x_Aw",
   "gid": 1352457417,
   "tab": "Marți 20:00-21:00"
  },
  "g096": {
   "teacher": "t6",
   "ssid": "1arRGVV-5QKwpb_WZ3-8uz-MSmNgWcU11hNUx0r-x_Aw",
   "gid": 1800790398,
   "tab": "Joi 14:00-16:00"
  },
  "g157": {
   "teacher": "t6",
   "ssid": "1arRGVV-5QKwpb_WZ3-8uz-MSmNgWcU11hNUx0r-x_Aw",
   "gid": 1253487894,
   "tab": "Sâmbătă 19:00-21:00"
  },
  "g181": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1039537573,
   "tab": "Luni/Miercuri 17:00-19:00"
  },
  "g086": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 305376746,
   "tab": "Luni/Miercuri 20:00-21:00"
  },
  "g169": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1424998958,
   "tab": "Marți 14:00-16:00"
  },
  "g101": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 2000132828,
   "tab": "Marți/Joi 17:00-18:00"
  },
  "g078": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 96090129,
   "tab": "Marți/Joi 18:00-20:00"
  },
  "g112": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 2045903546,
   "tab": "Miercuri 10:00-11:00 (Vară)"
  },
  "g051": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1505285741,
   "tab": "Miercuri/Vineri 11:00-12:00"
  },
  "g073": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1053400261,
   "tab": "Miercuri 15:00-16:00"
  },
  "g036": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 950795933,
   "tab": "Joi 15:00-16:00"
  },
  "g030": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 2022956540,
   "tab": "Joi 17:00-18:00"
  },
  "g025": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 894835397,
   "tab": "Vineri 10:00-11:00"
  },
  "g015": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 626164686,
   "tab": "Sâmbătă 08:00-09:00 (Vară)"
  },
  "g071": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1165612227,
   "tab": "Sâmbătă 08:00-10:00 (Vară)"
  },
  "g069": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1058479221,
   "tab": "Sâmbătă/Duminică 10:00-12:00 (Vară)"
  },
  "g006": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1158939438,
   "tab": "Duminică 09:00-10:00"
  },
  "g014": {
   "teacher": "t7",
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw",
   "gid": 1292528186,
   "tab": "Duminică 13:00-14:00"
  },
  "g133": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 1039537573,
   "tab": "Luni/Miercuri 08:00-10:00 (Vară)"
  },
  "g076": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 897296212,
   "tab": "Luni 10:00-11:00"
  },
  "g179": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 1908711274,
   "tab": "Miercuri/Vineri 14:00-15:00"
  },
  "g159": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 29278632,
   "tab": "Vineri 16:00-17:00"
  },
  "g183": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 577660615,
   "tab": "Sâmbătă/Duminică 15:00-16:00"
  },
  "g066": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 1278217443,
   "tab": "Duminică 12:00-13:00"
  },
  "g103": {
   "teacher": "t8",
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc",
   "gid": 80196114,
   "tab": "Duminică 18:00-19:00"
  },
  "g084": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 1039537573,
   "tab": "Luni 13:00-14:00"
  },
  "g123": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 1410966684,
   "tab": "Marți 09:00-10:00"
  },
  "g065": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 544994253,
   "tab": "Marți/Joi 13:00-15:00"
  },
  "g063": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 1760433170,
   "tab": "Miercuri/Vineri 16:00-17:00"
  },
  "g064": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 2047720674,
   "tab": "Vineri 09:00-10:00"
  },
  "g172": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 1818872618,
   "tab": "Sâmbătă 17:00-18:00"
  },
  "g117": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 1708381386,
   "tab": "Sâmbătă/Duminică 18:00-20:00"
  },
  "g102": {
   "teacher": "t9",
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M",
   "gid": 1122191726,
   "tab": "Duminică 14:00-15:00"
  },
  "g129": {
   "teacher": "t10",
   "ssid": "1G3WyFCNJUycOkdzgti-RuTRj5AqdDp9pUw94_7LI2Qg",
   "gid": 1039537573,
   "tab": "Miercuri/Vineri 11:00-13:00"
  },
  "g075": {
   "teacher": "t10",
   "ssid": "1G3WyFCNJUycOkdzgti-RuTRj5AqdDp9pUw94_7LI2Qg",
   "gid": 1710632409,
   "tab": "Duminică 08:00-10:00"
  },
  "g079": {
   "teacher": "t11",
   "ssid": "1tYPC84TGwcHARYtSV-0AZYtgQCOkdph6Wwg3UinBKOc",
   "gid": 1039537573,
   "tab": "Luni/Joi 15:00-17:00"
  },
  "g088": {
   "teacher": "t11",
   "ssid": "1tYPC84TGwcHARYtSV-0AZYtgQCOkdph6Wwg3UinBKOc",
   "gid": 1776333935,
   "tab": "Marți/Vineri 13:00-15:00"
  },
  "g189": {
   "teacher": "t11",
   "ssid": "1tYPC84TGwcHARYtSV-0AZYtgQCOkdph6Wwg3UinBKOc",
   "gid": 1848165823,
   "tab": "Marți 15:00-16:00"
  },
  "g026": {
   "teacher": "t11",
   "ssid": "1tYPC84TGwcHARYtSV-0AZYtgQCOkdph6Wwg3UinBKOc",
   "gid": 902850178,
   "tab": "Sâmbătă/Duminică 14:00-15:00"
  },
  "g174": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 1039537573,
   "tab": "Luni 09:00-11:00 (Vară)"
  },
  "g041": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 1242941323,
   "tab": "Luni/Miercuri 11:00-12:00"
  },
  "g067": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 1246419805,
   "tab": "Marți/Joi 09:00-10:00"
  },
  "g002": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 1572978688,
   "tab": "Marți/Joi 10:00-11:00"
  },
  "g131": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 523401044,
   "tab": "Joi 14:00-16:00"
  },
  "g005": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 1541207697,
   "tab": "Sâmbătă 19:00-20:00"
  },
  "g095": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 1713376880,
   "tab": "Duminică 13:00-14:00"
  },
  "g093": {
   "teacher": "t12",
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ",
   "gid": 302055589,
   "tab": "Duminică 15:00-17:00"
  },
  "g050": {
   "teacher": "t13",
   "ssid": "19FEDAnJv-ELK8GniphSrB6_UL4Mi3Xi1EIQyS96G9oA",
   "gid": 1039537573,
   "tab": "Luni 11:00-13:00 (Vară)"
  },
  "g158": {
   "teacher": "t13",
   "ssid": "19FEDAnJv-ELK8GniphSrB6_UL4Mi3Xi1EIQyS96G9oA",
   "gid": 1650825908,
   "tab": "Marți 09:00-10:00"
  },
  "g196": {
   "teacher": "t13",
   "ssid": "19FEDAnJv-ELK8GniphSrB6_UL4Mi3Xi1EIQyS96G9oA",
   "gid": 560653695,
   "tab": "Marți/Vineri 09:00-11:00"
  },
  "g098": {
   "teacher": "t13",
   "ssid": "19FEDAnJv-ELK8GniphSrB6_UL4Mi3Xi1EIQyS96G9oA",
   "gid": 416435089,
   "tab": "Miercuri 14:00-16:00"
  },
  "g046": {
   "teacher": "t13",
   "ssid": "19FEDAnJv-ELK8GniphSrB6_UL4Mi3Xi1EIQyS96G9oA",
   "gid": 97976088,
   "tab": "Joi 12:00-13:00"
  },
  "g105": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 1039537573,
   "tab": "Luni/Miercuri 14:00-16:00"
  },
  "g173": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 470842959,
   "tab": "Luni/Joi 17:00-19:00 (Vară)"
  },
  "g142": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 1885151877,
   "tab": "Luni/Miercuri 19:00-20:00"
  },
  "g007": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 1886877371,
   "tab": "Marți 18:00-20:00"
  },
  "g090": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 702184568,
   "tab": "Joi 13:00-14:00 (Vară)"
  },
  "g068": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 672920050,
   "tab": "Vineri 15:00-17:00"
  },
  "g027": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 1501472650,
   "tab": "Sâmbătă 13:00-14:00"
  },
  "g153": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 367632015,
   "tab": "Duminică 09:00-10:00"
  },
  "g099": {
   "teacher": "t14",
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc",
   "gid": 1190618920,
   "tab": "Duminică 15:00-17:00 (Vară)"
  },
  "g094": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 1039537573,
   "tab": "Luni 15:00-16:00"
  },
  "g150": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 199191932,
   "tab": "Luni/Miercuri 19:00-20:00"
  },
  "g057": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 749514788,
   "tab": "Marți 16:00-17:00 (Vară)"
  },
  "g113": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 1829220972,
   "tab": "Miercuri 11:00-13:00"
  },
  "g128": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 1391598560,
   "tab": "Joi 09:00-11:00"
  },
  "g043": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 1407300660,
   "tab": "Vineri 14:00-15:00"
  },
  "g054": {
   "teacher": "t15",
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY",
   "gid": 2068056990,
   "tab": "Duminică 12:00-14:00"
  },
  "g056": {
   "teacher": "t16",
   "ssid": "17kcWzglDwPGNNn0NT5yQQH-ty-C1dYPF1eGgRI-Xly4",
   "gid": 1039537573,
   "tab": "Miercuri/Vineri 13:00-15:00"
  },
  "g163": {
   "teacher": "t16",
   "ssid": "17kcWzglDwPGNNn0NT5yQQH-ty-C1dYPF1eGgRI-Xly4",
   "gid": 8559962,
   "tab": "Sâmbătă 13:00-14:00"
  },
  "g176": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 1039537573,
   "tab": "Luni/Joi 14:00-16:00"
  },
  "g028": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 1187459232,
   "tab": "Luni 16:00-17:00"
  },
  "g016": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 2116541852,
   "tab": "Marți/Vineri 08:00-09:00 (Vară)"
  },
  "g058": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 400303816,
   "tab": "Marți 10:00-12:00 (Vară)"
  },
  "g130": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 306438923,
   "tab": "Marți 13:00-14:00"
  },
  "g145": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 1123415455,
   "tab": "Marți/Vineri 14:00-15:00 (Vară)"
  },
  "g137": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 384411142,
   "tab": "Miercuri/Vineri 16:00-18:00"
  },
  "g009": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 1492479853,
   "tab": "Joi 18:00-19:00 (Vară)"
  },
  "g031": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 1300301031,
   "tab": "Vineri 13:00-15:00"
  },
  "g140": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 2110257219,
   "tab": "Sâmbătă 10:00-12:00"
  },
  "g013": {
   "teacher": "t17",
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc",
   "gid": 642415744,
   "tab": "Sâmbătă 14:00-15:00"
  },
  "g097": {
   "teacher": "t18",
   "ssid": "16T4ozrmb_w3-bg0iYGoVyPMJ90LeNU0hl80MFb8TF98",
   "gid": 1039537573,
   "tab": "Marți/Joi 15:00-17:00"
  },
  "g074": {
   "teacher": "t18",
   "ssid": "16T4ozrmb_w3-bg0iYGoVyPMJ90LeNU0hl80MFb8TF98",
   "gid": 103171075,
   "tab": "Marți 18:00-19:00"
  },
  "g187": {
   "teacher": "t18",
   "ssid": "16T4ozrmb_w3-bg0iYGoVyPMJ90LeNU0hl80MFb8TF98",
   "gid": 1984899466,
   "tab": "Miercuri 14:00-16:00"
  },
  "g186": {
   "teacher": "t18",
   "ssid": "16T4ozrmb_w3-bg0iYGoVyPMJ90LeNU0hl80MFb8TF98",
   "gid": 214290487,
   "tab": "Vineri 11:00-12:00"
  },
  "g035": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 1039537573,
   "tab": "Luni/Joi 15:00-17:00"
  },
  "g152": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 2100481653,
   "tab": "Luni/Joi 18:00-19:00"
  },
  "g167": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 1605245988,
   "tab": "Marți/Joi 16:00-17:00 (Vară)"
  },
  "g037": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 1346802577,
   "tab": "Marți/Vineri 20:00-21:00"
  },
  "g139": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 1370931774,
   "tab": "Miercuri 08:00-10:00"
  },
  "g032": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 2145580,
   "tab": "Miercuri 11:00-13:00"
  },
  "g106": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 1470691006,
   "tab": "Joi 14:00-15:00"
  },
  "g001": {
   "teacher": "t19",
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag",
   "gid": 1815358851,
   "tab": "Duminică 14:00-15:00"
  },
  "g024": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 1039537573,
   "tab": "Marți 11:00-12:00"
  },
  "g072": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 714444235,
   "tab": "Marți/Joi 12:00-13:00 (Vară)"
  },
  "g144": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 1083574108,
   "tab": "Marți/Joi 13:00-15:00"
  },
  "g085": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 483246583,
   "tab": "Miercuri 09:00-11:00 (Vară)"
  },
  "g178": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 1419765505,
   "tab": "Joi 09:00-11:00"
  },
  "g190": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 1818793530,
   "tab": "Sâmbătă 11:00-12:00"
  },
  "g055": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 1952449936,
   "tab": "Sâmbătă 14:00-15:00 (Vară)"
  },
  "g059": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 1711142433,
   "tab": "Sâmbătă/Duminică 17:00-19:00"
  },
  "g087": {
   "teacher": "t20",
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo",
   "gid": 2053051020,
   "tab": "Duminică 10:00-11:00"
  },
  "g177": {
   "teacher": "t21",
   "ssid": "1yFxqKu4br4l6K50uY9Tebjqn0Fk89YEBepqzA_EIinw",
   "gid": 1039537573,
   "tab": "Luni/Joi 09:00-11:00"
  },
  "g146": {
   "teacher": "t21",
   "ssid": "1yFxqKu4br4l6K50uY9Tebjqn0Fk89YEBepqzA_EIinw",
   "gid": 511008692,
   "tab": "Luni 13:00-14:00"
  },
  "g047": {
   "teacher": "t21",
   "ssid": "1yFxqKu4br4l6K50uY9Tebjqn0Fk89YEBepqzA_EIinw",
   "gid": 1472007146,
   "tab": "Luni/Miercuri 14:00-16:00"
  },
  "g192": {
   "teacher": "t21",
   "ssid": "1yFxqKu4br4l6K50uY9Tebjqn0Fk89YEBepqzA_EIinw",
   "gid": 1471654026,
   "tab": "Miercuri 18:00-20:00"
  },
  "g070": {
   "teacher": "t21",
   "ssid": "1yFxqKu4br4l6K50uY9Tebjqn0Fk89YEBepqzA_EIinw",
   "gid": 187014103,
   "tab": "Joi 14:00-15:00 (Vară)"
  },
  "g136": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 1039537573,
   "tab": "Luni/Joi 10:00-12:00 (Vară)"
  },
  "g021": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 639089103,
   "tab": "Marți/Vineri 13:00-14:00 (Vară)"
  },
  "g147": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 1780407374,
   "tab": "Marți/Joi 15:00-17:00"
  },
  "g155": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 283415093,
   "tab": "Marți/Joi 16:00-18:00"
  },
  "g012": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 1848321960,
   "tab": "Miercuri/Vineri 11:00-12:00"
  },
  "g060": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 1093144636,
   "tab": "Vineri 15:00-16:00"
  },
  "g132": {
   "teacher": "t22",
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo",
   "gid": 632157667,
   "tab": "Duminică 12:00-13:00"
  },
  "g011": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 1039537573,
   "tab": "Luni/Miercuri 16:00-17:00"
  },
  "g062": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 2135383880,
   "tab": "Miercuri 10:00-12:00"
  },
  "g118": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 1531248767,
   "tab": "Miercuri/Vineri 12:00-13:00"
  },
  "g020": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 957604841,
   "tab": "Miercuri/Vineri 13:00-15:00"
  },
  "g048": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 36801288,
   "tab": "Vineri 19:00-20:00 (Vară)"
  },
  "g166": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 1444353874,
   "tab": "Sâmbătă 13:00-14:00"
  },
  "g151": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 299634372,
   "tab": "Sâmbătă/Duminică 14:00-16:00"
  },
  "g164": {
   "teacher": "t24",
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4",
   "gid": 1701435498,
   "tab": "Sâmbătă 17:00-19:00"
  },
  "g008": {
   "teacher": "t25",
   "ssid": "14DgfWgop9CwwSjLYA47MGu6UsxpEUfuSxK0M4nWrZ9Q",
   "gid": 1039537573,
   "tab": "Luni/Joi 13:00-15:00"
  },
  "g170": {
   "teacher": "t25",
   "ssid": "14DgfWgop9CwwSjLYA47MGu6UsxpEUfuSxK0M4nWrZ9Q",
   "gid": 1171114413,
   "tab": "Luni/Joi 15:00-16:00"
  },
  "g165": {
   "teacher": "t25",
   "ssid": "14DgfWgop9CwwSjLYA47MGu6UsxpEUfuSxK0M4nWrZ9Q",
   "gid": 1544040864,
   "tab": "Marți 12:00-13:00"
  },
  "g138": {
   "teacher": "t25",
   "ssid": "14DgfWgop9CwwSjLYA47MGu6UsxpEUfuSxK0M4nWrZ9Q",
   "gid": 1535802021,
   "tab": "Sâmbătă 09:00-11:00"
  },
  "g052": {
   "teacher": "t25",
   "ssid": "14DgfWgop9CwwSjLYA47MGu6UsxpEUfuSxK0M4nWrZ9Q",
   "gid": 1066839666,
   "tab": "Sâmbătă 17:00-19:00"
  },
  "g119": {
   "teacher": "t27",
   "ssid": "1TQUvb0DuZFZ8ZGySDjfbBbo6Uh-ulRPE72kAHnkozNg",
   "gid": 1039537573,
   "tab": "Marți 16:00-17:00"
  },
  "g077": {
   "teacher": "t27",
   "ssid": "1TQUvb0DuZFZ8ZGySDjfbBbo6Uh-ulRPE72kAHnkozNg",
   "gid": 354866125,
   "tab": "Joi 14:00-15:00"
  },
  "g019": {
   "teacher": "t27",
   "ssid": "1TQUvb0DuZFZ8ZGySDjfbBbo6Uh-ulRPE72kAHnkozNg",
   "gid": 1468928730,
   "tab": "Joi 15:00-16:00"
  },
  "g193": {
   "teacher": "t27",
   "ssid": "1TQUvb0DuZFZ8ZGySDjfbBbo6Uh-ulRPE72kAHnkozNg",
   "gid": 283069442,
   "tab": "Vineri 08:00-09:00 (Vară)"
  },
  "g194": {
   "teacher": "t28",
   "ssid": "1cVeDnfAJrR3BfL2-zzwkN0Q05zE0UGCvt3PFX2R4Za4",
   "gid": 1039537573,
   "tab": "Luni/Joi 08:00-09:00"
  },
  "g175": {
   "teacher": "t28",
   "ssid": "1cVeDnfAJrR3BfL2-zzwkN0Q05zE0UGCvt3PFX2R4Za4",
   "gid": 1738351804,
   "tab": "Luni 12:00-13:00"
  },
  "g082": {
   "teacher": "t28",
   "ssid": "1cVeDnfAJrR3BfL2-zzwkN0Q05zE0UGCvt3PFX2R4Za4",
   "gid": 320696290,
   "tab": "Miercuri/Vineri 14:00-15:00 (Vară)"
  },
  "g195": {
   "teacher": "t28",
   "ssid": "1cVeDnfAJrR3BfL2-zzwkN0Q05zE0UGCvt3PFX2R4Za4",
   "gid": 1614590016,
   "tab": "Sâmbătă 16:00-18:00"
  },
  "g081": {
   "teacher": "t28",
   "ssid": "1cVeDnfAJrR3BfL2-zzwkN0Q05zE0UGCvt3PFX2R4Za4",
   "gid": 1816835507,
   "tab": "Duminică 09:00-10:00"
  }
 },
 "teachers": {
  "t26": {
   "ssid": "1oins50JBtrravAchc0yfgPGwOVpGI4LhjeuZUchTcw0"
  },
  "t1": {
   "ssid": "1QkBIcvEP_PKtU2klzX7p-Drvv0XiVf_RmYENSwBJiX8"
  },
  "t2": {
   "ssid": "1T2ynwIwWqBUcXdONirzfYuUjq-qpLHrnpyaTsa9-pbM"
  },
  "t3": {
   "ssid": "1oVQGaUrhkIxxSoo3jQ-68zrtuh35jcbUG9-xPx7tUX8"
  },
  "t4": {
   "ssid": "1D01FweZpWJT1PAMZXA1ZowrJYEBHCA0mQuafvkDS5so"
  },
  "t5": {
   "ssid": "1fB8mbhJDymYp3eXWozbjFbBzjmxz0b-6urVO45i15RY"
  },
  "t6": {
   "ssid": "1arRGVV-5QKwpb_WZ3-8uz-MSmNgWcU11hNUx0r-x_Aw"
  },
  "t7": {
   "ssid": "1Ai70fJZMrBqqFlgcutUfFfMid5joF72pqLFbErkArhw"
  },
  "t8": {
   "ssid": "1aRAsQ1mq4piTqyy6fewe2OQwIQ1Wl30k_9j9uIQX-wc"
  },
  "t9": {
   "ssid": "12uwrafYKAfPAV7EyNVMpdJAnNLWRntU5J7rOoRx1k0M"
  },
  "t10": {
   "ssid": "1G3WyFCNJUycOkdzgti-RuTRj5AqdDp9pUw94_7LI2Qg"
  },
  "t11": {
   "ssid": "1tYPC84TGwcHARYtSV-0AZYtgQCOkdph6Wwg3UinBKOc"
  },
  "t12": {
   "ssid": "1z_AguPqDJ32XFTfPh-U7h1EHS_mNm3P82nRtZ7N8cAQ"
  },
  "t13": {
   "ssid": "19FEDAnJv-ELK8GniphSrB6_UL4Mi3Xi1EIQyS96G9oA"
  },
  "t14": {
   "ssid": "1kjZgTJQ2-gWMDgvfUTTgELL6hrLQO37F0B-Gi0RATUc"
  },
  "t15": {
   "ssid": "1gSsOPNZPg2WdJP-46wFxzdVjQtZjYfiDFgz6hmUL6EY"
  },
  "t16": {
   "ssid": "17kcWzglDwPGNNn0NT5yQQH-ty-C1dYPF1eGgRI-Xly4"
  },
  "t17": {
   "ssid": "13LUWpbwlMEUXcANEZRn62ddDjMgAvdpHb5u6HS0q9Jc"
  },
  "t18": {
   "ssid": "16T4ozrmb_w3-bg0iYGoVyPMJ90LeNU0hl80MFb8TF98"
  },
  "t19": {
   "ssid": "191hGMq1h2rNYh-whaaT436tTRxWcC77le2p8qBC5_ag"
  },
  "t20": {
   "ssid": "1POmmMrJDFY9dGcKv3yhsA0nnxpp_5PxCih_ufVk0XXo"
  },
  "t21": {
   "ssid": "1yFxqKu4br4l6K50uY9Tebjqn0Fk89YEBepqzA_EIinw"
  },
  "t22": {
   "ssid": "1MlGmWXOfEQxhcz_buhl9tt27-bD3Ihff_nPUMQc5Epo"
  },
  "t24": {
   "ssid": "19GhRQ12XNemx9dJBXHx0GovZ7C01tnlVtbiDRFzd9i4"
  },
  "t25": {
   "ssid": "14DgfWgop9CwwSjLYA47MGu6UsxpEUfuSxK0M4nWrZ9Q"
  },
  "t27": {
   "ssid": "1TQUvb0DuZFZ8ZGySDjfbBbo6Uh-ulRPE72kAHnkozNg"
  },
  "t28": {
   "ssid": "1cVeDnfAJrR3BfL2-zzwkN0Q05zE0UGCvt3PFX2R4Za4"
  }
 }
};
  const base = id => 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  /* the link to a group's tab (or null), and to a teacher's workbook (or null) */
  /* when the registers are the source (Registre) every group and teacher knows its own registry: the link comes from the data */
  const D = () => window.AdminData;
  L.groupUrl = gid => {
    const d = D();
    if (d && d.registry) { const g = d.group(gid); return g && g._src && g._src.ssid ? base(g._src.ssid) + '#gid=' + g._src.sheet : null; }
    const g = L.groups[gid]; return g ? base(g.ssid) + '#gid=' + g.gid : null;
  };
  L.teacherUrl = tid => {
    const d = D();
    if (d && d.registry) { const t = d.teacher(tid); return t && t._ssid ? base(t._ssid) : null; }
    const t = L.teachers[tid]; return t ? base(t.ssid) : null;
  };
})();
