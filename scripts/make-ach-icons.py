#!/usr/bin/env python3
"""Medaliile pentru Realizari (assets/images/ach/): patru baze (bronz, argint, aur, blocat) si 11 simboluri care se pun peste moneda.
Se compun in pagina cu doua <img> suprapuse (js/achievements.js). Foloseste uneltele din scripts/make-admin-icons.py.
Rulare din radacina: python3 scripts/make-ach-icons.py"""
import os
here = os.path.dirname(__file__)
src = open(os.path.join(here, 'make-admin-icons.py'), encoding='utf-8').read()
exec(src[:src.index('I = {}')])
OUT = os.path.join(here, '..', 'assets', 'images', 'ach')
os.makedirs(OUT, exist_ok=True)
CX, CY = 32, 39    # the centre of the coin

def line(d, color, w=3.4):
    return '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, color, w)

def base(face, edge, ring, rib1, rib1e, rib2, rib2e):
    return svg(
        '<g transform="rotate(-16 22 14)">' + sh('<rect x="15" y="1" width="12" height="26" rx="3"/>', rib1, rib1e, 2) + '</g>' +
        '<g transform="rotate(16 42 14)">' + sh('<rect x="37" y="1" width="12" height="26" rx="3"/>', rib2, rib2e, 2) + '</g>' +
        sh('<circle cx="%d" cy="%d" r="23"/>' % (CX, CY), face, edge, 3) +
        '<circle cx="%d" cy="%d" r="18.2" fill="none" stroke="%s" stroke-width="2.2"/>' % (CX, CY, ring) +
        '<path d="M15 31Q19 21 29 19" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="2.6" stroke-linecap="round"/>')

BASES = {
    'm-bronze': base('#E8A167', '#B2622A', '#F5C79B', LIME, LIMEE, ORG, ORGE),
    'm-silver': base('#DDE2EE', '#98A1BA', '#F4F6FB', LIME, LIMEE, ORG, ORGE),
    'm-gold':   base(GOLD, GOLDE, '#FFF0B0', LIME, LIMEE, ORG, ORGE),
    'm-lock':   base('#E3DEEE', '#BDB4D4', '#F1EEF8', '#D3CCE4', '#BDB4D4', '#D3CCE4', '#BDB4D4'),
}

# glyphs: drawn in about a 24 x 24 box around the centre of the coin, dark violet
G = V1
def at(x, y): return 'transform="translate(%g %g) scale(1.2) translate(-12 -12)"' % (CX, CY)
def wrap(body): return svg('<g %s>%s</g>' % (at(0, 0), body))

GLYPHS = {
    # a flame
    'flame': wrap('<path d="M12 1C13 6 19 8.5 19 15a7 7 0 0 1-14 0c0-3 1.4-4.6 3-6 .3 2 1.2 3 2.4 3.2C9.8 8 10.4 4 12 1Z" fill="%s"/>' % G +
                  '<path d="M12 22a3.6 3.6 0 0 1-3.6-3.6c0-2 1.6-3 3.6-5.2 2 2.2 3.6 3.2 3.6 5.2A3.6 3.6 0 0 1 12 22Z" fill="#FFD23F"/>'),
    # a check inside a ring
    'check': wrap('<circle cx="12" cy="12" r="9.5" fill="none" stroke="%s" stroke-width="3"/>' % G + line('M7.5 12.4l3.2 3.2 6-6.6', G, 3.2)),
    # an open book
    'book': wrap('<path d="M12 6C9.5 4 6 3.6 2.5 4v14c3.5-.4 7 0 9.5 2 2.5-2 6-2.4 9.5-2V4c-3.5-.4-7 0-9.5 2Z" fill="%s"/>' % G +
                 '<path d="M12 6v14" stroke="#fff" stroke-opacity="0.85" stroke-width="1.6"/>'),
    # a bolt
    'bolt': wrap('<path d="M14 1L4 13.5h6.5L9 23l10.5-13H13Z" fill="%s" stroke="%s" stroke-width="1.6" stroke-linejoin="round"/>' % (G, G)),
    # a stopwatch
    'watch': wrap('<rect x="9.5" y="0.5" width="5" height="3" rx="1.2" fill="%s"/>' % G +
                  '<circle cx="12" cy="13.5" r="8.6" fill="none" stroke="%s" stroke-width="3"/>' % G + line('M12 13.5V8.6', G, 2.8) + line('M12 13.5l3.6 2.2', ORGE, 2.6)),
    # a star
    'star': wrap('<path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.5 5.6 21.1 7 14 1.7 9l7.2-.9Z" fill="%s" stroke="%s" stroke-width="1.4" stroke-linejoin="round"/>' % (G, G)),
    # a sheet with lines
    'sheet': wrap('<rect x="3.5" y="1.5" width="17" height="21" rx="3.4" fill="%s"/>' % G + line('M8 8h8', '#fff', 2.2) + line('M8 12.4h8', '#fff', 2.2) + line('M8 16.8h4.6', '#fff', 2.2)),
    # a board on legs
    'board': wrap('<rect x="1.5" y="2" width="21" height="14" rx="3" fill="%s"/>' % G + line('M5.5 12.5q2.6-6 5-2.2t4.6-3.4', '#fff', 2) +
                  line('M7 16.2L5 22M17 16.2L19 22', G, 2.4)),
    # two people
    'people': wrap('<circle cx="8.4" cy="7.2" r="3.6" fill="%s"/>' % G + '<path d="M1.4 20.5c0-4.4 3-7 7-7s7 2.6 7 7Z" fill="%s"/>' % G +
                   '<circle cx="17.4" cy="8" r="3" fill="%s" fill-opacity="0.6"/>' % G + '<path d="M16 14.2c4.2-.6 7 1.8 7 6.3h-6.4c0-2.6-.2-4.6-.6-6.3Z" fill="%s" fill-opacity="0.6"/>' % G),
    # a speech bubble
    'chat': wrap('<path d="M4.5 3h15a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H11l-5.5 4v-4H4.5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" fill="%s"/>' % G + line('M6.5 8.4h11', '#fff', 2) + line('M6.5 12.4h7', '#fff', 2)),
    # a stack of books with a plus
    'library': wrap('<rect x="2" y="14" width="20" height="5.6" rx="2" fill="%s"/>' % G + '<rect x="4" y="8" width="16" height="5.2" rx="2" fill="%s" fill-opacity="0.75"/>' % G +
                    '<rect x="1.5" y="21" width="21" height="2" rx="1" fill="%s"/>' % G + line('M12 1.2v5M9.5 3.7h5', G, 2.2)),
}

for name, body in BASES.items():
    open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(body)
for name, body in GLYPHS.items():
    open(os.path.join(OUT, 'g-' + name + '.svg'), 'w', encoding='utf-8').write(body)
print(len(BASES), 'bases,', len(GLYPHS), 'glyphs')
