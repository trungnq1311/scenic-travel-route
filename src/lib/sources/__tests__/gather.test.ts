import { gatherSources } from '../gather';
import type { SourceQuery } from '../types';

jest.mock('../web-search', () => ({
  fetchWebSearch: jest.fn(async () => ({
    source: 'web_search',
    items: [{ title: 'w', content: 'c' }],
    queryCount: 1,
    elapsedMs: 10,
  })),
}));

jest.mock('../tiktok', () => ({
  fetchTikTok: jest.fn(async () => ({
    source: 'tiktok',
    items: [{ title: 't', content: 'c' }],
    queryCount: 1,
    elapsedMs: 10,
  })),
}));

jest.mock('../google-reviews', () => ({
  fetchGoogleReviews: jest.fn(async () => ({
    source: 'google_reviews',
    items: [{ title: 'g', content: 'c' }],
    queryCount: 1,
    elapsedMs: 10,
  })),
}));

jest.mock('../youtube', () => ({
  fetchYouTube: jest.fn(async () => ({
    source: 'youtube',
    items: [{ title: 'y', content: 'c' }],
    queryCount: 1,
    elapsedMs: 10,
  })),
}));

const query: SourceQuery = {
  origin: 'HCM',
  destination: 'Vung Tau',
  originVi: 'Sài Gòn',
  destinationVi: 'Vũng Tàu',
};

describe('gatherSources', () => {
  test('gathers all four sources and sums totalItems', async () => {
    const result = await gatherSources(query);

    expect(result.sources).toHaveLength(4);
    expect(result.totalItems).toBe(4);
    expect(result.sources.map((s) => s.source).sort()).toEqual([
      'google_reviews',
      'tiktok',
      'web_search',
      'youtube',
    ]);
  });
});
