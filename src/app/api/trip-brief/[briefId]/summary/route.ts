import { NextResponse } from 'next/server';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { mapStoreError } from '@/lib/trip-brief/errors';
import { getTripBriefSummary } from '@/lib/trip-brief/store';

const SUMMARY_LIMIT = 60;
const SUMMARY_WINDOW_MS = 60_000;

export async function GET(request: Request, context: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await context.params;

  try {
    const rateLimit = checkRateLimit({
      key: `trip-brief:summary:${extractClientIp(request)}`,
      maxRequests: SUMMARY_LIMIT,
      windowMs: SUMMARY_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please retry later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        },
      );
    }

    const summary = await getTripBriefSummary(briefId);
    return NextResponse.json(summary, {
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
  } catch (error) {
    const mapped = mapStoreError(error);
    return NextResponse.json({ code: mapped.code, error: mapped.error }, { status: mapped.status });
  }
}
