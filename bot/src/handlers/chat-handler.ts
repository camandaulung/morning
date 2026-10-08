// Free-text chat: Gemini agent with digest tools (reads the whole Cá Mặn store
// on demand) + memory. Fallbacks: one-shot Gemini with prefetched context, then
// OpenAI — the user always gets an answer grounded in the digest.
import type { Env } from '../types';
import { sendLongMessage, sendChatAction } from '../telegram';
import { getHistory, appendHistory } from '../memory';
import { geminiAgent, geminiChat } from '../llm/gemini';
import { openaiChat } from '../llm/openai';
import { systemPrompt } from '../llm/persona';
import { retrieveContext, formatContextForPrompt, digestOverview } from '../rag';
import { DIGEST_TOOL_DECLARATIONS, executeDigestTool } from '../digest-tools';
import { loadDigest } from '../digest';

const PREFETCH_TOP_K = 10;

export async function handleChat(trimmed: string, chatId: number, userId: number, env: Env, token: string): Promise<void> {
  const [history, data] = await Promise.all([
    getHistory(env.STATE, userId),
    loadDigest(env.SITE_BASE_URL),
  ]);
  const now = new Date();
  // Prefetch: likely-relevant items up front so simple questions need no tool call.
  const prefetch = formatContextForPrompt(retrieveContext(data, trimmed, PREFETCH_TOP_K, now));
  const system = systemPrompt(env.SITE_BASE_URL)
    + `\n\nKHO TIN:\n${digestOverview(data, now)}`
    + `\n\nGỢI Ý BAN ĐẦU (tin có thể liên quan, lấy sẵn từ kho — chưa đủ thì gọi tool):\n${prefetch}`;

  let reply = await geminiAgent(
    env.GEMINI_API_KEY, env.GEMINI_MODEL, system, history, trimmed,
    DIGEST_TOOL_DECLARATIONS, (name, args) => executeDigestTool(name, args, data, now),
  );
  if (!reply) {
    await sendChatAction(token, chatId, 'typing').catch(() => {});
    reply = await geminiChat(env.GEMINI_API_KEY, env.GEMINI_MODEL, system, history, trimmed);
  }
  if (!reply) {
    // Gemini down/erroring — fall back to OpenAI so the user still gets an answer.
    reply = await openaiChat(env.OPENAI_API_KEY, env.OPENAI_CHAT_MODEL, system, history, trimmed);
  }
  const finalReply = reply || '😅 Em đang hơi lag, thử lại giúp em nhé.';

  await sendLongMessage(token, chatId, finalReply);
  if (reply) await appendHistory(env.STATE, userId, trimmed, reply, history);
}
