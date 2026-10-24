# ⚡ SWM Charge Finder

**Find the nearest SWM (Stadtwerke München) EV charger and start navigating with one tap – built for the Tesla in-car browser.**

[![Test & deploy](https://github.com/megatony/swm-charge-finder/actions/workflows/pages.yml/badge.svg)](https://github.com/megatony/swm-charge-finder/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-blue.svg)](https://creativecommons.org/licenses/by/4.0/)

**Live demo → <https://megatony.github.io/swm-charge-finder/>**

![SWM Charge Finder screenshot](docs/screenshot.png)

## Features

- **One big button.** "Navigate to nearest charger" reads your position and lists the three closest SWM sites; the top result opens turn-by-turn directions (Google Maps, which hands off to the car's navigation).
- **Made for the car.** Large touch targets, dark theme, one page plus two small scripts, a ~220 KB station file, and no frameworks, trackers or build step.
- **Useful details.** Each station shows its distance, max power (kW), connector types (Type 2, CCS, CHAdeMO) with counts, and its address.
- **Live availability.** Each station shows how many points are free, occupied, or unavailable right now, a **Free now** badge, and the time that status last changed. **Only show free** hides sites with nothing available. If the live feed is down, those details are hidden and the static list still works.
- **English and Turkish.** The header **EN / TR** toggle switches every label, including live status. English is the default. Turkish is chosen automatically when the browser language starts with `tr`, and the choice is remembered on the device. Numbers and times follow the selected language.
- **Fast-only filter** for DC chargers at 50 kW or more.
- **Manual location.** Enter an address (OpenStreetMap Nominatim) or `lat, lng` coordinates when GPS is unavailable or denied.
- **Deep links.** `?lat=48.137&lng=11.575` runs a search immediately.
- **Works fully static** (GitHub Pages), including live availability. An optional zero-dependency Node backend exposes the same feed on `/api/nearest` and a **send-to-car** endpoint.

## How it works

```
Bundesnetzagentur CSV ──► scripts/build-static.py ──► public/stations.json (621 SWM sites, 1,533 charge points)
                                                          │
Browser (public/index.html + core.js) ◄───────────────────┘   ranks by straight-line distance, client-side
        │
        └── GET MobiData BW OCPDB (no key, CORS *)  near the user’s position
                    source datex2_e_clearing_net, operator SWM
                    match the nearest location within 50 m
                    AVAILABLE = free · CHARGING/BLOCKED = occupied · OUTOFORDER/UNKNOWN = unavailable

server.js (optional) ── lib/live.js  LIVE_SOURCE=ocpdb (default) ──► the same OCPDB query, with a User-Agent
        │                     datex2 / file remain available (see Alternatives)
        └── POST /api/send-nearest-to-car ──► Tesla vehicle-command proxy ──► Fleet API navigation_gps_request
```

1. **Static data build.** `scripts/build-static.py` reads the official charging-station register CSV, keeps operational SWM-operated sites, groups charge points by location, and fixes rows that were geocoded to the city centre. Those rows are moved to a twin entry at the same address, or dropped.
2. **Frontend.** `public/core.js` (shared with Node) ranks stations by haversine distance and optional minimum power. On GitHub Pages it all runs in the browser. Live status is a second request to [MobiData BW’s Open ChargePoint DataBase](https://api.mobidata-bw.de/ocpdb/documentation/public.html), limited to a radius that covers the nearest register sites (cached for 60 seconds). e-clearing.net ids look like `CO_1391`, not Bundesnetzagentur EVSE ids, so a station is paired with the nearest SWM location within 50 m. `REMOVED` charge points are ignored. If that request fails, the page hides live badges and still lists the nearest sites.
3. **Backend (optional).** `server.js` serves the UI and `GET /api/nearest`. `lib/live.js` defaults to `LIVE_SOURCE=ocpdb` and sends `User-Agent: swm-charge-finder/1.0 (+https://github.com/megatony/swm-charge-finder)`. The same 60-second cache applies. With live data, the endpoint prefers stations that have a free point.
4. **Send to car (planned).** `POST /api/send-nearest-to-car` picks the nearest (free) charger and sends it to the car's navigation through the Tesla Fleet API (`navigation_gps_request`, signed by Tesla's vehicle-command proxy). It hasn't been tested against a real car yet.

## Quick start

Requirements: Node 18+ (no npm dependencies). Python 3 is needed only to rebuild the data.

```bash
git clone https://github.com/megatony/swm-charge-finder.git
cd swm-charge-finder

# Static only: serve public/ with anything
python3 -m http.server -d public 8080        # → http://localhost:8080

# Backend + UI
node server.js                                # → http://localhost:8080 (PORT to change)
curl "http://localhost:8080/api/nearest?lat=48.137&lng=11.575&limit=3&minKw=0"

# Tests
node test/test.js

# Rebuild public/stations.json from a fresh register download
#   CSV: https://www.bundesnetzagentur.de/ladesaeulenkarte → "Liste der Ladesäulen (CSV)"
python3 scripts/build-static.py path/to/Ladesaeulenregister.csv
```

Deployment: every push to `main` runs the tests and publishes `public/` to GitHub Pages via [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

### API

| Endpoint | Description |
|---|---|
| `GET /api/nearest?lat=&lng=&limit=3&minKw=0` | Nearest stations as JSON (`limit` ≤ 10). With a live feed (the default), only stations with a free point. Each result includes `freeCount`, `occupiedCount`, `unavailableCount`, and `statusUpdated`. |
| `POST /api/send-nearest-to-car?lat=&lng=` | Header `X-Api-Secret` required. Sends the nearest station to the car via Tesla Fleet API. |

## Configuration

All configuration is through environment variables (names only; never commit values):

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default `8080`) |
| `LIVE_SOURCE` | `ocpdb` (default, MobiData BW), `datex2` (Mobilithek), `file` (local DATEX/OCPI JSON), or `none` |
| `MOBILITHEK_URL` | Subscription URL of the Mobilithek AFIR dynamic feed |
| `MOBILITHEK_CERT`, `MOBILITHEK_KEY` | Client certificate and key (PEM paths) for Mobilithek mTLS |
| `MOBILITHEK_PFX`, `MOBILITHEK_PASS` | Alternative: PKCS#12 bundle path and its passphrase |
| `LIVE_FILE` | Path to a downloaded feed when `LIVE_SOURCE=file` |
| `API_SECRET` | Shared secret expected in `X-Api-Secret` for send-to-car |
| `TESLA_PROXY_URL` | Base URL of Tesla's vehicle-command HTTP proxy |
| `TESLA_ACCESS_TOKEN` | Tesla Fleet API user access token |
| `TESLA_VIN` | Target vehicle VIN |

`lib/live.js` also contains `googleNearbyAvailable()`, an unused adapter for the Google Places API (New) `evChargeOptions` that needs your own API key.

## Data sources & attribution

- **Charging stations:** [Ladesäulenregister](https://www.bundesnetzagentur.de/ladesaeulenkarte) © **Bundesnetzagentur.de** (as of 1 September 2026), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Changes: filtered to SWM-operated sites (SWM Versorgungs GmbH, SWM Mobilität GmbH), regrouped by location, misplaced city-centre coordinates corrected or removed. The Bundesnetzagentur accepts no liability for accuracy or completeness.
- **Address search:** [Nominatim](https://nominatim.openstreetmap.org/), data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).
- **Live availability:** [MobiData BW](https://www.mobidata-bw.de/) Open ChargePoint DataBase, republishing SWM dynamic data from [e-clearing.net](https://e-clearing.net/) (`source_uid=datex2_e_clearing_net`). No API key. Queried by position and radius rather than for the whole city.
- **Routing:** Google Maps directions links.

### Known limitations

- Distances are straight-line, not driving distance.
- Live status is matched by location (same SWM operator, nearest site within 50 m), because e-clearing.net charge-point ids are SWM-internal. A register row with no OCPDB neighbour inside that distance shows “availability unknown”. Neighbouring register rows are not merged: each keeps its single nearest location, so a busy post next to a free one stays busy.
- `RESERVED` (rare in this feed) counts as occupied. `REMOVED` points are left out of the counts.

## Alternatives

The OCPDB feed is the one the app uses. Two older adapters are still in `lib/live.js` if you need them:

- **Mobilithek DATEX II** (`LIVE_SOURCE=datex2`). A direct subscription to the [Mobilithek](https://mobilithek.info) AFIR recharging dynamic feed, with an mTLS client certificate (`MOBILITHEK_URL` plus `MOBILITHEK_CERT`/`MOBILITHEK_KEY` or `MOBILITHEK_PFX`/`MOBILITHEK_PASS`). That feed matches on EVSE id. Only a minority of register charge points have one (324 of 1,533), so coverage stays incomplete without an AFIR static feed. The subscription was never set up; OCPDB replaces it for day-to-day use. `LIVE_SOURCE=file` reads a saved DATEX II / OCPI JSON file from `LIVE_FILE` instead.
- **Google Places** (`googleNearbyAvailable()`). An unused adapter for the Places API (New) `evChargeOptions`. It needs your own API key and a billing account.

This is an independent hobby project. It isn't affiliated with or endorsed by Stadtwerke München, Tesla, or the Bundesnetzagentur.

## Roadmap

- [x] Static nearest-charger finder on GitHub Pages
- [x] Backend with pluggable live-status adapters (OCPDB, DATEX II / OCPI) and tests
- [x] **Live availability** from MobiData BW / e-clearing.net, on the static page and on `/api/nearest`
- [ ] **Voice:** a Siri Shortcut or voice assistant calls `/api/send-nearest-to-car`, and Tesla Fleet API sends the route straight to the car's navigation
- [ ] Driving-distance ranking

## License

Code: [MIT](LICENSE) © 2026 Bahadır Akın Akgül. Station data: CC BY 4.0, Bundesnetzagentur.de.
