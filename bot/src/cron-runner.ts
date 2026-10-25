// Scheduled handler body: dispatch morning.yml, then (evening only) verify that
// today's morning card actually reached the site. Any issue → Telegram alert to
// the owner (first id in ALLOWED_CHAT_IDS). Never throws.

import type { Env, DailyCard } from './types';
import { dispatchWorkflow, planDispatch, vnDate } from './dispatch';
import { fetchJson } from './http';
import { sendMessage, esc, getWebhookUrl, setWebhook } from './telegram';

// A failed setWebhook (Telegram once could not resolve *.workers.dev during a
// deploy) leaves the bot with NO webhook — chat goes silent until the next
// deploy. Every cron run re-registers it if it drifted.
export async function ensureWebhook(env: Env): Promise<string[]> {
  if (!env.WORKER_URL) return [];
  const expected = `${env.WORKER_URL}/webhook`;
  const current = await getWebhookUrl(env.TELEGRAM_BOT_TOKEN);
  if (current === expected) return [];
  const fixed = await setWebhook(env.TELEGRAM_BOT_TOKEN, expected, env.TELEGRAM_WEBHOOK_SECRET);
  return [fixed
    ? `Webhook bị lệch ("${current ?? 'không đọc được'}") — đã đăng ký lại ${expected}.`
    : `Webhook lệch ("${current ?? 'không đọc được'}") và đăng ký lại thất bại — bot chat đang không nhận tin.`];
}

// Catches every morning-pipeline failure (dispatch, workflow, Gemini, push),
// not just dispatch — runs at 22h VN so the 9h run has had 13h to land.
export async function checkMorningPublished(env: Env, now: Date): Promise<string[]> {
  const today = vnDate(now);
  const cards = await fetchJson<DailyCard[]>(`${env.SITE_BASE_URL}/cards.json?t=${now.getTime()}`);
  if (!cards) return [`Không đọc được ${env.SITE_BASE_URL}/cards.json — site down hoặc JSON hỏng.`];
  const latest = cards[0]?.date || '(trống)';
  if (latest !== today) return [`Bản tin sáng ${today} chưa lên site (card mới nhất: ${latest}).`];
  const items = Object.values(cards[0]).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  if (items === 0) return [`Bản tin sáng ${today} rỗng (0 tin) — LLM lỗi/hết quota?`];
  return [];
}

export async function alertOwner(env: Env, issues: string[]): Promise<void> {
  const owner = (env.ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).find(Boolean);
  if (!owner || !env.TELEGRAM_BOT_TOKEN) {
    console.error('[cron] cannot alert — no owner chat id / bot token:', issues);
    return;
  }
  const text = `⚠️ <b>Cá Mặn cron có vấn đề</b>\n\n${issues.map(i => `• ${esc(i)}`).join('\n')}`;
  await sendMessage(env.TELEGRAM_BOT_TOKEN, owner, text);
}

export async function runCron(env: Env, cron: string, now: Date): Promise<void> {
  try {
    const plan = planDispatch(cron, now);
    const issues = await dispatchWorkflow(env, plan, now);
    issues.push(...await ensureWebhook(env));
    if (plan.run_mode === 'evening') issues.push(...await checkMorningPublished(env, now));
    if (issues.length) await alertOwner(env, issues);
  } catch (e) {
    console.error('[cron] unexpected:', e);
  }
}
