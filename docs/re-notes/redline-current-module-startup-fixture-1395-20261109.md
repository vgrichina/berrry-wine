# Redline explicit current-module preparation and sole fixture, 1395

The actual historical preparation refusal is fixed by an explicit new-version
preparer, `tools/redline-current-module.cjs`. Historical preparation still
refuses the changed modules. The sole newly authorized native fixture failed
at startup, before input or capture; its cause remains UNKNOWN. No native retry,
period, original game, local Chrome, shared-client or custody change occurred.

Prepare a fresh destination with:

```
node tools/redline-current-module.cjs --prepare NEW_RUN
```

This declares `redline-1395-published-rep-1f3bd16c1-v1`, rather than claiming
the historical module. It first authenticates the complete 1235 manifest by
SHA-256 `f9b83cc89a0dd470f3d3f97846dfcf39b498fcb779e1a46de1a345006076f3ff`.
The original file is never written. Every historical provider must still match
its size and hash except these three explained published REP changes:

| Provider | Replacement SHA-256 |
| --- | --- |
| `src/05b-string-ops.wat` | `bc5e1c338a7a3aacc49d4d52bf4357bc9e2e71e3bbd5457b7093a91d01c80edb` |
| `build/wine-assembly.wasm` | `d5dd33faadee5a0f77ac35347ecf0e4efe5efc86d92b03ef45ffe5adee83aea0` |
| `build/wine-assembly.compat.wasm` | `a5d7569b2315787832b7e1e720aca05e4de8012c809ac7a7e7896a29452d057f` |

Every published source and compiler input under `src/`, `tools/watx-src/`, and
the compiler entry points must match Git `1f3bd16c1`. That commit must be an
ancestor of both HEAD and origin/main. The locked build reproduced the exact
two module hashes. Unexpected provider/source changes, altered historical pins,
or mismatched source/module versions refuse before destination creation.
Historical HTTP pins are checked against historical file pins, then updated
from the validated replacement file pins. This prevents a fresh module from
carrying a stale HTTP resolver identity.

Only the preparer signatures in native-trace and startup-boundary forward the
explicit `currentPublishedModules:true` option. Their default validation remains
strict. The new entry point records historical identity, declared module
version, published module commit and before/after/reason for all three changes;
then seals the complete 895-provider manifest by hash and makes it read-only.
The seal existed before allocation. Existing local/remote content barriers and
the actual generated caller validate these fresh pins before launch. The new
helper is pinned too. Run inputs are six small references to retained providers;
no media or module archive was copied into evidence.

The actual preparer tests show old FAIL/new PASS. Seven negative controls cover
historical-manifest tampering, old source with new modules, tampered module
with published source, unexplained host provider and source changes, unknown
options, and refusal to reuse a destination. Every refusal leaves its fresh
destination absent. The successful case verifies every generated file and HTTP
pin, original-manifest preservation, read-only mode and seal hash. Published
`14475fc9f` and current generated caller, startup diagnostic caller and single
comma fixture are byte-identical. The startup consumer still has 100 waits /
101 stat attempts; immutable deadlines, ten-second trace flags, independent UP,
capture ACK and ordinary joined quit remain unchanged.

Focused tests, no-launch actual-caller preflight, composition check and
`flock /tmp/wine-build.lock bash tools/build.sh` passed. The latter has an
actual wait and separate stdout/stderr EOF record. Existing 1355 startup and
whole-controller proofs and 1325 cleanup proofs were reread by SHA-size and
referenced, without another qualification experiment.

Before allocation, a fresh API read verified predecessor `bx_8w34tbhg`, UUID
`25fdf3f2-f616-4e3d-a301-b9d496c0a624`, archived with completed unforced
`stop_cc4d683a58df369d`; the board records PHYSICAL_DRAINED. A new immutable
25-minute UUID plan was then protected by the retained independent observable
watchdog, whose process identity, heartbeat and plan hash were checked before
the sole allocation. The runtime lock was held through its actual join.

New runtime `bx_rfgz429k`, UUID `5adf5b34-c76e-447d-b734-996cfe43bfd0`, was
created at `12:59:13.182Z` (create response; later API gives `12:59:13.036Z`).
Initial API expiry was `2026-11-09T13:24:02.050Z`. Provisioning and remote
895-provider barrier passed. The one actual startup-boundary `--fixture`
invocation selected comma600 and ordinary quit; neither command was reached.

The first actual terminal was `2026-11-09T13:00:25.011Z`:
`DevToolsActivePort unpublished after 100x100ms poll`. The retained readiness
diagnostic has 100 existing poll results, 101 ENOENT stats, zero reads and
10,349 ms elapsed. There was no input, capture, ACK or retry. The diagnostic
does not identify native Chrome cause. The fixed ten-second trace was not
flushed; trace retrieval refused to claim a valid boundary. Browser actual
wait reports SIGKILL, stream EOF false and streams truncated. Both malformed
Chrome gzip files (10-byte incomplete stderr and zero-byte stdout) retain
their exact bytes and explicit INVALID / EOF false status.

The enclosing custody supervisor additionally returned nonzero for an
unresolved kernel lineage: PID 8107/start 33709, autoattach stop, unknown parent
custodian. This is retained as `kernelComplete:false` and
`kernelForkLineageComplete:false`, despite all 81 recorded owned processes
being actually reaped and no remaining/unreaped/ptrace/resume entries. The
strict published 1325 cleanup correctly refused this incomplete receipt. Its
refusal is preserved. A narrow filesystem-only salvage used the published
1325 decoder, independently verified recorded process identities were gone,
checked profile/root process scans, port 45937 closed, no writer locks, and
removed the drained profile after retaining its file inventory. It did not
alter custody or promote completeness, EOF, trace validity or fixture success.

Published 1325 retrieval then collected 34 files / 32 unique SHA-size pairs.
An actual reread verified them, gzip CRC for valid artifacts, explicit INVALID
for both malformed logs, original journal/command hashes, 81 actual reap rows,
caller/watchdog actual waits and their separate stdout/stderr EOF, browser
actual wait and its failed EOF, and local/remote command waits. Large logs and
JSON were compressed before transfer. Proof commands were recorded before
execution; no proof files were renamed. Collection success is not browser EOF
or native fixture success. The initial filesystem inspection label collision
occurred before its remote command and is retained alongside the corrected
inspection; it was not a native replay.

All unique evidence was retrieved and verified before delegated normal stop.
Unforced `stop_c6f706024295cebc` completed `2026-11-09T13:03:19.518Z`.
A final exact-UUID API read confirms ARCHIVED, `archiveAfter:null`, and
`expiresAt` NOT_RETURNED. The watchdog and lifecycle supervisor actually joined
with code 0 and separate EOF; the runtime lock was released. The board releases
the drained runtime for queued Q2 1405 while preserving lineage/EOF limitations.

Evidence is `scratch/runs/20261109-redline-current-module-startup-fixture-1395/`.
Recovery uses recorded Git base plus small binary patches for relevant owned
source and run inputs, retained historical providers, and pinned media paths
and hashes. Git is the source archive. No source tree snapshot, media/module
evidence copy, deployment, worker, shared-client, custody, host, WAT, Q2/Q3,
Heroes II or CLAUDE edit was made. Free `/home` remained above 1.5 GB.

Next: separately scope the observed native startup failure and incomplete
kernel lineage. This task authorizes no further native attempt. SingleTaskSTOP.
