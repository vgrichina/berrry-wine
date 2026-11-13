# CLI invocation-owned native observation

Implemented the missing cooperative CLI admission/drain in
`lib/cli-observation-lease.js`, integrated in `test/run.js`. This is useful
completed lease code, **not original Pawn first-writer or PV-cause evidence**.
Allocation/pointer lifetimes and raw-store coverage remain UNKNOWN. Protected
export and opcode policies are unchanged. The authentic 100-byte save is intact.

The opt-in `--cli-native-observation --no-renderer --frozen --control-stdin`
(or HTTP `--control=PORT`) installs guarded imports and exports at actual
instance construction. Only a small option allowlist is accepted, before guest
instantiation. Worker, lazy I/O, render/GPU, recording/audio, scheduled arbitrary
input/eval and other configurations are refused. Unsupported process/audio/
network/render host services are also refused before calling their implementation.
The observation command accepts bounded ranges and limits, never executable code:

```json
{"action":"native-observe","ranges":[{"lo":4321528,"hi":4321532}],"maxSteps":32,"maxMs":100,"maxRecords":64}
```

Addresses in that example illustrate the request format; callers must establish
their own live range identities. No guest allocation, position, AI, clock, save,
forced call or replay is used to enter an observation. A sample performs normal
`run(1)` on the current CPU state. Progress, including progress before a trap,
is retained. This is not a rollback command.

A request requires frozen mode with zero outstanding step credits. It closes new
control admission, holds the genuine ThreadManager writer boundary and waits for
the acknowledged parked batch boundary, command promises, writer tickets,
bootstrap/scheduling flights and I/O fills. Work already admitted may finish to
that boundary; AsyncLocalStorage retains command admission only through its
actual promise settlement. Main batches carry their own admission through
awaited continuations and retire it before acknowledging the parked boundary.
New delayed callbacks are denied throughout drain. Participant retirement, replacement or census changes refuse the
request before baseline. Instances are constructed by the controller from the
actual compiled module and imported memory; native exports, facade exports,
memory buffer, thread object/handle/slot, module and main scheduler identity are
pinned. Unregistered cooperative instances refuse admission.

Only after drain does the controller attach a fresh genuine WriterEpoch to the
ThreadManager. The main facade and cooperative facades already use that same
late-bound epoch. The owned invocation is synchronous: no event-loop yield
occurs from baseline through its bounded steps. Ordinary exports, scheduler
entries, bootstrap and control commands cannot enter. Every host import is
refused before its callback, including log callbacks and potential reentry.
The invocation-specific export view expires even during a later invocation.
All attachment and boundary releases run in finally, including errors and drain
timeouts. This supported mode has no GuestThreadHost/RPC actor; such Worker
configurations are rejected instead of attaching a fictitious idle participant.
Its transport boundary remains unchanged.

`tools/pawn-cli-observation.cjs` arms the existing native-store journal in normal
instruction mode. It does not invoke protected REP mode or change its allowlist.
It records finite single-store receipts, including same-value stores; multiple
stores in unsplit REP, host/API boundaries, invalid counters, traps and unknown
stores stop the prefix conservatively. Every result remains UNKNOWN, including
successful bounded prefixes. Records describe only the admitted native interval,
not authenticated allocation identity or complete raw-store coverage. Repeated
requests do not create a continuous first-writer proof across a stopped prefix.

Validation uses the shipped interpreter with synthetic CPU code and actual
ThreadManager construction/scheduling, plus an actual frozen Notepad CLI control
session. Controls execute main/cooperative CPU work and a host typed-array writer
admitted before the request, assert the resulting drained baseline, attempt
competing CPU/scheduler/bootstrap/control/import/host entries, and execute delayed
callbacks while draining. They cover same-value stores, unsplit REP, normal POP,
CPU traps, a real CPU host-writer callback refused before effects then resumed,
retirement/replacement, module identity, reentry, timeout, stale invocation views,
eval refusal and ordinary CPU/host/batch resumption. The seventeen new control groups pass. The existing nineteen protected
observer controls, ThreadManager regression and locked full build also pass.
The new host-entry census record explicitly retains pending ownership; the
first build identified that missing record and it was added without relaxing
any existing entry or the nonlocal API lock.

Evidence: `scratch/runs/20261113-pawn-cli-observation-1800/`, exact Git SHA and
binary patches, focused logs, locked build, independent finite watchdog logs,
source/module/save hashes. No original Pawn execution or resource admission was
attempted: the inherited resource prerequisite is unresolved and the read-only
free-disk sample was below 1.5 GB. No boxes, workers, cleanup or source archives.
Box ID none; state NOT_CREATED; expiry null; stop receipt N/A.

Next: independently establish allocation/pointer lifetimes and raw-store/host
coverage before qualifying original evidence. Any original run still needs the
actual resource phase, sustained floor above 1.5 GB, heavy lock, child census,
source/module freeze and independent watchdog. First writer, PV cause and valid
second reply remain UNKNOWN.
