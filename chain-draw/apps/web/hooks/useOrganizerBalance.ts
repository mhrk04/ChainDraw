import { useEffect, useState } from 'react';
import { RPC_URL, USDC_MINT } from '@/lib/constants';

export function useOrganizerBalance(organizerWallet: string | null, mint?: string) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizerWallet) return;
    const tokenMint = mint ?? USDC_MINT;

    const fetchBalance = async () => {
      setLoading(true);
      try {
        // Use getTokenAccountsByOwner to find the organizer's ATA for the mint
        const res = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [
              organizerWallet,
              { mint: tokenMint },
              { encoding: 'jsonParsed' },
            ],
          }),
        });
        const data = await res.json();
        const accounts = data?.result?.value ?? [];
        if (accounts.length === 0) {
          setBalance(0n);
          return;
        }
        // Take the first ATA's balance
        const rawAmount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.amount;
        setBalance(rawAmount ? BigInt(rawAmount) : 0n);
      } catch {
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10_000);
    return () => clearInterval(interval);
  }, [organizerWallet, mint]);

  return { balance, loading };
}
