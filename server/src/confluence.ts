/**
 * Fetches onboarding pages from Confluence Cloud (REST API) for use in AI system prompts.
 * Configure via env; returns null if not configured or on error (caller falls back to static prompt).
 */

const DEFAULT_CQL = 'space=ABL AND title~"Onboarding" ORDER BY lastmodified DESC';

function stripHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => '\n' + '#'.repeat(Number(level)) + ' ');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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

type CacheEntry = { content: string; fetchedAt: number };
let cache: CacheEntry | null = null;

function getCacheTtlMs(): number {
  const raw = process.env.CONFLUENCE_CACHE_TTL_MS;
  if (raw === undefined || raw === '') return 5 * 60 * 1000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 5 * 60 * 1000;
}

function parsePageIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** Fetch specific pages by numeric content id (order preserved). IDs match URLs like .../pages/3670048770/... */
async function fetchContentByIds(
  baseUrl: string,
  authHeader: string,
  ids: string[]
): Promise<string | null> {
  const sections: string[] = [];

  for (const id of ids) {
    const url = `${baseUrl}/rest/api/content/${encodeURIComponent(id)}?expand=body.storage`;
    const res = await fetch(url, {
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[confluence] Page fetch failed', id, res.status, text.slice(0, 200));
      continue;
    }

    const page = (await res.json()) as ConfluencePage;
    const html = page.body?.storage?.value;
    if (!html) {
      console.warn(
        '[confluence] No body.storage for id',
        id,
        '(databases / smart links may not expose wiki storage — use a normal page or CQL instead)'
      );
      continue;
    }

    const bodyText = stripHtml(html);
    sections.push(`## ${page.title}\n\n${bodyText}`);
  }

  return sections.length > 0 ? sections.join('\n\n---\n\n') : null;
}

async function fetchContentByCql(
  baseUrl: string,
  authHeader: string,
  cql: string,
  limit: string
): Promise<string | null> {
  const encCql = encodeURIComponent(cql);
  const encLimit = encodeURIComponent(limit);
  const url = `${baseUrl}/rest/api/content/search?cql=${encCql}&expand=body.storage&limit=${encLimit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[confluence] API error', res.status, text.slice(0, 300));
    return null;
  }

  const data = (await res.json()) as ConfluenceSearchResult;
  if (!data.results?.length) {
    console.warn('[confluence] No pages matched CQL');
    return null;
  }

  const sections = data.results
    .filter(page => page.body?.storage?.value)
    .map(page => {
      const bodyText = stripHtml(page.body!.storage!.value!);
      return `## ${page.title}\n\n${bodyText}`;
    })
    .join('\n\n---\n\n');

  return sections || null;
}

/**
 * Returns concatenated plain text from Confluence, or null if skipped / failed.
 *
 * If CONFLUENCE_PAGE_IDS is set (comma-separated), those pages are fetched in order.
 * Otherwise uses CONFLUENCE_CQL search (default: ABL space + title contains Onboarding).
 */
export async function fetchConfluenceOnboardingContent(): Promise<string | null> {
  const baseUrl = (process.env.CONFLUENCE_BASE_URL ?? '').replace(/\/$/, '');
  const email = process.env.CONFLUENCE_EMAIL ?? '';
  const token = process.env.CONFLUENCE_API_TOKEN ?? '';

  if (!baseUrl || !email || !token) {
    return null;
  }

  const ttl = getCacheTtlMs();
  if (ttl > 0 && cache && Date.now() - cache.fetchedAt < ttl) {
    return cache.content;
  }

  const authHeader = `Basic ${Buffer.from(`${email}:${token}`, 'utf8').toString('base64')}`;
  const pageIds = parsePageIds(process.env.CONFLUENCE_PAGE_IDS);

  try {
    let content: string | null = null;

    if (pageIds.length > 0) {
      content = await fetchContentByIds(baseUrl, authHeader, pageIds);
    } else {
      const cql = process.env.CONFLUENCE_CQL ?? DEFAULT_CQL;
      const limit = process.env.CONFLUENCE_SEARCH_LIMIT ?? '10';
      content = await fetchContentByCql(baseUrl, authHeader, cql, limit);
    }

    if (!content) {
      return null;
    }

    if (ttl > 0) {
      cache = { content, fetchedAt: Date.now() };
    }
    return content;
  } catch (err) {
    console.error('[confluence] Fetch failed:', err);
    return null;
  }
}

export function clearConfluenceCache(): void {
  cache = null;
}

/** Prepends live Confluence text so the model prioritizes it over static onboarding copy. */
export function mergeConfluenceIntoSystemPrompt(fallback: string, confluenceContent: string): string {
  return (
    `## LIVE CONTENT FROM CONFLUENCE (fetched: ${new Date().toLocaleString()})\n` +
    `Prioritize this over the fallback knowledge below.\n\n${confluenceContent}\n\n---\n\n## FALLBACK KNOWLEDGE BASE\n${fallback}`
  );
}
