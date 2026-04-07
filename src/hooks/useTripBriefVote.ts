'use client';

import { useCallback, useMemo, useState } from 'react';
import type { GenerateResponse } from '@/lib/pipeline/types';
import type { TripBriefState, TripBriefView } from '@/lib/trip-brief/types';
import { getTripBriefState } from '@/lib/trip-brief/types';

interface UseTripBriefVoteReturn {
  tripBrief: TripBriefView | null;
  state: TripBriefState;
  isSubmittingVote: boolean;
  isUnlockPending: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  createTripBrief: (result: GenerateResponse) => Promise<void>;
  refreshTripBrief: (briefId: string) => Promise<void>;
  castVote: (routeId: string) => Promise<void>;
  lockDecision: () => Promise<void>;
  unlockDecision: () => Promise<void>;
}

interface ApiErrorShape {
  code?: string;
  error?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

function randomIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function useTripBriefVote(): UseTripBriefVoteReturn {
  const [tripBrief, setTripBrief] = useState<TripBriefView | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [isUnlockPending, setIsUnlockPending] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setErrorCode(null);
    setErrorMessage(null);
  }, []);

  const setErrorFromResponse = useCallback(async (response: Response) => {
    const data = await readJson<ApiErrorShape>(response);
    setErrorCode(data.code ?? 'unknown_error');
    setErrorMessage(data.error ?? 'Trip brief request failed.');
  }, []);

  const createTripBrief = useCallback(async (result: GenerateResponse) => {
    clearError();
    const response = await fetch('/api/trip-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      await setErrorFromResponse(response);
      return;
    }

    const view = await readJson<TripBriefView>(response);
    setTripBrief(view);
  }, [clearError, setErrorFromResponse]);

  const refreshTripBrief = useCallback(async (briefId: string) => {
    clearError();
    const response = await fetch(`/api/trip-brief/${briefId}`);
    if (!response.ok) {
      await setErrorFromResponse(response);
      return;
    }
    const view = await readJson<TripBriefView>(response);
    setTripBrief(view);
  }, [clearError, setErrorFromResponse]);

  const castVote = useCallback(async (routeId: string) => {
    if (!tripBrief) return;

    clearError();
    setIsSubmittingVote(true);
    try {
      const response = await fetch(`/api/trip-brief/${tripBrief.brief.briefId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          idempotencyKey: randomIdempotencyKey(),
        }),
      });

      if (!response.ok) {
        await setErrorFromResponse(response);
        return;
      }

      const view = await readJson<TripBriefView>(response);
      setTripBrief(view);
    } catch {
      setErrorCode('network_error');
      setErrorMessage('Still syncing votes... this is taking longer than usual.');
    } finally {
      setIsSubmittingVote(false);
    }
  }, [tripBrief, clearError, setErrorFromResponse]);

  const lockDecision = useCallback(async () => {
    if (!tripBrief) return;
    clearError();
    const response = await fetch(`/api/trip-brief/${tripBrief.brief.briefId}/lock`, {
      method: 'POST',
    });
    if (!response.ok) {
      await setErrorFromResponse(response);
      return;
    }
    const view = await readJson<TripBriefView>(response);
    setTripBrief(view);
  }, [tripBrief, clearError, setErrorFromResponse]);

  const unlockDecision = useCallback(async () => {
    if (!tripBrief) return;

    clearError();
    setIsUnlockPending(true);
    try {
      const response = await fetch(`/api/trip-brief/${tripBrief.brief.briefId}/lock`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        await setErrorFromResponse(response);
        return;
      }
      const view = await readJson<TripBriefView>(response);
      setTripBrief(view);
    } catch {
      setErrorCode('network_error');
      setErrorMessage('Still syncing votes... this is taking longer than usual.');
    } finally {
      setIsUnlockPending(false);
    }
  }, [tripBrief, clearError, setErrorFromResponse]);

  const state = useMemo(() => {
    if (isUnlockPending) return 'decision_unlock_pending' as const;
    if (isSubmittingVote) return 'submitting_vote' as const;
    return getTripBriefState(tripBrief, !!errorCode);
  }, [tripBrief, isSubmittingVote, isUnlockPending, errorCode]);

  return {
    tripBrief,
    state,
    isSubmittingVote,
    isUnlockPending,
    errorCode,
    errorMessage,
    createTripBrief,
    refreshTripBrief,
    castVote,
    lockDecision,
    unlockDecision,
  };
}
