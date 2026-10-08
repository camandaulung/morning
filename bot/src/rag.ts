// RAG helper — pick the digest items the chatbot answers from.
// Understands day scopes ("hnay", "sáng nay", "hôm qua", "08/10"), overview
// questions ("hôm nay có tin gì") that should return a whole day's card, topic
// mentions ("tin tài chính", "github"), and accent-less typing ("gia vang").
// Never returns an empty context while the store has items: when nothing
// matches, it falls back to the latest card so the bot can still talk about it.
import type { DigestData, DigestItem, DailyCard, WeeklyCard, MonthlyCard } from './types';

const VN_OFFSET_MS = 7 * 3600 * 1000;
const OVERVIEW_TOP_K = 40;

// Folded (accent-less) so they match folded query tokens.
const STOPWORDS = new Set([
  'va','cua','voi','de','cho','la','co','bi','duoc','da','se','dang','mot','cac','nhung',
  'nay','do','ve','tu','trong','ngoai','tren','duoi','hoac','hay','khi','neu','thi','vi',
  'boi','gio','den','tai','theo','nhu','the','an','of','to','for','with','in',
  'on','at','and','or','but','is','are','was','were','be','have','has','had','toi','em','anh','chi',
  'gi','sao','the','nao','bao','nhe','khong','ko','ai','dau','lam','ra','can','oi','nhi',
  'a','u','vay','day','minh','ban','xem','doc','biet','hoi','noi','ke','cho','giup','voi',
]);

// Words that only express "give me the news" — removed before keyword scoring.
const OVERVIEW_WORDS = new Set([
  'tin','tuc','ban','digest','news','bai','post','dang','moi','nhat','vua','tong','hop','tom','tat',
  'liet','ke','diem','may','nhung','cac','het','tat','ca','gi','nao','hom','nay','qua','sang','toi',
  'trua','chieu','hnay','hqua','today','yesterday','latest','kho','ca','man','summary',
]);

const OVERVIEW_RE = /(tin gi|co gi|tom tat|tong hop|diem tin|ban tin|digest|liet ke|may tin|cac tin|nhung tin|tin nao|het tin|tat ca|vua post|vua dang|moi post|tin moi|summary|what.?s new)/;

type Tagged = DigestItem & { _srcDate: string; _field: string; _kind: 'daily' | 'rollup' };

export function fold(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

function tokens(s: string, extraStop?: Set<string>): Set<string> {
  return new Set(
    fold(s)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w) && !(extraStop && extraStop.has(w))),
  );
}

function vnDate(now: Date, minusDays = 0): string {
  return new Date(now.getTime() + VN_OFFSET_MS - minusDays * 86400000).toISOString().slice(0, 10);
}

type Scope = { date: string } | { maxAge: number } | null;

// Detect a time scope in the (folded) query.
export function detectScope(q: string, now: Date): Scope {
  if (/\b(hom nay|hnay|sang nay|trua nay|chieu nay|toi nay|today|vua post|vua dang|moi post|sang gio)\b/.test(q)) {
    return { date: vnDate(now) };
  }
  if (/\b(hom qua|hqua|yesterday)\b/.test(q)) return { date: vnDate(now, 1) };
  const dm = q.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
  if (dm) {
    const year = dm[3] || vnDate(now).slice(0, 4);
    return { date: `${year}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` };
  }
  if (/\b(tuan nay|tuan qua|this week|past week|7 ngay)\b/.test(q)) return { maxAge: 8 };
  if (/\b(thang nay|thang qua|this month|past month|30 ngay)\b/.test(q)) return { maxAge: 32 };
  if (/\b(trending)\b/.test(q)) return { maxAge: 8 };
  if (/\bmoi nhat\b/.test(q)) return { maxAge: 3 };
  return null;
}

function daysBetween(dateStr: string, todayVn: string): number {
  if (!dateStr) return 9999;
  const d = Date.parse(dateStr + 'T00:00:00Z');
  const t = Date.parse(todayVn + 'T00:00:00Z');
  if (isNaN(d)) return 9999;
  return Math.max(0, Math.round((t - d) / 86400000));
}

// Half-life 7 days: today=1.0, week ago=0.5, 2 weeks=0.25, month=~0.06
function recencyWeight(ageDays: number): number {
  return Math.pow(0.5, ageDays / 7);
}

function scoreItem(item: Tagged, queryTokens: Set<string>, queryFolded: string, ageDays: number): number {
  const bag = tokens(`${item.title || ''} ${item.name || ''} ${item.desc || ''} ${item.detail || ''} ${item.reason || ''} ${item.tagLabel || ''}`);
  let overlap = 0;
  for (const t of queryTokens) if (bag.has(t)) overlap++;
  const head = fold(`${item.title || ''} ${item.name || ''}`);
  const substrBoost = queryFolded && head.includes(queryFolded) ? 3 : 0;
  const base = overlap + substrBoost;
  if (base === 0) return 0;
  return base * recencyWeight(ageDays);
}

function listFields<T extends Record<string, unknown>>(obj: T): string[] {
  return Object.keys(obj).filter(k =>
    Array.isArray(obj[k]) && !['date','dayLabel','dateLabel','fromDate','toDate','monthLabel','weekLabel'].includes(k)
  );
}

function cardDate(card: DailyCard | WeeklyCard | MonthlyCard): string {
  return (card as DailyCard).date || (card as WeeklyCard | MonthlyCard).toDate || '';
}

// output_field → section label, from the site's config.json.
function topicLabels(data: DigestData): Record<string, string> {
  const out: Record<string, string> = {};
  const topics = (data.config && data.config.topics) || {};
  for (const t of Object.values(topics) as { output_field?: string; section_label?: string }[]) {
    if (t && t.output_field) out[t.output_field] = t.section_label || t.output_field;
  }
  return out;
}

// Fields whose label or name the query mentions ("tin tài chính" → finance).
function detectTopics(qFolded: string, labels: Record<string, string>, fields: Set<string>): Set<string> {
  const hits = new Set<string>();
  for (const f of fields) {
    const label = fold(labels[f] || '');
    const words = [fold(f), label, ...label.split(/[\s/&]+/).filter(w => w.length > 3)];
    if (words.some(w => w && new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(qFolded))) hits.add(f);
  }
  return hits;
}

function sortByDateThenOrder(items: Tagged[]): Tagged[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (b.it._srcDate || '').localeCompare(a.it._srcDate || '') || a.i - b.i)
    .map(x => x.it);
}

export function retrieveContext(data: DigestData, query: string, topK = 12, now: Date = new Date()): DigestItem[] {
  const qFolded = fold(query).trim();
  const todayVn = vnDate(now);
  const labels = topicLabels(data);
  const pool: Tagged[] = [];

  const collect = (arr: (DailyCard | WeeklyCard | MonthlyCard)[], kind: Tagged['_kind']) => {
    for (const card of arr || []) {
      const srcDate = cardDate(card);
      for (const f of listFields(card as unknown as Record<string, unknown>)) {
        const items = (card as unknown as Record<string, DigestItem[]>)[f];
        for (const it of items) if (it?.title || it?.name) pool.push({ ...it, _srcDate: srcDate, _field: f, _kind: kind });
      }
    }
  };
  collect(data.daily, 'daily'); collect(data.weekly, 'rollup'); collect(data.monthly, 'rollup');

  // Dedup by URL, keep first (newest, since data is newest-first)
  const seen = new Set<string>();
  let uniq: Tagged[] = [];
  for (const it of pool) {
    const k = (it.url || it.title || it.name || '').toLowerCase();
    if (k && !seen.has(k)) { seen.add(k); uniq.push(it); }
  }
  if (!uniq.length) return [];

  const finish = (items: Tagged[], k: number) => items.slice(0, k).map(it => stripInternal(it, labels));

  // Topic filter ("tin tài chính", "github gamedev")
  const topicHits = detectTopics(qFolded, labels, new Set(uniq.map(it => it._field)));
  if (topicHits.size) {
    const narrowed = uniq.filter(it => topicHits.has(it._field));
    if (narrowed.length) uniq = narrowed;
  }

  // Time scope
  const scope = detectScope(qFolded, now);
  let working = uniq;
  if (scope && 'date' in scope) {
    let day = uniq.filter(it => it._kind === 'daily' && it._srcDate === scope.date);
    // "hôm nay" before today's card exists (or 0-9h) → latest daily card instead
    if (!day.length && scope.date === todayVn) {
      const latest = (data.daily || []).map(c => c.date).find(Boolean);
      day = uniq.filter(it => it._kind === 'daily' && it._srcDate === latest);
    }
    if (day.length) working = day;
  } else if (scope && 'maxAge' in scope) {
    const recent = uniq.filter(it => daysBetween(it._srcDate, todayVn) <= scope.maxAge);
    if (recent.length) working = recent;
  }

  const qTokens = tokens(query, OVERVIEW_WORDS);
  for (const f of topicHits) for (const w of tokens(`${f} ${labels[f] || ''}`)) qTokens.delete(w);
  const isOverview = OVERVIEW_RE.test(qFolded) || (qTokens.size === 0 && (scope !== null || topicHits.size > 0));

  // Overview / scope-only question → the whole slice, newest first, in card order
  if (isOverview || qTokens.size === 0) {
    const k = isOverview || scope || topicHits.size ? Math.max(topK, OVERVIEW_TOP_K) : topK;
    return finish(sortByDateThenOrder(working), k);
  }

  const scored = working
    .map(it => ({ it, score: scoreItem(it, qTokens, qFolded, daysBetween(it._srcDate, todayVn)) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.it);

  if (scored.length) return finish(scored, topK);
  // Nothing matched → still give the bot the newest items of the current slice
  return finish(sortByDateThenOrder(working), topK);
}

function stripInternal(it: Tagged, labels: Record<string, string>): DigestItem {
  const { _srcDate, _field, _kind: _drop, ...rest } = it;
  return { ...rest, date: _srcDate, topic: labels[_field] || _field };
}

function shortDate(iso?: string): string {
  const m = (iso || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : '';
}

export function formatContextForPrompt(items: DigestItem[]): string {
  if (!items.length) return '(Không có tin liên quan trong digest gần đây.)';
  return items.map((it, i) => {
    const title = it.title || it.name || '';
    const meta = [shortDate(it.date), it.topic, it.stars ? `⭐ ${it.stars}` : ''].filter(Boolean).join(' · ');
    const desc = (it.desc || it.reason || '').slice(0, 150);
    const detail = (it.detail || '').slice(0, 400);
    return `[${i+1}] ${meta ? `(${meta}) ` : ''}${title}\n    URL: ${it.url || ''}\n    ${desc}${detail ? `\n    Chi tiết: ${detail}` : ''}`;
  }).join('\n');
}

// Header for the system prompt: what "today" is and what the store holds.
export function digestOverview(data: DigestData, now: Date = new Date()): string {
  const daily = data.daily || [];
  const latest = daily[0];
  const dates = daily.map(c => c.date).filter(Boolean);
  const count = latest ? listFields(latest as unknown as Record<string, unknown>)
    .reduce((n, f) => n + ((latest as unknown as Record<string, unknown[]>)[f] || []).length, 0) : 0;
  return [
    `Hôm nay (giờ VN): ${vnDate(now)}.`,
    latest ? `Bản tin mới nhất trong kho: ${latest.date} (${count} tin).` : 'Kho chưa có bản tin.',
    dates.length ? `Kho có ${dates.length} bản tin ngày, từ ${dates[dates.length - 1]} đến ${dates[0]}, cộng tổng kết tuần/tháng.` : '',
  ].filter(Boolean).join('\n');
}
