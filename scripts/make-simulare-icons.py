#!/usr/bin/env python3
"""Iconitele pasului 2 din Simulare (assets/images/simulare/*.svg), in limbajul bufnitei.
Foloseste uneltele din scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-simulare-icons.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'simulare')
os.makedirs(OUT, exist_ok=True)
I = {}
# canvas: a white sheet with a written line and a lime pencil
I['canvas'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    fill('<path d="M6 21a15 15 0 0 1 15-15h22a15 15 0 0 1 15 15v2a50 14 0 0 0-52 0Z"/>', V3) +
    sh('<rect x="15" y="14" width="30" height="36" rx="5"/>', WH, '#C9BEE3', 3) +
    '<path d="M21 25h18M21 32h12" stroke="%s" stroke-width="3" stroke-linecap="round" fill="none"/>' % V1 +
    '<g transform="rotate(38 44 38)">' + sh('<rect x="40" y="20" width="9" height="30" rx="3"/>', LIME, LIMEE, 2.5) + fill('<path d="M40 50h9l-4.5 8Z"/>', GOLD) + '</g>' +
    spark(53, 11, WH, .9))
# poze: a camera
I['poze'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    fill('<path d="M6 21a15 15 0 0 1 15-15h22a15 15 0 0 1 15 15v2a50 14 0 0 0-52 0Z"/>', V3) +
    sh('<path d="M14 24h8l3-5h14l3 5h8a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V27a3 3 0 0 1 3-3Z"/>', WH, '#C9BEE3', 3) +
    sh('<circle cx="32" cy="38" r="10.5"/>', V1, VE, 2) + fill('<circle cx="32" cy="38" r="6"/>', LAV) + fill('<circle cx="29.5" cy="35.5" r="2"/>', WH) +
    fill('<circle cx="46" cy="30" r="2"/>', ORG) +
    spark(53, 11, WH, .9))
for k, v in I.items():
    open(os.path.join(OUT, k + '.svg'), 'w', encoding='utf-8').write(v)
print(len(I), 'icons')
