# Scoped D3D native qualification, 2026-10-23

**BLOCKED before compiler launch: MemAvailable 2,594,131,968 < required
2,684,354,560 bytes (shortfall 90,222,592).** One failed heavy-phase admission,
zero unchanged retries, zero compiler processes, zero Wasm/native processes.
Neither suite nor its native rejecting controls executed. No module, native
oracle, arena reuse, gameplay or shipping build PASS is claimed.

The private candidate starts at exact main
`5406777ecbcef9cf9b03b40d592d722bb0086de0`, containing feature `fd5e3fc9`
and repair `773e6112`. Its sole existing-source delta is the accepted
`test/test-d3d-software-compaction.js` from unmerged fixture
`09dc88de08907d362eef2ac5dbbaad0080147358` (blob
`883291df8482c5ee0571c9a23aa4001dc8408821`, SHA-256
`01b47b380da7c3d134175b0d7d1e666e2b0bad1f29d093ad85cedd0ebd148543`).
Production `src/` and `lib/` have empty diffs, including the whole-large-arena fix.
The arena-reuse test is unchanged. There was no main integration.

## Admission and executed scope

The initial consolidated disk admission passed at **63,050,349 / 67,108,864
new bytes**, including 16,777,216 future database/session/log growth and 8,388,608
reserve. Projected host remaining was 3,852,892,413, above 2,982,150,144.
The private peak allowance was 36,747,749: source checkout 23,707,757, pinned
pngjs 63,864, Git metadata 2,097,152, one sequential module 8,388,608,
manifest 131,072, logs/evidence/publication 2,097,152 and prepared
wrapper/control/scripts 262,144. No concurrent two-module retention was planned.

The supplied 183-file, 23,421,868-byte inventory was verified against exact Git
objects and extended by 22 demonstrated adapter/provenance-gate inputs, to 205
files. This includes dynamically loaded `test/compile-src.js` and the exact
compiler provenance gate's required files. All 23 standing pngjs files were
rehashed against the supplied receipt and copied without acquisition. Installed
Node ran in place. Full compiler/loader/adapter/stage identities and a byte-exact
whole-loader excerpt recipe are retained in `compiler-identity.json`.

A shared no-checkout private clone used explicit non-cone file patterns before
`read-tree -mu HEAD`; selected file hashes were then checked. These exact-source
gates passed under Node heap 256 MiB, CPU/wall 60 seconds and fresh
MemAvailable >=805,306,368:

- Manifest equality: all 127 WAT fragments in sorted include order.
- Per-fragment structural balance, passing every exact WAT path explicitly.
- Vendored compiler provenance: all 23 required files match; manifest/changelog
  seal passes.

These are diagnostic source/compiler gates, not `tools/build.sh` or a complete
shipping build. The accepted independent source/protocol and fixture reports
were read as standing inputs; their export doubles were not rerun or counted
as native evidence.

The first planned preparation command used the installed Node v24.18.1 path,
`--max-old-space-size=2048`, the exact compaction entrypoint and actual
`WINE_RENDER_ARTIFACT_PREPARE` interface. Its fresh memory gate rejected before
`Popen`. There is no PREPARATION ONLY result or artifact. The separately planned
consume phase had heap 512 MiB, CPU/wall 150, MemAvailable 1,610,612,736, fixed
512 MiB guest memory, zero Workers and no compile fallback; it never launched.
Both different-extraWat modules and engine/module/compiler execution identities
remain unqualified.

Actual assertions were read: the repaired compaction suite tests retained late
failure atomicity, streaming late failure against a separately rendered two-batch
prefix, unchanged published samples, baseline accounting, empty pending/live
contexts, exact successful samples/pixels, and allocator-visible compacted tails.
The unchanged arena suite checks whole large block shrink/reuse and three
rendered draws reusing one context address. None passed natively here.

## Accounting, guard and recovery

The coordinator baseline records 791,378,392 standing SQLite bytes. Standing
databases are excluded from new task storage; positive observed increases,
replacement/new DB/WAL/SHM files and all task sessions/events are charged.
The guard accumulates positive growth across observations with no shrink
credit and records external-file high water, standing initial/final size and
host free. A 16 MiB conservative future allowance remains in every command
projection. Databases were not modified, checkpointed or deleted.

The preprepared wrapper/control bytes count as this task's bytes. Before checkout
the wrapper gained projected allocation/host checks, exact Node heap validation,
external high water, serialized accounting and an additional 131,072-byte direct
output allowance above the initial 65,536 inspection reserve. Child output is
incrementally bounded at aggregate 524,288 before buffering; per-file limit is
25,165,824. The supplied 32-byte rejecting capture control is retained honestly,
including its pre-dispatch corrected constant-scoping typo. It is a capture
control, not native evidence. No changed native path was executed after denial.

Adjacent evidence includes `admission.json`, complete selected source/compiler
identities, `checkout.json` with full fixture diff, `execution.jsonl` for executed
commands, `first-phase-denial.json`, baseline, capture control and final accounting.
The installed Node executable is sealed in the inventory; host/shared-library and
standing storage identities are retained in `standing-inputs.json`.

Recovery scripts `plan.py`, `setup.py`, `native.py` and `guard.py` document the
exact commands. Original private recovery location:
`/tmp/d3d-scoped-native-qualification-oct23`; ignored copied pngjs and the checkout
are reproducible from the sealed standing donors/codec receipt. Do not blindly
rerun `setup.py` into an existing checkout or retry the denied command unchanged.
Resume requires coordinator authorization after observable sufficient memory,
fresh phase/storage/capture admission and revalidated exact inputs. No allocation
increase, acquisition, redesign or preparation-only task chain is requested.

The blocker owner is the coordinator's resource scheduling. Box ID/state/expiry
are N/A; no boxes or workers were launched. Coordinator retains lifecycle
ownership. Shadow Man 128 MiB hold and original Airstrike/Penguin SSH403 remain
unchanged. Publication is task-branch-only using strict trusted SSH, with actual
remote SHA verified and recorded on the append-only messageboard. This task stops
after preserving this result.
