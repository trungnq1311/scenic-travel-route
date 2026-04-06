interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  key: string;
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
}

const store = new Map<string, RateLimitEntry>();

function pruneExpired(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const now = Date.now();

  if (store.size > 1000) {
    pruneExpired(now);
  }

  const existing = store.get(config.key);
  if (!existing || existing.resetAt <= now) {
    store.set(config.key, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
      remaining: config.maxRequests - 1,
      limit: config.maxRequests,
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
      limit: config.maxRequests,
    };
  }

  existing.count += 1;
  store.set(config.key, existing);

  return {
    allowed: true,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    remaining: Math.max(0, config.maxRequests - existing.count),
    limit: config.maxRequests,
  };
}
