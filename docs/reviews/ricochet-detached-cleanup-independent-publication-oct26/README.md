# Ricochet detached transport: independent offline acceptance

Accepted candidate `4ffa995ba8a8bda59399960182ace17e8c4e3c01` on this task
branch only. **Main publication is forbidden in this assignment.** Integration
and actual Ricochet gameplay remain separate, unqualified gates.

The exact production helper is SHA256
`b4fe820ca51edab45ace65371a4561442f5ee6ecf165920b426ce5206d155336`.
`pinned-inputs.json` binds its Git blob, all seven selective files, and the
unchanged rejecting reproducer. Source was copied from the verified local donor,
checked against the immutable commit's blobs, without broad checkout or assets.
The production path is read.readfile → work.read_executor → SubprocessExecutor.
Only the final argv factory substitutes offline Python; real Boat argv remains
checked as data. No Boat command is executed.

The first behavioral group ran unchanged accept.py/local_transport.py against
that path. Both held-pipe and setsid cases have rejectedCandidate=false; both
child identities are absent, including zombies. Exit status alone was not used
as the oracle. The unchanged reproducer retains its historical candidate label;
acceptance-checkpoint.json identifies the actual candidate tested here.

The independent stdlib ownership fixture passed seven cases: setsid, double-fork,
early parent exit with a nonvacuous child identity, live parent at deadline,
successful metadata responses leaving detached children with closed output
pipes, caller cancellation, and caller exit. Transport identities must disappear
before outer fixture cleanup; an unrelated sibling must survive unchanged.
Cancellation also checks idempotence, destination preservation and private-temp
cleanup. Caller exit verifies the private control-pipe EOF path. The outer test
subreaper reaps the orphaned owner after caller exit and provides bounded cleanup
for deliberately broken negative controls; it does not make transport absence
pass by reaping or killing survivors before the assertion.

Four independently omitted production controls were rejected: subreaper
adoption, identity-bound descendant signalling, cancellation EOF detection,
and cleanup on successful direct-parent exit. Each mutation is hashed and the
helper is restored byte for byte. There was no production defect found and no
production implementation change in this acceptance task.

The standalone four-request fixture passed on the exact final helper: one
metadata plus four pending chunk requests, no queued tail, all four transports
reaped, destination unchanged, temp removed, elapsed 0.530312s for a 500ms
deadline. Its full measured physical peak was 132513792 bytes, below 134217728.
The historical unittest-based resource stops remain in the parent evidence.

Existing integrity/envelope and eight donor groups were reused. The response,
identity, metadata and chunk definitions are byte-identical; readback differs
from the original only in a comment. The donor focused receipt binds the current
helper plus one trailing LF (SHA256 0254d892...), explicitly verified rather than
misreported as a byte-identical full-file pin. This provenance mismatch warranted
the exact-final four-request run. The earlier missing pool-ancestor resource
qualification is retained and is not retroactively accepted. No game runs were
repeated. Original rejection 1ae56c108a93baf9e058f90bb65e15b2245838cf, real denials,
and prior incidents remain preserved in this branch's parent evidence.

Every test used the shared execution-pool wrapper with one permit and physical
128MiB aggregate supervision including pool/invoking ancestors, supervisor and
tracked descendants. Git uses both permits before the exclusive production Git
mutex, physical 256MiB aggregate, and RLIMIT_DATA=512MiB on Git children only.
CPU90s/wall120s/file24MiB/output2MiB/excerpt8192 are retained. No Node executes;
no Node startup receipt is claimed. Exact executables, argv, inherited limits,
physical peaks and identity scans are retained in the receipts.

Full task allocation is 96MiB, including selective Git/source, outputs,
publication, external launcher/events/session, positive WAL growth once,
future24MiB and reserve8MiB. Installed tools and readonly donor inputs remain
standing inputs; no links conceal bytes. Admission counts resident client growth
once, prospective clients only if unlaunched, host768MiB and shared child256MiB;
no individual client cap is inferred. Current complete receipts supersede the
initial conservative peer-allocation miscount without erasing that incident.

Replay scripts and receipts are retained here. Put the unchanged accept.py,
local_transport.py, input-pins.json and original-checkpoint.json under TASK/ops
(copy original-checkpoint.json to checkpoint.json); source belongs under
TASK/repo. Use a freshly admitted task-specific supervisor and the shared pool.
ownership.py and omission.py derive the same layout. Do not reuse stale fleet
admission or treat an old receipt as runtime authorization.

No guest, browser, Wasm compile, service/restart, public deployment or worker
launch occurred. No box is assigned. Historical bx_ex22dvm8 is ROOT-reported
STOPPED, unqueried here; original expiry 2026-10-26T22:31:02.949Z. Coordinator
retains lifecycle ownership. Remaining: separately assigned integration and
gameplay acceptance. This worker stops after verified branch publication.
