# ChainDraw
Trustless social giveaways on Solana · Payments track · Solana AI

### Trustless social giveaways on Solana · Payments track · Solana AI Hackathon KL

A brand posts "favourite \+ boost \+ follow to win." Participants can't tell if the prize is real or the draw was fair; honest organizers can't prove either. ChainDraw locks the organizer's commitment on-chain with Solana's native **Fixed Delegation**, verifies entries from **Mastodon** (free, real API), draws winners with verifiable randomness, and **pushes** prizes straight to winners — participants never pay, sign, or trust anyone.

---

## 1\. What changed from the first idea (read this first)

| Your phrasing | Correct mapping | Why |
| :---- | :---- | :---- |
| "Add entry as a subscription" | Entry \= on-chain record written by the verifier | The Subscriptions program moves money *from a payer*. Participants pay nothing, so an entry is not a payment object. |
| "Prize pool commitment by organizer" | **Fixed Delegation** (`createFixedDelegation`) | The organizer pre-authorizes the giveaway service to pull up to the prize pool, with an expiry. The delegation PDA is the public commitment. |
| "Draw result → allowance → pay winner" | **`transferFixed`** draws on the delegation | Each payout reduces the remaining allowance, pushed to the winner's token account. |

Net effect: **no custom escrow vault**. The native Subscriptions & Allowances program does commitment \+ payout. Your custom program only handles the registry \+ draw. Cleaner, and it's a real use of the track's primitive.

---

## 2\. Who pays for what (participant pays nothing, incl. gas)

| Action | Signer / payer | Notes |
| :---- | :---- | :---- |
| Init subscription authority (once / mint) | Organizer | `initSubscriptionAuthority` |
| Commit prize pool | Organizer | `createFixedDelegation`, amount \= pool, expiry \= draw \+ buffer |
| Write verified entry | Verifier keypair (funded by organizer) | participant submits handle \+ wallet via web form, signs nothing |
| Draw winners | Verifier/organizer keypair | seed published on-chain |
| Create winner token account (if missing) | Delegatee keypair (funded by organizer) | so winner needs zero SOL |
| Pay winner | Delegatee keypair | `transferFixed` pushes prize |
| Revoke leftover delegation | Organizer | reclaims rent |

The **verifier** and **delegatee** are backend-held keypairs the organizer funds with a little devnet SOL. Participants and winners only ever interact with a web form and receive funds.

---

## 3\. Solana integration — Subscriptions & Allowances (Fixed Delegation)

- **Program ID:** `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`  
- **Source:** `github.com/solana-program/subscriptions` (audited by Cantina)  
- **Live devnet demo to copy from:** `solana-subscriptions-program.vercel.app`  
- **SDK install:**  
    
  pnpm add @solana/subscriptions @solana/kit @solana/kit-plugin-rpc \\  
    
           @solana/kit-plugin-signer @solana-program/token

### 3.1 Commitment (organizer, once per campaign)

// delegatee \= the giveaway service authority (backend keypair OR a PDA of your

// custom program if you want CPI payouts — see 3.3).

const nonce    \= campaignNonce;            // unique per campaign

const amount   \= prizePoolBaseUnits;       // e.g. 100 USDC \= 100\_000\_000n (6 dp)

const expiryTs \= BigInt(drawDeadline \+ 3600);

// 1\. create the per-(user,mint) Subscription Authority if absent

if (\!subscriptionAuthority.exists) {

  await client.subscriptions.instructions

    .initSubscriptionAuthority({ tokenMint: USDC, tokenProgram, userAta: organizerAta })

    .sendTransaction();

}

// 2\. the commitment itself

await client.subscriptions.instructions

  .createFixedDelegation({ tokenMint: USDC, delegatee, nonce, amount, expiryTs })

  .sendTransaction();

// 3\. the PDA anyone can read to verify the commitment

const \[delegationPda\] \= await findFixedDelegationPda({

  subscriptionAuthority: subscriptionAuthorityPda,

  delegator: organizer, delegatee, nonce,

});

### 3.2 Payout (delegatee, after the draw — push, per winner)

// ensure winner ATA exists (payer \= delegatee), then:

await client.subscriptions.instructions

  .transferFixed({

    delegatee: delegateeSigner,         // backend keypair signs

    delegator: organizer,

    delegatorAta: organizerAta,

    tokenMint: USDC,

    delegationPda,

    amount: prizeShareBaseUnits,

    receiverAta: winnerAta,

    tokenProgram,

  })

  .sendTransaction();

### 3.3 Two ways to wire the draw → payout

- **MVP (do this first):** after the on-chain draw, the backend reads the winning entries and calls `transferFixed` client-side for each. Simple, matches the docs.  
- **Stretch (great flex for judges):** set `delegatee` \= a **PDA of your custom program**, then a single `draw_and_pay` instruction CPIs `transferFixed` so the draw and payout are atomic and fully trustless. More work; only if time allows.

### 3.4 Proving solvency, not just authorization

A Fixed Delegation proves *authorization* up to `amount`, not that the wallet holds the funds. The public page should show **both**: the delegation cap \+ remaining, **and** the organizer's live USDC balance, so viewers see commitment *and* that the money is actually there.

---

## 4\. Entry verification — Mastodon (free, real, no mock needed)

Mastodon's engagement endpoints need **no authentication for public posts** — this is the big win over X (which gated like/repost reads behind Enterprise).

| Need | Endpoint | Auth |
| :---- | :---- | :---- |
| Resolve handle → account id | `GET /api/v1/accounts/lookup?acct=user@instance` | none |
| Who favourited (liked) | `GET /api/v1/statuses/:id/favourited_by` | none (public status) |
| Who boosted (reposted) | `GET /api/v1/statuses/:id/reblogged_by` | none (public status) |
| Followed the page | `GET /api/v1/accounts/:organizerId/followers` (paginate) | none (public acct) |

- **Pagination:** follow the `Link` header (`max_id` / `since_id`); page until the handle is found or the list ends.  
- **Rate limits:** per-IP (e.g. \~300 req / 5 min on mastodon.social). Fine for a demo. Register an app for a token only if you want higher limits.  
- **Federation caveat:** `favourited_by` / `reblogged_by` can under-report engagers on *remote* instances the host hasn't federated with. For a clean demo, run the campaign post and test participants on **one instance** (e.g. mastodon.social).  
- **Verifier logic per entry:** resolve handle → for each required rule (`like`/`boost`/`follow`) check membership in the corresponding set → if all pass, call the giveaway program's `add_verified_entry(participantWallet, sha256(handle))`.

---

## 5\. Architecture & components

Organizer ──init+createFixedDelegation──▶ Subscriptions Program (commitment)

                                                  ▲

Participant ──web form (handle+wallet)──▶ Verifier service ──Mastodon reads──▶ ✓/✗

                                                  │ add\_verified\_entry

                                                  ▼

                                          Giveaway program (custom)

                                          campaign · entries · draw seed

                                                  │ winners

                                                  ▼

Delegatee ──transferFixed (push)──▶ Winner token accounts

Public event page ──reads delegation PDA \+ organizer balance \+ entries \+ winners

- **Custom Anchor program** (the only Rust you write): `Campaign`, `Entry` (PDA per entrant, indexed), `draw_winners` (VRF/seed, emits winner indices). No token escrow code.  
- **Verifier service** (Node/TS): Mastodon adapter \+ holds the verifier keypair; writes entries on-chain.  
- **Delegatee service** (can be the same Node process): holds the delegatee keypair; runs payouts via `transferFixed`.  
- **Frontend** (Next.js): organizer dashboard \+ public event page.

### Data model (custom program)

- `Campaign { organizer, verifier, prize_mint, prize_total, num_winners, cutoff_ts, requirements_uri, delegation_pda, entry_count, status }`  
- `Entry { campaign, index, participant_wallet, handle_hash, won, paid }`

---

## 6\. Randomness (keep the "provably fair" claim honest)

- **MVP:** recent slot-hash seed — runs instantly on devnet, fine to demo, but say out loud it's demo-grade.  
- **Production / if time:** **ORAO VRF** (single CPI on Solana, used by EndGame) — the seed comes with a proof anyone can verify. This is what makes "provably fair" true. Wire it into `draw_winners`.

---

## 7\. Today's sprint plan (≈5.5 hrs to 4 PM)

| Time | Task | Output |
| :---- | :---- | :---- |
| 0:00–0:30 | Scaffold via the workshop kit `ship` agent (`scaffold-project`); set up devnet wallet \+ USDC test mint | repo skeleton on devnet |
| 0:30–1:15 | Custom program: `Campaign` \+ `Entry` \+ `add_verified_entry`; `anchor deploy` | program live on devnet |
| 1:15–2:15 | Wire **Fixed Delegation**: organizer `initSubscriptionAuthority` \+ `createFixedDelegation` from the dashboard | commitment visible on Explorer |
| 2:15–3:15 | Mastodon verifier: lookup \+ favourited\_by \+ reblogged\_by \+ followers; write entries | real entries from a live toot |
| 3:15–3:45 | `draw_winners` (slot-hash) \+ `transferFixed` payout loop | winner paid on devnet |
| 3:45–4:15 | Public event page: delegation cap \+ remaining \+ organizer balance \+ winners | the trust screen |
| 4:15–4:45 | Slides in Canva (`create-pitch-deck` skill) | deck |
| buffer | ORAO VRF swap **only if** ahead | provable fairness |

Build during the hacking window (rules p.16). The workshop kit's opencode skills (`scaffold-project`, `build-defi-protocol`, `deploy-to-mainnet`, `create-pitch-deck`, `submit-to-hackathon`) are there to accelerate each row.

---

## 8\. Deliverables (your three asks)

1. **Runnable demo on GitHub**  
   - Custom Anchor program (campaign/entry/draw) deployed to devnet.  
   - Organizer dashboard: create campaign → commit pool (Fixed Delegation) → view entries → draw → pay.  
   - Public event page: live commitment \+ solvency \+ entries \+ winners, with an Explorer link.  
   - Verifier service hitting Mastodon for real.  
   - `README` with deploy \+ the 5-minute demo script.  
2. **Pitch deck (Canva)** — the required 6-part structure (one-liner, problem, solution, PMF, why Solana, team).  
3. **Problem-brief deck (Canva)** — the trust-gap framing (who hurts, why now, the no-purchase-necessary wedge).

---

## 9\. Judging-rubric map (p.13–14)

| Criterion (10 each) | Where you score |
| :---- | :---- |
| Problem clarity | One sentence: trustless social giveaways with a provable, committed prize pool |
| Solana-native integration | Fixed Delegation for commitment **and** payout — real use of the recurring-payments primitive, plus on-chain entries \+ draw seed |
| Working demo | Full flow on devnet; Mastodon verification is **live**, not mocked |
| Creativity & track fit | Delegated, auto-paid giveaways with no escrow custody risk |
| Potential beyond today | Recurring Delegation for repeating campaigns; multi-platform; organizer SaaS |

---

## 10\. Risks & mitigations

- **Solvency ≠ authorization** → show organizer balance next to the delegation cap.  
- **Mastodon federation under-reporting** → run the demo post \+ participants on one instance.  
- **Slot-hash randomness is biasable** → call it demo-grade; ORAO VRF is the fix.  
- **Winner has no token account** → delegatee creates the ATA (pays rent) before `transferFixed`.  
- **Delegation expiry** → set `expiryTs` comfortably after the draw; revoke to reclaim rent after payout.  
- **Time risk** → ship MVP (slot-hash \+ client-side `transferFixed`) end-to-end first; VRF and CPI payout are stretch.

---

---

# Part B — Implementation plan (CTO)

This maps your three UI flows to concrete routes, components, API endpoints, sequences, and a data model. Principle throughout: **chain is the source of truth for anything trust-critical** (commitment, entries, winners, draw seed); the backend is a UX cache \+ the verification/payout worker. Participants never sign or pay.

## B1. Screens & routes (Next.js)

| Route | Audience | Purpose |
| :---- | :---- | :---- |
| `/` | public | Main page — grid of all events with live status |
| `/event/[campaign]` | public | Event detail — requirements, prize pool, entries, winners, countdown, **Join** |
| `/organizer` | organizer (wallet) | Their events \+ **Create event** |
| `/organizer/[campaign]` | organizer (wallet) | Manage one event — entries table, **Draw & pay** |

### `/` — main page (your UI point 3, list)

- `EventCard` grid. Each card: title, prize (e.g. `100 USDC · 3 winners`), status badge (`Open` / `Drawing` / `Settled`), entry count, countdown.  
- Read path: backend `GET /api/events` returns the merged list; trust-critical numbers (pool, entry\_count, status) are re-read from chain client-side so the card can't lie. No wallet required to browse.

### `/event/[campaign]` — public event page (your UI points 2 & 3\)

Layout, top to bottom:

1. `PrizePoolPanel` — the trust widget. Shows committed cap, remaining, per-winner share, **and organizer's live USDC balance** with a green/red solvency dot. "Verify on Explorer ↗" linking the Fixed Delegation PDA.  
2. `Countdown` — ticks to `cutoff_ts`; flips the page to "Drawing…" at zero.  
3. `RequirementsChecklist` — each rule is an action link to Mastodon: "Favourite this post ↗", "Boost this post ↗", "Follow @org ↗".  
4. `JoinForm` — see B4. After the cutoff this is replaced by `WinnersPanel`.  
5. `EntriesPanel` — verified entry count \+ (optional) list of masked handles.  
6. `WinnersPanel` — after draw: winners \+ the on-chain draw seed \+ tx links.

### `/organizer` \+ `/organizer/[campaign]` (your UI point 1\)

- Wallet-gated (Phantom). `CreateEventForm` is a 4-step wizard mirroring your step 1: **requirements → prize & winners → due date → commit**. The final "Commit" step is where money is delegated (B4).  
- Manage page: entries table (live), `DrawAndPayButton` (enabled after cutoff), payout progress, revoke-leftover button.

## B2. Component inventory

`EventCard`, `EventGrid`, `PrizePoolPanel`, `SolvencyDot`, `Countdown`, `RequirementsChecklist`, `JoinForm`, `MastodonConnectButton`, `EntriesPanel`, `WinnersPanel`, `CreateEventForm` (4 steps), `CommitPoolStep` (wallet txs), `ManageEventTable`, `DrawAndPayButton`, `WalletButton` (organizer only).

Shared hooks: `useCampaign(pubkey)`, `useDelegation(campaign)`, `useEntries(campaign)`, `useOrganizerBalance(campaign)` — each polls RPC every \~10s and is the single read surface for the UI.

## B3. Backend API surface (Next.js API routes)

The verifier \+ delegatee keypairs live in server env and never reach the client.

| Method · Route | Who | Does |
| :---- | :---- | :---- |
| `POST /api/events` | organizer (signed msg) | Store event metadata after on-chain init; returns event id |
| `GET /api/events` | public | List events (backend cache, hydrated by client from chain) |
| `GET /api/events/:campaign` | public | One event's metadata \+ requirements JSON |
| `POST /api/events/:campaign/join` | participant | `{ handle, wallet }` → verify on Mastodon → write entry on-chain |
| `POST /api/events/:campaign/draw` | organizer (signed msg) | Run draw, then payout loop (idempotent) |
| `GET /api/events/:campaign/verify-status?handle=` | participant | Poll verification result (handles federation delay) |

Organizer-only routes authenticate with **sign-in-with-Solana**: the client signs a nonce, the server verifies the signature \== campaign.organizer.

## B4. End-to-end sequences

### Organizer creates an event (UI point 1\)

1. Wizard steps 1–3 collect: post URL (→ resolve `instance` \+ `statusId` via `accounts/lookup` \+ status fetch), required actions, follow target, prize total, winners, due date. Held in client state only.  
2. **Commit** (connect Phantom):  
   - tx A: custom program `initialize_campaign(campaign_id, …, cutoff_ts, num_winners, requirements_uri)` — `campaign_id` doubles as the delegation `nonce`.  
   - tx B: `initSubscriptionAuthority` (skip if it already exists for this mint).  
   - tx C: `createFixedDelegation({ amount: total, expiryTs: cutoff+buffer, delegatee: SERVICE_AUTHORITY, nonce: campaign_id })`.  
   - The delegation PDA is **derived** from `nonce` on read — no need to store it.  
3. Client calls `POST /api/events` with the metadata \+ campaign pubkey. Event now appears on `/`.

### Participant joins (UI point 2\) — zero gas, zero signature

1. On the event page they do the actions on Mastodon (links provided).  
2. **Handle ownership (integrity-critical):** offer **"Connect Mastodon"** (OAuth, `read` scope). This proves they own the handle and lets the follow check use the authenticated relationship endpoint. They then enter only a **wallet address**.  
   - *MVP fallback if OAuth slips:* accept a typed handle, but flag in the pitch that OAuth is the production integrity fix (otherwise someone could enter a handle they don't own).  
3. `POST /join` → verifier checks `favourited_by` / `reblogged_by` / follow → on pass, writes the entry on-chain (verifier keypair pays gas) and returns "Verified ✓ — you're entry \#N". On miss: "We can't see your boost yet, try again shortly" (federation lag).  
4. The entry write atomically creates two PDAs: `Entry[campaign, index]` (indexable for the draw) **and** `HandleClaim[campaign, handle_hash]` (init fails on a duplicate → one entry per handle, enforced on-chain).

### Draw & pay (after cutoff)

1. Organizer hits `DrawAndPayButton` → `POST /draw`.  
2. Server: `draw_winners(seed)` (slot-hash MVP / ORAO VRF stretch) → picks N distinct indices in `[0, entry_count)` → resolves each `Entry[campaign,index]`.  
3. For each winner (idempotent on `entry.paid`): ensure winner ATA (create, payer \= delegatee) → `transferFixed(share)` from organizer → winner → mark `entry.paid` on-chain. Retry per-winner on failure.  
4. `WinnersPanel` lights up with winners, shares, the seed, and tx links.

## B5. Data: on-chain vs off-chain

| Lives on-chain (source of truth) | Lives in backend (UX cache) |
| :---- | :---- |
| `Campaign` (config, cutoff, num\_winners, status, entry\_count) | Raw requirements JSON, post URL/instance, human copy |
| `Entry` (campaign, index, wallet, handle\_hash, won, paid) | Pending/verified status, verification logs |
| `HandleClaim` (uniqueness guard) | Mastodon OAuth tokens (encrypted) |
| Fixed Delegation PDA (commitment) | Event list cache for fast `/` render |
| Draw seed / winner flags | — |

**Anti-abuse summary:** one entry per handle (`HandleClaim` PDA) \+ handle ownership via Mastodon OAuth \+ verifier is the sole writer of entries. Equal prize split `total / num_winners`; send any remainder to the first winner.

## B6. Tech stack & deployment

- **Frontend:** Next.js (Pages router) \+ Tailwind; `@solana/wallet-adapter` (organizer only) \+ `@solana/kit` & `@solana/subscriptions` for delegation.  
- **Backend:** Next.js API routes (single deploy, fastest path) holding the verifier \+ delegatee keypairs in env. Extract a standalone worker only if the draw/payout loop outgrows a serverless timeout.  
- **Store:** SQLite \+ Prisma (persists across restarts); a JSON store is an acceptable demo shortcut.  
- **Chain:** devnet; USDC test mint via `spl-token`.  
- **Hosting:** Vercel on devnet. Keep `SERVICE_AUTHORITY`, `VERIFIER_SECRET`, `DELEGATEE_SECRET`, `RPC_URL` in env — never in the repo.

## B7. Revised build order (UI-aware, ≈5.5 hrs)

1. **Read layer first (45m).** Custom program `Campaign`/`Entry` \+ the four `use*` hooks \+ `EventGrid`/`PrizePoolPanel`/`Countdown` against a hand-seeded campaign. Gets the public, trust-critical UI visible early.  
2. **Commit flow (75m).** `CreateEventForm` → `initialize_campaign` \+ `createFixedDelegation`. End state: an event on `/` with a real, verifiable committed pool.  
3. **Join flow (75m).** `JoinForm` \+ `/api/join` \+ Mastodon verifier \+ `HandleClaim` uniqueness. End state: entries appear live from a real toot.  
4. **Draw & pay (45m).** `/api/draw` \+ `transferFixed` loop \+ `WinnersPanel`.  
5. **Polish \+ decks (60m).** Solvency dot, Explorer links, Canva slides.  
6. **Stretch only if ahead:** Mastodon OAuth handle-ownership, ORAO VRF, CPI atomic draw-and-pay.


