// Route: /organizer/[campaign] — Manage Event (wallet-gated organizer)
// Stitch screen: TO GENERATE — "Organizer manage event page"
// Components: ManageEventTable, DrawAndPayButton, payout progress, revoke button
// TODO Phase 4: wire DrawAndPayButton to POST /api/events/:campaign/draw

interface Props {
  params: { campaign: string };
}

export default function ManageEventPage({ params }: Props) {
  return (
    <main className="min-h-screen bg-[#f8f9ff] p-8">
      <h1 className="text-2xl font-semibold text-[#0b1c30]">Manage Giveaway</h1>
      <p className="mt-1 font-mono text-xs text-[#737686]">{params.campaign}</p>

      {/* Entries table placeholder */}
      <div className="mt-6 rounded-xl border border-[#c3c6d7] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0b1c30]">Entries</h2>
        <p className="mt-2 font-mono text-sm text-[#737686]">
          ManageEventTable — Phase 5 (pending)
        </p>
      </div>

      {/* Draw & Pay */}
      <div className="mt-4 rounded-xl border border-[#c3c6d7] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0b1c30]">Draw &amp; Pay</h2>
        <button
          disabled
          className="mt-4 rounded-lg bg-[#2563eb] px-6 py-3 text-sm font-semibold text-white opacity-40"
        >
          Draw Winners (enabled after cutoff)
        </button>
        <p className="mt-2 font-mono text-sm text-[#737686]">
          Payout progress: — / — winners paid
        </p>
      </div>

      {/* Revoke */}
      <div className="mt-4 rounded-xl border border-[#c3c6d7] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#0b1c30]">Revoke Leftover Delegation</h2>
        <p className="mt-1 text-sm text-[#434655]">
          After all winners are paid, revoke the delegation to reclaim rent.
        </p>
        <button
          disabled
          className="mt-3 rounded-lg border border-[#2563eb] px-6 py-2 text-sm font-semibold text-[#2563eb] opacity-40"
        >
          Revoke &amp; Reclaim Rent
        </button>
      </div>
    </main>
  );
}
