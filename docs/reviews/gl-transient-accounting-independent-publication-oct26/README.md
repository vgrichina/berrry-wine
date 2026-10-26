# Independent accounting acceptance: REJECT

Candidate `9e7b74218b6518534638efdd9a48310df7b6f1ad`, branch
`task/gl-transient-accounting-measured-client-repair-oct26`, donor
`/tmp/gl-transient-accounting-measured-client-repair-oct26/repo` remained read-only.
All four manifest SHA256 pins and their exact candidate Git blobs match the
materialized files (`pins.json`, `source-blobs.log`, `staged-source-identities.log`).
Only a minimal independent Git copy and those four files were staged. No source
repair was made. This branch publishes rejection evidence only; main publication
is forbidden after this rejection. Main was not checked out, changed or pushed.

The first behavioral check used the unchanged donor
`Accounting.test_production_discovery_races` on the exact retained production
`remote-run.py` allocation initializer, `alloc` and `check` definitions and the
actual shared `AllocatedDisk`. All three file/symlink/directory disappearance
cases passed, firing the actual callback and retrying once while retaining the
required charge. See `production-first.{json,log}`. No historical runner was
substituted, and the production script's guest/browser top-level code was not run.

The next independent challenge fails at **both the actual retained production
callback and shared accounting callback**. After one successful stable sample,
truncate a required file from 16384 bytes / 32 allocated blocks to zero, preserving
its device/inode. The second check returns `None` (success). The production
ledger reports samples=2, retries=0, unknown=0, lastBytes=8192 (only the root/tmp
directories); the required file is now charged zero. The shared callback also
accepts its second sample. This is deterministic mutation between samples, not
an arbitrary concurrent-write quota claim. See the unchanged
`required-cross-sample.py`, its nonzero supervised test receipt/log and the full
`required-cross-sample-result.json` including before/after metadata.

Cause: `AllocatedDisk._charge` saves only `_identity(s)` in `required_seen`.
`_version(s)` is compared within a walk, but no required-entry version baseline
survives to detect in-place truncation between samples. The implementation rejects
replacement/loss but silently accepts this required-input mutation. Required
inputs being quiescent and independently pinned is a necessary usage condition;
it does not make the requested fail-closed cross-sample mutation check pass.
Repair scope: retain and validate a bounded required-file version inventory across
samples/retries, distinguish mandatory directory namespace churn and explicitly
transient data, and preserve intended positive-WAL-growth semantics. Do not
unconditionally freeze all directory timestamps or WAL sizes. Fresh acceptance
must cover that repair and remaining independent fault gaps.

The unchanged donor 23 controls / six omission boundaries and five accepted
process-supervisor functions are retained as existing evidence, not rerun or
upgraded to independent acceptance. `reused-receipts.json` binds their paths and
hashes; the donor README documents final bounds/fixture progression. This new
rejection supersedes a blanket acceptance inference from those groups. Remaining
independent disappearance/replacement/ancestor-link/permission/EIO/fake-ENOENT,
ceiling/partial-retry/headroom/deadline/inventory challenges were stopped at the
first genuine candidate defect. No main reconciliation, merged tests or source
integration was attempted after rejection. `checkpoint.json` durably records the
candidate, exact hashes, completed checks and remaining work.

Reproduce with retained owned operations (expected nonzero):

```
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- python3 /tmp/gl-transient-accounting-independent-publication-oct26/ops/run.py test required-cross-sample /usr/bin/python3 /tmp/gl-transient-accounting-independent-publication-oct26/ops/required-cross-sample.py
```

`required-cross-sample.py` is retained byte-for-byte after its first rejection.
It creates only tiny owned temporary fixtures, removed on completion. It never
modifies donor or repository source. The published copy is an immutable recovery
copy; restore it to the retained `ops` path to use the recipe after loss.

Resource controls: fresh complete own allocation is **64 MiB**, including selective
source/.git, outputs and publication copies, external launcher/events/session,
positive WAL growth counted once, future16MiB and reserve8MiB. Read-only installed
tools and donor inputs are standing inputs, excluded; no links conceal bytes.
`admission-initial.json` measured own655360B, conservative projected42598400B,
MemAvailable3671674880B >= required1409286144B and projected host free3119427584B
>=2982150144B. Four other lightweight allocations conservatively reserve their
full64MiB growth. Resident Codex RSS is already deducted from MemAvailable;
future64MiB per resident is charged once, prospective clients=0, host768MiB plus
shared-child256MiB. No individual128MiB/320MiB client cap applies. Actual live
session `01a17a61-ea00-7e50-ad67-15a9091f2b7b`, PID3254701, executable argv verified
GPT-6.1-Sol / medium / 200000 total automatic compaction before checkout.

Every test command uses the shared pool1 permit; every Git command pool2 followed
by exclusive `/tmp/wine-ops-production-git.lock`. The accepted physical supervisor
includes pool parent, itself and descendants:128MiB tests /256MiB Git, CPU90,
wall120, file24MiB, output2MiB, excerpt8192. Git DATA512MiB is applied only to the
Git child, never supervisor, Node or Codex. No Node executes, so no Node startup
receipt is applicable. Exact commands, resource limits and actual measurements
are in supervised receipts and compact `closeout.json`. Sampling/waited-RSS
limitations of the accepted process supervisor remain. No arbitrary-write atomic
quota or instantaneous memory-bound claim is made.

GitHub publication uses the supplied dedicated identity and known-hosts files,
BatchMode, IdentitiesOnly, StrictHostKeyChecking=yes; trust files were not altered.
The initial launcher root-ref digest was reused without capturing a ref listing.
No filename-bearing guest mount argv exists in this offline task; nothing is
conditionally mounted or parsed. The exact retained production wrapper remains
a recovery source, not permission to replay its stale absolute paths or cutoff.

Historical incidents remain truthful: original Chromium SingletonSocket startup
ENOENT, shared-helper whole-root-zero bug, previous individual128MiB client-policy
rejection, runtime95297d0d 1GiB memory failure, real platform/access denials and
donor development/control/supervision errors are not erased. This worker's initial
read-only excerpts exceeded8192; later output is bounded. The failing independent
challenge is an actual candidate defect, not a platform denial or wrapper error.

No guest/browser/Wasm compile, Boat API/SSH/resume/creation, service/restart,
public deployment, game semantic changes, workers, agents or refill occurred.
WebGL1/2 remain **0/42 each**, backend unknown; source acceptance grants no runtime
success. Future runtime requires accepted actual helper/wrapper hashes, fresh
8GB finite-TTL Boat and separately authorized coordinator lifecycle; this worker
never creates a box. No box is assigned or queried. Prior bx_bcpdmz2t is ROOT-
reported stopped on the board (not independently queried); original expiry
2026-10-26T23:02:04.169Z. Lifecycle ownership remains with the coordinator.
