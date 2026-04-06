import type { SourceQuery, SourceResult, SourceItem } from './types';

const ENSEMBLE_BASE_URL =
  'https://ensembledata.com/apis/tt/keyword/search';

/** Generic Vietnamese road/route keywords for filtering TikTok descriptions. */
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
  'km',
  'cây số',
  'rẽ',
  'phượt',
  'xe máy',
  'ô tô',
  'cảnh đẹp',
  'phong cảnh',
];

const TIMEOUT_MS = 10_000;

/**
 * Check if a description matches road/route keywords.
 * Dynamically includes origin and destination Vietnamese names so that
 * content mentioning the trip endpoints is also captured.
 */
function matchesRoadKeywords(desc: string, query: SourceQuery): boolean {
  const lower = desc.toLowerCase();
  const dynamicKeywords = [
    ...ROAD_KEYWORDS,
    query.originVi,
    query.destinationVi,
  ];
  return dynamicKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Build the EnsembleData API URL with token as a query parameter. */
function buildUrl(keyword: string): string {
  const token = process.env.ENSEMBLE_DATA_API_KEY ?? '';
  const params = new URLSearchParams({
    name: keyword,
    period: '180',
    country: 'VN',
    token,
  });
  return `${ENSEMBLE_BASE_URL}?${params.toString()}`;
}

interface TikTokAwemeInfo {
  aweme_id?: string;
  desc?: string;
  statistics?: {
    play_count?: number;
    digg_count?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function parseItems(responseJson: unknown, query: SourceQuery): SourceItem[] {
  const items: SourceItem[] = [];

  const root = responseJson as {
    data?: {
      data?: Array<{ aweme_info?: TikTokAwemeInfo | TikTokAwemeInfo[] }>;
    };
  };
  const dataEntries = root?.data?.data ?? [];

  for (const entry of dataEntries) {
    // /search returns aweme_info as a single object per entry;
    // /full-search returns it as an array. Normalize to array.
    const raw = entry?.aweme_info;
    const awemeList: TikTokAwemeInfo[] = Array.isArray(raw)
      ? raw
      : raw
        ? [raw]
        : [];

    for (const aweme of awemeList) {
      const desc = aweme.desc ?? '';
      if (!desc || !matchesRoadKeywords(desc, query)) continue;

      const title = desc.length > 50 ? desc.slice(0, 50) : desc;
      const url = aweme.aweme_id
        ? `https://www.tiktok.com/@/video/${aweme.aweme_id}`
        : undefined;

      items.push({
        title,
        content: desc,
        url,
        metadata: {
          aweme_id: aweme.aweme_id,
          plays: aweme.statistics?.play_count,
          likes: aweme.statistics?.digg_count,
        },
      });
    }
  }

  return items;
}

async function fetchKeyword(keyword: string, query: SourceQuery): Promise<SourceItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(keyword), {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`EnsembleData API error: ${response.status} ${response.statusText}`);
    }

    const json: unknown = await response.json();
    return parseItems(json, query);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTikTok(query: SourceQuery): Promise<SourceResult> {
  const start = performance.now();

  const keywords = [
    `phượt ${query.originVi} ${query.destinationVi}`,
    `${query.originVi} đi ${query.destinationVi} đường đẹp`,
  ];

  try {
    const results = await Promise.allSettled(
      keywords.map((kw) => fetchKeyword(kw, query)),
    );

    const allItems: SourceItem[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    // Deduplicate by aweme_id
    const seen = new Set<string>();
    const deduplicated: SourceItem[] = [];
    for (const item of allItems) {
      const id = item.metadata?.aweme_id as string | undefined;
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      deduplicated.push(item);
    }

    const elapsedMs = Math.round(performance.now() - start);

    return {
      source: 'tiktok',
      items: deduplicated,
      queryCount: keywords.length,
      elapsedMs,
    };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - start);
    return {
      source: 'tiktok',
      items: [],
      queryCount: keywords.length,
      elapsedMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
