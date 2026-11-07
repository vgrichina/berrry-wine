# AVP2 Marine aim and texture boundary — 2026-11-07

One bounded successor to [async recovery](avp2-async-recovery-20261107.md).
Run: `scratch/runs/20261107-avp2-aim-textures/` (ignored evidence).
Result: the late-controller Mouse-cache discrepancy is reproduced and locally
fixed. Original Marine first-person world appears, then an **Out of memory**
dialog prevents the fresh movement/attack test. No attack consequence, hit,
damage, or original-game mouse acceptance is established. No emulator change.

## Controller correction and focused verification

`aim.cjs`, used by the actual `late-input.cjs` and staged driver, moves using
**the same `page.mouse` object that sends DOWN and independent UP**. It checks
live document/worker/render-owner identity, `elementFromPoint`, canvas bounds,
foreground owner/window bounds, and records canvas/window coordinates. It
requires trusted DOWN/UP at the exact aimed client point and target `screen`.
MouseLeft release also checks VK1 physical and asynchronous high bits.
Independent UP, held-key cleanup and sticky UNKNOWN Gate remain unchanged.
These are run-specific helpers, preserved with new-file binary patches; no
tracked runtime source was changed.

`local.cjs` uses production WineAssembly, guest Worker, Win98Renderer and
browserInput with the local boids render endpoint. `local-results.json` passes:

- A second Puppeteer Mouse emits trusted screen move `(386,502)`, then the
  long-lived controller emits trusted DOWN/UP `(0,0)` with empty target:
  failing-before exact-coordinate assertion, physical/high bits released.
- The same controller Mouse moves and pulses at `(386,502)` on `screen`:
  passing-after exact-coordinate, owner and release checks. Recorded backing
  canvas point `(376,342)`, foreground window `(0,0,640,480)`, client rect
  `(3,41,634,435)`, process1000/hwnd65537/endpoint1.
- Off-canvas and wrong expected owner fail before DOWN.
- A native DOWN with deliberately unacknowledged completion still receives
  independent UP on the aimed canvas; physical/high bits clear; sticky UNKNOWN
  rejects queued Enter without replay.

This local check proves controller routing, not original AVP2 gameplay. Earlier
harness readiness failures and intermediate runs remain alongside the final
pass. Local Chrome/server/profile cleanup is recorded in `local-cleanup.json`.

Unchanged physical-key fix `74d173af4`, collector `8453f67b4`, immutable controls
and their passed checks were reused (`reused-controls.json`). All 619 staged
runtime pins match (`changed-entry.json`); actual Node dependency closure and
all staged hash/size checks pass. `node tools/verify-avp2-recovery.js` passes
original18. `NODE_OPTIONS=--v8-pool-size=1 flock /tmp/wine-build.lock bash
tools/build.sh` passes (`build.exit=0`). Standard module is
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`
(2,182,500 bytes), also recovered from instantiated original workers.

## Single original attempt

Exactly one fresh UUID / box `bx_hs48msbv`, created 22:27:27Z, initial expiry
23:02:27Z. Detached observable normal-stop and 25-minute watchdog helpers were
armed before allocation; immutable watchdog deadline 22:52:27Z. Local and
remote launch floors exceeded 5 GB. Original launch 22:31:26Z. Staging retained
Git SHA `1db931c53342c3bfc6b088fed1cecdf4fd238aa6` and relevant patches,
not a source archive. Media paths/sizes/hashes are in `media-refs.json`.

Native WebGL2 Intel UHD620 ANGLE/Mesa composition, actual guest CPU and render
owners, response-body collector, and original module guards pass with no
collector first fault. Late entry seals process1001, hwnd131073, CPU endpoint2
and render endpoint1. Ordinary Enter pulses select Single Player, Marine,
Unwelcome Guests / Normal and launch. The loading screens named
`marine-world`, `marine-interior` and `intro-current` are **not world evidence**.
`world-progress.png` shows the conversation interior with four Marines.
Escape opens the pause menu; Enter resumes. `resume-world.png` at
22:39:48.440Z shows first-person corridor, knife lower right, teammate,
HUD health100/armor050 and radio. This is native scene progression, not a hit.

Before any fresh movement or attack, `corridor-fresh.png` at 22:42:40.696Z
shows AVP2's **Out of memory** dialog. No further gameplay input was sent.
No MouseLeft pulse was sent in this original attempt. No settings, clocks,
private handlers or bindings were invoked. No replay or second box.
An observational command11 used `type` instead of `action`; it returned a
known unsupported-command error without input. Corrected observational
command12 produced the OOM capture. Quit helper7 reports missing `.done` after
its intentional quit branch; `late-input-terminal.json` establishes normal
closed state instead. Neither event is an uncertain native input outcome.

## Passive texture provenance and limits

`textures.cjs` takes eight read-only shared-memory state snapshots and a short
built-in API trace window, then uses the existing bounded producer diagnostic.
It reads region-map bases, direct guest state and own VFS property descriptors;
it never invokes lazy `.data` getters. Trace names are removed after the
bounded window; initial creation tracing has a 180-second removal timer.
Forwarding remains enabled, so this is not a performance benchmark.

At **22:36:31–33Z during loading**, all eight snapshots show 520 live
texture-capable surfaces (617 total type2 surfaces), device slot10, stage-zero
binding0 and owned texture reference0. Stage-zero defaults are
`[0,4,2,0,4,2,0,0]`. Existing producer receipt endpoint2 accepts30 draws and
submits16 times; endpoint1 is idle. This is distinct from the predecessor's
retained565 accepted calls/62 submissions and sampled diffuse/no-texture
triangles.

`texture-api-window.json` retains 42,842 initial CreateSurface entry logs,
one EnumTextureFormats7 entry, and 468 window entries: 24 CreateSurface,
168 SetTextureStageState7, 276 SetRenderState7, **zero SetTexture7/3**.
Texture creation reaches guest API/WAT object state. In this bounded loading
window, the first observed absence is the texture-binding entry and its WAT
stage-zero state, upstream of textured producer submission. This does **not**
prove SetTexture never occurs in the Marine world. The later world receipt has
311 cumulative texture uploads; uploads alone do not establish texture binding
on the sampled diffuse triangles.

The original `d3d.ren` call return `0x011f9857` maps to PE `0x10040857`:
CreateSurface call at `0x10040854`, followed by HRESULT test and success branch.
Its failure path contains “Unable to create (%dx%d) texture surface.”
Disassembly and exact media reference are retained. Entry-only traces have no
HRESULT/branch receipt. Prior descriptor stack addresses were sampled after
reuse and read zero; they are explicitly **not** return evidence. Therefore
neither failed texture creation nor a faulty WAT SetTexture operation is
established. The inspected Device7 wrapper/vtable reaches `$d3dim_set_texture`,
which stores stage0 binding/reference; no speculative renderer patch was made.

Next work needs bounded creation entry/return and first binding provenance
while the scene is fresh, plus a fresh reviewed movement/aimed attack test.
The OOM allocation failure must first be attributed from passive evidence;
do not infer its cause from the trace count or flat textures.

## Recovery and shutdown

Unique remote logs, captures, instantiated module and receipts are recovered
with exact size/SHA-256 checks before the explicitly delegated normal box stop.
`remote-artifact-inventory.json`, `retrieval-verified.json`,
`remote-cleanup-audit.json`, lifecycle terminal records and
`normal-stop-confirmed.json` are the terminal evidence. They establish exact
owned runtime process, port, profile and held-input cleanup and box state.
No public deployment. No archive of source, scratch, docs or repeated media.

Terminal outcome: 118 remote artifacts / 20,779,346 bytes verified. HTTP46473
and CDP43075 closed, owned processes empty, profile absent, held input empty.
Box `bx_hs48msbv` confirmed **archived** at 22:44:35Z by normal non-forced
stop, before the original 23:02:27Z expiry. Both lifecycle children exit0 and
supervisor remaining set is empty. Local messageboard watcher is retired.
Lifecycle ownership returns to the coordinator; no live assigned box remains.
