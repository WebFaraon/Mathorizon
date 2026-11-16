#!/usr/bin/env python3
"""Iconitele de bifa ale misiunilor (assets/images/gamification/bifa.svg si bifa-gol.svg), in limbajul bufnitei.
Foloseste uneltele din scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-mission-icons.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'gamification')
done = svg(
    sh('<circle cx="32" cy="31" r="24"/>', LIME, LIMEE, 4) +
    fill('<path d="M13 24a21 21 0 0 1 38 0a30 14 0 0 0-38 0Z"/>', '#A6DB28') +
    '<path d="M21 32l8.5 8.5L44 24" fill="none" stroke="#FFFFFF" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    spark(56, 8, GOLD, 0.9))
empty = svg(
    sh('<circle cx="32" cy="31" r="24"/>', '#E6DEF6', '#C3B6E2', 4) +
    '<circle cx="32" cy="31" r="15" fill="none" stroke="#C2B5E1" stroke-width="4" stroke-dasharray="1 7" stroke-linecap="round"/>')
open(os.path.join(OUT, 'bifa.svg'), 'w', encoding='utf-8').write(done)
open(os.path.join(OUT, 'bifa-gol.svg'), 'w', encoding='utf-8').write(empty)
print('bifa, bifa-gol')
