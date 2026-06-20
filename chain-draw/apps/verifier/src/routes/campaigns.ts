import { Router } from 'express';
import { address } from '@solana/kit';
import {
  createFixedDelegation,
  createRecurringDelegation,
  loadSignerFromEnv,
} from '../lib/delegation.js';
import { deriveCampaignPda } from '../lib/onchain.js';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const campaignsRouter = Router();

const RPC_URL = process.env.RPC_URL ?? 'https://devnet.helius-rpc.com/?api-key=02923ff0-3d68-4bb1-a1ad-407f5f7d1e5f';
const EVENTS_PATH = join(process.cwd(), 'data', 'events.json');

function loadEvents() {
  try {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    if (!existsSync(EVENTS_PATH)) writeFileSync(EVENTS_PATH, '{}');
    return JSON.parse(readFileSync(EVENTS_PATH, 'utf8'));
  } catch { return {}; }
}

function saveEvents(data: Record<string, any>) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2));
}

function getProgram(payer: Keypair) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const idlPath = resolve(__dirname, '../../../../target/idl/chain_draw.json');
  const idl: anchor.Idl = JSON.parse(readFileSync(idlPath, 'utf8'));
  return new anchor.Program(idl, provider);
}

// POST /api/campaigns/create
// Called by the organizer wizard after they fill in the form.
// For demo: verifier backend holds the signer keypair and creates all on-chain accounts.
// Production: organizer signs txs directly via Phantom.
campaignsRouter.post('/create', async (req, res) => {
  const {
    organizer, organizerAta, delegatee,
    campaignId, cutoffTs, prizeTotalBase, numWinners,
    isRecurring, periodLength,
    title, postUrl, instance, statusId, organizerMastodonId,
  } = req.body;

  const required = ['organizer', 'organizerAta', 'delegatee', 'campaignId',
    'cutoffTs', 'prizeTotalBase', 'numWinners', 'title', 'postUrl', 'instance', 'statusId'];
  for (const f of required) {
    if (!req.body[f]) return res.status(400).json({ error: `Missing: ${f}` });
  }

  try {
    // Load verifier keypair (acts as organizer signer in demo)
    const verifierKp = Keypair.fromSecretKey(bs58.decode(process.env.VERIFIER_SECRET!));
    const program = getProgram(verifierKp);

    const campaignIdBig = BigInt(campaignId);
    // Demo: verifier signs, so PDA seeds must use the signer's key
    // (Anchor uses organizer.key().as_ref() which = verifierKp.publicKey)
    const [campaignPda] = deriveCampaignPda(verifierKp.publicKey, campaignIdBig);

    const requirementsUri = postUrl.slice(0, 200);

    // Step 1: initialize_campaign on-chain
    const signer = await loadSignerFromEnv('VERIFIER_SECRET');

    // Derive delegation PDA first (placeholder until delegation created)
    const delegationPdaPlaceholder = campaignPda.toBase58();

    await (program.methods as any)
      .initializeCampaign({
        campaignId: new anchor.BN(campaignId),
        verifier: verifierKp.publicKey,
        prizeMint: new PublicKey(process.env.USDC_MINT!),
        prizeTotal: new anchor.BN(prizeTotalBase),
        numWinners,
        cutoffTs: new anchor.BN(cutoffTs),
        requirementsUri,
        delegationPda: campaignPda, // updated after delegation created
        isRecurring,
        periodLength: new anchor.BN(periodLength ?? 0),
      })
      .accounts({
        campaign: campaignPda,
        organizer: verifierKp.publicKey, // demo: verifier acts as organizer
        systemProgram: SystemProgram.programId,
      })
      .signers([verifierKp])
      .rpc({ commitment: 'confirmed' });

    console.log('Campaign initialized:', campaignPda.toBase58());

    // Step 2: create Fixed or Recurring Delegation
    let delegationResult;
    const orgAddress = address(organizer);
    const ataAddress = address(organizerAta);
    const delegateeAddress = address(delegatee);

    if (isRecurring) {
      delegationResult = await createRecurringDelegation(signer, {
        organizerAta: ataAddress,
        delegatee: delegateeAddress,
        campaignId: campaignIdBig,
        amountPerPeriod: BigInt(prizeTotalBase),
        periodLength: BigInt(periodLength ?? 604800),
        expiryTs: BigInt(cutoffTs + 86400 * 30), // 30 days after cutoff
      });
    } else {
      delegationResult = await createFixedDelegation(signer, {
        organizerAta: ataAddress,
        delegatee: delegateeAddress,
        campaignId: campaignIdBig,
        prizeTotal: BigInt(prizeTotalBase),
        cutoffTs: BigInt(cutoffTs + 3600), // 1hr buffer
      });
    }

    // Step 3: Store metadata in local store
    const events = loadEvents();
    const campaignPdaStr = campaignPda.toBase58();
    events[campaignPdaStr] = {
      campaign: campaignPdaStr,
      campaignId: campaignId.toString(),
      organizer,
      organizerAta,
      delegatee,
      delegationPda: delegationResult.delegationPda.toString(),
      isRecurring,
      periodLength: parseInt(periodLength ?? '0'),
      prizeTotal: prizeTotalBase.toString(),
      numWinners,
      cutoffTs,
      requirementsUri,
      postUrl,
      instance,
      statusId,
      organizerMastodonId: organizerMastodonId ?? '',
      title,
      entryCount: 0,
      status: 'Open',
      createdAt: Date.now(),
      txSignatures: delegationResult.txSignatures,
    };
    saveEvents(events);

    console.log('Campaign created:', campaignPdaStr, '| delegation:', delegationResult.delegationPda);

    return res.json({
      ok: true,
      campaignPda: campaignPdaStr,
      delegationPda: delegationResult.delegationPda.toString(),
      txSignatures: delegationResult.txSignatures,
    });
  } catch (e: any) {
    console.error('Campaign creation failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
});
