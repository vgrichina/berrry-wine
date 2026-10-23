# Shadow Man diagnostic arming and module identity repair

Scoped offline correction of exact candidate
`6d145e98589caeab2d43c4bb54297d90c248b9de`, addressing independent review
`43a1d1d7b8c0418cdc1d61f646e2ea5150a318c4`. This corrects diagnostic
capture, not emulator modal/NULL behavior. The three WAT hook sources remain
byte-identical to candidate6d145e9. No canonical build, guest, Boat, browser,
GPU, runtime, merge, main/shared-index or donor metadata mutation occurred.

The corrected candidate is published on
`task/shadow-man-null-arming-identity-repair-oct23`; the exact commit and actual
remote verification are in the append-only repository messageboard and the
publication receipt under `scratch/runs/20261023-shadow-man-null-arming-identity-repair/`.
All source changes descend directly from candidate6d145e9, not current main.
Strict read-only remote main reconciliation returned
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. No fetch/archive was used.

## Corrected behavior

`test/run.js` assigns a monotonic one-based action sequence when each scheduled
input is dequeued. Both actual `dlg-cmd` sends consult the explicit
`Symbol.for('wine.shadow-null.selected-send.v1')` interface. The modal path
resolves its native modal HWND first; the other path completes renderer/slot
resolution and parent climbing first. The hook then validates the actual
instance, PID, runner identity, action, action sequence, actual batch, command3,
unsigned fresh resolved HWND and resolution path **before** invoking the actual
`we.send_message(dlg,0x111,ev.cmdId,0)`. No Wasm export property is reassigned.
With no preload/hook, the original send executes directly.

Instantiation does not arm. Startup, Configuration1024 and OK1 remain OFF and
cannot consume host or source quota. The selected final Beenden send is a
single synchronous window. Earlier sends pass through while OFF; at most two
returned `dlg-cmd` receipts are retained in host memory, then copied into the
arm receipt. Returned means the synchronous send returned, not proof that a
setting persisted or a particular screen appeared. Before diagnostic mutation,
arm synchronously retains a sealed/deep-frozen receipt containing the fresh
selection, prior returned actions, GPR/EIP state and diagnostic fields. It then
clears breakpoint, selects only decoded address0x004015d4, resets host counters
and calls `set_null_diag(1)` to reset/enable source counters in revised mode.

The selected-send callback must complete by synchronous terminal capture.
Return without capture, exception, quota/starvation, required-block failure or
retention failure is terminal failure. Rearm and duplicate/late selection are
rejected; wrong context/action/PID/runner/HWND/batch/command cannot send the
selected message. Captures remain immutable copies, synchronously written and
fsynced, followed by OS exit86. **Exit86 alone is not success.** A
`capture-failed` terminal or missing terminal receipt fails acceptance.

At most32 host event records are permitted, with one reserved for terminal
first-zero; the arm receipt is separate and does not consume event quota.
Source event33 still traps. Early callbacks while unarmed do not record or
consume host quota. The normal source default remains OFF. A first-zero record
is explicitly `ordinary-or-unknown; zero-writer unproven`. A legitimate
CACA0005 zero can end the window before the incident. A required-block policy
retains that observation but terminates with
`capture-failed: first-zero before required block`. This is never incident or
zero-writer evidence. Earlier Configuration saved locals are not recoverable
from this final-send window.

The preload hashes the named file, copies and compares the **actual compile
input bytes before native compilation**, and binds the returned immutable
Module in a private WeakSet. Instantiation accepts only that Module and one
context. Altered custom sections, other bytes, unbound Modules, byte-form
instantiate, Instance constructors, streaming forms and repeated compile or
instantiate contexts reject before the rejected context executes. Module
section boundaries are parsed to reject start sections before instantiation;
any import observer callback during instantiate is also a terminal failure.
The actual Module therefore derives from the bytes in its identity metadata.
This assumes the dedicated pinned runner and preload are trusted; it is not a
sandbox against hostile JS retaining original constructors/functions before
preload. No start-function compatibility is claimed or allowed.

## Complete helper input contract (no guest command executed)

A future authorized launch must supply the real corrected `test/run.js` as the
entry script, one `--wasm=ABSOLUTE_FILE` argument, and these environment fields:

- `SHADOW_NULL_PID`: exact target OS PID, established by the external launcher
  before exec; inherited child PID or worker-thread contexts reject.
- `SHADOW_NULL_RUNNER_SHA`: SHA256 of the exact corrected runner,
  `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
  Its resolved entry path must be this checkout's `test/run.js`.
- `SHADOW_NULL_OUTPUT`: absent exclusive output file in a retained destination.
- `SHADOW_NULL_SELECTION`: JSON with integer `actionSequence` (one-based,
  positive), `batch` (actual execution batch), `cmdId:3`, and `hwnd` (fresh,
  nonzero unsigned32). Choose these from fresh observable route evidence and
  the newly resolved launcher, after verified Configuration/OK. Test values
  sequence3/batch19/HWND8194 are synthetic controls. Historical HWND0x1001c and
  batch2578996 are not fresh-run constants. All scheduled actions count toward
  actionSequence; only actual `dlg-cmd` boundaries can arm.
- `SHADOW_NULL_MODE`: exactly `historical-pre-block` or `revised-first-zero`.
  Obsolete `SHADOW_NULL_UNTIL_ZERO` is rejected even if set to0.
- `SHADOW_NULL_BLOCK_POLICY`: `required` or `optional`, explicitly chosen.
- `SHADOW_NULL_WATCHDOG_MS`: integer1..300000, matching a finite **external
  process watchdog**. This is a declared launcher contract, not proof a watchdog
  exists; event-loop timers cannot stop synchronous Wasm. The external launcher
  must retain timeout/no-capture failure separately. No watchdog/guest launched
  here; native fixture children had actual5-second process timeouts.
- Revised mode additionally requires `SHADOW_NULL_REVISED_SHA`: exact named-file
  SHA of a separately built and qualified diagnostic module, distinct from the
  historical module. Historical mode enforces exact1,879,387 bytes and SHA
  `ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`,
  and uses no revised exports. No canonical module was available/executed here.

No competing trace/break/watch flags, `--spawned-child`, other selected-send
hook, alternate compilation/instantiation, propagated installer preload or
second context is permitted. The runner's ordinary wall/batch guards remain
useful but do not replace the external watchdog. There is no pause/rearm or
multi-phase capture contract. Coordinator must select a complete retained game
fixture/process; partial479-file VFS remains invalid. Prior successful OK and
fresh launcher selection require independent observable route evidence; two
returned send receipts do not establish those user-visible conditions.

## Durable tests and reviewed census

`test/test-shadow-man-null-capture.js` is discovered by the exact `.js` regex
and conventionally assigned unit tier. It runs the original capture fixture,
the maintained actual-source sender/modal-prefix fixture, and repair controls.
`tools/test-timeouts.json` registers75 seconds; each of three child suites has
an actual20-second process watchdog. Each preload control has5 seconds.
No global discovery regex/tier convention was changed.

Only four census entries were corrected using the explicit reviewed
`reconcile-census.cjs --apply` workflow. Existing entry order and all unrelated
entries/reasons remain intact. Three existing reasons are extended; one new
read-only token getter is added. No baseline dump/regeneration or gate bypass.
`census-reconciliation.json` retains individual before/after identities and
lifetime reasoning:

- `$run`: first-zero before last_run_halt/enclosing restoration, saved fields
  N/A; legitimate CACA0005 reaches it. No writer provenance or ownership proof.
- `$wnd_send_message_inner`: pre after caller save/child allocation and before
  callback frame; event2 before depth/token checks and restoration. Token is
  current child, not proven modal owner. Scripted abandonment and OFF controls.
- `$win32_dispatch_inner`: event3 after teardown/reentry and sentinel adjustment,
  before current-frame consumption; event4 after previous pump/EIP/ESP restore,
  before ended reset. Saved ESP denotes consumed frame, not original API entry.
- `export:null_diag_token`: synchronous read-only invocation_current getter;
  copying its signed64-bit representation does not acquire/retain ownership.

All retain `ownership:pending`. Scoped scan/check covers30 direct producers in
three unchanged WAT fragments; restoring the old ledger rejects exactly the
four reviewed entries. Complete closure and transitive exported-wrapper
reachability remain **PENDING**. Pinned scanner sourceFiles visits root JS and
lib JS, not test/run.js; no invented host-file entry was added for that runner.
Full census/manifest checks were not run against an incomplete tree.

## Evidence and exact verification

Evidence directory: `docs/re-notes/shadow-man-null-arming-identity-repair-20261023/`.
`checks.json` records actual argv/env/cwd/exits and stdout/stderr files.
Main commands, all exit0:

```
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-null-arming-identity-repair-20261023/run-checks.py
node --check test/run.js
node --check tools/shadow-man-null-capture.cjs
node --check tools/shadow-man-null-preload.cjs
node test/test-shadow-man-null-capture.js
node docs/re-notes/shadow-man-null-arming-identity-repair-20261023/old-controls.cjs
node docs/re-notes/shadow-man-null-arming-identity-repair-20261023/check-scoped.cjs
```

The wrapper uses recorded env overrides to execute the existing donor compiler
in place and retain outputs in this evidence directory. Compiler identities and
footprints are in admission.json. Its installed parser differs from the missing
candidate compiler blob; this is an explicitly identified focused test tool,
not a claim to have qualified the candidate's full vendored compiler provenance.
Original902-byte fixture SHA256
`f45414f005d33707d05e0a16d9abf6d77f2ddce5aa00ddcddc73551e68e500dd`;
actual-path3394-byte fixture SHA256
`5b874002a970b97d246408739811bd1802a8c31a6dc2357973579ce67c55f8ab`.
Both have fixed128-page initial/max8MiB linear memory, no guest/heap allocation.
WAT/binaries/source extraction and exact commands are retained for recovery.

`repair-tests.json` records normal success exit86 and all rejecting argv,
input/submitted-byte hashes, reasons, stdout/stderr/output, limits and explicit
no-continuation checks. Altered custom-section module, substituted bytes,
unbound Module, alternate forms/constructors/streaming, repeated contexts,
wrong PID/runner/hash, conflicts, child and exclusive-output controls exit1;
missing exports exit86 with capture-failed. Immutable bytes/retention failure,
quota/starvation, late/duplicate/wrong action/HWND/context and required-block
failure are also checked. VM execution of the exact runner branch covers
modal resolution, renderer parent climbing, slot fallback, absent dialog and
default-off send. A deliberately late adapter causes the actual ordering
oracle to exit1, retained in `late-arm.stderr`.

`old-candidate-controls.json` reuses the review's read-only original fixture and
negative driver with the exact old helper SHA. Eager startup zero and altered
custom-section module both falsely succeed at exit86; each updated-contract
assertion actually exits1. The corrected normal control still succeeds and
the altered-module control now exits1 before compilation/instantiation.
These are real rejecting controls, not re-labelled old success receipts.

The native fixture executes the full actual sender body and exact modal
sentinel/completion prefix, CACA0005 branch and zero predicate with scripted
dependencies. It covers OFF caller restoration,64-round abandonment, teardown
mutation ordering, old32-event starvation, and corrected OFF Configuration/OK
plus40modal completions before selected-send reset/legitimate-zero capture.
**Actual full handler / full module / actual canonical export compatibility:
NOT EXECUTED.** Source export declarations are not an actual module inventory.
No guest continuation/writer, performance, persistence, Play or gameplay claim.

## Remaining prerequisites and resources

Before any separately authorized diagnostic build: materialize and measure the
complete exact include closure rooted at src/main.watx, compiler provenance,
mirrors/baselines and full tests; obtain a new admission allocation. Run the exact
candidate build prerequisites preserved by review43a1d1d in pinned-build.sh,
including full callback census/transitive exports, test manifest/timeout gate,
manifest/fragment checks, memory/region/layout gates, API/dispatch/handler/import
and compiler provenance gates, then include-ordered paren/label checks. The
review report lists these in script order; none is waived by scoped tests.

After cheap gates and separate authorization, compile with the vendored WATX
compiler only, check data overlaps and validate new distinct module size/SHA,
start-section absence and actual imports/exports. Required common exports are
nine get_GPR/EIP getters, guest_read8, set_bp and set_trace_eip_range; revised
mode additionally needs set_null_diag/null_diag_field/token/root. Compare to
historical canonical inventory when available. Qualify actual interpreter,
sender/modal handler paths and pinned runner topology; then a new coordinator
runtime assignment must supply complete retained fixtures, fresh successful-OK
and launcher evidence, selection and external watchdog. No build/runtime is
authorized or inferred by this report.

Measured manifest **before checkout** projected28,851,715 bytes including Git,
source,12MiB test/evidence/temp growth and8MiB reserve, inside64MiB. Host
post-projection free exceeded2,982,150,144 bytes. Installed executables/compiler
ran in place with standing identities/footprints recorded separately; read-only
donor is separate. No copied/installed executable or links. Missing focused
baseline blobs were later copied by exact existing object identity into this
task's own Git only (15,748 uncompressed bytes); initial narrow diff inability
and repair are recorded in baseline-object-materialization.json. Final measured
accounting and evidence seals are in publication.json. Initial fixture controls
were adjusted for reserved terminal quota and missing-export setup; retained
final checks reflect corrected assertions, not a guest/source behavior change.

No test box assigned or contacted. bx_fn7pn7yg remains coordinator-reported
snapshot STOPPED (stop_428de72b6f35166b,03:03:34.606Z; historical expiry
2026-10-23T03:46:00.580Z), unprobed here. Coordinator retains lifecycle ownership.
Parallel Codex ShadowMan/POSITIONT/RichEdit, Claude B&W2 and laptop games remain
untouched. One bounded repair complete; no workers/refill or further assignment.
