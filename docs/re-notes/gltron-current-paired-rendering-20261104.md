# Original GLTron 0.70: current-main paired rendering, 2026-11-04

The two sequential browser gameplay arms reproduced no concrete trail/shadow
rendering defect. No production code, original media or guest configuration was
changed. Intentional black non-stencil shadows and persistent crash/winner console
history were retained. Stop condition reached; no speculative repair follows.

Evidence is in `scratch/runs/20261104-gltron-current-paired-rendering/`.
`investigation.json`, `checks.json`, per-arm commands/replies, screenshots with
state samples, HTTP byte receipts and recovery manifests record this run.
GLTron has no candidate-corpus manifest entry, so evidence remains linked here
instead of being attached to another candidate's dashboard card.

## Exact inputs and prepared runtime

The source pin was main `2e802c7dfbb41dec726b7e69d580aba316cc48d2`, after the
requested `c625f8f33` checkpoint. All 1,409 selected tracked source/runtime paths
matched the prepared box byte for byte before launch. Runtime source also matches
the committed D3D mip repair `de461ff9a370e8defe89a76544665410e17f0b0b`.
`source-pins.json` records full path/size/hash identities. Both
`relevant-source.patch` (working tree against HEAD) and `from-runtime-commit.patch`
(relevant tracked source against de461ff9a) are empty binary Git diffs.
Later shared-main advances during this task were documentation changes.

Both actual instantiated modules were canonical Wasm SHA-256
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`,
2,143,712 bytes, compiled and instantiated in the page realm. The actual module
bytes are retained once in `software-gameplay/actual-1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58.wasm`.
The prepared compatibility companion, retained as `compatibility-unexecuted.wasm`,
is SHA-256 `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`,
2,146,325 bytes; it was not executed. These are the prepared DR2 repair build's
bytes, not the older GLTron modules in the October notes. No rebuild was needed
for this documentation-only result.

Original `APPS.gltron` was selected and launched through the existing launcher.
The missing picker option was added for that existing registration only. The
complete local `test/binaries/gltron-0.70/` payload passed all 92 registry hashes
and sizes, totaling 4,968,893 bytes, matching the accepted original inventory
identified by `0f5c45647ac8d26104d01d4e052913382aaa9d73a3c6bc31339529a60508b341`.
Executable SHA-256:
`85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec`.
The box lacked this payload, so the verified files were transferred individually
to its existing `test/binaries/gltron-0.70/` path. No installer ran. HTTP rewriting
maps the registered `/binaries/` URLs to `/test/binaries/` without changing bytes.
Both arms served all 92 original files with matching hashes; all 1,504 runtime,
module, media and shared-DLL pins remained unchanged afterward. The final tree
contains exactly 92 regular original files and eight directories.

Media is referenced by path/hash in `media-pins.json`, not copied into evidence.
Git plus the recorded diffs is the source archive; no source tree tarball was
created. The separate shared `test/binaries/dlls/msvcrt.dll` was also pinned
(`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`).

## Actual rendering and inspected gameplay

Chrome 151.0.7922.108 ran only on the assigned box, at 1200×900, with isolated
shared memory, cooperative guest scheduling and frozen 16 ms host steps. Each
acknowledged step request was at most 64 slices. Neither arm had a guest Worker
or render-worker endpoint: actual rendering belonged to the page's
`Bridge.local` / `OpenGLHostBridge`, not the unrelated visible D3DIM GPU selector.
Read-only host-reference diagnostics identify these objects in `renderer-read.json`.

| Observed final counter | Software arm | WebGL arm |
| --- | ---: | ---: |
| Frozen steps | 2,992 | 3,000 |
| Software enabled | 1 | 0 |
| Software triangles consumed | 506,015 | 0 |
| Software lines consumed | 14,288 | 0 |
| Software presents | 622 | 0 |
| WebGL drawArrays | No WebGL context | 108,614 |
| Trusted paired keyboard actions | 9 | 9 |

Software uses the owning main instance's WAT rasterizer, with its context marked
`software: true`. Counts rise from 72,509 triangles / 176 presents at the paused
arena to the values above. WebGL owns an actual `WebGLBackend` and WebGL 1 context;
drawArrays rise from 5,899 in the intermediate ownership sample to 108,614, while
all sampled software counters remain zero. Final WebGL GPU-layer sequence is
453. The context reports ANGLE / Intel UHD Graphics 620 / Mesa 23.2.1. This
identifies the API/context, without independently qualifying physical GPU use.

Personally inspected the following concrete comparisons, under each arm's own
`software-gameplay/` or `webgl-gameplay/` directory:

- `main-menu.png`, `game-submenu.png`, `paused-arena.png`: original menus,
  native Return navigation and the yellow cycle on the arena grid.
- `moving.png`, `left.png`, `right.png`: moving cycle, native A/S camera
  orientation changes and bent minimap trails. Yellow/red trail faces retain
  their color; the floor grid remains continuous beside opaque black shadows.
  Software's distant grid is more visibly aliased; WebGL's distant grid is
  softer. No October-style white trail replacement or diagonal floor wedge was
  established by these comparisons.
- Software `approach.png` → `impact-check.png` → `outcome-check.png`:
  player one approaches a red trail, collides, and produces a bright impact
  with yellow/black debris. WebGL `right.png` and `approach.png` show player
  four's collision/debris; `outcome-check.png` shows player-one debris after
  reaching the red trail. The file named `impact-check.png` in WebGL is still
  an approach frame, not the collision peak.
- Each `round-outcome.png` shows PLAYER 2 WINS. This happened in both arms,
  but their opponent trajectories and crash ordering differ; equal outcomes
  were neither required nor used as a rendering oracle.
- `restarted.png`, `restart-left.png`, `restart-right.png`: native Return
  rebuilds the round, the yellow cycle moves, and A/S bends fresh trails while
  old console history persists. That history is original behavior, not evidence
  of another current-round death. `escape-menu.png` confirms native Escape
  returns to the original menu.

Only ordinary Return/A/S/Escape keyboard down/up actions were used for gameplay.
All 18 keyboard events per arm were trusted, paired, targeted at `screen` and
consumed through the ordinary host input route. No diagnostic guest-memory,
configuration or asset writes, cheats or gameplay shortcuts were used.

## Checks, preparation faults and handback

The first preparation launch stopped before frozen step zero because strict
HTTP sealing rejected the existing shared msvcrt DLL's initially absent pin.
Its logs/receipts are preserved under `software/`. After verifying and adding
that pin, a second preparation launch used an incorrect arm-name renderer query;
it was closed at zero steps and is retained under `software-final/`. The helper
was corrected before either gameplay arm. Neither attempt is gameplay evidence.
The attempted remote static registration test was absent from the prepared
staging; the existing local test subsequently passed. Missing optional
`stdole2.tlb` HTTP 404 messages remain in the logs and did not prevent these
observed routes. No production repair is inferred from these preparation faults.

Browser-helper JavaScript syntax checks, the existing static original-registration
test, trusted input balance/consumption, complete served-original hashes, exact
module identity, renderer ownership/counters, bounded step acknowledgements and
full recovered-file hashes passed. The final two gameplay arms contain no
recorded pageerror or first-failure marker. No new code was committed, so no
production build or repair negative control was required. This is not full27,
FPS, audio, crash-freedom, stencil-shadow or complete visual-parity qualification.

Assigned box `bx_92ssqvkw` was verified hydrated, RUNNING/API idle and healthy
before use. Gameplay software Chrome closed at 02:49:28.358Z; WebGL Chrome
closed at 02:54:09.793Z, both exit 0. Including both zero-step preparation
launches, measured Chrome duration was 523.204 seconds, with one browser at a
time. All four Chrome PIDs, all four driver PIDs and all four owned server ports
were verified absent/closed; unique captures/logs/modules were recovered and
hashed locally well before 03:32Z. The earlier `originalFiles: 100` field in
`final-runtime-verification.json` counts entries including directories; the
separate `final-inventory-process-check.json` correctly distinguishes 92 files
and eight directories.

Handback: **bx_92ssqvkw RUNNING/API idle, health ok**, expiry
**2026-11-04T03:42:18.748Z**. Coordinator retains shutdown ownership. This worker
issued no stop, delete, resume or new allocation. No local Chrome, subworker,
successor or public deployment was used. No further runtime work is warranted
without a new concrete reproduction; stop after publication of this note.
