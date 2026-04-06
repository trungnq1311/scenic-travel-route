import { fetchTikTok } from '../tiktok';
import type { SourceQuery } from '../types';

const query: SourceQuery = {
  origin: 'Ho Chi Minh City',
  destination: 'Vung Tau',
  originVi: 'Sài Gòn',
  destinationVi: 'Vũng Tàu',
};

describe('fetchTikTok', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.ENSEMBLE_DATA_API_KEY = 'test-token';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('calls EnsembleData with token in query and name param', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          data: [
            {
              aweme_info: {
                aweme_id: '123',
                desc: 'Cung đường ven biển Vũng Tàu rất đẹp',
                statistics: { play_count: 100, digg_count: 10 },
              },
            },
          ],
        },
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchTikTok(query);

    expect(result.source).toBe('tiktok');
    expect(result.error).toBeUndefined();
    expect(result.items.length).toBeGreaterThan(0);

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain('/tt/keyword/search');
    expect(calledUrl).toContain('name=');
    expect(calledUrl).toContain('token=test-token');
    expect(calledUrl).toContain('country=VN');
  });

  test('normalizes aweme_info array responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          data: [
            {
              aweme_info: [
                {
                  aweme_id: 'abc',
                  desc: 'Phượt cung đường đẹp',
                  statistics: { play_count: 1, digg_count: 1 },
                },
              ],
            },
          ],
        },
      }),
    }) as unknown as typeof fetch;

    const result = await fetchTikTok(query);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].metadata?.aweme_id).toBe('abc');
  });
});
