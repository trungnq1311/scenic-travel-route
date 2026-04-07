'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ProcessedRoute } from '@/lib/pipeline/types';
import type { TripBriefView } from '@/lib/trip-brief/types';
import RouteSidebar, { getRouteColor } from '@/components/RouteSidebar';
import RouteMap from '@/components/RouteMap';
import BottomSheet from '@/components/BottomSheet';
import RouteCard from '@/components/RouteCard';
import TripBriefPanel from '@/components/TripBriefPanel';

function readErrorText(code: string | null, fallback: string): string {
  switch (code) {
    case 'invalid_link':
      return 'This trip brief link is invalid or removed.';
    case 'token_invalid':
      return 'This voting session is no longer valid.';
    case 'expired_trip':
      return 'Voting closed for this trip brief.';
    default:
      return fallback;
  }
}

export default function TripBriefPage() {
  const router = useRouter();
  const params = useParams<{ briefId: string }>();

  const [view, setView] = useState<TripBriefView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isUnlockPending, setIsUnlockPending] = useState(false);

  useEffect(() => {
    const fetchView = async () => {
      setIsLoading(true);
      setErrorCode(null);
      setErrorMessage(null);

      const response = await fetch(`/api/trip-brief/${params.briefId}`);
      const payload = await response.json();

      if (!response.ok) {
        setErrorCode(payload.code || 'unknown_error');
        setErrorMessage(payload.error || 'Could not load shared trip brief.');
        setView(null);
        setIsLoading(false);
        return;
      }

      setView(payload as TripBriefView);
      setIsLoading(false);
    };

    void fetchView();
  }, [params.briefId]);

  const routes = view?.brief.routesSnapshot || [];
  const sortedRoutes = useMemo(() => {
    const scenic = routes
      .filter((route) => !route.isBaseline)
      .sort((a, b) => a.detourRatio - b.detourRatio);
    const baseline = routes.filter((route) => route.isBaseline);
    return [...scenic, ...baseline];
  }, [routes]);

  const scenicIndexMap = useMemo(() => {
    const lookup: Record<string, number> = {};
    let idx = 0;
    for (const route of routes) {
      if (!route.isBaseline) {
        lookup[route.id] = idx++;
      }
    }
    return lookup;
  }, [routes]);

  const defaultRouteId = useMemo(() => {
    if (!sortedRoutes.length) return null;
    if (view?.brief.winningRouteId) return view.brief.winningRouteId;
    const firstScenic = sortedRoutes.find((route) => !route.isBaseline);
    return firstScenic?.id ?? sortedRoutes[0].id;
  }, [sortedRoutes, view]);

  const activeRouteId = selectedRouteId ?? defaultRouteId;

  const tripBriefState = useMemo(() => {
    if (isUnlockPending) return 'decision_unlock_pending' as const;
    if (isSubmittingVote) return 'submitting_vote' as const;
    if (!view) return 'empty' as const;
    if (view.brief.decisionLockedAt) return 'decision_locked' as const;
    if (view.brief.status === 'expired') return 'expired_trip' as const;
    if (errorCode) return 'load_error' as const;
    return 'ready' as const;
  }, [view, isSubmittingVote, isUnlockPending, errorCode]);

  const refresh = async () => {
    const response = await fetch(`/api/trip-brief/${params.briefId}`);
    const payload = await response.json();
    if (!response.ok) {
      setErrorCode(payload.code || 'unknown_error');
      setErrorMessage(payload.error || 'Could not refresh shared trip brief.');
      return;
    }
    setView(payload as TripBriefView);
    setErrorCode(null);
    setErrorMessage(null);
  };

  const castVote = async (routeId: string) => {
    setIsSubmittingVote(true);
    try {
      const response = await fetch(`/api/trip-brief/${params.briefId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setErrorCode(payload.code || 'unknown_error');
        setErrorMessage(payload.error || 'Could not cast vote.');
        return;
      }

      setView(payload as TripBriefView);
      setErrorCode(null);
      setErrorMessage(null);
    } catch {
      setErrorCode('network_error');
      setErrorMessage('Still syncing votes... this is taking longer than usual.');
    } finally {
      setIsSubmittingVote(false);
    }
  };

  const lockDecision = async () => {
    const response = await fetch(`/api/trip-brief/${params.briefId}/lock`, {
      method: 'POST',
    });
    const payload = await response.json();
    if (!response.ok) {
      setErrorCode(payload.code || 'unknown_error');
      setErrorMessage(payload.error || 'Could not lock decision.');
      return;
    }
    setView(payload as TripBriefView);
    setErrorCode(null);
    setErrorMessage(null);
  };

  const unlockDecision = async () => {
    setIsUnlockPending(true);
    try {
      const response = await fetch(`/api/trip-brief/${params.briefId}/lock`, {
        method: 'DELETE',
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrorCode(payload.code || 'unknown_error');
        setErrorMessage(payload.error || 'Could not unlock decision.');
        return;
      }
      setView(payload as TripBriefView);
      setErrorCode(null);
      setErrorMessage(null);
    } catch {
      setErrorCode('network_error');
      setErrorMessage('Still syncing votes... this is taking longer than usual.');
    } finally {
      setIsUnlockPending(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-600">
        Loading shared trip brief...
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-stone-800">Shared trip brief unavailable</h1>
          <p className="mt-2 text-sm text-stone-600">{readErrorText(errorCode, errorMessage || 'Could not load shared trip brief.')}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Go to home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-stone-500 transition-colors hover:text-stone-700"
          >
            &larr; New search
          </button>
          <h1 className="text-lg font-semibold text-stone-800">
            {view.brief.origin}
            <span className="mx-2 text-stone-400">&rarr;</span>
            {view.brief.destination}
          </h1>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        <div className="hidden lg:flex lg:w-[400px] lg:flex-col lg:border-r lg:border-stone-200">
          <RouteSidebar
            routes={routes}
            selectedRouteId={activeRouteId}
            onSelectRoute={setSelectedRouteId}
            footer={
              <TripBriefPanel
                routes={sortedRoutes}
                selectedRouteId={activeRouteId}
                tripBrief={view}
                state={tripBriefState}
                errorCode={errorCode}
                errorMessage={errorMessage}
                onVote={castVote}
                onLock={lockDecision}
                onUnlock={unlockDecision}
              />
            }
          />
        </div>

        <div className="flex-1">
          <RouteMap
            routes={routes}
            selectedRouteId={activeRouteId}
            onSelectRoute={setSelectedRouteId}
          />
        </div>

        <div className="lg:hidden">
          <BottomSheet>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-stone-700">
                {routes.filter((route) => !route.isBaseline).length} scenic route{routes.filter((route) => !route.isBaseline).length !== 1 ? 's' : ''} found
              </h2>
            </div>
            <div className="space-y-3">
              {sortedRoutes.map((route) => {
                const scenicIdx = scenicIndexMap[route.id] ?? 0;
                const color = getRouteColor(route, scenicIdx);
                return (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isSelected={route.id === activeRouteId}
                    onClick={() => setSelectedRouteId(route.id)}
                    color={color}
                  />
                );
              })}
            </div>

            <TripBriefPanel
              routes={sortedRoutes}
              selectedRouteId={activeRouteId}
              tripBrief={view}
              state={tripBriefState}
              errorCode={errorCode}
              errorMessage={errorMessage}
              onVote={castVote}
              onLock={lockDecision}
              onUnlock={unlockDecision}
            />
          </BottomSheet>
        </div>
      </div>
    </div>
  );
}
