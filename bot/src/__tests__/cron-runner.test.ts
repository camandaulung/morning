import { describe, it, expect, vi, afterEach } from 'vitest';
import { planDispatch, vnDate, dispatchWorkflow } from '../dispatch';
import { runCron } from '../cron-runner';
import type { Env } from '../types';

const env = {
  GH_REPO: 'camandaulung/morning',
  GH_DISPATCH_TOKEN: 'tok',
  SITE_BASE_URL: 'https://site.test/morning',
  TELEGRAM_BOT_TOKEN: 'bot',
  ALLOWED_CHAT_IDS: '111, 222',
} as unknown as Env;

// 2026-10-25 02:00 UTC = Sunday 09:00 VN
const SUNDAY_MORNING = new Date('2026-10-25T02:00:00Z');
// 2026-11-01 02:00 UTC = Sunday + 1st of month, 09:00 VN
const FIRST_OF_MONTH = new Date('2026-11-01T02:00:00Z');
const MONDAY_MORNING = new Date('2026-10-26T02:00:00Z');
// 2026-10-26 15:00 UTC = 22:00 VN same day
const MONDAY_EVENING = new Date('2026-10-26T15:00:00Z');

function res(status: number, headers: Record<string, string> = {}, body = '') {
  return new Response(body || null, { status, headers });
}

afterEach(() => vi.restoreAllMocks());

describe('vnDate', () => {
  it('rolls to next day after 17:00 UTC', () => {
    expect(vnDate(new Date('2026-10-25T17:30:00Z'))).toBe('2026-10-26');
    expect(vnDate(new Date('2026-10-25T16:59:00Z'))).toBe('2026-10-25');
  });
});

describe('planDispatch', () => {
  it('weekday morning → morning only', () => {
    expect(planDispatch('0 2 * * *', MONDAY_MORNING)).toEqual({ run_mode: 'morning', run_weekly: false, run_monthly: false });
  });
  it('Sunday morning → also weekly', () => {
    expect(planDispatch('0 2 * * *', SUNDAY_MORNING)).toEqual({ run_mode: 'morning', run_weekly: true, run_monthly: false });
  });
  it('1st of month → also monthly', () => {
    expect(planDispatch('0 2 * * *', FIRST_OF_MONTH)).toEqual({ run_mode: 'morning', run_weekly: true, run_monthly: true });
  });
  it('evening cron → evening, never weekly/monthly', () => {
    expect(planDispatch('0 15 * * *', FIRST_OF_MONTH)).toEqual({ run_mode: 'evening', run_weekly: false, run_monthly: false });
  });
});

describe('dispatchWorkflow', () => {
  const plan = { run_mode: 'morning' as const, run_weekly: true, run_monthly: false };

  it('204 → no issues, sends string inputs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res(204));
    vi.stubGlobal('fetch', fetchMock);
    expect(await dispatchWorkflow(env, plan, MONDAY_MORNING)).toEqual([]);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/camandaulung/morning/actions/workflows/morning.yml/dispatches');
    expect(JSON.parse(opts.body)).toEqual({ ref: 'main', inputs: { run_mode: 'morning', run_weekly: 'true', run_monthly: 'false' } });
  });

  it('401 (expired PAT) → reported issue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(401, {}, '{"message":"Bad credentials"}')));
    expect(await dispatchWorkflow(env, plan, MONDAY_MORNING)).toEqual([
      'Dispatch morning lỗi HTTP 401: {"message":"Bad credentials"}',
    ]);
  });

  it('token expiring within 14 days → warning even on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(204, { 'github-authentication-token-expiration': '2026-11-02 02:00:00 UTC' })));
    expect(await dispatchWorkflow(env, plan, MONDAY_MORNING)).toEqual([
      'GH_DISPATCH_TOKEN hết hạn sau 7 ngày (2026-11-02 02:00:00 UTC) — rotate sớm.',
    ]);
  });

  it('token far from expiry → no warning', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(204, { 'github-authentication-token-expiration': '2027-10-01 00:00:00 UTC' })));
    expect(await dispatchWorkflow(env, plan, MONDAY_MORNING)).toEqual([]);
  });

  it('missing token → issue without calling GitHub', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const issues = await dispatchWorkflow({ ...env, GH_DISPATCH_TOKEN: undefined } as Env, plan, MONDAY_MORNING);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('GH_DISPATCH_TOKEN chưa set');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('runCron', () => {
  function route(handlers: Record<string, () => Response>) {
    const fetchMock = vi.fn(async (url: string) => {
      const key = Object.keys(handlers).find(k => url.includes(k));
      return key ? handlers[key]() : res(404);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }
  const telegramCalls = (m: ReturnType<typeof route>) =>
    m.mock.calls.filter(([u]) => String(u).includes('api.telegram.org'));

  it('healthy evening → no alert', async () => {
    const m = route({
      'api.github.com': () => res(204),
      'cards.json': () => res(200, { 'content-type': 'application/json' }, JSON.stringify([{ date: '2026-10-26', tech: [{ title: 'a' }] }])),
    });
    await runCron(env, '0 15 * * *', MONDAY_EVENING);
    expect(telegramCalls(m)).toHaveLength(0);
  });

  it('evening with stale card → alert owner (first allowed id) with both issues', async () => {
    const m = route({
      'api.github.com': () => res(401, {}, 'Bad credentials'),
      'cards.json': () => res(200, { 'content-type': 'application/json' }, JSON.stringify([{ date: '2026-10-25' }])),
      'api.telegram.org': () => res(200, {}, '{"ok":true}'),
    });
    await runCron(env, '0 15 * * *', MONDAY_EVENING);
    const calls = telegramCalls(m);
    expect(calls).toHaveLength(1);
    const body = JSON.parse((calls[0][1] as RequestInit).body as string);
    expect(body.chat_id).toBe('111');
    expect(body.text).toContain('Dispatch evening lỗi HTTP 401');
    expect(body.text).toContain('Bản tin sáng 2026-10-26 chưa lên site (card mới nhất: 2026-10-25).');
  });

  it('evening with today card but 0 items → empty-card alert', async () => {
    const m = route({
      'api.github.com': () => res(204),
      'cards.json': () => res(200, { 'content-type': 'application/json' }, JSON.stringify([{ date: '2026-10-26', tech: [], finance: [] }])),
      'api.telegram.org': () => res(200, {}, '{"ok":true}'),
    });
    await runCron(env, '0 15 * * *', MONDAY_EVENING);
    const body = JSON.parse((telegramCalls(m)[0][1] as RequestInit).body as string);
    expect(body.text).toContain('Bản tin sáng 2026-10-26 rỗng (0 tin) — LLM lỗi/hết quota?');
  });

  it('morning cron does not run the published-card watchdog', async () => {
    const m = route({ 'api.github.com': () => res(204) });
    await runCron(env, '0 2 * * *', MONDAY_MORNING);
    expect(m.mock.calls.some(([u]) => String(u).includes('cards.json'))).toBe(false);
    expect(telegramCalls(m)).toHaveLength(0);
  });
});
