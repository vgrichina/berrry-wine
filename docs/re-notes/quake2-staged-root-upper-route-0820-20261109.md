# Quake II staged-root repair and upper-route attempt, 0820

The concrete 0754 ENOENT is fixed in the exact run inputs and exercised through
the actual changed remote-parent invocation. Original guard/onward-door progress
was **not attempted**: the whole native fixture failed ordinary joined shutdown.
The first unexpected failure was terminal; no later input, capture or retry
followed. Evidence: `scratch/runs/20261109-quake2-staged-root-upper-route-0820/`.

## Concrete root fix and invocation evidence

This defect belonged to the run-specific `native-fixture.cjs` preload and its
`control.py` launch branch, rather than the tracked production caller. The
preload no longer derives its root from `process.cwd()`. The launch branch
passes explicit `QUAKE2_STAGED_ROOT` from the root whose full provider manifest
has just passed `native-startup-barrier.require`. Before opening the canonical
EXE, the preload requires an absolute root owning its own fixture path, a run
inside that root, and the barrier's exact root and manifest SHA. Missing or wrong
roots fail closed. The runtime root was `/home/user/q2-staged-0820`.

`offline-invocation.py` compiles the actual launch branch using the production
Q2 `Caller`, retains the generated replacement invocation of
`tools/quake2-native-launch-client.py --remote-parent`, and executes it from
unrelated cwd `/home/user`. The positive case reaches the composed fixture's
`DRIVER_PREFLIGHT` exit with `chromiumStarted:false`. Missing-root and wrong-root
variants fail in preload before Chrome. All three parents and remote-supervisor
children actually waited with separate stdout/stderr EOF. These offline tests
authenticate actual local provider bytes; they do not qualify frozen native
providers or claim original gameplay. The new runtime separately staged and
verified its exact frozen production closure. The prior ENOENT was not retried
inside its terminated predecessor runtime.

Recovery keeps Git base plus a small run-input patch, the zero production-source
patch, exact pinned-provider Git revisions, and existing media/module path/SHA
references. No tree, media or module archive was made. No tracked launcher/helper
needed modification. The run inputs are ignored evidence; this tracked note
records their recovery and outcome.

## Actual fixture, including the terminal shutdown blocker

The 723-provider closure retains caller
`1473c5952a52d5d2b4546b93a0d462b64fe5c6cd`, custody
`4341b87723a7d56bc98223215cca4cdc878fcae2`, reader `5bc5f86f9` integrated
in terminal repair `4ba9f3a1b08c11219c50023f4abffb3bf6c6f9cf` and the exact
historical host/Worker providers. CPU remains 2185596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Source-matched accepted reader/composition/PIPE/build proofs were reused rather
than rerun as separate qualification tasks. Production code did not change.

The actual retained PIPE caller launched the changed staged-root path. Chrome,
native keyboard/type/combo preflights, strict observation flags and the owning
Worker/module/instance/endpoint1/slot0 gates ran. PreCPU/preDLLmain records have
zero execution entries before release and NOT_ARMED native stores. The startup
capture identifies Worker target `D21BB504882C4F7CB7254CFA1A5B7688`, instance
`9b2ebd66-225f-4517-8b55-82eb991755bb:1`, and the exact CPU hash above.

I personally reviewed `startup.png`, `fixture-comma.png` and
`fixture-period.png`. They show the expected desktop/readme for the authored
idle fixture; they are not Quake II gameplay. Each 500ms key command explicitly
used `requireMotion:true` and `captureHeld:true`. Comma had four wholly-held
physical-high samples; period had three. All held passive/motion reads were
SNAPSHOT, both reverse key releases ACKed, fresh post-action captures showed
physical keys zero, and both numbered command ACKs succeeded. The fixture
initializes authored received-frame bytes in native code; this proves neither
original command consumption nor movement/contact/damage cause.

Ordinary quit then failed. The browser-close receipt records `closeRequest:ACK`,
a sent SIGTERM, Chrome terminal code0/signal null, drained true,
`elapsedMs:12113`, `capMs:19827`, and **normal:false**. The first browser terminal
record is **2026-11-09T08:21:53.772Z**, `abnormal browser shutdown; UNKNOWN; no
replay`; the caller then latched `owned transport failed: request-fixture_quit`.
There was no successful quit ACK. No cap was extended or SIGTERM result promoted
to ordinary success. The reason the close helper required escalation remains
unestablished; latency or a guest defect is not inferred.

Whole-fixture qualification therefore **FAILED**. Independent no-input caller
cancellation joined the existing owner; no original launch, route, game command,
gameplay PNG or later capture occurred. The next concrete blocker is ordinary
joined quit through this actual caller, before any original upper-route attempt.

## Retrieval and final lifecycle

The exact Redline0756 UUID `69ce5bd6-8e7d-4300-a29a-4f0bd7715acf` ARCHIVED
PHYSICAL_DRAINED release and stop `stop_f4cdb22d404ad552` completed
08:08:42.905Z were checked before create. One box only: **bx_wckgsd9r**, UUID
**c9b59dc4-de93-4b60-851c-509654899ca9**. The observable independent immutable
watchdog was prearmed before create, with 25-minute deadline **08:43:19.195Z**.
Create returned TTL1493 and initial expiry/archiveAfter **08:43:18.904Z**.

All **79 remote regular-file rows**, **57 newly stored unique contents**, were
retrieved and independently SHA/size reread before archive. All **11 remote gzip
rows** passed GNU gzip CRC and independent decompression/hash. Kernel custody
records **171 owned / 171 actual reaps**, complete true and command-log EOF true,
with no remaining/unreaped/unresolved entries. Both remote supervisor and caller
parent actually waited1 with separate stdout/stderr EOF. Local caller children
actually waited -9,0,0,1,0 with separate EOF; the retained controller waited1.
These are failed-run cleanup receipts, not normal qualification.

Ports **37903/33145** were closed, profile writers empty and runtime/input locks
free. The profile directory remained. Physical absence supports this census and
never replaces actual wait evidence. All-writers/nonleader coverage and lifetime
edict ABA remain UNKNOWN; native lifetime remains REVOKED.

Final state **ARCHIVED**, stopped **08:22:50.540Z**. Receipt
**stop_f07c5c431fca7a35**, completed **2026-11-09T08:22:50.631Z**, forced false,
error null. Final archiveAfter is null; expiresAt was not returned. The independent
watchdog and lifecycle supervisor actually waited0 with separate EOF. The local
runtime lock was released and PHYSICAL_DRAINED posted at 08:23:16Z. A local
reporting attempt used a nonexistent `completedAt` field; it was corrected to
the actual `endedAt` field without any runtime retry.

Outer logs were gzip drains from first byte. Final local verification includes
PNG chunk CRC/decompression, retained source/provider pins and reused proof
hashes. Free /home stayed above 1.5GB. No agents/workers, peer/shared host/custody/
WAT edits or public deployment occurred; Heroes II and Claude were untouched.

The 0635 damage cause remains UNKNOWN. No blind descent, crate-side turn, ladder
or Space assumption was attempted. Received-frame origin/velocity/raw flags
SNAPSHOT is not contact, consumption or cause; no flag names are invented.
Single-task STOP.
