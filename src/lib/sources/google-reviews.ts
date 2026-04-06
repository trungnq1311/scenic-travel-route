import type { SourceQuery, SourceResult, SourceItem } from './types';

const ROAD_KEYWORDS = [
  'đường', 'quốc lộ', 'QL', 'lái xe', 'drive', 'road', 'route',
  'scenic', 'view', 'cảnh', 'đèo', 'ven biển', 'biển',
];

const ROAD_PATTERN = new RegExp(ROAD_KEYWORDS.join('|'), 'i');

const REQUEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGoogleReviews(
  query: SourceQuery,
): Promise<SourceResult> {
  const start = Date.now();
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      source: 'google_reviews',
      items: [],
      queryCount: 0,
      elapsedMs: Date.now() - start,
      error: 'GOOGLE_API_KEY is not set',
    };
  }

  try {
    // Step 1: Search for scenic places with 4 queries in parallel
    const searchQueries = [
      `scenic viewpoint ${query.destination}`,
      `đèo ${query.destinationVi}`,
      `beach ${query.destination}`,
      `view ${query.destinationVi}`,
    ];

    const searchResponses = await Promise.all(
      searchQueries.map(async (q) => {
        const url =
          `https://maps.googleapis.com/maps/api/place/textsearch/json` +
          `?query=${encodeURIComponent(q)}&key=${apiKey}&language=vi&region=vn`;
        const res = await fetchWithTimeout(url);
        return res.json() as Promise<{
          results?: Array<{ place_id: string }>;
        }>;
      }),
    );

    // Collect up to 10 unique place_ids
    const seenIds = new Set<string>();
    const placeIds: string[] = [];

    for (const data of searchResponses) {
      for (const place of data.results ?? []) {
        if (!seenIds.has(place.place_id) && placeIds.length < 10) {
          seenIds.add(place.place_id);
          placeIds.push(place.place_id);
        }
      }
    }

    // Step 2: Fetch reviews for each place in parallel
    const detailResponses = await Promise.all(
      placeIds.map(async (id) => {
        const url =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${encodeURIComponent(id)}&fields=name,reviews&key=${apiKey}&language=vi`;
        const res = await fetchWithTimeout(url);
        return res.json() as Promise<{
          result?: {
            name?: string;
            reviews?: Array<{
              text?: string;
              rating?: number;
            }>;
          };
        }>;
      }),
    );

    // Step 3: Filter reviews by road/scenic keywords and map to SourceItems
    const items: SourceItem[] = [];

    for (let i = 0; i < detailResponses.length; i++) {
      const detail = detailResponses[i];
      const placeId = placeIds[i];
      const placeName = detail.result?.name ?? 'Unknown Place';

      for (const review of detail.result?.reviews ?? []) {
        const text = review.text ?? '';
        if (text && ROAD_PATTERN.test(text)) {
          items.push({
            title: placeName,
            content: text,
            metadata: {
              rating: review.rating,
              place_id: placeId,
            },
          });
        }
      }
    }

    return {
      source: 'google_reviews',
      items,
      queryCount: searchQueries.length + placeIds.length,
      elapsedMs: Date.now() - start,
    };
  } catch (err) {
    return {
      source: 'google_reviews',
      items: [],
      queryCount: 0,
      elapsedMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
