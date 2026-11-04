# Deus Ex upstream light provenance: module buffer identified; writer proof missing

No production emulator defect was demonstrated, and no production code changed.
The precise blocker is missing ordered writer/initializer and allocation-lifetime
evidence for the zero light, selected palette entry and texture mask. This run
narrows the upstream locations using original PE bytes and retained natural
samples; it does **not** establish the upstream cause.

Predecessor: [owning pixel inputs](deusex-owning-pixel-inputs-20261104.md), commit
`5c55e600d`. Evidence: `scratch/runs/20261104-deusex-upstream-light-provenance/`.
Local starting HEAD was `38238efd5b786b6a00b594ec5a6f775a3ce90787`.

## Address provenance and candidate writers

The predecessor's actual SoftDrv base was **289816576**. Original bytes at
RVA `0x36457` load EBP with module RVA **`0x752f0`**, resolving to **290296560**.
The retained boundary at `0x36472` has exactly that EBP. The sampled pixel's
light pointer **290296568** is module RVA **`0x752f8`**, after the original
`add ebp,8` at `0x364d8`. This light address is a module buffer, rather than
an independently identified heap allocation. Its initializer remains unknown.

The original setup path loads MM3 from descriptor `ECX+0x18` and MM4 from
`ECX+0x20`, then stores them to shift RVA `0x7d3e8` and mask RVA `0x7d3e0`
at instruction RVAs **`0x36487`** and **`0x3648e`**. The latter resolves to
the historical mask address **290329568**. At retained boundary `0x3649e`,
MM3 and MM4 are zero; this is consistent with the observed mask but is not
an ordered before/after store witness. The incoming descriptor address and
its initialized bytes were not captured.

The pixel's palette base is **412029080** and texel is **1**, giving selected
entry **412029088**. Original setup RVA `0x36464` loads EDX from pointer-global
RVA **`0x7d308`**. Static direct stores to that pointer occur at **`0x26596`**
and **`0x265ba`**; the second follows an indirect call with a pushed `0x800`
size. These are candidate selection/allocation sites, not proof of which site
produced this palette or initialized entry 1.

Static light-buffer writes also exist, for example `0x3d5ee` onward using
`[ESI+EDI*8]` after loading ESI with module RVA `0x752f0`, and `0x3d693` /
`0x3d69e` using an address derived from that buffer. Their natural execution
and overlap with the sampled qwords are unproved. No historical address was
used as a watch target in a new runtime.

`audit.py` independently parses PE section mappings, verifies the exact original
instruction encodings for the EBP setup and shift/mask stores, checks the captured
module-relative addresses and owning slot 0, and retains bounded disassembly
excerpts and input SHA-256 values. The retained per-distinct-PC samples do not
carry sequence numbers or per-sample Draw identity; they cannot establish
adjacency, a last writer, or a complete chain through these candidate sites.

## Verification and observation limit

On retained runtime `bx_mpnr7rhj`, the unchanged predecessor
`producer-next-boundaries-fixed.cjs` passed its actual original PE/Engine/SoftDrv
WASM fixture tests again: optional absent/true/false controls, zero/positive
pixel results, owning main Worker MMX slot 0, observer memory unchanged, cold
successor and warm predecoded `0x36577` landing. The original-instruction replay
again matched all **16** captured pixels and all eight MMX registers against
the independent integer reference, plus all **seven** discriminating controls.
Only output destinations were redirected to this run's namespace; predecessor
files were not edited. These are offline fixtures, not new natural observations.

The local static audit passed after correcting a text-excerpt parser that
initially tried to parse the `Disassembly` heading as hexadecimal. That failure
and correction are recorded; they do not indicate a guest defect. Four new
remote artifacts were recovered with full SHA/size verification.

No Chrome was launched. At dispatch/read time the fixed **10:17Z** Chrome-close
deadline left under four minutes. A new observer capable of correlating fresh
palette allocation, descriptor inputs, module-buffer writers and the owning Draw
was not implemented and preflighted within that window. The required complete
actual PE/Worker/dependency HTTP/cache/CJS/ESM preflight therefore was not claimed
for a new driver. No browser/reload, guest call/write, forced Draw, repaint, input,
PNG export or speculative production patch occurred. The natural-observation
allowance was unused; this run does not extend the predecessor's coverage.

Next evidence needed is an ordered, bounded read-only observation of the setup
descriptor and pointer-global selection, correlated with the fresh owning Draw,
followed back to actual overlapping light/palette writers and allocation lifetime.
Original instructions plus those captured inputs must then be replayed against
an independent reference before selecting a repair. The current evidence cannot
distinguish expected guest state from an upstream emulator defect.

## Custody

API inspection at **10:14:13Z** found no Chrome process. Final box info is retained;
the box is left RUNNING (API `idle`, healthy/hydrated), expiry
**2026-11-04T10:27:15.142Z**. Coordinator owns shutdown and receives custody back.
All new remote artifacts are recovered. No lifecycle, allocation, source-box,
local heavy browser, subworker, successor or deployment action was taken.
This is a note-only commit; no new full-build claim applies. Source recovery
uses Git SHA and small owned-file patches, with no source/media/module archive.
