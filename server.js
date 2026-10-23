// Tiny zero-dependency server: static UI + /api/nearest. Run: node server.js  (PORT=8080)
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { rank } from './public/core.js';
import { getStatusMap } from './lib/live.js';

const ROOT = new URL('.', import.meta.url).pathname;
const stations = JSON.parse(readFileSync(join(ROOT, 'public/stations.json'), 'utf8')).stations;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

export async function nearest(lat, lng, limit = 3, minKw = 0) {
  let statusMap = null, liveError = null;
  try { statusMap = await getStatusMap(); } catch (e) { liveError = e.message; }
  const results = rank(stations, { lat, lng }, { limit, statusMap, minKw });
  return { origin: { lat, lng }, live: !!statusMap, liveError, distance: 'haversine (straight line), not driving distance', results };
}

// Optional: push a destination to the car via Tesla Fleet API (through Tesla's vehicle-command proxy, which signs it).
// Disabled unless TESLA_PROXY_URL, TESLA_ACCESS_TOKEN, TESLA_VIN and API_SECRET are set. Not tested against a real car.
async function sendToTesla(lat, lng) {
  const { TESLA_PROXY_URL, TESLA_ACCESS_TOKEN, TESLA_VIN } = process.env;
  const r = await fetch(`${TESLA_PROXY_URL}/api/1/vehicles/${TESLA_VIN}/command/navigation_gps_request`, {
    method: 'POST', headers: { Authorization: `Bearer ${TESLA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon: lng, order: 1 }) });
  return { status: r.status, body: await r.text() };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (u.pathname === '/api/send-nearest-to-car' && req.method === 'POST') {
    // For an assistant/bot: finds nearest free SWM point and pushes it to the car. Requires header X-Api-Secret.
    if (!process.env.API_SECRET || req.headers['x-api-secret'] !== process.env.API_SECRET) { res.writeHead(401); return res.end('{"error":"unauthorized"}'); }
    if (!process.env.TESLA_PROXY_URL) { res.writeHead(501); return res.end('{"error":"Tesla Fleet API not configured"}'); }
    const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lng');
    const best = (await nearest(lat, lng, 1)).results[0];
    if (!best) { res.writeHead(404); return res.end('{"error":"no station"}'); }
    const tesla = await sendToTesla(best.lat, best.lng);
    res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ station: best, tesla }));
  }
  if (u.pathname === '/api/nearest') {
    const lat = +u.searchParams.get('lat'), lng = +u.searchParams.get('lng');
    if (!isFinite(lat) || !isFinite(lng) || !u.searchParams.get('lat')) { res.writeHead(400); return res.end('{"error":"lat,lng required"}'); }
    const body = await nearest(lat, lng, Math.min(+u.searchParams.get('limit') || 3, 10), +u.searchParams.get('minKw') || 0);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify(body));
  }
  let p = normalize(decodeURIComponent(u.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p === '/') p = '/index.html';
  const f = p.startsWith('/lib/') ? join(ROOT, p) : join(ROOT, 'public', p);
  if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
if (process.argv[1] === new URL(import.meta.url).pathname) server.listen(process.env.PORT || 8080, () => console.log('http://localhost:' + (process.env.PORT || 8080)));
