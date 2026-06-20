use anchor_lang::prelude::*;

/// Uniqueness guard — one per (campaign, handle_hash).
/// init will fail if it already exists, enforcing one entry per Mastodon handle on-chain.
/// PDA seeds: ["handle_claim", campaign, handle_hash]
#[account]
pub struct HandleClaim {
    /// The campaign this claim belongs to
    pub campaign: Pubkey,
    /// sha256(mastodon_handle)
    pub handle_hash: [u8; 32],
    /// Wallet that entered
    pub participant_wallet: Pubkey,
    /// Bump
    pub bump: u8,
}

impl HandleClaim {
    pub const LEN: usize = 8  // discriminator
        + 32  // campaign
        + 32  // handle_hash
        + 32  // participant_wallet
        + 1;  // bump
}
