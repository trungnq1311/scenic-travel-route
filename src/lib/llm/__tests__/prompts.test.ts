import { buildExtractionPrompt } from '../prompts';
import type { SourceResult } from '../../sources/types';

describe('buildExtractionPrompt', () => {
  test('includes origin/destination corridor and critical route rules', () => {
    const sources: SourceResult[] = [
      {
        source: 'youtube',
        items: [
          {
            title: 'Cung duong Sai Gon Vung Tau',
            content: 'Road tips and scenic views',
            url: 'https://youtube.com/x',
          },
        ],
        queryCount: 1,
        elapsedMs: 100,
      },
    ];

    const prompt = buildExtractionPrompt(sources, 'Ho Chi Minh City', 'Vung Tau');

    expect(prompt).toContain('Origin');
    expect(prompt).toContain('Destination');
    expect(prompt).toContain('Ho Chi Minh City');
    expect(prompt).toContain('Vung Tau');
    expect(prompt).toContain('CRITICAL Route Rules');
    expect(prompt).toContain('FIRST waypoint');
    expect(prompt).toContain('LAST waypoint');
  });
});
