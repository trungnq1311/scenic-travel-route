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
  const model = process.env.LLM_MODEL || "qwen/qwen3.6-plus:free";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

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
      console.error(
        `OpenRouter API error: ${response.status} ${response.statusText}`
      );
      return buildFallbackSummaries(routes);
    }

    const data = await response.json();
    const content: string | undefined =
      data?.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in LLM response");
      return buildFallbackSummaries(routes);
    }

    const cleaned = stripMarkdownAndThinkTags(content);
    const parsed: VibeSummary[] = JSON.parse(cleaned);

    // Validate that we got an array with the expected shape
    if (!Array.isArray(parsed)) {
      console.error("LLM response is not an array");
      return buildFallbackSummaries(routes);
    }

    // Ensure every route has a summary, filling in fallbacks for missing ones
    const summaryMap = new Map(
      parsed.map((s) => [s.routeId, s.vibeSummary])
    );

    return routes.map((route) => ({
      routeId: route.id,
      vibeSummary: summaryMap.get(route.id) ?? route.description,
    }));
  } catch (error) {
    console.error("Failed to synthesize vibes:", error);
    return buildFallbackSummaries(routes);
  } finally {
    clearTimeout(timeout);
  }
}
