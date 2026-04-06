import type { SourceResult } from '../sources/types';
import type { ExtractionResult } from './types';
import { buildExtractionPrompt, getSystemPrompt } from './prompts';

function stripResponseWrapper(text: string): string {
  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Strip <think>...</think> tags
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  return cleaned.trim();
}

function validateExtractionResult(data: unknown): data is ExtractionResult {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.corridor === 'string' && Array.isArray(obj.routes);
}

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const model = process.env.LLM_MODEL || 'qwen/qwen3.6-plus:free';
  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '180000', 10);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 8000,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${body}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== 'string') {
      throw new Error('OpenRouter response missing choices[0].message.content');
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

function parseExtractionResponse(raw: string): ExtractionResult {
  const cleaned = stripResponseWrapper(raw);
  const parsed = JSON.parse(cleaned);

  if (!validateExtractionResult(parsed)) {
    throw new Error(
      'Invalid extraction result: missing required fields "corridor" or "routes"',
    );
  }

  return parsed as ExtractionResult;
}

export async function extractRouteData(
  sources: SourceResult[],
  origin?: string,
  destination?: string,
): Promise<ExtractionResult> {
  const systemPrompt = getSystemPrompt();
  const userPrompt = buildExtractionPrompt(sources, origin, destination);

  // First attempt
  const firstResponse = await callOpenRouter(systemPrompt, userPrompt);

  try {
    return parseExtractionResponse(firstResponse);
  } catch {
    // Retry once with stricter prompt
    const retryPrompt =
      userPrompt +
      '\n\nIMPORTANT: Respond with pure JSON only. No markdown, no explanation.';

    const secondResponse = await callOpenRouter(systemPrompt, retryPrompt);

    try {
      return parseExtractionResponse(secondResponse);
    } catch (retryError) {
      throw new Error(
        `Failed to extract route data after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
      );
    }
  }
}
