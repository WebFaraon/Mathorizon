#!/usr/bin/env python3
"""Iconitele pasului "Ce antrenament vrei" din Antrenament (assets/images/antrenament/*.svg), in limbajul bufnitei.
Foloseste uneltele din scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-antrenament-icons.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'antrenament')
os.makedirs(OUT, exist_ok=True)
I = {}
# rapid: a lightning bolt on a violet tile
I['rapid'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    fill('<path d="M6 21a15 15 0 0 1 15-15h22a15 15 0 0 1 15 15v2a50 14 0 0 0-52 0Z"/>', V3) +
    sh('<path d="M36 12 20 35h10l-3 17 17-25H34Z" stroke-linejoin="round" stroke-width="3" stroke="%s"/>' % GOLD, GOLD, GOLDE, 3) +
    spark(54, 8, VL) + spark(10, 54, LAV, .8))
# personalizat: three sliders
def slider(y, x, col, ecol):
    return (fill('<rect x="13" y="%d" width="38" height="6" rx="3"/>' % (y - 3), '#3A1F6B') +
            sh('<circle cx="%d" cy="%d" r="7.5"/>' % (x, y), col, ecol, 2))
I['personalizat'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    slider(21, 42, LIME, LIMEE) + slider(32, 24, GOLD, GOLDE) + slider(43, 38, ORG, ORGE) +
    spark(55, 9, VL))
I['greseli'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    sh('<circle cx="31" cy="33" r="19"/>', ORG, ORGE, 2) + fill('<circle cx="31" cy="33" r="12.5"/>', '#fff') + fill('<circle cx="31" cy="33" r="6.5"/>', ORG) +
    '<path d="M33 31 49 15" stroke="%s" stroke-width="4.6" stroke-linecap="round"/>' % LIME + '<path d="M43 14l6 1 1 6" fill="none" stroke="%s" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' % LIME +
    spark(54, 54, VL, .8))
for k, v in I.items():
    open(os.path.join(OUT, k + '.svg'), 'w', encoding='utf-8').write(v)
print(len(I), 'icons')
