# Hexen II storage repair and ordinary world progress, 2026-11-07

The published CPU texture-storage repair has a visible effect in the registered
original. The statue and tree now have textured artwork, the white HUD strip is
replaced by its illustrated frame and counters, and the initially black courtyard
floor, walls and ramps render. Ordinary movement produced a flask inventory icon,
reached other views around the statue/ramp, and was followed by health loss, a
tilted zero-health view and a natural return to the starting courtyard. No enemy,
successful attack hit, doorway traversal or completed objective was established.
This is useful bounded rendering/gameplay progress, not overall visual parity.

Evidence root: `scratch/runs/20261107-graphics-storage-gameplay/` (ignored).
No shipped emulator change was needed. Only this note is committed.

## Baseline and qualification

Work began after graphics-texture-allocation terminated and released its files.
Its tested repair `ef2709a76` was published with the mandatory locked build and
focused capacity/lifetime/copy tests passing. The staged baseline is main
`b8b27fda18b44606e2ed89ab418c5705973e4720`, explicitly containing both that repair
and `fece02eca`. `explicit-baseline-changes.json` compares the predecessor pins:
only the three allocator WAT files and standard/compat modules changed. The
accepted control implementation and native functional files are unchanged.

`source-commit.txt`, `relevant-source.patch`, the new `lib/wininit-boot.js` patch
and `owned-inputs-final.patch` preserve source/helper recovery. Git is the source
archive. Registered media were checked at their existing paths; the 16-file
closure and SHA-256 references are retained in `baseline-references.json` and
`registry-media-reference.json`. No source/media archives or repeated media
copies were made in evidence. Original media, settings and default clock stayed
unchanged; the default snapshot tick is 200 ms per batch, not a real-time clock.

Local native WGL creation, red readback `[255,0,0,255]` and zero-context teardown
passed. The exact production threaded/headless-GL/stdin composition passed on
Notepad with numbered ping, error reply, snapshot, composited PNG and balanced
Enter. The accepted broader controls were reused. The predecessor's functional
pin gate was reused and its matching/changed/missing runtime/native cases passed.
It was enforced remotely before preflight and again immediately before launch.

All 473 runtime/input files and 161 functional native files matched. Generated
`node_modules/.package-lock.json` differs only in the root package name;
`generated-lock-metadata-difference.json` records exact byte/hash reconstruction.
Remote native WGL/headless tests also passed. All 152 observed runtime reads
matched staged pins; runtime/native postflight found no drift. The actual
standard module was 2182500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`, matching
the allocator worker's tested build. Both modules and selected native binaries
were recovered. No code changed here, so no new emulator build is claimed.

The original used production `test/run.js --app=hexen2_demo --no-build
--control-stdin --max-seconds=600 --batch-size=50000 --quiet-api --quiet-blocks
--trace-from=1000000000 --trace-to=15000 --headless-gl --threads`; full argv is
`retrieved/actual/threads/launch.json`. Renderer: Mesa llvmpipe LLVM 20.1.2,
WebGL 1.0, 640x480. Local Node v24.18.1; remote Node v24.22.1.

## Reviewed captures and consequences

Every composited capture was inspected before the next input. The GLHexen2
notice, MAIN/Single Player, New Game, default Paladin and default Apprentice
were reviewed individually. Five Enter pulses held 150 ms each; model meshing
then received a passive 20-second wait.

Captures below are in `retrieved/actual/threads/`:

| Capture | Visible finding and subsequent ordinary action |
| --- | --- |
| `menu-5.png` | Textured statue/tree, illustrated HUD, courtyard masonry/ramps; Up 1000 ms |
| `menu-6.png`–`menu-10.png` | Close textured obstruction, then side corridor/purple pickup and courtyard views; released arrow pulses to back away and inspect routes |
| `menu-11.png` | Tree/graves and ornate open arch at left; flask icon newly present in HUD inventory; continue route inspection |
| `menu-12.png`–`menu-13.png` | Wall then centered ramp; Up 1000 ms |
| `menu-14.png` | Different torch-lit geometry; health 28 versus previous 71; Ctrl 600 ms ordinary attack attempt |
| `menu-15.png` | Tilted floor view, LOADING overlay, health zero; passive wait only |
| `menu-16.png` | Natural return to starting courtyard, health 74, flask slot empty; finish without more input |
| `terminal.png` | Released-input courtyard view before normal guest quit |

The inventory change is a visible consequence consistent with collecting the
nearby pickup; its exact item identity was not established. Damage was observed
after movement, but its source and timing relative to input are unknown. The
Ctrl attempt does not establish a hit or kill. There was one original launch;
the game's return after zero health was not a second invocation or deliberate
replay. Some corridor surfaces remain very dark; that alone does not demonstrate
an emulator mismatch. No speed, FPS or audio-quality result is claimed.

The retained predecessor's grey statue/tree and white HUD captures were inspected
directly (`baseline-references.json`). The comparison is qualitative: same
registered route/media/settings and renderer/thread mode, different times and
health. It is not a pixel-matched A/B. All 20 recovered PNGs decode; the raw final
PNG is a texture atlas, not a composited world view.

`control-custody.json` verifies 70 contiguous successful numbered replies, all
submissions acknowledged, independent UP armed before every DOWN, and no held
input at completion. No control UNKNOWN, replay or private guest write occurred.
An early read of `menu-14` found only its snapshot; a later read recovered its
already-generated PNG without submitting another capture or game action.

## CPU definitions and host uploads

Passive observation recorded 5563 image API entries/exits and 5563 frontend
image uploads, including 20 further definitions during the natural return.
Call 3550 now exits with context error zero; no nonzero context error was seen
at any image exit. DIB occupancy is 621 pages at every sampled milestone from
image 1 through 5500; at 3550 there are 3552 live DX records of 16384 capacity.
This directly passes the prior failure boundary rather than inferring repair
from ACKs or draw counts.

Selected model names 725/754 now have 8/9 defined CPU mip levels and matching
host uploads. HUD names 835..843 each have a defined CPU image and host upload.
Their CPU surfaces/dimensions are nonzero. `retrieved/passive-summary.json`
retains the bounded states and counters; lossless raw metadata is under
`retrieved/actual/threads/raw/`. The old malformed auxiliary stack-argument arrays
were removed from this observer; no guest API argument claim relies on them.
The observation reads metadata and does not consume errors or alter allocation,
uploads, guest media or drawing. There are 120 bounded draw observations, which
are not independently treated as gameplay or visual correctness proof.

## Retrieval, lifecycle and limits

One fresh UUID-idempotent box, `bx_eq3p5mer`, was created at 21:31:37Z with initial
expiry 21:56:37.161Z. The independent 1500-second watchdog was prearmed and
verified alive before allocation; a separate normal-stop process was also
prearmed. At final inspection the watchdog process was absent, without a log or
terminal record. Its disappearance time/cause are unknown. Continuous watchdog
coverage therefore cannot be claimed; `watchdog-loss.json` preserves this
lifecycle limitation. No further allocation or game action followed discovery.

The guest exited normally with status zero at 21:37:24.609Z. Initial cleanup
asserted while the supervisor was still draining after writing terminal status;
that known failure is retained in `first-error.json` and its remote result.
Later final inspection found it had exited naturally: no kill was needed and no
owned remote guest/supervisor remained. No browser/profile/control port existed.

Before requesting box stop, 125 references / 124 unique contents, 11571249
referenced bytes, were recovered and verified by size/SHA-256, including unique
logs/captures/modules and final cleanup. The prearmed normal-stop delegate then
requested `stop_ebfeab3ca0d03d75`; it completed at 21:38:33.965Z, forced=false,
error=null. Box state is **archived**, current expiry null, retention unknown.
Owned input/processes/watchers are closed. `/home` remains above 9 GB free.
No public deployment occurred.

This bounded followthrough is finished. Historical 27 membership, broader crashes
and broader world/visual coverage remain separate open work. A later authorized
run may investigate combat/objectives and dark regions; none is silently claimed
covered by this repair. Future lifecycle helpers also need the unexplained
watchdog loss addressed before claiming continuous watchdog supervision.
