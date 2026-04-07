import { NextResponse } from 'next/server';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { buildVoterTokenSetCookie, getVoterTokenFromCookieHeader } from '@/lib/trip-brief/cookies';
import { mapStoreError } from '@/lib/trip-brief/errors';
import { emitTripBriefEvent } from '@/lib/trip-brief/events';
import { issueVoterToken, lockTripBriefDecision, unlockTripBriefDecision } from '@/lib/trip-brief/store';

const LOCK_LIMIT = 10;
const LOCK_WINDOW_MS = 60_000;

export async function POST(request: Request, context: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await context.params;

  try {
    const rateLimit = checkRateLimit({
      key: `trip-brief:lock:${extractClientIp(request)}`,
      maxRequests: LOCK_LIMIT,
      windowMs: LOCK_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          code: 'rate_limited',
          error: 'Too many lock attempts. Try again in 60 seconds.',
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

    let voterToken = getVoterTokenFromCookieHeader(request.headers.get('cookie'));
    if (!voterToken) {
      voterToken = issueVoterToken();
    }

    const lockResult = await lockTripBriefDecision({ briefId, voterToken });

    if (lockResult.lockApplied) {
      emitTripBriefEvent({
        event: 'trip_decision_locked',
        payload: {
          briefId,
          winningRouteId: lockResult.view.brief.winningRouteId,
          lockAt: lockResult.view.brief.decisionLockedAt,
          voterCount: lockResult.view.voteSummary.totalVotes,
        },
      });
    }

    const response = NextResponse.json(lockResult.view, {
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

export async function DELETE(request: Request, context: { params: Promise<{ briefId: string }> }) {
  const { briefId } = await context.params;

  try {
    const rateLimit = checkRateLimit({
      key: `trip-brief:unlock:${extractClientIp(request)}`,
      maxRequests: LOCK_LIMIT,
      windowMs: LOCK_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          code: 'rate_limited',
          error: 'Too many unlock attempts. Try again in 60 seconds.',
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

    let voterToken = getVoterTokenFromCookieHeader(request.headers.get('cookie'));
    if (!voterToken) {
      voterToken = issueVoterToken();
    }

    const view = await unlockTripBriefDecision({ briefId, voterToken });

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
