'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ChillLevel = 'low' | 'medium' | 'high';
type Vibe = 'nature' | 'cafes' | 'viewpoints';

export default function InputForm() {
  const router = useRouter();

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [chillLevel, setChillLevel] = useState<ChillLevel | null>(null);
  const [vibes, setVibes] = useState<Set<Vibe>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = origin.trim().length > 0 && destination.trim().length > 0;

  function toggleChill(level: ChillLevel) {
    setChillLevel((prev) => (prev === level ? null : level));
  }

  function toggleVibe(vibe: Vibe) {
    setVibes((prev) => {
      const next = new Set(prev);
      if (next.has(vibe)) {
        next.delete(vibe);
      } else {
        next.add(vibe);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    const params = new URLSearchParams();
    params.set('origin', origin.trim());
    params.set('destination', destination.trim());

    if (chillLevel) {
      params.set('chillLevel', chillLevel);
    }

    if (vibes.size > 0) {
      params.set('vibes', Array.from(vibes).join(','));
    }

    router.push(`/trip/new?${params.toString()}`);
  }

  const inputClasses =
    'w-full rounded-lg border border-stone-300 px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors';

  const chillOptions: { value: ChillLevel; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ];

  const vibeOptions: { value: Vibe; label: string }[] = [
    { value: 'nature', label: 'Nature' },
    { value: 'cafes', label: 'Cafes' },
    { value: 'viewpoints', label: 'Viewpoints' },
  ];

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-5">
      {/* Origin */}
      <div>
        <label htmlFor="origin" className="mb-1.5 block text-sm font-medium text-stone-700">
          Origin
        </label>
        <input
          id="origin"
          type="text"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="e.g. Saigon, Ho Chi Minh City"
          className={inputClasses}
        />
      </div>

      {/* Destination */}
      <div>
        <label htmlFor="destination" className="mb-1.5 block text-sm font-medium text-stone-700">
          Destination
        </label>
        <input
          id="destination"
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. Vung Tau, Da Lat"
          className={inputClasses}
        />
      </div>

      {/* Customize toggle */}
      <button
        type="button"
        onClick={() => setCustomizeOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors"
      >
        <svg
          className={`h-4 w-4 transition-transform ${customizeOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Customize
      </button>

      {/* Customize section */}
      {customizeOpen && (
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
          {/* Chill Level */}
          <div>
            <span className="mb-2 block text-sm font-medium text-stone-700">Chill Level</span>
            <div className="flex gap-2">
              {chillOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleChill(opt.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    chillLevel === opt.value
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vibes */}
          <div>
            <span className="mb-2 block text-sm font-medium text-stone-700">Vibes</span>
            <div className="flex flex-wrap gap-2">
              {vibeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleVibe(opt.value)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    vibes.has(opt.value)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className={`w-full rounded-lg py-3 font-semibold transition-colors ${
          isSubmitting
            ? 'cursor-wait bg-emerald-500 text-white'
            : canSubmit
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'cursor-not-allowed bg-stone-300 text-stone-500'
        }`}
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Starting...
          </span>
        ) : (
          'Discover Routes'
        )}
      </button>
    </form>
  );
}
