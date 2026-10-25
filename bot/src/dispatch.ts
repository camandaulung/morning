// Cloudflare cron trigger → GitHub Actions dispatch (Kiểu A).
// The Worker cron wakes up on time and asks GitHub Actions to run morning.yml.
// GitHub's own schedule stays as a (late, unreliable) backup. Never throws:
// every failure is returned as a human-readable issue so cron-runner.ts can
// alert the owner instead of failing silently (the 2026-10-13 PAT expiry went
// unnoticed for 12 days because errors were only console.error'd).

import type { Env } from './types';
import { fetchWithTimeout } from './http';

export type RunMode = 'morning' | 'evening';

export interface DispatchPlan {
  run_mode: RunMode;
  run_weekly: boolean;
  run_monthly: boolean;
}

export const EVENING_CRON = '0 15 * * *';
const VN_OFFSET_MS = 7 * 3600 * 1000;
const TOKEN_EXPIRY_WARN_DAYS = 14;

// Calendar date in Vietnam (UTC+7) as YYYY-MM-DD.
export function vnDate(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// Weekly/monthly used to ride only on GitHub's late native schedule; the
// morning dispatch now carries them on Sunday / the 1st (VN calendar).
export function planDispatch(cron: string, now: Date): DispatchPlan {
  if (cron === EVENING_CRON) return { run_mode: 'evening', run_weekly: false, run_monthly: false };
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return {
    run_mode: 'morning',
    run_weekly: vn.getUTCDay() === 0,
    run_monthly: vn.getUTCDate() === 1,
  };
}

// GitHub sends "2026-10-13 06:13:09 UTC" for PATs that have an expiry.
function tokenExpiryIssue(header: string | null, now: Date): string | null {
  if (!header) return null;
  const expiresAt = Date.parse(header.replace(' UTC', 'Z').replace(' ', 'T'));
  if (Number.isNaN(expiresAt)) return null;
  const daysLeft = Math.floor((expiresAt - now.getTime()) / 86400000);
  if (daysLeft > TOKEN_EXPIRY_WARN_DAYS) return null;
  return `GH_DISPATCH_TOKEN hết hạn sau ${daysLeft} ngày (${header}) — rotate sớm.`;
}

export async function dispatchWorkflow(env: Env, plan: DispatchPlan, now: Date): Promise<string[]> {
  if (!env.GH_DISPATCH_TOKEN) {
    return ['GH_DISPATCH_TOKEN chưa set trên Worker — cron không dispatch được, chỉ còn GitHub schedule (trễ vài giờ).'];
  }

  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/morning.yml/dispatches`;
  const inputs = {
    run_mode: plan.run_mode,
    run_weekly: String(plan.run_weekly),
    run_monthly: String(plan.run_monthly),
  };

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'caman-bot-cron',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main', inputs }),
    }, 10000);
    console.log(`[dispatch] ${JSON.stringify(inputs)} status=${res.status}`);

    const issues: string[] = [];
    if (res.status !== 204) {
      const body = (await res.text().catch(() => '')).slice(0, 200);
      issues.push(`Dispatch ${plan.run_mode} lỗi HTTP ${res.status}: ${body}`);
    }
    const expiry = tokenExpiryIssue(res.headers.get('github-authentication-token-expiration'), now);
    if (expiry) issues.push(expiry);
    return issues;
  } catch (e) {
    return [`Dispatch ${plan.run_mode} lỗi mạng: ${e instanceof Error ? e.message : String(e)}`];
  }
}
