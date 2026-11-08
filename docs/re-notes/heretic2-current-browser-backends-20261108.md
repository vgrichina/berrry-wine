# Heretic II current browser backends, 2026-11-08

Both serial browser backends reach the original Easy campaign's readable,
textured Silverspring docks, respond to ordinary movement and attack, display
the native narrative trigger, and open the stained wooden door on approach.
Software GL additionally reaches the raised doorway threshold. Full interior
traversal, outgoing enemy damage, a kill, pickup and objective completion remain
unverified. This is browser world/progress evidence, not backend parity.

Run: `scratch/runs/20261108-heretic2-current-browser-backends/` (ignored).
Only this note is committed; no emulator repair or new build was needed.

## Current runtime and originals

Pinned source: `49de9bd69bf85bc0f2bc38a367009d914c475a48` on main, with an empty
relevant tracked diff. All 628 runtime paths overlapping the released Hexen II
browser run are byte-identical, including the texture allocator/audio fixes.
The actual recovered guest and owning render Worker modules on both routes
match the staged standard module: 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The served `lib/host-audio.js` matches
`e2ae7f782e7fbeb246471acfb3a93d7ae80eec9b195e44f02072310e81373d15` on both
routes; this identifies the loaded repair without qualifying audio quality.

All 1,826 registered closure files match retained SHA-256/size references,
including all 1,825 installed originals and exact installed-tree membership.
The 1,824-entry browser manifest retains
`b9b1e85ceeb2daedb056f6299a057be4ef2c8601f0e999ab98ddaa467cfd2e3a`.
The 2,465 staged pins pass before launch and after both runs. All 943 WebGL and
937 software successful served reads, including range reads, join their pins.

Registered arguments, original media/configuration and registered 1998 clock
are unchanged. Each route uses the ordinary registered browser launch, main
book → Game → Down to Easy → Enter, then stock Space through the intro.
No console/map/cvar/save edits, guest-code inspection, private-handler calls or
guest-state writes were used. The licence remains private personal use; no
public deployment or source/media archive was made.

Browser: Chrome 151.0.7922.108 / V8 15.1.206.16, headless native viewport with
no resize/emulation. Captures are 945×889; guest framebuffer/context is 640×480.
Both routes use the default guest Worker, endpoint 1, slot 0, CPU thread 1,
512 MB fixed memory and a separate owning render Worker. Secondary guest-thread
gameplay is not established.

| Route | Actual CPU and rendering evidence |
| --- | --- |
| WebGL | CPU `gl_sw_enabled=0`; owning endpoint 1 `{api:gl, backend:webgl}`; unique live `WebGLBackend` version 1, `WebGLRenderingContext`, context not lost. Actual provider is ANGLE on Mesa Intel UHD Graphics 620, Mesa 23.2.1. It is not the predecessor's SwiftShader provider. |
| Software GL | CPU `gl_sw_enabled=1`, presents 389→1378; owning GL endpoint 1 `{api:gl, backend:software}`. Unique `OpenGLHostBridge` has `softwareConsumer=true`, context 1 / HWND 65537, `software=true`, `backendSoftware=true`, and consumes the actual instance's shared memory. A separate endpoint 2 `{api:legacy, backend:webgl}` also exists and is not the GL owner. |

## Reviewed progress and limits

All 46 numbered composited captures and five extra held captures were inspected;
all 51 PNGs pass chunk CRC and IDAT decoding checks. The numbers below are
visible health readings, not inferred enemy damage or comparative performance.

| Route / captures | Reviewed observation |
| --- | --- |
| WebGL `docks-load`, `pier-forward`, `shore-approach`, `rat-attack` | Corvus, textured docks/buildings/sky and readable HUD, initially health 100. Rat-like creature at his feet; health 94 then 92, Control attack pose. No outgoing contact established. |
| WebGL `dock-advance` through `passage-enter` | Forward movement off pier, right turns onto waterside paving, fallen figure and lit alley. Native text “What has befallen my people?” appears, health 85. This is a narrative trigger, not objective completion. |
| WebGL `door-face`, `door-approach`, `threshold-enter` | Stained door panel initially across opening, then visibly swung left with interior exposed after ordinary approach. Corvus remains at the right jamb; initial Up attempts do not prove crossing. |
| WebGL `doorway-line` through `enemy-followthrough` | After reviewed turn/stock comma strafe, blade-wielding humanoid appears at the steps; health 58→48→38→25. Control produces spell light/red effects, but these do not establish contact with the enemy. Humanoid remains standing in final reviewed frame. No death/reload/replay. |
| Software `sw-world` through `sw-passage-align` | Textured docks/model/HUD, health 100; ordinary movement and turn. Rat beside leg, health 99→92→83; Control produces red spell light on the wall, with no verified rat hit. |
| Software `sw-passage-advance` through `sw-alley-end` | Continued reviewed movement passes fallen body and reaches lit alley; health 78. The same native narrative text appears in `sw-passage-trigger`. |
| Software `sw-door-face` through `sw-interior` | Door visibly opens on approach. Stock comma/Left alignment and Up ascend steps into the doorway threshold; final health 74. A full interior room traversal or humanoid encounter is not established on this route. |

The run reuses the released exact Heretic bound-input/ordinary-key helpers and
passed capture/admission/ACK controls. Focused local checks confirm Control and
Space release independently of a slow sampler and that a simulated UNKNOWN
delivery releases without replay. Actual runs have 46 exact successful numbered
ACKs, 40 independently armed finite holds, zero stale refusals and zero UNKNOWN
outcomes/replay. Final capture bindings show all arrows released; no separate
guest input-queue consumption or terminal Control-state observation is claimed.
No emulator correctness defect was demonstrated. No FPS, audio-quality,
matched-pixel or backend-parity claim follows.

## Retrieval and shutdown

One UUID/idempotent fresh box, `bx_fq7bmbtt`, was allocated at 00:14:27 UTC.
Detached observable normal-stop and immutable 25-minute watchdog delegates were
armed before allocation; deadline 00:39:27.546 UTC, initial box expiry
00:39:27.725 UTC. The watchdog retains 9,162 heartbeats, maximum gap 0.267 s;
both delegates exit zero and their supervisor records no remaining children.

WebGL Chrome exits normally at 00:23:02.044 UTC. Its controller/Chrome/profile
are absent before software starts at 00:23:10.035 UTC. Software Chrome exits
normally at 00:28:45.590 UTC. Terminal verification confirms both controllers
and Chromes absent, four ports closed, profiles and writer locks absent, and
unchanged remote pins. No runtime exception/event-error records were emitted.

All 584 artifact references / 483 unique contents (36,428,101 referenced bytes),
including unique logs/captures and actual modules, were retrieved and SHA-256/
size verified before requesting normal stop. Stop `stop_07cf206bbe82d9a2`
completes at 00:30:03.895 UTC, forced=false, error=null. Final state is
**archived**, current expiry null. No resume/delete or additional box occurred.
The run stayed above the task's 5 GB disk floor without a RAM gate.

Minor observer/setup errors are retained: the first supervisor-file read raced
its creation (timestamps independently prove preallocation arming), a staging
wait expired before staging completed (launch waited for completion), and a
local held-capture fetch initially named a not-yet-copied helper (no remote
action). The initial shell board watcher was absent at final inspection; a
detached watcher covered final documentation/commit work and was then closed.
None changed/replayed original input or called for an emulator repair.

Recovery uses the exact Git SHA plus `relevant-source.patch`, the untracked
runtime dependency patch, owned helper/note patches, recovered modules and
existing media path/hash references. Git is the source archive. Focused helper
syntax/release, source/media/served pins, ACK/module, PNG, retrieval, lifecycle
and owned-scope evidence/whitespace checks pass; no production build is claimed.
The global evidence checker retains seven unrelated existing containment errors;
this run's schema and artifact containment/existence checks pass.

These per-backend browser world/progress cells are covered. Next assigned work
can target a conclusive outgoing hit or deeper interior objective. Full 27
remains open.
