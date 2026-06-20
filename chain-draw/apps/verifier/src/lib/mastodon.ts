/**
 * mastodon.ts — Mastodon social verification adapter
 *
 * All endpoints used here are PUBLIC — no authentication required for public posts.
 * This is the key advantage over X/Twitter (which requires $100+/mo for like/repost reads).
 *
 * Endpoints:
 *   GET /api/v1/accounts/lookup?acct=user@instance  — resolve handle → account_id
 *   GET /api/v1/statuses/:id/favourited_by          — who liked a post
 *   GET /api/v1/statuses/:id/reblogged_by           — who boosted a post
 *   GET /api/v1/accounts/:id/followers              — who follows an account
 *
 * Rate limits: ~300 req / 5 min per IP on mastodon.social (fine for demo).
 * Federation note: favourited_by / reblogged_by can under-report remote-instance users.
 * For a clean demo, run campaign post + participants on ONE instance (e.g. mastodon.social).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;        // full handle e.g. "alice@mastodon.social"
  display_name: string;
  url: string;
}

export interface VerifyResult {
  pass: boolean;
  rules: {
    favourite: boolean | 'skipped';
    boost: boolean | 'skipped';
    follow: boolean | 'skipped';
  };
  accountId: string | null;
  error?: string;
}

export interface CampaignRequirements {
  instance: string;          // e.g. "mastodon.social"
  statusId: string;          // Mastodon post ID for the giveaway post
  organizerMastodonId: string; // organizer's Mastodon account ID (for followers check)
  requireFavourite: boolean;
  requireBoost: boolean;
  requireFollow: boolean;
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

const USER_AGENT = 'ChainDraw-Verifier/1.0 (https://github.com/mhrk04/ChainDraw)';

async function mastodonFetch(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 404) return null;
  if (res.status === 429) throw new Error('Mastodon rate limit hit — retry in 5 minutes');
  if (!res.ok) throw new Error(`Mastodon API error: ${res.status} ${url}`);

  return res.json();
}

// ─── 1. Resolve handle → account_id ──────────────────────────────────────────

/**
 * Resolve a Mastodon handle to an account object.
 * handle format: "alice" (on same instance) or "alice@mastodon.social" (cross-instance)
 * instance: the instance to query, e.g. "mastodon.social"
 */
export async function resolveHandle(
  handle: string,
  instance: string
): Promise<MastodonAccount | null> {
  // Strip leading @
  const acct = handle.startsWith('@') ? handle.slice(1) : handle;
  const url = `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`;

  try {
    const data = await mastodonFetch(url);
    if (!data?.id) return null;
    return data as MastodonAccount;
  } catch (e) {
    console.warn('resolveHandle failed:', handle, e);
    return null;
  }
}

// ─── 2. Paginated list fetcher ────────────────────────────────────────────────

/**
 * Fetch ALL accounts from a paginated Mastodon endpoint.
 * Follows the Link header (max_id) until the list ends or targetId is found.
 * Returns the full set of account IDs, or exits early if targetId is found.
 */
async function fetchAllAccountIds(
  baseUrl: string,
  targetId: string,
  maxPages = 20
): Promise<Set<string>> {
  const ids = new Set<string>();
  let url: string | null = baseUrl;
  let page = 0;

  while (url && page < maxPages) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) break;

      const accounts: MastodonAccount[] = await res.json();
      if (!Array.isArray(accounts) || accounts.length === 0) break;

      for (const a of accounts) {
        ids.add(a.id);
        // Early exit — target found, no need to paginate further
        if (a.id === targetId) return ids;
      }

      // Follow Link header for next page
      const linkHeader = res.headers.get('link');
      url = parseNextLink(linkHeader);
      page++;

      // Small delay to respect rate limits
      if (url) await sleep(200);
    } catch {
      break;
    }
  }

  return ids;
}

/** Parse the `next` URL from a Mastodon Link header */
function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  // Link: <https://mastodon.social/api/...?max_id=123>; rel="next"
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── 3. Individual check functions ───────────────────────────────────────────

/**
 * Check if accountId favourited (liked) the status.
 */
export async function checkFavourited(
  instance: string,
  statusId: string,
  accountId: string
): Promise<boolean> {
  const url = `https://${instance}/api/v1/statuses/${statusId}/favourited_by?limit=80`;
  const ids = await fetchAllAccountIds(url, accountId);
  return ids.has(accountId);
}

/**
 * Check if accountId boosted (reblogged) the status.
 */
export async function checkBoosted(
  instance: string,
  statusId: string,
  accountId: string
): Promise<boolean> {
  const url = `https://${instance}/api/v1/statuses/${statusId}/reblogged_by?limit=80`;
  const ids = await fetchAllAccountIds(url, accountId);
  return ids.has(accountId);
}

/**
 * Check if accountId follows the organizer account.
 */
export async function checkFollows(
  instance: string,
  organizerAccountId: string,
  followerAccountId: string
): Promise<boolean> {
  const url = `https://${instance}/api/v1/accounts/${organizerAccountId}/followers?limit=80`;
  const ids = await fetchAllAccountIds(url, followerAccountId);
  return ids.has(followerAccountId);
}

// ─── 4. Master verifyEntry ────────────────────────────────────────────────────

/**
 * Full verification pipeline for one participant entry.
 *
 * Flow:
 *   1. Resolve handle → account_id (fails fast if handle not found)
 *   2. Run each required rule in parallel
 *   3. Return per-rule pass/fail + overall pass
 *
 * Called by POST /api/events/:campaign/join
 */
export async function verifyEntry(
  handle: string,
  requirements: CampaignRequirements
): Promise<VerifyResult> {
  const { instance, statusId, organizerMastodonId } = requirements;

  // Step 1: resolve handle
  const account = await resolveHandle(handle, instance);
  if (!account) {
    return {
      pass: false,
      rules: { favourite: false, boost: false, follow: false },
      accountId: null,
      error: `Handle @${handle} not found on ${instance}`,
    };
  }

  const accountId = account.id;

  // Step 2: run required checks in parallel
  const [favResult, boostResult, followResult] = await Promise.allSettled([
    requirements.requireFavourite
      ? checkFavourited(instance, statusId, accountId)
      : Promise.resolve('skipped' as const),
    requirements.requireBoost
      ? checkBoosted(instance, statusId, accountId)
      : Promise.resolve('skipped' as const),
    requirements.requireFollow
      ? checkFollows(instance, organizerMastodonId, accountId)
      : Promise.resolve('skipped' as const),
  ]);

  const fav = favResult.status === 'fulfilled' ? favResult.value : false;
  const boost = boostResult.status === 'fulfilled' ? boostResult.value : false;
  const follow = followResult.status === 'fulfilled' ? followResult.value : false;

  // Overall pass: all required rules must pass
  const pass =
    (requirements.requireFavourite ? fav === true : true) &&
    (requirements.requireBoost ? boost === true : true) &&
    (requirements.requireFollow ? follow === true : true);

  return {
    pass,
    rules: { favourite: fav, boost, follow },
    accountId,
  };
}
