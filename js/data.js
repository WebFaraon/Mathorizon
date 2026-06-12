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
    difficulty: 'greu', source: 'BAC — Algebră',
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
    difficulty: 'greu', source: 'BAC — Algebră',
    title: 'Logaritm compus (logaritm dintr-un logaritm)',
    statement: 'Calculați valoarea expresiei:\n$$\\log_{\\frac{1}{9}}\\!\\left(\\log_3 \\sqrt{729}\\right)$$',
    solution: '**Interior:**\n$$\\sqrt{729} = (3^6)^{1/2} = 3^3 = 27 \\Rightarrow \\log_3 27 = 3$$\n\n**Exterior** $\\left(\\dfrac{1}{9} = 3^{-2}\\right)$:\n$$\\log_{3^{-2}} 3 = \\frac{1}{-2} = \\boxed{-\\dfrac{1}{2}}$$'
  },
  {
    id: 'ca-012', categoryId: 'algebra', subcategoryId: 'calcul-algebric',
    difficulty: 'greu', source: 'BAC — Algebră',
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
    difficulty: 'greu', source: 'BAC — Algebră',
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
    difficulty: 'greu', source: 'BAC — Algebră',
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
    difficulty: 'greu', source: 'BAC — Algebră',
    title: 'Putere cu exponent logaritm și putere rațională',
    statement: 'Calculați valoarea expresiei:\n$$49^{\\frac{1}{\\log_5 7}} - 81^{\\frac{1}{4}}$$',
    solution: '$$\\frac{1}{\\log_5 7} = \\log_7 5 \\quad\\text{(proprietatea inversului)}$$\n\n$$49^{\\log_7 5} = (7^2)^{\\log_7 5} = 7^{2\\log_7 5} = \\left(7^{\\log_7 5}\\right)^2 = 5^2 = 25$$\n\n$$81^{1/4} = (3^4)^{1/4} = 3$$\n\n$$25 - 3 = \\boxed{22}$$'
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
    difficulty: 'greu', source: 'BAC 2020, Varianta 18',
    title: 'Inecuație cu fracție rațională',
    statement: 'Rezolvați în $\\mathbb{R}$ inecuația:\n$$\\frac{x+1}{x-2} \\geq 0$$',
    solution: 'Condiție: $x \\neq 2$\n\nTabel de semne:\n\n| $x$ | $(-\\infty,-1)$ | $-1$ | $(-1,2)$ | $2$ | $(2,+\\infty)$ |\n|-----|------|------|------|------|------|\n| $x+1$ | $-$ | $0$ | $+$ | $+$ | $+$ |\n| $x-2$ | $-$ | $-$ | $-$ | $\\nexists$ | $+$ |\n| raport | $+$ | $0$ | $-$ | $\\nexists$ | $+$ |\n\n$$\\boxed{x \\in (-\\infty,\\,-1] \\cup (2,\\,+\\infty)}$$'
  },

  /* ============================================================
     ALGEBRĂ — Polinoame
     ============================================================ */
  {
    id: 'alg-pol-001', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC 2022, Varianta 27',
    title: 'Împărțirea polinoamelor (schema Horner)',
    statement: 'Împărțiți $P(x) = x^3 - 2x^2 + x - 2$ la $(x - 2)$.',
    solution: 'Schema lui Horner pentru $x = 2$:\n\n$$\\begin{array}{c|cccc} 2 & 1 & -2 & 1 & -2 \\\\ & & 2 & 0 & 2 \\\\ \\hline & 1 & 0 & 1 & 0 \\end{array}$$\n\nCâtul: $x^2 + 1$, rest $= 0$\n\n$$P(x) = (x-2)(x^2+1)$$'
  },
  {
    id: 'alg-pol-002', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'mediu', source: 'BAC 2021, Varianta 16',
    title: 'Rădăcini și descompunere în factori',
    statement: 'Verificați că $x = 1$ este rădăcină a lui $P(x) = x^3 - 3x + 2$ și descompuneți $P(x)$.',
    solution: '$P(1) = 1 - 3 + 2 = 0$ ✓  — teorema lui Bézout: $(x-1) \\mid P(x)$\n\nDupă împărțire: $P(x) = (x-1)(x^2 + x - 2)$\n\nDescompunem $x^2 + x - 2 = (x-1)(x+2)$:\n\n$$\\boxed{P(x) = (x-1)^2(x+2)}$$'
  },
  {
    id: 'alg-pol-003', categoryId: 'algebra', subcategoryId: 'polinoame',
    difficulty: 'greu', source: 'BAC 2023, Varianta 21',
    title: 'Determinarea coeficienților din condiții de divizibilitate',
    statement: 'Găsiți $a, b \\in \\mathbb{R}$ astfel încât $P(x) = x^3 + ax^2 + bx - 6$ să fie divizibil cu $(x-1)$ și $(x+2)$.',
    solution: '$P(1) = 0 \\Rightarrow 1 + a + b - 6 = 0 \\Rightarrow a + b = 5$ \\quad (1)\n\n$P(-2) = 0 \\Rightarrow -8 + 4a - 2b - 6 = 0 \\Rightarrow 2a - b = 7$ \\quad (2)\n\n$(1)+(2): 3a = 12 \\Rightarrow a = 4,\\; b = 1$\n\n$$\\boxed{a = 4,\\quad b = 1}$$'
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
    difficulty: 'greu', source: 'BAC 2023, Varianta 26',
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
    difficulty: 'greu', source: 'BAC 2022, Varianta 29',
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
    difficulty: 'greu', source: 'BAC 2022, Varianta 32',
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
    difficulty: 'greu', source: 'BAC 2023, Varianta 35',
    title: 'Limită cu radical — forma $\\infty - \\infty$',
    statement: 'Calculați:\n$$\\lim_{x \\to \\infty} \\left(\\sqrt{x+3} - \\sqrt{x}\\right)$$',
    solution: 'Înmulțim cu conjugatul:\n$$\\frac{(\\sqrt{x+3}-\\sqrt{x})(\\sqrt{x+3}+\\sqrt{x})}{\\sqrt{x+3}+\\sqrt{x}} = \\frac{3}{\\sqrt{x+3}+\\sqrt{x}}$$\n\nCând $x \\to \\infty$: numitorul $\\to +\\infty$\n\n$$\\boxed{\\lim = 0}$$'
  },
  {
    id: 'an-lim-005', categoryId: 'analiza', subcategoryId: 'limite',
    difficulty: 'greu', source: 'BAC 2022, Varianta 13',
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
    difficulty: 'greu', source: 'BAC 2023, Varianta 8',
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
    difficulty: 'greu', source: 'BAC 2023, Varianta 19',
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
    difficulty: 'greu', source: 'BAC 2023, Varianta 15',
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
    difficulty: 'greu', source: 'BAC 2021, Varianta 30',
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
