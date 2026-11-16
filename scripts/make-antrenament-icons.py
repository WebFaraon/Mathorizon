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
# rapid: the same bolt as the XP icon (gamification/xp.svg), big on a violet tile with a soft glow behind it
BOLT = 'M74 8L26 72H58L50 120L102 50H71L74 8Z'
I['rapid'] = svg(
    sh('<rect x="6" y="6" width="52" height="52" rx="15"/>', V2, VE) +
    fill('<path d="M6 21a15 15 0 0 1 15-15h22a15 15 0 0 1 15 15v2a50 14 0 0 0-52 0Z"/>', V3) +
    '<circle cx="32" cy="33" r="19" fill="%s" opacity=".35"/>' % V3 +
    '<g transform="translate(8.6 8.4) scale(.372)">' +
    '<path d="%s" fill="%s" stroke="%s" stroke-width="9" stroke-linejoin="round" transform="translate(0 7)"/>' % (BOLT, GOLDE, GOLDE) +
    '<path d="%s" fill="%s" stroke="%s" stroke-width="9" stroke-linejoin="round"/>' % (BOLT, GOLD, GOLD) +
    '<path d="M70 22L42 62H62" fill="none" stroke="#FFF1B0" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>' +
    '</g>' +
    spark(52, 12, WH, .9) + spark(11, 52, LAV, .8) + spark(50, 52, LIME, .6))
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
# carti: two cards, the front one with a check (the "cards solved" counter of a round)
I['carti'] = svg(
    '<g transform="rotate(-12 26 34)">' + sh('<rect x="10" y="12" width="30" height="40" rx="7"/>', V1, VE, 3) + '</g>' +
    '<g transform="rotate(9 38 32)">' + sh('<rect x="22" y="10" width="30" height="42" rx="7"/>', WH, '#C9BEE3', 3) +
    fill('<rect x="22" y="10" width="30" height="13" rx="7"/>', '#EDE7F8') +
    '<path d="M31 35l5 5 9-11" fill="none" stroke="%s" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>' % LIMEE + '<path d="M31 33l5 5 9-11" fill="none" stroke="%s" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>' % LIME + '</g>' +
    spark(55, 10, GOLD, .9) + spark(8, 54, LAV, .8))
for k, v in I.items():
    open(os.path.join(OUT, k + '.svg'), 'w', encoding='utf-8').write(v)
print(len(I), 'icons')
