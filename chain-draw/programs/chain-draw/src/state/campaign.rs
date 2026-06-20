use anchor_lang::prelude::*;

/// On-chain campaign account.
/// campaign_id (u64) doubles as the delegation nonce — one nonce per campaign per organizer.
#[account]
#[derive(Default)]
pub struct Campaign {
    /// Unique campaign id — stored so all instructions can re-derive PDA seeds
    pub campaign_id: u64,
    /// Organizer wallet — must sign initialize + draw
    pub organizer: Pubkey,
    /// Verifier keypair (backend) — only signer allowed to call add_verified_entry
    pub verifier: Pubkey,
    /// USDC (or any SPL) mint for the prize
    pub prize_mint: Pubkey,
    /// Total prize in base units (e.g. 100 USDC = 100_000_000)
    pub prize_total: u64,
    /// Number of winners to draw
    pub num_winners: u8,
    /// Unix timestamp after which entries are closed and draw can run
    pub cutoff_ts: i64,
    /// IPFS/Arweave URI for requirements JSON (Mastodon post URL, rules, etc.)
    pub requirements_uri: String,
    /// The Fixed or Recurring Delegation PDA — public commitment anyone can verify
    pub delegation_pda: Pubkey,
    /// Number of verified entries written so far
    pub entry_count: u32,
    /// Campaign status
    pub status: CampaignStatus,
    /// true = RecurringDelegation (weekly/monthly giveaway); false = FixedDelegation (one-shot)
    pub is_recurring: bool,
    /// Period length in seconds (only meaningful when is_recurring = true)
    /// e.g. 604800 = 7 days (weekly), 2592000 = 30 days (monthly)
    pub period_length: i64,
    /// On-chain draw seed (slot hash at draw time) — published so anyone can verify
    pub draw_seed: Option<[u8; 32]>,
    /// Bump for the campaign PDA
    pub bump: u8,
}

impl Campaign {
    /// Account discriminator + all fixed fields + max requirements_uri (200 chars)
    pub const LEN: usize = 8   // discriminator
        + 8    // campaign_id
        + 32   // organizer
        + 32   // verifier
        + 32   // prize_mint
        + 8    // prize_total
        + 1    // num_winners
        + 8    // cutoff_ts
        + 4 + 200 // requirements_uri (vec prefix + max 200 bytes)
        + 32   // delegation_pda
        + 4    // entry_count
        + 1    // status
        + 1    // is_recurring
        + 8    // period_length
        + 1 + 32 // draw_seed (Option<[u8;32]>)
        + 1;   // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum CampaignStatus {
    #[default]
    Open,
    Drawing,
    Settled,
}
