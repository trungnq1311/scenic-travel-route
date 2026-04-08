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
- Trip brief share, vote, and lock workflow shipped in `v1.0.1`
- Recovery completed after repository loss (docs/config/scripts/tests restored)

## Product Constraints (Do Not Regress)

1. No manual curation. Data must come from external sources/APIs.
2. Source priority: Community > YouTube > TikTok > Web search = Google Reviews.
3. TikTok is mandatory in the pipeline.
4. Default LLM: `qwen/qwen3-next-80b-a3b-instruct:free` via OpenRouter free tier.
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

Required for trip-brief persistence:

- `DATABASE_URL`
- `TRIP_BRIEF_TOKEN_SECRET`

Optional:

- `LLM_MODEL` (default `qwen/qwen3-next-80b-a3b-instruct:free`)
- `LLM_TIMEOUT_MS` (default `180000`)
- `OPENROUTER_MAX_RETRIES` (default `3`)
- `OPENROUTER_RETRY_BASE_MS` (default `1500`)
- `LLM_FALLBACK_MODELS` (optional comma-separated models tried after `LLM_MODEL`)
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
npm run test:e2e
bash scripts/smoke-test.sh
```

## Database Migration (Trip Brief)

Run trip-brief schema migration before enabling persistent share/vote flows:

```bash
npm run db:migrate:trip-brief
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
5. `/trip/[tripId]` can create a shareable trip brief and redirect users to `/trip-brief/[briefId]`.
6. Trip brief APIs handle summary, voting, and lock flow under `/api/trip-brief/*`.

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
- `src/app/trip-brief/[briefId]/page.tsx`
- `src/app/api/trip-brief/route.ts`
- `src/app/api/trip-brief/[briefId]/vote/route.ts`
- `src/app/api/trip-brief/[briefId]/lock/route.ts`
- `src/components/TripBriefPanel.tsx`
- `src/lib/trip-brief/store.ts`

## Documentation

- `README.md` - quick start, architecture overview, and key paths
- `CLAUDE.md` - repository operating guide and implementation constraints
- `CHANGELOG.md` - release-by-release shipped changes
- `TODOS.md` - active product backlog and completed items

## Backlog

1. Add community source module (highest source-priority gap).
2. Improve OpenRouter 429 handling with retry/backoff/fallback.
3. Expand geocoding/routing beyond current Vietnam assumptions.
4. Restore long-form historical planning docs if canonical copies are found.
