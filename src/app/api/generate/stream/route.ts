import { generateRoutes } from '@/lib/pipeline/generate';
import type { GenerateRequest } from '@/lib/pipeline/types';
import type { StageResult } from '@/lib/pipeline/types';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { validateGenerateRequest } from '@/lib/security/input-validation';

export const maxDuration = 300;
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawRequest: GenerateRequest = {
    origin: url.searchParams.get('origin') ?? '',
    destination: url.searchParams.get('destination') ?? '',
    originVi: url.searchParams.get('originVi') ?? undefined,
    destinationVi: url.searchParams.get('destinationVi') ?? undefined,
    preferences: {
      chillLevel: url.searchParams.get('chillLevel') as
        | 'low'
        | 'medium'
        | 'high'
        | undefined,
    },
  };

  const validation = validateGenerateRequest(rawRequest);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rateLimit = checkRateLimit({
    key: `generate:${extractClientIp(request)}`,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please retry later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateLimit.retryAfterSeconds),
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
  }

  const req: GenerateRequest = validation.value;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const onStage = (stage: StageResult) => {
          if (stage.status === 'failed') {
            sendEvent('stage', {
              ...stage,
              detail: 'Pipeline stage failed',
            });
            return;
          }

          sendEvent('stage', stage);
        };

        const result = await generateRoutes(req, onStage);
        sendEvent('complete', result);
      } catch (error) {
        const requestId = crypto.randomUUID();
        console.error(`[generate:stream] Request failed (${requestId}):`, error);
        sendEvent('error', {
          message: 'Route generation failed. Please try again.',
          requestId,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    },
  });
}
