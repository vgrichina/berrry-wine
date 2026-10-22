# PASS — bounded snapshot recovery feasibility

Recovery preflight only, based on accepted main
58e90870a40a541a4083cae5e987ca8de31889e6. No runtime qualification.

The canonical primary was recovered through the documented server-side file
stream, HTTP206, Content-Range bytes 0-1879386/1879387. Actual size 1,879,387B;
SHA256 ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553
matches the accepted canonical build. No compat or historical module was used.
Local artifact: canonical-primary.wasm, intentionally uncommitted. Its recovery
recipe and independent verifier are committed. Only that binary was recovered.

## Complete compressed chain sizes

The authenticated documented download-metadata responses include every chunk,
its size and hash. Signed URLs were redacted before writing. No chunk was fetched.
Per-generation layer sizes, including all chunks, are in canonical-chain-sizes.json
and installed-chain-sizes.json; complete sanitized chunks are under raw/.

| Box | Snapshot | Chain | Generations/chunks | Compressed total |
|---|---|---|---|---|
| bx_f3gs8qm2 | de8639e2-cf50-4c6b-a330-6c482bc6f573 | 652833e6-5820-40a5-ba21-c6c5231f0d48 | 0–31 / 35 | 89,803,816B |
| bx_m4xrrj5a | 3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f | b96571ec-d987-429c-9a9e-48a9237c8e46 | 0–17 / 82 | 1,187,196,839B |

Both latest deltas are only 355 compressed bytes / 62 content bytes. Those
numbers are not chain totals. Canonical generation1 is 22,837,623B and generation2
45,088,318B. Installed generation6 alone is 609,077,045B. The previous 16MiB
failure is not retried. Local whole-chain staging fails the 64MiB allocation;
selected API streams avoid local layer and codec staging entirely.

## Actual installed state and eventual transfer

Fresh merged tree metadata reports the old live session path contains only two
directories, no files. Use the existing preserved retained-session backup,
not that empty path and not recreated metadata. It has 2,083 files / 186,399,681B,
including 2,045 parent-VFS files / 177,682,979B and the actual 17,088B registry.
The prior [bounded-launch RECOVERY.md](/home/user/wine-assembly-shadow-man-installed-game-bounded-launch-oct22/scratch/runs/20261022-shadow-man-installed-game-bounded-launch/RECOVERY.md) records that all 2,083 backup files matched
the session. This task reuses that identity receipt; no installed bytes or registry
values/hashes were newly read. The saved game directory has 1,960 files /
101,192,758B; do not mistake that for the accepted original 1,959 files /
100,354,053B. Original identity validation against ba485e8 remains a future gate.

Documented per-file snapshot streaming, proven on the canonical file, permits
eventual sequential direct writes into a separately authorized future box with
64KiB read buffers and exact expected-size enforcement from the saved inventory.
No >100MB payload passes through local disk. Registry bytes must be copied
unchanged from retained-session/parent-registry.json and hashed, never synthesized.
Installed-byte transfer/access was not executed here; support is documented and
the preserved path/size inventory is measured, not a claim of completed recovery.

installed-feasibility.json contains the measured inventory and deliberately
conservative peak: all three immutable backups with 4KiB file rounding and
directory allowance 609,730,560B <2GiB; two complete retained-session copies,
an extra original payload allowance, stream buffer and 8MiB filesystem metadata
allowance use 504,051,717B <896MiB hard tmpfs. With fixed96MiB and reserve32MiB,
mutable peak is 638,269,445B <1GiB. Immutable+mutable planned aggregate is
1,248,000,005B. Parent includes existing child evidence (468,779B) and all session
metadata; the additional complete child clone overcounts a minimal future launch.
This is transfer/storage feasibility, not a measured future runtime peak.
Future filesystem allocation/free>=2GiB and runtime admission must still be
measured on the future destination. No box is provisioned by this result.

## Allocations, limits, verification

Precheckout admission 57,122,816B <67,108,864B includes both entire reused donors,
Boat/Python/Git/SSH binaries, actually imported modules, 8MiB shared-library and
launcher allowance, 8MiB focused Git/evidence/metadata/output allowance and
8MiB reserve. Host free 6,961,868,800B >=2,982,150,144B. No source checkout,
new dependencies, decompressor, layer, archive, media or unlimited temp storage.
Tree response was 1,634,643B, chain JSON responses 32,309B and 74,282B;
all metadata reads were bounded. Canonical buffer64KiB, output exactly1,879,387B.
Final measured accounting and verification are in verification.json.

One initial canonical header-only request incorrectly required Content-Length;
the valid chunked206 response omitted it. No response body was read or file
created in that request. The check was corrected to use exact Content-Range and
bounded byte counting; the next request recovered and verified the primary.
No access denial occurred during snapshot reads; no auth/config changes or
alternate endpoint/identity was used. Existing status-reported CLI token stayed
in memory; it and signed URLs were never printed or committed.

Zero guest launches, builds, source compilations, API execs, workers, compute
creations/resumes/forks/starts/stops/deletes, reinstalls, packaging or source
repairs. Both bx_f3gs8qm2 and bx_m4xrrj5a remain STOPPED per coordinator checkpoint;
running expiry N/A. Coordinator retains lifecycle/task ownership. Existing403
sandbox.resume denials were not retried. No production/main changes or merge.
All base paths and protected root/donor Git metadata are preserved.
An ordinary unstaged `git diff --check` cannot read an unavailable unrelated
base blob in this focused repository. Validation uses the staged evidence-only
diff and `write-tree --missing-ok`, preserving the complete base index without
fetching or materializing unrelated source. No acceptance suite is replayed.

## Supported interfaces

The [download metadata API](https://docs.boat.dev/api/reference/snapshots/get-snapshot-download)
returns the complete ordered chain with chunk sizes. The
[snapshot file API](https://docs.boat.dev/api/reference/snapshots/get-snapshot-file)
supports stopped snapshots, individual bytes or folder tar streams and file ranges.
The [tree API](https://docs.boat.dev/api/reference/snapshots/get-snapshot-tree)
provides path/kind/size inventory. Existing CLI pull has path selection but stages
compressed layers, so it is not the recovery command admitted here.
