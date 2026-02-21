function normalizeDomainInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function originFromDomainValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = normalizeDomainInput(value);
  if (!normalizedValue) {
    return null;
  }

  return normalizeOrigin(normalizedValue);
}

function getRequestHeaderValue(request: Request, key: string) {
  const raw = request.headers.get(key) || "";
  return raw.split(",")[0]?.trim() || "";
}

function getRequestOrigins(request: Request) {
  const origins = new Set<string>();

  const fromUrl = normalizeOrigin(request.url);
  if (fromUrl) {
    origins.add(fromUrl);
  }

  const forwardedProto = getRequestHeaderValue(request, "x-forwarded-proto");
  const protocol =
    forwardedProto ||
    (fromUrl ? new URL(fromUrl).protocol.replace(":", "") : "") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  const candidateHosts = [
    getRequestHeaderValue(request, "x-forwarded-host"),
    getRequestHeaderValue(request, "host")
  ].filter(Boolean);

  for (const candidateHost of candidateHosts) {
    const hostOrigin = normalizeOrigin(`${protocol}://${candidateHost}`);
    if (hostOrigin) {
      origins.add(hostOrigin);
    }
  }

  return Array.from(origins);
}

export function getAllowedOrigins(request?: Request) {
  const allowed = new Set<string>();

  const envOrigins = [
    originFromDomainValue(process.env.NEXT_PUBLIC_SITE_URL),
    originFromDomainValue(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    originFromDomainValue(process.env.VERCEL_URL)
  ];

  for (const origin of envOrigins) {
    if (origin) {
      allowed.add(origin);
    }
  }

  if (request) {
    const requestOrigins = getRequestOrigins(request);
    for (const requestOrigin of requestOrigins) {
      allowed.add(requestOrigin);
    }
  }

  if (!allowed.size) {
    allowed.add("http://localhost:3000");
  }

  return Array.from(allowed);
}
