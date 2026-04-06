import { NextResponse } from 'next/server';
import { generateRoutes } from '@/lib/pipeline/generate';
import type { GenerateRequest } from '@/lib/pipeline/types';
import { checkRateLimit, extractClientIp } from '@/lib/security/rate-limit';
import { validateGenerateRequest } from '@/lib/security/input-validation';

export const maxDuration = 300; // 5 min max for Vercel
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const validation = validateGenerateRequest(body);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const rateLimit = checkRateLimit({
      key: `generate:${extractClientIp(request)}`,
      maxRequests: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please retry later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateLimit.limit),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          },
        },
      );
    }

    const validatedBody: GenerateRequest = validation.value;
    const requestId = crypto.randomUUID();
    console.log(`[generate] Starting pipeline (${requestId})`);

    const result = await generateRoutes(validatedBody);

    console.log(
      `[generate] Complete (${requestId}): ${result.routes.length} routes in ${result.generationMeta.totalElapsedMs}ms`,
    );

    return NextResponse.json(result, {
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error(`[generate] Pipeline failed (${requestId}):`, error);
    return NextResponse.json(
      {
        error: 'Route generation failed',
        requestId,
      },
      { status: 500 },
    );
  }
}
