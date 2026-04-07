import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { PoolClient } from 'pg';
import { withClient } from '@/lib/db/postgres';
import type {
  TripBrief,
  TripBriefRouteSnapshot,
  TripBriefSummaryView,
  TripBriefView,
  TripBriefVoteSummary,
} from './types';
import {
  castTripBriefVoteMemory,
  createTripBriefMemory,
  getTripBriefSummaryMemory,
  getTripBriefViewMemory,
  issueVoterTokenMemory,
  lockTripBriefDecisionMemory,
  resetTripBriefStoreMemory,
  unlockTripBriefDecisionMemory,
  verifyVoterTokenMemory,
} from './store-memory';

const DEFAULT_TTL_DAYS = 14;
const LOCK_UNDO_WINDOW_MS = 5 * 60 * 1000;
const TEST_TOKEN_SECRET = 'trip-brief-test-secret';

interface TripBriefRow {
  brief_id: string;
  trip_id: string;
  origin: string;
  destination: string;
  routes_snapshot: unknown;
  created_at: string;
  expires_at: string;
  status: 'active' | 'expired';
  decision_locked_at: string | null;
  locked_by_token_hash: string | null;
  winning_route_id: string | null;
}

interface VoteRow {
  route_id: string;
  count: string;
}

interface UserVoteRow {
  route_id: string;
}

interface MutationRow {
  idempotency_key: string;
}

interface DecisionRow {
  winner_route_id: string;
  total_votes: string;
}

function hasRows(rowCount: number | null, rowsLength: number): boolean {
  if (typeof rowCount === 'number') {
    return rowCount > 0;
  }
  return rowsLength > 0;
}

interface CreatedRow {
  brief_id: string;
  trip_id: string;
  origin: string;
  destination: string;
  routes_snapshot: unknown;
  created_at: string;
  expires_at: string;
  status: 'active' | 'expired';
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

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
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

function hashToken(token: string): string {
  return createHmac('sha256', getTokenSecret()).update(token).digest('hex');
}

function ensureRoutesSnapshot(snapshot: unknown): TripBriefRouteSnapshot[] {
  if (!Array.isArray(snapshot)) {
    throw new Error('invalid routes snapshot');
  }
  return snapshot as TripBriefRouteSnapshot[];
}

function rowToBrief(row: TripBriefRow | CreatedRow): TripBrief {
  return {
    briefId: row.brief_id,
    tripId: row.trip_id,
    origin: row.origin,
    destination: row.destination,
    routesSnapshot: ensureRoutesSnapshot(row.routes_snapshot),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
    decisionLockedAt: (row as TripBriefRow).decision_locked_at ?? null,
    lockedByTokenHash: (row as TripBriefRow).locked_by_token_hash ?? null,
    winningRouteId: (row as TripBriefRow).winning_route_id ?? null,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function computeReadOnly(brief: TripBrief): boolean {
  if (brief.decisionLockedAt) return true;
  return new Date(brief.expiresAt).getTime() <= Date.now() || brief.status === 'expired';
}

async function fetchBrief(client: PoolClient, briefId: string): Promise<TripBrief> {
  const result = await client.query<TripBriefRow>(
    `
      SELECT
        brief_id,
        trip_id,
        origin,
        destination,
        routes_snapshot,
        created_at,
        expires_at,
        status,
        decision_locked_at,
        locked_by_token_hash,
        winning_route_id
      FROM trip_briefs
      WHERE brief_id = $1
      FOR UPDATE
    `,
    [briefId],
  );

  if (result.rowCount === 0) {
    throw new Error('trip brief not found');
  }

  const brief = rowToBrief(result.rows[0]);

  if (brief.status === 'active' && new Date(brief.expiresAt).getTime() <= Date.now()) {
    await client.query(
      `
        UPDATE trip_briefs
        SET status = 'expired'
        WHERE brief_id = $1
      `,
      [briefId],
    );
    brief.status = 'expired';
  }

  return brief;
}

async function fetchVoteSummary(client: PoolClient, briefId: string): Promise<TripBriefVoteSummary> {
  const countsResult = await client.query<VoteRow>(
    `
      SELECT route_id, COUNT(*)::text AS count
      FROM trip_brief_votes
      WHERE brief_id = $1
      GROUP BY route_id
    `,
    [briefId],
  );

  const countsByRouteId: Record<string, number> = {};
  let totalVotes = 0;

  for (const row of countsResult.rows) {
    const count = Number(row.count);
    countsByRouteId[row.route_id] = count;
    totalVotes += count;
  }

  const winnerResult = await client.query<DecisionRow>(
    `
      SELECT route_id AS winner_route_id, COUNT(*)::text AS total_votes
      FROM trip_brief_votes
      WHERE brief_id = $1
      GROUP BY route_id
      ORDER BY COUNT(*) DESC, route_id ASC
      LIMIT 1
    `,
    [briefId],
  );

  return {
    countsByRouteId,
    totalVotes,
    winnerRouteId: hasRows(winnerResult.rowCount, winnerResult.rows.length)
      ? winnerResult.rows[0].winner_route_id
      : null,
  };
}

async function fetchUserVoteRouteId(
  client: PoolClient,
  briefId: string,
  tokenHash: string | null,
): Promise<string | null> {
  if (!tokenHash) return null;

  const result = await client.query<UserVoteRow>(
    `
      SELECT route_id
      FROM trip_brief_votes
      WHERE brief_id = $1 AND voter_token_hash = $2
      LIMIT 1
    `,
    [briefId, tokenHash],
  );

  return hasRows(result.rowCount, result.rows.length) ? result.rows[0].route_id : null;
}

function computeCanUnlock(brief: TripBrief, tokenHash: string | null): boolean {
  if (!brief.decisionLockedAt || !tokenHash || !brief.lockedByTokenHash) return false;
  if (brief.lockedByTokenHash !== tokenHash) return false;

  const lockedAt = new Date(brief.decisionLockedAt).getTime();
  return Date.now() - lockedAt <= LOCK_UNDO_WINDOW_MS;
}

function computeUndoExpiresAt(brief: TripBrief): string | null {
  if (!brief.decisionLockedAt) return null;
  const expiresAt = new Date(new Date(brief.decisionLockedAt).getTime() + LOCK_UNDO_WINDOW_MS);
  return expiresAt.toISOString();
}

async function buildTripBriefView(
  client: PoolClient,
  briefId: string,
  voterToken?: string | null,
  baseUrl?: string,
): Promise<TripBriefView> {
  const brief = await fetchBrief(client, briefId);
  const tokenHash = voterToken ? hashToken(voterToken) : null;
  const voteSummary = await fetchVoteSummary(client, briefId);
  const userVoteRouteId = await fetchUserVoteRouteId(client, briefId, tokenHash);
  const readOnly = computeReadOnly(brief);
  const canUnlock = computeCanUnlock(brief, tokenHash);
  const lockUndoExpiresAt = computeUndoExpiresAt(brief);
  const shareUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/trip-brief/${brief.briefId}`
    : `/trip-brief/${brief.briefId}`;

  return {
    brief,
    voteSummary,
    userVoteRouteId,
    shareUrl,
    readOnly,
    canUnlock,
    lockUndoExpiresAt,
  };
}

export function issueVoterToken(): string {
  if (!isDatabaseConfigured()) {
    return issueVoterTokenMemory();
  }
  const payload = randomBytes(24).toString('hex');
  const signature = signPayload(payload);
  return `${payload}.${toBase64Url(signature)}`;
}

export function verifyVoterToken(token: string): boolean {
  if (!isDatabaseConfigured()) {
    return verifyVoterTokenMemory(token);
  }
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

export async function createTripBrief(input: {
  tripId: string;
  origin: string;
  destination: string;
  routesSnapshot: TripBriefRouteSnapshot[];
  ttlDays?: number;
}): Promise<TripBrief> {
  if (!isDatabaseConfigured()) {
    return createTripBriefMemory(input);
  }

  const briefId = randomUUID();
  const createdAt = nowIso();
  const expiresAt = addDaysIso(input.ttlDays ?? DEFAULT_TTL_DAYS);

  return withClient(async (client) => {
    const result = await client.query<CreatedRow>(
      `
        INSERT INTO trip_briefs (
          brief_id,
          trip_id,
          origin,
          destination,
          routes_snapshot,
          created_at,
          expires_at,
          status,
          decision_locked_at,
          locked_by_token_hash,
          winning_route_id
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6,
          $7,
          'active',
          NULL,
          NULL,
          NULL
        )
        RETURNING
          brief_id,
          trip_id,
          origin,
          destination,
          routes_snapshot,
          created_at,
          expires_at,
          status
      `,
      [
        briefId,
        input.tripId,
        input.origin,
        input.destination,
        JSON.stringify(input.routesSnapshot),
        createdAt,
        expiresAt,
      ],
    );

    return rowToBrief(result.rows[0]);
  });
}

export async function getTripBriefView(
  briefId: string,
  voterToken?: string | null,
  baseUrl?: string,
): Promise<TripBriefView> {
  if (!isDatabaseConfigured()) {
    return getTripBriefViewMemory(briefId, voterToken, baseUrl);
  }
  return withClient((client) => buildTripBriefView(client, briefId, voterToken, baseUrl));
}

export async function getTripBriefSummary(briefId: string): Promise<TripBriefSummaryView> {
  if (!isDatabaseConfigured()) {
    return getTripBriefSummaryMemory(briefId);
  }

  return withClient(async (client) => {
    const brief = await fetchBrief(client, briefId);
    const voteSummary = await fetchVoteSummary(client, briefId);

    return {
      briefId,
      voteSummary,
      readOnly: computeReadOnly(brief),
      winningRouteId: brief.winningRouteId,
    };
  });
}

export async function castTripBriefVote(input: {
  briefId: string;
  voterToken: string;
  routeId: string;
  idempotencyKey: string;
}): Promise<TripBriefView> {
  if (!isDatabaseConfigured()) {
    return castTripBriefVoteMemory(input);
  }

  if (!verifyVoterToken(input.voterToken)) {
    throw new Error('invalid voter token');
  }

  return withClient(async (client) => {
    const tokenHash = hashToken(input.voterToken);

    await client.query('BEGIN');
    try {
      const brief = await fetchBrief(client, input.briefId);
      const readOnly = computeReadOnly(brief);
      if (readOnly) {
        if (brief.status === 'expired') {
          throw new Error('trip brief expired');
        }
        throw new Error('trip brief locked');
      }

      const routeExists = brief.routesSnapshot.some((route) => route.id === input.routeId);
      if (!routeExists) {
        throw new Error('unknown route');
      }

      const mutationInsert = await client.query<MutationRow>(
        `
          INSERT INTO trip_brief_vote_mutations (
            idempotency_key,
            brief_id,
            voter_token_hash,
            route_id,
            processed_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (idempotency_key) DO NOTHING
          RETURNING idempotency_key
        `,
        [input.idempotencyKey, input.briefId, tokenHash, input.routeId, nowIso()],
      );

      if (hasRows(mutationInsert.rowCount, mutationInsert.rows.length)) {
        await client.query(
          `
            INSERT INTO trip_brief_votes (
              brief_id,
              voter_token_hash,
              route_id,
              updated_at
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (brief_id, voter_token_hash)
            DO UPDATE SET
              route_id = EXCLUDED.route_id,
              updated_at = EXCLUDED.updated_at
          `,
          [input.briefId, tokenHash, input.routeId, nowIso()],
        );
      }

      const view = await buildTripBriefView(client, input.briefId, input.voterToken);
      await client.query('COMMIT');
      return view;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function lockTripBriefDecision(input: {
  briefId: string;
  voterToken: string;
}): Promise<TripBriefView> {
  if (!isDatabaseConfigured()) {
    return lockTripBriefDecisionMemory(input);
  }

  if (!verifyVoterToken(input.voterToken)) {
    throw new Error('invalid voter token');
  }

  return withClient(async (client) => {
    const tokenHash = hashToken(input.voterToken);

    await client.query('BEGIN');
    try {
      const brief = await fetchBrief(client, input.briefId);

      if (brief.status === 'expired') {
        throw new Error('trip brief expired');
      }

      if (brief.decisionLockedAt) {
        const view = await buildTripBriefView(client, input.briefId, input.voterToken);
        await client.query('COMMIT');
        return view;
      }

      const decision = await client.query<DecisionRow>(
        `
          SELECT route_id AS winner_route_id, COUNT(*)::text AS total_votes
          FROM trip_brief_votes
          WHERE brief_id = $1
          GROUP BY route_id
          ORDER BY COUNT(*) DESC, route_id ASC
          LIMIT 1
        `,
        [input.briefId],
      );

      if (!hasRows(decision.rowCount, decision.rows.length) || Number(decision.rows[0].total_votes) < 1) {
        throw new Error('at least one vote required before lock');
      }

      const lockedAt = nowIso();
      const lockResult = await client.query(
        `
          UPDATE trip_briefs
          SET
            decision_locked_at = $2,
            locked_by_token_hash = $3,
            winning_route_id = $4
          WHERE brief_id = $1 AND decision_locked_at IS NULL
        `,
        [input.briefId, lockedAt, tokenHash, decision.rows[0].winner_route_id],
      );

      if (!hasRows(lockResult.rowCount, 0)) {
        const view = await buildTripBriefView(client, input.briefId, input.voterToken);
        await client.query('COMMIT');
        return view;
      }

      const view = await buildTripBriefView(client, input.briefId, input.voterToken);
      await client.query('COMMIT');
      return view;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function unlockTripBriefDecision(input: {
  briefId: string;
  voterToken: string;
}): Promise<TripBriefView> {
  if (!isDatabaseConfigured()) {
    return unlockTripBriefDecisionMemory(input);
  }

  if (!verifyVoterToken(input.voterToken)) {
    throw new Error('invalid voter token');
  }

  return withClient(async (client) => {
    const tokenHash = hashToken(input.voterToken);

    await client.query('BEGIN');
    try {
      const brief = await fetchBrief(client, input.briefId);

      if (!brief.decisionLockedAt) {
        const view = await buildTripBriefView(client, input.briefId, input.voterToken);
        await client.query('COMMIT');
        return view;
      }

      if (brief.lockedByTokenHash !== tokenHash) {
        throw new Error('only locker can unlock');
      }

      const lockedAtMs = new Date(brief.decisionLockedAt).getTime();
      if (Date.now() - lockedAtMs > LOCK_UNDO_WINDOW_MS) {
        throw new Error('unlock window expired');
      }

      await client.query(
        `
          UPDATE trip_briefs
          SET
            decision_locked_at = NULL,
            locked_by_token_hash = NULL,
            winning_route_id = NULL
          WHERE brief_id = $1
        `,
        [input.briefId],
      );

      const view = await buildTripBriefView(client, input.briefId, input.voterToken);
      await client.query('COMMIT');
      return view;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function resetTripBriefStore(): Promise<void> {
  if (!isDatabaseConfigured()) {
    await resetTripBriefStoreMemory();
    return;
  }

  await withClient(async (client) => {
    await client.query('DELETE FROM trip_brief_vote_mutations');
    await client.query('DELETE FROM trip_brief_votes');
    await client.query('DELETE FROM trip_briefs');
  });
}
