use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8");

#[program]
pub mod chain_draw {
    use super::*;

    /// Organizer initializes a campaign.
    /// campaign_id doubles as the delegation nonce — unique per organizer.
    /// is_recurring + period_length enable the RecurringDelegation track primitive.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        params: InitializeCampaignParams,
    ) -> Result<()> {
        instructions::initialize_campaign::handler(ctx, params)
    }

    /// Verifier backend writes a verified entry on-chain.
    /// participant_wallet is the prize destination — participant signs nothing.
    /// HandleClaim PDA enforces one-entry-per-handle at the protocol level.
    pub fn add_verified_entry(
        ctx: Context<AddVerifiedEntry>,
        handle_hash: [u8; 32],
        participant_wallet: Pubkey,
    ) -> Result<()> {
        instructions::add_verified_entry::handler(ctx, handle_hash, participant_wallet)
    }

    /// Draw winners using a slot-hash seed (demo-grade).
    /// Emits winner indices in tx logs — backend reads and calls transferFixed per winner.
    /// Replace with ORAO VRF CPI for production provable fairness.
    pub fn draw_winners(ctx: Context<DrawWinners>) -> Result<()> {
        instructions::draw_winners::handler(ctx)
    }
}
