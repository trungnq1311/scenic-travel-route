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

function calculateScenicScore(route: ProcessedRoute): string {
  const poiScore = Math.min(route.pois.length * 0.5, 3);
  const segmentScore = Math.min(route.scenicSegments.length * 0.8, 4);
  const corroboratedBonus = route.scenicSegments.filter((s) => s.corroborated).length * 0.3;
  return Math.min(10, (poiScore + segmentScore + corroboratedBonus + 5)).toFixed(1);
}

function getVibeTag(vibeSummary: string): string {
  const lower = vibeSummary.toLowerCase();
  if (lower.includes('beach') || lower.includes('coast') || lower.includes('sea')) return 'Beach & Coast';
  if (lower.includes('mountain') || lower.includes('pass') || lower.includes('hills')) return 'Mountain';
  if (lower.includes('forest') || lower.includes('rice') || lower.includes('countryside')) return 'Rural & Nature';
  if (lower.includes('city') || lower.includes('urban')) return 'City & Culture';
  if (lower.includes('lake') || lower.includes('river')) return 'Lakeside';
  return 'Scenic';
}

function getPreviewGradient(isBaseline: boolean): string {
  if (isBaseline) return 'bg-gradient-to-br from-stone-300 to-stone-400';
  return 'bg-gradient-to-br from-teal-400 via-teal-500 to-amber-400';
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
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
  const scenicScore = calculateScenicScore(route);
  const vibeTag = getVibeTag(route.vibeSummary);
  const photoCount = Math.min(route.pois.length, 6);
  const detourExtra = Math.round(route.durationMinutes - route.baselineDurationMinutes);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full cursor-pointer text-left rounded-xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'border-stone-300 shadow-lg ring-2 ring-amber-200'
          : 'border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300 hover:-translate-y-0.5'
      } ${route.isBaseline && !isSelected ? 'bg-stone-50' : 'bg-white'}`}
    >
      {/* Preview Header */}
      <div className={`relative h-24 ${getPreviewGradient(route.isBaseline)}`}>
        {/* Scenic Score Badge */}
        {!route.isBaseline && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm">
            <span className="font-bold text-amber-600">{scenicScore}</span>
            <span className="text-stone-600">Scenic</span>
          </div>
        )}

        {/* Vibe Tag */}
        <div className="absolute bottom-3 left-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">
          {vibeTag}
        </div>

        {/* Baseline Badge */}
        {route.isBaseline && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-stone-600 shadow-sm backdrop-blur-sm">
            Fastest Route
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Route name + primary road */}
        <div className="flex items-center gap-2">
          <h3 className={`font-display font-bold text-base truncate ${
            route.isBaseline ? 'text-stone-500' : 'text-stone-800'
          }`}>
            {route.name}
          </h3>
        </div>

        {/* Stats row */}
        <div className="mt-1.5 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-stone-600">
            <ClockIcon />
            <span>{formatDuration(route.durationMinutes)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-600">
            <MapPinIcon />
            <span>{formatDistance(route.distanceKm)}</span>
          </div>
          {!route.isBaseline && (
            <span className="text-xs text-amber-600 font-medium">
              +{detourExtra > 0 ? `${detourExtra}min` : 'baseline'}
            </span>
          )}
        </div>

        {/* Badges */}
        {!route.isBaseline && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {route.scenicSegments.slice(0, 3).map((seg, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
              >
                {seg.name.length > 20 ? seg.name.slice(0, 20) + '...' : seg.name}
              </span>
            ))}
            {route.scenicSegments.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                +{route.scenicSegments.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Vibe summary */}
        <p
          className={`mt-2 text-sm leading-relaxed text-stone-500 ${
            isExpanded ? '' : 'line-clamp-2'
          }`}
        >
          {route.vibeSummary}
        </p>

        {/* Scenic photos indicator */}
        {!route.isBaseline && photoCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-600 w-fit">
            <CameraIcon />
            <span>{photoCount} scenic photos on map</span>
          </div>
        )}

        {/* Expanded details */}
        {isExpanded && !route.isBaseline && (
          <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
            {route.pois.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                  Points of Interest
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {route.pois.slice(0, 6).map((poi, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700"
                    >
                      {poi.name}
                    </span>
                  ))}
                  {route.pois.length > 6 && (
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                      +{route.pois.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {route.scenicSegments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-2">
                  Scenic Segments
                </h4>
                <ul className="space-y-1">
                  {route.scenicSegments.map((seg, i) => (
                    <li key={i} className="text-sm text-stone-600 flex items-start gap-2">
                      <span className="text-teal-500 mt-1">•</span>
                      <span>{seg.name}: {seg.description.slice(0, 80)}{seg.description.length > 80 ? '...' : ''}</span>
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
