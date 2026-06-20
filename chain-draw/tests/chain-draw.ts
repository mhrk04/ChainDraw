import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ChainDraw } from "../target/types/chain_draw";
import { PublicKey, Keypair, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { assert } from "chai";

describe("chain-draw", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.ChainDraw as Program<ChainDraw>;

  const organizer = provider.wallet as anchor.Wallet;
  const verifier = Keypair.generate();
  const participant = Keypair.generate();

  const CAMPAIGN_ID = new anchor.BN(Date.now()); // unique per test run
  const PRIZE_MINT = Keypair.generate().publicKey; // mock mint for unit tests
  const DELEGATION_PDA = Keypair.generate().publicKey; // mock delegation PDA

  // Derive campaign PDA
  const [campaignPda, campaignBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("campaign"),
      organizer.publicKey.toBuffer(),
      CAMPAIGN_ID.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // Helper: derive entry PDA
  const entryPda = (index: number) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("entry"),
        campaignPda.toBuffer(),
        new anchor.BN(index).toArrayLike(Buffer, "le", 4),
      ],
      program.programId
    )[0];

  // Helper: derive handle claim PDA
  const handleClaimPda = (hash: Buffer) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("handle_claim"), campaignPda.toBuffer(), hash],
      program.programId
    )[0];

  before(async () => {
    // Fund verifier from organizer for tests
    const tx = await provider.connection.requestAirdrop(
      verifier.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(tx);
  });

  // ─────────────────────────────────────────────
  // Test 1: initialize_campaign (one-shot)
  // ─────────────────────────────────────────────
  it("initializes a one-shot campaign (FixedDelegation)", async () => {
    const cutoff = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    await program.methods
      .initializeCampaign({
        campaignId: CAMPAIGN_ID,
        verifier: verifier.publicKey,
        prizeMint: PRIZE_MINT,
        prizeTotal: new anchor.BN(100_000_000), // 100 USDC
        numWinners: 3,
        cutoffTs: new anchor.BN(cutoff),
        requirementsUri: "https://mastodon.social/@chaindraw/1234567890",
        delegationPda: DELEGATION_PDA,
        isRecurring: false,
        periodLength: new anchor.BN(0),
      })
      .accounts({
        campaign: campaignPda,
        organizer: organizer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(campaign.campaignId.toString(), CAMPAIGN_ID.toString());
    assert.equal(campaign.organizer.toBase58(), organizer.publicKey.toBase58());
    assert.equal(campaign.verifier.toBase58(), verifier.publicKey.toBase58());
    assert.equal(campaign.numWinners, 3);
    assert.equal(campaign.isRecurring, false);
    assert.equal(campaign.entryCount, 0);
    assert.deepEqual(campaign.status, { open: {} });
    console.log("  ✓ Campaign PDA:", campaignPda.toBase58());
  });

  // ─────────────────────────────────────────────
  // Test 2: initialize_campaign (recurring)
  // ─────────────────────────────────────────────
  it("initializes a recurring campaign (RecurringDelegation)", async () => {
    const recurringCampaignId = new anchor.BN(CAMPAIGN_ID.toNumber() + 1);
    const [recurringPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("campaign"),
        organizer.publicKey.toBuffer(),
        recurringCampaignId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .initializeCampaign({
        campaignId: recurringCampaignId,
        verifier: verifier.publicKey,
        prizeMint: PRIZE_MINT,
        prizeTotal: new anchor.BN(50_000_000), // 50 USDC per period
        numWinners: 1,
        cutoffTs: new anchor.BN(Math.floor(Date.now() / 1000) + 7200),
        requirementsUri: "https://mastodon.social/@chaindraw/weekly",
        delegationPda: DELEGATION_PDA,
        isRecurring: true,
        periodLength: new anchor.BN(604800), // weekly
      })
      .accounts({
        campaign: recurringPda,
        organizer: organizer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const campaign = await program.account.campaign.fetch(recurringPda);
    assert.equal(campaign.isRecurring, true);
    assert.equal(campaign.periodLength.toString(), "604800");
    console.log("  ✓ Recurring campaign (weekly) PDA:", recurringPda.toBase58());
  });

  // ─────────────────────────────────────────────
  // Test 3: add_verified_entry succeeds first time
  // ─────────────────────────────────────────────
  it("adds a verified entry (verifier pays gas, participant pays nothing)", async () => {
    const handleHash = Buffer.alloc(32, 1); // mock sha256("@alice@mastodon.social")
    const entry0 = entryPda(0);
    const claim0 = handleClaimPda(handleHash);

    await program.methods
      .addVerifiedEntry(Array.from(handleHash), participant.publicKey)
      .accounts({
        campaign: campaignPda,
        entry: entry0,
        handleClaim: claim0,
        verifier: verifier.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([verifier])
      .rpc();

    const campaign = await program.account.campaign.fetch(campaignPda);
    assert.equal(campaign.entryCount, 1);

    const entry = await program.account.entry.fetch(entry0);
    assert.equal(entry.index, 0);
    assert.equal(entry.participantWallet.toBase58(), participant.publicKey.toBase58());
    assert.equal(entry.won, false);
    assert.equal(entry.paid, false);
    console.log("  ✓ Entry #0 written | participant:", participant.publicKey.toBase58());
  });

  // ─────────────────────────────────────────────
  // Test 4: add_verified_entry rejects duplicate handle
  // ─────────────────────────────────────────────
  it("rejects a duplicate handle entry (HandleClaim PDA init fails)", async () => {
    const handleHash = Buffer.alloc(32, 1); // same hash as test 3
    const entry1 = entryPda(1);
    const claim0 = handleClaimPda(handleHash); // same PDA — init will fail

    try {
      await program.methods
        .addVerifiedEntry(Array.from(handleHash), participant.publicKey)
        .accounts({
          campaign: campaignPda,
          entry: entry1,
          handleClaim: claim0,
          verifier: verifier.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([verifier])
        .rpc();
      assert.fail("Should have thrown for duplicate handle");
    } catch (e: any) {
      // Expected: account already exists
      assert.ok(
        e.message.includes("already in use") || e.message.includes("custom program error"),
        `Unexpected error: ${e.message}`
      );
      console.log("  ✓ Duplicate handle correctly rejected");
    }
  });

  // ─────────────────────────────────────────────
  // Test 5: draw_winners rejects before cutoff
  // ─────────────────────────────────────────────
  it("rejects draw before cutoff", async () => {
    try {
      await program.methods
        .drawWinners()
        .accounts({
          campaign: campaignPda,
          organizer: organizer.publicKey,
          slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        })
        .rpc();
      assert.fail("Should have thrown DrawTooEarly");
    } catch (e: any) {
      assert.ok(
        e.message.includes("DrawTooEarly") || e.message.includes("custom program error"),
        `Unexpected error: ${e.message}`
      );
      console.log("  ✓ Draw before cutoff correctly rejected");
    }
  });
});
