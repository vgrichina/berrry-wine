# Age of Wonders II owning ground discriminator, 2026-11-05

Evidence: `scratch/runs/20261105-aow2-black-ground-discriminator/`.
This follows `aow2-joined-callback-20261105.md`; historical native images remain
references. No terrain repair is inferred from a browser screenshot.

## Observation boundary and controls

The opt-in `legacy-ground-diagnostic` observes a bounded selected target point
at natural owning legacy GPU submissions. It records command sequence/ordinal,
source descriptor, covering triangles and interpolated UV, state/samplers,
native level-zero texel bytes and decoded cache samples, and completed GPU
pixels before/after the draw. It does not flush batches, write a guest DIB,
call guest exports or alter render fences. Receipts are immutable copies;
malformed requests reject without poisoning the renderer. Real draw errors
still propagate. Normal rendering does not allocate diagnostic provenance.

Triangle coverage is geometric, not an assertion that depth/alpha/cull tests
pass. Native texels are observation-time memory, not original asset provenance.
UV candidates use integer coordinates without the production POSITIONT shader's
1/16 subpixel tie offset, so even level-zero candidates are not exact
sampled-texel proof near boundaries. Mip/projected coordinates have no independent sample oracle here. Readback
synchronizes the selected GPU sample; timing is not a performance result.

`public-controls2/` passes actual public x86 COM calls and owning render Workers
on standard and compat modules, each armed and disabled. The independent
texture-rendered-contract oracle agrees with all completed target pixels;
native BGRX bytes and decoded RGBA samples agree with the public Lock input.
Four diagnostic records per armed module are completed and tied to commands.
All 27 draws per case, pixels, draw/merge/fence/sync/fallback/error counts are
preserved. Invalid coordinates and immutable receipts are checked. The first
control exposed a harness assumption about lazy endpoint creation; a public
draw/Lock warm-up fixes the fixture, not emulator behavior. Both attempts are
retained. `native16/` passes the independent RGB565 framebuffer/blend Worker
neighbor on both modules, 24 pixels each. Unit controls cover bounded
observation, clipped points, read errors and unsuppressed real draw errors;
batching and fallback-counter neighbors pass. Required locked build passes.

## Original result and first missing evidence

Exactly one materially changed original session ran 23:04:00Z–23:09:12Z.
Every current capture was personally reviewed before ordinary DOM input.
Scenario → Single → Start → Julia → six-unit army selection → two plotted
and confirmed moves passed. `army-selected.png`, `first-arrived.png` and
`second-arrived.png` show **20/20 → 13/20 → 10/20** and changing positions.
Mountains, forest, tower, army and path markers remain visible. Large ground
areas remain black. This is current post-callback-repair gameplay evidence,
with subsequent main changes also present; it does not isolate that repair.
There was no rejection receipt or browser fault in this session.

The first probe at native **[420,400]** actually covers forest. Its eight
completed records identify source primitive 5 / vertex type 3, converted to
triangle submissions, ARGB1555 texture 131809376 (16×128), native texel
`62 91`, decoded RGBA **[33,90,16,255]**, and GPU target transition from black
to that color. Independent 1555 expansion agrees; this is a useful positive
owning-source/decoder/target check, not a ground-texture witness.

The reviewed black point is native **[600,300]**, page **[547,416]**, after
accounting for the actual exclusive presentation letterbox. Lossless screenshot
pixels there are RGB [0,0,0]. Three bounded probes on actual endpoint 1 saw
**16,203 / 28,690 / 22,953** natural GPU submissions during idle (2s), army
selection (4s), and first-move confirmation (5s), respectively. All identify
the same 1024×768 RGB565 target 131805760 / DIB 479797248. **None recorded a
covering triangle at that point**; each ended by deadline, not an observation
error. These counts are submission observations, not game-update rates.

The first missing evidence is therefore the earlier producer/API/source or
other target contribution responsible for that black point. No original
ground draw or its native texture has been identified. These bounded windows
cannot exclude an earlier upload, blit, clear or omitted draw, and cannot
establish why the guest did not submit ground geometry there. There is no
proved native→decode→GPU disagreement and no reproduced emulator defect to
repair. No speculative color, blend, matrix or guest-data change was made.
The next investigation must identify that producer with a narrowly scoped
public-API/source witness; repeating unchanged original screenshots adds no
causal evidence. `analysis.json` retains the exact checks and boundaries.

Completed checkpoint data confirms actual legacy WebGL ownership at endpoint
1, main Worker slot 0, fence sequences 16556 → 25159 → 35517, zero errors,
zero fallback and zero completed software/fallback draws. Second arrival has
1,703,967 draw calls. The reported context is ANGLE Intel UHD 620 / Mesa
WebGL 2; launch arguments requested SwiftShader, so this is reported context
identity only. Logical FPS and audio remain unknown.

Actual original source was `ce757e2c7ad9799c992b3389cf74d62d177f7d0a`
plus the recorded diagnostic diff/new-file patches. All 166 HTTP-200 JS/Wasm
body receipts agree with recorded source/module identities. The actual standard
Wasm is 2,175,008 bytes, SHA-256
`3d59cca0579d2ccfdec1561d7403c371af771943f6c8385ce814eacb008c6821`;
compat controls used
`05949f1fd23f5e911db1550e691446f306de39230f5c0014fa796687b67254c2`.
Chrome 151.0.7922.108 / Node v24.18.1 used a fresh owned profile, threads,
COOP/COEP, cross-origin isolation and `defaultViewport:null`. Browser and
driver exited 0 after ordinary closure. No second original was launched.
The final receipt wording adds the subpixel limitation after that session;
this changes diagnostic text only, and does not retroactively change its
recorded source identity. Final focused controls and locked build were rerun.

## Identity and lifecycle

All edits/tests/build/browser/guest waited for ordered exact FINAL releases:
Aranna post-RPC 22:10:42Z, Conan world writer 22:51:21Z, D3D worker reset
22:59:46Z. Independent gate at 23:00:26.557954Z verified 969 absent PIDs,
230 refused ports, 82 absent profiles, four free locks, no heavy runtime and
the disk floor. Runtime deadline is 23:45:26.557954Z.

All 1,064 retained media pins were rehashed in place. The original EXE is
`test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted/AoW2.exe`,
SHA-256 `a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`.
Boot/fonts/native DLL closure, manifest, host import signatures and browser
prerequisites pass; static imports are an inventory only. Exact Git commit,
relevant binary diff/new-file patches, actual module identities and HTTP body
hashes are retained, without a source archive or media copy. No boxes,
subworkers, Heroes II, public deployment or lifecycle operations were used.
Box ID/state/expiry: N/A.
