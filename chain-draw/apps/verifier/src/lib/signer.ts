import { createKeyPairSignerFromBytes } from '@solana/kit';
import bs58 from 'bs58';

/**
 * Load a keypair signer from a base58-encoded private key env var.
 * These are backend-only — never sent to the client.
 */
export async function loadSigner(envVar: string) {
  const secret = process.env[envVar];
  if (!secret) throw new Error(`Missing env var: ${envVar}`);
  const bytes = bs58.decode(secret);
  return createKeyPairSignerFromBytes(bytes);
}

/** Convenience: load the verifier signer */
export const getVerifierSigner = () => loadSigner('VERIFIER_SECRET');

/** Convenience: load the delegatee signer */
export const getDelegateeSigner = () => loadSigner('DELEGATEE_SECRET');
