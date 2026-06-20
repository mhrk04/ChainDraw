/**
 * onchain.ts — On-chain operations using Anchor IDL
 *
 * Verifier keypair signs and pays gas for all entry writes.
 * Participants never sign or pay anything.
 */

import 'dotenv/config';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { createHash } from 'crypto';
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

// ─── Setup ────────────────────────────────────────────────────────────────────

function getVerifierKeypair(): Keypair {
  const secret = process.env.VERIFIER_SECRET;
  if (!secret) throw new Error('VERIFIER_SECRET not set in env');
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function getConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

function getProgram() {
  const verifier = getVerifierKeypair();
  const connection = getConnection();

  const wallet = new anchor.Wallet(verifier);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  // Load IDL from build output
  const idlPath = join(__dirname, '../../../../target/idl/chain_draw.json');
  let idl: anchor.Idl;
  try {
    idl = JSON.parse(readFileSync(idlPath, 'utf8'));
  } catch {
    throw new Error(`IDL not found at ${idlPath} — run "anchor build" first`);
  }

  return new anchor.Program(idl, provider);
}

// ─── sha256 handle hash ───────────────────────────────────────────────────────

/**
 * Hash the Mastodon handle with SHA-256.
 * Stored on-chain — we never expose the raw handle to avoid PII on-chain.
 */
export function hashHandle(handle: string): number[] {
  const hash = createHash('sha256').update(handle.toLowerCase().trim()).digest();
  return Array.from(hash);
}

// ─── PDA derivation ───────────────────────────────────────────────────────────

export function deriveCampaignPda(organizer: PublicKey, campaignId: bigint): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(campaignId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('campaign'), organizer.toBuffer(), idBuf],
    PROGRAM_ID
  );
}

export function deriveEntryPda(campaignPda: PublicKey, index: number): [PublicKey, number] {
  const idxBuf = Buffer.alloc(4);
  idxBuf.writeUInt32LE(index);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('entry'), campaignPda.toBuffer(), idxBuf],
    PROGRAM_ID
  );
}

export function deriveHandleClaimPda(
  campaignPda: PublicKey,
  handleHash: number[]
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('handle_claim'), campaignPda.toBuffer(), Buffer.from(handleHash)],
    PROGRAM_ID
  );
}

// ─── addVerifiedEntry ─────────────────────────────────────────────────────────

/**
 * Write a verified entry on-chain.
 * Verifier keypair signs and pays gas — participant pays nothing.
 *
 * Returns the entry index and transaction signature.
 */
export async function addVerifiedEntry(params: {
  campaignPda: string;        // campaign PDA pubkey (string)
  organizer: string;          // organizer pubkey (string) — needed to re-derive campaign seeds
  campaignId: bigint;         // for PDA derivation
  participantWallet: string;  // prize destination wallet
  mastodonHandle: string;     // raw handle — hashed before storing
}): Promise<{ entryIndex: number; txSignature: string }> {
  const program = getProgram();
  const verifier = getVerifierKeypair();

  const campaignPda = new PublicKey(params.campaignPda);
  const participantWallet = new PublicKey(params.participantWallet);

  // Fetch current entry count from campaign account
  const campaignAccount = await (program.account as any).campaign.fetch(campaignPda);
  const entryCount: number = campaignAccount.entryCount;

  // Derive PDAs
  const handleHash = hashHandle(params.mastodonHandle);
  const [entryPda] = deriveEntryPda(campaignPda, entryCount);
  const [handleClaimPda] = deriveHandleClaimPda(campaignPda, handleHash);

  // Check for duplicate before sending tx (saves gas on already-verified handles)
  try {
    await (program.account as any).handleClaim.fetch(handleClaimPda);
    throw new Error('DUPLICATE_HANDLE');
  } catch (e: any) {
    if (e.message === 'DUPLICATE_HANDLE') throw e;
    // Account doesn't exist yet — good, proceed
  }

  const txSignature = await (program.methods as any)
    .addVerifiedEntry(handleHash, participantWallet)
    .accounts({
      campaign: campaignPda,
      entry: entryPda,
      handleClaim: handleClaimPda,
      verifier: verifier.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([verifier])
    .rpc();

  console.log(
    `Entry #${entryCount} written | wallet=${params.participantWallet} | tx=${txSignature}`
  );

  return { entryIndex: entryCount, txSignature };
}

// ─── fetchCampaign ────────────────────────────────────────────────────────────

export async function fetchCampaignAccount(campaignPda: string) {
  const program = getProgram();
  try {
    return await (program.account as any).campaign.fetch(new PublicKey(campaignPda));
  } catch {
    return null;
  }
}

// ─── fetchAllEntries ──────────────────────────────────────────────────────────

export async function fetchAllEntries(campaignPda: string) {
  const program = getProgram();
  const all = await (program.account as any).entry.all([
    {
      memcmp: {
        offset: 8, // skip discriminator
        bytes: campaignPda,
      },
    },
  ]);
  return all.map((e: any) => ({
    pubkey: e.publicKey.toBase58(),
    ...e.account,
  }));
}
