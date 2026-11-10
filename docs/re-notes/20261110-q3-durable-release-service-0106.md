# Q3 durable release service

Evidence: `scratch/runs/20261110-q3-durable-release-service-0106/`.
Prior cause: [startup deadline attribution](20261110-q3-startup-deadline-cause-0053.md).

The Q3-only authenticated custody adapter now drains ready kernel stops before
releasing queued tasks. One ordered durable journal prefix can authorize a
cohort of already-consumed stops. The shared custody provider remains unchanged.

Every identity, lineage, consumed wait, retirement, release intent, cancellation
and error record is required before the next actual CONT. Only results of
already-authorized releases (`ptrace-cont-returned`, `parked-child-release`,
`parked-child-release-pending`) may remain behind that durable frontier. They
remain in the same bounded ordered journal, become durable with the next
required prefix or final close, and are never dropped. Saturation still applies
synchronous backpressure. A prior storage error always rejects release, even
when a cohort was previously certified. New required records after saturation
cannot inherit the preceding batch's certification. Gzip footer and final
durability remain mandatory.

The ready-stop scan retains creator/terminal priority, PID/start checks,
nonleader exec transfers, and actual wait obligations. Command-output service
still yields to ready kernel stops and queued resumes. Runtime, cleanup, image
and protocol deadlines are unchanged. No guest calls or writes were added.

Focused controls compare the prior adapter recovered from exact Git commit
`2bc65ee74e5a5726a58a86ea1a390f6ec1e3d185` with the changed adapter. They observe
successful real fsync completion separately from readable OS-cache bytes before
every actual CONT, require the durable prefix through all required records,
and require final journal bytes to equal every observed record in order.
Real Node fork traffic, unlinked irreversible exit, nonleader exec transfer,
pending-lineage cancellation and superseding exec are exercised. The generated
consumer controls use real Node children and ptrace custody under slow storage;
refusal, socket loss, synchronous send failure, withheld acknowledgement and
storage failure retain actual parent/adoption waits and separate pipe EOFs.
The storage-failure supervisor stays rejected even after its killed descendants
are independently drained; those later waits do not make a failed journal valid.

The first full consumer suite incorrectly compared total wall time, including
the unchanged 20-second cleanup grace, against a startup-performance threshold.
The corrected suite measures startup through the deliberate pre-navigation
refusal. Original failed logs are retained. An initial unlinked-exit probe
expected gzip although the reused fixture deliberately writes plain NDJSON;
the probe now handles both formats. Production failures and invariants were not
waived.

Repair `7607cab84` was committed with six explicit paths and immediately
published on main using strict SSH. The final compressed-output generated
consumer suite passes all eight cases. With injected 40ms storage latency,
startup through the deliberate pre-navigation refusal fell from 5.731641s to
3.542586s (38.2%); synchronizations fell from 65 to 48. Total wall time,
including the unchanged cleanup grace, fell from 28.316s to 25.517s. The
withheld reply still uses the unchanged 20-second protocol timeout and the
existing peer's separate 35-second exit cap. No later protocol/input/capture,
navigation or quit crossed a terminal boundary.

The final 20-child Node pressure control used 122 versus 87 synchronizations
and 9.455s versus 6.921s under injected 25ms service plus shared-host load.
The same worker's required-prefix, full final-byte retention, sticky storage,
footer, saturation, actual terminal/lineage/exec, command-output preemption,
generated-caller and retained-cause controls pass. Forty existing custody
regressions also pass; their standalone subprocess fixtures still load the
unchanged shared provider, while the new direct fixture controls explicitly
bind the changed adapter in each subprocess. The final locked build passes.

Exact source recovery is Git plus the small owned patch, not a source archive.
Native closure preparation independently reread all provider SHA/size pins at
each of five phase staging locations. The selected module remains the existing
`build/wine-assembly.wasm`, 2,186,068 bytes, SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.

The one changed native control passed on the new box. The accepted red-triangle
fixture was individually model-reviewed before its single Enter input; the
second reviewed image showed the expected 80-pixel translation. Planned owning
cancellation then drained 240 owned tasks through 240 actual reaps with zero
remaining tasks and separate command EOF. The generated, prelaunch and runtime
parents have actual wait receipts. This exercised the changed published service
and unchanged fixture acceptance mechanisms.

The conditional original reached a usable Q3 Arena main menu under the unchanged
startup image allowance. Its exact 137,030-byte PNG was model-reviewed before
one native Enter hold of 150ms. Native key-down/up acknowledgments and two
wholly-held physical Enter samples were recorded. The next individually
reviewed image still showed the same main-menu selection; logo animation alone
changed. This first live nonresponse triggered immediate owning cancellation.
No later game protocol, input, capture, retry, quit or deadline extension was
issued. Arena movement and firing were therefore not attained. The result does
not establish whether the guest ignored the key or had not yet handled it.

The original drained 170 owned tasks through 170 actual reaps, zero remaining,
with separate command EOF and actual generated/prelaunch/runtime waits. The
native service logged 503 synchronizations totaling 0.603s for the changed
control and 342 totaling 0.567s for the original. These native figures describe
this run; differing host conditions prevent attributing their entire difference
from the prior run to the repair. The matched slow-storage generated-consumer
comparison above supplies the causal measurement.

The input wire contains exactly the two successful input requests. General
protocol observation is bounded and its transport recorder saturated; the
separate execution-boundary stream is empty. Consequently it is not an
exhaustive protocol transcript. The published cancellation-file guard executes
before every native send regardless of recorder state. The owning command
stream contains the one input and cancellation sentinel, and there is no later
image or input. These distinct evidence scopes are retained without treating
missing observations as observed events.

All 138 unique remote artifacts (157 regular-file references, 3,785,079 unique
bytes) were recovered before stopping. A separate process independently checked
every unique SHA-256 and size, all recovered gzip streams, and PNG chunk CRCs;
a second remote inventory matched. Four actual images were individually
model-reviewed. Existing media was referenced by path/hash, not duplicated.

The local outer allocation transport wrapper terminated with status 143 for an
unknown reason and did not write its own wait receipt. Its partial gzip stdout
is preserved as-is with its hash in `allocation-transport-interruption.json`.
This limitation does not replace the independently retained successful actual
watchdog wait (status 0, separate stdout/stderr EOF), the native parent waits,
or the independently observed completed stop.

Only box `bx_hsh4576p` was created. Before creation, its independent immutable
25-minute watchdog was armed and observed for UUID
`75868b71-c444-4f0a-85db-cf0dc699dfbb`, deadline
`2026-11-10T01:47:43.330530Z`; initial API expiry was
`2026-11-10T01:47:42.943Z`. After independent unique-artifact verification,
exactly one delegated normal unforced stop completed:
`stop_09d00d982cdc6042` at `2026-11-10T01:28:05.953Z`.
The independent final API receipt records state `archived`, expiry
`archiveAfter: null`, and stoppedAt `2026-11-10T01:28:05.937Z`.
The watchdog acknowledged the confirmed normal stop, exited with an actual wait
and separate EOF, and released its lifecycle lock. Prior stopped boxes were
untouched. No box remains live for this task.

The causal service repair is shipped. Any further Q3 menu/input investigation
requires a separate assignment; this single task ends without another attempt.
