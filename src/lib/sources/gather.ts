import type { SourceQuery, SourceResult } from './types';
import { fetchWebSearch } from './web-search';
import { fetchTikTok } from './tiktok';
import { fetchGoogleReviews } from './google-reviews';
import { fetchYouTube } from './youtube';

export interface GatherResult {
  sources: SourceResult[];
  totalItems: number;
  elapsedMs: number;
}

interface SourceFetcher {
  name: SourceResult['source'];
  fn: (query: SourceQuery) => Promise<SourceResult>;
}

const SOURCE_FETCHERS: SourceFetcher[] = [
  { name: 'web_search', fn: fetchWebSearch },
  { name: 'tiktok', fn: fetchTikTok },
  { name: 'google_reviews', fn: fetchGoogleReviews },
  { name: 'youtube', fn: fetchYouTube },
];

export async function gatherSources(query: SourceQuery): Promise<GatherResult> {
  const start = Date.now();

  const settled = await Promise.allSettled(
    SOURCE_FETCHERS.map((s) => s.fn(query)),
  );

  const sources: SourceResult[] = settled.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    // Create fallback result for rejected sources
    const error = result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);

    return {
      source: SOURCE_FETCHERS[i].name,
      items: [],
      queryCount: 0,
      elapsedMs: 0,
      error,
    };
  });

  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);

  return {
    sources,
    totalItems,
    elapsedMs: Date.now() - start,
  };
}
