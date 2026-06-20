/**
 * delegation.ts — Subscriptions & Allowances integration
 *
 * Program ID: De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44
 * Source: github.com/solana-foundation/subscriptions (Cantina audited)
 *
 * Three operations:
 *   1. initSubscriptionAuthority  — once per (organizer, mint)
 *   2. createFixedDelegation      — one-shot campaign commitment
 *   3. createRecurringDelegation  — weekly/monthly campaign commitment
 *
 * The organizer calls 1+2 or 1+3 from the browser (Phantom signs).
 * This file provides the TS helpers the frontend wizard calls via
 * the /api/events POST route, AND the standalone scripts for testing.
 */

import { address, Address } from '@solana/kit';
import { SubscriptionsClient } from '@solana/subscriptions';
import { rpc } from './rpc.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUBSCRIPTIONS_PROGRAM_ID = address(
  'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44'
);

export const TOKEN_PROGRAM_ID = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const USDC_MINT = address(
  process.env.USDC_MINT ?? '3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks'
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegationResult {
  subscriptionAuthorityPda: Address;
  delegationPda: Address;
  txSignatures: string[];
}

export interface FixedDelegationParams {
  organizer: Address;
  organizerAta: Address;
  delegatee: Address;           // SERVICE_AUTHORITY — backend keypair public key
  campaignId: bigint;           // used as nonce — unique per campaign
  prizeTotal: bigint;           // base units (USDC: multiply by 1_000_000n)
  cutoffTs: bigint;             // unix timestamp of draw + 3600s buffer
  tokenMint?: Address;
}

export interface RecurringDelegationParams {
  organizer: Address;
  organizerAta: Address;
  delegatee: Address;
  campaignId: bigint;
  amountPerPeriod: bigint;      // max per period in base units
  periodLength: bigint;         // seconds: 604800n = weekly, 2592000n = monthly
  expiryTs: bigint;             // overall expiry (cutoff + several periods buffer)
  tokenMint?: Address;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a SubscriptionsClient bound to the current RPC.
 * The organizer's wallet adapter is passed in by the caller.
 */
function buildClient(organizerSigner: any) {
  return new SubscriptionsClient({
    rpc,
    signer: organizerSigner,
  });
}

// ─── 1. initSubscriptionAuthority ────────────────────────────────────────────

/**
 * Creates the per-(organizer, mint) Subscription Authority PDA.
 * Must be called once before any delegation for this mint.
 * Skip if already initialized (check isSubscriptionAuthorityInitialized first).
 *
 * Called by: organizer wallet (Phantom) in the commit wizard step.
 */
export async function ensureSubscriptionAuthority(
  organizerSigner: any,
  params: {
    organizer: Address;
    organizerAta: Address;
    tokenMint?: Address;
  }
): Promise<{ subscriptionAuthorityPda: Address; tx?: string }> {
  const client = buildClient(organizerSigner);
  const mint = params.tokenMint ?? USDC_MINT;

  // Check if already initialized
  const exists = await client.isSubscriptionAuthorityInitialized({
    wallet: params.organizer,
    tokenMint: mint,
  });

  if (exists) {
    const { pda } = await client.getSubscriptionAuthorityPDA({
      wallet: params.organizer,
      tokenMint: mint,
    });
    console.log('SubscriptionAuthority already exists:', pda);
    return { subscriptionAuthorityPda: pda };
  }

  // Initialize
  const tx = await client.initSubscriptionAuthority({
    tokenMint: mint,
    tokenProgram: TOKEN_PROGRAM_ID,
    userAta: params.organizerAta,
  }).sendTransaction();

  const { pda } = await client.getSubscriptionAuthorityPDA({
    wallet: params.organizer,
    tokenMint: mint,
  });

  console.log('SubscriptionAuthority initialized:', pda, '| tx:', tx);
  return { subscriptionAuthorityPda: pda, tx };
}

// ─── 2. createFixedDelegation ────────────────────────────────────────────────

/**
 * One-shot campaign commitment.
 * Organizer pre-authorizes the delegatee (SERVICE_AUTHORITY) to pull
 * up to prizeTotal before cutoffTs + buffer.
 *
 * The delegation PDA is the public on-chain commitment anyone can verify.
 *
 * Called by: organizer wallet (Phantom) in the commit wizard step.
 */
export async function createFixedDelegation(
  organizerSigner: any,
  params: FixedDelegationParams
): Promise<DelegationResult> {
  const client = buildClient(organizerSigner);
  const mint = params.tokenMint ?? USDC_MINT;
  const txSigs: string[] = [];

  // Step 1: ensure subscription authority exists
  const { subscriptionAuthorityPda, tx: authTx } = await ensureSubscriptionAuthority(
    organizerSigner,
    {
      organizer: params.organizer,
      organizerAta: params.organizerAta,
      tokenMint: mint,
    }
  );
  if (authTx) txSigs.push(authTx);

  // Step 2: createFixedDelegation
  // nonce = campaignId (u64 as string) — unique per campaign per organizer
  const nonce = params.campaignId.toString();
  const delegationTx = await client.createFixedDelegation({
    tokenMint: mint,
    delegatee: params.delegatee,
    nonce,
    amount: params.prizeTotal,
    expiryTs: params.cutoffTs,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).sendTransaction();
  txSigs.push(delegationTx);

  // Derive the delegation PDA — this is stored in the Campaign account
  const { pda: delegationPda } = await client.getDelegationPDA({
    subscriptionAuthority: subscriptionAuthorityPda,
    delegator: params.organizer,
    delegatee: params.delegatee,
    nonce,
  });

  console.log(
    'FixedDelegation created:',
    delegationPda,
    '| amount:', params.prizeTotal.toString(),
    '| expiry:', params.cutoffTs.toString(),
    '| tx:', delegationTx
  );

  return { subscriptionAuthorityPda, delegationPda, txSignatures: txSigs };
}

// ─── 3. createRecurringDelegation ────────────────────────────────────────────

/**
 * Recurring campaign commitment (weekly/monthly giveaways).
 * Organizer pre-authorizes the delegatee to pull up to amountPerPeriod
 * per period, auto-resetting each period — no re-signing needed.
 *
 * This is the key track-compliance addition:
 *   periodLength = 604800n  → weekly giveaway
 *   periodLength = 2592000n → monthly giveaway
 *
 * Called by: organizer wallet (Phantom) when isRecurring toggle is ON.
 */
export async function createRecurringDelegation(
  organizerSigner: any,
  params: RecurringDelegationParams
): Promise<DelegationResult> {
  const client = buildClient(organizerSigner);
  const mint = params.tokenMint ?? USDC_MINT;
  const txSigs: string[] = [];

  // Step 1: ensure subscription authority
  const { subscriptionAuthorityPda, tx: authTx } = await ensureSubscriptionAuthority(
    organizerSigner,
    {
      organizer: params.organizer,
      organizerAta: params.organizerAta,
      tokenMint: mint,
    }
  );
  if (authTx) txSigs.push(authTx);

  // Step 2: createRecurringDelegation
  const nonce = params.campaignId.toString();
  const delegationTx = await client.createRecurringDelegation({
    tokenMint: mint,
    delegatee: params.delegatee,
    nonce,
    amountPerPeriod: params.amountPerPeriod,
    periodLength: params.periodLength,
    expiryTs: params.expiryTs,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).sendTransaction();
  txSigs.push(delegationTx);

  // Derive PDA
  const { pda: delegationPda } = await client.getDelegationPDA({
    subscriptionAuthority: subscriptionAuthorityPda,
    delegator: params.organizer,
    delegatee: params.delegatee,
    nonce,
  });

  console.log(
    'RecurringDelegation created:',
    delegationPda,
    '| perPeriod:', params.amountPerPeriod.toString(),
    '| period:', params.periodLength.toString(), 's',
    '| tx:', delegationTx
  );

  return { subscriptionAuthorityPda, delegationPda, txSignatures: txSigs };
}

// ─── 4. transferFixed (payout per winner) ────────────────────────────────────

/**
 * Push prize share to a winner.
 * Called by the delegatee backend after draw_winners completes.
 * Delegatee keypair signs — winner pays nothing.
 */
export async function payWinnerFixed(
  delegateeSigner: any,
  params: {
    organizer: Address;
    organizerAta: Address;
    delegationPda: Address;
    winnerAta: Address;
    amount: bigint;
    tokenMint?: Address;
  }
): Promise<string> {
  const client = buildClient(delegateeSigner);
  const mint = params.tokenMint ?? USDC_MINT;

  const tx = await client.transferFixed({
    delegatee: delegateeSigner,
    delegator: params.organizer,
    delegatorAta: params.organizerAta,
    tokenMint: mint,
    delegationPda: params.delegationPda,
    amount: params.amount,
    receiverAta: params.winnerAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).sendTransaction();

  console.log('transferFixed | winner:', params.winnerAta, '| amount:', params.amount.toString(), '| tx:', tx);
  return tx;
}

// ─── 5. transferRecurring (payout for recurring campaigns) ───────────────────

/**
 * Push prize share to a winner for a recurring campaign.
 * Same flow as transferFixed but draws on the RecurringDelegation allowance.
 */
export async function payWinnerRecurring(
  delegateeSigner: any,
  params: {
    organizer: Address;
    organizerAta: Address;
    delegationPda: Address;
    winnerAta: Address;
    amount: bigint;
    tokenMint?: Address;
  }
): Promise<string> {
  const client = buildClient(delegateeSigner);
  const mint = params.tokenMint ?? USDC_MINT;

  const tx = await client.transferRecurring({
    delegatee: delegateeSigner,
    delegator: params.organizer,
    delegatorAta: params.organizerAta,
    tokenMint: mint,
    delegationPda: params.delegationPda,
    amount: params.amount,
    receiverAta: params.winnerAta,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).sendTransaction();

  console.log('transferRecurring | winner:', params.winnerAta, '| amount:', params.amount.toString(), '| tx:', tx);
  return tx;
}

// ─── 6. readDelegation (for PrizePoolPanel solvency display) ─────────────────

/**
 * Read a delegation PDA from chain.
 * Returns cap, remaining allowance, expiry — used by PrizePoolPanel trust widget.
 */
export async function readDelegation(delegationPda: Address) {
  const client = new SubscriptionsClient({ rpc, signer: null as any });
  try {
    // Try fixed first
    const fixed = await client.getFixedDelegation(delegationPda);
    return {
      type: 'fixed' as const,
      cap: fixed.amount,
      remaining: fixed.remainingAmount ?? fixed.amount,
      expiryTs: Number(fixed.expiryTs ?? 0),
      delegatee: fixed.delegatee,
    };
  } catch {
    // Try recurring
    try {
      const recurring = await client.getRecurringDelegation(delegationPda);
      return {
        type: 'recurring' as const,
        cap: recurring.amountPerPeriod,
        remaining: recurring.remainingThisPeriod ?? recurring.amountPerPeriod,
        expiryTs: Number(recurring.expiryTs ?? 0),
        periodLength: Number(recurring.periodLength),
        delegatee: recurring.delegatee,
      };
    } catch {
      return null;
    }
  }
}

// ─── 7. revokeDelegation (after payout — reclaim rent) ───────────────────────

/**
 * Revoke the delegation PDA after all winners are paid.
 * Returns rent to organizer. Called from /organizer/[campaign] manage page.
 */
export async function revokeDelegation(
  organizerSigner: any,
  delegationPda: Address
): Promise<string> {
  const client = buildClient(organizerSigner);
  const tx = await client.revokeDelegation({ delegationPda }).sendTransaction();
  console.log('Delegation revoked:', delegationPda, '| tx:', tx);
  return tx;
}
