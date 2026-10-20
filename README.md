# FHE Liar's Dice

A casual-first privacy game built on Fhenix CoFHE on Arbitrum Sepolia: contracts, the Next.js frontend, and the original overview page (`index.html`).

The core mechanic: every player's dice roll is generated as encrypted onchain state. Players make public escalating bids about the total dice on the table. When someone calls a bluff, the contract counts matching dice across encrypted hands, including wild ones, and reveals only whether the bid was good or a lie. Hands stay sealed during active play, then reveal after elimination.

## Current Scope

- Casual mode first.
- Two or more players.
- Five dice per player.
- Ones count as wild faces.
- No wagers, timers, ranked mode, penalties, or tournaments yet.
- 3D table feel: shake cup, place cup upside down, privately peek at your own dice.
- Contracts target Arbitrum Sepolia.

## Overview

Open [index.html](./index.html) in a browser to review:

- game aesthetics
- gameplay loop
- pages
- modes
- stack
- architecture
- locked MVP decisions

## Direction

The intended implementation stack is:

- Solidity + Foundry
- Fhenix CoFHE contracts, including encrypted random values such as `FHE.randomEuint8()`
- Arbitrum Sepolia
- React frontend with wagmi/viem
- Three.js for the 3D table and cup scene
- Rapier 3D for cup and dice physics
- GSAP for non-canvas UI motion

## Assets

- Hero 3D concept: [assets/images/hero-cup-concept.png](./assets/images/hero-cup-concept.png)
- Verification screenshots: [output/playwright](./output/playwright)

## Live (v1.0.1, CoFHE 1.0)

| | |
|---|---|
| Site | https://fhe-liars-dice.vercel.app |
| Network | Arbitrum Sepolia (421614) |
| FheLiarsDice | [`0x645761Fd1b8fB752f7Bc7C0AB16b5Da3305b8F76`](https://repo.sourcify.dev/421614/0x645761Fd1b8fB752f7Bc7C0AB16b5Da3305b8F76) (Sourcify exact match) |
| Previous deployment | `0x20B850b6ddCF9dC4E6cf6a403B27d962B3B9F9Da` (CoFHE 0.x, source in `legacy-contract/`) |
| `@cofhe/sdk` / `@cofhe/react` / `@cofhe/hardhat-plugin` | 1.0.1 |
| `@fhenixprotocol/cofhe-contracts` | 1.0.1 (1.0.2 only adds access-list helpers that `@cofhe/mock-contracts@1.0.1` can't compile against) |

## Layout

- `contracts/` - Hardhat + `@cofhe/hardhat-plugin`. `FheLiarsDice.sol`, tests, deploy / legacy-sync / live smoke scripts.
- `frontend/` - Next.js app (Privy + wagmi + `@cofhe/react`, Three.js table). Deployed to Vercel.
- `legacy-contract/` - verified source of the previous deployment, for reference.

## Points & leaderboard

- The last player standing at a table earns 1 point (`PointsAwarded`). `getPoints(address)` returns a player's total.
- `getLeaderboard()` returns the top 50 scorers, kept sorted on-chain on every win, so it costs the same no matter how many people play. The old `getAllPlayerPoints()` returned every player ever (130k+) and timed out, which left the site's leaderboard empty; it's still there for compatibility, next to the paginated `getPlayerPoints(offset, limit)`.
- Points from the previous deployment carry over without trusting anyone: the new contract reads `getPoints` from the old one on-chain. `getPoints` includes unsynced legacy points, players are synced automatically when they join a table, and `syncLegacyPoints(address[])` (permissionless, idempotent) imported all 551 legacy winners at launch.

## Game flow

`createTable(maxPlayers)` -> `joinTable` -> `startGame` (rolls encrypted hands; each die is decryptable only by its owner) -> `placeBid` -> `challenge` (encrypted count of matches plus wild ones; only the boolean verdict is made public) -> `finalizeChallenge(tableId, verdict, signature)` -> `finalizeReveal(tableId, dice, signatures)`, using the Threshold Network results from `client.decryptForTx(handle).withoutACP().execute()`.

## Develop

```bash
cd contracts
npm install
npm test                         # 20 tests against CoFHE mocks
npm run deploy:arb-sepolia       # PRIVATE_KEY in contracts/.env
npm run sync-legacy:arb-sepolia  # import legacy points (safe to re-run)
npm run smoke:arb-sepolia        # full live game against real CoFHE

cd ../frontend
npm install
npm run dev                      # NEXT_PUBLIC_PRIVY_APP_ID + NEXT_PUBLIC_FHE_LIARS_DICE_ADDRESS in .env.local
```

Known limitations:
- Faces come from `random % 6 + 1` on a uint8, so 1-4 are ~0.4% more likely than 5-6.
- A player can farm points by playing against their own second wallet.
- There are no turn timers, so a player who leaves mid-game stalls the table (casual mode by design).
