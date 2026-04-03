import { useState, useCallback } from 'react';

export const CONFLUENCE_EMAIL_KEY = 'ahead_confluence_email';
export const CONFLUENCE_TOKEN_KEY = 'ahead_confluence_token';
const CONFLUENCE_CONTENT_KEY = 'ahead_confluence_content';
const CONFLUENCE_SYNCED_KEY = 'ahead_confluence_synced';

export interface ConfluenceState {
  content: string | null;
  lastSynced: Date | null;
  isSyncing: boolean;
  isConfigured: boolean;
  error: string | null;
  sync: () => Promise<void>;
}

function stripHtml(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Convert common block elements to newlines
  text = text
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => '\n' + '#'.repeat(Number(level)) + ' ');

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse excess whitespace / blank lines
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value?: string } };
}

interface ConfluenceSearchResult {
  results: ConfluencePage[];
}

export function useConfluence(): ConfluenceState {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState<string | null>(() => {
    return localStorage.getItem(CONFLUENCE_CONTENT_KEY) ?? null;
  });

  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    const stored = localStorage.getItem(CONFLUENCE_SYNCED_KEY);
    return stored ? new Date(stored) : null;
  });

  const email = localStorage.getItem(CONFLUENCE_EMAIL_KEY) ?? '';
  const token = localStorage.getItem(CONFLUENCE_TOKEN_KEY) ?? '';
  const isConfigured = Boolean(email && token);

  const sync = useCallback(async () => {
    const currentEmail = localStorage.getItem(CONFLUENCE_EMAIL_KEY) ?? '';
    const currentToken = localStorage.getItem(CONFLUENCE_TOKEN_KEY) ?? '';

    if (!currentEmail || !currentToken) {
      setError('Confluence credentials not configured.');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const authHeader = 'Basic ' + btoa(`${currentEmail}:${currentToken}`);

      // Search for onboarding pages in the ABL space
      const cql = encodeURIComponent('space=ABL AND title~"Onboarding" ORDER BY lastmodified DESC');
      const url = `/confluence-api/content/search?cql=${cql}&expand=body.storage&limit=10`;

      const res = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Confluence API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data: ConfluenceSearchResult = await res.json();

      if (!data.results || data.results.length === 0) {
        throw new Error('No onboarding pages found in the ABL space. Check your credentials and space key.');
      }

      const sections = data.results
        .filter(page => page.body?.storage?.value)
        .map(page => {
          const bodyText = stripHtml(page.body!.storage!.value!);
          return `## ${page.title}\n\n${bodyText}`;
        })
        .join('\n\n---\n\n');

      const syncedAt = new Date();
      const fullContent = `# Live Confluence Content (${data.results.length} page${data.results.length !== 1 ? 's' : ''})\n\n${sections}`;

      setContent(fullContent);
      setLastSynced(syncedAt);
      localStorage.setItem(CONFLUENCE_CONTENT_KEY, fullContent);
      localStorage.setItem(CONFLUENCE_SYNCED_KEY, syncedAt.toISOString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return { content, lastSynced, isSyncing, isConfigured, error, sync };
}
