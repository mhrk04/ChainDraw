/**
 * payout.ts — Prize distribution via Subscriptions program
 *
 * Uses getTransferFixedInstruction / getTransferRecurringInstruction
 * from @solana/subscriptions v0.3.0 (correct low-level API).
 *
 * Flow per winner:
 *   1. Ensure winner ATA exists — delegatee creates + pays rent if missing
 *   2. transferFixed (one-shot) or transferRecurring (recurring campaign)
 *   3. Winner receives prize with zero SOL required
 *
 * Delegatee keypair signs every transaction.
 * Idempotent: skips entries already marked paid.
 */

import {
  getTransferFixedInstruction,
  getTransferRecurringInstruction,
  findSubscriptionAuthorityPda,
} from '@solana/subscriptions';

import {
  createSolanaRpc,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  address,
  createKeyPairSignerFromBytes,
  KeyPairSigner,
} from '@solana/kit';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_URL =
  process.env.RPC_URL ??
  'https://devnet.helius-rpc.com/?api-key=02923ff0-3d68-4bb1-a1ad-407f5f7d1e5f';

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? 'J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8'
);

const USDC_MINT_PUBKEY = new PublicKey(
  process.env.USDC_MINT ?? '3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks'
);

const USDC_MINT_ADDRESS = address(
  process.env.USDC_MINT ?? '3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks'
);

const TOKEN_PROGRAM_ADDRESS = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

// ─── Setup ────────────────────────────────────────────────────────────────────

function getDelegateeKeypair(): Keypair {
  const secret = process.env.DELEGATEE_SECRET;
  if (!secret) throw new Error('DELEGATEE_SECRET not set');
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function getOrganizerKeypair(): Keypair {
  const secret = process.env.VERIFIER_SECRET;
  if (!secret) throw new Error('VERIFIER_SECRET not set');
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function getConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

function getProgram(payer: Keypair) {
  const connection = getConnection();
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const idlPath = join(__dirname, '../../../../target/idl/chain_draw.json');
  const idl: anchor.Idl = JSON.parse(readFileSync(idlPath, 'utf8'));
  return new anchor.Program(idl, provider);
}

function getRpc() {
  return createSolanaRpc(RPC_URL);
}

async function getDelegateeSigner(): Promise<KeyPairSigner> {
  const kp = getDelegateeKeypair();
  return createKeyPairSignerFromBytes(kp.secretKey);
}

// ─── Send Kit transaction ─────────────────────────────────────────────────────

async function sendKitInstructions(
  signer: KeyPairSigner,
  instructions: any[]
): Promise<string> {
  const rpc = getRpc();
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  const tx = await signTransactionMessageWithSigners(
    appendTransactionMessageInstructions(
      instructions,
      setTransactionMessageLifetimeUsingBlockhash(
        latestBlockhash,
        setTransactionMessageFeePayer(
          signer.address,
          createTransactionMessage({ version: 0 })
        )
      )
    )
  );

  const encoded = getBase64EncodedWireTransaction(tx);
  const sig = await rpc
    .sendTransaction(encoded as any, { encoding: 'base64', skipPreflight: false } as any)
    .send();

  // Poll for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const status = await rpc
        .getSignatureStatuses([sig as any], { searchTransactionHistory: false })
        .send();
      const s = (status.value as any[])[0];
      if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') break;
    } catch { /* retry */ }
  }
  return sig as string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WinnerPayout {
  entryIndex: number;
  participantWallet: string;
  amount: bigint;
  txSignature?: string;
  status: 'paid' | 'failed' | 'skipped';
  error?: string;
}

export interface DrawResult {
  drawTxSignature: string;
  drawSeed: string;
  winnerIndices: number[];
  payouts: WinnerPayout[];
  totalPaid: number;
  campaignStatus: 'Settled' | 'Drawing';
}

// ─── Ensure winner ATA ────────────────────────────────────────────────────────

async function ensureWinnerAta(
  connection: Connection,
  delegatee: Keypair,
  winnerWallet: PublicKey
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(
    USDC_MINT_PUBKEY,
    winnerWallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const account = await connection.getAccountInfo(ata);
  if (account) return ata;

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      delegatee.publicKey,
      ata,
      winnerWallet,
      USDC_MINT_PUBKEY,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, tx, [delegatee], { commitment: 'confirmed' });
  console.log(`  Created ATA for ${winnerWallet.toBase58().slice(0, 8)}…: ${ata.toBase58().slice(0, 8)}…`);
  return ata;
}

// ─── Parse draw logs ──────────────────────────────────────────────────────────

function parseWinnerIndices(logs: string[]): number[] {
  for (const log of logs) {
    const match = log.match(/winners=\[([^\]]+)\]/);
    if (match) {
      return match[1].split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    }
  }
  return [];
}

function parseDrawSeed(logs: string[]): string {
  for (const log of logs) {
    const match = log.match(/seed=\[([^\]]+)\]/);
    if (match) return `[${match[1]}]`;
  }
  return 'unknown';
}

// ─── Entry PDA ────────────────────────────────────────────────────────────────

function deriveEntryPda(campaignPda: PublicKey, index: number): PublicKey {
  const idxBuf = Buffer.alloc(4);
  idxBuf.writeUInt32LE(index);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('entry'), campaignPda.toBuffer(), idxBuf],
    PROGRAM_ID
  );
  return pda;
}

// ─── transferFixed via @solana/subscriptions ──────────────────────────────────

async function payWinnerFixed(params: {
  delegateeSigner: KeyPairSigner;
  subscriptionAuthorityPda: string;
  organizerAta: string;
  delegationPda: string;
  winnerAta: string;
  amount: bigint;
  organizer: string;
}): Promise<string> {
  const { findEventAuthorityPda, SUBSCRIPTIONS_PROGRAM_ADDRESS } = await import('@solana/subscriptions');
  const [eventAuthority] = await findEventAuthorityPda();

  const ix = getTransferFixedInstruction({
    delegatee: params.delegateeSigner as any,
    subscriptionAuthority: address(params.subscriptionAuthorityPda),
    delegationPda: address(params.delegationPda),
    delegatorAta: address(params.organizerAta),
    receiverAta: address(params.winnerAta),
    tokenMint: USDC_MINT_ADDRESS,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    eventAuthority,
    selfProgram: SUBSCRIPTIONS_PROGRAM_ADDRESS,
    // data
    amount: params.amount,
    delegator: address(params.organizer),
    mint: USDC_MINT_ADDRESS,
  } as any);

  return sendKitInstructions(params.delegateeSigner, [ix]);
}

async function payWinnerRecurring(params: {
  delegateeSigner: KeyPairSigner;
  subscriptionAuthorityPda: string;
  organizerAta: string;
  delegationPda: string;
  winnerAta: string;
  amount: bigint;
  organizer: string;
}): Promise<string> {
  const { findEventAuthorityPda, SUBSCRIPTIONS_PROGRAM_ADDRESS } = await import('@solana/subscriptions');
  const [eventAuthority] = await findEventAuthorityPda();

  const ix = getTransferRecurringInstruction({
    delegatee: params.delegateeSigner as any,
    subscriptionAuthority: address(params.subscriptionAuthorityPda),
    delegationPda: address(params.delegationPda),
    delegatorAta: address(params.organizerAta),
    receiverAta: address(params.winnerAta),
    tokenMint: USDC_MINT_ADDRESS,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    eventAuthority,
    selfProgram: SUBSCRIPTIONS_PROGRAM_ADDRESS,
    // data
    amount: params.amount,
    delegator: address(params.organizer),
    mint: USDC_MINT_ADDRESS,
  } as any);

  return sendKitInstructions(params.delegateeSigner, [ix]);
}

// ─── Main: runDrawAndPay ──────────────────────────────────────────────────────

export async function runDrawAndPay(params: {
  campaignPda: string;
  organizer: string;
  campaignId: bigint;
  delegationPda: string;
  organizerAta: string;
  prizeTotal: bigint;
  numWinners: number;
  isRecurring: boolean;
}): Promise<DrawResult> {
  const connection = getConnection();
  const delegateeKp = getDelegateeKeypair();
  const delegateeSigner = await getDelegateeSigner();
  const organizerKp = getOrganizerKeypair();
  const program = getProgram(organizerKp);

  const campaignPdaPk = new PublicKey(params.campaignPda);
  const organizerPk = new PublicKey(params.organizer);

  // Derive subscription authority PDA (needed for transfer instructions)
  const [subscriptionAuthorityPda] = await findSubscriptionAuthorityPda({
    user: address(params.organizer),
    tokenMint: USDC_MINT_ADDRESS,
  });

  const prizeShare = params.prizeTotal / BigInt(params.numWinners);
  const remainder = params.prizeTotal - prizeShare * BigInt(params.numWinners);

  console.log(`\n── Draw & Pay | campaign=${params.campaignPda.slice(0, 8)}… ──`);
  console.log(`  total=${params.prizeTotal} | winners=${params.numWinners} | share=${prizeShare}`);

  // ── Step 1: draw_winners on-chain ──
  console.log('\n[1] draw_winners...');
  const drawTx = await (program.methods as any)
    .drawWinners()
    .accounts({
      campaign: campaignPdaPk,
      organizer: organizerKp.publicKey,
      slotHashes: new PublicKey('SysvarS1otHashes111111111111111111111111111'),
    })
    .signers([organizerKp])
    .rpc({ commitment: 'confirmed' });

  await new Promise((r) => setTimeout(r, 2000));

  const txInfo = await connection.getTransaction(drawTx, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  const logs = txInfo?.meta?.logMessages ?? [];
  const winnerIndices = parseWinnerIndices(logs);
  const drawSeed = parseDrawSeed(logs);

  console.log(`  tx: ${drawTx}`);
  console.log(`  seed: ${drawSeed}`);
  console.log(`  winner indices: [${winnerIndices.join(', ')}]`);

  // ── Step 2: Pay each winner ──
  console.log('\n[2] Paying winners...');
  const payouts: WinnerPayout[] = [];

  for (let i = 0; i < winnerIndices.length; i++) {
    const idx = winnerIndices[i];
    const amount = i === 0 ? prizeShare + remainder : prizeShare;
    const entryPda = deriveEntryPda(campaignPdaPk, idx);

    let participantWallet: string;
    try {
      const entryAccount = await (program.account as any).entry.fetch(entryPda);
      if (entryAccount.paid) {
        console.log(`  Entry #${idx}: already paid — skip`);
        payouts.push({ entryIndex: idx, participantWallet: entryAccount.participantWallet.toBase58(), amount, status: 'skipped' });
        continue;
      }
      participantWallet = entryAccount.participantWallet.toBase58();
    } catch (e: any) {
      payouts.push({ entryIndex: idx, participantWallet: 'unknown', amount, status: 'failed', error: e.message });
      continue;
    }

    const winnerPk = new PublicKey(participantWallet);
    console.log(`  Paying #${idx}: ${participantWallet.slice(0, 8)}… | ${amount} lamports`);

    try {
      // Ensure winner ATA (delegatee pays rent)
      const winnerAta = await ensureWinnerAta(connection, delegateeKp, winnerPk);

      // transferFixed or transferRecurring
      const txSig = params.isRecurring
        ? await payWinnerRecurring({
            delegateeSigner,
            organizer: params.organizer,
            subscriptionAuthorityPda: subscriptionAuthorityPda as unknown as string,
            organizerAta: params.organizerAta,
            delegationPda: params.delegationPda,
            winnerAta: winnerAta.toBase58(),
            amount,
          })
        : await payWinnerFixed({
            delegateeSigner,
            organizer: params.organizer,
            subscriptionAuthorityPda: subscriptionAuthorityPda as unknown as string,
            organizerAta: params.organizerAta,
            delegationPda: params.delegationPda,
            winnerAta: winnerAta.toBase58(),
            amount,
          });

      console.log(`  ✓ paid | tx=${txSig.slice(0, 16)}…`);
      payouts.push({ entryIndex: idx, participantWallet, amount, txSignature: txSig, status: 'paid' });
    } catch (e: any) {
      console.error(`  ✗ failed: ${e.message}`);
      payouts.push({ entryIndex: idx, participantWallet, amount, status: 'failed', error: e.message });
    }

    if (i < winnerIndices.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  const totalPaid = payouts.filter((p) => p.status === 'paid').length;
  const campaignStatus = totalPaid >= params.numWinners ? 'Settled' : 'Drawing';

  console.log(`\n── Complete | ${totalPaid}/${params.numWinners} paid | ${campaignStatus} ──\n`);
  return { drawTxSignature: drawTx, drawSeed, winnerIndices, payouts, totalPaid, campaignStatus };
}
