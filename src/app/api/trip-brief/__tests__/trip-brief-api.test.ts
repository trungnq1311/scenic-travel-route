import { POST as createTripBrief } from '@/app/api/trip-brief/route';
import { GET as getTripBriefSummary } from '@/app/api/trip-brief/[briefId]/summary/route';
import { POST as castVote } from '@/app/api/trip-brief/[briefId]/vote/route';
import { DELETE as unlockDecision, POST as lockDecision } from '@/app/api/trip-brief/[briefId]/lock/route';
import { resetRateLimitStore } from '@/lib/security/rate-limit';
import { resetTripBriefStore } from '@/lib/trip-brief/store';
import * as tripBriefEvents from '@/lib/trip-brief/events';

function createPayload() {
  return {
    tripId: '11111111-1111-1111-1111-111111111111',
    origin: 'Ho Chi Minh City',
    destination: 'Vung Tau',
    routes: [
      {
        id: 'route_a',
        name: 'Route A',
        description: 'Scenic coast',
        vibeSummary: 'Coastal drive',
        primaryRoad: 'QL51',
        distanceKm: 100,
        durationMinutes: 120,
        baselineDurationMinutes: 100,
        detourRatio: 1.2,
        geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
        waypoints: [],
        scenicSegments: [{ name: 'Coastline', description: 'Ocean views' }],
        pois: [{ name: 'Cafe', type: 'cafe', lat: 10.6, lng: 107.0, description: 'Nice stop', placeId: 'p1', sources: ['google_places'] }],
        isBaseline: false,
      },
      {
        id: 'baseline',
        name: 'Fastest Route',
        description: 'Direct',
        vibeSummary: 'Direct route',
        primaryRoad: 'QL51',
        distanceKm: 90,
        durationMinutes: 100,
        baselineDurationMinutes: 100,
        detourRatio: 1,
        geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
        waypoints: [],
        scenicSegments: [],
        pois: [],
        isBaseline: true,
      },
    ],
    generationMeta: {
      totalElapsedMs: 1000,
      stages: [],
      sourcesUsed: ['youtube', 'tiktok'],
      llmModel: 'openai/gpt-oss-120b:free',
      detourCap: {
        chillLevel: 'none',
        maxDurationRatio: Infinity,
        routesFiltered: 0,
      },
    },
  };
}

function briefContext(briefId: string) {
  return { params: Promise.resolve({ briefId }) };
}

function cookieValueFromSetCookie(setCookie: string | null): string {
  if (!setCookie) return '';
  return setCookie.split(';')[0];
}

describe('trip brief API integration', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  beforeEach(async () => {
    await resetTripBriefStore();
    resetRateLimitStore();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('does not emit vote event on idempotent replay', async () => {
    const emitSpy = jest.spyOn(tripBriefEvents, 'emitTripBriefEvent').mockImplementation(() => undefined);

    const createResponse = await createTripBrief(
      new Request('http://localhost:3000/api/trip-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload()),
      }),
    );

    const created = await createResponse.json();
    const briefId = created.brief.briefId as string;
    const cookie = cookieValueFromSetCookie(createResponse.headers.get('set-cookie'));

    await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({ routeId: 'route_a', idempotencyKey: 'same-key' }),
      }),
      briefContext(briefId),
    );

    const callsAfterFirstVote = emitSpy.mock.calls.length;

    await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({ routeId: 'baseline', idempotencyKey: 'same-key' }),
      }),
      briefContext(briefId),
    );

    expect(emitSpy.mock.calls.length).toBe(callsAfterFirstVote);
  });

  test('does not emit lock event when lock is already in effect', async () => {
    const emitSpy = jest.spyOn(tripBriefEvents, 'emitTripBriefEvent').mockImplementation(() => undefined);

    const createResponse = await createTripBrief(
      new Request('http://localhost:3000/api/trip-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload()),
      }),
    );
    const created = await createResponse.json();
    const briefId = created.brief.briefId as string;
    const cookie = cookieValueFromSetCookie(createResponse.headers.get('set-cookie'));

    await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({ routeId: 'route_a', idempotencyKey: 'vote-key' }),
      }),
      briefContext(briefId),
    );

    await lockDecision(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/lock`, {
        method: 'POST',
        headers: { cookie },
      }),
      briefContext(briefId),
    );

    const lockEventsAfterFirstLock = emitSpy.mock.calls.filter(
      (call) => call[0]?.event === 'trip_decision_locked',
    ).length;

    await lockDecision(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/lock`, {
        method: 'POST',
        headers: { cookie },
      }),
      briefContext(briefId),
    );

    const lockEventsAfterReplay = emitSpy.mock.calls.filter(
      (call) => call[0]?.event === 'trip_decision_locked',
    ).length;

    expect(lockEventsAfterReplay).toBe(lockEventsAfterFirstLock);
  });

  test('keeps vote idempotent for repeated idempotency key', async () => {
    const createResponse = await createTripBrief(
      new Request('http://localhost:3000/api/trip-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload()),
      }),
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const briefId = created.brief.briefId as string;
    const cookie = cookieValueFromSetCookie(createResponse.headers.get('set-cookie'));

    const firstVoteResponse = await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({
          routeId: 'route_a',
          idempotencyKey: 'same-key',
        }),
      }),
      briefContext(briefId),
    );
    expect(firstVoteResponse.status).toBe(200);

    const secondVoteResponse = await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({
          routeId: 'baseline',
          idempotencyKey: 'same-key',
        }),
      }),
      briefContext(briefId),
    );
    expect(secondVoteResponse.status).toBe(200);

    const summaryResponse = await getTripBriefSummary(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/summary`),
      briefContext(briefId),
    );
    expect(summaryResponse.status).toBe(200);
    const summary = await summaryResponse.json();

    expect(summary.voteSummary.totalVotes).toBe(1);
    expect(summary.voteSummary.countsByRouteId.route_a).toBe(1);
    expect(summary.voteSummary.countsByRouteId.baseline).toBeUndefined();
  });

  test('allows same idempotency key on different briefs', async () => {
    const createResponseA = await createTripBrief(
      new Request('http://localhost:3000/api/trip-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload()),
      }),
    );
    const createdA = await createResponseA.json();
    const briefIdA = createdA.brief.briefId as string;
    const cookieA = cookieValueFromSetCookie(createResponseA.headers.get('set-cookie'));

    const createResponseB = await createTripBrief(
      new Request('http://localhost:3000/api/trip-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createPayload(), tripId: '22222222-2222-2222-2222-222222222222' }),
      }),
    );
    const createdB = await createResponseB.json();
    const briefIdB = createdB.brief.briefId as string;

    await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefIdA}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: cookieA,
        },
        body: JSON.stringify({ routeId: 'route_a', idempotencyKey: 'shared-key' }),
      }),
      briefContext(briefIdA),
    );

    const secondVoteResponse = await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefIdB}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: cookieA,
        },
        body: JSON.stringify({ routeId: 'baseline', idempotencyKey: 'shared-key' }),
      }),
      briefContext(briefIdB),
    );
    expect(secondVoteResponse.status).toBe(200);

    const summaryB = await getTripBriefSummary(
      new Request(`http://localhost:3000/api/trip-brief/${briefIdB}/summary`),
      briefContext(briefIdB),
    );
    expect(summaryB.status).toBe(200);
    const summaryBodyB = await summaryB.json();
    expect(summaryBodyB.voteSummary.totalVotes).toBe(1);
    expect(summaryBodyB.voteSummary.countsByRouteId.baseline).toBe(1);
  });

  test('allows unlock only within the 5-minute undo window', async () => {
    const now = new Date('2026-04-07T08:45:54.247Z').getTime();
    jest.useFakeTimers();
    jest.setSystemTime(now);

    const createResponse = await createTripBrief(
      new Request('http://localhost:3000/api/trip-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload()),
      }),
    );
    const created = await createResponse.json();
    const briefId = created.brief.briefId as string;
    const cookie = cookieValueFromSetCookie(createResponse.headers.get('set-cookie'));

    await castVote(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({
          routeId: 'route_a',
          idempotencyKey: 'vote-key',
        }),
      }),
      briefContext(briefId),
    );

    const lockResponse = await lockDecision(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/lock`, {
        method: 'POST',
        headers: { cookie },
      }),
      briefContext(briefId),
    );
    expect(lockResponse.status).toBe(200);

    const unlockWithinWindow = await unlockDecision(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/lock`, {
        method: 'DELETE',
        headers: { cookie },
      }),
      briefContext(briefId),
    );
    expect(unlockWithinWindow.status).toBe(200);

    await lockDecision(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/lock`, {
        method: 'POST',
        headers: { cookie },
      }),
      briefContext(briefId),
    );

    jest.setSystemTime(now + (5 * 60 * 1000) + 1);

    const unlockTooLate = await unlockDecision(
      new Request(`http://localhost:3000/api/trip-brief/${briefId}/lock`, {
        method: 'DELETE',
        headers: { cookie },
      }),
      briefContext(briefId),
    );

    expect(unlockTooLate.status).toBe(409);
    const body = await unlockTooLate.json();
    expect(body.code).toBe('unlock_window_expired');

    jest.useRealTimers();
  });
});
