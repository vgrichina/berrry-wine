# Required-file version inventory repair — branch handoff

Base candidate `9e7b74218b6518534638efdd9a48310df7b6f1ad` from readonly
`/tmp/gl-transient-accounting-measured-client-repair-oct26/repo`. All four supplied
SHA-256 pins and candidate Git blob identities were verified before edits. Only
the shared helper and its two focused test files change. The production runner
fixture is byte-identical (`3ccde695a00edd757c05d7f1ec3d5d646d4b26baf4e60ea0abdcd3e5da901f4c`).
Selective source and a small independent Git object store were recovered locally;
no missing blob was retried and no broad checkout/assets were copied.

`AllocatedDisk.required_seen` now retains non-directory metadata versions across
samples AND discarded partial retries: device/inode/type, size, allocated blocks,
mtime/ctime, mode, uid/gid and link count. Mandatory directories retain identity,
plus a bounded mandatory child-name inventory. Their timestamps and block counts
are not frozen between samples; explicitly transient subtrees remain mutable,
while their mandatory root identities remain checked. New mandatory names,
missing names and changed file versions fail closed. Inventories remain bounded
by the traversal/required-entry limit, with the existing deadline/depth/retry/
ceiling checks. No failed or partial sample returns a zero/partial charge.

External WAL accounting explicitly opts in individual regular-file roots to
mutable versions while retaining root identity and ceiling validation. Directories
and non-root paths cannot receive this exception. WAL growth is still charged
once outside primary roots as max(0, allocated-baseline), without pinning its
changing size. Existing shrink behavior remains accepted. Permission/EIO faults
are preserved rather than treated as missing entries.

The FIRST behavioral checkpoint ran the unchanged independent
`required-cross-sample.py` (SHA256 `59993ac44a3f85edc39fe2d420c503ce9789fccad6588be4f3bd2cc942199ac0`)
against the repaired shared helper and the ACTUAL retained production allocation
initializer/alloc/check AST definitions. Both boundaries now reject same-inode
16384-byte/32-block truncation to zero. No top-level guest code executes. The final
unchanged reproducer passes again after all controls. Its embedded candidate is
its historical base; `helperSHA256` binds the actual tested repair.

27 focused tests pass: prior disappearance/replacement/ancestor-link/permission/
EIO/fake-ENOENT/ceiling/partial-retry/headroom/deadline/inventory controls, actual
production discovery races, transient churn and positive-WAL-growth once, plus
cross-sample truncate/rewrite/chmod at both callbacks, first-observed version
retention across retries, mandatory namespace changes and mutable-root exclusions.
Nine production omission controls reject missing controls. A separate mutation
proof disables ONLY the cross-sample version comparison in owned source, runs the
UNCHANGED independent reproducer and proves BOTH callbacks again accept truncation
and the reproducer fails. Source bytes are restored in finally, and the final
unchanged reproducer passes. Mutation result and child failure are retained.

Production discovery races were affected by the directory inventory additions,
so the exact three-case production test was rerun in the focused group; its prior
passing receipt is also referenced by path/hash. Five unrelated process-supervisor
functions retain identical source hashes and their prior accepted receipts are
reused, not rerun. `process-function-reuse.json` and `reused-receipts.json` bind
those standing receipts. `checkpoint.json` records each completed group and
remaining fresh independent acceptance. This is repair-worker validation, not
independent acceptance; main publication remains forbidden.

This is a bounded metadata observation, not a filesystem snapshot, content hash
or atomic quota for arbitrary concurrent writers. Mutations after validation are
subject to the next sample/free-space gate. An all-version-fields-equal rewrite
cannot be detected. Required inputs still need immutable independently pinned
sources. A rapid rewritten/restored-mtime fixture produced equal ctime; that
initial failure is retained in accounting-regressions.log. The corrected fixture
waits one bounded clock interval and asserts that the metadata version actually
changes before testing rejection. The initial chmod control also exposed coarse
ctime: explicit permission/ownership/link fields now participate in versions.
Its failure is retained in version-controls.log. The old required-deletion
omission became redundant because the new namespace check catches deletion;
its first failure is retained in omissions.log, then the omitted file inventory
is challenged with same-inode file mutation instead. No production fault was
silenced to make an omission test pass. An accidentally premature checkpoint PASS
entry is retained with its explicit CORRECTION and the subsequent true passing run.

Fresh admission uses 64 MiB total: measured task tree (including selective .git,
source, outputs and publication), external launcher/events/session, positive WAL
growth counted once, plus conservative 16 MiB source/publication growth budget,
16 MiB future growth and 8 MiB reserve. Readonly donor/installed tools are standing
inputs, excluded. No links/alternates conceal task bytes. All native resident Codex
clients, including the coordinator, receive future64MiB once; actual RSS is already
subtracted from MemAvailable. No prospective client is launched. Host768MiB plus
shared-child256MiB and measured resident growth are required; projected free must
remain >=2982150144 after remaining own allocation and four peer64MiB allocations.
Corrected full fresh receipts supersede the initial exec-only resident filter.
The initial admission JSON was accidentally overwritten by a fresh run; original
stdout measurements and this incident are preserved in initial-admission-history.json.

Every focused test ran through the shared pool1 permit; every Git command through
pool2 THEN exclusive /tmp/wine-ops-production-git.lock. The unchanged accepted
physical supervisor includes pool parent, itself and descendants: tests128MiB,
Git256MiB; CPU90/wall120/file24MiB/output2MiB/excerpt8192. Git DATA512MiB is set only
on the actual Git subprocess. Test measured peak82182144B and prepublication Git
peak67825664B; receipts retain sampled/wait4 values and their lower-bound sampling
limitations. No Node executes; Node startup is inapplicable. No Git DATA/AS limit
is applied to Python, Node or Codex. Exact executable argv/flags/limits and actual
measurements are retained in receipts. Live worker PID3267099/session
01a17a6a-f493-7de1-8e46-3072bd036c96 verified GPT-6.1-Sol medium200000 total.
Trusted SSH uses the supplied dedicated identity/known-hosts with BatchMode,
IdentitiesOnly and StrictHostKeyChecking=yes; no trust files changed. Initial root
ref digest is reused without capturing a ref listing. No guest/mount argv exists,
so there is no filename-bearing configuration to validate with the mount parser.

Original independent rejection evidence commit
`7123b7ce3bb0641afdb048457664e1e7419ff522` and all historical incidents remain valid:
Chromium SingletonSocket ENOENT, whole-root-zero bug, erroneous individual128MiB
client-policy rejection, runtime95297d0d 1GiB memory failure, actual platform/access
denials and donor development/supervision errors are not erased or reclassified.
This task performs no browser/guest/Wasm build, Boat API/SSH/resume/create, service/
restart/deployment, game-semantic work, workers/agents/refill or main publication.
No box is assigned or queried; box ID/state/expiry N/A. Coordinator owns lifecycle.
WebGL1/2 remain **0/42 each**, backend **unknown**.

Recovery: copy the retained ops scripts from this directory to the task's ops
folder and the three repaired source/test files plus unchanged pinned production
fixture to repo. Fresh admission is mandatory. The unchanged reproducer expects
that ops/repo sibling layout. Invoke tests with the shared pool and `ops/run.py`
as recorded in test receipt command fields; never run the stale top-level remote
runner. Own task branch publication and exact remote ref are recorded externally
in ops/publication.json and on the append-only repository messageboard. STOP here
for fresh independent affected acceptance; no main integration is authorized.

Final storage correction: the copied Git metadata initially contained a donor
alternates pointer. The full-footprint assertion rejected that unaccounted
dependency before push. An owned recovery command copied and SHA-verified only
562 commit/tree metadata objects (731893 uncompressed bytes) and the FOUR supplied
source blobs, removed the pointer and made the known base a shallow boundary.
There are no alternates or links hiding bytes. No other blobs/assets were read.
The first recovery attempted to overwrite an ordinary copied readonly Git object;
its PermissionError is retained. The corrected recipe verifies existing bytes
and writes only absent objects, preserving all platform/host restrictions.
The retained actual Git child alone receives DATA512MiB even when the supervised
recovery controller is Python. This recovery changes no tested source.
