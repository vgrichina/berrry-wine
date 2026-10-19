# OpenGL / Direct3D corpus status, reconciled 2026-10-17

## October 17 retained Darkstone movement review

Later October 15 captures supersede the camera-only result below. Both software
and WebGL show ordinary ground-click movement with a following camera. The
software run exited successfully; the WebGL run retained two movements but
ended at its input-queue deadline (exit 1).

At a closely matching gate/tree/feet pose, WebGL has a substantially larger
black foreground triangle; software still has a smaller wedge. Neither is
established as correct. This is movement evidence with an unresolved rendering
defect, not full backend qualification. Audio, combat, FPS and touch remain
unmeasured. No new runtime was performed on October 17.

See the [reviewed comparison](darkstone-backend-checkpoint-20261015.md#retained-same-pose-comparison-reviewed-october-17)
for exact source/module identities, PNG hashes, draw-completion counters and
cleanup receipts. Runs: `20261015-darkstone-software-movement` and
`20261015-darkstone-locomotion`. Identical-input foreground draw comparison
remains the next diagnostic; the old D3D9 capture format alone cannot preserve
legacy D3DIM live resources and framebuffer/depth history.

## October 15 paired Darkstone result (17:40 UTC)

Fresh source `fadaff08a`, module `9b57583c…`, reached Town through ordinary
character creation on both software and WebGL. Root reviewed before/idle/held
ArrowRight screenshots in both arms: camera control is verified. Main renderer
endpoint 1 reported advancing completed native software draws in the software
arm and advancing WebGL submissions in the WebGL arm. Reported WebGL errors
and all six fallback sites were zero; `declinedClears=1` remains a caveat.
Both arms exited normally and independent postflight verified idle/preserved
inputs. Full archive SHA-256 is
`25252b50372c11589f30439d0a13ab39b09576b5844c1855721c26a429c2aa8f`.
See [the paired receipt](darkstone-backend-checkpoint-20261015.md).
This supersedes backend-unknown for this new run only. Locomotion, combat,
audio, FPS, child renderer ownership and original-27 membership remain open.


## October 15 current integration status (14:38 UTC)

This section supersedes the earlier same-day startup and unmerged-palette
statuses below; those sections remain dated evidence.

- Palette candidate `6b269258560cb24c4370d0cd270d95c2eed7a00b` is now an
  ancestor of main. Its canonical build, sixteen CPU suites, actual WebGL1/2
  observations and both Worker synchronization modes passed. See
  [the exact validation receipt](palette-combined-validation-20261015.txt).
  Default/FALSE filtered-key semantics remain a separate contract question;
  the explicit TRUE-state tests do not settle that question.
- Fixed-function stencil/diffuse handling is merged through `9eb485acb`.
  Actual WebGL1 and WebGL2 each passed 77 observations. Removing the
  missing-texture guard caused six RGB/linkage failures, establishing that
  the oracle detects that regression. See
  [the actual GPU result](iw-render-gpu-result-20261015.json). This validates
  renderer behavior, not Invisible War gameplay or its held transport changes.
- Original .kkrieger reaches a first-person level and one reviewed ordinary
  forward movement. Evidence `2193c3869` and qualification `bee579acb` are on
  main. The [position capture](kkrieger-position-capture-20261015.md) records
  body Z progressing from 0 to 0.686228 at fixed yaw and forward basis, with
  reviewed before/after images. This closes only launch and one movement:
  observed input/release latency, repeated controls, combat, audio, FPS and
  a software/WebGL gameplay pair remain unqualified. The strict per-phase
  comparison still lacks two distinct completed samples; do not call it a
  performance measurement.
- CMR3's software LINELIST implementation is merged in `78a06540f` after
  canonical build, native raster suites and three failing negative controls.
  The [original-game replay](cmr3-lines-gameplay-20261015.md) now passes Stages,
  player/car/transmission/country selection and reaches the UK Warwick stage
  loading map. Rendering then reports `invalid native free list` after batch
  2402. The exact damaged node has not been captured; the first-failure diagnostic passed independent native conformance and is
  merged as `729d3fc73`. The subsequent original replay was automatically
  rejected for possible cybersecurity risk (exact action unspecified), then
  stopped cleanly at 13:08:09. That diagnostic replay is held: do not retry,
  rephrase or delegate it around the rejection. This restriction is separate
  from permitted compatibility/conformance work. Neither driving nor a software/WebGL gameplay pair is qualified.
  [Line conformance evidence](cmr3-software-line-lists-20261015.md) establishes
  the bounded raster fix, not the remaining game's correctness.

The earlier Invisible War transport review below is historical: the corrected
chain was subsequently merged as `3fdb29373`, an ancestor of current main,
after all eight combined native arms completed with their expected results.
The exact negative control failed with `RECEIVER_RETIREMENT_DID_NOT_SETTLE`
and the restored receiver suite passed. See the
[combined native result and merge receipt](iw-combined-native-result-20261015.md).
Original Invisible War gameplay, pointer marshalling and both renderer routes
remain unproved; native conformance does not establish those results.

Before that integration, callback transport remained on task branches. Selective
port `8793e9f47` and endpoint checkpoint `17e713cd2` preserve main's existing
lock, generation pins and INITIALIZING/LIVE/FAILED lifecycle; the older
`e2d10ebb0` branch must not replace those semantics. Exact candidate canonical
module `a948a826…` passed eight native loader/transport suites. Combined
local/Worker and Worker/Worker native endpoint races, nested initialization,
publication acknowledgements and lookup retirement passed at `4050bacb3`.

Independent review then found scheduler teardown could discard a retiring
Worker and reuse its TID/stack before termination. Fix `b5b69a714` passed
actual Worker ABI checks and canonical native validation `dca0e6201`: lost
retirement replies and generation-pin cleanup failures retain ownership;
successful termination releases the real native stack exactly once. The old
code fails the intended ownership assertion; restored code passes. Root
verified archive SHA-256
`22140338c794795536c124019079412943316e4a879b24014b4d51ea763f04fe`
under `scratch/runs/20261015-iw-retirement-native/` and its logs/postflight.

The earlier review blocked integration because PID-wide broker admission
deadlocked independent send chains and blocked a second receiver thread behind
the first.
Root reproduced both failures with real Node Workers, without guest WAT, in
`scratch/runs/20261015-iw-broker-root-review/`. Worker
`/root/iw_independent_send_fix` implemented per-thread, exact-waiting-frame
admission and regressions before the combined validation linked above. Do not
reopen this historical merge blocker as though that correction were absent.

The original 27-app membership evidence and per-game software/WebGL gameplay
coverage remain incomplete. None of these focused tests closes that goal.

## October 15 source-only next-validation reconciliation

Against `73f27af1b`, Age of Wonders II's viewport repairs `9a438f1b9` /
`201de22d9` and Start-click repair `b6e18c196` are ancestors. Its dated row's
terrain/UI defect is superseded by those merged fixes and the October 10
re-note. This audit does not independently re-review the absent October 10
capture bundle or certify a backend pair. Darkstone's complete installed
manifest is locally recoverable, but its original installer and retained
gameplay bundle are absent on this host. Neither absence invalidates the
historical observations below. The two exact next validation routes, fixture
hashes and missing evidence are in
[the bounded handoff](gl-d3d-next-validations-20261015.md).

## October 15 reviewed follow-up (09:36 UTC)

The dated table below preserves earlier results. Signed SHORT2/SHORT4 GPU
inputs and software declaration-component defaults are now on main
`ec4844f16`: canonical build, seven CPU suites and actual WebGL1/2 pixel
comparisons passed. Coordinator independently checked twelve GPU artifacts
and 266 tested-source hashes. Original `.kkrieger` run
`20261015-kkrieger-short-original` eliminates the earlier declaration errors
but still reaches EIP zero near 310 seconds, with 2 GiB memory and no OOM.
Its 42 artifacts were independently hash-checked and final screenshot viewed.
No gameplay is qualified. The next lead is a missing Buffer8 interface;
the game's actual QueryInterface HRESULT remains uncaptured. See
`docs/re-notes/kkrieger-beta.md` for the bounded diagnosis and uncertainty.

The palette candidate remains unmerged. Explicit state144 TRUE zero-RGBA
handling passed canonical build and CPU checks; new Worker coverage passed
both synchronization modes on `d582f0da5`, including native-index duplicate
RGB, held state snapshots, cache transitions and depth. Worker observations
read an XRGB DIB whose unused byte is normalized to 255, not framebuffer
alpha. Source-alpha behavior is checked through blend/test/depth effects;
direct GPU tests separately read framebuffer RGBA. Browser software-path
fixtures exposed incorrect endpoint routing and an assertion on XRGB's unused
byte; their failures are retained, corrected tests are being rerun, and no
full browser acceptance is claimed yet. A cache-identity mutation must still
fail the strengthened oracle. Default/FALSE filtered-key semantics,
alpha-palette/key precedence and legacy stencil remain separate open work.

## Original 27-app membership evidence

The original census commit is
`2d722ab3766c288d13796ed9dad3f1ceeca8f1eb` (22 September). Its message records
27 of 225 apps and seven D3DRM screensavers, but the commit contains only the
census tool and a CLAUDE.md edit, not the complete per-app output. The tool
depends on the executable/DLL files present when run. A current-asset rerun
therefore cannot authenticate the historical membership. The later expanded
69-app census is a different set, not a recovered original list.

The original stdout or session transcript associated with memory session
`bd610256-7b4f-4ed1-afa0-9c3cf3412fbb` is still missing from the inspected local
archives. The 57 references in `scratch/recovery-gl27-20261014/REPORT.txt`
refer to later dated run IDs, not 57 original September runs. Recover the
original output, or explicitly label a historically matched reconstruction;
do not infer a completed 27-app denominator from the current status table.

## October 14–15 targeted follow-up

Authorized Boat exec access now supports separate-box builds and browser tests.
The older blanket remote-access blocker is resolved; missing historical runs
and incomplete per-app software/WebGL qualification remain separate gaps.

| Scope | Verified change and evidence | Remaining work |
|---|---|---|
| .kkrieger D3D9 startup | `c79b943bb` implements signed Q8W8V8U8 storage/upload/sampling; full build and resource, software, WebGL1/2 and pipeline checks pass. `2e1d68489` fixes recycled sparse heap clearing that overwrote live mesh edges; baseline regression fails and fixed regression passes. Original demo advances beyond the persistent mesh loop. Runs `20261014-kkrieger-q8w8v8u8`, `20261014-kkrieger-mesh-writer`, `20261014-kkrieger-heap-fix`. Both fixes are on main. | Census `20261014-kkrieger-memory-census` proves backing shortage: 2,162,688 requested versus438,272 free; tables have capacity. Report on main `6cb760da2`. Registered2GiB route merged9e8afa2e5 uses174,718,976 extension bytes with OOM0 through300s. Follow-up `20261015-kkrieger-registered-600s` then exits around306s after243 generic declaration errors; correlation is not proven causality. Diagnostics/exit guard mergedcb0bf751a; exact original declaration capture is next. Retained heap space is not classified as a leak. No gameplay or both-backend acceptance. |
| Serious Sam cooperative startup | `43f04c7c4` prevents the reproduced low-EIP crash by making synchronous-fault file consumers resident on the cooperative backend. Four browser arms distinguish original failure, eager control, fixed policy and Worker behavior; runs `20261014-sam-browser-*`. Fix is on main. | Karnak gameplay/profile `20261014-sam-low-fps` measures3.18–4.05 actual GLfps on forced SwiftShader; pending GPU completion dominates this box. Report/probe `9b53a3795` on main. Logging-off control and Safari hardware cause remain unmeasured. HUD double-count fix `471dee7c2` passes focused mixed GL/GDI regression, not a performance improvement. |
| Legacy indexed palette candidates | Preserved `c2192e014` passes a separate-box full build and four real-VM CPU/page-watch/resource/software tests. Evidence `20261014-palette-remote-validation`. | Still unmerged. Source reconciliation `f8e4676ce` preserves candidate and main format63 changes. Exact reconciled candidate164dc33ad passed canonical build/four CPU suites; diagnostic-only fixture correction2b28b3e27 passed17 actual framebuffer checks each on WebGL1/2, zero fallback. Root reviewed original runtime hashes and pixel results in `20261015-palette-validation`; forced SwiftShader, reported Intel string is spoofed. Worker reports clean explicit-sync lifetime run125426 with7pixel observations/3blocked-before-drain barriers, pending root receipt review.13of14 follow-up configs pass; Boids route test assumes software default despite current WebGL default and needs explicit route selection. Default-lazy Worker variant, stencil rejection, baseline GPU failure and filtered-key/alpha-key contracts remain gaps. |

These are scoped results, not a new full-corpus sweep. Preserve the historical
rows below as dated evidence; no original 27-app completion is claimed.

The user's goal: every OpenGL and Direct3D app in the registry works on both the
**software** and the **WebGL** backend. This is the one shared status table for
it (task GLD3D-CORPUS-27-20261006). Codex coordinates the remaining work.
The Claude fleet is stopped. Codex coordinates current assignments on the board.
D3DRM rows marked w4 refer to historical work
by claude:65967384 (`docs/re-notes/plus98-dx-screensavers.md`), not a live worker.

Reconciled on **2026-10-07** against main `30f1e268`. This preserves the dated
measurements below; it is not a new full-corpus run. Tomb Raider III and
Half-Life Uplink have later retained browser evidence that supersedes their
earlier failures. Menu, loading, excluded and unmeasured rows still do not
prove the user's full software-and-WebGL gameplay goal.

Selective October 9 reconciliation adds retained Morrowind movement and Pirates
sailing evidence, current Age of Wonders II movement, and the Black & White 2
startup repair. This is not a new full-corpus or both-backend run. Missing
Pirates logs are listed below; the log provenance gaps are not passes.

### October 15 retained evidence update

Darkstone now has a fresh, recovered browser run:
`scratch/runs/20261015-darkstone-town-2`, source controller `c7e23d5f0`,
loaded module `04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
Ordinary character creation reaches Town. The road and gate remain fixed during
five idle seconds, then rotate under held ArrowRight. This proves camera
control; it does not prove champion locomotion, combat, FPS or audio.
The recovered archive SHA-256 is
`60900452d07daac7bfa60ba9e08cf5217ef66bcb1e1bca93388c034477053540`.

The software backend was requested, but the owning snapshot only exposed replay
progress, which also includes non-draw commands. Backend qualification therefore
remains unknown for this run. The October 10 paired-backend claim below remains
a historical report; its `scratch/runs/20261010T2116Z-darkstone` bundle is absent
on this host, so it has not been independently revalidated here. Do not replace
that historical claim with a fresh both-backend pass.

Main `99932f66b` adds endpoint-owned D3DIM completed-call counters, separately
for requested software and GPU fallback, published on existing natural fences.
Focused dispatcher/adapter tests cover endpoint isolation, flips and GL exclusion,
and throwing native calls. These counters were **not** in the Town run and are
not pixel-write counters. A fresh paired software/WebGL validation is queued;
no original 27-app membership or full-corpus completion follows from this update.

### October 19 reconciliation, without a new corpus sweep

Surface4/7 ABI support is on main `73433fabe`. The combined RTC/Surface build passed both ABI candidates, eight DirectDraw controls in both dispatch modes, and RTC native Worker/host/RPC checks. This qualifies the tested API behavior, not original-game rendering or both-backend coverage. Cube independent-face storage remains unsupported.

The original September 22 report names 27 measured apps without listing all IDs. The later table below has 26 rows expanding to 37 registry IDs; it must not be relabeled as the original 27-app manifest. Recover the contemporaneous census output to establish membership. The broader goal remains every registered GL/D3D app on both backends.

### October 10 follow-up, without a new corpus sweep

- Black & White 2 has further shader fixes on main: `eaf7d0316` aligns
  create-time IR/VM acceptance, `229fffacf` applies fixed fog after ps_1_4,
  and `3a908f97b` streams software raster batches when retaining all of them
  would exhaust the allocation budget. Unit and scoped differential tests
  support those changes. The software treatment run
  `20261010T1638Z-bw2-raster-budget-boat-w6` completes 3300 seconds with zero
  failed commands in 659 samples, beyond the control's ~2214-second latch.
  This proves the scoped render fix, not completion of the game-coverage task:
  post-flyover gameplay is about 37 minutes (45 required), and the corrected
  camera comparison does not separate input from scripted camera movement.
  Ordinary control and both-backend qualification remain open.
- Age of Wonders II terrain/UI overlap was repaired by `9a438f1b9` and
  `201de22d9`, reviewed by the ops coordinator. The separate 1024x768 Start
  click route is fixed in `b6e18c196`: lazy headless presentation refreshes
  the input transform before mapping clicks. The retained route
  `20261010T1731Z-aow2-screen-click-drop` reaches the world and Julia's
  welcome card. This does not upgrade the dated software row to a fresh
  WebGL or FPS qualification.
- New-game work outside the original set now includes Beyond Good & Evil:
  `0a690ad31` registers the original demo after reviewed ordinary input,
  food consumption/health change and forward movement in
  `scratch/runs/20261010T1432Z-bge-input-consumer`. Audio, sustained FPS and
  both-backend coverage remain unqualified. CMR3 still needs correct DLL
  unload/thread-exit behavior; its held draft is not a merged fix.
- Invisible War exercises the new D3D8 cube (`60349b055`) and pixel-shader
  handle (`dc2e0d410`) paths. `6bc406dc5` preserves executable identity
  across guest threads and fixes the missing UI configuration behind the
  null-object failure. The original ten-minute run
  `20261010T1726Z-deusex-iw-loading-long` still shows loading, with 21804
  completed render commands and no queue error; it is not menu or gameplay
  evidence. Ordinary focus/Escape, including a two-second hold, does not
  dismiss loading. See its
  [investigation notes](re-notes/deus-ex-invisible-war-demo.md).

The historical measurements below remain dated observations, not current-main
passes. In particular, the newer fixes do not complete this corpus goal.


## October 13 evidence reconciliation

This updates retained evidence against main fac1dc0ba; it is not a new corpus sweep.

| App / scope | Evidence now available | Remaining gap |
|---|---|---|
| Diablo II | GPU POINTLIST fix `782bc73d4` passed 40 pixel cases and ordinary browser town/control in paired `20261013T2055Z-diablo2-pointlist-control` / `-candidate`, canonical Wasm `ba6f25ea2d467b3fba00110d83575d48ac1aeb8794a474052190998067723259`. Control 38,701 fallbacks/27,556 readbacks; candidate 0/1,001 with zero backend errors. | Those optimization arms both use WebGL. Separate `20261013T2115Z-diablo2-software-town` on2cf59bcff/ba6 now verifies ordinary town/ground movement with live software endpoint, no GPU adapter and command progress. Both backend routes therefore have reviewed browser gameplay evidence on recorded versions. Different RNG/time prevents a performance comparison; logical/display FPS, audio/device remain unqualified. |
| Neverwinter Nights (new-game extension) | Real client attributes, stencil and color masks are merged. `20261013T2045Z-nwn-color-prelude` on `99e780866` / canonical `ba6f25ea…` reaches Prelude world; ordinary ground clicks change position/camera and open Pavel conversation, then Continue advances dialogue. Root reviewed captures. Local-only corpus registration `46a456ab` merged. | Evidence is CLI software with synthetic batch clock, not browser/WebGL, FPS, audio, combat or physical-device qualification. Registered browser run `20261013T2100Z-nwn-registered-browser` now also proves Prelude ground interaction and Pavel Continue; its exact GL backend remains unattested. |
| Arcanum | Retained `20261008T1431Z-arcanum-gameplay-qualified` explicitly pins both backends, ordinary movement and module identity. | Software FPS remains unqualified; later missing-knob notes do not erase this run. |
| UT2004 | Merged `fc0d7bf10`; `20261010T2240Z-ut2004-sw-menu-input-w5` retains software DM-Rankin and Up movement. | Historical installer route, not a fresh registered-app or full backend-pair certification. |
| UT2003 | `20261010T2140Z-ut2003-server-sw-w4` and both named artifacts are present; TLS/OOM fixes are merged. | Unattended listen server does not prove player movement; module hash absent. |
| Daikatana | Retained software `20261006T1830Z-daikatana-demo-gameplay` and explicit CLI WebGL `20261010T2140Z-daikatana-webgl-w4` record world, ordinary movement and weapon pickup. The latter commands `--headless-gl --gl-renderer=webgl --gl-census`; all three artifacts remain present. DLL repair remains merged. | Historical module hashes are incomplete. Browser world/control exists, but its exact GL backend is not attested: generic GPU presentation counters and static guest GL_RENDERER strings do not distinguish software. Do not duplicate generic CLI WebGL qualification. |
| FreeSpace | Earlier codec/API fixes and retained flight evidence remain available; this is not an unresolved launch crash. | Browser/device evidence remains a separate gap. |

The falling-leaf repair, registered saver clock and headless resize fix are merged. Historical 14/14 crash revisits are retained launch evidence, not a fresh full-game certification. MilkDrop remains held after automatic review; Morrowind remains paused and Heroes II belongs to the laptop.

## How the set was measured

`node tools/gfx-app-census.js --family=gl,d3drm,d3dim,d3d8,d3d9 --list` (fixed in
`3a7b0ecb` to read every PE an app mounts and the IDirect3D IID bytes) names 69
apps that can *reach* a 3D API. Static reach is not use, so every one was run:
three CLI workers, software arm only, each app traced for the calls that create
a 3D device (`Direct3DCreate8/9`, `IDirect3D*::CreateDevice`, a DirectDraw
QueryInterface for IDirect3D*, `wglCreateContext`) and photographed. Every
screenshot cited was looked at.

- Build: wasm `2809640c` at `3a7b0ecb`. Part of group A and C ran with the host
  JS at `fa4be36a` (a mid-sweep rebase; host changes were compatible: one
  optional `exeGuestPath` field, no new imports).
- Runs: `scratch/runs/20261006T02*-<app>-gld3d-sw/` (and `T03*` for later ones).
  Machine-readable rows: the sweep JSONs named in the GLD3D TODOS record.
- **WebGL arm.** `--headless-gl` is unavailable on this box (no
  `@node-3d/webgl`/`glfw`, no display), so the WebGL column is measured in the
  page instead: `tools/web-input-probe.js --app=ID --gpu` (without `--gpu` the
  probe's Chrome has no WebGL at all), the app's software route translated to
  timed keys/clicks, a reviewed screenshot, and the console checked for
  `[d3dim-gpu] D3DIM draws on WebGL` (D3D8/D3D9 use the D3D9 bridge, whose
  backend is `webgl` unless `?d3d9-renderer=software`, with no silent fallback).
  Rows dated **2026-10-06** were measured that way at `97aae839` (runs
  `scratch/runs/20261006T1840Z-gld3d-webgl/`); older dates quote the last
  browser or headless-GL verification from the app's re-notes and are not a
  measurement at this build. The DirectAnimation saver scr_corbis also draws
  its photo grid on WebGL there.
- **Tomb Raider III follow-up:** the later page route reaches Jungle and
  ordinary Up input moves Lara toward the cave. The earlier title-only result
  was route timing: Enter must reach the title ring before its attract demo,
  then wait for the passport animation. See `48ffb5e5` and
  `scratch/runs/20261006T2030Z-tr3-web-title-input/result.json`.
- The original sweep capped runs at 120 s, so historical "menu" or "loading"
  can mean the cap, not a defect. Later scoped routes record their own limits.

## Apps that really use OpenGL or Direct3D

| app | API at runtime | software | WebGL (date = when verified) | blocker / note |
|---|---|---|---|---|
| blood2_demo | D3DIM (Device3) | **gameplay** | **gameplay** (2026-10-06, browser; in-level, HUD 100/50; `scratch/runs/20261006T1840Z-gld3d-webgl`) | — |
| tomb_raider_2_demo | D3DIM (Device2) | **gameplay** | **gameplay** (2026-10-06, browser; Venice alley) | — |
| tomb_raider_3_demo | D3DIM (Device2) | **gameplay** | **gameplay** (2026-10-06, later browser route; Jungle and ordinary movement, `scratch/runs/20261006T2030Z-tr3-web-title-input`) | Earlier title result superseded by route timing correction `48ffb5e5`; no input repair needed. |
| gta2_demo | D3DIM (Device3) | **gameplay** | **gameplay** (2026-10-06, browser; city map, HUD) | — |
| mw3 | D3DIM (Device3) | **gameplay** (cockpit) | menu (2026-10-06, browser, no input; an Escape in the page's timing QUITS the demo, exit 3); gameplay (2026-09-20) | route: Escape at batches 10-41 skips the Zipper intro |
| diablo2_demo | D3DIM (Device3) | menu (hero select) | menu (2026-10-06, browser; Single Player / Exit) | gameplay needs > 120 s |
| darkstone_demo | D3DIM (Device2) | menu in dated sweep | menu (2026-10-06, browser) | Later retained Town before/after images show champion, HUD and substantial camera rotation; root reviewed them on October 8. Original backend, module and command log were not recovered, so neither backend is newly qualified. See `scratch/runs/20261007-darkstone-retained-gameplay-audit/result.json`; do not count this as a never-played new title. |
| arcanum_demo | D3DIM (D3D7) | **gameplay + player movement** (2026-10-08); FPS unqualified | **gameplay + player movement** (2026-10-08); idle crash-site 21.56 presentations/s | current source/module/backend pinned; 434 visible submissions / 20.127 s, not scanout; retained earlier gameplay, not a new never-qualified game; [handoff](../ops/handoffs/arcanum-gameplay-20261008.md) |
| dx_boids / dx_flip3dtl / dx_tunnel / dx_twist | D3DIM | **renders** | **renders**, all four (2026-10-06, browser; `scratch/runs/20261006T1935Z-gld3d-webgl-recheck`) | — |
| mcm | D3DRM over Device2 | **gameplay** (race) | gameplay (2026-09-20); not re-run (long route) | w4 |
| dx_globe / dx_viewer | D3DRM | **renders** | **renders** (2026-10-06, browser) | globe texture seam (w4) |
| scr_architec, fallingl, geometry, jazz, oasaver, rockroll, scifi | D3DRM | **renders** (w4 rerun at `--tick-ms-per-batch=2`) | **7 savers render** (2026-10-06, browser; fallingl dark leaves and oasaver green field as on software) | fallingl black leaves, oasaver stray box: w4 |
| halflife_uplink | OpenGL | **gameplay** (corridor + HUD) | **gameplay** (2026-10-06, lazy-file browser route after `5f4bac8c`; `scratch/runs/20261006T2100Z-hl-uplink-lazy-mci/4-gameplay-webgl-lazy.png`) | MCI lazy park now waits for IO; subclassed dialog buttons receive queued mouse input. Earlier black result superseded. |
| simgolf_demo | OpenGL | **gameplay** | **gameplay** (2026-10-06, browser; course + build bar) | — |
| quake2_demo | OpenGL (ref_gl) | **gameplay + ordinary forward/reverse/idle traversal** (2026-10-08, temporary browser, guest Worker/WAT software OpenGL, accepted reference `096889e1` / module `fb1be916`; [reviewed run](../scratch/runs/20261008T000901Z-quake2-software-ordinary/result.json)) | **gameplay + ordinary forward/reverse/idle traversal** (2026-10-07, temporary browser, guest Worker/WebGL, module `fb1be916`; [reviewed run](../scratch/runs/20261007T213620Z-quake2-ordinary-traversal/result.json)) | Original ref_gl Game → Easy; support-beam approach/reverse and stable idle landmarks reviewed on both backends. Software world visible by 49.617 s after selection, WebGL by 54 s. Software endpoint selection verified in host and owning render Worker, without GL WebGL fallback. Fresh software execution uses the unchanged accepted reference host/module closure, not a new current-main build. FPS/audio/network unqualified; [software identity and cleanup](../ops/handoffs/quake2-software-ordinary-20261008.md), [WebGL identity and cleanup](../ops/handoffs/quake2-ordinary-traversal-20261007.md). Historical 2026-09-23 gameplay retained. |
| warcraft3_demo | OpenGL | **Prologue gameplay, Thrall selection and two opposing ordinary move orders** (2026-10-08, temporary browser; guest OpenGL software; reference `f62ab3c9` / module `4dc5ac2c`; `scratch/runs/20261008T0400Z-warcraft3-software-runtime`) | **Prologue gameplay, Thrall selection and two opposing ordinary move orders** (2026-10-08, temporary browser; reference `f62ab3c9` / module `4dc5ac2c`; `scratch/runs/20261008T0156Z-warcraft3-campaign-world-runtime`) | Coordinator reviewed WebGL displacement against fixed hut, stone circle and rocks; matching live host/owning WebGL and all675 contained hashes verified. Coordinator also reviewed software selection and opposing displacement against the same landmarks, verified matching host/owning software endpoints and all666 contained hashes; integrated on main `0d9515322`. No engine change. FPS/audio/combat/campaign completion and a current-main build remain unverified. [Identity, route and cleanup](../ops/handoffs/warcraft3-campaign-world-20261008.md). [Software identity, route and cleanup](../ops/handoffs/warcraft3-software-20261008.md). Historical SetPixelFormat repair `579ee802` retained. |
| ptct | OpenGL | renders, correctness unverified | beams draw (2026-10-06, browser) | 0.35 presents/s on software |
| ut2003_demo | D3D8 | menu | menu (2026-10-06, browser, no route); gameplay (2026-09-25) | each frame ~1 s on software |
| ut2003_demo_server | D3D8 | **gameplay** (listen server renders DM-Antalus) | **gameplay** (2026-10-06, browser; DM-Antalus, HUD) | — |
| ut2004_demo | D3D8 | splash at 120 s | menu (2026-10-06, browser, no route); gameplay (2026-09-25) | slow |
| alien_shooter | D3D8 | **Mission 01 gameplay, movement and firing** (2026-10-06; `scratch/runs/20261006T0612Z-alien_shooter-w4-gameplay2`) | **Mission 01 gameplay, ordinary movement and aiming** (2026-10-08; `scratch/runs/20261008T0114Z-alien-shooter-webgl`, accepted reference `f62ab3c9` / module `4dc5ac2c`) | Root reviewed player movement and opposing aim poses; live host and owning WebGL proved,109 artifact hashes verified. No engine patch. FPS/audio/combat completion/current-main build unqualified. [Handoff](../ops/handoffs/alien-shooter-webgl-20261008.md). |
| crimsonland | D3D8 | **Tutorial gameplay and movement** (2026-10-06; `scratch/runs/20261006T0500Z-crimsonland-w4-survival`) | **Tutorial gameplay, movement and aiming** (2026-10-08; owning WebGL, reference `f62ab3c9` / module `4dc5ac2c`; `scratch/runs/20261008T0105Z-crimsonland-relative-input`) | Ordinary trusted relative mouse motion establishes real menu hover before clicking; arrow keys move player/terrain and relative input moves aim. Harness correction only. FPS/audio/combat/Tutorial completion and current-main build remain unqualified. |
| pawn | D3D9 | **gameplay** (board) | board (2026-10-06, browser); gameplay (2026-09-23) | — |
| pirates_2004 | D3D9 | **menu** after `ba161dfb` + `12408feb` + `d7f5a429` | **retained sailing captures** (October 2; record reports Worker/WebGL, source commit unknown, six logs missing) | Ship displacement/date progression visible; white terrain remains. Module hash recorded as `7c5f97f5...`; source commit unknown. [Run](../scratch/runs/20261001-pirates-worker-sailing-after/result.json). No fresh backend qualification; recover provenance or revalidate. Local1371 manifest paths present (1,294,935,424bytes); lack of room for a duplicate local archive is not itself a remote-transfer blocker. |
| black_white_2_demo | D3D9 | **island flyover** (October9, normal intro/menu with Worker boot fix `efcef0022` and live relative-input opt-in); player control pending | not freshly measured | Shared PE tail mapping fixes startup. Current flyover advances but has recurring rejected draws with declaration/FVF zero, despite zero main-Worker declaration-rejection counters; origin unproven. Stale right-edge pixels and garbled menu text remain. [Live run](../scratch/runs/20261009T0335Z-black-white2-staging-fix/result.json); no ordinary gameplay/FPS claim. Historical diagnostic intro-skip gameplay remains separate. |
| morrowind | D3D8 | no reviewed software gameplay in this reconciliation | **prison-ship gameplay, forward/reverse movement** (October5; Worker/WebGL) | [Reviewed run](../scratch/runs/20261005-morrowind-prison-movement/result.json), source `94d18605`, module `2e2fd8d1`; four review-image hashes and retained module rechecked October9. Partial typing loss and inset viewport remain. Not current-main, full character creation, audio or FPS qualification. |
| age_of_wonders2_demo | D3DIM | **gameplay and army movement** (October9, `ff0c1f07b`) | not measured by this run | [Reviewed run](../scratch/runs/20261009T0306Z-age-of-wonders2-gameplay/result.json). FVF RESERVED1 stride repair prevents Miles callback overwrite; movement20→13 verified. Terrain/UI overlap subsequently repaired by merged `9a438f1b9` / `201de22d9`; October 10 re-note reports clean panels on both renderers. Raw later bundle absent on this host; current backend/control pair, FPS/audio remain unqualified. |
| winamp | D3D8 (MilkDrop) | not run (CLI) | ordinary playback/Start opens MilkDrop then illegal-operation error (2026-10-07, browser) | original1.04e passes music gate but no visualization; fault/API cause unknown, native DLL probe refusals retained ([run findings](../ops/handoffs/winamp-milkdrop-ordinary-20261007.md)) |

Glide is not in this goal's scope, but the sweep saw it: nfs3_glide_demo
gameplay; diablo2_glide_demo title at 120 s (software Glide 1-2 batches/s and
its frame fills only 512x384 of 640x480); hitman_glide_demo crashes on the CLI
software arm (NULL object call in `EngineData.dll` 0x0ff6da1f during level
load; its re-note has the browser arm getting further).

## In the census, but not 3D at runtime

The IID evidence over-reports, exactly as the census warns: a DirectDraw game
that links `dxguid.lib` carries every DirectX GUID. Confirmed 2D (or GDI) by
trace: jazz2_demo, moorhuhn, moorhuhn_2, gallinelle (probe IDirect3D2/7, never
create a device), pocket_tanks, heroes3_demo, captain_claw_demo, aoe1, aoe2,
nfs3_demo (its own `softtria.dll` renderer), ut348_demo (SoftDrv), generally,
generally_track_editor, baldurs_gate_chapters_1_2_demo, icewind_dale_demo,
scummvm_fotaq, tworld, dungeons_of_dredmor(_release) (SDL; no GL calls),
arena_gog/daggerfall_gog/ultima4_gog (DOSBox `output=surface`; `opengl` is a
config option, not pursued), scr_win98, spider, and the four DirectAnimation
theme savers (scr_corbis/fashion/horror/wotravel). aoe1 and pirates_2004 also
match through a setup.exe/dxdiagn.dll that only lists DirectX files.

## Open blockers in the GL/D3D set, ranked

1. ~~DirectX version detection~~ -- both fixed. Crimsonland: `1fdd9a64`, a
   versioned `D3D8.DLL` stub (DirectX 8.1). Pirates: the DxDiag query was
   only its error-message chooser; the real failure was `MaxTextureBlendStages`
   = 0 in our caps (`ba161dfb`), then a failed `CoCreateInstance` (Miles A3D)
   re-running its thunk (`12408feb`), then the CLI ignoring `bigMemory`
   (`d7f5a429`).
2. **Crimsonland Tutorial control qualified on both backends**: retained October 6 software movement and October 8 ordinary WebGL movement/aiming are reviewed. WebGL required actual relative mouse input for Pointer Lock; absolute page coordinates had not established the menu target. This is a harness correction, not an engine patch. Survival, combat, FPS, audio and Tutorial completion remain unverified.

3. **Throughput, not correctness**: ut2003/ut2004/arcanum
   reach gameplay only past the 120 s cap on the dated software sweep.
   Quake II's fresh ordinary software run on the accepted reference build
   reaches the world by 49.617 s after Easy, superseding its earlier cap result.
4. **Remaining WebGL coverage**: the October 6 spot checks and later TR3/Uplink
   follow-ups are retained above. Pirates has retained sailing pictures with incomplete provenance; Morrowind
   has reviewed WebGL movement, and BW2 currently reaches its ordinary island flyover.
   Their software/WebGL pairs remain incomplete, and several other rows only
   prove menus or rendering. Do not reopen
   completed spot checks or mark the overall gameplay goal complete.
5. **D3DIM PBO warning**: emulator lifecycle audit and standalone Chrome151
   reproduction are complete. The standalone4x4 case reproduces the warning
   with correct pixels; the emulator trace has216 writes/215 reads and no
   overwrite violation (one capture-end pending read). Do not queue a speculative
   renderer repair or repeat the old causal trace. Browser-side warning remains;
   performance impact unmeasured. [Receipt](../ops/handoffs/pbo-chrome151-reproduction-20261007.json).

Outside the 3D set but found here: the DirectDrawFactory IID typo (fixed
`fa4be36a`; the theme savers then run the existing DirectAnimation shim, frames
unverified until their JPGs can be decoded: skia-canvas's native binary is
missing on this box at the software sweep; the later browser photo-grid
check is recorded above); aoe2's Unicode IDirectPlay4
QueryInterface (handed to the AoE lane on the board); `PathAppendA` for
dungeons_of_dredmor (fixed by w5 `5ca54afc`).


### D3DIM asynchronous PBO warning: source audit, 7 October 2026

No proven unsafe PBO reuse yet. Do not implement the old TODO's proposed ring or fence wait from the warning alone. No engine edits, tests, browser, build or performance measurements were performed. Drakan's acceptance fixture remains unchanged.

## Exact evidence

`source-receipt.json` hashes the source copies and original MW3 console. The console contains 145 instances of the shadow-copy-discard warning. The relevant `lib/d3dim-gpu.js` at origin/main e710d101 is byte-identical to feature commit fcfa4989. The shared checkout is older: this audit deliberately uses Git object contents, not its working-tree file.

In that source, `_flip` lines 457–498 collects an existing `t.inflight` at line 468 before writing the same PBO. `_completeInflight` lines 501–520 binds `t.pbo`, calls `getBufferSubData`, unbinds and deletes the fence. The normal path therefore orders readback before reuse. No explicit `clientWaitSync` exists; synchronous collection can still block.

The dead-target branch at lines 362–365 discards an unread pending result, deletes its sync, destroys the device and removes the target. It does not itself reuse that PBO. Resizing at lines 207–212 fences before destroying/replacing the target. These branches need live identity evidence before attributing the warning to discarded reads. `_completeInflight` clears its JS pending record before GL collection; an exception would leave no retry record. A WebGL validation failure can also return normally without copying. Neither is established in the saved run.

## What Chromium actually warns about

Primary source is pinned to Chromium revision d03948c49f64c93042f36929fc9a89d1e688c6e6, **not claimed to match the installed browser revision**:

- [GLES implementation](https://chromium.googlesource.com/chromium/src/+/d03948c49f64c93042f36929fc9a89d1e688c6e6/gpu/command_buffer/client/gles2_implementation.cc), `AllocateShadowCopiesForReadback`, lines 5908–5928: warning means `Buffer::Alloc` found an already allocated internal shadow for a written/unfenced buffer. It does not inspect our JavaScript `inflight` flag.
- [Shadow tracker](https://chromium.googlesource.com/chromium/src/+/d03948c49f64c93042f36929fc9a89d1e688c6e6/gpu/command_buffer/client/readback_buffer_shadow_tracker.cc), lines 26–76: allocation persists until `Free`; successful unmap frees it. Readback validity additionally compares write/readback serials.
- [WebGL2 implementation](https://chromium.googlesource.com/chromium/src/+/d03948c49f64c93042f36929fc9a89d1e688c6e6/third_party/blink/renderer/modules/webgl/webgl2_rendering_context_base.cc), lines 354–387: `getBufferSubData` validates, maps, copies and unmaps. Validation or mapping failure returns without that completed sequence. GLES unmap frees the shadow even when mapping used the synchronous fallback (lines 5442–5453). Consequently, merely omitting `clientWaitSync` does not prove why the *next write* warning occurs. A different warning explicitly diagnoses readback without waiting.

## Existing coverage and minimal next proof

`test/test-d3dim-gpu-async-flip.js` covers one queued flip, unrelated-range deferral, original-DIB collection, global collection, and synchronous fallback. It has no repeated-flip, discard/recreation or multiple-PBO identity case. Its mock `getBufferSubData` reads a variable last assigned by `bufferData`, rather than the currently bound buffer: extend that mock before trusting identity coverage.

First proposed source-only tests, once authorized: actual executor with a binding-aware GL mock; two differently colored consecutive frames; assert collect-old before write-new and correct old/new DIB bytes. Two targets/contexts must never collect each other's buffer. Dead target discards once and recreation gets a fresh resource identity; size growth collects before deletion. Negative control removing the collect-before-reuse call must fail on overwritten old-frame bytes, not a missing helper. These prove application ordering, not Chrome shadow behavior.

Then, only under a separate serialized browser grant: one short MW3 ordinary menu diagnostic, capped 10 seconds/256 detailed events with total counters and explicit dropped-event flag. Identify the actual executor and context, then assign stable WeakMap IDs to contexts, PBOs, syncs and targets. Wrap existing `bindBuffer`, `bufferData`, `readPixels`, `fenceSync`, `getBufferSubData`, `deleteSync`, `deleteBuffer` and executor target/collect lifecycle seams. Record args, bound pack-buffer identity, byte ranges, target/backing identity, entry/return/throw and warning timestamps. Forward exactly once with original receiver/arguments/results/errors. No extra readback, wait, flush, binding, getError or pixel mutation. Restore only own wrappers, report foreign replacement. Preserve observer overhead and unknown on cap/context mismatch.

Discriminating outcomes: a same-resource second write with no completed collection supports a missed/discarded-read lifecycle; a complete ordered collect between writes refutes that simple explanation and requires checking actual Chromium revision, validation and context before a change. A returned JS call alone cannot certify successful GL copying. Do not infer GPU corruption or a performance gain from warning counts. Any performance A/B belongs on separate boats with matched useful work.

### Winamp fixture identity, October 7

Static PE resource inspection identifies `test/binaries/winamp.exe` as 2.9.1.0. The registry mounts `plugins/candidates/vis_milk.dll` (430,592 bytes), not the separate `vis_milk2.dll` (425,472 bytes, Winamp 5.6.6 strings). No Winamp 5 executable was found in the `test/binaries` filename inventory. The registered plugin itself mentions a feature requiring Winamp 2.90 or later; that does not prove its full host requirement. The older “needs Winamp 5” table entry is therefore an unverified prerequisite, not an established missing-file blocker. Next inspect the exact registered plugin initialization/version gate before acquiring a different host. No runtime result is implied. Exact hashes and resources: `scratch/sweep-reconciliation-20261007/winamp-fixture-identity.json`.

### October 7 PBO executor regression follow-up

The binding-aware `test/test-d3dim-gpu-async-flip.js` now passes on unchanged
executor SHA-256 `e3370b31c0a63aff9420dc89f044f121c87bb2140a7683f4917f199a17680b8f`.
It proves same-PBO two-frame collection ordering and distinct DIB contents,
correct currently bound buffer despite another allocation, reversed collection
of independent contexts, rejection of a foreign-context PBO, and dead-target
discard/removal without a subsequent flip reusing that target. The GPU and
surface metadata are fixture objects; this is the actual JavaScript executor,
not actual Chrome/GPU execution. Resize/recreation is not newly covered.

Under the explicit pure-JS lease, candidate PID 2407020 exited 0 and private
in-memory `--negative-control` PID 2407027 exited 1 at the intended first-frame
byte assertion: actual `[17,17,17,17]`, expected `[48,32,16,255]`. The control
removes only collection before reuse, so setup or missing exports cannot
explain that expected failure. Both processes completed within 46.221 ms total
at 08:58:53.624Z; this duration is a cleanup receipt, not a benchmark.

Receipt/logs: `scratch/d3dim-pbo-audit-20261007/test-validation.json`,
`candidate.log`, `negative-control.log`. Test SHA-256:
`f9cfd55d29972759b7595aedea386bb4cb106d390d5fa4aeb05919b6a6dba13e`.
No engine change or claim that Chrome's warning is fixed. The bounded live
context/PBO lifecycle observer above remains the next causal diagnostic.

### Registered MilkDrop initialization gate, October 7

The exact registered `vis_milk.dll` export at `0x100299c0` returns its header directly. Its initializer at `0x10029a90` contains no blanket Winamp 5 rejection at the historical music check: it queries the host using `SendMessageA(WM_USER, 0, 0)`, accepts a result at least `0x4000`, and otherwise accepts `SendMessageA(WM_USER, 0, 0x68) == 1`. Only the latter failing path shows “This plugin can't run without music” and returns failure. This identifies an older-host playback condition, not proof of successful rendering. Raw exact-PE disassembly is retained at `scratch/sweep-reconciliation-20261007/milkdrop-init-disassembly.txt`.

Current `test/test-winamp-visualizers.js` documents and exercises MilkDrop header enumeration on the existing host; its historical remaining-gap comment names cross-thread IsPlaying delivery, not a Winamp 5 dependency. Main `2dab96f8` later changed Worker-to-main SendMessage delivery and is in the pinned `3b8189f5` runtime ancestry, but its WinBoard regression does not prove the MilkDrop route. Next run the actual registered plugin with ordinary playback/Start and observe the returned playback query and D3D device creation under each relevant thread mode. Keep software/WebGL rendering unqualified until that evidence exists. No host download or new runtime was performed for this source audit.

### Retained software evidence reconciliation, 8 October 2026

Root reviewed Crimsonland `s0.png` and `s-moved.png` from the October 6
Tutorial run: terrain moves beneath the player and the HUD remains visible.
Root reviewed Alien Shooter `m17500.png` and `m-fire.png`: the soldier moves
from the road to the fence and the later image shows firing. The run records
identify source commits `95e04dd8` and `d699e4df`, respectively; both omit
WASM hashes. These are retained historical software results, not fresh tests
of current main. Neither establishes WebGL gameplay, FPS or audio.

### October 9 retained-evidence limits

Pirates sailing images were inspected again: the ship leaves Port Royale and
the calendar advances from January11 to February3. The result record reports
WebGL but the following referenced files are absent from
`scratch/runs/20261001-pirates-worker-sailing-after/`:

- `worker-stretch-isolated.log`
- `stretch-tests-4.log`
- `stretch-baseline.log`
- `stretch-caps.log`
- `stretch-build-2.log`
- `color-targets-web.log`

The screenshots alone cannot restore the missing source/backend execution
record. These are retained pictures, not newly verified current-main gameplay.
Morrowind has stronger retained evidence: review.json records W/S1200ms and
idle1500ms, four screenshot hashes match, and the retained wasm matches
`2e2fd8d1ca62cd87f0bc09312bc4836108df610d00cb7771bb5ae22755eceedc`.
DiabloII lazy-default evidence ends at ActI loading; do not promote it to
gameplay merely because its regression result says passed.

## Current-main status, 10 October 2026 (GL-D3D-CORPUS-STATUS-20261010)

One row per app that draws through OpenGL or Direct3D at runtime, combining
the best dated evidence above, the per-app re-notes and `scratch/runs`, and a
fresh two-arm probe on current main. The sections above are unchanged.

**Census.** `node tools/gfx-app-census.js --family=gl,d3drm,d3dim,d3d8,d3d9 --list`
at `c50336dcc`: **90 of 289** registry apps reach a 3D API statically (ddraw 82,
d3drm 14, d3dim 68, d3d8 13, d3d9 4, gl 25). The 21 apps registered since
the October 6 sweep are classified below. Every census app appears exactly
once, either in the 3D table or in the not-3D list.

**Fresh probes.** Boat `bx_u968n4h4` (4 vCPU, llvmpipe, Xorg `:0`, ops
services off), main `cac339517`, wasm `6a798f18`. Each run is a bounded
`test/run.js --app=ID --no-close --png`; software arm is the default
(D3DIM/D3DRM), `--d3d9-renderer=software` (D3D8/9) or `--gl-renderer=software`;
GPU arm is `--headless-gl` (+ `--d3dim-gpu` for D3DIM/D3DRM). Runs, final
frames, log tails and the probe script are in
`scratch/runs/20261010T1850Z-gld3d-current-main-probes/`. A probe without an
input route only proves boot-to-menu and a clean exit; gameplay columns cite
the routed runs.

Legend: **gameplay** = ordinary control proven in a reviewed run; **renders**
= the 3D scene draws (no gameplay concept); *menu* / *loading* = how far the
best run got; **P** = reached in the 10-10 probe on current main.

### Apps that draw through OpenGL or Direct3D

| app | API | software | WebGL / GPU | first open blocker (row) |
|---|---|---|---|---|
| alien_shooter | D3D8 | **gameplay** 10-06 `20261006T0612Z-alien_shooter-w4-gameplay2` | **gameplay** 10-08 `20261008T0114Z-alien-shooter-webgl` | — |
| crimsonland | D3D8 | **gameplay** 10-10 `20261010T0515Z-crimsonland-cli-frames` | **gameplay** 10-08 `20261008T0105Z-crimsonland-relative-input` | — |
| diehard_nakatomi_demo | D3D8 | **gameplay** 10-10 `20261010T0230Z-diehard_nakatomi_demo-gameplay` | **gameplay** 10-10 `20261010T0315Z-diehard_nakatomi_demo-web` | — |
| ut2003_demo_server | D3D8 | **gameplay** (DM-Antalus, sweep row) | **gameplay** 10-06 `20261006T1840Z-gld3d-webgl` | software row has no reviewed result.json |
| ut2003_demo | D3D8 | **gameplay** 10-10: DM-Antalus, joined, HUD 100/150, Up walks to the boulder, Left turns (`20261010T2050Z-ut-family-both-arms`) | **gameplay** 10-10 (`--headless-gl`): DM-Antalus, Up walks into a weapon pickup, Left turns (same run) | headless-GL frame drawn 4,24 px off the client origin (HEADLESS-GL-CLIENT-OFFSET-20261010) |
| ut2004_demo | D3D8 | menus 10-10 (Instant Action game-type list) but clicks land late and ~40 px high, so gameplay was not reached before the boat TTL; DM-Rankin spawn 09-29 (re-note) | **gameplay** 10-10 (`--headless-gl`): DM-Rankin spawn with bots fighting, Up moves down the corridor, Left turns (same run) | software menu input mapping (UT2004-SW-MENU-INPUT-20261010); GPU menu list boxes draw empty |
| morrowind | D3D8 | *world renders*, no reviewed software movement | **gameplay** 10-05 `20261005-morrowind-prison-movement` | software run needs a heavy route (user: no Morrowind runs) |
| winamp (MilkDrop) | D3D8 | not run | MilkDrop opens then illegal-operation fault 10-07 | MilkDrop fault (TODOS line "Diagnose original Winamp MilkDrop exception") |
| pawn | D3D9 | **gameplay** 09-23; board renders **P** | **gameplay** 10-03 page; board renders **P** | — |
| pirates_2004 | D3D9 | *menu* | retained sailing pictures, provenance gap | PIRATES-ROUTE-FOLLOWUP, PIRATES-TERRAIN-REVIEW |
| black_white_2_demo | D3D9 | island renders 3300 s, 0 failed commands 10-10 `20261010T1638Z-bw2-raster-budget-boat-w6`; control not shown | not measured since 09-15 (wrong scene then) | GAMEPLAY-black_white_2_demo |
| blood2_demo | D3DIM Dev3 | **gameplay** | **gameplay** 10-06 | — |
| tomb_raider_2_demo / tomb_raider_3_demo | D3DIM Dev2 | **gameplay** | **gameplay** 10-06 (`20261006T2030Z-tr3-web-title-input`) | — |
| gta2_demo | D3DIM Dev3 | **gameplay** | **gameplay** 10-06 | — |
| mw3 | D3DIM Dev3 | **gameplay** (cockpit) | **cockpit gameplay + forward movement** 10-10, `--headless-gl --d3dim-gpu`, 49,818 GPU draws, 0 fallbacks (`20261010T2110Z-mw3-webgl-cockpit-w5`) | — |
| diablo2_demo | D3DIM Dev3 | *menu* / Act I loading | *menu* 10-06 | gameplay needs a longer route |
| darkstone_demo | D3DIM Dev2 | **Town gameplay** 10-10, software D3DIM: camera turns under Right input (`20261010T2116Z-darkstone`, w5) | **Town gameplay** 10-10, `--headless-gl --d3dim-gpu`: camera turns under Right input, 62,238 GPU draws, 0 fallbacks (same run) | — |
| arcanum_demo | D3D7 | **gameplay** 10-10 `20261010T0810-arcanum-control-frames` | **gameplay** 10-08 (backend knob not recorded) | — |
| age_of_wonders2_demo | D3DIM | **gameplay** 10-09 `20261009T0306Z-age-of-wonders2-gameplay` | **gameplay + army movement** 10-10, page WebGL on a GPU-less boat Chrome (`20261010T1145-aow2-viewport-clip-fix`, after `9a438f1b9`) | — |
| mcm | D3DRM / Dev2 | **race P**: Stunt Quarry, riding, 200 s routed run | **race P**: same route, 225k GPU draws, 0 fallbacks | — (first current-main WebGL race since 09-20) |
| dx_flip3dtl | D3DIM | **renders P** (textured cube) | **renders P** (33k GPU draws, 0 fallbacks) | — |
| dx_globe | D3DRM | **renders P** | **renders P** (233k GPU draws) | — |
| dx_viewer | D3DRM | **renders P** | **renders P** | — |
| dx_boids / dx_tunnel / dx_twist | D3DIM | **renders** 09-23 | **renders** 10-06 `20261006T1935Z-gld3d-webgl-recheck` | — |
| scr_jazz | D3DRM | **renders P** (first dated software run) | **renders P** | — |
| scr_architec, geometry, oasaver, rockroll, scifi | D3DRM | **renders** 10-06 `…-w4-software` | **renders** 10-06 `…-w4-webgl` | oasaver stray box (minor) |
| scr_fallingl | D3DRM | renders, leaves draw as black silhouettes | same picture | SCR-FALLINGL-BLACK-LEAVES-20261010 |
| zuma_deluxe | D3D7 (9 lit-off 2D quads) + DDraw | **gameplay** 10-10 `20261010T0710Z-zuma_deluxe-control-frames-w6`; title **P** | **gameplay** 10-04 `20261004-zuma-adventure-gameplay`; title **P** (9 GPU draws) | — |
| avp_alien_demo / avp_marine_demo | D3DIM (execute buffers) | **gameplay** 10-06 (`20261006T072800Z-avp-alien-demo-forward-walk`, `20261006T073600Z-avp-marine-demo-gameplay`); menu **P** | **gameplay** 10-10, both demos in-game on WebGL (`20261010T1930Z-avp_alien-webgl-w4`, `20261010T1930Z-avp_marine-webgl-w4`) | — |
| carmageddon2_demo | D3DIM Dev2 | **gameplay** 10-06 `20261006T075600Z-carmageddon2-demo-gameplay` | **race with control** 10-10, `--headless-gl --d3dim-gpu`, accelerating among opponents (`20261010T2100Z-carma2-webgl-w4`) | — |
| carmageddon_tdr2000_demo | D3D7 | **race** 10-10: opponents racing, HUD (`20261010T2035Z-tdr2000-loader-stall-w6`). The earlier "stall" was a long CRT-heavy load: use `--batch-size=500000` | **race with control** 10-10, `--headless-gl --d3dim-gpu`, lap 1/4 with kills after Up (`20261010T2100Z-tdr2000-webgl-w4`) | software steering not separately proven |
| cmr2_demo | D3D7 | **gameplay** 10-06 `20261006T1650Z-cmr2_demo-gameplay-w6`; menu **P** | **in-race with control** 10-10, `--headless-gl --d3dim-gpu`, Sweden stage at 11 mph after Up (`20261010T2100Z-cmr2-webgl-w4`); the menu glyph blocks were fixed by `8918a13de` | — |
| colin_mcrae_rally_demo | D3DIM | **gameplay** 10-06 `20261006T061500Z-colin-mcrae-rally-demo-gameplay`; options **P** | **in-race** 10-10 `20261010T1930Z-colin-webgl-w4` | — |
| drakan_demo | D3D6 | **gameplay** 10-06 `20261006T1600Z-drakan_demo-gameplay`; menu **P** | **in-level with control** 10-10, `--headless-gl --d3dim-gpu`, on the dragon, turn and forward (`20261010T2100Z-drakan-webgl-w4`) | — |
| quake2_demo | OpenGL | **gameplay** 10-08 `20261008T000901Z-quake2-software-ordinary` | **gameplay** 10-07 `20261007T213620Z-quake2-ordinary-traversal` | — |
| warcraft3_demo | OpenGL | **gameplay** 10-10 `20261010T0330Z-warcraft3-demo-control-frames` | **gameplay** 10-08 `20261008T0156Z-warcraft3-campaign-world-runtime` | D3D8 path (registry without `-opengl`) reaches only the menu |
| halflife_uplink | OpenGL | **gameplay** 09-22 | **gameplay** 10-06 `20261006T2100Z-hl-uplink-lazy-mci` | — |
| simgolf_demo | OpenGL | **gameplay** 10-06 | **gameplay** 10-06 `20261006T0503Z-simgolf_demo-webgl-route-w5` | — |
| anachronox_demo | OpenGL | **gameplay** 10-06 `20261006T1940Z-anachronox_demo-gameplay-w6` | **gameplay** 10-06 `20261006T2030Z-anachronox_demo-web-w6` | — |
| daikatana_demo | OpenGL | **gameplay** 10-06 `20261006T1830Z-daikatana-demo-gameplay` | **gameplay** 10-06 `20261006T1910Z-daikatana-demo-web` (renderer not recorded) | — |
| descent3_demo | OpenGL | **gameplay** 10-06 `20261006T1320Z-descent3_demo-gameplay-w6`; pilot screen **P** | **in-flight gameplay** 10-10: cockpit, yaw and laser fire, energy 100 -> 99, 664k GL draws (`20261010T2030Z-descent3-webgl-flight-w4`). It needed the `lib/gpu-backend.js` fix below; before it, the run crashed at the pilot screen | — |
| baldurs_gate2_demo | **DirectDraw** as registered: 0 GL calls at startup and menu on both arms, no `3D Acceleration` key in baldur.ini (`20261010T1930Z-bg2-renderer-w4`) | movement 10-09 (native CLI, no result.json) | **gameplay** 10-10 `20261010T0146Z-bg2-browser-lock-fix` (DirectDraw) | its OpenGL path (`3D Acceleration=1`) is unexercised |
| ptct | OpenGL | **renders P** (untextured beams) | **renders P** (72 draws, 24 presents in 50 s) | correctness unverified (0 texture uploads) |
| deus_ex_demo | SoftDrv by default; D3DDrv / OpenGlDrv optional | D3DDrv on software D3DIM 10-06; OpenGlDrv intro 10-06 | D3DDrv menu + Training 10-06 `20261006T1115Z-deusex-renderer-bench` | GAMEPLAY-deus-ex-demo |

### Census apps that do not draw through OpenGL or Direct3D

The October 6 list above still holds: jazz2_demo, moorhuhn, moorhuhn_2,
gallinelle, pocket_tanks, heroes3_demo, captain_claw_demo, aoe1, aoe2,
nfs3_demo, ut348_demo, generally, generally_track_editor,
baldurs_gate_chapters_1_2_demo, icewind_dale_demo, scummvm_fotaq, tworld,
dungeons_of_dredmor, dungeons_of_dredmor_release, arena_gog, daggerfall_gog,
ultima4_gog, scr_win98, spider, scr_corbis, scr_fashion, scr_horror,
scr_wotravel. Glide (out of scope): nfs3_glide_demo, diablo2_glide_demo,
hitman_glide_demo.

New since that sweep, each with a reviewed gameplay run on its own renderer:
asghan_demo, braveheart_demo, crusaders_mm_demo and populous_tb_demo draw
with their own software renderer through DirectDraw (the registered exe; their
D3D/Glide exes are not registered). croc2_demo never calls `CreateDevice`,
even with a HAL seeded. disciples2_demo is DirectDraw only. driver_demo's
`config.exe` offers only Glide.

### Found and fixed on the way: desktop GLSL explicit LOD

`--headless-gl` crashed Descent 3 at its first GL_CLAMP draw:
`extension 'GL_EXT_shader_texture_lod' unsupported in fragment shader`.
`lib/gl-compat.js`'s border-sampling program is ESSL. The Node bridge exposes
desktop GLSL, where that extension is `GL_ARB_shader_texture_lod` and the
function is `texture2DLod`. `lib/glide-backend.js` already made that rewrite
for its own shader. `portToDesktopGLSL` in `lib/gpu-backend.js` now makes it for
every shader. `test/test-headless-gl.js` compiles such a program. On the boat
it fails with the exact Descent 3 error on unchanged main, and passes with
the fix. Browsers are unaffected: their WebGL1 knows the EXT name.

`test-headless-gl.js` was already red on main before this change, for two
reasons. Its `run.js` regex predated `HEADLESS_GL || GLIDE_RENDERER === 'software'`
(now fixed here). Later, its resize assertion
`right edge stale: drawing buffer was not resized` fails under llvmpipe both
with and without this change: HEADLESS-GL-RESIZE-STALE-20261010. Fixed in
`636e0c8b7`: once a context has drawn, Mesa keeps its drawable at the old
size until the next swap, so `resizeContext` now swaps once after resizing.

### What is still open, in order

1. **Pairs still short of gameplay** (GL-D3D-PAIRS-20261010, split on the
   board 2026-10-10 20:40Z). Closed on 10-10: avp_alien/marine, colin_mcrae
   and descent3 on WebGL (w4); aow2 on WebGL (w5); mcm on both arms; tdr2000
   on software (w6); the cmr2 WebGL glyph blocks (`8918a13de`); driver_demo's
   Glide path on WebGL (`--headless-gl`, llvmpipe on a boat Xorg): the "Lose
   the tail!" chase with its HUD, GAME OVER at 01:04.48 without input as on
   software, and with `'` + Z the car burns out, turns and reaches the garage
   exit past 01:04 (d10ba697,
   `scratch/runs/20261010T2200Z-driver_demo-glide-webgl-d10ba697`).
   Closed later on 10-10: mw3 on WebGL (w5); cmr2, tdr2000, drakan and
   carmageddon2 on WebGL (w4); ut2003 on both arms and ut2004 on WebGL
   (1863d2b5); darkstone_demo on both arms (w5).
   - **Still open:** diablo2_demo on both arms (w6); the daikatana and arcanum WebGL backends and a ut2003_demo_server
     software result.json (w4); ut2004 software gameplay
     (UT2004-SW-MENU-INPUT-20261010).
   - **Not split:** bg2 is DirectDraw as registered.
2. **Heavy D3D8/D3D9 titles**: Pirates (PIRATES-* rows), BW2
   (GAMEPLAY-black_white_2_demo), Morrowind software (heavy route needs user
   sign-off).
3. **Wrong pictures**: scr_fallingl black leaves on both arms
   (SCR-FALLINGL-BLACK-LEAVES-20261010), ptct untextured.
4. **Fault**: Winamp MilkDrop (existing TODOS row).

## Current-main refresh, 11 October 2026 (GFX-CORPUS-MATRIX-20261011)

**Census.** `node tools/gfx-app-census.js --family=gl,d3drm,d3dim,d3d8,d3d9 --list`
on `4cbde5326`: **92 of 294** registry apps reach a 3D API statically (ddraw 82,
d3drm 14, d3dim 68, d3d8 13, d3d9 4, gl 24). Three of today's registrations
are absent only because their executables are fetched, not kept, on the ops
box: `re_volt_demo`, `forsaken_demo`, `midtown_madness_trial` (all DirectX 5/6
D3DIM, run below).

**Probe.** Boat `bx_az67mx8t` (4 vCPU, llvmpipe, Xorg `:0`, ops services off),
main `4cbde5326`, the 10-10 `probe.js`: one unrouted `test/run.js --app=ID
--no-close` per arm, **35 s wall clock**, final frame as PNG. Software arm is
the default (D3DIM/D3DRM), `--d3d9-renderer=software` (D3D8/9) or
`--gl-renderer=software`; GPU arm is `--headless-gl` (+ `--d3dim-gpu`). Up to
three probes shared the 4 vCPUs, so batch counts are lower than an idle box.
Apps that stop on a start-up dialog were re-probed with Enter at batches
30/90/200/400 and `--stuck-after` raised. Frames, logs, summaries and the
scripts: `scratch/runs/20261011T0600Z-gfx-corpus-matrix-w4/`. This is a
regression sweep at a fixed short budget; the gameplay evidence in the 10-10
table still stands where the probe reached the same point.

| app | software (35 s) | GPU (35 s) | note |
|---|---|---|---|
| dx_flip3dtl, dx_globe, dx_viewer, dx_boids, dx_tunnel, dx_twist | renders | renders | samples animate per presented frame, so final frames differ by arm |
| scr_jazz, scr_rockroll, scr_fallingl, scr_geometry | renders | renders | |
| scr_architec | white at 35 s; renders at 60k batches (series) | same | a long first load, not a fault |
| scr_scifi, scr_oasaver | **uniform frame** through 2.9M batches (120 s) on the default CLI clock | same | render with the 10-06 flags `--tick-ms-per-batch=2 --dx-surfaces` (scifi 237,900-byte frame): D3DRM-SCR-DEFAULT-CLOCK-UNIFORM-20261011. **Resolved:** a clock artifact (scene timers expire before the first Flip, so the device is rebuilt every frame); the seven savers now register `cliTickMsPerBatch: 2`, see `re-notes/plus98-dx-screensavers.md` |
| tomb_raider_2_demo, tomb_raider_3_demo | in-level after Enter on the setup dialog | same; identical frames at batches 60k/120k | |
| gta2_demo, darkstone_demo, cmr2_demo, colin_mcrae_rally_demo, avp_alien_demo, avp_marine_demo, blood2_demo, mw3, diablo2_demo | menu | menu | |
| drakan_demo, mcm, midtown_madness_trial | menu after Enter on the start-up message box | same | midtown: vehicle menu; mcm: profile name entry |
| carmageddon2_demo | intro, then exits itself (code 0) at ~112k batches | same | unattended only; the 10-10 routed race is unaffected |
| zuma_deluxe | black at 35-40 s; title at 100 s | — | slow load, not a fault |
| re_volt_demo | Acclaim splash (8.4k batches in 35 s) | same | new; menu not reached within budget |
| **forsaken_demo** | **dies**: guest heap exhausted, `Unable to allocate thread TLS vector` | same | FORSAKEN-HEAP-EXHAUSTION-20261011; w5's routed command (`--batch-size=200000`, 700 batches) still runs clean |
| pawn | board | board | |
| crimsonland, alien_shooter, ptct | launcher / setup dialog | same | need their routes |
| quake2_demo | menu | menu, 1.78M GL calls | |
| descent3_demo | pilot screen | same, 352k GL calls | |
| anachronox_demo | intro | intro, 36k GL calls | |
| halflife_uplink | menu | menu, 0 GL calls within 35 s | slow start (7.4k batches) |
| warcraft3_demo | menu | menu, 504k GL calls | |
| daikatana_demo | menu | menu, 1.94M GL calls | |
| serious_sam_demo | first-run message box | same | needs the registered route (re-note) |
| **quake3_demo** | not run | not run | fixture: QUAKE3-FIXTURE-INSTALL-STEP-20261011 |
| winamp | main window | main window | MilkDrop not exercised |

Not re-probed (heavy, or fresh 10-10 evidence): arcanum, aow2, tdr2000,
diehard, deus_ex, ut2003/ut2004, morrowind, pirates (Codex), bw2.

**Regressions since 10-10: none found.** Every app that reached a point on
10-10 reached it again on both arms, and the two arms agree wherever they can
be compared at the same batch. New failures: Forsaken's heap exhaustion on an
unattended run, quake3's unreproducible fixture, and the scifi/oasaver
default-clock frame.

## Historical census recovery anchor — 18 October 2026

The original tool addition is commit `2d722ab3766c288d13796ed9dad3f1ceeca8f1eb`
(22 September). Its commit message independently records 27 OpenGL/Direct3D
apps among 225 registry apps, seven `scr_*` D3DRM screensavers, and the
launcher-noise cautions for `icewind_dale_demo` and `tworld`. The retained
`project_gl_d3d_corpus_goal.md` memory identifies the originating session as
`bd610256-7b4f-4ed1-afa0-9c3cf3412fbb` and records family counts GL7, D3DRM10,
D3DIM9, D3D8 7, D3D9 2 with overlap.

Neither source enumerates all 27 IDs. A matching transcript/census output was
not found in the checked local Claude project files. This narrows recovery to
the original tool and registry revision plus the contemporaneous binary
inventory, or the originating session's saved output. Re-running today's
tool against today's registry is not equivalent; scanning old registry paths
against changed/missing binaries is also insufficient without identity checks.
No historical census was rerun here and no membership or backend qualification
is inferred from the counts.
