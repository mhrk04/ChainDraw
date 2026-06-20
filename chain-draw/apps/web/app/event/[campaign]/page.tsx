// Route: /event/[campaign] — Giveaway Detail (public)
// Stitch screen: 5b2300d4d036474a9206964d128e795a (Giveaway Detail)
// Components: PrizePoolPanel, SolvencyDot, Countdown, RequirementsChecklist,
//             JoinForm, EntriesPanel, WinnersPanel
// TODO Phase 5: wire all components to chain hooks

interface Props {
  params: { campaign: string };
}

export default function EventPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-[#f8f9ff] p-8">
      <p className="font-mono text-sm text-[#737686]">
        Campaign: {params.campaign}
      </p>
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-[#c3c6d7] bg-white p-6">
          PrizePoolPanel — Phase 5 (pending)
        </div>
        <div className="rounded-xl border border-[#c3c6d7] bg-white p-6">
          JoinForm — Phase 5 (pending)
        </div>
        <div className="rounded-xl border border-[#c3c6d7] bg-white p-6">
          EntriesPanel — Phase 5 (pending)
        </div>
      </div>
    </main>
  );
}
