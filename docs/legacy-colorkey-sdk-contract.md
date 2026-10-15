# Legacy color-key contract evidence

Verified 2026-10-15 against preserved original Microsoft DirectX SDK pages.

The [DX7 D3DRENDERSTATETYPE reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm)
identifies `COLORKEYBLENDENABLE` as state 144. When explicitly enabled,
matching texture samples have both color and alpha replaced by zero. The
application configures alpha testing and blending to obtain rejection or
blending. This entry does not specify the initial value, the disabled-mode
filtering algorithm, or precedence with alpha-capable palettes.

The [DX7 Color Keying State page](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3e78.content.htm),
dated September 2, 1999, specifies FALSE as the default of
`COLORKEYENABLE` (state 41). That is not evidence for state 144's default.

## Implementation consequences

The candidate in `task/palette-worker-lifetime` still retains keyed RGB while
clearing alpha during GPU upload. Its shared fixed-function shader discards
samples below alpha 0.5 regardless of the application's alpha-test settings.
These operations do not implement the documented explicitly enabled state144
mode. Both software and GPU paths need to consume that state, retain its
identity in relevant descriptors/caches, and test actual framebuffer results.

Do not infer universal rejection whenever any filtered tap matches a key.
Default/FALSE behavior, zero-weight and border taps, and DDPCAPS_ALPHA/key
precedence remain unresolved. Existing unkeyed palette GPU/Worker passes do
not cover these contracts. No production behavior changes or native reference
measurements accompany this note.

## Follow-up after integration

The implementation-consequences section above describes the historical
candidate, not current main. Explicit TRUE behavior and its CPU/GPU/Worker
validation are now integrated (see `palette-combined-validation-20261015.txt`).
The [bounded FALSE audit](legacy-colorkey-false-audit-20261015.txt) records
primary-source limits and the missing discriminating reference experiment.
It does not resolve the API default or FALSE filtered-key semantics.
