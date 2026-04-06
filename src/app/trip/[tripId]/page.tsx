'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useRouteGeneration } from '@/hooks/useRouteGeneration';
import ProgressStepper from '@/components/ProgressStepper';
import RouteMap from '@/components/RouteMap';
import RouteSidebar from '@/components/RouteSidebar';
import BottomSheet from '@/components/BottomSheet';
import RouteCard from '@/components/RouteCard';
import { getRouteColor } from '@/components/RouteSidebar';
import type { ProcessedRoute } from '@/lib/pipeline/types';

function TripContent() {
  const params = useParams<{ tripId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const origin = searchParams.get('origin') || '';
  const destination = searchParams.get('destination') || '';
  const chillLevel = searchParams.get('chillLevel') || undefined;

  const isNewTrip = params.tripId === 'new';

  const { status, stages, result, error, retry } = useRouteGeneration({
    origin: isNewTrip ? origin : '',
    destination: isNewTrip ? destination : '',
    chillLevel,
  });

  // Interstitial: show "Found N scenic routes!" for 1.5s before revealing map
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (status === 'complete' && result) {
      const timer = setTimeout(() => {
        setShowResults(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
    // Reset when status changes away from complete (e.g. on retry)
    setShowResults(false);
  }, [status, result]);

  const defaultRouteId = useMemo(() => {
    if (!result?.routes.length) return null;
    const firstScenic = result.routes.find((r) => !r.isBaseline);
    return firstScenic?.id ?? result.routes[0].id;
  }, [result]);

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const activeRouteId = selectedRouteId ?? defaultRouteId;

  // Sort routes for mobile bottom sheet: scenic by detourRatio ascending, baseline last
  const sortedRoutes = useMemo(() => {
    if (!result?.routes.length) return [];
    const scenic = result.routes
      .filter((r: ProcessedRoute) => !r.isBaseline)
      .sort((a: ProcessedRoute, b: ProcessedRoute) => a.detourRatio - b.detourRatio);
    const baseline = result.routes.filter((r: ProcessedRoute) => r.isBaseline);
    return [...scenic, ...baseline];
  }, [result]);

  // Build scenic index lookup for color assignment in mobile cards
  const scenicIndexMap = useMemo(() => {
    if (!result?.routes.length) return {};
    const lookup: Record<string, number> = {};
    let idx = 0;
    for (const route of result.routes) {
      if (!route.isBaseline) {
        lookup[route.id] = idx++;
      }
    }
    return lookup;
  }, [result]);

  const scenicCount = result?.routes.filter((r: ProcessedRoute) => !r.isBaseline).length ?? 0;

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-stone-500 transition-colors hover:text-stone-700"
          >
            &larr; New search
          </button>
          <h1 className="text-lg font-semibold text-stone-800">
            {origin}
            <span className="mx-2 text-stone-400">&rarr;</span>
            {destination}
          </h1>
        </div>
      </header>

      {/* Generating states: show progress stepper centered */}
      {(status === 'connecting' || status === 'generating' || status === 'error') && (
        <main className="flex flex-1 flex-col items-center px-6 py-12">
          <div className="flex w-full max-w-sm flex-col items-center">
            <h2 className="mb-6 text-base font-medium text-stone-600">
              Planning your scenic route...
            </h2>
            <ProgressStepper
              stages={stages}
              status={status}
              error={error}
              onRetry={retry}
            />
          </div>
        </main>
      )}

      {/* Interstitial: brief "Found N routes!" before map reveal */}
      {status === 'complete' && result && !showResults && (
        <main className="flex flex-1 flex-col items-center justify-center px-6">
          <div
            className="flex flex-col items-center gap-3"
            style={{ animation: 'fadeInUp 0.5s ease-out' }}
          >
            <svg className="h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-xl font-semibold text-stone-800">
              {scenicCount > 0
                ? `Found ${scenicCount} scenic route${scenicCount !== 1 ? 's' : ''}!`
                : 'Route found!'}
            </h2>
          </div>
        </main>
      )}

      {/* Complete: show sidebar + map layout */}
      {status === 'complete' && result && showResults && (
        <div className="relative flex flex-1 overflow-hidden">
          {/* Empty state banner when no scenic alternatives */}
          {scenicCount === 0 && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-amber-50 border-b border-amber-200 px-6 py-3 text-center">
              <p className="text-sm text-amber-700">
                No scenic alternatives found. Here&apos;s the fastest route.
              </p>
            </div>
          )}
          {/* Desktop sidebar */}
          <div className="hidden lg:flex lg:w-[400px] lg:flex-col lg:border-r lg:border-stone-200">
            <RouteSidebar
              routes={result.routes}
              selectedRouteId={activeRouteId}
              onSelectRoute={setSelectedRouteId}
            />
          </div>

          {/* Map */}
          <div className="flex-1">
            <RouteMap
              routes={result.routes}
              selectedRouteId={activeRouteId}
              onSelectRoute={setSelectedRouteId}
            />
          </div>

          {/* Mobile bottom sheet */}
          <div className="lg:hidden">
            <BottomSheet>
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-stone-700">
                  {scenicCount} scenic route{scenicCount !== 1 ? 's' : ''} found
                </h2>
              </div>
              <div className="space-y-3">
                {sortedRoutes.map((route: ProcessedRoute) => {
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
            </BottomSheet>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TripPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-stone-500">Loading...</div>}>
      <TripContent />
    </Suspense>
  );
}
