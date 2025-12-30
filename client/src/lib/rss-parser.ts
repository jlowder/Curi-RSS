// This would be used on the frontend if we implemented client-side parsing
// For now, we're doing server-side parsing for better security and CORS handling

export interface ParsedFeed {
  title: string;
  description?: string;
  items: ParsedItem[];
}

export interface ParsedItem {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
  author?: string;
  category?: string;
  imageUrl?: string;
}

// Placeholder for potential client-side RSS parsing functionality
// In production, server-side parsing is preferred for security and CORS reasons
export async function parseRSSFeed(url: string): Promise<ParsedFeed> {
  throw new Error("Client-side RSS parsing not implemented. Use server-side API instead.");
}
