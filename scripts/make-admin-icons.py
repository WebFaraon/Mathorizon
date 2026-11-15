#!/usr/bin/env python3
"""Genereaza iconitele ilustrate ale consolei de administrare (assets/images/admin/<id>.svg), in limbajul bufnitei:
fiecare forma are o muchie solida mai inchisa dedesubt. Se ruleaza din radacina proiectului: python3 scripts/make-admin-icons.py"""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'admin')
V1, V2, V3, VL, LAV, VE = '#3F236E', '#5B2FB3', '#7C58D1', '#B49AE8', '#CFC4E8', '#2C1952'
LIME, LIMEE = '#7BB403', '#4F7A00'
GOLD, GOLDE = '#FFD23F', '#C98600'
ORG, ORGE = '#FF8A12', '#C9520A'
WH, WHE = '#F1ECFA', '#B7A9DA'

def fill(el, color):
    return el.replace('/>', ' fill="%s"/>' % color, 1)

def sh(el, face, edge, dy=3):
    """a shape with its solid edge underneath"""
    return '<g transform="translate(0 %d)">%s</g>%s' % (dy, fill(el, edge), fill(el, face))

def st(d, face, edge, w=6, dy=3):
    """a thick rounded stroke with its edge"""
    one = lambda c: '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>' % (d, c, w)
    return '<g transform="translate(0 %d)">%s</g>%s' % (dy, one(edge), one(face))

def spark(x, y, c, s=1):
    return '<path d="M%g %gl%g %g %g %g %g %g %g %g-%g-%g-%g-%gZ" fill="%s"/>' % (x, y - 4*s, 1.1*s, 2.9*s, 2.9*s, 1.1*s, -2.9*s, 1.1*s, -1.1*s, 2.9*s, 1.1*s, 2.9*s, 2.9*s, 1.1*s, c) if False else \
        '<path d="M%g %g l%g %g %g %g %g %g %g %g %g %g %g %g %g %g Z" fill="%s"/>' % (
            x, y - 4*s, 1.1*s, 2.9*s, 2.9*s, 1.1*s, -2.9*s, 1.1*s, -1.1*s, 2.9*s, -1.1*s, -2.9*s, -2.9*s, -1.1*s, 2.9*s, -1.1*s, c)

def svg(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n%s\n</svg>\n' % body

I = {}
I['acasa'] = svg(
    sh('<rect x="12" y="28" width="40" height="27" rx="6"/>', WH, WHE) +
    sh('<path d="M8 31L32 9L56 31Z" stroke-linejoin="round" stroke-width="5" stroke="%s"/>' % ORG, ORG, ORGE).replace('stroke="%s"' % ORG, 'stroke="%s"' % ORG) +
    fill('<rect x="42" y="13" width="7" height="12" rx="2"/>', V1) +
    fill('<rect x="26" y="39" width="12" height="16" rx="3"/>', V2) +
    fill('<rect x="16" y="35" width="8" height="8" rx="2"/>', GOLD) +
    fill('<circle cx="35" cy="47" r="1.4"/>', GOLD) + spark(55, 9, VL))
I['orar'] = svg(
    fill('<rect x="18" y="5" width="5" height="12" rx="2.5"/>', V1) + fill('<rect x="41" y="5" width="5" height="12" rx="2.5"/>', V1) +
    sh('<rect x="7" y="10" width="50" height="46" rx="9"/>', WH, WHE) +
    fill('<path d="M7 19a9 9 0 0 1 9-9h32a9 9 0 0 1 9 9v6H7Z"/>', V2) +
    fill('<rect x="18" y="5" width="5" height="12" rx="2.5"/>', V1) + fill('<rect x="41" y="5" width="5" height="12" rx="2.5"/>', V1) +
    ''.join(fill('<rect x="%d" y="%d" width="9" height="6" rx="2"/>' % (x, y), c) for (x, y, c) in [
        (13, 30, LAV), (27, 30, LAV), (41, 30, LIME), (13, 39, LAV), (27, 39, GOLD), (41, 39, LAV), (13, 47, LIME), (27, 47, LAV), (41, 47, LAV)]))
I['elevi'] = svg(
    sh('<circle cx="41" cy="21" r="8.5"/>', GOLD, GOLDE) + sh('<path d="M25 56Q25 38 41 38Q57 38 57 56Z"/>', LIME, LIMEE) +
    sh('<circle cx="23" cy="26" r="9.5"/>', GOLD, GOLDE) + sh('<path d="M5 58Q5 40 23 40Q41 40 41 58Z"/>', V2, VE) +
    spark(55, 8, VL))
I['inscriere'] = svg(
    sh('<circle cx="26" cy="22" r="10"/>', GOLD, GOLDE) + sh('<path d="M5 57Q5 38 26 38Q47 38 47 57Z"/>', V2, VE) +
    sh('<circle cx="47" cy="44" r="12"/>', LIME, LIMEE) +
    '<path d="M47 38v12M41 44h12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>' + spark(10, 8, VL))
I['starturi'] = svg(
    sh('<path d="M24 36L12 47V54L24 48Z"/>', V2, VE) + sh('<path d="M40 36L52 47V54L40 48Z"/>', V2, VE) +
    fill('<path d="M26 45Q32 63 38 45Z"/>', GOLD) + fill('<path d="M29 45Q32 56 35 45Z"/>', ORG) +
    sh('<path d="M32 4C43 13 45 30 41 44H23C19 30 21 13 32 4Z"/>', WH, WHE) +
    fill('<path d="M32 4C37 8 40 13 42 19H22C24 13 27 8 32 4Z"/>', ORG) +
    sh('<circle cx="32" cy="29" r="6.5"/>', V2, VE) + fill('<circle cx="30" cy="27" r="2"/>', VL) + spark(55, 12, LAV))
I['schimbari'] = svg(
    fill('<rect x="15" y="6" width="5" height="11" rx="2.5"/>', V1) + fill('<rect x="33" y="6" width="5" height="11" rx="2.5"/>', V1) +
    sh('<rect x="7" y="11" width="42" height="42" rx="9"/>', WH, WHE) +
    fill('<path d="M7 20a9 9 0 0 1 9-9h24a9 9 0 0 1 9 9v5H7Z"/>', V2) +
    fill('<rect x="15" y="6" width="5" height="11" rx="2.5"/>', V1) + fill('<rect x="33" y="6" width="5" height="11" rx="2.5"/>', V1) +
    fill('<rect x="13" y="31" width="8" height="6" rx="2"/>', LAV) + fill('<rect x="25" y="31" width="8" height="6" rx="2"/>', LAV) + fill('<rect x="13" y="41" width="8" height="6" rx="2"/>', GOLD) +
    sh('<circle cx="46" cy="45" r="14"/>', ORG, ORGE) +
    '<path d="M39 42h14M49 38l4 4-4 4M53 49H39M43 45l-4 4 4 4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>')
I['repartizare'] = svg(
    sh('<rect x="11" y="7" width="42" height="49" rx="7"/>', ORG, ORGE) +
    fill('<rect x="16" y="12" width="32" height="44" rx="3"/>', V2) +
    fill('<rect x="21" y="17" width="22" height="12" rx="2.5"/>', V3) + fill('<rect x="21" y="33" width="22" height="10" rx="2.5"/>', V3) +
    sh('<circle cx="42" cy="46" r="3.4"/>', GOLD, GOLDE, 2) + spark(56, 10, LAV))
I['inlocuiri'] = svg(
    sh('<rect x="5" y="8" width="25" height="25" rx="8"/>', V2, VE) + sh('<rect x="34" y="31" width="25" height="25" rx="8"/>', LIME, LIMEE) +
    fill('<circle cx="17.5" cy="20.5" r="4.2"/>', GOLD) + fill('<circle cx="46.5" cy="43.5" r="4.2"/>', '#fff') +
    st('M35 16H47Q52 16 52 21V25', ORG, ORGE, 4.4, 2) + sh('<path d="M46 24L52 33L58 24Z" stroke-linejoin="round" stroke-width="2" stroke="%s"/>' % ORG, ORG, ORGE, 2) +
    st('M29 48H17Q12 48 12 43V39', GOLD, GOLDE, 4.4, 2) + sh('<path d="M6 40L12 31L18 40Z" stroke-linejoin="round" stroke-width="2" stroke="%s"/>' % GOLD, GOLD, GOLDE, 2))
I['receptie'] = svg(
    sh('<rect x="18" y="52" width="28" height="6" rx="3"/>', GOLD, GOLDE, 2) + fill('<rect x="27" y="45" width="10" height="9"/>', LAV) +
    sh('<rect x="5" y="8" width="54" height="40" rx="8"/>', V1, VE) +
    fill('<rect x="10" y="13" width="44" height="30" rx="4"/>', V2) +
    fill('<path d="M10 24h44v-7a4 4 0 0 0-4-4H14a4 4 0 0 0-4 4Z"/>', V3) +
    sh('<path d="M28 21L28 36L41 28.5Z" stroke-linejoin="round" stroke-width="3" stroke="%s"/>' % LIME, LIME, LIMEE, 2) + spark(56, 6, VL))
I['disponibilitate'] = svg(
    sh('<circle cx="32" cy="32" r="25"/>', V2, VE) + fill('<circle cx="32" cy="32" r="19.5"/>', WH) +
    fill('<rect x="30" y="15" width="4" height="5" rx="2"/>', LIME) + fill('<rect x="30" y="44" width="4" height="5" rx="2"/>', LAV) +
    fill('<rect x="15" y="30" width="5" height="4" rx="2"/>', LAV) + fill('<rect x="44" y="30" width="5" height="4" rx="2"/>', LAV) +
    '<path d="M32 32V20M32 32L41 38" stroke="%s" stroke-width="4.2" stroke-linecap="round"/>' % V1 + fill('<circle cx="32" cy="32" r="3.6"/>', GOLD) + spark(56, 8, LAV))
I['analitica'] = svg(
    sh('<rect x="6" y="7" width="52" height="50" rx="9"/>', WH, WHE) +
    sh('<rect x="14" y="33" width="9" height="17" rx="2.5"/>', VL, V3, 2) + sh('<rect x="27.5" y="23" width="9" height="27" rx="2.5"/>', LIME, LIMEE, 2) + sh('<rect x="41" y="14" width="9" height="36" rx="2.5"/>', GOLD, GOLDE, 2) +
    fill('<rect x="12" y="51" width="40" height="2.5" rx="1.2"/>', LAV))
I['calculator'] = svg(
    sh('<rect x="11" y="5" width="42" height="54" rx="9"/>', V2, VE) +
    fill('<rect x="16" y="11" width="32" height="14" rx="4"/>', '#DDF3A6') + '<path d="M22 20h6M36 17l3 6M39 17l-3 6" stroke="%s" stroke-width="2.4" stroke-linecap="round"/>' % V1 +
    ''.join(fill('<rect x="%d" y="%d" width="8" height="7" rx="2.4"/>' % (x, y), c) for (x, y, c) in [
        (17, 30, LAV), (28, 30, LAV), (39, 30, LAV), (17, 39, LAV), (28, 39, LAV), (39, 39, LAV), (17, 48, LAV), (28, 48, GOLD), (39, 48, LIME)]))
I['profesori'] = svg(
    fill('<rect x="25" y="4" width="14" height="8" rx="4"/>', V1) +
    sh('<rect x="5" y="9" width="54" height="45" rx="9"/>', WH, WHE) + fill('<rect x="25" y="4" width="14" height="8" rx="4"/>', V1) + fill('<circle cx="32" cy="8" r="1.6"/>', GOLD) +
    sh('<circle cx="21" cy="29" r="6.5"/>', GOLD, GOLDE, 2) + fill('<path d="M10 49Q10 38 21 38Q32 38 32 49Z"/>', V2) +
    fill('<rect x="37" y="24" width="15" height="4.5" rx="2.2"/>', VL) + fill('<rect x="37" y="33" width="15" height="4.5" rx="2.2"/>', LAV) + fill('<rect x="37" y="42" width="9" height="4.5" rx="2.2"/>', LIME))
I['sincronizare'] = svg(
    st('M13.2 25.2A20 20 0 0 1 49.3 22', LIME, LIMEE, 6.5) + sh('<path d="M52.8 29L56.5 17.5L42.5 25.5Z" stroke-linejoin="round" stroke-width="3" stroke="%s"/>' % LIME, LIME, LIMEE) +
    st('M50.8 38.8A20 20 0 0 1 14.7 42', V2, VE, 6.5) + sh('<path d="M11.2 34L7.5 46.5L21.5 38.5Z" stroke-linejoin="round" stroke-width="3" stroke="%s"/>' % V2, V2, VE) +
    spark(55, 52, VL))
I['culegeri'] = svg(
    sh('<rect x="8" y="41" width="48" height="15" rx="5"/>', V2, VE, 2) + fill('<rect x="14" y="46" width="14" height="3.5" rx="1.7"/>', WH) + fill('<rect x="45" y="44" width="4" height="9" rx="2"/>', GOLD) +
    sh('<rect x="12" y="25" width="44" height="14" rx="5"/>', ORG, ORGE, 2) + fill('<rect x="18" y="30" width="12" height="3.5" rx="1.7"/>', WH) + fill('<rect x="47" y="28" width="4" height="8" rx="2"/>', V1) +
    sh('<rect x="8" y="9" width="42" height="14" rx="5"/>', LIME, LIMEE, 2) + fill('<rect x="14" y="14" width="12" height="3.5" rx="1.7"/>', '#fff') + fill('<rect x="41" y="12" width="4" height="8" rx="2"/>', V1) +
    spark(57, 12, VL))
I['info'] = svg(
    sh('<circle cx="32" cy="32" r="25"/>', V2, VE) + fill('<path d="M13 24A21 21 0 0 1 32 11 21 21 0 0 1 51 24 40 18 0 0 0 13 24Z"/>', V3) +
    fill('<circle cx="32" cy="20.5" r="4"/>', GOLD) + '<rect x="28" y="28" width="8" height="20" rx="4" fill="#fff"/>' + spark(56, 8, LAV))

os.makedirs(OUT, exist_ok=True)
for k, v in I.items():
    open(os.path.join(OUT, k + '.svg'), 'w', encoding='utf-8').write(v)
# profil: the same bust as the site's Profil tab
src = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'tabs', 'profil.svg')
open(os.path.join(OUT, 'profil.svg'), 'w', encoding='utf-8').write(open(src, encoding='utf-8').read())
print(len(I) + 1, 'icons')
