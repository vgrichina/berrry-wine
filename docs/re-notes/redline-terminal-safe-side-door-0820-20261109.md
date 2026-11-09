# Redline terminal-safe side-door task — 2026-11-09

Evidence: `scratch/runs/20261109-redline-terminal-safe-side-door-0820/`.

**Stopped at the first concrete offline blocker: the tracked native fixture
does not execute the production caller. No box, original launch, input or
gameplay capture was created. Side-door entry and driving remain unverified.**

`tools/redline-native-fixture.cjs` imports the joined shutdown helper, creates
its own Chrome child, WebSocket, pending-command map, CDP send function and
Worker inventory, then invokes `tools/redline-startup.cjs` directly. It never
loads or launches `tools/redline-browser-run.cjs`. Its terminal guard belongs
to `createLifecycle`; the production caller's `closing` guard is separate.
Consequently, adding caller `2045a98ee7695bd031392dc16965be2eaed0882c` to the
provider manifest verifies its bytes but does not exercise that caller's
terminal behavior or shutdown. A fresh whole-native fixture PASS would still
leave changed-caller native coverage UNKNOWN. The predecessor's 180 actual
reaps cannot fill this gap.

The production caller's `NO_ORIGINAL` route also returns before its startup
helper call. Running that route would not establish the required actual
owning Worker/module/instance/endpoint/slot and pre-CPU/pre-DLLmain behavior
through the production caller. This task does not substitute that preflight
for the requested native integration or launch original to discover the gap.

Offline inspection prepared the exact 735-provider closure using current
bytes and recorded the Git base plus relevant binary diff. The production
caller matches the published 2045 commit byte for byte. The selected private
CPU remains 2,185,596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Both tracked fixture and shutdown helper are pinned and source-matched to the
accepted predecessor inputs. Eight input/capture helpers and accepted proof
references were reread and hash/size checked. The unchanged startup refusal,
retirement and terminal-boundary composition, shutdown inert-child proofs,
and locked-build proof are reused; no duplicate qualification is run and no
current native PASS is claimed. Inspection itself passed with an actual
exit-0 wait and separate stdout/stderr EOF.

No production or shared provider was edited. Native lifetime remains
REVOKED; all-writer coverage and edict ABA remain UNKNOWN. Quake II 0820's
allocation/release gate was not crossed. This task's box ID, UUID, expiry and
stop receipt are null, state NOT_CREATED; no watchdog or physical drain is
claimed for a nonexistent box. The predecessor box remains only historical
evidence, not this task's runtime. Q3 must still respect any active Q2 runtime.

Next work is to make the tracked native sequence exercise the actual
production caller and its joined shutdown before original launch, while
preserving the current terminal boundary and caps. Then require a fresh whole
native PASS before personally reviewing original living pixels. The shipped
Readme route remains comma/period lateral movement around the rear corner,
walking into an identified side door, changed vehicle HUD/camera, then short
terrain-relative driving. No blocked forward holds or displacement inference
from native key high bits occurred here.

An initial local wrapper invocation omitted its label/command arguments and
raised IndexError before creating any process or evidence file. The corrected
owned wrapper ran inspection once. No native invocation or retry occurred.
Git remains the source archive; no source/media/module archive was created.
Free `/home` stayed above 1.5 GB. No agents, workers, public deployment,
Heroes II or Claude changes. SingleTaskSTOP.
