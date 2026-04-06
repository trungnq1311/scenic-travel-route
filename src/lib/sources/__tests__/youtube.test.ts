import { fetchYouTube } from '../youtube';
import type { SourceQuery } from '../types';

const query: SourceQuery = {
  origin: 'Ho Chi Minh City',
  destination: 'Vung Tau',
  originVi: 'Sài Gòn',
  destinationVi: 'Vũng Tàu',
};

describe('fetchYouTube', () => {
  const originalFetch = global.fetch;
  const originalGoogleKey = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = 'google-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_API_KEY = originalGoogleKey;
    jest.restoreAllMocks();
  });

  test('returns empty with error when GOOGLE_API_KEY missing', async () => {
    delete process.env.GOOGLE_API_KEY;

    const result = await fetchYouTube(query);

    expect(result.source).toBe('youtube');
    expect(result.items).toEqual([]);
    expect(result.error).toContain('GOOGLE_API_KEY');
  });

  test('deduplicates by videoId and filters keyword-relevant videos', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: 'v1' },
            snippet: {
              title: 'Cung duong dep Sai Gon Vung Tau',
              description: 'Drive road tips',
              channelTitle: 'A',
            },
          },
          {
            id: { videoId: 'v1' },
            snippet: {
              title: 'Duplicate video',
              description: 'road road',
              channelTitle: 'A',
            },
          },
          {
            id: { videoId: 'v2' },
            snippet: {
              title: 'Cooking vlog',
              description: 'kitchen only',
              channelTitle: 'B',
            },
          },
        ],
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchYouTube(query);

    expect(result.error).toBeUndefined();
    expect(result.items.length).toBe(1);
    expect(result.items[0].metadata?.videoId).toBe('v1');
  });
});
