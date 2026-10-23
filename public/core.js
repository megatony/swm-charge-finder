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
 * statusMap: Map<normEvse, 'AVAILABLE'|'CHARGING'|'OUT_OF_ORDER'|...>, or null when no live feed is configured.
 * With a statusMap (and onlyAvailable), stations without at least one AVAILABLE point are skipped.
 */
export function rank(stations, origin, { limit = 3, statusMap = null, minKw = 0, onlyAvailable = true } = {}) {
  const out = [];
  for (const s of stations) {
    if (s.maxKw < minKw) continue;
    const points = s.points.map((p) => ({ ...p, status: statusMap && p.evse ? statusMap.get(normEvse(p.evse)) || 'UNKNOWN' : 'UNKNOWN' }));
    const free = points.filter((p) => p.status === 'AVAILABLE').length;
    const live = points.some((p) => p.status !== 'UNKNOWN');
    if (statusMap && onlyAvailable && free === 0) continue;
    out.push({ ...s, points, freeCount: live ? free : null, live, distanceKm: +haversineKm(origin, s).toFixed(2), navUrl: navUrl(s.lat, s.lng) });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, limit);
}
