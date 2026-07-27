# Style lock - FHE Liar's Dice

Established: 2026-07-27. Source: starter scaffolding + verified Fhenix public docs + user-specified game concept.

## Palette
- Background: #070a0f (role: page background)
- Surface: #11151a (role: cards, panels, mockups)
- Primary: #0675d3 (role: primary actions, active UI, bid path)
- Accent: #f2753f (role: challenge/verdict emphasis only)
- Text primary: #e9f3fe - contrast vs background: 17.67, WCAG AA pass
- Text muted: #9aa8b7
- Button label color: #ffffff - contrast vs Primary: 4.67, WCAG AA pass
- Border: #1c2026
- Dark mode: not needed for this project - single dark mode only.

## Color contract
- Text-safe (>=4.5): bg/on-primary, surface/on-primary, text/bg, border/on-primary, text/surface, text/border, bg/accent, surface/accent, accent/border, primary/on-primary
- UI-safe (>=3.0 and <4.5): bg/primary, text/primary, surface/primary, primary/border
- Decorative (<3.0): accent/on-primary, text/accent, primary/accent, bg/border, text/on-primary, surface/border, bg/surface

## Typography
- Display/heading font: Urbanist - game energy without becoming cartoonish.
- Body font: Open Sans - readable for overview/spec content.
- Data/code font: IBM Plex Mono - reserved for contract, network, and encrypted-state labels.
- Scale: 1.22 ratio, base 16px.

## Shape language
- Corner radius: 8px for cards and panels, 4px for chips and controls.
- Shadow depth: flat, no soft shadow reliance.
- Border usage: 1px hairline borders and grid lines.

## Density & spacing
- Base unit: 4px.
- Section padding: connective sections 64px, standard sections 96px, pivotal sections 128px desktop.
- Content card internal padding: 24px.
- Compact card internal padding: 12px.
- Showcase card internal padding: 32px.
- Overall density: information-rich, visual-first, builder-facing.
- Section separation: fixed section padding with hairline dividers where needed.

## Structure
- Macrostructure used: Product Demo / Workbench.
- Narrative arc: hook(H2) -> problem(prose + table-risk visual) -> solution(F3 encrypted flow) -> how(F4 gameplay loop) -> proof(F6 assumptions/spec sheet) -> close(C2).
- Shared chrome: Nav N6 command bar, Footer Ft2 inline single line.
- Per-page body archetypes: H2 split demo, F3 sticky scroll stack, F4 numbered step sequence, F6 spec sheet, C2 statement.
- Build stamp / log: `.tastemaker/log.json` carries the per-build record; CSS stamp is at the top of `index.html`.

## Mood descriptors
Encrypted, tense, tactical, builder-facing.

## Assets
- Anchor asset: `assets/images/hero-cup-concept.png` - generated 3D cup/dice art direction for the game feel.
- Asset style: realistic 3D cup, dice, sealed opponent silhouettes, electric-blue encrypted glow, restrained orange challenge glow.
- Illustration vs. photography split: generated 3D concept art for hero direction; code-native diagrams for system overview.
- Illustration source used: built-in image generation for the hero concept; code-native fallback for diagrams.
- Logo: inline geometric dice/lock mark in `index.html`.

## Motion
- Feel: quick, restrained, decisive.
- Entrance duration/distance: 220ms, 16px rise.
- Easing: power2.out.

## Do not
- Do not show plaintext dice faces as revealed player hands before elimination.
- Do not imply contracts are deployed until they are.
- Do not use invented player counts, TVL, audits, or performance metrics.
- Do not design ranked, wager, timer, or penalty logic before casual mode is playable.
