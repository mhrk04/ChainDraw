'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState, type ComponentProps } from 'react';

export function ClientWalletButton(props: ComponentProps<typeof WalletMultiButton>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        style={{
          backgroundColor: '#004ac6',
          borderRadius: '0.5rem',
          height: '40px',
          width: '140px',
        }}
      />
    );
  }

  return <WalletMultiButton {...props} />;
}
