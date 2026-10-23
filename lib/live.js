// Live-status adapters. getLiveStatus() returns either OCPDB locations or an EVSE status map, or null.
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { normEvse, normStatus, fetchOcpdbLocations } from '../public/core.js';

export const APP_USER_AGENT = 'swm-charge-finder/1.0 (+https://github.com/megatony/swm-charge-finder)';

export function liveSource(env = process.env) {
  return env.LIVE_SOURCE || 'ocpdb';
}

export function ocpdbHeaders() {
  return { Accept: 'application/json', 'User-Agent': APP_USER_AGENT };
}

// Tolerant parser for DATEX II v3 "AFIR-Recharging-Dynamic" JSON (Mobilithek) and OCPI-like EVSE lists.
export function parseDynamic(json) {
  const m = new Map();
  const walk = (x) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== 'object') return;
    // DATEX II: refillPointStatus { reference: { idG|id }, status: { value } | status: 'available' }
    if (x.reference && x.status !== undefined) {
      const id = x.reference.idG || x.reference.id || x.reference.externalIdentifier;
      const st = typeof x.status === 'object' ? x.status.value ?? x.status.status : x.status;
      if (id) m.set(normEvse(id), normStatus(st));
    }
    // OCPI: { evse_id, status }
    if (x.evse_id && x.status) m.set(normEvse(x.evse_id), normStatus(x.status));
    Object.values(x).forEach(walk);
  };
  walk(json);
  return m;
}

function getJson(url, { cert, key, pfx, passphrase, headers } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      cert, key, pfx, passphrase,
      headers: { Accept: 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': APP_USER_AGENT, ...headers },
      timeout: 15000,
    }, (res) => {
      let b = ''; res.setEncoding('utf8'); res.on('data', (c) => (b += c));
      res.on('end', () => (res.statusCode >= 300 ? reject(new Error(`HTTP ${res.statusCode}`)) : resolve(JSON.parse(b))));
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

let evseCache = { key: '', at: 0, map: null };
// LIVE_SOURCE=datex2 → MOBILITHEK_URL (+ client cert MOBILITHEK_CERT/KEY or MOBILITHEK_PFX/PASS)
// LIVE_SOURCE=file   → LIVE_FILE (local JSON, for testing / a cron that downloads the feed)
async function loadEvseStatus(env) {
  const src = liveSource(env);
  const key = src + '|' + (env.LIVE_FILE || env.MOBILITHEK_URL || '');
  if (Date.now() - evseCache.at < 60_000 && evseCache.map && evseCache.key === key) return evseCache.map;
  let json;
  if (src === 'file') json = JSON.parse(readFileSync(env.LIVE_FILE, 'utf8'));
  else if (src === 'datex2') {
    const opt = {};
    if (env.MOBILITHEK_PFX) { opt.pfx = readFileSync(env.MOBILITHEK_PFX); opt.passphrase = env.MOBILITHEK_PASS; }
    if (env.MOBILITHEK_CERT) { opt.cert = readFileSync(env.MOBILITHEK_CERT); opt.key = readFileSync(env.MOBILITHEK_KEY); }
    json = await getJson(env.MOBILITHEK_URL, opt);
  } else throw new Error('unknown LIVE_SOURCE ' + src);
  evseCache = { key, at: Date.now(), map: parseDynamic(json) };
  return evseCache.map;
}

// Backwards-compatible EVSE map. OCPDB is location-based, so this returns null for it.
export async function getStatusMap(env = process.env) {
  const src = liveSource(env);
  if (src === 'none' || src === 'ocpdb') return null;
  return loadEvseStatus(env);
}

const ocpdbCache = new Map();
const ocpdbInflight = new Map();

function cacheIdentity(lat, lng) {
  return `${(+lat).toFixed(3)}|${(+lng).toFixed(3)}`;
}

/**
 * OCPDB locations around a point, cached for 60 s. A cached circle is reused when it already
 * covers the requested radius at the same rounded position. `fetchFn` is injectable in tests.
 */
export async function fetchOcpdbNear({ lat, lng, radiusM }, { fetchFn, ttl = 60_000 } = {}) {
  const id = cacheIdentity(lat, lng);
  if (ttl > 0) {
    for (const entry of ocpdbCache.values()) {
      if (entry.id === id && entry.radiusM >= radiusM - 50 && Date.now() - entry.at < ttl) return entry.locations;
    }
    const pending = ocpdbInflight.get(id);
    if (pending && pending.radiusM >= radiusM - 50) return pending.promise;
  }
  const promise = fetchOcpdbLocations({ lat, lng, radiusM }, { fetchFn, headers: ocpdbHeaders() });
  ocpdbInflight.set(id, { radiusM, promise });
  try {
    const locations = await promise;
    ocpdbCache.set(`${id}|${Math.round(radiusM)}`, { id, radiusM, at: Date.now(), locations });
    if (ocpdbCache.size > 32) {
      const oldest = [...ocpdbCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) ocpdbCache.delete(oldest[0]);
    }
    return locations;
  } finally {
    if (ocpdbInflight.get(id)?.promise === promise) ocpdbInflight.delete(id);
  }
}

/**
 * Live data for one search.
 * LIVE_SOURCE=ocpdb (default) → MobiData BW locations near lat/lng (needs query.lat/lng/radiusM).
 * LIVE_SOURCE=datex2|file     → Map<normEvse, status>.
 * LIVE_SOURCE=none            → null.
 */
export async function getLiveStatus(env = process.env, query = {}) {
  const src = liveSource(env);
  if (src === 'none') return null;
  if (src === 'ocpdb') {
    const { lat, lng, radiusM = 5000, fetchFn, ttl } = query;
    if (lat == null || lng == null) throw new Error('LIVE_SOURCE=ocpdb requires lat and lng');
    const locations = await fetchOcpdbNear({ lat, lng, radiusM }, { fetchFn, ttl });
    return { source: 'ocpdb', locations };
  }
  return { source: src, statusMap: await loadEvseStatus(env) };
}

// Optional: Google Places API (New) live connector availability — needs GOOGLE_MAPS_API_KEY (billing account).
export async function googleNearbyAvailable(lat, lng, key) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress,places.evChargeOptions', 'User-Agent': APP_USER_AGENT },
    body: JSON.stringify({ includedTypes: ['electric_vehicle_charging_station'], maxResultCount: 20, rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } } }),
  });
  if (!r.ok) throw new Error('Places HTTP ' + r.status);
  const { places = [] } = await r.json();
  return places.filter((p) => /SWM|Stadtwerke M/i.test(p.displayName?.text || '')).map((p) => ({
    name: p.displayName.text, address: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude,
    available: (p.evChargeOptions?.connectorAggregation || []).reduce((n, c) => n + (c.availableCount || 0), 0),
    connectors: p.evChargeOptions?.connectorAggregation || [],
  }));
}
