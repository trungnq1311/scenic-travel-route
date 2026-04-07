import { checkRateLimit, extractClientIp } from '../rate-limit';

describe('checkRateLimit', () => {
  const originalTrustProxyHeaders = process.env.TRUST_PROXY_HEADERS;

  beforeEach(() => {
    delete process.env.TRUST_PROXY_HEADERS;
  });

  afterAll(() => {
    process.env.TRUST_PROXY_HEADERS = originalTrustProxyHeaders;
  });

  test('allows requests under limit then blocks', () => {
    const key = `test-limit-${Date.now()}`;

    const r1 = checkRateLimit({ key, maxRequests: 2, windowMs: 10_000 });
    const r2 = checkRateLimit({ key, maxRequests: 2, windowMs: 10_000 });
    const r3 = checkRateLimit({ key, maxRequests: 2, windowMs: 10_000 });

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('uses separate counters per key', () => {
    const keyA = `key-a-${Date.now()}`;
    const keyB = `key-b-${Date.now()}`;

    const a1 = checkRateLimit({ key: keyA, maxRequests: 1, windowMs: 10_000 });
    const a2 = checkRateLimit({ key: keyA, maxRequests: 1, windowMs: 10_000 });
    const b1 = checkRateLimit({ key: keyB, maxRequests: 1, windowMs: 10_000 });

    expect(a1.allowed).toBe(true);
    expect(a2.allowed).toBe(false);
    expect(b1.allowed).toBe(true);
  });

  test('ignores proxy headers unless explicitly trusted', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });

    expect(extractClientIp(request)).toBe('unknown');
  });

  test('does not trust x-forwarded-for even when proxy headers are enabled', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.1.1.1, 10.0.0.8' },
    });

    expect(extractClientIp(request)).toBe('unknown');
  });

  test('prefers trusted provider headers over forwarded chain', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.1.1.1, 10.0.0.8',
        'x-vercel-forwarded-for': '203.0.113.9',
      },
    });

    expect(extractClientIp(request)).toBe('203.0.113.9');
  });
});
