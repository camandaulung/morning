import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('gemini generate() config fallbacks', () => {
  it('switches to gemini-flash-latest on a retired-model 404, then stays there', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('gemini-2.5-flash')) {
        return new Response(JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'This model models/gemini-2.5-flash is no longer available to new users.' } }));
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
    }));
    const { geminiChat } = await import('../llm/gemini');
    expect(await geminiChat('k', 'gemini-2.5-flash', 'sys', [], 'hi')).toBe('ok');
    expect(await geminiChat('k', 'gemini-2.5-flash', 'sys', [], 'hi again')).toBe('ok');
    expect(urls.map(u => u.split('/models/')[1])).toEqual([
      'gemini-2.5-flash:generateContent', 'gemini-flash-latest:generateContent', 'gemini-flash-latest:generateContent',
    ]);
  });

  it('sends the key in a header, not the URL', async () => {
    let init: RequestInit | undefined; let url = '';
    vi.stubGlobal('fetch', vi.fn(async (u: string, i: RequestInit) => { url = u; init = i;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })); }));
    const { geminiChat } = await import('../llm/gemini');
    await geminiChat('secret-key', 'gemini-3.8-flash', 'sys', [], 'hi');
    expect(url).not.toContain('secret-key');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
  });

  it('drops thinkingConfig when the model rejects it', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, i: RequestInit) => {
      const b = JSON.parse(String(i.body)); bodies.push(b);
      if (b.generationConfig?.thinkingConfig) {
        return new Response(JSON.stringify({ error: { code: 400, status: 'INVALID_ARGUMENT', message: 'thinkingBudget is not supported; use thinkingLevel' } }));
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'done' }] } }] }));
    }));
    const { geminiAgent } = await import('../llm/gemini');
    expect(await geminiAgent('k', 'gemini-3.8-flash', 'sys', [], 'hi', [], () => ({}))).toBe('done');
    expect(bodies).toHaveLength(2);
    expect(bodies[1].generationConfig.thinkingConfig).toBeUndefined();
  });
});
