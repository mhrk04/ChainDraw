// Route: /organizer/new — Create Giveaway Wizard (4 steps)
// Stitch screens:
//   Step 1-3:  ef375329456f468182840af288b5f491 (Create Giveaway Wizard)
//   Prize:     cc4ad30c2d0245e6a74628e4e433ec06 (Create Giveaway: Prize Setup)
//   Commit:    673f2503f6c648019c3489fe3b9e69e9 (Create Giveaway: Final Commitment)
// Step 3 (Prize Setup) includes isRecurring toggle + periodLength for Recurring Delegation
// TODO Phase 2: wire commit step to initSubscriptionAuthority + createFixedDelegation/createRecurringDelegation

export default function CreateGiveawayPage() {
  return (
    <main className="min-h-screen bg-[#f8f9ff] p-8">
      <h1 className="text-2xl font-semibold text-[#0b1c30]">Create Giveaway</h1>

      {/* Step indicator */}
      <div className="mt-6 flex items-center gap-3">
        {['Requirements', 'Prize Setup', 'Commit'].map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563eb] text-sm font-bold text-white">
              {i + 1}
            </div>
            <span className="text-sm font-medium text-[#0b1c30]">{step}</span>
            {i < 2 && <div className="h-px w-12 bg-[#c3c6d7]" />}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-[#c3c6d7] bg-white p-6">
        <p className="font-mono text-sm text-[#737686]">
          Wizard form — Phase 2 &amp; 5 (pending)
        </p>
        <p className="mt-2 text-sm text-[#434655]">
          Prize Setup step will include: isRecurring toggle + periodLength (weekly/monthly)
          for createRecurringDelegation track compliance.
        </p>
      </div>
    </main>
  );
}
