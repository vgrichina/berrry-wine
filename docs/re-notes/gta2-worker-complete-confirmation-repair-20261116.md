# GTA2 Worker COMPLETE confirmation repair

Status: candidate actual main and Worker four-gesture fixtures PASS; full live
fault matrix and published-source qualification remain OPEN. Implementation is
uncommitted. No original game, worker or box has been launched for this task.
Evidence: `scratch/runs/20261116-gta2-worker-complete-confirmation/`.

The predecessor report is `5eeacc6c064cc207817d365b8ab30566e8c111b9`.
Its main baseline completed at 335/422/379/383 ms. Worker baseline stalled on
module recovery at 500 ms; its candidate ARM at 466 ms did not COMPLETE.
Independent expiry/signaling/quiescence were 507/508/509 ms. Both old endpoints
remain permanently closed. Exact inherited source pins and relevant binary
patches were retained before this task's edits.

Heavy work began only after explicit GL and Sims QI final releases, personal
hash/wait/PID/group checks and free locks. GL: 959 direct references, 166 process
and 65 thread waits with both EOFs, 176 PID/group absences. Sims QI: 2,635 indexed
artifacts, 487 actual waits with both EOFs, 684 PID/group absences. A temporary
handoff allowed the coordinator's remote preservation merge; its 14 actual waits
and both EOFs, artifact hashes and current PID/group absence were personally
checked. Heavy work resumed on published main c1ccb2eb3b8fa241ff688a622873d194a6f85806.
Foreign WIP, including guest-thread-host364bbcd1, is not adopted.

The controller now starts its independent deadline service before asynchronous
configuration IO. Confirmation and the original parent final checks overlap;
every check still joins before COMPLETE and physical DOWN. Event notifications
replace repeated polling. EOF/cancellation is checked again after confirmation.
A dedicated phase pipe retains actual observations if the watchdog kills the
child. After an independently delivered UP, a read-only original-renderer
witness records physical UP before the unchanged missing-schedule refusal.
The fixed 500 ms COMPLETE, 1,750 ms independent UP and 3 s aggregate limits
are unchanged, as are owner, nonce, process/thread generation, renderer,
source/module and physical-input predicates.

The independent child's loopback transport uses builtin HTTP/socket IO and
bounded buffered WebSocket text framing. It verifies the upgrade and refuses
invalid masking, UTF-8, continuation and control frames. It recovers and hashes
all current module wire bytes on every gesture; no native/module observation is
cached. Ordinary parent transport behavior remains unchanged.

The new owned verified-source-view preload validates each immutable Git blob,
keeps its bytes private, and records its SHA-256. Each final source-pin invocation
compares every immutable digest in that same verified view after freshly reading
and checking the preload's current and exact executed source provenance. Owned
mutable helpers, the preload itself, modules and run inputs always use fresh IO
and hashes; immutable-view identity changes and missing provenance refuse.
This removes repeated immutable source copies/hashes without removing a final
pin predicate. All original final-check invocation sites remain. The view is
prepared in a sealed transient memfd; source recovery is Git SHA plus exact
binary patches, never a source-tree or WASM snapshot.

Actual candidate progression:

- candidate-worker-1: first COMPLETE 453 ms. Next gesture's 3 MB module response
  arrived at 499 ms; no ARM/DOWN, independent expiry 505 ms. Permanently closed.
- transport-worker-1: COMPLETE 435/481 ms for the two modals. Third child
  confirmed at 473 ms but the parent's joined checks crossed 500 ms; no third
  DOWN. Permanently closed. This evidence motivated the immutable-view change.
- immutable-worker-1: four actual COMPLETE receipts at 232/366/235/204 ms;
  two personally reviewed visible native modals, public DOWN1/UP3, all physical
  keys UP and native ExitProcess(0).
- immutable-main-1: four COMPLETE receipts at 173/243/168/142 ms, same visible
  modals, public DOWN1/UP3 and native ExitProcess(0). An expired initial review
  was refused locally before a command; a fresh full capture was reviewed.

Every authored input above followed personal inspection of its current raw PNG,
backing, logical, displayed and public GetPixel evidence. Genuine native DLL
lifecycle evidence is retained. All completed fixture endpoints were closed and
actual child waits/both EOFs retained. Fixture native ExitProcess is distinct
from subsequent browser host teardown and does not qualify original GTA2 Quit.

Focused checks pass: 18 standalone authored controls, current source guards,
bridge/page/refusal models, actual preinitialization refusal controls, seven
real-socket transport cases and seven immutable-view provenance/fresh-input
controls. The actual compiled deadline service killed a blocked victim with
expiry/signaling/quiescence 501/502/504 ms and zero input requests.
Initial and final shared and HEAD-plus-whole-owned full flock builds pass.
The existing actual paired-controller protocol controls pass. In the actual
Worker stalled-parent-after-DOWN control, independent physical UP was witnessed
1,329 ms after DOWN while the parent remained blocked. Missing-schedule refusal
remained mandatory, followed by local replay/rebind/after-UNKNOWN refusal with
zero later wire requests. The complete main/Worker live fault checklist remains
OPEN.
After failure the test wrapper attempts replay/rebind/later requests through the
same terminal API and requires local refusal with unchanged actual wire logs.

Publication and original-game authorization remain OPEN until final builds,
focused controls and the complete published main/Worker native fixture and fault
matrix pass. No ARM-only, prototype, screenshot or host-stop result is treated
as qualification. No original attempt is authorized by these candidate results.
