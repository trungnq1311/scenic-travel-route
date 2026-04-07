export interface RouteForSynthesis {
  id: string;
  name: string;
  description: string;
  primaryRoad: string;
  distanceKm: number;
  durationMinutes: number;
  scenicSegments: { name: string; description: string }[];
  pois: { name: string; type: string; description: string }[];
}

export interface VibeSummary {
  routeId: string;
  vibeSummary: string;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getModelCandidates(): string[] {
  const primaryModel = process.env.LLM_MODEL || "qwen/qwen3.6-plus:free";
  const fallbackModels = (process.env.LLM_FALLBACK_MODELS || "")
    .split(",")
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

  const baseMs = Number.parseInt(process.env.OPENROUTER_RETRY_BASE_MS || "", 10);
  const retryBaseMs = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : DEFAULT_RETRY_BASE_MS;

  return retryBaseMs * 2 ** attempt;
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "AbortError" ||
    error.name === "TypeError" ||
    error.message.includes("fetch failed")
  );
}

function getMaxRetries(): number {
  const parsed = Number.parseInt(process.env.OPENROUTER_MAX_RETRIES || "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MAX_RETRIES;
  }
  return parsed;
}

function buildPrompt(routes: RouteForSynthesis[]): string {
  const routeDescriptions = routes
    .map((route, index) => {
      const segments = route.scenicSegments
        .map((s) => `${s.name}: ${s.description}`)
        .join("; ");
      const pois = route.pois
        .map((p) => `${p.name} (${p.type}): ${p.description}`)
        .join("; ");

      return [
        `Route ${index + 1}: ${route.name} (id: ${route.id})`,
        `- Road: ${route.primaryRoad}`,
        `- Distance: ${route.distanceKm}km, Duration: ${route.durationMinutes}min`,
        `- Scenic segments: ${segments || "N/A"}`,
        `- Key stops: ${pois || "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "For each of the following scenic routes, write a 2-3 sentence \"vibe summary\" in English",
    "that captures what makes this drive special. Be specific about what the driver will see and feel.",
    "",
    'Respond with a JSON array of objects: [{ "routeId": "...", "vibeSummary": "..." }]',
    "",
    "Routes:",
    "",
    routeDescriptions,
  ].join("\n");
}

function stripMarkdownAndThinkTags(text: string): string {
  // Strip think tags (e.g. <think>...</think>)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  // Strip markdown code blocks (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1");
  return cleaned.trim();
}

function buildFallbackSummaries(routes: RouteForSynthesis[]): VibeSummary[] {
  return routes.map((route) => ({
    routeId: route.id,
    vibeSummary: route.description,
  }));
}

export async function synthesizeVibes(
  routes: RouteForSynthesis[]
): Promise<VibeSummary[]> {
  if (routes.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not set, returning fallback summaries");
    return buildFallbackSummaries(routes);
  }

  const prompt = buildPrompt(routes);
  const modelCandidates = getModelCandidates();
  const maxRetries = getMaxRetries();
  const timeoutMs = Number.parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10);

  try {
    for (const model of modelCandidates) {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages: [
                  {
                    role: "system",
                    content:
                      "You are a travel writer. Respond ONLY with valid JSON.",
                  },
                  { role: "user", content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 2000,
                chat_template_kwargs: { enable_thinking: false },
              }),
              signal: controller.signal,
            }
          );

          if (!response.ok) {
            const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);

            if (!isRetryable || attempt === maxRetries) {
              console.error(
                `OpenRouter API error (${response.status}) [model=${model}]`
              );
              break;
            }

            const delayMs = getRetryDelayMs(attempt, response.headers.get("retry-after"));
            await sleep(delayMs);
            continue;
          }

          const data = await response.json();
          const content: string | undefined = data?.choices?.[0]?.message?.content;

          if (!content) {
            console.error("No content in LLM response");
            return buildFallbackSummaries(routes);
          }

          const cleaned = stripMarkdownAndThinkTags(content);
          const parsed: VibeSummary[] = JSON.parse(cleaned);

          if (!Array.isArray(parsed)) {
            console.error("LLM response is not an array");
            return buildFallbackSummaries(routes);
          }

          const summaryMap = new Map(parsed.map((s) => [s.routeId, s.vibeSummary]));

          return routes.map((route) => ({
            routeId: route.id,
            vibeSummary: summaryMap.get(route.id) ?? route.description,
          }));
        } catch (error) {
          if (!isRetryableFetchError(error) || attempt === maxRetries) {
            console.error(`Failed to synthesize vibes [model=${model}]:`, error);
            break;
          }

          const delayMs = getRetryDelayMs(attempt, null);
          await sleep(delayMs);
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    return buildFallbackSummaries(routes);
  } catch (error) {
    console.error("Failed to synthesize vibes:", error);
    return buildFallbackSummaries(routes);
  }
}
