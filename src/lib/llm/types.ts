export interface ExtractedWaypoint {
  name: string;
  name_en?: string;
  lat: number;
  lng: number;
  type: string;
  description: string;
  sources: string[];
}

export interface ScenicSegment {
  name: string;
  from_waypoint: string;
  to_waypoint: string;
  description: string;
  sources: string[];
  corroborated: boolean;
}

export interface ExtractedRoute {
  id: string;
  name: string;
  description: string;
  primary_road: string;
  estimated_distance_km: number;
  waypoints: ExtractedWaypoint[];
  scenic_segments: ScenicSegment[];
}

export interface MentionedRoad {
  name: string;
  aliases: string[];
  description: string;
  sources: string[];
}

export interface ExtractedPOI {
  name: string;
  lat: number;
  lng: number;
  type: string;
  description: string;
  sources: string[];
}

export interface SourceSummary {
  web_search_findings: number;
  tiktok_findings: number;
  google_reviews_findings: number;
  cross_source_corroborations: number;
}

export interface ExtractionResult {
  corridor: string;
  routes: ExtractedRoute[];
  roads_mentioned: MentionedRoad[];
  pois: ExtractedPOI[];
  source_summary: SourceSummary;
}
