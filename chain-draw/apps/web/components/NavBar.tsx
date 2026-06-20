'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function NavBar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Explore' },
    { href: '/how-it-works', label: 'How it Works' },
    { href: '/organizer', label: 'My Giveaways' },
  ];

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: '#ffffff',
        borderColor: '#c3c6d7',
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight"
            style={{ color: '#004ac6' }}
          >
            ChainDraw
          </Link>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-6 md:flex">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm font-medium transition-colors duration-150"
                  style={{
                    color: active ? '#004ac6' : '#434655',
                    borderBottom: active ? '2px solid #004ac6' : '2px solid transparent',
                    paddingBottom: '2px',
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Wallet connect */}
        <div className="flex items-center gap-3">
          <WalletMultiButton
            style={{
              backgroundColor: '#004ac6',
              borderRadius: '0.5rem',
              fontSize: '14px',
              fontWeight: '500',
              height: '40px',
              padding: '0 20px',
            }}
          />
        </div>
      </div>
    </nav>
  );
}
