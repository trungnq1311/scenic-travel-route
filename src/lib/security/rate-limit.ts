import { createHash } from 'crypto';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const IPV4_WITH_OPTIONAL_PORT = /^((?:\d{1,3}\.){3}\d{1,3})(?::\d+)?$/;
const IPV6_WITH_OPTIONAL_BRACKETS = /^\[?([A-Fa-f0-9:]+)\]?$/;

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

export function resetRateLimitStore(): void {
  store.clear();
}

function pruneExpired(now: number): void {
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

function normalizeIp(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const ipv4Match = value.match(IPV4_WITH_OPTIONAL_PORT);
  if (ipv4Match?.[1]) {
    return ipv4Match[1];
  }

  const ipv6Match = value.match(IPV6_WITH_OPTIONAL_BRACKETS);
  if (ipv6Match?.[1] && ipv6Match[1].includes(':')) {
    return ipv6Match[1].toLowerCase();
  }

  return null;
}

function fromHeader(request: Request, headerName: string): string | null {
  const raw = request.headers.get(headerName);
  if (!raw) {
    return null;
  }

  const firstValue = raw.split(',')[0];
  return normalizeIp(firstValue);
}

function buildClientFingerprint(request: Request): string {
  const fingerprintSeed = [
    request.headers.get('user-agent')?.trim() ?? '',
    request.headers.get('accept-language')?.trim() ?? '',
    request.headers.get('sec-ch-ua')?.trim() ?? '',
    request.headers.get('sec-ch-ua-platform')?.trim() ?? '',
  ].join('|');

  if (!fingerprintSeed.replace(/\|/g, '')) {
    return 'fingerprint:anonymous';
  }

  const digest = createHash('sha256').update(fingerprintSeed).digest('hex').slice(0, 16);
  return `fingerprint:${digest}`;
}

export function extractClientIp(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') {
    return buildClientFingerprint(request);
  }

  const trustedHeaderIp =
    fromHeader(request, 'cf-connecting-ip') ||
    fromHeader(request, 'x-real-ip') ||
    fromHeader(request, 'x-vercel-forwarded-for');

  if (trustedHeaderIp) return trustedHeaderIp;

  return buildClientFingerprint(request);
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
