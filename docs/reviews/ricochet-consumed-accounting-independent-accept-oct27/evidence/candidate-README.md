# Ricochet consumed-control accounting repair (source/test only)

The pinned gameplay supervisor enumerated paths, then called `stat()` again.
The serial controller legitimately unlinked `serial/continue.json` between those
operations, terminating supervision with `FileNotFoundError`. The original
failure is retained at donor commit `66dafb1db3dfc97395edb14a81532a06f3226008`;
its `ops/result.json` reports `BLOCKED_ACCOUNTING_SCAN_RACE`, not accepted
post-input gameplay or ordinary Quit.

`tools/ricochet/runtime-accounting.py` takes bounded fd-relative samples. Roots
and every discovered retained artifact keep their identities across samples.
The only disappearance exception is an explicitly named ephemeral regular file,
whose entire declared maximum charge stays reserved while present, absent or
open-but-unlinked. Nothing skips a subtree or suppresses arbitrary ENOENT.
Files must be single-link regular files; symlinks, special files, cross-device
traversal, replacements and unexpected disappearance fail closed. Immutable
inputs require content hashes and stable versions; live outputs may grow and
are charged at the maximum size/allocated bytes observed through their open
file descriptor and pathname. Using logical bytes as well as allocated bytes
also rejects sparse growth. Namespace churn outside the named control path
rejects the sample. New retained artifacts can appear between successful scans.

The ledger is an observation, not a filesystem quota or atomic snapshot.
Growth after the last observation is checked at the next sample; existing
physical RSS, conservative CPU, wall deadline and file-size supervision remain
mandatory. Failed samples cannot return partial totals. The receipt retains the
highest observed charge, including an over-cap failing sample.

## Integration recipe for the next bounded gameplay owner

1. Verify donor commit and these three original blobs against the source pins
   in `checkpoint.json`: `remote-supervisor.py`, `trusted-supervisor.py`, `serial.py`
   under `docs/reviews/ricochet-measured-cpu-round-gameplay-oct27/remote-tools/`.
   Preserve original failure diagnostics. Do not replay uncertain steps.
2. Stage this helper as `H/runtime-accounting.py`. Build an immutable manifest
   mapping the **actual staged absolute paths** of the helper, trusted supervisor,
   controller, child launcher, production runner, module, API table, import
   signatures, libraries/workers and registered fixture closure to verified
   SHA-256 values. Include only genuinely immutable inputs; runtime logs and
   checkpoints are live files. Verify all sources before importing/executing them.
3. Call `integrate.py:transform(original_supervisor_bytes, immutable_manifest,
   secondary_root=actual_retained_cleanup_root)` and retain both source and
   generated hashes. This recipe rejects another source revision or an absent
   helper/manifest pin. Both directory roots must already exist and remain
   identity-pinned. Stage the resulting supervisor in the same H directory.
4. The generated supervisor charges a **24 MiB control reservation inside the
   existing 256 MiB allocation**. This matches the existing writer file-size
   limit; it does not add storage or increase any cap. The owner must establish
   the publisher/controller contract before launch: only authorized bounded JSON
   commands, regular single-link files, both logical and allocated size <=24 MiB,
   writer RLIMIT_FSIZE <=24 MiB, one outstanding command, no unaccounted temporary
   paths. All producers (including API-side writers) must enforce that bound
   before publication. A file consumed before opening cannot independently prove
   its past size, so this writer contract is required, not inferred from absence.
   Ordinary small control JSON needs only one block; the reservation remains
   deliberately conservative. Include it once in fresh disk admission. If the
   full immutable closure plus reservation does not fit, stop for coordinator
   allocation resolution; do not lower a proven bound or increase a runtime cap.
5. Keep the original capture/output/storage/RSS/CPU/wall/host-floor checks and
   cleanup supervisor. The recipe changes only storage inventory, derives stream
   and PNG sizes from that same sample, and persists the accounting receipt.
   Replace the historical cutoff and task-specific directory/environment bindings
   only under the next owner's fresh assignment/readiness/lifecycle receipt.
   This source-only recipe intentionally leaves the old cutoff unchanged.
6. Run the production-boundary fixture first, then reuse affected passing groups:
   `python3 -S test/ricochet-runtime-accounting.test.py AccountingTests.test_00_exact_transformed_production_boundary`.
   The first subgate deterministically reproduces the unchanged production
   failure. The next subgate runs the complete generated production supervisor,
   including initialization and its unmodified trusted process supervisor,
   consuming only the authorized control file between enumeration and stat.
   Its child is a tiny Python fixture; no guest, Node or platform execution occurs.
7. For an authorized future gameplay attempt, retain fresh exact-config startup
   diagnostics, distinct bounded stdout/stderr from process creation, real mount
   parser receipt, input/source/module pins and lifecycle/admission. Verify the
   next completed post-input step and before/after paddle/ball response, then
   ordinary in-game Quit. None of those guest outcomes is claimed by this repair.

## Verification and handoff

22 meaningful test methods passed across retained, non-repeated affected groups.
They cover deterministic consumption before stat, immediately after open and
before final validation; missing/change/replacement/link races; control recreation
and over-reservation; live/sparse growth and storage peaks; traversal bounds;
unchanged RSS/CPU/wall enforcement; and storage-rejection cleanup of a synthetic
process tree with PID/start-identity absence checks. Tests use temporary owned
fixtures only. Original behavioral failure and the first implementation's
unlink-after-open rejection are retained alongside the corrected passes.

The task branch is an isolated sparse **orphan report**, not an integration
commit. Extract only the helper, test, recipe and desired evidence paths when
reviewing/integrating; never merge this orphan tree into main. Original pinned
supervisor/controller blobs are included unchanged for reproducibility. Git used
read-only donor alternates, child-only DATA512 MiB, physical256 MiB, two permits
and the production Git lock; Python used one permit and the trusted physical128
MiB supervisor. No full checkout/repack, root/index/ref mutation, main ownership,
public deployment, workers, boxes or guest execution occurred.

Incidents retained: sparse donor checkout reported an unrelated missing object
while exiting zero; its diagnostic is not treated as success evidence for a full
checkout. The owned task branch was made unborn and its index emptied to create
this scoped report. Initial read-only command displays exceeded the intended
small display gate; later execution displays are bounded. Initial RAM admission
conservatively charged already-live peer clients twice; corrected admission uses
live pinned PIDs/RSS already included in MemAvailable and reserves only future
clients. No denial was bypassed. WAL baseline was unavailable; the full current
shared WAL is conservatively charged once, without claiming exact growth.

No box is assigned to this source-only task. The historical bx_e9mecsag is not
accessed; the coordinator's board reports its scheduled snapshot/stop completed.
Lifecycle ownership remains with the coordinator.
