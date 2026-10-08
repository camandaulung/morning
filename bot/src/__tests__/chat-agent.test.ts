import { describe, it, expect, vi, afterEach } from 'vitest';
import { retrieveContext, detectScope, fold, digestOverview } from '../rag';
import { executeDigestTool } from '../digest-tools';
import { geminiAgent } from '../llm/gemini';
import type { DigestData } from '../types';

// 2026-10-08 10:58 VN = 03:58 UTC
const NOW = new Date('2026-10-08T03:58:00Z');

const data: DigestData = {
  daily: [
    {
      date: '2026-10-08', dayLabel: 'Thứ Năm',
      finance: [
        { title: '💰 Giá vàng tụt xuống mức thấp nhất 2 tháng', url: 'https://x.vn/vang', desc: 'Vàng SJC giảm mạnh.' },
        { title: '🏠 Lãi suất vay mua nhà ở xã hội 6,5%/năm', url: 'https://x.vn/nha', desc: 'Gói vay ưu đãi.' },
      ],
      tech: [{ title: '🚀 Microsoft đại tu thanh tìm kiếm Windows 11', url: 'https://x.vn/win', desc: 'Search mới.' }],
    },
    {
      date: '2026-10-07', dayLabel: 'Thứ Tư',
      gamedev: [{ title: '🕹️ Donchitos/Claude-Code-Game-Studios', url: 'https://github.com/Donchitos/Claude-Code-Game-Studios', desc: 'Game studio bằng Claude Code.', stars: '25.8K+' }],
      finance: [{ title: '📈 VN-Index vượt 1.700 điểm', url: 'https://x.vn/vni', desc: 'Chứng khoán tăng.' }],
    },
  ],
  weekly: [],
  monthly: [],
  config: { topics: {
    finance_market: { output_field: 'finance', section_label: 'Tài chính' },
    tech_gadget: { output_field: 'tech', section_label: 'Tech & Gadget' },
    gamedev_repos: { output_field: 'gamedev', section_label: 'GitHub GameDev' },
  } },
};

describe('rag — day scope + overview', () => {
  it('detects hnay / sáng nay / vừa post as today (VN time)', () => {
    for (const q of ['đọc được mấy tin vừa post hnay ko', 'uh a hỏi tin sáng nay', 'hom nay co gi']) {
      expect(detectScope(fold(q), NOW)).toEqual({ date: '2026-10-08' });
    }
    expect(detectScope(fold('hôm qua'), NOW)).toEqual({ date: '2026-10-07' });
    expect(detectScope(fold('tin ngày 7/10'), NOW)).toEqual({ date: '2026-10-07' });
  });

  it('returns the whole of today\'s card for "tin sáng nay"', () => {
    const items = retrieveContext(data, 'uh a hỏi tin sáng nay', 10, NOW);
    expect(items.map(i => i.url)).toEqual(['https://x.vn/vang', 'https://x.vn/nha', 'https://x.vn/win']);
    expect(items[0]).toMatchObject({ date: '2026-10-08', topic: 'Tài chính' });
  });

  it('matches accent-less queries', () => {
    expect(retrieveContext(data, 'gia vang', 5, NOW)[0].url).toBe('https://x.vn/vang');
  });

  it('filters by topic mention', () => {
    const items = retrieveContext(data, 'tin tài chính', 10, NOW);
    expect(items.every(i => i.topic === 'Tài chính')).toBe(true);
    expect(items).toHaveLength(3);
  });

  it('falls back to newest items instead of empty context', () => {
    expect(retrieveContext(data, 'zzzz qqqq', 2, NOW)).toHaveLength(2);
  });

  it('overview header names today and latest card', () => {
    const o = digestOverview(data, NOW);
    expect(o).toContain('2026-10-08');
    expect(o).toContain('3 tin');
  });
});

describe('digest tools', () => {
  it('get_digest today returns all items of the latest card', () => {
    const r = executeDigestTool('get_digest', { date: 'today' }, data, NOW) as { count: number; date: string };
    expect(r).toMatchObject({ date: '2026-10-08', count: 3 });
  });

  it('get_digest with topic filter', () => {
    const r = executeDigestTool('get_digest', { date: '2026-10-07', topic: 'github' }, data, NOW) as { items: { title: string; stars?: string }[] };
    expect(r.items).toHaveLength(1);
    expect(r.items[0].stars).toBe('25.8K+');
  });

  it('get_digest unknown date lists available dates', () => {
    const r = executeDigestTool('get_digest', { date: '2026-01-01' }, data, NOW) as { available_dates: string[] };
    expect(r.available_dates).toEqual(['2026-10-08', '2026-10-07']);
  });

  it('search_news finds older items by keyword', () => {
    const r = executeDigestTool('search_news', { query: 'claude game' }, data, NOW) as { items: { url: string }[] };
    expect(r.items[0].url).toBe('https://github.com/Donchitos/Claude-Code-Game-Studios');
  });
});

describe('geminiAgent loop', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('executes a function call then returns the final text', async () => {
    const replies = [
      { candidates: [{ content: { parts: [{ functionCall: { name: 'get_digest', args: { date: 'today' } }, thoughtSignature: 'sig' }] } }] },
      { candidates: [{ content: { parts: [{ text: 'Sáng nay có 3 tin.' }] } }] },
    ];
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(replies.shift()));
    }));
    const exec = vi.fn(() => ({ count: 3 }));
    const out = await geminiAgent('k', 'm', 'sys', [], 'tin sáng nay', [], exec);
    expect(out).toBe('Sáng nay có 3 tin.');
    expect(exec).toHaveBeenCalledWith('get_digest', { date: 'today' });
    // model turn echoed verbatim (thought signature kept) + function response sent back
    const second = bodies[1].contents;
    expect(second[1]).toEqual({ role: 'model', parts: [{ functionCall: { name: 'get_digest', args: { date: 'today' } }, thoughtSignature: 'sig' }] });
    expect(second[2].parts[0].functionResponse).toEqual({ name: 'get_digest', response: { result: { count: 3 } } });
  });

  it('returns null on API error so the caller can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'quota' } }))));
    expect(await geminiAgent('k', 'm', 'sys', [], 'hi', [], () => ({}))).toBeNull();
  });
});
