import { useEffect, useState } from 'react';

export interface Entry {
  index: number;
  participantWallet: string;
  handleHash: string;
  won: boolean;
  paid: boolean;
}

export function useEntries(campaignPubkey: string | null) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!campaignPubkey) return;

    const fetch = async () => {
      setLoading(true);
      try {
        // TODO Phase 1: fetch all Entry PDAs for campaign via getProgramAccounts
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 10_000);
    return () => clearInterval(interval);
  }, [campaignPubkey]);

  return { entries, loading };
}
