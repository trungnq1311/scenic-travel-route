import type { SourceQuery, SourceResult, SourceItem } from './types';

const YOUTUBE_SEARCH_URL =
  'https://www.googleapis.com/youtube/v3/search';

/** Generic Vietnamese road/route keywords for filtering video titles + descriptions. */
const ROAD_KEYWORDS = [
  'QL',
  'quốc lộ',
  'tỉnh lộ',
  'đường',
  'cung đường',
  'con đường',
  'tuyến đường',
  'đường đẹp',
  'đường mòn',
  'đèo',
  'ven biển',
  'biển',
  'núi',
  'cao tốc',
  'phà',
  'cầu',
  'ngã ba',
  'phượt',
  'xe máy',
  'ô tô',
  'cảnh đẹp',
  'phong cảnh',
  'route',
  'road',
  'scenic',
  'drive',
];

const TIMEOUT_MS = 10_000;
const MAX_RESULTS_PER_QUERY = 10;

/**
 * Check if title or description matches road/route keywords.
 * Dynamically includes origin/destination Vietnamese names.
 */
function matchesRoadKeywords(text: string, query: SourceQuery): boolean {
  const lower = text.toLowerCase();
  const dynamicKeywords = [
    ...ROAD_KEYWORDS,
    query.originVi,
    query.destinationVi,
  ];
  return dynamicKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function buildSearchQueries(query: SourceQuery): string[] {
  return [
    `phượt ${query.originVi} ${query.destinationVi} đường đẹp`,
    `${query.originVi} đi ${query.destinationVi} cung đường`,
    `scenic route ${query.origin} to ${query.destination}`,
  ];
}

interface YouTubeSearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: { code?: number; message?: string };
}

async function fetchSingleQuery(
  searchQuery: string,
  apiKey: string,
  signal: AbortSignal,
  query: SourceQuery,
): Promise<SourceItem[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: searchQuery,
    type: 'video',
    regionCode: 'VN',
    relevanceLanguage: 'vi',
    maxResults: String(MAX_RESULTS_PER_QUERY),
    key: apiKey,
  });

  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    const status = response.status;
    // 403 typically means YouTube Data API is not enabled for this key
    if (status === 403) {
      throw new Error(
        `YouTube Data API returned 403 — the API may not be enabled for this key`,
      );
    }
    throw new Error(
      `YouTube API error: ${status} ${response.statusText}`,
    );
  }

  const data: YouTubeSearchResponse = await response.json();

  if (data.error) {
    throw new Error(
      `YouTube API error: ${data.error.code} ${data.error.message}`,
    );
  }

  return (data.items ?? [])
    .filter((item) => {
      const title = item.snippet?.title ?? '';
      const desc = item.snippet?.description ?? '';
      return matchesRoadKeywords(`${title} ${desc}`, query);
    })
    .map((item) => ({
      title: item.snippet?.title ?? '',
      content: item.snippet?.description ?? '',
      url: item.id?.videoId
        ? `https://www.youtube.com/watch?v=${item.id.videoId}`
        : undefined,
      metadata: {
        videoId: item.id?.videoId,
        channelTitle: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt,
      },
    }));
}

export async function fetchYouTube(query: SourceQuery): Promise<SourceResult> {
  const start = Date.now();
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      source: 'youtube',
      items: [],
      queryCount: 0,
      elapsedMs: Date.now() - start,
      error: 'GOOGLE_API_KEY is not set',
    };
  }

  try {
    const searchQueries = buildSearchQueries(query);

    const settled = await Promise.allSettled(
      searchQueries.map((q) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        return fetchSingleQuery(q, apiKey, controller.signal, query).finally(
          () => clearTimeout(timeout),
        );
      }),
    );

    const allItems: SourceItem[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    // Deduplicate by videoId
    const seen = new Set<string>();
    const deduplicated: SourceItem[] = [];
    for (const item of allItems) {
      const id = item.metadata?.videoId as string | undefined;
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      deduplicated.push(item);
    }

    return {
      source: 'youtube',
      items: deduplicated,
      queryCount: searchQueries.length,
      elapsedMs: Date.now() - start,
    };
  } catch (error) {
    return {
      source: 'youtube',
      items: [],
      queryCount: 0,
      elapsedMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
