# Independent census and CPU review — 2026-10-27

ACCEPT the bounded two-entry callback inventory correction at
`0bbff116aa79f55e7a8ba9afaf3122e5f0a0a110` (correction `8218b104b8`).
Keep the canonical full build REJECTED and its modules UNQUALIFIED.
This acceptance does not certify invocation ownership, nonlocal operations,
full-module execution, or game behavior. No main integration is authorized.

Against base `9923b8b786fbb26fa5e07ba8d9dc2c8e4e42e10e`, only the census JSON
and the retained review note changed. Exactly two entries change only `sha256`
and `reason`; the other 405 entries compare identically, including their
ordering. Both reviewed entries still assert `ownership: pending`. The scanner
is byte-identical to base. Production source is unchanged by this correction.
The unchanged production scanner/build gate was the first behavioral check:
407 boundaries pass; nonlocal API/handler registration stays disabled. No build
or compiler was invoked in this task.

## Independent lifetime findings

The complete historical blobs were recovered read-only and compared with the
retained old files, identities and full diffs, not merely refreshed digests.
`ops/pinned-inputs.json` records the exact SHA-256 and Git identities:

- Renderer old blob `d2fab5556291146f9b4fb6ccc586d4be9485d3cc`, current
  `a4778d19ee9ca0d7e8df919fd5393ba3c7a86f29`.
- Thread manager old blob `c32dec0085065134a06761de4533139eb220f830`, current
  `05fe82b2fd26dec80652c71698d90792acd04517`.

Renderer changes add transition recording and bounded keyboard event storage.
The import closure from `createWindowHost` strongly retains its per-host Map;
the renderer Set retains WeakRefs to that Map, not the host/guest context.
Temporary dereferenced Maps and buffers live during synchronous calls. Event
objects retain scalar key/time/sequence values; selected Sets retain numeric
keys. There are no added guest callback/register snapshots, promises, timers,
or retained callable continuations. Consumption clears occupied references;
reset deletes a device; reacquisition replaces its record. Dead WeakRefs are
pruned opportunistically on acquisition/recording, so Set wrappers can remain
until later activity. This is not deterministic finalization.

Clock sampling can throw after physical key state has changed and before the
event/sequence append. Allocation failures can similarly leave partial host
state; no rollback or general exception safety is claimed. The new code has no
catch/resume continuation or restoration guard. The unchanged surrounding
keyboard/queue ownership restoration is not replaced by buffered input.
The clock hook is synchronous and may be arbitrary code; absence of a retained
callback does not establish safety for arbitrary reentrant hooks.

Actual source wiring: `host-window.js` owns the Map and delegates
`di_keyboard_buffer`; the generated numeric import signature and blocking
`guest-rpc.js` request/response path preserve one-call synchrony. Multiple calls
are separate turns. Op8 stages an inactive filter, op9 adds keys, and op10
publishes the complete selection. Recording skips inactive records. WAT sets
ACQUIRED after activation; an activation failure invokes reset before returning
an error. Unacquire and final `$dx_free` reset storage; nonfinal Release retains
the live object. Reuse unchanged accepted actual OS Worker, final/nonfinal
Release, slot reuse and admission evidence rather than replaying those groups.
No change to those production paths is part of the census correction.

The entire thread-manager delta is `isMainSleeping(observe)`, already present
on main `be0eb25fc33f3b057847d6c4e2c4fe5a6a9a426c`. The omitted-observer
expression remains exact. An enabled observer receives a newly allocated scalar
snapshot synchronously after the short-circuited comparison is captured. No
observer is stored on the manager or posted to a Worker. A thrown observer
propagates; no resource was newly acquired and no new cleanup guard is needed.
Nested calls have independent locals. Observer mutation cannot change the
already captured return value, but arbitrary scheduler mutation is not certified
safe. Existing teardown, cancellation and parked-frame paths are unchanged.
The CLI passes the optional row observer at the actual scheduler call sites.

Focused independent checks supplement the production gate: both producer hash
mutations reject, ownership claims reject, and nonlocal API/handler mutations
reject. Exact-method observer checks cover default behavior, one clock read,
short-circuiting, captured result despite observer mutation, exception identity
and nesting. This method-level supplement does not substitute for the real CLI
scanner or establish guest execution. Existing broad census mutation and accepted
DirectInput groups are reused unchanged through the verified donor manifest.

## CPU disposition

Trusted retained canonical receipt: exit0, cleanupComplete=true,
`stopReason: aggregate CPU limit`, reported CPU105.48018 >90 seconds,
wall19.653826765 seconds, peakRSS806514688 bytes. Every gate emitted its output,
but emitted artifacts do not override the supervisor rejection. Multicore CPU
can exceed wall time; that comparison is not evidence of an accounting defect.

The exact trusted supervisor SHA-256 is
`9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`.
Its header explicitly documents conservative duplicate charging. `snapshot()`
sums own utime/stime and waited-child cutime/cstime. `supervise()` retains each
identity's high-water value, sums identities, and also charges its own change
in that same combined counter. Thus a child's observed CPU remains charged
when a waiting ancestor, and ultimately the supervisor itself, inherits that
CPU. `wait4` subtree usage can also include already observed descendants.
Nested Git wrapper supervisors add more observed wait ancestry. This is a
demonstrated non-unique accounting quantity, not an undiscovered feature of
multicore execution or a numeric rounding issue.

`census-cpu-accounting-review-oct27.py` runs the **unchanged** supervisor with
the existing 90-second limit over two ~0.6-second CPU fixtures. An independent
outer Linux `wait4` obtains unique CPU for the entire inner supervisor subtree,
including its overhead. It demonstrates:

| fixture | supervisor reported | whole-subtree wait4 | duplicate excess |
| --- | ---: | ---: | ---: |
| flat child | 1.446374 | 0.883808 | 0.562566 |
| nested waiting parent | 2.162483 | 0.959733 | 1.202750 |

Both fixtures reject interpreting `cpuSeconds` as exact unique aggregate CPU;
the additional waiting parent increases excess. No supervisor code, allowance,
or resource guard changed. These small diagnostic fixtures do not reproduce
the canonical workload, and **do not prove its rejection was false**.

The retained build receipt lists identities but does not retain per-identity
own/waited CPU histories or root-subtree wait4 CPU. The available preflight,
stdout/stderr, nested Git supervision, remote-build.py, git-wrapper.py, recovery
recipe and archive cannot reconstruct unique build CPU. Therefore neither
genuine unique CPU >90 nor canonical false rejection is established. The
enforced conservative reported limit is conclusively exceeded, and remains a
blocking rejection. Its documented conservatism must not be silently repaired
or treated as permission to accept artifacts.

Coordinator assignment is needed for any accounting repair. To resolve the
canonical CPU question, recover contemporaneous unique root-subtree wait4 user+
system usage plus exclusive supervisor/bootstrap overhead, or an invocation-
isolated cgroup CPU before/after receipt covering every descendant; alternatively
retain complete identity-keyed own/waited CPU observations and reap usage with
an independently validated disjoint-accounting algorithm. Any fresh canonical
execution requires separate authorization; this task grants none.

Canonical module `b6cdde8dfa78bfcce22694127636ce1ad6714ac92df0e1182b7377005b58d758`
and compatibility module
`2ef31d69863914161bf3b37c330ae56d2968cda57444d3c6d7ba09a270910421`
remain UNQUALIFIED. No module compile/instantiation, guest/browser execution,
Boat action, guard adjustment, main publication or other worker occurred.
The retained box `bx_qq2nauqh` was snapshot-stopped19:48:56UTC; no live box was
assigned or accessed here. Coordinator retains lifecycle ownership.

## Evidence and recovery

Owned evidence: `/tmp/airstrike-census-independent-cpu-review-oct27/ops/`.
Canonical manifest: `receipt-manifest.json`; compact progress:
`checks-checkpoint.json`. Each executed operation has distinct admission,
supervisor, stdout and stderr files. Full independent source diffs and old
files are retained there. Tests are committed beside this report; run only
under the task's admission/pool/supervisor wrapper, with Node
`--max-old-space-size=512` and its retained exact startup configuration.

Reuse the coordinator-verified 49 payload hashes from donor manifest
`/tmp/airstrike-directinput-census-build-recovery-oct27/ops/receipt-manifest.json`,
SHA-256 `44347aba1ab73f2e26794b83f2010fa79337fa7d95329019a4d1ed7afc883b7e`.
No repeated payload sweep or broad suite. Source recovery used narrow sparse
checkout and read-only local object alternates, network fetch0. Root/donor
tracked files, index and refs are read-only; only the append-only shared board
was written. Publication is solely the assigned diagnostic task branch.
