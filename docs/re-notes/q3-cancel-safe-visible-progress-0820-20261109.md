# Q3 visible gameplay: current caller lacks the required native startup gate

The first concrete blocker was found offline in the exact current Q3 browser
composition. Its native fixture executes guest CPU before authenticating its
owning Worker module. Its original route navigates directly to
`app=quake3_demo` before the owner authentication. Neither supplies the required
parked preCPU/preDLLmain Worker/module/instance/endpoint/slot admission. No box,
native browser or original was started, and no gameplay consequence PNG exists.

Evidence: `scratch/runs/20261109-q3-cancel-safe-visible-progress-0820/`.
`native-caller-gate.log.gz` records the composed-source hash, exact provider
references, fixture hashes and source positions; the check compiles the actual
composition and verifies the ordering in its actual original and fixture paths.
The actual check process has an actual wait0 and independently observed stdout
EOF in `native-caller-gate.wait.json.gz`.

The retained consumer's `LOCAL_PRODUCTION_FIXTURE` path does execute the current
Q3 composition, unlike an unrelated standalone native fixture. However, its
`generated.cjs` starts a GuestWorkerLink, calls `load_pe`, then executes public
x86 GL calls through `call_func`/`run`. It publishes `__generatedReady` only
after those calls. The caller awaits that readiness and invokes
`local-controls.cjs`, which then retrieves the Worker module hash. That proves
post-execution identity, not the required pre-execution admission. The normal
route likewise sends `Page.navigate` with the selected Q3 app before readiness
and `chain.establishReady`. The composed source, generated fixture and controls
contain no parked startup admission. Existing late module observations and
matching provider pins cannot move these boundaries earlier.

No provider or custody fix was made. Repairing this requires integrating a
parked startup admission with the actual Q3 caller and generated fixture,
including authentication before PE/DLL guest execution and release only after
an unchanged live Worker/module/instance/endpoint/slot check. That changes
providers the task expressly forbids editing. Substituting the standalone
Redline fixture, weakening the native gate, or treating inert Node controls as
real-browser proof would not satisfy the task. This is a concrete implementation
blocker, not a request for a separate acceptance/publication task.

The selected launch client and remote-cancellation test exactly match published
`623aebabeec8a501a4990a6a888f2ff769283ddb`; the composer and strict prelaunch retain
`36d5529d2e`'s propagation integration. The eight actual generated-parent
cancel/control cases and focused launch-client/prelaunch/locked-build evidence
are reused by source match and independent SHA256/size/gzip-CRC reread, without
rerunning or copying the proof. The fresh local strict prelaunch passes with
928 canonical providers; the actual browser composition compiles. Relevant
tracked build/Q3 source has no uncommitted diff. The only subsequent tracked
code changes from623 are unrelated Redline caller/tests.

Current native custody SHA256 remains
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`;
CPU remains2185596bytes, SHA256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
marker remains
`1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d`.
All caps are unchanged. Native lifetime is REVOKED; allwriters and edictABA
remain UNKNOWN. Historical0052's SIGPIPE cause,33 missing waits and
commandEOF:false remain UNKNOWN. No physical absence is used as missing-wait
proof.

A run-local Boat cancellation controller and small inert runtime were prepared,
using the actual retained caller branches, current generated remote parent,
strict prelaunch and current native supervisor. They were never dispatched.
Actual Boat cancellation delivery, generated-parent joins and native child
wait/EOF on Boat therefore remain UNKNOWN. The accepted eight local controls
and publication alone do not upgrade them. The original was never admitted;
there was no later input, capture, ACK, runtime retry or deadline extension.

The board-only runtime queue was respected. Redline0820 posted explicit
`NOT_CREATED STOP`; Q20820 had acquired UUID
`c9b59dc4-de93-4b60-851c-509654899ca9` and had not released it when this task
posted its own `NOT_CREATED STOP`. No peer box was inspected or modified.
Own box ID/UUID/state/expiry/stop receipt: NONE / NONE / NOT_CREATED / N/A / N/A.
No create was attempted, so no runtime watchdog, physical-drain or native-wait
receipt is invented. The local board watcher and inspection commands are joined
with actual waits and separate EOF observations.

Recovery records the exact Git base plus small relevant/owned input patches;
Git remains the source archive. No source/media/module archive or repeated
media/module copy was created. Logs are gzip from first byte. Final evidence
is reread for SHA256, size and gzip CRC. Free `/home` remains above1.5GB.
The run-specific dashboard schema/containment check passes with no missing
artifacts. The repository-wide checker reports22 preexisting containment errors,
800 missing references and127 invalid records; none belongs to this run.
No shared host/custody/WAT/provider, Q2, Redline, HeroesII or CLAUDE edit,
agent/worker launch or public deployment occurred.

Next implementation work is the missing native startup gate in the actual Q3
caller. Gameplay remains unverified. This single task stops with the offline
blocker and its evidence preserved.
