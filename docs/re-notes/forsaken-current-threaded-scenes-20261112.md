# Forsaken: current actual-Worker software and WebGL scenes, 2026-11-12

The registered browser entrypoint now has fresh, bounded evidence of moving original
Forsaken gameplay on both software and WebGL, with Threads enabled and a real guest
Worker. The earlier threaded-output gap is closed for these browser routes. This
is one application's coverage, not completion of GLD3D-CORPUS-27. The historical
Node CLI threaded capture is not requalified by a browser result.

Evidence: `scratch/runs/20261112-forsaken-current-threaded-scenes-0048/` (ignored).
The source base is main `2796d2de06637d95975ad1ad66d61a48eb110281`, with exact relevant
uncommitted hunks in `relevant-source.patch` and `untracked-runtime.patch`.
`runtime-pins.json` records the staged dependency closure. Both actual owning
modules were recovered through CDP and SHA-256 matched
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`
(2,189,682 bytes). Original pinned executable/data/map files are referenced by
existing path, size and digest in `media-verification.json`; no source tree or
media archive was made. No save/map bytes were edited.

## Native scenes and attribution

Normal URLs used `index.html?debug&candidates&no-log&threads&d3d-renderer=BACKEND&app=forsaken_demo`.
The native Single Player / START / VOLCANO menus led to the original teal room.
Full completed 1024 x 712 screenshots were individually reviewed before dependent
balanced native CDP key input. The screenshots retain the surrounding app UI.
Input was guarded by current process, guest Worker, endpoint, module, canvas,
renderer and scene-age identity. A stale software scene was refused with zero
effects, then passively refreshed and reviewed before new input.

WebGL (`webgl/`): A600 moved substantially toward the doorway; Control500 changed
PULS 2000 to 1996; A1000 entered a textured corridor with a visible native enemy.
The subsequent Right250 capture shows a respawn with FOUR LIVES LEFT, so it is
not evidence of controlled heading or an enemy kill. Actual guest Worker target
`4716430A59A292BDFEF51E74578FCE11`, endpoint 1 / slot 0, and separate RenderWorker
`A3EFD438190C7A987A5AFD50F1AD2639`, endpoint 1, were observed. The actual WebGL2
context identified Intel UHD 620 / Mesa 23.2.1 despite the launch's SwiftShader
flag. The request flag is not substituted for actual renderer identity.

Software (`software-inline/`): A600 visibly enlarged the doorway; Control500
changed PULS 2000 to 1996; A1000 entered the corridor with an enemy in front.
The full corridor image retains five lives, shield/hull 128, and PULS 1996.
Actual guest Worker target `5C1641F98A4C436ADD90D6ABCA697595`, endpoint 1 / slot 0,
owned the native inline software path. GPU was disabled and no shared render port
was active. A passive profile of this exact Worker/module sampled
`rasterize_triangle_textured` and `viewport_draw_textured_span`.
`software-owner-proof.json` resolves function indices through a compiler-generated
name section whose executable sections exactly equal the actual canonical module;
the named module was not served to the game. Sampling establishes execution,
not draw counts, presentation latency or FPS.

## Demonstrated defects and bounded fixes

The inherited run-only capture binding incorrectly required a separate
RenderWorker for every backend. Normal software instead rasterizes in the guest
Worker. Its `d3dCommands` facade exists at initialization but lazily creates the
encoder/port only when called; facade presence alone does not prove GPU activity.
The corrected `bound-input.cjs` attributes inline software to the actual guest
Worker only with GPU off, no active port and an empty command snapshot, retaining
all owning-identity checks. WebGL still requires its actual renderer. The retained
`inline-routing-test.cjs` exercises this same helper against a generated fixture,
including GPU/port/submitted-command and owner-substitution rejection controls.
These fixtures are not original gameplay or actual-Worker evidence.

Two earlier software diagnostic runs are preserved: one rendered a healthy menu
but waited for the nonexistent external renderer; the second rejected the inert
command facade. Both stopped before original game input. Their expected driver
status 1 and Chrome status 0 are recorded; neither is classified as a game black
screen. The first WebGL launch failed before browser startup because a required
run deadline file had not been staged; that failure is also retained.

Separately, the existing real-Worker producer-publication regression failed at
`this.broker.watchWriter?.(...)` because standalone WorkerLink legitimately has
no broker. Optional chaining on the method did not protect the absent receiver.
The three writer watch/detach lifecycle calls now use `this.broker?.…`.
The test starts inside its cleanup scope, explicitly checks brokerless operation
and verifies that normal stop clears the actual Worker. The callback census hash
and narrow review were updated. Broker-owned enrollment and writer identity
checks remain intact. This actual shared runtime defect is not asserted to have
caused Forsaken's historical rendering/capture gap.

The pre-change regression failure, fixed regression, Worker lifecycle,
transient-writer, actual-Worker parity and callback-census checks are retained.
`flock /tmp/wine-build.lock bash tools/build.sh` passed after the census review
(`build-final.log`). The earlier expected stale-census build failure is retained.

## Limits and lifecycle

No controlled heading, enemy kill, level completion, audio, FPS, software/WebGL
parity, general invocation ownership or full-27 completion is claimed. Earlier
native movement/combat coverage and historical screenshot/measurement limits
remain valid. In particular, this does not reverse the old latency qualification
or treat screenshot labels as proof of their contents.

The additional Node CLI arm was prepared but never launched: a media-alias
preflight assertion failed before its symlink mutation. The known command outcome
and terminal custody record are retained; no guest input was sent or replayed.
This leaves CLI-specific requalification open without diminishing the two actual
browser Worker results.

Both successful browsers completed ordinary quit with actual parent status 0,
separate stdout/stderr EOF, Chrome status 0, removed profiles and closed ports.
The box's initial 60-minute expiry was 2026-11-12T01:49:05.609Z. An independent
observable deadline watchdog was armed before allocation. Final retrieval and
normal stop completed at 2026-11-12T01:11:31.030Z: box `bx_e4gyfcnt` is archived,
receipt `stop_b9a2a5469bce538d`, forced=false/error=null, current expiry null.
All 296 output paths (240 unique SHA-256 values) were recovered by independent
remote rereads and local rehash before stop. Seventeen bound captures, thirteen
balanced pulses and 1,319 whole HTTP responses match their retained hashes/pins.
Lifecycle client, adopted owner and watchdog actual waits/EOF completed with
status 0. Details are in `RECOVERY.md`, `retrieval-manifest.json`,
`evidence-verification.json` and `stop-confirmed.json` in the run directory.
