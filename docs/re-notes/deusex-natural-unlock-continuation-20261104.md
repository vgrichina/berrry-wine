# Natural Unlock continuation rejected at the actual observer limit

The proposed 10,000,000-block / 120,000-ms observation **did not launch**.
The historical pinned observer only supports **2,000,000 blocks / 15,000 ms**.
Its constructor silently clamps larger positive integers with `Math.min`;
the owning Worker passes options directly to that constructor. There is no
separate larger-interval Worker contract. The run-specific exact-limit gate
rejects both unsupported settings before Chrome rather than reporting the
requested bounds while executing a shorter interval. No guard was changed.

Evidence and runnable small inputs are retained in
`scratch/runs/20261104-deusex-natural-unlock-continuation/`.
This follows [the original ESP-aware Draw observation](deusex-original-esp-aware-draw-20261104.md).
Its 192 genuine Render save/restore pairs and exact 913,266-block time terminal
remain the latest natural execution evidence. The prior 271.95-ms WASM runtime
does not prove a guest hang or demonstrate a production throughput defect.
The historical exact-terminal analyzer passed again; it describes the prior
session, not a new observation.

## Actual assigned runtime and prebrowser verification

Only assigned `bx_jaqh7yas`, rooted at
`/home/user/deusex-natural-draw-runtime`, was accessed. All **484 inherited pins**
matched before and after the six prebrowser suites. The manifest records the
exact candidate/dependency graph, path, full SHA-256, size and original source
reference. No production source or media/module bytes were staged or changed.
The tested historical source commit is
`1a207ffb0d02447cea321c66f12d9df93ccd9d79`.

| Retained input | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `7ca6bf69861fbe774bf30d03163d847945b6d07d1ffeea132911b68038b7a4c3` |
| `lib/deusex-draw-observer.js` | `c4ae65d9052d737cfa8317b08f58d3afccbcebae2e2d6f29ca9a6c00e4432fc4` |
| Original `deusex.exe` | `2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f` |
| Original `engine.dll` | `3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0` |
| Original `render.dll` | `9f405de68112266bbd72cb4e37c39b3b9712052c49fcd2f7cd9f2654b443773b` |
| Original `softdrv.dll` | `25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18` |

Original media remains at the manifest's existing paths under
`test/binaries/candidates/deus-ex-demo/installed/system/`; the tested normal
module remains at its existing runtime path. Git SHA plus relevant binary diff
and owned new-input patches preserve source provenance without a source archive.
The shared checkout's current build was not substituted for the retained module.

The following six suites passed remotely by **08:01:01.889Z**:

- Actual Puppeteer-core 25.7.0 ESM import, CJS helper/complete driver imports,
  and all 144 actual HTTP page/Worker/runtime resources with pinned SHA,
  COOP/COEP and no-store headers; supported absent-build-info dev fallback.
- Original candidate selector and immediate launch-failure negatives.
- Actual driver/collection command integration and missing/mutated HTTP pins.
- Source-bearing native GIsRunning readiness fixtures, actual original IAT and
  MainLoop instruction bytes, and gate-before-WorkerLink-start ordering.
- Actual normal WASM owning Worker and local instruction execution, original
  EXE/Engine PE loading/relocation, Render ESP alias guards, exact terminals,
  and full next-driver integration with modeled DOM/readiness.
- Constructor-only limit fixtures: both excessive settings reject; exact
  supported maxima pass; zero, negative, fractional and nonfinite bounds reject.

These are tests, not natural game execution. No live native readiness or Draw
boundary was sampled. The limit fixture deliberately provides no guest memory.

After the six successful suites and closed recovery, an additional command
attempted `node tools/check-browser-cache-versions.js` on the assigned runtime.
That optional tool is absent and returned `MODULE_NOT_FOUND` at **08:01:42.686Z**.
The chained explicit Puppeteer CJS import check did not execute. Remote execution
stopped at this first failure, without staging the missing tool or retrying.
The fresh HTTP graph checks passed, but a fresh dedicated cache-tool pass and
explicit Puppeteer CJS entry import are unclaimed. `first-failure.json` preserves
the command, error and unexecuted dependent check.

## Closed evidence and custody

All **12 closed remote artifacts, 503,902 bytes**, were recovered or matched to
identical small local inputs with full SHA/size verification by
**08:01:24.961Z**. `remote-recovery-manifest.json` lists each unique artifact;
it confirms all 484 pins remained intact and no Chrome or Node driver remained.
The subsequent failed optional command is separately retained locally.

There was **zero Chrome launch**, no fresh game/window/surface PNG and no image
review claim. Natural Unlock, tail, epilogue, complete Draw, lifetime,
viewport-to-host binding and gameplay remain unobserved. No guest mutation,
call, forced Draw/repaint, input, pulse, breakpoint takeover, reload or second
browser occurred. Actual instruction tests ran isolated fixtures only.
No production defect was established, so no production fix or full build was
needed. No lifecycle action, source-box access, local heavy runtime, subworker,
successor, Heroes II or public deployment occurred.

**bx_jaqh7yas is left RUNNING** (API `idle`, healthy/hydrated), expiry
**2026-11-04T08:39:09.654Z**; coordinator owns shutdown and receives custody.
The concrete blocker is the unsupported larger observer contract. A separately
authorized limit-contract change with owning Worker/instruction tests and a
locked full build is needed before a genuine 10M/120s interval can be attempted;
the missing optional tool/import prerequisites must also be settled before
Chrome. This task stops with the tested rejection, without claiming the requested
natural boundary or a fresh capture.
