# Forsaken threaded enemy encounter and post-damage white viewport, 2026-11-12

Fresh original Forsaken reached combat on actual inline software and actual
WebGL owners. Native player damage and respawns are visible. Neither enemy hit
nor defeat is verified: both routes subsequently developed a persistent white
game viewport that prevents reliable aiming and enemy-consequence review.
The bounded crash sweep found no native trap in its observed slices and no
reported runtime exception. This is a rendering blocker, not a demonstrated
native crash, completed combat objective, or completion of GL/D3D27.

Evidence is retained locally in
`scratch/runs/20261112-forsaken-owner-enemy-1510/` (ignored). Runtime source base
is main `9263762bffc7190b96d329d246a1b5a6956fa23b`, plus
`relevant-source.patch` and `untracked-runtime.patch`; `runtime-pins.json`
identifies every staged file. Small run helpers are retained as patches.
No source/media archive was made. The 873 Forsaken media pins remain unchanged;
20 shared runtime media/DLL pins were also checked. Original `ForsakenDemo.exe`
is 3,759,616 bytes, SHA-256
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`.
Fresh actual guest and renderer bytecode recovered through CDP matches the
2,189,863-byte canonical module, SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
This is distinct from the earlier `1165…` module.

## Original route and reviewed consequences

Both normal launches used
`index.html?debug&candidates&no-log&threads&d3d-renderer=BACKEND&app=forsaken_demo`.
Balanced native Enter input passed through Single Player / START / VOLCANO.
Full completed 1024 × 712 captures were reviewed before dependent input, with
strict process, endpoint, actual Worker, module, canvas, renderer, hash and
120-second scene-age admission. No guest configuration, game state, health,
lives, AI or clock writes, forced guest calls, or input replay were used.

| Actual owner | Reviewed encounter and consequence |
| --- | --- |
| Software | A600 enlarged the doorway; A1000 entered the corridor with a visible enemy above/right of the crosshair. Starting HUD was five lives, SHLD128/HULL128, PULS2000/MUG5. Control1800's next frame shows FOUR LIVES LEFT, SHLD160/HULL128, PULS1984. A second Control2000 from the respawn doorway shows THREE LIVES LEFT, SHLD128/HULL128, PULS1982. Space1000 shows TWO LIVES LEFT, PULS2000/MUG3 and a bright doorway effect. These frames establish respawn consequences; they do not identify an enemy hit. The subsequent passive capture is white except for LIVES2. |
| WebGL | A600, A700, then A300 approached/crossed the doorway. The last move's capture is a four-lives respawn with hostile craft visible through the doorway. Control1800 shows four lives, SHLD128/HULL128, PULS1988/MUG5 and green pulse effects. Space1000 shows SHLD0/HULL31, four lives, MUG3 and a bright blue doorway effect. The six following passive captures show a near-white scene with yellow fragments and LIVES4. A later full capture retains this condition. Enemy defeat remains unknown. |

Software's guest Worker target `EDE0919F885EC1D8C0FDC195D7905A95`, endpoint 1 /
slot 0, owns the inline software route: GPU disabled, no active shared render
port, empty command snapshot. An initialized command facade is not GPU proof.
WebGL's guest Worker `7D30CFDA0B88941B0782FA92F58AE84E` and separate owning
RenderWorker `9BB5E4A5AAEEC70D07CDAB2B6B72C260`, endpoint 1, have matching
recovered module bytes and an actual observed WebGL2 context. That context reports
Intel UHD 620 / Mesa 23.2.1 through ANGLE, despite the launch's SwiftShader flag.

## Bounded blocker diagnosis

Six passive full captures on each live route retained the white viewport.
Software slice sequence advanced from 34196 at its first white observation to
34840 at its last sweep observation. WebGL advanced from 30970 to 32967 between
its first white sweep and final capture; recorded draw count advanced from
20323 to 28423 with reported errors still zero. All these sampled `trapped`
fields are null. No exception/failure event file was produced by either browser.
These are bounded execution observations, not frame-rate or latency measures.

`natural-render-audit.json` adds owner-bound observations of future natural
WebGL rendering calls, after the white condition already existed. For two
seconds, wrappers preserved each original call/result/error and restored the
original methods automatically. They invoked no guest export, input, flush,
readback, fence or game-state setter. The observer retained at most 64 rows and
the first 12 vertices of each retained submission. It is not a replayable frame.

The 64 retained rows include 16 submissions, all with blending enabled and
`srcblend=2, dstblend=2` (ONE/ONE in `lib/d3d9-backend.js`), including textured
scene geometry. Five observed clears use flags 2 (depth only); five natural
uploads begin with 32 bytes of `0xff` in a 16-bit target. The complete two-second
counter totals are 24 clears, 24 uploads, 120 descriptions and 96 successful
submission returns. Scene geometry is still being submitted; the viewport has
not become white because the actual renderer disappeared.

Additive scene rendering over already-white sampled destination pixels, without
a color clear at the observed boundaries, explains persistent saturation there.
This is the first causal rendering-path evidence for the blocker. It does not
identify the earlier CPU writer, prove every uploaded pixel was white, or explain
why opaque scene submissions retained additive blending after combat damage.
Software exhibits the same visible failure, but this GPU packet diagnosis must
not be substituted for a software producer trace. Next work should trace the
natural render-state and destination-pixel transition immediately before the
first white combat frame, then retry the enemy objective after a bounded fix.
No speculative runtime change was made.

## Verification and lifecycle

Before allocation, the exact helper import closure, seven physical key
descriptors, inline-owner positive/rejection controls, timer-driven release
tests (3), and API custody tests (13) passed. The first import check caught a
missing transitive helper; it was added before allocation. Remote reread verified
1,545 staged files, and the same import check passed remotely before game launch.
`flock /tmp/wine-build.lock bash tools/build.sh` passed (`build.log`).

`verify.py` checks all 372 retrieved paths (299 unique hashes), both actual
module recoveries, 33 bound PNGs, 16 balanced native pulses, all 32 trusted
delivered key edges, 1,325 whole served-response hashes, owner continuity,
natural-render observations, and terminal lifecycle records. Each remote output
was fetched twice independently and locally rehashed before stop. Read-only
download-capability connection failures were retained and recovered without
runtime command/input replay. Normal completion used `Browser.close`; it does
not establish guest ExitProcess. Both browser parents and Chrome exited 0 with
separate stdout/stderr EOF; the outer API commands also exited 0.

Private box `bx_ec6hpx8n` had an observable independent watchdog armed before
allocation and an initial expiry of `2026-11-12T16:13:43.064Z`. After evidence
verification, delegated normal stop completed at `2026-11-12T15:30:24.467Z`,
receipt `stop_217a1f305c23691f`, forced=false/error=null. Final state is archived,
expiry null. Lifecycle client, adopted owner and watchdog actual joins are 0
with the recorded EOFs. Do not resume or delete this box by default.

No Node CLI detour, additional Codex workers, public deployment, parity, audio, FPS, full-27,
verified enemy hit/defeat or level-completion claim is made. The earlier
[threaded moving-scene evidence](forsaken-current-threaded-scenes-20261112.md)
remains valid within its stated limits.
