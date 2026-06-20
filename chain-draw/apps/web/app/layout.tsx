import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NavBar } from '@/components/NavBar';
import { SolanaWalletProvider } from '@/components/WalletProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ChainDraw — Trustless Social Giveaways on Solana',
  description:
    'Prize committed on-chain. Winner picked by math. Proof public forever.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className} style={{ backgroundColor: '#f8f9ff', color: '#0b1c30' }}>
        <SolanaWalletProvider>
          <NavBar />
          {children}
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
