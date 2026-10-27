# Airstrike accepted compiler: one canonical build, rejected

The independently accepted candidate `1cf9788cc3ac807027206c39fcbf1d2771599845` does **not** unlock full-module acceptance. The one authorized `bash tools/build.sh` invocation exited 0 and produced both modules, but the unchanged trusted supervisor rejected it with `aggregate CPU limit`: **126.1068 reported CPU seconds**, 22.611741 wall seconds, 807268352-byte peak aggregate RSS, cleanupComplete true. Its CPU90/wall120 gates and byte hash `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85` were unchanged. Build stdout reaches both completion messages and the 323-segment overlap check. This command exit is not acceptance. No retry, integration, gameplay, main publication, or guard/metric change occurred.

The historical **105.48018 CPU rejection**, old modules **UNQUALIFIED**, and whole-invocation CPU completeness **UNKNOWN** remain binding. The new number is the existing trusted guard's reported value; no diagnostic cgroup value substitutes for it. This run establishes no accepted full-build speed or memory benefit.

## Exact source and reused acceptance

Baseline portable source archive SHA256 `87916e3d000f95ad67be9593f2ad868e8b710d0fbf440c49b93b8879c7a985d1` plus the exact independently reviewed census delta and candidate diff from `0bbff116aa79f55e7a8ba9afaf3122e5f0a0a110` reconstruct 3559 manifest files / 64037897 source bytes. Full source manifest SHA256 `e124c9afa32ac00bde8740a92e5710128586ee663e8132d5106eb5f89d7127e4`. The four supplied compiler SHA256 pins match. Source closure was checked locally before allocation and on the remote before execution. Real commit/tree/src-tree/API-table Git objects preserve `git show HEAD:src/api_table.json`, verified byte-exact locally and remotely; no skipped/shallow fallback substitutes for that gate. No network Git fetch/clone/repack.

Reuse coordinator-verified candidate manifest `487ed0d5a09fe15043a11cf70ffa0e1304194ceda453756fbbe26a45b06d44d0` (198 payloads) and independent acceptance commit `8f0813f167687f110829d03d102bd016a1b26164`, manifest `8e5be727bf647d474388365661c20b5225221c02e5450fda27ddc91365e0b001` (297 payloads). The 125 baseline full-result and 68 unchanged-test comparisons were not rerun. Reuse was enabled with `WINE_WAT_FRONTEND_REUSE=1`; all provenance/census/signature/segment gates stayed intact.

## Execution and rejected artifacts

Fresh supported API-exec large Boat `bx_neejz2qd`, 1200-second TTL, expiry 2026-10-27T21:43:06.272Z, task cutoff 21:45 UTC with earlier expiry authoritative. Remote preflight measured 15892148224 bytes MemAvailable, 128740311040 bytes disk free, and all limiting cgroup ancestors had over 11 GiB remaining. Local aggregate admission and full ownership were remeasured per supervised operation with the 512 MiB task allocation, 32 MiB reserve and prescribed disk floor. Staging result records measured duration and exact archive SHA. Heavy Node RSS guard was 10 GiB; CPU90/wall120/file24MiB/output2MiB unchanged. Remote Node `/home/user/.nvm/versions/node/v24.22.1/bin/node` startup passed under the same executable/environment/empty heap flags and inherited DATA/AS-unlimited limits before the build. Receipts preserve executable hash/version, environment, actual limits, location, and distinct stdout/stderr from process creation. No guest/mount invocation existed.

Both emitted artifacts are **UNQUALIFIED**. Conditional post-pass validation/import/export collection was correctly not entered after rejection:

| Artifact | Bytes | SHA256 |
|---|---:|---|
| wine-assembly.compat.wasm | 1882918 | `2ef31d69863914161bf3b37c330ae56d2968cda57444d3c6d7ba09a270910421` |
| wine-assembly.wasm | 1880345 | `b6cdde8dfa78bfcce22694127636ce1ad6714ac92df0e1182b7377005b58d758` |

## Preservation and lifecycle

Recovery evidence archive SHA256 `01bf6558dbf5843d3770e8979deb016e695d9e40fde5e886dc75aec1281ab5cd`, 1594623 bytes, retains the complete original build/startup/driver stdout and stderr, guard JSON, exact manifest/control/supervisor and both modules. The box is **stopped**, snapshot completed and verified `2026-10-27T21:25:36.738Z`, stopped at `2026-10-27T21:25:36.784Z`. This task had explicit delegated snapshot-stop authority. No assigned box remains running.

Canonical manifest: `/tmp/airstrike-accepted-compiler-canonical-build-oct27/ops/receipt-manifest.json`. Separate ignored recovery copies: `/home/user/wine-assembly/scratch/usage-watch/airstrike-accepted-compiler-canonical-build-oct27/build-source.tar.gz`, `recovery-evidence.tar.gz`, `source-manifest.json`, and `task-evidence.tar.gz`. Git does not retain those binaries; preserve that directory or the verified box snapshot. To recover without a build: extract build-source.tar.gz into a new owned directory, then recovery-evidence.tar.gz separately. Verify all hashes against the manifest and module-artifacts.json. The build archive includes minimal real Git objects and the exact changed source. The committed build-only helper documents the actual invocation; it is not authorization for a replay and expects the owned remote directory layout. Any future execution requires a new explicit assignment/admission and unchanged policy gates. Root refs/index/tracked files and donors remained read-only; only append-only messageboard updates were made there. Setup/receipt-label/terminal incidents are retained in ops/incidents.md.
