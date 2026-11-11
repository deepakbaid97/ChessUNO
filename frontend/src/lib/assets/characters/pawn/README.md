# Pawn character layers

The first pawn uses CSS/vector placeholders so it ships without external artwork.
Replace the corresponding layers with transparent `head`, `body`, `arms`, `legs`,
`helmet`, and `sword` PNG/WebP assets. `PawnCharacter.svelte` deliberately keeps
each layer in its own element and owns all animation transforms, so the public API
does not need to change when final illustrations arrive.
