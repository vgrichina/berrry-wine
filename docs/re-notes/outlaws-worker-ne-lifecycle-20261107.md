# Outlaws Worker NE lifecycle continuation, 7 November 2026

The demonstrated Worker lifecycle failure is fixed in `c254a3e3e` on main.
The unchanged registered `outlaws_demo` now reaches its original level in the
production guest Worker. Personally reviewed browser captures show forward
walking, right turning and a visible muzzle flash/hammer animation from the
original README's Z secondary-fire binding. Enemy interaction, primary Ctrl
fire, audio, FPS, whole-game correctness and other backends remain unverified.

Evidence is in `scratch/runs/20261107-outlaws-worker-ne-lifecycle/`.

## Demonstrated failure and bounded change

The exact retained console, startup state and instantiated module from
[the preceding original attempt](outlaws-current-browser-combat-20261107.md)
are reused by path, length and SHA-256 in `prior-demonstrated-evidence.json`.
That original failed with `DLL initializer did not return: module=0xbde000`,
`completed:false`, `halt:3`, yield 18, and the nested cause
`Worker NE guest lifecycle is not implemented`. No media recovery is repeated.

`test/test-worker-ne-guest-lifecycle.js` recreates the same causal chain with
generated ordinary PE/NE files: actual `GuestThreadHost` -> actual
`guest-worker.js` in a Node Worker -> PE LoadLibraryA -> mapped PE DllMain ->
KERNEL32 legacy lifecycle exports -> NE LibEntry/GPA/WEP. There is no
page-side executable instance or replacement guest lifecycle. Before the fix,
the first case fails at module `0x503000` with the same nested refusal,
`completed:false`, `halt:3`, yield 18 (`before-regression.log`). The preferred
fixture placement comes from the owning Worker's allocator.

The Worker now imports the existing NE bridge closure. `process-boot.js`
routes Worker yield 18 through its existing asynchronous PE callback gate.
`ne-guest-bridge.js` prepares immutable source copies through the existing
Worker DLL lookup protocol before synchronous NE execution. The existing
source inspector's preflight repeats only to obtain the next absent file;
no initializer, settlement or failed request is replayed. Every temporary
native live-module reference/scope unwinds before awaiting I/O. The exact
endpoint and native request token/frame are checked before and after awaits.

Execution and completion reuse the documented main/cooperative semantics in
[the NE lifecycle note](outlaws-guest-lifecycle.md): the process-owned native
module table, bounded synchronous invocation, native frame restoration,
reference ownership, exactly-once settlement and diagnostic failures. No NE
execution scope spans an await. Direct Worker slices also service the request
on their own instance. Worker commands remain serialized while lookup replies
alone bypass that queue. Stop now joins the existing callback-owner retirement
for slices and dynamic DLL service commands before Worker termination.

The DLL initializer completion/quarantine implementation is unchanged.
Failed imports, LibEntry, WEP and cancellation retain their existing failure
behavior; no imports are skipped, failed initializer is acknowledged, guest
bytes are modified, or diagnostic is silenced. The temporary callback census
review records these four changed host producers and retains `ownership:pending`.
This does not implement asynchronous NE guest waits or certify broader
invocation ownership. `host.js` retains its diagnostic for an unserviced
Worker lifecycle yield; normal service now occurs inside its owning Worker.

## Verification

The actual Worker regression passes ten cases: nested lifecycle, ordinary
slice lifecycle, delayed source I/O with unrelated exports queued and the
original gate owner retained, transitive import, missing image status 2,
malformed image status 11, LibEntry failure, missing import failure, retained
failed WEP, and cancellation with matching endpoint retirement plus balanced
callback generator/unwind counts. Success completes WEP and leaves no native
modules; failed/cancelled PE initializers retain quarantine pins. Caller
stacks, duplicate refs and named/ordinal GPA results are checked.

`flock /tmp/wine-build.lock bash tools/build.sh` passes (`build.log`). Seventeen
distinct existing NE/DLL/Worker regressions also pass in `focused.log` and
`focused-dll-worker.log`, including the full-module
`test-ne-guest-lifecycle-candidate.js`, synchronous bridge/source/caller tests,
image/invoke/QT/loader tests, DLL completion/serialization, actual Worker
DLL messages, CS continuation, bootstrap retirement, registry, run-slice and
host lifecycle controls. The expanded new Worker test passes separately in
`after-regression.log`.

One additional older partial-WAT fixture,
`test-win32-ne-module-transaction.js`, fails to compile because its extracted
invocation closure lacks `$host_beep_thread_begin`. Neither that fixture nor
its WAT inputs changed here. This is recorded rather than counted as a pass;
the full-module native transaction/lifecycle coverage passes.

## Current original browser evidence

The same staged driver passes its exact deferred observer missing-file control
and positive attach, then a fresh local Chromium production guest/render Worker
attach. Its fixture screenshot was personally reviewed and exact quit ACK,
absent PIDs/ports/profile/writer and empty input were verified. Byte-identical
input/release/identity/ACK helper controls are inherited with recorded hashes;
changed Worker execution has fresh actual-Worker coverage. The actual driver
accepts its 25-minute deadline and rejects 35 minutes, expired and NaN before
Chromium/guest creation.

One UUID-idempotent 40-minute box, `bx_67quddj6`, was allocated at 12:40:08Z,
with original expiry 13:20:08.403Z and immutable browser deadline
13:05:08.246Z. All 495 pins, including all Worker/importScripts dependencies,
the deferred observer and original companion media, verify before and after
execution. The registered EXE, empty arguments, working directory and manifest
are unchanged. There is one original launch and no UNKNOWN replay, forced
focus, guest configuration, clock, save or backend change.

Reviewed original captures: `startup` LucasArts splash; `settled` main menu;
`main-game` difficulty menu; `difficulty-good` loading; `level-ready` original
first-person level; `walk-forward` viewpoint beyond the overhead gate;
`turn-right` right-side building/horse; `secondary-fire` visible muzzle flash
and hammer-fanning hand. All are under `review/`. Two reviewed menu clicks,
Up 800 ms, Right 400 ms and Z 180 ms each receive exact ACK and independently
armed UP. All 12 recorded native events are trusted and balanced. Eight
commands, including passive captures and quit, receive exact ACKs.

The live instantiated module is SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Chrome is 151.0.7922.71, native inner viewport 1024x712. The actual original
page renderer is Win98Renderer/CanvasRenderingContext2D; no original render
Worker endpoint appears. The local COM fixture's legacy WebGL executor is
qualification evidence only. All original successful served bodies are audited
against staged pins; optional 404 probes are retained separately.

All 103 unique terminal artifacts (5,964,290 bytes), including the live module,
were recovered and SHA-verified before the task-delegated normal nonforced
shutdown. Browser and driver PIDs 11669/11676 are absent, ports 36693/36971 are
closed, profile/writer are absent and held input is empty. The box is confirmed
archived at 12:45:57.015Z, completed stop `forced:false`, expiry null. Local
qualification cleanup is also verified and `/home` remains above 2 GB free.

Git remains the source archive: tested source is main
`9397a90ae020dacef3e3646d5af59346df288f21` plus `relevant-tracked.patch` and
the required pre-existing `lib-wininit-boot.new.patch`. Owned regression/helper
patches retain small new inputs. The four runtime files match published
`c254a3e3e`; no source-tree or media archive is created.

The first demonstrated failure is closed. Further work, if assigned, is
reviewed original enemy/primary-fire interaction and the unrelated stale
partial-WAT test fixture; this run makes no broader compatibility claim.
