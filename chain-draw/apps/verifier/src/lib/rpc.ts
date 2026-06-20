import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const RPC_URL = process.env.RPC_URL ?? 'https://devnet.helius-rpc.com/?api-key=02923ff0-3d68-4bb1-a1ad-407f5f7d1e5f';
const WS_URL = RPC_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export const rpc = createSolanaRpc(RPC_URL);
export const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
