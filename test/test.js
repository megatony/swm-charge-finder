// Zero-dependency tests: node test/test.js
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  rank, haversineKm, plugLabels, normEvse, normStatus, statusBucket, parseOcpdb, matchLiveLocation,
  sameOperator, fetchOcpdbLocations, ocpdbLocationsUrl, searchRadiusM,
} from '../public/core.js';
import { parseDynamic, getLiveStatus, liveSource, ocpdbHeaders } from '../lib/live.js';
import { nearest } from '../server.js';

const stations = JSON.parse(readFileSync(new URL('../public/stations.json', import.meta.url))).stations;
const ocpdbJson = JSON.parse(readFileSync(new URL('./fixture-ocpdb-locations.json', import.meta.url)));
const MARIENPLATZ = { lat: 48.137, lng: 11.575 };
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
let passed = 0;

test('haversine: Marienplatz -> Hauptbahnhof is about 1.2 km', () => {
  assert(Math.abs(haversineKm({ lat: 48.1374, lng: 11.5755 }, { lat: 48.1402, lng: 11.5600 }) - 1.19) < 0.1);
});

test('rank returns the 3 nearest stations sorted by distance', () => {
  const r = rank(stations, MARIENPLATZ, { onlyAvailable: false });
  assert.equal(r.length, 3);
  assert(r[0].distanceKm <= r[1].distanceKm && r[1].distanceKm <= r[2].distanceKm);
  assert.equal(r[0].live, false);
  assert.equal(r[0].freeCount, null);
});

test('minKw filter keeps only fast chargers', () => {
  const r = rank(stations, MARIENPLATZ, { minKw: 50, onlyAvailable: false });
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

test('with a DATEX status map, only stations with a free point are returned', () => {
  const live = rank(stations, MARIENPLATZ, { statusMap });
  assert.equal(live.length, 1);
  assert.equal(live[0].address, 'Leopoldstr. gg. 81');
  assert.equal(live[0].freeCount, 1);
  assert.equal(live[0].occupiedCount, 1);
});

test('status buckets: free, occupied, unavailable', () => {
  assert.equal(statusBucket(normStatus('AVAILABLE')), 'free');
  assert.equal(statusBucket(normStatus('CHARGING')), 'occupied');
  assert.equal(statusBucket(normStatus('BLOCKED')), 'occupied');
  assert.equal(statusBucket(normStatus('RESERVED')), 'occupied');
  assert.equal(normStatus('OUTOFORDER'), 'OUT_OF_ORDER');
  assert.equal(statusBucket(normStatus('OUTOFORDER')), 'unavailable');
  assert.equal(statusBucket(normStatus('UNKNOWN')), 'unavailable');
  assert.equal(statusBucket(normStatus('INOPERATIVE')), 'unavailable');
  assert.equal(sameOperator('SWM Versorgungs GmbH', 'SWM Mobilität GmbH'), true);
  assert.equal(sameOperator('SWM Versorgungs GmbH', 'Ionity GmbH'), false);
});

const ocpdbLocations = parseOcpdb(ocpdbJson);

test('OCPDB fixture drops REMOVED points and keeps coordinates', () => {
  assert.equal(ocpdbLocations.length, 5);
  const tal = ocpdbLocations.find((l) => l.points.some((p) => p.id === 'CO_1001'));
  assert.deepEqual(tal.points.map((p) => p.status), ['CHARGING', 'BLOCKED']);
  assert.equal(tal.operator, 'SWM Versorgungs GmbH');
  assert.equal(tal.lat, 48.135646);
  assert.equal(tal.lng, 11.580395);
});

test('OCPDB locations match the nearest same-operator site within 50 m', () => {
  const tal = stations.find((s) => s.address === 'Tal 36');
  const leo = stations.find((s) => s.address === 'Leopoldstr. gg. 81');
  const talHit = matchLiveLocation(tal, ocpdbLocations);
  const leoHit = matchLiveLocation(leo, ocpdbLocations);
  assert(talHit.distanceM < 1);
  assert.deepEqual(talHit.location.points.map((p) => p.id), ['CO_1001', 'CO_1002']);
  assert.deepEqual(leoHit.location.points.map((p) => p.id), ['CO_2001', 'CO_2002', 'CO_2003']);
  const north = { lat: tal.lat + 120 / 111320, lng: tal.lng, operator: tal.operator };
  assert.equal(matchLiveLocation(north, ocpdbLocations), null);
  assert.equal(matchLiveLocation({ ...tal, operator: 'Ionity GmbH' }, ocpdbLocations), null);
  assert.equal(matchLiveLocation(stations.find((s) => s.address === 'Pacellistr. 1a'), ocpdbLocations), null);
});

test('live ranking counts free / occupied / unavailable and can prefer a free station', () => {
  const nearTal = rank(stations, { lat: 48.135646, lng: 11.580395 }, { limit: 4, liveLocations: ocpdbLocations, onlyAvailable: false });
  assert.equal(nearTal[0].address, 'Tal 36');
  assert.equal(nearTal[0].freeCount, 0);
  assert.equal(nearTal[0].occupiedCount, 2);
  assert.equal(nearTal[0].unavailableCount, 0);
  assert.equal(nearTal[0].statusUpdated, '2026-10-23T20:00:00Z');

  const nearLeo = rank(stations, { lat: 48.16317, lng: 11.58655 }, { limit: 3, liveLocations: ocpdbLocations, onlyAvailable: false });
  assert.equal(nearLeo[0].address, 'Leopoldstr. gg. 81');
  assert.equal(nearLeo[0].freeCount, 1);
  assert.equal(nearLeo[0].occupiedCount, 0);
  assert.equal(nearLeo[0].unavailableCount, 2);
  assert.equal(nearLeo[0].statusUpdated, '2026-10-23T23:00:00Z');

  const freeOnly = rank(stations, MARIENPLATZ, { limit: 5, liveLocations: ocpdbLocations, onlyAvailable: true });
  assert.deepEqual(freeOnly.map((s) => s.address), ['Leopoldstr. gg. 81']);
  const listed = rank(stations, MARIENPLATZ, { limit: 8, liveLocations: ocpdbLocations, onlyAvailable: false });
  const pac = listed.find((s) => s.address === 'Pacellistr. 1a');
  assert.equal(pac.live, false);
  assert.equal(pac.freeCount, null);
});

test('search radius covers the requested neighbour and the OCPDB url is a located query', () => {
  const dists = stations.map((s) => haversineKm(MARIENPLATZ, s) * 1000).sort((a, b) => a - b);
  const radius = searchRadiusM(stations, MARIENPLATZ, { want: 3, padM: 0, minM: 0, maxM: 1e9 });
  assert.equal(radius, Math.ceil(dists[2]));
  const url = new URL(ocpdbLocationsUrl({ lat: 48.137, lng: 11.575, radiusM: 2000.4 }));
  assert.equal(url.origin + url.pathname, 'https://api.mobidata-bw.de/ocpdb/api/public/v1/locations');
  assert.equal(url.searchParams.get('source_uid'), 'datex2_e_clearing_net');
  assert.equal(url.searchParams.get('operator_name'), 'SWM');
  assert.equal(url.searchParams.get('lat'), '48.137');
  assert.equal(url.searchParams.get('lon'), '11.575');
  assert.equal(url.searchParams.get('radius'), '2000');
  assert.equal(url.searchParams.get('offset'), null);
});

test('OCPDB fetch follows pages, sends a User-Agent, and fails on HTTP errors', async () => {
  const seen = [];
  const removed = { operator: { name: 'SWM Versorgungs GmbH' }, coordinates: { lat: 48.1, lon: 11.5 }, evses: [{ evse_id: 'CO_X', status: 'REMOVED' }] };
  const kept = { operator: { name: 'SWM Versorgungs GmbH' }, coordinates: { lat: 48.2, lon: 11.6 }, evses: [{ evse_id: 'CO_2001', status: 'AVAILABLE', status_last_updated: '2026-10-23T23:00:00Z' }] };
  const fetchFn = async (url, opt) => {
    seen.push({ url, ua: opt.headers['User-Agent'] });
    const offset = new URL(url).searchParams.get('offset');
    if (!offset) return { ok: true, json: async () => ({ items: [removed], total_count: 2, next_offset: 1 }) };
    return { ok: true, json: async () => ({ items: [kept], total_count: 2 }) };
  };
  const locs = await fetchOcpdbLocations({ lat: 48.1, lng: 11.5, radiusM: 1000 }, { fetchFn, headers: ocpdbHeaders() });
  assert.equal(seen.length, 2);
  assert.match(seen[0].ua, /swm-charge-finder\/1\.0/);
  assert.match(seen[0].ua, /github\.com\/megatony\/swm-charge-finder/);
  assert.equal(new URL(seen[1].url).searchParams.get('offset'), '1');
  assert.equal(locs.length, 1);
  assert.equal(locs[0].points[0].id, 'CO_2001');
  await assert.rejects(
    () => fetchOcpdbLocations({ lat: 1, lng: 2, radiusM: 10 }, { fetchFn: async () => ({ ok: false, status: 503 }) }),
    /OCPDB HTTP 503/,
  );
});

test('ocpdb is the default live source and a location query is cached', async () => {
  assert.equal(liveSource({}), 'ocpdb');
  assert.equal(await getLiveStatus({ LIVE_SOURCE: 'none' }), null);
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    assert.match(url, /source_uid=datex2_e_clearing_net/);
    assert.match(url, /operator_name=SWM/);
    return { ok: true, json: async () => ocpdbJson };
  };
  const query = { lat: 47.11, lng: 10.22, radiusM: 1500, fetchFn };
  const first = await getLiveStatus({ LIVE_SOURCE: 'ocpdb' }, query);
  const second = await getLiveStatus({ LIVE_SOURCE: 'ocpdb' }, { ...query, radiusM: 1400 });
  assert.equal(calls, 1);
  assert.equal(first.source, 'ocpdb');
  assert.equal(second.locations.length, 5);
  await getLiveStatus({ LIVE_SOURCE: 'ocpdb' }, { ...query, radiusM: 8000 });
  assert.equal(calls, 2);
  await getLiveStatus({ LIVE_SOURCE: 'ocpdb' }, { ...query, ttl: 0 });
  assert.equal(calls, 3);
  const file = await getLiveStatus({ LIVE_SOURCE: 'file', LIVE_FILE: new URL('./fixture-datex2-dynamic.json', import.meta.url).pathname });
  assert.equal(file.source, 'file');
  assert.equal(file.statusMap.get('DESWME000402'), 'AVAILABLE');
  await assert.rejects(() => getLiveStatus({ LIVE_SOURCE: 'ocpdb' }, {}), /requires lat and lng/);
  await assert.rejects(() => getLiveStatus({ LIVE_SOURCE: 'nope' }), /unknown LIVE_SOURCE/);
});

test('API nearest prefers a station with a free point and can run with live data off', async () => {
  const prevFetch = globalThis.fetch;
  const prev = process.env.LIVE_SOURCE;
  try {
    process.env.LIVE_SOURCE = 'none';
    const offline = await nearest(48.137, 11.575, 3, 0);
    assert.equal(offline.live, false);
    assert.equal(offline.liveSource, null);
    assert.equal(offline.results.length, 3);
    assert.equal(offline.results[0].freeCount, null);

    process.env.LIVE_SOURCE = 'ocpdb';
    globalThis.fetch = async () => ({ ok: true, json: async () => ocpdbJson });
    const live = await nearest(48.137, 11.575, 3, 0);
    assert.equal(live.live, true);
    assert.equal(live.liveSource, 'ocpdb');
    assert.equal(live.liveError, null);
    assert.equal(live.results[0].address, 'Leopoldstr. gg. 81');
    assert.equal(live.results[0].freeCount, 1);
    assert.ok(live.results.every((s) => s.freeCount > 0));
  } finally {
    globalThis.fetch = prevFetch;
    if (prev === undefined) delete process.env.LIVE_SOURCE;
    else process.env.LIVE_SOURCE = prev;
  }
});

for (const [name, fn] of tests) {
  await fn();
  passed++;
  console.log('✓', name);
}
console.log(`\nAll ${passed} tests passed.`);
