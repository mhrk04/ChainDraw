// Route: /event/[campaign] — Giveaway Detail (public)
// Stitch screen: 5b2300d4d036474a9206964d128e795a (Giveaway Detail)
// PrizePoolPanel is wired to live chain data via useDelegation + useOrganizerBalance

import { PrizePoolPanel } from '@/components/PrizePoolPanel';
import { VERIFIER_API } from '@/lib/constants';

interface Props {
  params: { campaign: string };
}

async function getCampaignData(campaign: string) {
  try {
    const res = await fetch(`${VERIFIER_API}/api/events/${campaign}`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function EventPage({ params }: Props) {
  const data = await getCampaignData(params.campaign);

  // Fallback mock for development before any campaigns are created
  const campaign = data ?? {
    campaign: params.campaign,
    title: 'ChainDraw Giveaway',
    organizer: 'EoLYw86xT1M73oxj6foAeyQEiBKP35pwQpSX1i2XsYPn',
    delegationPda: params.campaign,
    prizeTotal: '100000000',
    numWinners: 3,
    cutoffTs: Math.floor(Date.now() / 1000) + 3600,
    isRecurring: false,
    periodLength: 0,
    postUrl: '#',
    entryCount: 0,
    status: 'Open',
  };

  return (
    <main className="min-h-screen bg-[#f8f9ff]">
      {/* Nav */}
      <nav className="border-b border-[#c3c6d7] bg-white px-6 py-4">
        <a href="/" className="text-sm font-semibold text-[#2563eb]">← All Giveaways</a>
      </nav>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-[#0b1c30]">{campaign.title}</h1>
          <p className="mt-1 font-mono text-xs text-[#737686]">{params.campaign}</p>
        </div>

        {/* ── THE TRUST WIDGET ── */}
        <PrizePoolPanel
          campaignPubkey={params.campaign}
          delegationPda={campaign.delegationPda}
          organizer={campaign.organizer}
          prizeTotal={campaign.prizeTotal}
          numWinners={campaign.numWinners}
          isRecurring={campaign.isRecurring}
          periodLength={campaign.periodLength}
        />

        {/* Requirements */}
        <div className="rounded-xl border border-[#c3c6d7] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Requirements</h2>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Favourite the post', href: campaign.postUrl },
              { label: 'Boost (repost) the post', href: campaign.postUrl },
              { label: 'Follow the organizer', href: campaign.postUrl },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-lg bg-[#f8f9ff] px-4 py-3">
                <span className="text-sm text-[#0b1c30]">{r.label}</span>
                <a
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Do on Mastodon ↗
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Join Form */}
        <div className="rounded-xl border border-[#c3c6d7] bg-white p-6">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Enter Giveaway</h2>
          <p className="mt-1 text-sm text-[#434655]">
            No wallet signature required. No gas fees. Just your Mastodon handle and prize wallet.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-[#434655]">Mastodon handle</label>
              <input
                type="text"
                placeholder="@you@mastodon.social"
                className="mt-1 w-full rounded-lg bg-[#f1f5f9] px-4 py-3 text-sm text-[#0b1c30] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#434655]">Prize wallet address</label>
              <input
                type="text"
                placeholder="Your Solana wallet (prize sent here)"
                className="mt-1 w-full rounded-lg bg-[#f1f5f9] px-4 py-3 font-mono text-sm text-[#0b1c30] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <button className="w-full rounded-lg bg-[#2563eb] py-3 text-sm font-semibold text-white hover:bg-[#004ac6]">
              Verify &amp; Enter — Phase 3 (Mastodon)
            </button>
          </div>
        </div>

        {/* Entries */}
        <div className="rounded-xl border border-[#c3c6d7] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0b1c30]">Entries</h2>
            <span className="rounded-full bg-[#eff4ff] px-3 py-1 font-mono text-sm font-medium text-[#2563eb]">
              {campaign.entryCount ?? 0} verified
            </span>
          </div>
          <p className="mt-2 text-sm text-[#737686]">
            Each entry is an on-chain PDA — verifiable at any time.
          </p>
        </div>
      </div>
    </main>
  );
}
