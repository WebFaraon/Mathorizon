#!/usr/bin/env python3
"""Iconitele cheilor din placa profilului si ale butoanelor de schimbat poza (assets/images/profile/btn-<id>.svg), in limbajul bufnitei.
Aceleasi unelte ca scripts/make-admin-icons.py. Rulare din radacina: python3 scripts/make-profile-buttons.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'profile')
os.makedirs(OUT, exist_ok=True)

def line(d, c, w=3.4):
    return '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, c, w)

B = {}
# Registru: a violet ledger with white pages, ruled lines and a lime bookmark
B['registru'] = svg(
    sh('<rect x="9" y="6" width="42" height="52" rx="9"/>', V2, VE) +
    fill('<rect x="15" y="6" width="3.6" height="52" rx="1.8"/>', V1) +
    fill('<rect x="22" y="13" width="23" height="29" rx="4"/>', WH) +
    line('M26.5 20h14', LAV, 3) + line('M26.5 26h14', LAV, 3) + line('M26.5 32h9', LAV, 3) +
    fill('<path d="M38 42h9v15l-4.5-3.6L38 57Z"/>', LIME) + fill('<path d="M38 42h9v4.2h-9Z"/>', '#A6DB28') +
    spark(56, 10, VL))
# Adauga exercitiu: a sheet with rules and a gold coin with a plus on the corner
B['exercitiu'] = svg(
    sh('<rect x="8" y="6" width="42" height="52" rx="9"/>', WH, WHE) +
    fill('<rect x="8" y="6" width="42" height="13" rx="9"/>', V2) + fill('<rect x="8" y="13" width="42" height="6"/>', V2) +
    fill('<circle cx="17" cy="12.5" r="2.3"/>', WH) + fill('<circle cx="25" cy="12.5" r="2.3"/>', WH) +
    line('M16 28h22', LAV, 3.4) + line('M16 36h14', LAV, 3.4) +
    sh('<circle cx="46" cy="46" r="13"/>', GOLD, GOLDE, 2.4) +
    line('M46 39.5v13M39.5 46h13', '#fff', 4.4) + spark(56, 8, VL))
# Biblioteca: three books standing on a shelf (violet, orange, lime), one leaning
B['biblioteca'] = svg(
    sh('<rect x="7" y="9" width="14" height="42" rx="4"/>', V2, VE) +
    fill('<rect x="7" y="16" width="14" height="4" rx="1"/>', VL) +
    sh('<rect x="23" y="5" width="14" height="46" rx="4"/>', ORG, ORGE) +
    fill('<rect x="23" y="12" width="14" height="4" rx="1"/>', '#FFC58A') +
    '<g transform="rotate(14 49 51)">' + sh('<rect x="40" y="11" width="14" height="40" rx="4"/>', LIME, LIMEE) +
    fill('<rect x="40" y="18" width="14" height="4" rx="1"/>', '#C9EE74') + '</g>' +
    sh('<rect x="3" y="51" width="58" height="8" rx="4"/>', GOLD, GOLDE, 2) + spark(30, 1.5, VL, .8))
# Editeaza profilul: a card with a person-less ruled body and a gold pencil across it
B['editeaza'] = svg(
    sh('<rect x="6" y="9" width="44" height="46" rx="9"/>', WH, WHE) +
    fill('<circle cx="19" cy="23" r="5"/>', V2) + line('M14 36h22', LAV, 3.4) + line('M14 44h12', LAV, 3.4) +
    '<g transform="translate(-6 2) rotate(42 44 36) translate(44 36) scale(.86) translate(-44 -36)">' +
    sh('<rect x="38.5" y="9" width="11" height="40" rx="3.5"/>', GOLD, GOLDE, 2.4) +
    fill('<rect x="38.5" y="9" width="11" height="8" rx="3.5"/>', ORG) +
    fill('<path d="M38.5 49h11L44 60Z"/>', '#F2D7B0') + fill('<path d="M41.6 55.5h4.8L44 60Z"/>', V1) + '</g>' +
    spark(55, 8, VL))
# Camera: a violet body with a lens, a gold flash and a lime shutter
B['camera'] = svg(
    sh('<path d="M21 12h22l4 7h5a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8V27a8 8 0 0 1 8-8h5Z"/>', V2, VE) +
    fill('<circle cx="32" cy="37" r="14"/>', WH) + fill('<circle cx="32" cy="37" r="9.5"/>', V1) +
    fill('<circle cx="32" cy="37" r="5"/>', V3) + fill('<circle cx="29.6" cy="34.6" r="2"/>', '#fff') +
    fill('<circle cx="50" cy="26" r="3"/>', GOLD) + fill('<rect x="12" y="23" width="9" height="4.4" rx="2.2"/>', LIME) +
    spark(57, 8, VL))
# Admin: a gear with a lime centre
import math
teeth = ''.join('<g transform="rotate(%d 32 32)">%s</g>' % (a, fill('<rect x="27" y="4" width="10" height="14" rx="3"/>', V3)) for a in range(0, 360, 45))
gear_edge = ''.join('<g transform="rotate(%d 32 32)">%s</g>' % (a, fill('<rect x="27" y="4" width="10" height="14" rx="3"/>', VE)) for a in range(0, 360, 45))
B['admin'] = svg(
    '<g transform="translate(5.1 4.5) scale(.84)"><g transform="translate(0 3)">' + gear_edge + fill('<circle cx="32" cy="32" r="19"/>', VE) + '</g>' +
    teeth + fill('<circle cx="32" cy="32" r="19"/>', V2) +
    sh('<circle cx="32" cy="32" r="8.5"/>', LIME, LIMEE, 2) + fill('<circle cx="32" cy="32" r="3.4"/>', '#fff') + '</g>' + spark(57, 8, VL))

for name, body in B.items():
    open(os.path.join(OUT, 'btn-' + name + '.svg'), 'w', encoding='utf-8').write(body)
    print('btn-' + name + '.svg')
