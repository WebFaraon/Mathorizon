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
      { id: 'polinoame',        name: 'Polinoame',                 symbol: 'P(x)', color: '#6366f1', description: 'Împărțire, rădăcini, descompunere' },
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
    id: 'alg-in-001', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'usor', source: 'BAC 2022, Varianta 15',
    title: 'Inecuație de gradul 1',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$3x - 2 > x + 4$$',
    solution: '$$3x - x > 4 + 2$$\n$$2x > 6 \\Rightarrow x > 3$$\n\n$$\\boxed{x \\in (3,\\, +\\infty)}$$'
  },
  {
    id: 'alg-in-002', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 20',
    title: 'Inecuație de gradul 2',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$x^2 - 3x - 10 < 0$$',
    solution: 'Rezolvăm $x^2 - 3x - 10 = 0$:\n$\\Delta = 49 \\Rightarrow x_1 = -2,\\; x_2 = 5$\n\nParabola cu $a=1>0$, deschisă în sus — inecuația $< 0$ este satisfăcută **între** rădăcini:\n\n$$\\boxed{x \\in (-2,\\, 5)}$$'
  },
  {
    id: 'alg-in-003', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 2',
    title: 'Inecuație cu modul',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$|x - 3| \\leq 2$$',
    solution: '$$|x-3| \\leq 2 \\iff -2 \\leq x-3 \\leq 2 \\iff 1 \\leq x \\leq 5$$\n\n$$\\boxed{x \\in [1,\\, 5]}$$'
  },
  {
    id: 'alg-in-004', categoryId: 'algebra', subcategoryId: 'inec-rationale',
    difficulty: 'dificil', source: 'BAC 2020, Varianta 18',
    title: 'Inecuație cu fracție rațională',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$\\frac{x+1}{x-2} \\geq 0$$',
    solution: 'Condiție: $x \\neq 2$\n\nTabel de semne:\n\n| $x$ | $(-\\infty,-1)$ | $-1$ | $(-1,2)$ | $2$ | $(2,+\\infty)$ |\n|-----|------|------|------|------|------|\n| $x+1$ | $-$ | $0$ | $+$ | $+$ | $+$ |\n| $x-2$ | $-$ | $-$ | $-$ | $\\nexists$ | $+$ |\n| raport | $+$ | $0$ | $-$ | $\\nexists$ | $+$ |\n\n$$\\boxed{x \\in (-\\infty,\\,-1] \\cup (2,\\,+\\infty)}$$'
  },

  /* ============================================================
     ALGEBRĂ — Polinoame
     ============================================================ */
  {
    id: 'alg-pol-001', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția de divizibilitate',
    statement: 'Fie polinomul $P(x) = x^3 - 2x^2 + (m+1)x - 4$. Determinați valoarea reală a lui $m$ pentru care $P(x)$ este divizibil prin $Q(x) = x - 2$.',
    solution: 'Dacă $P(x)$ este divizibil prin $(x-2)$, atunci $x = 2$ este rădăcină, deci $P(2) = 0$.\n\n$$P(2) = 8 - 8 + 2(m+1) - 4 = 0$$\n\n$$2m + 2 - 4 = 0 \\Rightarrow 2m = 2 \\Rightarrow \\boxed{m = 1}$$'
  },
  {
    id: 'alg-pol-002', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea coeficientului și a celorlalte rădăcini',
    statement: 'Fie polinomul $P(x) = x^3 + x^2 + ax - 12$. Se știe că $x = -2$ este rădăcină a polinomului. Determinați celelalte rădăcini.',
    solution: '$P(-2) = 0$:\n$$-8 + 4 - 2a - 12 = 0 \\Rightarrow -2a = 16 \\Rightarrow a = -8$$\n\nDeci $P(x) = x^3 + x^2 - 8x - 12$. Împărțim prin $(x+2)$ (schema Horner):\n\n$$\\begin{array}{c|cccc} -2 & 1 & 1 & -8 & -12 \\\\ & & -2 & 2 & 12 \\\\ \\hline & 1 & -1 & -6 & 0 \\end{array}$$\n\n$$P(x) = (x+2)(x^2 - x - 6) = (x+2)(x-3)(x+2) = (x+2)^2(x-3)$$\n\nRădăcinile sunt $\\boxed{x = -2 \\text{ (dublă)},\\ x = 3}$'
  },

  {
    id: 'alg-pol-003', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Rădăcinile reale ale unui polinom definit printr-un determinant',
    statement: 'Fie polinomul\n$$P(x) = \\begin{vmatrix} -1 & x & 2 \\\\ x & 2 & -1 \\\\ 2 & -1 & x \\end{vmatrix}$$\nDeterminați rădăcinile reale ale polinomului.',
    solution: 'Dezvoltăm determinantul după primul rând:\n\n$$P(x) = -1(2x-1) - x(x^2+2) + 2(-x-4)$$\n\n$$= -2x+1-x^3-2x-2x-8 = -x^3-6x-7$$\n\nVerificăm $x = -1$: $\\quad P(-1) = 1+6-7 = 0$ ✓\n\nÎmpărțim prin $(x+1)$:\n$$P(x) = -(x+1)(x^2-x+7)$$\n\n$\\Delta = 1 - 28 = -27 < 0$, deci $x^2-x+7$ nu are rădăcini reale.\n\n$$\\boxed{x = -1}$$'
  },

  {
    id: 'alg-pol-004', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Câtul și restul împărțirii unui polinom de grad 4 la grad 2',
    statement: 'Determinați câtul și restul împărțirii polinomului $P(x) = x^4 - 5x^2 + 3x - 2$ la polinomul $Q(x) = x^2 + 1$.',
    solution: 'Împărțim prin algoritmul împărțirii:\n\n$x^4 \\div x^2 = x^2$; $\\quad x^2(x^2+1) = x^4+x^2$; rest: $-6x^2+3x-2$\n\n$-6x^2 \\div x^2 = -6$; $\\quad -6(x^2+1) = -6x^2-6$; rest: $3x+4$\n\n$$\\boxed{C(x) = x^2-6, \\quad R(x) = 3x+4}$$'
  },
  {
    id: 'alg-pol-005', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Rădăcină dublă — determinarea coeficienților și a celorlalte rădăcini',
    statement: 'Fie polinomul $P(x) = x^4 - 5x^3 + ax^2 + bx - 18$. Știind că $x = 3$ este rădăcină dublă a polinomului $P(x)$, să se determine celelalte rădăcini.',
    solution: 'Deoarece $x=3$ este rădăcină dublă: $P(3)=0$ și $P\'(3)=0$.\n\n$$P(3)=0:\\quad 81-135+9a+3b-18=0 \\Rightarrow 3a+b=24 \\quad(1)$$\n\n$$P\'(x)=4x^3-15x^2+2ax+b \\Rightarrow P\'(3)=108-135+6a+b=0 \\Rightarrow 6a+b=27 \\quad(2)$$\n\n$(2)-(1):\\; 3a=3 \\Rightarrow a=1,\\; b=21$\n\n$P(x)=(x-3)^2(x^2+x-2)=(x-3)^2(x-1)(x+2)$\n\n$$\\boxed{x=1,\\quad x=-2}$$'
  },
  {
    id: 'alg-pol-006', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea coeficientului din condiția restului la împărțire',
    statement: 'Fie polinomul $P(x) = 4x^3 + (a-2)x^2 + (1-a)x + 6$. Determinați valorile reale ale lui $a$, astfel încât restul împărțirii polinomului la $Q(x) = x + 1$ să fie egal cu $5$.',
    solution: 'Prin teorema lui Bézout, restul împărțirii lui $P(x)$ la $(x+1)$ este $P(-1)$.\n\n$$P(-1) = -4 + (a-2) - (1-a) + 6 = 2a - 1$$\n\n$$2a - 1 = 5 \\Rightarrow 2a = 6 \\Rightarrow \\boxed{a = 3}$$'
  },
  {
    id: 'alg-pol-007', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Câtul împărțirii folosind suma coeficienților',
    statement: 'Determinați câtul împărțirii polinomului $P(x) = x^3 - ax^2 + (2a-1)x - 5$ la binomul $Q(x) = x + 2$, dacă se cunoaște că suma coeficienților lui $P(x)$ este $0$.',
    solution: 'Suma coeficienților $= P(1) = 0$:\n$$1 - a + (2a-1) - 5 = a - 5 = 0 \\Rightarrow a = 5$$\n\n$P(x) = x^3 - 5x^2 + 9x - 5$. Schema Horner pentru $x = -2$:\n\n$$\\begin{array}{c|cccc} -2 & 1 & -5 & 9 & -5 \\\\ & & -2 & 14 & -46 \\\\ \\hline & 1 & -7 & 23 & -51 \\end{array}$$\n\n$$\\boxed{C(x) = x^2 - 7x + 23}, \\quad R = -51$$'
  },
  {
    id: 'alg-pol-008', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 4 la un binom',
    statement: 'Determinați restul împărțirii polinomului $P(x) = x^4 + 3x^3 + 2x^2 - x - 3$ la binomul $x + 3$.',
    solution: 'Prin teorema lui Bézout, restul este $P(-3)$:\n\n$$P(-3) = 81 - 81 + 18 + 3 - 3 = \\boxed{18}$$'
  },
  {
    id: 'alg-pol-009', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunere în factori cu rădăcină dublă dată',
    statement: 'Descompuneți în factori ireductibili polinomul $P(x) = x^4 - 5x^3 + x^2 + 21x - 18$, știind că $x = 3$ este o rădăcină dublă a polinomului.',
    solution: '$(x-3)^2 = x^2-6x+9$ divide $P(x)$. Împărțim:\n\n$$P(x) = (x-3)^2(x^2+x-2) = (x-3)^2(x-1)(x+2)$$\n\n$$\\boxed{P(x) = (x-3)^2(x-1)(x+2)}$$'
  },
  {
    id: 'alg-pol-010', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Descompunere în factori ireductibili cu rădăcină dublă necunoscută',
    statement: 'Descompuneți în factori ireductibili polinomul $P(x) = x^4 - x^3 - ax^2 - (a+8)x - 10$, știind că $x = -1$ este o rădăcină dublă a polinomului $P(x)$.',
    solution: '$P(-1) = 1+1-a+(a+8)-10 = 0$ (adevărat $\\forall a$)\n\n$P\'(x) = 4x^3-3x^2-2ax-(a+8)$\n$$P\'(-1) = -4-3+2a-a-8 = a-15 = 0 \\Rightarrow a = 15$$\n\n$P(x) = x^4-x^3-15x^2-23x-10$. Împărțim prin $(x+1)^2 = x^2+2x+1$:\n$$P(x) = (x+1)^2(x^2-3x-10) = (x+1)^2(x-5)(x+2)$$\n\n$$\\boxed{P(x) = (x+1)^2(x-5)(x+2)}$$'
  },
  {
    id: 'alg-pol-011', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Verificarea unei rădăcini și determinarea celorlalte rădăcini',
    statement: 'Fie polinomul $P(x) = 2x^3 - 9x^2 + 7x + 6$. Arătați că $x = 3$ este rădăcină a polinomului $P(x)$ și determinați celelalte rădăcini ale polinomului.',
    solution: '$$P(3) = 54 - 81 + 21 + 6 = 0 \\checkmark$$\n\nSchema Horner pentru $x = 3$:\n$$\\begin{array}{c|cccc} 3 & 2 & -9 & 7 & 6 \\\\ & & 6 & -9 & -6 \\\\ \\hline & 2 & -3 & -2 & 0 \\end{array}$$\n\n$$P(x) = (x-3)(2x^2-3x-2) = (x-3)(2x+1)(x-2)$$\n\n$$\\boxed{x = 2, \\quad x = -\\tfrac{1}{2}}$$'
  },
  {
    id: 'alg-pol-012', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii la un polinom de grad 2 cu rădăcini cunoscute',
    statement: 'Determinați restul împărțirii polinomului $P(x) = 3x^3 - 4x^2 - 3x + 7$ la $Q(x) = x^2 - 1$.',
    solution: '$R(x) = ax+b$. Deoarece $x^2-1 = (x-1)(x+1)$, evaluăm în $x=1$ și $x=-1$:\n\n$$P(1) = 3-4-3+7 = 3 = a+b$$\n$$P(-1) = -3-4+3+7 = 3 = -a+b$$\n\nDin sistem: $a = 0,\\; b = 3$\n\n$$\\boxed{R(x) = 3}$$'
  },
  {
    id: 'alg-pol-013', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea lui m și restul la un polinom de grad 2',
    statement: 'Fie $P(x) = x^4 + 2x^3 + mx^2 + 5x + 4$. Determinați $m$, astfel încât $x = -1$ să fie rădăcină, apoi aflați restul împărțirii lui $P(x)$ la $x^2 - 2$.',
    solution: '$$P(-1) = 1-2+m-5+4 = m-2 = 0 \\Rightarrow m = 2$$\n\n$P(x) = x^4+2x^3+2x^2+5x+4$. $R(x) = ax+b$:\n\nEvaluăm în $x = \\sqrt{2}$ și $x = -\\sqrt{2}$:\n$$P(\\sqrt{2}) = 4+4\\sqrt{2}+4+5\\sqrt{2}+4 = 12+9\\sqrt{2} = a\\sqrt{2}+b$$\n$$P(-\\sqrt{2}) = 4-4\\sqrt{2}+4-5\\sqrt{2}+4 = 12-9\\sqrt{2} = -a\\sqrt{2}+b$$\n\n$a = 9,\\; b = 12$\n\n$$\\boxed{R(x) = 9x+12}$$'
  },
  {
    id: 'alg-pol-014', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția că o rădăcină dată este rădăcină a polinomului',
    statement: 'Determinați $a \\in \\mathbb{R}$, pentru care $x = \\dfrac{1}{2}$ este rădăcină a polinomului:\n$$P(x) = 8x^3 + (a+2)x - 5x + a$$',
    solution: '$P(x) = 8x^3 + (a-3)x + a$\n\n$$P\\!\\left(\\tfrac{1}{2}\\right) = 8 \\cdot \\tfrac{1}{8} + (a-3)\\cdot\\tfrac{1}{2} + a = 1 + \\frac{a-3}{2} + a = 0$$\n\n$$2 + (a-3) + 2a = 0 \\Rightarrow 3a = 1 \\Rightarrow \\boxed{a = \\dfrac{1}{3}}$$'
  },
  {
    id: 'alg-pol-015', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Descompunerea completă a unui polinom de grad 4',
    statement: 'Fie polinomul $P(x) = x^4 - 6x^3 - 3x^2 + 52x - 60$. Descompuneți în factori polinomul.',
    solution: 'Testăm $x=2$: $P(2) = 16-48-12+104-60 = 0$ ✓\n\nSchema Horner:\n$$\\begin{array}{c|ccccc} 2 & 1 & -6 & -3 & 52 & -60 \\\\ & & 2 & -8 & -22 & 60 \\\\ \\hline & 1 & -4 & -11 & 30 & 0 \\end{array}$$\n\nTestăm $x=2$ în $x^3-4x^2-11x+30$: $8-16-22+30=0$ ✓\n\n$$x^3-4x^2-11x+30 = (x-2)(x^2-2x-15) = (x-2)(x-5)(x+3)$$\n\n$$\\boxed{P(x) = (x-2)^2(x-5)(x+3)}$$'
  },
  {
    id: 'alg-pol-016', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului la un binom',
    statement: 'Fie polinomul $P(x) = x^3 + (a+1)x^2 - a^2x - 2$. Determinați $a \\in \\mathbb{R}$, știind că restul împărțirii la $x - 2$ este $10$.',
    solution: 'Prin teorema lui Bézout: $P(2) = 10$.\n\n$$8 + 4(a+1) - 2a^2 - 2 = 10$$\n$$10 + 4a - 2a^2 = 10$$\n$$4a - 2a^2 = 0 \\Rightarrow 2a(2-a) = 0$$\n\n$$\\boxed{a = 0 \\quad \\text{sau} \\quad a = 2}$$'
  },
  {
    id: 'alg-pol-017', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Restul împărțirii la un polinom de grad 2 cu rădăcini 0 și 1',
    statement: 'Determinați restul împărțirii polinomului $P(x) = 2x^4 + 3x^3 - x + 1$ la $Q(x) = x^2 - x$.',
    solution: '$R(x) = ax+b$. Deoarece $x^2-x = x(x-1)$, evaluăm în $x=0$ și $x=1$:\n\n$$P(0) = 1 = b$$\n$$P(1) = 2+3-1+1 = 5 = a+b = a+1 \\Rightarrow a = 4$$\n\n$$\\boxed{R(x) = 4x+1}$$'
  },

  {
    id: 'alg-pol-018', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunere în factori ireductibili cu rădăcină dublă x=1',
    statement: 'Descompuneți în factori ireductibili polinomul\n$$P(x) = x^4 + 5x^3 - x^2 - 17x + 12$$\ndacă $x = 1$ este rădăcină dublă.',
    solution: '$P(1) = 1+5-1-17+12 = 0$ ✓ și $P\'(1) = 4+15-2-17 = 0$ ✓\n\nÎmpărțim prin $(x-1)^2 = x^2-2x+1$:\n$$P(x) = (x-1)^2(x^2+7x+12) = (x-1)^2(x+3)(x+4)$$\n\n$$\\boxed{P(x) = (x-1)^2(x+3)(x+4)}$$'
  },
  {
    id: 'alg-pol-019', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu −10',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(x) = ax^4 - 7x^3 + 3x^2 + (a-3)x + 4$$\nla binomul $Q(x) = x - 2$, este egal cu $-10$.',
    solution: '$P(2) = -10$:\n$$16a - 56 + 12 + 2(a-3) + 4 = -10$$\n$$18a - 46 = -10 \\Rightarrow 18a = 36 \\Rightarrow \\boxed{a = 2}$$'
  },
  {
    id: 'alg-pol-020', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Restul împărțirii unui polinom de grad 4 la x+2',
    statement: 'Determinați restul împărțirii polinomului\n$$P(x) = 3x^4 - 6x^3 + x^2 - 3x + 4$$\nla polinomul $Q(x) = x + 2$.',
    solution: 'Prin teorema lui Bézout, restul este $P(-2)$:\n\n$$P(-2) = 3(16) - 6(-8) + 4 - 3(-2) + 4 = 48 + 48 + 4 + 6 + 4 = \\boxed{110}$$'
  },
  {
    id: 'alg-pol-021', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea coeficienților a și b din condiția rădăcinii duble',
    statement: 'Fie polinomul $P(x) = x^4 + 6x^3 + 9x^2 + 2ax - b$. Determinați numerele reale $a$ și $b$, pentru care $x = 2$ este rădăcină dublă.',
    solution: '$x=2$ rădăcină dublă $\\Rightarrow P(2)=0$ și $P\'(2)=0$.\n\n$$P\'(x) = 4x^3+18x^2+18x+2a \\Rightarrow P\'(2) = 140+2a = 0 \\Rightarrow a = -70$$\n\n$$P(2) = 100 + 4(-70) - b = 0 \\Rightarrow b = -180$$\n\n$$P(x) = (x-2)^2(x^2+10x+45)$$\n\n$$\\boxed{a = -70, \\quad b = -180}$$'
  },
  {
    id: 'alg-pol-022', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Determinarea parametrului a din condiția restului egal cu 6',
    statement: 'Determinați valorile parametrului real $a$, pentru care restul împărțirii polinomului\n$$P(x) = ax^4 - 6x^3 - 2x^2 - 2ax - 2$$\nla $Q(x) = x - 2$, este egal cu $6$.',
    solution: '$P(2) = 6$:\n$$16a - 48 - 8 - 4a - 2 = 6$$\n$$12a - 58 = 6 \\Rightarrow 12a = 64 \\Rightarrow \\boxed{a = \\dfrac{16}{3}}$$'
  },
  {
    id: 'alg-pol-023', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu 27',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(x) = 3x^4 - 2ax^3 - 12x^2 + 8x - a - 2$$\nla $Q(x) = x + 2$, este egal cu $27$.',
    solution: '$P(-2) = 27$:\n$$48 + 16a - 48 - 16 - a - 2 = 27$$\n$$15a - 18 = 27 \\Rightarrow 15a = 45 \\Rightarrow \\boxed{a = 3}$$'
  },
  {
    id: 'alg-pol-024', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui m din condiția de divizibilitate cu x+1',
    statement: 'Fie polinomul $P(x) = 2x^5 + 3x^3 - (m+1)x^2 + (m-1)x + 6 + m$. Determinați valorile reale ale lui $m$, pentru care polinomul $P(x)$ se divide cu $Q(x) = x + 1$.',
    solution: 'Dacă $P(x)$ este divizibil cu $(x+1)$, atunci $P(-1) = 0$:\n$$-2 - 3 - (m+1) - (m-1) + 6 + m = 0$$\n$$1 - m = 0 \\Rightarrow \\boxed{m = 1}$$'
  },
  {
    id: 'alg-pol-025', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'dificil', source: 'BAC — Algebră',
    title: 'Determinarea lui a și restul la x²−2 din condiție la x=2',
    statement: 'Determinați restul împărțirii polinomului $P(x) = x^4 + 2x - 2 - a$, la polinomul $Q(x) = x^2 - 2$, dacă restul împărțirii la $x = 2$ este egal cu $8$.',
    solution: 'Din $P(2) = 8$:\n$$16 + 4 - 2 - a = 8 \\Rightarrow a = 10$$\n\n$P(x) = x^4 + 2x - 12$. Scriem $R(x) = bx + c$ și evaluăm în $x = \\pm\\sqrt{2}$:\n$$P(\\sqrt{2}) = 4 + 2\\sqrt{2} - 12 = -8 + 2\\sqrt{2} = b\\sqrt{2} + c$$\n$$P(-\\sqrt{2}) = 4 - 2\\sqrt{2} - 12 = -8 - 2\\sqrt{2} = -b\\sqrt{2} + c$$\n\n$b = 2,\\; c = -8$\n\n$$\\boxed{R(x) = 2x - 8}$$'
  },
  {
    id: 'alg-pol-026', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu −13',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(x) = (a+3)x^5 - 2x^3 + (9+a)x^2 + 2x + 7 - a$$\nla $Q(x) = x - 2$, este egal cu $-13$.',
    solution: '$P(2) = -13$:\n$$(a+3)(32) - 16 + (9+a)(4) + 4 + 7 - a = -13$$\n$$32a + 96 - 16 + 36 + 4a + 4 + 7 - a = -13$$\n$$35a + 127 = -13 \\Rightarrow 35a = -140 \\Rightarrow \\boxed{a = -4}$$'
  },
  {
    id: 'alg-pol-027', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'usor', source: 'BAC — Algebră',
    title: 'Determinarea lui a din condiția restului egal cu 3 la x−1',
    statement: 'Determinați valorile reale ale lui $a$, pentru care restul împărțirii polinomului\n$$P(x) = 2ax^4 - 7x^3 + 2x^2 - 10x + a$$\nla $Q(x) = x - 1$, este egal cu $3$.',
    solution: '$P(1) = 3$:\n$$2a - 7 + 2 - 10 + a = 3$$\n$$3a - 15 = 3 \\Rightarrow 3a = 18 \\Rightarrow \\boxed{a = 6}$$'
  },
  {
    id: 'alg-pol-028', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC — Algebră',
    title: 'Descompunere în factori ireductibili cu rădăcină dublă x=−2',
    statement: 'Descompuneți în factori ireductibili polinomul\n$$P(x) = x^4 + 7x^3 + 12x^2 - 4x - 16$$\ndacă $x = -2$ este rădăcină dublă.',
    solution: '$P(-2) = 16-56+48+8-16 = 0$ ✓ și $P\'(-2) = -32+84-48-4 = 0$ ✓\n\nÎmpărțim prin $(x+2)^2 = x^2+4x+4$:\n$$P(x) = (x+2)^2(x^2+3x-4) = (x+2)^2(x+4)(x-1)$$\n\n$$\\boxed{P(x) = (x+2)^2(x+4)(x-1)}$$'
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

  /* ============================================================
     ALGEBRĂ — Numere complexe
     ============================================================ */
  {
    id: 'alg-cx-001', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'usor', source: 'BAC 2022, Varianta 30',
    title: 'Produsul numerelor complexe',
    statement: 'Calculați $z_1 \\cdot z_2$, unde $z_1 = 2+3i$ și $z_2 = 1-i$.',
    solution: '$$z_1 \\cdot z_2 = (2+3i)(1-i) = 2 - 2i + 3i - 3i^2$$\n$$= 2 + i + 3 \\qquad (i^2 = -1)$$\n\n$$\\boxed{z_1 \\cdot z_2 = 5 + i}$$'
  },
  {
    id: 'alg-cx-002', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 18',
    title: 'Câtul numerelor complexe',
    statement: 'Calculați $z = \\dfrac{3+4i}{2-i}$.',
    solution: 'Amplificăm cu conjugatul numitorului:\n$$z = \\frac{(3+4i)(2+i)}{(2-i)(2+i)} = \\frac{6+3i+8i+4i^2}{4+1} = \\frac{2+11i}{5}$$\n\n$$\\boxed{z = \\frac{2}{5} + \\frac{11}{5}i}$$'
  },
  {
    id: 'alg-cx-003', categoryId: 'algebra', subcategoryId: 'complexe',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 25',
    title: 'Modul și argument',
    statement: 'Determinați modulul și argumentul lui $z = -1 + i\\sqrt{3}$.',
    solution: '$$|z| = \\sqrt{(-1)^2 + (\\sqrt{3})^2} = \\sqrt{1+3} = 2$$\n\n$z$ se află în cadranul II ($\\text{Re}<0, \\text{Im}>0$):\n$$\\arg(z) = \\pi - \\arctan\\!\\left(\\frac{\\sqrt{3}}{1}\\right) = \\pi - \\frac{\\pi}{3} = \\frac{2\\pi}{3}$$\n\n$$\\boxed{|z| = 2, \\quad \\arg(z) = \\frac{2\\pi}{3}}$$'
  },

  /* ============================================================
     ALGEBRĂ — Ecuații exponențiale
     ============================================================ */
  {
    id: 'log-ee-001', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC 2023, Varianta 10',
    title: 'Ecuație exponențială simplă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$2^x = 32$$',
    solution: '$$2^x = 2^5$$\n\nFuncția $2^x$ este strict crescătoare, deci:\n$$\\boxed{x = 5}$$'
  },
  {
    id: 'log-ee-002', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'usor', source: 'BAC 2022, Varianta 23',
    title: 'Reducere la aceeași bază',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$9^x = 3^{x+2}$$',
    solution: '$$3^{2x} = 3^{x+2}$$\n\nBazele sunt egale, deci:\n$$2x = x + 2 \\Rightarrow x = 2$$\n\n$$\\boxed{x = 2}$$'
  },
  {
    id: 'log-ee-003', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 4',
    title: 'Ecuație exponențială cu substituție',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$4^x - 5 \\cdot 2^x + 4 = 0$$',
    solution: 'Substituție: $t = 2^x > 0$\n$$t^2 - 5t + 4 = 0 \\Rightarrow (t-1)(t-4) = 0$$\n\n$t_1 = 1 \\Rightarrow 2^x = 2^0 \\Rightarrow x = 0$\n$t_2 = 4 \\Rightarrow 2^x = 2^2 \\Rightarrow x = 2$\n\n$$\\boxed{x \\in \\{0,\\, 2\\}}$$'
  },
  {
    id: 'log-ee-004', categoryId: 'algebra', subcategoryId: 'ec-exp',
    difficulty: 'dificil', source: 'BAC 2023, Varianta 26',
    title: 'Ecuație exponențială prin factorizare',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$2^{x+1} + 2^{x-1} = 5$$',
    solution: '$$2 \\cdot 2^x + \\frac{1}{2} \\cdot 2^x = 5$$\n$$\\frac{5}{2} \\cdot 2^x = 5 \\Rightarrow 2^x = 2$$\n\n$$\\boxed{x = 1}$$'
  },

  /* ============================================================
     ALGEBRĂ — Ecuații logaritmice
     ============================================================ */
  {
    id: 'log-el-001', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'usor', source: 'BAC 2022, Varianta 16',
    title: 'Ecuație logaritmică simplă',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$\\log_2(x) = 4$$',
    solution: '$$x = 2^4 = 16$$\n\nDomeniu: $x > 0$ ✓\n\n$$\\boxed{x = 16}$$'
  },
  {
    id: 'log-el-002', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'BAC 2023, Varianta 7',
    title: 'Ecuație cu suma logaritmilor',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$\\log(x-1) + \\log(x+2) = 1$$',
    solution: 'Domeniu: $x > 1$\n$$\\log[(x-1)(x+2)] = 1 \\Rightarrow (x-1)(x+2) = 10$$\n$$x^2 + x - 12 = 0 \\Rightarrow (x+4)(x-3) = 0$$\n\n$x = -4$ (respins, $\\notin$ domeniu)\n\n$$\\boxed{x = 3}$$'
  },
  {
    id: 'log-el-003', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 12',
    title: 'Ecuație logaritmică cu expresie pătratică',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$\\log_2(x^2 - 4x + 5) = 1$$',
    solution: '$$x^2 - 4x + 5 = 2^1 = 2$$\n$$x^2 - 4x + 3 = 0 \\Rightarrow (x-1)(x-3) = 0$$\n\nVerificăm că argumentul $> 0$ pentru $x \\in \\{1,3\\}$: ambele ✓\n\n$$\\boxed{x \\in \\{1,\\, 3\\}}$$'
  },
  {
    id: 'log-el-004', categoryId: 'algebra', subcategoryId: 'ec-log',
    difficulty: 'dificil', source: 'BAC 2022, Varianta 29',
    title: 'Ecuație cu logaritmi de baze diferite',
    statement: 'Rezolvați în $\\mathbb{R}$ ecuația:\n$$\\log_2(x) + \\log_4(x) = 3$$',
    solution: '$$\\log_4(x) = \\frac{\\log_2 x}{\\log_2 4} = \\frac{\\log_2 x}{2}$$\n$$\\log_2 x + \\frac{\\log_2 x}{2} = 3 \\Rightarrow \\frac{3}{2}\\log_2 x = 3 \\Rightarrow \\log_2 x = 2$$\n\n$$\\boxed{x = 4}$$'
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
