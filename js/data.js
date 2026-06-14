/* ============================================================
   BACMath — Date cu notație LaTeX (randat prin KaTeX)
   Reguli: $...$ = inline, $$...$$ = display (fără \n în interior)
   ============================================================ */

window.BM = window.BM || {};

BM.CATEGORIES = [
  {
    id: 'algebra', name: 'Algebră', symbol: 'α',
    gradient: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#7c3aed',
    description: 'Ecuații, inecuații, polinoame, numere complexe, exponențiale, logaritmi, trigonometrie',
    subcategories: [
      { id: 'calcul-algebric',  name: 'Calcul Algebric',           symbol: 'ax',   color: '#7c3aed', description: 'Radicali, puteri, expresii algebrice' },
      { id: 'polinoame',        name: 'Polinoame',                 symbol: 'P(X)', color: '#6366f1', description: 'Împărțire, rădăcini, descompunere' },
      { id: 'complexe',         name: 'Numere Complexe',           symbol: 'ℂ',    color: '#a855f7', description: 'Forma algebrică și trigonometrică' },
      { id: 'ec-irationale',    name: 'Ecuații Iraționale',        symbol: '√=',   color: '#0ea5e9', description: 'Ecuații cu radicali' },
      { id: 'ec-exp',           name: 'Ecuații Exponențiale',      symbol: 'aˣ',   color: '#06b6d4', description: 'Ecuații cu baze și exponenți' },
      { id: 'ec-log',           name: 'Ecuații Logaritmice',       symbol: 'log',  color: '#0891b2', description: 'Logaritmi în baze diverse' },
      { id: 'inec-rationale',   name: 'Inecuații Raționale',       symbol: '≤',    color: '#10b981', description: 'Inecuații cu fracții algebrice' },
      { id: 'inec-irationale',  name: 'Inecuații Iraționale',      symbol: '√<',   color: '#059669', description: 'Inecuații cu radicali' },
      { id: 'inec-exp',         name: 'Inecuații Exponențiale',    symbol: 'aˣ>',  color: '#f59e0b', description: 'Inecuații cu funcții exponențiale' },
      { id: 'inec-log',         name: 'Inecuații Logaritmice',     symbol: 'lg>',  color: '#d97706', description: 'Inecuații cu funcții logaritmice' },
      { id: 'trigonometrie',    name: 'Trigonometrie',             symbol: 'sin',  color: '#ec4899', description: 'Funcții trigonometrice, identități' }
    ]
  },
  {
    id: 'geometrie', name: 'Geometrie', symbol: '△',
    gradient: 'linear-gradient(135deg,#be185d,#9d174d)', color: '#ec4899',
    description: 'Geometrie plană, analitică și în spațiu',
    subcategories: [
      { id: 'geo-plana',     name: 'Geometrie Plană',     symbol: '△',   color: '#f43f5e', description: 'Triunghiuri, cercuri, poligoane' },
      { id: 'geo-analitica', name: 'Geometrie Analitică', symbol: 'Oxy', color: '#ec4899', description: 'Drepte, distanțe, arii în plan' },
      { id: 'geo-spatiu',    name: 'Geometrie în Spațiu', symbol: '⬡',   color: '#be185d', description: 'Poliedre, sfere, volume' }
    ]
  },
  {
    id: 'analiza', name: 'Analiză Matematică', symbol: '∫',
    gradient: 'linear-gradient(135deg,#d97706,#92400e)', color: '#f59e0b',
    description: 'Limite, derivate, integrale, șiruri și progresii',
    subcategories: [
      { id: 'limite',    name: 'Limite',    symbol: 'lim', color: '#f59e0b', description: 'Limite de funcții și șiruri' },
      { id: 'derivate',  name: 'Derivate',  symbol: "f'",  color: '#d97706', description: 'Reguli de derivare, monotonie' },
      { id: 'integrale', name: 'Integrale', symbol: '∫',   color: '#ea580c', description: 'Integrale definite și nedefinite' },
      { id: 'siruri',    name: 'Șiruri',    symbol: 'aₙ',  color: '#dc2626', description: 'Convergență, limite de șiruri' },
      { id: 'progresii', name: 'Progresii', symbol: '∑',   color: '#b91c1c', description: 'Aritmetice și geometrice' }
    ]
  },
  {
    id: 'combinatorica', name: 'Combinatorică și Probabilitate', symbol: 'Cₙᵏ',
    gradient: 'linear-gradient(135deg,#059669,#065f46)', color: '#10b981',
    description: 'Permutări, aranjamente, combinări, probabilitate și statistică',
    subcategories: [
      { id: 'permutari',     name: 'Permutări',     symbol: 'Pₙ',  color: '#10b981', description: 'Aranjamente fără repetiție' },
      { id: 'aranjamente',   name: 'Aranjamente',   symbol: 'Aₙᵏ', color: '#059669', description: 'Selecții ordonate de k elemente' },
      { id: 'combinari',     name: 'Combinări',     symbol: 'Cₙᵏ', color: '#047857', description: 'Selecții neordonate, binomul lui Newton' },
      { id: 'probabilitate', name: 'Probabilitate', symbol: 'P',   color: '#0ea5e9', description: 'Evenimente, probabilități clasice' },
      { id: 'statistica',    name: 'Statistică',    symbol: 'σ',   color: '#0284c7', description: 'Medie, dispersie, frecvențe' }
    ]
  }
];

BM.EXERCISES = [

  /* ============================================================
     CALCUL ALGEBRIC — 5 exerciții din imagini
     ============================================================ */
  {
    id: 'ca-001', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 dintr-o putere',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[3]{25^{1{,}5} - 61}$$',
    solution: '**Pasul 1.** Calculăm $25^{1{,}5}$:\n$$25^{1{,}5} = 25^{\\frac{3}{2}} = \\left(5^2\\right)^{\\frac{3}{2}} = 5^3 = 125$$\n\n**Pasul 2.** Scădem și extragem radicalul:\n$$\\sqrt[3]{125 - 61} = \\sqrt[3]{64} = \\sqrt[3]{4^3}$$\n\n$$\\boxed{= 4}$$'
  },
  {
    id: 'ca-002', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Suma logaritmilor cu baze reciproce',
    statement: 'Calculați valoarea expresiei:\n$$\\log_3 75 + 2\\log_{\\frac{1}{3}} 5$$',
    solution: 'Observăm că $\\dfrac{1}{3} = 3^{-1}$, deci $\\log_{\\frac{1}{3}} 5 = -\\log_3 5$.\n\n$$\\log_3 75 + 2(-\\log_3 5) = \\log_3 75 - \\log_3 5^2 = \\log_3 75 - \\log_3 25$$\n\n$$= \\log_3 \\frac{75}{25} = \\log_3 3$$\n\n$$\\boxed{= 1}$$'
  },
  {
    id: 'ca-003', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza 16 și putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{16}\\!\\left(64^2\\right) \\cdot \\left(\\frac{3}{2}\\right)^{-1}$$',
    solution: '**Pasul 1.** Reducem totul la puteri ale lui 2:\n$$\\log_{2^4}\\!\\left(2^{12}\\right) = \\frac{12}{4} = 3$$\n\n**Pasul 2.** Puterea negativă:\n$$\\left(\\frac{3}{2}\\right)^{-1} = \\frac{2}{3}$$\n\n**Pasul 3.** Produsul:\n$$3 \\cdot \\frac{2}{3} = \\boxed{2}$$'
  },
  {
    id: 'ca-004', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm și radical de ordin 3',
    statement: 'Calculați valoarea expresiei:\n$$2^{\\log_{0{,}5} 2} + 5\\sqrt[3]{0{,}008}$$',
    solution: '**Pasul 1.** Calculăm exponentul — $0{,}5 = 2^{-1}$:\n$$\\log_{2^{-1}} 2 = \\frac{1}{-1} = -1 \\Rightarrow 2^{-1} = \\frac{1}{2}$$\n\n**Pasul 2.** Radicalul:\n$$0{,}008 = \\frac{8}{1000} = \\frac{1}{125} = \\frac{1}{5^3} \\Rightarrow \\sqrt[3]{0{,}008} = \\frac{1}{5}$$\n\n**Pasul 3.** Suma:\n$$\\frac{1}{2} + 5 \\cdot \\frac{1}{5} = \\frac{1}{2} + 1 = \\boxed{\\frac{3}{2}}$$'
  },
  {
    id: 'ca-005', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere rațională și logaritm zecimal',
    statement: 'Determinați valoarea expresiei:\n$$64^{\\frac{1}{3}} + \\left(\\frac{1}{\\lg 100}\\right)^{-2}$$',
    solution: '**Pasul 1.** Puterea rațională:\n$$64^{\\frac{1}{3}} = \\left(4^3\\right)^{\\frac{1}{3}} = 4$$\n\n**Pasul 2.** Logaritmul zecimal:\n$$\\lg 100 = \\log_{10} 10^2 = 2 \\Rightarrow \\frac{1}{\\lg 100} = \\frac{1}{2}$$\n\n**Pasul 3.** Puterea negativă:\n$$\\left(\\frac{1}{2}\\right)^{-2} = 2^2 = 4$$\n\n**Pasul 4.** Suma:\n$$4 + 4 = \\boxed{8}$$'
  },

  {
    id: 'ca-006', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Număr pătrat perfect cu radical și logaritm',
    statement: 'Arătați că numărul\n$$a = \\sqrt[3]{81^{\\frac{3}{4}} + 4^{\\log_2 \\sqrt{37}}}$$\neste un pătrat perfect.',
    solution: '**Pasul 1.** Calculăm $81^{\\frac{3}{4}}$:\n$$81^{\\frac{3}{4}} = (3^4)^{\\frac{3}{4}} = 3^3 = 27$$\n\n**Pasul 2.** Calculăm $4^{\\log_2 \\sqrt{37}}$:\n$$4^{\\log_2 \\sqrt{37}} = (2^2)^{\\log_2 37^{1/2}} = 2^{\\log_2 37} = 37$$\n\n**Pasul 3.** Suma sub radical:\n$$\\sqrt[3]{27 + 37} = \\sqrt[3]{64} = \\sqrt[3]{4^3} = 4 = 2^2$$\n\nDeoarece $a = 2^2$, numărul $a$ este pătrat perfect. $\\blacksquare$'
  },
  {
    id: 'ca-007', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 0,25',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{0{,}25} 16 + 2$$',
    solution: '$0{,}25 = \\dfrac{1}{4} = 2^{-2}$\n$$\\log_{2^{-2}} 2^4 = \\frac{4}{-2} = -2$$\n\n$$-2 + 2 = \\boxed{0}$$'
  },
  {
    id: 'ca-008', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent rațional negativ',
    statement: 'Calculați valoarea expresiei:\n$$-125^{-\\frac{1}{3}} - \\frac{9}{5}$$',
    solution: '$$125^{\\frac{1}{3}} = \\sqrt[3]{125} = 5 \\Rightarrow 125^{-\\frac{1}{3}} = \\frac{1}{5}$$\n\n$$-\\frac{1}{5} - \\frac{9}{5} = -\\frac{10}{5} = \\boxed{-2}$$'
  },
  {
    id: 'ca-009', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Fracție cu puteri și radicali',
    statement: 'Calculați valoarea expresiei:\n$$\\frac{27^{-\\frac{2}{3}} \\cdot \\sqrt{9^3}}{\\sqrt[4]{81^{-1}}}$$',
    solution: '**Numărătorul:**\n$$27^{-2/3} = (3^3)^{-2/3} = 3^{-2} = \\frac{1}{9}, \\qquad \\sqrt{9^3} = (3^2)^{3/2} = 3^3 = 27$$\n$$\\text{Numărător} = \\frac{1}{9} \\cdot 27 = 3$$\n\n**Numitorul:**\n$$\\sqrt[4]{81^{-1}} = (3^4)^{-1/4} = 3^{-1} = \\frac{1}{3}$$\n\n$$\\frac{3}{\\dfrac{1}{3}} = 3 \\cdot 3 = \\boxed{9}$$'
  },
  {
    id: 'ca-010', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent expresie cu logaritm',
    statement: 'Calculați valoarea expresiei:\n$$2^{3 - \\log_2 3} - \\frac{2}{3}$$',
    solution: '$$2^{3-\\log_2 3} = \\frac{2^3}{2^{\\log_2 3}} = \\frac{8}{3}$$\n\n$$\\frac{8}{3} - \\frac{2}{3} = \\frac{6}{3} = \\boxed{2}$$'
  },
  {
    id: 'ca-011', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Logaritm compus (logaritm dintr-un logaritm)',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{\\frac{1}{9}}\\!\\left(\\log_3 \\sqrt{729}\\right)$$',
    solution: '**Interior:**\n$$\\sqrt{729} = (3^6)^{1/2} = 3^3 = 27 \\Rightarrow \\log_3 27 = 3$$\n\n**Exterior** $\\left(\\dfrac{1}{9} = 3^{-2}\\right)$:\n$$\\log_{3^{-2}} 3 = \\frac{1}{-2} = \\boxed{-\\dfrac{1}{2}}$$'
  },
  {
    id: 'ca-012', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Logaritm în baza 1/2 înmulțit cu 5',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{\\frac{1}{2}}\\!\\left(\\sqrt{2 \\cdot \\sqrt[5]{2}}\\right) \\cdot 5$$',
    solution: '**Argumentul:**\n$$\\sqrt{2 \\cdot 2^{1/5}} = \\sqrt{2^{\\frac{6}{5}}} = 2^{\\frac{3}{5}}$$\n\n**Logaritmul** $\\left(\\dfrac{1}{2} = 2^{-1}\\right)$:\n$$\\log_{2^{-1}}\\!\\left(2^{3/5}\\right) = \\frac{3/5}{-1} = -\\frac{3}{5}$$\n\n$$-\\frac{3}{5} \\cdot 5 = \\boxed{-3}$$'
  },
  {
    id: 'ca-013', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical și putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{\\sqrt[4]{4}} 32 - \\left(\\frac{2}{15}\\right)^{-1}$$',
    solution: '$\\sqrt[4]{4} = 2^{1/2}$, deci:\n$$\\log_{2^{1/2}} 2^5 = \\frac{5}{1/2} = 10$$\n\n$$\\left(\\frac{2}{15}\\right)^{-1} = \\frac{15}{2}$$\n\n$$10 - \\frac{15}{2} = \\frac{20 - 15}{2} = \\boxed{\\frac{5}{2}}$$'
  },
  {
    id: 'ca-014', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Pătrat perfect cu exponent expresie logaritmică',
    statement: 'Arătați că valoarea expresiei\n$$\\left(\\frac{1}{2}\\right)^{-2-\\log_2 9}$$\neste un pătrat perfect.',
    solution: '$$\\left(\\frac{1}{2}\\right)^{-2-\\log_2 9} = 2^{2+\\log_2 9} = 2^2 \\cdot 2^{\\log_2 9} = 4 \\cdot 9 = 36$$\n\nDeoarece $36 = 6^2$, expresia este pătrat perfect. $\\blacksquare$'
  },
  {
    id: 'ca-015', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent rațional și număr mixt',
    statement: 'Calculați valoarea expresiei:\n$$(0{,}0016)^{\\frac{1}{4}} + \\left(1\\dfrac{1}{4}\\right)^{-1}$$',
    solution: '**Primul termen:**\n$$0{,}0016 = \\frac{16}{10000} = \\left(\\frac{2}{10}\\right)^4 \\Rightarrow (0{,}0016)^{1/4} = \\frac{2}{10} = \\frac{1}{5}$$\n\n**Al doilea termen:**\n$$1\\frac{1}{4} = \\frac{5}{4} \\Rightarrow \\left(\\frac{5}{4}\\right)^{-1} = \\frac{4}{5}$$\n\n$$\\frac{1}{5} + \\frac{4}{5} = \\boxed{1}$$'
  },

  {
    id: 'ca-016', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Fracție la putere rațională',
    statement: 'Calculați valoarea expresiei:\n$$-\\frac{11}{4} + \\left(\\frac{81}{256}\\right)^{0{,}25}$$',
    solution: '$$\\left(\\frac{81}{256}\\right)^{1/4} = \\left(\\frac{3^4}{4^4}\\right)^{1/4} = \\frac{3}{4}$$\n\n$$-\\frac{11}{4} + \\frac{3}{4} = -\\frac{8}{4} = \\boxed{-2}$$'
  },
  {
    id: 'ca-017', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm compus și radical dintr-un logaritm',
    statement: 'Calculați valoarea expresiei:\n$$\\log_2\\!\\left(\\log_3 81\\right) + \\sqrt{\\log_5 625}$$',
    solution: '$$\\log_3 81 = \\log_3 3^4 = 4 \\Rightarrow \\log_2 4 = 2$$\n\n$$\\log_5 625 = \\log_5 5^4 = 4 \\Rightarrow \\sqrt{4} = 2$$\n\n$$2 + 2 = \\boxed{4}$$'
  },
  {
    id: 'ca-018', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 dintr-un număr negativ și putere',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[3]{-0{,}125} + 16^{-0{,}25}$$',
    solution: '$$-0{,}125 = -\\frac{1}{8} = -\\frac{1}{2^3} \\Rightarrow \\sqrt[3]{-0{,}125} = -\\frac{1}{2}$$\n\n$$16^{-0{,}25} = (2^4)^{-1/4} = 2^{-1} = \\frac{1}{2}$$\n\n$$-\\frac{1}{2} + \\frac{1}{2} = \\boxed{0}$$'
  },
  {
    id: 'ca-019', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Proprietățile logaritmului zecimal',
    statement: 'Calculați valoarea expresiei:\n$$\\lg 400 - 2\\lg 2$$',
    solution: '$$\\lg 400 - 2\\lg 2 = \\lg 400 - \\lg 4 = \\lg\\frac{400}{4} = \\lg 100 = \\boxed{2}$$'
  },
  {
    id: 'ca-020', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 dintr-un număr mixt',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[3]{-4\\dfrac{17}{27}} + 36^{-0{,}5}$$',
    solution: '$$-4\\frac{17}{27} = -\\frac{125}{27} = -\\frac{5^3}{3^3} \\Rightarrow \\sqrt[3]{-\\frac{125}{27}} = -\\frac{5}{3}$$\n\n$$36^{-0{,}5} = \\frac{1}{\\sqrt{36}} = \\frac{1}{6}$$\n\n$$-\\frac{5}{3} + \\frac{1}{6} = -\\frac{10}{6} + \\frac{1}{6} = -\\frac{9}{6} = \\boxed{-\\frac{3}{2}}$$'
  },
  {
    id: 'ca-021', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Suma logaritmilor unor expresii conjugate',
    statement: 'Calculați valoarea expresiei:\n$$\\log_3\\!\\left(5+\\sqrt{7}\\right) + \\log_3\\!\\left(5-\\sqrt{7}\\right) + \\log_3\\frac{1}{2}$$',
    solution: '$$\\log_3\\!\\left[(5+\\sqrt{7})(5-\\sqrt{7})\\right] = \\log_3(25-7) = \\log_3 18$$\n\n$$\\log_3 18 + \\log_3\\frac{1}{2} = \\log_3\\frac{18}{2} = \\log_3 9 = \\log_3 3^2 = \\boxed{2}$$'
  },
  {
    id: 'ca-022', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm zecimal și radical de ordin 5',
    statement: 'Calculați valoarea expresiei:\n$$100^{\\lg 2} + \\sqrt[5]{-243}$$',
    solution: '$$100^{\\lg 2} = (10^2)^{\\lg 2} = 10^{2\\lg 2} = 10^{\\lg 4} = 4$$\n\n$$\\sqrt[5]{-243} = \\sqrt[5]{-3^5} = -3$$\n\n$$4 + (-3) = \\boxed{1}$$'
  },
  {
    id: 'ca-023', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Fracție cu radicali și puteri negative',
    statement: 'Calculați valoarea expresiei:\n$$\\frac{\\sqrt[3]{49}}{7^{-1/3}}$$',
    solution: '$$\\frac{(7^2)^{1/3}}{7^{-1/3}} = \\frac{7^{2/3}}{7^{-1/3}} = 7^{\\frac{2}{3}+\\frac{1}{3}} = 7^1 = \\boxed{7}$$'
  },
  {
    id: 'ca-024', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza 0,5 și număr zecimal',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{0{,}5}\\sqrt[4]{8} + 0{,}75$$',
    solution: '$$\\sqrt[4]{8} = (2^3)^{1/4} = 2^{3/4}$$\n\n$0{,}5 = 2^{-1}$, deci:\n$$\\log_{2^{-1}}\\!\\left(2^{3/4}\\right) = \\frac{3/4}{-1} = -\\frac{3}{4}$$\n\n$$-\\frac{3}{4} + 0{,}75 = -\\frac{3}{4} + \\frac{3}{4} = \\boxed{0}$$'
  },
  {
    id: 'ca-025', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Putere cu exponent diferență de logaritmi',
    statement: 'Calculați valoarea expresiei:\n$$49^{\\log_7 10 - \\log_{49} 25}$$',
    solution: '$$\\log_{49} 25 = \\log_{7^2} 5^2 = \\frac{2\\log_7 5}{2} = \\log_7 5$$\n\n$$49^{\\log_7 10 - \\log_7 5} = 49^{\\log_7 2} = (7^2)^{\\log_7 2} = 7^{2\\log_7 2} = 7^{\\log_7 4} = \\boxed{4}$$'
  },
  {
    id: 'ca-026', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Combinație de logaritmi zecimali și în baza 0,1',
    statement: 'Calculați valoarea expresiei:\n$$\\lg 250 - \\log_{0{,}1} 4 + \\lg 10^{-1}$$',
    solution: '$\\log_{0{,}1} 4 = \\log_{10^{-1}} 4 = -\\lg 4$\n\n$$\\lg 250 - (-\\lg 4) + (-1) = \\lg 250 + \\lg 4 - 1 = \\lg 1000 - 1 = 3 - 1 = \\boxed{2}$$'
  },
  {
    id: 'ca-027', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza 2 dintr-un radical de radical',
    statement: 'Calculați valoarea expresiei:\n$$0{,}25 + \\log_2\\!\\left(\\sqrt{2\\sqrt{2}}\\right)$$',
    solution: '$$2\\sqrt{2} = 2 \\cdot 2^{1/2} = 2^{3/2} \\Rightarrow \\sqrt{2\\sqrt{2}} = \\left(2^{3/2}\\right)^{1/2} = 2^{3/4}$$\n\n$$\\log_2 2^{3/4} = \\frac{3}{4}$$\n\n$$\\frac{1}{4} + \\frac{3}{4} = \\boxed{1}$$'
  },
  {
    id: 'ca-028', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Produs cu putere rațională și putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$0{,}04^{\\frac{1}{2}} \\cdot \\left(\\frac{\\sqrt{5}}{10}\\right)^{-2}$$',
    solution: '$$0{,}04^{1/2} = \\sqrt{0{,}04} = 0{,}2 = \\frac{1}{5}$$\n\n$$\\left(\\frac{\\sqrt{5}}{10}\\right)^{-2} = \\left(\\frac{10}{\\sqrt{5}}\\right)^2 = \\frac{100}{5} = 20$$\n\n$$\\frac{1}{5} \\cdot 20 = \\boxed{4}$$'
  },
  {
    id: 'ca-029', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritmi zecimali și în baza 0,1',
    statement: 'Calculați valoarea expresiei:\n$$2\\lg\\sqrt{5} + \\log_{0{,}1} 50$$',
    solution: '$$2\\lg\\sqrt{5} = 2 \\cdot \\frac{1}{2}\\lg 5 = \\lg 5$$\n\n$\\log_{0{,}1} 50 = \\log_{10^{-1}} 50 = -\\lg 50$\n\n$$\\lg 5 - \\lg 50 = \\lg\\frac{5}{50} = \\lg\\frac{1}{10} = \\boxed{-1}$$'
  },
  {
    id: 'ca-030', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm și putere rațională',
    statement: 'Calculați valoarea expresiei:\n$$49^{\\frac{1}{\\log_5 7}} - 81^{\\frac{1}{4}}$$',
    solution: '$$\\frac{1}{\\log_5 7} = \\log_7 5 \\quad\\text{(proprietatea inversului)}$$\n\n$$49^{\\log_7 5} = (7^2)^{\\log_7 5} = 7^{2\\log_7 5} = \\left(7^{\\log_7 5}\\right)^2 = 5^2 = 25$$\n\n$$81^{1/4} = (3^4)^{1/4} = 3$$\n\n$$25 - 3 = \\boxed{22}$$'
  },

  {
    id: 'ca-031', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Sumă de logaritmi cu baze complementare (½ și 4)',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{\\frac{1}{2}} 6 + \\log_4 144$$',
    solution: 'Observăm că $\\dfrac{1}{2} = 2^{-1}$, deci $\\log_{\\frac{1}{2}} 6 = -\\log_2 6 = -2\\log_4 6$.\n\nPentru al doilea termen:\n$$\\log_4 144 = \\log_4(4 \\cdot 36) = 1 + \\log_4 6^2 = 1 + 2\\log_4 6$$\n\nSumăm:\n$$-2\\log_4 6 + 1 + 2\\log_4 6 = \\boxed{1}$$'
  },
  {
    id: 'ca-032', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Puteri cu exponenți zecimali și negativi',
    statement: 'Calculați valoarea expresiei:\n$$8^{\\frac{2}{3}} + \\left(\\frac{1}{32}\\right)^{-0{,}2} - 0{,}5^{-1}$$',
    solution: '**Primul termen:**\n$$8^{2/3} = (2^3)^{2/3} = 2^2 = 4$$\n\n**Al doilea termen:**\n$$\\left(\\frac{1}{32}\\right)^{-0{,}2} = 32^{0{,}2} = (2^5)^{\\frac{1}{5}} = 2$$\n\n**Al treilea termen:**\n$$0{,}5^{-1} = \\frac{1}{0{,}5} = 2$$\n\n$$4 + 2 - 2 = \\boxed{4}$$'
  },
  {
    id: 'ca-033', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritmi cu baze radical și rezultate negative',
    statement: 'Calculați valoarea expresiei:\n$$\\log_3 \\frac{1}{27} + \\log_{\\sqrt{2}} \\frac{1}{8}$$',
    solution: '$$\\log_3 \\frac{1}{27} = \\log_3 3^{-3} = -3$$\n\n$$\\log_{\\sqrt{2}} \\frac{1}{8} = \\log_{2^{1/2}} 2^{-3} = \\frac{-3}{\\dfrac{1}{2}} = -6$$\n\n$$-3 + (-6) = \\boxed{-9}$$'
  },
  {
    id: 'ca-034', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 din 0,008 și fracție la putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$0{,}008^{\\frac{1}{3}} + \\left(\\frac{25}{16}\\right)^{-0{,}5}$$',
    solution: '$$0{,}008 = \\frac{8}{1000} = \\left(\\frac{2}{10}\\right)^3 \\Rightarrow 0{,}008^{1/3} = \\frac{2}{10} = \\frac{1}{5}$$\n\n$$\\left(\\frac{25}{16}\\right)^{-0{,}5} = \\left(\\frac{16}{25}\\right)^{1/2} = \\frac{4}{5}$$\n\n$$\\frac{1}{5} + \\frac{4}{5} = \\boxed{1}$$'
  },
  {
    id: 'ca-035', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 dintr-o fracție negativă',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[3]{-\\dfrac{0{,}008}{0{,}027}} - 3^{-1}$$',
    solution: '$$\\sqrt[3]{-\\frac{8}{27}} = -\\sqrt[3]{\\frac{2^3}{3^3}} = -\\frac{2}{3}$$\n\n$$3^{-1} = \\frac{1}{3}$$\n\n$$-\\frac{2}{3} - \\frac{1}{3} = \\boxed{-1}$$'
  },
  {
    id: 'ca-036', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Combinație de logaritmi cu trei baze diferite',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{0{,}25} 16 + \\log_3 36 - \\log_{\\sqrt{3}} 2$$',
    solution: '$$\\log_{0{,}25} 16 = \\log_{2^{-2}} 2^4 = \\frac{4}{-2} = -2$$\n\n$$\\log_3 36 = \\log_3(4 \\cdot 9) = 2\\log_3 2 + 2$$\n\n$$\\log_{\\sqrt{3}} 2 = \\log_{3^{1/2}} 2 = 2\\log_3 2$$\n\nSumăm:\n$$-2 + 2\\log_3 2 + 2 - 2\\log_3 2 = \\boxed{0}$$'
  },
  {
    id: 'ca-037', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă și fracție cu simplificare',
    statement: 'Calculați valoarea expresiei:\n$$\\left(\\frac{1}{27}\\right)^{-\\frac{1}{3}} + 25\\left(\\frac{5}{2}\\right)^{-2} - 16^{0{,}25}$$',
    solution: '$$\\left(\\frac{1}{27}\\right)^{-1/3} = 27^{1/3} = 3$$\n\n$$25\\left(\\frac{5}{2}\\right)^{-2} = 25 \\cdot \\frac{4}{25} = 4$$\n\n$$16^{0{,}25} = (2^4)^{1/4} = 2$$\n\n$$3 + 4 - 2 = \\boxed{5}$$'
  },
  {
    id: 'ca-038', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent 0,2 dintr-un număr mic',
    statement: 'Calculați valoarea expresiei:\n$$0{,}00032^{0{,}2} + \\left(\\frac{25}{16}\\right)^{-\\frac{1}{2}} + 17^0$$',
    solution: '$$0{,}00032 = \\frac{32}{100000} = \\left(\\frac{2}{10}\\right)^5 \\Rightarrow 0{,}00032^{0{,}2} = \\frac{2}{10} = \\frac{1}{5}$$\n\n$$\\left(\\frac{25}{16}\\right)^{-1/2} = \\sqrt{\\frac{16}{25}} = \\frac{4}{5}$$\n\n$$17^0 = 1$$\n\n$$\\frac{1}{5} + \\frac{4}{5} + 1 = \\boxed{2}$$'
  },
  {
    id: 'ca-039', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Sumă de logaritmi cu rezultat fracționar',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{25} 125 + \\log_2(2\\sqrt{2})$$',
    solution: '$$\\log_{25} 125 = \\log_{5^2} 5^3 = \\frac{3}{2}$$\n\n$$2\\sqrt{2} = 2^1 \\cdot 2^{1/2} = 2^{3/2} \\Rightarrow \\log_2 2^{3/2} = \\frac{3}{2}$$\n\n$$\\frac{3}{2} + \\frac{3}{2} = \\boxed{3}$$'
  },
  {
    id: 'ca-040', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de radical și puteri simple',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt{\\sqrt{16}} + \\sqrt{0{,}25} + 2^{-1}$$',
    solution: '$$\\sqrt{\\sqrt{16}} = \\sqrt{4} = 2$$\n\n$$\\sqrt{0{,}25} = \\sqrt{\\frac{1}{4}} = \\frac{1}{2}$$\n\n$$2^{-1} = \\frac{1}{2}$$\n\n$$2 + \\frac{1}{2} + \\frac{1}{2} = \\boxed{3}$$'
  },

  {
    id: 'ca-041', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 din fracție și putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[3]{\\dfrac{8}{27}} + 0{,}5\\left(\\dfrac{3}{2}\\right)^{-1}$$',
    solution: '$$\\sqrt[3]{\\frac{8}{27}} = \\sqrt[3]{\\frac{2^3}{3^3}} = \\frac{2}{3}$$\n\n$$0{,}5 \\cdot \\left(\\frac{3}{2}\\right)^{-1} = \\frac{1}{2} \\cdot \\frac{2}{3} = \\frac{1}{3}$$\n\n$$\\frac{2}{3} + \\frac{1}{3} = \\boxed{1}$$'
  },
  {
    id: 'ca-042', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm reciproc și sumă de logaritmi cu baze diferite',
    statement: 'Calculați valoarea expresiei:\n$$\\frac{1}{\\log_3 6} + \\log_6 12 - \\log_3 1$$',
    solution: '$$\\log_3 1 = 0$$\n\nFolosim proprietatea $\\dfrac{1}{\\log_3 6} = \\log_6 3$:\n$$\\log_6 3 + \\log_6 12 = \\log_6(3 \\cdot 12) = \\log_6 36 = \\log_6 6^2 = \\boxed{2}$$'
  },
  {
    id: 'ca-043', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Fracție la putere rațională, putere zero și radical la putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$\\left(\\frac{16}{81}\\right)^{0{,}25} - 4^0 + \\sqrt{3}^{-2}$$',
    solution: '$$\\left(\\frac{16}{81}\\right)^{1/4} = \\frac{2}{3}$$\n\n$$4^0 = 1$$\n\n$$(\\sqrt{3})^{-2} = (3^{1/2})^{-2} = 3^{-1} = \\frac{1}{3}$$\n\n$$\\frac{2}{3} - 1 + \\frac{1}{3} = 1 - 1 = \\boxed{0}$$'
  },
  {
    id: 'ca-044', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm negativ și logaritm cu bază radical',
    statement: 'Calculați valoarea expresiei:\n$$\\log_4 \\frac{1}{64} + 0{,}25\\log_{\\sqrt{9}} 81$$',
    solution: '$$\\log_4 \\frac{1}{64} = \\log_4 4^{-3} = -3$$\n\n$$\\sqrt{9} = 3,\\quad \\log_3 81 = \\log_3 3^4 = 4$$\n$$0{,}25 \\cdot 4 = 1$$\n\n$$-3 + 1 = \\boxed{-2}$$'
  },
  {
    id: 'ca-045', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordin 5 dintr-un produs cu puteri',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[5]{27^{\\frac{2}{3}}\\left(\\frac{9}{32}\\right)^{-1}}$$',
    solution: '$$27^{2/3} = (3^3)^{2/3} = 3^2 = 9$$\n\n$$\\left(\\frac{9}{32}\\right)^{-1} = \\frac{32}{9}$$\n\n$$9 \\cdot \\frac{32}{9} = 32 = 2^5$$\n\n$$\\sqrt[5]{2^5} = \\boxed{2}$$'
  },
  {
    id: 'ca-046', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordin 3 dintr-un produs cu putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$\\sqrt[3]{-243\\left(\\frac{3}{\\sqrt{8}}\\right)^{-2}}$$',
    solution: '$$\\left(\\frac{3}{\\sqrt{8}}\\right)^{-2} = \\left(\\frac{\\sqrt{8}}{3}\\right)^2 = \\frac{8}{9}$$\n\n$$-243 \\cdot \\frac{8}{9} = -27 \\cdot 8 = -216$$\n\n$$\\sqrt[3]{-216} = \\sqrt[3]{(-6)^3} = \\boxed{-6}$$'
  },
  {
    id: 'ca-047', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs cu putere negativă și putere rațională',
    statement: 'Calculați valoarea expresiei:\n$$\\left(\\frac{13}{2}\\right)^{-1} \\cdot 169^{0{,}5} + 9^{1{,}5}$$',
    solution: '$$\\left(\\frac{13}{2}\\right)^{-1} = \\frac{2}{13}, \\quad 169^{0{,}5} = \\sqrt{169} = 13$$\n$$\\frac{2}{13} \\cdot 13 = 2$$\n\n$$9^{1{,}5} = (3^2)^{3/2} = 3^3 = 27$$\n\n$$2 + 27 = \\boxed{29}$$'
  },
  {
    id: 'ca-048', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere a lui 10 cu exponent logaritmic negativ',
    statement: 'Calculați valoarea expresiei:\n$$10^{-\\lg 3} + \\log_{27} 9 - \\lg 100$$',
    solution: '$$10^{-\\lg 3} = 10^{\\lg 3^{-1}} = 3^{-1} = \\frac{1}{3}$$\n\n$$\\log_{27} 9 = \\log_{3^3} 3^2 = \\frac{2}{3}$$\n\n$$\\lg 100 = 2$$\n\n$$\\frac{1}{3} + \\frac{2}{3} - 2 = 1 - 2 = \\boxed{-1}$$'
  },
  {
    id: 'ca-049', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Combinație de patru logaritmi cu baze diferite',
    statement: 'Calculați valoarea expresiei:\n$$\\log_4 32 - \\log_9 27 + \\log_3 6 - \\log_3 2$$',
    solution: '$$\\log_4 32 = \\log_{2^2} 2^5 = \\frac{5}{2}$$\n\n$$\\log_9 27 = \\log_{3^2} 3^3 = \\frac{3}{2}$$\n\n$$\\log_3 6 - \\log_3 2 = \\log_3 \\frac{6}{2} = \\log_3 3 = 1$$\n\n$$\\frac{5}{2} - \\frac{3}{2} + 1 = 1 + 1 = \\boxed{2}$$'
  },
  {
    id: 'ca-050', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Sumă de logaritmi în baza 6 cu coeficienți',
    statement: 'Calculați valoarea expresiei:\n$$2\\log_6 2 + 0{,}5\\log_6 81$$',
    solution: '$$2\\log_6 2 = \\log_6 4$$\n\n$$0{,}5\\log_6 81 = \\log_6 81^{1/2} = \\log_6 9$$\n\n$$\\log_6 4 + \\log_6 9 = \\log_6 36 = \\log_6 6^2 = \\boxed{2}$$'
  },
  {
    id: 'ca-051', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical dintr-un logaritm negativ și putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{-\\log_{\\frac{1}{2}} 16 - 8^{-\\frac{2}{3}}}$$',
    solution: '$$\\log_{\\frac{1}{2}} 16 = \\log_{2^{-1}} 2^4 = \\frac{4}{-1} = -4$$\n\n$$-\\log_{\\frac{1}{2}} 16 = 4$$\n\n$$8^{-\\frac{2}{3}} = (2^3)^{-\\frac{2}{3}} = 2^{-2} = \\frac{1}{4}$$\n\n$$E = \\sqrt{4 - \\frac{1}{4}} = \\sqrt{\\frac{15}{4}} = \\boxed{\\dfrac{\\sqrt{15}}{2}}$$'
  },
  {
    id: 'ca-052', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Fracție de logaritmi zecimali și putere cu exponent irațional',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{2\\lg 2 + \\lg 3}{\\lg 48 - \\lg 4} + \\left(2^{\\sqrt{3}}\\right)^{\\sqrt{3}}$$',
    solution: '$$\\lg 48 - \\lg 4 = \\lg \\frac{48}{4} = \\lg 12$$\n\n$$2\\lg 2 + \\lg 3 = \\lg 4 + \\lg 3 = \\lg 12$$\n\n$$\\frac{\\lg 12}{\\lg 12} = 1$$\n\n$$\\left(2^{\\sqrt{3}}\\right)^{\\sqrt{3}} = 2^{\\sqrt{3}\\cdot\\sqrt{3}} = 2^3 = 8$$\n\n$$E = 1 + 8 = \\boxed{9}$$'
  },
  {
    id: 'ca-053', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 cu identitate trigonometrică',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{\\sin^2 43^\\circ + \\cos^2 43^\\circ - (27)^{\\frac{2}{3}}}$$',
    solution: '$$\\sin^2 43^\\circ + \\cos^2 43^\\circ = 1$$\n\n$$27^{\\frac{2}{3}} = (3^3)^{\\frac{2}{3}} = 3^2 = 9$$\n\n$$E = \\sqrt[3]{1 - 9} = \\sqrt[3]{-8} = \\boxed{-2}$$'
  },
  {
    id: 'ca-054', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Suma a doi logaritmi cu baze reciproce',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_2 36 + \\log_{\\frac{1}{2}} 9$$',
    solution: '$$\\log_{\\frac{1}{2}} 9 = -\\log_2 9$$\n\n$$E = \\log_2 36 - \\log_2 9 = \\log_2 \\frac{36}{9} = \\log_2 4 = \\boxed{2}$$'
  },
  {
    id: 'ca-055', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent negativ și logaritm dintr-un radical',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{2}{7}\\right)^{-1} + \\log_3 \\sqrt{27}$$',
    solution: '$$\\left(\\frac{2}{7}\\right)^{-1} = \\frac{7}{2}$$\n\n$$\\log_3 \\sqrt{27} = \\log_3 27^{\\frac{1}{2}} = \\frac{1}{2}\\log_3 3^3 = \\frac{3}{2}$$\n\n$$E = \\frac{7}{2} + \\frac{3}{2} = \\frac{10}{2} = \\boxed{5}$$'
  },
  {
    id: 'ca-056', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordinul 4 înmulțit cu putere fracționară',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[4]{27}\\cdot 9^{\\frac{1}{8}} - \\left(\\frac{3}{2}\\right)^{-2}$$',
    solution: '$$\\sqrt[4]{27} = 3^{\\frac{3}{4}}, \\quad 9^{\\frac{1}{8}} = (3^2)^{\\frac{1}{8}} = 3^{\\frac{1}{4}}$$\n\n$$3^{\\frac{3}{4}} \\cdot 3^{\\frac{1}{4}} = 3^1 = 3$$\n\n$$\\left(\\frac{3}{2}\\right)^{-2} = \\left(\\frac{2}{3}\\right)^{2} = \\frac{4}{9}$$\n\n$$E = 3 - \\frac{4}{9} = \\frac{27-4}{9} = \\boxed{\\dfrac{23}{9}}$$'
  },
  {
    id: 'ca-057', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent rațional negativ minus logaritm',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\sqrt{8}\\right)^{-\\frac{2}{3}} - \\log_{25} 5$$',
    solution: '$$\\left(\\sqrt{8}\\right)^{-\\frac{2}{3}} = \\left(8^{\\frac{1}{2}}\\right)^{-\\frac{2}{3}} = 8^{-\\frac{1}{3}} = (2^3)^{-\\frac{1}{3}} = 2^{-1} = \\frac{1}{2}$$\n\n$$\\log_{25} 5 = \\log_{5^2} 5 = \\frac{1}{2}$$\n\n$$E = \\frac{1}{2} - \\frac{1}{2} = \\boxed{0}$$'
  },
  {
    id: 'ca-058', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Putere negativă plus radical de ordinul 3 cu logaritm și putere',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{1}{3}\\right)^{-2} + \\sqrt[3]{\\log_3 \\frac{1}{9} - \\left(\\frac{1}{\\sqrt{6}}\\right)^{-2}}$$',
    solution: '$$\\left(\\frac{1}{3}\\right)^{-2} = 3^2 = 9$$\n\n$$\\log_3 \\frac{1}{9} = \\log_3 3^{-2} = -2$$\n\n$$\\left(\\frac{1}{\\sqrt{6}}\\right)^{-2} = (\\sqrt{6})^2 = 6$$\n\n$$\\sqrt[3]{-2 - 6} = \\sqrt[3]{-8} = -2$$\n\n$$E = 9 + (-2) = \\boxed{7}$$'
  },
  {
    id: 'ca-059', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 27 plus putere cu exponent negativ',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{27} 9 + \\left(\\frac{4}{3}\\right)^{-1}$$',
    solution: '$$\\log_{27} 9 = \\log_{3^3} 3^2 = \\frac{2}{3}$$\n\n$$\\left(\\frac{4}{3}\\right)^{-1} = \\frac{3}{4}$$\n\n$$E = \\frac{2}{3} + \\frac{3}{4} = \\frac{8}{12} + \\frac{9}{12} = \\boxed{\\dfrac{17}{12}}$$'
  },
  {
    id: 'ca-060', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm minus radical de ordinul 5',
    statement: 'Calculați valoarea expresiei:\n$$E = 25^{\\log_5 3} - 32^{\\frac{1}{5}}$$',
    solution: '$$25^{\\log_5 3} = (5^2)^{\\log_5 3} = 5^{2\\log_5 3} = \\left(5^{\\log_5 3}\\right)^2 = 3^2 = 9$$\n\n$$32^{\\frac{1}{5}} = (2^5)^{\\frac{1}{5}} = 2$$\n\n$$E = 9 - 2 = \\boxed{7}$$'
  },
  {
    id: 'ca-061', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Doi logaritmi cu baze reciproce plus putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_6 96 + \\log_{\\frac{1}{6}} 16 + \\left(\\frac{1}{\\sqrt{3}}\\right)^{-2}$$',
    solution: '$$\\log_{\\frac{1}{6}} 16 = -\\log_6 16$$\n\n$$\\log_6 96 - \\log_6 16 = \\log_6 \\frac{96}{16} = \\log_6 6 = 1$$\n\n$$\\left(\\frac{1}{\\sqrt{3}}\\right)^{-2} = (\\sqrt{3})^2 = 3$$\n\n$$E = 1 + 3 = \\boxed{4}$$'
  },
  {
    id: 'ca-062', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Trei puteri cu exponenți fracționari și negativi',
    statement: 'Calculați valoarea expresiei:\n$$E = 27^{-\\frac{2}{3}} + 81^{\\frac{3}{4}} + (0{,}25)^{-2}$$',
    solution: '$$27^{-\\frac{2}{3}} = (3^3)^{-\\frac{2}{3}} = 3^{-2} = \\frac{1}{9}$$\n\n$$81^{\\frac{3}{4}} = (3^4)^{\\frac{3}{4}} = 3^3 = 27$$\n\n$$(0{,}25)^{-2} = \\left(\\frac{1}{4}\\right)^{-2} = 4^2 = 16$$\n\n$$E = \\frac{1}{9} + 27 + 16 = \\frac{1}{9} + 43 = \\boxed{\\dfrac{388}{9}}$$'
  },
  {
    id: 'ca-063', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi în baza 36 plus radical de ordinul 3',
    statement: 'Să se afle valoarea expresiei:\n$$E = \\log_{36} 84 - \\log_{36} 14 + \\sqrt[3]{-27}$$',
    solution: '$$\\log_{36} 84 - \\log_{36} 14 = \\log_{36} \\frac{84}{14} = \\log_{36} 6 = \\frac{1}{2}$$\n\n$$\\sqrt[3]{-27} = -3$$\n\n$$E = \\frac{1}{2} - 3 = \\boxed{-\\dfrac{5}{2}}$$'
  },
  {
    id: 'ca-064', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali conjugați cu iradical în interior',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{\\sqrt{65}-7}\\cdot\\sqrt{\\sqrt{65}+7}$$',
    solution: '$$E = \\sqrt{(\\sqrt{65}-7)(\\sqrt{65}+7)} = \\sqrt{65 - 49} = \\sqrt{16} = \\boxed{4}$$'
  },
  {
    id: 'ca-065', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Combinație de logaritmi zecimali și pătrat al unui radical',
    statement: 'Calculați valoarea expresiei:\n$$E = 3\\lg 5 + \\frac{1}{2}\\lg 64 - \\left(\\sqrt[3]{-8}\\right)^2$$',
    solution: '$$3\\lg 5 = \\lg 125, \\quad \\frac{1}{2}\\lg 64 = \\lg 8$$\n\n$$\\lg 125 + \\lg 8 = \\lg 1000 = 3$$\n\n$$\\sqrt[3]{-8} = -2 \\Rightarrow (-2)^2 = 4$$\n\n$$E = 3 - 4 = \\boxed{-1}$$'
  },
  {
    id: 'ca-066', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali de ordinul 3 conjugați',
    statement: 'Aflați valoarea expresiei:\n$$E = \\sqrt[3]{7-\\sqrt{22}}\\cdot\\sqrt[3]{7+\\sqrt{22}}$$',
    solution: '$$E = \\sqrt[3]{(7-\\sqrt{22})(7+\\sqrt{22})} = \\sqrt[3]{49-22} = \\sqrt[3]{27} = \\boxed{3}$$'
  },
  {
    id: 'ca-067', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Număr zecimal plus logaritm dintr-un radical',
    statement: 'Calculați valoarea expresiei:\n$$E = 3{,}5 + \\log_3 \\sqrt{27}$$',
    solution: '$$\\log_3 \\sqrt{27} = \\log_3 3^{\\frac{3}{2}} = \\frac{3}{2} = 1{,}5$$\n\n$$E = 3{,}5 + 1{,}5 = \\boxed{5}$$'
  },
  {
    id: 'ca-068', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Fracție de puteri cu radicali și exponenți fracționari',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{\\sqrt[3]{16}\\cdot 4^{\\frac{1}{3}}}{\\sqrt{8}}$$',
    solution: '$$\\sqrt[3]{16} = 2^{\\frac{4}{3}}, \\quad 4^{\\frac{1}{3}} = 2^{\\frac{2}{3}}, \\quad \\sqrt{8} = 2^{\\frac{3}{2}}$$\n\n$$E = \\frac{2^{\\frac{4}{3}}\\cdot 2^{\\frac{2}{3}}}{2^{\\frac{3}{2}}} = \\frac{2^2}{2^{\\frac{3}{2}}} = 2^{2-\\frac{3}{2}} = 2^{\\frac{1}{2}} = \\boxed{\\sqrt{2}}$$'
  },
  {
    id: 'ca-069', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Suma a doi logaritmi cu baze reciproce în baza 3',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_3 24 + \\log_{\\frac{1}{3}} 8$$',
    solution: '$$\\log_{\\frac{1}{3}} 8 = -\\log_3 8$$\n\n$$E = \\log_3 24 - \\log_3 8 = \\log_3 \\frac{24}{8} = \\log_3 3 = \\boxed{1}$$'
  },
  {
    id: 'ca-070', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 16 minus putere cu exponent negativ',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{16} 32 - 2^{-2}$$',
    solution: '$$\\log_{16} 32 = \\log_{2^4} 2^5 = \\frac{5}{4}$$\n\n$$2^{-2} = \\frac{1}{4}$$\n\n$$E = \\frac{5}{4} - \\frac{1}{4} = \\frac{4}{4} = \\boxed{1}$$'
  },
  {
    id: 'ca-071', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 dintr-o fracție minus putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{1+\\frac{61}{64}} - 2^{-2}$$',
    solution: '$$1 + \\frac{61}{64} = \\frac{125}{64}$$\n\n$$\\sqrt[3]{\\frac{125}{64}} = \\frac{\\sqrt[3]{125}}{\\sqrt[3]{64}} = \\frac{5}{4}$$\n\n$$2^{-2} = \\frac{1}{4}$$\n\n$$E = \\frac{5}{4} - \\frac{1}{4} = \\boxed{1}$$'
  },
  {
    id: 'ca-072', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent rațional negativ minus logaritm dintr-un radical',
    statement: 'Calculați valoarea expresiei:\n$$E = 8^{-\\frac{2}{3}} - \\log_2 \\sqrt{2}$$',
    solution: '$$8^{-\\frac{2}{3}} = (2^3)^{-\\frac{2}{3}} = 2^{-2} = \\frac{1}{4}$$\n\n$$\\log_2 \\sqrt{2} = \\log_2 2^{\\frac{1}{2}} = \\frac{1}{2}$$\n\n$$E = \\frac{1}{4} - \\frac{1}{2} = \\frac{1-2}{4} = \\boxed{-\\dfrac{1}{4}}$$'
  },
  {
    id: 'ca-073', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Produs de două puteri cu exponenți fracționari mari',
    statement: 'Calculați valoarea expresiei:\n$$E = 8^{\\frac{5}{3}}\\cdot\\left(\\sqrt[3]{9}\\right)^{\\frac{9}{2}}$$',
    solution: '$$8^{\\frac{5}{3}} = (2^3)^{\\frac{5}{3}} = 2^5 = 32$$\n\n$$\\sqrt[3]{9} = (3^2)^{\\frac{1}{3}} = 3^{\\frac{2}{3}}$$\n\n$$\\left(3^{\\frac{2}{3}}\\right)^{\\frac{9}{2}} = 3^{\\frac{2}{3}\\cdot\\frac{9}{2}} = 3^3 = 27$$\n\n$$E = 32 \\cdot 27 = \\boxed{864}$$'
  },
  {
    id: 'ca-074', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi în baza 36 minus radical dintr-o putere',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{36} 84 - \\log_{36} 14 - \\sqrt{2^{-2}}$$',
    solution: '$$\\log_{36} 84 - \\log_{36} 14 = \\log_{36} \\frac{84}{14} = \\log_{36} 6 = \\frac{1}{2}$$\n\n$$\\sqrt{2^{-2}} = \\sqrt{\\frac{1}{4}} = \\frac{1}{2}$$\n\n$$E = \\frac{1}{2} - \\frac{1}{2} = \\boxed{0}$$'
  },
  {
    id: 'ca-075', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Sumă de logaritmi zecimali cu coeficienți',
    statement: 'Calculați valoarea expresiei:\n$$E = 2\\lg 5 + \\frac{1}{2}\\lg 16$$',
    solution: '$$2\\lg 5 = \\lg 25$$\n\n$$\\frac{1}{2}\\lg 16 = \\lg 4$$\n\n$$\\lg 25 + \\lg 4 = \\lg 100 = \\boxed{2}$$'
  },
  {
    id: 'ca-076', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi plus inversul unui număr zecimal',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_2 18 - \\log_2 9 + (1{,}5)^{-1}$$',
    solution: '$$\\log_2 18 - \\log_2 9 = \\log_2 \\frac{18}{9} = \\log_2 2 = 1$$\n\n$$(1{,}5)^{-1} = \\left(\\frac{3}{2}\\right)^{-1} = \\frac{2}{3}$$\n\n$$E = 1 + \\frac{2}{3} = \\boxed{\\dfrac{5}{3}}$$'
  },
  {
    id: 'ca-077', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 dintr-o expresie cu radical pătratic',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{-3-(2\\sqrt{6})^2}$$',
    solution: '$$(2\\sqrt{6})^2 = 4\\cdot 6 = 24$$\n\n$$E = \\sqrt[3]{-3 - 24} = \\sqrt[3]{-27} = \\boxed{-3}$$'
  },
  {
    id: 'ca-078', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi în baza 5 minus radical dintr-o putere',
    statement: 'Să se afle valoarea expresiei:\n$$E = \\log_5 80 - \\log_5 16 - \\sqrt{3^{-2}}$$',
    solution: '$$\\log_5 80 - \\log_5 16 = \\log_5 \\frac{80}{16} = \\log_5 5 = 1$$\n\n$$\\sqrt{3^{-2}} = \\sqrt{\\frac{1}{9}} = \\frac{1}{3}$$\n\n$$E = 1 - \\frac{1}{3} = \\boxed{\\dfrac{2}{3}}$$'
  },
  {
    id: 'ca-079', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Fracție de puteri ale lui 3 cu exponenți negativi și fracționari',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{3^{-1{,}5}\\cdot 9^2}{\\sqrt{27}}$$',
    solution: '$$3^{-1{,}5} = 3^{-\\frac{3}{2}}, \\quad 9^2 = (3^2)^2 = 3^4, \\quad \\sqrt{27} = 3^{\\frac{3}{2}}$$\n\n$$E = \\frac{3^{-\\frac{3}{2}}\\cdot 3^4}{3^{\\frac{3}{2}}} = \\frac{3^{\\frac{5}{2}}}{3^{\\frac{3}{2}}} = 3^{\\frac{5}{2}-\\frac{3}{2}} = 3^1 = \\boxed{3}$$'
  },
  {
    id: 'ca-080', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă a diferenței de logaritmi în baza 25',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\log_{25} 75 - \\log_{25} 3\\right)^{-15}$$',
    solution: '$$\\log_{25} 75 - \\log_{25} 3 = \\log_{25} \\frac{75}{3} = \\log_{25} 25 = 1$$\n\n$$E = 1^{-15} = \\boxed{1}$$'
  },
  {
    id: 'ca-081', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent negativ plus logaritm dintr-un sinus',
    statement: 'Calculați valoarea expresiei:\n$$E = 8^{-\\frac{2}{3}} + \\log_2\\!\\left(\\sin\\frac{\\pi}{6}\\right)$$',
    solution: '$$8^{-\\frac{2}{3}} = (2^3)^{-\\frac{2}{3}} = 2^{-2} = \\frac{1}{4}$$\n\n$$\\sin\\frac{\\pi}{6} = \\frac{1}{2} \\Rightarrow \\log_2\\frac{1}{2} = -1$$\n\n$$E = \\frac{1}{4} + (-1) = \\boxed{-\\dfrac{3}{4}}$$'
  },
  {
    id: 'ca-082', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent rațional plus inversul unui logaritm',
    statement: 'Calculați valoarea expresiei:\n$$E = 4^{-\\frac{3}{2}} + \\left(\\log_2\\frac{1}{16}\\right)^{-1}$$',
    solution: '$$4^{-\\frac{3}{2}} = (2^2)^{-\\frac{3}{2}} = 2^{-3} = \\frac{1}{8}$$\n\n$$\\log_2\\frac{1}{16} = \\log_2 2^{-4} = -4$$\n\n$$(-4)^{-1} = -\\frac{1}{4}$$\n\n$$E = \\frac{1}{8} - \\frac{1}{4} = \\frac{1-2}{8} = \\boxed{-\\dfrac{1}{8}}$$'
  },
  {
    id: 'ca-083', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali de ordinul 3 conjugați cu radicali interiori',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{12-\\sqrt{80}}\\cdot\\sqrt[3]{12+\\sqrt{80}}$$',
    solution: '$$E = \\sqrt[3]{(12-\\sqrt{80})(12+\\sqrt{80})} = \\sqrt[3]{144-80} = \\sqrt[3]{64} = \\boxed{4}$$'
  },
  {
    id: 'ca-084', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 dintr-o fracție mixtă plus logaritm',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{2\\tfrac{3}{8} - \\tfrac{9}{4}} + \\log_3\\sqrt{3}$$',
    solution: '$$2\\frac{3}{8} - \\frac{9}{4} = \\frac{19}{8} - \\frac{18}{8} = \\frac{1}{8}$$\n\n$$\\sqrt[3]{\\frac{1}{8}} = \\frac{1}{2}$$\n\n$$\\log_3\\sqrt{3} = \\frac{1}{2}$$\n\n$$E = \\frac{1}{2} + \\frac{1}{2} = \\boxed{1}$$'
  },
  {
    id: 'ca-085', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență a doi logaritmi cu coeficient în baza 3',
    statement: 'Calculați valoarea expresiei:\n$$E = 2\\log_3 6 - \\log_3 4$$',
    solution: '$$2\\log_3 6 = \\log_3 6^2 = \\log_3 36$$\n\n$$E = \\log_3 36 - \\log_3 4 = \\log_3 \\frac{36}{4} = \\log_3 9 = \\boxed{2}$$'
  },
  {
    id: 'ca-086', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali conjugați cu radicali și multipli',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{\\sqrt{70}-3\\sqrt{5}}\\cdot\\sqrt{\\sqrt{70}+3\\sqrt{5}}$$',
    solution: '$$E = \\sqrt{(\\sqrt{70}-3\\sqrt{5})(\\sqrt{70}+3\\sqrt{5})} = \\sqrt{70 - 9\\cdot5} = \\sqrt{70-45} = \\sqrt{25} = \\boxed{5}$$'
  },
  {
    id: 'ca-087', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Număr periodic plus logaritm în baza 27',
    statement: 'Calculați valoarea expresiei:\n$$E = 1{,}(6) + \\log_{27} 9$$',
    solution: '$$1{,}(6) = 1\\tfrac{2}{3} = \\frac{5}{3}$$\n\n$$\\log_{27} 9 = \\log_{3^3} 3^2 = \\frac{2}{3}$$\n\n$$E = \\frac{5}{3} + \\frac{2}{3} = \\boxed{\\dfrac{7}{3}}$$'
  },
  {
    id: 'ca-088', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent fracționar plus putere negativă a unui zecimal',
    statement: 'Calculați valoarea expresiei:\n$$E = 81^{\\frac{3}{4}} + (0{,}25)^{-2}$$',
    solution: '$$81^{\\frac{3}{4}} = (3^4)^{\\frac{3}{4}} = 3^3 = 27$$\n\n$$(0{,}25)^{-2} = \\left(\\frac{1}{4}\\right)^{-2} = 4^2 = 16$$\n\n$$E = 27 + 16 = \\boxed{43}$$'
  },
  {
    id: 'ca-089', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Sumă de logaritmi zecimali fără termen suplimentar',
    statement: 'Calculați valoarea expresiei:\n$$E = 3\\lg 5 + \\frac{1}{2}\\lg 64$$',
    solution: '$$3\\lg 5 = \\lg 125, \\quad \\frac{1}{2}\\lg 64 = \\lg 8$$\n\n$$\\lg 125 + \\lg 8 = \\lg 1000 = \\boxed{3}$$'
  },
  {
    id: 'ca-090', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical minus logaritm în baza 2',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt{2}} 12 - \\log_2 9$$',
    solution: '$$\\log_{\\sqrt{2}} 12 = \\log_{2^{\\frac{1}{2}}} 12 = 2\\log_2 12$$\n\n$$E = 2\\log_2 12 - \\log_2 9 = \\log_2 144 - \\log_2 9 = \\log_2 16 = \\boxed{4}$$'
  },
  {
    id: 'ca-091', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere negativă a sumei de trei puteri cu exponenți fracționari',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(27^{\\frac{2}{3}} + 125^{\\frac{1}{3}} + 8^{\\frac{1}{3}}\\right)^{-\\frac{1}{4}}$$',
    solution: '$$27^{\\frac{2}{3}} = 9, \\quad 125^{\\frac{1}{3}} = 5, \\quad 8^{\\frac{1}{3}} = 2$$\n\n$$9 + 5 + 2 = 16$$\n\n$$E = 16^{-\\frac{1}{4}} = \\frac{1}{16^{\\frac{1}{4}}} = \\frac{1}{2} = \\boxed{\\dfrac{1}{2}}$$'
  },
  {
    id: 'ca-092', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 4 dintr-un radical minus radical de ordinul 3',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_4\\sqrt{2} - \\sqrt[3]{\\frac{1}{64}}$$',
    solution: '$$\\log_4\\sqrt{2} = \\log_{2^2} 2^{\\frac{1}{2}} = \\frac{1}{4}$$\n\n$$\\sqrt[3]{\\frac{1}{64}} = \\frac{1}{4}$$\n\n$$E = \\frac{1}{4} - \\frac{1}{4} = \\boxed{0}$$'
  },
  {
    id: 'ca-093', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Sumă de număr periodic și putere cu exponent negativ',
    statement: 'Calculați valoarea expresiei:\n$$E = 0{,}(5) + (1{,}5)^{-2}$$',
    solution: '$$0{,}(5) = \\frac{5}{9}$$\n\n$$(1{,}5)^{-2} = \\left(\\frac{3}{2}\\right)^{-2} = \\frac{4}{9}$$\n\n$$E = \\frac{5}{9} + \\frac{4}{9} = \\frac{9}{9} = \\boxed{1}$$'
  },
  {
    id: 'ca-094', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical din logaritmul unei diferențe de puteri',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{\\log_2\\!\\left[\\left(\\frac{1}{4}\\right)^{-2} - (2\\sqrt{3})^2\\right]}$$',
    solution: '$$\\left(\\frac{1}{4}\\right)^{-2} = 4^2 = 16$$\n\n$$(2\\sqrt{3})^2 = 4\\cdot3 = 12$$\n\n$$\\log_2(16-12) = \\log_2 4 = 2$$\n\n$$E = \\sqrt{2} = \\boxed{\\sqrt{2}}$$'
  },
  {
    id: 'ca-095', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere negativă a sumei de trei puteri cu radicali',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left[8^{\\frac{2}{3}} + \\left(\\frac{1}{9}\\right)^{-\\frac{3}{2}} + \\sqrt{125^{\\frac{2}{3}}}\\right]^{-\\frac{1}{2}}$$',
    solution: '$$8^{\\frac{2}{3}} = 4, \\quad \\left(\\frac{1}{9}\\right)^{-\\frac{3}{2}} = 9^{\\frac{3}{2}} = 27, \\quad 125^{\\frac{2}{3}} = 25 \\Rightarrow \\sqrt{25} = 5$$\n\n$$4 + 27 + 5 = 36$$\n\n$$E = 36^{-\\frac{1}{2}} = \\frac{1}{6} = \\boxed{\\dfrac{1}{6}}$$'
  },
  {
    id: 'ca-096', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical 2 minus putere cu bază fracție irațională',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt{2}} 8 - \\left(\\frac{1}{3\\sqrt{2}}\\right)^{-2}$$',
    solution: '$$\\log_{\\sqrt{2}} 8 = \\log_{2^{\\frac{1}{2}}} 2^3 = \\frac{3}{\\frac{1}{2}} = 6$$\n\n$$\\left(\\frac{1}{3\\sqrt{2}}\\right)^{-2} = (3\\sqrt{2})^2 = 9\\cdot2 = 18$$\n\n$$E = 6 - 18 = \\boxed{-12}$$'
  },
  {
    id: 'ca-097', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Fracție de puteri împărțită la puterea unui logaritm',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{9^{-3}\\cdot 27^2}{\\left(\\log_{\\sqrt{2}} 2\\right)^{-2}}$$',
    solution: '$$9^{-3}\\cdot 27^2 = 3^{-6}\\cdot 3^6 = 1$$\n\n$$\\log_{\\sqrt{2}} 2 = \\log_{2^{\\frac{1}{2}}} 2 = 2$$\n\n$$2^{-2} = \\frac{1}{4}$$\n\n$$E = \\frac{1}{\\frac{1}{4}} = \\boxed{4}$$'
  },
  {
    id: 'ca-098', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali de ordinul 3 cu radicali conjugați pătratici',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{9-\\sqrt{17}}\\cdot\\sqrt[3]{9+\\sqrt{17}}$$',
    solution: '$$E = \\sqrt[3]{(9-\\sqrt{17})(9+\\sqrt{17})} = \\sqrt[3]{81-17} = \\sqrt[3]{64} = \\boxed{4}$$'
  },
  {
    id: 'ca-099', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical 3 minus logaritm în baza 3',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt{3}} 18 - \\log_3 4$$',
    solution: '$$\\log_{\\sqrt{3}} 18 = \\log_{3^{\\frac{1}{2}}} 18 = 2\\log_3 18$$\n\n$$E = 2\\log_3 18 - \\log_3 4 = \\log_3 18^2 - \\log_3 4 = \\log_3 \\frac{324}{4} = \\log_3 81 = \\boxed{4}$$'
  },
  {
    id: 'ca-100', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu bază fracție irațională minus inversul unui logaritm',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{\\sqrt{3}}{2}\\right)^{-2} - \\left(\\log_3 27\\right)^{-1}$$',
    solution: '$$\\left(\\frac{\\sqrt{3}}{2}\\right)^{-2} = \\left(\\frac{2}{\\sqrt{3}}\\right)^2 = \\frac{4}{3}$$\n\n$$\\log_3 27 = 3 \\Rightarrow 3^{-1} = \\frac{1}{3}$$\n\n$$E = \\frac{4}{3} - \\frac{1}{3} = \\frac{3}{3} = \\boxed{1}$$'
  },
  {
    id: 'ca-113', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent fracționar minus număr întreg',
    statement: 'Calculați valoarea expresiei:\n$$E = 32^{\\frac{3}{5}} - 8$$',
    solution: '$$32^{\\frac{3}{5}} = (2^5)^{\\frac{3}{5}} = 2^3 = 8$$\n\n$$E = 8 - 8 = \\boxed{0}$$'
  },
  {
    id: 'ca-114', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Sumă de puteri cu exponenți logaritmici în baze diferite',
    statement: 'Calculați valoarea expresiei:\n$$E = 2^{3+\\log_2 5} + 3^{\\log_9 16}$$',
    solution: '$$2^{3+\\log_2 5} = 2^3\\cdot 2^{\\log_2 5} = 8\\cdot5 = 40$$\n\n$$3^{\\log_9 16} = 3^{2\\log_3 2} = (3^{\\log_3 2})^2 = 2^2 = 4$$\n\n$$E = 40 + 4 = \\boxed{44}$$'
  },
  {
    id: 'ca-115', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Diferență de puteri cu exponenți logaritmici compuși',
    statement: 'Calculați valoarea expresiei:\n$$E = 2^{2+\\log_4 25} - 2^{\\frac{3}{\\log_5 2}}$$',
    solution: '$$\\log_4 25 = \\log_{2^2} 5^2 = \\log_2 5 \\Rightarrow 2^{2+\\log_2 5} = 4\\cdot5 = 20$$\n\n$$\\frac{3}{\\log_5 2} = 3\\log_2 5 \\Rightarrow 2^{3\\log_2 5} = (2^{\\log_2 5})^3 = 5^3 = 125$$\n\n$$E = 20 - 125 = \\boxed{-105}$$'
  },
  {
    id: 'ca-116', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Produs de două fracții la puteri reciproce',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{14}{3}\\right)^{\\frac{3}{2}}\\cdot\\left(\\frac{7}{6}\\right)^{-1{,}5}$$',
    solution: '$$\\left(\\frac{7}{6}\\right)^{-1{,}5} = \\left(\\frac{6}{7}\\right)^{\\frac{3}{2}}$$\n\n$$E = \\left(\\frac{14}{3}\\cdot\\frac{6}{7}\\right)^{\\frac{3}{2}} = 4^{\\frac{3}{2}} = \\boxed{8}$$'
  },
  {
    id: 'ca-117', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 16 plus putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{16} 8 + 2^{-2}$$',
    solution: '$$\\log_{16} 8 = \\log_{2^4} 2^3 = \\frac{3}{4}$$\n\n$$2^{-2} = \\frac{1}{4}$$\n\n$$E = \\frac{3}{4} + \\frac{1}{4} = \\boxed{1}$$'
  },
  {
    id: 'ca-118', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă plus radical de ordinul 3 minus număr întreg',
    statement: 'Calculați valoarea expresiei:\n$$E = 2^{-2} + \\sqrt[3]{\\frac{27}{64}} - 2$$',
    solution: '$$2^{-2} = \\frac{1}{4}, \\quad \\sqrt[3]{\\frac{27}{64}} = \\frac{3}{4}$$\n\n$$E = \\frac{1}{4} + \\frac{3}{4} - 2 = 1 - 2 = \\boxed{-1}$$'
  },
  {
    id: 'ca-119', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Fracție de radicali și puteri ale lui 3',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{\\sqrt[3]{81}}{9^{\\frac{1}{6}}}$$',
    solution: '$$\\sqrt[3]{81} = 3^{\\frac{4}{3}}, \\quad 9^{\\frac{1}{6}} = 3^{\\frac{1}{3}}$$\n\n$$E = 3^{\\frac{4}{3}-\\frac{1}{3}} = 3^1 = \\boxed{3}$$'
  },
  {
    id: 'ca-120', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Radical de ordinul 4 dintr-un produs cu exponent irațional',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[4]{3^{(\\sqrt{3}-1)^2}\\cdot 9^{\\sqrt{3}}}$$',
    solution: '$$(\\sqrt{3}-1)^2 = 4-2\\sqrt{3}$$\n\n$$3^{4-2\\sqrt{3}}\\cdot 3^{2\\sqrt{3}} = 3^4 = 81$$\n\n$$E = \\sqrt[4]{81} = \\boxed{3}$$'
  },
  {
    id: 'ca-121', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical din sumă complexă de puteri cu exponenți fracționari',
    statement: 'Determinați valoarea expresiei:\n$$E = \\sqrt{\\left(\\frac{1}{10}\\right)^{-2} + \\left(16^{\\frac{3}{4}}\\right)^2\\cdot 81^{\\frac{1}{2}}}$$',
    solution: '$$\\left(\\frac{1}{10}\\right)^{-2} = 100, \\quad 16^{\\frac{3}{4}} = 8 \\Rightarrow 8^2 = 64, \\quad 81^{\\frac{1}{2}} = 9$$\n\n$$E = \\sqrt{100 + 64\\cdot9} = \\sqrt{676} = \\boxed{26}$$'
  },
  {
    id: 'ca-122', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical din diferența a două expresii cu puteri negative',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{\\left(\\frac{27}{64}\\right)^{-\\frac{2}{3}} - \\left(\\frac{3}{\\sqrt{7}}\\right)^{-2}}$$',
    solution: '$$\\left(\\frac{27}{64}\\right)^{-\\frac{2}{3}} = \\left(\\frac{4}{3}\\right)^2 = \\frac{16}{9}$$\n\n$$\\left(\\frac{3}{\\sqrt{7}}\\right)^{-2} = \\left(\\frac{\\sqrt{7}}{3}\\right)^2 = \\frac{7}{9}$$\n\n$$E = \\sqrt{\\frac{16}{9} - \\frac{7}{9}} = \\sqrt{1} = \\boxed{1}$$'
  },
  {
    id: 'ca-123', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm minus radical dintr-un zecimal',
    statement: 'Calculați valoarea expresiei:\n$$E = 3^{\\log_{27} 8} - \\sqrt[3]{0{,}027}$$',
    solution: '$$\\log_{27} 8 = \\log_{3^3} 2^3 = \\log_3 2 \\Rightarrow 3^{\\log_3 2} = 2$$\n\n$$\\sqrt[3]{0{,}027} = \\sqrt[3]{\\frac{27}{1000}} = \\frac{3}{10}$$\n\n$$E = 2 - \\frac{3}{10} = \\boxed{1{,}7}$$'
  },
  {
    id: 'ca-124', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Media aritmetică a două expresii combinate',
    statement: 'Calculați media aritmetică a numerelor $a$ și $b$:\n$$a = \\sqrt{81}+\\sqrt[3]{-64}+16^{\\frac{3}{4}}, \\quad b = \\log_3 27 - \\sqrt{6\\tfrac{1}{4}} + 3^{\\log_3\\frac{1}{2}}$$\n$$E = \\dfrac{a+b}{2}$$',
    solution: '$$a = 9 + (-4) + 8 = 13$$\n\n$$b = 3 - \\frac{5}{2} + \\frac{1}{2} = 1$$\n\n$$E = \\frac{13+1}{2} = \\boxed{7}$$'
  },
  {
    id: 'ca-125', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm zecimal cu coeficient plus logaritm în baza 0,1',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{1}{2}\\lg 36 + \\log_{0{,}1} 60$$',
    solution: '$$\\frac{1}{2}\\lg 36 = \\lg 6$$\n\n$$\\log_{0{,}1} 60 = \\log_{10^{-1}} 60 = -\\lg 60$$\n\n$$E = \\lg 6 - \\lg 60 = \\lg \\frac{1}{10} = \\boxed{-1}$$'
  },
  {
    id: 'ca-126', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm plus logaritmi — verificare pătrat perfect',
    statement: 'Arătați că numărul $a$ este un pătrat perfect:\n$$a = 4^{\\log_2\\sqrt{7}} + \\log_5 75 - \\log_5 3$$',
    solution: '$$4^{\\log_2\\sqrt{7}} = 2^{\\log_2 7} = 7$$\n\n$$\\log_5 75 - \\log_5 3 = \\log_5 25 = 2$$\n\n$$a = 7 + 2 = 9 = 3^2 \\Rightarrow \\boxed{a = 9 \\text{ este pătrat perfect}}$$'
  },
  {
    id: 'ca-127', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Sumă de puteri cu exponenți ce conțin logaritmi',
    statement: 'Calculați valoarea expresiei:\n$$a = 49^{1-\\log_7 2} + 5^{-\\log_5 4}$$',
    solution: '$$49^{1-\\log_7 2} = 7^2\\cdot(7^{\\log_7 2})^{-2} = 49\\cdot2^{-2} = \\frac{49}{4}$$\n\n$$5^{-\\log_5 4} = 4^{-1} = \\frac{1}{4}$$\n\n$$a = \\frac{49}{4} + \\frac{1}{4} = \\frac{50}{4} = \\boxed{\\dfrac{25}{2}}$$'
  },
  {
    id: 'ca-128', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical minus număr întreg',
    statement: 'Determinați valoarea expresiei:\n$$E = \\log_{\\sqrt{3}} 9 - 9$$',
    solution: '$$\\log_{\\sqrt{3}} 9 = \\log_{3^{\\frac{1}{2}}} 3^2 = \\frac{2}{\\frac{1}{2}} = 4$$\n\n$$E = 4 - 9 = \\boxed{-5}$$'
  },
  {
    id: 'ca-129', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Fracție minus putere cu exponent rațional negativ',
    statement: 'Determinați valoarea expresiei:\n$$E = \\frac{7}{8} - 16^{-\\frac{3}{4}}$$',
    solution: '$$16^{-\\frac{3}{4}} = (2^4)^{-\\frac{3}{4}} = 2^{-3} = \\frac{1}{8}$$\n\n$$E = \\frac{7}{8} - \\frac{1}{8} = \\frac{6}{8} = \\boxed{\\dfrac{3}{4}}$$'
  },
  {
    id: 'ca-130', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Fracție de radical de ordinul 5 și putere negativă',
    statement: 'Determinați valoarea expresiei:\n$$E = \\frac{\\sqrt[5]{625}}{25^{-\\frac{1}{10}}}$$',
    solution: '$$\\sqrt[5]{625} = 5^{\\frac{4}{5}}, \\quad 25^{-\\frac{1}{10}} = 5^{-\\frac{1}{5}}$$\n\n$$E = \\frac{5^{\\frac{4}{5}}}{5^{-\\frac{1}{5}}} = 5^{\\frac{4}{5}+\\frac{1}{5}} = 5^1 = \\boxed{5}$$'
  },
  {
    id: 'ca-131', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere minus putere negativă a inversului unui logaritm',
    statement: 'Determinați valoarea expresiei:\n$$E = 81^{\\frac{3}{4}} - \\left(\\frac{1}{\\log_3 27}\\right)^{-3}$$',
    solution: '$$81^{\\frac{3}{4}} = (3^4)^{\\frac{3}{4}} = 3^3 = 27$$\n\n$$\\log_3 27 = 3 \\Rightarrow \\frac{1}{3} \\Rightarrow \\left(\\frac{1}{3}\\right)^{-3} = 3^3 = 27$$\n\n$$E = 27 - 27 = \\boxed{0}$$'
  },
  {
    id: 'ca-132', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 9 dintr-un radical minus număr zecimal',
    statement: 'Determinați valoarea expresiei:\n$$E = \\log_9\\sqrt{27} - 0{,}75$$',
    solution: '$$\\log_9\\sqrt{27} = \\log_{3^2} 3^{\\frac{3}{2}} = \\frac{3}{4}$$\n\n$$E = \\frac{3}{4} - 0{,}75 = \\frac{3}{4} - \\frac{3}{4} = \\boxed{0}$$'
  },
  {
    id: 'ca-133', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical din diferența a două puteri',
    statement: 'Determinați valoarea expresiei:\n$$E = \\sqrt{\\left(\\frac{1}{13}\\right)^{-2} - 125^{\\frac{2}{3}}}$$',
    solution: '$$\\left(\\frac{1}{13}\\right)^{-2} = 13^2 = 169$$\n\n$$125^{\\frac{2}{3}} = (5^3)^{\\frac{2}{3}} = 5^2 = 25$$\n\n$$E = \\sqrt{169-25} = \\sqrt{144} = \\boxed{12}$$'
  },
  {
    id: 'ca-134', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 36 dintr-o putere minus putere negativă',
    statement: 'Determinați valoarea expresiei:\n$$E = \\log_{36} 216^{\\frac{1}{2}} - 2^{-2}$$',
    solution: '$$\\log_{36} 216^{\\frac{1}{2}} = \\log_{6^2} (6^3)^{\\frac{1}{2}} = \\log_{6^2} 6^{\\frac{3}{2}} = \\frac{3}{4}$$\n\n$$2^{-2} = \\frac{1}{4}$$\n\n$$E = \\frac{3}{4} - \\frac{1}{4} = \\boxed{\\dfrac{1}{2}}$$'
  },
  {
    id: 'ca-135', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm plus logaritm în baza 1/5',
    statement: 'Determinați valoarea expresiei:\n$$E = 9^{\\log_3 7} + \\log_{\\frac{1}{5}} 125$$',
    solution: '$$9^{\\log_3 7} = (3^2)^{\\log_3 7} = (3^{\\log_3 7})^2 = 7^2 = 49$$\n\n$$\\log_{\\frac{1}{5}} 125 = \\log_{5^{-1}} 5^3 = \\frac{3}{-1} = -3$$\n\n$$E = 49 + (-3) = \\boxed{46}$$'
  },
  {
    id: 'ca-136', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical din sumă de putere fracționară și logaritm negativ',
    statement: 'Determinați valoarea expresiei:\n$$E = \\sqrt{64^{\\frac{1}{3}} + \\log_2 \\frac{1}{16}}$$',
    solution: '$$64^{\\frac{1}{3}} = 4$$\n\n$$\\log_2 \\frac{1}{16} = \\log_2 2^{-4} = -4$$\n\n$$E = \\sqrt{4+(-4)} = \\sqrt{0} = \\boxed{0}$$'
  },
  {
    id: 'ca-137', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm plus putere negativă — verificare număr întreg',
    statement: 'Arătați că numărul $a$ este întreg:\n$$a = \\log_{16} 64 + 8^{-\\frac{1}{3}}$$',
    solution: '$$\\log_{16} 64 = \\log_{2^4} 2^6 = \\frac{6}{4} = \\frac{3}{2}$$\n\n$$8^{-\\frac{1}{3}} = (2^3)^{-\\frac{1}{3}} = 2^{-1} = \\frac{1}{2}$$\n\n$$a = \\frac{3}{2} + \\frac{1}{2} = \\boxed{2 \\in \\mathbb{Z}}$$'
  },
  {
    id: 'ca-138', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical dintr-un pătrat cu radical minus radical și număr întreg',
    statement: 'Determinați valoarea expresiei:\n$$E = \\sqrt{(\\sqrt{3}-1)^2} - \\sqrt{27} + 1$$',
    solution: '$$\\sqrt{(\\sqrt{3}-1)^2} = |\\sqrt{3}-1| = \\sqrt{3}-1 \\quad (\\text{deoarece }\\sqrt{3}>1)$$\n\n$$\\sqrt{27} = 3\\sqrt{3}$$\n\n$$E = \\sqrt{3}-1 - 3\\sqrt{3} + 1 = \\boxed{-2\\sqrt{3}}$$'
  },
  {
    id: 'ca-139', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 dintr-un produs cu exponent irațional de baza 2',
    statement: 'Determinați valoarea expresiei:\n$$E = \\sqrt[3]{2^{(\\sqrt{2}-1)^2}\\cdot 4^{\\sqrt{2}}}$$',
    solution: '$$(\\sqrt{2}-1)^2 = 2 - 2\\sqrt{2} + 1 = 3 - 2\\sqrt{2}$$\n\n$$4^{\\sqrt{2}} = 2^{2\\sqrt{2}}$$\n\n$$2^{3-2\\sqrt{2}}\\cdot 2^{2\\sqrt{2}} = 2^3 = 8$$\n\n$$E = \\sqrt[3]{8} = \\boxed{2}$$'
  },
  {
    id: 'ca-140', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm dintr-o funcție trigonometrică',
    statement: 'Determinați valoarea expresiei:\n$$E = 3^{\\log_{\\sqrt{3}} \\text{tg}\\,60^\\circ}$$',
    solution: '$$\\text{tg}\\,60^\\circ = \\sqrt{3}$$\n\n$$\\log_{\\sqrt{3}} \\sqrt{3} = 1$$\n\n$$E = 3^1 = \\boxed{3}$$'
  },
  {
    id: 'ca-141', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Putere cu exponent sumă de inversul unui logaritm și 1',
    statement: 'Determinați valoarea expresiei:\n$$E = 8^{\\frac{1}{\\log_5 4}+1}$$',
    solution: '$$\\frac{1}{\\log_5 4} = \\log_4 5$$\n\n$$\\log_4 5 + 1 = \\log_4 5 + \\log_4 4 = \\log_4 20$$\n\n$$8 = 4^{\\frac{3}{2}} \\Rightarrow 8^{\\log_4 20} = (4^{\\log_4 20})^{\\frac{3}{2}} = 20^{\\frac{3}{2}} = 20\\sqrt{20} = \\boxed{40\\sqrt{5}}$$'
  },
  {
    id: 'ca-142', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Sumă de radicali de ordinul 3 la puteri fracționare',
    statement: 'Determinați valoarea expresiei:\n$$E = \\left(\\sqrt[3]{81}\\right)^{\\frac{3}{2}} + \\left(\\sqrt[3]{4}\\right)^{\\frac{9}{2}}$$',
    solution: '$$\\left(\\sqrt[3]{81}\\right)^{\\frac{3}{2}} = (3^{\\frac{4}{3}})^{\\frac{3}{2}} = 3^2 = 9$$\n\n$$\\left(\\sqrt[3]{4}\\right)^{\\frac{9}{2}} = (2^{\\frac{2}{3}})^{\\frac{9}{2}} = 2^3 = 8$$\n\n$$E = 9 + 8 = \\boxed{17}$$'
  },
  {
    id: 'ca-143', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă a fracției minus putere cu exponent fracționar',
    statement: 'Determinați valoarea expresiei:\n$$E = \\left(-\\frac{1}{5}\\right)^{-2} - 125^{\\frac{2}{3}}$$',
    solution: '$$\\left(-\\frac{1}{5}\\right)^{-2} = (-5)^2 = 25$$\n\n$$125^{\\frac{2}{3}} = (5^3)^{\\frac{2}{3}} = 5^2 = 25$$\n\n$$E = 25 - 25 = \\boxed{0}$$'
  },
  {
    id: 'ca-144', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical din sumă de putere fracționară și putere negativă a fracției',
    statement: 'Determinați valoarea expresiei:\n$$E = \\sqrt{81^{\\frac{3}{4}} + \\left(\\frac{1}{3}\\right)^{-2}}$$',
    solution: '$$81^{\\frac{3}{4}} = 27, \\quad \\left(\\frac{1}{3}\\right)^{-2} = 9$$\n\n$$E = \\sqrt{27+9} = \\sqrt{36} = \\boxed{6}$$'
  },
  {
    id: 'ca-145', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent ce conține logaritm — verificare pătrat perfect',
    statement: 'Arătați că valoarea expresiei $25^{1+\\log_5 2}$ este un pătrat perfect.',
    solution: '$$25^{1+\\log_5 2} = 25\\cdot 25^{\\log_5 2} = 25\\cdot(5^2)^{\\log_5 2} = 25\\cdot(5^{\\log_5 2})^2 = 25\\cdot 4 = 100 = 10^2$$\n\n$$\\boxed{100 = 10^2 \\text{ este pătrat perfect}}$$'
  },
  {
    id: 'ca-146', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Media aritmetică a doi logaritmi cu argumente conjugate',
    statement: 'Calculați media aritmetică a numerelor $a$ și $b$:\n$$E = \\dfrac{a+b}{2}, \\quad a = \\log_2(6-2\\sqrt{5}), \\quad b = \\log_2(6+2\\sqrt{5})$$',
    solution: '$$a+b = \\log_2[(6-2\\sqrt{5})(6+2\\sqrt{5})] = \\log_2[36-20] = \\log_2 16 = 4$$\n\n$$E = \\frac{4}{2} = \\boxed{2}$$'
  },
  {
    id: 'ca-147', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm în baza 36 plus logaritm în baza 3',
    statement: 'Calculați valoarea expresiei:\n$$E = 6^{\\log_{36} 49} + \\log_3 27$$',
    solution: '$$\\log_{36} 49 = \\log_{6^2} 7^2 = \\log_6 7$$\n\n$$6^{\\log_6 7} = 7$$\n\n$$\\log_3 27 = 3$$\n\n$$E = 7 + 3 = \\boxed{10}$$'
  },
  {
    id: 'ca-101', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Fracție de puteri ale lui 3 cu exponenți negativi și fracționari',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{9^{-2}\\cdot 81^{\\frac{3}{4}}}{\\left(\\dfrac{1}{3}\\right)^{-1}}$$',
    solution: '$$9^{-2} = 3^{-4}, \\quad 81^{\\frac{3}{4}} = (3^4)^{\\frac{3}{4}} = 3^3$$\n\n$$\\left(\\frac{1}{3}\\right)^{-1} = 3$$\n\n$$E = \\frac{3^{-4}\\cdot 3^3}{3} = \\frac{3^{-1}}{3} = 3^{-2} = \\boxed{\\dfrac{1}{9}}$$'
  },
  {
    id: 'ca-102', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical 3 minus logaritm în baza 9 al unei puteri',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt{3}} 24 - \\log_9 4^6$$',
    solution: '$$\\log_{\\sqrt{3}} 24 = 2\\log_3 24$$\n\n$$\\log_9 4^6 = \\frac{6\\log_3 4}{2} = 3\\log_3 4$$\n\n$$E = 2\\log_3 24 - 3\\log_3 4 = \\log_3 24^2 - \\log_3 4^3 = \\log_3 \\frac{576}{64} = \\log_3 9 = \\boxed{2}$$'
  },
  {
    id: 'ca-103', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali conjugați cu radicali în interior',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{7+2\\sqrt{10}}\\cdot\\sqrt{7-2\\sqrt{10}}$$',
    solution: '$$E = \\sqrt{(7+2\\sqrt{10})(7-2\\sqrt{10})} = \\sqrt{49-4\\cdot10} = \\sqrt{9} = \\boxed{3}$$'
  },
  {
    id: 'ca-104', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm iterativ plus logaritm dintr-un radical',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_4\\!\\left(\\log_9 81\\right) + \\log_3\\sqrt{3}$$',
    solution: '$$\\log_9 81 = \\log_{3^2} 3^4 = 2$$\n\n$$\\log_4 2 = \\log_{2^2} 2 = \\frac{1}{2}$$\n\n$$\\log_3\\sqrt{3} = \\frac{1}{2}$$\n\n$$E = \\frac{1}{2} + \\frac{1}{2} = \\boxed{1}$$'
  },
  {
    id: 'ca-105', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi în baza 3 plus putere cu bază fracție irațională',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_3 54 - \\log_3 6 + \\left(\\frac{1}{\\sqrt{2}}\\right)^{-2}$$',
    solution: '$$\\log_3 54 - \\log_3 6 = \\log_3 \\frac{54}{6} = \\log_3 9 = 2$$\n\n$$\\left(\\frac{1}{\\sqrt{2}}\\right)^{-2} = (\\sqrt{2})^2 = 2$$\n\n$$E = 2 + 2 = \\boxed{4}$$'
  },
  {
    id: 'ca-106', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Radical din sumă de puteri cu exponenți logaritmici',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{25^{\\frac{1}{2}\\log_5 12} + 7^{2\\log_7 2}}$$',
    solution: '$$25^{\\frac{1}{2}\\log_5 12} = (5^2)^{\\frac{1}{2}\\log_5 12} = 5^{\\log_5 12} = 12$$\n\n$$7^{2\\log_7 2} = \\left(7^{\\log_7 2}\\right)^2 = 2^2 = 4$$\n\n$$E = \\sqrt{12+4} = \\sqrt{16} = \\boxed{4}$$'
  },
  {
    id: 'ca-107', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs de radicali de ordinul 4 cu radicali conjugați',
    statement: 'Aflați valoarea expresiei:\n$$E = \\sqrt[4]{7-\\sqrt{33}}\\cdot\\sqrt[4]{7+\\sqrt{33}}$$',
    solution: '$$E = \\sqrt[4]{(7-\\sqrt{33})(7+\\sqrt{33})} = \\sqrt[4]{49-33} = \\sqrt[4]{16} = \\boxed{2}$$'
  },
  {
    id: 'ca-108', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Combinație de trei logaritmi în aceeași bază',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_6 60 - \\log_6 5 + \\log_6 3$$',
    solution: '$$\\log_6 60 - \\log_6 5 = \\log_6 \\frac{60}{5} = \\log_6 12$$\n\n$$\\log_6 12 + \\log_6 3 = \\log_6 36 = \\log_6 6^2 = \\boxed{2}$$'
  },
  {
    id: 'ca-109', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi cu argumente sub formă de puteri',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_2\\!\\left(16^{\\frac{1}{2}}\\right) - \\log_3\\!\\left(\\frac{1}{9}\\right)^{\\frac{1}{2}}$$',
    solution: '$$\\log_2 16^{\\frac{1}{2}} = \\log_2 4 = 2$$\n\n$$\\left(\\frac{1}{9}\\right)^{\\frac{1}{2}} = \\frac{1}{3} \\Rightarrow \\log_3\\frac{1}{3} = -1$$\n\n$$E = 2 - (-1) = \\boxed{3}$$'
  },
  {
    id: 'ca-110', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Logaritm, radical dintr-o fracție mixtă și putere cu exponent logaritm',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_3 27 - \\sqrt{6\\tfrac{1}{4}} + 3^{\\log_{\\sqrt{3}}\\frac{\\sqrt{2}}{2}}$$',
    solution: '$$\\log_3 27 = 3$$\n\n$$\\sqrt{6\\frac{1}{4}} = \\sqrt{\\frac{25}{4}} = \\frac{5}{2}$$\n\n$$\\log_{\\sqrt{3}} x = 2\\log_3 x \\Rightarrow 3^{\\log_{\\sqrt{3}}\\frac{\\sqrt{2}}{2}} = \\left(\\frac{\\sqrt{2}}{2}\\right)^2 = \\frac{1}{2}$$\n\n$$E = 3 - \\frac{5}{2} + \\frac{1}{2} = 3 - 2 = \\boxed{1}$$'
  },
  {
    id: 'ca-111', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferența dintre doi logaritmi cu baze și argumente diferite',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt{27}} 3 - \\frac{1}{3}\\log_3 \\frac{1}{81}$$',
    solution: '$$\\log_{\\sqrt{27}} 3 = \\log_{3^{\\frac{3}{2}}} 3 = \\frac{2}{3}$$\n\n$$\\frac{1}{3}\\log_3 \\frac{1}{81} = \\frac{1}{3}\\log_3 3^{-4} = \\frac{1}{3}\\cdot(-4) = -\\frac{4}{3}$$\n\n$$E = \\frac{2}{3} - \\left(-\\frac{4}{3}\\right) = \\frac{2}{3} + \\frac{4}{3} = \\boxed{2}$$'
  },
  {
    id: 'ca-112', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Media aritmetică a doi logaritmi cu baze radicale',
    statement: 'Calculați media aritmetică a expresiilor:\n$$E = \\dfrac{\\log_{\\sqrt[3]{16}} 2 + \\dfrac{2}{\\log_8 4}}{2}$$',
    solution: '$$\\log_{\\sqrt[3]{16}} 2 = \\log_{2^{\\frac{4}{3}}} 2 = \\frac{3}{4}$$\n\n$$\\log_8 4 = \\log_{2^3} 2^2 = \\frac{2}{3} \\Rightarrow \\frac{2}{\\log_8 4} = \\frac{2}{\\frac{2}{3}} = 3$$\n\n$$E = \\frac{\\frac{3}{4} + 3}{2} = \\frac{\\frac{15}{4}}{2} = \\boxed{\\dfrac{15}{8}}$$'
  },

  {
    id: 'ca-148', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical din 2 minus 4',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt{2}} 4 - 4$$',
    solution: '$$\\log_{\\sqrt{2}} 4 = \\log_{2^{1/2}} 2^2 = \\frac{2}{1/2} = 4$$\n\n$$E = 4 - 4 = \\boxed{0}$$'
  },
  {
    id: 'ca-149', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă a lui 27 minus fracție',
    statement: 'Calculați valoarea expresiei:\n$$E = 27^{-\\frac{2}{3}} - \\frac{10}{9}$$',
    solution: '$$27^{-\\frac{2}{3}} = (3^3)^{-\\frac{2}{3}} = 3^{-2} = \\frac{1}{9}$$\n\n$$E = \\frac{1}{9} - \\frac{10}{9} = -\\frac{9}{9} = \\boxed{-1}$$'
  },
  {
    id: 'ca-150', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 din 81 împărțit la putere a lui 9',
    statement: 'Calculați valoarea expresiei:\n$$E = \\frac{\\sqrt[3]{81}}{9^{1/6}}$$',
    solution: '$$\\sqrt[3]{81} = (3^4)^{1/3} = 3^{4/3}$$\n\n$$9^{1/6} = (3^2)^{1/6} = 3^{1/3}$$\n\n$$E = \\frac{3^{4/3}}{3^{1/3}} = 3^{4/3 - 1/3} = 3^1 = \\boxed{3}$$'
  },
  {
    id: 'ca-151', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Număr zecimal plus logaritm în baza 2 din radical',
    statement: 'Calculați valoarea expresiei:\n$$E = 1{,}5 + \\log_2 \\sqrt{8}$$',
    solution: '$$\\log_2 \\sqrt{8} = \\frac{1}{2}\\log_2 8 = \\frac{1}{2} \\cdot 3 = \\frac{3}{2} = 1{,}5$$\n\n$$E = 1{,}5 + 1{,}5 = \\boxed{3}$$'
  },
  {
    id: 'ca-152', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă a lui 2 plus radical de ordinul 3 minus număr',
    statement: 'Calculați valoarea expresiei:\n$$E = 2^{-2} + \\sqrt[3]{\\dfrac{27}{64}} - 2$$',
    solution: '$$2^{-2} = \\frac{1}{4}$$\n\n$$\\sqrt[3]{\\frac{27}{64}} = \\frac{3}{4}$$\n\n$$E = \\frac{1}{4} + \\frac{3}{4} - 2 = 1 - 2 = \\boxed{-1}$$'
  },
  {
    id: 'ca-153', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 81 din 27 plus putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{81} 27 + 4^{-1}$$',
    solution: '$$\\log_{81} 27 = \\log_{3^4} 3^3 = \\frac{3}{4}$$\n\n$$4^{-1} = \\frac{1}{4}$$\n\n$$E = \\frac{3}{4} + \\frac{1}{4} = \\boxed{1}$$'
  },
  {
    id: 'ca-154', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Suma logaritmilor în baze reciproce 5 și 1/5',
    statement: 'Calculați suma numerelor:\n$$\\log_5 50 \\text{ și } \\log_{\\frac{1}{5}} 2$$',
    solution: '$$\\log_{\\frac{1}{5}} 2 = -\\log_5 2$$\n\n$$\\log_5 50 - \\log_5 2 = \\log_5 \\frac{50}{2} = \\log_5 25 = \\boxed{2}$$'
  },
  {
    id: 'ca-155', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical din putere zecimală minus număr',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt{9^{1{,}5} - 2}$$',
    solution: '$$9^{1{,}5} = (3^2)^{3/2} = 3^3 = 27$$\n\n$$E = \\sqrt{27 - 2} = \\sqrt{25} = \\boxed{5}$$'
  },
  {
    id: 'ca-156', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Logaritm în baza 3 din 36 minus logaritm dublu',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_3 36 - 2\\log_3 2$$',
    solution: '$$2\\log_3 2 = \\log_3 4$$\n\n$$E = \\log_3 36 - \\log_3 4 = \\log_3 \\frac{36}{4} = \\log_3 9 = \\boxed{2}$$'
  },
  {
    id: 'ca-157', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza 1/2 minus logaritm în baza 2',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\frac{1}{2}} \\frac{4}{5} - \\log_2 5$$',
    solution: '$$\\log_{\\frac{1}{2}} \\frac{4}{5} = -\\log_2 \\frac{4}{5} = -(\\log_2 4 - \\log_2 5) = -2 + \\log_2 5$$\n\n$$E = -2 + \\log_2 5 - \\log_2 5 = \\boxed{-2}$$'
  },
  {
    id: 'ca-158', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 dintr-un produs cu putere fracționară',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{-128 \\cdot 0{,}125^{\\frac{1}{3}}}$$',
    solution: '$$0{,}125 = \\frac{1}{8} = 2^{-3} \\Rightarrow 0{,}125^{1/3} = 2^{-1} = \\frac{1}{2}$$\n\n$$-128 \\cdot \\frac{1}{2} = -64$$\n\n$$E = \\sqrt[3]{-64} = \\boxed{-4}$$'
  },
  {
    id: 'ca-159', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Diferență de logaritmi în baze reciproce 3 și 1/3',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_3 54 - \\log_{\\frac{1}{3}} 0{,}5$$',
    solution: '$$\\log_{\\frac{1}{3}} 0{,}5 = \\frac{\\ln(1/2)}{\\ln(1/3)} = \\frac{-\\ln 2}{-\\ln 3} = \\log_3 2$$\n\n$$E = \\log_3 54 - \\log_3 2 = \\log_3 \\frac{54}{2} = \\log_3 27 = \\boxed{3}$$'
  },
  {
    id: 'ca-160', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere cu exponent 0,25 a fracției 16/81 minus fracție',
    statement: 'Calculați valoarea expresiei:\n$$E = -\\frac{5}{3} + \\left(\\frac{16}{81}\\right)^{0{,}25}$$',
    solution: '$$\\left(\\frac{16}{81}\\right)^{1/4} = \\frac{16^{1/4}}{81^{1/4}} = \\frac{2}{3}$$\n\n$$E = -\\frac{5}{3} + \\frac{2}{3} = -\\frac{3}{3} = \\boxed{-1}$$'
  },
  {
    id: 'ca-161', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 din putere zecimală minus număr',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{32^{0{,}4} - 12}$$',
    solution: '$$32^{0{,}4} = (2^5)^{2/5} = 2^2 = 4$$\n\n$$E = \\sqrt[3]{4 - 12} = \\sqrt[3]{-8} = \\boxed{-2}$$'
  },
  {
    id: 'ca-162', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Putere negativă a fracției 27/125 minus fracție',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{27}{125}\\right)^{-1/3} - \\frac{2}{3}$$',
    solution: '$$\\left(\\frac{27}{125}\\right)^{-1/3} = \\left(\\frac{125}{27}\\right)^{1/3} = \\frac{5}{3}$$\n\n$$E = \\frac{5}{3} - \\frac{2}{3} = \\frac{3}{3} = \\boxed{1}$$'
  },
  {
    id: 'ca-163', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Logaritm în baza radical cubic din 5 minus inversul unei fracții',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_{\\sqrt[3]{5}} 25 - \\left(\\frac{1}{6}\\right)^{-1}$$',
    solution: '$$\\log_{5^{1/3}} 5^2 = \\frac{2}{1/3} = 6$$\n\n$$\\left(\\frac{1}{6}\\right)^{-1} = 6$$\n\n$$E = 6 - 6 = \\boxed{0}$$'
  },
  {
    id: 'ca-164', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent 1/4 a lui 0,0081 plus inversul unui număr mixt',
    statement: 'Calculați valoarea expresiei:\n$$E = (0{,}0081)^{1/4} + \\left(1\\frac{3}{7}\\right)^{-1}$$',
    solution: '$$0{,}0081 = \\frac{81}{10000} \\Rightarrow (0{,}0081)^{1/4} = \\frac{3}{10}$$\n\n$$1\\frac{3}{7} = \\frac{10}{7} \\Rightarrow \\left(\\frac{10}{7}\\right)^{-1} = \\frac{7}{10}$$\n\n$$E = \\frac{3}{10} + \\frac{7}{10} = \\boxed{1}$$'
  },
  {
    id: 'ca-165', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Putere cu exponent 1,5 a fracției înmulțită cu puterea lui -5',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{4}{25}\\right)^{1{,}5} \\cdot (-5)^3$$',
    solution: '$$\\left(\\frac{4}{25}\\right)^{3/2} = \\left(\\frac{2}{5}\\right)^3 = \\frac{8}{125}$$\n\n$$(-5)^3 = -125$$\n\n$$E = \\frac{8}{125} \\cdot (-125) = \\boxed{-8}$$'
  },
  {
    id: 'ca-166', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical de ordinul 3 din număr mixt negativ plus putere negativă',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sqrt[3]{-2\\dfrac{10}{27}} + 9^{-0{,}5}$$',
    solution: '$$2\\frac{10}{27} = \\frac{64}{27} \\Rightarrow \\sqrt[3]{-\\frac{64}{27}} = -\\frac{4}{3}$$\n\n$$9^{-0{,}5} = \\frac{1}{3}$$\n\n$$E = -\\frac{4}{3} + \\frac{1}{3} = -\\frac{3}{3} = \\boxed{-1}$$'
  },
  {
    id: 'ca-167', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Produs de puteri cu exponenți fracționari din fracții neparfecte',
    statement: 'Calculați valoarea expresiei:\n$$E = \\left(\\frac{189}{4}\\right)^{\\frac{1}{4}} \\cdot \\left(\\frac{7}{12}\\right)^{-0{,}25}$$',
    solution: '$$\\left(\\frac{189}{4}\\right)^{1/4} \\cdot \\left(\\frac{12}{7}\\right)^{1/4} = \\left(\\frac{189}{4} \\cdot \\frac{12}{7}\\right)^{1/4} = \\left(\\frac{2268}{28}\\right)^{1/4} = 81^{1/4} = \\boxed{3}$$'
  },
  {
    id: 'ca-168', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm negativ în baza 4',
    statement: 'Calculați valoarea expresiei:\n$$E = 2^{-\\log_4 9}$$',
    solution: '$$\\log_4 9 = \\log_{2^2} 3^2 = \\log_2 3$$\n\n$$E = 2^{-\\log_2 3} = 3^{-1} = \\boxed{\\dfrac{1}{3}}$$'
  },
  {
    id: 'ca-169', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Suma logaritmilor în baze reciproce 7 și 1/7',
    statement: 'Calculați valoarea expresiei:\n$$E = \\log_7 2 + \\log_{\\frac{1}{7}} 98$$',
    solution: '$$\\log_{\\frac{1}{7}} 98 = -\\log_7 98$$\n\n$$E = \\log_7 2 - \\log_7 98 = \\log_7 \\frac{2}{98} = \\log_7 \\frac{1}{49} = \\log_7 7^{-2} = \\boxed{-2}$$'
  },

  /* ============================================================
     ALGEBRĂ — Inecuații
     ============================================================ */
  {
    id: 'rat-in-001', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu fracții și numitor comun 1−x²',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{1}{x+1} < \\frac{2x+3}{x-1}+\\frac{x}{1-x^2}$$',
    solution: '**Domeniu:** $x \\neq \\pm 1$. Notăm că $1-x^2 = -(x+1)(x-1)$.\n\nAducem totul în stânga; numitor comun $(x+1)(x-1)$:\n\n$$\\frac{(x-1)-(2x+3)(x+1)+x}{(x+1)(x-1)} < 0$$\n\nNumărător: $(x-1)-(2x^2+5x+3)+x = -2x^2-3x-4$.\n\n$\\Delta = 9 - 32 = -23 < 0$ și coef. lui $x^2$ este $-2 < 0$, deci $-2x^2-3x-4 < 0$ $\\forall x \\in \\mathbb{R}$.\n\nInecuația devine $\\dfrac{\\text{negativ}}{(x+1)(x-1)} < 0$, adică $(x+1)(x-1) > 0 \\iff x^2 > 1$.\n\n$$\\boxed{x \\in (-\\infty,\\,-1) \\cup (1,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-002', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu fracție și termen întreg',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{4}{x-3} \\geq x$$',
    solution: '**Domeniu:** $x \\neq 3$.\n\n$$\\frac{4}{x-3}-x \\geq 0 \\iff \\frac{4-x(x-3)}{x-3} \\geq 0 \\iff \\frac{-x^2+3x+4}{x-3} \\geq 0 \\iff \\frac{(x-4)(x+1)}{x-3} \\leq 0$$\n\nTabel de semne:\n\n| $x$ | $(-\\infty,-1)$ | $-1$ | $(-1,3)$ | $3$ | $(3,4)$ | $4$ | $(4,+\\infty)$ |\n|---|---|---|---|---|---|---|---|\n| $x+1$ | $-$ | $0$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| $x-4$ | $-$ | $-$ | $-$ | $-$ | $-$ | $0$ | $+$ |\n| $x-3$ | $-$ | $-$ | $-$ | ND | $+$ | $+$ | $+$ |\n| raport | $-$ | $0$ | $+$ | ND | $-$ | $0$ | $+$ |\n\n$$\\boxed{x \\in (-\\infty,\\,-1] \\cup (3,\\,4]}$$'
  },
  {
    id: 'rat-in-003', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu fracție și termen pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{x}{x+4} < 3x$$',
    solution: '**Domeniu:** $x \\neq -4$.\n\n$$\\frac{x}{x+4}-3x < 0 \\iff \\frac{x-3x(x+4)}{x+4} < 0 \\iff \\frac{-3x^2-11x}{x+4} < 0 \\iff \\frac{x(3x+11)}{x+4} > 0$$\n\nTabel de semne (zeros: $x=-4$ exclus, $x=-\\tfrac{11}{3}$, $x=0$):\n\n| $x$ | $(-\\infty,-4)$ | $(-4,-\\tfrac{11}{3})$ | $(-\\tfrac{11}{3},0)$ | $0$ | $(0,+\\infty)$ |\n|---|---|---|---|---|---|\n| $x$ | $-$ | $-$ | $-$ | $0$ | $+$ |\n| $3x+11$ | $-$ | $-$ | $+$ | $+$ | $+$ |\n| $x+4$ | $-$ | $+$ | $+$ | $+$ | $+$ |\n| raport | $-$ | $+$ | $-$ | $0$ | $+$ |\n\n$$\\boxed{x \\in \\left(-4,\\,-\\dfrac{11}{3}\\right) \\cup (0,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-004', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu numitor logaritmic și numărător cubic',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{x^3-4x}{\\ln(x+5)-\\ln 3} \\leq 0$$',
    solution: '**Domeniu:** $x > -5$, $x \\neq -2$ (anulează numitorul).\n\nNumărător: $x^3-4x = x(x-2)(x+2)$, zeros: $-2, 0, 2$.\n\nNumitor: $\\ln\\dfrac{x+5}{3}$; negativ pe $(-5,-2)$, pozitiv pe $(-2,+\\infty)$.\n\n| $x$ | $(-5,-2)$ | $(-2,0)$ | $0$ | $(0,2)$ | $2$ | $(2,+\\infty)$ |\n|---|---|---|---|---|---|---|\n| $x(x-2)(x+2)$ | $-$ | $+$ | $0$ | $-$ | $0$ | $+$ |\n| $\\ln\\frac{x+5}{3}$ | $-$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| raport | $+$ | $+$ | $0$ | $-$ | $0$ | $+$ |\n\n$$\\boxed{x \\in [0,\\,2]}$$'
  },
  {
    id: 'rat-in-005', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu modul la numărător și logaritm la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{|x^2-9|}{\\log_{0{,}5} x} \\geq 0$$',
    solution: '**Domeniu:** $x > 0$, $x \\neq 1$ (numitorul ar fi $0$).\n\n$|x^2-9| \\geq 0$ mereu; este $= 0$ când $x = 3$.\n\nDeoarece baza $0{,}5 < 1$, $\\log_{0{,}5}$ este descrescător:\n$\\log_{0{,}5} x > 0 \\iff x < 1$;\\ $\\log_{0{,}5} x < 0 \\iff x > 1$.\n\n**Cazul 1:** $x \\in (0,1)$: numărător $\\geq 0$, numitor $> 0$ $\\Rightarrow$ raport $\\geq 0$ ✓\n\n**Cazul 2:** $x = 3$: numărător $= 0$ $\\Rightarrow$ raport $= 0 \\geq 0$ ✓\n\n**Cazul 3:** $x \\in (1,+\\infty)$, $x \\neq 3$: numărător $> 0$, numitor $< 0$ $\\Rightarrow$ raport $< 0$ ✗\n\n$$\\boxed{x \\in (0,\\,1) \\cup \\{3\\}}$$'
  },
  {
    id: 'rat-in-006', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical la numărător și expresie exponențială la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{x+3}}{4^x-6\\cdot 2^x+8} \\leq 0$$',
    solution: '**Domeniu:** $x \\geq -3$; numitorul $\\neq 0$.\n\nFie $t = 2^x > 0$: $t^2-6t+8=(t-2)(t-4)=0 \\Rightarrow x=1$ sau $x=2$ (excluse).\n\nSemnul numitorului $(2^x-2)(2^x-4)$:\n$x < 1$: $(-)(-) = +$;\\ $1 < x < 2$: $(+)(-) = -$;\\ $x > 2$: $(+)(+) = +$.\n\nNumărător $\\sqrt{x+3} \\geq 0$; zero la $x = -3$.\n\n| $x$ | $-3$ | $(-3,1)$ | $(1,2)$ | $(2,+\\infty)$ |\n|---|---|---|---|---|\n| $\\sqrt{x+3}$ | $0$ | $+$ | $+$ | $+$ |\n| $(2^x-2)(2^x-4)$ | $+$ | $+$ | $-$ | $+$ |\n| raport | $0$ | $+$ | $-$ | $+$ |\n\n$$\\boxed{x \\in \\{-3\\} \\cup (1,\\,2)}$$'
  },
  {
    id: 'rat-in-007', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu fracții cu același factor la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{x+3}{(x-1)(x+5)} \\geq \\frac{1}{x-1}$$',
    solution: '**Domeniu:** $x \\neq 1$, $x \\neq -5$.\n\n$$\\frac{x+3}{(x-1)(x+5)}-\\frac{1}{x-1} \\geq 0 \\iff \\frac{x+3-(x+5)}{(x-1)(x+5)} \\geq 0 \\iff \\frac{-2}{(x-1)(x+5)} \\geq 0$$\n\nDeoarece $-2 < 0$, inecuația se inversează:\n\n$$(x-1)(x+5) \\leq 0$$\n\nDar numitorul $\\neq 0$ (domeniu), deci $(x-1)(x+5) < 0 \\iff -5 < x < 1$.\n\n$$\\boxed{x \\in (-5,\\,1)}$$'
  },
  {
    id: 'rat-in-008', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical și numitor pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{(7-2x)\\sqrt{x-2}}{x^2-16} > 0$$',
    solution: '**Domeniu:** $x \\geq 2$, $x \\neq 4$.\n\nPentru inegalitate strictă trebuie $\\sqrt{x-2} > 0 \\Rightarrow x > 2$.\n\n$x^2-16 = (x-4)(x+4)$; pentru $x > 2$: $x+4 > 0$, deci semnul numitorului = semnul lui $x-4$.\n\n| $x$ | $(2,\\,\\frac{7}{2})$ | $\\frac{7}{2}$ | $(\\frac{7}{2},4)$ | $4$ | $(4,+\\infty)$ |\n|---|---|---|---|---|---|\n| $7-2x$ | $+$ | $0$ | $-$ | $-$ | $-$ |\n| $\\sqrt{x-2}$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| $x^2-16$ | $-$ | $-$ | $-$ | ND | $+$ |\n| raport | $-$ | $0$ | $+$ | ND | $-$ |\n\n$$\\boxed{x \\in \\left(\\dfrac{7}{2},\\,4\\right)}$$'
  },
  {
    id: 'rat-in-009', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu modul la numărător și logaritm la numitor (baza subunitară)',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{|x-2|}{\\log_{0{,}4}(3x+1)} < 0$$',
    solution: '**Domeniu:** $3x+1 > 0 \\Rightarrow x > -\\dfrac{1}{3}$; $x \\neq 0$ (numitorul ar fi $0$).\n\n$|x-2| \\geq 0$; pentru fracție $< 0$ trebuie numărător $> 0$ (deci $x \\neq 2$) și numitor $< 0$.\n\nDeoarece baza $0{,}4 < 1$:\n$\\log_{0{,}4}(3x+1) < 0 \\iff 3x+1 > 0{,}4^0 = 1 \\iff x > 0$.\n\nDeci condiția devine: $x > 0$ și $x \\neq 2$.\n\n**La $x = 2$:** $|2-2| = 0 \\Rightarrow$ fracție $= 0$, nu $< 0$. Exclus.\n\n$$\\boxed{x \\in (0,\\,2) \\cup (2,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-010', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu termen întreg și fracție cu x la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$x+3 \\geq \\frac{4+3x}{x}$$',
    solution: '**Domeniu:** $x \\neq 0$.\n\n$$x+3-\\frac{4+3x}{x} \\geq 0 \\iff \\frac{x(x+3)-(4+3x)}{x} \\geq 0 \\iff \\frac{x^2-4}{x} \\geq 0 \\iff \\frac{(x-2)(x+2)}{x} \\geq 0$$\n\nTabel de semne:\n\n| $x$ | $(-\\infty,-2)$ | $-2$ | $(-2,0)$ | $0$ | $(0,2)$ | $2$ | $(2,+\\infty)$ |\n|---|---|---|---|---|---|---|---|\n| $x+2$ | $-$ | $0$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| $x-2$ | $-$ | $-$ | $-$ | $-$ | $-$ | $0$ | $+$ |\n| $x$ | $-$ | $-$ | $-$ | ND | $+$ | $+$ | $+$ |\n| raport | $-$ | $0$ | $+$ | ND | $-$ | $0$ | $+$ |\n\n$$\\boxed{x \\in [-2,\\,0) \\cup [2,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-011', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu logaritmi de baze reciproce la numărător',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\log_2(x+1)-\\log_{0{,}5}(x-1)}{x^2-4} > 0$$',
    solution: '**Domeniu:** $x > 1$, $x \\neq 2$.\n\nDeoarece $\\log_{0{,}5}(x-1) = -\\log_2(x-1)$, numărătorul devine:\n$$\\log_2(x+1)+\\log_2(x-1) = \\log_2(x^2-1)$$\n\nSemnul numărătorului: $\\log_2(x^2-1) \\gtrless 0 \\iff x^2-1 \\gtrless 1 \\iff x \\gtrless \\sqrt{2}$.\n\n$x^2-4 = (x-2)(x+2)$; pentru $x > 1$: $x+2 > 0$, deci semnul numitorului = semnul lui $x-2$.\n\n| $x$ | $(1,\\sqrt{2})$ | $\\sqrt{2}$ | $(\\sqrt{2},2)$ | $2$ | $(2,+\\infty)$ |\n|---|---|---|---|---|---|\n| $\\log_2(x^2-1)$ | $-$ | $0$ | $+$ | $+$ | $+$ |\n| $x-2$ | $-$ | $-$ | $-$ | ND | $+$ |\n| raport | $+$ | $0$ | $-$ | ND | $+$ |\n\n$$\\boxed{x \\in (1,\\,\\sqrt{2}) \\cup (2,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-012', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical la numărător și pătratic la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{2x^2-7x+5}}{x^2-16} < 0$$',
    solution: '$2x^2-7x+5 = (2x-5)(x-1)$, zerouri la $x=1$ și $x=\\tfrac{5}{2}$.\n\n**Domeniu:** $x \\leq 1$ sau $x \\geq \\tfrac{5}{2}$; $x \\neq \\pm 4$.\n\nPentru fracție $< 0$: $\\sqrt{2x^2-7x+5} > 0$ (adică $x < 1$ sau $x > \\tfrac{5}{2}$) și $x^2-16 < 0$ (adică $-4 < x < 4$).\n\nIntersecție:\n$x < 1$ și $-4 < x < 4$: $-4 < x < 1$.\n$x > \\tfrac{5}{2}$ și $-4 < x < 4$: $\\tfrac{5}{2} < x < 4$.\n\n$$\\boxed{x \\in \\left(-4,\\,1\\right) \\cup \\left(\\dfrac{5}{2},\\,4\\right)}$$'
  },
  {
    id: 'rat-in-013', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu fracție rațională — numărător și numitor pătratici',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{-x^2-x+2}{x^2-8x+12} \\geq 0$$',
    solution: 'Numărător: $-x^2-x+2 = -(x^2+x-2) = -(x+2)(x-1)$.\n\nNumitor: $x^2-8x+12 = (x-2)(x-6)$. **Domeniu:** $x \\neq 2, x \\neq 6$.\n\n$$\\frac{-(x+2)(x-1)}{(x-2)(x-6)} \\geq 0 \\iff \\frac{(x+2)(x-1)}{(x-2)(x-6)} \\leq 0$$\n\nTabel de semne:\n\n| $x$ | $(-\\infty,-2)$ | $-2$ | $(-2,1)$ | $1$ | $(1,2)$ | $2$ | $(2,6)$ | $6$ | $(6,+\\infty)$ |\n|---|---|---|---|---|---|---|---|---|---|\n| $x+2$ | $-$ | $0$ | $+$ | $+$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| $x-1$ | $-$ | $-$ | $-$ | $0$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| $x-2$ | $-$ | $-$ | $-$ | $-$ | $-$ | ND | $+$ | $+$ | $+$ |\n| $x-6$ | $-$ | $-$ | $-$ | $-$ | $-$ | $-$ | $-$ | ND | $+$ |\n| raport | $+$ | $0$ | $-$ | $0$ | $+$ | ND | $-$ | ND | $+$ |\n\n$$\\boxed{x \\in [-2,\\,1] \\cup (2,\\,6)}$$'
  },
  {
    id: 'rat-in-014', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu logaritm compus și pătrat de logaritm',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\log_{0{,}2}\\!\\left(\\dfrac{25}{x}\\right)+\\log_5^2(x)}{x-26} > 0$$',
    solution: '**Domeniu:** $x > 0$, $x \\neq 26$.\n\nDeoarece $0{,}2 = \\tfrac{1}{5}$:\n$$\\log_{1/5}\\!\\frac{25}{x} = -\\log_5\\frac{25}{x} = -(2-\\log_5 x) = \\log_5 x - 2$$\n\nFie $t = \\log_5 x$; numărătorul devine:\n$$(t-2)+t^2 = t^2+t-2 = (t+2)(t-1)$$\n\n$(t+2)(t-1) = 0 \\Rightarrow t = -2 \\Rightarrow x = \\tfrac{1}{25}$ sau $t = 1 \\Rightarrow x = 5$.\n\nNumeratorul $< 0$ când $-2 < t < 1$, adică $\\tfrac{1}{25} < x < 5$.\nNumeratorul $> 0$ când $t < -2$ sau $t > 1$, adică $x < \\tfrac{1}{25}$ sau $x > 5$.\n\nFracție $> 0$: semne egale la numărător și numitor.\n\n$\\bullet$ Num $< 0$, denom $< 0$ ($x < 26$): $\\tfrac{1}{25} < x < 5$ ✓\n\n$\\bullet$ Num $> 0$, denom $> 0$ ($x > 26$): $x > 26$ ✓\n\n$$\\boxed{x \\in \\left(\\dfrac{1}{25},\\,5\\right) \\cup (26,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-015', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu numărător pătratic și numitor exponențial',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{x^2-3x+2}{4^{x+1}+2^x-5} \\leq 0$$',
    solution: 'Numărător: $x^2-3x+2 = (x-1)(x-2)$.\n\nNumitor: $4\\cdot4^x+2^x-5$. Fie $t = 2^x > 0$: $4t^2+t-5 = (4t+5)(t-1)$.\nDeoarece $4t+5 > 0$, semnul numitorului = semnul lui $t-1 = 2^x-1$:\n$> 0$ când $x > 0$;\\ $< 0$ când $x < 0$;\\ $= 0$ când $x = 0$ (exclus din domeniu).\n\n| $x$ | $(-\\infty,0)$ | $(0,1)$ | $1$ | $(1,2)$ | $2$ | $(2,+\\infty)$ |\n|---|---|---|---|---|---|---|\n| $(x-1)(x-2)$ | $+$ | $+$ | $0$ | $-$ | $0$ | $+$ |\n| $4^{x+1}+2^x-5$ | $-$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| raport | $-$ | $+$ | $0$ | $-$ | $0$ | $+$ |\n\n$$\\boxed{x \\in (-\\infty,\\,0) \\cup [1,\\,2]}$$'
  },
  {
    id: 'rat-in-016', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu logaritm din modul la numărător',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{-1+\\log_2|2x+6|}{x^2+6x} < 0$$',
    solution: '**Domeniu:** $2x+6 \\neq 0 \\Rightarrow x \\neq -3$;\\ $x^2+6x = x(x+6) \\neq 0 \\Rightarrow x \\neq 0,\\,-6$.\n\nSemnul numărătorului $-1+\\log_2|2x+6|$:\n$= 0 \\iff |2x+6| = 2 \\iff x = -2$ sau $x = -4$.\n$< 0 \\iff |2x+6| < 2 \\iff -4 < x < -2$.\n$> 0 \\iff x < -4$ sau $x > -2$.\n\nSemnul numitorului $x(x+6)$:\n$< 0$ pentru $-6 < x < 0$;\\ $> 0$ pentru $x < -6$ sau $x > 0$.\n\nFracție $< 0$: semne opuse la numărător și numitor.\n\n$\\bullet$ Num $> 0$ și denom $< 0$: ($x < -4$ sau $x > -2$) și $(-6 < x < 0)$:\n$(-6,-4) \\cup (-2,0)$ ✓\n\n$\\bullet$ Num $< 0$ și denom $> 0$: $(-4,-2)$ și ($x<-6$ sau $x>0$): vid ✗\n\n$$\\boxed{x \\in (-6,\\,-4) \\cup (-2,\\,0)}$$'
  },
  {
    id: 'rat-in-017', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical la numărător și expresie exponențială la numitor (II)',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{-3x^2+10x-7}}{4^x-2^{2+x}} > 0$$',
    solution: '$-3x^2+10x-7 \\geq 0 \\iff 3x^2-10x+7 \\leq 0 \\iff (3x-7)(x-1) \\leq 0 \\iff 1 \\leq x \\leq \\dfrac{7}{3}$.\n\nNumitor: $4^x-4\\cdot2^x = 2^x(2^x-4) = 0 \\iff x = 2$ (exclus).\n\n**Domeniu:** $1 \\leq x \\leq \\dfrac{7}{3}$, $x \\neq 2$.\n\nSemnul numitorului $2^x(2^x-4)$: $2^x > 0$ mereu; $2^x-4 < 0$ când $x < 2$, $> 0$ când $x > 2$.\n\nPentru fracție $> 0$: numărător $> 0$ (adică $1 < x < \\tfrac{7}{3}$) și numitor $> 0$ (adică $x > 2$).\n\nIntersecție: $2 < x < \\dfrac{7}{3}$ (posibil, deoarece $\\dfrac{7}{3} \\approx 2{,}33 > 2$).\n\n$$\\boxed{x \\in \\left(2,\\,\\dfrac{7}{3}\\right)}$$'
  },
  {
    id: 'rat-in-018', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu numărător exponențial combinat și numitor x',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{5\\cdot 4^x-7\\cdot 10^x+2\\cdot 25^x}{x} \\geq 0$$',
    solution: '**Domeniu:** $x \\neq 0$.\n\nÎmpărțim numărătorul prin $4^x > 0$; fie $t = \\left(\\dfrac{5}{2}\\right)^x > 0$:\n$$5-7\\cdot\\left(\\tfrac{5}{2}\\right)^x+2\\cdot\\left(\\tfrac{5}{2}\\right)^{2x} = 2t^2-7t+5 = (2t-5)(t-1)$$\n\n$(2t-5)(t-1) = 0 \\Rightarrow t=1 \\Rightarrow x=0$ (exclus) sau $t=\\dfrac{5}{2} \\Rightarrow x=1$.\n\nNumeratorul $\\geq 0 \\iff t \\leq 1$ sau $t \\geq \\dfrac{5}{2} \\iff x \\leq 0$ sau $x \\geq 1$.\n\nFracție $\\geq 0$:\n\n$\\bullet$ Num $> 0$, denom $> 0$ ($x > 0$): $x > 0$ și ($x < 0$ sau $x > 1$) $\\Rightarrow x > 1$.\n\n$\\bullet$ Num $= 0$: $x = 1$ ✓;\\ $x = 0$ exclus.\n\n$\\bullet$ Num $> 0$, denom $< 0$ ($x < 0$): și num $> 0$ (care pentru $x<0$ necesită $x < 0$) $\\Rightarrow$ fracție $< 0$ ✗.\n\n$$\\boxed{x \\in [1,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-019', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu parametru dat de un determinant 3×3',
    statement: 'Fie $d = \\begin{vmatrix} 3 & 1 & 2 \\\\ -1 & 0 & 5 \\\\ 1 & 0 & 4 \\end{vmatrix}$. Rezolvați în $\\mathbb{R}$ inecuația $\\dfrac{x^2-d}{x-4} \\geq 0$.',
    solution: '**Pasul 1 — calculăm $d$** (dezvoltare după coloana 2):\n$$d = -1\\cdot(-1)^{1+2}\\begin{vmatrix}-1&5\\\\1&4\\end{vmatrix} = (-4-5)\\cdot(-1)\\cdot(-1) = -9\\cdot(-1)\\cdot(-1)$$\n\nHmm, să recalculăm direct pe rând 1:\n$$d = 3(0\\cdot4-5\\cdot0)-1((-1)\\cdot4-5\\cdot1)+2((-1)\\cdot0-0\\cdot1) = 0-1(-9)+0 = 9$$\n\nDeci $d = 9$; inecuația devine:\n$$\\frac{x^2-9}{x-4} \\geq 0 \\iff \\frac{(x-3)(x+3)}{x-4} \\geq 0$$\n\nTabel de semne ($x \\neq 4$):\n\n| $x$ | $(-\\infty,-3)$ | $-3$ | $(-3,3)$ | $3$ | $(3,4)$ | $4$ | $(4,+\\infty)$ |\n|---|---|---|---|---|---|---|---|\n| $x+3$ | $-$ | $0$ | $+$ | $+$ | $+$ | $+$ | $+$ |\n| $x-3$ | $-$ | $-$ | $-$ | $0$ | $+$ | $+$ | $+$ |\n| $x-4$ | $-$ | $-$ | $-$ | $-$ | $-$ | ND | $+$ |\n| raport | $-$ | $0$ | $+$ | $0$ | $-$ | ND | $+$ |\n\n$$\\boxed{x \\in [-3,\\,3] \\cup (4,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-020', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radicali la numărător și la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{x^2-4x-5}}{\\sqrt{x^2-1}-\\sqrt{3}} \\leq 0$$',
    solution: '$x^2-4x-5 = (x-5)(x+1) \\geq 0 \\Rightarrow x \\leq -1$ sau $x \\geq 5$.\n\n$x^2-1 \\geq 0$: satisfăcut în domeniu. Numitor $\\neq 0$: $x^2 \\neq 4 \\Rightarrow x \\neq \\pm 2$; în domeniu, excludem $x = -2$.\n\n**Domeniu:** $(x \\leq -1,\\, x \\neq -2)$ sau $x \\geq 5$.\n\nNumărătorul $\\geq 0$ mereu; zero la $x = -1$ și $x = 5$.\n\nSemnul numitorului $\\sqrt{x^2-1}-\\sqrt{3}$:\n$< 0 \\iff x^2-1 < 3 \\iff x^2 < 4 \\iff -2 < x < 2$;\\ în domeniu: $-2 < x \\leq -1$.\n$> 0 \\iff x^2 > 4$:\\ în domeniu: $x < -2$ sau $x \\geq 5$ ($x \\neq 5$ unde num $= 0$).\n\nFracție $\\leq 0$:\n$\\bullet$ Num $> 0$ și denom $< 0$: $x \\in (-1) $și $-2<x\\leq-1$: $-2 < x < -1$ ✓\n$\\bullet$ Num $= 0$: $x=-1$ (denom $= -\\sqrt{3} < 0$, raport $= 0$ ✓); $x=5$ (denom $> 0$, raport $= 0$ ✓)\n\n$$\\boxed{x \\in (-2,\\,-1] \\cup \\{5\\}}$$'
  },
  {
    id: 'rat-in-021', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical dintr-un logaritm și numitor pătrat perfect exponențial',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{\\log_3(x-1)-3}}{4^x-8\\cdot 2^x+16} > 0$$',
    solution: '**Domeniu:** $\\log_3(x-1) \\geq 3 \\Rightarrow x-1 \\geq 27 \\Rightarrow x \\geq 28$.\n\nNumitor: $4^x-8\\cdot2^x+16 = (2^x)^2-8\\cdot2^x+16 = (2^x-4)^2$.\n\n$(2^x-4)^2 = 0 \\iff 2^x = 4 \\iff x = 2$. Dar $x \\geq 28 > 2$, deci numitorul $> 0$ $\\forall x$ în domeniu.\n\nNumărătorul $= 0$ când $\\log_3(x-1) = 3 \\iff x = 28$.\n\nFracție $> 0$: numărător $> 0$ (și numitor $> 0$):\n$$\\log_3(x-1) > 3 \\iff x-1 > 27 \\iff x > 28$$\n\n$$\\boxed{x \\in (28,\\,+\\infty)}$$'
  },

  {
    id: 'rat-in-022', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație rațională cu parametru din determinantul unui produs de matrice complexe',
    statement: 'Fie matricele $A = \\begin{pmatrix}1+i & 1-i \\\\ i & 1\\end{pmatrix}$ și $B = \\begin{pmatrix}1-i & 1+i \\\\ -i & 2\\end{pmatrix}$, iar $d = \\det(A \\cdot B)$. Determinați toate soluțiile întregi ale inecuației\n$$\\frac{x^2+d}{x^2-4} < d$$',
    solution: '**Calculul lui $d$:**\n\n$\\det(A) = (1+i)\\cdot 1 - (1-i)\\cdot i = 1+i-i+i^2 = 0$\n\n$d = \\det(A\\cdot B) = \\det(A)\\cdot\\det(B) = 0$\n\n**Inecuația devine:**\n$$\\frac{x^2}{x^2-4} < 0$$\n\nNumărătorul $x^2 \\geq 0$; fracția $< 0$ iff $x^2 > 0$ și $x^2-4 < 0$, adică $x \\neq 0$ și $-2 < x < 2$.\n\nSoluție reală: $x \\in (-2,\\,0)\\cup(0,\\,2)$.\n\nSoluțiile întregi: $x = -1$ și $x = 1$.\n\n$$\\boxed{x \\in \\{-1,\\;1\\}}$$'
  },
  {
    id: 'rat-in-023', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical la numărător și logaritm minus 1 la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{x-5}}{\\log_{\\sqrt{2}}(x-4)-1} \\geq 0$$',
    solution: '**Domeniu:** $x-5 \\geq 0 \\Rightarrow x \\geq 5$; $x-4 > 0$ satisfăcut; numitor $\\neq 0$: $\\log_{\\sqrt{2}}(x-4) \\neq 1 \\Rightarrow x-4 \\neq \\sqrt{2} \\Rightarrow x \\neq 4+\\sqrt{2}$.\n\nDeoarece $4+\\sqrt{2} \\approx 5{,}41 > 5$, domeniu: $[5,\\,+\\infty)\\setminus\\{4+\\sqrt{2}\\}$.\n\n**Numărătorul** $\\sqrt{x-5} \\geq 0$ mereu; $= 0$ la $x = 5$.\n\n**Semnul numitorului** $\\log_{\\sqrt{2}}(x-4)-1$ (baza $\\sqrt{2} > 1$):\n- $< 0$ când $x-4 < \\sqrt{2}$, adică $x < 4+\\sqrt{2}$; în domeniu: $x \\in [5,\\,4+\\sqrt{2})$\n- $> 0$ când $x > 4+\\sqrt{2}$\n\n**Fracție $\\geq 0$:**\n- $x = 5$: $\\frac{0}{-1} = 0$ ✓\n- $x \\in (5,\\,4+\\sqrt{2})$: $+/- < 0$ ✗\n- $x \\in (4+\\sqrt{2},\\,+\\infty)$: $+/+ > 0$ ✓\n\n$$\\boxed{x \\in \\{5\\}\\cup(4+\\sqrt{2},\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-024', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical și logaritm de expresie pătratică la numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{2x-3}}{\\log_{\\sqrt{2}}(x^2-3x+3)} \\geq 0$$',
    solution: '**Domeniu:** $2x-3 \\geq 0 \\Rightarrow x \\geq \\tfrac{3}{2}$.\n\n$x^2-3x+3 > 0$: $\\Delta = 9-12 = -3 < 0$, deci mereu pozitiv.\n\nNumitor $\\neq 0$: $x^2-3x+3 \\neq 1 \\Rightarrow (x-1)(x-2) \\neq 0 \\Rightarrow x \\neq 2$ (în domeniu).\n\nDomeniu: $[\\tfrac{3}{2},\\,+\\infty)\\setminus\\{2\\}$.\n\n**Semnul numitorului** (baza $\\sqrt{2} > 1$): $\\log_{\\sqrt{2}}(x^2-3x+3) > 0 \\iff x^2-3x+3 > 1 \\iff (x-1)(x-2) > 0$.\n\nÎn domeniu ($x \\geq \\tfrac{3}{2}$): numitor $< 0$ pe $[\\tfrac{3}{2},\\,2)$; numitor $> 0$ pe $(2,\\,+\\infty)$.\n\n**Fracție $\\geq 0$:**\n- $x = \\tfrac{3}{2}$: $\\frac{0}{\\text{neg}} = 0$ ✓\n- $x \\in (\\tfrac{3}{2},\\,2)$: $+/- < 0$ ✗\n- $x \\in (2,\\,+\\infty)$: $+/+ > 0$ ✓\n\n$$\\boxed{x \\in \\left\\{\\tfrac{3}{2}\\right\\}\\cup(2,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-025', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu radical dintr-un logaritm la numărător',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația\n$$\\frac{\\sqrt{\\log_2(x-1)}}{x^2-3x-4} \\geq 0$$',
    solution: '**Domeniu:** $\\log_2(x-1) \\geq 0 \\Rightarrow x-1 \\geq 1 \\Rightarrow x \\geq 2$.\n\nNumitor $\\neq 0$: $(x-4)(x+1) \\neq 0 \\Rightarrow x \\neq 4$ (în domeniu).\n\nDomeniu: $[2,\\,+\\infty)\\setminus\\{4\\}$.\n\n**Numărătorul** $= 0$ la $x = 2$; $> 0$ pentru $x > 2$.\n\n**Semnul numitorului** $(x-4)(x+1)$: în domeniu, $(x+1) > 0$ mereu.\n- $x \\in [2,\\,4)$: $(x-4) < 0$ ⟹ numitor $< 0$\n- $x > 4$: $(x-4) > 0$ ⟹ numitor $> 0$\n\n**Fracție $\\geq 0$:**\n- $x = 2$: $\\frac{0}{-3} = 0$ ✓\n- $x \\in (2,\\,4)$: $+/- < 0$ ✗\n- $x > 4$: $+/+ > 0$ ✓\n\n$$\\boxed{x \\in \\{2\\}\\cup(4,\\,+\\infty)}$$'
  },
  {
    id: 'rat-in-026', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu logaritm la numărător și radical de trinăm pătratic la numitor',
    statement: 'Să se rezolve în $\\mathbb{R}$ inecuația\n$$\\frac{2-4\\cdot\\log_9 x}{\\sqrt{2x^2-x-6}} \\geq 0$$',
    solution: '**Domeniu:** $x > 0$ și $2x^2-x-6 > 0$.\n\n$2x^2-x-6 = 0$: $\\Delta = 1+48 = 49$, rădăcini $x = \\frac{1\\pm7}{4}$, deci $x_1 = -\\frac{3}{2}$, $x_2 = 2$.\n\n$2x^2-x-6 > 0 \\iff x < -\\tfrac{3}{2}$ sau $x > 2$. Cu $x > 0$: **domeniu** $= (2,\\,+\\infty)$.\n\n**Numitorul** $> 0$ mereu în domeniu.\n\n**Numărătorul** $2-4\\log_9 x \\geq 0 \\iff \\log_9 x \\leq \\tfrac{1}{2} \\iff x \\leq 9^{1/2} = 3$.\n\nFracție $\\geq 0$ iff numărător $\\geq 0$ (numitor pozitiv): $x \\in (2,\\,+\\infty)$ și $x \\leq 3$.\n\n$$\\boxed{x \\in (2,\\,3]}$$'
  },
  {
    id: 'rat-in-027', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Inecuație cu pătratul unui logaritm cu bază variabilă la numărător',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ inecuația\n$$\\frac{\\log^2_{x-1}(5-x)}{x^2-3x} \\leq 0$$',
    solution: '**Domeniu:** Baza: $x-1 > 0$ și $x-1 \\neq 1 \\Rightarrow x > 1$, $x \\neq 2$. Argument: $5-x > 0 \\Rightarrow x < 5$. Numitor: $x(x-3) \\neq 0 \\Rightarrow x \\neq 3$.\n\nDomeniu: $(1,2)\\cup(2,3)\\cup(3,5)$.\n\n**Numărătorul** $[\\log_{x-1}(5-x)]^2 \\geq 0$ mereu; $= 0$ iff $\\log_{x-1}(5-x) = 0 \\iff 5-x = 1 \\iff x = 4$.\n\n**Semnul numitorului** $x(x-3)$:\n- $x \\in (1,2)$: $x > 0$, $x-3 < 0$ ⟹ numitor $< 0$\n- $x \\in (2,3)$: $x > 0$, $x-3 < 0$ ⟹ numitor $< 0$\n- $x \\in (3,5)$: $x > 0$, $x-3 > 0$ ⟹ numitor $> 0$\n\n**Fracție $\\leq 0$:**\n- Num $> 0$ și denom $< 0$: $x \\in (1,2)\\cup(2,3)$ ✓\n- Num $= 0$ ($x = 4$) și denom $> 0$: fracție $= 0$ ✓\n\n$$\\boxed{x \\in (1,\\,2)\\cup(2,\\,3)\\cup\\{4\\}}$$'
  },

  /* ============================================================
     ALGEBRĂ — Polinoame
     ============================================================ */
  {
    id: 'alg-pol-001', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția de divizibilitate',
    statement: 'Fie polinomul $P(X) = X^3 - 2X^2 + (m+1)X - 4$. Determinați valoarea reală a lui $m$ pentru care $P(X)$ este divizibil prin $Q(X) = X - 2$.',
    solution: 'Dacă $P(X)$ este divizibil prin $(X-2)$, atunci $X = 2$ este rădăcină, deci $P(2) = 0$.\n\n$$P(2) = 8 - 8 + 2(m+1) - 4 = 0$$\n\n$$2m + 2 - 4 = 0 \\Rightarrow 2m = 2 \\Rightarrow \\boxed{m = 1}$$'
  },
  {
    id: 'alg-pol-002', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea coeficientului și a celorlalte rădăcini',
    statement: 'Fie polinomul $P(X) = X^3 + X^2 + aX - 12$. Se știe că $X = -2$ este rădăcină a polinomului. Determinați celelalte rădăcini.',
    solution: '$P(-2) = 0$:\n$$-8 + 4 - 2a - 12 = 0 \\Rightarrow -2a = 16 \\Rightarrow a = -8$$\n\nDeci $P(X) = X^3 + X^2 - 8X - 12$. Împărțim prin $(X+2)$ (schema Horner):\n\n$$\\begin{array}{c|cccc} -2 & 1 & 1 & -8 & -12 \\\\ & & -2 & 2 & 12 \\\\ \\hline & 1 & -1 & -6 & 0 \\end{array}$$\n\n$$P(X) = (X+2)(X^2 - X - 6) = (X+2)(X-3)(X+2) = (X+2)^2(X-3)$$\n\nRădăcinile sunt $\\boxed{X = -2 \\text{ (dublă)},\\ X = 3}$'
  },

  {
    id: 'alg-pol-003', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Rădăcinile reale ale unui polinom definit printr-un determinant',
    statement: 'Fie polinomul\n$$P(X) = \\begin{vmatrix} -1 & X & 2 \\\\ X & 2 & -1 \\\\ 2 & -1 & X \\end{vmatrix}$$\nDeterminați rădăcinile reale ale polinomului.',
    solution: 'Dezvoltăm determinantul după primul rând:\n\n$$P(X) = -1(2X-1) - X(X^2+2) + 2(-X-4)$$\n\n$$= -2X+1-X^3-2X-2X-8 = -X^3-6X-7$$\n\nVerificăm $X = -1$: $\\quad P(-1) = 1+6-7 = 0$ ✓\n\nÎmpărțim prin $(X+1)$:\n$$P(X) = -(X+1)(X^2-X+7)$$\n\n$\\Delta = 1 - 28 = -27 < 0$, deci $X^2-X+7$ nu are rădăcini reale.\n\n$$\\boxed{X = -1}$$'
  },

  {
    id: 'alg-pol-004', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Câtul și restul împărțirii unui polinom de grad 4 la grad 2',
    statement: 'Determinați câtul și restul împărțirii polinomului $P(X) = X^4 - 5X^2 + 3X - 2$ la polinomul $Q(X) = X^2 + 1$.',
    solution: 'Împărțim prin algoritmul împărțirii:\n\n$X^4 \\div X^2 = X^2$; $\\quad X^2(X^2+1) = X^4+X^2$; rest: $-6X^2+3X-2$\n\n$-6X^2 \\div X^2 = -6$; $\\quad -6(X^2+1) = -6X^2-6$; rest: $3X+4$\n\n$$\\boxed{C(X) = X^2-6, \\quad R(X) = 3X+4}$$'
  },
  {
    id: 'alg-pol-005', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Rădăcină dublă — determinarea coeficienților și a celorlalte rădăcini',
    statement: 'Fie polinomul $P(X) = X^4 - 5X^3 + aX^2 + bX - 18$. Știind că $X = 3$ este rădăcină dublă a polinomului $P(X)$, să se determine celelalte rădăcini.',
    solution: 'Deoarece $X=3$ este rădăcină dublă: $P(3)=0$ și $P\'(3)=0$.\n\n$$P(3)=0:\\quad 81-135+9a+3b-18=0 \\Rightarrow 3a+b=24 \\quad(1)$$\n\n$$P\'(X)=4X^3-15X^2+2aX+b \\Rightarrow P\'(3)=108-135+6a+b=0 \\Rightarrow 6a+b=27 \\quad(2)$$\n\n$(2)-(1):\\; 3a=3 \\Rightarrow a=1,\\; b=21$\n\n$P(X)=(X-3)^2(X^2+X-2)=(X-3)^2(X-1)(X+2)$\n\n$$\\boxed{X=1,\\quad X=-2}$$'
  },
  {
    id: 'alg-pol-006', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea coeficientului din condiția restului la împărțire',
    statement: 'Fie polinomul $P(X) = 4X^3 + (a-2)X^2 + (1-a)X + 6$. Determinați valorile reale ale lui $a$, astfel încât restul împărțirii polinomului la $Q(X) = X + 1$ să fie egal cu $5$.',
    solution: 'Prin teorema lui Bézout, restul împărțirii lui $P(X)$ la $(X+1)$ este $P(-1)$.\n\n$$P(-1) = -4 + (a-2) - (1-a) + 6 = 2a - 1$$\n\n$$2a - 1 = 5 \\Rightarrow 2a = 6 \\Rightarrow \\boxed{a = 3}$$'
  },
  {
    id: 'alg-pol-007', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Câtul împărțirii folosind suma coeficienților',
    statement: 'Determinați câtul împărțirii polinomului $P(X) = X^3 - aX^2 + (2a-1)X - 5$ la binomul $Q(X) = X + 2$, dacă se cunoaște că suma coeficienților lui $P(X)$ este $0$.',
    solution: 'Suma coeficienților $= P(1) = 0$:\n$$1 - a + (2a-1) - 5 = a - 5 = 0 \\Rightarrow a = 5$$\n\n$P(X) = X^3 - 5X^2 + 9X - 5$. Schema Horner pentru $X = -2$:\n\n$$\\begin{array}{c|cccc} -2 & 1 & -5 & 9 & -5 \\\\ & & -2 & 14 & -46 \\\\ \\hline & 1 & -7 & 23 & -51 \\end{array}$$\n\n$$\\boxed{C(X) = X^2 - 7X + 23}, \\quad R = -51$$'
  },
  {
    id: 'alg-pol-008', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 4 la un binom',
    statement: 'Determinați restul împărțirii polinomului $P(X) = X^4 + 3X^3 + 2X^2 - X - 3$ la binomul $X + 3$.',
    solution: 'Prin teorema lui Bézout, restul este $P(-3)$:\n\n$$P(-3) = 81 - 81 + 18 + 3 - 3 = \\boxed{18}$$'
  },
  {
    id: 'alg-pol-009', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunere în factori cu rădăcină dublă dată',
    statement: 'Descompuneți în factori ireductibili polinomul $P(X) = X^4 - 5X^3 + X^2 + 21X - 18$, știind că $X = 3$ este o rădăcină dublă a polinomului.',
    solution: '$(X-3)^2 = X^2-6X+9$ divide $P(X)$. Împărțim:\n\n$$P(X) = (X-3)^2(X^2+X-2) = (X-3)^2(X-1)(X+2)$$\n\n$$\\boxed{P(X) = (X-3)^2(X-1)(X+2)}$$'
  },
  {
    id: 'alg-pol-010', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Descompunere în factori ireductibili cu rădăcină dublă necunoscută',
    statement: 'Descompuneți în factori ireductibili polinomul $P(X) = X^4 - X^3 - aX^2 - (a+8)X - 10$, știind că $X = -1$ este o rădăcină dublă a polinomului $P(X)$.',
    solution: '$P(-1) = 1+1-a+(a+8)-10 = 0$ (adevărat $\\forall a$)\n\n$P\'(X) = 4X^3-3X^2-2aX-(a+8)$\n$$P\'(-1) = -4-3+2a-a-8 = a-15 = 0 \\Rightarrow a = 15$$\n\n$P(X) = X^4-X^3-15X^2-23X-10$. Împărțim prin $(X+1)^2 = X^2+2X+1$:\n$$P(X) = (X+1)^2(X^2-3X-10) = (X+1)^2(X-5)(X+2)$$\n\n$$\\boxed{P(X) = (X+1)^2(X-5)(X+2)}$$'
  },
  {
    id: 'alg-pol-011', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Verificarea unei rădăcini și determinarea celorlalte rădăcini',
    statement: 'Fie polinomul $P(X) = 2X^3 - 9X^2 + 7X + 6$. Arătați că $X = 3$ este rădăcină a polinomului $P(X)$ și determinați celelalte rădăcini ale polinomului.',
    solution: '$$P(3) = 54 - 81 + 21 + 6 = 0 \\checkmark$$\n\nSchema Horner pentru $X = 3$:\n$$\\begin{array}{c|cccc} 3 & 2 & -9 & 7 & 6 \\\\ & & 6 & -9 & -6 \\\\ \\hline & 2 & -3 & -2 & 0 \\end{array}$$\n\n$$P(X) = (X-3)(2X^2-3X-2) = (X-3)(2X+1)(X-2)$$\n\n$$\\boxed{X = 2, \\quad X = -\\tfrac{1}{2}}$$'
  },
  {
    id: 'alg-pol-012', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii la un polinom de grad 2 cu rădăcini cunoscute',
    statement: 'Determinați restul împărțirii polinomului $P(X) = 3X^3 - 4X^2 - 3X + 7$ la $Q(X) = X^2 - 1$.',
    solution: '$R(X) = aX+b$. Deoarece $X^2-1 = (X-1)(X+1)$, evaluăm în $X=1$ și $X=-1$:\n\n$$P(1) = 3-4-3+7 = 3 = a+b$$\n$$P(-1) = -3-4+3+7 = 3 = -a+b$$\n\nDin sistem: $a = 0,\\; b = 3$\n\n$$\\boxed{R(X) = 3}$$'
  },
  {
    id: 'alg-pol-013', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea lui m și restul la un polinom de grad 2',
    statement: 'Fie $P(X) = X^4 + 2X^3 + mX^2 + 5X + 4$. Determinați $m$, astfel încât $X = -1$ să fie rădăcină, apoi aflați restul împărțirii lui $P(X)$ la $X^2 - 2$.',
    solution: '$$P(-1) = 1-2+m-5+4 = m-2 = 0 \\Rightarrow m = 2$$\n\n$P(X) = X^4+2X^3+2X^2+5X+4$. $R(X) = aX+b$:\n\nEvaluăm în $X = \\sqrt{2}$ și $X = -\\sqrt{2}$:\n$$P(\\sqrt{2}) = 4+4\\sqrt{2}+4+5\\sqrt{2}+4 = 12+9\\sqrt{2} = a\\sqrt{2}+b$$\n$$P(-\\sqrt{2}) = 4-4\\sqrt{2}+4-5\\sqrt{2}+4 = 12-9\\sqrt{2} = -a\\sqrt{2}+b$$\n\n$a = 9,\\; b = 12$\n\n$$\\boxed{R(X) = 9X+12}$$'
  },
  {
    id: 'alg-pol-014', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția că o rădăcină dată este rădăcină a polinomului',
    statement: 'Determinați $a \\in \\mathbb{R}$, pentru care $X = \\dfrac{1}{2}$ este rădăcină a polinomului:\n$$P(X) = 8X^3 + (a+2)X - 5X + a$$',
    solution: '$P(X) = 8X^3 + (a-3)X + a$\n\n$$P\\!\\left(\\tfrac{1}{2}\\right) = 8 \\cdot \\tfrac{1}{8} + (a-3)\\cdot\\tfrac{1}{2} + a = 1 + \\frac{a-3}{2} + a = 0$$\n\n$$2 + (a-3) + 2a = 0 \\Rightarrow 3a = 1 \\Rightarrow \\boxed{a = \\dfrac{1}{3}}$$'
  },
  {
    id: 'alg-pol-015', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Descompunerea completă a unui polinom de grad 4',
    statement: 'Fie polinomul $P(X) = X^4 - 6X^3 - 3X^2 + 52X - 60$. Descompuneți în factori polinomul.',
    solution: 'Testăm $X=2$: $P(2) = 16-48-12+104-60 = 0$ ✓\n\nSchema Horner:\n$$\\begin{array}{c|ccccc} 2 & 1 & -6 & -3 & 52 & -60 \\\\ & & 2 & -8 & -22 & 60 \\\\ \\hline & 1 & -4 & -11 & 30 & 0 \\end{array}$$\n\nTestăm $X=2$ în $X^3-4X^2-11X+30$: $8-16-22+30=0$ ✓\n\n$$X^3-4X^2-11X+30 = (X-2)(X^2-2X-15) = (X-2)(X-5)(X+3)$$\n\n$$\\boxed{P(X) = (X-2)^2(X-5)(X+3)}$$'
  },
  {
    id: 'alg-pol-016', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului la un binom',
    statement: 'Fie polinomul $P(X) = X^3 + (a+1)X^2 - a^2X - 2$. Determinați $a \\in \\mathbb{R}$, știind că restul împărțirii la $X - 2$ este $10$.',
    solution: 'Prin teorema lui Bézout: $P(2) = 10$.\n\n$$8 + 4(a+1) - 2a^2 - 2 = 10$$\n$$10 + 4a - 2a^2 = 10$$\n$$4a - 2a^2 = 0 \\Rightarrow 2a(2-a) = 0$$\n\n$$\\boxed{a = 0 \\quad \\text{sau} \\quad a = 2}$$'
  },
  {
    id: 'alg-pol-017', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii la un polinom de grad 2 cu rădăcini 0 și 1',
    statement: 'Determinați restul împărțirii polinomului $P(X) = 2X^4 + 3X^3 - X + 1$ la $Q(X) = X^2 - X$.',
    solution: '$R(X) = aX+b$. Deoarece $X^2-X = X(X-1)$, evaluăm în $X=0$ și $X=1$:\n\n$$P(0) = 1 = b$$\n$$P(1) = 2+3-1+1 = 5 = a+b = a+1 \\Rightarrow a = 4$$\n\n$$\\boxed{R(X) = 4X+1}$$'
  },

  {
    id: 'alg-pol-018', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunere în factori ireductibili cu rădăcină dublă X=1',
    statement: 'Descompuneți în factori ireductibili polinomul\n$$P(X) = X^4 + 5X^3 - X^2 - 17X + 12$$\ndacă $X = 1$ este rădăcină dublă.',
    solution: '$P(1) = 1+5-1-17+12 = 0$ ✓ și $P\'(1) = 4+15-2-17 = 0$ ✓\n\nÎmpărțim prin $(X-1)^2 = X^2-2X+1$:\n$$P(X) = (X-1)^2(X^2+7X+12) = (X-1)^2(X+3)(X+4)$$\n\n$$\\boxed{P(X) = (X-1)^2(X+3)(X+4)}$$'
  },
  {
    id: 'alg-pol-019', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu −10',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(X) = aX^4 - 7X^3 + 3X^2 + (a-3)X + 4$$\nla binomul $Q(X) = X - 2$, este egal cu $-10$.',
    solution: '$P(2) = -10$:\n$$16a - 56 + 12 + 2(a-3) + 4 = -10$$\n$$18a - 46 = -10 \\Rightarrow 18a = 36 \\Rightarrow \\boxed{a = 2}$$'
  },
  {
    id: 'alg-pol-020', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 4 la X+2',
    statement: 'Determinați restul împărțirii polinomului\n$$P(X) = 3X^4 - 6X^3 + X^2 - 3X + 4$$\nla polinomul $Q(X) = X + 2$.',
    solution: 'Prin teorema lui Bézout, restul este $P(-2)$:\n\n$$P(-2) = 3(16) - 6(-8) + 4 - 3(-2) + 4 = 48 + 48 + 4 + 6 + 4 = \\boxed{110}$$'
  },
  {
    id: 'alg-pol-021', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților a și b din condiția rădăcinii duble',
    statement: 'Fie polinomul $P(X) = X^4 + 6X^3 + 9X^2 + 2aX - b$. Determinați numerele reale $a$ și $b$, pentru care $X = 2$ este rădăcină dublă.',
    solution: '$X=2$ rădăcină dublă $\\Rightarrow P(2)=0$ și $P\'(2)=0$.\n\n$$P\'(X) = 4X^3+18X^2+18X+2a \\Rightarrow P\'(2) = 140+2a = 0 \\Rightarrow a = -70$$\n\n$$P(2) = 100 + 4(-70) - b = 0 \\Rightarrow b = -180$$\n\n$$P(X) = (X-2)^2(X^2+10X+45)$$\n\n$$\\boxed{a = -70, \\quad b = -180}$$'
  },
  {
    id: 'alg-pol-022', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea parametrului a din condiția restului egal cu 6',
    statement: 'Determinați valorile parametrului real $a$, pentru care restul împărțirii polinomului\n$$P(X) = aX^4 - 6X^3 - 2X^2 - 2aX - 2$$\nla $Q(X) = X - 2$, este egal cu $6$.',
    solution: '$P(2) = 6$:\n$$16a - 48 - 8 - 4a - 2 = 6$$\n$$12a - 58 = 6 \\Rightarrow 12a = 64 \\Rightarrow \\boxed{a = \\dfrac{16}{3}}$$'
  },
  {
    id: 'alg-pol-023', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu 27',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(X) = 3X^4 - 2aX^3 - 12X^2 + 8X - a - 2$$\nla $Q(X) = X + 2$, este egal cu $27$.',
    solution: '$P(-2) = 27$:\n$$48 + 16a - 48 - 16 - a - 2 = 27$$\n$$15a - 18 = 27 \\Rightarrow 15a = 45 \\Rightarrow \\boxed{a = 3}$$'
  },
  {
    id: 'alg-pol-024', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția de divizibilitate cu X+1',
    statement: 'Fie polinomul $P(X) = 2X^5 + 3X^3 - (m+1)X^2 + (m-1)X + 6 + m$. Determinați valorile reale ale lui $m$, pentru care polinomul $P(X)$ se divide cu $Q(X) = X + 1$.',
    solution: 'Dacă $P(X)$ este divizibil cu $(X+1)$, atunci $P(-1) = 0$:\n$$-2 - 3 - (m+1) - (m-1) + 6 + m = 0$$\n$$1 - m = 0 \\Rightarrow \\boxed{m = 1}$$'
  },
  {
    id: 'alg-pol-025', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea lui a și restul la X²−2 din condiție la X=2',
    statement: 'Determinați restul împărțirii polinomului $P(X) = X^4 + 2X - 2 - a$, la polinomul $Q(X) = X^2 - 2$, dacă restul împărțirii la $X = 2$ este egal cu $8$.',
    solution: 'Din $P(2) = 8$:\n$$16 + 4 - 2 - a = 8 \\Rightarrow a = 10$$\n\n$P(X) = X^4 + 2X - 12$. Scriem $R(X) = bX + c$ și evaluăm în $X = \\pm\\sqrt{2}$:\n$$P(\\sqrt{2}) = 4 + 2\\sqrt{2} - 12 = -8 + 2\\sqrt{2} = b\\sqrt{2} + c$$\n$$P(-\\sqrt{2}) = 4 - 2\\sqrt{2} - 12 = -8 - 2\\sqrt{2} = -b\\sqrt{2} + c$$\n\n$b = 2,\\; c = -8$\n\n$$\\boxed{R(X) = 2X - 8}$$'
  },
  {
    id: 'alg-pol-026', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu −13',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(X) = (a+3)X^5 - 2X^3 + (9+a)X^2 + 2X + 7 - a$$\nla $Q(X) = X - 2$, este egal cu $-13$.',
    solution: '$P(2) = -13$:\n$$(a+3)(32) - 16 + (9+a)(4) + 4 + 7 - a = -13$$\n$$32a + 96 - 16 + 36 + 4a + 4 + 7 - a = -13$$\n$$35a + 127 = -13 \\Rightarrow 35a = -140 \\Rightarrow \\boxed{a = -4}$$'
  },
  {
    id: 'alg-pol-027', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu 3 la X−1',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(X) = 2aX^4 - 7X^3 + 2X^2 - 10X + a$$\nla $Q(X) = X - 1$, este egal cu $3$.',
    solution: '$P(1) = 3$:\n$$2a - 7 + 2 - 10 + a = 3$$\n$$3a - 15 = 3 \\Rightarrow 3a = 18 \\Rightarrow \\boxed{a = 6}$$'
  },
  {
    id: 'alg-pol-028', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunere în factori ireductibili cu rădăcină dublă X=−2',
    statement: 'Descompuneți în factori ireductibili polinomul\n$$P(X) = X^4 + 7X^3 + 12X^2 - 4X - 16$$\ndacă $X = -2$ este rădăcină dublă.',
    solution: '$P(-2) = 16-56+48+8-16 = 0$ ✓ și $P\'(-2) = -32+84-48-4 = 0$ ✓\n\nÎmpărțim prin $(X+2)^2 = X^2+4X+4$:\n$$P(X) = (X+2)^2(X^2+3X-4) = (X+2)^2(X+4)(X-1)$$\n\n$$\\boxed{P(X) = (X+2)^2(X+4)(X-1)}$$'
  },

  {
    id: 'alg-pol-029', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților din condiții de divizibilitate și rest, apoi restul la X+2',
    statement: 'Fie polinomul $P(X) = X^3 + aX^2 + bX - 6$, $a, b \\in \\mathbb{R}$. Se știe că $P(X)$ se divide cu binomul $X - 3$, iar prin împărțirea la binomul $X - 2$ dă restul $-16$. Determinați restul împărțirii polinomului $P(X)$ la binomul $X + 2$.',
    solution: 'Din condiția de divizibilitate cu $(X-3)$: $P(3) = 0$\n$$27 + 9a + 3b - 6 = 0 \\Rightarrow 3a + b = -7 \\quad (1)$$\n\nDin restul la $(X-2)$: $P(2) = -16$\n$$8 + 4a + 2b - 6 = -16 \\Rightarrow 2a + b = -9 \\quad (2)$$\n\n$(1)-(2):\\; a = 2,\\; b = -13$\n\n$P(X) = X^3 + 2X^2 - 13X - 6$\n\nRestul la $(X+2)$: $P(-2) = -8 + 8 + 26 - 6 = \\boxed{20}$'
  },
  {
    id: 'alg-pol-030', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a și restul la X+3',
    statement: 'Se consideră polinomul $P(X) = X^3 + aX^2 + 5X - 3$, unde $a \\in \\mathbb{R}$. Știind că $P(2) = 7$, să se afle restul împărțirii polinomului $P(X)$ la binomul $Q(X) = X + 3$.',
    solution: 'Din $P(2) = 7$:\n$$8 + 4a + 10 - 3 = 7 \\Rightarrow 4a = -8 \\Rightarrow a = -2$$\n\n$P(X) = X^3 - 2X^2 + 5X - 3$\n\nRestul la $(X+3)$: $P(-3) = -27 - 18 - 15 - 3 = \\boxed{-63}$'
  },
  {
    id: 'alg-pol-031', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția de rădăcină și restul la X−4',
    statement: 'Se consideră polinomul $P(X) = X^3 + aX^2 - 5X + 6$, unde $a \\in \\mathbb{R}$. Știind că $X = -2$ este rădăcină a polinomului $P(X)$, să se afle restul împărțirii polinomului $P(X)$ la binomul $X - 4$.',
    solution: 'Din $P(-2) = 0$:\n$$-8 + 4a + 10 + 6 = 0 \\Rightarrow 4a = -8 \\Rightarrow a = -2$$\n\n$P(X) = X^3 - 2X^2 - 5X + 6$\n\nRestul la $(X-4)$: $P(4) = 64 - 32 - 20 + 6 = \\boxed{18}$'
  },
  {
    id: 'alg-pol-032', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea polinomului P(X) din câtul și restul împărțirii la X²−1',
    statement: 'Polinomul $P(X)$ se împarte la polinomul $Q(X) = X^2 - 1$, obținându-se câtul\n$$C(X) = X^3 - X + 1$$\nDeterminați polinomul $P(X)$, știind că $P(2) = 6$ și $P(-2) = 2$.',
    solution: '$P(X) = (X^2-1)(X^3-X+1) + R(X)$, unde $R(X) = bX+c$.\n\n$(X^2-1)(X^3-X+1) = X^5-2X^3+X^2+X-1$\n\nDin $P(2) = 6$:\n$$21 + (2b+c) = 6 \\Rightarrow 2b+c = -15 \\quad (1)$$\n\nDin $P(-2) = 2$:\n$$3(-5) + (-2b+c) = 2 \\Rightarrow -2b+c = 17 \\quad (2)$$\n\nDin $(1)+(2)$: $2c = 2 \\Rightarrow c = 1,\\; b = -8$, deci $R(X) = -8X+1$\n\n$$\\boxed{P(X) = X^5 - 2X^3 + X^2 - 7X}$$'
  },
  {
    id: 'alg-pol-033', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților din condiția de rest egal și rădăcinile polinomului',
    statement: 'Fie polinomul $P(X) = 2X^3 + aX^2 + bX + 12$. Știind că restul împărțirii polinomului $P(X)$ la binomul $X - 3$ este egal cu restul împărțirii polinomului $P(X)$ la binomul $X + 1$ și este egal cu $15$, să se afle rădăcinile polinomului $P(X)$.',
    solution: 'Din $P(3) = 15$:\n$$54 + 9a + 3b + 12 = 15 \\Rightarrow 3a + b = -17 \\quad (1)$$\n\nDin $P(-1) = 15$:\n$$-2 + a - b + 12 = 15 \\Rightarrow a - b = 5 \\quad (2)$$\n\nDin $(1)+(2)$: $4a = -12 \\Rightarrow a = -3,\\; b = -8$\n\n$P(X) = 2X^3 - 3X^2 - 8X + 12$. Testăm $X = 2$: $16 - 12 - 16 + 12 = 0$ ✓\n\nSchema Horner:\n$$\\begin{array}{c|cccc} 2 & 2 & -3 & -8 & 12 \\\\ & & 4 & 2 & -12 \\\\ \\hline & 2 & 1 & -6 & 0 \\end{array}$$\n\n$P(X) = (X-2)(2X^2+X-6) = (X-2)(2X-3)(X+2)$\n\n$$\\boxed{X = 2,\\quad X = \\tfrac{3}{2},\\quad X = -2}$$'
  },
  {
    id: 'alg-pol-034', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul la un polinom de grad 2 din resturile cunoscute la factorii săi',
    statement: 'Să se afle restul împărțirii polinomului $P(X)$, de grad cel puțin $2$, la polinomul\n$$Q(X) = X^2 - X - 6$$\nștiind că resturile împărțirii lui $P(X)$ la $X - 3$ și $X + 2$ sunt $7$ și respectiv $-8$.',
    solution: '$Q(X) = X^2-X-6 = (X-3)(X+2)$, cu rădăcinile $X = 3$ și $X = -2$.\n\n$R(X) = bX + c$. Din $P(3) = R(3)$ și $P(-2) = R(-2)$:\n\n$$3b + c = 7 \\quad (1)$$\n$$-2b + c = -8 \\quad (2)$$\n\n$(1)-(2)$: $5b = 15 \\Rightarrow b = 3,\\; c = -2$\n\n$$\\boxed{R(X) = 3X - 2}$$'
  },
  {
    id: 'alg-pol-035', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția că X=3 este rădăcină',
    statement: 'Fie polinomul $P(X) = X^3 + aX^2 + 9X - 9$. Să se determine $a \\in \\mathbb{R}$ pentru care $X = 3$ este rădăcină a polinomului $P(X)$.',
    solution: '$P(3) = 0$:\n$$27 + 9a + 27 - 9 = 0 \\Rightarrow 9a = -45 \\Rightarrow \\boxed{a = -5}$$'
  },
  {
    id: 'alg-pol-036', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Aflarea restului la X+3 din condiția restului la X−2',
    statement: 'Aflați restul împărțirii polinomului $P(X) = 2X^3 - 3X^2 + mX + 1$ la binomul $X + 3$, știind că împărțit la binomul $X - 2$ dă restul $15$.',
    solution: 'Din $P(2) = 15$:\n$$16 - 12 + 2m + 1 = 15 \\Rightarrow 2m = 10 \\Rightarrow m = 5$$\n\n$P(X) = 2X^3 - 3X^2 + 5X + 1$\n\nRestul la $(X+3)$: $P(-3) = -54 - 27 - 15 + 1 = \\boxed{-95}$'
  },
  {
    id: 'alg-pol-037', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Rădăcinile unui polinom de grad 3 care se divide cu X+2',
    statement: 'Să se afle rădăcinile polinomului $P(X) = 2X^3 - X^2 + aX - 6$, $a \\in \\mathbb{R}$, știind că el se divide cu polinomul $Q(X) = X + 2$.',
    solution: 'Din $P(-2) = 0$:\n$$-16 - 4 - 2a - 6 = 0 \\Rightarrow -2a = 26 \\Rightarrow a = -13$$\n\n$P(X) = 2X^3 - X^2 - 13X - 6$. Schema Horner pentru $X = -2$:\n$$\\begin{array}{c|cccc} -2 & 2 & -1 & -13 & -6 \\\\ & & -4 & 10 & 6 \\\\ \\hline & 2 & -5 & -3 & 0 \\end{array}$$\n\n$P(X) = (X+2)(2X^2-5X-3) = (X+2)(2X+1)(X-3)$\n\n$$\\boxed{X = -2,\\quad X = -\\tfrac{1}{2},\\quad X = 3}$$'
  },
  {
    id: 'alg-pol-038', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a și calculul P(2)',
    statement: 'Fie polinomul $P(X) = X^2 + aX - 7$. Știind că $P(1) = -2$, aflați $P(2)$.',
    solution: 'Din $P(1) = -2$:\n$$1 + a - 7 = -2 \\Rightarrow a = 4$$\n\n$P(X) = X^2 + 4X - 7$\n\n$$P(2) = 4 + 8 - 7 = \\boxed{5}$$'
  },
  {
    id: 'alg-pol-039', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunerea în factori cu rădăcina X=3 dată',
    statement: 'Se consideră polinomul $P(X) = 2X^3 - aX^2 + 3X - 9$. Dacă $X = 3$ este rădăcină a polinomului $P(X)$, să se descompună $P(X)$ în factori.',
    solution: 'Din $P(3) = 0$:\n$$54 - 9a + 9 - 9 = 0 \\Rightarrow 9a = 54 \\Rightarrow a = 6$$\n\n$P(X) = 2X^3 - 6X^2 + 3X - 9$. Grupăm termenii:\n$$= 2X^2(X-3) + 3(X-3) = (X-3)(2X^2+3)$$\n\n$2X^2+3 > 0$ pentru orice $X \\in \\mathbb{R}$, deci nu are rădăcini reale.\n\n$$\\boxed{P(X) = (X-3)(2X^2+3)}$$'
  },
  {
    id: 'alg-pol-040', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților și descompunerea în factori în mulțimea R',
    statement: 'Fie polinomul $P(X) = X^3 + aX^2 + 2X + b$. Știind că $P(2) = -6$ și că $X = 3$ este rădăcină a polinomului, să descompună $P(X)$ în factori în mulțimea $\\mathbb{R}$.',
    solution: 'Din $P(3) = 0$:\n$$27 + 9a + 6 + b = 0 \\Rightarrow 9a + b = -33 \\quad (1)$$\n\nDin $P(2) = -6$:\n$$8 + 4a + 4 + b = -6 \\Rightarrow 4a + b = -18 \\quad (2)$$\n\n$(1)-(2)$: $5a = -15 \\Rightarrow a = -3,\\; b = -6$\n\n$P(X) = X^3 - 3X^2 + 2X - 6$. Schema Horner pentru $X = 3$:\n$$\\begin{array}{c|cccc} 3 & 1 & -3 & 2 & -6 \\\\ & & 3 & 0 & 6 \\\\ \\hline & 1 & 0 & 2 & 0 \\end{array}$$\n\n$X^2+2$ nu are rădăcini reale ($\\Delta = -8 < 0$).\n\n$$\\boxed{P(X) = (X-3)(X^2+2)}$$'
  },
  {
    id: 'alg-pol-041', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din egalitatea resturilor și rădăcinile polinomului',
    statement: 'Determinați rădăcinile polinomului $P(X) = X^3 + 2aX^2 - 5X - a - 9$, $a \\in \\mathbb{R}$, știind că restul împărțirii polinomului $P(X)$ la binomul $X - 2$ este egal cu restul împărțirii lui $P(X)$ la binomul $X + 1$.',
    solution: '$P(2) = P(-1)$:\n$$8 + 8a - 10 - a - 9 = -1 + 2a + 5 - a - 9$$\n$$7a - 11 = a - 5 \\Rightarrow 6a = 6 \\Rightarrow a = 1$$\n\n$P(X) = X^3 + 2X^2 - 5X - 10$. Grupăm:\n$$= X^2(X+2) - 5(X+2) = (X+2)(X^2-5)$$\n\n$$\\boxed{X = -2,\\quad X = \\sqrt{5},\\quad X = -\\sqrt{5}}$$'
  },
  {
    id: 'alg-pol-042', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea lui a, b ∈ Z astfel încât X=1 să fie rădăcină',
    statement: 'Fie polinomul $P(X) = a^2X^4 - 2abX^3 + b^2X^2 + a^2X - 2a + 1$. Să se determine $a, b \\in \\mathbb{Z}$, astfel încât $P(X)$ să admită ca rădăcină $X = 1$.',
    solution: '$P(1) = 0$:\n$$a^2 - 2ab + b^2 + a^2 - 2a + 1 = 0$$\n\nRegrupăm:\n$$(a-b)^2 + (a-1)^2 = 0$$\n\nO sumă de două pătrate este zero dacă și numai dacă ambii termeni sunt zero:\n$$a - b = 0 \\Rightarrow b = a \\qquad \\text{și} \\qquad a - 1 = 0 \\Rightarrow a = 1$$\n\n$$\\boxed{a = 1,\\quad b = 1}$$'
  },
  {
    id: 'alg-pol-043', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu −3 la X−1',
    statement: 'Să se afle $a \\in \\mathbb{R}$, știind că restul împărțirii polinomului\n$$P(X) = X^3 - 2X^2 + aX - 7$$\nla binomul $X - 1$ este egal cu $-3$.',
    solution: '$P(1) = -3$:\n$$1 - 2 + a - 7 = -3 \\Rightarrow a - 8 = -3 \\Rightarrow \\boxed{a = 5}$$'
  },
  {
    id: 'alg-pol-044', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția restului la X−√2',
    statement: 'Determinați $m \\in \\mathbb{R}$, astfel încât restul împărțirii polinomului\n$$P(X) = 2X^3 + mX^2 + mX + 2$$\nla binomul $Q(X) = X - \\sqrt{2}$ să fie egal cu $4\\sqrt{2}$.',
    solution: 'Prin teorema lui Bézout: $P(\\sqrt{2}) = 4\\sqrt{2}$\n\n$$2(\\sqrt{2})^3 + m(\\sqrt{2})^2 + m\\sqrt{2} + 2 = 4\\sqrt{2}$$\n$$4\\sqrt{2} + 2m + m\\sqrt{2} + 2 = 4\\sqrt{2}$$\n$$2m + m\\sqrt{2} + 2 = 0$$\n$$m(2 + \\sqrt{2}) = -2$$\n$$m = \\frac{-2}{2+\\sqrt{2}} = \\frac{-2(2-\\sqrt{2})}{(2+\\sqrt{2})(2-\\sqrt{2})} = \\frac{-2(2-\\sqrt{2})}{2}$$\n\n$$\\boxed{m = \\sqrt{2} - 2}$$'
  },
  {
    id: 'alg-pol-045', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a și restul la X−3 din condiția restului la X+2',
    statement: 'Restul împărțirii polinomului $P(X) = X^3 + 3X^2 + aX + 5$ la binomul $X + 2$ este egal cu $13$. Să se afle restul împărțirii lui $P(X)$ la binomul $X - 3$.',
    solution: 'Din $P(-2) = 13$:\n$$-8 + 12 - 2a + 5 = 13 \\Rightarrow -2a = 4 \\Rightarrow a = -2$$\n\n$P(X) = X^3 + 3X^2 - 2X + 5$\n\nRestul la $(X-3)$: $P(3) = 27 + 27 - 6 + 5 = \\boxed{53}$'
  },
  {
    id: 'alg-pol-046', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților și descompunerea în factori cu rădăcina X=2',
    statement: 'Fie polinomul $P(X) = X^3 + aX^2 + 3X + b$. Știind că $X = 2$ este rădăcină a polinomului și că $P(3) = 12$, descompuneți $P(X)$ în factori pe mulțimea $\\mathbb{R}$.',
    solution: 'Din $P(2) = 0$:\n$$8 + 4a + 6 + b = 0 \\Rightarrow 4a + b = -14 \\quad (1)$$\n\nDin $P(3) = 12$:\n$$27 + 9a + 9 + b = 12 \\Rightarrow 9a + b = -24 \\quad (2)$$\n\n$(2)-(1)$: $5a = -10 \\Rightarrow a = -2,\\; b = -6$\n\n$P(X) = X^3 - 2X^2 + 3X - 6$. Schema Horner pentru $X = 2$:\n$$\\begin{array}{c|cccc} 2 & 1 & -2 & 3 & -6 \\\\ & & 2 & 0 & 6 \\\\ \\hline & 1 & 0 & 3 & 0 \\end{array}$$\n\n$X^2+3$ nu are rădăcini reale ($\\Delta = -12 < 0$).\n\n$$\\boxed{P(X) = (X-2)(X^2+3)}$$'
  },

  {
    id: 'alg-pol-047', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția de divizibilitate și restul la X−5',
    statement: 'Polinomul $P(X) = -X^3 - 3X^2 + (a+3)X + (2a+1)$ este divizibil prin binomul $X + 1$. Determinați restul împărțirii polinomului $P(X)$ la binomul $Q(X) = X - 5$.',
    solution: 'Dacă $P(X)$ este divizibil cu $(X+1)$, atunci $P(-1) = 0$:\n$$-(-1)^3 - 3(-1)^2 + (a+3)(-1) + (2a+1) = 0$$\n$$1 - 3 - a - 3 + 2a + 1 = 0 \\Rightarrow a = 4$$\n\n$P(X) = -X^3 - 3X^2 + 7X + 9$\n\nRestul la $(X-5)$: $P(5) = -125 - 75 + 35 + 9 = \\boxed{-156}$'
  },
  {
    id: 'alg-pol-048', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Descompunere în factori cu rădăcina dublă X=1 și coeficient necunoscut a',
    statement: 'Descompuneți în factori ireductibili polinomul\n$$P(X) = X^4 - 3X^3 - aX^2 + (3a+2)X - 6$$\nștiind că $X = 1$ este o rădăcină dublă a polinomului $P(X)$.',
    solution: 'Din $P(1) = 0$: $\\quad 1 - 3 - a + 3a + 2 - 6 = 2a - 6 = 0 \\Rightarrow a = 3$\n\nVerificăm $P\'(1) = 0$: $P\'(X) = 4X^3-9X^2-6X+11 \\Rightarrow P\'(1) = 4-9-6+11 = 0$ ✓\n\n$P(X) = X^4-3X^3-3X^2+11X-6$. Împărțim de două ori prin $(X-1)$:\n$$\\begin{array}{c|ccccc} 1 & 1 & -3 & -3 & 11 & -6 \\\\ & & 1 & -2 & -5 & 6 \\\\ \\hline & 1 & -2 & -5 & 6 & 0 \\end{array}$$\n$$\\begin{array}{c|cccc} 1 & 1 & -2 & -5 & 6 \\\\ & & 1 & -1 & -6 \\\\ \\hline & 1 & -1 & -6 & 0 \\end{array}$$\n\n$X^2-X-6 = (X-3)(X+2)$\n\n$$\\boxed{P(X) = (X-1)^2(X-3)(X+2)}$$'
  },
  {
    id: 'alg-pol-049', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Descompunere în factori cu rădăcina dublă X=2',
    statement: 'Descompuneți în factori ireductibili polinomul\n$$P(X) = X^4 - 8X^3 + 15X^2 + 4X - 20$$\nștiind că $X = 2$ este o rădăcină dublă a polinomului $P(X)$.',
    solution: '$P(2) = 16-64+60+8-20 = 0$ ✓ și $P\'(2) = 32-96+60+4 = 0$ ✓\n\nÎmpărțim de două ori prin $(X-2)$:\n$$\\begin{array}{c|ccccc} 2 & 1 & -8 & 15 & 4 & -20 \\\\ & & 2 & -12 & 6 & 20 \\\\ \\hline & 1 & -6 & 3 & 10 & 0 \\end{array}$$\n$$\\begin{array}{c|cccc} 2 & 1 & -6 & 3 & 10 \\\\ & & 2 & -8 & -10 \\\\ \\hline & 1 & -4 & -5 & 0 \\end{array}$$\n\n$X^2-4X-5 = (X-5)(X+1)$\n\n$$\\boxed{P(X) = (X-2)^2(X-5)(X+1)}$$'
  },
  {
    id: 'alg-pol-050', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 3 la X²−2',
    statement: 'Determinați restul împărțirii polinomului\n$$P(X) = X^3 - 6X^2 - 2$$\nla polinomul $Q(X) = X^2 - 2$.',
    solution: '$R(X) = bX+c$. Rădăcinile lui $X^2-2$: $X = \\pm\\sqrt{2}$.\n\n$$P(\\sqrt{2}) = 2\\sqrt{2} - 12 - 2 = 2\\sqrt{2} - 14 = b\\sqrt{2} + c$$\n$$P(-\\sqrt{2}) = -2\\sqrt{2} - 12 - 2 = -2\\sqrt{2} - 14 = -b\\sqrt{2} + c$$\n\n$b = 2,\\; c = -14$\n\n$$\\boxed{R(X) = 2X - 14}$$'
  },
  {
    id: 'alg-pol-051', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția de divizibilitate cu X+1',
    statement: 'Fie polinomul $P(X) = 2X^3 + 3X^2 - (a+1)X + 2$. Determinați valorile reale ale lui $a$, pentru care polinomul $P(X)$ este divizibil prin $Q(X) = X + 1$.',
    solution: 'Dacă $P(X)$ este divizibil cu $(X+1)$, atunci $P(-1) = 0$:\n$$2(-1)^3 + 3(-1)^2 - (a+1)(-1) + 2 = 0$$\n$$-2 + 3 + (a+1) + 2 = 0$$\n$$a + 4 = 0 \\Rightarrow \\boxed{a = -4}$$'
  },
  {
    id: 'alg-pol-052', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția că X=−3 este rădăcină',
    statement: 'Determinați valorile reale ale lui $a$ pentru care $X = -3$ este rădăcină a polinomului\n$$P(X) = X^3 + (a-1)X^2 - 5X + 3$$',
    solution: '$P(-3) = 0$:\n$$-27 + 9(a-1) + 15 + 3 = 0$$\n$$9a - 18 = 0 \\Rightarrow \\boxed{a = 2}$$'
  },
  {
    id: 'alg-pol-053', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 3 la X²+2',
    statement: 'Determinați restul împărțirii polinomului\n$$P(X) = 2X^3 + X^2 - 2$$\nla polinomul $Q(X) = X^2 + 2$.',
    solution: '$X^2+2$ nu are rădăcini reale, deci împărțim direct cu rest:\n\n$2X^3 \\div X^2 = 2X$; $\\quad 2X(X^2+2) = 2X^3+4X$; rest: $X^2-4X-2$\n\n$X^2 \\div X^2 = 1$; $\\quad 1(X^2+2) = X^2+2$; rest: $-4X-4$\n\n$$P(X) = (X^2+2)(2X+1) + (-4X-4)$$\n\n$$\\boxed{R(X) = -4X - 4}$$'
  },
  {
    id: 'alg-pol-054', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului — ecuație de grad 2',
    statement: 'Fie polinomul $P(X) = 3X^3 + (a+3)X^2 - a^2X - 5$. Știind că restul împărțirii polinomului $P(X)$ la binomul $Q(X) = X + 2$ este egal cu $13$, determinați valorile lui $a$.',
    solution: 'Din $P(-2) = 13$:\n$$3(-8) + (a+3)(4) - a^2(-2) - 5 = 13$$\n$$-24 + 4a + 12 + 2a^2 - 5 = 13$$\n$$2a^2 + 4a - 30 = 0 \\Rightarrow a^2 + 2a - 15 = 0$$\n$$(a+5)(a-3) = 0$$\n$$\\boxed{a = -5 \\quad \\text{sau} \\quad a = 3}$$'
  },
  {
    id: 'alg-pol-055', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Restul împărțirii lui 5X³−2X²+X−4 la X+2',
    statement: 'Determinați restul împărțirii polinomului $P(X) = 5X^3 - 2X^2 + X - 4$ la binomul $X + 2$.',
    solution: 'Prin teorema lui Bézout, restul este $P(-2)$:\n$$P(-2) = 5(-8) - 2(4) + (-2) - 4 = -40 - 8 - 2 - 4 = \\boxed{-54}$$'
  },
  {
    id: 'alg-pol-056', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Aflarea lui a știind că X=2 este rădăcină a polinomului',
    statement: 'Fie polinomul $P(X) = X^3 - aX^2 + X + a$. Aflați numărul real $a$, dacă $X = 2$ este rădăcină a polinomului $P(X)$.',
    solution: 'Din $P(2) = 0$:\n$$8 - 4a + 2 + a = 0$$\n$$10 - 3a = 0 \\Rightarrow \\boxed{a = \\dfrac{10}{3}}$$'
  },
  {
    id: 'alg-pol-057', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui b din condiția restului egal cu 3 la X+1',
    statement: 'Fie polinomul $P(X) = 7X^3 - 6X^2 + bX + 1$. Știind că restul împărțirii polinomului $P(X)$ la binomul $X + 1$ este egal cu $3$, aflați numărul real $b$.',
    solution: 'Din $P(-1) = 3$:\n$$-7 - 6 - b + 1 = 3$$\n$$-12 - b = 3 \\Rightarrow \\boxed{b = -15}$$'
  },
  {
    id: 'alg-pol-058', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu 4 la X−2',
    statement: 'Fie polinomul $P(X) = 2X^3 + (a-2)X^2 - 3aX + 10$. Determinați valorile reale ale lui $a$, știind că restul împărțirii polinomului la binomul $Q(X) = X - 2$ este egal cu $4$.',
    solution: 'Din $P(2) = 4$:\n$$16 + (a-2)(4) - 6a + 10 = 4$$\n$$16 + 4a - 8 - 6a + 10 = 4$$\n$$-2a + 18 = 4 \\Rightarrow \\boxed{a = 7}$$'
  },

  {
    id: 'alg-pol-059', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția că X=−1 este rădăcină',
    statement: 'Determinați valorile reale ale lui $a$, pentru care $X = -1$ este rădăcină a polinomului\n$$P(X) = X^3 - X^2 + (a-2)X + 1$$',
    solution: '$P(-1) = 0$:\n$$-1 - 1 + (a-2)(-1) + 1 = 0$$\n$$-1 - 1 - a + 2 + 1 = 1 - a = 0 \\Rightarrow \\boxed{a = 1}$$'
  },
  {
    id: 'alg-pol-060', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Restul împărțirii lui 2X³+X²−5X+1 la X−2',
    statement: 'Determinați restul împărțirii polinomului $P(X) = 2X^3 + X^2 - 5X + 1$ la binomul $X - 2$.',
    solution: 'Prin teorema lui Bézout, restul este $P(2)$:\n$$P(2) = 16 + 4 - 10 + 1 = \\boxed{11}$$'
  },
  {
    id: 'alg-pol-061', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii lui X³−2X²+16 la X²−1',
    statement: 'Determinați restul împărțirii polinomului $P(X) = X^3 - 2X^2 + 16$ la polinomul $Q(X) = X^2 - 1$.',
    solution: '$R(X) = bX+c$. Deoarece $X^2-1 = (X-1)(X+1)$, evaluăm în $X=1$ și $X=-1$:\n\n$$P(1) = 1 - 2 + 16 = 15 = b + c \\quad (1)$$\n$$P(-1) = -1 - 2 + 16 = 13 = -b + c \\quad (2)$$\n\nDin $(1)+(2)$: $2c = 28 \\Rightarrow c = 14,\\; b = 1$\n\n$$\\boxed{R(X) = X + 14}$$'
  },
  {
    id: 'alg-pol-062', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția de divizibilitate cu X−2',
    statement: 'Fie polinomul $P(X) = X^3 - 4X^2 - aX - 4$. Determinați valorile reale ale lui $a$, pentru care polinomul $P(X)$ este divizibil prin $Q(X) = X - 2$.',
    solution: 'Dacă $P(X)$ este divizibil cu $(X-2)$, atunci $P(2) = 0$:\n$$8 - 16 - 2a - 4 = 0$$\n$$-12 - 2a = 0 \\Rightarrow \\boxed{a = -6}$$'
  },
  {
    id: 'alg-pol-063', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Demonstrarea divizibilității unui polinom dat printr-un determinant',
    statement: 'Fie polinomul\n$$P(X) = \\begin{vmatrix} X & 3 & 0 \\\\ -1 & X & 3 \\\\ 2X & 6 & X-2 \\end{vmatrix}$$\nArătați că $P(X)$ este divizibil cu $X - 2$.',
    solution: 'Dezvoltăm determinantul după primul rând:\n$$P(X) = X(X(X-2)-18) - 3(-(X-2)-6X)$$\n$$= X(X^2-2X-18) - 3(-7X+2)$$\n$$= X^3-2X^2-18X+21X-6$$\n$$= X^3-2X^2+3X-6$$\n\nFactorizăm prin grupare:\n$$P(X) = X^2(X-2)+3(X-2) = (X-2)(X^2+3)$$\n\nDeoarece $P(X) = (X-2)(X^2+3)$, $P(X)$ este divizibil cu $X-2$. $\\blacksquare$'
  },
  {
    id: 'alg-pol-064', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția de divizibilitate și restul la X²+3',
    statement: 'Fie polinomul $P(X) = X^4 + (m+1)X^3 + 2X^2 + 7X + 3$, care este divizibil la binomul $(X + 3)$. Determinați valoarea reală a lui $m$ și restul împărțirii lui $P(X)$ la polinomul $Q(X) = X^2 + 3$.',
    solution: 'Din $P(-3) = 0$:\n$$81 - 27(m+1) + 18 - 21 + 3 = 0$$\n$$54 - 27m = 0 \\Rightarrow m = 2$$\n\n$P(X) = X^4 + 3X^3 + 2X^2 + 7X + 3$. Împărțim la $X^2+3$:\n\n$X^4 \\div X^2 = X^2$; rest: $3X^3-X^2+7X+3$\n\n$3X^3 \\div X^2 = 3X$; rest: $-X^2-2X+3$\n\n$-X^2 \\div X^2 = -1$; rest: $-2X+6$\n\n$$\\boxed{m = 2, \\quad R(X) = -2X + 6}$$'
  },
  {
    id: 'alg-pol-065', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Demonstrarea că X=2 este rădăcină și determinarea celorlalte rădăcini',
    statement: 'Fie polinomul $P(X) = 4X^3 - 16X^2 + 19X - 6$. Arătați că $X = 2$ este rădăcină a polinomului $P(X)$ și determinați celelalte rădăcini ale polinomului.',
    solution: '$P(2) = 32 - 64 + 38 - 6 = 0$ ✓\n\nSchema Horner pentru $X = 2$:\n$$\\begin{array}{c|cccc} 2 & 4 & -16 & 19 & -6 \\\\ & & 8 & -16 & 6 \\\\ \\hline & 4 & -8 & 3 & 0 \\end{array}$$\n\n$P(X) = (X-2)(4X^2-8X+3) = (X-2)(2X-1)(2X-3)$\n\n$$\\boxed{X = \\tfrac{1}{2}, \\quad X = \\tfrac{3}{2}}$$'
  },
  {
    id: 'alg-pol-066', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea câtului împărțirii la X−2 din două condiții simultane',
    statement: 'Fie polinomul $P(X) = 2X^3 + aX^2 + bX + 2$, $a, b \\in \\mathbb{R}$. Determinați câtul împărțirii lui $P(X)$ la binomul $X - 2$, dacă se știe că $X = 2$ este rădăcină a polinomului $P(X)$, iar restul împărțirii lui $P(X)$ la $(X + 1)$ este egal cu $3$.',
    solution: 'Din $P(2) = 0$:\n$$16 + 4a + 2b + 2 = 0 \\Rightarrow 2a + b = -9 \\quad (1)$$\n\nDin $P(-1) = 3$:\n$$-2 + a - b + 2 = 3 \\Rightarrow a - b = 3 \\quad (2)$$\n\nDin $(1)+(2)$: $3a = -6 \\Rightarrow a = -2,\\; b = -5$\n\n$P(X) = 2X^3 - 2X^2 - 5X + 2$. Schema Horner pentru $X = 2$:\n$$\\begin{array}{c|cccc} 2 & 2 & -2 & -5 & 2 \\\\ & & 4 & 4 & -2 \\\\ \\hline & 2 & 2 & -1 & 0 \\end{array}$$\n\n$$\\boxed{C(X) = 2X^2 + 2X - 1}$$'
  },
  {
    id: 'alg-pol-067', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția restului egal cu 4 la X+2',
    statement: 'Fie polinomul $P(X) = X^3 - 6X^2 + mX - 6$. Determinați valorile reale a lui $m$ pentru care restul împărțirii polinomului $P(X)$ la $(X + 2)$ este egal cu $4$.',
    solution: 'Din $P(-2) = 4$:\n$$-8 - 24 - 2m - 6 = 4$$\n$$-38 - 2m = 4 \\Rightarrow -2m = 42 \\Rightarrow \\boxed{m = -21}$$'
  },
  {
    id: 'alg-pol-068', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a știind că X=−2 este rădăcină',
    statement: 'Determinați valorile reale ale lui $a$, știind că $X = -2$ este rădăcină a polinomului $P(X) = 2X^3 + 4X + a$.',
    solution: '$P(-2) = 0$:\n$$2(-8) + 4(-2) + a = 0$$\n$$-16 - 8 + a = 0 \\Rightarrow \\boxed{a = 24}$$'
  },
  {
    id: 'alg-pol-069', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a știind că X=1/2 este rădăcină',
    statement: 'Să se afle valoarea parametrului real $a$ pentru care $X = \\dfrac{1}{2}$ este rădăcină a polinomului $P(X) = 4X^3 - 22X^2 + aX - 14$.',
    solution: '$P\\!\\left(\\dfrac{1}{2}\\right) = 0$:\n$$4 \\cdot \\frac{1}{8} - 22 \\cdot \\frac{1}{4} + \\frac{a}{2} - 14 = 0$$\n$$\\frac{1}{2} - \\frac{11}{2} + \\frac{a}{2} - 14 = 0$$\n$$\\frac{a - 10}{2} = 14 \\Rightarrow a - 10 = 28 \\Rightarrow \\boxed{a = 38}$$'
  },
  {
    id: 'alg-pol-070', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui m ∈ ℝ știind că X=1 este rădăcină a unui polinom de grad 4',
    statement: 'Fie polinomul $P(X) = 4X^4 + 4mX^3 + (m^2+7)X^2 + 4mX + 4$, unde $m \\in \\mathbb{R}$. Determinați $m \\in \\mathbb{R}$, știind că $X = 1$ este o rădăcină a polinomului $P(X)$.',
    solution: '$P(1) = 0$:\n$$4 + 4m + (m^2+7) + 4m + 4 = 0$$\n$$m^2 + 8m + 15 = 0$$\n$$(m+3)(m+5) = 0$$\n$$\\boxed{m = -3 \\quad \\text{sau} \\quad m = -5}$$'
  },
  {
    id: 'alg-pol-071', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 3 la X²−2',
    statement: 'Aflați restul împărțirii $P(X) = 3X^3 - 4X^2 + 5X - 1$ la $Q(X) = X^2 - 2$.',
    solution: '$R(X) = aX+b$. Rădăcinile lui $Q$: $X = \\pm\\sqrt{2}$.\n\n$$P(\\sqrt{2}) = 6\\sqrt{2} - 8 + 5\\sqrt{2} - 1 = 11\\sqrt{2} - 9 = a\\sqrt{2} + b$$\n$$P(-\\sqrt{2}) = -6\\sqrt{2} - 8 - 5\\sqrt{2} - 1 = -11\\sqrt{2} - 9 = -a\\sqrt{2} + b$$\n\n$a = 11,\\; b = -9$\n\n$$\\boxed{R(X) = 11X - 9}$$'
  },
  {
    id: 'alg-pol-072', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților din resturile la X−1 și X+2, apoi restul la X−2',
    statement: 'Împărțind polinomul $P(X) = X^3 + aX^2 + bX + 3$ la binomul $X - 1$ și la binomul $X + 2$, se obțin resturile $5$, respectiv $17$. Aflați restul împărțirii polinomului $P(X)$ la $X - 2$.',
    solution: 'Din $P(1) = 5$:\n$$1 + a + b + 3 = 5 \\Rightarrow a + b = 1 \\quad (1)$$\n\nDin $P(-2) = 17$:\n$$-8 + 4a - 2b + 3 = 17 \\Rightarrow 2a - b = 11 \\quad (2)$$\n\nDin $(1)+(2)$: $3a = 12 \\Rightarrow a = 4,\\; b = -3$\n\n$P(X) = X^3 + 4X^2 - 3X + 3$\n\nRestul la $(X-2)$: $P(2) = 8 + 16 - 6 + 3 = \\boxed{21}$'
  },
  {
    id: 'alg-pol-073', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul la X−2 cunoscând că X=−1 este rădăcină',
    statement: 'Aflați restul împărțirii polinomului $P(X) = 3X^3 + aX^2 - 2aX + 7$ la binomul $X - 2$, știind că $X = -1$ este rădăcină a acestui polinom.',
    solution: 'Din $P(-1) = 0$:\n$$-3 + a + 2a + 7 = 0 \\Rightarrow 3a + 4 = 0 \\Rightarrow a = -\\dfrac{4}{3}$$\n\nRestul la $(X-2)$: $P(2) = 3(8) + a(4) - 2a(2) + 7 = 24 + 4a - 4a + 7 = 31$\n\n(Termenii cu $a$ se anulează!)\n\n$$\\boxed{\\text{Restul} = 31}$$'
  },
  {
    id: 'alg-pol-074', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a și b din resturile la X+2 și X+3',
    statement: 'Împărțind polinomul $P(X) = X^3 + aX^2 + bX + 3$ la binomul $X + 2$, se obține restul $1$, iar la binomul $X + 3$, se obține restul $-3$. Determinați $a, b \\in \\mathbb{R}$.',
    solution: 'Din $P(-2) = 1$:\n$$-8 + 4a - 2b + 3 = 1 \\Rightarrow 2a - b = 3 \\quad (1)$$\n\nDin $P(-3) = -3$:\n$$-27 + 9a - 3b + 3 = -3 \\Rightarrow 3a - b = 7 \\quad (2)$$\n\nDin $(2)-(1)$: $a = 4$, înlocuim în $(1)$: $b = 5$\n\nVerificare: $P(-2) = -8+16-10+3 = 1$ ✓, $P(-3) = -27+36-15+3 = -3$ ✓\n\n$$\\boxed{a = 4, \\quad b = 5}$$'
  },
  {
    id: 'alg-pol-075', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția de divizibilitate cu X+2',
    statement: 'Să se afle valorile parametrului real $m$ pentru care polinomul $P(X) = 2X^5 + 5X^2 - m$ se divide cu binomul $X + 2$.',
    solution: 'Dacă $P(X)$ este divizibil cu $(X+2)$, atunci $P(-2) = 0$:\n$$2(-32) + 5(4) - m = 0$$\n$$-64 + 20 - m = 0$$\n$$-44 = m$$\n$$\\boxed{m = -44}$$'
  },

  /* ============================================================
     ALGEBRĂ — Numere complexe
     ============================================================ */
  {
    id: 'alg-cx-001', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$z^2 - (3+2i)z + 6i = 0$$',
    solution: '$\\Delta = (3+2i)^2-4\\cdot 6i = (9+12i-4)-24i = 5-12i$\nCalculăm $\\sqrt{5-12i}$: fie $\\sqrt{5-12i} = p+qi$, $p,q \\in \\mathbb{R}$.\n$p^2-q^2 = 5$ și $2pq = -12 \\Rightarrow q = -6/p$\n$p^2-36/p^2 = 5 \\Rightarrow p^4-5p^2-36 = 0 \\Rightarrow (p^2-9)(p^2+4) = 0$\n$p^2 = 9 \\Rightarrow p = \\pm 3$, $q = \\mp 2$\nDeci $\\sqrt{\\Delta} = 3-2i$.\n$$z_{1,2} = \\frac{(3+2i)\\pm(3-2i)}{2}$$\n$$z_1 = \\frac{6}{2} = 3,\\qquad z_2 = \\frac{4i}{2} = 2i$$\n$$\\boxed{z_1 = 3,\\quad z_2 = 2i}$$'
  },
  {
    id: 'alg-cx-002', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produsul părților reală și imaginară',
    statement: 'Determinați produsul dintre partea reală și partea imaginară a numărului complex\n$$z = 3 + \\frac{2+3i}{3-2i}$$\nunde $i^2 = -1$.',
    solution: 'Amplificăm fracția cu conjugatul numitorului:\n$$\\frac{2+3i}{3-2i} = \\frac{(2+3i)(3+2i)}{9+4} = \\frac{6+4i+9i+6i^2}{13} = \\frac{13i}{13} = i$$\nDeci $z = 3+i$, adică $\\text{Re}(z) = 3$, $\\text{Im}(z) = 1$.\n$$\\boxed{\\text{Re}(z) \\cdot \\text{Im}(z) = 3 \\cdot 1 = 3}$$'
  },
  {
    id: 'alg-cx-003', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui număr complex dat printr-un determinant',
    statement: 'Determinați conjugatul numărului complex\n$$z = \\begin{vmatrix} -3-2i & 5 \\\\ -2i & 3+i \\end{vmatrix}$$\nunde $i^2 = -1$.',
    solution: 'Calculăm determinantul:\n$$z = (-3-2i)(3+i) - 5 \\cdot (-2i)$$\n$$= -9-3i-6i-2i^2+10i = -9-9i+2+10i = -7+i$$\nConjugatul lui $z = -7+i$ este:\n$$\\boxed{\\bar{z} = -7-i}$$'
  },
  {
    id: 'alg-cx-004', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Condiție ca expresia să fie număr real nenul',
    statement: 'Fie expresia $E(z) = mz^2 + (m-1)z + 4$, unde $m \\in \\mathbb{R}$. Determinați valoarea reală a lui $m$, pentru care $E(-1+2i)$ este un număr real nenul.',
    solution: 'Calculăm $(-1+2i)^2 = 1-4i+4i^2 = -3-4i$.\n$$E(-1+2i) = m(-3-4i)+(m-1)(-1+2i)+4 = (-4m+5)+(-2m-2)i$$\nPentru $E(-1+2i)$ real: $-2m-2 = 0 \\Rightarrow m = -1$.\nVerificăm că e nenul: $E(-1+2i) = 9 \\neq 0$ ✓\n$$\\boxed{m = -1}$$'
  },
  {
    id: 'alg-cx-005', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară în ℂ',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$(4+3i)z = 2-i$$',
    solution: '$$z = \\frac{2-i}{4+3i} = \\frac{(2-i)(4-3i)}{16+9} = \\frac{8-6i-4i+3i^2}{25} = \\frac{5-10i}{25}$$\n$$\\boxed{z = \\frac{1}{5} - \\frac{2}{5}i}$$'
  },
  {
    id: 'alg-cx-006', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat ca produs',
    statement: 'Determinați modulul numărului complex\n$$z = -\\frac{(1-5i)(3+2i)}{13}$$',
    solution: '$(1-5i)(3+2i) = 3+2i-15i-10i^2 = 13-13i$\n$$z = -\\frac{13-13i}{13} = -1+i$$\n$$\\boxed{|z| = \\sqrt{(-1)^2+1^2} = \\sqrt{2}}$$'
  },
  {
    id: 'alg-cx-007', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din condiție cu determinant',
    statement: 'Determinați numerele complexe $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\begin{vmatrix} 2-i & 1 \\\\ \\bar{z} & z+i \\end{vmatrix} = 1$$',
    solution: 'Condiția este $(2-i)(z+i) - \\bar{z} = 1$.\nCu $z = a+bi$, $\\bar{z} = a-bi$:\n$(2-i)(a+(b+1)i) - (a-bi) = 1$\n$(a+b+1)+(3b+2-a)i = 1$\n\nRe: $a+b = 0 \\Rightarrow a = -b$\nIm: $3b+2+b = 0 \\Rightarrow b = -\\dfrac{1}{2}$, $a = \\dfrac{1}{2}$\n$$\\boxed{z = \\frac{1}{2} - \\frac{i}{2}}$$'
  },
  {
    id: 'alg-cx-008', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat și fracție',
    statement: 'Determinați numărul complex $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\frac{3\\bar{z}-2i}{2z+3} = i$$\nunde $\\bar{z}$ este conjugatul lui $z$.',
    solution: '$3\\bar{z}-2i = i(2z+3)$\n$3(a-bi)-2i = -2b+(2a+3)i$\n$3a-(3b+2)i = -2b+(2a+3)i$\n\nRe: $3a = -2b$, Im: $-(3b+2) = 2a+3$\nDin prima: $b = -\\dfrac{3a}{2}$. Înlocuind: $-\\dfrac{5a}{2} = -5 \\Rightarrow a = 2$, $b = -3$\n$$\\boxed{z = 2-3i}$$'
  },
  {
    id: 'alg-cx-009', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex cu puteri ale lui i',
    statement: 'Determinați modulul numărului complex\n$$z = \\frac{10}{1+3i} + 3i^{10}$$',
    solution: '$i^{10} = (i^4)^2 \\cdot i^2 = -1$, deci $3i^{10} = -3$.\n$$\\frac{10}{1+3i} = \\frac{10(1-3i)}{10} = 1-3i$$\n$z = (1-3i)+(-3) = -2-3i$\n$$\\boxed{|z| = \\sqrt{4+9} = \\sqrt{13}}$$'
  },
  {
    id: 'alg-cx-010', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Numere complexe cu condiție de modul și ecuație liniară',
    statement: 'Determinați numerele complexe $z$ care verifică condițiile:\n$$|z| = \\sqrt{10} \\quad \\text{și} \\quad (3-i)z+(3+i)\\bar{z} = 20$$',
    solution: 'Fie $z = a+bi$. $(3-i)(a+bi)+(3+i)(a-bi) = (6a+2b)+0 \\cdot i = 20$\n$\\Rightarrow 3a+b = 10 \\Rightarrow b = 10-3a$\nDin $|z|^2 = 10$: $a^2+(10-3a)^2 = 10$\n$10a^2-60a+90 = 0 \\Rightarrow (a-3)^2 = 0 \\Rightarrow a = 3$, $b = 1$\n$$\\boxed{z = 3+i}$$'
  },
  {
    id: 'alg-cx-011', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat',
    statement: 'Determinați numărul complex $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\frac{\\bar{z}-i}{z+1-i} = 1+2i$$\nunde $\\bar{z}$ este conjugatul lui $z$.',
    solution: '$\\bar{z}-i = (1+2i)(z+1-i)$\nCu $z = a+bi$, $\\bar{z} = a-bi$:\n$a-(b+1)i = (a-2b+3)+(2a+b+1)i$\n\nRe: $a = a-2b+3 \\Rightarrow b = \\dfrac{3}{2}$\nIm: $-(b+1) = 2a+b+1 \\Rightarrow a = -b-1 = -\\dfrac{5}{2}$\n$$\\boxed{z = -\\frac{5}{2}+\\frac{3}{2}i}$$'
  },
  {
    id: 'alg-cx-012', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui determinant cu puteri ale lui i',
    statement: 'Determinați conjugatul numărului complex\n$$z = \\begin{vmatrix} i^{101} & 1+i \\\\ 2-i & i^{50} \\end{vmatrix}$$',
    solution: '$i^{101} = i^{4 \\cdot 25+1} = i$, $i^{50} = i^{4 \\cdot 12+2} = i^2 = -1$\n$$z = i \\cdot (-1)-(1+i)(2-i) = -i-(2-i+2i-i^2) = -i-(3+i) = -3-2i$$\n$$\\boxed{\\bar{z} = -3+2i}$$'
  },
  {
    id: 'alg-cx-013', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$z^2-(5-i)z+8-i = 0$$',
    solution: '$\\Delta = (5-i)^2-4(8-i) = (24-10i-1)-(32-4i) = -8-6i$\nCalculăm $\\sqrt{-8-6i}$: fie $\\sqrt{-8-6i} = p+qi$, $p,q \\in \\mathbb{R}$.\n$p^2-q^2 = -8$ și $2pq = -6 \\Rightarrow q = -3/p$\n$p^2 - 9/p^2 = -8 \\Rightarrow p^4+8p^2-9 = 0 \\Rightarrow (p^2+9)(p^2-1) = 0$\n$p^2 = 1 \\Rightarrow p = \\pm 1$, $q = \\mp 3$, deci $\\sqrt{\\Delta} = 1-3i$.\n$$z_{1,2} = \\frac{(5-i)\\pm(1-3i)}{2}$$\n$$z_1 = \\frac{6-4i}{2} = 3-2i, \\qquad z_2 = \\frac{4+2i}{2} = 2+i$$\n$$\\boxed{z_1 = 3-2i, \\quad z_2 = 2+i}$$'
  },
  {
    id: 'alg-cx-014', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produsul părților reală și imaginară',
    statement: 'Determinați produsul dintre partea reală și partea imaginară a numărului complex\n$$z = \\frac{50}{1-7i}+3$$',
    solution: '$$\\frac{50}{1-7i} = \\frac{50(1+7i)}{1+49} = 1+7i$$\n$z = 1+7i+3 = 4+7i$, deci $\\text{Re}(z) = 4$, $\\text{Im}(z) = 7$.\n$$\\boxed{\\text{Re}(z) \\cdot \\text{Im}(z) = 28}$$'
  },
  {
    id: 'alg-cx-015', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară în ℂ',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$(2+i)z = 5+5i$$',
    solution: '$$z = \\frac{5+5i}{2+i} = \\frac{(5+5i)(2-i)}{5} = \\frac{10-5i+10i-5i^2}{5} = \\frac{15+5i}{5}$$\n$$\\boxed{z = 3+i}$$'
  },
  {
    id: 'alg-cx-016', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație în ℂ cu determinant de ordinul 3',
    statement: 'Fie\n$$D(z) = \\begin{vmatrix} z-1 & 2 & 0 \\\\ -2 & z-1 & 0 \\\\ 5 & 7 & z-i \\end{vmatrix}$$\nunde $i^2 = -1$. Rezolvați în $\\mathbb{C}$ ecuația $D(z) = 0$.',
    solution: 'Dezvoltăm după coloana a 3-a:\n$$D(z) = (z-i)\\begin{vmatrix} z-1 & 2 \\\\ -2 & z-1 \\end{vmatrix} = (z-i)\\left[(z-1)^2+4\\right] = (z-i)(z^2-2z+5)$$\nRădăcinile: $z_1 = i$\n$z^2-2z+5 = 0 \\Rightarrow z = \\dfrac{2 \\pm \\sqrt{-16}}{2} = 1\\pm 2i$\n$$\\boxed{z_1 = i, \\quad z_2 = 1+2i, \\quad z_3 = 1-2i}$$'
  },
  {
    id: 'alg-cx-017', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat printr-un determinant',
    statement: 'Determinați modulul numărului complex\n$$z = \\begin{vmatrix} \\dfrac{1}{i} & 2 \\\\ 1 & \\dfrac{2}{1+i} \\end{vmatrix}$$',
    solution: '$\\dfrac{1}{i} = \\dfrac{i}{i^2} = -i$, $\\dfrac{2}{1+i} = \\dfrac{2(1-i)}{2} = 1-i$\n$$z = (-i)(1-i) - 2 = -i+i^2-2 = -1-i-2 = -3-i$$\n$$\\boxed{|z| = \\sqrt{9+1} = \\sqrt{10}}$$'
  },
  {
    id: 'alg-cx-018', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Forma trigonometrică a unui produs de numere complexe',
    statement: 'Scrieți sub formă trigonometrică numărul complex\n$$z = (-1+i\\sqrt{3})(\\sqrt{3}+i)$$',
    solution: '$z = -\\sqrt{3}-i+3i+i^2\\sqrt{3} = -2\\sqrt{3}+2i$\n$|z| = \\sqrt{12+4} = 4$\nCadranul II: $\\cos\\theta = -\\dfrac{\\sqrt{3}}{2}$, $\\sin\\theta = \\dfrac{1}{2} \\Rightarrow \\theta = \\dfrac{5\\pi}{6}$\n$$\\boxed{z = 4\\left(\\cos\\frac{5\\pi}{6}+i\\sin\\frac{5\\pi}{6}\\right)}$$'
  },
  {
    id: 'alg-cx-019', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Condiție ca un număr complex să fie real',
    statement: 'Fie $a \\in \\mathbb{R}$ și\n$$z = \\frac{a+2i}{2+ai}$$\nDeterminați $a$, pentru care $z \\in \\mathbb{R}$.',
    solution: '$$z = \\frac{(a+2i)(2-ai)}{4+a^2} = \\frac{4a+(4-a^2)i}{4+a^2}$$\nPentru $z \\in \\mathbb{R}$: $\\text{Im}(z) = 0 \\Rightarrow 4-a^2 = 0 \\Rightarrow a^2 = 4$\n$$\\boxed{a = \\pm 2}$$'
  },
  {
    id: 'alg-cx-020', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat',
    statement: 'Determinați numărul complex $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$(1+i)z+(2-i)\\bar{z} = 8+3i$$\nunde $\\bar{z}$ este conjugatul lui $z$.',
    solution: '$(1+i)(a+bi)+(2-i)(a-bi) = 8+3i$\n$(3a-2b)+(-b)i = 8+3i$\n\nRe: $3a-2b = 8$, Im: $-b = 3 \\Rightarrow b = -3$\n$3a+6 = 8 \\Rightarrow a = \\dfrac{2}{3}$\n$$\\boxed{z = \\frac{2}{3}-3i}$$'
  },
  {
    id: 'alg-cx-021', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Rezolvare ecuație cu conjugat în ℂ',
    statement: 'Să se rezolve în $\\mathbb{C}$ ecuația\n$$2z+3\\bar{z} = 15-2i$$',
    solution: 'Fie $z = a+bi$, $\\bar{z} = a-bi$.\n$2(a+bi)+3(a-bi) = 15-2i$\n$5a+(-b)i = 15-2i$\n\nRe: $a = 3$, Im: $b = 2$\n$$\\boxed{z = 3+2i}$$'
  },
  {
    id: 'alg-cx-022', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$(1-i)z^2-4z+2+2i = 0$$',
    solution: '$\\Delta = 16-4(1-i)(2+2i)$\n$(1-i)(2+2i) = 2+2i-2i-2i^2 = 4$\n$\\Delta = 16-16 = 0$, rădăcină dublă:\n$$z = \\frac{4}{2(1-i)} = \\frac{2(1+i)}{2} = 1+i$$\n$$\\boxed{z = 1+i \\text{ (rădăcină dublă)}}$$'
  },
  {
    id: 'alg-cx-023', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul lui z din ecuație liniară',
    statement: 'Determinați conjugatul lui $z$, pentru care\n$$(1-3i)z = 10i$$',
    solution: '$$z = \\frac{10i}{1-3i} = \\frac{10i(1+3i)}{10} = i+3i^2 = -3+i$$\n$$\\boxed{\\bar{z} = -3-i}$$'
  },
  {
    id: 'alg-cx-024', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din condiție cu determinant',
    statement: 'Determinați numerele complexe $z = a+bi$, $a, b \\in \\mathbb{R}$, pentru care\n$$\\begin{vmatrix} 3z & \\bar{z}-2 \\\\ i+1 & i-1 \\end{vmatrix} = -4i$$',
    solution: '$(3z)(i-1)-(\\bar{z}-2)(i+1) = -4i$\n$(-3a-3b+(3a-3b)i) - (a-2+b+((a-2)-b)i) = -4i$\n\nRe: $-4a-4b+2 = 0 \\Rightarrow a+b = \\dfrac{1}{2}$\nIm: $2a-2b+2 = -4 \\Rightarrow a-b = -3$\n$a = -\\dfrac{5}{4}$, $b = \\dfrac{7}{4}$\n$$\\boxed{z = -\\frac{5}{4}+\\frac{7}{4}i}$$'
  },
  {
    id: 'alg-cx-025', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu determinant 2×2 în ℂ',
    statement: 'Fie\n$$D(z) = \\begin{vmatrix} (1+i)z & i \\\\ z+1 & z-i \\end{vmatrix}$$\nRezolvați în $\\mathbb{C}$ ecuația $D(z) = -i$.',
    solution: '$(1+i)z(z-i)-i(z+1) = -i$\n$(1+i)z^2-i(1+i)z-iz = 0$\n$(1+i)z^2+(1-2i)z = 0$\n$z[(1+i)z+(1-2i)] = 0$\n$z_1 = 0$, sau $z_2 = \\dfrac{(-1+2i)(1-i)}{2} = \\dfrac{1+3i}{2}$\n$$\\boxed{z_1 = 0, \\quad z_2 = \\frac{1+3i}{2}}$$'
  },
  {
    id: 'alg-cx-026', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinantul unei matrice cu puteri ale lui i',
    statement: 'Calculați determinantul matricei\n$$A = \\begin{pmatrix} i^5 & 2 & 1 \\\\ 0 & i^{10} & -i \\\\ 1+i & 1-i & 0 \\end{pmatrix}$$\nunde $i^2 = -1$.',
    solution: '$i^5 = i$, $i^{10} = -1$. Matricea devine $\\begin{pmatrix} i & 2 & 1 \\\\ 0 & -1 & -i \\\\ 1+i & 1-i & 0 \\end{pmatrix}$.\nDezvoltăm după prima coloană:\n$\\det A = i\\begin{vmatrix}-1&-i\\\\1-i&0\\end{vmatrix}+(1+i)\\begin{vmatrix}2&1\\\\-1&-i\\end{vmatrix}$\n$= i(0+i(1-i))+(1+i)(-2i+1)$\n$= i(i+1)+(1+i)(1-2i)$\n$= (i^2+i)+(1-2i+i-2i^2)$\n$= (-1+i)+(3-i) = 2$\n$$\\boxed{\\det A = 2}$$'
  },
  {
    id: 'alg-cx-027', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Condiție ca expresia să fie număr real',
    statement: 'Fie expresia\n$$E(z) = az^2-(a+1)z+8i$$\nDeterminați $a \\in \\mathbb{R}$, astfel încât $E(1-i)$ să fie număr real.',
    solution: '$(1-i)^2 = -2i$\n$E(1-i) = a(-2i)-(a+1)(1-i)+8i$\n$= -(a+1)+(-2a+(a+1)+8)i$\n$= -(a+1)+(-a+9)i$\nPentru $E(1-i)$ real: $-a+9 = 0 \\Rightarrow a = 9$\n$$\\boxed{a = 9}$$'
  },
  {
    id: 'alg-cx-028', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat printr-un determinant',
    statement: 'Calculați modulul numărului complex\n$$z = \\begin{vmatrix} 3+2i & 2i^3 \\\\ 1 & 1+i \\end{vmatrix}$$\nunde $i^2 = -1$.',
    solution: '$i^3 = -i$, deci $2i^3 = -2i$.\n$$z = (3+2i)(1+i)-(-2i)\\cdot 1 = 3+3i+2i+2i^2+2i = 3+7i-2 = 1+7i$$\n$$\\boxed{|z| = \\sqrt{1^2+7^2} = \\sqrt{50} = 5\\sqrt{2}}$$'
  },
  {
    id: 'alg-cx-029', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui cât de numere complexe',
    statement: 'Determinați modulul numărului complex\n$$z = \\frac{3+2i}{2-3i}$$\nunde $i^2 = -1$.',
    solution: 'Proprietate: $|z| = \\dfrac{|3+2i|}{|2-3i|}$\n$$|3+2i| = \\sqrt{9+4} = \\sqrt{13}, \\qquad |2-3i| = \\sqrt{4+9} = \\sqrt{13}$$\n$$\\boxed{|z| = \\frac{\\sqrt{13}}{\\sqrt{13}} = 1}$$'
  },
  {
    id: 'alg-cx-030', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat și fracție',
    statement: 'Determinați numărul complex $z = a+bi$, $i^2 = -1$, pentru care\n$$\\frac{-6+6z}{1-i+\\bar{z}} = 4-i$$\nunde $\\bar{z}$ este conjugatul numărului complex.',
    solution: '$-6+6z = (4-i)(1-i+\\bar{z})$\n$-6+6(a+bi) = (4-i)((1+a)-(b+1)i)$\nDezvoltăm RHS: $(3+4a-b)+(-5-a-4b)i$\n\nRe: $-6+6a = 3+4a-b \\Rightarrow 2a+b = 9$\nIm: $6b = -5-a-4b \\Rightarrow a+10b = -5$\n\nDin sistem: $a = 5$, $b = -1$\n$$\\boxed{z = 5-i}$$'
  },
  {
    id: 'alg-cx-031', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 în ℂ',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$2z^2+2z+1 = 0$$',
    solution: '$\\Delta = 4-8 = -4$\n$$z_{1,2} = \\frac{-2 \\pm \\sqrt{-4}}{4} = \\frac{-2 \\pm 2i}{4}$$\n$$\\boxed{z_1 = -\\frac{1}{2}+\\frac{i}{2}, \\quad z_2 = -\\frac{1}{2}-\\frac{i}{2}}$$'
  },
  {
    id: 'alg-cx-032', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Raportul Im/Re al unui număr complex',
    statement: 'Fie numărul complex\n$$z = (1-3i)(3-4i)+6+2i^3$$\nunde $i^2 = -1$. Calculați $\\dfrac{\\text{Im}\\,z}{\\text{Re}\\,z}$.',
    solution: '$i^3 = -i$, deci $2i^3 = -2i$.\n$(1-3i)(3-4i) = 3-4i-9i+12i^2 = -9-13i$\n$z = -9-13i+6-2i = -3-15i$\n$$\\boxed{\\frac{\\text{Im}\\,z}{\\text{Re}\\,z} = \\frac{-15}{-3} = 5}$$'
  },
  {
    id: 'alg-cx-033', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat',
    statement: 'Determinați numărul complex $z = a+bi$, $i^2 = -1$, pentru care\n$$\\frac{2\\bar{z}}{3+z} = -i$$\nunde $\\bar{z}$ este conjugatul numărului complex.',
    solution: '$2\\bar{z} = -i(3+z)$\n$2(a-bi) = -3i-(ai+bi^2) = b+(-3-a)i$\n\nRe: $2a = b$, Im: $-2b = -3-a$\nDin prima: $b=2a$. Înlocuind: $-4a = -3-a \\Rightarrow a = 1$, $b = 2$\n$$\\boxed{z = 1+2i}$$'
  },
  {
    id: 'alg-cx-034', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinantul unei matrice cu puteri ale lui i',
    statement: 'Calculați determinantul matricei\n$$A = \\begin{pmatrix} i^3 & 2-4i \\\\ 1-3i & 4-i \\end{pmatrix}$$\nunde $i^2 = -1$.',
    solution: '$i^3 = -i$\n$\\det A = (-i)(4-i)-(2-4i)(1-3i)$\n$= -4i+i^2-(2-6i-4i+12i^2)$\n$= (-1-4i)-(-10-10i)$\n$= 9+6i$\n$$\\boxed{\\det A = 9+6i}$$'
  },
  {
    id: 'alg-cx-035', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Demonstrarea că un determinant este număr pur imaginar',
    statement: 'Arătați că determinantul matricei\n$$A = \\begin{pmatrix} 1-2i & i^4 \\\\ 5+6i^3 & 1+2i \\end{pmatrix}$$\nunde $i^2 = -1$, este un număr pur imaginar.',
    solution: '$i^4 = 1$, $i^3 = -i$, deci $6i^3 = -6i$ și $5+6i^3 = 5-6i$.\n$\\det A = (1-2i)(1+2i) - 1 \\cdot (5-6i)$\n$= (1+4) - (5-6i)$\n$= 5-5+6i$\n$$\\boxed{\\det A = 6i}$$\nDeoarece $6i$ are partea reală egală cu $0$, este număr pur imaginar.'
  },
  {
    id: 'alg-cx-036', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui număr complex dat ca fracție',
    statement: 'Determinați conjugatul numărului complex\n$$z = \\frac{2-9i}{4-i}$$\nunde $i^2 = -1$.',
    solution: '$$z = \\frac{(2-9i)(4+i)}{(4-i)(4+i)} = \\frac{8+2i-36i-9i^2}{17} = \\frac{17-34i}{17} = 1-2i$$\n$$\\boxed{\\bar{z} = 1+2i}$$'
  },
  {
    id: 'alg-cx-037', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$(1+i)z^2-(2-i)z+1-2i = 0$$',
    solution: '$\\Delta = (2-i)^2-4(1+i)(1-2i)$\n$(1+i)(1-2i) = 1-2i+i-2i^2 = 3-i$\n$\\Delta = (3-4i)-4(3-i) = 3-4i-12+4i = -9$\n$\\sqrt{\\Delta} = 3i$\n$z_1 = \\dfrac{(2-i)+3i}{2(1+i)} = \\dfrac{2+2i}{2+2i} = 1$\n$z_2 = \\dfrac{(2-i)-3i}{2(1+i)} = \\dfrac{(2-4i)(1-i)}{4} = \\dfrac{-2-6i}{4} = -\\dfrac{1}{2}-\\dfrac{3}{2}i$\n$$\\boxed{z_1 = 1, \\quad z_2 = -\\frac{1}{2}-\\frac{3}{2}i}$$'
  },
  {
    id: 'alg-cx-038', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat și fracție',
    statement: 'Determinați numărul complex $z = a+bi$, $i^2 = -1$, pentru care\n$$\\frac{5\\bar{z}}{-2+z} = 5+i$$\nunde $\\bar{z}$ este conjugatul numărului complex.',
    solution: '$5\\bar{z} = (5+i)(z-2)$\nCu $z=a+bi$, $\\bar{z}=a-bi$:\n$b+(-10b-a)i = -10-2i$\n\nRe: $b = -10$, Im: $-10(-10)-a = -2 \\Rightarrow a = 102$\n$$\\boxed{z = 102-10i}$$'
  },
  {
    id: 'alg-cx-039', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat printr-un determinant',
    statement: 'Fie numărul complex\n$$z = \\begin{vmatrix} 2+2i & 6 \\\\ 1 & 5-i \\end{vmatrix}$$\nunde $i^2 = -1$. Calculați modulul lui $z$.',
    solution: '$z = (2+2i)(5-i)-6 = 10-2i+10i-2i^2-6 = 10+8i+2-6 = 6+8i$\n$$\\boxed{|z| = \\sqrt{36+64} = \\sqrt{100} = 10}$$'
  },
  {
    id: 'alg-cx-040', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Diferența Re−Im pentru un număr complex',
    statement: 'Fie numărul complex\n$$z = (3-5i)(1+42i)-6+7i^{13}$$\nunde $i^2 = -1$. Calculați diferența dintre partea reală și partea imaginară.',
    solution: '$i^{13} = i^{4 \\cdot 3+1} = i$, deci $7i^{13} = 7i$.\n$(3-5i)(1+42i) = 3+126i-5i-210i^2 = 213+121i$\n$z = 213+121i-6+7i = 207+128i$\n$$\\boxed{\\text{Re}(z)-\\text{Im}(z) = 207-128 = 79}$$'
  },
  {
    id: 'alg-cx-041', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Raportul Re/Im pentru un determinant de ordinul 3',
    statement: 'Fie numărul complex\n$$z = \\begin{vmatrix} 1 & 2-i & 0 \\\\ 1+i & 1 & 2 \\\\ 3 & 1-i & -1 \\end{vmatrix}$$\nunde $i^2 = -1$. Aflați $\\dfrac{\\text{Re}\\,z}{\\text{Im}\\,z}$.',
    solution: 'Dezvoltăm după coloana a 3-a:\n$C_{23} = -|1, 2-i; 3, 1-i| = -(1-i-3(2-i)) = -(-5+2i) = 5-2i$\n$C_{33} = |1, 2-i; 1+i, 1| = 1-(2-i)(1+i) = 1-(3+i) = -2-i$\n$z = 2(5-2i)+(-1)(-2-i) = 10-4i+2+i = 12-3i$\n$$\\boxed{\\frac{\\text{Re}\\,z}{\\text{Im}\\,z} = \\frac{12}{-3} = -4}$$'
  },
  {
    id: 'alg-cx-042', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu conjugat',
    statement: 'Determinați numărul complex $z = a+bi$, $i^2 = -1$, pentru care\n$$\\frac{\\bar{z}}{2+z} = 1+2i$$\nunde $\\bar{z}$ este conjugatul numărului complex.',
    solution: '$\\bar{z} = (1+2i)(2+z)$\n$a-bi = (1+2i)(2+a+bi)$\n$= (2+a-2b)+(b+4+2a)i$\n\nRe: $a = 2+a-2b \\Rightarrow b = 1$\nIm: $-b = b+4+2a \\Rightarrow 2a = -6 \\Rightarrow a = -3$\n$$\\boxed{z = -3+i}$$'
  },
  {
    id: 'alg-cx-043', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Raportul Im/Re al unui număr complex',
    statement: 'Fie numărul complex\n$$z = (3+2i)(6-i)-6+2i^7$$\nunde $i^2 = -1$. Calculați $\\dfrac{\\text{Im}\\,z}{\\text{Re}\\,z}$.',
    solution: '$i^7 = i^{4+3} = i^3 = -i$, deci $2i^7 = -2i$.\n$(3+2i)(6-i) = 18-3i+12i-2i^2 = 20+9i$\n$z = 20+9i-6-2i = 14+7i$\n$$\\boxed{\\frac{\\text{Im}\\,z}{\\text{Re}\\,z} = \\frac{7}{14} = \\frac{1}{2}}$$'
  },
  {
    id: 'alg-cx-044', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$4iz^2-(4+2i)z+1-i = 0$$',
    solution: '$\\Delta = (4+2i)^2-4\\cdot 4i\\cdot(1-i) = (12+16i)-(16i-16i^2) = 12+16i-16i-16 = -4$\n$\\sqrt{\\Delta} = 2i$\n$z_1 = \\dfrac{(4+2i)+2i}{8i} = \\dfrac{4+4i}{8i} = \\dfrac{(4+4i)(-i)}{8} = \\dfrac{4-4i}{8} = \\dfrac{1}{2}-\\dfrac{i}{2}$\n$z_2 = \\dfrac{4}{8i} = \\dfrac{1}{2i} = -\\dfrac{i}{2}$\n$$\\boxed{z_1 = \\frac{1}{2}-\\frac{i}{2}, \\quad z_2 = -\\frac{i}{2}}$$'
  },
  {
    id: 'alg-cx-045', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex',
    statement: 'Fie numărul complex\n$$z = (2i-5)(1+4i)+1-13i^7$$\nunde $i^2 = -1$. Calculați modulul numărului complex $z$.',
    solution: '$i^7 = -i$, deci $-13i^7 = 13i$.\n$(2i-5)(1+4i) = 2i+8i^2-5-20i = -13-18i$\n$z = -13-18i+1+13i = -12-5i$\n$$\\boxed{|z| = \\sqrt{144+25} = \\sqrt{169} = 13}$$'
  },
  {
    id: 'alg-cx-046', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Inversul unui număr complex',
    statement: 'Fie numărul complex\n$$z = 1+2i$$\nunde $i^2 = -1$. Calculați inversul numărului complex $z$.',
    solution: '$z^{-1} = \\dfrac{\\bar{z}}{|z|^2} = \\dfrac{1-2i}{1^2+2^2} = \\dfrac{1-2i}{5}$\n$$\\boxed{z^{-1} = \\frac{1}{5}-\\frac{2}{5}i}$$'
  },
  {
    id: 'alg-cx-047', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinantul unei matrice cu puteri ale lui i',
    statement: 'Calculați determinantul matricei\n$$A = \\begin{pmatrix} 1+i & i^5 \\\\ 2 & 1-2i \\end{pmatrix}$$\nunde $i^2 = -1$.',
    solution: '$i^5 = i^4 \\cdot i = i$\n$\\det A = (1+i)(1-2i) - i \\cdot 2 = 1-2i+i-2i^2-2i = 1-3i+2 = 3-3i$\n$$\\boxed{\\det A = 3-3i}$$'
  },
  {
    id: 'alg-cx-048', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat ca produs minus putere de i',
    statement: 'Determinați modulul numărului complex\n$$z = (2-i)(2+i)-12i^3$$\nunde $i^2 = -1$.',
    solution: '$(2-i)(2+i) = 4-i^2 = 4+1 = 5$\n$i^3 = -i$, deci $12i^3 = -12i$\n$z = 5-(-12i) = 5+12i$\n$$\\boxed{|z| = \\sqrt{25+144} = \\sqrt{169} = 13}$$'
  },
  {
    id: 'alg-cx-049', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui cât cu produs la numitor',
    statement: 'Aflați modulul numărului complex\n$$z = \\frac{5+i}{(1+i)(2-3i)}$$',
    solution: 'Folosim proprietatea $|z| = \\dfrac{|5+i|}{|1+i| \\cdot |2-3i|}$:\n$$|5+i| = \\sqrt{26}, \\quad |1+i| = \\sqrt{2}, \\quad |2-3i| = \\sqrt{13}$$\n$$|z| = \\frac{\\sqrt{26}}{\\sqrt{2} \\cdot \\sqrt{13}} = \\frac{\\sqrt{26}}{\\sqrt{26}}$$\n$$\\boxed{|z| = 1}$$'
  },
  {
    id: 'alg-cx-050', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară în mulțimea numerelor complexe',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(4-3i) \\cdot z = 2+i$$',
    solution: '$$z = \\frac{2+i}{4-3i} = \\frac{(2+i)(4+3i)}{16+9} = \\frac{8+6i+4i+3i^2}{25} = \\frac{5+10i}{25}$$\n$$\\boxed{z = \\frac{1}{5}+\\frac{2}{5}i}$$'
  },
  {
    id: 'alg-cx-051', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație cu conjugat în mulțimea numerelor complexe',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$z + 2 \\cdot \\bar{z} = 3-2i$$\nunde $\\bar{z}$ reprezintă conjugatul numărului complex $z$.',
    solution: 'Fie $z = a+bi$, $\\bar{z} = a-bi$.\n$(a+bi)+2(a-bi) = 3-2i$\n$3a+(-b)i = 3-2i$\nRe: $a = 1$, Im: $b = 2$\n$$\\boxed{z = 1+2i}$$'
  },
  {
    id: 'alg-cx-052', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 în mulțimea numerelor complexe',
    statement: 'Să se rezolve în $\\mathbb{C}$ ecuația\n$$z^2 - 2(1-i)z + 1-2i = 0$$',
    solution: '$\\Delta = 4(1-i)^2 - 4(1-2i) = 4(1-2i-1) - 4+8i = -8i-4+8i = -4$\n$\\sqrt{\\Delta} = 2i$\n$$z_{1,2} = \\frac{2(1-i) \\pm 2i}{2} = (1-i) \\pm i$$\n$$z_1 = 1-i+i = 1, \\qquad z_2 = 1-i-i = 1-2i$$\n$$\\boxed{z_1 = 1, \\quad z_2 = 1-2i}$$'
  },
  {
    id: 'alg-cx-053', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Produsul Re·Im al unui număr complex dat ca fracție',
    statement: 'Să se afle produsul dintre partea reală și partea imaginară a numărului complex\n$$z = \\frac{2-3i}{4+2i} \\cdot (4-i)$$',
    solution: '$(2-3i)(4-i) = 8-2i-12i+3i^2 = 5-14i$\n$$z = \\frac{5-14i}{4+2i} = \\frac{(5-14i)(4-2i)}{20} = \\frac{20-66i-28}{20} = -\\frac{2}{5}-\\frac{33}{10}i$$\n$\\text{Re}(z) = -\\dfrac{2}{5}$, $\\text{Im}(z) = -\\dfrac{33}{10}$\n$$\\boxed{\\text{Re}(z) \\cdot \\text{Im}(z) = \\frac{33}{25}}$$'
  },
  {
    id: 'alg-cx-054', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din condiția |z| − z = 1+4i',
    statement: 'Să se afle numărul complex $z = x+yi$, dacă\n$$|z|-z = 1+4i$$\nunde $x, y \\in \\mathbb{R}$.',
    solution: '$|z| - (x+yi) = 1+4i$\n$(\\sqrt{x^2+y^2}-x)-yi = 1+4i$\n\nIm: $-y = 4 \\Rightarrow y = -4$\nRe: $\\sqrt{x^2+16} = x+1 \\Rightarrow x^2+16 = x^2+2x+1 \\Rightarrow x = \\dfrac{15}{2}$\n$$\\boxed{z = \\frac{15}{2}-4i}$$'
  },
  {
    id: 'alg-cx-055', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Formă algebrică a unui număr complex cu funcții trigonometrice',
    statement: 'Să se scrie în formă algebrică numărul complex\n$$z = \\frac{\\sin x + i\\cos x}{\\sin x - i\\cos x} + \\frac{-\\sin x + i\\cos x}{\\sin x + i\\cos x}$$\n$x \\in \\mathbb{R}$.',
    solution: 'Prima fracție — amplificăm cu $\\sin x+i\\cos x$ (conjugatul numitorului):\n$$\\frac{(\\sin x+i\\cos x)^2}{\\sin^2x+\\cos^2x} = \\sin^2x-\\cos^2x+2i\\sin x\\cos x = -\\cos 2x+i\\sin 2x$$\nA doua fracție — amplificăm cu $\\sin x-i\\cos x$:\n$$\\frac{(-\\sin x+i\\cos x)(\\sin x-i\\cos x)}{1} = \\cos^2x-\\sin^2x+2i\\sin x\\cos x = \\cos 2x+i\\sin 2x$$\n$z = (-\\cos 2x+\\cos 2x)+i(\\sin 2x+\\sin 2x)$\n$$\\boxed{z = 2i\\sin 2x}$$'
  },
  {
    id: 'alg-cx-056', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex cu radicali imbricați',
    statement: 'Să se determine modulul numărului complex\n$$z = \\sqrt{2+\\sqrt{2+\\sqrt{3}}} - \\sqrt{2-\\sqrt{2+\\sqrt{3}}} \\cdot i$$',
    solution: '$$|z|^2 = \\left(\\sqrt{2+\\sqrt{2+\\sqrt{3}}}\\right)^2 + \\left(\\sqrt{2-\\sqrt{2+\\sqrt{3}}}\\right)^2$$\n$$= (2+\\sqrt{2+\\sqrt{3}})+(2-\\sqrt{2+\\sqrt{3}}) = 4$$\n$$\\boxed{|z| = \\sqrt{4} = 2}$$'
  },
  {
    id: 'alg-cx-057', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din condiția 2z = |z| + 2i',
    statement: 'Să se determine numărul complex $z = x+yi$, dacă\n$$2z = |z|+2i$$',
    solution: '$2(x+yi) = \\sqrt{x^2+y^2}+2i$\nIm: $2y = 2 \\Rightarrow y = 1$\nRe: $2x = \\sqrt{x^2+1} \\Rightarrow 4x^2 = x^2+1 \\Rightarrow 3x^2 = 1 \\Rightarrow x = \\dfrac{\\sqrt{3}}{3}$ (luând $x > 0$)\n$$\\boxed{z = \\frac{\\sqrt{3}}{3}+i}$$'
  },
  {
    id: 'alg-cx-058', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui cât de numere complexe',
    statement: 'Aflați modulul numărului complex\n$$z = \\frac{5+8i}{8-5i}$$',
    solution: '$|5+8i| = \\sqrt{25+64} = \\sqrt{89}$\n$|8-5i| = \\sqrt{64+25} = \\sqrt{89}$\n$$\\boxed{|z| = \\frac{\\sqrt{89}}{\\sqrt{89}} = 1}$$'
  },

  {
    id: 'alg-cx-059', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Suma dintre partea reală și imaginară',
    statement: 'Fie numărul complex\n$$z = (3-i)^2 + 2i^5 - 4$$\nDeterminați suma dintre partea reală și partea imaginară a numărului $z$.',
    solution: '$(3-i)^2 = 9-6i+i^2 = 9-6i-1 = 8-6i$\n$i^5 = i^{4+1} = i$, deci $2i^5 = 2i$\n$$z = (8-6i)+2i-4 = 4-4i$$\n$\\text{Re}(z) = 4$, $\\text{Im}(z) = -4$\n$$\\boxed{\\text{Re}(z)+\\text{Im}(z) = 4+(-4) = 0}$$'
  },

  {
    id: 'alg-cx-060', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Formă algebrică pentru expresie cu conjugat',
    statement: 'Fie numărul complex\n$$z = \\frac{2-i}{4+3i}$$\nSă se scrie în formă algebrică numărul $w = 5z + 10\\bar{z}$.',
    solution: '$$z = \\frac{(2-i)(4-3i)}{16+9} = \\frac{8-6i-4i+3i^2}{25} = \\frac{5-10i}{25} = \\frac{1}{5}-\\frac{2}{5}i$$\n$\\bar{z} = \\dfrac{1}{5}+\\dfrac{2}{5}i$\n$$w = 5\\!\\left(\\frac{1}{5}-\\frac{2}{5}i\\right)+10\\!\\left(\\frac{1}{5}+\\frac{2}{5}i\\right) = (1-2i)+(2+4i)$$\n$$\\boxed{w = 3+2i}$$'
  },

  {
    id: 'alg-cx-061', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(3+2i)z = 5+i$$',
    solution: '$$z = \\frac{5+i}{3+2i} = \\frac{(5+i)(3-2i)}{9+4} = \\frac{15-10i+3i-2i^2}{13} = \\frac{17-7i}{13}$$\n$$\\boxed{z = \\frac{17}{13}-\\frac{7}{13}i}$$'
  },

  {
    id: 'alg-cx-062', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex definit ca determinant',
    statement: 'Să se afle modulul numărului complex\n$$z = \\begin{vmatrix} 3+i & 1-i \\\\ 2+i & 3-i \\end{vmatrix}$$',
    solution: '$$z = (3+i)(3-i)-(1-i)(2+i)$$\n$(3+i)(3-i) = 9-i^2 = 9+1 = 10$\n$(1-i)(2+i) = 2+i-2i-i^2 = 2-i+1 = 3-i$\n$$z = 10-(3-i) = 7+i$$\n$$\\boxed{|z| = \\sqrt{49+1} = \\sqrt{50} = 5\\sqrt{2}}$$'
  },

  {
    id: 'alg-cx-063', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație bicuadrată în ℂ prin substituție',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$(z^2-3z)^2 + 3(z^2-3z) - 28 = 0$$',
    solution: 'Notăm $t = z^2-3z$:\n$$t^2+3t-28 = 0 \\Rightarrow (t+7)(t-4) = 0$$\n$t_1 = -7$ sau $t_2 = 4$\n\n**Cazul $t = -7$:** $z^2-3z+7 = 0$\n$\\Delta = 9-28 = -19$\n$$z = \\frac{3 \\pm i\\sqrt{19}}{2}$$\n\n**Cazul $t = 4$:** $z^2-3z-4 = 0$\n$\\Delta = 9+16 = 25$\n$$z = \\frac{3 \\pm 5}{2} \\Rightarrow z = 4 \\text{ sau } z = -1$$\n$$\\boxed{z_1 = -1,\\ z_2 = 4,\\ z_{3,4} = \\frac{3 \\pm i\\sqrt{19}}{2}}$$'
  },

  {
    id: 'alg-cx-064', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unei combinații de numere complexe',
    statement: 'Fie numerele complexe $z_1 = 2+i$ și $z_2 = 1+2i$. Să se afle conjugatul numărului complex\n$$z = z_1 + z_2 + z_1 \\cdot z_2$$',
    solution: '$z_1+z_2 = (2+i)+(1+2i) = 3+3i$\n$z_1 \\cdot z_2 = (2+i)(1+2i) = 2+4i+i+2i^2 = 2+5i-2 = 5i$\n$$z = 3+3i+5i = 3+8i$$\n$$\\boxed{\\bar{z} = 3-8i}$$'
  },

  {
    id: 'alg-cx-065', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Numere reale din egalitate de numere complexe',
    statement: 'Aflați numerele reale $x$ și $y$ din egalitatea\n$$2+5ix-3iy = 14i+3x-5y$$',
    solution: 'Identificăm partea reală și imaginară:\nRe: $2 = 3x-5y$\nIm: $5x-3y = 14$\n\nSistem:\n$3x-5y = 2$ — $(1)$\n$5x-3y = 14$ — $(2)$\n\n$(1)\\times 3$: $9x-15y = 6$\n$(2)\\times 5$: $25x-15y = 70$\nScădem: $16x = 64 \\Rightarrow x = 4$\nDin $(1)$: $12-5y = 2 \\Rightarrow y = 2$\n$$\\boxed{x = 4,\\ y = 2}$$'
  },

  {
    id: 'alg-cx-066', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație liniară în z și conjugatul său',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$(2+i)z-(3+6i)\\bar{z} = 5+2i$$',
    solution: 'Fie $z = a+bi$, $\\bar{z} = a-bi$:\n$(2+i)(a+bi)-(3+6i)(a-bi) = 5+2i$\n$(2a-b)+(a+2b)i - [(3a+6b)+(6a-3b)i] = 5+2i$\n$(-a-7b)+(-5a+5b)i = 5+2i$\n\nSistem:\n$-a-7b = 5$ — $(1)$\n$-5a+5b = 2$ — $(2)$\n\nDin $(2)$: $a = b-\\dfrac{2}{5}$\nÎn $(1)$: $-8b = 5-\\dfrac{2}{5} = \\dfrac{23}{5} \\Rightarrow b = -\\dfrac{23}{40}$\n$a = -\\dfrac{23}{40}-\\dfrac{16}{40} = -\\dfrac{39}{40}$\n$$\\boxed{z = -\\frac{39}{40}-\\frac{23}{40}i}$$'
  },

  {
    id: 'alg-cx-067', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$(3-2i)z = 3+i$$',
    solution: '$$z = \\frac{3+i}{3-2i} = \\frac{(3+i)(3+2i)}{9+4} = \\frac{9+6i+3i+2i^2}{13} = \\frac{7+9i}{13}$$\n$$\\boxed{z = \\frac{7}{13}+\\frac{9}{13}i}$$'
  },

  {
    id: 'alg-cx-068', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Demonstrație că un număr complex este real',
    statement: 'Arătați că numărul\n$$z = \\frac{1}{1+2i}+\\frac{1}{1-2i}$$\neste real.',
    solution: '$$\\frac{1}{1+2i} = \\frac{1-2i}{1+4} = \\frac{1-2i}{5}$$\n$$\\frac{1}{1-2i} = \\frac{1+2i}{1+4} = \\frac{1+2i}{5}$$\n$$z = \\frac{1-2i}{5}+\\frac{1+2i}{5} = \\frac{2}{5}$$\n$\\text{Im}(z) = 0$, deci $z = \\dfrac{2}{5} \\in \\mathbb{R}$ $\\square$'
  },

  {
    id: 'alg-cx-069', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui număr complex dat printr-o expresie',
    statement: 'Aflați conjugatul numărului complex\n$$z = (2+3i)(1-i)+i+3i^2$$',
    solution: '$(2+3i)(1-i) = 2-2i+3i-3i^2 = 2+i+3 = 5+i$\n$3i^2 = -3$\n$$z = (5+i)+i+(-3) = 2+2i$$\n$$\\boxed{\\bar{z} = 2-2i}$$'
  },

  {
    id: 'alg-cx-070', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Formă algebrică a unui raport de puteri ale lui i',
    statement: 'Determinați numerele reale $a$ și $b$, astfel încât\n$$\\frac{2i-i^2}{3i+i^2} = a+bi$$',
    solution: '$i^2 = -1$:\n$$\\frac{2i-(-1)}{3i+(-1)} = \\frac{1+2i}{-1+3i}$$\nAmplificăm cu conjugatul numitorului $(-1-3i)$:\n$$= \\frac{(1+2i)(-1-3i)}{(-1)^2+3^2} = \\frac{-1-3i-2i-6i^2}{10} = \\frac{5-5i}{10} = \\frac{1}{2}-\\frac{1}{2}i$$\n$$\\boxed{a = \\frac{1}{2},\\ b = -\\frac{1}{2}}$$'
  },

  {
    id: 'alg-cx-071', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Numere reale din egalitate de numere complexe',
    statement: 'Să se afle numerele reale $x$ și $y$ din egalitatea\n$$3xi-(10x+2yi) = -5y+3i$$',
    solution: 'Scriem membrul stâng:\n$3xi-10x-2yi = -10x+(3x-2y)i$\n\nEgalitate: $-10x+(3x-2y)i = -5y+3i$\n\nRe: $-10x = -5y \\Rightarrow y = 2x$\nIm: $3x-2y = 3$\n\nSubstituim $y = 2x$: $3x-4x = 3 \\Rightarrow x = -3$\n$y = 2(-3) = -6$\n$$\\boxed{x = -3,\\ y = -6}$$'
  },

  {
    id: 'alg-cx-072', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(2-3i) \\cdot z = -1-5i$$',
    solution: '$$z = \\frac{-1-5i}{2-3i} = \\frac{(-1-5i)(2+3i)}{4+9} = \\frac{-2-3i-10i-15i^2}{13} = \\frac{13-13i}{13}$$\n$$\\boxed{z = 1-i}$$'
  },

  {
    id: 'alg-cx-073', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu modulul numărului complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$z^2 + |z| = 0$$',
    solution: 'Fie $z = a+bi$. $z^2 = a^2-b^2+2abi$, $|z| = \\sqrt{a^2+b^2} \\geq 0$.\n$z^2+|z| = 0$ impune $\\text{Im}(z^2) = 0$, deci $2ab = 0$.\n\n**Cazul $b = 0$:** $z = a \\in \\mathbb{R}$, $z^2+|a| = 0 \\Rightarrow a^2+|a| = 0$\nDeoarece $a^2 \\geq 0$ și $|a| \\geq 0$: $a = 0 \\Rightarrow z = 0$\n\n**Cazul $a = 0$:** $z = bi$, $z^2 = -b^2$, $|z| = |b|$\n$-b^2+|b| = 0 \\Rightarrow |b|(|b|-1) = 0$\n$|b| = 0 \\Rightarrow z = 0$, sau $|b| = 1 \\Rightarrow z = \\pm i$\n\nVerificare: $i^2+|i| = -1+1 = 0$ ✓\n$$\\boxed{z_1 = 0,\\ z_2 = i,\\ z_3 = -i}$$'
  },

  {
    id: 'alg-cx-074', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui produs de numere complexe',
    statement: 'Să se afle conjugatul numărului complex\n$$z = (1+i)(2+3i)$$',
    solution: '$(1+i)(2+3i) = 2+3i+2i+3i^2 = 2+5i-3 = -1+5i$\n$$\\boxed{\\bar{z} = -1-5i}$$'
  },

  {
    id: 'alg-cx-075', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex în formă trigonometrică',
    statement: 'Aflați modulul numărului complex\n$$z = \\cos\\frac{\\pi}{4} - i\\sin\\frac{\\pi}{4}$$',
    solution: '$|z|^2 = \\cos^2\\dfrac{\\pi}{4}+\\sin^2\\dfrac{\\pi}{4} = 1$\n(Identitate trigonometrică fundamentală)\n$$\\boxed{|z| = 1}$$'
  },

  {
    id: 'alg-cx-076', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Egalitatea a două numere complexe',
    statement: 'Determinați pentru care valori reale ale lui $m$ numerele complexe\n$$z_1 = (m^2-7)+2i \\quad \\text{și} \\quad z_2 = 2+(m-1)i$$\nsunt egale.',
    solution: '$z_1 = z_2$ dacă și numai dacă $\\text{Re}(z_1) = \\text{Re}(z_2)$ și $\\text{Im}(z_1) = \\text{Im}(z_2)$:\n$$m^2-7 = 2 \\Rightarrow m^2 = 9 \\Rightarrow m = \\pm 3$$\n$$2 = m-1 \\Rightarrow m = 3$$\nAmbele condiții sunt satisfăcute pentru $m = 3$: $9-7 = 2$ ✓\n$$\\boxed{m = 3}$$'
  },

  {
    id: 'alg-cx-077', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$z^2-(2-i)z+3-i = 0$$',
    solution: '$\\Delta = (2-i)^2-4(3-i) = (4-4i-1)-12+4i = -9$\n$\\sqrt{\\Delta} = 3i$\n$$z_{1,2} = \\frac{(2-i)\\pm 3i}{2}$$\n$$z_1 = \\frac{2-i+3i}{2} = \\frac{2+2i}{2} = 1+i$$\n$$z_2 = \\frac{2-i-3i}{2} = \\frac{2-4i}{2} = 1-2i$$\n$$\\boxed{z_1 = 1+i,\\quad z_2 = 1-2i}$$'
  },

  {
    id: 'alg-cx-078', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Suma modulelor soluțiilor unei ecuații de gradul 2',
    statement: 'Fie $z_1$ și $z_2$ soluțiile complexe ale ecuației\n$$z^2+2\\sqrt{3}\\,z+4 = 0$$\nCalculați $|z_1|+|z_2|$.',
    solution: '$\\Delta = 12-16 = -4 < 0$, deci $z_1, z_2 \\in \\mathbb{C} \\setminus \\mathbb{R}$.\nPrin Viète: $z_1 z_2 = 4$, deci $|z_1||z_2| = 4$.\nDeoarece coeficienții sunt reali, $z_2 = \\bar{z_1}$, deci $|z_1| = |z_2|$.\n$|z_1|^2 = 4 \\Rightarrow |z_1| = 2$\n$$\\boxed{|z_1|+|z_2| = 4}$$'
  },

  {
    id: 'alg-cx-079', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unei combinații liniare de numere complexe',
    statement: 'Fie numerele complexe $z_1 = 2+i$ și $z_2 = 1+2i$. Calculați modulul numărului complex\n$$z = 3z_1-2z_2$$',
    solution: '$z = 3(2+i)-2(1+2i) = 6+3i-2-4i = 4-i$\n$$\\boxed{|z| = \\sqrt{16+1} = \\sqrt{17}}$$'
  },

  {
    id: 'alg-cx-080', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(1+i)z = 1-i$$',
    solution: '$$z = \\frac{1-i}{1+i} = \\frac{(1-i)^2}{(1+i)(1-i)} = \\frac{1-2i+i^2}{2} = \\frac{-2i}{2}$$\n$$\\boxed{z = -i}$$'
  },

  {
    id: 'alg-cx-081', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Numere reale din egalitate de numere complexe',
    statement: 'Determinați numerele reale $x$ și $y$, știind că\n$$(2x+yi)-(y+3xi) = 3-5i$$',
    solution: '$(2x-y)+(y-3x)i = 3-5i$\n\nRe: $2x-y = 3$\nIm: $y-3x = -5 \\Rightarrow 3x-y = 5$\n\nScădem: $(3x-y)-(2x-y) = 5-3 \\Rightarrow x = 2$\n$y = 2(2)-3 = 1$\n$$\\boxed{x = 2,\\ y = 1}$$'
  },

  {
    id: 'alg-cx-082', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu modulul numărului complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$|z|-2iz = 1-2i$$',
    solution: 'Fie $z = a+bi$. Separăm Re și Im:\n$|z|-2i(a+bi) = 1-2i$\n$(|z|+2b)+(-2a)i = 1-2i$\n\nIm: $-2a = -2 \\Rightarrow a = 1$\nRe: $\\sqrt{1+b^2}+2b = 1 \\Rightarrow \\sqrt{1+b^2} = 1-2b$ (necesită $b \\leq \\frac{1}{2}$)\n\nRidicăm la pătrat: $1+b^2 = 1-4b+4b^2 \\Rightarrow 3b^2-4b = 0 \\Rightarrow b(3b-4) = 0$\n$b = 0$ (valid) sau $b = \\frac{4}{3} > \\frac{1}{2}$ (invalid)\n$$\\boxed{z = 1}$$'
  },

  {
    id: 'alg-cx-083', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu conjugatul numărului complex',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$\\bar{z}-2z = i(2i+9)$$',
    solution: '$i(2i+9) = 2i^2+9i = -2+9i$\nFie $z = a+bi$:\n$(a-bi)-2(a+bi) = -2+9i$\n$-a-3bi = -2+9i$\n\nRe: $-a = -2 \\Rightarrow a = 2$\nIm: $-3b = 9 \\Rightarrow b = -3$\n$$\\boxed{z = 2-3i}$$'
  },

  {
    id: 'alg-cx-084', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat printr-o expresie',
    statement: 'Fie numărul complex\n$$z = (-2+3i)(1-4i)-5+i$$\nSă se determine $|z|$.',
    solution: '$(-2+3i)(1-4i) = -2+8i+3i-12i^2 = -2+11i+12 = 10+11i$\n$$z = (10+11i)-5+i = 5+12i$$\n$$\\boxed{|z| = \\sqrt{25+144} = \\sqrt{169} = 13}$$'
  },

  {
    id: 'alg-cx-085', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Numere complexe cu pătrat dat',
    statement: 'Determinați numerele complexe $z$ care verifică egalitatea\n$$z^2 = -5+12i$$',
    solution: 'Fie $z = a+bi$: $a^2-b^2 = -5$ și $2ab = 12 \\Rightarrow b = 6/a$\n$$a^2-\\frac{36}{a^2} = -5 \\Rightarrow a^4+5a^2-36 = 0 \\Rightarrow (a^2-4)(a^2+9) = 0$$\n$a^2 = 4 \\Rightarrow a = \\pm 2$\nDacă $a = 2$: $b = 3$; dacă $a = -2$: $b = -3$\n$$\\boxed{z_1 = 2+3i,\\quad z_2 = -2-3i}$$'
  },

  {
    id: 'alg-cx-086', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui cât de produse de numere complexe',
    statement: 'Să se afle modulul numărului complex\n$$z = \\frac{(1+2i)(2+i)}{1+i}$$',
    solution: 'Folosim $|z| = \\dfrac{|1+2i| \\cdot |2+i|}{|1+i|}$:\n$$|1+2i| = \\sqrt{5},\\quad |2+i| = \\sqrt{5},\\quad |1+i| = \\sqrt{2}$$\n$$|z| = \\frac{\\sqrt{5}\\cdot\\sqrt{5}}{\\sqrt{2}} = \\frac{5}{\\sqrt{2}}$$\n$$\\boxed{|z| = \\frac{5\\sqrt{2}}{2}}$$'
  },

  {
    id: 'alg-cx-087', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Numere reale din egalitate de numere complexe',
    statement: 'Determinați numerele reale $x$ și $y$ din relația\n$$(4-i)x+(2+5i)y = 8+5i$$',
    solution: '$(4x+2y)+(-x+5y)i = 8+5i$\n\nSistem:\n$4x+2y = 8$ — $(1)$\n$-x+5y = 5$ — $(2)$\n\n$5\\times(1)$: $20x+10y = 40$\n$2\\times(2)$: $-2x+10y = 10$\nScădem: $22x = 30 \\Rightarrow x = \\dfrac{15}{11}$\n$y = 4-2\\cdot\\dfrac{15}{11} = \\dfrac{14}{11}$\n$$\\boxed{x = \\frac{15}{11},\\ y = \\frac{14}{11}}$$'
  },

  {
    id: 'alg-cx-088', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui număr complex definit printr-o relație',
    statement: 'Determinați conjugatul numărului complex $z$, pentru care\n$$\\frac{z}{1+i} = 2-i^3$$',
    solution: '$i^3 = -i$, deci $2-i^3 = 2+i$\n$$z = (1+i)(2+i) = 2+i+2i+i^2 = 2+3i-1 = 1+3i$$\n$$\\boxed{\\bar{z} = 1-3i}$$'
  },

  {
    id: 'alg-cx-089', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex cu pătrat dat și condiție pe partea reală',
    statement: 'Determinați numerele complexe $z$ pentru care se verifică condițiile\n$$z^2 = -5+12i \\quad \\text{și} \\quad \\text{Re}\\,z < 0$$',
    solution: 'Din $z^2 = -5+12i$ (calculat similar cu alg-cx-085):\n$z_1 = 2+3i$ (Re $= 2 > 0$) sau $z_2 = -2-3i$ (Re $= -2 < 0$)\n\nCondiția Re $z < 0$ selectează:\n$$\\boxed{z = -2-3i}$$'
  },

  {
    id: 'alg-cx-090', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Suma dintre partea reală și imaginară',
    statement: 'Fie\n$$z = 4i^3+(3+i)^2-5$$\nDeterminați suma dintre partea reală și partea imaginară a numărului complex $z$.',
    solution: '$4i^3 = 4 \\cdot(-i) = -4i$\n$(3+i)^2 = 9+6i+i^2 = 8+6i$\n$$z = -4i+(8+6i)-5 = 3+2i$$\n$$\\boxed{\\text{Re}(z)+\\text{Im}(z) = 3+2 = 5}$$'
  },

  {
    id: 'alg-cx-091', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 3 în ℂ',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$z^3-z^2+z-1 = 0$$',
    solution: 'Grupăm: $z^2(z-1)+(z-1) = (z-1)(z^2+1) = 0$\n$z = 1$ sau $z^2 = -1 \\Rightarrow z = \\pm i$\n$$\\boxed{z_1 = 1,\\quad z_2 = i,\\quad z_3 = -i}$$'
  },

  {
    id: 'alg-cx-092', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Parametru real din condiția de modul',
    statement: 'Determinați valorile reale ale lui $a$ pentru care numărul complex\n$$z = a+3i$$\nare modulul egal cu $5$.',
    solution: '$|z|^2 = a^2+9 = 25 \\Rightarrow a^2 = 16$\n$$\\boxed{a = \\pm 4}$$'
  },

  {
    id: 'alg-cx-093', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$(3-i)z = 2+3i$$',
    solution: '$$z = \\frac{2+3i}{3-i} = \\frac{(2+3i)(3+i)}{9+1} = \\frac{6+2i+9i+3i^2}{10} = \\frac{3+11i}{10}$$\n$$\\boxed{z = \\frac{3}{10}+\\frac{11}{10}i}$$'
  },

  {
    id: 'alg-cx-094', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Să se rezolve în mulțimea $\\mathbb{C}$ ecuația\n$$z^2-2(1-i)z+1-2i = 0$$',
    solution: '$\\Delta = [2(1-i)]^2-4(1-2i) = 4(1-2i-1)-4+8i = -8i-4+8i = -4$\n$\\sqrt{\\Delta} = 2i$\n$$z_{1,2} = \\frac{2(1-i)\\pm 2i}{2} = (1-i)\\pm i$$\n$$z_1 = 1-i+i = 1,\\qquad z_2 = 1-i-i = 1-2i$$\n$$\\boxed{z_1 = 1,\\quad z_2 = 1-2i}$$'
  },

  {
    id: 'alg-cx-095', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Expresie cu soluțiile unei ecuații de gradul 2',
    statement: 'Fie $z_1$ și $z_2$ soluțiile complexe ale ecuației $z^2-4z+5 = 0$. Să se afle valoarea expresiei\n$$z_1^2+z_2^2$$',
    solution: 'Prin Viète: $z_1+z_2 = 4$, $z_1 z_2 = 5$\n$$z_1^2+z_2^2 = (z_1+z_2)^2-2z_1 z_2 = 16-10$$\n$$\\boxed{z_1^2+z_2^2 = 6}$$'
  },

  {
    id: 'alg-cx-096', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Expresie cu un număr complex de modul 1',
    statement: 'Se consideră numărul complex\n$$z = \\frac{-1+i\\sqrt{3}}{2}$$\nCalculați $z+\\dfrac{1}{z}$.',
    solution: '$|z|^2 = \\dfrac{1+3}{4} = 1$, deci $|z| = 1$.\nAșadar $\\dfrac{1}{z} = \\bar{z} = \\dfrac{-1-i\\sqrt{3}}{2}$\n$$z+\\frac{1}{z} = \\frac{-1+i\\sqrt{3}}{2}+\\frac{-1-i\\sqrt{3}}{2} = \\frac{-2}{2}$$\n$$\\boxed{z+\\frac{1}{z} = -1}$$'
  },

  {
    id: 'alg-cx-097', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu conjugatul numărului complex',
    statement: 'Determinați $z \\in \\mathbb{C}$, dacă\n$$2\\bar{z}+z = 3+4i$$',
    solution: 'Fie $z = a+bi$:\n$2(a-bi)+(a+bi) = 3+4i$\n$3a-bi = 3+4i$\n\nRe: $3a = 3 \\Rightarrow a = 1$\nIm: $-b = 4 \\Rightarrow b = -4$\n$$\\boxed{z = 1-4i}$$'
  },

  {
    id: 'alg-cx-098', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Coeficienți reali ai ecuației cu soluție complexă dată',
    statement: 'Determinați $a, b \\in \\mathbb{R}$, știind că $z = 3+4i$ este soluție a ecuației\n$$z^2+az+b = 0$$',
    solution: '$(3+4i)^2+a(3+4i)+b = 0$\n$(9+24i-16)+(3a+b)+(4a)i = 0$\n$(-7+3a+b)+(24+4a)i = 0$\n\nIm: $24+4a = 0 \\Rightarrow a = -6$\nRe: $-7+3(-6)+b = 0 \\Rightarrow b = 25$\n$$\\boxed{a = -6,\\quad b = 25}$$'
  },

  {
    id: 'alg-cx-099', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Condiție de realitate pentru o expresie complexă',
    statement: 'Se consideră numărul complex $z = 2+(2a-3)i$, unde $a \\in \\mathbb{R}$. Determinați $a$, astfel încât numărul $z+iz$ să fie real.',
    solution: '$iz = i[2+(2a-3)i] = 2i+(2a-3)i^2 = -(2a-3)+2i = (3-2a)+2i$\n$$z+iz = [2+(3-2a)]+[(2a-3)+2]i = (5-2a)+(2a-1)i$$\nPentru ca $z+iz \\in \\mathbb{R}$: $\\text{Im} = 0$\n$2a-1 = 0 \\Rightarrow a = \\dfrac{1}{2}$\n$$\\boxed{a = \\frac{1}{2}}$$'
  },

  {
    id: 'alg-cx-100', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Parametru pozitiv din condiția de modul',
    statement: 'Determinați numărul real pozitiv $m$, știind că modulul numărului complex\n$$z = 3+mi$$\neste egal cu $5$.',
    solution: '$|z|^2 = 9+m^2 = 25 \\Rightarrow m^2 = 16 \\Rightarrow m = \\pm 4$\nDeoarece $m > 0$:\n$$\\boxed{m = 4}$$'
  },

  {
    id: 'alg-cx-101', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Numere complexe reciproc conjugate cu expresii logaritmice',
    statement: 'Determinați valorile reale ale lui $x$ pentru care numerele complexe\n$$z_1 = \\lg(2x^2+x+1)+i\\cdot 4^x \\quad \\text{și} \\quad z_2 = \\lg(x^2+1)+i\\cdot(2^{x+1}-3)$$\nsunt reciproc conjugate.',
    solution: '$z_1$ și $z_2$ reciproc conjugate $\\Leftrightarrow z_2 = \\bar{z_1}$:\n\n**Re:** $\\lg(2x^2+x+1) = \\lg(x^2+1) \\Rightarrow 2x^2+x+1 = x^2+1$\n$x^2+x = 0 \\Rightarrow x(x+1) = 0 \\Rightarrow x = 0$ sau $x = -1$\n\n**Im:** $2^{x+1}-3 = -4^x$, fie $t = 2^x > 0$:\n$2t-3 = -t^2 \\Rightarrow t^2+2t-3 = 0 \\Rightarrow (t-1)(t+3) = 0$\n$t = 1$ (unica soluție pozitivă) $\\Rightarrow x = 0$\n\nVerificare $x = -1$: $\\text{Im}: 2^0-3 = -2 \\neq -4^{-1} = -\\dfrac{1}{4}$ ✗\n$$\\boxed{x = 0}$$'
  },

  {
    id: 'alg-cx-102', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(3+2i)z = 20-4i$$',
    solution: '$$z = \\frac{20-4i}{3+2i} = \\frac{(20-4i)(3-2i)}{9+4} = \\frac{60-40i-12i+8i^2}{13} = \\frac{52-52i}{13}$$\n$$\\boxed{z = 4-4i}$$'
  },

  {
    id: 'alg-cx-103', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinantul unei matrice cu elemente complexe',
    statement: 'Calculați determinantul matricei\n$$A = \\begin{pmatrix} 2+5i & -3 \\\\ i^5 & 2-5i \\end{pmatrix}, \\quad i^2 = -1$$',
    solution: '$i^5 = i^{4+1} = i$\n$$\\det A = (2+5i)(2-5i)-(-3)\\cdot i = (4+25)+3i$$\n$$\\boxed{\\det A = 29+3i}$$'
  },

  {
    id: 'alg-cx-104', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat printr-o expresie',
    statement: 'Determinați modulul numărului complex\n$$z = (7+3i)^2+33i^7, \\quad i^2 = -1$$',
    solution: '$(7+3i)^2 = 49+42i+9i^2 = 40+42i$\n$i^7 = i^{4+3} = i^3 = -i$, deci $33i^7 = -33i$\n$$z = 40+42i-33i = 40+9i$$\n$$\\boxed{|z| = \\sqrt{1600+81} = \\sqrt{1681} = 41}$$'
  },

  {
    id: 'alg-cx-105', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Demonstrație că o expresie complexă este număr natural',
    statement: 'Fie numerele complexe $z_1 = 1+2i$ și $z_2 = 1-i$. Arătați că numărul\n$$w = z_1^2+4z_2$$\neste un număr natural.',
    solution: '$z_1^2 = (1+2i)^2 = 1+4i+4i^2 = 1+4i-4 = -3+4i$\n$4z_2 = 4(1-i) = 4-4i$\n$$w = (-3+4i)+(4-4i) = 1$$\n$w = 1 \\in \\mathbb{N}$ $\\square$'
  },

  {
    id: 'alg-cx-106', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Număr complex din expresia conjugatului',
    statement: 'Fie $\\bar{z} = (3+5i)(3-5i)+2-7i^3$, unde $\\bar{z}$ este conjugatul numărului complex $z$. Determinați numărul complex $z$.',
    solution: '$(3+5i)(3-5i) = 9+25 = 34$\n$7i^3 = 7(-i) = -7i$, deci $-7i^3 = 7i$\n$$\\bar{z} = 34+2+7i = 36+7i$$\n$$\\boxed{z = 36-7i}$$'
  },

  {
    id: 'alg-cx-107', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$z^2-(4+3i)z+4+6i = 0$$',
    solution: '$\\Delta = (4+3i)^2-4(4+6i) = (16+24i-9)-16-24i = -9$\n$\\sqrt{\\Delta} = 3i$\n$$z_{1,2} = \\frac{(4+3i)\\pm 3i}{2}$$\n$$z_1 = \\frac{4+6i}{2} = 2+3i,\\qquad z_2 = \\frac{4+3i-3i}{2} = 2$$\n$$\\boxed{z_1 = 2+3i,\\quad z_2 = 2}$$'
  },

  {
    id: 'alg-cx-108', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(3-i)z^2-(4-i)z+2 = 0$$',
    solution: '$\\Delta = (4-i)^2-4(3-i)\\cdot 2 = (15-8i)-(24-8i) = -9$\n$\\sqrt{\\Delta} = 3i$\n$$z_{1,2} = \\frac{(4-i)\\pm 3i}{2(3-i)}$$\n$z_1 = \\dfrac{4+2i}{2(3-i)} = \\dfrac{2+i}{3-i} = \\dfrac{(2+i)(3+i)}{10} = \\dfrac{5+5i}{10}$\n$z_2 = \\dfrac{4-4i}{2(3-i)} = \\dfrac{2(1-i)}{3-i} = \\dfrac{2(1-i)(3+i)}{10} = \\dfrac{4-2i}{5}$\n$$\\boxed{z_1 = \\frac{1+i}{2},\\quad z_2 = \\frac{4-2i}{5}}$$'
  },

  {
    id: 'alg-cx-109', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară cu coeficient complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$(5-i)z = 13$$',
    solution: '$$z = \\frac{13}{5-i} = \\frac{13(5+i)}{25+1} = \\frac{13(5+i)}{26} = \\frac{5+i}{2}$$\n$$\\boxed{z = \\frac{5}{2}+\\frac{1}{2}i}$$'
  },

  {
    id: 'alg-cx-110', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex dat printr-o expresie',
    statement: 'Determinați modulul numărului complex\n$$z = (5-3i)^2-42i^3, \\quad i^2 = -1$$',
    solution: '$(5-3i)^2 = 25-30i+9i^2 = 16-30i$\n$42i^3 = 42(-i) = -42i$\n$$z = (16-30i)-(-42i) = 16+12i$$\n$$\\boxed{|z| = \\sqrt{256+144} = \\sqrt{400} = 20}$$'
  },

  {
    id: 'alg-cx-111', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui număr complex definit ca determinant',
    statement: 'Determinați conjugatul numărului complex\n$$z = \\begin{vmatrix} 3-2i & i \\\\ 5 & 3+2i \\end{vmatrix}, \\quad i^2 = -1$$',
    solution: '$z = (3-2i)(3+2i)-5i = (9+4)-5i = 13-5i$\n$$\\boxed{\\bar{z} = 13+5i}$$'
  },

  {
    id: 'alg-cx-112', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Parametru real pentru ca o expresie complexă să fie reală nenulă',
    statement: 'Fie numerele complexe $z_1 = 1-2i$ și $z_2 = 3-i$. Determinați valorile reale ale lui $a$ pentru care numărul\n$$w = a^2z_1^2+4a\\bar{z_2}$$\neste un număr real nenul, unde $\\bar{z_2}$ este conjugatul lui $z_2$.',
    solution: '$z_1^2 = (1-2i)^2 = 1-4i-4 = -3-4i$\n$\\bar{z_2} = 3+i$\n$$w = a^2(-3-4i)+4a(3+i) = (-3a^2+12a)+(-4a^2+4a)i$$\nPentru $w \\in \\mathbb{R}$: $-4a^2+4a = 0 \\Rightarrow 4a(1-a) = 0$\n$a = 0$ sau $a = 1$\n\nPentru $a = 0$: $w = 0$ (exclus)\nPentru $a = 1$: $w = -3+12 = 9 \\neq 0$ ✓\n$$\\boxed{a = 1}$$'
  },

  {
    id: 'alg-cx-113', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu determinant',
    statement: 'Determinați numerele complexe $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\begin{vmatrix} z+i & 1-2i \\\\ \\bar{z} & 5 \\end{vmatrix} = 10+20i$$',
    solution: '$5(z+i)-(1-2i)\\bar{z} = 10+20i$\nFie $z = a+bi$, $\\bar{z} = a-bi$:\n$(1-2i)(a-bi) = (a-2b)+(-b-2a)i$\n\n$(4a+2b)+(2a+6b+5)i = 10+20i$\n\nSistem: $4a+2b = 10$, $2a+6b = 15$\n$5b = 10 \\Rightarrow b = 2$, $a = \\dfrac{10-4}{2\\cdot 2} = \\dfrac{3}{2}$\n$$\\boxed{z = \\frac{3}{2}+2i}$$'
  },

  {
    id: 'alg-cx-114', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu modulul numărului complex',
    statement: 'Rezolvați în mulțimea $\\mathbb{C}$ ecuația\n$$2z+|z| = 1+2i$$',
    solution: 'Fie $z = a+bi$. Separăm Re și Im:\n$2(a+bi)+\\sqrt{a^2+b^2} = 1+2i$\n$(2a+|z|)+2bi = 1+2i$\n\nIm: $2b = 2 \\Rightarrow b = 1$\nRe: $2a+\\sqrt{a^2+1} = 1 \\Rightarrow \\sqrt{a^2+1} = 1-2a$ (necesită $a \\leq \\frac{1}{2}$)\n\n$a^2+1 = 1-4a+4a^2 \\Rightarrow 3a^2-4a = 0 \\Rightarrow a(3a-4) = 0$\n$a = 0$ (valid) sau $a = \\frac{4}{3}$ (invalid)\n$$\\boxed{z = i}$$'
  },

  {
    id: 'alg-cx-115', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Raportul dintre partea imaginară și cea reală',
    statement: 'Fie numărul complex\n$$z = \\frac{15+20i}{2+i}$$\nDeterminați numărul $w = \\dfrac{\\text{Im}\\,z}{\\text{Re}\\,z}$.',
    solution: '$$z = \\frac{(15+20i)(2-i)}{4+1} = \\frac{30-15i+40i-20i^2}{5} = \\frac{50+25i}{5} = 10+5i$$\n$\\text{Re}\\,z = 10$, $\\text{Im}\\,z = 5$\n$$\\boxed{w = \\frac{5}{10} = \\frac{1}{2}}$$'
  },

  {
    id: 'alg-cx-116', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex din ecuație cu determinant',
    statement: 'Determinați numerele complexe $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\begin{vmatrix} z+2i & 3-i \\\\ \\bar{z} & 2 \\end{vmatrix} = -6-20i$$',
    solution: '$2(z+2i)-(3-i)\\bar{z} = -6-20i$\nFie $z = a+bi$, $\\bar{z} = a-bi$:\n$(3-i)(a-bi) = (3a-b)+(-3b-a)i$\n\n$(-a+b)+(a+5b+4)i = -6-20i$\n\nSistem: $-a+b = -6$, $a+5b = -24$\n$6b = -30 \\Rightarrow b = -5$, $a = -5+(-6) \\cdot(-1)...$\n$b = -5 \\Rightarrow a = b+6 = 1$\n$$\\boxed{z = 1-5i}$$'
  },

  {
    id: 'alg-cx-117', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$z^2-z(2+5i)-5+5i = 0$$',
    solution: '$\\Delta = (2+5i)^2-4(-5+5i) = (4+20i-25)+20-20i = -1$\n$\\sqrt{\\Delta} = i$\n$$z_{1,2} = \\frac{(2+5i)\\pm i}{2}$$\n$$z_1 = \\frac{2+6i}{2} = 1+3i,\\qquad z_2 = \\frac{2+4i}{2} = 1+2i$$\n$$\\boxed{z_1 = 1+3i,\\quad z_2 = 1+2i}$$'
  },

  {
    id: 'alg-cx-118', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui cât de numere complexe',
    statement: 'Determinați modulul numărului complex\n$$z = \\frac{3+4i}{2+i}, \\quad i^2 = -1$$',
    solution: 'Folosim $|z| = \\dfrac{|3+4i|}{|2+i|}$:\n$$|3+4i| = \\sqrt{9+16} = 5,\\quad |2+i| = \\sqrt{5}$$\n$$\\boxed{|z| = \\frac{5}{\\sqrt{5}} = \\sqrt{5}}$$'
  },

  {
    id: 'alg-cx-119', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Numere reale din determinant egal cu număr complex dat',
    statement: 'Fie\n$$z = \\begin{vmatrix} 2x+yi & 3x-yi \\\\ -i^3 & 1 \\end{vmatrix}$$\nAflați numerele reale $x$ și $y$, astfel încât $z = 3-5i$, unde $i^2 = -1$.',
    solution: '$-i^3 = -(-i) = i$\n$z = (2x+yi)\\cdot 1-(3x-yi)\\cdot i = (2x+yi)-(3xi+y)$\n$= (2x-y)+(y-3x)i$\n\nRe: $2x-y = 3$\nIm: $y-3x = -5 \\Rightarrow 3x-y = 5$\n\nScădem: $x = 2$, $y = 4-3 = 1$\n$$\\boxed{x = 2,\\ y = 1}$$'
  },

  {
    id: 'alg-cx-120', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficient imaginar',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$2iz^2+(4-i)z-1-3i = 0$$',
    solution: '$\\Delta = (4-i)^2-4\\cdot 2i\\cdot(-1-3i) = (15-8i)+8i(-1)...$\n$(4-i)^2 = 15-8i$\n$4\\cdot 2i\\cdot(-1-3i) = 8i(-1-3i) = -8i-24i^2 = 24-8i$\n$\\Delta = (15-8i)-(24-8i) = -9$\n$\\sqrt{\\Delta} = 3i$\n$$z_{1,2} = \\frac{-(4-i)\\pm 3i}{4i} = \\frac{(-4+i)\\pm 3i}{4i}$$\n$z_1 = \\dfrac{-4+4i}{4i} = \\dfrac{-1+i}{i} = \\dfrac{(-1+i)(-i)}{1} = i+1 = 1+i$\n$z_2 = \\dfrac{-4-2i}{4i} = \\dfrac{(-4-2i)(-i)}{4} = \\dfrac{4i-2}{4} = -\\dfrac{1}{2}+i$\n$$\\boxed{z_1 = 1+i,\\quad z_2 = -\\frac{1}{2}+i}$$'
  },

  {
    id: 'alg-cx-121', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu conjugatul într-o fracție',
    statement: 'Determinați numărul complex $z = a+bi$, $a, b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\frac{2\\bar{z}}{z+5} = 3i$$\nunde $\\bar{z}$ este conjugatul lui $z$.',
    solution: '$2\\bar{z} = 3i(z+5)$\nFie $z = a+bi$:\n$2(a-bi) = 3i(a+5+bi)$\n$2a-2bi = 3i(a+5)+3bi^2 = -3b+3(a+5)i$\n\nRe: $2a = -3b \\Rightarrow b = -\\dfrac{2a}{3}$\nIm: $-2b = 3(a+5)$\n\nSubstituim: $-2\\left(-\\dfrac{2a}{3}\\right) = 3a+15 \\Rightarrow \\dfrac{4a}{3} = 3a+15$\n$4a = 9a+45 \\Rightarrow -5a = 45 \\Rightarrow a = -9$\n$b = -\\dfrac{2(-9)}{3} = 6$\n$$\\boxed{z = -9+6i}$$'
  },

  {
    id: 'alg-cx-122', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Partea reală a unui număr complex definit ca determinant',
    statement: 'Determinați partea reală a numărului complex\n$$z = \\begin{vmatrix} 2i & 2i-3 \\\\ 2i+3 & 5 \\end{vmatrix}, \\quad i^2 = -1$$',
    solution: '$z = 2i\\cdot 5-(2i-3)(2i+3) = 10i-(4i^2-9) = 10i+4+9 = 13+10i$\n$$\\boxed{\\text{Re}\\,z = 13}$$'
  },
  {
    id: 'alg-cx-123', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu conjugatul numărului complex',
    statement: 'Determinați numărul complex $z = a+bi$, $a,b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\frac{2\\bar{z}+4i}{z+1} = i,$$\nunde $\\bar{z}$ este conjugatul lui $z$.',
    solution: 'Fie $z = a+bi$, $\\bar{z} = a-bi$.\n$2\\bar{z}+4i = 2(a-bi)+4i = 2a+(-2b+4)i$\n$z+1 = (a+1)+bi$\nEcuația devine $2\\bar{z}+4i = i(z+1) = i[(a+1)+bi] = -b+(a+1)i$.\nEgalăm real și imaginar:\nReal: $2a = -b \\Rightarrow b = -2a$\nImag: $-2b+4 = a+1 \\Rightarrow 4a+4 = a+1 \\Rightarrow 3a = -3 \\Rightarrow a = -1$, $b = 2$\n$$\\boxed{z = -1+2i}$$'
  },
  {
    id: 'alg-cx-124', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex — expresie cu puteri de i',
    statement: 'Determinați modulul numărului complex\n$$z = (2+2i)(2-2i)+6i^3,$$\nunde $i^2 = -1$.',
    solution: '$(2+2i)(2-2i) = 4-(2i)^2 = 4-4i^2 = 4+4 = 8$\n$i^3 = -i$, deci $6i^3 = -6i$\n$z = 8-6i$\n$$|z| = \\sqrt{64+36} = \\sqrt{100} = \\boxed{10}$$'
  },
  {
    id: 'alg-cx-125', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Conjugatul unui număr complex definit printr-un determinant',
    statement: 'Determinați conjugatul numărului complex\n$$z = \\begin{vmatrix} 2-i & 2 \\\\ i & 2+i \\end{vmatrix},$$\nunde $i^2 = -1$.',
    solution: '$z = (2-i)(2+i)-2\\cdot i = (4-i^2)-2i = 5-2i$\n$$\\boxed{\\bar{z} = 5+2i}$$'
  },
  {
    id: 'alg-cx-126', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Număr complex definit printr-un determinant nul',
    statement: 'Determinați numerele complexe $z = a+bi$, $a,b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\begin{vmatrix} 2z+6i & \\bar{z} \\\\ 3+i & 1 \\end{vmatrix} = 0.$$',
    solution: '$(2z+6i)\\cdot 1 - \\bar{z}(3+i) = 0$\nFie $z = a+bi$, $\\bar{z} = a-bi$:\n$(2(a+bi)+6i) - (a-bi)(3+i) = 0$\n$(a-bi)(3+i) = 3a+ai-3bi-bi^2 = (3a+b)+(a-3b)i$\n$(2a+(2b+6)i)-((3a+b)+(a-3b)i) = 0$\nEgalăm: Real: $-a-b = 0 \\Rightarrow b = -a$\nImag: $5b+6-a = 0 \\Rightarrow -6a+6 = 0 \\Rightarrow a = 1$, $b = -1$\n$$\\boxed{z = 1-i}$$'
  },
  {
    id: 'alg-cx-127', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație liniară în ℂ',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$(2+i)z = 5.$$',
    solution: '$$z = \\frac{5}{2+i} = \\frac{5(2-i)}{(2+i)(2-i)} = \\frac{5(2-i)}{5} = 2-i$$\n$$\\boxed{z = 2-i}$$'
  },
  {
    id: 'alg-cx-128', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produsul Re·Im pentru un număr complex fracționar',
    statement: 'Determinați produsul dintre partea reală și partea imaginară a numărului complex\n$$z = \\frac{2-4i}{1+i},$$\nunde $i^2 = -1$.',
    solution: '$$z = \\frac{(2-4i)(1-i)}{(1+i)(1-i)} = \\frac{2-2i-4i+4i^2}{2} = \\frac{-2-6i}{2} = -1-3i$$\n$\\text{Re}(z) = -1$, $\\text{Im}(z) = -3$\n$$\\boxed{\\text{Re}(z)\\cdot\\text{Im}(z) = (-1)(-3) = 3}$$'
  },
  {
    id: 'alg-cx-129', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu coeficienți complecși',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$(1+i)z^2-(4+2i)z+4 = 0.$$',
    solution: '$\\Delta = (4+2i)^2-4\\cdot(1+i)\\cdot 4 = (12+16i)-(16+16i) = -4$\n$\\sqrt{\\Delta} = 2i$\n$$z_{1,2} = \\frac{(4+2i)\\pm 2i}{2(1+i)}$$\n$z_1 = \\dfrac{4+4i}{2(1+i)} = \\dfrac{4(1+i)}{2(1+i)} = 2$\n$z_2 = \\dfrac{4}{2(1+i)} = \\dfrac{2}{1+i} = \\dfrac{2(1-i)}{2} = 1-i$\n$$\\boxed{z_1 = 2, \\quad z_2 = 1-i}$$'
  },
  {
    id: 'alg-cx-130', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație de gradul 2 cu discriminant negativ real',
    statement: 'Rezolvați în $\\mathbb{C}$ ecuația\n$$z^2-(2-i)z+3-i = 0,$$\nunde $i^2 = -1$.',
    solution: '$\\Delta = (2-i)^2-4(3-i) = (3-4i)-(12-4i) = -9$\n$\\sqrt{\\Delta} = 3i$\n$$z_{1,2} = \\frac{(2-i)\\pm 3i}{2}$$\n$$z_1 = \\frac{2+2i}{2} = 1+i, \\qquad z_2 = \\frac{2-4i}{2} = 1-2i$$\n$$\\boxed{z_1 = 1+i, \\quad z_2 = 1-2i}$$'
  },
  {
    id: 'alg-cx-131', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinantul unei matrice cu intrări complexe',
    statement: 'Calculați determinantul matricei\n$$A = \\begin{pmatrix} 1+3i & -6 \\\\ i^3 & 1+3i \\end{pmatrix},$$\nunde $i^2 = -1$.',
    solution: '$i^3 = -i$\n$\\det(A) = (1+3i)^2-(-6)(-i) = (1+3i)^2-6i$\n$(1+3i)^2 = 1+6i+9i^2 = 1+6i-9 = -8+6i$\n$\\det(A) = -8+6i-6i = -8$\n$$\\boxed{\\det(A) = -8}$$'
  },
  {
    id: 'alg-cx-132', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Parametru real pentru care o expresie complexă este reală nenulă',
    statement: 'Fie expresia $E(z) = pz^2+p^2z+2-6i$. Determinați valorile reale ale lui $p$, pentru care $E(1+2i)$ este un număr real nenul.',
    solution: 'Calculăm $(1+2i)^2 = 1+4i+4i^2 = -3+4i$.\n$E(1+2i) = p(-3+4i)+p^2(1+2i)+2-6i$\n$= (-3p+p^2+2)+(4p+2p^2-6)i$\nPentru $E(1+2i)$ real: $4p+2p^2-6 = 0 \\Rightarrow p^2+2p-3 = 0 \\Rightarrow (p+3)(p-1) = 0$\n$p = 1$: parte reală $= -3+1+2 = 0$ (exclus, trebuie nenul)\n$p = -3$: parte reală $= 9+9+2 = 20 \\neq 0$ ✓\n$$\\boxed{p = -3}$$'
  },
  {
    id: 'alg-cx-133', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Numere complexe definite prin modul și relație cu conjugatul',
    statement: 'Determinați numerele complexe $z = x+iy$, $x,y \\in \\mathbb{R}$, $i^2 = -1$, care verifică condițiile:\n$$|z| = 3\\sqrt{2} \\quad \\text{și} \\quad (1+i)z+(1-i)\\bar{z} = 0,$$\nunde $\\bar{z}$ este conjugatul lui $z$.',
    solution: 'Fie $z = x+iy$, $\\bar{z} = x-iy$.\n$(1+i)(x+iy) = (x-y)+(x+y)i$\n$(1-i)(x-iy) = (x-y)-(x+y)i$\nSuma $= 2(x-y) = 0 \\Rightarrow x = y$\nDin $|z| = 3\\sqrt{2}$: $x^2+y^2 = 18 \\Rightarrow 2x^2 = 18 \\Rightarrow x = \\pm 3$\n$$\\boxed{z = 3+3i \\text{ sau } z = -3-3i}$$'
  },
  {
    id: 'alg-cx-134', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui z din conjugatul său',
    statement: 'Determinați numerele complexe $z$, dacă\n$$\\bar{z} = (1+i)(2-i)+3i^5,$$\nunde $i^2 = -1$, iar $\\bar{z}$ este conjugatul numărului $z$.',
    solution: '$(1+i)(2-i) = 2-i+2i-i^2 = 2+i+1 = 3+i$\n$i^5 = i^{4+1} = i$, deci $3i^5 = 3i$\n$\\bar{z} = 3+i+3i = 3+4i$\n$$\\boxed{z = 3-4i}$$'
  },
  {
    id: 'alg-cx-135', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produsul Re·Im pentru o expresie cu fracție complexă',
    statement: 'Determinați produsul dintre partea reală și partea imaginară a numărului complex\n$$z = \\frac{26}{3-2i}-6,$$\nunde $i^2 = -1$.',
    solution: '$$\\frac{26}{3-2i} = \\frac{26(3+2i)}{(3-2i)(3+2i)} = \\frac{26(3+2i)}{13} = 2(3+2i) = 6+4i$$\n$z = 6+4i-6 = 4i$\n$\\text{Re}(z) = 0$, $\\text{Im}(z) = 4$\n$$\\boxed{\\text{Re}(z)\\cdot\\text{Im}(z) = 0}$$'
  },
  {
    id: 'alg-cx-136', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Valoarea parametrului m din condiția că z = a+ai este soluție',
    statement: 'Determinați valorile reale ale lui $m$, pentru care numărul complex nenul\n$$z = a+ai, \\quad a \\in \\mathbb{R}, \\quad i^2 = -1,$$\neste soluție a ecuației $z^2-6z+m = 0$.',
    solution: '$z^2 = (a+ai)^2 = a^2+2a^2i+a^2i^2 = a^2+2a^2i-a^2 = 2a^2i$\nSubstituim: $2a^2i-6(a+ai)+m = 0$\n$(m-6a)+(2a^2-6a)i = 0$\nReal: $m = 6a$\nImag: $2a^2-6a = 0 \\Rightarrow 2a(a-3) = 0 \\Rightarrow a = 0$ sau $a = 3$\nDeoarece $z$ este nenul: $a \\neq 0$, deci $a = 3$\n$$\\boxed{m = 18}$$'
  },
  {
    id: 'alg-cx-137', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Modulul unui număr complex',
    statement: 'Fie numărul complex $z = (1-3i)^2+12i$, unde $i^2 = -1$. Determinați modulul numărului $z$.',
    solution: '$(1-3i)^2 = 1-6i+9i^2 = 1-6i-9 = -8-6i$\n$z = -8-6i+12i = -8+6i$\n$$|z| = \\sqrt{(-8)^2+6^2} = \\sqrt{64+36} = \\sqrt{100} = \\boxed{10}$$'
  },
  {
    id: 'alg-cx-138', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Valoarea lui a pentru care un număr complex este pur imaginar',
    statement: 'Determinați valoarea reală a lui $a$, pentru care numărul complex\n$$z = (a+i)(1-2i)-i^6, \\quad i^2 = -1,$$\neste pur imaginar.',
    solution: '$i^6 = (i^2)^3 = (-1)^3 = -1$, deci $-i^6 = 1$\n$(a+i)(1-2i) = a-2ai+i-2i^2 = (a+2)+(1-2a)i$\n$z = (a+2)+(1-2a)i+1 = (a+3)+(1-2a)i$\nPentru $z$ pur imaginar: $\\text{Re}(z) = 0$ și $\\text{Im}(z) \\neq 0$\n$a+3 = 0 \\Rightarrow a = -3$\nVerificăm: $\\text{Im}(z) = 1-2(-3) = 7 \\neq 0$ ✓\n$$\\boxed{a = -3}$$'
  },
  {
    id: 'alg-cx-139', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație complexă provenită dintr-un determinant',
    statement: 'Fie\n$$D(z) = \\begin{vmatrix} z & 3-i \\\\ -1 & iz+2+3i \\end{vmatrix},$$\nunde $i^2 = -1$. Rezolvați în $\\mathbb{C}$ ecuația $D(z) = 0$.',
    solution: '$D(z) = z(iz+2+3i)-(3-i)(-1) = iz^2+(2+3i)z+(3-i) = 0$\n$\\Delta = (2+3i)^2-4\\cdot i\\cdot(3-i)$\n$(2+3i)^2 = 4+12i+9i^2 = -5+12i$\n$4i(3-i) = 12i-4i^2 = 4+12i$\n$\\Delta = (-5+12i)-(4+12i) = -9$\n$\\sqrt{\\Delta} = 3i$\n$$z_{1,2} = \\frac{-(2+3i)\\pm 3i}{2i}$$\n$z_1 = \\dfrac{-2-3i+3i}{2i} = \\dfrac{-2}{2i} = \\dfrac{-1}{i} = \\dfrac{-i}{i^2} = i$\n$z_2 = \\dfrac{-2-6i}{2i} = \\dfrac{(-2-6i)(-i)}{2} = \\dfrac{2i+6i^2}{2} = \\dfrac{-6+2i}{2} = -3+i$\n$$\\boxed{z_1 = i, \\quad z_2 = -3+i}$$'
  },
  {
    id: 'alg-cx-140', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Partea reală a inversului unui număr complex',
    statement: 'Determinați partea reală a inversului numărului complex $z = 2+i$, unde $i^2 = -1$.',
    solution: '$$\\frac{1}{z} = \\frac{1}{2+i} = \\frac{2-i}{(2+i)(2-i)} = \\frac{2-i}{5} = \\frac{2}{5}-\\frac{1}{5}i$$\n$$\\boxed{\\text{Re}\\!\\left(\\frac{1}{z}\\right) = \\frac{2}{5}}$$'
  },
  {
    id: 'alg-cx-141', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Demonstrarea că un număr complex este pur imaginar',
    statement: 'Fie $z = \\dfrac{3-i}{1+3i}$, unde $i^2 = -1$. Arătați că $z$ este un număr complex pur imaginar.',
    solution: '$$z = \\frac{(3-i)(1-3i)}{(1+3i)(1-3i)} = \\frac{3-9i-i+3i^2}{1+9} = \\frac{-10i}{10} = -i$$\n$\\text{Re}(z) = 0$ și $\\text{Im}(z) = -1 \\neq 0$, deci $z$ este pur imaginar. $\\square$'
  },
  {
    id: 'alg-cx-142', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Număr complex definit printr-un determinant nul',
    statement: 'Determinați numerele complexe $z$, pentru care\n$$\\begin{vmatrix} 1 & i^3 \\\\ z & z-4 \\end{vmatrix} = 0,$$\nunde $i^2 = -1$.',
    solution: '$i^3 = -i$\n$(z-4)\\cdot 1 - (-i)\\cdot z = 0 \\Rightarrow z-4+iz = 0 \\Rightarrow (1+i)z = 4$\n$$z = \\frac{4}{1+i} = \\frac{4(1-i)}{(1+i)(1-i)} = \\frac{4(1-i)}{2} = 2(1-i)$$\n$$\\boxed{z = 2-2i}$$'
  },
  {
    id: 'alg-cx-143', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Forma trigonometrică și putere mare a unui număr complex',
    statement: 'Fie numărul complex $z = \\dfrac{1}{2}-\\dfrac{\\sqrt{3}}{2}\\,i$, $i^2 = -1$. Scrieți numărul $z$ sub formă trigonometrică și calculați $z^{2026}$.',
    solution: '$|z| = \\sqrt{\\dfrac{1}{4}+\\dfrac{3}{4}} = 1$\n$\\cos\\theta = \\dfrac{1}{2}$, $\\sin\\theta = -\\dfrac{\\sqrt{3}}{2} \\Rightarrow \\theta = -\\dfrac{\\pi}{3}$\n$$z = \\cos\\!\\left(-\\frac{\\pi}{3}\\right)+i\\sin\\!\\left(-\\frac{\\pi}{3}\\right)$$\nPrin formula lui De Moivre: $z^{2026} = \\cos\\!\\left(-\\dfrac{2026\\pi}{3}\\right)+i\\sin\\!\\left(-\\dfrac{2026\\pi}{3}\\right)$\n$2026 = 6\\cdot 337+4$, deci $z^{2026} = z^4$.\n$z^2 = \\cos\\!\\left(-\\dfrac{2\\pi}{3}\\right)+i\\sin\\!\\left(-\\dfrac{2\\pi}{3}\\right) = -\\dfrac{1}{2}-\\dfrac{\\sqrt{3}}{2}\\,i$\n$z^4 = (z^2)^2 = \\left(-\\dfrac{1}{2}-\\dfrac{\\sqrt{3}}{2}\\,i\\right)^2 = \\dfrac{1}{4}+\\dfrac{\\sqrt{3}}{2}\\,i-\\dfrac{3}{4} = -\\dfrac{1}{2}+\\dfrac{\\sqrt{3}}{2}\\,i$\n$$\\boxed{z^{2026} = -\\frac{1}{2}+\\frac{\\sqrt{3}}{2}\\,i}$$'
  },
  {
    id: 'alg-cx-144', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Numere complexe cu modul dat și relație liniară cu conjugatul',
    statement: 'Determinați numerele complexe $z = a+bi$, unde $i^2 = -1$, pentru care\n$$|z| = 3\\sqrt{5} \\quad \\text{și} \\quad (1-2i)z+(1+2i)\\bar{z} = 0.$$',
    solution: 'Fie $z = a+bi$, $\\bar{z} = a-bi$.\n$(1-2i)(a+bi) = (a+2b)+(b-2a)i$\n$(1+2i)(a-bi) = (a+2b)+(2a-b)i$\nSuma $= 2(a+2b) = 0 \\Rightarrow a = -2b$\nDin $|z| = 3\\sqrt{5}$: $a^2+b^2 = 45 \\Rightarrow 4b^2+b^2 = 45 \\Rightarrow b^2 = 9 \\Rightarrow b = \\pm 3$\n$b=3$: $a=-6 \\Rightarrow z = -6+3i$\n$b=-3$: $a=6 \\Rightarrow z = 6-3i$\n$$\\boxed{z \\in \\{-6+3i,\\; 6-3i\\}}$$'
  },
  {
    id: 'alg-cx-145', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu conjugatul numărului complex — formă fracționară',
    statement: 'Determinați numerele complexe $z = a+bi$, $a,b \\in \\mathbb{R}$, $i^2 = -1$, pentru care\n$$\\frac{z+6-3i}{z+\\bar{z}+i} = -2-i,$$\nunde $\\bar{z}$ este conjugatul numărului complex $z$.',
    solution: 'Fie $z = a+bi$, $\\bar{z} = a-bi$, deci $z+\\bar{z} = 2a$.\n$z+6-3i = (-2-i)(2a+i) = -4a-2i-2ai-i^2 = (1-4a)+(-2-2a)i$\n$(a+bi)+6-3i = (1-4a)+(-2-2a)i$\nEgalăm:\nReal: $a+6 = 1-4a \\Rightarrow 5a = -5 \\Rightarrow a = -1$\nImag: $b-3 = -2-2(-1) = 0 \\Rightarrow b = 3$\n$$\\boxed{z = -1+3i}$$'
  },

  /* ============================================================
     ALGEBRĂ — Ecuații Iraționale
     ============================================================ */
  {
    id: 'ira-001', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu radical și condiție de semn pe membrul drept',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{3x+18} = -x$.',
    solution: 'D.V.A.: $3x+18 \\geq 0 \\Rightarrow x \\geq -6$ și $-x \\geq 0 \\Rightarrow x \\leq 0$. Domeniu: $x \\in [-6,\\, 0]$.\n\nRidicăm la pătrat ambii membri:\n$$3x+18 = x^2 \\Rightarrow x^2-3x-18 = 0 \\Rightarrow (x-6)(x+3) = 0$$\n$x = 6$ (respins, $\\notin [-6, 0]$) sau $x = -3 \\in [-6, 0]$.\n\nVerificare $x = -3$: $\\sqrt{-9+18} = \\sqrt{9} = 3 = -(-3)$ ✓\n$$\\boxed{x = -3}$$'
  },
  {
    id: 'ira-002', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație cu radicali egali și polinom de grad 5',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{2x^5+3x-2} = \\sqrt{5x^3-2}$.',
    solution: 'Ridicăm la pătrat (ambii membri sunt $\\geq 0$, condiția de domeniu se verifică la final):\n$$2x^5+3x-2 = 5x^3-2 \\Rightarrow 2x^5-5x^3+3x = 0$$\n$$x(2x^4-5x^2+3) = 0 \\Rightarrow x(2x^2-3)(x^2-1) = 0$$\nSoluții candidate: $x=0,\\; x=\\pm 1,\\; x=\\pm\\dfrac{\\sqrt{6}}{2}$.\n\nVerificăm că radicantul $\\geq 0$ pentru fiecare:\n- $x=0$: $2(0)+3(0)-2=-2<0$ — respins\n- $x=1$: $2+3-2=3\\geq 0$ ✓\n- $x=-1$: $-2-3-2=-7<0$ — respins\n- $x=\\dfrac{\\sqrt{6}}{2}$: $5x^3-2 = \\dfrac{15\\sqrt{6}}{4}-2 > 0$ și $2x^5+3x-2 = 5x^3-2 > 0$ ✓\n- $x=-\\dfrac{\\sqrt{6}}{2}$: $2x^5+3x-2 = -\\dfrac{15\\sqrt{6}}{4}-2 < 0$ — respins\n$$\\boxed{x \\in \\left\\{1,\\;\\dfrac{\\sqrt{6}}{2}\\right\\}}$$'
  },
  {
    id: 'ira-003', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical imbriocat — două ridicări succesive la pătrat',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{2+\\sqrt{3-x}} = \\sqrt{x+1}$.',
    solution: 'D.V.A.: $x \\leq 3$ și $x \\geq -1$. Domeniu inițial: $[-1, 3]$.\n\nRidicăm la pătrat:\n$$2+\\sqrt{3-x} = x+1 \\Rightarrow \\sqrt{3-x} = x-1$$\nD.V.A. suplimentar: $x-1 \\geq 0 \\Rightarrow x \\geq 1$. Domeniu restrâns: $[1, 3]$.\n\nRidicăm din nou la pătrat:\n$$3-x = (x-1)^2 = x^2-2x+1 \\Rightarrow x^2-x-2 = 0 \\Rightarrow (x-2)(x+1) = 0$$\n$x=-1$ (respins, $\\notin [1, 3]$) sau $x=2 \\in [1, 3]$.\n\nVerificare $x=2$: $\\sqrt{2+\\sqrt{1}} = \\sqrt{3} = \\sqrt{3}$ ✓\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'ira-004', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Diferența a doi radicali egală cu 1',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{2x+3} - \\sqrt{x+1} = 1$.',
    solution: 'D.V.A.: $2x+3\\geq 0$ și $x+1\\geq 0$, deci $x \\geq -1$.\n\nIzolăm un radical: $\\sqrt{2x+3} = 1+\\sqrt{x+1}$. Ridicăm la pătrat:\n$$2x+3 = 1+2\\sqrt{x+1}+(x+1) \\Rightarrow x+1 = 2\\sqrt{x+1}$$\nNotăm $t = \\sqrt{x+1} \\geq 0$: $t^2 = 2t \\Rightarrow t(t-2) = 0$\n$$t=0 \\Rightarrow x=-1 \\qquad t=2 \\Rightarrow x=3$$\nVerificări:\n- $x=-1$: $\\sqrt{1}-\\sqrt{0}=1$ ✓\n- $x=3$: $\\sqrt{9}-\\sqrt{4}=3-2=1$ ✓\n$$\\boxed{x \\in \\{-1,\\; 3\\}}$$'
  },
  {
    id: 'ira-005', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație cu radical de ordinul 3 — ridicare la cub',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt[3]{7x+1} - x = 1$.',
    solution: 'Radicalul de ordin impar este definit pe $\\mathbb{R}$, fără restricții de domeniu.\n\nIzolăm radicalul: $\\sqrt[3]{7x+1} = x+1$. Ridicăm la cub:\n$$7x+1 = (x+1)^3 = x^3+3x^2+3x+1$$\n$$x^3+3x^2-4x = 0 \\Rightarrow x(x^2+3x-4) = 0 \\Rightarrow x(x+4)(x-1) = 0$$\nVerificări:\n- $x=0$: $\\sqrt[3]{1}-0=1$ ✓\n- $x=-4$: $\\sqrt[3]{-27}+4=-3+4=1$ ✓\n- $x=1$: $\\sqrt[3]{8}-1=2-1=1$ ✓\n$$\\boxed{x \\in \\{-4,\\; 0,\\; 1\\}}$$'
  },
  {
    id: 'ira-006', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu expresie liniară — condiție suplimentară',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația: $3 + \\sqrt{x-1} = 2x$.',
    solution: 'D.V.A.: $x \\geq 1$. Izolăm radicalul: $\\sqrt{x-1} = 2x-3$.\n\nD.V.A. suplimentar: $2x-3 \\geq 0 \\Rightarrow x \\geq \\dfrac{3}{2}$.\n\nRidicăm la pătrat:\n$$x-1 = (2x-3)^2 = 4x^2-12x+9 \\Rightarrow 4x^2-13x+10 = 0$$\n$$\\Delta = 169-160 = 9 \\Rightarrow x = \\frac{13\\pm 3}{8}$$\n$x=2$ sau $x=\\dfrac{5}{4}<\\dfrac{3}{2}$ (respins).\n\nVerificare $x=2$: $3+\\sqrt{1}=4=2\\cdot 2$ ✓\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'ira-007', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație irațională cu soluție unică — pătrat perfect',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația: $2\\sqrt{x-5} = x-4$.',
    solution: 'D.V.A.: $x \\geq 5$. Automat $x-4 \\geq 1 > 0$, deci membrul drept este pozitiv.\n\nRidicăm la pătrat:\n$$4(x-5) = (x-4)^2 \\Rightarrow 4x-20 = x^2-8x+16$$\n$$x^2-12x+36 = 0 \\Rightarrow (x-6)^2 = 0 \\Rightarrow x = 6$$\n\nVerificare $x=6$: $2\\sqrt{1}=2=6-4$ ✓\n$$\\boxed{x = 6}$$'
  },
  {
    id: 'ira-008', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu expresie liniară — o soluție extransă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația: $\\sqrt{x-1} = x-3$.',
    solution: 'D.V.A.: $x-1 \\geq 0 \\Rightarrow x \\geq 1$ și $x-3 \\geq 0 \\Rightarrow x \\geq 3$. Domeniu: $x \\geq 3$.\n\nRidicăm la pătrat:\n$$x-1 = (x-3)^2 = x^2-6x+9 \\Rightarrow x^2-7x+10 = 0 \\Rightarrow (x-2)(x-5) = 0$$\n$x=2$ (respins, $<3$) sau $x=5 \\geq 3$.\n\nVerificare $x=5$: $\\sqrt{4}=2=5-3$ ✓\n$$\\boxed{x = 5}$$'
  },
  {
    id: 'ira-009', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical cu coeficient 2 egal cu expresie liniară',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația: $2\\sqrt{x+1} = x-2$.',
    solution: 'D.V.A.: $x+1 \\geq 0 \\Rightarrow x \\geq -1$ și $x-2 \\geq 0 \\Rightarrow x \\geq 2$. Domeniu: $x \\geq 2$.\n\nRidicăm la pătrat:\n$$4(x+1) = (x-2)^2 = x^2-4x+4 \\Rightarrow x^2-8x = 0 \\Rightarrow x(x-8) = 0$$\n$x=0$ (respins, $<2$) sau $x=8 \\geq 2$.\n\nVerificare $x=8$: $2\\sqrt{9}=6=8-2$ ✓\n$$\\boxed{x = 8}$$'
  },
  {
    id: 'ira-010', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație produs cu radical — principiul zero al produsului',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $(16-x^2)\\sqrt{3-x} = 0$.',
    solution: 'D.V.A.: $3-x \\geq 0 \\Rightarrow x \\leq 3$.\n\nProdusul este nul când cel puțin un factor este 0:\n\n$16-x^2 = 0 \\Rightarrow x = \\pm 4$. Condiție: $x \\leq 3$, deci $x=-4$ ✓, $x=4$ respins.\n\n$\\sqrt{3-x} = 0 \\Rightarrow 3-x=0 \\Rightarrow x=3 \\leq 3$ ✓\n$$\\boxed{x \\in \\{-4,\\; 3\\}}$$'
  },
  {
    id: 'ira-011', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinant de ordinul 2 egal cu un radical',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\det A = \\sqrt{4-x}$, unde $\\det A$ reprezintă determinantul matricei\n$$A = \\begin{pmatrix} 1 & x+1 \\\\ 2 & 3x \\end{pmatrix}.$$',
    solution: 'Calculăm determinantul:\n$$\\det A = 1 \\cdot 3x - (x+1) \\cdot 2 = 3x-2x-2 = x-2$$\n\nEcuația devine: $x-2 = \\sqrt{4-x}$\n\nD.V.A.: $4-x \\geq 0 \\Rightarrow x \\leq 4$ și $x-2 \\geq 0 \\Rightarrow x \\geq 2$. Domeniu: $[2, 4]$.\n\nRidicăm la pătrat:\n$$(x-2)^2 = 4-x \\Rightarrow x^2-4x+4=4-x \\Rightarrow x^2-3x=0 \\Rightarrow x(x-3)=0$$\n$x=0$ (respins, $\\notin [2,4]$) sau $x=3 \\in [2,4]$.\n\nVerificare $x=3$: $3-2=1=\\sqrt{4-3}=1$ ✓\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'ira-012', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Sumă de radicali imbricați — soluție interval',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\sqrt{x+2\\sqrt{x-1}} + \\sqrt{x-2\\sqrt{x-1}} = 2$.',
    solution: 'D.V.A.: $x-1 \\geq 0 \\Rightarrow x \\geq 1$. Substituim $t = \\sqrt{x-1} \\geq 0$, deci $x = t^2+1$:\n$$x+2\\sqrt{x-1} = t^2+1+2t = (t+1)^2$$\n$$x-2\\sqrt{x-1} = t^2+1-2t = (t-1)^2 \\geq 0 \\text{ (D.V.A. automat satisfăcută)}$$\nEcuația devine $|t+1|+|t-1|=2$. Deoarece $t \\geq 0$: $|t+1|=t+1$.\n\n- $0 \\leq t \\leq 1$: $(t+1)+(1-t)=2$ ✓ — adevărat $\\forall t \\in [0,1]$\n- $t > 1$: $(t+1)+(t-1)=2t=2 \\Rightarrow t=1$\n\nDeci $t \\in [0, 1] \\Rightarrow \\sqrt{x-1} \\in [0,1] \\Rightarrow x-1 \\in [0,1]$.\n$$\\boxed{x \\in [1,\\; 2]}$$'
  },
  {
    id: 'ira-013', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinant 2×2 egal cu radical — domeniu negativ',
    statement: 'Fie determinantul\n$$d = \\begin{vmatrix} x & 2 \\\\ x+1 & 1 \\end{vmatrix}.$$\nRezolvați în $\\mathbb{R}$ ecuația $d = \\sqrt{4+x}$.',
    solution: 'Calculăm determinantul:\n$$d = x \\cdot 1 - 2(x+1) = x-2x-2 = -x-2$$\n\nEcuația devine: $-x-2 = \\sqrt{4+x}$\n\nD.V.A.: $4+x \\geq 0 \\Rightarrow x \\geq -4$ și $-x-2 \\geq 0 \\Rightarrow x \\leq -2$. Domeniu: $[-4, -2]$.\n\nRidicăm la pătrat:\n$$(-x-2)^2 = 4+x \\Rightarrow x^2+4x+4=4+x \\Rightarrow x^2+3x=0 \\Rightarrow x(x+3)=0$$\n$x=0$ (respins) sau $x=-3 \\in [-4,-2]$.\n\nVerificare $x=-3$: $-(-3)-2=1=\\sqrt{4-3}=1$ ✓\n$$\\boxed{x = -3}$$'
  },
  {
    id: 'ira-014', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinant 2×2 egal cu radical — condiție dublă de domeniu',
    statement: 'Fie determinantul\n$$d = \\begin{vmatrix} 1 & x+1 \\\\ 2 & 3x \\end{vmatrix}.$$\nRezolvați în $\\mathbb{R}$ ecuația $d = \\sqrt{4-x}$.',
    solution: 'Calculăm determinantul:\n$$d = 1 \\cdot 3x - (x+1) \\cdot 2 = 3x-2x-2 = x-2$$\n\nEcuația devine: $x-2 = \\sqrt{4-x}$\n\nD.V.A.: $4-x \\geq 0 \\Rightarrow x \\leq 4$ și $x-2 \\geq 0 \\Rightarrow x \\geq 2$. Domeniu: $[2, 4]$.\n\nRidicăm la pătrat:\n$$(x-2)^2 = 4-x \\Rightarrow x^2-3x=0 \\Rightarrow x(x-3)=0$$\n$x=0$ (respins, $\\notin [2,4]$) sau $x=3 \\in [2,4]$.\n\nVerificare $x=3$: $3-2=1=\\sqrt{4-3}=1$ ✓\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'ira-015', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical cu radical în interior — două ridicări la pătrat',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\sqrt{5+\\sqrt{x-1}} = 3$.',
    solution: 'D.V.A.: $x \\geq 1$.\n\nRidicăm la pătrat:\n$$5+\\sqrt{x-1} = 9 \\Rightarrow \\sqrt{x-1} = 4$$\nRidicăm din nou la pătrat:\n$$x-1 = 16 \\Rightarrow x = 17$$\n\nVerificare: $\\sqrt{5+\\sqrt{16}} = \\sqrt{5+4} = \\sqrt{9} = 3$ ✓\n$$\\boxed{x = 17}$$'
  },
  {
    id: 'ira-016', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație irațională cu soluție negativă',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ ecuația $\\sqrt{7-3x} = x+7$.',
    solution: 'D.V.A.: $7-3x \\geq 0 \\Rightarrow x \\leq \\dfrac{7}{3}$ și $x+7 \\geq 0 \\Rightarrow x \\geq -7$. Domeniu: $\\left[-7,\\, \\dfrac{7}{3}\\right]$.\n\nRidicăm la pătrat:\n$$7-3x = (x+7)^2 = x^2+14x+49 \\Rightarrow x^2+17x+42=0$$\n$$\\Delta = 289-168 = 121 \\Rightarrow x = \\frac{-17\\pm 11}{2}$$\n$x=-3$ sau $x=-14<-7$ (respins).\n\nVerificare $x=-3$: $\\sqrt{7+9}=\\sqrt{16}=4=-3+7$ ✓\n$$\\boxed{x = -3}$$'
  },
  {
    id: 'ira-017', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinant cu element sub radical — condiție de domeniu',
    statement: 'Se consideră determinantul\n$$D(x) = \\begin{vmatrix} \\sqrt{5-x^2} & x \\\\ 1 & 1 \\end{vmatrix}.$$\nRezolvați în mulțimea $\\mathbb{R}$ ecuația $D(x) = 1$.',
    solution: 'D.V.A.: $5-x^2 \\geq 0 \\Rightarrow x \\in [-\\sqrt{5},\\, \\sqrt{5}]$.\n\nCalculăm determinantul:\n$$D(x) = \\sqrt{5-x^2} \\cdot 1 - x \\cdot 1 = \\sqrt{5-x^2}-x$$\n\nEcuația: $\\sqrt{5-x^2}-x=1 \\Rightarrow \\sqrt{5-x^2}=x+1$\n\nD.V.A. suplimentar: $x+1 \\geq 0 \\Rightarrow x \\geq -1$. Domeniu: $[-1,\\, \\sqrt{5}]$.\n\nRidicăm la pătrat:\n$$5-x^2=(x+1)^2=x^2+2x+1 \\Rightarrow 2x^2+2x-4=0 \\Rightarrow x^2+x-2=0$$\n$$(x+2)(x-1)=0 \\Rightarrow x=-2 \\text{ (respins, }\\notin [-1,\\sqrt{5}]\\text{) sau } x=1$$\n\nVerificare $x=1$: $\\sqrt{4}-1=2-1=1$ ✓\n$$\\boxed{x = 1}$$'
  },
  {
    id: 'ira-018', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație cu valoare absolută sub radical',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\sqrt{|x-3|+2} = 3$.',
    solution: 'Radicantul $|x-3|+2 \\geq 2 > 0$ pentru orice $x \\in \\mathbb{R}$, deci nu există restricții de domeniu.\n\nRidicăm la pătrat:\n$$|x-3|+2 = 9 \\Rightarrow |x-3| = 7$$\n$$x-3 = 7 \\Rightarrow x=10 \\qquad \\text{sau} \\qquad x-3=-7 \\Rightarrow x=-4$$\nVerificări:\n- $x=10$: $\\sqrt{7+2}=\\sqrt{9}=3$ ✓\n- $x=-4$: $\\sqrt{7+2}=\\sqrt{9}=3$ ✓\n$$\\boxed{x \\in \\{-4,\\; 10\\}}$$'
  },
  {
    id: 'ira-019', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical imbriocat simplu — soluție unică',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\sqrt{7-\\sqrt{x+1}} = 2$.',
    solution: 'D.V.A.: $x+1 \\geq 0 \\Rightarrow x \\geq -1$ și $7-\\sqrt{x+1} \\geq 0 \\Rightarrow \\sqrt{x+1} \\leq 7 \\Rightarrow x \\leq 48$.\n\nRidicăm la pătrat:\n$$7-\\sqrt{x+1} = 4 \\Rightarrow \\sqrt{x+1} = 3$$\nRidicăm din nou la pătrat:\n$$x+1 = 9 \\Rightarrow x = 8$$\n\nVerificare: $\\sqrt{7-\\sqrt{9}} = \\sqrt{7-3} = \\sqrt{4} = 2$ ✓\n$$\\boxed{x = 8}$$'
  },
  {
    id: 'ira-020', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu expresie liniară — domeniu de semn',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{4-x} = x-2$.',
    solution: 'D.V.A.: $4-x \\geq 0 \\Rightarrow x \\leq 4$ și $x-2 \\geq 0 \\Rightarrow x \\geq 2$. Domeniu: $x \\in [2,\\, 4]$.\n\nRidicăm la pătrat ambii membri:\n$$4-x = (x-2)^2 = x^2-4x+4$$\n$$x^2-3x = 0 \\Rightarrow x(x-3) = 0$$\n$x = 0$ (respins, $\\notin [2,4]$) sau $x = 3 \\in [2,4]$ ✓\n\nVerificare $x=3$: $\\sqrt{4-3} = 1 = 3-2$ ✓\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'ira-021', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Două radicale egale — reducere prin ridicare la pătrat',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{x^3-3x-1} = \\sqrt{x-1}$.',
    solution: 'D.V.A.: $x-1 \\geq 0 \\Rightarrow x \\geq 1$ și $x^3-3x-1 \\geq 0$ (verificat pentru soluțiile candidate).\n\nRidicăm la pătrat (ambii membri sunt $\\geq 0$):\n$$x^3-3x-1 = x-1 \\Rightarrow x^3-4x = 0 \\Rightarrow x(x-2)(x+2) = 0$$\nCandidați: $x=0$ (respins, $<1$), $x=-2$ (respins, $<1$), $x=2$ ✓.\n\nVerificare $x=2$: $\\sqrt{8-6-1} = \\sqrt{1} = 1 = \\sqrt{2-1}$ ✓\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'ira-022', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu x — condiție de semn obligatorie',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{4x+12} = x$.',
    solution: 'D.V.A.: $4x+12 \\geq 0 \\Rightarrow x \\geq -3$ și $x \\geq 0$ (membrul drept trebuie $\\geq 0$). Domeniu: $x \\geq 0$.\n\nRidicăm la pătrat:\n$$4x+12 = x^2 \\Rightarrow x^2-4x-12 = 0 \\Rightarrow (x-6)(x+2) = 0$$\n$x=6$ ✓ sau $x=-2$ (respins, $<0$).\n\nVerificare $x=6$: $\\sqrt{24+12} = \\sqrt{36} = 6$ ✓\n$$\\boxed{x = 6}$$'
  },
  {
    id: 'ira-023', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Produs de radicale egal cu constantă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{-x} \\cdot \\sqrt{-5x+12} = 3$.',
    solution: 'D.V.A.: $-x \\geq 0 \\Rightarrow x \\leq 0$ și $-5x+12 \\geq 0 \\Rightarrow x \\leq \\dfrac{12}{5}$. Domeniu: $x \\leq 0$.\n\n$\\sqrt{(-x)(-5x+12)} = 3$. Ridicăm la pătrat:\n$$(-x)(-5x+12) = 9 \\Rightarrow 5x^2-12x-9 = 0$$\n$$\\Delta = 144+180 = 324,\\quad \\sqrt{\\Delta} = 18$$\n$$x = \\frac{12 \\pm 18}{10}: \\quad x_1 = 3 \\text{ (respins, }> 0\\text{)},\\quad x_2 = -\\frac{3}{5} \\text{ ✓}$$\n\nVerificare $x=-\\dfrac{3}{5}$: $\\sqrt{\\tfrac{3}{5}} \\cdot \\sqrt{3+12} = \\sqrt{\\tfrac{3}{5} \\cdot 15} = \\sqrt{9} = 3$ ✓\n$$\\boxed{x = -\\dfrac{3}{5}}$$'
  },
  {
    id: 'ira-024', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu expresie liniară în 2x',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{2x+1} = 2x-1$.',
    solution: 'D.V.A.: $2x+1 \\geq 0 \\Rightarrow x \\geq -\\dfrac{1}{2}$ și $2x-1 \\geq 0 \\Rightarrow x \\geq \\dfrac{1}{2}$. Domeniu: $x \\geq \\dfrac{1}{2}$.\n\nRidicăm la pătrat:\n$$2x+1 = (2x-1)^2 = 4x^2-4x+1 \\Rightarrow 4x^2-6x = 0 \\Rightarrow 2x(2x-3) = 0$$\n$x=0$ (respins, $< \\dfrac{1}{2}$) sau $x = \\dfrac{3}{2}$ ✓\n\nVerificare $x=\\dfrac{3}{2}$: $\\sqrt{4} = 2 = 2 \\cdot \\dfrac{3}{2}-1$ ✓\n$$\\boxed{x = \\dfrac{3}{2}}$$'
  },
  {
    id: 'ira-025', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical cu expresie pătratică — membrul drept negativ',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $2\\sqrt{1-2x^2} = -x$.',
    solution: 'D.V.A.: $1-2x^2 \\geq 0 \\Rightarrow x^2 \\leq \\dfrac{1}{2} \\Rightarrow x \\in \\left[-\\dfrac{\\sqrt{2}}{2},\\, \\dfrac{\\sqrt{2}}{2}\\right]$ și $-x \\geq 0 \\Rightarrow x \\leq 0$. Domeniu: $x \\in \\left[-\\dfrac{\\sqrt{2}}{2},\\, 0\\right]$.\n\nRidicăm la pătrat:\n$$4(1-2x^2) = x^2 \\Rightarrow 4-8x^2 = x^2 \\Rightarrow 9x^2 = 4 \\Rightarrow x = \\pm\\dfrac{2}{3}$$\n$x=\\dfrac{2}{3}$ (respins, $> 0$) sau $x=-\\dfrac{2}{3}$ — verificăm dacă $-\\dfrac{2}{3} \\geq -\\dfrac{\\sqrt{2}}{2} \\approx -0.707$: da ✓\n\nVerificare $x=-\\dfrac{2}{3}$: $2\\sqrt{1-\\tfrac{8}{9}} = 2\\sqrt{\\tfrac{1}{9}} = \\dfrac{2}{3} = -\\left(-\\dfrac{2}{3}\\right)$ ✓\n$$\\boxed{x = -\\dfrac{2}{3}}$$'
  },
  {
    id: 'ira-026', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Diferență de radicale — ridicare la pătrat de două ori',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{2x} = \\sqrt{x-1}+1$.',
    solution: 'D.V.A.: $2x \\geq 0 \\Rightarrow x \\geq 0$ și $x-1 \\geq 0 \\Rightarrow x \\geq 1$. Domeniu: $x \\geq 1$.\n\nRidicăm la pătrat:\n$$2x = (\\sqrt{x-1}+1)^2 = (x-1)+2\\sqrt{x-1}+1 = x+2\\sqrt{x-1}$$\n$$x = 2\\sqrt{x-1}$$\nRidicăm din nou la pătrat:\n$$x^2 = 4(x-1) \\Rightarrow x^2-4x+4 = 0 \\Rightarrow (x-2)^2 = 0 \\Rightarrow x = 2 \\text{ ✓}$$\n\nVerificare $x=2$: $\\sqrt{4} = 2$ și $\\sqrt{1}+1 = 2$ ✓\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'ira-027', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Produs nul cu radical și polinoam de gradul 2',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{1-x}\\,(x^2+7x-18) = 0$.',
    solution: 'D.V.A.: $1-x \\geq 0 \\Rightarrow x \\leq 1$.\n\nProdul este nul dacă cel puțin un factor este zero:\n\n**Cazul 1:** $\\sqrt{1-x} = 0 \\Rightarrow x = 1 \\leq 1$ ✓\n\n**Cazul 2:** $x^2+7x-18 = 0$\n$$\\Delta = 49+72 = 121,\\quad x = \\frac{-7 \\pm 11}{2}$$\n$x_1 = 2$ (respins, $> 1$) sau $x_2 = -9 \\leq 1$ ✓\n\nVerificare $x=-9$: $\\sqrt{1-(-9)} = \\sqrt{10} \\neq 0$ și $81-63-18=0$ ✓\n$$\\boxed{x \\in \\{-9,\\; 1\\}}$$'
  },
  {
    id: 'ira-028', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical cu polinoam pătratic egal cu expresie liniară',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{3x^2-x} = 3+x$.',
    solution: 'D.V.A.: $x(3x-1) \\geq 0 \\Rightarrow x \\leq 0$ sau $x \\geq \\dfrac{1}{3}$. Și $3+x \\geq 0 \\Rightarrow x \\geq -3$. Domeniu: $x \\in [-3,\\, 0] \\cup \\left[\\dfrac{1}{3},\\, +\\infty\\right)$.\n\nRidicăm la pătrat:\n$$3x^2-x = (3+x)^2 = 9+6x+x^2 \\Rightarrow 2x^2-7x-9 = 0$$\n$$(2x-9)(x+1) = 0 \\Rightarrow x = \\dfrac{9}{2} \\text{ sau } x = -1$$\n\nVerificare $x=\\dfrac{9}{2}$: $\\sqrt{3 \\cdot \\tfrac{81}{4}-\\tfrac{9}{2}} = \\sqrt{\\tfrac{225}{4}} = \\dfrac{15}{2} = 3+\\dfrac{9}{2}$ ✓\nVerificare $x=-1$: $\\sqrt{3+1} = 2 = 3-1$ ✓\n$$\\boxed{x \\in \\left\\{-1,\\; \\dfrac{9}{2}\\right\\}}$$'
  },
  {
    id: 'ira-029', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Radical cu coeficient egal cu expresie în paranteze',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $2\\sqrt{5-x}-3(x+2) = 0$.',
    solution: 'D.V.A.: $5-x \\geq 0 \\Rightarrow x \\leq 5$. Din ecuație: $2\\sqrt{5-x} = 3(x+2) \\geq 0 \\Rightarrow x \\geq -2$. Domeniu: $x \\in [-2,\\, 5]$.\n\nRidicăm la pătrat:\n$$4(5-x) = 9(x+2)^2 \\Rightarrow 20-4x = 9x^2+36x+36$$\n$$9x^2+40x+16 = 0$$\n$$\\Delta = 1600-576 = 1024,\\quad \\sqrt{\\Delta} = 32$$\n$$x = \\frac{-40 \\pm 32}{18}: \\quad x_1 = -\\frac{4}{9} \\text{ ✓},\\quad x_2 = -4 \\text{ (respins, }< -2\\text{)}$$\n\nVerificare $x=-\\dfrac{4}{9}$: $2\\sqrt{5+\\tfrac{4}{9}} = 2\\sqrt{\\tfrac{49}{9}} = \\dfrac{14}{3}$ și $3\\!\\left(-\\tfrac{4}{9}+2\\right) = \\dfrac{14}{3}$ ✓\n$$\\boxed{x = -\\dfrac{4}{9}}$$'
  },
  {
    id: 'ira-030', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical plus x egal cu constantă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{15+3x}+x = 1$.',
    solution: 'Scriem ecuația ca $\\sqrt{15+3x} = 1-x$.\n\nD.V.A.: $15+3x \\geq 0 \\Rightarrow x \\geq -5$ și $1-x \\geq 0 \\Rightarrow x \\leq 1$. Domeniu: $x \\in [-5,\\, 1]$.\n\nRidicăm la pătrat:\n$$15+3x = (1-x)^2 = 1-2x+x^2 \\Rightarrow x^2-5x-14 = 0$$\n$$(x-7)(x+2) = 0 \\Rightarrow x=7 \\text{ (respins, }>1\\text{) sau } x=-2 \\text{ ✓}$$\n\nVerificare $x=-2$: $\\sqrt{15-6}+(-2) = 3-2 = 1$ ✓\n$$\\boxed{x = -2}$$'
  },
  {
    id: 'ira-031', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical din x plus constantă egal cu x',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{x}+2 = x$.',
    solution: 'Scriem ecuația ca $\\sqrt{x} = x-2$.\n\nD.V.A.: $x \\geq 0$ și $x-2 \\geq 0 \\Rightarrow x \\geq 2$. Domeniu: $x \\geq 2$.\n\nRidicăm la pătrat:\n$$x = (x-2)^2 = x^2-4x+4 \\Rightarrow x^2-5x+4 = 0$$\n$$(x-1)(x-4) = 0 \\Rightarrow x=1 \\text{ (respins, }<2\\text{) sau } x=4 \\text{ ✓}$$\n\nVerificare $x=4$: $\\sqrt{4}+2 = 2+2 = 4$ ✓\n$$\\boxed{x = 4}$$'
  },
  {
    id: 'ira-032', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație irațională rezolvată prin substituție',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $6\\sqrt{x}-x = -16$.',
    solution: 'Scriem ecuația ca $6\\sqrt{x} = x-16$.\n\nD.V.A.: $x \\geq 0$ și $x-16 \\geq 0 \\Rightarrow x \\geq 16$. Domeniu: $x \\geq 16$.\n\nSubstituție $t = \\sqrt{x}$, $t \\geq 4$:\n$$6t = t^2-16 \\Rightarrow t^2-6t-16 = 0 \\Rightarrow (t-8)(t+2) = 0$$\n$t=8$ ✓ (deoarece $8 \\geq 4$) sau $t=-2$ (respins, $<0$).\n\n$\\sqrt{x} = 8 \\Rightarrow x = 64$\n\nVerificare: $6\\cdot 8-64 = 48-64 = -16$ ✓\n$$\\boxed{x = 64}$$'
  },
  {
    id: 'ira-033', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu expresie liniară pozitivă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{3-x} = 2x$.',
    solution: 'D.V.A.: $3-x \\geq 0 \\Rightarrow x \\leq 3$ și $2x \\geq 0 \\Rightarrow x \\geq 0$. Domeniu: $x \\in [0,\\, 3]$.\n\nRidicăm la pătrat:\n$$3-x = 4x^2 \\Rightarrow 4x^2+x-3 = 0$$\n$$\\Delta = 1+48 = 49 \\Rightarrow x = \\frac{-1 \\pm 7}{8}$$\n$x_1 = \\dfrac{3}{4}$ ✓ sau $x_2 = -1$ (respins, $<0$).\n\nVerificare $x=\\dfrac{3}{4}$: $\\sqrt{3-\\tfrac{3}{4}} = \\sqrt{\\tfrac{9}{4}} = \\dfrac{3}{2} = 2 \\cdot \\dfrac{3}{4}$ ✓\n$$\\boxed{x = \\dfrac{3}{4}}$$'
  },
  {
    id: 'ira-034', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical minus 2x egal cu 1',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{x+1}-2x = 1$.',
    solution: 'Scriem ecuația ca $\\sqrt{x+1} = 1+2x$.\n\nD.V.A.: $x+1 \\geq 0 \\Rightarrow x \\geq -1$ și $1+2x \\geq 0 \\Rightarrow x \\geq -\\dfrac{1}{2}$. Domeniu: $x \\geq -\\dfrac{1}{2}$.\n\nRidicăm la pătrat:\n$$x+1 = (1+2x)^2 = 1+4x+4x^2 \\Rightarrow 4x^2+3x = 0 \\Rightarrow x(4x+3) = 0$$\n$x=0$ ✓ sau $x=-\\dfrac{3}{4}$ (respins, $<-\\dfrac{1}{2}$).\n\nVerificare $x=0$: $\\sqrt{1}-0 = 1$ ✓\n$$\\boxed{x = 0}$$'
  },
  {
    id: 'ira-035', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu x — formă cu diferență nulă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{x+2}-x = 0$.',
    solution: 'Scriem ecuația ca $\\sqrt{x+2} = x$.\n\nD.V.A.: $x+2 \\geq 0 \\Rightarrow x \\geq -2$ și $x \\geq 0$. Domeniu: $x \\geq 0$.\n\nRidicăm la pătrat:\n$$x+2 = x^2 \\Rightarrow x^2-x-2 = 0 \\Rightarrow (x-2)(x+1) = 0$$\n$x=2$ ✓ sau $x=-1$ (respins, $<0$).\n\nVerificare $x=2$: $\\sqrt{4}-2 = 0$ ✓\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'ira-036', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical minus x egal cu constantă negativă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{x-1}-x = -7$.',
    solution: 'Scriem ecuația ca $\\sqrt{x-1} = x-7$.\n\nD.V.A.: $x-1 \\geq 0 \\Rightarrow x \\geq 1$ și $x-7 \\geq 0 \\Rightarrow x \\geq 7$. Domeniu: $x \\geq 7$.\n\nRidicăm la pătrat:\n$$x-1 = (x-7)^2 = x^2-14x+49 \\Rightarrow x^2-15x+50 = 0$$\n$$(x-5)(x-10) = 0 \\Rightarrow x=5 \\text{ (respins, }<7\\text{) sau } x=10 \\text{ ✓}$$\n\nVerificare $x=10$: $\\sqrt{9}-10 = 3-10 = -7$ ✓\n$$\\boxed{x = 10}$$'
  },
  {
    id: 'ira-037', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical din expresie pătratică egal cu constantă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{x^2-1} = 2$.',
    solution: 'D.V.A.: $x^2-1 \\geq 0 \\Rightarrow |x| \\geq 1$, adică $x \\leq -1$ sau $x \\geq 1$.\n\nRidicăm la pătrat:\n$$x^2-1 = 4 \\Rightarrow x^2 = 5 \\Rightarrow x = \\pm\\sqrt{5}$$\n\nVerificare: $\\sqrt{(\\pm\\sqrt{5})^2-1} = \\sqrt{5-1} = \\sqrt{4} = 2$ ✓ (ambele valori)\n$$\\boxed{x \\in \\{-\\sqrt{5},\\; \\sqrt{5}\\}}$$'
  },
  {
    id: 'ira-038', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical din polinoam pătratic egal cu 1',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{3-2x^2} = 1$.',
    solution: 'D.V.A.: $3-2x^2 \\geq 0 \\Rightarrow x^2 \\leq \\dfrac{3}{2} \\Rightarrow x \\in \\left[-\\dfrac{\\sqrt{6}}{2},\\, \\dfrac{\\sqrt{6}}{2}\\right]$.\n\nRidicăm la pătrat:\n$$3-2x^2 = 1 \\Rightarrow 2x^2 = 2 \\Rightarrow x^2 = 1 \\Rightarrow x = \\pm 1$$\n\nVerificăm că $|{\\pm 1}| = 1 \\leq \\dfrac{\\sqrt{6}}{2} \\approx 1.22$ ✓\n\nVerificare: $\\sqrt{3-2} = \\sqrt{1} = 1$ ✓\n$$\\boxed{x \\in \\{-1,\\; 1\\}}$$'
  },
  {
    id: 'ira-039', categoryId: 'algebra', subcategoryId: 'ec-irationale',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Radical egal cu zero — soluție directă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\sqrt{6x-4} = 0$.',
    solution: 'D.V.A.: $6x-4 \\geq 0 \\Rightarrow x \\geq \\dfrac{2}{3}$.\n\n$\\sqrt{6x-4} = 0 \\Leftrightarrow 6x-4 = 0 \\Rightarrow x = \\dfrac{2}{3}$ ✓\n\nVerificare: $\\sqrt{6 \\cdot \\tfrac{2}{3}-4} = \\sqrt{4-4} = \\sqrt{0} = 0$ ✓\n$$\\boxed{x = \\dfrac{2}{3}}$$'
  },

  /* ============================================================
     ALGEBRĂ — Ecuații exponențiale
     ============================================================ */
  {
    id: 'log-ee-005', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită printr-un determinant',
    statement: 'Fie $D(x) = \\begin{vmatrix} 9^x & 3 \\\\ 27 & 3^{3x} \\end{vmatrix}$. Rezolvați în $\\mathbb{R}$ ecuația $D(x) = 0$.',
    solution: 'Calculăm determinantul:\n$$D(x) = 9^x \\cdot 3^{3x} - 3 \\cdot 27 = 3^{2x} \\cdot 3^{3x} - 81 = 3^{5x} - 3^4$$\n\n$D(x) = 0 \\Rightarrow 3^{5x} = 3^4 \\Rightarrow 5x = 4$\n\n$$\\boxed{x = \\dfrac{4}{5}}$$'
  },
  {
    id: 'log-ee-006', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu substituție — coeficienți de 3',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $3^{x+1} + 6 \\cdot 3^{-x+1} = 29$.',
    solution: 'Scriem $3 \\cdot 3^x + 18 \\cdot 3^{-x} = 29$. Substituție $t = 3^x > 0$:\n$$3t + \\frac{18}{t} = 29 \\Rightarrow 3t^2 - 29t + 18 = 0$$\n$$\\Delta = 841 - 216 = 625 \\Rightarrow t = \\frac{29 \\pm 25}{6}$$\n\n$t_1 = 9 = 3^2 \\Rightarrow x_1 = 2$\n\n$t_2 = \\dfrac{2}{3} \\Rightarrow 3^x = \\dfrac{2}{3} \\Rightarrow x_2 = \\log_3 \\dfrac{2}{3} = \\log_3 2 - 1$\n\n$$\\boxed{x \\in \\left\\{2,\\; \\log_3 2 - 1\\right\\}}$$'
  },
  {
    id: 'log-ee-007', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 4 — ecuație cu 16 și 0,25',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $16^{1-x} = 0{,}25^{-2x}$.',
    solution: '$16 = 4^2$ și $0{,}25 = \\dfrac{1}{4} = 4^{-1}$:\n$$(4^2)^{1-x} = (4^{-1})^{-2x} \\Rightarrow 4^{2(1-x)} = 4^{2x}$$\n$$2 - 2x = 2x \\Rightarrow 4x = 2$$\n\n$$\\boxed{x = \\dfrac{1}{2}}$$'
  },
  {
    id: 'log-ee-008', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială omogenă — împărțire la 36ˣ',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $3 \\cdot 16^x + 2 \\cdot 81^x = 5 \\cdot 36^x$.',
    solution: 'Împărțim prin $36^x > 0$:\n$$3\\left(\\frac{16}{36}\\right)^x + 2\\left(\\frac{81}{36}\\right)^x = 5 \\Rightarrow 3\\left(\\frac{4}{9}\\right)^x + 2\\left(\\frac{9}{4}\\right)^x = 5$$\n\nSubstituție $t = \\left(\\dfrac{4}{9}\\right)^x > 0$, deci $\\left(\\dfrac{9}{4}\\right)^x = \\dfrac{1}{t}$:\n$$3t + \\frac{2}{t} = 5 \\Rightarrow 3t^2 - 5t + 2 = 0 \\Rightarrow (3t-2)(t-1) = 0$$\n\n$t = 1 \\Rightarrow \\left(\\dfrac{4}{9}\\right)^x = 1 \\Rightarrow x = 0$\n\n$t = \\dfrac{2}{3} \\Rightarrow \\left(\\dfrac{2}{3}\\right)^{2x} = \\left(\\dfrac{2}{3}\\right)^1 \\Rightarrow 2x = 1 \\Rightarrow x = \\dfrac{1}{2}$\n\n$$\\boxed{x \\in \\left\\{0,\\; \\dfrac{1}{2}\\right\\}}$$'
  },
  {
    id: 'log-ee-009', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la aceeași bază — 1,25 și 0,8',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $(1{,}25)^{x-1} \\cdot (0{,}8)^{2x-7} = \\dfrac{5}{4}$.',
    solution: '$1{,}25 = \\dfrac{5}{4}$ și $0{,}8 = \\dfrac{4}{5} = \\left(\\dfrac{5}{4}\\right)^{-1}$:\n$$\\left(\\frac{5}{4}\\right)^{x-1} \\cdot \\left(\\frac{5}{4}\\right)^{-(2x-7)} = \\left(\\frac{5}{4}\\right)^1$$\n$$(x-1) - (2x-7) = 1$$\n$$-x + 6 = 1 \\Rightarrow x = 5$$\n\n$$\\boxed{x = 5}$$'
  },
  {
    id: 'log-ee-010', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu baze conjugate',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\left(5+\\sqrt{24}\\right)^x + \\left(5-\\sqrt{24}\\right)^x = 98$.',
    solution: 'Observăm că $(5+\\sqrt{24})(5-\\sqrt{24}) = 25-24 = 1$, deci $5-\\sqrt{24} = (5+\\sqrt{24})^{-1}$.\n\nSubstituție $t = (5+\\sqrt{24})^x > 0$:\n$$t + \\frac{1}{t} = 98 \\Rightarrow t^2 - 98t + 1 = 0 \\Rightarrow t = 49 \\pm 20\\sqrt{6}$$\n\n$\\sqrt{24} = 2\\sqrt{6}$, iar $(5+2\\sqrt{6})^2 = 49+20\\sqrt{6}$ și $(5+2\\sqrt{6})^{-2} = 49-20\\sqrt{6}$.\n\n$t_1 = 49+20\\sqrt{6} = (5+\\sqrt{24})^2 \\Rightarrow x = 2$\n$t_2 = 49-20\\sqrt{6} = (5+\\sqrt{24})^{-2} \\Rightarrow x = -2$\n\n$$\\boxed{x \\in \\{-2,\\; 2\\}}$$'
  },
  {
    id: 'log-ee-011', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație cu exponenți logaritmici — simetrie',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $x^{\\lg(x-3)} + (x-3)^{\\lg x} = 2x^2$.',
    solution: 'D.V.A.: $x > 0$ și $x-3 > 0 \\Rightarrow x > 3$.\n\nObservăm că $x^{\\lg(x-3)} = 10^{\\lg x \\cdot \\lg(x-3)} = (x-3)^{\\lg x}$,\ndeci cei doi termeni din stânga sunt egali:\n$$2 \\cdot x^{\\lg(x-3)} = 2x^2 \\Rightarrow x^{\\lg(x-3)} = x^2$$\n\nLuăm $\\lg$ din ambii membri:\n$$\\lg(x-3) \\cdot \\lg x = 2 \\lg x$$\n\nDeoarece $x > 3 > 1$, avem $\\lg x > 0$, deci împărțim:\n$$\\lg(x-3) = 2 \\Rightarrow x-3 = 100 \\Rightarrow x = 103$$\n\nVerificare: $103^{\\lg 100} + 100^{\\lg 103} = 103^2 + 103^2 = 2 \\cdot 103^2$ ✓\n$$\\boxed{x = 103}$$'
  },
  {
    id: 'log-ee-012', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație cu exponent logaritmic în baza 2',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $x^{\\log_2 x + 4} = 32$.',
    solution: 'D.V.A.: $x > 0$, $x \\neq 1$.\n\nLuăm $\\log_2$ din ambii membri:\n$$(\\log_2 x + 4) \\cdot \\log_2 x = \\log_2 32 = 5$$\n\nSubstituție $t = \\log_2 x$:\n$$t^2 + 4t - 5 = 0 \\Rightarrow (t+5)(t-1) = 0$$\n\n$t = 1 \\Rightarrow x = 2$: $\\;2^{1+4} = 2^5 = 32$ ✓\n$t = -5 \\Rightarrow x = 2^{-5} = \\dfrac{1}{32}$: $\\;\\left(\\dfrac{1}{32}\\right)^{-5+4} = \\left(\\dfrac{1}{32}\\right)^{-1} = 32$ ✓\n\n$$\\boxed{x \\in \\left\\{\\dfrac{1}{32},\\; 2\\right\\}}$$'
  },
  {
    id: 'log-ee-013', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită printr-un determinant de ordinul 2',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\begin{vmatrix} 2^x & 2^{x+1}-2 \\\\ 2^x-1 & 2^x+8 \\end{vmatrix} = 30$.',
    solution: 'Calculăm determinantul. Observăm că $2^{x+1}-2 = 2(2^x-1)$:\n$$D = 2^x(2^x+8) - 2(2^x-1)^2$$\n$$= 2^{2x} + 8 \\cdot 2^x - 2(2^{2x}-2\\cdot 2^x+1)$$\n$$= -2^{2x} + 12 \\cdot 2^x - 2 = 30$$\n$$2^{2x} - 12 \\cdot 2^x + 32 = 0$$\n\nSubstituție $t = 2^x > 0$:\n$$t^2 - 12t + 32 = 0 \\Rightarrow (t-4)(t-8) = 0$$\n$t = 4 = 2^2 \\Rightarrow x = 2$ și $t = 8 = 2^3 \\Rightarrow x = 3$\n\n$$\\boxed{x \\in \\{2,\\; 3\\}}$$'
  },
  {
    id: 'log-ee-014', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 5 — ecuație cu 0,2 și 25',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $0{,}2^{x+1} = 25^{x-4}$.',
    solution: '$0{,}2 = \\dfrac{1}{5} = 5^{-1}$ și $25 = 5^2$:\n$$(5^{-1})^{x+1} = (5^2)^{x-4} \\Rightarrow 5^{-(x+1)} = 5^{2(x-4)}$$\n$$-(x+1) = 2(x-4)$$\n$$-x-1 = 2x-8 \\Rightarrow 3x = 7$$\n\n$$\\boxed{x = \\dfrac{7}{3}}$$'
  },
  {
    id: 'log-ee-015', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la aceeași bază — ecuație pătratică în exponent',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\left(\\dfrac{2}{3}\\right)^{2x-4} \\cdot \\left(\\dfrac{9}{4}\\right)^2 = \\left(\\dfrac{8}{27}\\right)^{-x^2}$.',
    solution: '$\\dfrac{9}{4} = \\left(\\dfrac{2}{3}\\right)^{-2}$ și $\\dfrac{8}{27} = \\left(\\dfrac{2}{3}\\right)^3$:\n$$\\left(\\frac{2}{3}\\right)^{2x-4} \\cdot \\left(\\frac{2}{3}\\right)^{-4} = \\left(\\frac{2}{3}\\right)^{-3x^2}$$\n$$\\left(\\frac{2}{3}\\right)^{2x-8} = \\left(\\frac{2}{3}\\right)^{-3x^2}$$\n$$2x - 8 = -3x^2 \\Rightarrow 3x^2 + 2x - 8 = 0$$\n$$\\Delta = 4 + 96 = 100 \\Rightarrow x = \\frac{-2 \\pm 10}{6}$$\n$x_1 = \\dfrac{4}{3}$ și $x_2 = -2$\n\n$$\\boxed{x \\in \\left\\{-2,\\; \\dfrac{4}{3}\\right\\}}$$'
  },
  {
    id: 'log-ee-016', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant 2×2 cu baze mixte',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\begin{vmatrix} 4^{x+1} & 3^x \\\\ 13 \\cdot 2^x - 3^{x+2} & 1 \\end{vmatrix} = 0$.',
    solution: 'Calculăm determinantul:\n$$4^{x+1} \\cdot 1 - 3^x(13 \\cdot 2^x - 3^{x+2}) = 0$$\n$$4 \\cdot (2^x)^2 - 13 \\cdot 2^x \\cdot 3^x + 9 \\cdot (3^x)^2 = 0$$\n\nÎmpărțim prin $(3^x)^2 > 0$, cu substituția $t = \\left(\\dfrac{2}{3}\\right)^x > 0$:\n$$4t^2 - 13t + 9 = 0 \\Rightarrow (4t-9)(t-1) = 0$$\n\n$t = 1 \\Rightarrow \\left(\\dfrac{2}{3}\\right)^x = 1 \\Rightarrow x = 0$\n\n$t = \\dfrac{9}{4} = \\left(\\dfrac{3}{2}\\right)^2 = \\left(\\dfrac{2}{3}\\right)^{-2} \\Rightarrow x = -2$\n\n$$\\boxed{x \\in \\{-2,\\; 0\\}}$$'
  },
  {
    id: 'log-ee-017', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $2^{x^2-2x} = 8$.',
    solution: '$8 = 2^3$, deci:\n$$2^{x^2-2x} = 2^3 \\Rightarrow x^2 - 2x = 3$$\n$$x^2 - 2x - 3 = 0 \\Rightarrow (x-3)(x+1) = 0$$\n\n$$\\boxed{x \\in \\{-1,\\; 3\\}}$$'
  },
  {
    id: 'log-ee-018', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită printr-un determinant cu baza 2',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\begin{vmatrix} 3 \\cdot 2^x & 2^x \\\\ 2 & 2 \\end{vmatrix} = 32$.',
    solution: 'Calculăm determinantul:\n$$3 \\cdot 2^x \\cdot 2 - 2^x \\cdot 2 = 6 \\cdot 2^x - 2 \\cdot 2^x = 4 \\cdot 2^x = 32$$\n$$2^x = 8 = 2^3$$\n\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'log-ee-019', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu valoare absolută — baza 5',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ ecuația $5^{|4x-6|} = 25^{3x-4}$.',
    solution: '$25 = 5^2$, deci $5^{|4x-6|} = 5^{2(3x-4)} = 5^{6x-8}$.\n\nNecesar $6x - 8 \\geq 0 \\Rightarrow x \\geq \\dfrac{4}{3}$. Ecuația devine $|4x-6| = 6x-8$.\n\n**Cazul 1:** $x \\geq \\dfrac{3}{2}$: $\\;4x-6 = 6x-8 \\Rightarrow x = 1 < \\dfrac{3}{2}$ — imposibil.\n\n**Cazul 2:** $x < \\dfrac{3}{2}$: $\\;-(4x-6) = 6x-8 \\Rightarrow 10x = 14$\n\n$x = \\dfrac{7}{5}$. Verificare: $\\dfrac{4}{3} \\leq \\dfrac{7}{5} < \\dfrac{3}{2}$ ✓\n\n$$\\boxed{x = \\dfrac{7}{5}}$$'
  },
  {
    id: 'log-ee-020', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație definită prin determinant D(x) — baze 3 și 9',
    statement: 'Fie $D(x) = \\begin{vmatrix} 3^{x-1} & 27 \\\\ 9 & 9^x \\end{vmatrix}$. Rezolvați în $\\mathbb{R}$ ecuația $D(x) = 0$.',
    solution: 'Calculăm determinantul:\n$$D(x) = 3^{x-1} \\cdot 9^x - 27 \\cdot 9 = 3^{x-1} \\cdot 3^{2x} - 3^3 \\cdot 3^2 = 3^{3x-1} - 3^5$$\n\n$D(x) = 0 \\Rightarrow 3^{3x-1} = 3^5 \\Rightarrow 3x - 1 = 5 \\Rightarrow 3x = 6$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-021', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant — baze 9 și 3',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ ecuația $\\begin{vmatrix} 9^x & -1 \\\\ 2 & 3^x \\end{vmatrix} = 11$.',
    solution: 'Calculăm determinantul:\n$$9^x \\cdot 3^x - (-1) \\cdot 2 = (3^x)^2 \\cdot 3^x + 2 = 3^{3x} + 2 = 11$$\n$$3^{3x} = 9 = 3^2 \\Rightarrow 3x = 2$$\n\n$$\\boxed{x = \\dfrac{2}{3}}$$'
  },
  {
    id: 'log-ee-022', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu valoare absolută — baza 3 și 9',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $3^{|3x-4|} = 9^{2x-2}$.',
    solution: '$9 = 3^2$, deci $3^{|3x-4|} = 3^{2(2x-2)} = 3^{4x-4}$.\n\nNecesar $4x - 4 \\geq 0 \\Rightarrow x \\geq 1$. Ecuația devine $|3x-4| = 4x-4$.\n\n**Cazul 1:** $x \\geq \\dfrac{4}{3}$: $\\;3x-4 = 4x-4 \\Rightarrow x = 0 < \\dfrac{4}{3}$ — imposibil.\n\n**Cazul 2:** $x < \\dfrac{4}{3}$: $\\;-(3x-4) = 4x-4 \\Rightarrow 7x = 8$\n\n$x = \\dfrac{8}{7}$. Verificare: $1 \\leq \\dfrac{8}{7} < \\dfrac{4}{3}$ ✓\n\n$$\\boxed{x = \\dfrac{8}{7}}$$'
  },
  {
    id: 'log-ee-023', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent trigonometric în valoare absolută',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $3^{|\\sin x - 1|} = 9$.',
    solution: '$9 = 3^2$, deci:\n$$3^{|\\sin x - 1|} = 3^2 \\Rightarrow |\\sin x - 1| = 2$$\n\n$\\sin x - 1 = 2 \\Rightarrow \\sin x = 3$ — imposibil ($|\\sin x| \\leq 1$)\n\n$\\sin x - 1 = -2 \\Rightarrow \\sin x = -1 \\Rightarrow x = -\\dfrac{\\pi}{2} + 2k\\pi,\\; k \\in \\mathbb{Z}$\n\n$$\\boxed{x = -\\dfrac{\\pi}{2} + 2k\\pi,\\; k \\in \\mathbb{Z}}$$'
  },
  {
    id: 'log-ee-024', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant — coloane identice cu 3^x',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\begin{vmatrix} 3^x & -2 \\\\ 3^x & 4 \\end{vmatrix} = 54$.',
    solution: 'Calculăm determinantul:\n$$3^x \\cdot 4 - (-2) \\cdot 3^x = 4 \\cdot 3^x + 2 \\cdot 3^x = 6 \\cdot 3^x = 54$$\n$$3^x = 9 = 3^2$$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-025', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent logaritmic — substituție',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $4^{\\log_9 x} - 6 \\cdot 2^{\\log_9 x} + 2^{\\log_3 27} = 0$.',
    solution: 'Calculăm $2^{\\log_3 27} = 2^{\\log_3 3^3} = 2^3 = 8$.\n\nNotăm $4^{\\log_9 x} = (2^2)^{\\log_9 x} = (2^{\\log_9 x})^2$.\n\nSubstituție $t = 2^{\\log_9 x} > 0$:\n$$t^2 - 6t + 8 = 0 \\Rightarrow (t-2)(t-4) = 0$$\n\n$t = 2 = 2^1 \\Rightarrow \\log_9 x = 1 \\Rightarrow x = 9$\n\n$t = 4 = 2^2 \\Rightarrow \\log_9 x = 2 \\Rightarrow x = 81$\n\n$$\\boxed{x \\in \\{9,\\; 81\\}}$$'
  },
  {
    id: 'log-ee-026', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 2 — produs cu 8 și rezultat 16',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $8 \\cdot 2^{x-4} = 16$.',
    solution: '$8 = 2^3$ și $16 = 2^4$:\n$$2^3 \\cdot 2^{x-4} = 2^4 \\Rightarrow 2^{x-1} = 2^4 \\Rightarrow x - 1 = 4$$\n\n$$\\boxed{x = 5}$$'
  },
  {
    id: 'log-ee-027', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant — baze 2 și 4',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\begin{vmatrix} 2^x & 12 \\\\ 4 & 4^x \\end{vmatrix} = 16$.',
    solution: 'Calculăm determinantul:\n$$2^x \\cdot 4^x - 12 \\cdot 4 = 16$$\n$$2^x \\cdot (2^2)^x - 48 = 16$$\n$$2^{3x} = 64 = 2^6 \\Rightarrow 3x = 6$$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-028', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponenți trigonometrici și substituție',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $9^{\\sin^2 x} - 3 \\cdot \\left(\\dfrac{1}{3}\\right)^{\\cos^2 x} = 6$.',
    solution: '$9^{\\sin^2 x} = 3^{2\\sin^2 x}$ și $\\left(\\dfrac{1}{3}\\right)^{\\cos^2 x} = 3^{-\\cos^2 x}$, deci:\n$$3^{2\\sin^2 x} - 3^{1-\\cos^2 x} = 6$$\n\nDeoarece $1 - \\cos^2 x = \\sin^2 x$:\n$$3^{2\\sin^2 x} - 3^{\\sin^2 x} = 6$$\n\nSubstituție $t = 3^{\\sin^2 x} > 0$:\n$$t^2 - t - 6 = 0 \\Rightarrow (t-3)(t+2) = 0$$\n\n$t = 3 \\Rightarrow 3^{\\sin^2 x} = 3^1 \\Rightarrow \\sin^2 x = 1 \\Rightarrow \\sin x = \\pm 1$\n\n$$\\boxed{x = \\dfrac{\\pi}{2} + k\\pi,\\; k \\in \\mathbb{Z}}$$'
  },
  {
    id: 'log-ee-029', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant — baza 3, rezultat 29',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\begin{vmatrix} 3^x & -2 \\\\ 1 & 9 \\end{vmatrix} = 29$.',
    solution: 'Calculăm determinantul:\n$$3^x \\cdot 9 - (-2) \\cdot 1 = 9 \\cdot 3^x + 2 = 29$$\n$$9 \\cdot 3^x = 27 \\Rightarrow 3^x = 3 = 3^1$$\n\n$$\\boxed{x = 1}$$'
  },
  {
    id: 'log-ee-030', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant — baze 4 și 2',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ ecuația $\\begin{vmatrix} 4^x & 2 \\\\ 3 & 2^x \\end{vmatrix} = 10$.',
    solution: 'Calculăm determinantul:\n$$4^x \\cdot 2^x - 2 \\cdot 3 = 10$$\n$$(2^2)^x \\cdot 2^x - 6 = 10$$\n$$2^{2x} \\cdot 2^x = 2^{3x} = 16 = 2^4 \\Rightarrow 3x = 4$$\n\n$$\\boxed{x = \\dfrac{4}{3}}$$'
  },
  {
    id: 'log-ee-031', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la aceeași bază — 2/3 și 1,5',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\left(\\dfrac{2}{3}\\right)^{-x} = (1{,}5)^3$.',
    solution: '$1{,}5 = \\dfrac{3}{2} = \\left(\\dfrac{2}{3}\\right)^{-1}$, deci:\n$$\\left(\\frac{2}{3}\\right)^{-x} = \\left(\\frac{2}{3}\\right)^{-3} \\Rightarrow -x = -3$$\n\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'log-ee-032', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 2 — 1/8 înmulțit cu 4^x',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\dfrac{1}{8} \\cdot 4^x = \\dfrac{1}{16}$.',
    solution: '$\\dfrac{1}{8} = 2^{-3}$, $4^x = 2^{2x}$ și $\\dfrac{1}{16} = 2^{-4}$:\n$$2^{-3} \\cdot 2^{2x} = 2^{-4} \\Rightarrow 2^{2x-3} = 2^{-4} \\Rightarrow 2x - 3 = -4 \\Rightarrow 2x = -1$$\n\n$$\\boxed{x = -\\dfrac{1}{2}}$$'
  },
  {
    id: 'log-ee-033', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponenți zecimali — grupare și raport',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ ecuația $5^{\\lg x} - 3^{\\lg x - 1} = 3^{\\lg x + 1} - 5^{\\lg x - 1}$.',
    solution: 'Notăm $a = 5^{\\lg x}$, $b = 3^{\\lg x}$. Ecuația devine:\n$$a - \\frac{b}{3} = 3b - \\frac{a}{5}$$\n\nAducem $a$ la stânga, $b$ la dreapta:\n$$a + \\frac{a}{5} = 3b + \\frac{b}{3} \\Rightarrow \\frac{6a}{5} = \\frac{10b}{3} \\Rightarrow \\frac{a}{b} = \\frac{10}{3} \\cdot \\frac{5}{6} = \\frac{25}{9}$$\n\n$$\\left(\\frac{5}{3}\\right)^{\\lg x} = \\left(\\frac{5}{3}\\right)^2 \\Rightarrow \\lg x = 2 \\Rightarrow x = 100$$\n\nD.V.A.: $x > 0$ ✓\n\n$$\\boxed{x = 100}$$'
  },
  {
    id: 'log-ee-034', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent fracționar în logaritm',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $2^{\\dfrac{3}{\\log_2 x}} = \\dfrac{1}{64}$.',
    solution: 'D.V.A.: $x > 0$, $x \\neq 1$.\n\n$\\dfrac{1}{64} = 2^{-6}$, deci:\n$$2^{\\frac{3}{\\log_2 x}} = 2^{-6} \\Rightarrow \\frac{3}{\\log_2 x} = -6 \\Rightarrow \\log_2 x = -\\frac{1}{2}$$\n$$x = 2^{-1/2} = \\frac{1}{\\sqrt{2}} = \\frac{\\sqrt{2}}{2}$$\n\n$$\\boxed{x = \\dfrac{\\sqrt{2}}{2}}$$'
  },
  {
    id: 'log-ee-035', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent cubic',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $2^{x^3-1} = \\left(\\dfrac{1}{2}\\right)^{1-x}$.',
    solution: '$\\left(\\dfrac{1}{2}\\right)^{1-x} = 2^{-(1-x)} = 2^{x-1}$, deci:\n$$2^{x^3-1} = 2^{x-1} \\Rightarrow x^3 - 1 = x - 1$$\n$$x^3 - x = 0 \\Rightarrow x(x-1)(x+1) = 0$$\n\n$$\\boxed{x \\in \\{-1,\\; 0,\\; 1\\}}$$'
  },
  {
    id: 'log-ee-036', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Calcul de expresie exponențială din condiție dată',
    statement: 'Calculați $E = 2^x + 2^{-x}$, știind că $4^x + 4^{-x} = 23$.',
    solution: 'Observăm că:\n$$(2^x + 2^{-x})^2 = 4^x + 2 \\cdot 2^x \\cdot 2^{-x} + 4^{-x} = (4^x + 4^{-x}) + 2 = 23 + 2 = 25$$\n\nDeoarece $2^x + 2^{-x} > 0$ (suma de termeni pozitivi):\n\n$$\\boxed{E = 2^x + 2^{-x} = 5}$$'
  },
  {
    id: 'log-ee-037', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu bază cosinus',
    statement: 'Rezolvați în mulțimea $\\mathbb{R}$ ecuația $\\left(\\cos\\dfrac{\\pi}{6}\\right)^{2x-2} = 1\\dfrac{7}{9}$.',
    solution: '$\\cos\\dfrac{\\pi}{6} = \\dfrac{\\sqrt{3}}{2}$ și $1\\dfrac{7}{9} = \\dfrac{16}{9}$.\n\n$$\\left(\\frac{\\sqrt{3}}{2}\\right)^{2(x-1)} = \\frac{16}{9}$$\n$$\\left(\\frac{3}{4}\\right)^{x-1} = \\frac{16}{9} = \\left(\\frac{4}{3}\\right)^2 = \\left(\\frac{3}{4}\\right)^{-2}$$\n$$x - 1 = -2$$\n\n$$\\boxed{x = -1}$$'
  },
  {
    id: 'log-ee-038', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu bază sinus',
    statement: 'Să se rezolve în mulțimea $\\mathbb{R}$ ecuația $\\left(\\sin\\dfrac{5\\pi}{6}\\right)^{3x-4} = \\sqrt{8}$.',
    solution: '$\\sin\\dfrac{5\\pi}{6} = \\sin\\left(\\pi - \\dfrac{\\pi}{6}\\right) = \\sin\\dfrac{\\pi}{6} = \\dfrac{1}{2}$.\n\n$\\sqrt{8} = 2\\sqrt{2} = 2^{3/2}$, deci:\n$$\\left(\\frac{1}{2}\\right)^{3x-4} = 2^{3/2} \\Rightarrow 2^{-(3x-4)} = 2^{3/2}$$\n$$-(3x-4) = \\frac{3}{2} \\Rightarrow -3x + 4 = \\frac{3}{2} \\Rightarrow -3x = -\\frac{5}{2}$$\n\n$$\\boxed{x = \\dfrac{5}{6}}$$'
  },
  {
    id: 'log-ee-039', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 5 — produs 5·25^{2x}',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $5 \\cdot 25^{2x} = 0{,}04$.',
    solution: '$25 = 5^2$ și $0{,}04 = \\dfrac{1}{25} = 5^{-2}$:\n$$5^1 \\cdot (5^2)^{2x} = 5^{-2} \\Rightarrow 5^{4x+1} = 5^{-2}$$\n$$4x + 1 = -2 \\Rightarrow 4x = -3$$\n\n$$\\boxed{x = -\\dfrac{3}{4}}$$'
  },
  {
    id: 'log-ee-040', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație definită prin determinant D(x) — baze 2 și 4',
    statement: 'Fie $D(x) = \\begin{vmatrix} 2^{x-1} & 4 \\\\ 8 & 4^x \\end{vmatrix}$. Rezolvați în $\\mathbb{R}$ ecuația $D(x) = 0$.',
    solution: 'Calculăm determinantul:\n$$D(x) = 2^{x-1} \\cdot 4^x - 4 \\cdot 8 = 2^{x-1} \\cdot 2^{2x} - 32 = 2^{3x-1} - 2^5$$\n\n$D(x) = 0 \\Rightarrow 2^{3x-1} = 2^5 \\Rightarrow 3x - 1 = 5 \\Rightarrow 3x = 6$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-041', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent pătratic — soluții întregi',
    statement: 'Determinați soluțiile întregi ale ecuației $125^{x^2} = 25^{x+4}$.',
    solution: '$125 = 5^3$ și $25 = 5^2$:\n$$(5^3)^{x^2} = (5^2)^{x+4} \\Rightarrow 5^{3x^2} = 5^{2x+8}$$\n$$3x^2 = 2x + 8 \\Rightarrow 3x^2 - 2x - 8 = 0$$\n$$\\Delta = 4 + 96 = 100 \\Rightarrow x = \\frac{2 \\pm 10}{6}$$\n\n$x_1 = 2 \\in \\mathbb{Z}$ ✓ și $x_2 = -\\dfrac{4}{3} \\notin \\mathbb{Z}$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-042', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la aceeași bază — 2,5 și 0,4',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $(2{,}5)^{-3x+4} \\cdot (0{,}4)^{5x-2} = \\dfrac{4}{25}$.',
    solution: '$2{,}5 = \\dfrac{5}{2}$ și $0{,}4 = \\dfrac{2}{5} = \\left(\\dfrac{5}{2}\\right)^{-1}$:\n$$\\left(\\frac{5}{2}\\right)^{-3x+4} \\cdot \\left(\\frac{5}{2}\\right)^{-(5x-2)} = \\frac{4}{25}$$\n$$\\left(\\frac{5}{2}\\right)^{-8x+6} = \\left(\\frac{2}{5}\\right)^{-2} \\cdot \\left(\\frac{2}{5}\\right)^0$$\n\n$\\dfrac{4}{25} = \\left(\\dfrac{2}{5}\\right)^2 = \\left(\\dfrac{5}{2}\\right)^{-2}$, deci:\n$$-8x + 6 = -2 \\Rightarrow 8x = 8$$\n\n$$\\boxed{x = 1}$$'
  },
  {
    id: 'log-ee-043', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 5 — 25 și 1/5',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $25^{x-3} = \\left(\\dfrac{1}{5}\\right)^{-x}$.',
    solution: '$25 = 5^2$ și $\\left(\\dfrac{1}{5}\\right)^{-x} = (5^{-1})^{-x} = 5^x$:\n$$(5^2)^{x-3} = 5^x \\Rightarrow 5^{2x-6} = 5^x$$\n$$2x - 6 = x$$\n\n$$\\boxed{x = 6}$$'
  },
  {
    id: 'log-ee-044', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent radical — substituție',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\left(\\dfrac{4}{25}\\right)^{-x+2} = 2{,}5^{-\\sqrt{x}} \\cdot 0{,}4$.',
    solution: 'D.V.A.: $x \\geq 0$.\n\n$\\dfrac{4}{25} = \\left(\\dfrac{2}{5}\\right)^2$, $2{,}5^{-\\sqrt{x}} = \\left(\\dfrac{5}{2}\\right)^{-\\sqrt{x}} = \\left(\\dfrac{2}{5}\\right)^{\\sqrt{x}}$ și $0{,}4 = \\dfrac{2}{5}$:\n$$\\left(\\frac{2}{5}\\right)^{2(-x+2)} = \\left(\\frac{2}{5}\\right)^{\\sqrt{x}} \\cdot \\left(\\frac{2}{5}\\right)^1$$\n$$-2x + 4 = \\sqrt{x} + 1 \\Rightarrow 2x + \\sqrt{x} - 3 = 0$$\n\nSubstituție $t = \\sqrt{x} \\geq 0$ ($x = t^2$):\n$$2t^2 + t - 3 = 0 \\Rightarrow (2t+3)(t-1) = 0$$\n\n$t = 1$ (acceptat), $t = -\\dfrac{3}{2}$ (respins)\n$$\\sqrt{x} = 1 \\Rightarrow x = 1$$\n\n$$\\boxed{x = 1}$$'
  },
  {
    id: 'log-ee-045', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent pătratic — baza 1/5',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\left(\\dfrac{1}{5}\\right)^{x+3-x^2} - 125 = 0$.',
    solution: '$125 = 5^3 = \\left(\\dfrac{1}{5}\\right)^{-3}$, deci:\n$$\\left(\\frac{1}{5}\\right)^{x+3-x^2} = \\left(\\frac{1}{5}\\right)^{-3} \\Rightarrow x + 3 - x^2 = -3$$\n$$x^2 - x - 6 = 0 \\Rightarrow (x-3)(x+2) = 0$$\n\n$$\\boxed{x \\in \\{-2,\\; 3\\}}$$'
  },
  {
    id: 'log-ee-046', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent pătratic — baza 2',
    statement: 'Determinați soluțiile reale ale ecuației $2^{x^2+3x} = 16$.',
    solution: '$16 = 2^4$, deci:\n$$2^{x^2+3x} = 2^4 \\Rightarrow x^2 + 3x = 4$$\n$$x^2 + 3x - 4 = 0 \\Rightarrow (x+4)(x-1) = 0$$\n\n$$\\boxed{x \\in \\{-4,\\; 1\\}}$$'
  },
  {
    id: 'log-ee-047', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent pătratic — baza 0,5',
    statement: 'Determinați soluțiile reale ale ecuației $(0{,}5)^{-x^2+3} = 0{,}25$.',
    solution: '$0{,}5 = \\dfrac{1}{2}$ și $0{,}25 = \\dfrac{1}{4} = \\left(\\dfrac{1}{2}\\right)^2$:\n$$\\left(\\frac{1}{2}\\right)^{-x^2+3} = \\left(\\frac{1}{2}\\right)^2 \\Rightarrow -x^2 + 3 = 2$$\n$$x^2 = 1$$\n\n$$\\boxed{x \\in \\{-1,\\; 1\\}}$$'
  },
  {
    id: 'log-ee-048', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 2 — produs cu 8',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $4^{-3x-6} = 2^{-x} \\cdot 8$.',
    solution: '$4 = 2^2$ și $8 = 2^3$:\n$$(2^2)^{-3x-6} = 2^{-x} \\cdot 2^3 \\Rightarrow 2^{-6x-12} = 2^{-x+3}$$\n$$-6x - 12 = -x + 3 \\Rightarrow -5x = 15$$\n\n$$\\boxed{x = -3}$$'
  },
  {
    id: 'log-ee-049', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la baza 10 — produs 2·5 cu exponent pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $2^{x^2-1} \\cdot 5^{x^2-1} = 0{,}001 \\cdot (10^{x+2})^3$.',
    solution: 'Stânga: $2^{x^2-1} \\cdot 5^{x^2-1} = (2 \\cdot 5)^{x^2-1} = 10^{x^2-1}$.\n\nDreapta: $0{,}001 = 10^{-3}$, deci $10^{-3} \\cdot 10^{3(x+2)} = 10^{3x+3}$.\n\nEcuația devine:\n$$10^{x^2-1} = 10^{3x+3} \\Rightarrow x^2 - 1 = 3x + 3$$\n$$x^2 - 3x - 4 = 0 \\Rightarrow (x-4)(x+1) = 0$$\n\n$$\\boxed{x \\in \\{-1,\\; 4\\}}$$'
  },
  {
    id: 'log-ee-050', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la baza 2 — fracție cu putere în numitor',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $(0{,}25)^x = \\dfrac{128}{2^{x-1}}$.',
    solution: '$0{,}25 = \\dfrac{1}{4} = 2^{-2}$ și $128 = 2^7$:\n$$2^{-2x} = \\frac{2^7}{2^{x-1}} = 2^{7-(x-1)} = 2^{8-x}$$\n$$-2x = 8 - x \\Rightarrow -x = 8$$\n\n$$\\boxed{x = -8}$$'
  },
  {
    id: 'log-ee-051', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent pătratic — soluții iraționale',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $(0{,}5)^{x^2} \\cdot 2^{2x+3} = 64^{-1}$.',
    solution: '$0{,}5 = \\dfrac{1}{2} = 2^{-1}$ și $64^{-1} = 2^{-6}$:\n$$2^{-x^2} \\cdot 2^{2x+3} = 2^{-6} \\Rightarrow 2^{-x^2+2x+3} = 2^{-6}$$\n$$-x^2 + 2x + 3 = -6 \\Rightarrow x^2 - 2x - 9 = 0$$\n$$\\Delta = 4 + 36 = 40 \\Rightarrow x = \\frac{2 \\pm 2\\sqrt{10}}{2} = 1 \\pm \\sqrt{10}$$\n\n$$\\boxed{x \\in \\{1 - \\sqrt{10},\\; 1 + \\sqrt{10}\\}}$$'
  },
  {
    id: 'log-ee-052', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la aceeași bază cu raport de logaritmi',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\left(\\dfrac{4}{9}\\right)^x \\cdot \\left(\\dfrac{27}{8}\\right)^{x-1} = \\dfrac{\\lg 4}{\\lg 8}$.',
    solution: '$\\dfrac{\\lg 4}{\\lg 8} = \\dfrac{2\\lg 2}{3\\lg 2} = \\dfrac{2}{3}$.\n\n$\\dfrac{4}{9} = \\left(\\dfrac{2}{3}\\right)^2$ și $\\dfrac{27}{8} = \\left(\\dfrac{3}{2}\\right)^3 = \\left(\\dfrac{2}{3}\\right)^{-3}$:\n$$\\left(\\frac{2}{3}\\right)^{2x} \\cdot \\left(\\frac{2}{3}\\right)^{-3(x-1)} = \\left(\\frac{2}{3}\\right)^1$$\n$$2x - 3(x-1) = 1 \\Rightarrow 2x - 3x + 3 = 1 \\Rightarrow -x = -2$$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-053', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație exponențială cu exponent fracționar pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\left(\\dfrac{1}{8}\\right)^{\\frac{2x^2}{3}} = 4^{-x} \\cdot 8^{-4}$.',
    solution: '$\\dfrac{1}{8} = 2^{-3}$, $4 = 2^2$ și $8 = 2^3$:\n$$\\left(2^{-3}\\right)^{\\frac{2x^2}{3}} = 2^{-2x} \\cdot 2^{-12} \\Rightarrow 2^{-2x^2} = 2^{-2x-12}$$\n$$-2x^2 = -2x - 12 \\Rightarrow x^2 - x - 6 = 0$$\n$$(x-3)(x+2) = 0$$\n\n$$\\boxed{x \\in \\{-2,\\; 3\\}}$$'
  },
  {
    id: 'log-ee-054', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Reducere la baza 3/5 cu exponent pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $0{,}6 \\cdot \\left(\\dfrac{25}{9}\\right)^{x^2-12} = \\left(\\dfrac{27}{125}\\right)^3$.',
    solution: '$0{,}6 = \\dfrac{3}{5}$, $\\dfrac{25}{9} = \\left(\\dfrac{5}{3}\\right)^2 = \\left(\\dfrac{3}{5}\\right)^{-2}$ și $\\dfrac{27}{125} = \\left(\\dfrac{3}{5}\\right)^3$:\n$$\\left(\\frac{3}{5}\\right)^1 \\cdot \\left(\\frac{3}{5}\\right)^{-2(x^2-12)} = \\left(\\frac{3}{5}\\right)^9$$\n$$1 - 2(x^2-12) = 9 \\Rightarrow 1 - 2x^2 + 24 = 9$$\n$$2x^2 = 16 \\Rightarrow x^2 = 8$$\n\n$$\\boxed{x \\in \\{-2\\sqrt{2},\\; 2\\sqrt{2}\\}}$$'
  },
  {
    id: 'log-ee-055', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Suma soluțiilor ecuației exponențiale — baza 5/3',
    statement: 'Să se afle suma soluțiilor reale ale ecuației $\\left(\\dfrac{5}{3}\\right)^{x+1} \\cdot \\left(\\dfrac{9}{25}\\right)^{x^2+2x-11} = \\left(\\dfrac{3}{5}\\right)^{-9}$.',
    solution: '$\\dfrac{9}{25} = \\left(\\dfrac{3}{5}\\right)^2 = \\left(\\dfrac{5}{3}\\right)^{-2}$ și $\\left(\\dfrac{3}{5}\\right)^{-9} = \\left(\\dfrac{5}{3}\\right)^9$:\n$$\\left(\\frac{5}{3}\\right)^{x+1} \\cdot \\left(\\frac{5}{3}\\right)^{-2(x^2+2x-11)} = \\left(\\frac{5}{3}\\right)^9$$\n$$x+1 - 2(x^2+2x-11) = 9$$\n$$-2x^2 - 3x + 23 = 9 \\Rightarrow 2x^2 + 3x - 14 = 0$$\n$$\\Delta = 9 + 112 = 121 \\Rightarrow x = \\frac{-3 \\pm 11}{4}$$\n\n$x_1 = 2$ și $x_2 = -\\dfrac{7}{2}$\n\nSuma soluțiilor: $2 + \\left(-\\dfrac{7}{2}\\right) = \\boxed{-\\dfrac{3}{2}}$'
  },
  {
    id: 'log-ee-056', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Reducere la baza 3 — 9 la putere cu 1/27',
    statement: 'Să se rezolve în $\\mathbb{R}$ ecuația $9^{-4x-5} = 3^{-x} \\cdot \\dfrac{1}{27}$.',
    solution: '$9 = 3^2$ și $\\dfrac{1}{27} = 3^{-3}$:\n$$(3^2)^{-4x-5} = 3^{-x} \\cdot 3^{-3} \\Rightarrow 3^{-8x-10} = 3^{-x-3}$$\n$$-8x - 10 = -x - 3 \\Rightarrow -7x = 7$$\n\n$$\\boxed{x = -1}$$'
  },
  {
    id: 'log-ee-057', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație definită prin determinant D(x) — baze 3 și 9 (exponent mare)',
    statement: 'Fie $D(x) = \\begin{vmatrix} 3^{2x+8} & 27 \\\\ 3 & 9^{x+6} \\end{vmatrix}$. Rezolvați în $\\mathbb{R}$ ecuația $D(x) = 0$.',
    solution: 'Calculăm determinantul:\n$$D(x) = 3^{2x+8} \\cdot 9^{x+6} - 27 \\cdot 3 = 3^{2x+8} \\cdot 3^{2(x+6)} - 3^4$$\n$$= 3^{2x+8+2x+12} - 3^4 = 3^{4x+20} - 3^4$$\n\n$D(x) = 0 \\Rightarrow 3^{4x+20} = 3^4 \\Rightarrow 4x + 20 = 4 \\Rightarrow 4x = -16$\n\n$$\\boxed{x = -4}$$'
  },
  {
    id: 'log-ee-058', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Inecuație exponențială cu exponent pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația $\\left(\\dfrac{9}{2}\\right)^{x^2+x} \\geq \\left(\\dfrac{4}{81}\\right)^{2x-7}$.',
    solution: '$\\dfrac{4}{81} = \\left(\\dfrac{2}{9}\\right)^2 = \\left(\\dfrac{9}{2}\\right)^{-2}$:\n$$\\left(\\frac{9}{2}\\right)^{x^2+x} \\geq \\left(\\frac{9}{2}\\right)^{-2(2x-7)}$$\n\nDeoarece $\\dfrac{9}{2} > 1$, funcția este crescătoare:\n$$x^2 + x \\geq -4x + 14 \\Rightarrow x^2 + 5x - 14 \\geq 0$$\n$$(x+7)(x-2) \\geq 0$$\n\n$$\\boxed{x \\in (-\\infty,\\; -7] \\cup [2,\\; +\\infty)}$$'
  },
  {
    id: 'log-ee-059', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Ecuație exponențială definită prin determinant — baza 2, termen constant',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația $\\begin{vmatrix} 2^x+16 & 2^x \\\\ 2 & 1 \\end{vmatrix} = 0$.',
    solution: 'Calculăm determinantul:\n$$(2^x+16) \\cdot 1 - 2^x \\cdot 2 = 2^x + 16 - 2 \\cdot 2^x = -2^x + 16 = 0$$\n$$2^x = 16 = 2^4$$\n\n$$\\boxed{x = 4}$$'
  },
  {
    id: 'log-ee-060', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Ecuație definită prin determinant D(x) — baze 3 și 9 (versiune 2)',
    statement: 'Fie $D(x) = \\begin{vmatrix} 3^{3x-1} & 3 \\\\ 27 & 9^x \\end{vmatrix}$. Rezolvați în $\\mathbb{R}$ ecuația $D(x) = 0$.',
    solution: 'Calculăm determinantul:\n$$D(x) = 3^{3x-1} \\cdot 9^x - 3 \\cdot 27 = 3^{3x-1} \\cdot 3^{2x} - 3^4 = 3^{5x-1} - 3^4$$\n\n$D(x) = 0 \\Rightarrow 3^{5x-1} = 3^4 \\Rightarrow 5x - 1 = 4 \\Rightarrow 5x = 5$\n\n$$\\boxed{x = 1}$$'
  },

  /* ============================================================
     ALGEBRĂ — Ecuații logaritmice
     ============================================================ */
  {
    id: 'log-el-001', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu substituție exponențială',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_2(6 \\cdot 2^x - 4) = 2x + 1$$',
    solution: '**Domeniu:** $6 \\cdot 2^x - 4 > 0 \\Leftrightarrow 2^x > \\tfrac{2}{3}$, adevărat $\\forall x \\in \\mathbb{R}$.\n\n**Scriem membrul drept ca logaritm:**\n$$2x+1 = \\log_2 2^{2x+1} = \\log_2(2 \\cdot 4^x)$$\n\nEcuația devine $6 \\cdot 2^x - 4 = 2 \\cdot 4^x$. **Notăm** $t = 2^x > 0$:\n$$2t^2 - 6t + 4 = 0 \\Rightarrow t^2 - 3t + 2 = 0 \\Rightarrow (t-1)(t-2) = 0$$\n\n$$t = 1 \\Rightarrow 2^x = 1 \\Rightarrow x = 0 \\qquad t = 2 \\Rightarrow 2^x = 2 \\Rightarrow x = 1$$\n\n$$\\boxed{x \\in \\{0,\\; 1\\}}$$'
  },
  {
    id: 'log-el-002', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație cu logaritmi în baze reciproce',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_5(25x) + \\log_x 5 = 4$$',
    solution: '**Domeniu:** $x > 0$, $x \\neq 1$.\n\n$$\\log_5(25x) = \\log_5 25 + \\log_5 x = 2 + \\log_5 x$$\n\n**Notăm** $t = \\log_5 x$; prin schimbare de bază: $\\log_x 5 = \\dfrac{1}{t}$.\n$$2 + t + \\frac{1}{t} = 4 \\Rightarrow t + \\frac{1}{t} = 2 \\Rightarrow t^2 - 2t + 1 = 0 \\Rightarrow (t-1)^2 = 0$$\n$$t = 1 \\Rightarrow \\log_5 x = 1 \\Rightarrow x = 5 \\quad (5 \\neq 1 \\text{ ✓})$$\n\n$$\\boxed{x = 5}$$'
  },
  {
    id: 'log-el-003', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu fracție și radical',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\lg \\dfrac{\\sqrt{3-x}}{3x+5} = 0$$',
    solution: '**Domeniu:** $3-x > 0$ și $3x+5 > 0$ $\\Rightarrow x \\in \\bigl(-\\tfrac{5}{3},\\, 3\\bigr)$.\n\n$$\\frac{\\sqrt{3-x}}{3x+5} = 10^0 = 1 \\Rightarrow \\sqrt{3-x} = 3x+5$$\n\nCondiție: $3x+5 \\geq 0$ (satisfăcută în domeniu). Ridicăm la pătrat:\n$$3 - x = (3x+5)^2 = 9x^2 + 30x + 25 \\Rightarrow 9x^2 + 31x + 22 = 0$$\n$$\\Delta = 961 - 792 = 169 \\Rightarrow x = \\frac{-31 \\pm 13}{18}$$\n\n$x_1 = -1$ ✓ (în domeniu);\\ $x_2 = -\\dfrac{22}{9} \\approx -2{,}44$ (respins, $3x_2 + 5 < 0$)\n\n$$\\boxed{x = -1}$$'
  },
  {
    id: 'log-el-004', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație cu radical dintr-un logaritm',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\sqrt{\\log_2 x} + \\log_2 \\sqrt{x} = 4$$',
    solution: '**Domeniu:** $\\log_2 x \\geq 0 \\Rightarrow x \\geq 1$.\n\n$$\\log_2 \\sqrt{x} = \\tfrac{1}{2}\\log_2 x$$\n\n**Notăm** $t = \\sqrt{\\log_2 x} \\geq 0$, deci $\\log_2 x = t^2$:\n$$t + \\frac{t^2}{2} = 4 \\Rightarrow t^2 + 2t - 8 = 0 \\Rightarrow (t-2)(t+4) = 0$$\n\n$t = -4$ (respins); $t = 2$:\n$$\\sqrt{\\log_2 x} = 2 \\Rightarrow \\log_2 x = 4 \\Rightarrow \\boxed{x = 16}$$'
  },
  {
    id: 'log-el-005', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație pătratică în logaritm zecimal',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\lg^2(-x) - \\lg\\dfrac{x^2}{10} - 4 = 0$$',
    solution: '**Domeniu:** $-x > 0 \\Rightarrow x < 0$.\n\n$$\\lg\\frac{x^2}{10} = \\lg x^2 - \\lg 10 = 2\\lg(-x) - 1$$\n\n**Notăm** $t = \\lg(-x)$:\n$$t^2 - (2t - 1) - 4 = 0 \\Rightarrow t^2 - 2t - 3 = 0 \\Rightarrow (t-3)(t+1) = 0$$\n\n$t = 3 \\Rightarrow \\lg(-x) = 3 \\Rightarrow x = -1000$\n\n$t = -1 \\Rightarrow \\lg(-x) = -1 \\Rightarrow x = -\\dfrac{1}{10}$\n\n$$\\boxed{x \\in \\left\\{-1000,\\;-\\dfrac{1}{10}\\right\\}}$$'
  },
  {
    id: 'log-el-006', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu diferență de logaritmi',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$1 + \\lg x = \\lg(x+1)$$',
    solution: '**Domeniu:** $x > 0$.\n\n$$1 = \\lg(x+1) - \\lg x = \\lg\\frac{x+1}{x}$$\n$$\\frac{x+1}{x} = 10 \\Rightarrow x + 1 = 10x \\Rightarrow 9x = 1$$\n$$\\boxed{x = \\dfrac{1}{9}}$$'
  },
  {
    id: 'log-el-007', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Sumă de logaritmi în baza 9',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_9(x-6) + \\log_9(2x-3) = 2$$',
    solution: '**Domeniu:** $x - 6 > 0$ și $2x - 3 > 0$ $\\Rightarrow x > 6$.\n\n$$\\log_9[(x-6)(2x-3)] = 2 \\Rightarrow (x-6)(2x-3) = 81$$\n$$2x^2 - 15x + 18 = 81 \\Rightarrow 2x^2 - 15x - 63 = 0$$\n$$\\Delta = 225 + 504 = 729 = 27^2 \\Rightarrow x = \\frac{15 \\pm 27}{4}$$\n\n$x_1 = \\dfrac{21}{2} > 6$ ✓;\\ $x_2 = -3$ (respins)\n\n$$\\boxed{x = \\dfrac{21}{2}}$$'
  },
  {
    id: 'log-el-008', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Diferență de logaritmi egală cu zero',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_3(x+6) - \\log_3(x^2-36) = 0$$',
    solution: '**Domeniu:** $x + 6 > 0$ și $x^2 - 36 > 0$ $\\Rightarrow x > 6$.\n\n$$\\log_3 \\frac{x+6}{x^2-36} = 0 \\Rightarrow \\frac{x+6}{x^2-36} = 1$$\n\nDeoarece $x^2 - 36 = (x-6)(x+6)$, simplificăm cu $x + 6 > 0$:\n$$\\frac{1}{x-6} = 1 \\Rightarrow x - 6 = 1$$\n$$\\boxed{x = 7}$$'
  },
  {
    id: 'log-el-009', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Sumă de logaritmi în baza 2',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_2(x+1) + \\log_2(x-2) = 2$$',
    solution: '**Domeniu:** $x + 1 > 0$ și $x - 2 > 0$ $\\Rightarrow x > 2$.\n\n$$\\log_2[(x+1)(x-2)] = 2 \\Rightarrow (x+1)(x-2) = 4$$\n$$x^2 - x - 2 = 4 \\Rightarrow x^2 - x - 6 = 0 \\Rightarrow (x-3)(x+2) = 0$$\n\n$x = 3 > 2$ ✓;\\ $x = -2$ (respins)\n\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'log-el-010', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu baza variabilă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_x(4x^2 - 3x) = 3$$',
    solution: '**Domeniu:** $x > 0$, $x \\neq 1$, $4x^2 - 3x > 0 \\Rightarrow x > \\tfrac{3}{4}$.\n\n$$4x^2 - 3x = x^3 \\Rightarrow x^3 - 4x^2 + 3x = 0 \\Rightarrow x(x-1)(x-3) = 0$$\n\n$x = 0$ (respins);\\ $x = 1$ (baza $\\neq 1$, respins);\\ $x = 3$ ✓\n\nVerificare: $\\log_3(36 - 9) = \\log_3 27 = 3$ ✓\n\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'log-el-011', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Sumă de logaritmi în baza 6',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_6(2x-1) + \\log_6(x-6) = 1$$',
    solution: '**Domeniu:** $2x - 1 > 0$ și $x - 6 > 0$ $\\Rightarrow x > 6$.\n\n$$\\log_6[(2x-1)(x-6)] = 1 \\Rightarrow (2x-1)(x-6) = 6$$\n$$2x^2 - 13x + 6 = 6 \\Rightarrow 2x^2 - 13x = 0 \\Rightarrow x(2x-13) = 0$$\n\n$x = 0$ (respins);\\ $x = \\dfrac{13}{2} > 6$ ✓\n\nVerificare: $\\log_6 12 + \\log_6 \\tfrac{1}{2} = \\log_6 6 = 1$ ✓\n\n$$\\boxed{x = \\dfrac{13}{2}}$$'
  },
  {
    id: 'log-el-012', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație pătratică în logaritm baza 3',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$-2\\log_3(x^2) + \\log_3^2\\!\\left(\\dfrac{-x}{3}\\right) - 4 = 0$$',
    solution: '**Domeniu:** $\\dfrac{-x}{3} > 0 \\Rightarrow x < 0$ (și $x^2 > 0$ ✓).\n\n**Notăm** $t = \\log_3(-x)$:\n$$\\log_3(x^2) = \\log_3(-x)^2 = 2t$$\n$$\\log_3\\frac{-x}{3} = \\log_3(-x) - \\log_3 3 = t - 1$$\n\n$$-2(2t) + (t-1)^2 - 4 = 0$$\n$$-4t + t^2 - 2t + 1 - 4 = 0 \\Rightarrow t^2 - 6t - 3 = 0$$\n$$\\Delta = 36 + 12 = 48 \\Rightarrow t = 3 \\pm 2\\sqrt{3}$$\n\n$$x_1 = -3^{\\,3+2\\sqrt{3}}, \\qquad x_2 = -3^{\\,3-2\\sqrt{3}}$$\n\n(ambele $< 0$ ✓)\n\n$$\\boxed{x \\in \\bigl\\{-3^{3+2\\sqrt{3}},\\; -3^{3-2\\sqrt{3}}\\bigr\\}}$$'
  },

  {
    id: 'log-el-013', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație pătratică în lg cu coeficienți iraționali',
    statement: 'Să se rezolve în $\\mathbb{R}$ ecuația\n$$2\\lg^2 x + \\left(1-\\sqrt{2}\\right)\\lg x^2 = 2\\sqrt{2}$$',
    solution: '**Domeniu:** $x > 0$.\n\nDeoarece $\\lg x^2 = 2\\lg x$, **notăm** $t = \\lg x$:\n$$2t^2 + 2(1-\\sqrt{2})\\,t - 2\\sqrt{2} = 0 \\Rightarrow t^2 + (1-\\sqrt{2})\\,t - \\sqrt{2} = 0$$\n\n$$\\Delta = (1-\\sqrt{2})^2 + 4\\sqrt{2} = 3+2\\sqrt{2} = (1+\\sqrt{2})^2$$\n\n$$t = \\frac{-(1-\\sqrt{2})\\pm(1+\\sqrt{2})}{2}$$\n\n$t_1 = \\sqrt{2} \\Rightarrow \\lg x = \\sqrt{2} \\Rightarrow x = 10^{\\sqrt{2}}$\n\n$t_2 = -1 \\Rightarrow \\lg x = -1 \\Rightarrow x = \\dfrac{1}{10}$\n\n$$\\boxed{x \\in \\left\\{\\dfrac{1}{10},\\; 10^{\\sqrt{2}}\\right\\}}$$'
  },
  {
    id: 'log-el-014', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație cu radical dintr-un logaritm baza 3',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$3\\sqrt{\\log_3 x} - \\log_3(3x) - 1 = 0$$',
    solution: '**Domeniu:** $\\log_3 x \\geq 0 \\Rightarrow x \\geq 1$.\n\n$$\\log_3(3x) = 1 + \\log_3 x$$\n\n**Notăm** $t = \\sqrt{\\log_3 x} \\geq 0$, deci $\\log_3 x = t^2$:\n$$3t - (1+t^2) - 1 = 0 \\Rightarrow t^2 - 3t + 2 = 0 \\Rightarrow (t-1)(t-2) = 0$$\n\n$t = 1 \\Rightarrow \\log_3 x = 1 \\Rightarrow x = 3$\n\n$t = 2 \\Rightarrow \\log_3 x = 4 \\Rightarrow x = 81$\n\n$$\\boxed{x \\in \\{3,\\; 81\\}}$$'
  },
  {
    id: 'log-el-015', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu baza radical din 3',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_{\\sqrt{3}}\\!(x^2 - 5x - 3) = 2$$',
    solution: '**Domeniu:** $x^2 - 5x - 3 > 0$.\n\n$$x^2 - 5x - 3 = (\\sqrt{3})^2 = 3 \\Rightarrow x^2 - 5x - 6 = 0 \\Rightarrow (x-6)(x+1) = 0$$\n\nVerificăm condiția de domeniu:\n\n$x = 6$: $\\;36-30-3 = 3 > 0$ ✓\n\n$x = -1$: $\\;1+5-3 = 3 > 0$ ✓\n\n$$\\boxed{x \\in \\{-1,\\; 6\\}}$$'
  },
  {
    id: 'log-el-016', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Sistem de ecuații logaritmice în baza 3',
    statement: 'Rezolvați în $\\mathbb{R}\\times\\mathbb{R}$ sistemul de ecuații\n$$\\begin{cases} \\log_3 x + \\log_3 y = 2+\\log_3 2 \\\\ \\log_3(x+y) = 2 \\end{cases}$$',
    solution: '**Domeniu:** $x > 0$, $y > 0$, $x+y > 0$.\n\n**Din ecuația a doua:** $\\log_3(x+y) = 2 \\Rightarrow x+y = 9$.\n\n**Din ecuația întâi:**\n$$\\log_3(xy) = 2+\\log_3 2 = \\log_3 9 + \\log_3 2 = \\log_3 18 \\Rightarrow xy = 18$$\n\n$x$ și $y$ sunt rădăcinile ecuației $t^2 - 9t + 18 = 0$:\n$$(t-3)(t-6) = 0 \\Rightarrow t \\in \\{3,\\, 6\\}$$\n\n$$\\boxed{(x,y) \\in \\{(3,\\,6),\\;(6,\\,3)\\}}$$'
  },
  {
    id: 'log-el-017', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu polinom pătratic în baza 2',
    statement: 'Să se rezolve în $\\mathbb{R}$ ecuația\n$$\\log_2(x^2 - 3x + 10) = 3$$',
    solution: '**Domeniu:** $x^2-3x+10 > 0$ ($\\Delta = 9-40 < 0$, deci pozitiv $\\forall x\\in\\mathbb{R}$).\n\n$$x^2 - 3x + 10 = 2^3 = 8 \\Rightarrow x^2 - 3x + 2 = 0 \\Rightarrow (x-1)(x-2) = 0$$\n\n$$\\boxed{x \\in \\{1,\\; 2\\}}$$'
  },
  {
    id: 'log-el-018', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică compusă cu putere de 7',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_3\\!\\sqrt{130 - 7^{\\log_x(6-x)}} = 2$$',
    solution: '**Domeniu:** $x \\in (0,6)\\setminus\\{1\\}$.\n\n**Pasul 1.** Eliminăm radicalul și logaritmul exterior:\n$$\\sqrt{130 - 7^{\\log_x(6-x)}} = 9 \\Rightarrow 7^{\\log_x(6-x)} = 130-81 = 49 = 7^2$$\n\n$$\\Rightarrow \\log_x(6-x) = 2 \\Rightarrow 6-x = x^2$$\n\n**Pasul 2.** Rezolvăm ecuația pătratică:\n$$x^2+x-6=0 \\Rightarrow (x-2)(x+3)=0$$\n\n$x=2 \\in (0,6)\\setminus\\{1\\}$ ✓;\\ $x=-3$ (respins)\n\nVerificare: $\\log_2 4=2$ ✓ și $\\log_3\\sqrt{81}=\\log_3 9=2$ ✓\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-el-019', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație cu radical dintr-un logaritm baza 2',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$3\\sqrt{\\log_2 x} - \\log_2(8x) + 1 = 0$$',
    solution: '**Domeniu:** $\\log_2 x \\geq 0 \\Rightarrow x \\geq 1$.\n\n$$\\log_2(8x) = 3+\\log_2 x$$\n\n**Notăm** $t = \\sqrt{\\log_2 x} \\geq 0$, deci $\\log_2 x = t^2$:\n$$3t-(3+t^2)+1=0 \\Rightarrow t^2-3t+2=0 \\Rightarrow (t-1)(t-2)=0$$\n\n$t=1 \\Rightarrow \\log_2 x=1 \\Rightarrow x=2$\n\n$t=2 \\Rightarrow \\log_2 x=4 \\Rightarrow x=16$\n\n$$\\boxed{x \\in \\{2,\\; 16\\}}$$'
  },
  {
    id: 'log-el-020', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu radical în argument',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$0{,}5\\,\\lg(8-x) = \\lg\\!\\left(1+\\sqrt{x+5}\\right)$$',
    solution: '**Domeniu:** $8-x > 0$ și $x+5 \\geq 0$ $\\Rightarrow x \\in [-5,\\,8)$.\n\n$$\\lg\\sqrt{8-x} = \\lg(1+\\sqrt{x+5}) \\Rightarrow \\sqrt{8-x} = 1+\\sqrt{x+5}$$\n\n**Notăm** $u = \\sqrt{x+5} \\geq 0$, deci $x = u^2-5$:\n$$\\sqrt{13-u^2} = 1+u$$\n\nRidicăm la pătrat (ambii membri $\\geq 0$ ✓):\n$$13-u^2 = 1+2u+u^2 \\Rightarrow 2u^2+2u-12=0 \\Rightarrow (u+3)(u-2)=0$$\n\n$u=-3$ (respins);\\ $u=2 \\Rightarrow x=4-5=-1$\n\nVerificare: $0{,}5\\,\\lg 9 = \\lg 3$ și $\\lg(1+2)=\\lg 3$ ✓\n\n$$\\boxed{x = -1}$$'
  },
  {
    id: 'log-el-021', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu termen exponențial mixt',
    statement: 'Să se rezolve în $\\mathbb{R}$ ecuația\n$$\\lg\\!\\left(3\\cdot 5^x+24\\cdot 20^x\\right) = x+\\lg 18$$',
    solution: '**Domeniu:** $3\\cdot 5^x+24\\cdot 20^x > 0$ (adevărat $\\forall x\\in\\mathbb{R}$).\n\n$$\\lg(3\\cdot 5^x+24\\cdot 20^x) = \\lg(18\\cdot 10^x)$$\n$$\\Rightarrow 3\\cdot 5^x+24\\cdot 20^x = 18\\cdot 10^x$$\n\nÎmpărțim prin $5^x$:\n$$3+24\\cdot 4^x = 18\\cdot 2^x$$\n\n**Notăm** $t = 2^x > 0$:\n$$24t^2-18t+3=0 \\Rightarrow 8t^2-6t+1=0 \\Rightarrow (4t-1)(2t-1)=0$$\n\n$t=\\dfrac{1}{4} \\Rightarrow 2^x=2^{-2} \\Rightarrow x=-2$\n\n$t=\\dfrac{1}{2} \\Rightarrow 2^x=2^{-1} \\Rightarrow x=-1$\n\n$$\\boxed{x \\in \\{-2,\\;-1\\}}$$'
  },
  {
    id: 'log-el-022', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică zecimală cu polinom pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\lg(x^2-x+8)=1$$',
    solution: '**Domeniu:** $x^2-x+8>0$ ($\\Delta=1-32<0$, deci pozitiv $\\forall x\\in\\mathbb{R}$).\n\n$$x^2-x+8=10 \\Rightarrow x^2-x-2=0 \\Rightarrow (x-2)(x+1)=0$$\n\n$$\\boxed{x \\in \\{-1,\\; 2\\}}$$'
  },
  {
    id: 'log-el-023', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Aflarea lui x din relație cu proprietăți de logaritmi',
    statement: 'Să se afle $x$, știind că\n$$\\log_5 x = 2\\cdot\\log_5 3+\\frac{1}{2}\\cdot\\log_5 49-\\frac{1}{3}\\cdot\\log_5 27$$',
    solution: 'Aplicăm proprietățile logaritmilor:\n$$2\\log_5 3 = \\log_5 9,\\qquad \\frac{1}{2}\\log_5 49 = \\log_5 7,\\qquad \\frac{1}{3}\\log_5 27 = \\log_5 3$$\n\n$$\\log_5 x = \\log_5 9+\\log_5 7-\\log_5 3 = \\log_5\\frac{9\\cdot 7}{3} = \\log_5 21$$\n\n$$\\boxed{x = 21}$$'
  },
  {
    id: 'log-el-024', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație pătratică în log baza 3 cu argument negativ',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_3^2(-x) - 2\\log_3\\!\\left(\\dfrac{x^2}{27}\\right) - 6 = 0$$',
    solution: '**Domeniu:** $-x > 0 \\Rightarrow x < 0$.\n\nDeoarece $x < 0$, $x^2 = (-x)^2$, deci:\n$$\\log_3\\frac{x^2}{27} = \\log_3(-x)^2 - \\log_3 27 = 2\\log_3(-x) - 3$$\n\n**Notăm** $t = \\log_3(-x)$:\n$$t^2 - 2(2t-3) - 6 = 0 \\Rightarrow t^2 - 4t = 0 \\Rightarrow t(t-4) = 0$$\n\n$t = 0 \\Rightarrow -x = 1 \\Rightarrow x = -1$\n\n$t = 4 \\Rightarrow -x = 81 \\Rightarrow x = -81$\n\nVerificare:\n\n$x=-1$: $\\;0^2 - 2\\log_3\\!\\tfrac{1}{27} - 6 = 6 - 6 = 0$ ✓\n\n$x=-81$: $\\;4^2 - 2\\log_3 243 - 6 = 16 - 10 - 6 = 0$ ✓\n\n$$\\boxed{x \\in \\{-81,\\; -1\\}}$$'
  },
  {
    id: 'log-el-025', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație cu modulul logaritmului natural',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\ln^2 x + 2|\\ln x| - 3 = 0$$',
    solution: '**Domeniu:** $x > 0$.\n\n**Notăm** $u = |\\ln x| \\geq 0$, deci $\\ln^2 x = u^2$:\n$$u^2 + 2u - 3 = 0 \\Rightarrow (u+3)(u-1) = 0$$\n\n$u = -3$ (respins, $u \\geq 0$);\\ $u = 1$:\n$$|\\ln x| = 1 \\Rightarrow \\ln x = 1 \\text{ sau } \\ln x = -1$$\n$$x = e \\qquad x = e^{-1} = \\frac{1}{e}$$\n\nAmbele $> 0$ ✓\n\n$$\\boxed{x \\in \\left\\{\\dfrac{1}{e},\\; e\\right\\}}$$'
  },
  {
    id: 'log-el-026', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Sumă de logaritmi în baza 2 egală cu 1',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_2(x-1) + \\log_2(x-2) = 1$$',
    solution: '**Domeniu:** $x - 1 > 0$ și $x - 2 > 0$ $\\Rightarrow x > 2$.\n\n$$\\log_2[(x-1)(x-2)] = 1 \\Rightarrow (x-1)(x-2) = 2$$\n$$x^2 - 3x + 2 = 2 \\Rightarrow x^2 - 3x = 0 \\Rightarrow x(x-3) = 0$$\n\n$x = 0$ (respins);\\ $x = 3 > 2$ ✓\n\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'log-el-027', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică ce se reduce la pătratică',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_3(x+2) = 2\\log_3 x$$',
    solution: '**Domeniu:** $x + 2 > 0$ și $x > 0$ $\\Rightarrow x > 0$.\n\n$$\\log_3(x+2) = \\log_3 x^2 \\Rightarrow x+2 = x^2$$\n$$x^2 - x - 2 = 0 \\Rightarrow (x-2)(x+1) = 0$$\n\n$x = 2 > 0$ ✓;\\ $x = -1$ (respins)\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-el-028', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'dificil', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu baza variabilă x',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_x(-3x+4) = 2$$',
    solution: '**Domeniu:** $x > 0$, $x \\neq 1$, $-3x+4 > 0 \\Rightarrow x < \\dfrac{4}{3}$.\n\nDomeniu: $x \\in \\left(0,\\,\\dfrac{4}{3}\\right)$, $x \\neq 1$.\n\n$$-3x+4 = x^2 \\Rightarrow x^2+3x-4 = 0 \\Rightarrow (x+4)(x-1) = 0$$\n\n$x = -4$ (respins, $\\notin$ domeniu)\n\n$x = 1$ (respins, baza $\\neq 1$)\n\n$$\\boxed{x \\in \\emptyset}$$'
  },
  {
    id: 'log-el-029', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu baza x−1',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_{x-1}(x+19) = 2$$',
    solution: '**Domeniu:** $x-1 > 0 \\Rightarrow x > 1$, $x-1 \\neq 1 \\Rightarrow x \\neq 2$.\n\n$$x+19 = (x-1)^2 = x^2-2x+1 \\Rightarrow x^2-3x-18 = 0 \\Rightarrow (x-6)(x+3) = 0$$\n\n$x = 6 > 1$, $x \\neq 2$ ✓\n\n$x = -3$ (respins, $\\notin$ domeniu)\n\nVerificare: $\\log_5 25 = \\log_5 5^2 = 2$ ✓\n\n$$\\boxed{x = 6}$$'
  },
  {
    id: 'log-el-030', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică baza 3 cu argument pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_3(x^2-1) = 1$$',
    solution: '**Domeniu:** $x^2-1 > 0 \\Rightarrow |x| > 1$, adică $x < -1$ sau $x > 1$.\n\n$$x^2-1 = 3^1 = 3 \\Rightarrow x^2 = 4 \\Rightarrow x = \\pm 2$$\n\nAmbele satisfac $|x| > 1$ ✓\n\nVerificare: $\\log_3(4-1) = \\log_3 3 = 1$ ✓\n\n$$\\boxed{x \\in \\{-2,\\; 2\\}}$$'
  },
  {
    id: 'log-el-031', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică baza 5 cu argument pătratic',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_5(x^2+1) = 1$$',
    solution: '**Domeniu:** $x^2+1 > 0$ (adevărat $\\forall x \\in \\mathbb{R}$).\n\n$$x^2+1 = 5^1 = 5 \\Rightarrow x^2 = 4 \\Rightarrow x = \\pm 2$$\n\nVerificare: $\\log_5(4+1) = \\log_5 5 = 1$ ✓\n\n$$\\boxed{x \\in \\{-2,\\; 2\\}}$$'
  },
  {
    id: 'log-el-032', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică cu baza radical din 6',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_{\\sqrt{6}}(x^2-5) = 2$$',
    solution: '**Domeniu:** $x^2-5 > 0 \\Rightarrow |x| > \\sqrt{5}$.\n\n$$x^2-5 = (\\sqrt{6})^2 = 6 \\Rightarrow x^2 = 11 \\Rightarrow x = \\pm\\sqrt{11}$$\n\n$\\sqrt{11} > \\sqrt{5}$ ✓\n\n$$\\boxed{x \\in \\{-\\sqrt{11},\\; \\sqrt{11}\\}}$$'
  },
  {
    id: 'log-el-033', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică baza 1/2 fără soluție reală',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_{\\frac{1}{2}}(x^2+1) = 2$$',
    solution: '**Domeniu:** $x^2+1 > 0$ (adevărat $\\forall x \\in \\mathbb{R}$).\n\n$$x^2+1 = \\left(\\tfrac{1}{2}\\right)^2 = \\frac{1}{4} \\Rightarrow x^2 = -\\frac{3}{4}$$\n\nEcuația nu are soluție reală deoarece $x^2 \\geq 0$.\n\n$$\\boxed{x \\in \\emptyset}$$'
  },
  {
    id: 'log-el-034', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'Culegere de matematică, clasa a XI-a',
    title: 'Ecuație logaritmică baza 1/2 cu exponent negativ',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația\n$$\\log_{\\frac{1}{2}}(x^2-4x-1) = -2$$',
    solution: '**Domeniu:** $x^2-4x-1 > 0$; rădăcini: $x = 2 \\pm \\sqrt{5}$.\n\nDomeniu: $x < 2-\\sqrt{5}$ sau $x > 2+\\sqrt{5}$.\n\n$$x^2-4x-1 = \\left(\\tfrac{1}{2}\\right)^{-2} = 4 \\Rightarrow x^2-4x-5 = 0 \\Rightarrow (x-5)(x+1) = 0$$\n\n$x = 5 > 2+\\sqrt{5} \\approx 4{,}24$ ✓\n\n$x = -1 < 2-\\sqrt{5} \\approx -0{,}24$ ✓\n\nVerificare: $25-20-1 = 4 = \\left(\\tfrac{1}{2}\\right)^{-2}$ ✓;\\ $1+4-1 = 4$ ✓\n\n$$\\boxed{x \\in \\{-1,\\; 5\\}}$$'
  },

  /* ============================================================
     ALGEBRĂ — Inecuații logaritmice
     ============================================================ */
  {
    id: 'log-il-001', categoryId: 'algebra', subcategoryId: 'inec-log',
    difficulty: 'usor', source: 'BAC 2022, Varianta 1',
    title: 'Inecuație logaritmică simplă',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$\\log_3(x) < 2$$',
    solution: 'Domeniu: $x > 0$\n\nBaza $3 > 1$ → funcție crescătoare:\n$$\\log_3(x) < \\log_3(9) \\Rightarrow x < 9$$\n\n$$\\boxed{x \\in (0,\\, 9)}$$'
  },
  {
    id: 'log-il-002', categoryId: 'algebra', subcategoryId: 'inec-log',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 33',
    title: 'Inecuație cu baza subunitară',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$\\log_{0.5}(x+1) < \\log_{0.5}(3-x)$$',
    solution: 'Domeniu: $x > -1$ și $x < 3$, deci $x \\in (-1, 3)$\n\nBaza $0{,}5 < 1$ → funcție **descrescătoare** → inversăm inegalitatea:\n$$x + 1 > 3 - x \\Rightarrow 2x > 2 \\Rightarrow x > 1$$\n\n$$\\boxed{x \\in (1,\\, 3)}$$'
  },

  /* ============================================================
     ALGEBRĂ — Trigonometrie: Valori
     ============================================================ */
  {
    id: 'trig-v-001', categoryId: 'algebra', subcategoryId: 'trigonometrie',
    difficulty: 'usor', source: 'BAC 2022, Varianta 3',
    title: 'Calcul cu valori trigonometrice exacte',
    statement: 'Calculați valoarea expresiei:\n$$E = \\sin\\frac{\\pi}{6} + \\cos\\frac{\\pi}{3} - 2\\sin\\frac{\\pi}{2}$$',
    solution: '$$\\sin\\frac{\\pi}{6} = \\frac{1}{2},\\quad \\cos\\frac{\\pi}{3} = \\frac{1}{2},\\quad \\sin\\frac{\\pi}{2} = 1$$\n\n$$E = \\frac{1}{2} + \\frac{1}{2} - 2 = 1 - 2$$\n\n$$\\boxed{E = -1}$$'
  },
  {
    id: 'trig-v-002', categoryId: 'algebra', subcategoryId: 'trigonometrie',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 28',
    title: 'Formula sinusului sumei',
    statement: 'Calculați $\\sin 75°$ folosind formula sinusului sumei.',
    solution: '$$\\sin 75° = \\sin(45° + 30°) = \\sin 45°\\cos 30° + \\cos 45°\\sin 30°$$\n$$= \\frac{\\sqrt{2}}{2} \\cdot \\frac{\\sqrt{3}}{2} + \\frac{\\sqrt{2}}{2} \\cdot \\frac{1}{2} = \\frac{\\sqrt{6}}{4} + \\frac{\\sqrt{2}}{4}$$\n\n$$\\boxed{\\sin 75° = \\frac{\\sqrt{6}+\\sqrt{2}}{4}}$$'
  },
  {
    id: 'trig-v-003', categoryId: 'algebra', subcategoryId: 'trigonometrie',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 22',
    title: 'Identitate trigonometrică — demonstrație',
    statement: 'Demonstrați că pentru orice $x \\in \\mathbb{R}$:\n$$(\\sin x - \\cos x)^2 = 1 - \\sin 2x$$',
    solution: '$$\\text{S.S.} = \\sin^2 x - 2\\sin x\\cos x + \\cos^2 x$$\n$$= (\\sin^2 x + \\cos^2 x) - 2\\sin x\\cos x$$\n$$= 1 - \\sin 2x = \\text{S.D.} \\quad \\square$$'
  },

  /* ============================================================
     ALGEBRĂ — Trigonometrie: Ecuații
     ============================================================ */
  {
    id: 'trig-ec-001', categoryId: 'algebra', subcategoryId: 'trigonometrie',
    difficulty: 'usor', source: 'BAC 2022, Varianta 21',
    title: 'Ecuație trigonometrică — cos x = 1/2',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$\\cos x = \\frac{1}{2}$$',
    solution: '$$\\cos x = \\cos\\frac{\\pi}{3}$$\n\nSoluțiile generale: $\\cos x = \\cos\\alpha \\iff x = \\pm\\alpha + 2k\\pi$\n\n$$\\boxed{x = \\pm\\frac{\\pi}{3} + 2k\\pi, \\quad k \\in \\mathbb{Z}}$$'
  },
  {
    id: 'trig-ec-002', categoryId: 'algebra', subcategoryId: 'trigonometrie',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 16',
    title: 'Ecuație trigonometrică de gradul 2 în cos x',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$2\\cos^2 x - \\cos x - 1 = 0$$',
    solution: 'Substituție: $t = \\cos x,\\; t \\in [-1,1]$\n$$2t^2 - t - 1 = 0 \\Rightarrow (2t+1)(t-1) = 0$$\n\n$t_1 = 1 \\Rightarrow \\cos x = 1 \\Rightarrow x = 2k\\pi$\n\n$t_2 = -\\dfrac{1}{2} \\Rightarrow \\cos x = -\\dfrac{1}{2} \\Rightarrow x = \\pm\\dfrac{2\\pi}{3} + 2k\\pi$\n\n$$\\boxed{x = 2k\\pi \\text{ sau } x = \\pm\\frac{2\\pi}{3} + 2k\\pi,\\; k\\in\\mathbb{Z}}$$'
  },
  {
    id: 'trig-ec-003', categoryId: 'algebra', subcategoryId: 'trigonometrie',
    difficulty: 'dificil', source: 'BAC 2022, Varianta 32',
    title: 'Ecuație cu sin x + cos x',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$\\sin x + \\cos x = 1$$',
    solution: 'Scriem în forma $R\\sin(x+\\varphi)$:\n$$\\sqrt{2}\\,\\sin\\!\\left(x+\\frac{\\pi}{4}\\right) = 1 \\Rightarrow \\sin\\!\\left(x+\\frac{\\pi}{4}\\right) = \\frac{1}{\\sqrt{2}} = \\sin\\frac{\\pi}{4}$$\n\n$x + \\dfrac{\\pi}{4} = \\dfrac{\\pi}{4} + 2k\\pi \\Rightarrow x = 2k\\pi$\n\n$x + \\dfrac{\\pi}{4} = \\dfrac{3\\pi}{4} + 2k\\pi \\Rightarrow x = \\dfrac{\\pi}{2} + 2k\\pi$\n\n$$\\boxed{x = 2k\\pi \\text{ sau } x = \\frac{\\pi}{2} + 2k\\pi,\\; k\\in\\mathbb{Z}}$$'
  },

  /* ============================================================
     ANALIZĂ MATEMATICĂ — Limite
     ============================================================ */
  {
    id: 'an-lim-001', categoryId: 'analiza', subcategoryId: 'limite',
    difficulty: 'usor', source: 'BAC 2023, Varianta 20',
    title: 'Limită la infinit — funcție rațională',
    statement: 'Calculați:\n$$\\lim_{x \\to \\infty} \\frac{3x^2 + 2x - 1}{2x^2 - 5}$$',
    solution: 'Împărțim numărătorul și numitorul cu $x^2$:\n$$\\lim_{x \\to \\infty} \\frac{3 + \\frac{2}{x} - \\frac{1}{x^2}}{2 - \\frac{5}{x^2}} = \\frac{3+0-0}{2-0}$$\n\n$$\\boxed{\\lim = \\frac{3}{2}}$$'
  },
  {
    id: 'an-lim-002', categoryId: 'analiza', subcategoryId: 'limite',
    difficulty: 'mediu', source: 'BAC 2022, Varianta 6',
    title: 'Limită — nedeterminare 0/0 prin factorizare',
    statement: 'Calculați:\n$$\\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3}$$',
    solution: 'Substituind direct: $\\dfrac{0}{0}$ — nedeterminat.\n\nFactorizăm:\n$$\\lim_{x \\to 3} \\frac{(x-3)(x+3)}{x-3} = \\lim_{x \\to 3}(x+3) = 6$$\n\n$$\\boxed{\\lim = 6}$$'
  },
  {
    id: 'an-lim-003', categoryId: 'analiza', subcategoryId: 'limite',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 9',
    title: 'Limita remarcabilă $\\sin x / x$',
    statement: 'Calculați:\n$$\\lim_{x \\to 0} \\frac{\\sin 5x}{3x}$$',
    solution: '$$\\lim_{x \\to 0} \\frac{\\sin 5x}{3x} = \\frac{5}{3} \\cdot \\lim_{x \\to 0} \\frac{\\sin 5x}{5x} = \\frac{5}{3} \\cdot 1$$\n\n$$\\boxed{\\lim = \\frac{5}{3}}$$'
  },
  {
    id: 'an-lim-004', categoryId: 'analiza', subcategoryId: 'limite',
    difficulty: 'dificil', source: 'BAC 2023, Varianta 35',
    title: 'Limită cu radical — forma $\\infty - \\infty$',
    statement: 'Calculați:\n$$\\lim_{x \\to \\infty} \\left(\\sqrt{x+3} - \\sqrt{x}\\right)$$',
    solution: 'Înmulțim cu conjugatul:\n$$\\frac{(\\sqrt{x+3}-\\sqrt{x})(\\sqrt{x+3}+\\sqrt{x})}{\\sqrt{x+3}+\\sqrt{x}} = \\frac{3}{\\sqrt{x+3}+\\sqrt{x}}$$\n\nCând $x \\to \\infty$: numitorul $\\to +\\infty$\n\n$$\\boxed{\\lim = 0}$$'
  },
  {
    id: 'an-lim-005', categoryId: 'analiza', subcategoryId: 'limite',
    difficulty: 'dificil', source: 'BAC 2022, Varianta 13',
    title: 'Limita lui $e$ — varianta exponențială',
    statement: 'Calculați:\n$$\\lim_{x \\to 0} \\frac{e^{2x} - 1}{3x}$$',
    solution: 'Folosim limita remarcabilă $\\displaystyle\\lim_{t\\to 0}\\dfrac{e^t-1}{t} = 1$:\n$$\\frac{e^{2x}-1}{3x} = \\frac{2}{3} \\cdot \\frac{e^{2x}-1}{2x} \\xrightarrow{x\\to 0} \\frac{2}{3} \\cdot 1$$\n\n$$\\boxed{\\lim = \\frac{2}{3}}$$'
  },

  /* ============================================================
     ANALIZĂ MATEMATICĂ — Derivate
     ============================================================ */
  {
    id: 'an-der-001', categoryId: 'analiza', subcategoryId: 'derivate',
    difficulty: 'usor', source: 'BAC 2022, Varianta 17',
    title: 'Derivata unui polinom',
    statement: 'Calculați derivata funcției:\n$$f(x) = x^4 - 3x^2 + 2x - 7$$',
    solution: '$$f\'(x) = 4x^3 - 6x + 2$$'
  },
  {
    id: 'an-der-002', categoryId: 'analiza', subcategoryId: 'derivate',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 14',
    title: 'Derivata unui produs (regula produsului)',
    statement: 'Calculați derivata funcției:\n$$f(x) = x^2 \\cdot e^x$$',
    solution: '$(uv)\' = u\'v + uv\'$, cu $u = x^2$, $v = e^x$:\n$$f\'(x) = 2x \\cdot e^x + x^2 \\cdot e^x = xe^x(x+2)$$\n\n$$\\boxed{f\'(x) = xe^x(x+2)}$$'
  },
  {
    id: 'an-der-003', categoryId: 'analiza', subcategoryId: 'derivate',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 18',
    title: 'Derivata funcției compuse',
    statement: 'Calculați derivata funcției:\n$$f(x) = \\ln(x^2 + 1)$$',
    solution: '$[\\ln g(x)]\' = \\dfrac{g\'(x)}{g(x)}$, cu $g(x) = x^2+1$:\n\n$$\\boxed{f\'(x) = \\frac{2x}{x^2+1}}$$'
  },
  {
    id: 'an-der-004', categoryId: 'analiza', subcategoryId: 'derivate',
    difficulty: 'mediu', source: 'BAC 2022, Varianta 26',
    title: 'Ecuația tangentei la o curbă',
    statement: 'Determinați ecuația tangentei la graficul lui $f(x) = x^2 - 3x + 2$ în punctul de abscisă $x_0 = 1$.',
    solution: '$f(1) = 1 - 3 + 2 = 0$ → punctul $A(1,\\, 0)$\n\n$f\'(x) = 2x - 3 \\Rightarrow f\'(1) = -1$ → panta $m = -1$\n\n$$y - 0 = -1(x-1)$$\n\n$$\\boxed{y = -x + 1}$$'
  },
  {
    id: 'an-der-005', categoryId: 'analiza', subcategoryId: 'derivate',
    difficulty: 'dificil', source: 'BAC 2023, Varianta 8',
    title: 'Punctele de extrem ale unei funcții',
    statement: 'Determinați punctele de extrem ale funcției:\n$$f(x) = x^3 - 6x^2 + 9x + 1$$',
    solution: '$$f\'(x) = 3x^2 - 12x + 9 = 3(x-1)(x-3) = 0 \\Rightarrow x_1=1,\\; x_2=3$$\n\n$f\'$ schimbă semnul: $+$ → $-$ în $x=1$ (maxim), $-$ → $+$ în $x=3$ (minim)\n\n$$f(1) = 5 \\;\\text{(maxim local)}, \\qquad f(3) = 1 \\;\\text{(minim local)}$$'
  },

  /* ============================================================
     ANALIZĂ MATEMATICĂ — Integrale
     ============================================================ */
  {
    id: 'an-int-001', categoryId: 'analiza', subcategoryId: 'integrale',
    difficulty: 'usor', source: 'BAC 2022, Varianta 2',
    title: 'Integrala unui polinom',
    statement: 'Calculați:\n$$\\int (3x^2 - 4x + 2)\\, dx$$',
    solution: '$$\\int (3x^2 - 4x + 2)\\, dx = x^3 - 2x^2 + 2x + C$$'
  },
  {
    id: 'an-int-002', categoryId: 'analiza', subcategoryId: 'integrale',
    difficulty: 'usor', source: 'BAC 2023, Varianta 11',
    title: 'Integrală definită',
    statement: 'Calculați:\n$$\\int_0^2 (2x + 1)\\, dx$$',
    solution: '$F(x) = x^2 + x$\n\n$$\\int_0^2 (2x+1)\\,dx = F(2) - F(0) = (4+2) - 0$$\n\n$$\\boxed{= 6}$$'
  },
  {
    id: 'an-int-003', categoryId: 'analiza', subcategoryId: 'integrale',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 7',
    title: 'Integrală cu funcție exponențială',
    statement: 'Calculați:\n$$\\int_0^1 e^x\\, dx$$',
    solution: '$$\\int_0^1 e^x\\, dx = \\left[e^x\\right]_0^1 = e^1 - e^0 = e - 1$$\n\n$$\\boxed{e - 1 \\approx 1{,}718}$$'
  },
  {
    id: 'an-int-004', categoryId: 'analiza', subcategoryId: 'integrale',
    difficulty: 'mediu', source: 'BAC 2022, Varianta 34',
    title: 'Integrare prin substituție',
    statement: 'Calculați:\n$$\\int 2x\\,e^{x^2}\\, dx$$',
    solution: 'Substituție: $t = x^2 \\Rightarrow dt = 2x\\, dx$\n$$\\int e^t\\, dt = e^t + C$$\n\n$$\\boxed{e^{x^2} + C}$$'
  },
  {
    id: 'an-int-005', categoryId: 'analiza', subcategoryId: 'integrale',
    difficulty: 'dificil', source: 'BAC 2023, Varianta 19',
    title: 'Integrare prin părți',
    statement: 'Calculați:\n$$\\int x\\sin x\\, dx$$',
    solution: '$\\int u\\, dv = uv - \\int v\\, du$\n\n$u = x \\Rightarrow du = dx$;  $dv = \\sin x\\, dx \\Rightarrow v = -\\cos x$\n$$\\int x\\sin x\\, dx = -x\\cos x + \\int \\cos x\\, dx$$\n\n$$\\boxed{= -x\\cos x + \\sin x + C}$$'
  },

  /* ============================================================
     ANALIZĂ — Șiruri
     ============================================================ */
  {
    id: 'an-sir-001', categoryId: 'analiza', subcategoryId: 'siruri',
    difficulty: 'usor', source: 'BAC 2022, Varianta 5',
    title: 'Termenul general al unui șir aritmetic',
    statement: 'Determinați formula termenului general al șirului:\n$$2,\\; 5,\\; 8,\\; 11,\\; 14,\\; \\ldots$$',
    solution: 'Rația: $d = 5 - 2 = 3$ (progresie aritmetică)\n$$a_n = a_1 + (n-1)d = 2 + (n-1) \\cdot 3 = 3n - 1$$\n\n$$\\boxed{a_n = 3n - 1}$$'
  },
  {
    id: 'an-sir-002', categoryId: 'analiza', subcategoryId: 'siruri',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 24',
    title: 'Limita unui șir',
    statement: 'Calculați:\n$$\\lim_{n \\to \\infty} \\frac{2n^2 + n - 1}{n^2 + 3n}$$',
    solution: '$$\\lim_{n\\to\\infty} \\frac{2 + \\frac{1}{n} - \\frac{1}{n^2}}{1 + \\frac{3}{n}} = \\frac{2}{1}$$\n\n$$\\boxed{\\lim = 2}$$'
  },

  /* ============================================================
     ANALIZĂ — Progresii
     ============================================================ */
  {
    id: 'an-prog-001', categoryId: 'analiza', subcategoryId: 'progresii',
    difficulty: 'usor', source: 'BAC 2022, Varianta 10',
    title: 'Suma termenilor progresiei aritmetice',
    statement: 'O progresie aritmetică are $a_1 = 4$ și $r = 3$. Calculați $S_{10}$.',
    solution: '$$S_n = \\frac{n}{2}(2a_1 + (n-1)r)$$\n$$S_{10} = \\frac{10}{2}(2\\cdot4 + 9\\cdot3) = 5(8+27) = 5 \\cdot 35$$\n\n$$\\boxed{S_{10} = 175}$$'
  },
  {
    id: 'an-prog-002', categoryId: 'analiza', subcategoryId: 'progresii',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 23',
    title: 'Termenul și suma progresiei geometrice',
    statement: 'O progresie geometrică are $b_1 = 3$ și $q = 2$. Calculați $b_6$ și $S_6$.',
    solution: '$$b_6 = b_1 \\cdot q^5 = 3 \\cdot 32 = 96$$\n\n$$S_6 = b_1\\frac{q^6-1}{q-1} = 3 \\cdot \\frac{64-1}{1} = 3 \\cdot 63$$\n\n$$\\boxed{b_6 = 96, \\quad S_6 = 189}$$'
  },

  /* ============================================================
     GEOMETRIE — Plană
     ============================================================ */
  {
    id: 'geo-p-001', categoryId: 'geometrie', subcategoryId: 'geo-plana',
    difficulty: 'usor', source: 'BAC 2022, Varianta 18',
    title: 'Teorema lui Pitagora — latură și arie',
    statement: 'Un triunghi dreptunghic are catetele $a = 5\\,\\text{cm}$ și $b = 12\\,\\text{cm}$. Calculați ipotenuza și aria.',
    solution: '$$c = \\sqrt{a^2+b^2} = \\sqrt{25+144} = \\sqrt{169} = 13\\,\\text{cm}$$\n\n$$\\mathcal{A} = \\frac{ab}{2} = \\frac{5 \\cdot 12}{2} = 30\\,\\text{cm}^2$$'
  },
  {
    id: 'geo-p-002', categoryId: 'geometrie', subcategoryId: 'geo-plana',
    difficulty: 'usor', source: 'BAC 2023, Varianta 3',
    title: 'Raza și aria unui cerc din perimetru',
    statement: 'Un cerc are perimetrul $20\\pi\\,\\text{cm}$. Calculați raza și aria.',
    solution: '$$P = 2\\pi r = 20\\pi \\Rightarrow r = 10\\,\\text{cm}$$\n\n$$\\mathcal{A} = \\pi r^2 = 100\\pi\\,\\text{cm}^2$$'
  },
  {
    id: 'geo-p-003', categoryId: 'geometrie', subcategoryId: 'geo-plana',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 14',
    title: 'Triunghi echilateral — înălțime și arie',
    statement: 'Un triunghi echilateral are latura $a = 6\\,\\text{cm}$. Calculați înălțimea și aria.',
    solution: '$$h = \\frac{a\\sqrt{3}}{2} = \\frac{6\\sqrt{3}}{2} = 3\\sqrt{3}\\,\\text{cm}$$\n\n$$\\mathcal{A} = \\frac{a^2\\sqrt{3}}{4} = \\frac{36\\sqrt{3}}{4} = 9\\sqrt{3}\\,\\text{cm}^2$$'
  },
  {
    id: 'geo-p-004', categoryId: 'geometrie', subcategoryId: 'geo-plana',
    difficulty: 'mediu', source: 'BAC 2022, Varianta 33',
    title: 'Aria și perimetrul unui trapez isoscel',
    statement: 'Un trapez are bazele $B = 10\\,\\text{cm}$, $b = 6\\,\\text{cm}$, înălțimea $h = 4\\,\\text{cm}$ și laturile neparalele egale cu $l = 5\\,\\text{cm}$. Calculați aria și perimetrul.',
    solution: '$$\\mathcal{A} = \\frac{(B+b)h}{2} = \\frac{16 \\cdot 4}{2} = 32\\,\\text{cm}^2$$\n\n$$P = B + b + 2l = 10 + 6 + 10 = 26\\,\\text{cm}$$'
  },

  /* ============================================================
     GEOMETRIE — Analitică
     ============================================================ */
  {
    id: 'geo-a-001', categoryId: 'geometrie', subcategoryId: 'geo-analitica',
    difficulty: 'usor', source: 'BAC 2022, Varianta 25',
    title: 'Distanța dintre două puncte',
    statement: 'Calculați distanța dintre $A(1,\\,2)$ și $B(4,\\,6)$.',
    solution: '$$d(A,B) = \\sqrt{(4-1)^2+(6-2)^2} = \\sqrt{9+16} = \\sqrt{25}$$\n\n$$\\boxed{d(A,B) = 5}$$'
  },
  {
    id: 'geo-a-002', categoryId: 'geometrie', subcategoryId: 'geo-analitica',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 30',
    title: 'Ecuația dreptei prin două puncte',
    statement: 'Determinați ecuația dreptei prin $A(1,\\,2)$ și $B(3,\\,6)$.',
    solution: '$$m = \\frac{y_B - y_A}{x_B - x_A} = \\frac{6-2}{3-1} = 2$$\n\n$$y - 2 = 2(x-1) \\Rightarrow y = 2x$$\n\nVerificare: $B(3,6): 6 = 2 \\cdot 3$ ✓\n\n$$\\boxed{y = 2x}$$'
  },
  {
    id: 'geo-a-003', categoryId: 'geometrie', subcategoryId: 'geo-analitica',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 31',
    title: 'Distanța de la un punct la o dreaptă',
    statement: 'Calculați distanța de la $P(3,\\,4)$ la dreapta $3x + 4y - 25 = 0$.',
    solution: '$$d = \\frac{|ax_0 + by_0 + c|}{\\sqrt{a^2+b^2}} = \\frac{|3\\cdot3 + 4\\cdot4 - 25|}{\\sqrt{9+16}} = \\frac{|0|}{5}$$\n\n$$\\boxed{d = 0}$$\n\nPunctul $P$ se află pe dreaptă!'
  },
  {
    id: 'geo-a-004', categoryId: 'geometrie', subcategoryId: 'geo-analitica',
    difficulty: 'dificil', source: 'BAC 2023, Varianta 15',
    title: 'Centrul și raza unui cerc',
    statement: 'Determinați centrul și raza cercului:\n$$x^2 + y^2 - 6x + 4y - 3 = 0$$',
    solution: 'Completăm pătratele:\n$$(x^2 - 6x + 9) + (y^2 + 4y + 4) = 3 + 9 + 4$$\n$$(x-3)^2 + (y+2)^2 = 16$$\n\n$$\\boxed{\\text{Centru } O(3,\\,-2),\\quad r = 4}$$'
  },

  /* ============================================================
     GEOMETRIE — Spațiu
     ============================================================ */
  {
    id: 'geo-s-001', categoryId: 'geometrie', subcategoryId: 'geo-spatiu',
    difficulty: 'usor', source: 'BAC 2022, Varianta 20',
    title: 'Diagonalele unui cub',
    statement: 'Un cub are latura $a = 4\\,\\text{cm}$. Calculați diagonala feței și diagonala spațiului.',
    solution: '$$d_f = a\\sqrt{2} = 4\\sqrt{2}\\,\\text{cm}$$\n\n$$d_s = a\\sqrt{3} = 4\\sqrt{3}\\,\\text{cm}$$'
  },
  {
    id: 'geo-s-002', categoryId: 'geometrie', subcategoryId: 'geo-spatiu',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 4',
    title: 'Volumul și aria laterală a unui cilindru',
    statement: 'Un cilindru are $r = 3\\,\\text{cm}$ și $h = 7\\,\\text{cm}$. Calculați volumul și aria laterală.',
    solution: '$$V = \\pi r^2 h = \\pi \\cdot 9 \\cdot 7 = 63\\pi\\,\\text{cm}^3$$\n\n$$A_l = 2\\pi r h = 2\\pi \\cdot 3 \\cdot 7 = 42\\pi\\,\\text{cm}^2$$'
  },
  {
    id: 'geo-s-003', categoryId: 'geometrie', subcategoryId: 'geo-spatiu',
    difficulty: 'dificil', source: 'BAC 2021, Varianta 30',
    title: 'Piramidă regulată — volum și apotema',
    statement: 'O piramidă regulată cu baza pătrată ($a = 6\\,\\text{cm}$) are înălțimea $h = 4\\,\\text{cm}$. Calculați volumul și apotema.',
    solution: '$$V = \\frac{\\mathcal{A}_{baza} \\cdot h}{3} = \\frac{36 \\cdot 4}{3} = 48\\,\\text{cm}^3$$\n\nApotema (înălțimea feței laterale):\n$$l = \\sqrt{h^2 + \\left(\\frac{a}{2}\\right)^2} = \\sqrt{16+9} = 5\\,\\text{cm}$$\n\n$$\\boxed{V = 48\\,\\text{cm}^3,\\quad l = 5\\,\\text{cm}}$$'
  }

];

/* ---- Funcții utilitare ---- */
BM.getExerciseCount = function(categoryId, subcategoryId) {
  return BM.EXERCISES.filter(e =>
    e.categoryId === categoryId &&
    (!subcategoryId || e.subcategoryId === subcategoryId)
  ).length;
};
BM.getCategoryById    = id => BM.CATEGORIES.find(c => c.id === id);
BM.getSubcategoryById = (catId, subId) => {
  const cat = BM.getCategoryById(catId);
  return cat ? cat.subcategories.find(s => s.id === subId) : null;
};
