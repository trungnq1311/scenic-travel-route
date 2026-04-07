const TOKEN_COOKIE_NAME = 'trip_voter_token';
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const parts = cookieHeader.split(';');
  const out: Record<string, string> = {};

  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey || rawValue.length === 0) continue;
    out[rawKey] = decodeURIComponent(rawValue.join('='));
  }

  return out;
}

export function getVoterTokenFromCookieHeader(cookieHeader: string | null): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[TOKEN_COOKIE_NAME] || null;
}

export function buildVoterTokenSetCookie(value: string): string {
  return [
    `${TOKEN_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_MAX_AGE_SECONDS}`,
  ].join('; ');
}

export function getVoterTokenCookieName(): string {
  return TOKEN_COOKIE_NAME;
}
