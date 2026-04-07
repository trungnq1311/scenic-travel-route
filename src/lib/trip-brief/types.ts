import type { ProcessedRoute } from '@/lib/pipeline/types';

export type TripBriefStatus = 'active' | 'expired';
export type TripBriefState =
  | 'empty'
  | 'ready'
  | 'submitting_vote'
  | 'load_error'
  | 'expired_trip'
  | 'decision_locked'
  | 'decision_unlock_pending';

export type RouteConfidence = 'high' | 'medium' | 'low';

export type TripBriefRouteSnapshot = ProcessedRoute & {
  confidence: RouteConfidence;
};

export interface TripBrief {
  briefId: string;
  tripId: string;
  origin: string;
  destination: string;
  routesSnapshot: TripBriefRouteSnapshot[];
  createdAt: string;
  expiresAt: string;
  status: TripBriefStatus;
  decisionLockedAt: string | null;
  lockedByTokenHash: string | null;
  winningRouteId: string | null;
}

export interface TripBriefVoteSummary {
  countsByRouteId: Record<string, number>;
  totalVotes: number;
  winnerRouteId: string | null;
}

export interface TripBriefView {
  brief: TripBrief;
  voteSummary: TripBriefVoteSummary;
  userVoteRouteId: string | null;
  shareUrl: string;
  readOnly: boolean;
  canUnlock: boolean;
  lockUndoExpiresAt: string | null;
}

export interface TripBriefSummaryView {
  briefId: string;
  voteSummary: TripBriefVoteSummary;
  readOnly: boolean;
  winningRouteId: string | null;
}

export function getTripBriefState(view: TripBriefView | null, hasError: boolean): TripBriefState {
  if (hasError) return 'load_error';
  if (!view) return 'empty';
  if (view.brief.decisionLockedAt) return 'decision_locked';
  if (view.brief.status === 'expired') return 'expired_trip';
  return 'ready';
}
