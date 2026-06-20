// Route: /organizer — Organizer Dashboard (wallet-gated)
// Stitch screen: 0e229b502dcd4cf7854f62f04cca864e (Organizer Dashboard)
// TODO Phase 5: wallet-gate with Phantom, list organizer campaigns

export default function OrganizerPage() {
  return (
    <main className="min-h-screen bg-[#f8f9ff] p-8">
      <h1 className="text-2xl font-semibold text-[#0b1c30]">My Giveaways</h1>
      <div className="mt-4 rounded-xl border border-[#c3c6d7] bg-white p-6">
        <p className="font-mono text-sm text-[#737686]">
          Connect Phantom to manage your campaigns — Phase 5 (pending)
        </p>
      </div>
      <a
        href="/organizer/new"
        className="mt-4 inline-block rounded-lg bg-[#2563eb] px-6 py-3 text-sm font-semibold text-white"
      >
        + Create Giveaway
      </a>
    </main>
  );
}
