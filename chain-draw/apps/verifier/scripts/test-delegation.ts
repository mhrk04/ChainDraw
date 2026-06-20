/**
 * test-delegation.ts
 *
 * Smoke-tests the Fixed and Recurring delegation flow on devnet.
 * Run with: npx tsx scripts/test-delegation.ts
 *
 * Pre-requisites:
 *   - VERIFIER_SECRET in .env (organizer signs in this test)
 *   - USDC_MINT in .env
 *   - Organizer ATA funded with test USDC
 */

import 'dotenv/config';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import bs58 from 'bs58';
import {
  createFixedDelegation,
  createRecurringDelegation,
  readDelegation,
} from '../src/lib/delegation.js';

async function main() {
  // Load organizer signer (using deployer keypair for the test)
  const secret = process.env.VERIFIER_SECRET!;
  const bytes = bs58.decode(secret);
  const signer = await createKeyPairSignerFromBytes(bytes);
  const organizer = signer.address;

  console.log('\n── ChainDraw Delegation Smoke Test ──');
  console.log('Organizer:', organizer);

  const SERVICE_AUTHORITY = process.env.SERVICE_AUTHORITY!;
  const USDC_MINT_ADDR = process.env.USDC_MINT!;

  // We need the organizer's ATA — derive it
  // For the test, we pass a placeholder; real flow derives it from wallet
  const organizerAta = process.env.ORGANIZER_ATA ?? 'EEJhNCzdMCCEFxPuUV5vc9sAxVWrn5W16FvAqJTHoiKT';

  const campaignId = BigInt(Date.now());
  const cutoffTs = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log('\n[1] Testing FixedDelegation...');
  try {
    const fixed = await createFixedDelegation(signer, {
      organizer,
      organizerAta: organizerAta as any,
      delegatee: SERVICE_AUTHORITY as any,
      campaignId,
      prizeTotal: 10_000_000n, // 10 USDC
      cutoffTs,
    });
    console.log('  FixedDelegation PDA:', fixed.delegationPda);
    console.log('  Txs:', fixed.txSignatures);

    console.log('\n[2] Reading FixedDelegation from chain...');
    const info = await readDelegation(fixed.delegationPda);
    console.log('  Delegation info:', JSON.stringify(info, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (e) {
    console.error('  FixedDelegation failed:', e);
  }

  const recurringCampaignId = campaignId + 1n;
  console.log('\n[3] Testing RecurringDelegation (weekly)...');
  try {
    const recurring = await createRecurringDelegation(signer, {
      organizer,
      organizerAta: organizerAta as any,
      delegatee: SERVICE_AUTHORITY as any,
      campaignId: recurringCampaignId,
      amountPerPeriod: 5_000_000n, // 5 USDC per week
      periodLength: 604800n,        // weekly
      expiryTs: BigInt(Math.floor(Date.now() / 1000) + 86400 * 30), // 30 days
    });
    console.log('  RecurringDelegation PDA:', recurring.delegationPda);
    console.log('  Txs:', recurring.txSignatures);

    console.log('\n[4] Reading RecurringDelegation from chain...');
    const info = await readDelegation(recurring.delegationPda);
    console.log('  Delegation info:', JSON.stringify(info, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (e) {
    console.error('  RecurringDelegation failed:', e);
  }

  console.log('\n── Done ──\n');
}

main().catch(console.error);
