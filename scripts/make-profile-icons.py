#!/usr/bin/env python3
"""Iconitele casetelor cu informatii din profil (assets/images/profile/<id>.svg), in limbajul bufnitei.
Foloseste aceleasi unelte ca scripts/make-admin-icons.py (partea de pana la dictionarul I). Rulare din radacina: python3 scripts/make-profile-icons.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'profile')
os.makedirs(OUT, exist_ok=True)

def ring(x, y, w, h, r, col, edge, sw=7, dy=3):
    one = lambda c: '<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="none" stroke="%s" stroke-width="%g"/>' % (x, y, w, h, r, c, sw)
    return '<g transform="translate(0 %d)">%s</g>%s' % (dy, one(edge), one(col))

P = {}
P['tara'] = svg(
    sh('<circle cx="32" cy="32" r="25"/>', V2, VE) +
    fill('<path d="M17 23Q26 12 38 18Q38 27 28 30Q18 31 17 23Z"/>', LIME) +
    fill('<path d="M36 38Q47 34 51 42Q47 52 39 51Q33 46 36 38Z"/>', LIME) +
    '<ellipse cx="32" cy="32" rx="11" ry="25" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2"/>' +
    '<path d="M8 32H56" stroke="#fff" stroke-opacity=".38" stroke-width="2"/>' + spark(55, 9, LAV))
P['telefon'] = svg(
    sh('<rect x="17" y="5" width="30" height="54" rx="9"/>', V2, VE) +
    fill('<rect x="21.5" y="12" width="21" height="34" rx="4"/>', LAV) +
    fill('<rect x="25" y="17" width="14" height="4" rx="2"/>', V3) + fill('<rect x="25" y="25" width="10" height="4" rx="2"/>', VL) +
    sh('<circle cx="32" cy="38" r="5.5"/>', LIME, LIMEE, 2) +
    fill('<rect x="27" y="51" width="10" height="3" rx="1.5"/>', LAV) + spark(54, 14, VL))
P['email'] = svg(
    sh('<rect x="6" y="14" width="52" height="38" rx="8"/>', WH, WHE) +
    '<path d="M9 19L32 38L55 19" fill="none" stroke="%s" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>' % V2 +
    sh('<circle cx="52" cy="15" r="9"/>', LIME, LIMEE, 2) + '<path d="M52 10v10M47 15h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>')
P['link'] = svg(
    ring(5, 18, 34, 22, 11, V2, VE) + ring(25, 26, 34, 22, 11, ORG, ORGE) + spark(55, 10, VL))
P['rating'] = svg(
    '<g transform="translate(3.4 5.5) scale(.89)">' + sh('<path d="M32 5l8.2 17.2 18.8 2.3-13.8 12.9 3.6 18.6L32 46.7 15.2 56l3.6-18.6L5 24.5l18.8-2.3Z" stroke-linejoin="round" stroke-width="4" stroke="%s"/>' % GOLD, GOLD, GOLDE, 4) +
    fill('<path d="M32 12l5 10.6-9.2 1.1Z"/>', '#FFE98A') + '</g>' + spark(10, 10, VL) + spark(55, 52, ORG, .8))
P['membru'] = svg(
    fill('<rect x="16" y="5" width="5" height="11" rx="2.5"/>', V1) + fill('<rect x="39" y="5" width="5" height="11" rx="2.5"/>', V1) +
    sh('<rect x="6" y="10" width="48" height="46" rx="9"/>', WH, WHE) +
    fill('<path d="M6 19a9 9 0 0 1 9-9h30a9 9 0 0 1 9 9v6H6Z"/>', V2) +
    fill('<rect x="16" y="5" width="5" height="11" rx="2.5"/>', V1) + fill('<rect x="39" y="5" width="5" height="11" rx="2.5"/>', V1) +
    fill('<rect x="13" y="32" width="9" height="6" rx="2"/>', LAV) + fill('<rect x="27" y="32" width="9" height="6" rx="2"/>', LAV) +
    fill('<rect x="13" y="42" width="9" height="6" rx="2"/>', LAV) +
    sh('<circle cx="47" cy="45" r="12"/>', GOLD, GOLDE, 2) + '<path d="M47 38.5l2.1 4.4 4.8.6-3.5 3.3.9 4.8-4.3-2.4-4.3 2.4.9-4.8-3.5-3.3 4.8-.6Z" fill="%s"/>' % ORG)
P['autentificare'] = svg(
    sh('<path d="M32 5L54 13V31C54 45 44 54 32 59C20 54 10 45 10 31V13Z" stroke-linejoin="round" stroke-width="3" stroke="%s"/>' % V2, V2, VE) +
    fill('<path d="M32 10L49 16V31C49 41 42 48 32 52Z"/>', V3) +
    '<path d="M21 32l8 8 14-16" fill="none" stroke="#fff" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>' + spark(56, 8, LAV))
for k, v in P.items():
    open(os.path.join(OUT, k + '.svg'), 'w', encoding='utf-8').write(v)
print(len(P), 'icons')
