/**
 * delegation.ts — Subscriptions & Allowances integration
 *
 * Program: De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44
 * Source:  github.com/solana-foundation/subscriptions (Cantina audited)
 *
 * Five Subscriptions primitives used (track compliance):
 *   1. getInitSubscriptionAuthorityInstruction  — once per (organizer, mint)
 *   2. getCreateFixedDelegationInstruction      — one-shot prize commitment
 *   3. getCreateRecurringDelegationInstruction  — weekly/monthly giveaway
 *   4. getTransferFixedInstruction              — payout per winner (in payout.ts)
 *   5. getRevokeDelegationInstruction           — reclaim rent after payout
 */

import {
  getInitSubscriptionAuthorityInstruction,
  getCreateFixedDelegationInstruction,
  getCreateRecurringDelegationInstruction,
  getRevokeDelegationInstruction,
  findSubscriptionAuthorityPda,
  findFixedDelegationPda,
  findRecurringDelegationPda,
  fetchMaybeFixedDelegation,
  fetchMaybeRecurringDelegation,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
} from '@solana/subscriptions';

import {
  createSolanaRpc,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  sendAndConfirmTransactionFactory,
  address,
  Address,
  createKeyPairSignerFromBytes,
  KeyPairSigner,
} from '@solana/kit';

import bs58 from 'bs58';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOKEN_PROGRAM_ADDRESS = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const USDC_MINT_ADDRESS = address(
  process.env.USDC_MINT ?? '3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks'
);

const RPC_URL =
  process.env.RPC_URL ??
  'https://devnet.helius-rpc.com/?api-key=02923ff0-3d68-4bb1-a1ad-407f5f7d1e5f';

// ─── RPC ─────────────────────────────────────────────────────────────────────

export function getRpc() {
  return createSolanaRpc(RPC_URL);
}

// ─── Signer ───────────────────────────────────────────────────────────────────

export async function loadSignerFromEnv(envVar: string): Promise<KeyPairSigner> {
  const secret = process.env[envVar];
  if (!secret) throw new Error(`Missing env var: ${envVar}`);
  return createKeyPairSignerFromBytes(bs58.decode(secret));
}

// ─── Send transaction ─────────────────────────────────────────────────────────

export async function sendInstructions(
  signer: KeyPairSigner,
  instructions: any[]
): Promise<string> {
  const rpc = getRpc();
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const txMessage = appendTransactionMessageInstructions(
    instructions,
    setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash,
      setTransactionMessageFeePayer(
        signer.address,
        createTransactionMessage({ version: 0 })
      )
    )
  );

  const signedTx = await signTransactionMessageWithSigners(txMessage);
  const encoded = getBase64EncodedWireTransaction(signedTx);
  const sig = await rpc
    .sendTransaction(encoded as any, { encoding: 'base64', skipPreflight: false } as any)
    .send();

  // Poll for confirmation
  let confirmed = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const status = await rpc
        .getSignatureStatuses([sig as any], { searchTransactionHistory: false })
        .send();
      const s = (status.value as any[])[0];
      if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') {
        confirmed = true;
        break;
      }
    } catch { /* retry */ }
  }
  if (!confirmed) console.warn('Tx may not be confirmed yet:', sig);
  return sig as string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegationResult {
  subscriptionAuthorityPda: Address;
  delegationPda: Address;
  txSignatures: string[];
}

// ─── 1. ensureSubscriptionAuthority ──────────────────────────────────────────

export async function ensureSubscriptionAuthority(
  signer: KeyPairSigner,
  params: { organizerAta: Address; tokenMint?: Address }
): Promise<{ subscriptionAuthorityPda: Address; tx?: string }> {
  const rpc = getRpc();
  const mint = params.tokenMint ?? USDC_MINT_ADDRESS;

  const [saPda] = await findSubscriptionAuthorityPda({
    user: signer.address,
    tokenMint: mint,
  });

  const existing = await fetchMaybeSubscriptionAuthority(rpc, saPda);
  if (existing.exists) {
    console.log('SubscriptionAuthority already exists:', saPda);
    return { subscriptionAuthorityPda: saPda };
  }

  const ix = getInitSubscriptionAuthorityInstruction({
    owner: signer as any,
    subscriptionAuthority: saPda,
    tokenMint: mint,
    userAta: params.organizerAta,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

  const tx = await sendInstructions(signer, [ix]);
  console.log('SubscriptionAuthority initialized:', saPda, '| tx:', tx);
  return { subscriptionAuthorityPda: saPda, tx };
}

async function fetchMaybeSubscriptionAuthority(rpc: any, address: Address) {
  try {
    const { fetchMaybeSubscriptionAuthority: fetch } = await import('@solana/subscriptions');
    return fetch(rpc, address);
  } catch {
    return { exists: false };
  }
}

// ─── 2. createFixedDelegation ────────────────────────────────────────────────

export async function createFixedDelegation(
  signer: KeyPairSigner,
  params: {
    organizerAta: Address;
    delegatee: Address;
    campaignId: bigint;
    prizeTotal: bigint;
    cutoffTs: bigint;
    tokenMint?: Address;
  }
): Promise<DelegationResult> {
  const mint = params.tokenMint ?? USDC_MINT_ADDRESS;
  const txSigs: string[] = [];

  const { subscriptionAuthorityPda, tx: authTx } =
    await ensureSubscriptionAuthority(signer, { organizerAta: params.organizerAta, tokenMint: mint });
  if (authTx) txSigs.push(authTx);

  const [delegationPda] = await findFixedDelegationPda({
    subscriptionAuthority: subscriptionAuthorityPda,
    delegator: signer.address,
    delegatee: params.delegatee,
    nonce: params.campaignId,
  });

  const ix = getCreateFixedDelegationInstruction({
    delegator: signer as any,
    subscriptionAuthority: subscriptionAuthorityPda,
    delegationAccount: delegationPda,
    delegatee: params.delegatee,
    // data args
    nonce: params.campaignId,
    amount: params.prizeTotal,
    expiryTs: params.cutoffTs,
    expectedSubscriptionAuthorityInitId: 0n,
  } as any);

  const tx = await sendInstructions(signer, [ix]);
  txSigs.push(tx);
  console.log('FixedDelegation created:', delegationPda, '| tx:', tx);
  return { subscriptionAuthorityPda, delegationPda, txSignatures: txSigs };
}

// ─── 3. createRecurringDelegation ────────────────────────────────────────────

export async function createRecurringDelegation(
  signer: KeyPairSigner,
  params: {
    organizerAta: Address;
    delegatee: Address;
    campaignId: bigint;
    amountPerPeriod: bigint;
    periodLength: bigint;
    expiryTs: bigint;
    tokenMint?: Address;
  }
): Promise<DelegationResult> {
  const mint = params.tokenMint ?? USDC_MINT_ADDRESS;
  const txSigs: string[] = [];

  const { subscriptionAuthorityPda, tx: authTx } =
    await ensureSubscriptionAuthority(signer, { organizerAta: params.organizerAta, tokenMint: mint });
  if (authTx) txSigs.push(authTx);

  const [delegationPda] = await findRecurringDelegationPda({
    subscriptionAuthority: subscriptionAuthorityPda,
    delegator: signer.address,
    delegatee: params.delegatee,
    nonce: params.campaignId,
  });

  const ix = getCreateRecurringDelegationInstruction({
    delegator: signer as any,
    subscriptionAuthority: subscriptionAuthorityPda,
    delegationAccount: delegationPda,
    delegatee: params.delegatee,
    // data args
    nonce: params.campaignId,
    amountPerPeriod: params.amountPerPeriod,
    periodLengthS: params.periodLength,
    startTs: BigInt(Math.floor(Date.now() / 1000)),
    expiryTs: params.expiryTs,
    expectedSubscriptionAuthorityInitId: 0n,
  } as any);

  const tx = await sendInstructions(signer, [ix]);
  txSigs.push(tx);
  console.log('RecurringDelegation created:', delegationPda, '| tx:', tx);
  return { subscriptionAuthorityPda, delegationPda, txSignatures: txSigs };
}

// ─── 4. readDelegation ───────────────────────────────────────────────────────

export async function readDelegation(delegationPdaAddr: Address) {
  const rpc = getRpc();

  try {
    const fixed = await fetchMaybeFixedDelegation(rpc, delegationPdaAddr);
    if (fixed.exists) {
      return {
        type: 'fixed' as const,
        cap: (fixed.data as any).amount,
        remaining: (fixed.data as any).remainingAmount ?? (fixed.data as any).amount,
        expiryTs: Number((fixed.data as any).expiryTs ?? 0),
        delegatee: (fixed.data as any).delegatee,
      };
    }
  } catch { /* try recurring */ }

  try {
    const recurring = await fetchMaybeRecurringDelegation(rpc, delegationPdaAddr);
    if (recurring.exists) {
      return {
        type: 'recurring' as const,
        cap: (recurring.data as any).amountPerPeriod,
        remaining: (recurring.data as any).remainingThisPeriod ?? (recurring.data as any).amountPerPeriod,
        expiryTs: Number((recurring.data as any).expiryTs ?? 0),
        periodLength: Number((recurring.data as any).periodLengthS),
        delegatee: (recurring.data as any).delegatee,
      };
    }
  } catch { /* not found */ }

  return null;
}

// ─── 5. revokeDelegation ─────────────────────────────────────────────────────

export async function revokeDelegation(
  signer: KeyPairSigner,
  delegationPda: Address
): Promise<string> {
  const ix = getRevokeDelegationInstruction({
    authority: signer as any,
    delegationAccount: delegationPda,
  });
  const tx = await sendInstructions(signer, [ix]);
  console.log('Delegation revoked:', delegationPda, '| tx:', tx);
  return tx;
}
