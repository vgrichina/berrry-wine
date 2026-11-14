# Synchronous D3DIM input readiness and bounded Forsaken, 2026-11-14

The synchronous executor previously returned only counters from `snapshot()`.
The production input-owner adapter requires `snapshot().ready`, so even a live
native Forsaken menu with 46813 draws and zero renderer errors could not bind.
The resize repair `6a742b727` is unchanged.

## Contract

`D3DIMGpu.snapshot()` now reports a Boolean `ready` and executor-local
`readinessGeneration`, alongside the existing counters. Construction and the
guest READY capability opcode do not initialize a lazy GL context. Input
readiness requires at least one successfully allocated target, the exact
allocated device/backend/context identities, a readable nonlost context status,
and no initialization failure, readback fault, recorded rendering error,
shutdown or retirement. Observed loss, an identity mismatch or an unreadable
status latches refusal for that executor; restoring old handles cannot revive
it. Ordinary target retirement can be followed by new allocation, but changes
the generation. A new executor has its own exact JS identity.

The CLI owner takes one device snapshot and includes its generation among its
reference checks. Existing window/thread/EIP/quit checks and the production
guarded-input predicate remain required. No owner or nonce is manufactured.
The asynchronous Encoder still derives readiness from its shared READY and
ERROR words; it has no local target-generation contract.

The released uncommitted `lib/d3dim-gpu.js` baseline is preserved in
`gpu-baseline.patch` under the run directory. Its self-contained readback
cancellation, idempotent shutdown, allocation identity and passive inventory
work is explicitly adopted in this module. It uses existing Backend APIs and
has no dependency on the other uncommitted host/render/census changes. Those
other changes remain uncommitted. The pointer worker's `test/run.js` and
`test/test-cli-guarded-input.js` were not edited.

## Evidence and validation

Evidence: `scratch/runs/20261114-d3dim-sync-readiness-forsaken/`. Git is the source
archive; relevant dirty source is retained as Git patches, with no source-tree,
module or media copies. Media is referenced by existing path and SHA256.

`red.log` reproduces the actual synchronous class's live admission refusal
through `createCliInputSnapshot` and `createGuardedInput`. The final test also
rejects the exact initial Git module plus `gpu-baseline.patch`, reconstructed
only in memory (`final-tests-baseline-red.json`/`.log`), at that same production
bind. Eleven readback/retirement controls pass with the exact committed adapter
loaded from Git (`committed-consumer-tests.log`); no foreign adapter changes
are needed by the adopted GPU module. The new lifecycle
suite checks live admission/consumption, passive allocation inventory,
cancellation without running withheld readback tasks, uninitialized and unavailable contexts,
stop (including disposal failure), loss before/after restoration, unreadable
status, device/backend/context identity replacement, target retirement and
executor replacement, rendering failure, and unchanged asynchronous readiness.
The native public-CLI fixture uses actual shared WASM/window ownership and a
native synchronous GL target, then exercises HTTP guarded bind/input/status/
release and stopped refusal. Its synthetic target and Solitaire window are
fixture evidence, not original-game progress.

## Published repair and checks

Repair commit `0d2ff179faf3a161c17a7fe738c89390c79c3597` is published on
main (strict pinned-SSH pull and push both returned 0). Fifteen focused
invocations passed, including both new tests, native-mode lifecycle controls,
public guarded input, input ownership, headless GL, raster/backend, native16,
present, passive inventory, asynchronous readback, stop lifecycle and step
progress. The full `flock /tmp/wine-build.lock bash tools/build.sh` passed before
the code commit. Validation took the fair heavy-lock turn after the queued
LMarbles pointer and SuperTux stomp runs. `validation.json` records all sixteen
actual waits and separate stdout/stderr EOFs. Eight controller controls, four
supervision controls and an actual outer-wait control also passed.

## One bounded original Forsaken run

One fresh original process ran with fixed `--max-seconds=900`, an independent
prearmed 920-second watchdog, real ticks/default batch 1000, actual native
synchronous D3DIM, and direct production guarded HTTP input. The unchanged
894 media/input pins and original manifest/CRT were used. The exact private
162-provider offline recovery was used without a root install or network
fetch. The launch module SHA256 is
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
The original menu now bound normally: HWND65537/thread1, initialized native
context identity1, generation1, ready=true, draws5329/errors0. The existing
owner remained bound; no guard condition was bypassed or nonce fabricated.

Ordinary SinglePlayer / Normal / VOLCANO reached a living ship with five lives,
SHLD128/HULL128 and PULS2000. A finite forward pulse traversed toward the hatch;
the personally reviewed full scene identified a green hovering enemy craft
near the crosshair (`traverse-hatch.png`). Before a subsequent aimed result,
the ship had died/respawned. A mostly white/yellow scene then prevented useful
inspection. Native documented Escape pause exposed the ordinary menu.
Read-only observation of that white scene still showed ready=true, generation1,
draws60399/errors0, no fallback, and the same nonlost native 640x480 16bpp
context. That does not establish a renderer defect, and no whitening patch was
made.

Through the same process's ordinary menus, a second Normal VOLCANO entry
reached the same living approach and identified craft (`second-approach.png`).
A finite Ctrl500ms primary attempt was actually CONSUMED and independently
released with ACK and subsequent progress. Its reviewed full scene was
13.05 seconds old at consumption. The resulting capture showed a respawn,
four lives and PULS2000; neither an ammo decrement nor target damage/projectile
consequence is proved. White imagery recurred. There was no second process,
state/config/AI/health/clock/blend override, relay, proxy or input test delay.

Twenty-four finite actions each had a fresh personally reviewed full scene,
unique nonce, independent prearmed UP, actual release-child wait0 and ACK.
Maximum capture age was 27.633 seconds and review age 0.514 seconds. Every
nonfinal action recorded postrelease progress. Each operation had its own
six-second deadline, separate from the 40–1000ms pulse. No replay or UNKNOWN
occurred. Sixteen selected result-named PNGs have SHA256, CRC and inflate
checks; redundant menu captures were removed after recording their hashes.

## Quit blocker, waits and cleanup

Time was reserved for ordinary native Quit: Escape pause, Quit to main menu,
EXITGAME, then Enter through the native promotion exit page. This reached the
native Forsaken error dialog: “Cannot call D3DAppShowBackBuffer while
bRenderingIsOK is FALSE.” The captured snapshot reports quit=true with the
modal still visible. No further guarded input was attempted after that capture.
The final image still shows the dialog, and the log explicitly records
`[max-seconds] stopping after 900s`. Native Quit is **not proved**; exit0 must
not be substituted for native Quit. Runtime stats were 899.996 seconds.

Native PID3585909, watchdog3585908 and supervisor3585902 have actual waits0
with stdout/stderr EOF. The outer child and invoking tool also returned0.
The watchdog observed actual native wait and did not fire. Heavy lock was
released, these PIDs are absent and port8476 is closed. No box was created:
ID none, state NOT_CREATED, expiry null, stop receipt not applicable.

Postflight verified all 894 media and 162 private provider pins and the exact
module. Of 1643 source pins and 105 loaded files, only the other worker's owned
`test/run.js` drifted after launch; launch hashes and relevant dirty Git patches
preserve the actual inputs. No foreign source was reverted or committed.
The private run-local node_modules was removed after verification. Small
run-specific scripts were preserved as `run-inputs.patch` and removed; the
run contains compact JSON/logs/Git patches and selected captures, no source
tree/module/media copies or bundles. Free disk after cleanup exceeded 13 GB.

Remaining outcomes are a verified finite aimed weapon consequence and actual
native Quit. The next causal investigation is the original-game death/white
scene and the exit-path rendering-error dialog; these are not evidence to
weaken input guards or infer a speculative renderer fix. Full27 remains
unproved.
