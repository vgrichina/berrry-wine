# Public child mip overwrite: complete bounded WebGL matrix

PASS in one browser attempt after published `abbae05c5`: both pinned modules,
queued Worker and direct backends, explicit WebGL1 and WebGL2. The repaired
stale-child-upload negative ran first, before any positive cell, and failed
the changed-color oracle after successful public draws/readback and verified
public child writes. All 24 rendered negatives were rejected as intended.
No production defect or production change was needed.

The fixture now runs that repaired negative first and records the exact
injected script URL, byte count and SHA-256 in each negative result. Cheap
HTTP controls additionally prove ordinary requests receive the unchanged
production body. The existing pathname repair covers both the unversioned
page URL and `/lib/d3dim-gpu.js?v=legacy-texture-public-com`, the actual Worker
import. Both injected bodies were 56,829 bytes with SHA-256
`9fc0da4f5628a07c198e4585b251d625d8039b278004781ec0082c53137357ab`.

| Module | Backend | Explicit version | Observations / draws | Rendered negatives |
| --- | --- | --- | --- | --- |
| canonical | queued Worker | WebGL1 | 25 / 21 PASS | all 3 PASS |
| canonical | queued Worker | WebGL2 | 25 / 21 PASS | all 3 PASS |
| canonical | direct | WebGL1 | 19 / 15 PASS | all 3 PASS |
| canonical | direct | WebGL2 | 19 / 15 PASS | all 3 PASS |
| compatibility | queued Worker | WebGL1 | 25 / 21 PASS | all 3 PASS |
| compatibility | queued Worker | WebGL2 | 25 / 21 PASS | all 3 PASS |
| compatibility | direct | WebGL1 | 19 / 15 PASS | all 3 PASS |
| compatibility | direct | WebGL2 | 19 / 15 PASS | all 3 PASS |

Every positive cell sampled `[0,0,255]` before overwrite and `[192,48,224]`
afterward, following public Lock/Unlock on the acquired 4x4 level-2 child.
A second public lock verified every written pixel and retained backing/pitch
16. Every stale-upload negative retained `[0,0,255]` after those verified
writes while independently expecting `[192,48,224]`; its actual-pixel failure
was required. The two original level-zero-only and stale-filter negatives
also reached successful public draws and discriminating pixel failures.

All four Worker cells retained the three held-batch transitions, with live
sampler changes before drain, 21 draws/fences/readback syncs, 6 texture uploads,
and zero errors, fallbacks or native/fallback software draws. Each cell kept
five perspective observations and the independent analytic LOD oracle. Maximum
channel error was 0.5 at unchanged tolerance 2. Direct cells additionally
checked actual `gl.readPixels`; Worker cells used production fence/readPixels
and verified backend/API identity and actual requested WebGL VERSION.
Public x86 vtables, guards, stdcall checks, five mip levels and formats remain
in use. No fixed LOD, Wasm patch, fixture export or production sampler oracle
was added.

The single Chrome 151.0.7922.108 attempt ran from 04:17:09.729Z through
04:17:33.163Z (23.434 seconds), without retry or a second browser. CDP reports
Vulkan SwiftShader/Subzero driver 5.0.0, while actual GL renderer strings report
Intel UHD 620 ANGLE/Mesa. Both reports are retained; physical GPU attribution
is unknown. This is fixture coverage, with no physicalGPU or full27 claim.
Non-solid texels/within-level filtering discrimination, partial or malformed
chains, other formats/padded pitches, combined filters, other dimensions and
games remain unexecuted.

Run: `scratch/runs/20261104-legacy-public-mip-stale-upload/`.
Baseline: `2b7c8a1ffb28fe4e7ec861ea05ee81028f7727c2` plus `relevant.patch`;
the new note is preserved as `owned-note.patch`. The minimal predecessor
runtime was reused; only the owned fixture and source manifest were uploaded.
All 36 staged inputs were SHA-256 checked before and after execution.

- Canonical: 2,143,712 bytes,
  `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
- Compatibility: 2,146,325 bytes,
  `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`.
- Existing calc bootstrap:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

Before Chrome: exact injected URL bodies/no-store/isolation controls,
ordinary-body controls, planner/seams/oracle/options, both module hashes,
both public bootstraps and actual module HTTP bytes/isolation PASS. Afterwards:
independent evidence assertions over all eight cells and 24 negatives, test-tier
membership/regression and locked full build PASS; both module hashes unchanged.
Eighteen stable unique logs/captures/results/modules were recovered with sizes
and full SHA-256, after helper closure. Browser and driver absence and all
source pins were verified before the 04:28Z deadline. The canonical Worker
WebGL1 capture was personally viewed; pixel claims use recorded readback.
No source archive or media evidence copies were made.

Assigned box `bx_4hx68dxv` remains RUNNING/APIidle, healthy/hydrated, expiry
`2026-11-04T04:38:03.251Z`. Lifecycle/shutdown ownership returns to the
coordinator. No lifecycle action, subworker, local heavy runtime, successor,
public deployment or Heroes II work was performed. All requested fixture
cells are closed; the remaining unknowns above are outside this run.
