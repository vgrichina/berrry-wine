# Quake II REP reader boundaries, 1405

The actual serialized `readPage` in `tools/quake2-passive-attack.cjs` now
brackets its six existing frame/ring copies with the opt-in 1335 writer
witness. It takes an optional fourth, synchronous witness object. The actual
capture/progress caller accepts `writerWitnessGlobal`, an explicit page-realm
binding name. Default calls remain off; a requested missing binding retains
UNAVAILABLE evidence. Boundary/snapshot exceptions and asynchronous receipts
retain INVALID evidence without changing acceptance, retrying, or reading
guest bytes again. Every return, including early rejection, retains the
available witness snapshot. Rejected frames retain their already-read bytes.

The helper preserves raw PC, address, element width, epoch and arm generation.
Arm generation is not parse generation. All writers, aliases, peer/host
writes, parse generation, frame ABA and historical1265 cause remain UNKNOWN;
`nativeQualification` is false. No predicate or health/input policy was waived.

## Concrete first rejection: before allocation

This task did **not** run native Q2. The necessary synchronous owning-CPU
binding is absent in the existing Worker-owned browser route. The page reader
requires the page's renderer, DOM and process identity objects. The guest CPU
instance lives in `lib/guest-worker.js`. The real `WorkerLink.callExport()`
and `readExports()` in `lib/guest-thread-host.js` await `_ask()` messages.
`host.js` explicitly retains the page instance as an idle renderer ownership
token, while the worker runs the guest. Arming that idle instance would not
observe the guest's stores. The native composition installs no page-realm
writer binding. No CPU witness is silently manufactured from shared bytes.

The caller test exercises the **real WorkerLink export method**, with inert
transport and no worker creation: it returns a Promise and the integrated
reader retains INVALID evidence. An absent opted-in binding is UNAVAILABLE.
RPCs between copies would introduce awaits and change the reader's order.
A worker/shared observer bridge requires source observer work excluded by
this task's narrow caller scope. These are preallocation limitations, not an
observed native game failure or a cause inferred from epochs.

Redline1395 acquired the sole runtime UUID
`5adf5b34-c76e-447d-b734-996cfe43bfd0` and later posted its release:
`bx_rfgz429k`, ARCHIVED/PHYSICAL_DRAINED, completed normal unforced stop
`stop_c6f706024295cebc` at 13:03:19.518Z, initial expiry 13:24:02.050Z,
final archiveAfter null, expiresAt not returned. This is the other worker's
API-verified board handoff; this worker did not independently contact,
allocate, cancel or stop that box. The Q2 prerequisite remains unavailable
after the runtime slot release. Q2 fixture/cancel proof reuse was not admitted: this task
does not have the required actual owning-reader boundary. No fixture,
original game, input, capture, local Chrome, agent or worker was launched.
New Q2 box ID/state/expiry/stop receipt: NOT_CREATED / null; watchdog NOT_ARMED
because the prerequisite failed. There are no new cleanup waits, EOFs,
transfers or shutdown receipts to claim. Q31345's archived/drained handoff
and stop `stop_cc4d683a58df369d` remain untouched.

## Validation

- Fifteen real shipped-CPU controls now get boundaries directly from the
  serialized production reader. The iterator instrumentation only traces
  bytes. They compare current OFF/ON and the exact preintegration reader at
  `1f3bd16c17cbdac9e47a441045f69a9b1157e103`: architecture, lazy flags,
  memory, 13,068 guest reads in exact order, results and executed/short-circuited
  predicates agree. The old reader records zero boundaries even when given
  the same witness. New REP publication records 60 dwords, last PC `0x403527`,
  exact destination and width 4; frame/client clears retain their real PCs.
  Authored instruction scheduling is not a native game invocation.
- Actual serialized capture/progress checks exercise all six bracketed copies,
  default/opt-in/missing binding, detached retained evidence, early rejection,
  throwing observers, rejected asynchronous receipts and the real async export
  proxy. Observation failures leave acceptance unchanged.
- All 18 existing old/new rejected-frame controls pass with the full generated
  1205 health consumer, exact read order, attack/damage and signed health.
  Six added real-CPU controls execute the original publication REP between
  existing copies and retain its receipts in the actual health history sink
  on first HP loss, signed death -1 and UNKNOWN. Independent UP runs in all
  six, including failed-UP variants; the first terminal error remains sticky
  and terminal ticker reads remain zero. The UNKNOWN control authors the
  current-frame change; it makes no claim about that change's CPU writer.
- Passive attack/damage, native-write-core, 66 real REP observer controls and
  exact1265 verified binary decoder/reader replay pass. The decoder's corrupt
  gzip input is an intentional negative control.
- Locked `flock /tmp/wine-build.lock bash tools/build.sh` passes.

## Current source and modules

Evidence: `scratch/runs/20261109-quake2-rep-witness-native-progress-1405/`.
`git-base.txt`, relevant uncommitted patch and owned patch recover source;
Git is the archive. `current-pins.json` records the current on-disk closure
with **no historical Git provider substitution**, and explicitly lists every
change from1265. Preparation does not claim whole-fixture admission.
Historical readers occur only as named test controls.

The current build differs from1265:

| Module | Bytes | SHA256 |
|---|---:|---|
| primary | 2185646 | `d5dd33faadee5a0f77ac35347ecf0e4efe5efc86d92b03ef45ffe5adee83aea0` |
| compat | 2188292 | `a5d7569b2315787832b7e1e720aca05e4de8012c809ac7a7e7896a29452d057f` |

The pinned EXE remains the existing installed-extracted Quake II executable,
323584 bytes, SHA256
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
No media/module/source archive copies were created. Evidence is sealed by
SHA/size and gzip CRC; free /home stays above 1.5 GB.

Next work needs explicit scope for a synchronous owning-CPU/page boundary
transport before a fixture or original run. Existing asynchronous load/write
observations cannot replace it. Native guard/door progress remains unverified.
SingleTaskSTOP.
