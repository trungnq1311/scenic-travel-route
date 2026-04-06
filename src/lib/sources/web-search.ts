import type { SourceQuery, SourceResult, SourceItem } from './types';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const TIMEOUT_MS = 10_000;

const ROAD_KEYWORDS = [
  'route', 'road', 'drive', 'highway', 'scenic',
  'đường', 'quốc lộ', 'QL', 'cung đường', 'đèo',
  'ven biển', 'phà', 'cầu', 'phượt',
];

const keywordPattern = new RegExp(ROAD_KEYWORDS.join('|'), 'i');

function buildQueries(query: SourceQuery): string[] {
  return [
    `đường đẹp ${query.originVi} đi ${query.destinationVi}`,
    `cung đường phượt ${query.originVi} ${query.destinationVi}`,
    `scenic route ${query.origin} to ${query.destination}`,
    `best road trip ${query.origin} ${query.destination}`,
  ];
}

interface TavilyResult {
  title: string;
  content: string;
  url: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

async function fetchSingleQuery(
  searchQuery: string,
  signal: AbortSignal,
): Promise<SourceItem[]> {
  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: searchQuery,
      search_depth: 'advanced',
      max_results: 10,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  const data: TavilyResponse = await response.json();

  return (data.results ?? [])
    .filter((item) => keywordPattern.test(item.content) || keywordPattern.test(item.title))
    .map((item) => ({
      title: item.title,
      content: item.content,
      url: item.url,
    }));
}

export async function fetchWebSearch(query: SourceQuery): Promise<SourceResult> {
  const start = Date.now();

  try {
    const searchQueries = buildQueries(query);

    const settled = await Promise.allSettled(
      searchQueries.map((q) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        return fetchSingleQuery(q, controller.signal).finally(() =>
          clearTimeout(timeout),
        );
      }),
    );

    const items: SourceItem[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        items.push(...result.value);
      }
    }

    return {
      source: 'web_search',
      items,
      queryCount: searchQueries.length,
      elapsedMs: Date.now() - start,
    };
  } catch (error) {
    return {
      source: 'web_search',
      items: [],
      queryCount: 0,
      elapsedMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
