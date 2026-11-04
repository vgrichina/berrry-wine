# Original Draw naturally crosses Render ESP reuse; Unlock remains missing

The one original-game observation passed the predecessor's conservative Render
stop and recorded **192 natural Render ESP save/restore pairs**. It observed
MainLoop loop check 1, Tick return 1, Draw entry and successful viewport Lock
return (EAX 1). Its exact terminal is **time-limit after 913,266 blocks**, in
original SoftDrv RVA `0x365b0`. Natural Unlock entry remains the first missing
checkpoint. No complete Draw return or visible gameplay is claimed.

This follows the published [ESP-aware repair](deusex-esp-alias-observer-repair-20261104.md)
`65438de076e5a16458c9bc3b88db7512314b57dd` and
[predecessor natural run](deusex-natural-terminal-run-20261104.md).
Evidence and runnable small inputs are in
`scratch/runs/20261104-deusex-original-esp-aware-draw/`.

## Actual provisioning and preflight

Only assigned fork `bx_fzs28fky` was accessed. All 339 inherited pins matched;
there was no Chrome or Node driver. Existing original media, native support
paths, corrected/readiness helpers and dependencies were retained in
`/home/user/deusex-natural-draw-runtime`. Current browser/Worker sources came
from committed Git `1a207ffb0d02447cea321c66f12d9df93ccd9d79`, including the
unchanged published repair. The next-driver and collection helper are byte
identical to the repair's tested recipe.

A shared local build changed during initial staging: its actual bytes were
`bcc27cab733801a1b9da5446824ec351d4a56d0bfd70d89fcff8643d4e0259a4`,
not the earlier measured normal module. This was caught before preflight or
Chrome. Committed compiler/source prerequisites were staged individually into
the served checkout, and a remote rebuild reproduced the repair-tested normal
module exactly. No compiler/source tree was archived into evidence. The final
manifest was regenerated from those actual inputs; the transient module was
never used for a browser run. `stage-changes.json` records initial staging;
`rebuild.json` and final `provision-manifest.json` record the correction.

| Actual served input | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 2144190 | `7ca6bf69861fbe774bf30d03163d847945b6d07d1ffeea132911b68038b7a4c3` |
| `lib/deusex-draw-observer.js` | 19043 | `c4ae65d9052d737cfa8317b08f58d3afccbcebae2e2d6f29ca9a6c00e4432fc4` |
| `lib/guest-worker.js` | 71526 | `bfa5f4f25de48e79c31868ab78b784da4ad39c4591c4e5bf86ab68248eb7c344` |
| Original `deusex.exe` | 253952 | `2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f` |
| Original `engine.dll` | 1736704 | `3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0` |
| Original `render.dll` | 233472 | `9f405de68112266bbd72cb4e37c39b3b9712052c49fcd2f7cd9f2654b443773b` |

Original binaries remain under
`test/binaries/candidates/deus-ex-demo/installed/system/`. The final 484 pins
include compiler prerequisites and passed before/after verification. HTTP
preflight verified all 144 actual page/Worker/runtime resources, SHA, isolation
and no-store headers; absent `build-info.js` used the supported dev fallback.
Actual Puppeteer-core 25.7.0 CJS/ESM imports and complete next-driver imports
passed. Cache graph, genuine selector/failure negatives, pinned HTTP mutation
negatives and measured-readiness fixtures passed. The actual module passed
local and owning-Worker observer tests, including original PE/Render instruction
coverage and complete next-driver integration with modeled DOM/readiness and
real WorkerLink execution. These fixtures are separate from natural execution.

## Single natural interval

Chrome/151.0.7922.108 ran **07:49:59.254Z–07:50:23.216Z** on 2026-11-04.
The genuine candidate selector and measured `_exeUrl` selected the original
EXE. Native GIsRunning was 1 at **07:50:08.042Z**, address `0x10daf434`,
with original EXE base `0x10900000`. At **07:50:08.044Z**, visible non-child
HWND `0x10003` measured 648×488, `dxWriteSeq=80`, canonical version 10.
Only after both measured gates did slot 0/endpoint identity 1 start the owning
observer, once, for 2,000,000 blocks/15,000 ms under ordinary scheduling.

| Natural boundary | Evidence |
| --- | --- |
| Draw entry | EIP `0x110109e0`, ECX `0x103ef0a0`, viewport `0x19309380`, ESP `0x179ff878`, EBP `0x179ff8b0`, saved caller `0x1134426e` |
| Lock callee entry | EIP `0x1133d145`, ESP `0x179ff788`, EBP `0x179ff874`, saved return `0x11010d6e` |
| Lock return | EIP `0x11010d6e`, EAX 1, ESI `0x19309380`, ESP `0x179ff7c8`, EBP `0x179ff874` |
| Render ESP save/restore | 192 alternating pairs; LIVE index 6, base `0x11752000`, generation 1; save RVA `0x3246`, restoration witnesses at RVA `0x30cd` or `0x3355`; each restored captured ESP/EBP |
| Unlock/tail/epilogue/saved caller | Not observed; `observedReturnPair=false` |

The exact frozen collector terminal, rather than a later passive sample:

| Terminal field | Actual value |
| --- | --- |
| Status / reason / boundary | `expired-incomplete` / `time-limit` / `after-run` |
| Monotonic time / elapsed | 23085.390000000014 ms / 15000.234999999986 ms |
| Actual / charged blocks | 913266 / 913266; 1086734 remaining |
| Run calls / observed boundaries | 913266 / 913267 |
| Completed WASM run time | 271.95000000146683 ms |
| EIP / ESP / EBP | `0x1149a5b0` / `0xe7` / `0x114d93d8` |
| Thread / yield / last-run halt | 1 / 0 / 1 |
| PC module | LIVE `SoftDrv.dll`, index 4, base `0x11464000`, size 757760, generation 1, RVA `0x365b0` |
| MainLoop signature / loop check / Tick return | true / 1 / 1 |
| Diagnostic error / module error / trapping run | null / null / false |

Halt 1 is the last single-block quantum exhausting, not application exit.
The deadline expired while ordinary guest execution continued within Draw.
This result establishes neither a guest hang nor a production defect. Read-only
original SoftDrv inspection (SHA-256
`25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`)
maps the terminal to preferred VA `0x10d365b0`, instruction `movq mm1,mm7`,
amid MMX texture/pixel arithmetic. The retained disassembly is static context;
it does not prove subsequent execution or a complete surface presentation.

## Capture, recovery and handoff

The personally reviewed `recovered/fresh-host.png` shows Deus Ex Demo selected,
launch logs and a black game area. It is a fresh 93,703-byte host capture, not
a verified gameplay screenshot. `engineRender` and `viewportPlayer` remain
null; allocation lifetime and viewport-to-host binding remain unknown.
No complete Draw occurred to qualify a further surface/route inspection.

All 59 closed artifacts, 3,781,887 bytes, were recovered or matched to identical
small local inputs with full SHA/size verification by **07:50:29.062Z**.
The offline analyzer checks every recovered hash, served source identity,
selector/readiness ordering, exact terminal, all 192 natural save/restore pairs,
first missing Unlock, frozen stop replies and cleanup. No Chrome/driver remains;
all 484 final pins still match. Exact Git SHA, relevant workspace binary diff,
owned new-input patches and final artifact seal preserve source provenance;
the workspace diff is diagnostic and was not applied to committed served inputs.

No production files changed, so no new fix or local heavy build was required.
There was no second browser/reload, guest write/call, input, forced Draw/repaint,
scheduler pulse, breakpoint takeover, source-box access, media/module set copy,
allocation/resume/stop/delete, subworker, successor, Heroes II or public deployment.

**bx_fzs28fky remains RUNNING** (API `idle`, healthy/hydrated), expiry
**2026-11-04T08:25:38.056Z**. Coordinator owns shutdown and receives custody.
The next technical target is the first natural Unlock boundary after the
observed Render work; a larger or faster observation needs separate scheduling
authorization. This single task ends at the exact missing boundary.
