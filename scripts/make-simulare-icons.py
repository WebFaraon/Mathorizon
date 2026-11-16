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
# canvas: a white sheet with a written line and a lime pencil (centred on the tile)
I['canvas'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    fill('<path d="M6 21a15 15 0 0 1 15-15h22a15 15 0 0 1 15 15v2a50 14 0 0 0-52 0Z"/>', V3) +
    sh('<rect x="17" y="15" width="26" height="33" rx="5"/>', WH, '#C9BEE3', 3) +
    '<path d="M22 25h16M22 32h10" stroke="%s" stroke-width="3" stroke-linecap="round" fill="none"/>' % V1 +
    '<g transform="rotate(38 42 38)">' + sh('<rect x="38" y="21" width="9" height="26" rx="3"/>', LIME, LIMEE, 2.5) + fill('<path d="M38 47h9l-4.5 8Z"/>', GOLD) + '</g>')
# poze: a camera, its middle on the middle of the tile (32, 32)
I['poze'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    fill('<path d="M6 21a15 15 0 0 1 15-15h22a15 15 0 0 1 15 15v2a50 14 0 0 0-52 0Z"/>', V3) +
    sh('<path d="M16 21h6l2.5-4h15l2.5 4h6a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z"/>', WH, '#C9BEE3', 3) +
    sh('<circle cx="32" cy="33" r="9.5"/>', V1, VE, 2) + fill('<circle cx="32" cy="33" r="5.4"/>', LAV) + fill('<circle cx="30" cy="31" r="1.8"/>', WH) +
    fill('<circle cx="45" cy="26.5" r="1.8"/>', ORG))
for k, v in I.items():
    open(os.path.join(OUT, k + '.svg'), 'w', encoding='utf-8').write(v)
print(len(I), 'icons')
