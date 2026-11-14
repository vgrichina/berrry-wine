# DirectDraw creation-time blit keys, 2026-11-14

Run: `scratch/runs/20261114-ddraw-created-key-native/`.

## Contract and scope

The earlier November 13 source review and unexecuted candidate were hypotheses,
not runtime acceptance. This run tests the current compiled project module in
Node/V8 on x86-64, with x86 guest instructions calling published DirectDraw and
surface COM vtables. The existing calculator PE supplies the guest substrate;
the calculator application is not executed. This is a native regression fixture,
not original-game, browser, or 27-application acceptance.

Microsoft documents flag-gated creation descriptors in
[DDSURFACEDESC](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddsurfacedesc)
and [DDSURFACEDESC2](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddsurfacedesc2).
[DDCOLORKEY](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddcolorkey)
contains low/high range endpoints; equal endpoints specify one color.
[Blt](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-blt)
selects the source and destination surface keys through its respective flags.
[Wine's public header](https://github.com/wine-mirror/wine/blob/master/include/ddraw.h)
independently confirms the numeric constants and structure field order.

For the 32-bit guest ABI, both descriptor layouts have destination blit endpoints
at +48/+52 and source blit endpoints at +64/+68. The descriptor sizes are 108 and
124 bytes. `DDSD_CKDESTBLT=0x4000`, `DDSD_CKSRCBLT=0x10000`;
`DDCKEY_DESTBLT=2`, `DDCKEY_SRCBLT=8`; `DDBLT_KEYDEST=0x2000`,
`DDBLT_KEYSRC=0x8000`. The fixture supplies valid endpoints within the native
pixel width; it makes no Windows conformance claim for out-of-width keys.

The released candidate copies flagged endpoints into the existing owned
auxiliary state used by SetColorKey/GetColorKey and Blt. CreateSurface resolves
its actual surface bit depth before this copy; the candidate masks using that
resolved depth, matching the existing setter. Source and destination presence
remain separate. The allocation failure path releases the unpublished surface.
No consumer, region allocation, overlay, or unrelated WIP is changed.

## Reproduction and checks

The baseline removes only the exact released 32-line hunk, compiles the actual
module under both runtime/build locks, and runs the public COM fixture. An EXIT
trap restores that same hunk before releasing the locks. The candidate is then
built and tested in a separate bounded lock turn.

The fixture covers both descriptor sizes and 8/16/24/32-bit caller-backed
surfaces, absent flags despite nonzero key bytes, source/destination singles and
inclusive ranges independently and together, unsigned high-bit values, public
GetColorKey output canaries, and directional removal. It overwrites the entire
caller descriptor before any keyed pixel check. Public Lock verifies the
surface-owned depth, original storage pointer, and padded pitch. An independent
Cartesian pixel oracle checks below/low/interior/high/above endpoints, all
destination bytes, row padding, guards, and untouched source storage. Creation
pixel checks precede every SetColorKey call.

The actual baseline module
`d7d650e5af43483248d48aeb197dda2272a7a9ab6ace7f9907b6949815502b41`
reproduced 1,088 mismatches: 480 GetColorKey HRESULTs, 480 endpoint outputs,
and 128 keyed Blt destination byte arrays. For example, the 108-byte/8-bit
source-single case copied source color 32 over destination color 63 despite
the source key being 32. Missing creation state was therefore an actual
public-COM/pixel defect, independently of the earlier static suspicion.

The candidate module
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`
passed with zero mismatches. Both versions exercised 144 surfaces, 864
directional key queries, 200 Blts, and 1,789 public x86 COM calls, including
exact stdcall cleanup assertions. The only production difference is the
released 32-line creation-key import. The prepared fixture additionally checks
public Lock's actual pixel depth; its WIP comment was removed.

Both baseline and candidate full builds passed under both locks, including
canonical and compat module compilation. All eight adjacent regressions passed:

- `test-directdraw-key-clip-sprites.js`: 7,220 cases / 16,915 public COM calls.
- `test-directdraw-ckey-blit.js`: 3,640 scalar-oracle SIMD copy cases.
- `test-ddraw-getcolorkey-nokey.js`.
- `test-directdraw-blt-clipping.js`.
- `test-directdraw-blt-rect-boundaries.js`: 740 cases / 815 public COM calls.
- `test-directdraw-system-memory-blits.js`: 422 checks / 1,076 COM calls.
- `test-directdraw-surface3-desc.js`.
- `test-directdraw-surface-initialize.js`.

The shipped module hash stayed unchanged across the adjacent suite. Public COM
tests use the actual compiled module; some older adjacent controls compile
instrumented modules and are additional regression checks, not the reproduction.
The run's `result.json` records publication. No further work is required for this
fixture defect; original-game coverage remains a separate, unproved scope.

## Recovery and lifecycle

Git is the source archive. `head-start.txt`, `relevant-start.patch`,
`released-hunk.patch`, `released-test-new.patch`, `tested-test-new.patch`, and
`foreign-wininit-new.patch` record the initial source and relevant uncommitted
changes. Candidate checkpoints record its current HEAD and relevant binary diff.
`pins-start.json` records file hashes, including the existing calculator PE.
End checks found no drift in any `src/` or `lib/` input. The fixture's two-line
comment/depth-assertion update and another owner's ToyVM JavaScript changes are
recorded separately; ToyVM does not participate in this WAT/COM reproduction.
Build logs and module hashes identify actual tested modules; no source snapshots,
Wasm dumps, screenshots, media copies, or capture bundles are needed.

An independent watchdog is observably armed before each supervised subprocess;
the supervisor waits for the actual child exit and both output EOFs, then joins
the watchdog. Normal-exit and deadline controls exercise that mechanism. Runtime
and build work is serialized with `wine-heavy-runtime.lock` and
`wine-build.lock`, with finite lock waits and separate baseline/candidate turns.
No box is created: ID/expiry null, state `NOT_CREATED`, stop receipt not applicable.
Baseline and candidate both ended with actual wait status 0, both output EOFs,
watchdog wait status 0, and normal watchdog completion without timeout signals.
