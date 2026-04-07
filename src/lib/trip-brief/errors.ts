export type TripBriefErrorCode =
  | 'invalid_link'
  | 'token_invalid'
  | 'expired_trip'
  | 'decision_locked'
  | 'unlock_window_expired'
  | 'unknown_route'
  | 'vote_required'
  | 'forbidden_unlock'
  | 'invalid_payload'
  | 'internal_error';

export interface TripBriefError {
  code: TripBriefErrorCode;
  error: string;
  status: number;
}

export function mapStoreError(error: unknown): TripBriefError {
  const message = error instanceof Error ? error.message : 'unknown error';

  switch (message) {
    case 'trip brief not found':
      return { code: 'invalid_link', error: 'This trip brief link is invalid or removed.', status: 404 };
    case 'invalid voter token':
      return { code: 'token_invalid', error: 'This voting session is no longer valid.', status: 401 };
    case 'trip brief expired':
      return { code: 'expired_trip', error: 'Voting closed for this trip brief.', status: 409 };
    case 'trip brief locked':
      return { code: 'decision_locked', error: 'Decision already locked for this trip brief.', status: 409 };
    case 'unlock window expired':
      return { code: 'unlock_window_expired', error: 'Undo lock window has expired.', status: 409 };
    case 'unknown route':
      return { code: 'unknown_route', error: 'Selected route does not exist in this trip brief.', status: 400 };
    case 'at least one vote required before lock':
      return { code: 'vote_required', error: 'At least one vote is required before lock.', status: 400 };
    case 'only locker can unlock':
      return { code: 'forbidden_unlock', error: 'Only the user who locked can unlock during the undo window.', status: 403 };
    default:
      return { code: 'internal_error', error: 'Trip brief request failed.', status: 500 };
  }
}

export function mapValidationError(message: string): TripBriefError {
  return {
    code: 'invalid_payload',
    error: message,
    status: 400,
  };
}
