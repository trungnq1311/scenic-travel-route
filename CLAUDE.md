# Scenic Travel Route

## Project Overview

AI-powered scenic road-trip planner that turns any A-to-B drive into a scenic journey. Given an origin and destination, the system gathers travel content from multiple external sources (YouTube, TikTok, web search, Google Reviews), uses an LLM to extract route variants and waypoints, geocodes waypoints, fetches drivable geometries, discovers POIs, and synthesizes vibe summaries for map-first route comparison.

Current status: Alpha V1.0. Core route pipeline and map UI are implemented and working.

## Product Decisions (Do Not Regress)

1. No manual curation. Route data must come from external sources and APIs.
2. Source priority set by founder: Community > YouTube > TikTok > Web search = Google Reviews.
3. TikTok is mandatory and must stay in the pipeline.
4. LLM default: OpenRouter free tier using `qwen/qwen3.6-plus:free`.
5. OpenRouter request must include `chat_template_kwargs: { enable_thinking: false }` to improve clean JSON output.
6. Default detour behavior: no cap. Optional chill level filtering applies ratio caps (low=1.5x, medium=2.0x, high=3.0x).
7. Phase 2 UI pattern: map-dominant layout, desktop sidebar + mobile bottom sheet.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 6
- Tailwind CSS v4
- Mapbox GL + react-map-gl
- Jest + ts-jest

## Environment Variables

Use `.env.local` for local development. Reference template: `.env.example`.

Required keys:
- `OPENROUTER_API_KEY`
- `TAVILY_API_KEY`
- `GOOGLE_API_KEY`
- `ENSEMBLE_DATA_API_KEY`
- `MAPBOX_API_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`

Optional tuning:
- `LLM_MODEL` (default `qwen/qwen3.6-plus:free`)
- `LLM_TIMEOUT_MS` (default 180000)
- `SOURCE_TIMEOUT_MS`
- `MAX_PIPELINE_TIME_MS`

## How to Run

```bash
npm install
npm run dev
```

## How to Verify

```bash
npm run build
npm test -- --no-coverage
bash scripts/smoke-test.sh
```

Notes:
- Jest may print an open-handles warning; this is known and non-blocking in current setup.

## Architecture

1. Input form (`/`) collects origin, destination, preferences.
2. Trip page (`/trip/[tripId]`) connects to SSE endpoint.
3. SSE endpoint triggers pipeline and streams stage updates.
4. Pipeline stages:
   - gather sources
   - extract structured routes with LLM
   - geocode waypoints
   - fetch route geometries
   - fetch POIs
   - synthesize vibes
5. Results render as selectable polylines + cards + POI markers.

## Important Implementation Details

### Route endpoint correctness

Routes must always start near origin and end near destination.

Protections currently implemented:
- Prompt-level route rules in `src/lib/llm/prompts.ts`
- Endpoint injection in `src/lib/geo/route.ts`
- Endpoint validation in `src/lib/pipeline/generate.ts` using haversine threshold

### Google Geocoding Vietnam behavior

Use component filtering in `src/lib/geo/geocode.ts`:
- `components=locality:<name>|country:VN`
- `region=vn`

Avoid relying on raw freeform address strings for localities.

### TikTok (EnsembleData) contract

In `src/lib/sources/tiktok.ts`:
- Endpoint: `/tt/keyword/search`
- Auth: `token` query parameter
- Query field: `name` (not `keyword`)
- Response shape can be object or array for `aweme_info`; parser normalizes both

### YouTube source

`src/lib/sources/youtube.ts` uses YouTube Data API v3 via `GOOGLE_API_KEY`.

## Key Files

- `src/app/page.tsx`
- `src/app/trip/[tripId]/page.tsx`
- `src/app/api/generate/route.ts`
- `src/app/api/generate/stream/route.ts`
- `src/hooks/useRouteGeneration.ts`
- `src/lib/pipeline/generate.ts`
- `src/lib/sources/gather.ts`
- `src/lib/sources/tiktok.ts`
- `src/lib/sources/youtube.ts`
- `src/lib/geo/geocode.ts`
- `src/lib/geo/route.ts`
- `src/components/ProgressStepper.tsx`

## Recovery Notes (2026-04-06)

After repository loss, the following were restored:
- project configs (`jest.config.ts`, `postcss.config.mjs`, `.env.example`)
- smoke test script (`scripts/smoke-test.sh`)
- core project tests under `src/lib/**/__tests__`
- handover doc (`CLAUDE.md`)

Current verification after restore:
- `npm run build` passes
- `npm test -- --no-coverage` passes (13 suites, 20 tests)

## Short Backlog

1. Recreate/restore long-form phase plan docs under `docs/plans/` if canonical copies are found.
2. Add community source module (highest source-priority gap).
3. Improve OpenRouter 429 handling (retry/backoff/fallback).
4. Expand geocoding/routing beyond current Vietnam assumptions.
