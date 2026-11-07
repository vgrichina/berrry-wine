# Tomb Raider II browser Venice attempt — 2026-11-07

**First blocker: the browser cannot fetch the real COMCTL32 dependency. Venice
gameplay remains UNKNOWN.** One fresh-boat original of registered
`tomb_raider_2_demo` was stopped at its personally reviewed startup screen. The
browser requests `/binaries/dlls/comctl32.dll` and its `.part000` fallback; both
return HTTP 404. The verified DLL was provisioned at
`test/binaries/dlls/comctl32.dll`. The full-shell capture shows the fallback
wizard with Back/Next/Cancel, and the runtime explicitly reports COMCTL32 missing.
There is no ordinary OK button to select. No options click, arrow, action,
movement, damage or kill input was dispatched to this original.

Evidence: `scratch/runs/20261107-tr2-browser-venice/`, especially
`review/startup.png`, its state/capture records, `fixture-identity.json`,
`runtime-pins.json`, `audit.json`, and the retrieved original HTTP/console logs.
The route mismatch belongs to this root-served test arrangement; this run does
not establish an emulator defect or behavior of another serving arrangement.
The first commentary diagnosis that the resolver omitted the DLL was incorrect:
the retained pins, transfer ledger and remote pre/post verification prove that
the exact DLL was present under its staged path.

Supplied identities, each matching retained November 5 local preflight evidence:

| Existing fixture path | Bytes | SHA-256 |
|---|---:|---|
| `test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE` | 909824 | `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa` |
| `test/binaries/candidates/tomb-raider-2-demo/game/DATA/DEMOPC.DAT` | 2064 | `e1bdd5776e1946420e0eeb9e1a4da12f16ea2bbfb7c3909b414372b100ff51bd` |
| `test/binaries/candidates/tomb-raider-2-demo/game/DATA/BOAT.TR2` | 5920318 | `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e` |
| `test/binaries/dlls/comctl32.dll` | 577808 | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4` |

The original note attributes the demo to `tr2_demo_02.exe` from Tomb Raider
Chronicles. Its provenance JSON and historical native evidence directory are
absent. Complete local hash agreement establishes the supplied identity only;
upstream archive verification is unrecoverable from those retained materials.
No download, archive substitution or media modification was attempted.

Source commit is `c955c8b9219ea820adf51c38b47095271631145e`, with relevant dirty
and new-source patches retained. All 572 runtime pins match remotely before and
after execution. Live guest Worker bytecode is standard Wasm
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`;
its unique module is recovered. The requested backend is WebGL, but no owning
D3D render Worker or draw evidence exists at this options-only checkpoint.
Chrome is 151.0.7922.108; the isolated shell viewport is 1024×768 and its current
desktop canvas is 684×570. A game framebuffer was not reached.

Nine transport controls and six actual-executor recovery controls pass with the
registered-app guard changed to Tomb Raider II. Generated production-renderer
checks cover balanced left/up/right/down, Alt, Control and Space, physical
DirectInput state on press/release, invalid-key rejection and partial-send
termination. These controls do not prove original gameplay. The 12-second scene
guard, duplicate-ID refusal, stale zero-effect refresh and terminal partial or
UNKNOWN behavior remain intact. No scene-dependent original input was attempted.

Fresh boat `bx_r9e57gag` was created only after persisting/fsyncing the UUID
Idempotency-Key. Original execution began 00:23:55.267 UTC; Chrome exited
normally with code zero at 00:24:29.578. Both processes are subsequently absent,
both private ports refuse connections, and profile/writer lock are absent.
All 31 terminal inventoried files were retrieved or matched locally. Delegated
normal stop `stop_d017185c0ac523bd` completed at 00:24:47.524,
`forced=false`, `error=null`; final state is archived, active expiry null.
Start through confirmed stop took 52.257 seconds, within the 35-minute bound.

Only this findings note is published. No local runtime/source/build change,
second original, resume, guest/save/config edit, blind coordinate sequence,
benchmark, source/media archive or automated safety flag occurred. Free disk
remained above 2 GB. Artifacts precede `result.json`. Historical native movement
still does not establish browser gameplay; full27, backend parity, audio and FPS
remain open. Next work needs a separately authorized fresh attempt after a
generated preflight proves the registry dependency URL serves the pinned DLL.
This worker releases its owned paths and stops.
