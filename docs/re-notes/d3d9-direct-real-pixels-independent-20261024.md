# Independent D3D9 actual pixel review, 2026-10-24

**Reject publication/qualification at `28e5521f5e31a1cf7ee6c92b646816cc7ea784b8`; do not integrate into main.** The retained local execution evidence is consistent and its saved pixels pass independent decoding. However, the immutable reviewed commit omits **all 40 PNGs** named by its sealed manifest. Its evidence directory tracks only 15 files. The original note's assertion that portable PNGs are committed is unsupported. This is an artifact publication defect, not evidence of a production rendering defect.

## Reproducer and resume condition

From any repository containing the reviewed commit:

```sh
git ls-tree -r --name-only 28e5521f5e31a1cf7ee6c92b646816cc7ea784b8 -- docs/re-notes/d3d9-direct-real-pixels-20261024-evidence
python3 tools/verify-d3d9-real-pixel-evidence.py docs/re-notes/d3d9-direct-real-pixels-20261024-evidence
```

The first command lists 15 files and no PNGs. On the reviewed tree plus this independent verifier, the second exits 1 because `intermediate-stencil-rectangle-origin.png` is missing. The manifest seals 52 files, including 40 PNGs. [Exact missing paths](d3d9-direct-real-pixels-independent-20261024-evidence/publication-defect.json) are retained. PNG bytes still exist in the read-only donor worktree `/tmp/d3d9px25/repo/docs/re-notes/d3d9-direct-real-pixels-20261024-evidence/` and original `/tmp/d3d9px25/run/`; their bytes match. Coordinator may assign publication repair that actually tracks the existing exact bytes, followed by final-tree verification. No browser rerun is required by this finding. This task stops without repair or main integration.

## Execution evidence findings

| Variant | Passed/56 | Failed | Numeric pixels | Mismatched pixels |
|---|---:|---:|---:|---:|
| candidate | 56 | 0 | 3200 | 0 |
| producer historical Device | 55 | 1 | 3200 | 64 |
| intermediate historical GPU | 50 | 6 | 3200 | 384 |
| rectangle mutation | 49 | 7 | 3200 | 363 |

All four raw variant JSON files agree with numeric aggregation and summary: 50 pixel checks and six passing capability/validation checks each, no errors, identical unique check names. No capability failure is counted as intended control rejection. All 52 local seals pass. JSON, Chrome log, cleanup receipt and every PNG match the standing original run bytes.

The independent standard-library verifier decodes all 40 retained 8×8 RGBA PNGs, validates chunk CRCs, dimensions and filters, and compares every saved pixel and first-mismatch coordinate to independently specified expected values. This checks **640 saved pixels per variant**; the other 2560 observations per variant are available as numeric checks only. Thus numeric aggregation of 3200 pixels is verified, but independent decoding of all 3200 is not claimed. Independent checks use half-open top-left rectangles: red/magenta `(1,1)-(3,4)` has six pixels, depth `(1,1)-(4,3)` six, stencil `(4,3)-(7,6)` nine. Six representative candidate/control PNGs were also inspected with the image tool: clipped magenta versus full magenta; wrapper default green versus producer blue; named quarter-depth blue versus intermediate green.

Producer fails only `wrapper-default-one-after-quarter`. Intermediate fails named format-80/75 fresh and retained quarter-depth plus implicit format-75 fresh and retained stencil-52. Rectangle mutation fails seven clipping/retention/empty-region checks. [Independent results](d3d9-direct-real-pixels-independent-20261024-evidence/pixel-verification.json) report acceptance of the **local receipts**, not acceptance of the incomplete Git publication. [Corruption tests](d3d9-direct-real-pixels-independent-20261024-evidence/corruption-tests.json) reject missing PNG, bad PNG CRC despite updated seal, vertical flip despite valid CRC and updated seal, and altered numeric aggregation despite updated seal. No production implementation is imported or executed by the verifier.

## Source and execution binding

Standing accepted source `0e927b73b64b29931f83d1e9ed77282c5b1bf731` is unchanged. Candidate GPU SHA256 `f0d70cfe6418d3297a4f414a7d4980e3cf279c0ee000bc923c0b0481cce1589d`, Device `ba5063750e6c8caf684f6ce72c7b91437539e4e49008c3111f5978d3752c6773`, fixture `d16a5ea580ae07c9ecb93c6b1a96c611fbf1b1fc2281648fad8f9853e0c880bf`, dependencies, CDP and supervisor match accepted Git blobs and standing files. Producer substitutes only Device from `ffe822a9d50ad79439330609915eb84475acd2bc`, hash `9ffb72da84b68d2b44879142f79651a9bbd3167ccc42cbddacf94add172a62d1`. Intermediate substitutes only GPU from `77180c76b312efe465ad91e60286d40330d77d0d`, hash `5b02eb42dd21e02f0dc01bea589a121456e28fcf1dbcf42b5a647efa5181d1dd`. Exact one-anchor rectangle mutation hashes to `e4eb569b0466ae0d03825db46355222d5694030ae18b2307f8e41f4116643a1f`. [Bindings](d3d9-direct-real-pixels-independent-20261024-evidence/source-bindings.json) retain identities. Harness inspection confirms each variant evaluates its full dependencies/GPU/Device source snapshot before fixture execution; no require/network source cache participates. Accepted offline oracle/supervisor tests were not rerun.

Reused supervisor receipt: one accepted Python invocation, exit 0, wall 2.952 seconds, aggregate CPU 1.911436 seconds, no remaining descendants. Prior capture 1125240 plus 624159 new bytes equals 1749399 ≤ 2173816; original histories and resource/SQLite receipts remain retained. No sandbox bypass; renderer security samples are empty, so per-renderer seccomp/NoNewPrivs is **not verified**. Renderer is ANGLE Intel UHD 620/Mesa 23.2.1, WebGL2, Chrome 151. Scope is Device/GPU/direct GLSL only: no guest, COM, full-module, gameplay or hardware-universal qualification.

## Worker controls

Fresh noncone sparse repository uses read-only alternates; donor/root tracked files, index and refs remain untouched. Nested alternate warnings are retained separately from blob stdout, with exit statuses checked. Strict coordinator-provided SSH verified remote main `12dd6ea7861ac7608a45afb40d404fdc68990681` and donor task `28e5521f5e31a1cf7ee6c92b646816cc7ea784b8`. No main source qualification is asserted: integration/source reconciliation stopped on the publication defect. Only this independent report, small verifier and review receipts are added on the owned task branch. No shared main integration lock or main push is needed for a rejection.

Initial [resource admission](d3d9-direct-real-pixels-independent-20261024-evidence/admission.json) projected 33923072/67108864 bytes including full external session/events, positive SQLite growth allowance, future growth and 8 MiB reserve; projected host free 3662299136 ≥ 2982150144. Standing inputs/tools are separately counted; no install, compilation, copied executable or links. Final local resource/cleanup receipt accompanies publication. No browser/guest/box/build/acquisition/deployment or worker was launched. Box ID/state/expiry N/A; coordinator retains all runtime lifecycle ownership and the Enigma/Maelstrom lanes.
