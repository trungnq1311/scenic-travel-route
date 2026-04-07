import { test, expect } from '@playwright/test';

const STUB_TRIP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const STUB_GENERATE_RESPONSE = {
  tripId: STUB_TRIP_ID,
  origin: 'Ho Chi Minh City',
  destination: 'Vung Tau',
  routes: [
    {
      id: 'route_a',
      name: 'Scenic Coastal Route',
      description: 'Ocean views and cafe stops',
      vibeSummary: 'Coastal chill drive with scenic pull-offs',
      primaryRoad: 'QL51',
      distanceKm: 100,
      durationMinutes: 120,
      baselineDurationMinutes: 100,
      detourRatio: 1.2,
      geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
      waypoints: [
        { name: 'Ho Chi Minh City', lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' },
        { name: 'Vung Tau', lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
      ],
      scenicSegments: [{ name: 'Coastal Segment', description: 'Sea-facing road' }],
      pois: [
        {
          name: 'Beach Cafe',
          lat: 10.5,
          lng: 106.95,
          type: 'cafe',
          description: 'Popular stop',
          placeId: 'poi-1',
          sources: ['google_places'],
        },
      ],
      isBaseline: false,
    },
    {
      id: 'baseline',
      name: 'Fastest Route (Baseline)',
      description: 'Direct fastest route',
      vibeSummary: 'Direct and quick',
      primaryRoad: 'QL51',
      distanceKm: 90,
      durationMinutes: 100,
      baselineDurationMinutes: 100,
      detourRatio: 1,
      geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
      waypoints: [
        { name: 'Ho Chi Minh City', lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' },
        { name: 'Vung Tau', lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
      ],
      scenicSegments: [],
      pois: [],
      isBaseline: true,
    },
  ],
  generationMeta: {
    totalElapsedMs: 1500,
    stages: [
      { name: 'gather', status: 'success', elapsedMs: 100 },
      { name: 'extract', status: 'success', elapsedMs: 100 },
      { name: 'geocode', status: 'success', elapsedMs: 100 },
      { name: 'route', status: 'success', elapsedMs: 100 },
      { name: 'pois', status: 'success', elapsedMs: 100 },
      { name: 'synthesize', status: 'success', elapsedMs: 100 },
    ],
    sourcesUsed: ['youtube', 'tiktok'],
    llmModel: 'qwen/qwen3.6-plus:free',
    detourCap: {
      chillLevel: 'none',
      maxDurationRatio: Number.MAX_SAFE_INTEGER,
      routesFiltered: 0,
    },
  },
};

test('share -> vote -> lock happy path', async ({ page }) => {
  await page.addInitScript(() => {
    const originalEventSource = window.EventSource;

    class MockEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;

      url: string;
      readyState = 1;
      withCredentials = false;
      onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
      onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
      onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
      private listeners: Record<string, Array<(event: MessageEvent) => void>> = {};

      constructor(url: string) {
        this.url = url;

        setTimeout(() => {
          const stageNames = ['gather', 'extract', 'geocode', 'route', 'pois', 'synthesize'];
          for (const name of stageNames) {
            this.emit('stage', {
              name,
              status: 'success',
              elapsedMs: 100,
            });
          }

          this.emit('complete', {
            tripId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            origin: 'Ho Chi Minh City',
            destination: 'Vung Tau',
            routes: [
              {
                id: 'route_a',
                name: 'Scenic Coastal Route',
                description: 'Ocean views and cafe stops',
                vibeSummary: 'Coastal chill drive with scenic pull-offs',
                primaryRoad: 'QL51',
                distanceKm: 100,
                durationMinutes: 120,
                baselineDurationMinutes: 100,
                detourRatio: 1.2,
                geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
                waypoints: [
                  { name: 'Ho Chi Minh City', lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' },
                  { name: 'Vung Tau', lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
                ],
                scenicSegments: [{ name: 'Coastal Segment', description: 'Sea-facing road' }],
                pois: [
                  {
                    name: 'Beach Cafe',
                    lat: 10.5,
                    lng: 106.95,
                    type: 'cafe',
                    description: 'Popular stop',
                    placeId: 'poi-1',
                    sources: ['google_places'],
                  },
                ],
                isBaseline: false,
              },
              {
                id: 'baseline',
                name: 'Fastest Route (Baseline)',
                description: 'Direct fastest route',
                vibeSummary: 'Direct and quick',
                primaryRoad: 'QL51',
                distanceKm: 90,
                durationMinutes: 100,
                baselineDurationMinutes: 100,
                detourRatio: 1,
                geometry: { type: 'LineString', coordinates: [[106.7, 10.8], [107.1, 10.3]] },
                waypoints: [
                  { name: 'Ho Chi Minh City', lat: 10.8, lng: 106.7, source: 'google', confidence: 'high' },
                  { name: 'Vung Tau', lat: 10.3, lng: 107.1, source: 'google', confidence: 'high' },
                ],
                scenicSegments: [],
                pois: [],
                isBaseline: true,
              },
            ],
            generationMeta: {
              totalElapsedMs: 1500,
              stages: [],
              sourcesUsed: ['youtube', 'tiktok'],
              llmModel: 'qwen/qwen3.6-plus:free',
              detourCap: {
                chillLevel: 'none',
                maxDurationRatio: Number.MAX_SAFE_INTEGER,
                routesFiltered: 0,
              },
            },
          });
          this.close();
        }, 30);
      }

      addEventListener(type: string, listener: (event: MessageEvent) => void): void {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(listener);
      }

      removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
        const items = this.listeners[type];
        if (!items) return;
        this.listeners[type] = items.filter((l) => l !== listener);
      }

      dispatchEvent(): boolean {
        return true;
      }

      close(): void {
        this.readyState = 2;
      }

      private emit(type: string, payload: unknown): void {
        const event = new MessageEvent(type, { data: JSON.stringify(payload) });
        const items = this.listeners[type] || [];
        for (const item of items) item(event);
      }
    }

    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: MockEventSource,
    });

    window.addEventListener('beforeunload', () => {
      Object.defineProperty(window, 'EventSource', {
        configurable: true,
        writable: true,
        value: originalEventSource,
      });
    });
  });

  await page.route('**/api/trip-brief', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'trip_voter_token=test-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
      },
      body: JSON.stringify({
        brief: {
          briefId: 'brief-1',
          tripId: STUB_TRIP_ID,
          origin: 'Ho Chi Minh City',
          destination: 'Vung Tau',
          routesSnapshot: STUB_GENERATE_RESPONSE.routes.map((route) => ({
            ...route,
            confidence: route.id === 'route_a' ? 'high' : 'medium',
          })),
          createdAt: '2026-04-07T08:00:00.000Z',
          expiresAt: '2026-04-21T08:00:00.000Z',
          status: 'active',
          decisionLockedAt: null,
          lockedByTokenHash: null,
          winningRouteId: null,
        },
        voteSummary: {
          countsByRouteId: {},
          totalVotes: 0,
          winnerRouteId: null,
        },
        userVoteRouteId: null,
        shareUrl: 'http://localhost:3000/trip-brief/brief-1',
        readOnly: false,
        canUnlock: false,
        lockUndoExpiresAt: null,
      }),
    });
  });

  await page.route('**/api/trip-brief/brief-1/vote', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        brief: {
          briefId: 'brief-1',
          tripId: STUB_TRIP_ID,
          origin: 'Ho Chi Minh City',
          destination: 'Vung Tau',
          routesSnapshot: STUB_GENERATE_RESPONSE.routes.map((route) => ({
            ...route,
            confidence: route.id === 'route_a' ? 'high' : 'medium',
          })),
          createdAt: '2026-04-07T08:00:00.000Z',
          expiresAt: '2026-04-21T08:00:00.000Z',
          status: 'active',
          decisionLockedAt: null,
          lockedByTokenHash: null,
          winningRouteId: null,
        },
        voteSummary: {
          countsByRouteId: { route_a: 1 },
          totalVotes: 1,
          winnerRouteId: 'route_a',
        },
        userVoteRouteId: 'route_a',
        shareUrl: 'http://localhost:3000/trip-brief/brief-1',
        readOnly: false,
        canUnlock: false,
        lockUndoExpiresAt: null,
      }),
    });
  });

  await page.route('**/api/trip-brief/brief-1/lock', async (route) => {
    const method = route.request().method();
    if (method !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        brief: {
          briefId: 'brief-1',
          tripId: STUB_TRIP_ID,
          origin: 'Ho Chi Minh City',
          destination: 'Vung Tau',
          routesSnapshot: STUB_GENERATE_RESPONSE.routes.map((route) => ({
            ...route,
            confidence: route.id === 'route_a' ? 'high' : 'medium',
          })),
          createdAt: '2026-04-07T08:00:00.000Z',
          expiresAt: '2026-04-21T08:00:00.000Z',
          status: 'active',
          decisionLockedAt: '2026-04-07T08:10:00.000Z',
          lockedByTokenHash: 'hash',
          winningRouteId: 'route_a',
        },
        voteSummary: {
          countsByRouteId: { route_a: 1 },
          totalVotes: 1,
          winnerRouteId: 'route_a',
        },
        userVoteRouteId: 'route_a',
        shareUrl: 'http://localhost:3000/trip-brief/brief-1',
        readOnly: true,
        canUnlock: true,
        lockUndoExpiresAt: '2026-04-07T08:15:00.000Z',
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Origin').fill('Ho Chi Minh City');
  await page.getByLabel('Destination').fill('Vung Tau');
  await page.getByRole('button', { name: 'Discover Routes' }).click();

  await expect(page.getByRole('heading', { name: 'Trip Brief' }).first()).toBeVisible();
  await expect(page.getByText('Anyone with this link can view and vote for 14 days.').first()).toBeVisible();

  await page.getByRole('button', { name: /Vote for Scenic Coastal Route/i }).first().click();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Lock decision' }).first().click({ force: true });
  await expect(page.getByText(/Decision locked\./i).first()).toBeVisible();
});
