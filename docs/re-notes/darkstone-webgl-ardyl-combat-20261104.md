# Darkstone: original WebGL Ardyl combat, 2026-11-04

**Verified:** Town → Land of Ardyl → visibly aimed Skeleton → one skeleton
defeated while warrior CODEX survived. Personally reviewed original inventory
captures show **LIFE 32/35 → 20/35**, **Victories 0+0 → 1+0**, and increased EXP
bar fill. The original character started at LIFE 35/35 and EXP 0; enemies
damaged him before the combat baseline. Numeric earned EXP was not collected.

This closes the WebGL combat gap in
[the manual-combat note](darkstone-ardyl-manual-combat-20261104.md) at
`b8773d9f83b68b04b80c9f28addd8eaf3fd81082`. Software was not rerun.
Evidence is in ignored `scratch/runs/20261104-darkstone-webgl-ardyl-combat/`.
Darkstone has no candidate-corpus entry, so this investigation is not attached
to an unrelated dashboard candidate.

## Runtime and gates

Reused the already staged source
`2e802c7dfbb41dec726b7e69d580aba316cc48d2`, predecessor relevant binary/new-file
patches, all **1,427 runtime pins**, and **15 original media pins** on
`bx_3ub9q4br`. No source rebuild, source archive, media transfer, configuration
edit, cheat, or guest-memory write occurred. `checkout-head.txt`,
`provenance.json`, retained source patches, and run-helper patches record
provenance without substituting the newer shared checkout into the runtime.

The page compiled and instantiated the canonical **2,143,712-byte** module,
then sent it to guest/render workers whose receive/instantiate observations
are retained. Actual tested bytes were recovered as:

`webgl-gameplay/actual-1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58.wasm`

The **2,146,325-byte** companion
`74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`
was pinned unchanged, not executed. Its already recovered predecessor bytes
remain in the preceding run.

Before the single browser launch, a **fail-fast shell** passed actual syntax
and import checks, read-only native-observer execution, worker-expression
absent/present controls, binary capture/recovery transport, 8,000-record
manifest transport with wrong-hash/size negatives, atomic matching-ACK
ordering, capture freshness and step bounds, closed-inventory rejection and
acceptance, all runtime pins, **300 localhost GET byte/hash checks**, isolation,
served-module omission/hash/size negatives, HTTP-negative controls, and
canonical compile/instantiate fallback rejection. In particular,
`test-native-observer.log` passed before Chrome; the predecessor's late-test
ordering error was not repeated.

Exactly seven known optional HTTP 404 responses were recorded individually
in `optional-http-404.json` and checked again in `final-audit.json`:
`/build-info.js`, `/api/auth/user`, `/favicon.ico` twice, `/__bundle`,
`/test/binaries/tlbs/stdole2.tlb`, and its `.part000` probe. Exact query strings
and supported original-host absence behavior are retained. No new non-200
response, console error, fallback, or runtime failure was accepted. There was
no reload, retry after failure, or second browser.

## Inspected route and loading

Each route or aim decision followed a personally viewed fresh capture.
Original menus created the level-1 warrior CODEX and placed him in the party.
Town's F input visibly displayed **Combat Mode: Manual** in
`manual-confirmed.png`. The inspected upper-left exit used page `(380,488)`.
Every advancement had a matching ACK and at most **64 steps**.

| Capture | Frozen steps | Reviewed scene and observed progress |
| --- | ---: | --- |
| `exit-initial` | 5072 | Black; loader thread 3 at `0x4767b2`; thread 2 waiting on CS owned by 3 |
| `exit-64` | 5136 | Ardyl loading art appearing; loader `0x460816`; loader GL draws 1 → 628; wait resolved |
| `exit-192` | 5264 | Land of Ardyl art and progress bar; loader `0x463103`; loader GL draws 12,026 |
| `exit-448` | 5520 | Black/fade; loader endpoint closed after 28,280 GL draws; main `0x4e84b3` |
| `exit-704` | 5776 | Black; main advanced to `0x4d95a1`; owning world GL draws 14,275 → 14,363 |
| `exit-960` | 6032 | Actual Ardyl world and HUD; owning world GL draws 18,601 |

These checkpoints establish loading progress through the black interval in
this run. They do not identify every historical black frame as loading.
No production defect was established or production file changed.

The reused ground route moved toward `(569,431)`, settled, then `(681,592)`
into the clearing. Two skeletons became visible. The first 12-step and
64-step right-button portrait holds did not open inventory in the reviewed
captures; a 128-step hold, split into two ACKed commands, did. This observed
input timing was preserved rather than inferring an open inventory.
`before-stats-open.png` shows LIFE **32/35**, Victories **0+0**, and empty EXP.

## Aim, defeat, survival, and renderer identity

After closing inventory, the pointer followed the near skeleton's torso.
`aimed-first.png` visibly shows **Skeleton** and its red health bar. The first
hold was 64 steps, followed by three 256-step holds and a final 64-step hold:
**896 held steps / 14.336 guest seconds**, always divided into commands of
at most 64 steps. Each hold ended with a fresh personally viewed capture;
the aim was corrected to the visible torso. `attack-near-final.png` shows
the near skeleton gone and the second remaining.

`after-stats.png` confirms **LIFE 20/35**, **Victories 1+0**, and newly filled
EXP bar. `victory-world.png` confirms the inventory closed, surviving warrior,
and remaining skeleton. No potion was used. The original apple, gold, sword,
shield, and helmet remain visible in inventory.

The actual owning renderer was **`lib/d3d-render-worker.js`**, endpoint **1**,
options `{api:"legacy",backend:"webgl"}`, with **zero** native software draw
completions. Worker IDs, module observations, draw progress, and WebGL context
metadata are retained in capture states and `final-state.json`.

The worker context reports vendor `WebKit`, renderer `WebKit WebGL`, version
`WebGL 2.0 (OpenGL ES 3.0 Chromium)`, and an unmasked Intel UHD Graphics 620 /
Mesa 23.2.1 string. However, read-only browser CDP `SystemInfo.getInfo` in
`system-gpu.json` identifies **ANGLE SwiftShader**, Google Vulkan Subzero,
driver 5.0.0, `ANGLE_SWIFTSHADER`, and OpenGL ES 3.0 / ANGLE 2.1.28232.
The browser system report establishes SwiftShader execution; the context's
Intel string does not establish physical GPU use.

## Closure and handback

Chrome **151.0.7922.108**, Puppeteer **24.31.0**, isolated private localhost,
worker threads, frozen 16-ms steps, 1200×900 viewport. **269 matching ACKs**,
maximum advance **64**, and **58 trusted observed input events** passed the
final audit. Issued and observed key/button inputs were balanced. Final
input queue was empty, active event null, and mouse button mask zero.

The one browser ran **639.823 seconds**, below 15 minutes. Chrome PID **30833**
exited 0 at **04:24:09.594Z**; driver PID **30821** was absent and private port
**34973** closed. Recovery required `cleanup.json` first and verified **863**
stable arm files by full SHA-256 and size, including actual tested module
bytes. All **1,427 pins** remained unchanged. Own remote helpers and recovery
finished before **04:32Z**.

Assigned **bx_3ub9q4br** was verified and ACKed before use and verified at
handback **RUNNING / API `idle`, healthy, hydrated**, exact expiry
**2026-11-04T04:42:10.054Z**. It remains assigned to the coordinator for
shutdown. No allocation, resume, stop, delete, public deployment, successor,
or subworker occurred. Audio, FPS, full-game coverage, companion execution,
and physical GPU execution are not claimed.
