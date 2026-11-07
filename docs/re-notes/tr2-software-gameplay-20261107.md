# Tomb Raider II software movement and weapon draw — 2026-11-07

**The original TR2 Venice demo demonstrates ordinary forward translation and a
separate weapon-draw action on the production software backend.** Personally
reviewed settled captures and actual owning render-Worker completions establish
this bounded addition to `GLD3D-CORPUS-27-20261006`. The earlier
[WebGL result](tr2-bounded-gameplay-20261107.md), published as `07c00a950`, was not
repeated or used to infer software success. No emulator defect was demonstrated;
only this findings note is published.

Evidence: `scratch/runs/20261107-tr2-software-gameplay/`. One original on one fresh
boat `bx_p8h9chj5`; no shared local runtime/source/build lane, second original,
replay, old403 resume, worker delegation, deployment, guest-byte/config/save edit
or source/media archive.

Before the original, nine atomic transport controls, seven executor/recovery
controls, balanced production-renderer/DirectInput keys and invalid-duration
controls passed. Holds 0, 49, 2001, 3500, -1, NaN and 100.5 refuse before writer
lock, command/ID publication, executor admission, app reads or key events.
Allowed holds are 50–2000 ms. A generated PE with separate ILT/IAT and ordinary
property-sheet flags loads the exact native COMCTL32 through its dependency URL.
The served bytes match the retained DLL hash; DllMain returns EAX=1. Its fresh
capture was personally reviewed: explanatory tabbed page, OK, Cancel and disabled
Apply. Generated Chrome/controller, ports, profile and writer lock were clean
before the original.

## Reviewed original input

The original started at 01:38:05.967 UTC with the supported ordinary
`?d3d-renderer=software` selector. `index.html` maps that query to
`WINE_D3DIM_GPU=false`. The current Graphics page was personally reviewed with
Hardware 3D Acceleration (the guest D3D API), full-screen 640×480 High Color and
Z Buffer; host GPU selector Software. Ordinary OK reached Venice.

- `review/venice-idle.png` and refreshed `review/before-move.png`: Lara stands
  empty-handed in the starting alley, facing the orange lattice doorway uphill.
- Balanced Up 1600 ms, followed by 6000 ms without input:
  `review/forward-settled.png` shows Lara standing idle farther uphill. The left
  brick corner and right wall edge shift, floor position changes and the lattice
  doorway is closer. Facing remains unchanged and no turn was sent. The settled
  spatial change establishes translation, rather than a running animation alone.
- From that personally reviewed current scene, balanced Space 300 ms followed by
  6000 ms without input produces `review/weapons-ready.png`: raised arms, visible
  pistols and health HUD. Another 5000 ms without input produces
  `review/weapons-persistent.png`, retaining the weapon-ready pose and pistols.
  This demonstrates weapon draw, without firing or combat.

Seven numbered commands have complete ACKs. The first Up request expired before
dispatch and was refused with zero effects; a new capture and new command ID
continued on the same queue. Its ID was never replayed. There were no partial or
UNKNOWN action outcomes. Each ordinary input followed personal review of its
fresh capture and passed the current registered-app/12-second scene guard.

## Actual software execution and identity

Direct CDP observations identify render owner
`87A539A4E97CE041E3243D8D52FD1BF2`, endpoint 1, `{api:'legacy',backend:'software'}`.
The production process render factory supplies this endpoint; its Worker replay
calls `ex.d3dim_worker_draw` and increments
`evidence.d3dimSoftwareDrawCallsCompleted` only after that call completes.

| Checkpoint | Direct owner completed software draws | Owner completed sequence | Guest-reported software draws |
|---|---:|---:|---:|
| Before movement | 376,250 | 38,817 | 375,904 |
| Settled after Up | 528,558 | 52,572 | 528,210 |
| Settled after Space | 692,395 | 72,046 | 692,032 |
| Persistent weapons | 806,974 | 86,172 | 806,614 |

Samples are sequential, not atomic pairs. At every reviewed gameplay checkpoint,
the actual owner has **no GPU adapter**, `failed=null`, ready=1 and error=0.
Returned guest endpoint statistics have GL triangles=0, GL renderer/version=null,
fallbacks=0 and GPU-fallback software draws=0. Together with the actual software
owner and advancing native completions, these establish software execution and
absence of WebGL draws on this route; generated pixels or the UI label alone
were not accepted. No separate GL-call instrumentation was installed.

Source staging commit: `cd916e6ef1840055bd97f18f728d7f993fe31515`, with relevant dirty
and new-source patches retained. Source identity and actual module identity are
separate: both live guest and render Workers yielded Wasm bytes with SHA-256
`c1fbcf285cd0e7f0468d8c22af9ddf4b7edc7b7f092af77e41d51f3da2b7c186`
(2,181,042 bytes), matching the provisioned existing standard module. No local
build was run or claimed. Chrome is 151.0.7922.108, isolated guest Workers,
1024×768 viewport and 640×480 game buffer.

All 574 runtime file pins match remotely before and after; all 163 successful
original HTTP responses match pinned bytes. Five non-200 responses are retained
in the audit. All 100 inventoried remote run files were retrieved or matched to
retained local bytes. Source/media were transferred as individual serving inputs,
not archived into evidence. The reused pin checker prints an obsolete constant
`originalLaunches:0`; launch and queue records establish one original. Likewise,
the generic cleanup field `pending:'UNKNOWN; never replay'` is template wording,
not an UNKNOWN outcome for any of the seven completed queue commands.

The existing retained fixture identities match exactly:

| Path under `test/binaries/` | Bytes | SHA-256 |
|---|---:|---|
| `candidates/tomb-raider-2-demo/game/TOMB2.EXE` | 909824 | `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa` |
| `candidates/tomb-raider-2-demo/game/DATA/DEMOPC.DAT` | 2064 | `e1bdd5776e1946420e0eeb9e1a4da12f16ea2bbfb7c3909b414372b100ff51bd` |
| `candidates/tomb-raider-2-demo/game/DATA/BOAT.TR2` | 5920318 | `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e` |
| `dlls/comctl32.dll` | 577808 | `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4` |

Upstream `provenance.json` and historical native evidence remain absent. Historical
attribution is `tr2_demo_02.exe` from Tomb Raider Chronicles; local hash agreement
does not recover upstream provenance.

## Retrieval and lifecycle

The UUID Idempotency-Key was persisted and fsynced before the create request.
Initial expiry was 02:37:12.315 UTC. Ordinary completion closed Chrome at
01:40:02.954, exit code 0 and signal null; no browser failure or exception artifact
was emitted. The first immediate cleanup sample still saw the controller; a later
independent check at 01:40:44.665 confirms both generated/original controllers and
Chrome absent, all four ports refusing, both profiles absent, no profile processes
and no writer locks. This is normal teardown, not evidence of a crash.

After evidence retrieval, the explicitly delegated normal stop
`stop_a97228b8eaf287de` completed at 01:40:46.065, forced=false, error=null.
Boat state is archived and active expiry null. Allocation through completed stop
took about 214 seconds, within 35 minutes. Local disk stayed above 2 GB. No
automated risk flag occurred. Artifacts and publication records precede
`result.json`, written last.

No combat, damage, kills, audio, FPS, full parity or full27 claim. Up tests forward
running; Shift-walking and Alt jump remain untested. No further execution is
needed for this bounded task.
