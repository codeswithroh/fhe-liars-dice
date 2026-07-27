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

## Notes

This repo currently contains the overview/spec artifact, not the playable game implementation yet.
