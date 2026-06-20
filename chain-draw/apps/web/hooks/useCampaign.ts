import { useEffect, useState } from 'react';
import { RPC_URL } from '@/lib/constants';

export interface Campaign {
  publicKey: string;
  organizer: string;
  prizeMint: string;
  prizeTotal: bigint;
  numWinners: number;
  cutoffTs: number;
  entryCount: number;
  status: 'Open' | 'Drawing' | 'Settled';
  isRecurring: boolean;
  periodLength: number;
  delegationPda: string;
  requirementsUri: string;
}

export function useCampaign(pubkey: string | null) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pubkey) return;

    const fetchCampaign = async () => {
      setLoading(true);
      try {
        // TODO Phase 1: fetch Campaign account from chain via RPC
        // const connection = createSolanaRpc(RPC_URL);
        // const account = await connection.getAccountInfo(pubkey);
        // setCampaign(deserializeCampaign(account));
        setCampaign(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
    const interval = setInterval(fetchCampaign, 10_000); // poll every 10s
    return () => clearInterval(interval);
  }, [pubkey]);

  return { campaign, loading, error };
}
