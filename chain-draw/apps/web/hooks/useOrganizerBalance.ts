import { useEffect, useState } from 'react';

export function useOrganizerBalance(organizerWallet: string | null, mint: string | null) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizerWallet || !mint) return;

    const fetch = async () => {
      setLoading(true);
      try {
        // TODO Phase 2: fetch organizer token account balance for mint via RPC
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 10_000);
    return () => clearInterval(interval);
  }, [organizerWallet, mint]);

  return { balance, loading };
}
