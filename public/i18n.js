// UI strings for the static pages. English is the default. Keys and comments stay in English.

export const LANGS = ['en', 'tr'];
export const LANG_STORAGE_KEY = 'swm-lang';

export const STRINGS = {
  en: {
    metaTitle: 'SWM Charge Finder',
    metaDescription: 'Find the nearest SWM (Stadtwerke München) EV charger and navigate there with one tap. Built for the Tesla browser.',
    title: 'SWM Charge Finder',
    tagline: 'Nearest Stadtwerke München charger · see what’s free right now',
    find: '⚡ Navigate to nearest charger',
    enterLocation: '✍️ Enter location',
    fastOnly: '🚀 Fast only (≥ 50 kW)',
    onlyFree: '🟢 Only show free',
    addressPlaceholder: 'Address or coordinates, e.g. 48.137, 11.575',
    addressLabel: 'Address or coordinates',
    search: 'Search',
    language: 'Language',

    footerStationsLead: 'Station data:',
    footerStationsMid: '© Bundesnetzagentur.de (as of 1 Sep 2026), licensed under',
    footerStationsEnd: '. Modified: filtered to SWM-operated sites, misplaced coordinates cleaned.',
    footerAddressLead: 'Address search:',
    footerAddressMid: ', ©',
    osmContributors: 'OpenStreetMap contributors',
    footerAddressEnd: '. Routes open in Google Maps. Distances are straight-line.',
    footerLiveLead: 'Live availability:',
    footerLiveRest: '(Open ChargePoint DataBase). Available counts as free, charging or blocked as occupied, out of order or unknown as unavailable. Independent project, not affiliated with SWM or Tesla.',
    footerSource: 'Source on GitHub',

    searchingNear: 'Searching near {where}…',
    checkingFree: 'Checking which chargers are free near {where}…',
    gettingLocation: 'Getting your location…',
    lookingUp: 'Looking up address…',
    fastOnlyStatus: 'fast chargers only',
    freeOnlyStatus: 'free only',
    liveAttribution: 'live · MobiData BW / e-clearing.net',
    newestStatus: 'newest status {when}',
    justNow: 'just now',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    statusChanged: 'status changed {when}',

    freeNow: 'Free now',
    availabilityUnknown: 'availability unknown',
    countFree: '{n} free',
    countOccupied: '{n} occupied',
    countUnavailable: '{n} unavailable',
    upToKw: 'up to {kw} kW',
    chargePoint: '{n} charge point',
    chargePoints: '{n} charge points',
    meters: '{n} m',
    kilometers: '{n} km',
    navigate: 'Navigate ➜',
    go: 'Go ➜',
    connector: '{count}× {label} · {kw} kW',
    plugType2: 'Type 2',
    plugType2Cable: 'Type 2 (tethered cable)',
    plugCcs: 'CCS',
    plugChademo: 'CHAdeMO',
    plugSchuko: 'Schuko',

    nearestChargers: 'Nearest chargers',
    nearestFree: 'Nearest free chargers',
    noneFound: 'No matching charger found',
    noneFree: 'No free SWM charge point nearby right now.',
    tryFastOff: 'Try turning off “Fast only”.',
    noneNearby: 'No SWM charger nearby.',

    loadFailed: 'Couldn’t load charger data ({message}). Check your connection and try again.',
    noGeo: 'This browser can’t share your location. Enter an address or coordinates instead.',
    geoDenied: 'Location access was denied. Allow location for this site in the browser settings, or enter an address below.',
    geoTimeout: 'Getting your location timed out. Try again, or enter an address below.',
    geoFailed: 'Couldn’t get your location ({message}). Enter an address below.',
    addressNotFound: 'Address not found. Try adding the city, e.g. “Leopoldstr. 81, München”.',
    addressFailed: 'Address search failed. Check your connection or enter coordinates.',
    liveDown: 'Live availability is unavailable right now, so free and occupied can’t be shown. Listing the nearest chargers instead.',

    cbTitle: 'Tesla sign-in · SWM Charge Finder',
    cbHeading: 'Tesla authorization code',
    cbInstructions: 'Your code is below. Copy it and send it back to Grok Bot to finish connecting your car.',
    cbCopy: 'Copy code',
    cbCopied: 'Copied ✓',
    cbNoCode: '(no code)',
    cbMissing: 'No ?code= parameter found in the URL.',
    cbError: 'Error: {detail}',
    cbState: 'state: {state}',
  },
  tr: {
    metaTitle: 'SWM Şarj Bulucu',
    metaDescription: 'En yakın SWM (Stadtwerke München) elektrikli araç şarj noktasını bulun ve tek dokunuşla yol tarifi alın. Tesla tarayıcısı için tasarlandı.',
    title: 'SWM Şarj Bulucu',
    tagline: 'En yakın Stadtwerke München şarjı · şu an hangisi boş',
    find: '⚡ En yakın şarja yol tarifi',
    enterLocation: '✍️ Konum gir',
    fastOnly: '🚀 Yalnızca hızlı (≥ 50 kW)',
    onlyFree: '🟢 Yalnızca boş olanlar',
    addressPlaceholder: 'Adres veya koordinat, örn. 48.137, 11.575',
    addressLabel: 'Adres veya koordinat',
    search: 'Ara',
    language: 'Dil',

    footerStationsLead: 'İstasyon verisi:',
    footerStationsMid: '© Bundesnetzagentur.de (1 Eylül 2026 itibarıyla),',
    footerStationsEnd: ' lisansı altındadır. Değişiklik: yalnızca SWM’nin işlettiği istasyonlar bırakıldı, yanlış konumlu kayıtlar temizlendi.',
    footerAddressLead: 'Adres araması:',
    footerAddressMid: ', ©',
    osmContributors: 'OpenStreetMap katkıda bulunanlar',
    footerAddressEnd: '. Rotalar Google Maps’te açılır. Mesafeler kuş uçuşudur.',
    footerLiveLead: 'Anlık doluluk:',
    footerLiveRest: '(Open ChargePoint DataBase). Müsait olanlar boş, şarj edilen veya bloke olanlar dolu, arızalı ya da durumu bilinmeyenler kullanılamaz sayılır. SWM veya Tesla ile bağlantısı olmayan bağımsız bir projedir.',
    footerSource: 'Kaynak kodu GitHub’da',

    searchingNear: '{where} yakınında aranıyor…',
    checkingFree: '{where} yakınında hangi şarjların boş olduğu kontrol ediliyor…',
    gettingLocation: 'Konumunuz alınıyor…',
    lookingUp: 'Adres aranıyor…',
    fastOnlyStatus: 'yalnızca hızlı şarj',
    freeOnlyStatus: 'yalnızca boş',
    liveAttribution: 'canlı · MobiData BW / e-clearing.net',
    newestStatus: 'en son durum {when}',
    justNow: 'az önce',
    minutesAgo: '{n} dk önce',
    hoursAgo: '{n} saat önce',
    statusChanged: 'durum {when} değişti',

    freeNow: 'Şimdi boş',
    availabilityUnknown: 'doluluk bilinmiyor',
    countFree: '{n} boş',
    countOccupied: '{n} dolu',
    countUnavailable: '{n} kullanılamaz',
    upToKw: 'en fazla {kw} kW',
    chargePoint: '{n} şarj noktası',
    chargePoints: '{n} şarj noktası',
    meters: '{n} m',
    kilometers: '{n} km',
    navigate: 'Yol tarifi ➜',
    go: 'Git ➜',
    connector: '{count}× {label} · {kw} kW',
    plugType2: 'Tip 2',
    plugType2Cable: 'Tip 2 (sabit kablo)',
    plugCcs: 'CCS',
    plugChademo: 'CHAdeMO',
    plugSchuko: 'Schuko',

    nearestChargers: 'En yakın şarjlar',
    nearestFree: 'En yakın boş şarjlar',
    noneFound: 'Uygun şarj bulunamadı',
    noneFree: 'Yakında şu an boş bir SWM şarj noktası yok.',
    tryFastOff: '“Yalnızca hızlı” filtresini kapatmayı deneyin.',
    noneNearby: 'Yakında SWM şarjı yok.',

    loadFailed: 'Şarj verisi yüklenemedi ({message}). Bağlantınızı kontrol edip yeniden deneyin.',
    noGeo: 'Bu tarayıcı konumunuzu paylaşamıyor. Bunun yerine bir adres veya koordinat girin.',
    geoDenied: 'Konum izni reddedildi. Tarayıcı ayarlarından bu siteye konum izni verin veya aşağıya bir adres girin.',
    geoTimeout: 'Konum alınırken zaman aşımı oldu. Yeniden deneyin veya aşağıya bir adres girin.',
    geoFailed: 'Konumunuz alınamadı ({message}). Aşağıya bir adres girin.',
    addressNotFound: 'Adres bulunamadı. Şehri de yazmayı deneyin, örneğin “Leopoldstr. 81, München”.',
    addressFailed: 'Adres araması başarısız oldu. Bağlantınızı kontrol edin veya koordinat girin.',
    liveDown: 'Anlık doluluk şu an kullanılamıyor, bu yüzden boş ve dolu bilgisi gösterilemiyor. Bunun yerine en yakın şarjlar listeleniyor.',

    cbTitle: 'Tesla girişi · SWM Şarj Bulucu',
    cbHeading: 'Tesla yetkilendirme kodu',
    cbInstructions: 'Kodunuz aşağıda. Aracınızı bağlamayı tamamlamak için kopyalayıp Grok Bot’a gönderin.',
    cbCopy: 'Kodu kopyala',
    cbCopied: 'Kopyalandı ✓',
    cbNoCode: '(kod yok)',
    cbMissing: 'Adreste ?code= parametresi yok.',
    cbError: 'Hata: {detail}',
    cbState: 'state: {state}',
  },
};

/** BCP 47 tag used for Intl number and date formatting. */
export function localeTag(lang) {
  return lang === 'tr' ? 'tr-TR' : 'en-GB';
}

/**
 * Saved choice wins. Otherwise Turkish when the browser language starts with "tr".
 * Anything else, including a missing or unknown saved value, stays English.
 */
export function initialLang(stored, navigatorLanguage = '') {
  if (stored === 'en' || stored === 'tr') return stored;
  return String(navigatorLanguage || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/** Look up a string and substitute {name} placeholders. Unknown languages fall back to English. */
export function translate(lang, key, vars = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  const raw = table[key] ?? STRINGS.en[key] ?? key;
  return String(raw).replace(/\{(\w+)\}/g, (_, name) => (vars[name] == null ? '' : String(vars[name])));
}

export function formatNumber(lang, value, options) {
  return new Intl.NumberFormat(localeTag(lang), options).format(value);
}

export function formatDateTime(lang, date) {
  return new Intl.DateTimeFormat(localeTag(lang), {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date);
}
