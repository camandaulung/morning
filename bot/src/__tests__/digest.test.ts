import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadDigest, resetDigestMemo } from '../digest';

const BASE = 'https://example.test/morning';
const FILES: Record<string, unknown> = {
  'cards.json': [{ date: '2026-10-08', tech: [{ title: 'Tin A', url: 'https://a.com' }] }],
  'weekly.json': [],
  'monthly.json': [],
  'config.json': { topics: {}, site: {} },
};

function stubFetch(broken: string[] = []) {
  const mock = vi.fn(async (url: string) => {
    const name = String(url).split('/').pop()!;
    if (broken.includes(name)) return new Response('down', { status: 503 });
    return new Response(JSON.stringify(FILES[name]));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('loadDigest memo', () => {
  beforeEach(() => resetDigestMemo());
  afterEach(() => vi.unstubAllGlobals());

  it('reuses the parsed store within the TTL instead of refetching', async () => {
    const fetchMock = stubFetch();
    const first = await loadDigest(BASE, 1_000);
    const second = await loadDigest(BASE, 1_000 + 299_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(second).toBe(first);            // same objects → rag token cache stays warm
  });

  it('refetches once the TTL has passed', async () => {
    const fetchMock = stubFetch();
    await loadDigest(BASE, 1_000);
    await loadDigest(BASE, 1_000 + 301_000);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it('does not keep a partial load — the next message retries', async () => {
    const failing = stubFetch(['cards.json']);
    const partial = await loadDigest(BASE, 1_000);
    expect(partial.daily).toEqual([]);
    expect(failing).toHaveBeenCalledTimes(4);

    const healthy = stubFetch();
    const full = await loadDigest(BASE, 2_000);
    expect(healthy).toHaveBeenCalledTimes(4);
    expect(full.daily).toHaveLength(1);
  });

  it('keeps a separate store per site base URL', async () => {
    const fetchMock = stubFetch();
    await loadDigest(BASE, 1_000);
    await loadDigest('https://other.test', 1_000);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
});
