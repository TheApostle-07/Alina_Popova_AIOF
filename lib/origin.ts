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

function originFromRequestHost(request: Request) {
  const urlOrigin = normalizeOrigin(request.url);
  if (urlOrigin) {
    return urlOrigin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto") || "";
  const firstProto = forwardedProto.split(",")[0]?.trim();
  const protocol = firstProto || (process.env.NODE_ENV === "production" ? "https" : "http");

  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const host = forwardedHost.split(",")[0]?.trim();
  if (!host) {
    return null;
  }

  return normalizeOrigin(`${protocol}://${host}`);
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
    const requestOrigin = originFromRequestHost(request);
    if (requestOrigin) {
      allowed.add(requestOrigin);
    }
  }

  if (!allowed.size) {
    allowed.add("http://localhost:3000");
  }

  return Array.from(allowed);
}
