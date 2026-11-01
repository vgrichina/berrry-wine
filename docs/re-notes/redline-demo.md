# Redline (Accolade / Beyond Games, 1999): original single-player demo recovery

## Stadium City gameplay and controls reached (2026-11-01)

Run `20261101-redline-default-drain-gameplay` advances the original demo through
Stadium City selection, world loading and its opening cutscene to **first-person
gameplay with visible control responses**. Inspected 640×480 PNGs show the
weapon, crosshair, HUD strip, changed camera position after Up, changed viewing
direction after Right, and a firing effect while the left mouse button is held.
The rendering remains visibly incomplete: surfaces, characters, weapon and HUD
contain flat/untextured areas and missing detail. This is local CLI gameplay
evidence, not correct rendering, sustained playability or browser qualification.

Both serial runs remove **all nine block counters**, retaining only frozen
read-only snapshots of accumulator/time, CPU/stack and synchronization state,
plus existing input delivery observations. No breakpoint, clock override,
guest register/memory write, settings change or additional DLL was used.
Counters in the preceding investigation affected optimization/pacing; its batch
numbers must not be substituted for this run's observations.

### Default-budget drain and pump return

Run 1 retains the shipped CLI defaults: 1,000 blocks per batch and 200 ms per
batch. It follows DISPLAY unchanged → Play → Start Up → New Game → Stadium
City, then queues Enter-down at 29,100 and Enter-up at 30,100.

| Batch | Stored time `0x5b8740` | Accumulator `0x5b8744` | Input dequeued/dispatched | Inspected output |
| ---: | ---: | ---: | ---: | --- |
| 29,100 | 5,132,611 | 864,603 | 6 / 5 | Stadium City selection |
| 115,100 | 5,132,611 | 33,960 | 6 / 5 | Same selection |
| 125,100 | 23,822,601 | 0 | 8 / 7 | LOADING WORLD |
| 135,100 | 23,822,601 | 0 | 8 / 7 | LOADING WORLD |
| 155,100 | 29,210,203 | 687,506 | 8 / 7 | Opening 3D cutscene |
| 275,100 | 29,210,203 | 542,372 | 8 / 7 | Same cutscene frame |

The first fixed-time interval subtracts 830,643 = 25,171 × 33, averaging
9.65864 accumulator ms per batch. Between 115,100 and 125,100 the backlog
drains, the stored time advances, the two queued Enter events are delivered,
and mission loading begins. This establishes eventual catch-up completion and
pump return; no mutex or traversal repair was necessary. The final cutscene
frame alone is **not** counted as gameplay.

The second fixed-time interval drains only 145,134 over 120,000 batches,
averaging 1.20945 ms per batch. At the last observation, 16,436 more 33-ms
decrements remain. Extrapolating that interval requires about 448,445 additional
default batches / 124.5 seconds, before any subsequent elapsed-time addition.
The wall estimate uses the 33.321-second difference between the two capture
mtimes, including checkpoint overhead; it is not a throughput guarantee.
Run 1 already took 64.210 seconds. Continuing that same budget cannot fit the
120-second inner bound at the measured average, which justifies the next run's
documented instruction-budget adjustment.

### Final bounded run: budget adjustment and player input

Run 2 repeats the ordinary route at defaults through batch 29,100, then uses
the existing control command `set-batch-size:100000`: **100× the default main
block budget**, without changing the 200-ms batch clock. This changes work
per synthetic time interval, not guest configuration. It is not a claim of
100× wall-clock speed or a measurement against the preceding instrumented run.
The worker slice policy and all other launch options remain unchanged.

Enter-down is queued at 29,100 and Enter-up at 29,110. At 30,100 the accumulator
is zero, stored time is 6,000,001 and dequeue/dispatch is 8/7; the inspected
capture is LOADING WORLD. Batch 30,300 shows the opening cutscene. The original
Readme's controls explicitly document Space to skip cutscenes, Up for forward,
Right for turning and left mouse for fire. The retained `readme-text.txt` is
only a text extraction; the original file remains unchanged.

| Ordinary input | Held interval | Inspected capture after work |
| --- | --- | --- |
| Space | 30,300–30,500; release then 200 batches | `run2/space-released.png`, 30,700: first-person weapon/crosshair/HUD |
| Up (VK 38) | 30,700–30,730 | `run2/forward-held.png`: camera advances into the arena |
| Right (VK 39) | 30,730–30,760 | `run2/right-held.png`: view turns toward the blue-lit interior |
| Released arrows | through 30,790 | `run2/controls-released.png`: weapon, nearby vehicle, changed view |
| Left mouse | 30,790–30,810; release then 10 batches | `run2/fire-held.png`: firing effect; `fire-released.png`: effect clears |

The input dispatch trace records these keyboard and mouse messages reaching
Redline's focused `0x10017` window. Dequeue/dispatch advances from 8/7 before
Space to 17/15 at 30,820; the renderer input queue is empty at every captured
checkpoint. Accumulator samples during player controls stay between 527 and
1,102, with advancing stored time. Thus these captures include delivered
controls and subsequent rendered changes, rather than merely queued events.
No claim is made about audio, missions beyond this opening area, or a complete
texture/HUD implementation. The next useful investigation is the incomplete
texture/HUD rendering on this now-reachable gameplay route.

### Identity, bounds and preservation

The accepted locked-build module from `20261101-redline-catchup-runtime` was
reused because all **4,385** recorded source/test/tool/package input hashes
still match, before and after both runs. Its build-source commit remains
`bbfb46421afa71d0f3899f9dc3cd0ac2308183c8`; observation HEAD is
`cb0ac400b3af8a6ef3d838c7abdb3354791ad4c1`, with unchanged runtime inputs.
The accepted build log is copied into this run. Both actual WebAssembly compile
observations match retained `tested-module.wasm`, 2,025,619 bytes, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
Layout remains `ccbc5bf6dfb9610e`; the retained mirror SHA-256 remains
`3926a7a2bda6727de2852155e9764b24b8909001d1e2c6ba62e0eb4cab708b11`.
All 127 actual loaded-read hashes per run match the files after testing.

The launch remains `--app=redline_demo`, empty guest arguments,
`C:\MAINDIR` cwd, original EXE and IFORCE2-only seed, original 59-companion
manifest and shipped DISPLAY defaults. Full registration/fixture tests pass
before and after; all 70 host fixture hashes, including the full original
65-file extraction and package/archive pins, are unchanged. No production,
test or foreign WIP files were edited.

Exactly two local CLI guest invocations ran, each on an open PTY with
outer `timeout --kill-after=5s 150s`, inner `--max-seconds=120`, finite inherited
child guard and process-group cleanup. They finish by control `quit`, exit 0,
in 64.210 / 93.133 seconds, without timeout, trap or signal. No child was
requested. Both Python drivers, both outer processes and both Node guests
are absent; both process groups are empty. Disk remains above 2 GB. No box
was acquired: ID, state, expiry and lifecycle handback are N/A.

Commands, PTY/control logs, original-control text, actual inspected captures,
`analysis.json`, full source/fixture maps, loaded module/read manifests and
cleanup verification are retained in the ignored run directory. There is no
candidate-corpus ID, so the reviewed result remains investigation evidence
and is not attached to an unrelated dashboard candidate.


## Measured catch-up backlog (2026-11-01)

Run `20261101-redline-catchup-runtime` establishes the immediate reason the
ordinary CLI pump does not return during Stadium City selection: the main
thread is completing updates inside a large fixed-step backlog. Traversals
and callbacks return repeatedly; the accumulator decreases correctly. It has
not drained by the final observation. This is a measured local CLI cause,
not a mission-load fix or browser/WebGL qualification.

The required current-main locked build passed before the focused fixture test
and serialized runtime. Build-source HEAD was
`bbfb46421afa71d0f3899f9dc3cd0ac2308183c8`, following `18dd486c0` and incoming
`95b5a2440`. The actual compile inputs in both guest runs were the retained
2,025,619-byte `tested-module.wasm`, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
Its layout is `ccbc5bf6dfb9610e`, matching the current mirror (SHA-256
`3926a7a2bda6727de2852155e9764b24b8909001d1e2c6ba62e0eb4cab708b11`).
The mirror copy, full source maps and actual loaded-read manifests are retained.
All 4,385 tracked source/test/tool/package input hashes were unchanged, as
were all 123 observed file reads in each guest run. No old module, historical
source overlay or identity bypass was used. Shared HEAD advanced through
unrelated documentation during observation; it is not substituted for the
recorded build-source identity.

Read-only counters were armed at original pinned-EXE addresses `0x49e6db`
(traversal entry), `0x49e8e8` (exit), `0x49e8d0` (callback return),
`0x53ad0e` (update return), `0x53ad1f`, `0x53ad29` (catch-up exit),
`0x53aa8a` (pump), `0x53aba3` (catch-up entry), and `0x53acff` (inner loop).
Frozen-boundary read-only snapshots record time, accumulator, registers,
stack, callback pointers, synchronization words and input queues. Counter
instrumentation changes interpreter optimization/pacing, so these batch counts
are diagnostic observations, not uninstrumented timing or browser throughput.

| Batch | Time at `0x5b8740` | Accumulator at `0x5b8744` | Update returns | Traversal exits | Pump entries |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 24,000 | 4,248,003 | 15,537 | 804 | 803 | 958 |
| 29,100 | 5,290,611 | 1,019,073 | 1,988 | 1,986 | 967 |
| 35,100 | 5,290,611 | 965,613 | 3,608 | 3,606 | 967 |
| 39,100 | 5,290,611 | 929,973 | 4,688 | 4,687 | 967 |
| 47,100 | 5,290,611 | 858,660 | 6,849 | 6,847 | 967 |

Across batches 29,100–47,100, 4,861 completed update returns subtract exactly
160,413 = 4,861 × 33. Traversal entries and exits each increase by 4,861;
callback-return count increases by 2,143,706. Catch-up entry remains 35,
exit remains 24, the inner-loop drain-exit remains 5, and pump remains 967.
Thus this interval is one progressing catch-up invocation, not one frozen
600-entry traversal. At batch 47,100 the actual EIP is `0x49e872`, DX 436.
The callback pointers sampled are `0x53aba3` and `0x52927a`.

Between batches 24,000 and 29,100, one additional catch-up entry updates the
stored time by 1,042,608 ms. Its effect reconciles exactly:
15,537 + 1,042,608 − (1,184 × 33) = 1,019,073.
The calculation uses 1,988 − 804 = 1,184 observed returns. The CLI's unchanged
default is 200 ms per batch. A large elapsed-time addition paired with slower
work completion explains the backlog on this route; no altered clock, budget,
register, guest memory or configuration was tested. At the last snapshot,
26,020 further 33-ms decrements would be needed if nothing else changes.
Whether the full backlog drains and the next elapsed-time addition permits
sustained pump progress remains unmeasured. No eventual mission load is claimed.

The static mutex ambiguity is also resolved locally: guest `0x5b81b0` contains
handle `0xe0002`. Its synchronization slot is type 3 (mutex), owner Win32
thread ID 1, recursion 1 throughout the snapshots. Worker emulator tid 1
(Win32 ID 2) remains at `0x4c2974`, waiting on that same handle; main continues
executing. This documents a worker waiting for main's owned mutex, without
establishing a circular deadlock. Main's nonzero diagnostic wait-handle field
is stale while its active state/yield 0 and progressing counters are observed.

The unchanged ordinary route opens DISPLAY at batch 11,000, accepts its
original defaults, then Play, Start Up and held mouse/Enter New Game. The
inspected batch-29,100 capture shows Stadium City mission selection. Enter
down at 29,100 and up at 30,100 stay in the renderer queue through 47,100;
observed dequeue/dispatch counts remain 6/5. The inspected final capture is
byte-identical to mission selection. It is a menu, not gameplay.

There were two actual guest runs, plus one Node preload-path failure before
CLI/module/guest creation (exit 1, 0.056 s). Guest run 1 ended cleanly after
batch 24,000 because the optional `input-state` diagnostic rejected a numeric
request ID; its startup measurements and error receipt are preserved. Guest
run 2 corrected the request ID to a string and completed the route above.
Both used open PTY/control-stdin, outer `timeout --kill-after=5s 150s`, inner
`--max-seconds=120` and ordinary `--spawn-processes` child guards inherited at
120 s. Both ended by control `quit`, exit 0 (10.462 / 17.209 s including
startup/control), without timeout, trap or signal. No guest requested a child.
All recorded guest/outer PIDs are collected and absent. No box was acquired;
box ID/state/expiry and lifecycle handback are N/A.

`node test/test-redline-demo-registration.js --fixture` passed before/after,
including full package, original archive and 65-file pins. The complete
70-file host fixture hash maps match. Original EXE/IFORCE2-only seed, empty
args, cwd and default DISPLAY route remain intact. Production and test files
were not edited. Evidence contains commands, full control responses, inspected
captures, build/test logs, module/source/mirror identities, quantitative
`analysis.json`, and exit/cleanup receipts. Free disk stayed above 2 GB.
No candidate-corpus ID exists; this remains investigation evidence, not a
dashboard pass. Remaining work is eventual drain/pump-return and subsequent
mission-load behavior under a separately scoped run; no further runtime was
launched in this assignment.

## Mission callback localization (2026-11-01)

Investigation `20261101-redline-mission-callback-cause` narrows the outstanding
work to the game's fixed-step catch-up path, but **does not establish the first
causal blocker**. It inspected the published `1dd8b642` run's actual Stadium
City capture, saved stack, input-state records and original pinned EXE using
existing disassembly/xref tools. No new guest invocation was made; there is no
new gameplay, browser or WebGL evidence. Production, tests and disk fixture
files were not edited.

The saved batch-52,200 EBP chain is coherent across five frames. Starting at
`0x074ffca8`, the return addresses are `0x43e726`, `0x529290`, `0x53ad0e`,
`0x53ab4d`, `0x5398c1`; saved EBP advances through `0x074ffcd0`,
`0x074ffce0`, `0x074ffcf0`, `0x074ffd18`, then outside the captured stack at
`0x074fff6c`. Original disassembly resolves the innermost calls as:

- `0x43e721` calls the UI traversal `0x49e6db`, returning at `0x43e726`.
- `0x52928b` calls that input/UI update `0x43e712`, returning at `0x529290`.
- `0x53ad08` calls the function pointer at `0x5b6d4c`, returning at
  `0x53ad0e`. This stack establishes the active callback path through
  `0x52927a`; the pointer itself was not sampled.
- `0x53ab47` calls the pointer at `0x5b6d48`, returning at `0x53ab4d`.
  The saved inner frame is in `0x53aba3`, the fixed-step catch-up function.

That catch-up function reads `WINMM!timeGetTime` at `0x53accf`, adds the
elapsed difference from `0x5b8740` to accumulator `0x5b8744`, and saves the
new time. While the signed accumulator is at least 33, `0x53acff` calls the
update callback, then `0x53ad0e..0x53ad1d` subtracts 33 and loops. This inner
loop contains no message pump. Only after it drains can the function return
through `0x53ab4d`, then `0x53ab8c` jump back to `0x53aa7d` and the ordinary
`PeekMessageA` loop at `0x53aa8a`. This is a concrete pump-return dependency,
not proof of excessive accumulated time or scheduler starvation.

The UI traversal is bounded by a signed 16-bit index below 600, with an
additional early exit when its remaining-live-entry count reaches zero.
Batch 42,200's EIP `0x49e8d0` is exactly the return site of the indirect
virtual call at `0x49e8cd`: at least that UI callback returned. Batch 52,200
has EIP `0x49e872` and DX 418 at the index-increment block. Neither sample
records the index at both times, the entry count, callback target, traversal
entry/exit counts or accumulator. Therefore neither a single traversal stuck
forever nor repeated completed traversals is demonstrated. The last dispatched
message being Enter-up does not establish an outstanding DispatchMessage call;
the captured call chain instead places execution in the pump's update path.

Message ownership is localized to the existing renderer queue: both saved
input-state records retain six later events, main is active with no wait,
and the focus/routed window is `0x10017`. This explains where delivery awaits
the pump, without proving why the pump has not returned. The worker's
`0x4c2974` wrapper calls `WaitForSingleObject`; its paired constructor calls
`CreateMutexA` and its release calls `ReleaseMutex`, **not SetEvent**. The
static global mutex object at `0x5b81b0` participates in a separate update
path at `0x53ad7d`, which acquires, calls the same update pointer, and releases.
The saved worker wait handle `0xe0002` cannot be mapped to that object or an
owner from these records: neither object contents nor the worker stack nor
ThreadManager mutex ownership was captured. No mutex deadlock is established.

The precise remaining runtime question is whether `0x5b8744` decreases across
completed `0x53ad0e` returns and reaches below 33 before another elapsed-time
addition, and whether `0x49e6db`/its callbacks return during that interval.
Existing `--count` diagnostics on the traversal entry, return block
`0x49e8e8`, callback-return block `0x49e8d0`, catch-up loop/exit and pump entry,
paired with read-only accumulator/index/stack/mutex-owner observations, would
distinguish those cases. The predecessor evidence cannot supply these missing
values; no speculative runtime fix was made.

Fresh execution stopped at a concrete identity prerequisite. Inspection began
on main `1810077ac3b4c26d5cdc723407dd8612f0082d77`, after Rune had released its
runtime. Incoming `95b5a2440` changed three previously loaded host sources:
`test/run.js`, `lib/apps.js`, and `lib/region-map.generated.js`. The retained
validated module still hashes to `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`
and carries layout `3a03507bae8914c0`; the current JS mirror carries
`ccbc5bf6dfb9610e`. The CLI's existing pre-instantiation guard refuses that
pair. Thus exact unchanged validated-build reuse is unavailable in this shared
checkout. No launch was spent on the known mismatch; no bypass, historical
source overlay, rebuild or guest mutation was performed. A matching validated
source/module/mirror set is required before collecting the missing runtime
observations. This host identity prerequisite is separate from the still
unproven guest cause.

Evidence includes original-EXE disassembly/IAT names, reconstructed stack,
saved queue/thread samples, current/prior source and module identities,
registration output and command/exit receipts. The inspected screenshot is a
byte-preserved predecessor capture, explicitly labeled as reused. The focused
`node test/test-redline-demo-registration.js --fixture` check passed; all 70
host fixture files match the predecessor's after-map. Documentation diff check
passed. No guest/child was created, no authentic VFS state was changed, and
no box was acquired (ID/state/expiry N/A). Disk remained above 2 GB. This is
an investigation-only record with no candidate-corpus ID or dashboard pass.

## Original local CLI progress (2026-11-01)

Run `20261101-redline-original-cli-progress` reached the original launcher,
DISPLAY dialog, Beyond Games splash, Start Up menu and mission selection.
The inspected mission-selection capture highlights **Stadium City**. Opening
that mission did not succeed within the bounded run: later ordinary Enter and
mouse input remained queued while the main guest kept executing. There is no
player-controlled gameplay evidence. This is local CLI compatibility evidence,
not browser, WebGL, authentic Windows installation or hardware qualification.
The older runtime-transfer restriction below concerns the remote lane; this
assignment explicitly authorized the existing local fixture.
The launcher visibly titles itself `Redline Demo - v0.90 1/19/99`; that observed
label is separate from the PE timestamp and the readme's January 28 date.

Tested shared main `d4b5757889c59a4bb17c9a3b47c9759fb62ace60`, a documentation
advance from requested `36592af3b884b95d2f14dc5474c5c541a1640e95`.
No source, test, helper, app registration or fixture edits were made.
`node test/test-redline-demo-registration.js --fixture` passed before and after:
the original package, all 65 original members and 60 game files retain their
pins, including EXE SHA-256
`fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`.
The host tree's full 70-file map (65 originals plus existing metadata/manifest)
also matches before/after. Launch cwd remains `c:\MAINDIR`, guest args empty,
and the sole app-local DLL seed remains original `IFORCE2.DLL`.

No loose CFG was supplied. The game itself generated `c:\maindir\redline.cfg`
in its ephemeral VFS through the ordinary route. A read-only snapshot is
retained as `guest-generated-redline.cfg`, 2,500 bytes, SHA-256
`aa7d4bd36cfef68c47737d26d613bc023f5125f3872ccd75c7a9ac5d4b1a60c5`.
It records `displaydevice 'display'`, `screenwidth 640`, `screenheight 480`,
`screenbbp 16`; it was neither edited nor fed into subsequent runs. No renderer,
DirectX, registry, dependency or installed-state override was used.

All three runs used an open PTY and this exact command, replacing `N` with
`1`, `2` or `3` and inserting the diagnostic flags listed below:

```sh
timeout --kill-after=5s 150s node \
  --require ./scratch/runs/20261101-redline-original-cli-progress/observe.cjs \
  test/run.js --app=redline_demo --no-build --wasm=build/wine-assembly.wasm \
  --quiet-api --quiet-blocks --no-close --max-seconds=120 --spawn-processes \
  --control-stdin --frozen \
  --png=scratch/runs/20261101-redline-original-cli-progress/runN-final.png \
  --tee=scratch/runs/20261101-redline-original-cli-progress/runN.log
```

Read `docs/cli-run.md`, the control implementation and both child launch paths
before launch. `--spawn-processes` enables actual ordinary child execution;
both child paths inherit `--max-seconds=120`, and the parent collects/kills its
children on exit. No child process was requested or spawned in these runs;
Play creates the game window in the same emulator. The outer 150-second process
group watchdog bounds even frozen think time (the inner guard pauses while
frozen). Each run ended through control `quit`, exit 0, with no trap, signal or
watchdog expiration. There were never overlapping guest trees; no guests remain.

The command channel accepts `{"action":"step","n":11000}` and
`{"cmd":"click:130:337"}`. Common ordinary route: step to batch 11,000,
click DISPLAY at (130,337), step 2,000, click Done at (127,331), step 1,000,
click Play at (132,281). The DISPLAY screenshot shows the original selected
Primary Display Driver (display) and 640x480x16; no selection was changed.

- Run 1: captured splash at 19,000 and Start Up at 24,000. A click on New Game
  at 29,000, Enter held for 50 batches, a mouse press held for 100 batches,
  and relative motion (0,-18) followed by a 1,000-batch press did not advance
  the displayed menu through 50,250. Exit after 72.616 seconds of run-loop time,
  191,656 API calls. This established an input symptom, not a deadlock cause.
- Run 2 was a focused diagnostic, adding `--trace-input --trace-input-dispatch`
  and `--trace-api=PeekMessageA,GetMessageA,DispatchMessageA,GetAsyncKeyState,GetCursorPos,IDirectInputDevice_GetDeviceState,IDirectInputDevice_GetDeviceData,WaitForSingleObject,SetEvent,ResetEvent --trace-api-paused`.
  At menu batch 24,000, move and press at (330,148), plus Enter down, step 100,
  then release mouse/Enter and step 5,000. API tracing was enabled only during
  that 100-batch hold. Both DirectInput device reads returned S_OK, and a
  read-only buffer observation found mouse button byte 0x80. At batch 25,525,
  six queued events drained and five entered DispatchMessageA. The inspected
  capture at 29,100 shows mission selection. Thus an unconditional input-polling
  failure is disproven; the simultaneous mouse/Enter sequence does not isolate
  which action selected New Game. Exit 28.410 seconds, 179,303 API calls.
- Run 3 added only `--trace-input-dispatch`, repeated that successful held-input
  route and visually reconfirmed mission selection at 29,100. Enter down at
  29,100, up at 30,100, then 5,000 batches did not open Stadium City. Next,
  move to (95,120), relative motion (-240,0) over ten batches, step 100, press
  at (95,120) for 2,000 batches, release and step 5,000, then another 10,000.
  Through 52,200, the mission-selection PNG remained byte-identical and six
  later events stayed queued: Enter down/up, motion, hit-test and button down/up.
  The earlier six dequeues/five dispatches never increased. Exit 49.443 seconds,
  192,774 API calls. Stopped here; no fourth invocation or source repair.

First demonstrated remaining route blocker: **Stadium City selection does not
progress in this bounded execution**. Read-only snapshots at 42,200 and 52,200
place main EIP at `0x49e8d0` and `0x49e872`; the latter is a 16-bit-index loop
over 600 UI entries, with indirect callbacks at `0x49e8cd`. The stack still
contains 5,132,611, matching the last observed guest tick after the earlier
input dispatch; the exact outstanding callback has not been identified. Thread 1 is
active at `0x4c2974`, yield 1, wait handle `0xe0002`; no held-critical-section
failure was printed. These observations do not prove an infinite loop,
scheduler starvation, missing DLL causality or a renderer defect. Startup also
warns that system `ole32.dll`/`shell32.dll` real-PE files are absent; do not
replace them or treat those warnings alone as the demonstrated cause.
The next causal assignment is to trace the mission-selection callback/dispatch
return and its 600-entry traversal, including loop progress and thread/event
ownership, using the preserved ordinary route and unchanged fixture.

All three actual WebAssembly.compile inputs were 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`;
the exact bytes are retained as `tested-module.wasm`. Accepted locked build
`20261101-thread-manager-options-land` (40.431 seconds, PASS, accepted commit
`9ba1c215c1766b39da747f386e0820f7399f6c93`) was reused. All 1,153 preceding
Rune source inputs plus both package files match before/after; all 66 tracked
actually read sources match that accepted build commit. The observer records
123 distinct reads including installed dependencies/media, unchanged afterward.
Selected SHA-256 identities: `test/run.js`
`69f1d0193b0fddd31660a95271afba4e52a71bf09eb73e29e93c1e6d277f30bf`,
`lib/apps.js`
`f95d5d6c37062a8c38accebed9ac6ae7d6d9589e8c482b5100bfc2a9f23b30c8`.

Ignored evidence directory: `scratch/runs/20261101-redline-original-cli-progress/`.
`commands.json`, `ordinary-inputs.json`, logs, snapshots, loaded-source/module
hashes, before/after fixture maps, disassembly and PNGs preserve the route.
Actually inspected launcher, DISPLAY, splash, Start Up, run 2/3 mission
selection and final blocker captures. Redline has no candidate-corpus ID, so
the investigation record has `candidateId: null` and is not a dashboard pass.
Documentation diff check and fixture checks passed. Disk stayed above 2 GB;
box ID/state/expiry/shutdown N/A, no box ownership acquired. No browser,
download, transfer workaround or public deployment was performed.

## Local candidate registration (2026-11-01)

The recovered original is registered as local-only experimental `redline_demo`.
Use the ordinary local `index.html?candidates&app=redline_demo` selector route.
This is static launch preparation; no browser, installer, game or gameplay was
executed. Public eligibility is unchanged. The earlier recovery report below
describes the media-only stage before registration.

Canonical ignored fixture: `test/binaries/candidates/redline-demo/`.
`original/MAINDIR/` contains all 60 unchanged original run files, including
both readmes, Mplayer support, I-Force files and the whole data container.
The other five extracted support files remain under `original/` with their
exact extraction-relative paths; installer TEMP/GROUP_PATH labels are not
mounted as invented installed Windows locations. All 65 candidate files are
independent byte copies, with no shared inodes or links to archival originals.
There are no generated settings or modified guest files.

The entry launches `original/MAINDIR/Redline.exe` as
`c:\MAINDIR\Redline.exe`, with cwd `c:\MAINDIR` and empty arguments, preserving
the original shortcut's relationship. The ordinary schema1
`.wine-assembly-browser.json` lists exactly the other 59 MAINDIR members with
explicit `c:\MAINDIR\...` paths and exact whole-file sizes. It retains the
three auxiliary EXEs as companions. It uses the current manifest validation
contract without an integrity bypass or a claim that its optional single-EXE
integrity format can describe this multi-EXE tree. Separate full-file checking
pins the package and all 65 extracted files against the table below.

Static import-table and printable dynamic module-name inspection of both
Redline.exe and IFORCE2.DLL found `IFORCE2` as the only game app-local seed.
It imports KERNEL32/ole32; printable module names also include user32/kernel32.
Redline's names otherwise match its system imports listed below. Therefore
the entry seeds only the original `IFORCE2.DLL`, using the host's existing
basename DLL policy. Mplayer's Url.dll/Rnaph.dll and installer DxDlg.dll are
preserved support files, not injected startup dependencies. Static inspection
cannot establish every dynamically constructed runtime dependency.

The native original DISPLAY selection / Play first-run flow remains intact.
No renderer, default selection, registry overlay, CFG, DirectX version
override or dependency injection was added. Whether original installation
side effects are necessary remains unknown; static extraction and a source
readme do not constitute installation or runtime evidence. DirectX 6 / 3D
prerequisites, rendered output, input, audio and gameplay remain unqualified.
Runtime access stays blocked pending authorized functioning transfer. Boat
ID/state/expiry: N/A; no box or runtime lifecycle ownership was acquired.

The original package is deliberately referenced, not duplicated:
`scratch/runs/20261031T2348Z-redline-original-recovery/RLSPDEMO.EXE`, with the
48,229,213-byte SHA-256 pin below. `.host/package-reference.json` records this
predecessor reference; `.host/inventory.json` and `inventory.sha256` retain
whole-file recovery pins. The predecessor's actual handoff is `RECOVERY.md`
(`RECOVERY.txt` does not exist). Its extraction/package/source files remain
unchanged. To recheck recovery and the actual registered fixture from repo
root, run:

```sh
node test/test-redline-demo-registration.js --fixture
```

The explicit fixture mode fails if media is missing. It verifies the package,
all candidate and archival whole-file hashes, exact 65-file set and 60-file
run tree, independent inodes, the canonical inventory digest, exact registry
entry and manifest, actual CLI resolver, browser-relative URLs/VFS paths,
ordinary loading policy (8 eager / 51 lazy; synchronous reads: 59 eager),
and checked-out local selector / public exclusion expressions. Without
`--fixture`, the test checks registry and selector behavior without requiring
ignored media. Evidence, static PE/string inspection, gate logs and recovery
instructions: `scratch/runs/20261101T0002Z-redline-local-registration/`.
The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passed, as did
the focused fixture check, file-policy / candidate-manifest tests, census
mutation tests and Rune registration regression. The reviewed census change
updates only the apps host-file SHA; all boundary/ownership fields remain
unchanged. `/home` remained above 2 GB free (over 2.56 GB at final build).

Static media recovery only, 2026-10-31. No installer, game, browser or runtime
was executed; no box was allocated or accessed. Gameplay compatibility remains
unknown. The recovery base is main `81f5df0c8966ef74e23bb0961cf8cc1e746d0efe`,
a descendant of requested `4efd707960b1b4bbbce2f77b11c9da84b7c8b305`.

Evidence and original media are retained in the ignored directory
`scratch/runs/20261031T2348Z-redline-original-recovery/` (called `R` below).
Before ownership, searched existing reverse-engineering notes, `lib/apps.js`,
`TODOS.md`, `ops/STATUS.md` and the append-only messageboard. No competing
Redline game ownership, qualified lane or hold was found. References to
Rendition's `redline.dll` concern a different component. The coordinator's
Redline task/status entry is this assignment. No registry or candidate files
were changed.

## Source and identity

Selected the standalone Windows package
[`RLSPDEMO.EXE`](https://archive.org/download/RedlineDemo/RLSPDEMO.EXE)
from Internet Archive's
[`RedlineDemo` preservation item](https://archive.org/details/RedlineDemo),
uploaded in February 2012 and attributed to Beyond Games / Accolade, 1999.
This is a credible preservation mirror, not a publisher-hosted download or
cryptographically authenticated publisher release. The item's description
discusses multiplayer; the actual Wise script explicitly names this payload
**Redline Single Player Demo**. Its executable and original readmes determine
the recovered build's identity.

[PCGamingWiki's preservation entry](https://community.pcgamingwiki.com/files/file/2800-redline-demo/)
separately identifies single-player `reddemo.exe` and multiplayer `reddemo_m.exe`
and links archived FilePlanet IDs 47170 / 47169. Those historical names are
leads, not a claim that `reddemo.exe` is byte-identical to `RLSPDEMO.EXE`.
[ModDB's demo mirror](https://www.moddb.com/games/redline/downloads/redline-demo)
bundles both demos in `redlinedemo.zip` (67,366,650 bytes; advertised MD5
`6e6712d976529fea06a6e266847f97fe`). That ZIP was not downloaded or verified.

Saved Archive metadata records the selected package as 48,229,213 bytes,
MD5 `ad55f1adc4b3a094b1576ff95956d777`, SHA-1
`57618ed347c2ee842ba5bfad391a04a14f70e5d4`.
HTTP range probes returned 206, total 48,229,213 bytes, last modification
2012-02-15 17:14:16 GMT and ETag `"4f3be7e8-2dfeb5d"`.

## Static extraction and installation boundary

The 65-member Wise file table was parsed from the first 65,536 bytes before
the full download. It advertises **91,645,042 expanded bytes**. Admission
reserved the complete package plus complete expanded payload and 3 MB for
helpers/evidence; the combined task limit is 200,000,000 bytes, and `/home`
must remain above 2,000,000,000 free bytes. No compilation archive was
downloaded. An unrelated 27.99 GB WizardWorks archive was identified through
metadata only; its archive listing returned HTTP 403 and it was not fetched.

REWise extracts original bytes without running the Windows installer.
`extracted/MAINDIR/` is the game's original run-file tree; `TEMP/`,
`UNINSTALL_PATH` and `GROUP_PATH/` retain installer support and website files.
These variable names are extraction labels, not literal installed Windows
paths. Static extraction does not perform the original installer actions.
The readme documents interactive double-click installation; additional
installer command-line arguments and any required installer cwd are unknown.

The original script sets the default directory to
`%PROGRAM_FILES%\Accolade\Redline Single Player Demo`. Its ordinary game
shortcut and finish-page launch target `%MAINDIR%\Redline.exe`, with empty
arguments and working directory `%MAINDIR%`. Therefore the corresponding
extracted-tree launch proposal is `Redline.exe`, cwd `R/extracted/MAINDIR`,
args empty. This is source-backed launch intent, not a successful launch.
The separate Mplayer shortcut targets `mplaynow.exe`; it is not the
single-player executable.

The script invokes the bundled `TEMP/DxDlg.dll` export `DirectXDlg`, creates
shortcuts, installation log and uninstall metadata, and offers desktop icon /
launch choices. `wise-script.log` retains the parsed original operations,
including the empty shortcut argument field and cwd. No installation replay,
registry/config fabrication, dependency replacement or patch was performed.

## Original prerequisites and ordinary first run

`MAINDIR/Readme.doc` and `Readme.rtf` identify a **January 28, 1999 single-player
and network demo**. They describe two training missions, Stadium City followed
by Yahoos, and multiplayer arenas MultiAirport / Triagonizer. This differs
from the Archive item's older multiplayer description. A numeric release
version for these actual bytes has not been established; the catalog's 0.90
label for another filename is not adopted as an executable version.

The original System Requirements section specifies Windows 95/98, AMD K6-2
233 or Pentium 200, 32 MB RAM, DirectX 6, compatible display and sound drivers,
and a 3D accelerator. It advertises 75 MB disk space, which is smaller than
the actual recovered run tree; use the measured sizes here for storage
planning. IPX LAN or TCP/IP is listed for multiplayer. The Installation
section calls its installer `REDLINEDEMO.EXE`; this name differs from the
mirror's `RLSPDEMO.EXE`, and no byte-identity claim is made for the former.
It says to follow the installer prompts and obtain DirectX 6 if missing.
The driver section says a DirectX installation requires a restart.

The documented first-run sequence is the original launcher, DISPLAY hardware
selection, then Play Redline. The launcher documentation recommends selecting
the primary display device for a combined 2D/3D card. It exposes resolution
and advanced options; none were selected or changed here. Then New Game
reaches the first mission according to the readme. These are instructions for
future ordinary use, not observed behavior. Arrow keys move/drive, Ctrl fires,
Space jumps on foot or brakes in a vehicle, and Delete/Page Down exits a
vehicle. The readme discourages editing `Redline.CFG`; no loose CFG is shipped
in this extracted tree and none was created. Any defaults inside `Redline.bgd`
remain untouched; its internal format was not unpacked.

Static PE imports of `Redline.exe`: `SHELL32`, `DDRAW`, `DINPUT`, `DSOUND`,
`WINMM`, `USER32`, `GDI32`, `ole32`, `WSOCK32`, `IFORCE2`, `ADVAPI32`,
`KERNEL32`. The bundled `IFORCE2.DLL` imports `KERNEL32` and `ole32`.
`DDRAW` imports include `DirectDrawCreate` / `DirectDrawEnumerateA`, and
`DINPUT` includes `DirectInputCreateA`. These are static import observations,
not a complete runtime dependency trace. Executable strings also state the
DirectX 6 and 3D acceleration requirements and name
`SOFTWARE\Beyond Games\Redline`; required initial registry values, if any,
remain unknown. No DirectX redistributable is present among the 65 members.
Authentic DirectX 6 installation and working 3D driver enumeration are the
first ordinary launch prerequisites to establish in any future runtime lane.
No native-DLL mapping or compatibility claim is made.

## Actual pins and validation

Recovered package SHA-256:
`e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c`.
Both catalog MD5 and SHA-1 matched the complete downloaded bytes.
`MAINDIR/Redline.exe` is a 1,828,864-byte PE32 i386 Windows GUI executable;
SHA-256 `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`.
Its COFF timestamp is 1999-01-28 02:05:18 UTC (a header field, not independent
release-date proof); preferred image base is `0x00400000`.

All **65 extracted files / 91,645,042 bytes** matched the pre-download Wise
table's paths and sizes. Every file's computed CRC32 matched the original
script, and REWise `-V` independently reported success for all 65 members.
The complete `MAINDIR/` run tree is **60 files / 91,406,857 bytes**, including
the original readmes, I-Force files, Mplayer support and 48 WAV files.
The main `Redline.bgd` container is 71,788,765 bytes; it was retained whole.
No original settings, bytes or filenames were modified.

`inventory.json` records path, size, SHA-256 and CRC32 for every file.
`inventory.sha256` uses sorted paths and canonical lines of the form
`SHA256`, two spaces, decimal byte size, two spaces, path, newline. Its
SHA-256 is
`08c55c1a9054ec7f0d8ceb717aa308d7bd338e7a542d3ffbde56965b353d82df`.
The full inventory is also pinned below so recovery does not depend on
ignored evidence surviving.

Evidence: `preflight.json`, `redlinedemo-metadata.json`, `range-metadata.json`,
`head-list.log`, `head-recheck.log`, `download-admission.json`, `download.json`,
`extract-admission.json`, `extraction.log`, `verify.log`, `wise-script.log`,
`redline-pe.txt`, `iforce-pe.txt`, `dxdlg-pe.txt`, original readmes and
`validation.json`. The DOC's printable strings were inspected statically;
neither document was opened in a GUI.

The first geo download and a sequential direct-server continuation were
terminated (own processes, exit 143) because of slow transfer. Four disjoint
HTTP 206 ranges completed the same file, with exact Content-Range/length
checks and final whole-file catalog hash verification. No second package
copy was retained. An attempted filtered extraction from only the head probe
failed with a parser/seek error and produced no payload; complete-package
extraction, full CRC verification and independent table checks passed.

At the completed extraction check, this task's logical files totaled
140,696,032 bytes and `/home` had 2,226,073,600 bytes free. Both download and
extraction had separate pre-write admission checks; downloads also checked
remaining extraction headroom while writing. Original predecessor files were
read only. No project build is required for this documentation-only commit.

## Recovery recipe

Use a newly owned, empty ignored run directory; never extract over an existing
fixture. Retain the whole original package, readmes and all run files. The
readme contains Accolade's copyright notice; no redistribution license was
established and no media was published.

Extractor: official REWise revision
[`c3d3b68903a90ec53ff7b0a4ae704adc6302814b`](https://codeberg.org/CYBERDEV/REWise/src/commit/c3d3b68903a90ec53ff7b0a4ae704adc6302814b),
source URL
`https://codeberg.org/CYBERDEV/REWise/archive/c3d3b68903a90ec53ff7b0a4ae704adc6302814b.tar.gz`,
1,724,088 bytes, SHA-256
`7f18fd53180cc4f9547fb62c232952b414b71e5c89286604751c898a91e447da`.
This task reused the existing verified source archive from
`scratch/runs/20261031T2253Z-rune-demo-media-resume/` without changing it,
copied its source/COPYING/README/Makefile into `R/rewise-source/`, and built a
small standalone extraction helper. Its local SHA-256 is
`8da810cf481dd17764854289aa28be727b34390e6d2b01e1320c8ca3668c6203`;
compiler-dependent helper identity is separate from game/package identity.
`extractor-source-pins.json` records every copied source file. The debug
variant built with `-DREWISE_DEBUG` supports `-z` for static script inspection.
No Windows installer or game code runs through REWise.

For fresh recovery, first recheck space. Allow at least 145 MB task headroom
for package, expanded payload, source and bounded evidence, while preserving
the 2 GB free-space floor and 200 MB task ceiling. Re-fetch the 64 KiB head
with HTTP 206 and confirm the exact expanded table before any full download.
Then use the stable package URL above; the metadata also advertises direct
server `https://ia801407.us.archive.org/19/items/RedlineDemo/RLSPDEMO.EXE`.
If endpoints change, read `/metadata/RedlineDemo` for current servers; require
the same package size and pins rather than trusting the filename.

Commands below assume `R` is that empty owned directory, the pinned source
has been verified and selectively extracted to `R/rewise-source/`, and fresh
download/disk checks have passed. Use bounded HTTP timeouts and size limits.

```sh
gcc -Wall -I"$R/rewise-source/src" \
  "$R"/rewise-source/src/{rewise,CP1252,print,reader,exefile,pkzip,wildcard,wisescript,wiseoverlay}.c \
  -o "$R/rewise" -lz
mkdir "$R/rewise-tmp"
curl --fail --location --max-time 60 --range 0-65535 \
  https://archive.org/download/RedlineDemo/RLSPDEMO.EXE \
  -o "$R/range-head.bin"
"$R/rewise" -l -p -t "$R/rewise-tmp" "$R/range-head.bin"
# Require 65 members / 91645042 bytes; repeat free-space admission.
curl --fail --location --max-time 600 --max-filesize 48229213 \
  https://archive.org/download/RedlineDemo/RLSPDEMO.EXE \
  -o "$R/RLSPDEMO.EXE"
# Require 48229213 bytes and package SHA-256 e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c.
sha256sum "$R/RLSPDEMO.EXE"
# Repeat free-space admission immediately before expansion.
mkdir "$R/extracted"
"$R/rewise" -x "$R/extracted" -p -t "$R/rewise-tmp" "$R/RLSPDEMO.EXE"
"$R/rewise" -V -p -t "$R/rewise-tmp" "$R/RLSPDEMO.EXE"
```

Compare every extracted path, size and SHA-256 with the table below.
The retained `R/check-media.py` additionally compares all original script
CRCs and recreates the canonical inventory digest. Its use in this run is
recorded in `validation.json`; that script is an evidence helper, not a
tracked runtime or app registration.

Next: preserve this fixture for a separately authorized ordinary installation
and first-run lane that establishes authentic DirectX 6 / 3D hardware support.
Installation side effects, generated settings, actual rendered output,
input, audio and gameplay remain untested. Runtime/Boat ID, state and expiry:
N/A; no lifecycle ownership was acquired.

## Complete extracted file pins

Paths below are relative to `R/extracted/`. All hashes are SHA-256.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `GROUP_PATH/Accolade Website.url` | 51 | `fd1eca0f4e9d0aab1a7a2b01cebaf1f353d463c9fe845dad8f9f382eeda0f95a` |
| `GROUP_PATH/BeyondGames Website.url` | 54 | `44768e854571fd9092b9e6067dd89572d984fc032fa552467a087f480710313f` |
| `MAINDIR/IFORCE2.DLL` | 68608 | `13df61b255529952085af6812890ff824245479513a5a610b81cb5edca4a7ad1` |
| `MAINDIR/Mplaynow.ini` | 222 | `0b3350903136d46aa6395a4db2598ec144b108f38aab3d22aab833d8a0a18ecb` |
| `MAINDIR/Mplaynow/Mplayer/setup.EXE` | 1038780 | `d08aa48938b4577f4b6e93d1be3613266300ddef020cb37933d6bf3397ed9004` |
| `MAINDIR/Mplaynow/Mpnetsue.exe` | 10112 | `af605d85dd58e8f00c8970e28cfea4a92e8c9eb4842559b4172e9947a1fc69b8` |
| `MAINDIR/Mplaynow/Rnaph.dll` | 9728 | `a72e6d59937affc14ceaf55bd5663968c4e78c1399d45c55283552e23a8a86be` |
| `MAINDIR/Mplaynow/Url.dll` | 87552 | `b00a7034f2e34350f9c2efd402f786716994fee98d7ae26c9b0ff59dfa8c1fa5` |
| `MAINDIR/Readme.doc` | 89600 | `a31bb6fbe7086b6128c8f6af0a77e7e97625a947396c8eacbd15f04500ae6828` |
| `MAINDIR/Readme.rtf` | 65275 | `4b91a429ada240d65a3ddc577842766397abb026c817e8c9204dfcb44023b02c` |
| `MAINDIR/Redline.bgd` | 71788765 | `840dc1421e88708bb64de686e6a996e2638c27693b25ecdb54237824c64808aa` |
| `MAINDIR/Redline.exe` | 1828864 | `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e` |
| `MAINDIR/mplaynow.exe` | 273408 | `ae9577e276413b5635194521417f01919b799f33b287bcbaaa458ed99baada00` |
| `MAINDIR/redline.ifr` | 1217 | `b3e9f558349f50beff05b7f87efc0730b5f7e04e5516999a29bcf32b7140d82a` |
| `MAINDIR/wav/CrowdPanic2.wav` | 440378 | `f9a2680dbeda57031f497c98ae4ce56e53c24abc939c69c0306b80a16e624bf6` |
| `MAINDIR/wav/EnviroGrowl.wav` | 459566 | `e961f27ca0431eae28695111971b246c96efa5b0e0b9bac2666eb0f29106a47f` |
| `MAINDIR/wav/EnviroHall.wav` | 84090 | `38fb370728a5af3b8325effa05974baa331521aa568e2c2291b5dfb48f205aad` |
| `MAINDIR/wav/RantGrowl.wav` | 210160 | `7cb94ab93831f66d7b51c92e6fa4e6e3e3f6d9f9e132b6e118a202b6c85452b7` |
| `MAINDIR/wav/Stad1st_01.wav` | 633978 | `8cbb5a87e5b158404a24ec7add3f351b3c0ba2a2bc7552624079883556a27adf` |
| `MAINDIR/wav/Stad1st_02.wav` | 469382 | `19391bf8d8230a3943478560085f2dda6e77e83829df76e9ca10c3e140ac799f` |
| `MAINDIR/wav/Stad1st_03.wav` | 370394 | `b5495309afc9f345872093815e8c2415731e66fc91b29b6f7c3662359edb3c82` |
| `MAINDIR/wav/Stad1st_05.wav` | 937328 | `fdb32af0176127a1371e5648a7b9e55984dbd76f29885f4652073c3990a0e8cd` |
| `MAINDIR/wav/Tox5.wav` | 121614 | `db5874dcb6b12a48ea93cbafa3f3f35d452e0e918d3d488aab92bba84e679c6a` |
| `MAINDIR/wav/YahooIntro.wav` | 1503280 | `3b945517ba1373e3bf092bbfa04ba4c157b7093b5e86c593d99fd93f2695ed7f` |
| `MAINDIR/wav/flameboom.wav` | 101840 | `581a38591f569a1e14309326e0a3f4858eb2731644255acbe7d799e20d31d7f4` |
| `MAINDIR/wav/howlingchamber.wav` | 283838 | `da65e0c34b146776bdd2e250120e7077b305993f698ddc7130d8de98fa4fdab8` |
| `MAINDIR/wav/hub0.wav` | 1478300 | `a5f6244ae720a03cd58bad3bd9d8a012c89d17241bc1b38b82359956d292d1fa` |
| `MAINDIR/wav/hub0_1a.wav` | 281104 | `146421e0296f693c6149d2592122eb6f6bd5d0b5304325967d29fa5936d4a080` |
| `MAINDIR/wav/hub0_1b.wav` | 221042 | `9829322e53ef3e006a252d4df621e275adddc84ac2ff2d85374cf875c1b9f162` |
| `MAINDIR/wav/hub0_1c.wav` | 512144 | `4db534b2034689026f4dfaf2e517415ff9712faee460883a6cebbef16454e394` |
| `MAINDIR/wav/hub0_2.wav` | 317578 | `e076757e5c1cb1316c1de9428718cadc257065d12708a28455e576f4790dfe37` |
| `MAINDIR/wav/hub0_3.wav` | 133240 | `dfd54ea955d760baa4c0cbe9ea1cc848628d640d03aaaa04aecf41dde068b834` |
| `MAINDIR/wav/hub2.wav` | 143116 | `db0dd776bdc9d7199124113017dc6db3fe6ab7cc30214fec8c00d36972853b70` |
| `MAINDIR/wav/rumble1.wav` | 79178 | `d76441e1a2a13560ee59e8d93ac61bffc479c369ef629a82b8c7c3fb52b09ac7` |
| `MAINDIR/wav/stadSong2.wav` | 976712 | `afcd3138b42ad0eff7d2679b4612d7f22db420a438906984036b9c436abf4c8b` |
| `MAINDIR/wav/stadSong3.wav` | 941132 | `f4d10d9d2a9ff884f129dc1323a0b4ee33f5c77640fbd2ed70b9b6a0c133fa0b` |
| `MAINDIR/wav/stadium10.wav` | 82810 | `63069fbebe883e9ac9d5dc695304cae854a72107c6a836e2d047d43ccd480b18` |
| `MAINDIR/wav/stadium11.wav` | 59580 | `de140fd5224548b264cfb27c3a014da414a3e7699508b993a52c4ea641d40baf` |
| `MAINDIR/wav/stadium13.wav` | 39542 | `a92a4fbba37b5c2fa0b42f691d7a50c313283f89c533c484a0be8cd097df4fed` |
| `MAINDIR/wav/stadium14.wav` | 93182 | `4bda00558b16fded36c3ce05e9520fd11a5c2b67f437e926f33aa7902c6912d6` |
| `MAINDIR/wav/stadium9.wav` | 328782 | `17bcecc84f50f46666f7c70a979b3b1f1e389403df2daf1a82b25b01dfd8e771` |
| `MAINDIR/wav/windLoop.wav` | 203646 | `f02df070838380f1d0d863019074d837a069a212e5955b0113e93db5448727d1` |
| `MAINDIR/wav/yahoos1.wav` | 191992 | `2fd9a7d586d444d7f659452b0ddcd8ffe091bb268cad259c4d19003d90e4b4db` |
| `MAINDIR/wav/yahoos10.wav` | 285420 | `cfa5918fcc323907db3bf72137ed51ad6cc3648d9784de11391625898de2e21c` |
| `MAINDIR/wav/yahoos11.wav` | 125992 | `7b689566e1cc2b7620855b470b2a89faa68f6047daccebf2a0e550ab139e7d1e` |
| `MAINDIR/wav/yahoos12.wav` | 390534 | `eab2a77ce713df632edf5c79964d992cc1a99eacec07703e0174488877e8b8d4` |
| `MAINDIR/wav/yahoos13.wav` | 248852 | `d5f7ea6c9adc8d56fbcac71677d99100d7edadae113dae5782c12a2d779c288e` |
| `MAINDIR/wav/yahoos14.wav` | 206832 | `a7b73623cdeacfa1a9cbbf7d8f50eb400a9d48c7a135bf00cb98ed48048f49ac` |
| `MAINDIR/wav/yahoos15.wav` | 143336 | `337f6183f64c0816c37bedccbbf9e3c7cabecdf09ba94aad8c8c5b8e48de9c18` |
| `MAINDIR/wav/yahoos16.wav` | 96412 | `5466b8eb989f831fbf2c52f1ee53ee99c76f96a63c3de52a8d26df718baac6e6` |
| `MAINDIR/wav/yahoos17.wav` | 226276 | `7069447dff1a536f55b8d10ab693b78e66a7b163be3c3de72649c1c2e4c65b58` |
| `MAINDIR/wav/yahoos18.wav` | 197108 | `ef283b662a49fa1033bd3a3c0d5d154ead15e18f034c36b9f81dc8ac0830edff` |
| `MAINDIR/wav/yahoos19.wav` | 126488 | `b8bc5303b7c7c0e222e31260db7fc81de794f4ae845e370093b579577504b76b` |
| `MAINDIR/wav/yahoos20.wav` | 57720 | `fe43778dcb52faf2b1ffc0d57ee460ef28ef13526c254455f3ba075ab4ae73a1` |
| `MAINDIR/wav/yahoos3.wav` | 117780 | `2ec99501277ff7530c8c3725841a1c5e93f2d529972da5b17046966e87a5c7c1` |
| `MAINDIR/wav/yahoos4.wav` | 70020 | `722b8973ff8fa8a090f716fe86b5314e0dc7096b2671a1e4682e8316ae6314ca` |
| `MAINDIR/wav/yahoos5.wav` | 114552 | `ed88a8aa13a34bafc6fa85bf21ae989763db3c38f02543732b70b3045924adc7` |
| `MAINDIR/wav/yahoos6.wav` | 356360 | `4bd895a778ca10ab225a0992afcbc4b75ec4e56985cc74153d855ccfa382da64` |
| `MAINDIR/wav/yahoos7.wav` | 79664 | `575e8066556a5c21eb447efdceea496a25401b072862839f4dd5e46670fa2ba7` |
| `MAINDIR/wav/yahoos8.wav` | 341780 | `7d71097d71f41fa39a24a59d3ed3b7eae10f881f12933ace7c18143f9228e306` |
| `MAINDIR/wav/yahoos9.wav` | 325596 | `6dfb5560d7fc8d9a1a126419bb1a7e81ba2b0a91f3f267ce4484fe150169819a` |
| `MAINDIR/wav/yahoosexp.wav` | 935076 | `93836f5a2459875d684e218ae055d2b2798ad326d489c3e9106e3daa03916379` |
| `TEMP/DxDlg.dll` | 80896 | `a17daf20e9abcc519d0ecb53ce5dc8c37515e4eeffee2a89213b55991456a69d` |
| `TEMP/W32INST_PATH_` | 8704 | `3e0c4e282a232b65f22911a4ab25c7b8f84660dc52a2a2bc4f1a90892ad02472` |
| `UNINSTALL_PATH` | 148480 | `a2b6c24d41b3837f2979029c403a451d3946c4ab2cbf1e05e85066e39df551ec` |
