# Redline production fixture and side-door attempt — 2026-11-09

The actual production native fixture failed at the first comma hold. Original
Redline, period, ordinary quit ACK, side-door entry and vehicle driving were
not reached. No input, capture request or retry followed the terminal failure.

Offline staging corrections were implemented in
`scratch/runs/20261109-redline-production-side-door-0856/control.py` and
`prepare.py`: supply the immutable `BROWSER_DEADLINE` to the tracked fixture,
include `redline-production-fixture.cjs`, and stage the current run's helper
paths and unchanged observer. The 744-provider closure uses committed custody
`c443739b5e27d85fe434d54cd3e4c45eb51fc833`, after its exact completion/release
entry. Its bytes were compared with Git; no custody WIP or pin relaxation was
used. The actual generated invocation passed offline execution with inert
supervision, and the production caller's closure preflight passed without
creating Chrome. Six focused retirement-service dependency tests and the
locked build passed. Exact-source accepted production composition, startup,
input and custody proofs were referenced and hash-checked, not requalified.

The one fresh native run executed `tools/redline-native-fixture.cjs`, which
launched `tools/redline-browser-run.cjs`. Parked preCPU/preDLLmain admission
authenticated selected CPU `a320d4c8…`, owning Worker/module/instance/endpoint
and slot. Startup and its bound capture completed. At 08:59:42.547Z the first
numbered comma command failed with **input delivery exceeded hold bound**:
the key-down response completed after the independent 600 ms release timer
had fired. The existing helper attempted release and rejected the action.
There is no successful hold receipt, high-read/release-zero qualification,
comma capture ACK or whole-native PASS. Underlying delivery latency is not
explained by this observation. Caps, identity semantics and observation flags
were unchanged. Native lifetime remains REVOKED; all-writer coverage and edict
ABA remain UNKNOWN.

The controller actually waited caller exit 1 and its independent watchdog
exit 0, with separate stdout/stderr EOF. Production cleanup actually waited
Chrome exit 0 and stream EOF. This is failure cleanup, not ordinary quit ACK.
Custody finished with 185 owned tasks and 185 actual reaps, no unresolved
lineage/waits, complete command EOF and durable gzip footer/hash evidence.
Independent no-input inspection found both ports closed, no owned survivors,
profile or writer locks. These physical observations are separate from waits.

Box `bx_3znvnq3n`, immutable allocation UUID
`df37f243-b2f7-49d8-88ab-db02200d6141`, had initial expiry
`2026-11-09T09:23:31.444Z`. The independent 25-minute deadline watchdog was
observably armed before create. All 43 unique artifacts were retrieved and
independently SHA/size verified, including eight gzip CRC checks, before
delegated normal shutdown. Stop receipt `stop_cae2ca113a71a867` completed
without force at 09:00:38.924Z; state **ARCHIVED**, **PHYSICAL_DRAINED**.
The allocation watchdog also actually exited 0 with separate pipe EOF.

Evidence and gzip-first-byte logs are in the run above. Recovery uses Git base
`c443739b5e27d85fe434d54cd3e4c45eb51fc833`, the small relevant binary patch
(including untracked `lib/wininit-boot.js`) and owned run-input patch. Existing
media and selected module are path/hash references; no source/media/module
archive was made. Free `/home` stayed above 1.5 GB. No shared host/WAT/custody,
Heroes II or Claude edits, workers, agents, public deployment or local browser.

Next work is an offline diagnosis of bounded native key delivery before any
separately authorized native attempt. This task stops at the first concrete
runtime blocker. SingleTaskSTOP.
