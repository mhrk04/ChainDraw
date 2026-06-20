# ChainDraw

**Trustless social giveaways on Solana · Payments track · Solana AI Hackathon KL**

> Prize locked on-chain. Winner picked by math. Proof public forever.

A brand posts "favourite + boost + follow to win." Participants can't tell if the prize is real or the draw was fair. ChainDraw fixes this: the organizer commits the prize pool using Solana's native **Fixed or Recurring Delegation** (Subscriptions & Allowances program), verifies Mastodon entries for free, draws winners with on-chain randomness, and pushes prizes directly to winners. **Participants never pay gas, sign a transaction, or trust anyone.**

---

## Live Demo (devnet)

| | |
|---|---|
| **Program ID** | `J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8` |
| **Subscriptions program** | `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44` |
| **USDC test mint** | `3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks` |
| **Explorer** | [View program on devnet](https://explorer.solana.com/address/J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8?cluster=devnet) |

---

## How it works

```
Organizer ──createFixedDelegation──▶ Subscriptions Program (commitment)
                                              ▲
Participant ──web form (handle+wallet)──▶ Verifier ──Mastodon API──▶ ✓/✗
                                              │ add_verified_entry
                                              ▼
                                      Giveaway Program (custom)
                                      campaign · entries · draw seed
                                              │ winners
                                              ▼
Delegatee ──transferFixed (push)──▶ Winner token accounts
```

### Payments track primitives used

| Instruction | Where |
|---|---|
| `initSubscriptionAuthority` | Once per organizer/mint pair |
| `createFixedDelegation` | One-shot prize commitment |
| `createRecurringDelegation` | Weekly/monthly giveaway (recurring toggle) |
| `transferFixed` / `transferRecurring` | Push payout to each winner |
| `revokeDelegation` | Organizer reclaims rent after payout |

All five Subscriptions & Allowances instructions used — no custom escrow vault.

---

## Repo structure

```
chain-draw/
├── programs/chain-draw/src/     # Anchor program (Rust)
│   ├── state/
│   │   ├── campaign.rs          # Campaign account (is_recurring, period_length)
│   │   ├── entry.rs             # Entry PDA per participant
│   │   └── handle_claim.rs      # Duplicate guard PDA
│   └── instructions/
│       ├── initialize_campaign.rs
│       ├── add_verified_entry.rs
│       └── draw_winners.rs      # Slot-hash seed, Fisher-Yates draw
├── apps/
│   ├── web/                     # Next.js frontend
│   │   ├── app/
│   │   │   ├── page.tsx         # / — Explore giveaways
│   │   │   ├── event/[campaign] # Public event page + trust widget
│   │   │   ├── organizer/       # Dashboard + create wizard
│   │   │   └── how-it-works/
│   │   └── components/
│   │       ├── PrizePoolPanel   # THE trust widget — cap + remaining + solvency
│   │       ├── JoinForm         # Mastodon verify + entry submit
│   │       ├── WinnersPanel     # Winners + draw proof
│   │       └── EventCard
│   └── verifier/                # Node/TS backend
│       └── src/
│           ├── lib/
│           │   ├── mastodon.ts  # favourited_by, reblogged_by, followers
│           │   ├── delegation.ts # Subscriptions SDK wrappers
│           │   ├── payout.ts    # transferFixed/Recurring loop
│           │   └── onchain.ts   # Anchor IDL entry writer
│           └── routes/
│               ├── events.ts    # GET/POST /api/events
│               ├── join.ts      # POST /api/events/:campaign/join
│               ├── draw.ts      # POST /api/events/:campaign/draw
│               ├── verifyStatus.ts
│               └── campaigns.ts # POST /api/campaigns/create
├── tests/chain-draw.ts          # Anchor integration tests
├── Anchor.toml                  # devnet config + Helius RPC
└── .env.example
```

---

## Prerequisites

```bash
# Verify tools
solana --version     # 3.x (Agave)
anchor --version     # 0.32.x
node --version       # >= 20
pnpm --version       # >= 8
rustc --version      # 1.8x
```

---

## Setup

### 1. Clone + install

```bash
git clone https://github.com/mhrk04/ChainDraw.git
cd ChainDraw/chain-draw

# Install Node deps
pnpm install
cd apps/web && pnpm install && cd ../..
cd apps/verifier && pnpm install && cd ../..
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Get a free Helius key: https://dev.helius.xyz
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

PROGRAM_ID=J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8
NEXT_PUBLIC_PROGRAM_ID=J7G5n75tEWBPu1oNd5CfEq8Z6ZRR22FF5moMh25cmVy8

SUBSCRIPTIONS_PROGRAM_ID=De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44
NEXT_PUBLIC_SUBSCRIPTIONS_PROGRAM_ID=De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44

USDC_MINT=3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks
NEXT_PUBLIC_USDC_MINT=3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks

# Backend keypairs (base58) — generate with: solana-keygen new
VERIFIER_SECRET=<verifier_keypair_base58>
DELEGATEE_SECRET=<delegatee_keypair_base58>
SERVICE_AUTHORITY=<delegatee_pubkey>
NEXT_PUBLIC_SERVICE_AUTHORITY=<delegatee_pubkey>
```

### 3. Fund wallets (devnet)

```bash
# Organizer wallet (Phantom / CLI keypair)
# Fund at: https://faucet.solana.com

# Fund verifier + delegatee backend keypairs
solana transfer <VERIFIER_PUBKEY> 0.1 --url devnet --allow-unfunded-recipient
solana transfer <DELEGATEE_PUBKEY> 0.1 --url devnet --allow-unfunded-recipient

# Mint test USDC to organizer
spl-token create-account 3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks --url devnet
spl-token mint 3nN5zccTzdt7KnVVHqhC2unNxQTMGQkJtkipXnG3b7Ks 10000 --url devnet
```

### 4. Build + deploy the Anchor program

```bash
# Already deployed — skip if using the existing program ID
anchor build
anchor deploy
```

---

## Running locally

Open **3 terminals**:

**Terminal 1 — Verifier service**
```bash
cd chain-draw/apps/verifier
SKIP_AUTH=true npx tsx src/index.ts
# Running on http://localhost:3001
```

**Terminal 2 — Next.js frontend**
```bash
cd chain-draw/apps/web
pnpm dev
# Running on http://localhost:3000
```

**Terminal 3 — Anchor tests** (optional)
```bash
cd chain-draw
anchor test
```

---

## 5-minute demo script

> Run this end-to-end to show the full flow on devnet.

### Step 1 — Create a Mastodon post (30s)
1. Go to **https://mastodon.social** and log in
2. Post: `"ChainDraw demo giveaway — favourite + boost to enter! @chaindraw"`
3. Copy the post URL — you'll need the **status ID** (numbers at the end)

### Step 2 — Create a giveaway (60s)
1. Open **http://localhost:3000/organizer/new**
2. Connect Phantom (devnet)
3. Fill in:
   - Post URL: `your mastodon post URL`
   - Instance: `mastodon.social`
   - Status ID: `<numbers from URL>`
   - Prize: `10 USDC` · Winners: `2`
   - Cutoff: 2 minutes from now
   - **Toggle recurring OFF** (one-shot demo)
4. Click **Commit Prize Pool** → signs 2–3 Phantom txs
5. Campaign appears on **http://localhost:3000**

### Step 3 — Enter the giveaway (60s)
1. Open the campaign page
2. On mastodon.social: **favourite** and **boost** your post
3. Back on ChainDraw: enter your Mastodon handle + a devnet wallet
4. Click **Verify & Enter**
5. See: `✓ Verified — you are entry #0`
6. Repeat with a second account → entry #1

### Step 4 — Draw winners (60s)
1. Wait for cutoff (or set it in the past)
2. Go to **/organizer/[campaign]**
3. Click **Draw Winners & Pay**
4. Phantom signs the SIWS message
5. Watch: draw tx + payout txs appear
6. **WinnersPanel** shows winner wallets + Explorer links

### Step 5 — Verify on Explorer (30s)
On the public event page:
- **Delegation PDA** → shows committed cap + remaining
- **Draw seed** → [anyone can recompute winner indices from this]
- **Payout tx** → on-chain proof winner received funds

---

## Judging rubric alignment

| Criterion | Evidence |
|---|---|
| **Problem clarity** | Organizers can't prove fairness; participants can't verify the prize exists |
| **Solana-native integration** | All 5 Subscriptions instructions; Fixed + Recurring Delegation; no custom escrow |
| **Working demo** | Full devnet flow; Mastodon verification is live (favourited_by, reblogged_by, followers) |
| **Creativity & track fit** | Delegated, auto-paid giveaways; winner needs zero SOL |
| **Potential beyond today** | Recurring delegation → weekly giveaway SaaS; multi-platform; organizer subscription |

---

## Key design decisions

**No custom escrow vault.**
The Subscriptions program's Fixed Delegation is the commitment. The organizer's tokens stay in their wallet; the delegation PDA proves authorization up to `amount`. This is a correct, minimal use of the track primitive.

**Solvency ≠ authorization.**
`PrizePoolPanel` shows both: the delegation cap and the organizer's live USDC balance. Judges and participants can see commitment and that the money is actually there.

**Participants pay nothing.**
The verifier keypair (backend) pays gas for `add_verified_entry`. The delegatee keypair pays rent for winner ATAs. Participants only interact with a web form.

**Recurring delegation for track compliance.**
The `isRecurring` toggle in the create wizard calls `createRecurringDelegation` with `periodLengthS` — covering the recurring payment primitive, not just one-shot allowances.

---

## Security notes

- `VERIFIER_SECRET` and `DELEGATEE_SECRET` are backend-only — never sent to the browser
- One entry per Mastodon handle enforced on-chain via `HandleClaim` PDA — init fails on duplicate
- Draw uses slot-hash randomness (demo-grade) — state "provably fair in production with ORAO VRF"
- Delegation expiry set to cutoff + buffer — revoke after payout to reclaim rent

---

## Team

Built at **Solana AI Hackathon KL** · Payments track

---

## License

MIT
