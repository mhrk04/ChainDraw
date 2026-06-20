use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;

declare_id!("J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8");

#[program]
pub mod chain_draw {
    use super::*;

    /// Organizer initializes a campaign.
    /// campaign_id is reused as the delegation nonce — no need to store separately.
    /// is_recurring + period_length wire the RecurringDelegation track primitive.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        params: InitializeCampaignParams,
    ) -> Result<()> {
        instructions::initialize_campaign::handler(ctx, params)
    }

    /// Verifier writes a verified entry on-chain.
    /// Participant signs nothing and pays nothing.
    /// HandleClaim PDA enforces one-entry-per-handle.
    pub fn add_verified_entry(
        ctx: Context<AddVerifiedEntry>,
        handle_hash: [u8; 32],
    ) -> Result<()> {
        instructions::add_verified_entry::handler(ctx, handle_hash)
    }

    /// Draw winners using a slot-hash seed (demo-grade; replace with ORAO VRF for production).
    /// Emits the seed on-chain so anyone can verify the result.
    pub fn draw_winners(ctx: Context<DrawWinners>) -> Result<()> {
        instructions::draw_winners::handler(ctx)
    }
}
