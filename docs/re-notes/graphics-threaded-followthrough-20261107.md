# Registered Hexen II threaded world and movement, 2026-11-07

The repaired production CLI `--threads` local-main MIDI route reached a personally
reviewed composited courtyard and responded visibly to ordinary forward movement.
Black model and HUD regions persist in the captured original. A demonstrated
emulator sampling defect is repaired with failing-before/passing-after pixel
regression. Its effect in the original is **not** qualified: the sole authorized
original completed before the repair, and was not replayed.

Evidence root: `scratch/runs/20261107-graphics-threaded-followthrough/` (ignored).
All paths below are relative to this root unless explicitly qualified. No source
or media archive was made. Git is the source archive; preserve this run directory.

## Exact preflight and original identity

Original staged source: `994008917622964e3ae9768c0bf3e6802607c480` on main,
including ancestor `eee2adf57` and the identical repaired `lib/host-audio.js` blob.
`source-commit.txt`, `eee2adf57-ancestry.txt`, `audio-repair-pin.json`,
`runtime-pins.json`, empty `relevant-source.patch`, and the relevant preexisting
untracked `new-lib_wininit-boot.js.patch` record the source closure. The final JS
repair is separate in `repair-source.patch` and `repair-tested-pins.json`.
`owned-inputs-prelaunch.patch` and `owned-inputs-final.patch` recover the small
run-specific helpers. No modifications to the registered executable were made.

Before allocation, local `local-control-exact-threads/terminal.json` passed the
production CLI/headless-GL/stdin closed-trace composition, including numbered
ping, error ACK, snapshot, composited PNG and balanced Enter with independent UP.
`local-closure-audit.json` records 464 files, no missing runtime requires, and
explicit inclusion of `lib/host-audio.js`. `midi-local-main.log` passes the
production local-main mixed-worker callback/lifetime regression and rejection
controls; `midi-worker-slot0-3.log` passes actual Worker slots 0/3 open, callback,
header, restart/reset/close and rejection/lifetime controls. The accepted no-input
matrix and cooperative original were not repeated.

Sixteen registered media references and SHA-256s are in
`registry-media-closure.json`. Root `installed/GLRoot/glh2.exe` is 545280 bytes,
SHA-256 `76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The registration feeds the root glh2 layout, excludes MiniGL, and preserves
original settings. Existing media were referenced individually, not bundled into
an evidence archive. Native dependencies were resolved and hashed before
allocation (`native-preallocation-verification.json`, `native-local-pins.json`).

Two failed local setup attempts are retained: the first lacked the new observer;
the second lacked native resolution. Neither allocated a box or sent original
input. Local native packages were then installed from the retained lock and their
official install scripts; the exact composed qualification passed.

One fresh UUID-idempotent creation allocated `bx_hqm2pn99` at
16:10:57.146Z; initial expiry was 16:35:57.160Z. The independent non-agent normal
stop watchdog PID 2387772 was armed at 16:10:56.484Z for 1500 seconds and verified
alive before allocation (`watchdog-ready.json`,
`watchdog-alive-before-allocation.json`). No other original or heavy guest ran.

The remote preflight verified 471 runtime/input pins and 162 native pins. Native
8x8 red readback was `[255,0,0,255]`, GL error zero, destroyed live contexts zero;
actual native WGL/headless regression passed without skip (`retrieved/context-probe.json`,
`retrieved/native-wgl.json`). There is a preserved prelaunch audit defect:
comparison of all 162 local/remote native files failed only on generated
`node_modules/.package-lock.json` root-name metadata, and the launch shell
continued. The 161 functional native files match exactly; the metadata difference
is recorded in `native-remote-local-comparison.json`. This was not a functional
native mismatch, but the original launch was not gated by that comparison's
exit status. Future provisioning should make that check fail closed.

Exact original argv is `retrieved/actual/threads/launch.json`: production
`test/run.js --app=hexen2_demo --no-build --control-stdin --headless-gl --threads`,
600-second cap, batch size 50000, unchanged default clock, trace window
`1000000000..15000`, scheduler and MIDI/WGL trace flags, separate exit raw PNG and
PCM outputs. Passive observation hooks are retained with hashes. There was no
forced fallback/capture, guest write, private game handler, clock/config change,
or coordinate click.

`retrieved/loaded-audit.json` matches all 152 observed reads; postflight has zero
changes among 471 staged pins, with matching native postflight too. This CLI has
no HTTP-served module. The actual read, compiled, and instantiated standard WASM
was 2182493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`, 2288 exports.
The compile/instantiate observation is in `retrieved/gl-summary.json`; both WASMs
and loaded native `.node`/`.so` binaries are recovered under `retrieved/`.
Original native context: 640x480, Mesa llvmpipe LLVM 20.1.2, WebGL 1.0, GLSL 4.50,
remote Node v24.22.1. Selection of this provider is not performance evidence.

## Personal review and ordinary input

Each capture below was personally inspected before authorizing its next input.
The driver writes independent UP before submitting DOWN; no DOWN reply is needed
to arm release. `control-custody.json`, `commands.jsonl`, original `[ctl]` output
and the `*-review.json` files preserve ordering and exact replies.

| Composited capture under `retrieved/actual/threads/` | Reviewed content / next action |
| --- | --- |
| `notice.png` | GLHexen2 notice with OK; ordinary Enter |
| `post.png` | MAIN, Single Player selected; ordinary Enter |
| `menu-1.png` | SINGLE PLAYER, New Game selected; ordinary Enter |
| `menu-2.png` | Class selection, Paladin; ordinary Enter |
| `menu-3.png` | Difficulty selection, Apprentice; ordinary Enter |
| `menu-4.png` | Natural model-meshing/loading screen; passive 20-second wait |
| `menu-5.png` | First-person courtyard, fists and HUD 80/0; ordinary Up Arrow |
| `menu-6.png` | Foreground stone wall/plinth now fills view, ramp visible at right; finish |
| `terminal.png` | Same final position after input release; normal quit |

The Up Arrow binding is documented in `docs/re-notes/hexen2-demo.md`.
One 1000ms wall-clock Up pulse visibly advanced from the courtyard toward the
stone obstruction; no inferred displacement or speed is reported. Five 150ms
Enter pulses and one Up pulse were balanced, all independently armed; 32 numbered
guest replies were contiguous and successful. No UNKNOWN, held key, input replay,
or second original occurred. Ordinary `png:` captured the composited screen.
`final-raw.png` is a separately retained 512x256 texture atlas, not a world capture.
All ten PNGs decoded and were reviewed (`png-decode-review.json`).

## Scheduler and MIDI observations

`retrieved/actual/threads/raw/schedulers.jsonl` observes actual backend `worker`.
Its thread arrays are empty at construction, before close and exit. The CLI argv
and backend agree; the observer's generic `requested:false` field reflects an
unset manager option, not cooperative selection. No auxiliary guest execution or
concurrency is established by these snapshots.

`raw/midi.jsonl` observes one `midi_stream_open`, returning handle 786433.
MOM_OPEN (967) was dequeued into callback EIP 4464496 with active 0->1, followed
by observation of the admitted callback becoming inactive at a different EIP.
Thus the repaired local-main open/callback path passed the old guard in this
original. Terminal state is nonrunning with no queued headers or pending
callbacks. No prepare-header, stream-out, restart or playback call was observed.
`audio.pcm` is empty (zero bytes); this proves neither playback nor audio quality.

## Black rendering reproduction and demonstrated repair

The courtyard shows a black statue/model silhouette and black lower HUD blocks;
these persist after forward input. This is a visual defect, not visual parity.
Bounded passive emulator observation retained 400 draws after world review,
texture dimensions/filters/completeness, matrices, primary colors and enables,
plus 1,146,884 bytes of unique runtime RGBA texture data. The first 1800 upload
records were bounded; the terminal reports 3549 uploads overall. The GL log is
losslessly gzipped at `raw/gl-state.jsonl.gz` (66,335,650 bytes). An observer
metadata mistake included typed-array values in those upload arguments, making
the bounded log larger than intended. `retrieved/gl-summary.json` and
`draw-texture-table.json` are compact indexes; they do not replace the raw log.

Texture names 754 (196 draws) and 725 (48 draws) are enabled with no image levels,
min filter 9985 (`LINEAR_MIPMAP_NEAREST`), MODULATE, and positive primary RGB.
Nine HUD textures 835..843 likewise have no image levels, with NEAREST and REPLACE.
Other sampled textures have defined complete images. This establishes incomplete
sampling state and rules out a universally black guest primary color; it does
not by itself establish why those texture objects have no defined images at draw time.

Our ordinary shader enabled sampling solely from API enable state. Only the
special border shader checked `_textureComplete`. WebGL's black result for an
incomplete texture therefore leaked into desktop GL behavior. Desktop GL skips
texture application for a null level-zero image and for incomplete mip chains;
see [OpenGL 1.1 specification, texture application/completeness](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf)
and [Microsoft glTexParameter remarks](https://learn.microsoft.com/en-us/windows/win32/opengl/gltexparameterf).

`lib/gl-compat.js` now gates both sampling uniforms on completeness and checks
for transitions each draw, including binding, image/filter changes and shared
storage changes. API enable state is preserved. Existing border behavior remains.
The actual WebGL 1/2 pixel regression failed before with black `[0,0,0,192]`
instead of primary `[128,64,32,192]`; after repair, all 38 environment/completeness
cases pass, including null model/HUD states, valid textures, missing/mismatched
mips, binding/filter transitions and independent unit 1. The old unit test's
expectation that an undefined unit 1 image enabled shader sampling was corrected;
its API-enable assertion remains. Border (16 pixel cases), 1D textures (36),
fixed-function and multitexture focused tests pass. Locked
`flock /tmp/wine-build.lock bash tools/build.sh` passes (`locked-build.log`).

This repairs a demonstrated emulator semantic cause of black output under the
observed state. It does not restore the absent images or prove the original
statue/HUD is visually correct after repair. Emulator WAT upload/storage paths
were inspected without guest disassembly; a storage/allocation hypothesis is
unproved because the bounded trace lacks the relevant complete upload/error
history. No speculative allocator change was made. Remaining boundary: explain
missing image definitions, then separately authorize a fresh original to review
this repair's visible effect. No FPS, parity or concurrency claim is made.

## Recovery, normal stop and publication

`retrieval-verification.json` records 125 references / 123 unique recovered paths,
77,596,227 bytes; each local size and SHA-256 matched before stop at
16:15:13.696Z. `final-retrieval-reread.json` rechecks those artifacts. Recover from
this evidence directory and its exact Git SHA/patches, not from an assumed box
retention period. Preserve the original media paths and hashes rather than
copying media into another run. Native lockfiles, binary pins and recovered
loaded native modules supply the dependency recovery references.

The guest quit normally with exit 0 at 16:14:13.314Z. `retrieved/cleanup.json`
finds no owned live guest/supervisor process; no browser/profile/control port or
remote watcher was created. After verified recovery, explicitly delegated normal
stop `stop_9796115d9eece096` completed at 16:15:14.213Z, forced=false, error=null.
`boat-state-fdba1c5f-3f30-4f96-8188-1c12546bd671.json` confirms **ARCHIVED**;
current expiry is null and retention is unknown. The independent watchdog then
recorded owner-completed shutdown and exited. Local cleanup closes the board
watcher and verifies owned processes absent; free /home remains above 2 GB.
Publication commits only the three announced code/test files and this note on
main, with immediate pull/push. `publication.json` records the resulting commit.
