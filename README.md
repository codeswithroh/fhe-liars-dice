# FHE Liar's Dice

A planning and visual overview for a casual-first privacy game built for Fhenix CoFHE on Arbitrum Sepolia.

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

## Contracts (v1.0.1)

`contracts/` holds the onchain game, built on Fhenix CoFHE 1.0.

| | |
|---|---|
| Network | Arbitrum Sepolia (421614) |
| LiarsDice | [`0xd24ED945Cf9DD0fb0F5499f61d39021823Cf5BF6`](https://sepolia.arbiscan.io/address/0xd24ED945Cf9DD0fb0F5499f61d39021823Cf5BF6) |
| `@cofhe/sdk` / `@cofhe/hardhat-plugin` | 1.0.1 |
| `@fhenixprotocol/cofhe-contracts` | 1.0.1 (1.0.2 only adds access-list helpers that the 1.0.1 mocks can't compile against) |

Flow: `createRoom` → `joinRoom` → `startGame` → each player `rollDice` (5 encrypted random faces, decryptable only by the owner) → `placeBid` → `challenge` (encrypted count of matches plus wild ones, only the boolean verdict is made public) → `resolveChallenge(roomId, result, signature)` with the threshold-network result from `client.decryptForTx(verdictHandle).withoutACP().execute()`. Eliminated hands and the winner's hand are revealed.

```bash
cd contracts
npm install
npm test                      # mock CoFHE tests
npm run deploy:arb-sepolia    # needs PRIVATE_KEY in contracts/.env
npm run smoke:arb-sepolia     # live 2-player round against real CoFHE
```

Known limitation: faces come from `random % 6 + 1` on a uint8, so faces 1-4 are very slightly more likely than 5-6. Fine for casual mode.

## Notes

The frontend (3D table, wagmi/viem, `@cofhe/react`) is not built yet.
