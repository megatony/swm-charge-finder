// Shared logic (Node + browser via <script type=module>)
export function haversineKm(a, b) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const normEvse = (s) => (s || '').replace(/[*\s-]/g, '').toUpperCase();
export function navUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}
// statusMap: Map<normEvse, 'AVAILABLE'|'CHARGING'|'OUT_OF_ORDER'|...> or null when no live feed
export function rank(stations, origin, { limit = 3, statusMap = null, minKw = 0, onlyAvailable = true } = {}) {
  const out = [];
  for (const s of stations) {
    if (s.maxKw < minKw) continue;
    const pts = s.points.map((p) => ({ ...p, status: statusMap && p.evse ? statusMap.get(normEvse(p.evse)) || 'UNKNOWN' : 'UNKNOWN' }));
    const free = pts.filter((p) => p.status === 'AVAILABLE').length;
    const live = pts.some((p) => p.status !== 'UNKNOWN');
    if (statusMap && onlyAvailable && free === 0) continue;
    out.push({ ...s, points: pts, freeCount: live ? free : null, live, distanceKm: +haversineKm(origin, s).toFixed(2), navUrl: navUrl(s.lat, s.lng) });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out.slice(0, limit);
}
