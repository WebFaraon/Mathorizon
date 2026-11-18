#!/usr/bin/env python3
"""Iconitele paginii unei clase, in limbajul bufnitei (o muchie solida mai inchisa sub fiecare forma):
lectie.svg (Urmatoarea lectie), teme.svg, simulari.svg si matematica.svg (disciplina Matematica) in assets/images/class/.
Foloseste uneltele din scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-class-icons.py"""
import os
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

for name, body in (('lectie', lectie), ('nivel', nivel), ('teme', teme), ('simulari', simulari), ('matematica', mat), ('plus', plus), ('sablon', sablon)):
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(body)
    print(name + '.svg')
