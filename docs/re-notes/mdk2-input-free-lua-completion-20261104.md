# MDK2 naturally completes the Lua request and constructs Level l1

One bounded replay of the unchanged original runtime reached the requested Lua
completion, then constructed `Level` / file `l1` and queued the next 105 resources.
The final personally viewed capture at step 3680 remained black. Loading artwork,
comic, tutorial and gameplay are unproved. No production defect or fix follows.

Evidence is in `scratch/runs/20261104-mdk2-input-free-lua-completion/` (RUN).
This follows [the resource contract](mdk2-construction-resource-contract-20261104.md)
at b9f92d156 and [the deferred replay](mdk2-deferred-request-native-replay-20261104.md)
at b1a22f69d. The predecessor's complete 525-file seal was verified unchanged.
The local preparation commit was `7e58e56fa6609a144e48bb74044e8791b3adad01`;
that is not the execution source.

Execution retained source `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`, module
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` and companion
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
The assigned fork `bx_5dbavbcw` was actually hydrated/healthy and executable,
with retained module/media and no Chrome process before use. Preflight checked
all 432 runtime pins, exact small driver/controller dependencies, both runtime
JSON companions, actual assignment RUN/OUT, CJS and ESM Puppeteer24.31.0 imports,
registered selector/WebGL, isolated HTTP module hashes and cache graph. All
30 existing media paths/hashes matched; none was copied. The original observation
preload and accepted controls stayed unchanged. All 54 classifier/controller
controls, six assignment routing tests, wrapper import test and two read-only
observer tests passed. These preparation tests missed the new sidecar filename
contract described below; dependency presence did not prove that contract.

The sole Chrome/151.0.7922.108 PID23726 has identity time 12:18:39.391Z.
All 27 captures were personally viewed before any dependent action. Each capture
first saved the existing published 640x480 logical canvas as RGBA bytes and read
the actual file-worker state, then took the full-page PNG. There was no repaint,
guest callback, register/code/argument write, fault clear, retry or reload.
Startup advanced in reviewed 512-slice groups. At3072 the legal/title screen
supported balanced Escape. At3184 New Game was readable with a red controller
ring; at3232 Medium was highlighted. Separate capture-bound reviews and input
preflights preceded the two balanced Enter presses. No input followed Medium.

| Step | Direct native observation; viewed game area |
| --- | --- |
| 3280,3296 | Medium fade; startscreen/menu, deferred transition. |
| 3312 | Black; menu/game intermediate pair directly sampled. |
| 3328–3376 | Black; game/game, Level absent, level1/checkpoint9. Type10 request6174784, pending0/completion0, size192320, completedBytes982692. |
| 3392,3408 | Black; completion1, active cleared, completedBytes1175012: exact **192320** delta. Prepared1, queue1 and request6174784 persist legitimately. Level still absent. |
| 3424 | Black; Level table with file `l1`, initial queue1; completed Lua request still retained. |
| 3488–3680 | Black; Level `l1`, queue105, new active/request6122816, type1/size699228, pending0/completion0, completedBytes reset0. |

Thus completion preceded Level creation and its separate resource-loading phase.
The earlier historical3424 completion was not used as a deadline. This replay
completed at3392, with its own timing and inputs; no historical screenshot or
measurement was relabelled as current evidence.

The new read-only sidecars correlate native workerHandle921600 to the actual
ThreadManager entry and guest tid2. They retain current PC, previous PC, general
registers, 48 stack words, suspend/wait/sleep/yield fields, scheduler events and
slice counters. At3344/3376/3392/3488/3680 the owner is active, suspendCount0,
waitPolls0, sleepUntil0, lastYield0 and not in flight. Worker slices increase
3277→3309→3325→3421→3613. PC samples are `0x4515cd`, the return from the original
SleepEx wrapper. Pending samples have differing stacks/registers and return
addresses `0x45774a` or `0x457708`, the archive output/input callbacks that call
that wrapper with zero delay. The original disassembly is retained in
`owner-disassembly.txt`. This supplies scheduling and decode-callback activity
despite stable aggregate completion bytes. It does not measure a monotonic decode
cursor or establish a stall. The Lua request subsequently completed naturally.

The first unexpected failure was an operator download HTTP404 for
`comic-control-130-owner.json`. The executed run-owned wrapper had saved that
sidecar as `comic-control-130-owner`, because the original driver's `save(name)`
uses the supplied name verbatim. Raw metadata had the same suffix omission;
all actual RGBA, metadata and owner files existed and were recovered. Progression
stopped immediately: **the next guest command was quit133**, acknowledged at
12:26:22.586Z. Chrome exited0 after463.195 seconds, before the original470-second
bound/deadline12:26:28.542Z. No second Chrome was launched.

The same worker fixed the ignored wrapper to pass explicit `-raw.json` and
`-owner.json` names. The actual generated shot command is now exercised offline
with inert page/I/O peers: it must write both exact names, raw bytes, PNG and
capture JSON in raw/owner/PNG order. A negative control reproduces and rejects
the executed suffix omission. Those two controls and both observer tests pass.
The fixed wrapper was **not executed in Chrome**. Executed wrapper SHA is
`d8cf550bcae04becb0347571b134c388174bbc04422bdec89a3648ebe888bc94`;
fixed SHA is `b5f85284acebec7339786c655f56929954cd8212e64bce3ff71fcc65f071e787`.
Both versions and small new-file patches are retained in RUN.

Full recovery verifies all560 closed remote files /43622189 bytes. Focused checks
pass all134 sequential ACKs, exact requested execution, all200 served-file hash
matches, cache-disabled responses, isolation,27 PNG/raw pairs, review hashes,
balanced/drained input and the Lua/Level/queue boundaries. Successful static
responses carry no-store; six retained404 fallback responses do not. The shared
continuation ledger ends at400 slices/39 commands,13 construction quanta and
three pending quanta; menu continuation used208/39. No budget was reset or extended.

Only this note is committed. Git SHA, relevant binary diff and owned small-file
patches preserve provenance; evidence/helpers remain ignored. No full build is
claimed for this documentation and run-helper change. No local heavy runtime,
source archive, module/media copy, other box, lifecycle action, subworker,
successor or deployment occurred.

Custody returned to the coordinator after recovery: `bx_5dbavbcw` is left RUNNING
(API idle, healthy, hydrated), expiry2026-11-04T12:54:43.746Z. Chrome is absent and
the owned driver process is closed. Shutdown remains the coordinator's at12:50.
The next native prerequisite is completion of the new699228-byte resource and
the subsequent queue, followed by separately verified visible loading/tutorial
evidence in a separately authorized run. This worker stops after publication.
