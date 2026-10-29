Scoped decision: ACCEPT the preserved open-unlinked charge-lifetime behavior by
source plus actual-runtime evidence. No production defect is demonstrated. The
original gatePASS=false and CLI rejection remain unchanged. This accepts the
bounded allocation guard behavior, not the failed original receipt oracle.

All five production files match their dispatch SHA-256/byte pins and the exact
Git objects at 5a88ca099b962e946160afd2d4d71a950bf46db3. input-pins.json records
those identities, original paths and verbatim evidence hashes. The original
canonical, completion, stop and cancellation receipts were independently checked
against the coordinator's immutable pins. The fixture and observer match their
original canonical pins. evidence/runtime.stdout is the unchanged raw API
envelope; runtime.json records its local execution metadata. The nested report,
base64 child output, recorded argv and canonical checkpoint agree. No predecessor
code was executed. No backend, FUSE, Boat, guest, browser or Node invocation ran.

The exact single-thread fixture executes, in order (fixture.py lines 2–10):
open A; write 16384 a bytes; unlink A; create/open B; fstat A; assert links=0 and
size=16384; pread/assert A's bytes; flush the checkpoint; attempt B's 16384-byte
write. There is no close of A before B's write. The actual checkpoint identifies
Afd=3, Bfd=4, Ainode=2, Aopen=true, Alinks=0, Asize=16384. The final deliberate
AssertionError would execute if B's full write returned; its absence alone is
not the acceptance oracle because the supervisor terminated the child (-15).

Source anchors are in test/toyvm-kernel-profile-accounting-backend-oct28:

- fuse_backend.py:64 create charges 4096 metadata before insertion. The root
  already owns 4096. CREATE at line 111 increments inode opens and handle count.
  A's successful WRITE (line 123) calls resize (line 78) before payload mutation
  and written-counter increment. Rounded payload growth is charged synchronously.
- UNLINK at line 138 removes the name and decrements links, then calls collect
  (line 52). collect requires both links=0 and opens=0. A remains open, so unlink
  cannot remove its metadata or payload charge. FORGET is explicitly not storage
  reclamation. The fixture's fstat/pread establish the still-live unlinked inode.
- Creating B adds 4096. Thus root4096 + Ametadata4096 + Apayload16384 +
  Bmetadata4096 = 28672 immediately before B growth. This is SOURCE-INFERRED,
  not a measured rejection-time live sample. The recorded peak=28672 agrees.
- B's full request would add 16384, yielding 45056 > liveLimit32768. Its file
  size would equal fileLimit16384; cumulative written would be32768 <=65536.
  Therefore charge (line 48), rather than those other guards, rejects with
  filesystem allocation limit BEFORE live increment, resize and written increment.
  The serial serve loop (line 188), direct_io and disabled writeback prevent an
  unaccounted asynchronous successful growth in this pinned path. Raw failure
  reason, written=16384 and peak=28672 agree with rejection before B allocation.
- RELEASE at line 133 decrements opens and handles, then collects A when its last
  handle ends. It frees 4096+16384. B remains linked with metadata only. The
  resulting root4096+Bmetadata4096 explains final live8192, inodes2, handles0.

An early close would free A and leave root+B metadata8192, allowing B growth to
24576 under the limit. That alternative conflicts with the pinned fixture's exact
order and retained written/failure receipt. It is tested as a rejecting control;
it is not executed as a runtime replay. Accepted B growth controls also reject,
including a forged sticky failure paired with written32768. Static checks reject
premature collection, charging after mutation and relabeling final live as28672.

supervise_accounted.py:37 calls the pinned child-tree supervisor. That supervisor
signals/reaps owned children before returning (pinned-supervisor.py:179–212).
The adapter samples at line40, waits for zero handles, and assigns this final
snapshot to result['filesystem'] at line45. It emits no filesystemFinal key.
Hence live8192 is the observed post-reap value. The old oracle incorrectly
required that field to be28672 and required nonexistent filesystemFinal.openHandles.
Neither old expectation is changed here. Sticky failure may also be copied into
stopReason after reap; we do not infer exactly when the polling check saw it.

Actual cleanup evidence shows child-tree cleanupComplete=true, all recorded
process identities absent/reused, unmountExit=0, no remaining mounts, backend
serverExit=-15 and empty backend stderr. The coordinator's separately pinned
receipt confirms bx_gfk8k88g snapshot completed and actual state stopped at
2026-10-29T04:37:48.431Z; its original effective expiry was05:06:59.426Z. No new
box was allocated or touched. Shutdown ownership remains with the coordinator.

Limits of acceptance: rejection-time live bytes were not independently sampled;
the child did not report a returned ENOSPC errno. This is acceptance of charge
retention and rejection of the attempted B growth on the pinned path, not an
observation of syscall completion. It does not qualify confinement, arbitrary
descendants, general resource behavior, browsers or gameplay. Historical EACCES,
socket-length, observer, procedural and publication limitations remain in the
unchanged historical canonical. Browser CPU35.353183/wall101.495550694/captures1
remain unchanged. Empty mount argv was recorded for this direct CLI path; no
guest mount parser is claimed to have run.

No instrumentation task is required for this bounded decision. If a future task
specifically needs an instantaneous measured live/errno oracle, minimally retain
an opt-in, request-owned pre-reject snapshot (operation/inode, pre-live, delta,
limits, links/opens, written) before charge mutation, correlate it to B and its
returned errno, and keep the post-reap filesystem snapshot separate. Test early
close and accepted growth as controls. That work is neither implemented nor
authorized as runtime execution here.

Reproduce only the offline checks with `python3 -B check.py` from this directory
under the task's prescribed limits. check.py parses source and receipts without
importing or invoking production code. Seven adversarial controls pass. Evidence
copies are verbatim; the historical canonical is not rewritten. Five source Git
object comparisons and fresh per-operation aggregate disk/RAM checks are retained
in the private evidence directory. The optional `sparse-checkout list` diagnostic
reported that this born minimal worktree has no configured sparse-checkout; no
retry, checkout or sparse expansion followed. New files use exact-path staging.

Publication is task-branch-only. The root messageboard already exceeds this
worker's file-size cap; messageboard-publication-note.txt delegates its one
concise receipt pointer to the coordinator. No rootboard write is attempted.
