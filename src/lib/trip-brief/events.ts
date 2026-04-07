export interface TripBriefEvent {
  event: 'trip_brief_created' | 'trip_brief_viewed' | 'trip_vote_cast' | 'trip_decision_locked';
  payload: Record<string, unknown>;
}

export function emitTripBriefEvent(event: TripBriefEvent): void {
  console.log(`[trip-brief:event] ${event.event}`, event.payload);
}
