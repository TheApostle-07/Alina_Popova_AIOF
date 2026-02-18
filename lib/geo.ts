type Coordinate = { lat: number; lng: number };

const INDIA_REGION_MAP: Record<string, { name: string } & Coordinate> = {
  AN: { name: "Andaman and Nicobar Islands", lat: 11.74, lng: 92.66 },
  AP: { name: "Andhra Pradesh", lat: 15.91, lng: 79.74 },
  AR: { name: "Arunachal Pradesh", lat: 28.22, lng: 94.73 },
  AS: { name: "Assam", lat: 26.2, lng: 92.94 },
  BR: { name: "Bihar", lat: 25.1, lng: 85.31 },
  CG: { name: "Chhattisgarh", lat: 21.28, lng: 81.86 },
  CH: { name: "Chandigarh", lat: 30.73, lng: 76.78 },
  DD: { name: "Dadra and Nagar Haveli and Daman and Diu", lat: 20.27, lng: 72.99 },
  DL: { name: "Delhi", lat: 28.61, lng: 77.21 },
  DN: { name: "Dadra and Nagar Haveli and Daman and Diu", lat: 20.27, lng: 72.99 },
  GA: { name: "Goa", lat: 15.29, lng: 74.12 },
  GJ: { name: "Gujarat", lat: 22.31, lng: 72.14 },
  HP: { name: "Himachal Pradesh", lat: 31.1, lng: 77.17 },
  HR: { name: "Haryana", lat: 29.06, lng: 76.08 },
  JH: { name: "Jharkhand", lat: 23.61, lng: 85.28 },
  JK: { name: "Jammu and Kashmir", lat: 34.08, lng: 74.8 },
  KA: { name: "Karnataka", lat: 15.32, lng: 75.71 },
  KL: { name: "Kerala", lat: 10.85, lng: 76.27 },
  LA: { name: "Ladakh", lat: 34.15, lng: 77.58 },
  LD: { name: "Lakshadweep", lat: 10.57, lng: 72.64 },
  MH: { name: "Maharashtra", lat: 19.75, lng: 75.71 },
  ML: { name: "Meghalaya", lat: 25.47, lng: 91.37 },
  MN: { name: "Manipur", lat: 24.66, lng: 93.91 },
  MP: { name: "Madhya Pradesh", lat: 22.97, lng: 78.66 },
  MZ: { name: "Mizoram", lat: 23.16, lng: 92.94 },
  NL: { name: "Nagaland", lat: 26.16, lng: 94.56 },
  OR: { name: "Odisha", lat: 20.95, lng: 85.1 },
  PB: { name: "Punjab", lat: 31.15, lng: 75.34 },
  PY: { name: "Puducherry", lat: 11.94, lng: 79.81 },
  RJ: { name: "Rajasthan", lat: 27.02, lng: 74.22 },
  SK: { name: "Sikkim", lat: 27.53, lng: 88.51 },
  TN: { name: "Tamil Nadu", lat: 11.13, lng: 78.65 },
  TR: { name: "Tripura", lat: 23.94, lng: 91.99 },
  TS: { name: "Telangana", lat: 17.12, lng: 79.21 },
  UK: { name: "Uttarakhand", lat: 30.07, lng: 79.02 },
  UP: { name: "Uttar Pradesh", lat: 26.85, lng: 80.95 },
  WB: { name: "West Bengal", lat: 22.99, lng: 87.85 }
};

const COUNTRY_FALLBACK_MAP: Record<string, Coordinate> = {
  IN: { lat: 20.59, lng: 78.96 },
  US: { lat: 39.83, lng: -98.58 },
  CA: { lat: 56.13, lng: -106.35 },
  GB: { lat: 55.38, lng: -3.44 },
  AU: { lat: -25.27, lng: 133.77 },
  AE: { lat: 23.42, lng: 53.85 },
  SG: { lat: 1.35, lng: 103.82 },
  DE: { lat: 51.17, lng: 10.45 },
  FR: { lat: 46.23, lng: 2.21 },
  NL: { lat: 52.13, lng: 5.29 },
  IT: { lat: 41.87, lng: 12.56 },
  ES: { lat: 40.46, lng: -3.75 },
  BR: { lat: -14.24, lng: -51.93 },
  ZA: { lat: -30.56, lng: 22.94 },
  RU: { lat: 61.52, lng: 105.32 },
  JP: { lat: 36.2, lng: 138.25 },
  KR: { lat: 35.91, lng: 127.77 },
  ID: { lat: -0.79, lng: 113.92 },
  PH: { lat: 12.88, lng: 121.77 },
  TH: { lat: 15.87, lng: 100.99 },
  MY: { lat: 4.21, lng: 101.98 },
  SA: { lat: 23.89, lng: 45.08 },
  NZ: { lat: -40.9, lng: 174.89 }
};

let displayNames: Intl.DisplayNames | null = null;

function getDisplayNames() {
  if (displayNames) {
    return displayNames;
  }

  try {
    displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    displayNames = null;
  }
  return displayNames;
}

function getHeaderValue(headers: Headers, keys: string[]) {
  for (const key of keys) {
    const value = headers.get(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function parseCoordinate(value: string, min: number, max: number) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  if (parsed < min || parsed > max) {
    return undefined;
  }
  return parsed;
}

export function getCountryFallbackCoordinates(countryCode?: string | null) {
  if (!countryCode) {
    return null;
  }
  return COUNTRY_FALLBACK_MAP[countryCode.toUpperCase()] || null;
}

export function getIndiaRegionInfo(regionCode?: string | null) {
  if (!regionCode) {
    return null;
  }
  return INDIA_REGION_MAP[regionCode.toUpperCase()] || null;
}

export function getCountryName(countryCode?: string | null) {
  if (!countryCode || countryCode.length !== 2) {
    return "";
  }

  const normalized = countryCode.toUpperCase();
  const names = getDisplayNames();
  const name = names?.of(normalized) || "";
  return name || normalized;
}

export type RequestGeo = {
  countryCode?: string;
  country?: string;
  regionCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lng?: number;
};

export function parseGeoFromHeaders(headers: Headers): RequestGeo {
  const countryCode = getHeaderValue(headers, [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code"
  ]).toUpperCase();

  const regionCode = getHeaderValue(headers, [
    "x-vercel-ip-country-region",
    "x-vercel-ip-region",
    "x-region-code"
  ]).toUpperCase();

  const city = getHeaderValue(headers, ["x-vercel-ip-city", "x-city"]).slice(0, 120);

  let lat = parseCoordinate(
    getHeaderValue(headers, ["x-vercel-ip-latitude", "x-vercel-ip-lat", "x-geo-latitude"]),
    -90,
    90
  );
  let lng = parseCoordinate(
    getHeaderValue(headers, ["x-vercel-ip-longitude", "x-vercel-ip-lng", "x-geo-longitude"]),
    -180,
    180
  );

  const indiaRegion = countryCode === "IN" ? getIndiaRegionInfo(regionCode) : null;
  const countryFallback = getCountryFallbackCoordinates(countryCode);

  if (typeof lat !== "number" || typeof lng !== "number") {
    if (indiaRegion) {
      lat = indiaRegion.lat;
      lng = indiaRegion.lng;
    } else if (countryFallback) {
      lat = countryFallback.lat;
      lng = countryFallback.lng;
    }
  }

  return {
    countryCode: countryCode || undefined,
    country: getCountryName(countryCode) || undefined,
    regionCode: regionCode || undefined,
    region: indiaRegion?.name || undefined,
    city: city || undefined,
    lat,
    lng
  };
}
