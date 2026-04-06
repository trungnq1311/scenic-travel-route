import type { SourceResult } from '../sources/types';

const SOURCE_LIMITS: Record<string, number> = {
  web_search: 20,
  tiktok: 15,
  google_reviews: 20,
  youtube: 20,
};

function toPromptTagValue(input: string): string {
  return input.replace(/[<>\n\r]/g, ' ').trim();
}

export function buildExtractionPrompt(
  sources: SourceResult[],
  origin?: string,
  destination?: string,
): string {
  const sections: string[] = [];

  for (const source of sources) {
    const limit = SOURCE_LIMITS[source.source] ?? 20;
    const items = source.items.slice(0, limit);

    if (items.length === 0) continue;

    const label = source.source.toUpperCase().replace('_', ' ');
    const lines: string[] = [`=== ${label} RESULTS ===`];

    items.forEach((item, idx) => {
      lines.push(`[${idx + 1}] Title: ${item.title}`);
      lines.push(`Content: ${item.content}`);
      if (item.url) {
        lines.push(`URL: ${item.url}`);
      }
      lines.push('');
    });

    sections.push(lines.join('\n'));
  }

  const sourceContent = sections.join('\n\n');

  const originLabel = origin || 'Origin';
  const destLabel = destination || 'Destination';
  const originTag = toPromptTagValue(originLabel);
  const destinationTag = toPromptTagValue(destLabel);

  return `You are a scenic route extraction system for Vietnam. Your task is to analyze content from multiple sources and extract structured scenic route data for traveling from ${originTag} to ${destinationTag}.

# Travel Corridor
- **Origin**: ${originTag}
- **Destination**: ${destinationTag}

Every route you extract MUST be a complete driving route that starts at ${originTag} and ends at ${destinationTag}. Do NOT extract partial routes, local sightseeing loops, or routes that go to a different destination.

# Input Sources
${sourceContent}

# Your Task

From the sources above, extract scenic route variants for driving from ${originTag} to ${destinationTag}. De-duplicate across sources. For each finding, track which sources mention it.

Return a JSON object with this EXACT structure:

{
  "corridor": "${originTag} to ${destinationTag}",
  "routes": [
    {
      "id": "route_1",
      "name": "Short descriptive name",
      "description": "2-3 sentence description of this route variant",
      "primary_road": "Main road name (e.g., QL51)",
      "estimated_distance_km": 120,
      "waypoints": [
        {
          "name": "Place name in Vietnamese",
          "name_en": "English name if applicable",
          "lat": 10.7769,
          "lng": 106.7009,
          "type": "city|town|landmark|intersection|pass|beach|viewpoint",
          "description": "Brief description of this waypoint",
          "sources": ["web_search", "tiktok"]
        }
      ],
      "scenic_segments": [
        {
          "name": "Scenic stretch name",
          "from_waypoint": "Start waypoint name",
          "to_waypoint": "End waypoint name",
          "description": "What makes this stretch scenic",
          "sources": ["web_search", "google_reviews"],
          "corroborated": true
        }
      ]
    }
  ],
  "roads_mentioned": [
    {
      "name": "Road name",
      "aliases": ["Alternative names"],
      "description": "Brief description",
      "sources": ["web_search"]
    }
  ],
  "pois": [
    {
      "name": "POI name",
      "lat": 10.5,
      "lng": 107.1,
      "type": "cafe|restaurant|viewpoint|beach|temple|market",
      "description": "Brief description",
      "sources": ["google_reviews"]
    }
  ],
  "source_summary": {
    "web_search_findings": 15,
    "tiktok_findings": 8,
    "google_reviews_findings": 5,
    "cross_source_corroborations": 4
  }
}

# CRITICAL Route Rules
1. EVERY route MUST be a complete journey from ${originTag} to ${destinationTag}.
2. The FIRST waypoint of each route MUST be at or very near ${originTag}.
3. The LAST waypoint of each route MUST be at or very near ${destinationTag}.
4. Waypoints MUST be ordered sequentially along the driving direction from origin to destination.
5. Do NOT include routes that only visit areas near the origin without reaching ${destinationTag}.
6. Do NOT include routes that go to a DIFFERENT destination than ${destinationTag}.
7. Each route should represent a DISTINCT road/path variant (e.g., highway vs coastal road vs ferry route).

# Other Rules
8. Only extract places that ACTUALLY EXIST. Do NOT invent or hallucinate waypoints.
9. For coordinates (lat/lng), provide your best estimate based on geographic knowledge of Vietnam.
10. Mark "corroborated": true for scenic segments mentioned by 2+ independent sources.
11. Include the "sources" array for EVERY waypoint, segment, road, and POI.
12. Vietnamese place names should preserve diacritics.

Return ONLY the JSON object, no other text. Do not wrap in markdown code blocks.`;
}

export function getSystemPrompt(): string {
  return 'You are a geographic data extraction system specializing in Vietnamese travel routes. You respond ONLY with valid JSON. No explanations, no markdown, no code blocks. Just the JSON object.';
}
