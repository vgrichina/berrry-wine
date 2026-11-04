# Extended natural original Deus Ex Draw observation

The original game naturally reached **Unlock and the complete Draw return pair**
after **192 genuine Render ESP save/restore pairs**. The exact terminal is
`render-route-return-candidate-unverified-lifetime`, at the saved caller
`0x1134426e`, after **999,905 blocks / 22,520.175 ms**. The fresh personally
reviewed host PNG shows a black game area; visible gameplay, object lifetime and
viewport-to-host surface binding remain unverified.

This run uses the published `b2e6bb1277a11637a7f666c98324092772c2d9dc`
observer contract, explicitly requesting `limitProfile: 'extended'`,
10,000,000 blocks and 120,000 ms. It stopped naturally before either ceiling.

Evidence and small runnable inputs are retained in
`scratch/runs/20261104-deusex-extended-natural-unlock/`.
The assigned runtime is `/home/user/deusex-natural-draw-runtime` on
`bx_jaqh7yas`; `/home/user/wine-assembly` was never used remotely.

The locked full build passed. Its normal module SHA-256 is
`129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52`.
The exact bytes were captured and transferred while holding the full build lock.
The historical module remains at
`build/wine-assembly.historical-7ca6bf69.wasm`, SHA-256
`7ca6bf69861fbe774bf30d03163d847945b6d07d1ffeea132911b68038b7a4c3`.
Neither module was duplicated into run evidence.

Candidate source comes from Git
`bd7a87370bc4d9a3f290589803280ccada037a20`.
Only changed small runtime/test sources, the tested cache checker, small run
helpers and the authorized exact WASM were staged. The regenerated manifest
verifies 489 actual inputs, retaining original media by existing path and full
SHA: EXE `2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f`,
Engine `3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`,
Render `9f405de68112266bbd72cb4e37c39b3b9712052c49fcd2f7cd9f2654b443773b`,
SoftDrv `25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`.
No source archives or copied media were created.

Before Chrome, the actual helper preflight passed the exact candidate contract,
checker self-tests and actual local/owning-Worker/original-instruction suite.
The complete next-driver integration passed with modeled DOM/readiness and real
WorkerLink/WASM execution. Explicit Puppeteer-core 25.7.0 CJS and ESM imports,
next-driver imports, cache graph (98 page/13 Worker scripts), all 144 actual HTTP
resources with SHA/isolation/no-store checks, selector negatives, driver transport
and measured native-readiness fixtures passed. The single browser is launched
only after `prebrowser-pass.json`; no failing prerequisites were ignored.

The copied collection rejects terminal profile or bounds differing from the
request. Native readiness, original PE identity, Worker ownership and Render
ESP-alias guards are unchanged. The run driver only adds an absolute hard
browser deadline of 08:29Z to its existing 15-minute bound.

Chrome/151.0.7922.108 ran once, **08:24:22.473Z–08:24:59.159Z**.
The actual original EXE and native `GIsRunning=1` were measured before the visible
source-bearing HWND `0x10003` gate at **08:24:36.032Z** (640×480,
`dxWriteSeq=32`, canonical version 2). Only then did slot 0 / endpoint identity 1
start the owning observer. No readiness or ESP guard was bypassed.

| Natural checkpoint | Exact EIP | ESP |
| --- | --- | --- |
| Draw entry | `0x110109e0` | `0x179ff878` |
| Lock callee | `0x1133d145` | `0x179ff788` |
| Lock return, EAX 1 | `0x11010d6e` | `0x179ff7c8` |
| Unlock callee | `0x1133d1ea` | `0x179ff7c0` |
| Unlock return | `0x11010f7a` | `0x179ff7c8` |
| Tail callee | `0x117530eb` | `0x179ff7c4` |
| Tail return | `0x11010f82` | `0x179ff7c8` |
| Draw epilogue | `0x11010fc9` | `0x179ff7c8` |
| Saved caller | `0x1134426e` | `0x179ff88c` |

The collector observed 393 events: nine checkpoints and 384 alternating Render
ESP events. Every restoration matches its saved ESP/EBP. Render is LIVE index 6,
base `0x11752000`, generation 1; save RVA `0x3246`, restore RVA `0x30cd` or
`0x3355`. The final return sets `observedReturnPair=true`; its status deliberately
retains the unverified-lifetime qualification.

The frozen terminal has 999,905 charged blocks/run calls, 999,906 boundaries,
485.14500001678243 ms completed WASM time, ESP `0x179ff88c`, EBP `0x179ff8b0`,
thread 1, yield 0 and last-run halt 1. Its PC belongs to LIVE WinDrv index 3,
base `0x1133c000`, generation 1, RVA `0x826e`. MainLoop signature is original,
loop check 1, Tick return 1; diagnostic/module errors are null and no trapping
run was omitted. Halt 1 is the single-block quantum, not guest exit.
The exact `extended` 10M/120s limits remain in the frozen terminal; both stop
replies match that terminal byte-for-byte as JSON values.

I personally inspected `recovered/fresh-host.png` (93,649 bytes, SHA-256
`6dfe04f628337897a062b35e085a7297f4e4ea795292fb1711ed4bb1bb1affb2`).
It shows Deus Ex Demo selected, original launch logs and a black game area.
This is the fresh host capture after natural completion, not a qualified rendered
surface or gameplay image. `engineRender` and `viewportPlayer` remain null.
No further browser, reload, input or observation was attempted.

All **67 closed artifacts / 4,515,128 bytes** were recovered or matched to
identical small local inputs with full SHA/size verification. The remote closed
manifest was captured at **08:25:32.771114Z**, and recovery completed before
08:26Z. All 489 actual pins still match and Chrome/Node driver are absent.
`analyze.cjs` verifies every recovered artifact, every served input, actual
selector/readiness order, all nine natural checkpoints, 192 ESP pairs, exact
terminal, frozen stop replies and normal cleanup. Its assertions run against
fresh recovered evidence, independently of the prebrowser modeled fixtures.

Git SHA, relevant binary diff, owned new-input patches and artifact seal preserve
provenance. No production defect was demonstrated and no production file changed.
The old 15-second observation limit was insufficient for this route; this run
establishes the requested natural boundary without a throughput repair.

**Handoff:** `bx_jaqh7yas` is left RUNNING (API `idle`, healthy/hydrated), expiry
**2026-11-04T08:39:09.654Z**. Coordinator owns shutdown and receives custody.
Next work is object lifetime and actual viewport-to-host surface binding before
any visible-gameplay claim. No lifecycle action, source-box access, subworkers,
successors, Heroes II or public deployment occurred.
