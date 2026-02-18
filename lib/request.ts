export function getRequestId(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming && incoming.length >= 8 && incoming.length <= 128) {
    return incoming;
  }

  const randomPart = Math.random().toString(36).slice(2, 14);
  const timePart = Date.now().toString(36);
  return `req_${timePart}_${randomPart}`;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim();
  if (candidate && candidate.length <= 100) {
    return candidate;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && realIp.length <= 100) {
    return realIp;
  }

  return "unknown";
}

export function getIdentifierBucketKey(prefix: string, identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);

  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }

  const digest = hash.toString(16).padStart(16, "0");
  return `${prefix}:${digest}`;
}
