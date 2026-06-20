import { useEffect, useState } from 'react';

export interface DelegationInfo {
  pda: string;
  cap: bigint;       // total authorized amount (base units)
  remaining: bigint; // remaining allowance
  expiryTs: number;
  isExpired: boolean;
  isRecurring: boolean;
  periodLength?: number;
  amountPerPeriod?: bigint;
}

export function useDelegation(delegationPda: string | null) {
  const [delegation, setDelegation] = useState<DelegationInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!delegationPda) return;

    const fetch = async () => {
      setLoading(true);
      try {
        // TODO Phase 2: deserialize FixedDelegation or RecurringDelegation PDA from chain
        setDelegation(null);
      } finally {
        setLoading(false);
      }
    };

    fetch();
    const interval = setInterval(fetch, 10_000);
    return () => clearInterval(interval);
  }, [delegationPda]);

  return { delegation, loading };
}
