'use client';

import { useState } from 'react';
import type { ProcessedRoute } from '@/lib/pipeline/types';

export interface RouteCardProps {
  route: ProcessedRoute;
  isSelected: boolean;
  onClick: () => void;
  color: string;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

export default function RouteCard({
  route,
  isSelected,
  onClick,
  color,
}: RouteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    onClick();
    setExpanded((prev) => (isSelected ? !prev : true));
  };

  const isExpanded = isSelected && expanded;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full cursor-pointer text-left rounded-lg border transition-all duration-150 ${
        isSelected
          ? 'border-stone-300 shadow-md'
          : 'border-stone-200 shadow-none hover:border-stone-300'
      } ${route.isBaseline && !isSelected ? 'bg-stone-50' : 'bg-white'}`}
      style={
        isSelected
          ? { borderLeftWidth: '4px', borderLeftColor: color }
          : undefined
      }
    >
      <div className="px-4 py-3">
        {/* Route name + primary road badge */}
        <div className="flex items-center gap-2">
          <span
            className={`font-semibold text-sm ${
              route.isBaseline ? 'text-stone-500' : 'text-stone-800'
            }`}
          >
            {route.name}
          </span>
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
            {route.primaryRoad}
          </span>
        </div>

        {/* Duration + distance */}
        <div className="mt-1.5 flex items-center gap-3 text-xs text-stone-600">
          <span>{formatDuration(route.durationMinutes)}</span>
          <span className="text-stone-300">·</span>
          <span>{formatDistance(route.distanceKm)}</span>
        </div>

        {route.isBaseline ? (
          /* Baseline: "Fastest Route" label */
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-500">
              Fastest Route
            </span>
          </div>
        ) : (
          <>
            {/* Detour + scenic badges */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                {route.detourRatio.toFixed(1)}x longer
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                {route.scenicSegments.length} scenic
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {route.pois.length} stops
              </span>
            </div>

            {/* Vibe summary */}
            <p
              className={`mt-2 text-xs leading-relaxed text-stone-500 ${
                isExpanded ? '' : 'line-clamp-2'
              }`}
            >
              {route.vibeSummary}
            </p>
          </>
        )}

        {/* Expanded details */}
        {isExpanded && !route.isBaseline && (
          <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
            {route.scenicSegments.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-stone-600">
                  Scenic Segments
                </h4>
                <ul className="mt-1 space-y-0.5">
                  {route.scenicSegments.map((seg, i) => (
                    <li key={i} className="text-xs text-stone-500">
                      {seg.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {route.pois.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-stone-600">
                  Points of Interest
                </h4>
                <ul className="mt-1 space-y-0.5">
                  {route.pois.map((poi, i) => (
                    <li key={i} className="text-xs text-stone-500">
                      {poi.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
