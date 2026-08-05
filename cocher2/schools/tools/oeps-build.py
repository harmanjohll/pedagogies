"""raw.json → (a) Opera Estate's roster, (b) the institutional facts for its pack.

Same split as Park View: (a) is 81 named people's weeks, (b) is bell times,
class codes and subject names — facts about the institution with no person
attached.

Two extra jobs this school needs and Park View did not:
  · the Principal, Hoo Wai Ling, has no sheet of her own. She was asked to
    follow Elvenia's week, so her row is Elvenia's entries under her own name
    and handle — and it says so, rather than looking like a timetable the
    school issued for her.
  · two sheets carry the identical display name ("Mrs Eliza Lim"). The school's
    own sheet tag is appended so the picker is not two indistinguishable rows.
"""
import json, re, collections, pathlib

d = json.load(open('raw.json'))
E = [e for t in d['teachers'] for e in t['entries']]
SUBJ = d['legendSubjects']
handle = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

# Which teaching area a timetable code belongs to. Foundation subjects sit with
# the subject they are a Foundation version OF — a teacher on FMA is a
# Mathematics teacher, and splitting them out would empty the picker.
AREA = {
    'EL': 'English', 'EL*': 'English', 'FEL': 'English',
    'MA': 'Mathematics', 'FMA': 'Mathematics',
    'SCI': 'Science', 'FSC': 'Science',
    'MT': 'Mother Tongue', 'FMT': 'Mother Tongue', 'FMT (EXTRA)': 'Mother Tongue',
    'SS': 'Social Studies',
    'PE': 'Physical Education', 'AC': 'Art', 'MU': 'Music',
    'PAL': 'Programme for Active Learning',
    'LSP1': 'Learning Support', 'LSP2': 'Learning Support',
    # Full names too: a school that later writes "Mathematics" instead of "MA"
    # should not silently drop out of the picker.
    'ENGLISH LANGUAGE': 'English', 'FOUNDATION EL': 'English',
    'MATHEMATICS': 'Mathematics', 'FOUNDATION MATH': 'Mathematics',
    'SCIENCE': 'Science', 'FOUNDATION SCIENCE': 'Science',
    'MOTHER TONGUE': 'Mother Tongue', 'FOUNDATION MT': 'Mother Tongue',
    'SOCIAL STUDIES': 'Social Studies', 'PHYSICAL EDUCATION': 'Physical Education',
    'ART & CRAFT': 'Art', 'MUSIC': 'Music',
    'PROGRAMME FOR ACTIVE LEARNING': 'Programme for Active Learning',
    'LSP FOR P1': 'Learning Support', 'LSP FOR P2': 'Learning Support',
}

# ── (a) the roster ────────────────────────────────────────────────────────────
dupes = {n for n, c in collections.Counter(t['name'] for t in d['teachers']).items() if c > 1}
teachers = []
for t in d['teachers']:
    name = f"{t['name']} ({t['sheet']})" if t['name'] in dupes else t['name']
    teachers.append({'name': name, 'email': f"{handle(t['sheet'])}@oeps",
                     'department': '', 'entries': t['entries'],
                     'dayDuties': t['dayDuties']})

elvenia = next(t for t in d['teachers'] if t['sheet'] == 'ELVENIA')
teachers.append({
    'name': 'Hoo Wai Ling', 'email': 'wailing@oeps', 'department': '',
    'note': "Principal. Following Elvenia Poh's week for the beta — this is not "
            "a timetable the school issued for her.",
    'entries': [dict(e) for e in elvenia['entries']],
    'dayDuties': [dict(x) for x in elvenia['dayDuties']],
})
teachers.sort(key=lambda t: t['name'])

pathlib.Path('oeps-staff.json').write_text(json.dumps({
    'schoolId': 'oeps',
    'note': ('Opera Estate Primary, staff timetable %s. Sign-in handles are '
             'name@oeps — a pilot handle, deliberately not an MOE address. A live '
             'Drive/Apps Script feed overrides this file when one is configured.' % d['tag']),
    'teachers': teachers,
}, indent=2) + '\n')

# ── (b) institutional facts ───────────────────────────────────────────────────
starts = sorted({e['start'] for e in E})
ends = {e['start']: e['end'] for e in E}
periods = [{'id': i + 1, 'start': s, 'end': f'{int(s[:2]) + (int(s[3:]) + 30) // 60:02d}:{(int(s[3:]) + 30) % 60:02d}'}
           for i, s in enumerate(starts)]

codes = collections.Counter()
for e in E:
    for c in re.split(r'[,/]', e['class'] or ''):
        c = c.strip().upper()
        if re.fullmatch(r'[1-6](?:[A-Z]{1,3}|FDN)', c):
            codes[c] += 1
by_level = collections.defaultdict(list)
for c in sorted(codes):
    by_level[f'Primary {c[0]}'].append(c)

taught = collections.Counter(e['title'] for e in E if e['kind'] == 'lesson')
subjects, seen = [], set()
for code, _ in taught.most_common():
    for part in re.split(r'[,/]', code):
        part = part.strip()
        full = SUBJ.get(part, SUBJ.get(part.rstrip('*'), part))
        if part and full not in seen:
            seen.add(full)
            subjects.append({'code': part, 'name': full})

areas = {}
for e in E:
    if e['kind'] != 'lesson':
        continue
    for part in re.split(r'[,/]', e['title']):
        a = AREA.get(part.strip().upper())
        if a:
            areas[a] = areas.get(a, 0) + 1

facts = {
    'slotMinutes': 30,
    'bell': {'dayStart': starts[0], 'periodMinutes': 30, 'periods': periods},
    'classCodes': dict(by_level),
    'subjectCodes': subjects,
    'subjectDepartments': AREA,
    'departments': sorted(areas, key=lambda a: -areas[a]),
    'dutyPostsTimed': sorted({e['title'] for e in E if e['kind'] == 'duty'}),
    'dutyPostsUntimed': sorted({p['post'] for t in d['teachers'] for p in t['dayDuties']}),
    'nonLesson': sorted({e['title'] for e in E if e['kind'] == 'school'}),
}
pathlib.Path('oeps-facts.json').write_text(json.dumps(facts, indent=2) + '\n')

print('roster  :', len(teachers), 'people,', sum(len(t['entries']) for t in teachers), 'entries')
print('periods :', len(periods), f"({periods[0]['start']}–{periods[-1]['end']})")
print('classes :', sum(len(v) for v in by_level.values()), 'across', len(by_level), 'levels')
print('         ', {k: v for k, v in by_level.items()})
print('subjects:', ', '.join(f"{s['code']}={s['name']}" for s in subjects))
print('areas   :', {a: n for a, n in sorted(areas.items(), key=lambda x: -x[1])})
print('duties  : timed', facts['dutyPostsTimed'])
print('          untimed', facts['dutyPostsUntimed'])
print('non-lesson:', facts['nonLesson'])
print('duplicate display names fixed:', dupes or 'none')
