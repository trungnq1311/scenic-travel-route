export interface SourceQuery {
  origin: string;
  destination: string;
  originVi: string;
  destinationVi: string;
}

export interface SourceItem {
  title: string;
  content: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export type SourceName = 'web_search' | 'tiktok' | 'google_reviews' | 'youtube';

export interface SourceResult {
  source: SourceName;
  items: SourceItem[];
  queryCount: number;
  elapsedMs: number;
  error?: string;
}
