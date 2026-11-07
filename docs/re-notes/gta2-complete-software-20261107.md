# GTA2 software qualification: first new blocker — 2026-11-07

No original GTA2 launched. The corrected dependency inventory and app-local
Miles URL passed, as did generated production COM/vtable and input controls.
The first new blocker is the browser software-owner preflight: it found zero
legacy/software endpoints, so qualification stopped before native COMCTL or
the original. No walking, vehicle entry or driving is established. Existing
WebGL proof `27fdd86e9` remains separate.

Evidence: `scratch/runs/20261107-gta2-complete-software/`.

The run-specific recipe now includes `tools/protected-writer-entries.js`, checks
the complete `render-artifact.js` identity inventory, follows static relative
JavaScript dependencies and refuses missing explicit inputs instead of silently
filtering them. This local check also caught and removed a stale `style.css`
entry. Miles uses its actual app-local URL:
`/binaries/candidates/gta2-demo/installed/Program_Executable_Files/mss32.dll`.
The boat returned HTTP 200 with the pinned SHA-256 for both Miles and COMCTL32;
no `/null` request occurred. Each remote prerequisite was checked before the
next step. The failed software preflight was neither retried nor followed by
another guest launch.

The generated guest-x86 public COM/vtable Surface4/7 control passed, including
the production method tails and legacy versus DX7 matching regression. Balanced
production renderer/DirectInput controls and invalid-duration zero-effect
controls passed locally and remotely. Local atomic transport and executor
controls also passed. Chrome's about:blank preflight recorded five balanced
trusted arrow/Enter pairs; invalid holds produced zero events.

At 02:03:56.090 UTC the software-owner assertion failed with `0 !== 1`.
Personally reviewed `retrieved/software-qualify/startup.png` shows an empty teal
desktop, the Program selector displaying Notepad and Software/Threads selected.
Its state records `apps: []`, `workers: []` and `owningRenderer: []`. The
run-specific qualifier intended to select the registered SDK Boids control and
clicked the toolbar Launch button at 02:03:38.020 UTC, but no guest launch was
established. Its inherited `launch.json` app field says `gta2_demo`; that label
does not establish an original launch. The qualifier was in SOFTWARE_QUALIFY
mode and its source selects `dx_boids`. No guest EXE response or guest log
followed. Selector/launch readiness is the next issue to qualify; an
initialization race is a possibility, not a demonstrated cause. There is no
evidence of a rasterizer or emulator defect and no production repair.

Source staging commit is `e9fc18bb3a3c22b96e64d21791b822e3f254e7e0`.
All 693 staged file pins matched before and after. Git SHA plus relevant dirty
and new-file patches identify source without a source-tree archive. Existing
standard/compat modules are pinned, but no browser guest module executed or
was retrieved. The COM harness compiled through its canonical helper; this
does not assert that the full production build ran. No production code changed.

All 69 registered GTA2 media paths plus the installed EXE and Miles DLL were
present and hashed. EXE: 2,893,824 bytes,
`97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3`.
Miles: 331,776 bytes,
`0974b244354a5d13e0711db15430c05f7949dc279b63897146f304d1401153fc`.
The historical 73-payload distribution and upstream provenance remain
unreconstructed. Guest/media/config/save bytes were preserved.

All 38 inventoried remote artifacts were retrieved or verified against exact
local bytes. Earlier partial console/HTTP observations remain separately named;
the final versions were retrieved and verified. Controller PID 6542 and Chrome
PID 6554 are absent, HTTP port 43157 and debug port 34075 refuse connections,
and the profile and writer lock are absent. Chrome exited normally with code 0.
The template cleanup string `UNKNOWN; never replay` is a generic terminal policy,
not an original input outcome; no original commands existed.

One fresh boat, `bx_27cz2e3r`, was allocated using a UUID Idempotency-Key
persisted and fsynced before create. Explicit delegated normal stop
`stop_a0fe8d42dd3e7bf2` completed at 02:04:23.654 UTC with `forced=false` and
`error=null`; the boat is archived with active expiry null. Allocation through
retrieval and completed stop took approximately 94 seconds, below 35 minutes.
Local free disk remained above 2 GB. No automated safety flag occurred.

No local runtime/source/build lane, nested worker, old403 resume, held-risk
retry, deployment or source/media archive was used. Findings only; no combat,
audio, FPS, parity or full27 claim. A future authorized attempt must first
qualify selector/launch readiness and actual software-owner completions, then
the ordinary native COMCTL flow, before starting the original.
