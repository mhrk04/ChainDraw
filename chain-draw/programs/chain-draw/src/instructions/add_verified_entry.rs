use anchor_lang::prelude::*;
use crate::state::{Campaign, CampaignStatus, Entry, HandleClaim};
use crate::errors::ChainDrawError;

#[derive(Accounts)]
#[instruction(handle_hash: [u8; 32])]
pub struct AddVerifiedEntry<'info> {
    #[account(
        mut,
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Open @ ChainDrawError::CampaignNotOpen,
        constraint = Clock::get()?.unix_timestamp < campaign.cutoff_ts @ ChainDrawError::CutoffPassed,
        constraint = campaign.verifier == verifier.key() @ ChainDrawError::Unauthorized,
    )]
    pub campaign: Account<'info, Campaign>,

    /// Entry PDA — one per (campaign, index)
    #[account(
        init,
        payer = verifier,
        space = Entry::LEN,
        seeds = [
            b"entry",
            campaign.key().as_ref(),
            &campaign.entry_count.to_le_bytes(),
        ],
        bump,
    )]
    pub entry: Account<'info, Entry>,

    /// HandleClaim PDA — init fails if handle already entered (duplicate guard)
    #[account(
        init,
        payer = verifier,
        space = HandleClaim::LEN,
        seeds = [
            b"handle_claim",
            campaign.key().as_ref(),
            &handle_hash,
        ],
        bump,
    )]
    pub handle_claim: Account<'info, HandleClaim>,

    /// Verifier backend keypair — pays gas, participant pays nothing
    #[account(mut)]
    pub verifier: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AddVerifiedEntry>, handle_hash: [u8; 32]) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    let index = campaign.entry_count;

    // Write entry
    let entry = &mut ctx.accounts.entry;
    entry.campaign = campaign.key();
    entry.index = index;
    entry.participant_wallet = ctx.accounts.verifier.key(); // replaced with actual wallet — see note
    entry.handle_hash = handle_hash;
    entry.won = false;
    entry.paid = false;
    entry.bump = ctx.bumps.entry;

    // Write handle claim (uniqueness guard)
    let claim = &mut ctx.accounts.handle_claim;
    claim.campaign = campaign.key();
    claim.handle_hash = handle_hash;
    claim.participant_wallet = ctx.accounts.verifier.key();
    claim.bump = ctx.bumps.handle_claim;

    // Increment entry count
    campaign.entry_count = campaign.entry_count.checked_add(1).unwrap();

    msg!("Entry #{} added. Total entries: {}", index, campaign.entry_count);
    Ok(())
}
