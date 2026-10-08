// Gemini 2.5 flash — primary LLM for cheap fast chat + vision (photo describe/OCR)
import type { Msg } from '../types';
import { fetchWithTimeout } from '../http';

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const LLM_TIMEOUT_MS = 20000;

interface GeminiPart { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string }; }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[]; }
interface GeminiCandidate { content?: { parts?: GeminiPart[] }; finishReason?: string; }
interface GeminiResp { candidates?: GeminiCandidate[]; error?: { message: string }; }

function extractText(j: GeminiResp): string | null {
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
  return text || null;
}

export async function geminiChat(
  apiKey: string, model: string, system: string, history: Msg[], userText: string,
): Promise<string | null> {
  const contents: GeminiContent[] = [];
  for (const m of history) {
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] });
  }
  contents.push({ role: 'user', parts: [{ text: userText }] });

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
  };

  try {
    const r = await fetchWithTimeout(`${API}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, LLM_TIMEOUT_MS);
    const j = await r.json() as GeminiResp;
    if (j.error) { console.error('[gemini]', j.error.message); return null; }
    return extractText(j);
  } catch (e) {
    console.error('[gemini] fetch error:', e);
    return null;
  }
}

// Describe/OCR an image. base64Image = raw base64 (no data: prefix).
export async function geminiDescribeImage(
  apiKey: string, model: string, base64Image: string, mimeType: string, question: string,
): Promise<string | null> {
  const contents: GeminiContent[] = [{
    role: 'user',
    parts: [
      { text: question },
      { inlineData: { mimeType, data: base64Image } },
    ],
  }];
  const body = { contents, generationConfig: { temperature: 0.4, maxOutputTokens: 512 } };

  try {
    const r = await fetchWithTimeout(`${API}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, LLM_TIMEOUT_MS);
    const j = await r.json() as GeminiResp;
    if (j.error) { console.error('[gemini vision]', j.error.message); return null; }
    return extractText(j);
  } catch (e) {
    console.error('[gemini vision] fetch error:', e);
    return null;
  }
}

// ── Agent loop: Gemini function calling ──────────────────────────────────────
// The model decides which tools to call (possibly several, over several steps);
// we run them locally and feed results back until it answers in text. Model
// parts are echoed back verbatim so Gemini 2.5 thought signatures survive.

interface AgentPart {
  text?: string;
  thought?: boolean;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  [k: string]: unknown;
}
interface AgentContent { role: 'user' | 'model'; parts: AgentPart[]; }

export type ToolExecutor = (name: string, args: Record<string, unknown>) => unknown | Promise<unknown>;

export async function geminiAgent(
  apiKey: string, model: string, system: string, history: Msg[], userText: string,
  tools: unknown[], execute: ToolExecutor, opts: { maxSteps?: number; budgetMs?: number } = {},
): Promise<string | null> {
  const maxSteps = opts.maxSteps ?? 4;
  const deadline = Date.now() + (opts.budgetMs ?? 25000);
  const contents: AgentContent[] = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }],
  }));
  contents.push({ role: 'user', parts: [{ text: userText }] });

  for (let step = 0; step <= maxSteps; step++) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) { console.error('[gemini agent] out of time budget'); return null; }
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      // Last step: no tools, force a text answer from what was gathered.
      ...(step < maxSteps ? { tools: [{ functionDeclarations: tools }] } : {}),
      generationConfig: { temperature: 0.5, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 1024 } },
    };
    let j: { candidates?: { content?: { parts?: AgentPart[] } }[]; error?: { message: string } };
    try {
      const r = await fetchWithTimeout(`${API}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }, Math.min(LLM_TIMEOUT_MS, remaining));
      j = await r.json();
    } catch (e) {
      console.error('[gemini agent] fetch error:', e);
      return null;
    }
    if (j.error) { console.error('[gemini agent]', j.error.message); return null; }

    const parts = j.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) {
      const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
      return text || null;
    }

    contents.push({ role: 'model', parts });
    const responses: AgentPart[] = [];
    for (const p of calls) {
      const { name, args = {} } = p.functionCall!;
      let result: unknown;
      try { result = await execute(name, args); }
      catch (e) { result = { error: e instanceof Error ? e.message : String(e) }; }
      console.log(`[gemini agent] step ${step} → ${name}(${JSON.stringify(args)})`);
      responses.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return null;
}
