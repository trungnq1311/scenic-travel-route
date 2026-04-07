'use client';

import type { ProcessedRoute } from '@/lib/pipeline/types';
import type { TripBriefState, TripBriefView } from '@/lib/trip-brief/types';
import { getConfidenceBadgeMeta, getRouteConfidence } from '@/lib/trip-brief/confidence';

interface TripBriefPanelProps {
  routes: ProcessedRoute[];
  selectedRouteId: string | null;
  tripBrief: TripBriefView | null;
  state: TripBriefState;
  errorCode: string | null;
  errorMessage: string | null;
  onVote: (routeId: string) => Promise<void>;
  onLock: () => Promise<void>;
  onUnlock: () => Promise<void>;
  readOnlyMessage?: string;
}

function getFailureCopy(errorCode: string | null, fallback: string | null): string {
  switch (errorCode) {
    case 'rate_limited':
      return 'Too many vote attempts. Try again in 60 seconds.';
    case 'token_invalid':
      return 'This voting session is no longer valid.';
    case 'invalid_link':
      return 'This trip brief link is invalid or removed.';
    case 'expired_trip':
      return 'Voting closed for this trip brief.';
    case 'decision_locked':
      return 'Decision already locked for this trip brief.';
    default:
      return fallback || 'Could not sync votes.';
  }
}

function RouteVoteRow({
  route,
  selected,
  count,
  disabled,
  onVote,
}: {
  route: ProcessedRoute;
  selected: boolean;
  count: number;
  disabled: boolean;
  onVote: () => void;
}) {
  const confidence = getRouteConfidence(route);
  const badgeMeta = getConfidenceBadgeMeta(confidence);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onVote}
      aria-label={`Vote for ${route.name}`}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
        selected ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-300'
      } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-stone-800">{route.name}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badgeMeta.className}`}>
            {badgeMeta.label}
          </span>
          <span className="text-xs text-stone-500">{route.detourRatio.toFixed(1)}x longer</span>
        </div>
      </div>

      <div className="ml-3 shrink-0 text-right">
        <div className="text-sm font-semibold text-stone-800">{count}</div>
        <div className="text-xs text-stone-500">votes</div>
      </div>
    </button>
  );
}

export default function TripBriefPanel({
  routes,
  selectedRouteId,
  tripBrief,
  state,
  errorCode,
  errorMessage,
  onVote,
  onLock,
  onUnlock,
  readOnlyMessage,
}: TripBriefPanelProps) {
  const isReadOnly = tripBrief?.readOnly ?? false;
  const hasError = state === 'load_error';
  const votedRouteId = tripBrief?.userVoteRouteId || null;
  const counts = tripBrief?.voteSummary.countsByRouteId ?? {};
  const selectedForVote = selectedRouteId || votedRouteId;
  const winnerRouteId = tripBrief?.brief.winningRouteId ?? tripBrief?.voteSummary.winnerRouteId ?? null;
  const canLock = !!tripBrief && !isReadOnly && tripBrief.voteSummary.totalVotes > 0;

  return (
    <section className="border-t border-stone-200 bg-white p-4" aria-label="Trip brief voting panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-700">Trip Brief</h3>
        <span className="text-xs text-stone-500">Anyone with this link can view and vote for 14 days.</span>
      </div>

      <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-700">
        <div className="font-medium">Share URL</div>
        <div className="mt-1 break-all text-stone-600">{tripBrief?.shareUrl || 'Generating share link...'}</div>
      </div>

      {hasError && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          {getFailureCopy(errorCode, errorMessage)}
        </div>
      )}

      {state === 'expired_trip' && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Voting closed for this trip brief.
        </div>
      )}

      {state === 'decision_locked' && winnerRouteId && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Decision locked. {winnerRouteId} wins.
        </div>
      )}

      {readOnlyMessage && (
        <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
          {readOnlyMessage}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {routes.map((route) => (
          <RouteVoteRow
            key={route.id}
            route={route}
            selected={selectedForVote === route.id}
            count={counts[route.id] ?? 0}
            disabled={isReadOnly || state === 'submitting_vote'}
            onVote={() => onVote(route.id)}
          />
        ))}
      </div>

      <div className="mt-3 sticky bottom-0 flex items-center gap-2 bg-white pt-1 pb-[calc(env(safe-area-inset-bottom)+4px)]">
        <button
          type="button"
          onClick={onLock}
          disabled={!canLock || state === 'submitting_vote'}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-300"
          aria-label="Lock decision"
        >
          Lock decision
        </button>

        <button
          type="button"
          onClick={onUnlock}
          disabled={!tripBrief?.canUnlock || state === 'decision_unlock_pending'}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 px-3 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Undo lock"
        >
          {state === 'decision_unlock_pending' ? 'Undoing...' : 'Undo lock'}
        </button>
      </div>
    </section>
  );
}
