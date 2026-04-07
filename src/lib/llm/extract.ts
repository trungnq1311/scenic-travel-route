import type { SourceResult } from '../sources/types';
import type { ExtractionResult } from './types';
import { buildExtractionPrompt, getSystemPrompt } from './prompts';

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModelCandidates(): string[] {
  const primaryModel = process.env.LLM_MODEL || 'qwen/qwen3.6-plus:free';
  const fallbackModels = (process.env.LLM_FALLBACK_MODELS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== primaryModel);

  return [primaryModel, ...fallbackModels];
}

function parseRetryAfterMs(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number.parseInt(retryAfterHeader, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const absoluteTime = Date.parse(retryAfterHeader);
  if (!Number.isNaN(absoluteTime)) {
    const delay = absoluteTime - Date.now();
    return delay > 0 ? delay : 0;
  }

  return null;
}

function getRetryDelayMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  const baseMs = Number.parseInt(process.env.OPENROUTER_RETRY_BASE_MS || '', 10);
  const retryBaseMs = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : DEFAULT_RETRY_BASE_MS;

  return retryBaseMs * 2 ** attempt;
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'AbortError' ||
    error.name === 'TypeError' ||
    error.message.includes('fetch failed')
  );
}

function getMaxRetries(): number {
  const parsed = Number.parseInt(process.env.OPENROUTER_MAX_RETRIES || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MAX_RETRIES;
  }
  return parsed;
}

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

  const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS || '180000', 10);

  const maxRetries = getMaxRetries();
  const modelCandidates = getModelCandidates();
  let lastError: Error | null = null;

  for (const model of modelCandidates) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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
          const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

          if (!isRetryable || attempt === maxRetries) {
            lastError = new Error(
              `OpenRouter API error (${response.status}) [model=${model}]: ${body}`,
            );
            break;
          }

          const delayMs = getRetryDelayMs(attempt, response.headers.get('retry-after'));
          await sleep(delayMs);
          continue;
        }

        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;

        if (typeof content !== 'string') {
          throw new Error('OpenRouter response missing choices[0].message.content');
        }

        return content;
      } catch (error) {
        if (!isRetryableFetchError(error) || attempt === maxRetries) {
          lastError =
            error instanceof Error
              ? new Error(`OpenRouter request failed [model=${model}]: ${error.message}`)
              : new Error(`OpenRouter request failed [model=${model}]: ${String(error)}`);
          break;
        }

        const delayMs = getRetryDelayMs(attempt, null);
        await sleep(delayMs);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw lastError ?? new Error('OpenRouter request failed after retries');
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
