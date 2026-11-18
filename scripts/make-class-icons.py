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

# Simulari: a target with the arrow in the middle
simulari = svg(
    sh('<circle cx="29" cy="36" r="25"/>', V2, VE) +
    fill('<circle cx="29" cy="36" r="18.5"/>', WH) +
    fill('<circle cx="29" cy="36" r="12"/>', V3) +
    fill('<circle cx="29" cy="36" r="6"/>', GOLD) +
    st('M31 34L55 10', LIME, LIMEE, 4.6, 2) +
    line('M54 11L48.5 9.5', LIME, 3.4) + line('M54 11L55.5 5', LIME, 3.4) + line('M56 9L61 7.5', LIME, 3.4) +
    spark(10, 10, VL))

# Matematica: a violet tile with a white pi, a gold ruler along the bottom and a lime plus
mat = svg(
    sh('<rect x="5" y="5" width="54" height="52" rx="14"/>', V2, VE, 4) +
    fill('<rect x="9" y="9" width="46" height="44" rx="10"/>', V3).replace('fill="%s"' % V3, 'fill="%s" fill-opacity="0.28"' % VL) +
    line('M18 22H46', '#fff', 6) + line('M25 22V43', '#fff', 6) + line('M39 22Q38 40 46 42', '#fff', 6) +
    sh('<rect x="30" y="50" width="30" height="10" rx="3"/>', GOLD, GOLDE, 2) +
    ''.join(fill('<rect x="%g" y="%g" width="2" height="%g" rx="1"/>' % (x, 50, h), V1) for x, h in [(35, 5), (40, 3.4), (45, 5), (50, 3.4), (55, 5)]) +
    sh('<circle cx="14" cy="52" r="7"/>', LIME, LIMEE, 2) + line('M14 48.5v7M10.5 52h7', '#fff', 2.8) + spark(53, 11, '#fff', 0.9))

for name, body in (('lectie', lectie), ('teme', teme), ('simulari', simulari), ('matematica', mat)):
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(body)
    print(name + '.svg')
