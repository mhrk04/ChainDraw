import { useEffect, useState } from 'react';
import { VERIFIER_API } from '@/lib/constants';

export interface DelegationInfo {
  pda: string;
  type: 'fixed' | 'recurring';
  cap: string;          // base units as string (bigint serialised)
  remaining: string;    // base units as string
  expiryTs: number;     // unix timestamp
  isExpired: boolean;
  isSolvent: boolean;   // true when organizer balance >= cap
  periodLength?: number; // seconds — only for recurring
  organizerBalance?: string; // live USDC balance in base units
}

export function useDelegation(delegationPda: string | null, campaignPubkey: string | null) {
  const [delegation, setDelegation] = useState<DelegationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignPubkey) return;

    const fetchDelegation = async () => {
      setLoading(true);
      try {
        // Fetch from verifier API which enriches with live chain data
        const res = await fetch(`${VERIFIER_API}/api/events/${campaignPubkey}`);
        if (!res.ok) throw new Error('Failed to fetch campaign');
        const data = await res.json();

        const info = data.delegationInfo;
        if (!info) {
          setDelegation(null);
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        setDelegation({
          pda: delegationPda ?? data.delegationPda,
          type: info.type,
          cap: info.cap?.toString() ?? data.prizeTotal,
          remaining: info.remaining?.toString() ?? info.cap?.toString() ?? data.prizeTotal,
          expiryTs: info.expiryTs,
          isExpired: info.expiryTs > 0 && now > info.expiryTs,
          isSolvent: true, // Phase 5: compare organizer balance vs cap
          periodLength: info.periodLength,
        });
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchDelegation();
    const interval = setInterval(fetchDelegation, 10_000);
    return () => clearInterval(interval);
  }, [delegationPda, campaignPubkey]);

  return { delegation, loading, error };
}
