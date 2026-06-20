use anchor_lang::prelude::*;
use crate::state::{Campaign, CampaignStatus};
use crate::errors::ChainDrawError;

#[derive(Accounts)]
pub struct DrawWinners<'info> {
    #[account(
        mut,
        seeds = [
            b"campaign",
            campaign.organizer.as_ref(),
            &campaign.campaign_id.to_le_bytes(),
        ],
        bump = campaign.bump,
        constraint = campaign.organizer == organizer.key() @ ChainDrawError::OrganizerOnly,
        constraint = campaign.status == CampaignStatus::Open @ ChainDrawError::AlreadyDrawn,
        constraint = Clock::get()?.unix_timestamp >= campaign.cutoff_ts @ ChainDrawError::DrawTooEarly,
        constraint = campaign.entry_count > 0 @ ChainDrawError::NoEntries,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut)]
    pub organizer: Signer<'info>,

    /// SlotHashes sysvar — demo-grade randomness seed.
    /// Replace inner logic with ORAO VRF CPI for production provable fairness.
    /// CHECK: read-only sysvar, safe
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DrawWinners>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    let num_winners = campaign.num_winners as u32;
    let entry_count = campaign.entry_count;

    // Read slot hash for demo-grade randomness
    // Layout: 8-byte count, then (slot u64 + hash [u8;32]) per entry
    let slot_hashes_data = ctx.accounts.slot_hashes.data.borrow();
    let seed: [u8; 32] = if slot_hashes_data.len() >= 48 {
        slot_hashes_data[16..48].try_into().unwrap()
    } else {
        [0u8; 32]
    };

    // Store seed on-chain — anyone can recompute the winner indices from this
    campaign.draw_seed = Some(seed);
    campaign.status = CampaignStatus::Drawing;

    // Fisher-Yates subset draw seeded from slot hash
    let actual_winners = num_winners.min(entry_count);
    let mut pool: Vec<u32> = (0..entry_count).collect();
    let mut rng = u64::from_le_bytes(seed[0..8].try_into().unwrap());

    let mut winner_indices: Vec<u32> = Vec::with_capacity(actual_winners as usize);
    for i in 0..actual_winners as usize {
        // Linear congruential generator step
        rng = rng
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let remaining = pool.len() - i;
        let j = i + (rng as usize % remaining);
        pool.swap(i, j);
        winner_indices.push(pool[i]);
    }

    // Emit winner indices — backend reads this log to call transferFixed per winner
    msg!(
        "DRAW | campaign={} | seed={:?} | winners={:?}",
        campaign.campaign_id,
        &seed[..8],
        winner_indices
    );

    Ok(())
}
