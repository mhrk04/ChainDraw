/**
 * test-draw.ts — Smoke test for draw + pay pipeline
 *
 * Run with: npx tsx scripts/test-draw.ts
 *
 * Pre-requisites:
 *   - Campaign deployed + entries written (run test-delegation.ts first)
 *   - DELEGATEE_SECRET, VERIFIER_SECRET, USDC_MINT in .env
 *   - Organizer ATA has USDC + delegation created
 *
 * This test calls the POST /api/events/:campaign/draw endpoint directly
 * using SKIP_AUTH=true to bypass the organizer signature check.
 */

import 'dotenv/config';

const VERIFIER_URL = process.env.VERIFIER_URL ?? 'http://localhost:3001';

async function main() {
  console.log('\n── ChainDraw Draw & Pay Smoke Test ──\n');
  console.log('Verifier URL:', VERIFIER_URL);

  // List campaigns from the events store
  const eventsRes = await fetch(`${VERIFIER_URL}/api/events`);
  const { events } = await eventsRes.json();
  console.log(`Found ${events.length} campaign(s)`);

  if (events.length === 0) {
    console.log('No campaigns found. Create one via POST /api/events first.');
    return;
  }

  const campaign = events[0];
  const campaignPda = campaign.campaign;
  console.log(`\nTesting draw on campaign: ${campaignPda}`);
  console.log(`  prizeTotal: ${campaign.prizeTotal}`);
  console.log(`  numWinners: ${campaign.numWinners}`);
  console.log(`  isRecurring: ${campaign.isRecurring}`);
  console.log(`  status: ${campaign.status}`);
  console.log(`  entryCount: ${campaign.entryCount ?? 'unknown'}`);

  // Trigger draw (SKIP_AUTH=true bypasses signature check)
  console.log('\n[1] Triggering draw...');
  const drawRes = await fetch(`${VERIFIER_URL}/api/events/${campaignPda}/draw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature: 'dev-bypass',
      nonce: campaignPda,
    }),
  });

  const result = await drawRes.json();
  console.log('\nDraw result:');
  console.log(JSON.stringify(result, null, 2));

  if (result.drawTxSignature) {
    console.log(`\n✓ Draw tx: https://explorer.solana.com/tx/${result.drawTxSignature}?cluster=devnet`);
  }

  if (result.payouts?.length > 0) {
    console.log('\nPayout summary:');
    for (const p of result.payouts) {
      console.log(
        `  Entry #${p.entryIndex} → ${p.participantWallet?.slice(0, 8)}… | ${p.status}`,
        p.explorerUrl ? `| ${p.explorerUrl}` : ''
      );
    }
  }

  console.log('\n── Done ──\n');
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
