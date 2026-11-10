// Fetch + cache digest data (cards / weekly / monthly / config) from GH Pages
import type { DigestData, DailyCard, WeeklyCard, MonthlyCard } from './types';
import { fetchJson } from './http';

const TTL_SEC = 300; // 5 min
const DIGEST_TIMEOUT_MS = 10000;

interface DigestConfig { topics?: Record<string, unknown>; site?: Record<string, unknown>; }

function fetchDigestJson<T>(url: string): Promise<T | null> {
  return fetchJson<T>(url, { cf: { cacheEverything: true, cacheTtl: TTL_SEC } }, DIGEST_TIMEOUT_MS);
}

// Parsed digest kept for the life of the isolate (same TTL as the edge cache above).
// A Worker isolate serves many messages, and the agent loop reads the store several
// times per message — without this every chat message re-downloaded and re-parsed
// ~1 MB of JSON. Reusing the same objects also lets rag.ts keep its per-item token
// cache warm across messages.
let memo: { base: string; at: number; data: DigestData } | null = null;

export function resetDigestMemo(): void { memo = null; }

export async function loadDigest(base: string, now: number = Date.now()): Promise<DigestData> {
  if (memo && memo.base === base && now - memo.at < TTL_SEC * 1000) return memo.data;

  const [daily, weekly, monthly, config] = await Promise.all([
    fetchDigestJson<DailyCard[]>(`${base}/cards.json`),
    fetchDigestJson<WeeklyCard[]>(`${base}/weekly.json`),
    fetchDigestJson<MonthlyCard[]>(`${base}/monthly.json`),
    fetchDigestJson<DigestConfig>(`${base}/config.json`),
  ]);
  const data: DigestData = {
    daily:   daily   || [],
    weekly:  weekly  || [],
    monthly: monthly || [],
    config:  config  || { topics: {}, site: {} },
  };
  // Only a complete load is worth keeping — a failed fetch should be retried on
  // the next message, not served as "empty store" for 5 minutes.
  if (daily && weekly && monthly && config) memo = { base, at: now, data };
  return data;
}
