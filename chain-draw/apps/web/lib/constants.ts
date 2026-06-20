// Solana program IDs
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID!;
export const SUBSCRIPTIONS_PROGRAM_ID = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_PROGRAM_ID!;
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT!;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';

// Subscriptions program (De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44)
export const SUBSCRIPTIONS_PROGRAM =
  'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';

// USDC decimals
export const USDC_DECIMALS = 6;

// Campaign status
export const CAMPAIGN_STATUS = {
  OPEN: 'Open',
  DRAWING: 'Drawing',
  SETTLED: 'Settled',
} as const;

// Verifier API base URL
export const VERIFIER_API = process.env.NEXT_PUBLIC_VERIFIER_API ?? 'http://localhost:3001';
