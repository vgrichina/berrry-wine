# Warcraft III renderer loss audit — 8 November 2026

**No emulator cause is demonstrated; no emulator repair was made.** The
retained original establishes an unanswered audio import and disappearance of
an OS renderer PID. It does **not** establish that the disappearing PID owned
Warcraft's page. The bounded production audio fixture passes. A remaining
prelaunch PID/target mapping gap prevents another original in this task.

Evidence: `scratch/runs/20261108-warcraft3-renderer-process-loss/`.
Read first: [released remote journal investigation](browser-journal-remote-service-20261108.md),
its final cause audit, journal tail, process samples, browser logs and driver;
also the Warcraft and earlier current-browser notes. Single worker, no nested
workers, no game execution or new box in this task.

## What the retained original establishes

The compressed journal was streamed through SHA-256 and parsed without a raw
expansion. Its 2,582,639,811 original bytes hash to
`bb37538245ebad990e24f07e91e64c7b43cad35d6e1666cfd0f5458b07639668`,
matching the release. The 1,950,341-byte controller trace was also independently
hashed and inspected. `retained-audit.json` preserves both hashes and tails.

The final nested chain is `WorkerLink._onMessage` 2968485 →
`GuestRpc.invoke.voice_play_ring` 2968486 → `GuestRpc.host.voice_play_ring`
2968487, arguments `[720900,24246244,136704,0,2]`, slot 4, endpoint 5,
04:52:59.323 UTC. There is no retained return/error. The last observer emission
at 04:52:59.324 drains through 5,937,009. The released final **218,625-slot
contiguous tail** remains meaningful; earlier **8,528 lost slots in ten ranges**
remain a limitation. Older unmatched calls across those ranges are not hangs.

The busiest retained observer epoch second contains **47,620 rows**, and the
largest batch contains 1,025 rows including a loss marker. Loss means the true
earlier peak is not bounded by that measurement. Most entries are unrelated
Worker messages; only 17,929 retained host `voice_play_ring` entries occur in
the entire original. Repeating millions of those other records is unnecessary.

PID **11520** is present at 04:52:58.956 and absent at 04:52:59.954, before the
04:53:17.923 owner read and its UNKNOWN. Browser process requests continue.
Its dominant renderer CPU time is a correlation. `SystemInfo.getProcessInfo`
has PIDs but no target IDs; page/Worker bindings have target IDs and emulator
process ID 1000, but no OS PID. The retained driver captures neither a tracing
mapping nor browser target crash/exit events. It handles target detach for
Worker bookkeeping without retaining an independent exit record.

Thus exact **Warcraft page ↔ PID11520 mapping is unknown**, and so is the
original renderer exit reason. Original Chrome stderr contains no corresponding
fatal stack or exit explanation. The later browser exit code zero describes
normal browser closure, not PID11520. OS crashpad/apport/kernel/OOM records were
not retrieved by that run; their absence from evidence is not proof that the
remote OS had no such records. The archived box was not resumed to seek them.
Page and observer emissions both stop, so uninterrupted synchronous execution
inside the last audio import is also unproved. Neither audio deadlock, OOM,
guest trap, browser crash cause, emulator regression nor historical stall cause
follows from this boundary.

## Exact production audio path

`IDirectSoundBuffer_Unlock` in `src/09a8-handlers-directx.wat` refreshes an
already playing looping buffer by calling `host_voice_play_ring(handle, wa,
size, 0, 2)`. `lib/guest-rpc.js:createWorkerImports` uses an asynchronous
descriptor refresh only when its live voice map matches both pointer and
length. Otherwise it posts a blocking RPC. The final observed RPC means this
fast path was unavailable; the retained records do not say why.

`GuestWorkerLink._onMessage` services the RPC through the main broker, whose
invoke calls the selected `lib/host-audio.js` arrow import. That import calls
`ctx._voices.playRing(...)` and returns zero only afterward. `playRing` first
looks up the voice, pumps notifications, obtains a PCM view and selects strict
`loop === 2`. Refresh then marks audio hot, updates extent, flushes or joins
the optional recording tap, and attempts an existing worklet descriptor write.
If not already routed, it can promote a live looping BufferSource after lazy
module readiness; otherwise it uses the existing delayed-ring or decode/splice
fallback. Those branches were not bracketed in the original.

`notifyPump` walks active notification registrations, computes progress and
signals crossed events through the final host namespace. Worklet progress
reads try at most four times. `route` checks routing gates/module readiness,
then writes a descriptor or constructs a node. Module loading is asynchronous;
this path does not synchronously wait for the module promise. The AudioWorklet
uses bounded descriptor retries and finite render quanta. There is no
`Atomics.wait` in these page-side audio files. This source audit does not rule
out a native browser failure or establish which refresh branch the original
entered. Tap allocation sizes, native calls and event reentrancy remain
unobserved in that original; no speculative lock or audio change is justified.

## Narrow probes and real-browser fixture

Run-local `probes.cjs` reuses the released independent observer and tested
coalesced recorder. It selects voice lifecycle/notification/worklet methods
and unique lexical refresh hot/tap/delay/decode brackets. It excludes unrelated
Worker messages. Arguments retain primitive values and object identities;
object graphs, getters and thrown-object message getters are not traversed.
The diagnostic ring is bounded at 32,768 slots of 2,048 payload bytes, with
explicit loss/oversize/fragment markers. The recorder remains bounded at 32 MiB.
Probe code adds no guest writes, guest polls, timer or scheduling changes.
Existing observer timing and production audio timers remain in use.

`probe-test.cjs` checks receiver/argument identities, original object and promise
results without then assimilation, exact thrown object, exactly-once calls,
host zero versus inner undefined, actual production `getMemory` exception,
hostile receiver/error getters, unchanged fixture memory, and fail-closed source
anchors. These probes are diagnostic artifacts, not a production source change.

`retained-voice-shape.json` recovers voice 720900's actual open arguments:
**44,100 Hz, stereo, 16-bit**. Corrected fixture v4 uses that format, exact
pointer **24,246,244**, length **136,704**, offset zero, voice ID 720900, fixed
512 MiB shared WebAssembly memory and actual browser Worker slot 4. It invokes
production `GuestRpc.createWorkerImports/createMainBroker`, `createAudioHost`,
the worklet router and the actual AudioWorklet processor. No emulated guest
program or full interpreter module is substituted into an original run.

Both unobserved and observed arms pass lazy-load fallback, loop=2 promotion,
same-node loop=2 refresh, locally read advancing worklet cursor, stop/release,
replay/new node and close. Synthetic notifications at zero, half-ring and STOP
exercise the active notification/progress path; their registration is not
claimed to match the original's unknown notification state. The first
promotion travels as blocking RPC; the routed refresh travels as asynchronous
call. Outer results remain zero and production lifecycle semantics agree.

Initial iterations with only 100 ms audio startup waits failed a fixture cursor
assertion while AudioContext time was also stationary. Retained v1/v2 failures
are not emulator failures. A two-second startup allowance followed by a
500 ms cursor interval resolves the fixture assertion. v3 passes at 22,050 Hz;
v4 corrects the recovered format and adds active notifications. The initial
overbroad probe anchors failed closed and were narrowed before observed runs.

| Corrected v4 measurement | Result |
| --- | ---: |
| Synchronous bursts | 3 × 900 refreshes |
| Maximum rows per epoch second | 75,925 (> retained original 47,620) |
| Final contiguous chain | 77,682 slots, 38,841 entries + 38,841 returns |
| Lost / oversized / pending fragments | 0 / 0 / 0 |
| Recorder admitted / durable batches | 386 / 386 |
| Maximum queued plus in-flight bytes | 3,831,102 (< 33,554,432) |
| Median 900-refresh unobserved / observed burst | 6.710 / 170.980 ms |
| Added time per refresh | 182.522 µs |

These are sequential synthetic arms, not a randomized original workload:
the inner burst takes **25.48×** as long with probes. Original-run overhead
is unmeasured. Passing beyond the measured rate does not bound every possible
original burst. `validation.json` validates every final sequence increment,
parent entry/return pairing and bounded queue. A finite 1.8-second synchronous
callback additionally leaves its entry durably readable while still pending;
the independent recorder/observer continues and its exact result 37 returns.

## Independent exit control and remaining gate

After closing the synthetic audio fixture, a deliberately requested local
`Page.crash` produces `Inspector.targetCrashed` and
`Target.targetCrashed(status="crashed", errorCode=134)` for exact page target
`C4BBF068032641CDC37FBA689C88F4BD`. Independent browser samples lose renderer
PID **3269640**; native stderr identifies that same PID and signal 6. Crashpad
minidumps for the v3/v4 controls and the v3 apport report were recovered and
hash-verified. Those records explain **only these deliberately induced local
control exits**, never the original. A 700 ms observation in v3 was too short;
v4's bounded independent samples retain the eventual crash event and PID loss.

Pre-crash `Tracing.start/end` qualification, attempted with both event delivery
and a stream, retained no page marker or frame/PID mapping within its bounded
completion wait. Therefore a reliable **prelaunch** page/Worker-to-OS-PID
mapping is still unqualified. Post-crash correlation in a deliberate control
does not supply that missing original mapping. Remote burst service and
original overhead for this narrower selection are also unmeasured.

This is the concrete remaining gap: qualify that mapping and independently
retain browser target exit status plus OS crash/exit diagnostics alongside the
inner refresh chain on a subsequent bounded original. The existing original
cannot supply missing inner branches or an exit reason retrospectively. No
new box was allocated while this prerequisite failed; no replay, WebGL
follow-up, guest/config/clock edit, audio disabling or lock removal occurred.
Player control, full27, parity, FPS, audio quality and campaign stay open.

## Validation, preservation and lifecycle

Focused neighbors pass: audio routing **36/36**, Worker audio cursor,
DirectSound refresh seam and AudioWorklet processor tests. No emulator source
changed, so no failing-before repair claim or new locked-build claim is made.
Git references, relevant binary diff, source hashes and owned new-file patches
preserve recovery without source/media archives. Closed logs are losslessly
compressed and round-trip hash-verified; the predecessor's multi-GB journal
was never expanded locally. Run size stays bounded.

All local fixture Chrome processes exit zero on browser closure; profiles and
ports are closed. `local-shutdown.json` records checks. No box was created:
**box ID null, state NOT_ALLOCATED, expiry null, stop receipt null**. No
inherited box was touched. Sampled free disk stayed above five billion bytes;
the lowest explicit sample was 5,003,784,192 bytes. A continuous disk minimum
was not recorded. The coordinator independently restored headroom. No RAM
gate, source/media archive, old-box resume/delete, deployment or nested worker.
