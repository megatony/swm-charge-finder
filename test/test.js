// Zero-dependency tests: node test/test.js
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { rank, haversineKm, plugLabels, normEvse } from '../public/core.js';
import { parseDynamic } from '../lib/live.js';

const stations = JSON.parse(readFileSync(new URL('../public/stations.json', import.meta.url))).stations;
const MARIENPLATZ = { lat: 48.137, lng: 11.575 };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };

test('haversine: Marienplatz -> Hauptbahnhof is about 1.2 km', () => {
  assert(Math.abs(haversineKm({ lat: 48.1374, lng: 11.5755 }, { lat: 48.1402, lng: 11.5600 }) - 1.19) < 0.1);
});

test('rank returns the 3 nearest stations sorted by distance', () => {
  const r = rank(stations, MARIENPLATZ);
  assert.equal(r.length, 3);
  assert(r[0].distanceKm <= r[1].distanceKm && r[1].distanceKm <= r[2].distanceKm);
});

test('minKw filter keeps only fast chargers', () => {
  const r = rank(stations, MARIENPLATZ, { minKw: 50 });
  assert(r.length > 0 && r.every((s) => s.maxKw >= 50));
});

test('city-centre (Marienplatz) geocodes were removed from the data', () => {
  assert(stations.every((s) => !(Math.abs(s.lat - 48.137108) < 2e-4 && Math.abs(s.lng - 11.575382) < 2e-4)));
});

test('plug names are translated to English labels', () => {
  assert.deepEqual(plugLabels('AC Typ 2 Steckdose'), ['Type 2']);
  assert.deepEqual(plugLabels('AC Typ 2 Fahrzeugkupplung'), ['Type 2 (tethered cable)']);
  assert.deepEqual(plugLabels('DC Fahrzeugkupplung Typ Combo 2 (CCS); DC CHAdeMO'), ['CCS', 'CHAdeMO']);
  assert.equal(normEvse('DE*SWM*E000401'), 'DESWME000401');
});

const statusMap = parseDynamic(JSON.parse(readFileSync(new URL('./fixture-datex2-dynamic.json', import.meta.url))));

test('DATEX II dynamic feed is parsed into EVSE statuses', () => {
  assert.equal(statusMap.get('DESWME000402'), 'AVAILABLE');
  assert.equal(statusMap.get('DESWME000401'), 'CHARGING');
});

test('with live data, only stations with a free point are returned', () => {
  const live = rank(stations, MARIENPLATZ, { statusMap });
  assert.equal(live.length, 1);
  assert.equal(live[0].address, 'Leopoldstr. gg. 81');
  assert.equal(live[0].freeCount, 1);
});

console.log(`\nAll ${passed} tests passed.`);
