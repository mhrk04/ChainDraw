use anchor_lang::prelude::*;
use crate::state::{Campaign, CampaignStatus};
use crate::errors::ChainDrawError;

#[derive(Accounts)]
pub struct DrawWinners<'info> {
    #[account(
        mut,
        bump = campaign.bump,
        constraint = campaign.organizer == organizer.key() @ ChainDrawError::OrganizerOnly,
        constraint = campaign.status == CampaignStatus::Open @ ChainDrawError::AlreadyDrawn,
        constraint = Clock::get()?.unix_timestamp >= campaign.cutoff_ts @ ChainDrawError::DrawTooEarly,
        constraint = campaign.entry_count > 0 @ ChainDrawError::NoEntries,
    )]
    pub campaign: Account<'info, Campaign>,

    #[account(mut)]
    pub organizer: Signer<'info>,

    /// SlotHashes sysvar — used as demo-grade randomness seed
    /// Replace with ORAO VRF account for production provable fairness
    /// CHECK: read-only sysvar
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DrawWinners>) -> Result<()> {
    let campaign = &mut ctx.accounts.campaign;
    let num_winners = campaign.num_winners as u32;
    let entry_count = campaign.entry_count;

    require!(entry_count > 0, ChainDrawError::NoEntries);

    // --- Slot-hash seed (demo-grade) ---
    // Read the most recent slot hash from the SlotHashes sysvar.
    // Note: slot-hash randomness can be biased by a malicious validator.
    // For production, replace with ORAO VRF CPI.
    let slot_hashes_data = ctx.accounts.slot_hashes.data.borrow();
    // SlotHashes layout: 8 bytes len, then entries of (slot: u64, hash: [u8;32])
    let seed: [u8; 32] = if slot_hashes_data.len() >= 48 {
        slot_hashes_data[16..48].try_into().unwrap()
    } else {
        [0u8; 32]
    };

    // Store seed on-chain for public verification
    campaign.draw_seed = Some(seed);
    campaign.status = CampaignStatus::Drawing;

    // Derive winner indices (Fisher-Yates subset, seeded)
    let actual_winners = num_winners.min(entry_count);
    let mut winner_indices: Vec<u32> = Vec::with_capacity(actual_winners as usize);
    let mut rng_state = u64::from_le_bytes(seed[0..8].try_into().unwrap());

    let mut pool: Vec<u32> = (0..entry_count).collect();
    for i in 0..actual_winners as usize {
        // lcg step
        rng_state = rng_state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let j = (rng_state as usize) % (pool.len() - i) + i;
        pool.swap(i, j);
        winner_indices.push(pool[i]);
    }

    msg!(
        "Draw complete. Seed: {:?}. Winners (indices): {:?}",
        &seed[0..8],
        winner_indices
    );

    // NOTE: winner Entry accounts are marked won=true in a separate CPI or
    // by the backend reading the seed + indices and calling mark_winner.
    // For MVP the backend reads winner_indices from this tx log and calls transferFixed.

    Ok(())
}
