# Scenic Travel Route

AI-powered scenic road-trip planner that turns any A-to-B drive into a scenic journey.

Given an origin and destination, the app:
- gathers route-relevant travel content from multiple external sources,
- extracts route variants and waypoints with an LLM,
- geocodes waypoints and fetches drivable route geometries,
- discovers POIs and synthesizes vibe summaries,
- renders selectable route options on an interactive map.

## Current Status

- Alpha V1.0
- Core pipeline and map UI are implemented
- Recovery completed after repository loss (docs/config/scripts/tests restored)

## Product Constraints (Do Not Regress)

1. No manual curation. Data must come from external sources/APIs.
2. Source priority: Community > YouTube > TikTok > Web search = Google Reviews.
3. TikTok is mandatory in the pipeline.
4. Default LLM: `qwen/qwen3.6-plus:free` via OpenRouter free tier.
5. OpenRouter payload must include `chat_template_kwargs: { enable_thinking: false }`.
6. Default detour behavior: no cap. Optional chill-level caps: low=1.5x, medium=2.0x, high=3.0x.
7. UI pattern: map-first (desktop sidebar + mobile bottom sheet).

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 6
- Tailwind CSS v4
- Mapbox GL + react-map-gl
- Jest + ts-jest

## Environment Variables

Create `.env.local` from `.env.example`.

Required:
- `OPENROUTER_API_KEY`
- `TAVILY_API_KEY`
- `GOOGLE_API_KEY`
- `ENSEMBLE_DATA_API_KEY`
- `MAPBOX_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

Optional:
- `LLM_MODEL` (default `qwen/qwen3.6-plus:free`)
- `LLM_TIMEOUT_MS` (default `180000`)
- `SOURCE_TIMEOUT_MS`
- `MAX_PIPELINE_TIME_MS`

## Getting Started

```bash
npm install
npm run dev
```

App URL: `http://localhost:3000`

## Verification

```bash
npm run build
npm test -- --no-coverage
bash scripts/smoke-test.sh
```

Note: Jest may report an open-handles warning in this setup; it is known and non-blocking.

## Architecture Overview

1. `/` (landing page) captures origin/destination and options.
2. `/trip/[tripId]` connects to SSE endpoint for live stage updates.
3. `/api/generate/stream` runs the pipeline and streams stage events.
4. Pipeline stages:
   - gather sources (`src/lib/sources/*`)
   - extract routes (`src/lib/llm/extract.ts`)
   - geocode waypoints (`src/lib/geo/geocode.ts`)
   - fetch route geometries (`src/lib/geo/route.ts`)
   - fetch POIs (`src/lib/geo/pois.ts`)
   - synthesize vibes (`src/lib/llm/synthesize.ts`)

## Important Implementation Notes

- Route endpoint correctness is protected at three layers:
  - strict prompt rules,
  - endpoint injection into route waypoints,
  - endpoint distance validation in pipeline.
- Vietnam geocoding uses component filtering (`locality + country:VN`) due to post-2026 admin changes.
- TikTok integration uses EnsembleData `tt/keyword/search` with token query parameter and `name` query field.

## Key Paths

- `src/app/page.tsx`
- `src/app/trip/[tripId]/page.tsx`
- `src/app/api/generate/route.ts`
- `src/app/api/generate/stream/route.ts`
- `src/hooks/useRouteGeneration.ts`
- `src/lib/pipeline/generate.ts`
- `src/lib/sources/gather.ts`
- `src/lib/geo/geocode.ts`
- `src/lib/geo/route.ts`
- `src/components/ProgressStepper.tsx`

## Backlog

1. Add community source module (highest source-priority gap).
2. Improve OpenRouter 429 handling with retry/backoff/fallback.
3. Expand geocoding/routing beyond current Vietnam assumptions.
4. Restore long-form historical planning docs if canonical copies are found.
