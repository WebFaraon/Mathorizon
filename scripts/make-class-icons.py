#!/usr/bin/env python3
"""Iconitele paginii unei clase, in limbajul bufnitei (o muchie solida mai inchisa sub fiecare forma):
lectie.svg (Urmatoarea lectie), teme.svg, simulari.svg si matematica.svg (disciplina Matematica) in assets/images/class/.
Foloseste uneltele din scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-class-icons.py"""
import os, math
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'class')

def line(d, color, w=3.4):
    return '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, color, w)

# Urmatoarea lectie: a clock with two bells, a lime play badge
lectie = svg(
    sh('<circle cx="13" cy="13" r="7"/>', GOLD, GOLDE, 2) + sh('<circle cx="51" cy="13" r="7"/>', GOLD, GOLDE, 2) +
    sh('<circle cx="32" cy="35" r="25"/>', V2, VE) +
    fill('<circle cx="32" cy="35" r="19.5"/>', WH) +
    ''.join(fill('<rect x="%g" y="%g" width="%g" height="%g" rx="1.3"/>' % r, VL) for r in [(30.7, 18, 2.6, 5), (30.7, 47, 2.6, 5), (14.5, 33.7, 5, 2.6), (44.5, 33.7, 5, 2.6)]) +
    line('M32 35V24', V1, 4) + line('M32 35L40 40', ORG, 4) +
    fill('<circle cx="32" cy="35" r="3.2"/>', V1) +
    sh('<circle cx="52" cy="52" r="9"/>', LIME, LIMEE, 2) +
    fill('<path d="M49.5 47.5L57 52L49.5 56.5Z"/>', '#fff') + spark(8, 36, VL, 0.8))

# Teme: a sheet with three bullets, a binder clip and the pencil
teme = svg(
    sh('<rect x="8" y="9" width="42" height="50" rx="9"/>', WH, WHE) +
    ''.join(fill('<circle cx="19" cy="%g" r="3.2"/>' % y, c) for y, c in [(26, LIME), (37, GOLD), (48, V3)]) +
    line('M27 26h16', LAV, 3.6) + line('M27 37h16', LAV, 3.6) + line('M27 48h10', LAV, 3.6) +
    sh('<rect x="20" y="4" width="18" height="11" rx="4.5"/>', V2, VE, 2) +
    fill('<circle cx="29" cy="9.5" r="2"/>', VL) +
    '<path d="M42 58L55 44L61 50L47 63L40 64Z" fill="%s" transform="translate(0 2)"/>' % GOLDE +
    '<path d="M42 58L55 44L61 50L47 63L40 64Z" fill="%s"/>' % GOLD +
    '<path d="M55 44L61 50L58 53L52 47Z" fill="%s"/>' % ORG +
    '<path d="M40 64L42 58L47 63Z" fill="%s"/>' % V1 + spark(57, 14, VL))

# Simulari: a target with a clean arrow (shaft, two feathers and a nock), drawn along one axis and turned
def arrow(color, feather):
    return ('<g transform="translate(29 36) rotate(-45)">' +
            '<path d="M3 0H34" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round"/>' % color +
            '<path d="M18 0l3-5.4h5.2L23.2 0z" fill="%s"/><path d="M18 0l3 5.4h5.2L23.2 0z" fill="%s"/>' % (feather, feather) +
            '</g>')
simulari = svg(
    sh('<circle cx="29" cy="36" r="25"/>', V2, VE) +
    fill('<circle cx="29" cy="36" r="18.5"/>', WH) +
    fill('<circle cx="29" cy="36" r="12"/>', V3) +
    fill('<circle cx="29" cy="36" r="6"/>', GOLD) +
    '<g transform="translate(0 2)">%s</g>' % arrow(LIMEE, ORGE) + arrow(LIME, ORG) +
    spark(10, 10, VL))

# Plus: a gold coin with a bold plus (for "new" keys)
plus = svg(
    sh('<circle cx="32" cy="31" r="26"/>', GOLD, GOLDE, 4) +
    '<path d="M13 22Q22 8 40 10" fill="none" stroke="#FFF1B8" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="M32 19V43M20 31H44" fill="none" stroke="#9A5B00" stroke-width="8" stroke-linecap="round" transform="translate(0 1.6)" opacity="0.35"/>' +
    '<path d="M32 19V43M20 31H44" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>')

# Sablon: two stacked sheets, a violet header band, rows and a gold bookmark
sablon = svg(
    '<g transform="rotate(9 32 34)">' + sh('<rect x="14" y="8" width="36" height="46" rx="8"/>', LAV, '#A99AD2') + '</g>' +
    sh('<rect x="9" y="12" width="40" height="47" rx="8"/>', WH, WHE) +
    fill('<path d="M9 21a9 9 0 0 1 9-9h22a9 9 0 0 1 9 9v5H9Z"/>', V2) +
    fill('<rect x="15" y="33" width="8" height="6" rx="2"/>', LIME) + line('M28 36h14', LAV, 3.6) +
    fill('<rect x="15" y="43" width="8" height="6" rx="2"/>', GOLD) + line('M28 46h10', LAV, 3.6) +
    '<path d="M41 3h12v19l-6-4.5L41 22Z" fill="%s" transform="translate(0 2)"/>' % GOLDE +
    '<path d="M41 3h12v19l-6-4.5L41 22Z" fill="%s"/>' % GOLD)

# Matematica: a violet tile with a white pi, a gold ruler along the bottom and a lime plus
mat = svg(
    sh('<rect x="5" y="5" width="54" height="52" rx="14"/>', V2, VE, 4) +
    fill('<rect x="9" y="9" width="46" height="44" rx="10"/>', V3).replace('fill="%s"' % V3, 'fill="%s" fill-opacity="0.28"' % VL) +
    line('M18 22H46', '#fff', 6) + line('M25 22V43', '#fff', 6) + line('M39 22Q38 40 46 42', '#fff', 6) +
    sh('<rect x="30" y="50" width="30" height="10" rx="3"/>', GOLD, GOLDE, 2) +
    ''.join(fill('<rect x="%g" y="%g" width="2" height="%g" rx="1"/>' % (x, 50, h), V1) for x, h in [(35, 5), (40, 3.4), (45, 5), (50, 3.4), (55, 5)]) +
    sh('<circle cx="14" cy="52" r="7"/>', LIME, LIMEE, 2) + line('M14 48.5v7M10.5 52h7', '#fff', 2.8) + spark(53, 11, '#fff', 0.9))

# Nivel: three ascending bars (violet, lime, gold) on a floor line, a star on the tallest
nivel = svg(
    sh('<rect x="7" y="38" width="14" height="20" rx="4.5"/>', V3, VE, 3) +
    sh('<rect x="25" y="26" width="14" height="32" rx="4.5"/>', LIME, LIMEE, 3) +
    sh('<rect x="43" y="12" width="14" height="46" rx="4.5"/>', GOLD, GOLDE, 3) +
    fill('<rect x="10.5" y="42" width="3" height="9" rx="1.5"/>', VL) +
    fill('<rect x="28.5" y="30" width="3" height="14" rx="1.5"/>', '#C8E67A') +
    fill('<rect x="46.5" y="16" width="3" height="20" rx="1.5"/>', '#FFF1B8') +
    spark(15, 20, VL) + spark(33, 11, LAV, 0.8))

# ---- Pulsul grupei, cardul clasei, mesaje si tipurile de teme (2026-11-19) ----
def star(cx, cy, R, r, color):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = R if i % 2 == 0 else r
        pts.append('%.2f,%.2f' % (cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>' % (' '.join(pts), color, color)

def bust(cx, cy, head, body, edge, hc=GOLD, he=GOLDE):
    """a person: a round head and a rounded body, both with their solid edge"""
    return (sh('<path d="M%g %gv-2a%g %g 0 0 1 %g 0v2Z"/>' % (cx - 11, cy + 22, 11, 11, 22), body, edge, 2) +
            sh('<circle cx="%g" cy="%g" r="6.6"/>' % (cx, cy + 4), hc, he, 2))

# Prezenta medie: a roster sheet with two people rows and a lime check badge
prezenta = svg(
    sh('<rect x="8" y="9" width="42" height="49" rx="9"/>', WH, WHE) +
    sh('<rect x="19" y="4" width="20" height="11" rx="4.5"/>', V2, VE, 2) + fill('<circle cx="29" cy="9.5" r="2"/>', VL) +
    ''.join(fill('<circle cx="18" cy="%g" r="3.8"/>' % y, c) + line('M26 %gh16' % y, LAV, 3.6) for y, c in [(26, GOLD), (38, V3), (50, GOLD)]) +
    sh('<circle cx="47" cy="45" r="13"/>', LIME, LIMEE, 3) +
    line('M40.5 45l5 5L54 40', '#fff', 4.4) + spark(55, 9, VL))

# Media elevilor pe ora: a clock behind two people
elevi_ora = svg(
    sh('<circle cx="40" cy="27" r="21"/>', V2, VE) +
    fill('<circle cx="40" cy="27" r="16.2"/>', WH) +
    ''.join(fill('<rect x="%g" y="%g" width="%g" height="%g" rx="1.2"/>' % r, VL) for r in [(38.8, 13, 2.4, 4.2), (38.8, 37.8, 2.4, 4.2), (26, 25.8, 4.2, 2.4), (49.8, 25.8, 4.2, 2.4)]) +
    line('M40 27V17', V1, 3.6) + line('M40 27L47 31', ORG, 3.6) + fill('<circle cx="40" cy="27" r="2.8"/>', V1) +
    bust(12, 32, 0, V2, VE) + bust(32, 36, 0, LIME, LIMEE) + spark(9, 15, VL, 0.8))

# Medie clasa: a report sheet with three bars and a gold star badge
medie = svg(
    sh('<rect x="7" y="10" width="44" height="48" rx="9"/>', WH, WHE) +
    sh('<rect x="12" y="41" width="8" height="12" rx="3"/>', V3, VE, 2) +
    sh('<rect x="23" y="33" width="8" height="20" rx="3"/>', LIME, LIMEE, 2) +
    sh('<rect x="34" y="26" width="8" height="27" rx="3"/>', GOLD, GOLDE, 2) +
    sh('<circle cx="50" cy="14" r="11.5"/>', ORG, ORGE, 3) + star(50, 14, 7, 3.2, '#fff') + spark(10, 7, VL))

# Marime grupa: three people in a row, the middle one in front
marime = svg(
    bust(14, 22, 0, LIME, LIMEE) + bust(50, 22, 0, ORG, ORGE) + bust(32, 20, 0, V2, VE) + spark(55, 8, VL, 0.9))

# Format: a building (offline) behind a monitor (online)
format_ = svg(
    sh('<rect x="6" y="20" width="26" height="38" rx="5"/>', WH, WHE) +
    ''.join(fill('<rect x="%g" y="%g" width="5" height="5" rx="1.5"/>' % (x, y), c) for x, y, c in [(11, 26, GOLD), (21, 26, V3), (11, 36, V3), (21, 36, GOLD)]) +
    fill('<rect x="14" y="47" width="10" height="11" rx="2.5"/>', V2) +
    sh('<rect x="26" y="9" width="35" height="25" rx="6"/>', V2, VE) +
    fill('<rect x="30" y="13" width="27" height="17" rx="3"/>', V1) +
    fill('<path d="M39 17.5L48 21.5L39 25.5Z"/>', LIME) +
    sh('<rect x="38" y="38" width="12" height="5" rx="2"/>', LAV, '#A99AD2', 2) + spark(58, 44, VL))

# Mesaje: a violet chat bubble with three lines, a lime bubble behind
mesaje = svg(
    sh('<path d="M34 34a7 7 0 0 1 7-7h13a7 7 0 0 1 7 7v10a7 7 0 0 1-7 7h-1v8l-8-8h-4a7 7 0 0 1-7-7Z"/>', LIME, LIMEE) +
    sh('<path d="M6 15a8 8 0 0 1 8-8h26a8 8 0 0 1 8 8v19a8 8 0 0 1-8 8H27L16 52v-10h-2a8 8 0 0 1-8-8Z"/>', V2, VE) +
    line('M15 17h24', '#fff', 3.8) + line('M15 25h24', VL, 3.8) + line('M15 33h13', VL, 3.8) + spark(56, 10, VL))

# Tip tema: text, a sheet with a big T and two lines
tip_text = svg(
    sh('<rect x="10" y="5" width="44" height="54" rx="9"/>', WH, WHE) +
    line('M20 19H44', V2, 6) + line('M32 19V37', V2, 6) +
    line('M19 46H45', LAV, 3.8) + line('M19 53H35', LAV, 3.8) + spark(55, 8, VL))

# Tip tema: PDF, a sheet with a folded corner and an orange band
def letters():
    g = ('<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(17.5 40.5)">'
         '<path d="M0 0v9M0 0h4a2.9 2.9 0 0 1 0 5.8H0"/>'
         '<path d="M10.5 0v9h2.2a4.5 4.5 0 0 0 0-9Z"/>'
         '<path d="M22 9V0h5.6M22 4.4h4.3"/></g>')
    return g
tip_pdf = svg(
    sh('<path d="M14 5h24l14 14v33a7 7 0 0 1-7 7H14a7 7 0 0 1-7-7V12a7 7 0 0 1 7-7Z"/>', WH, WHE) +
    fill('<path d="M38 5l14 14H44a6 6 0 0 1-6-6Z"/>', LAV) +
    sh('<rect x="12" y="33" width="38" height="20" rx="5"/>', ORG, ORGE, 2) + letters() +
    line('M15 20h14', LAV, 3.6) + line('M15 27h9', LAV, 3.6) + spark(56, 8, VL))

# Tip tema: images, a framed picture with a sun and two hills
tip_imagini = svg(
    '<defs><clipPath id="im"><rect x="9" y="12" width="46" height="40" rx="8"/></clipPath></defs>' +
    sh('<rect x="7" y="10" width="50" height="44" rx="10"/>', WH, WHE) +
    '<g clip-path="url(#im)">' + fill('<rect x="9" y="12" width="46" height="40" rx="8"/>', '#D9CDF3') +
    fill('<circle cx="42" cy="25" r="6.5"/>', GOLD) +
    fill('<path d="M5 56L22 31L38 56Z"/>', V3) + fill('<path d="M24 56L41 38L60 56Z"/>', LIME) + '</g>' + spark(55, 8, VL))

# Tip tema: AI import, a robot head with an antenna and two sparks
tip_ai = svg(
    line('M32 12V6', V1, 3.4) + sh('<circle cx="32" cy="6" r="4"/>', LIME, LIMEE, 2) +
    sh('<rect x="3" y="28" width="7" height="14" rx="3.5"/>', GOLD, GOLDE, 2) + sh('<rect x="54" y="28" width="7" height="14" rx="3.5"/>', GOLD, GOLDE, 2) +
    sh('<rect x="9" y="13" width="46" height="40" rx="14"/>', V2, VE) +
    fill('<rect x="14" y="20" width="36" height="26" rx="9"/>', V1) +
    fill('<circle cx="24" cy="32" r="4.4"/>', LIME) + fill('<circle cx="40" cy="32" r="4.4"/>', LIME) +
    line('M26 41h12', VL, 3) + spark(56, 10, '#FFF1B8', 0.9) + spark(8, 56, VL, 0.8))

for name, body in (('lectie', lectie), ('nivel', nivel), ('teme', teme), ('simulari', simulari), ('matematica', mat), ('plus', plus), ('sablon', sablon), ('prezenta', prezenta), ('elevi-ora', elevi_ora), ('medie', medie), ('marime', marime), ('format', format_), ('mesaje', mesaje), ('tip-text', tip_text), ('tip-pdf', tip_pdf), ('tip-imagini', tip_imagini), ('tip-ai', tip_ai)):
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(body)
    print(name + '.svg')
