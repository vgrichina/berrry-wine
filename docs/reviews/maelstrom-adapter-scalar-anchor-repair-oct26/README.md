# Adapter scalar and return-anchor repair

Starting review: `568a0a4825a29e75ecabc26594f8ecef1e4c3d3f` (tree `ae463966406b440b9fad4d9db3f50dfeac2aad25`). Source/fixture-tested tree: `40265be422da898146ea0afaaca9d69cb1ace2d3`.

The adapter validates every raw native, select and diagnostic scalar as an integer in the signed-i32/unsigned-u32 union before conversion, native start, live observation or persistence. Missing/nonfunction exports fail construction; all-absent diagnostic exports retain legacy compatibility. Snapshot errors close the adapter, including on unchanged native fields. Each observation reads one snapshot and publishes that same snapshot; callback count/order and captured zero/nonzero errno remain intact. The standalone decoder continues to consume validated unsigned snapshots.

Rejection expectedReturn must equal the original binary's select-return anchor. A shared immutable original-PE mapping now supplies the binary verifier, loaded-image verifier and decoder: original SDL_net preferred VA 0x10001362 maps from preferred base 0x10000000 to the already-required original loaded base 0x7a2000, giving 0x7a3362. This mapping is trusted source configuration, independently checked against pinned binary bytes and relocated loaded bytes, never a diagnostic or another self-reported export. It does not introduce an emulator allocator base or support arbitrary alternate guest mappings. Existing relocation/IAT checks remain intact.

The unchanged independent reproducer goes from the retained historical **6 PASS / 13 FAIL** to **19 PASS**. Its SHA-256 remains `8483dd85879c25d32c78125251741db6fd53248ed5d14b4f632e07777f19a401`. All existing **41 groups** pass: 14 rejection groups including 511 failure combinations, 13 latch, 6 snapshot, 7 adapter and the original AST preservation control. New regression: **13 groups / 3,474 cases**, covering every scalar family, malformed/partial exports, signed endpoints, zero/nonzero capture, legacy callbacks, unchanged-state validation, closure after errors, single-sample publication, forged/zero/wrong anchors and valid authentic rejection diagnostics. An additional preservation control confirms byte-identical complete generated WAT, unchanged pins, oracles, reproducer and historical result bytes.

Run the existing fixtures and `test/maelstrom-adapter-scalar-anchor.test.cjs` with installed Node, heap 128 MiB, CPU/wall 60 s, file 24 MiB, combined output 128 KiB, TERM/KILL/reap 5 s. Set:

```
MNE_SOURCE_ROOT=/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/pinned-source
MNE_ORIGINAL_ROOT=/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom
MNE_CRT=/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll
MNE_REVIEW_REPO=<this checkout>
```

For the unchanged independent reproducer, run a byte-identical copy from an owned evidence directory: it writes its result beside itself. Keep the original review's historical result unchanged. The task's `ops/run.py` and `ops/exec.py` retain bounded supervisors. Historical b41a7c5 source root/12 pins and original accepted evidence are reused in place; no current-source substitution or seal repackaging.

Evidence here retains historical failure results, repaired results, command receipts, preservation proof and resource/incident records. Consolidated publication and cleanup receipts: `/tmp/maelstrom-adapter-scalar-anchor-repair-oct26/ops/result.json`, `evidence-manifest.json`, `publication.json`, `tested-tree.json`, `RECOVERY.md`. Task allocation is 64 MiB including 8 MiB reserve, actual symlink blocks, session/launcher logs and conservative shared database charges. The initial admission's tree label was the predecessor source tree; setup asserted the actual review tree before checkout. Inspection truncation, the reproducer output-path restoration and one corrected sparse staging rejection are disclosed in incidents.json.

These are synthetic adapter-boundary repairs and source/fixture tests. They do not show malformed i32 output from authentic Wasm or identify authentic batch36170/status5 cause, which remains **UNKNOWN**. No compiler, Wasm instantiation, native/guest/browser/Boat execution, main integration or deployment. Fresh independent review and exact changed-module canonical/static ABI/layout/native qualification remain required before any guest. Runtime lifecycle stays with the coordinator; bx_k38z8byn was reported stopped and was not accessed.
