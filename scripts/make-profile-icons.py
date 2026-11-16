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
LAND, LANDE = '#8FD11B', '#4F7A00'
def land(d):
    return '<g transform="translate(0 2.2)"><path d="%s" fill="%s"/></g><path d="%s" fill="%s"/>' % (d, LANDE, d, LAND)
P['tara'] = svg(
    '<defs><clipPath id="g"><circle cx="32" cy="32" r="25"/></clipPath></defs>' +
    sh('<circle cx="32" cy="32" r="25"/>', V2, VE) +
    '<g clip-path="url(#g)">' +
    fill('<circle cx="32" cy="32" r="25"/>', '#4B2A9C') +
    land('M10 20C14 13 22 12 27 15C31 17 30 22 34 25C38 28 36 33 31 34C27 35 28 40 24 40C19 40 16 34 13 31C10 28 8 24 10 20Z') +
    land('M38 41C43 38 51 38 55 43C58 48 52 54 46 55C40 56 35 52 36 47C36 44 36 42 38 41Z') +
    land('M44 13C48 10 55 11 58 16C59 20 55 23 51 22C47 21 45 18 44 13Z') +
    '<path d="M32 7C21 14 21 50 32 57" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.8"/>' +
    '<path d="M32 7C43 14 43 50 32 57" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.8"/>' +
    '<path d="M7 32H57" stroke="#fff" stroke-opacity=".28" stroke-width="1.8"/>' +
    '<path d="M32 4A28 28 0 0 0 4 32 33 33 0 0 1 32 4Z" fill="#fff" fill-opacity=".22"/>' +
    '<path d="M60 36A28 28 0 0 1 32 60 28 28 0 0 0 60 36Z" fill="#1F1035" fill-opacity=".30"/>' +
    '</g>' + spark(56, 8, LAV))
P['telefon'] = svg(
    sh('<rect x="11" y="5" width="42" height="54" rx="11"/>', V2, VE) +
    fill('<rect x="16" y="12" width="32" height="34" rx="5"/>', LAV) +
    fill('<rect x="20" y="17" width="20" height="4.5" rx="2.2"/>', V3) + fill('<rect x="20" y="25" width="13" height="4" rx="2"/>', VL) +
    fill('<rect x="20" y="33" width="24" height="9" rx="3"/>', '#E7DEF7') +
    fill('<rect x="26" y="51" width="12" height="3" rx="1.5"/>', LAV) + spark(57, 12, VL))
P['email'] = svg(
    sh('<rect x="6" y="14" width="52" height="38" rx="8"/>', WH, WHE) +
    '<path d="M9 19L32 38L55 19" fill="none" stroke="%s" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>' % V2 +
    sh('<circle cx="52" cy="15" r="9"/>', LIME, LIMEE, 2) + '<path d="M52 10v10M47 15h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>')
P['link'] = svg(
    ring(5, 18, 34, 22, 11, V2, VE) + ring(25, 26, 34, 22, 11, ORG, ORGE) + spark(55, 10, VL))
SGOLD, SLIGHT, SDARK, SEDGE = '#FFC42E', '#FFE27A', '#F59A00', '#B85F00'
P['rating'] = svg(
    '<g transform="translate(0 4.5)"><path d="M32.0 9.0 39.1 25.3 56.7 27.0 43.4 38.7 47.3 56.0 32.0 47.0 16.7 56.0 20.6 38.7 7.3 27.0 24.9 25.3Z" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/></g>' % (SEDGE, SEDGE) +
    '<path d="M32.0 9.0 39.1 25.3 56.7 27.0 43.4 38.7 47.3 56.0 32.0 47.0 16.7 56.0 20.6 38.7 7.3 27.0 24.9 25.3Z" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"/>' % (SGOLD, SGOLD) +
    '<path d="M32.0 35.0 L24.9 25.3 L32.0 9.0 Z M32.0 35.0 L39.1 25.3 L56.7 27.0 Z M32.0 35.0 L43.4 38.7 L47.3 56.0 Z M32.0 35.0 L32.0 47.0 L16.7 56.0 Z M32.0 35.0 L20.6 38.7 L7.3 27.0 Z" fill="%s"/>' % SLIGHT +
    '<path d="M32.0 35.0 L32.0 9.0 L39.1 25.3 Z M32.0 35.0 L56.7 27.0 L43.4 38.7 Z M32.0 35.0 L47.3 56.0 L32.0 47.0 Z M32.0 35.0 L16.7 56.0 L20.6 38.7 Z M32.0 35.0 L7.3 27.0 L24.9 25.3 Z" fill="%s"/>' % SDARK +
    '<path d="M23 21Q25 16.5 29 13.5" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round"/>' +
    spark(9, 11, VL) + spark(57, 52, ORG, .8))
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
