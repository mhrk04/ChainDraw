// Route: /how-it-works — static explainer
// Stitch screen: dd4c5d0640eb44dd9b1a653bfa8ddf9b (How it Works)
// TODO Phase 5: replace with Stitch HTML export

export default function HowItWorksPage() {
  const steps = [
    {
      n: '01',
      title: 'Organizer commits prize',
      body: 'Fixed or Recurring Delegation locks the prize pool on-chain. No custodian. No escrow. The Solana Subscriptions program holds the authorization.',
    },
    {
      n: '02',
      title: 'Participants enter for free',
      body: 'Like + Boost + Follow the Mastodon post. Submit your handle and wallet. The verifier service checks your actions and writes your entry on-chain. You sign nothing and pay nothing.',
    },
    {
      n: '03',
      title: 'Draw runs on-chain',
      body: 'After the cutoff, winners are selected using a verifiable on-chain seed. The draw seed is public — anyone can verify the result.',
    },
    {
      n: '04',
      title: 'Winners receive prizes automatically',
      body: 'The delegatee service calls transferFixed for each winner. Prizes are pushed directly to winner wallets. Winners need zero SOL.',
    },
  ];

  return (
    <main className="min-h-screen bg-[#f8f9ff] p-8">
      <h1 className="text-4xl font-bold text-[#0b1c30]">How ChainDraw works</h1>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl border border-[#c3c6d7] bg-white p-6">
            <span className="font-mono text-sm text-[#2563eb]">{s.n}</span>
            <h2 className="mt-2 text-xl font-semibold text-[#0b1c30]">{s.title}</h2>
            <p className="mt-2 text-[#434655]">{s.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
