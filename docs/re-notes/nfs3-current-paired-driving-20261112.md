# NFS3: current software and WebGL driving

Run `20261112-nfs3-provision-gated-paired-driving-0840-fresh` verifies original
active driving on both actual renderer backends at main8a834a3dc. Guest and
owning render Worker bytecode match2189863-byte module
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The original1577984-byte nfs3demo.exe remains SHA256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.
All727 runtime/media/driver pins passed final reread. No production change,
build or task commit was needed.

Both routes used the registered catalogue, native software-default setup,
reload, Direct3D Device1 selection/original warning OK/setup OK, reload and
`nfs3_chosen_renderer`. Setup exit1 after writing the selection is expected.

| Actual backend | Native consequence |
| --- | --- |
| Software | Up acceleration1→82 MPH with road progress; separately reviewed Right/Left produced opposite wheel positions and changed alignment. R recovery and resumed52-MPH driving followed. |
| WebGL | Up acceleration2→28 MPH, onward48 MPH; Left reached a guardrail, Down reversed away, R restored road alignment and Up resumed48-MPH driving. |

Software selected Hot Pursuit; WebGL selected an eight-car race. An opponent
arrest occurred in the software race, without attribution to R. These are
unmatched scenes, with no lap/finish/save, parity, audio or FPS claim. Draw,
fence and replay counters bind active routes and are not frame rates.

Early debugger auto-attachment captured the executing guest and renderer
modules beside scenes: guest endpoint1/slot0 and render endpoint1/generation1.
Software has positive completed WAT D3DIM draws and GPU disabled. WebGL has
WebGL2 execution telemetry, zero software/fallback completions and zero errors.
Native SystemInfo identifies **SwiftShader** despite JavaScript's Intel string.
The image's BetterChromium wrapper appends fingerprint/timezone flags; the
inherited no-fingerprint policy phrase was explicitly corrected. No physical
GPU or uninstrumented timing acceptance follows. No guest state/clock/RNG,
readiness, physics or save override was supplied.

Provisioning was actually joined exit0/EOF and729 remote inputs verified before
a box/closure-bound pass permitted browser launch. Missing/failed/wrong-box/
unjoined pass cases refuse before API effects. The first task-local attempt
received HTTP400 on an additional104535-byte verifier POST before command ACK;
its exact validation cause is unknown, and no browser started. A fresh box used
a short manifest-reading verifier under the unchanged original deadline.
Prior0835's premature launch failure remains unchanged.

Every dependent input followed a separate completed full-frame review, with
independent key releases. No batched R→Up inspection claim was used. No emulator
trap, timer abort, UNKNOWN or renderer error occurred in these bounded runs;
this does not establish general crash freedom or the historical timer cause.

The coordinator verified396 transferred paths (272 runtime plus124 provider),
the compressed executing module's raw SHA, software acceleration/opposite-turn
images and the final WebGL driving image. The worker's checker covers38 full
PNGs, CRC/inflation and bound review/ACK chains. Parent attempt's runtime file
and26 provider logs were also hash-checked. All unique evidence was recovered
before normal stop. Actual runtime/Chrome parents and manager/watchdog waits
reached0 with separate EOFs. Both boxes are independently stopped/archived with
expiry null; finalbx_hupjur2y receiptstop_bdf3e1708a3c0bf3 is unforced.

Exact recovery is in the run's `RESULT.md`/`RECOVERY.md`; Git+diff/helper patches
replace source/media archives. The next graphics lane targets current Re-Volt
paired driving/checkpoint progress. Full27 coverage remains open.
