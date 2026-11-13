# DirectDraw directional blit keys

The canonical module after `70082cd28` still failed all 240 native source-range,
destination-key and destination-range cases. SetColorKey ignored direction and
the high endpoint, storing every key in the source-low union field. Blt compared
source equality only; GetColorKey also returned the source low value for both
endpoints regardless of direction.

Microsoft specifies distinct source/destination keys, a COLORSPACE range flag,
and null removal: [SetColorKey](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-setcolorkey),
[Blt](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-blt).

The existing surface-owned auxiliary heap block now has a 16-byte key-state
tail. This avoids growing or moving fixed regions. Source low remains in
DxObject.misc2 for existing texture consumers; source high and destination
low/high retain independent presence bits. GetColorKey reads the selected
direction. Null removal leaves the other direction intact. Caller key buffers
are copied synchronously. Existing surface retirement frees the full block.

The ordinary single-source-equality SIMD path is retained. Extended Blt and
BltFast copies exclude inclusive source ranges and admit inclusive destination
ranges using unsigned native pixel values. They inspect each destination's old
value once, preserve equal-size aliasing with memmove ordering, and snapshot the
source for stretched aliases. Clipping and complete pixel widths remain active.
Overlay keys are unsupported and return an error rather than replacing blit
keys; invalid direction flags leave state unchanged.

Evidence: `scratch/runs/20261113-coordinator-ddraw-key-range-repair/`.

- Original 240-case frontier: 240 failures before, zero after.
- Expanded public x86 COM suite: 7,220 copy cases, 16,915 calls, zero failures;
  interface versions 1/2/3/4/7, four depths, range endpoints, high unsigned
  values, combined directions, overlap, nearest-neighbor stretch, BltFast,
  disjoint clips, poisoned caller buffers, padding and guard bytes.
- Directional GetColorKey and independent removal preserve the other key and
  output canaries. Absent/unsupported/invalid queries do not write output.
- Eight adjacent tests pass: equality-key blits, BltFast overlap, system-memory
  blits, DXT blits, interface refcounts, surface caps, absent GetColorKey and VB
  image helpers (including their allocation controls).
- Required serialized full build passes. No memory-map change was needed.

These are native API fixture results. Original-game screenshots, browser
composition, performance and the GL/D3D 27-app goal are not established here.
