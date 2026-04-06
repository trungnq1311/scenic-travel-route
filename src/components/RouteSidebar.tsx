'use client';

import { useMemo } from 'react';
import type { ProcessedRoute } from '@/lib/pipeline/types';
import RouteCard from './RouteCard';

const SCENIC_COLORS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#8b5cf6', // purple
  '#10b981', // green
  '#14b8a6', // teal
];

const BASELINE_COLOR = '#9ca3af';

export interface RouteSidebarProps {
  routes: ProcessedRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
}

export function getRouteColor(
  route: ProcessedRoute,
  scenicIndex: number,
): string {
  if (route.isBaseline) return BASELINE_COLOR;
  return SCENIC_COLORS[scenicIndex % SCENIC_COLORS.length];
}

export default function RouteSidebar({
  routes,
  selectedRouteId,
  onSelectRoute,
}: RouteSidebarProps) {
  // Sort: scenic routes by detourRatio ascending, baseline always last
  const sortedRoutes = useMemo(() => {
    const scenic = routes
      .filter((r) => !r.isBaseline)
      .sort((a, b) => a.detourRatio - b.detourRatio);
    const baseline = routes.filter((r) => r.isBaseline);
    return [...scenic, ...baseline];
  }, [routes]);

  // Build scenic index lookup for color assignment
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

  const scenicCount = routes.filter((r) => !r.isBaseline).length;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-stone-700">
          {scenicCount} scenic route{scenicCount !== 1 ? 's' : ''} found
        </h2>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sortedRoutes.map((route) => {
          const scenicIdx = scenicIndexMap[route.id] ?? 0;
          const color = getRouteColor(route, scenicIdx);
          return (
            <RouteCard
              key={route.id}
              route={route}
              isSelected={route.id === selectedRouteId}
              onClick={() => onSelectRoute(route.id)}
              color={color}
            />
          );
        })}
      </div>
    </div>
  );
}
