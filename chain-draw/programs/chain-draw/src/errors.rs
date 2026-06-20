use anchor_lang::prelude::*;

#[error_code]
pub enum ChainDrawError {
    #[msg("Campaign is not open for entries")]
    CampaignNotOpen,

    #[msg("Entry window has closed (past cutoff)")]
    CutoffPassed,

    #[msg("Draw can only run after cutoff")]
    DrawTooEarly,

    #[msg("Campaign has already been drawn")]
    AlreadyDrawn,

    #[msg("Only the verifier may write entries")]
    Unauthorized,

    #[msg("Only the organizer may draw winners")]
    OrganizerOnly,

    #[msg("Duplicate entry: this handle has already entered")]
    DuplicateHandle,

    #[msg("Entry index out of range")]
    InvalidEntryIndex,

    #[msg("No entries — cannot draw")]
    NoEntries,
}
