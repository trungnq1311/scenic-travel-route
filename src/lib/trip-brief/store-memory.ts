import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type {
  TripBrief,
  TripBriefRouteSnapshot,
  TripBriefSummaryView,
  TripBriefView,
  TripBriefVoteSummary,
} from './types';

const DEFAULT_TTL_DAYS = 14;
const LOCK_UNDO_WINDOW_MS = 5 * 60 * 1000;
const TEST_TOKEN_SECRET = 'trip-brief-test-secret';

interface StoredVote {
  routeId: string;
  updatedAt: string;
}

interface StoredBrief {
  brief: TripBrief;
  votesByTokenHash: Map<string, StoredVote>;
  idempotencyKeys: Set<string>;
  voteMutationKeysByTokenHash: Map<string, Set<string>>;
}

const briefStore = new Map<string, StoredBrief>();

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getTokenSecret(): string {
  const configured = process.env.TRIP_BRIEF_TOKEN_SECRET;
  if (configured && configured.trim()) {
    return configured;
  }

  if (process.env.NODE_ENV === 'test') {
    return TEST_TOKEN_SECRET;
  }

  throw new Error('TRIP_BRIEF_TOKEN_SECRET environment variable is required');
}

function decodeBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const fixed = mod === 0 ? padded : `${padded}${'='.repeat(4 - mod)}`;
  return Buffer.from(fixed, 'base64');
}

function signPayload(payload: string): Buffer {
  return createHmac('sha256', getTokenSecret()).update(payload).digest();
}

function toBase64Url(value: Buffer): string {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isExpired(brief: TripBrief): boolean {
  return new Date(brief.expiresAt).getTime() <= Date.now() || brief.status === 'expired';
}

function isLocked(brief: TripBrief): boolean {
  return brief.decisionLockedAt !== null;
}

function hashToken(token: string): string {
  return createHmac('sha256', getTokenSecret()).update(token).digest('hex');
}

function summarizeVotes(votesByTokenHash: Map<string, StoredVote>): TripBriefVoteSummary {
  const countsByRouteId: Record<string, number> = {};

  for (const vote of votesByTokenHash.values()) {
    countsByRouteId[vote.routeId] = (countsByRouteId[vote.routeId] ?? 0) + 1;
  }

  let winnerRouteId: string | null = null;
  let max = -1;
  for (const [routeId, count] of Object.entries(countsByRouteId)) {
    if (count > max) {
      max = count;
      winnerRouteId = routeId;
    }
  }

  return {
    countsByRouteId,
    totalVotes: votesByTokenHash.size,
    winnerRouteId,
  };
}

function getStoredOrThrow(briefId: string): StoredBrief {
  const stored = briefStore.get(briefId);
  if (!stored) {
    throw new Error('trip brief not found');
  }
  if (isExpired(stored.brief) && stored.brief.status !== 'expired') {
    stored.brief.status = 'expired';
  }
  return stored;
}

export function issueVoterTokenMemory(): string {
  const payload = randomBytes(24).toString('hex');
  const signature = signPayload(payload);
  return `${payload}.${toBase64Url(signature)}`;
}

export function verifyVoterTokenMemory(token: string): boolean {
  const [payload, signaturePart] = token.split('.');
  if (!payload || !signaturePart) return false;

  let providedSig: Buffer;
  try {
    providedSig = decodeBase64Url(signaturePart);
  } catch {
    return false;
  }

  const expectedSig = signPayload(payload);
  return safeEqual(providedSig, expectedSig);
}

export async function createTripBriefMemory(input: {
  tripId: string;
  origin: string;
  destination: string;
  routesSnapshot: TripBriefRouteSnapshot[];
  ttlDays?: number;
}): Promise<TripBrief> {
  const briefId = randomUUID();
  const brief: TripBrief = {
    briefId,
    tripId: input.tripId,
    origin: input.origin,
    destination: input.destination,
    routesSnapshot: input.routesSnapshot,
    createdAt: nowIso(),
    expiresAt: addDaysIso(input.ttlDays ?? DEFAULT_TTL_DAYS),
    status: 'active',
    decisionLockedAt: null,
    lockedByTokenHash: null,
    winningRouteId: null,
  };

  briefStore.set(briefId, {
    brief,
    votesByTokenHash: new Map(),
    idempotencyKeys: new Set(),
    voteMutationKeysByTokenHash: new Map(),
  });

  return brief;
}

export async function getTripBriefViewMemory(
  briefId: string,
  voterToken?: string | null,
  baseUrl?: string,
): Promise<TripBriefView> {
  const stored = getStoredOrThrow(briefId);
  const voteSummary = summarizeVotes(stored.votesByTokenHash);
  const voterTokenHash = voterToken ? hashToken(voterToken) : null;
  const userVoteRouteId = voterTokenHash
    ? (stored.votesByTokenHash.get(voterTokenHash)?.routeId ?? null)
    : null;
  const readOnly = isExpired(stored.brief) || isLocked(stored.brief);
  const canUnlock =
    !!voterTokenHash &&
    !!stored.brief.decisionLockedAt &&
    stored.brief.lockedByTokenHash === voterTokenHash &&
    Date.now() - new Date(stored.brief.decisionLockedAt).getTime() <= LOCK_UNDO_WINDOW_MS;

  const lockUndoExpiresAt = stored.brief.decisionLockedAt
    ? new Date(new Date(stored.brief.decisionLockedAt).getTime() + LOCK_UNDO_WINDOW_MS).toISOString()
    : null;

  const shareUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/trip-brief/${stored.brief.briefId}`
    : `/trip-brief/${stored.brief.briefId}`;

  return {
    brief: stored.brief,
    voteSummary,
    userVoteRouteId,
    shareUrl,
    readOnly,
    canUnlock,
    lockUndoExpiresAt,
  };
}

export async function getTripBriefSummaryMemory(briefId: string): Promise<TripBriefSummaryView> {
  const stored = getStoredOrThrow(briefId);
  const voteSummary = summarizeVotes(stored.votesByTokenHash);

  return {
    briefId,
    voteSummary,
    readOnly: isExpired(stored.brief) || isLocked(stored.brief),
    winningRouteId: stored.brief.winningRouteId,
  };
}

export async function castTripBriefVoteMemory(input: {
  briefId: string;
  voterToken: string;
  routeId: string;
  idempotencyKey: string;
}): Promise<{ view: TripBriefView; mutationApplied: boolean }> {
  if (!verifyVoterTokenMemory(input.voterToken)) {
    throw new Error('invalid voter token');
  }

  const stored = getStoredOrThrow(input.briefId);

  const tokenHash = hashToken(input.voterToken);
  const tokenMutationKeys = stored.voteMutationKeysByTokenHash.get(tokenHash);

  if (tokenMutationKeys?.has(input.idempotencyKey)) {
    return {
      view: await getTripBriefViewMemory(input.briefId, input.voterToken),
      mutationApplied: false,
    };
  }

  if (isExpired(stored.brief)) {
    stored.brief.status = 'expired';
    throw new Error('trip brief expired');
  }

  if (isLocked(stored.brief)) {
    throw new Error('trip brief locked');
  }

  const routeExists = stored.brief.routesSnapshot.some((route) => route.id === input.routeId);
  if (!routeExists) {
    throw new Error('unknown route');
  }

  stored.votesByTokenHash.set(tokenHash, {
    routeId: input.routeId,
    updatedAt: nowIso(),
  });
  stored.idempotencyKeys.add(input.idempotencyKey);

  if (!tokenMutationKeys) {
    stored.voteMutationKeysByTokenHash.set(tokenHash, new Set([input.idempotencyKey]));
  } else {
    tokenMutationKeys.add(input.idempotencyKey);
  }

  return {
    view: await getTripBriefViewMemory(input.briefId, input.voterToken),
    mutationApplied: true,
  };
}

export async function lockTripBriefDecisionMemory(input: {
  briefId: string;
  voterToken: string;
}): Promise<{ view: TripBriefView; lockApplied: boolean }> {
  if (!verifyVoterTokenMemory(input.voterToken)) {
    throw new Error('invalid voter token');
  }

  const stored = getStoredOrThrow(input.briefId);
  if (isExpired(stored.brief)) {
    stored.brief.status = 'expired';
    throw new Error('trip brief expired');
  }
  if (isLocked(stored.brief)) {
    return {
      view: await getTripBriefViewMemory(input.briefId, input.voterToken),
      lockApplied: false,
    };
  }

  const summary = summarizeVotes(stored.votesByTokenHash);
  if (!summary.winnerRouteId || summary.totalVotes < 1) {
    throw new Error('at least one vote required before lock');
  }

  const tokenHash = hashToken(input.voterToken);
  stored.brief.decisionLockedAt = nowIso();
  stored.brief.lockedByTokenHash = tokenHash;
  stored.brief.winningRouteId = summary.winnerRouteId;

  return {
    view: await getTripBriefViewMemory(input.briefId, input.voterToken),
    lockApplied: true,
  };
}

export async function unlockTripBriefDecisionMemory(input: {
  briefId: string;
  voterToken: string;
}): Promise<TripBriefView> {
  if (!verifyVoterTokenMemory(input.voterToken)) {
    throw new Error('invalid voter token');
  }

  const stored = getStoredOrThrow(input.briefId);
  if (!stored.brief.decisionLockedAt) {
    return getTripBriefViewMemory(input.briefId, input.voterToken);
  }

  const tokenHash = hashToken(input.voterToken);
  if (stored.brief.lockedByTokenHash !== tokenHash) {
    throw new Error('only locker can unlock');
  }

  const lockedAtMs = new Date(stored.brief.decisionLockedAt).getTime();
  if (Date.now() - lockedAtMs > LOCK_UNDO_WINDOW_MS) {
    throw new Error('unlock window expired');
  }

  stored.brief.decisionLockedAt = null;
  stored.brief.lockedByTokenHash = null;
  stored.brief.winningRouteId = null;

  return getTripBriefViewMemory(input.briefId, input.voterToken);
}

export async function resetTripBriefStoreMemory(): Promise<void> {
  briefStore.clear();
}
