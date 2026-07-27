Original prompt: Create an HTML overview page for an FHE Liar's Dice game built for Fhenix CoFHE on Arbitrum Sepolia, using Tastemaker for aesthetics and covering gameplay, pages, modes, stack, architecture, and necessary information.

## 2026-07-27

- Built the first static overview page at `index.html`.
- Established Tastemaker style lock and build log under `.tastemaker/`.
- Verified the page in Chromium at desktop and mobile sizes with no console errors or horizontal overflow.
- Updated scope after user decisions:
  - Casual mode first.
  - Two or more players.
  - Five dice per player for the MVP recommendation.
  - Ones are wild and count toward any challenged face.
  - No wager, ranked, timer, slashing, or penalty design yet.
  - Hands remain sealed during active play.
  - After elimination, all hands can reveal.
  - Use CoFHE encrypted randomness for rolls, e.g. `FHE.randomEuint8()`, then map sealed values into die faces.
  - Use Three.js plus a 3D physics library for realistic cup shake, dice tumble, upside-down placement, and private peek feeling.
- Generated and saved a hero concept image at `assets/images/hero-cup-concept.png`.

## Next build suggestions

- Create an actual interactive 3D prototype with a single canvas, `window.render_game_to_text`, and `window.advanceTime(ms)`.
- Start with local-only simulated game state before wiring wallets/contracts.
- Then implement Foundry contract tests for wild-one matching and verdict resolution.
