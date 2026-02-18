type RateLimitConfig = {
  windowMs: number;
  limit: number;
  lockoutMs?: number;
  namespace?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
  blockedUntil: number;
};

const buckets = new Map<string, Bucket>();

type RedisResult<T> = {
  ok: boolean;
  value: T | null;
};

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

async function redisCommand<T>(command: string, ...args: Array<string | number>) {
  const redis = getRedisConfig();
  if (!redis) {
    return { ok: false, value: null } as RedisResult<T>;
  }

  const encodedArgs = [command, ...args].map((value) => encodeURIComponent(String(value)));
  const url = `${redis.url}/${encodedArgs.join("/")}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redis.token}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return { ok: false, value: null } as RedisResult<T>;
    }

    const json = (await response.json()) as { result?: T };
    return {
      ok: true,
      value: (json.result ?? null) as T | null
    };
  } catch {
    return { ok: false, value: null } as RedisResult<T>;
  }
}

async function consumeRateLimitRedis(key: string, config: RateLimitConfig) {
  const now = Date.now();
  const namespace = config.namespace || "global";
  const lockKey = `rl:${namespace}:lock:${key}`;
  const bucketKey = `rl:${namespace}:bucket:${key}`;

  const lockRaw = await redisCommand<string>("GET", lockKey);
  if (!lockRaw.ok) {
    return null;
  }

  const blockedUntil = Number(lockRaw.value || 0);
  if (Number.isFinite(blockedUntil) && blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: blockedUntil - now
    };
  }

  const incr = await redisCommand<number>("INCR", bucketKey);
  if (!incr.ok) {
    return null;
  }

  const current = Number(incr.value || 0);
  if (current === 1) {
    await redisCommand("PEXPIRE", bucketKey, config.windowMs);
  }

  const ttl = await redisCommand<number>("PTTL", bucketKey);
  const retryAfterMs = Math.max(1, Number(ttl.value || config.windowMs));

  if (current > config.limit) {
    if (config.lockoutMs) {
      const blockedUntilAt = now + config.lockoutMs;
      await redisCommand("SET", lockKey, blockedUntilAt, "PX", config.lockoutMs);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: config.lockoutMs
      };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, config.limit - current),
    retryAfterMs
  };
}

function consumeRateLimitMemory(key: string, config: RateLimitConfig) {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    const fresh: Bucket = {
      count: 1,
      resetAt: now + config.windowMs,
      blockedUntil: 0
    };
    buckets.set(key, fresh);
    return {
      allowed: true,
      remaining: config.limit - 1,
      retryAfterMs: config.windowMs
    };
  }

  if (existing.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.blockedUntil - now
    };
  }

  existing.count += 1;
  if (existing.count > config.limit) {
    if (config.lockoutMs) {
      existing.blockedUntil = now + config.lockoutMs;
    }
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: config.lockoutMs || existing.resetAt - now
    };
  }

  return {
    allowed: true,
    remaining: config.limit - existing.count,
    retryAfterMs: existing.resetAt - now
  };
}

export async function consumeRateLimit(key: string, config: RateLimitConfig) {
  const redisResult = await consumeRateLimitRedis(key, config);
  if (redisResult) {
    return redisResult;
  }

  return consumeRateLimitMemory(key, config);
}
