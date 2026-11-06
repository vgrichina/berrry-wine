# Ordinary Device3/Device7 vertex-buffer ranges, 2026-11-06

`D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013`: the tested ordinary VB range cases
match documented valid-input semantics. No emulator mismatch was reproduced;
no production code, capabilities, guest code or media changed. The existing
Device3 test now has an explicit `--public-ranges` mode. Its historical default
remains available. Evidence: `scratch/runs/20261106-legacy-vb-range-rendering/`.

The historical test exercised extracted handlers at start zero and accepted
some changed pixels. Existing dimensional/PVS fixtures already exercise Device7
nonzero starts, sparse relative indices and queued reuse. The new coverage is
the combined public x86 COM Device3/7 path with independent exact pixel samples,
Device3 sparse indices above index-count, count versus backing capacity for
nonindexed draws, and two different buffers/ranges pending together. It does not
claim those existing Device7 mechanisms were previously untested.

The [1999 SDK indexed-VB reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_1mas.content.htm)
defines Device7 indices relative to the declared vertex range, in
`[0, dwNumVertices-1]`; the
[ordinary-VB reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_3d0k.content.htm)
defines start and vertex count. Microsoft's
[interface declarations](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3d.h)
also establish that Device3 indexed VB drawing has no start/count parameters,
whereas Device7 has both. Copies of these references are retained in the run.
Unlocked system-memory TL buffers, legal WORD indices and flags zero were used.
No invalid-call HRESULT expectation was inferred from implementation behavior.

Each device uses capacity-15 buffers with distinct selected triangles at starts
3 and 8. Nonindexed count is 3; Device7 indexed count is 5 with sparse relative
indices `[4,0,2]`. Device3 uses absolute buffer indices `[start+4,start,start+2]`,
which are distinct from an index-count-sized vertex range. Poison triangles fill
unused capacity. Red left and blue right triangles have asymmetric geometry.
Ten hand-authored interior/exterior pixel positions per readback distinguish
each triangle from poison and clear pixels without using emulator rasterization
or vertex-selection helpers to calculate expectations. Full readback RGBA is
retained, but the oracle asserts these ten samples, not every target pixel.

The queued path holds the first submitted packet while the second remains in
the producer buffer. It verifies the changed producer slot, independent colors
and an incomplete first sequence, then overwrites both buffers through public
Lock/Unlock calls and overwrites index memory before draining. Both regions must
retain their original pixels. This respects actual queue transport: enqueueing a
small second draw does not imply a second packet has already been posted.
Public calls check expected HRESULTs, output guards, stdcall stack restoration
and caller return execution through the reused public COM fixture.

Final matrix, 08:11:16–08:11:21 UTC: **PASS** on both shipped modules for software,
direct WebGL1/2 and owning queued Worker WebGL1/2 (10 positive cells). There were
160 draws, 120 readback checkpoints, 1,200 sampled RGB pixels and 16 held pairs.
Queued cells reported zero software/fallback draws. Four semantic negative
controls all failed the independent pixel oracle after successful public draws:
ignored start, count expanded to remaining capacity, absolute Device7 indices,
and overwritten buffered second draw. These mutate test inputs/queue bytes;
they are sensitivity controls, not reproduced emulator defects. Eight positive
PNG readback tile sheets were visually reviewed.

Source/module identity:

| Item | Identity |
| --- | --- |
| Pre-edit main | `eb6624a08bc5251c2a756ceb271a7b6bc78d8a63` |
| Final matrix HEAD | `113c0817ec23c22b7708996dca32db4ec274b6fb` |
| Standard, 2,178,481 bytes | SHA-256 `41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f` |
| Compat, 2,181,127 bytes | SHA-256 `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a` |
| Bootstrap PE | Existing `test/binaries/calc.exe`, SHA-256 `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b` |

The fixture hashes fetched module bytes before compilation and reuses that
compiled module for CPU/render Workers. It pins/rechecks 291 source/test files;
`ranges/range-controls.json` contains identities, COM receipts, pixels and queue
snapshots. `final-tested-diff.patch` recovers the final test edits from recorded
matrix HEAD; the new note has its own patch. Git is the source archive.
Chrome was `151.0.7922.108`; actual GL strings identify WebGL1/2 and
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
SwiftShader launch flags do not establish the actual backend. Native Windows,
other hardware/backends and gameplay are unqualified.

Validation and bounded stop:

- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS before the matrix.
  Later edits corrected only the test harness; production source stayed unchanged.
- `node --check test/test-d3dim-v3-vertex-buffer-draw.js`: PASS.
- `node test/test-d3dim-v3-vertex-buffer-draw.js --public-ranges`: final PASS;
  requires `LEGACY_VB_RANGE_EVIDENCE` and an absolute ISO
  `LEGACY_VB_RANGE_HARD_CLOSE` with cleanup margin.
- Historical `node test/test-d3dim-v3-vertex-buffer-draw.js`: PASS.
- `node test/test-legacy-dimensional-vertex-buffer.js`: FAIL at 08:11:55.734377 UTC,
  before drawing, on the unchanged `test-legacy-public-mip-webgl.js:134/192`
  unique string-replacement seam (`1 !== 2`, `PIXEL ORACLE` anchor). Its dependency
  stack does not load the edited Device3 test. The three relevant fixture files
  have no changes against HEAD. This was the first unresolved prerequisite;
  further tests/builds/runtime stopped. Planned PVS, texture-stage-alias and
  GPU-batching neighbors were not executed. Repairing that fixture is separate
  follow-up work; this task makes no whole-neighbor-suite pass claim.

Two earlier harness attempts are preserved separately. The first lacked
cross-origin isolation headers on the custom fixture response and failed Worker
module transfer before drawing. The second incorrectly expected two submitted
packets rather than one submitted plus a buffered successor. Both concrete
harness prerequisites were corrected before the passing matrix. No unchanged
run was repeated; no renewed safety flag occurred.

Exact KKnD0640, Lords2FirstDestroy0700, then AoWWorkerDrain0725 FINAL releases and
their cleanup were independently checked before shared edits/build/runtime.
The immutable local window was 08:07:56.211446–08:52:56.211446 UTC; the holder and
runtime watcher closed at 08:13:02.296952 after the neighbor failure. Final
cleanup and publication receipts are in the run. No boxes were used; box
ID/state/expiry are N/A. No stopped D3D9 clip-status or sparse-client work reopened.

Remaining semantic gap: valid indexed inputs cannot establish rejection behavior
for an index outside the declared range but inside backing capacity. A precise
documented invalid-input contract or native reference is needed before adding
that expectation. Nonindexed count versus capacity is tested here. Restore the
unchanged neighbor fixture prerequisite before running the remaining neighbors;
do not repair production from the static range-check question alone.
