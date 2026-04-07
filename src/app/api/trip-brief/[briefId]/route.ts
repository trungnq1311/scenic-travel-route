import { NextResponse } from 'next/server';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { buildVoterTokenSetCookie, getVoterTokenFromCookieHeader } from '@/lib/trip-brief/cookies';
import { emitTripBriefEvent } from '@/lib/trip-brief/events';
import { mapStoreError } from '@/lib/trip-brief/errors';
import { getTripBriefView, issueVoterToken } from '@/lib/trip-brief/store';

const READ_LIMIT = 60;
const READ_WINDOW_MS = 60_000;

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request, context: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await context.params;

  try {
    const rateLimit = checkRateLimit({
      key: `trip-brief:read:${extractClientIp(request)}`,
      maxRequests: READ_LIMIT,
      windowMs: READ_WINDOW_MS,
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

    let voterToken = getVoterTokenFromCookieHeader(request.headers.get('cookie'));
    if (!voterToken) {
      voterToken = issueVoterToken();
    }

    const view = await getTripBriefView(briefId, voterToken, getBaseUrl(request));

    emitTripBriefEvent({
      event: 'trip_brief_viewed',
      payload: {
        briefId,
        viewedAt: new Date().toISOString(),
        deviceType: request.headers.get('user-agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      },
    });

    const response = NextResponse.json(view, {
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
    response.headers.set('Set-Cookie', buildVoterTokenSetCookie(voterToken));
    return response;
  } catch (error) {
    const mapped = mapStoreError(error);
    return NextResponse.json({ code: mapped.code, error: mapped.error }, { status: mapped.status });
  }
}
