"""A demo group in the real register: a copy of the register's own template tab ("Orar 1": same colours, dropdowns, conditional
formatting, column widths, formulas) filled with demo people, so it can be opened in Google Sheets exactly as the real ones.

    node scripts/registru-import/demo-group.js > _import/demo/group.json
    python scripts/registru-import/make_demo_xlsx.py "<a real register .xlsx>" _import/demo/group.json _import/demo

The real register is only the source of the empty template (its other tabs are dropped, none of its data is copied).
Needs openpyxl (pip install openpyxl). The formulas are the register's own: Google Sheets calculates them when the file is imported.
"""
import sys, os, json, datetime
sys.stdout.reconfigure(encoding='utf-8')
if os.environ.get('OPENPYXL_LIB'): sys.path.insert(0, os.environ['OPENPYXL_LIB'])
import openpyxl

src, js, out = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(js, encoding='utf-8'))
wb = openpyxl.load_workbook(src)
ws = wb['Orar 1']
for n in list(wb.sheetnames):
    if n not in ('Orar 1', 'CONFIGURARI'): del wb[n]          # no real tab survives
ws.title = d['group']['tab'].replace('/', ' ').replace(':', ' ')[:31]
wb.move_sheet(ws, offset=-wb.index(ws))
wb.active = 0
ws.sheet_view.tabSelected = True
wb.properties.creator = 'Mathorizon demo'; wb.properties.lastModifiedBy = 'Mathorizon demo'

cfg = wb['CONFIGURARI']
pick = lambda col: [cfg.cell(r, col).value for r in range(2, 200) if cfg.cell(r, col).value]
managers = pick(2)
STATE = {'activ': 'Activ', 'completare': 'Se completează', 'inactiv': 'Inactiv', 'inlocuire': 'Înlocuire'}
STATUS = {'activ': 'Activ', 'instabil': 'Activ', 'proba': 'Oră de probă', 'proba_ok': 'Oră de probă confirmată', 'transferat': 'Transferat', 'inactiv': 'Inactiv', 'inlocuire': 'Înlocuire'}
MARK = {'P': 'PREZENT', 'A': 'ABSENT', 'M': 'ABSENT MOTIVAT', 'G': 'PRIMA LECȚIE GRATUITĂ', 'B': 'ABSENT PRIMA LECȚIE GRATUITĂ'}
MONTH = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']
g = d['group']
ws['A1'] = 'Individual 1 elev' if g['size'] == 1 else 'Grup cu %d elevi' % g['size']
ws['A3'] = STATE.get(g['status'], 'Activ')
ws['A4'] = g['subject']; ws['A5'] = g['grade']
ws['A6'] = g['level'].replace('-', ' ― ')
ws['A7'] = g['profile'] or 'Profilul'
for i, s in enumerate(d['schedule']):
    r = 2 + i
    ws.cell(r, 27).value = s['day']
    ws.cell(r, 28).value = datetime.time(s['hour'], 0)
    ws.cell(r, 29).value = s['room']
for k, s in enumerate(d['students'][:23]):
    c = 4 + k
    ws.cell(1, c).value = '%s%s' % (s['name'], s['phone'] or '')
    ws.cell(3, c).value = '=SUM(%s)' % s['paid']
    ws.cell(4, c).value = '=SUM(%s)' % s['disc']
    if s['manager'] in managers: ws.cell(7, c).value = s['manager']
    ws.cell(8, c).value = STATUS.get(s['status'], 'Activ')
level = 'Nivelul Profesorului %d' % d['teacherLevel']
for r in range(9, 199): ws.cell(r, 27).value = level
for i, l in enumerate(d['lessons']):
    r = 9 + i
    y, m, day = map(int, l['iso'].split('-'))
    ws.cell(r, 1).value = '%d %s' % (day, MONTH[m - 1])
    ws.cell(r, 2).value = l['topic']
    for k, code in enumerate(l['marks']):
        if code: ws.cell(r, 4 + k).value = MARK[code]
os.makedirs(out, exist_ok=True)
path = os.path.join(out, '%s Registru EXAMEN.MD OFFLINE 2025-2026 (DEMO).xlsx' % d['teacher'])
wb.save(path)
print('Salvat:', path)
