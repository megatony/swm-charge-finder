// Live-status adapters. Each returns Map<normalizedEvseId, STATUS> or null (= no live data).
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { normEvse } from '../public/core.js';

const MAP = { available: 'AVAILABLE', charging: 'CHARGING', occupied: 'CHARGING', blocked: 'BLOCKED', reserved: 'RESERVED',
  outoforder: 'OUT_OF_ORDER', faulted: 'OUT_OF_ORDER', inoperative: 'OUT_OF_ORDER', outofservice: 'OUT_OF_ORDER', unknown: 'UNKNOWN', removed: 'OUT_OF_ORDER', planned: 'OUT_OF_ORDER' };
const normStatus = (v) => MAP[String(v || '').toLowerCase().replace(/[^a-z]/g, '')] || 'UNKNOWN';

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
    const req = https.get(url, { cert, key, pfx, passphrase, headers: { Accept: 'application/json', 'Accept-Encoding': 'identity', ...headers }, timeout: 15000 }, (res) => {
      let b = ''; res.setEncoding('utf8'); res.on('data', (c) => (b += c));
      res.on('end', () => (res.statusCode >= 300 ? reject(new Error(`HTTP ${res.statusCode}`)) : resolve(JSON.parse(b))));
    });
    req.on('error', reject); req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

let cache = { at: 0, map: null };
// LIVE_SOURCE=datex2  → MOBILITHEK_URL (+ client cert MOBILITHEK_CERT/KEY or MOBILITHEK_PFX/PASS)
// LIVE_SOURCE=file    → LIVE_FILE (local JSON, for testing / a cron that downloads the feed)
export async function getStatusMap(env = process.env) {
  const src = env.LIVE_SOURCE || 'none';
  if (src === 'none') return null;
  if (Date.now() - cache.at < 60_000 && cache.map) return cache.map;
  let json;
  if (src === 'file') json = JSON.parse(readFileSync(env.LIVE_FILE, 'utf8'));
  else if (src === 'datex2') {
    const opt = {};
    if (env.MOBILITHEK_PFX) { opt.pfx = readFileSync(env.MOBILITHEK_PFX); opt.passphrase = env.MOBILITHEK_PASS; }
    if (env.MOBILITHEK_CERT) { opt.cert = readFileSync(env.MOBILITHEK_CERT); opt.key = readFileSync(env.MOBILITHEK_KEY); }
    json = await getJson(env.MOBILITHEK_URL, opt);
  } else throw new Error('unknown LIVE_SOURCE ' + src);
  cache = { at: Date.now(), map: parseDynamic(json) };
  return cache.map;
}

// Optional: Google Places API (New) live connector availability — needs GOOGLE_MAPS_API_KEY (billing account).
export async function googleNearbyAvailable(lat, lng, key) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress,places.evChargeOptions' },
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
