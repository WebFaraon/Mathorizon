#!/usr/bin/env python3
"""Iconita Tabla live (assets/images/class/tabla.svg), in limbajul bufnitei. Foloseste uneltele din scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-tabla-icon.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'class', 'tabla.svg')
body = (
    # legs of the easel
    '<path d="M24 46L17 60M40 46L47 60" fill="none" stroke="%s" stroke-width="4.4" stroke-linecap="round"/>' % VE +
    '<path d="M32 46V58" fill="none" stroke="%s" stroke-width="4.4" stroke-linecap="round"/>' % VE +
    # the board: frame with a solid edge, dark green-violet slate inside
    sh('<rect x="5" y="8" width="54" height="38" rx="9"/>', V2, VE) +
    fill('<rect x="10" y="13" width="44" height="28" rx="4.5"/>', '#2C1952') +
    # chalk: a curve, a line and a lime check
    '<path d="M16 33Q21 22 27 29T38 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16 20h13" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"/>' % VL +
    '<path d="M40 33l4 4 7-9" fill="none" stroke="%s" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' % LIME +
    # chalk tray and a gold chalk
    sh('<rect x="20" y="44" width="24" height="5" rx="2.5"/>', GOLD, GOLDE, 2) +
    spark(57, 6, VL))
open(OUT, 'w', encoding='utf-8').write(svg(body))
print('tabla.svg')
