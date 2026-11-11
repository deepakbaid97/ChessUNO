# Pawn character layers

`illustrated/` contains the production-ready transparent SVG kit for the pawn.
Every file uses a shared `256 × 256` canvas and is injected into its own animation
layer by `PawnCharacter.svelte`:

- `body`, `head`, `helmet`, `arm-left`, `arm-right`, `leg-left`, `leg-right`, `weapon`
- one face layer per expression: `face-neutral`, `face-happy`, `face-scared`, `face-angry`

SVG colors use the pawn's semantic CSS variables, allowing light and dark factions
to share the illustrated geometry while retaining distinct palettes. Replacement
PNG/WebP or SVG artwork must retain the shared canvas and layer names so no public
component API or animation rig needs to change.
