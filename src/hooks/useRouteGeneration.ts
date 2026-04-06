'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { StageResult, GenerateResponse } from '@/lib/pipeline/types';

type GenerationStatus = 'connecting' | 'generating' | 'complete' | 'error';

interface UseRouteGenerationReturn {
  status: GenerationStatus;
  stages: StageResult[];
  result: GenerateResponse | null;
  error: string | null;
  retry: () => void;
}

export function useRouteGeneration(params: {
  origin: string;
  destination: string;
  chillLevel?: string;
}): UseRouteGenerationReturn {
  const { origin, destination, chillLevel } = params;

  const [status, setStatus] = useState<GenerationStatus>('connecting');
  const [stages, setStages] = useState<StageResult[]>([]);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!origin.trim() || !destination.trim()) return;

    closeEventSource();

    setStatus('connecting');
    setStages([]);
    setResult(null);
    setError(null);

    const searchParams = new URLSearchParams();
    searchParams.set('origin', origin);
    searchParams.set('destination', destination);
    if (chillLevel) {
      searchParams.set('chillLevel', chillLevel);
    }

    const es = new EventSource(`/api/generate/stream?${searchParams.toString()}`);
    eventSourceRef.current = es;

    es.addEventListener('stage', (event: MessageEvent) => {
      const stage = JSON.parse(event.data) as StageResult;
      setStages((prev) => [...prev, stage]);
      setStatus('generating');
    });

    es.addEventListener('complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as GenerateResponse;
      setResult(data);
      setStatus('complete');
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('error', (event: MessageEvent) => {
      // SSE error event with data payload from our API
      if (event.data) {
        const data = JSON.parse(event.data) as { message: string };
        setError(data.message);
      } else {
        setError('An unexpected error occurred');
      }
      setStatus('error');
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      // EventSource connection-level error (network failure, etc.)
      // Only handle if we haven't already processed a custom error event
      if (eventSourceRef.current === es) {
        setError('Connection lost. Please try again.');
        setStatus('error');
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, [origin, destination, chillLevel, closeEventSource]);

  const retry = useCallback(() => {
    retriesRef.current += 1;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      closeEventSource();
    };
  }, [connect, closeEventSource]);

  return { status, stages, result, error, retry };
}
