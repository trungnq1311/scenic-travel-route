'use client';

import { useState, useEffect } from 'react';
import type { StageResult } from '@/lib/pipeline/types';

interface ProgressStepperProps {
  stages: StageResult[];
  status: 'connecting' | 'generating' | 'complete' | 'error';
  error: string | null;
  onRetry: () => void;
}

const STAGE_DEFINITIONS = [
  { name: 'gather', label: 'Searching travel sources...' },
  { name: 'extract', label: 'Analyzing with AI...' },
  { name: 'geocode', label: 'Finding coordinates...' },
  { name: 'route', label: 'Mapping routes...' },
  { name: 'pois', label: 'Discovering stops...' },
  { name: 'synthesize', label: 'Writing vibe summaries...' },
] as const;

const TRAVEL_TIPS = [
  'Vietnam has over 3,000 km of coastline with countless scenic coastal roads.',
  'The best time for a road trip in southern Vietnam is the dry season, November to April.',
  'Cat Lai ferry is a local favorite for getting out of Saigon without highway traffic.',
  'Vietnamese roadside "com tam" (broken rice) stops are some of the best meals you\'ll find.',
  '"Phuot" is the Vietnamese word for adventure travel — and it\'s a way of life here.',
  'Many scenic routes in Vietnam were originally built by the French colonial government.',
  'Coastal road QL55 between Vung Tau and Phan Thiet is one of Vietnam\'s most underrated drives.',
  'Vietnamese coffee ("ca phe sua da") is the perfect road trip fuel — strong and sweet.',
  'The Long Hai to Vung Tau stretch has ocean views that rival the California coast.',
  'Local ferry crossings often cut hours off highway routes and add adventure to the trip.',
  'Vietnam\'s national roads (Quoc Lo) are marked with "QL" followed by the road number.',
  'The best hidden beaches are often found by following dirt roads off the main highways.',
  'Suoi Nghe countryside route passes through rubber plantations and dragon fruit farms.',
  'Vietnamese gas stations ("cay xang") are everywhere — you\'ll never run dry.',
  'Dawn and dusk are the most scenic times on Vietnam\'s coastal roads.',
];

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-5 w-5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PendingIcon() {
  return <div className="h-5 w-5 rounded-full border-2 border-stone-300" />;
}

/**
 * Rotating travel tips shown during the long AI analysis stage.
 * Each tip fades in/out every 5 seconds.
 */
function TravelTipCarousel() {
  const [tipIndex, setTipIndex] = useState(() =>
    Math.floor(Math.random() * TRAVEL_TIPS.length)
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % TRAVEL_TIPS.length);
        setVisible(true);
      }, 400);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700">
        Did you know?
      </p>
      <p
        className={`text-sm text-amber-900 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {TRAVEL_TIPS[tipIndex]}
      </p>
    </div>
  );
}

/**
 * Elapsed time counter that ticks every second while a stage is active.
 */
function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    : `${seconds}s`;

  return (
    <span className="ml-2 text-xs text-stone-400">{display}</span>
  );
}

export default function ProgressStepper({ stages, status, error, onRetry }: ProgressStepperProps) {
  const completedStageNames = new Set(stages.map((s) => s.name));
  const stageMap = new Map(stages.map((s) => [s.name, s]));

  // Track when the extract stage becomes active for the elapsed timer
  const [extractStartTime, setExtractStartTime] = useState<number | null>(null);

  function getStageState(index: number): 'completed' | 'partial' | 'failed' | 'active' | 'pending' {
    const def = STAGE_DEFINITIONS[index];
    const stageResult = stageMap.get(def.name);

    if (stageResult) {
      if (stageResult.status === 'failed') return 'failed';
      if (stageResult.status === 'partial') return 'partial';
      return 'completed';
    }

    if (status === 'generating' && !completedStageNames.has(def.name)) {
      const allPreviousReported = STAGE_DEFINITIONS.slice(0, index).every((prev) =>
        completedStageNames.has(prev.name)
      );
      if (allPreviousReported) return 'active';
    }

    return 'pending';
  }

  // Check if the extract stage is currently active
  const extractState = getStageState(1);
  const isExtractActive = extractState === 'active';

  // Set extract start time when it becomes active
  useEffect(() => {
    if (isExtractActive && extractStartTime === null) {
      setExtractStartTime(Date.now());
    } else if (!isExtractActive && extractStartTime !== null) {
      setExtractStartTime(null);
    }
  }, [isExtractActive, extractStartTime]);

  return (
    <div className="w-full max-w-sm space-y-1">
      {status === 'connecting' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-stone-500">
          <SpinnerIcon />
          <span>Connecting...</span>
        </div>
      )}

      <div className="space-y-3">
        {STAGE_DEFINITIONS.map((def, index) => {
          const state = getStageState(index);
          const stageResult = stageMap.get(def.name);

          return (
            <div key={def.name} className="flex items-center gap-3">
              {/* Icon */}
              <div className="flex-shrink-0">
                {state === 'completed' && <CheckIcon />}
                {state === 'partial' && <WarningIcon />}
                {state === 'failed' && <ErrorIcon />}
                {state === 'active' && <SpinnerIcon />}
                {state === 'pending' && <PendingIcon />}
              </div>

              {/* Label and detail */}
              <div className="min-w-0 flex-1">
                <span
                  className={`text-sm ${
                    state === 'pending' ? 'text-stone-400' : 'text-stone-700'
                  }`}
                >
                  {def.label}
                </span>
                {/* Show live elapsed timer for active extract stage */}
                {state === 'active' && def.name === 'extract' && extractStartTime && (
                  <ElapsedTimer startTime={extractStartTime} />
                )}
                {stageResult && state === 'completed' && (
                  <span className="ml-2 text-xs text-stone-400">
                    Done in {(stageResult.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
                {stageResult && state === 'partial' && (
                  <span className="ml-2 text-xs text-yellow-600">
                    {(stageResult.elapsedMs / 1000).toFixed(1)}s
                  </span>
                )}
                {stageResult && state === 'failed' && stageResult.detail && (
                  <span className="ml-2 text-xs text-red-500">{stageResult.detail}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Travel tips carousel during the long AI analysis stage */}
      {isExtractActive && <TravelTipCarousel />}

      {/* Error footer with retry */}
      {status === 'error' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error || 'Something went wrong'}</p>
          <button
            onClick={onRetry}
            className="mt-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Completion message */}
      {status === 'complete' && (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-teal-700">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>All done!</span>
        </div>
      )}
    </div>
  );
}
