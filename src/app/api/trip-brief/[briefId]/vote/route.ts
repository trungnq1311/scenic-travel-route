import { NextResponse } from 'next/server';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { buildVoterTokenSetCookie, getVoterTokenFromCookieHeader } from '@/lib/trip-brief/cookies';
import { mapStoreError, mapValidationError } from '@/lib/trip-brief/errors';
import { emitTripBriefEvent } from '@/lib/trip-brief/events';
import { castTripBriefVote, getTripBriefView, issueVoterToken } from '@/lib/trip-brief/store';
import { validateVoteRequest } from '@/lib/trip-brief/validation';

const VOTE_LIMIT = 5;
const VOTE_WINDOW_MS = 60_000;

function resolveIdempotencyKey(raw: string | null): string {
  if (raw) return raw;
  return crypto.randomUUID();
}

export async function POST(request: Request, context: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await context.params;

  try {
    const rateLimit = checkRateLimit({
      key: `trip-brief:vote:${extractClientIp(request)}`,
      maxRequests: VOTE_LIMIT,
      windowMs: VOTE_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          code: 'rate_limited',
          error: 'Too many vote attempts. Try again in 60 seconds.',
        },
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

    const body: unknown = await request.json();
    const validation = validateVoteRequest(body);
    if (!validation.ok) {
      const mapped = mapValidationError(validation.error);
      return NextResponse.json({ code: mapped.code, error: mapped.error }, { status: mapped.status });
    }

    let voterToken = getVoterTokenFromCookieHeader(request.headers.get('cookie'));
    if (!voterToken) {
      voterToken = issueVoterToken();
    }

    const previousView = await getTripBriefView(briefId, voterToken);

    const view = await castTripBriefVote({
      briefId,
      voterToken,
      routeId: validation.value.routeId,
      idempotencyKey: resolveIdempotencyKey(validation.value.idempotencyKey),
    });

    emitTripBriefEvent({
      event: 'trip_vote_cast',
      payload: {
        briefId,
        routeId: validation.value.routeId,
        castAt: new Date().toISOString(),
        isRevote:
          previousView.userVoteRouteId !== null &&
          previousView.userVoteRouteId !== validation.value.routeId,
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
