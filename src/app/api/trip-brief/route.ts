import { NextResponse } from 'next/server';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { evaluateRouteConfidence } from '@/lib/trip-brief/confidence';
import { buildVoterTokenSetCookie, getVoterTokenFromCookieHeader } from '@/lib/trip-brief/cookies';
import { emitTripBriefEvent } from '@/lib/trip-brief/events';
import { createTripBrief, getTripBriefView, issueVoterToken } from '@/lib/trip-brief/store';
import { validateCreateTripBriefRequest } from '@/lib/trip-brief/validation';

const CREATE_LIMIT = 20;
const CREATE_WINDOW_MS = 60_000;

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: `trip-brief:create:${extractClientIp(request)}`,
      maxRequests: CREATE_LIMIT,
      windowMs: CREATE_WINDOW_MS,
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

    const body: unknown = await request.json();
    const validation = validateCreateTripBriefRequest(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const source = validation.value;
    const routesSnapshot = source.routes.map((route) => ({
      ...route,
      confidence: evaluateRouteConfidence(route),
    }));

    const created = await createTripBrief({
      tripId: source.tripId,
      origin: source.origin,
      destination: source.destination,
      routesSnapshot,
    });

    let voterToken = getVoterTokenFromCookieHeader(request.headers.get('cookie'));
    if (!voterToken) {
      voterToken = issueVoterToken();
    }

    const view = await getTripBriefView(created.briefId, voterToken, getBaseUrl(request));

    emitTripBriefEvent({
      event: 'trip_brief_created',
      payload: {
        briefId: created.briefId,
        tripId: created.tripId,
        routeCount: created.routesSnapshot.length,
        createdAt: created.createdAt,
      },
    });

    const response = NextResponse.json(view, {
      status: 201,
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });

    response.headers.set('Set-Cookie', buildVoterTokenSetCookie(voterToken));

    return response;
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(`[trip-brief:create] failed (${requestId}):`, error);
    return NextResponse.json(
      {
        error: 'Trip brief creation failed',
        requestId,
      },
      { status: 500 },
    );
  }
}
