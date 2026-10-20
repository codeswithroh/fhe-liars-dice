# Style lock — FHE Liar's Dice

Established: 2026-08-03. Source: existing Fhenix brand anchors (cyan + white, user-specified, kept as-is) + fresh technical-mood palette generated for everything else (`scripts/generate_palette.py --mood technical --mode dark --seed 7`, neutrals kept; primary/on-primary/accent hand-set to the fixed Fhenix anchors and re-verified with `check_contrast.py --matrix`).

## Palette
- Background: `#070a0f` (role: page background)
- Surface: `#11151a` (role: panels/cards)
- Primary: `#22d3ee` (role: primary actions, links, brand accent — **fixed Fhenix cyan, not generated**)
- On-primary: `#03141a` (role: label color for text sitting on a Primary fill)
- Accent: `#f8fafc` (role: "white" from the Fhenix brand — headline emphasis, secondary CTA text, sparingly)
- Border: `#1c2126` (role: hairlines/dividers)
- Text primary: `#eaf3fe` — contrast vs background: 17.70:1 (PASS)
- Warning/danger (challenge, "lie" verdict, errors): `#fb7185` — contrast vs background 7.37:1, vs surface 6.81:1 (PASS). Not a Fhenix brand color; a semantic state color only.
- Success/good verdict: `#4ade80` — contrast vs background 11.38:1, vs surface 10.52:1 (PASS). Semantic state color only.
- Button label color: white (`#03141a` on Primary, see contrast below) — do not assume plain white on cyan; `#ffffff` on `#22d3ee` fails (1.81:1).
- Dark mode: this project is dark-mode-native, no runtime toggle, no separate light companion.

## Color contract

Ran `check_contrast.py --matrix text=#eaf3fe bg=#070a0f surface=#11151a primary=#22d3ee accent=#f8fafc border=#1c2126 on-primary=#03141a`:

- Text-safe (>=4.5): bg/accent, accent/on-primary, text/bg, surface/accent, text/on-primary, text/surface, accent/border, text/border, bg/primary, primary/on-primary, surface/primary, primary/border
- UI-safe (>=3.0 and <4.5): none
- Decorative (<3.0, never for text or the sole state signal): primary/accent, text/primary, bg/border, border/on-primary, surface/border, bg/surface, text/accent, bg/on-primary, surface/on-primary

Warning (`#fb7185`) and success (`#4ade80`) were checked as single pairs against bg/surface only (both PASS, both >7:1) — re-run the full matrix if either gets used as a fill with a label color other than `text primary`.

**Rule:** never set white (`#ffffff`/`#f8fafc`) as a text label directly on the Primary cyan fill — it fails at 1.81:1. Use `on-primary` (`#03141a`) for that role.

## Typography
- Display/heading font: **Archivo** — technical-mood pairing from `references/style-tokens.md`; a builder-facing/crypto product reads as more "infra-grade" with a geometric grotesk than a generic humanist sans.
- Body font: **IBM Plex Sans** — pairs with Archivo in the same mood family, keeps a cohesive technical feel.
- Mono (reserved for addresses, table IDs, dice values, round numbers, tx hashes — never long-form body copy): **IBM Plex Mono**.
- Scale: base 16px, headings on a 1.25 ratio (existing Tailwind text-4xl/5xl/6xl steps kept).

## Shape language
- Corner radius: kept as-is (`rounded-lg`/`rounded-xl`/`rounded-2xl`, existing scale) — not part of this pass.
- Shadow depth: flat/hairline-bordered panels, glow via `text-shadow`/`box-shadow` on brand cyan only, no drop shadows for depth.
- Border usage: 1px hairline borders (`border-white/10`, `border-cyan-500/30` etc.) over shadows — matches the technical mood's "visible border over shadow" rule.

## Density & spacing
Not re-derived this pass — existing Tailwind spacing scale (space-3/4/6/8 etc.) stays as the base unit; this pass only touched color/type/motion tokens, not layout density.

## Assets
- 3D dice/cup models: `frontend/public/models/*.glb`, sourced from user-provided `.blend` assets (see prior session) — untouched by this pass.
- Motion: dice hero canvas now uses Rapier physics for a roll-in intro + drag-to-throw interaction (see Motion section below), not GSAP/scroll-reveal — the hero is a physics toy, not a scroll narrative.
- Logo: cold-start construction (Path A, no existing mark found), `frontend/design/assets/logo/mark.svg` — a single sealed die: rounded-square outline (bg `#070a0f`, `#22d3ee` stroke) with one centered pip (`#22d3ee` fill). One concept ("a sealed die, one true roll"), 2 shapes, 2 colors, reads clean at 16px. Used as the nav mark (`components/ui/NavBar.tsx`) and the favicon set (`scripts/export_favicons.py` output copied to `frontend/public/favicons/`, wired via `app/layout.tsx`'s `metadata.icons`).
- Co-brand badge: user supplied the real official Fhenix logo (`assets/fhenix_logo.svg`, dark-navy/cyan/silver, drawn for a light background) — copied as-is to `frontend/public/brand/fhenix_logo.svg`, never recolored. Shown at the top of the hero as `Fhenix (on a small white plate) × our die mark + wordmark` (`app/page.tsx`'s `CoBrandBadge`). The white plate is the only accommodation made for our dark theme; the source SVG itself is untouched.

## Structure
- Landing hero: split layout, not stacked-centered — copy column (badge, H1, subhead, CTA row) on the left, the interactive dice-throw canvas on the right, per `references/hero-guidelines.md`'s "let one side dominate slightly" and "promise on one side, proof on the other." Falls back to a vertical stack (`grid-rows-[auto_1fr]`) below `lg`, dice keep real (non-collapsing) space via the `1fr` row rather than shrinking to content.
- Hero is viewport-locked, not scroll-height: `h-[calc(100dvh-96px)] sm:h-[calc(100dvh-64px)]` (96px accounts for the sticky nav wrapping to two rows on narrow viewports where its links overflow one line; 64px once it's back to one row at `sm+`). Nothing in the hero, including the dice physics toy, may push past one screen — this was a direct, explicit constraint from the user, not a default choice.

## Icons
- Set: **Lucide** (`stroke="currentColor"`, 2px stroke width, 24x24 viewBox) — fetched via `fetch_icons.py --set lucide`, inlined as React components in `frontend/components/ui/icons.tsx` rather than served as static files, so each usage site controls its own tint via Tailwind text-color classes.
- Used for: lobby "game asset card" icon badges (`DicesIcon`, `LogInIcon`, `HashIcon`, `UsersRoundIcon`, `TrophyIcon`) — a cyan-tinted `border-cyan-500/30 bg-cyan-500/10` square badge (`h-10 w-10`/`h-11 w-11`, `rounded-lg`) is the icon-badge convention; reuse it for any future icon-forward card rather than inventing a new badge treatment.

## Structure (lobby)
- The lobby's action cards (Create table, Join by table ID) use a shared `GameAssetCard` pattern (`frontend/app/lobby/page.tsx`): icon badge + title/subtitle row on top, controls + one `GoButton` primary action below. Modeled on icon-forward gacha-game upgrade-card references the user supplied, translated into this project's own locked tokens (not that reference's skin/gold treatment).
- `GoButton`: short, bold (`font-bold`), high-contrast cyan-fill action button, reused everywhere a table-row/card needs one unmistakable primary action (Create, Join, per-row "Go" in Open tables).

## Reference intelligence
- Reference board: inferred, not viewed (no reference images/URLs supplied for this pass — user gave direct constraints: keep cyan+white, generate the rest, technical build with real physics interaction).
- Design read: marketing/landing hero for a privacy-crypto dice game, audience = crypto-curious casual players + developers, mode = Experience (the hero is meant to be played with, not just read), visual lane = technical/dark with one saturated brand accent (cyan).
- Dials: variance 4/10 (existing site structure kept, palette/type/motion refreshed), motion 8/10 (physics-driven hero is the centerpiece ask), density 5/10, art direction 6/10 (real 3D assets, not illustration).
