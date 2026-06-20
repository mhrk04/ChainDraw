use anchor_lang::prelude::*;

/// One verified participant entry per campaign.
/// PDA seeds: ["entry", campaign, index_le_bytes]
#[account]
pub struct Entry {
    /// Campaign this entry belongs to
    pub campaign: Pubkey,
    /// Sequential index (0-based) — used by draw_winners to pick winners
    pub index: u32,
    /// Winner's wallet — prize will be pushed here via transferFixed/transferRecurring
    pub participant_wallet: Pubkey,
    /// sha256(mastodon_handle) — stored to avoid exposing PII on-chain
    /// HandleClaim PDA enforces uniqueness; this is a second reference for indexing
    pub handle_hash: [u8; 32],
    /// Set to true after draw_winners selects this entry
    pub won: bool,
    /// Set to true after transferFixed/transferRecurring payout succeeds
    pub paid: bool,
    /// Bump for this entry PDA
    pub bump: u8,
}

impl Entry {
    pub const LEN: usize = 8   // discriminator
        + 32   // campaign
        + 4    // index
        + 32   // participant_wallet
        + 32   // handle_hash
        + 1    // won
        + 1    // paid
        + 1;   // bump
}
