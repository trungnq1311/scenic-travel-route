import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
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
});
