#!/usr/bin/env python3
"""Build public/stations.json (SWM-operated charging sites) from the Bundesnetzagentur Ladesäulenregister CSV.

Usage: python3 scripts/build-static.py [path/to/Ladesaeulenregister.csv]   (default: data/lsr.csv)
Download the CSV from https://www.bundesnetzagentur.de/ladesaeulenkarte (data licensed CC BY 4.0, Bundesnetzagentur.de).
"""
import csv, json, sys, re
src = sys.argv[1] if len(sys.argv) > 1 else 'data/lsr.csv'
rows = list(csv.reader(open(src, encoding='utf-8-sig'), delimiter=';'))
# The CSV starts with a free-text preamble; "Letzte Aktualisierung vom: DD.MM.YYYY" carries the data date.
asof = next((f"{m.group(3)}-{m.group(2)}-{m.group(1)}" for r in rows[:30] if r and 'Aktualisierung' in r[0]
             for m in [re.search(r'(\d{2})\.(\d{2})\.(\d{4})', r[0])] if m), 'unknown')
hi = next(i for i, r in enumerate(rows) if r and r[0] == 'Ladeeinrichtungs-ID')
H = rows[hi]; idx = {h: i for i, h in enumerate(H)}
def f(x):
    if not x: return None
    vals=[float(v.strip().replace(',', '.')) for v in x.split(';') if v.strip()]
    return max(vals) if vals else None
locs = {}
for r in rows[hi+1:]:
    if len(r) < 20: continue
    op = r[idx['Betreiber']]
    if not re.search(r'Stadtwerke M(ü|ue)nchen|^SWM', op): continue
    if r[idx['Status']] != 'In Betrieb': continue
    lat, lng = f(r[idx['Breitengrad']]), f(r[idx['Längengrad']])
    if lat is None: continue
    addr = f"{r[idx['Straße']]} {r[idx['Hausnummer']]}".strip()
    key = (round(lat, 5), round(lng, 5))
    L = locs.setdefault(key, {'id': r[0], 'lat': lat, 'lng': lng, 'address': addr,
          'city': f"{r[idx['Postleitzahl']]} {r[idx['Ort']]}".strip(), 'operator': op,
          'kind': r[idx['Art der Ladeeinrichtung']], 'points': []})
    for n in range(1, 7):
        plug = r[idx[f'Steckertypen{n}']]
        if not plug: continue
        L['points'].append({'evse': r[idx[f'EVSE-ID{n}']].replace('*', '').upper() or None,
                            'plug': plug, 'kw': f(r[idx[f'Nennleistung Stecker{n}']])})
# Data-quality fix: some register rows carry the Munich city-centre geocode (48.137108, 11.575382 = Marienplatz)
# instead of the real site. Re-home them onto another SWM entry with the same street/house no./PLZ, else drop.
CENTROID = (48.137108, 11.575382)
good = {}
for (k, L) in locs.items():
    if abs(L['lat']-CENTROID[0]) > 2e-4 or abs(L['lng']-CENTROID[1]) > 2e-4:
        good.setdefault((L['address'], L['city']), L)
fixed = dropped = 0
for k in list(locs):
    L = locs[k]
    if abs(L['lat']-CENTROID[0]) <= 2e-4 and abs(L['lng']-CENTROID[1]) <= 2e-4:
        twin = good.get((L['address'], L['city']))
        del locs[k]
        if twin:
            nk = (round(twin['lat'], 5) + 1e-6, round(twin['lng'], 5))
            L.update(lat=twin['lat'], lng=twin['lng'], coordFixed=True); locs[nk] = L; fixed += 1
        else: dropped += 1
print('centroid-geocoded entries: fixed', fixed, 'dropped', dropped)
out = sorted(locs.values(), key=lambda x: x['id'])
for o in out: o['maxKw'] = max([p['kw'] or 0 for p in o['points']] or [0])
json.dump({'source': f'Bundesnetzagentur Ladesäulenregister (as of {asof})',
           'license': 'CC BY 4.0, attribution: Bundesnetzagentur.de (filtered to SWM sites, coordinates cleaned)',
           'count': len(out), 'stations': out}, open('public/stations.json', 'w'), ensure_ascii=False)
print(len(out), 'locations,', sum(len(o['points']) for o in out), 'points;', sum(1 for o in out for p in o['points'] if p['evse']), 'with EVSE-ID')
print(sorted({o['operator'] for o in out}))
