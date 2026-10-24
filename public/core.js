// Shared logic, used by both Node (server.js, tests) and the browser (<script type="module">).

/** Great-circle (straight-line) distance in km between two {lat, lng} points. */
export function haversineKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Normalise an EVSE ID for matching: "DE*SWM*E000401" -> "DESWME000401". */
export const normEvse = (s) => (s || '').replace(/[*\s-]/g, '').toUpperCase();

// OCPI / DATEX status strings → a small set. "removed" stays out of service for DATEX feeds;
// the OCPDB parser drops REMOVED charge points before this runs.
const STATUS_MAP = {
  available: 'AVAILABLE', charging: 'CHARGING', occupied: 'CHARGING', blocked: 'BLOCKED', reserved: 'RESERVED',
  outoforder: 'OUT_OF_ORDER', faulted: 'OUT_OF_ORDER', inoperative: 'OUT_OF_ORDER', outofservice: 'OUT_OF_ORDER',
  unknown: 'UNKNOWN', removed: 'OUT_OF_ORDER', planned: 'OUT_OF_ORDER',
};
/** "out of order" / "OUTOFORDER" → "OUT_OF_ORDER". Unknown vocabulary becomes UNKNOWN. */
export const normStatus = (v) => STATUS_MAP[String(v || '').toLowerCase().replace(/[^a-z]/g, '')] || 'UNKNOWN';

/** AVAILABLE = free; CHARGING / BLOCKED / RESERVED = occupied; everything else = unavailable. */
export function statusBucket(status) {
  if (status === 'AVAILABLE') return 'free';
  if (status === 'CHARGING' || status === 'BLOCKED' || status === 'RESERVED') return 'occupied';
  if (status === 'REMOVED') return 'removed';
  return 'unavailable';
}

/** Counts for one station. REMOVED points are ignored. `updated` is the newest status timestamp. */
export function summarizeLive(points) {
  let free = 0, occupied = 0, unavailable = 0, updated = null;
  for (const p of points || []) {
    const bucket = statusBucket(p.status);
    if (bucket === 'removed') continue;
    if (bucket === 'free') free++;
    else if (bucket === 'occupied') occupied++;
    else unavailable++;
    if (p.updated && (!updated || p.updated > updated)) updated = p.updated;
  }
  return { free, occupied, unavailable, updated, total: free + occupied + unavailable };
}

const swmOperator = (s) => /swm|stadtwerke munchen/.test(String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, ''));

/** Same company, or both SWM (Versorgungs and Mobilität publish under slightly different names). */
export function sameOperator(a, b) {
  if (swmOperator(a) && swmOperator(b)) return true;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const ka = norm(a), kb = norm(b);
  return !!ka && ka === kb;
}

/** Metres within which an OCPDB location is treated as the same site as a register row. */
export const LIVE_MATCH_METERS = 50;

/**
 * Nearest OCPDB location for a register station: same operator and within `maxMeters`.
 * One register row maps to one location (the nearest), so neighbouring sites are not merged.
 * Returns null when nothing is close enough.
 */
export function matchLiveLocation(station, locations, maxMeters = LIVE_MATCH_METERS) {
  let best = null, bestM = Infinity;
  for (const loc of locations || []) {
    if (!sameOperator(station.operator, loc.operator)) continue;
    const meters = haversineKm(station, loc) * 1000;
    if (meters < bestM) { bestM = meters; best = loc; }
  }
  if (!best || bestM > maxMeters) return null;
  return { location: best, distanceM: bestM };
}

export const OCPDB_LOCATIONS_URL = 'https://api.mobidata-bw.de/ocpdb/api/public/v1/locations';
export const LIVE_ATTRIBUTION = 'MobiData BW / e-clearing.net';

/** Public OCPDB locations query. Radius is metres. lat/lon/radius must be sent together. */
export function ocpdbLocationsUrl({ lat, lng, radiusM, limit = 1000, offset = 0 } = {}) {
  const u = new URL(OCPDB_LOCATIONS_URL);
  u.searchParams.set('source_uid', 'datex2_e_clearing_net');
  u.searchParams.set('operator_name', 'SWM');
  u.searchParams.set('lat', String(lat));
  u.searchParams.set('lon', String(lng));
  u.searchParams.set('radius', String(Math.max(1, Math.round(radiusM))));
  u.searchParams.set('limit', String(limit));
  if (offset) u.searchParams.set('offset', String(offset));
  return u.toString();
}

/**
 * Parse an OCPDB locations page into {lat, lng, operator, points: [{id, status, updated}]}.
 * Charge points with status REMOVED are dropped, and locations with none left are omitted.
 */
export function parseOcpdb(json) {
  const items = Array.isArray(json) ? json : (json && json.items) || [];
  const out = [];
  for (const it of items) {
    const c = it && it.coordinates;
    const lat = c ? c.lat ?? c.latitude : null;
    const lng = c ? c.lon ?? c.longitude ?? c.lng : null;
    if (lat == null || lng == null) continue;
    const operator = (it.operator && it.operator.name) || (typeof it.operator === 'string' ? it.operator : '');
    const points = [];
    for (const e of it.evses || []) {
      if (String(e.status || '').toUpperCase() === 'REMOVED') continue;
      const updated = e.status_last_updated || e.last_updated || null;
      points.push({ id: e.evse_id || e.uid || null, status: normStatus(e.status), updated });
    }
    if (!points.length) continue;
    out.push({ id: it.id ?? null, lat: +lat, lng: +lng, operator, address: it.address || it.name || '', points });
  }
  return out;
}

function abortAfter(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  if (typeof AbortController === 'undefined') return undefined;
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/**
 * Fetch every OCPDB locations page for one circle around the user.
 * `fetchFn` defaults to global fetch and is injectable in tests. Throws if the API is down.
 */
export async function fetchOcpdbLocations({ lat, lng, radiusM }, { fetchFn = globalThis.fetch, headers = {}, pageLimit = 1000, maxPages = 5, timeoutMs = 12000, signal } = {}) {
  if (typeof fetchFn !== 'function') throw new Error('fetch is not available');
  const locations = [];
  let offset = 0, seen = 0;
  for (let page = 0; page < maxPages; page++) {
    const url = ocpdbLocationsUrl({ lat, lng, radiusM, limit: pageLimit, offset });
    const res = await fetchFn(url, { headers, signal: signal || abortAfter(timeoutMs) });
    if (!res.ok) throw new Error(`OCPDB HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.error) throw new Error(json.error.message || 'OCPDB error');
    const items = json.items || [];
    seen += items.length;
    locations.push(...parseOcpdb(json));
    const next = json.next_offset;
    const total = json.total_count;
    if (!items.length || next == null || next <= offset || (total != null && seen >= total)) break;
    offset = next;
  }
  return locations;
}

/**
 * Radius (metres) that covers the `want` nearest register stations, plus padding for the 50 m match.
 * Capped so a search never asks OCPDB for more than the Munich area.
 */
export function searchRadiusM(stations, origin, { minKw = 0, want = 40, padM = 300, minM = 800, maxM = 25000 } = {}) {
  const dists = [];
  for (const s of stations) {
    if ((s.maxKw || 0) < minKw) continue;
    dists.push(haversineKm(origin, s) * 1000);
  }
  dists.sort((a, b) => a - b);
  if (!dists.length) return minM;
  const reach = dists[Math.min(want, dists.length) - 1];
  return Math.min(maxM, Math.max(minM, Math.ceil(reach + padM)));
}

/** Google Maps driving-directions URL (opens the Tesla navigation / phone maps app). */
export function navUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

// The register uses German plug names; map them to short English labels for display.
const PLUG_LABELS = [
  [/chademo/i, 'CHAdeMO'],
  [/combo|ccs/i, 'CCS'],
  [/typ\s*2.*fahrzeugkupplung/i, 'Type 2 (tethered cable)'],
  [/typ\s*2/i, 'Type 2'],
  [/schuko|typ\s*e\s*f/i, 'Schuko'],
];
/** "DC Fahrzeugkupplung Typ Combo 2 (CCS); DC CHAdeMO" -> ["CCS", "CHAdeMO"] */
export function plugLabels(plug) {
  return String(plug || '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (PLUG_LABELS.find(([re]) => re.test(p)) || [null, p])[1]);
}

/**
 * Rank stations by distance from `origin`.
 * Live data is either:
 *   - liveLocations: OCPDB sites matched by operator and distance (see matchLiveLocation), or
 *   - statusMap: Map<normEvse, status> from a DATEX II / OCPI feed.
 * With onlyAvailable, stations that don't have a confirmed free point are skipped.
 */
export function rank(stations, origin, { limit = 3, statusMap = null, liveLocations = null, minKw = 0, onlyAvailable = true, matchMeters = LIVE_MATCH_METERS } = {}) {
  const out = [];
  const hasLive = !!(statusMap || liveLocations);
  for (const s of stations) {
    if (s.maxKw < minKw) continue;
    let points = s.points;
    let free = 0, occupiedCount = null, unavailableCount = null, statusUpdated = null, live = false;
    if (liveLocations) {
      const hit = matchLiveLocation(s, liveLocations, matchMeters);
      if (hit) {
        const sum = summarizeLive(hit.location.points);
        free = sum.free;
        occupiedCount = sum.occupied;
        unavailableCount = sum.unavailable;
        statusUpdated = sum.updated;
        live = true;
      }
    } else if (statusMap) {
      points = s.points.map((p) => ({ ...p, status: p.evse ? statusMap.get(normEvse(p.evse)) || 'UNKNOWN' : 'UNKNOWN' }));
      const sum = summarizeLive(points);
      free = sum.free;
      // A register point with no EVSE id is UNKNOWN, which is not a real "unavailable" count.
      live = points.some((p) => p.status !== 'UNKNOWN');
      if (live) {
        occupiedCount = points.filter((p) => statusBucket(p.status) === 'occupied').length;
        unavailableCount = points.filter((p) => p.status !== 'UNKNOWN' && statusBucket(p.status) === 'unavailable').length;
      }
    }
    if (hasLive && onlyAvailable && free === 0) continue;
    out.push({
      ...s, points, freeCount: live ? free : null, occupiedCount: live ? occupiedCount : null,
      unavailableCount: live ? unavailableCount : null, statusUpdated: live ? statusUpdated : null,
      live, distanceKm: +haversineKm(origin, s).toFixed(2), navUrl: navUrl(s.lat, s.lng),
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, limit);
}
