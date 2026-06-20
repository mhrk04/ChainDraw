use anchor_lang::prelude::*;
use crate::state::campaign::{Campaign, CampaignStatus};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeCampaignParams {
    /// Unique campaign nonce — also used as the Fixed/Recurring Delegation nonce
    pub campaign_id: u64,
    pub verifier: Pubkey,
    pub prize_mint: Pubkey,
    pub prize_total: u64,
    pub num_winners: u8,
    pub cutoff_ts: i64,
    /// Max 200 chars URI pointing to requirements JSON
    pub requirements_uri: String,
    /// The Fixed or Recurring Delegation PDA — derived client-side, stored for public verification
    pub delegation_pda: Pubkey,
    /// false = FixedDelegation (one-shot); true = RecurringDelegation (weekly/monthly)
    pub is_recurring: bool,
    /// Period length in seconds (604800 = weekly, 2592000 = monthly). 0 if not recurring.
    pub period_length: i64,
}

#[derive(Accounts)]
#[instruction(params: InitializeCampaignParams)]
pub struct InitializeCampaign<'info> {
    #[account(
        init,
        payer = organizer,
        space = Campaign::LEN,
        seeds = [
            b"campaign",
            organizer.key().as_ref(),
            &params.campaign_id.to_le_bytes(),
        ],
        bump,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut)]
    pub organizer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeCampaign>, params: InitializeCampaignParams) -> Result<()> {
    require!(params.num_winners >= 1, anchor_lang::error::ErrorCode::ConstraintRaw);
    require!(params.prize_total > 0, anchor_lang::error::ErrorCode::ConstraintRaw);

    let campaign = &mut ctx.accounts.campaign;
    campaign.campaign_id = params.campaign_id;
    campaign.organizer = ctx.accounts.organizer.key();
    campaign.verifier = params.verifier;
    campaign.prize_mint = params.prize_mint;
    campaign.prize_total = params.prize_total;
    campaign.num_winners = params.num_winners;
    campaign.cutoff_ts = params.cutoff_ts;
    campaign.requirements_uri = params.requirements_uri;
    campaign.delegation_pda = params.delegation_pda;
    campaign.entry_count = 0;
    campaign.status = CampaignStatus::Open;
    campaign.is_recurring = params.is_recurring;
    campaign.period_length = params.period_length;
    campaign.draw_seed = None;
    campaign.bump = ctx.bumps.campaign;

    msg!(
        "Campaign {} initialized | recurring={} | period={}s | winners={} | prize={}",
        params.campaign_id,
        params.is_recurring,
        params.period_length,
        params.num_winners,
        params.prize_total,
    );
    Ok(())
}
