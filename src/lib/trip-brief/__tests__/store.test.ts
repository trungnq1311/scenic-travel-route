import {
  castTripBriefVote,
  createTripBrief,
  getTripBriefSummary,
  getTripBriefView,
  issueVoterToken,
  lockTripBriefDecision,
  resetTripBriefStore,
  unlockTripBriefDecision,
  verifyVoterToken,
} from '../store';

const routesSnapshot = [
  {
    id: 'route_a',
    name: 'Route A',
    description: 'desc',
    vibeSummary: 'vibe',
    primaryRoad: 'QL1A',
    distanceKm: 100,
    durationMinutes: 120,
    baselineDurationMinutes: 100,
    detourRatio: 1.2,
    geometry: { type: 'LineString' as const, coordinates: [[106.7, 10.8], [107.1, 10.3]] },
    waypoints: [],
    scenicSegments: [],
    pois: [],
    isBaseline: false,
    confidence: 'high' as const,
  },
  {
    id: 'baseline',
    name: 'Baseline',
    description: 'desc',
    vibeSummary: 'vibe',
    primaryRoad: 'QL1A',
    distanceKm: 90,
    durationMinutes: 100,
    baselineDurationMinutes: 100,
    detourRatio: 1,
    geometry: { type: 'LineString' as const, coordinates: [[106.7, 10.8], [107.1, 10.3]] },
    waypoints: [],
    scenicSegments: [],
    pois: [],
    isBaseline: true,
    confidence: 'high' as const,
  },
];

describe('trip brief store', () => {
  const originalTokenSecret = process.env.TRIP_BRIEF_TOKEN_SECRET;

  beforeAll(() => {
    process.env.TRIP_BRIEF_TOKEN_SECRET = 'trip-brief-test-secret';
  });

  beforeEach(async () => {
    await resetTripBriefStore();
  });

  afterAll(() => {
    process.env.TRIP_BRIEF_TOKEN_SECRET = originalTokenSecret;
  });

  test('issues and verifies voter token', () => {
    const token = issueVoterToken();
    expect(verifyVoterToken(token)).toBe(true);
    expect(verifyVoterToken(`${token}broken`)).toBe(false);
  });

  test('throws when token secret missing outside test mode', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.TRIP_BRIEF_TOKEN_SECRET;
    process.env.NODE_ENV = 'development';

    expect(() => issueVoterToken()).toThrow('TRIP_BRIEF_TOKEN_SECRET environment variable is required');

    process.env.NODE_ENV = originalNodeEnv;
    process.env.TRIP_BRIEF_TOKEN_SECRET = 'trip-brief-test-secret';
  });

  test('creates brief, casts vote, supports revote, and summarizes', async () => {
    const token = issueVoterToken();

    const brief = await createTripBrief({
      tripId: 'trip-1',
      origin: 'HCM',
      destination: 'VT',
      routesSnapshot,
    });

    const initial = await getTripBriefView(brief.briefId, token, 'http://localhost:3000');
    expect(initial.voteSummary.totalVotes).toBe(0);
    expect(initial.readOnly).toBe(false);

    await castTripBriefVote({
      briefId: brief.briefId,
      voterToken: token,
      routeId: 'route_a',
      idempotencyKey: 'idemp-1',
    });

    const afterVote = await getTripBriefView(brief.briefId, token);
    expect(afterVote.userVoteRouteId).toBe('route_a');
    expect(afterVote.voteSummary.totalVotes).toBe(1);
    expect(afterVote.voteSummary.winnerRouteId).toBe('route_a');

    await castTripBriefVote({
      briefId: brief.briefId,
      voterToken: token,
      routeId: 'baseline',
      idempotencyKey: 'idemp-2',
    });

    const afterRevote = await getTripBriefView(brief.briefId, token);
    expect(afterRevote.userVoteRouteId).toBe('baseline');
    expect(afterRevote.voteSummary.totalVotes).toBe(1);
    expect(afterRevote.voteSummary.winnerRouteId).toBe('baseline');

    const summary = await getTripBriefSummary(brief.briefId);
    expect(summary.voteSummary.totalVotes).toBe(1);
    expect(summary.voteSummary.countsByRouteId.baseline).toBe(1);
  });

  test('supports idempotent vote writes', async () => {
    const token = issueVoterToken();
    const brief = await createTripBrief({
      tripId: 'trip-1',
      origin: 'HCM',
      destination: 'VT',
      routesSnapshot,
    });

    const first = await castTripBriefVote({
      briefId: brief.briefId,
      voterToken: token,
      routeId: 'route_a',
      idempotencyKey: 'same-key',
    });
    expect(first.mutationApplied).toBe(true);

    const second = await castTripBriefVote({
      briefId: brief.briefId,
      voterToken: token,
      routeId: 'baseline',
      idempotencyKey: 'same-key',
    });
    expect(second.mutationApplied).toBe(false);

    const view = await getTripBriefView(brief.briefId, token);
    expect(view.userVoteRouteId).toBe('route_a');
    expect(view.voteSummary.totalVotes).toBe(1);
  });

  test('applies idempotency key per brief scope', async () => {
    const token = issueVoterToken();
    const briefA = await createTripBrief({
      tripId: 'trip-a',
      origin: 'HCM',
      destination: 'VT',
      routesSnapshot,
    });
    const briefB = await createTripBrief({
      tripId: 'trip-b',
      origin: 'HCM',
      destination: 'Dalat',
      routesSnapshot,
    });

    await castTripBriefVote({
      briefId: briefA.briefId,
      voterToken: token,
      routeId: 'route_a',
      idempotencyKey: 'cross-brief-key',
    });

    await castTripBriefVote({
      briefId: briefB.briefId,
      voterToken: token,
      routeId: 'baseline',
      idempotencyKey: 'cross-brief-key',
    });

    const viewA = await getTripBriefView(briefA.briefId, token);
    const viewB = await getTripBriefView(briefB.briefId, token);

    expect(viewA.userVoteRouteId).toBe('route_a');
    expect(viewB.userVoteRouteId).toBe('baseline');
    expect(viewA.voteSummary.totalVotes).toBe(1);
    expect(viewB.voteSummary.totalVotes).toBe(1);
  });

  test('locks and unlocks decision within undo window', async () => {
    const token = issueVoterToken();
    const brief = await createTripBrief({
      tripId: 'trip-1',
      origin: 'HCM',
      destination: 'VT',
      routesSnapshot,
    });

    await castTripBriefVote({
      briefId: brief.briefId,
      voterToken: token,
      routeId: 'route_a',
      idempotencyKey: 'vote-1',
    });

    const locked = await lockTripBriefDecision({ briefId: brief.briefId, voterToken: token });
    expect(locked.lockApplied).toBe(true);
    expect(locked.view.readOnly).toBe(true);
    expect(locked.view.brief.winningRouteId).toBe('route_a');
    expect(locked.view.canUnlock).toBe(true);

    const unlocked = await unlockTripBriefDecision({ briefId: brief.briefId, voterToken: token });
    expect(unlocked.brief.decisionLockedAt).toBeNull();
    expect(unlocked.readOnly).toBe(false);
  });

  test('does not report lock applied when already locked', async () => {
    const token = issueVoterToken();
    const brief = await createTripBrief({
      tripId: 'trip-1',
      origin: 'HCM',
      destination: 'VT',
      routesSnapshot,
    });

    await castTripBriefVote({
      briefId: brief.briefId,
      voterToken: token,
      routeId: 'route_a',
      idempotencyKey: 'vote-1',
    });

    const firstLock = await lockTripBriefDecision({ briefId: brief.briefId, voterToken: token });
    expect(firstLock.lockApplied).toBe(true);

    const replayLock = await lockTripBriefDecision({ briefId: brief.briefId, voterToken: token });
    expect(replayLock.lockApplied).toBe(false);
  });
});
