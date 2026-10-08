// Tools the chat agent can call to read the Cá Mặn digest store (cards.json +
// weekly.json + monthly.json). Declarations follow Gemini function-calling
// schema; executeDigestTool runs them locally over the already-loaded data.
import type { DigestData, DigestItem } from './types';
import { retrieveContext, fold } from './rag';

const VN_OFFSET_MS = 7 * 3600 * 1000;

export const DIGEST_TOOL_DECLARATIONS = [
  {
    name: 'get_digest',
    description: 'Lấy toàn bộ tin của bản tin Cá Mặn một ngày cụ thể (mặc định: bản tin mới nhất). Dùng khi người dùng hỏi "hôm nay/sáng nay/hôm qua/ngày X có tin gì", "tóm tắt bản tin".',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'YYYY-MM-DD, hoặc "today", "yesterday", "latest". Bỏ trống = latest.' },
        topic: { type: 'STRING', description: 'Tuỳ chọn: lọc theo chủ đề, ví dụ "Tài chính", "GitHub GameDev", "Gaming".' },
      },
    },
  },
  {
    name: 'search_news',
    description: 'Tìm tin trong kho 30 ngày (cả tổng kết tuần/tháng) theo từ khoá, có thể lọc chủ đề và số ngày gần đây. Dùng cho câu hỏi về một sự kiện, công ty, người, sản phẩm, repo cụ thể.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Từ khoá tìm kiếm (tiếng Việt có/không dấu hoặc tiếng Anh).' },
        topic: { type: 'STRING', description: 'Tuỳ chọn: chủ đề để lọc.' },
        days: { type: 'INTEGER', description: 'Tuỳ chọn: chỉ lấy tin trong N ngày gần nhất.' },
        limit: { type: 'INTEGER', description: 'Số kết quả tối đa (mặc định 10, tối đa 25).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_rollup',
    description: 'Lấy bản tổng kết tuần hoặc tháng gần nhất của Cá Mặn.',
    parameters: {
      type: 'OBJECT',
      properties: {
        kind: { type: 'STRING', enum: ['week', 'month'], description: 'week hoặc month.' },
      },
      required: ['kind'],
    },
  },
];

function vnDate(now: Date, minusDays = 0): string {
  return new Date(now.getTime() + VN_OFFSET_MS - minusDays * 86400000).toISOString().slice(0, 10);
}

function topicLabels(data: DigestData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of Object.values((data.config && data.config.topics) || {}) as { output_field?: string; section_label?: string }[]) {
    if (t && t.output_field) out[t.output_field] = t.section_label || t.output_field;
  }
  return out;
}

function matchesTopic(field: string, label: string, topic?: string): boolean {
  if (!topic) return true;
  const t = fold(topic).trim();
  return fold(field).includes(t) || fold(label).includes(t) || t.includes(fold(field));
}

// Compact item shape returned to the model — keeps tokens low, keeps URL exact.
function slim(it: DigestItem & { date?: string; topic?: string }) {
  return {
    title: it.title || it.name || '',
    topic: it.topic,
    date: it.date,
    desc: it.desc || '',
    detail: it.detail ? it.detail.slice(0, 500) : undefined,
    reason: it.reason || undefined,
    stars: it.stars || undefined,
    source: it.source || undefined,
    url: it.url || '',
  };
}

function itemsOfCard(card: Record<string, unknown>, labels: Record<string, string>, date: string, topic?: string) {
  const out: ReturnType<typeof slim>[] = [];
  for (const [field, arr] of Object.entries(card)) {
    if (!Array.isArray(arr)) continue;
    const label = labels[field] || field;
    if (!matchesTopic(field, label, topic)) continue;
    for (const it of arr as DigestItem[]) {
      if (it && (it.title || it.name)) out.push(slim({ ...it, date, topic: label }));
    }
  }
  return out;
}

export function executeDigestTool(name: string, args: Record<string, unknown>, data: DigestData, now: Date = new Date()): unknown {
  const labels = topicLabels(data);
  const daily = data.daily || [];

  if (name === 'get_digest') {
    let date = String(args.date || 'latest').trim().toLowerCase();
    if (date === 'today') date = vnDate(now);
    if (date === 'yesterday') date = vnDate(now, 1);
    let card = date === 'latest' ? daily[0] : daily.find(c => c.date === date);
    let note: string | undefined;
    if (!card && date === vnDate(now) && daily[0]) {
      card = daily[0];
      note = `Chưa có bản tin ngày ${date}; đây là bản tin mới nhất (${card.date}).`;
    }
    if (!card) {
      return { error: `Không có bản tin ngày ${date}.`, available_dates: daily.map(c => c.date).slice(0, 30) };
    }
    const items = itemsOfCard(card as unknown as Record<string, unknown>, labels, card.date, args.topic as string | undefined);
    return { date: card.date, dayLabel: card.dayLabel, note, count: items.length, items };
  }

  if (name === 'search_news') {
    const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
    const days = Number(args.days) || 0;
    const topic = args.topic as string | undefined;
    const found = retrieveContext(data, String(args.query || ''), 60, now)
      .filter(it => matchesTopic('', it.topic || '', topic))
      .filter(it => !days || !it.date || it.date >= vnDate(now, days))
      .slice(0, limit)
      .map(slim);
    return { query: args.query, count: found.length, items: found };
  }

  if (name === 'get_rollup') {
    const arr = (args.kind === 'month' ? data.monthly : data.weekly) || [];
    const card = arr[0] as unknown as Record<string, unknown> | undefined;
    if (!card) return { error: `Chưa có tổng kết ${args.kind === 'month' ? 'tháng' : 'tuần'}.` };
    const label = String(card.weekLabel || card.monthLabel || '');
    return { label, from: card.fromDate, to: card.toDate, items: itemsOfCard(card, labels, String(card.toDate || '')) };
  }

  return { error: `Unknown tool: ${name}` };
}
