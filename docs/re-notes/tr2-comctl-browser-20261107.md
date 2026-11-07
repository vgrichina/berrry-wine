# Tomb Raider II browser COMCTL32 preflight and terminal input limit — 2026-11-07

**Serving mismatch corrected in the run adapter; native options and Venice
rendering verified. Gameplay remains partial UNKNOWN.** Personally reviewed
before/after captures show a visible left turn. Translation and a distinct
jump/action/attack were not demonstrated. The worker then requested a 3500 ms
hold despite the adapter's 2000 ms limit. That request failed validation after
transport dispatch admission and terminated the original as UNKNOWN. This was
an operator input error, not a demonstrated emulator defect. No replay or second
original was attempted.

Evidence: `scratch/runs/20261107-tr2-comctl-browser/`. The run-only browser adapter
uses the existing `test/static-server.js` with `/binaries/` rewritten to
`/test/binaries/`, matching the existing logical-FPS harness convention. The
production registry and emulator are unchanged. Exact
`/binaries/dlls/comctl32.dll` now returns HTTP 200, 577808 bytes, SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
The actual resolver closure is recorded: COMCTL32 is native; its GDI32,
KERNEL32, USER32 and ADVAPI32 imports are built-in-only modules under the current
registry. No other real transitive DLL is required. Native dependencies are
included in transfer and HTTP pins, with remote bytes checked before and after.

A generated PE exercises `PropertySheetA` through the same shell and resolver.
Its initial control incorrectly aliased the lookup and address import tables,
leaving the API on its initial thunk despite loading the DLL; that failed
wizard capture is retained and does not diagnose the original. The corrected
control uses distinct tables. Its personally reviewed capture shows a tabbed
page, an explanatory static label, ordinary OK, Cancel and disabled Apply.
Worker logs confirm the real COMCTL32 load, import patch and successful DllMain.
One preparation process also exited at mkdir before browser creation because a
corrected input upload used the wrong destination; the corrected destination
and its separate launch records are retained. Neither is an original run.

The single registered original began at 00:32:31.933 UTC. Its personally reviewed
Graphics page selected Hardware 3D Acceleration, full screen 640x480 High Color,
Z Buffer, and ordinary OK. An expired options request was refused with zero
effects. A newly captured and reviewed request clicked the observed OK.
`venice-idle.png` shows Lara in the Venice alley. A stale turn request was also
refused with zero effects; a fresh 1200 ms Left key-down/key-up pair succeeded.
`idle-fresh.png` and `turned-left.png` show changed facing while remaining in
the same location. No Up, Alt, Control or Space input reached this original.
The subsequent `turn-more` request had invalid duration and produced no ACK;
its ordinary-key assertion precedes the first CDP key event. Nevertheless,
transport had already marked admission dispatched, so its terminal classification
remains UNKNOWN, without inferring a safe retry.

At the last reviewed capture, owning endpoint statistics returned through the
guest Worker identify legacy WebGL endpoint 1: 11843 draws, 36152 draw calls,
48965 triangles, errors 0 and software/fallback-software draws 0. The direct CDP
snapshot of the actual D3D render Worker identifies that same WebGL endpoint,
failed=null, control error=0, completed=626, batches=417, commands=36604.
`render-evidence.json` distinguishes returned endpoint counters from direct
Worker control inspection; no separate GL-call instrumentation was installed.
Renderer is ANGLE Intel UHD Graphics 620, WebGL 2.0, Chrome 151.0.7922.108.
This establishes rendered Venice and a visible turn, not translation, a distinct
action, combat, damage, kills, audio, FPS, full27 or backend parity.

Supplied fixture hashes remain exactly:

| Existing path under `test/binaries/` | Bytes | SHA-256 |
|---|---:|---|
| `candidates/tomb-raider-2-demo/game/TOMB2.EXE` | 909824 | `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa` |
| `candidates/tomb-raider-2-demo/game/DATA/DEMOPC.DAT` | 2064 | `e1bdd5776e1946420e0eeb9e1a4da12f16ea2bbfb7c3909b414372b100ff51bd` |
| `candidates/tomb-raider-2-demo/game/DATA/BOAT.TR2` | 5920318 | `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e` |

The historical attribution is `tr2_demo_02.exe` from Tomb Raider Chronicles.
`provenance.json` and historical native evidence remain absent. Hash agreement
establishes supplied local identity only, not recovered upstream provenance.
No download, media/archive substitution or guest/save/config change occurred.

Tested source commit: `f4473ab2936e22ac5fdd02267eec3504bd425aa2`, relevant dirty
and new-source patches retained. Actual Worker Wasm SHA-256:
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`.
Nine generated transport cases, six actual-executor recovery cases and balanced
production-renderer/DirectInput keyboard controls pass. Corrected generated PE
structure checks pass. All 572 final remote pins match. HTTP audits match 172
successful original responses with zero mismatches; optional/unmapped responses
are explicitly retained. The final inventory's 123 files were retrieved or
matched locally, including captures, logs and unique modules. Source trees and
game media were not archived into evidence. No emulator code changed, so no
local build/runtime was taken from Aranna or Lords and no emulator-build claim
is made. This publication contains findings only.

Fresh boat `bx_wkadtmbm` was created after persisting/fsyncing the UUID
Idempotency-Key. Chrome exited normally with code 0 at 00:34:20.912 UTC after
the terminal input validation. Runtime processes are absent; both ports refuse
connections, profile and writer lock are absent. Delegated normal stop
`stop_255b142558b909e7` completed at 00:34:55.092 UTC, forced=false, error=null;
state archived, active expiry null. Original start through completed stop took
143.159 seconds; allocation through stop took 350.726 seconds, both below 35
minutes. Disk remained above 2 GB. No safety flag, nested worker, old403 resume,
second original or hidden replay occurred.

Next work needs a separately authorized attempt using bounded holds of at most
2000 ms, each admitted from a fresh reviewed scene, to demonstrate translation
and then a documented distinct action. This task stops at its terminal adapter
failure; ownership is released after publishing artifacts and result.json last.
