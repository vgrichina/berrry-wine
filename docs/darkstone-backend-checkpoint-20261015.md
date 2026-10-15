# Darkstone staged backend capture

Initial source-only preparation, October 15. At preparation time no browser,
game, remote command or full build had run for this controller. The installed payload's 15 paths match
`7379dca78b373080febeb6fce4282c284faa234deec8185870041e508cc3f673`.
The historical Town screenshots remain unavailable locally.

`tools/darkstone-backend-checkpoint.js` captures only the proposed menu
checkpoint using the existing `web-input-probe.js`. It makes no menu clicks.
The recorded menu is unreviewed until a reviewer inspects the image; a logo,
launcher, loading screen, or crash ends the attempt without blind inputs.
The next ordinary-route controller is deliberately deferred until that review.

After the coordinator grants the sole runtime lane, stage a dedicated full
checkout on `bx_9ef2wdsw` through Boat exec/file API using the scoped key.
Do not use SSH/scp, modify the IW donor, or stage dependencies/payload copies
on the local host. Preserve source inventory, approved dependency hashes,
the installed fixture, and module identity in the run bundle. The matching
verified IW donor is `/home/user/wa-iw-combined-native` at `6c22121e`; its
canonical module SHA is
`04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
Production equivalence to main `3fdb2937` / `7deb622c` is documented by the
integration receipt; verify the staged physical inputs before using the donor
module. No source compilation fallback or compatibility module qualifies.

Start only a private isolated loopback dev server from that dedicated tree.
Require an independent idle process census, adequate TTL/disk, and preserved
donor/fixture pins before launching. Set `CHROME` to the remote browser's
verified executable path. From the staged checkout:

```sh
node tools/darkstone-backend-checkpoint.js \
  --root=/home/user/wa-darkstone-validation \
  --out=/home/user/darkstone-menu-software-UNIQUE \
  --origin=http://127.0.0.1:PORT --backend=software
```

The output directory must not exist and its parent must exist. The controller
checks disk and HTTP module bytes and every HTTP fixture file before launching, captures the SHA belonging
to the actual `wine._wasmModule` object compiled by the page, and verifies
fixture and disk-module hashes afterward. Its compile observer preserves compile arguments
and hashes a copy of the input; it never calls guest exports. An unobserved
module is unknown and fails the identity check. The observer adds startup
hashing overhead, so this is not a timing experiment.

The browser probe gets 180 seconds under GNU timeout plus 10 seconds to kill;
the synchronous controller has a 195-second guard. Probe cleanup uses its
existing browser-close finally block. Independently inspect the owned process
tree after termination, terminate only owned leftovers, and recheck fixture,
source and preserved module pins before releasing the lane. A timeout may
bypass probe finally; `summary.json` never claims independent cleanup.

Review `menu.png`, `output.log`, `console.log`, module identity and both
completed main-Worker slice reports. Do not infer backend use from `--gpu`,
the query, page counters, replay-command counts, or a screenshot. Software
rasterization must have live owning-worker draw-consumption evidence. WebGL
must have advancing owning-renderer draws plus fallback/error review. The
current collector may lack software draw consumption or child-thread render
ownership; leave backend unknown in that case. Run WebGL separately only
after reviewing the software arm and confirming the runtime lane.

For the subsequent reviewed ordinary route, use the existing Darkstone re-note
coordinates and inspect each menu/party checkpoint before proceeding. Town
requires the blue mana HUD, followed by before/5-second idle/held ArrowRight
landmarks showing fixed road or gate rotation. This establishes camera control
only. No FPS, audio, combat, locomotion, physical GPU, or full-game claim follows.

Recover all artifacts as ordinary files into a unique shared
`scratch/runs/<id>/` directory, record actual source and HTTP-loaded module,
then publish `result.json` last per `ops/README.md`. Never label an uninspected
capture reviewed. Root owns TODO/STATUS updates.

Offline checks passed: Node syntax, whitespace, exact installed inventory,
plan rejection of public origins/step injection, absence of menu clicks, and
actual tiny WebAssembly Module identity hashing with an unknown-object
negative. These checks do not validate browser timing or gameplay.

The later software-requested menu capture completed and was reviewed; see
`docs/re-notes/darkstone-demo.md` for the actual module identity, evidence hash,
independent release and limits. It reached a 640×480 main menu, so the older
800×600 route coordinates require new live geometry review. The replay-only
Worker counters leave software rasterization unqualified. The complete
executed staging/controller recipe is retained in the hashed run archive.

## Prepared next checkpoint: one New Game click

After a separate runtime grant, add `--checkpoint=new-game` to the same
controller invocation and choose a new evidence directory. This repeats the
verified menu route, saves the menu, then performs exactly one trusted mouse
click at normalized visible `#screen` position `(0.5, 0.483)`, waits three
seconds, saves `new-game.png` and exits. It does not select One Player, create
a champion, or enter Town. The next screen must be reviewed before more input.

The point was selected from New Game in the reviewed 1280×900 capture. Its
actual runtime mapping, measured below, is CSS x480,y516.644. The
`canvasclick` probe step records live intrinsic dimensions, bounding rectangle
and exclusive-presentation viewport before input. It maps the normalized
visible point directly to trusted Puppeteer mouse coordinates, so a native
800×600 viewport presented on a 640×480 canvas does not cause an erroneous
native-coordinate conversion. Existing `click:X,Y` behavior is unchanged.
An absent/hidden/zero-sized canvas, nonfinite or out-of-bounds fractions, or a
visible launcher aborts before this click. If the menu/layout differs from the
reviewed checkpoint, retain the capture and stop; do not guess follow-on input.

This addition is source-prepared only. Syntax, exact mapper positive/invalid
cases and the one-click-only serialized plan passed offline. No new browser
execution or next-screen claim is attached to it.

The first live one-click attempt (`253377`, source `97ed1f6c1`) reached the
same visually reviewed menu but **stopped before clicking**: its visibility
guard rejected `#screen` opacity zero. This is the renderer's intended
input/presentation split (`lib/renderer.js`): transparent `#screen` still
receives input while `#screen-present` paints the visible frame. It is a
harness failure, not a guest failure. The loaded module remained `04ede`.
Independent postflight at 16:45:30.183 UTC verified idle and unchanged source,
dependency, browser, fixture and all five donor module pins.

Bundle `scratch/runs/20261015-darkstone-new-game/evidence.tar.gz` is 1,531,166
bytes, SHA-256
`dbae69c2b526d5d2b8c1f8fa436268c0be0775c3f1354bd4b7d7c13257a55bc1`.
It contains `darkstone-new-game-evidence/capture/menu.png`; no next-screen
PNG exists because no click was delivered. No rerun is implied by recovery.

The amended guard accepts either visible `#screen`, or transparent input
`#screen` paired with visible `#screen-present` at the same displayed rectangle
(within half a CSS pixel). Both rectangles, dimensions, styles and the native
viewport are logged; absent/hidden/misaligned presentation or a noninteractive
input surface still stops the click. Actual-function offline DOM cases cover
both accepted modes and those rejection cases. The existing native `toPage`
function remains byte-identical to `eb5a9559f`. This amended guard has not yet
run in a browser.

## Reviewed New Game transition and next One Player checkpoint

Run `20261015-darkstone-new-game-paired`, immutable `caa6175db`, outer PID
`255955`, delivered exactly one trusted click and finished at 16:49:05.862 UTC.
The resulting PNG was reviewed by the capture agent and coordinator: it shows
the New Game submenu with **One Player, Multiplayer and Exit**. The actual
loaded module remains `04ede400…`; no software backend qualification follows.

Measured live input and presentation rectangles are identical: left 10, top
194, width 940, height 668. The earlier visual estimate included the 35-pixel
fullscreen banner and was incorrect. The input canvas is 640×480 at opacity
zero; the visible presentation canvas is 940×668. The native viewport is
640×480, letterboxed into destination x24,y0,width891,height668. The normalized
point `(0.5,0.483)` therefore clicked CSS `(480,516.644)`; the actual input log
records guest `(320,231)`, and the visible submenu proves that New Game was
selected. This is ordinary menu interaction, not world control.

Independent postflight at 16:49:24.078 UTC passed idle, all physical source,
dependency/browser/fixture inventories and five preserved module pins.
Archive `scratch/runs/20261015-darkstone-new-game-paired/evidence.tar.gz` is
2,007,045 bytes, SHA-256
`cfabd473d24087fceb8d68d2e5bc2a4ecb9496777c66c01c0815447135ed3926`.
It retains the menu/next-screen PNGs and exact live mapping/input logs.

The next source-prepared checkpoint is `--checkpoint=one-player`: repeat the
reviewed New Game transition, retain its screenshot, then click normalized
`(0.5,0.5374)` (CSS approximately 480,553 for the measured rect), wait three
seconds and save `one-player.png`. It stops without any character selection,
name entry or party confirmation. The One Player target has been reviewed;
the resulting screen has not yet been executed or reviewed. Run only after
the coordinator's separate runtime grant.

## Reviewed One Player transition

Run `20261015-darkstone-one-player`, source `0ae29c53a`, PID `260137`,
finished at 16:55:16.178 UTC. The reviewed `one-player.png` shows **Choose
Your Champions**, an empty champion list and empty party slots, plus Create a
Character, OK and Back. Exactly the two reviewed New Game and One Player
clicks were delivered. No champion exists yet; world/control/backend claims
remain unqualified. The actual loaded module is still `04ede400…`.

Independent postflight at 16:55:32.663 UTC verified idle and unchanged source,
dependency/browser/fixture inventories and six donor modules, now including
the separately admitted arena `ca90c018…` at
`/home/user/wa-ne-arena-native/build/wine-assembly.wasm`.
The recovered archive is
`scratch/runs/20261015-darkstone-one-player/evidence.tar.gz`, 2,575,740 bytes,
SHA-256 `4954c31566fcbdd8cef33738944e66642b031b13f53e55a5b8f24915b5ffb295`.

Source-prepared `--checkpoint=create-character` repeats those two reviewed
clicks, then clicks the visible Create a Character button at normalized
`(0.1915,0.6811)` (approximately CSS 190,649), waits three seconds, captures
`create-character.png` and stops. It does not choose a class, enter a name,
confirm a character or place a portrait. The new screen remains untested;
the coordinator must review the next target and grant the runtime lane.

## Bounded continuation in one browser session

`--checkpoint=interactive` runs the same reviewed three-click prefix through
Create a Character, retaining each screen, then keeps the existing Puppeteer
probe alive for ordinary visible UI inputs. The agent inspects each resulting
PNG before choosing the next class/name/party action. No additional human or
coordinator approval file is involved; runtime ownership still requires the
coordinator's grant. Do not infer class or party coordinates from the older
800×600 route.

Write sequential JSON files to `capture/commands/0.json`, `1.json`, etc.
through the scoped Boat file API. Each contains `{"steps":[...]}` using the
existing probe step syntax. For example, after visually reviewing a field:

```json
{"steps":["type:CODEX","wait:1000","shot:/home/user/RUN/capture/named-character.png","evalfile:/home/user/wa-darkstone-validation/tools/capture-legacy-render-evidence.js"]}
```

Replace RUN with the actual fresh evidence directory. `N.done.json` records
completion; `ready.json` records the queue deadline. `{"quit":true}` closes
the browser normally. Allowed queued operations are normalized trusted canvas
clicks, native pointer moves, a small ordinary key set, short alphanumeric name
entry, bounded waits, fresh PNGs inside the capture directory, and the exact
read-only renderer-evidence collector. Arbitrary eval, raw commands, guest
writes and unrelated eval files are rejected.

Limits are 48 commands, 16 steps per command, at most 120 seconds of total
wait in one command, and a 420-second queue deadline measured after launch.
The probe has an external 480-second bound with a 10-second kill grace; retain
the outer 600-second controller and independent postflight. On timeout or a
wrong screen, preserve evidence and stop. The menu wrapper's disk/HTTP/actual
module identity and fixture pre/post checks still apply. The source-prepared
queue passed actual validator and serialized-generator offline checks,
including rejected arbitrary eval/path escape/invalid input and normal quit.
No browser execution with this continuation mode has run yet.

### Owning renderer telemetry audit (2026-10-15, source only)

Audited c7e23d5f production source (admitted 04ede module); no runtime or renderer changes. Existing `capture-legacy-render-evidence.js` correctly leaves software backend unknown.

- `lib/d3d-render-worker.js:138` `replay` handles D3DIM draws, GL draws, flips and texture copies. `replayBatch:423` publishes aggregate commands/batches/time and GL-specific triangle counters. A legacy software endpoint has no adapter (`render-open:308`); D3DIM records call `instance.exports.d3dim_worker_draw` directly. Replay progress therefore cannot separate software draws from other work.
- `src/09ab-handlers-d3dim-core.wat:373` exports `d3dim_worker_draw`, which invokes the native software primitive path with its immutable state override. There is no D3DIM draw/pixel count in the current shared snapshot. `d3dim_get_stats:845` explicitly zero-fills the five legacy D3DSTATS counters; calling this guest API would not supply evidence and would violate read-only capture.
- `lib/d3dim-gpu.js:958` `_submitImmediate` increments **draws** only after `t.device.draw(draw)` returns. The chain is `lib/d3d9-backend.js:347` device draw → `gpu-backend.js:740` → `gl.drawElements` / `gl.drawArrays` / `gl.drawArraysInstanced`. This is actual WebGL submission evidence, not GPU hardware or successful visible-fragment proof. By contrast, **drawCalls**, **triangles**, **lines**, **points** can include accepted deferred batches; use **draws** deltas for backend progress. Textured clears can also submit draws.
- GPU `snapshot:1016` also exposes **errors**, **fallbacks**, disjoint **fallbackDrawShape/Describe/Target/Texture**, **fallbackClearTarget/TextureShape**, **fences**, **syncs**, and **syncPixels/Bytes**. A fallback count identifies rejection, not completed software rasterization. `lib/d3dim-render-worker.js` runs native `d3dim_worker_draw` after a declined GPU draw and fence; that completion has no distinct counter today.
- The D3DIM adapter returns `gpu.snapshot()` plus **glRenderer** on an ordinary opcode `0x20001` fence. `d3d-render-worker.js:405` forwards stats; `guest-worker.js:503` stores them and merges them with encoder stats into slice **d3d**. `d3d-command-stream.js:416` preserves producer **transportFences** separately. Capture naturally published values; do not induce fences merely to measure. Require advancing slice sequence and counter deltas at matched screenshots. A main guest snapshot does not cover child endpoint owners, and a missing or stale snapshot stays unknown. SwiftShader is still WebGL execution, not hardware GPU qualification.

Smallest follow-up telemetry proposal (not implemented): maintain an endpoint-local **softwareDrawCallsCompleted** counter immediately after the direct `d3dim_worker_draw` returns, including the adapter's GPU-decline software branch, and expose it with endpoint ID/API/backend and completed batch sequence in a read-only owning-worker snapshot. Keep fallback-software completions separate from requested-software completions. This proves completion of the native software draw path, not that a pixel survived clipping/depth/alpha tests. For literal rasterization proof, a further native counter is needed: increment an instance-local pixel-write counter only in actual raster color-store branches (e.g. the span's 32/16/8-bit stores at core lines 5683/5707/5709), with read-only export and per-endpoint before/after attribution around each software draw. Other flat/line/point store paths need equivalent coverage before calling it a total. That native addition requires a new build/hash and must not be retroactively attributed to admitted 04ede. No rendering algorithm changes are proposed.

### Fresh Town and camera-control capture (2026-10-15)

Reviewed c7e interactive controller completed on admitted 04ede: outer PID 281716 started 17:12:06.957Z, terminal 0 at 17:16:06.394Z, independent idle/source/donor/dependency/browser/fixture/six-module postflight passed 17:16:17.444Z. HTTP fixture checks and actual loaded module matched, disk module and all 15 fixture paths unchanged. Local evidence: `/home/user/wine-assembly/scratch/runs/20261015-darkstone-town-2`; remote preserved `/home/user/darkstone-town-2-evidence`. Archive 9,384,790 bytes, SHA256 `60900452d07daac7bfa60ba9e08cf5217ef66bcb1e1bca93388c034477053540`. Retrieve large archives in named 2.5MB chunks via scoped file API and verify assembled hash; no payload copy is needed.

Ordinary route after reviewed menu prefix: Create Character opens Warrior by default; click name field (.535,.782), type Arden; Create (.532,.949); choose Arden in list (.147,.124); place in first slot (.656,.38); OK (.53,.949). These are fractions of the observed input canvas rect (10,194,940,668), with matching visible presentation canvas. Each transition was captured and visually reviewed before the next input. `party-accepted.png` explicitly shows **Town**, the blue mana HUD, Arden on a road beside a gate. No hidden controls or guest-memory writes were used.

`town-before.png` and `town-idle.png` (5 seconds idle) preserve road/gate geometry, with idle character animation. Trusted ArrowRight down, 5-second hold, then `town-held-right.png` shows the gate/road rotated. ArrowRight up, 2-second wait and `town-released.png` show the new orientation; a later `town-settled.png` preserves that orientation and shows the guest WM_KEYUP 0x27 receipt. This establishes ordinary Town camera control, not locomotion or combat. Collector samples at before/idle/held/released/settled have advancing main slice sequence 26997/29368/32351/33360/49319; replay commands 4175165/4259573/4348314/4398016/4938354. Software draw qualification stays **unknown**: those aggregate counters are not software rasterization evidence. No WebGL arm, FPS or audio claim.

Queued commands were atomically published after local validation using the actual extracted `validateQueuedSteps` function. Screenshot paths must be absolute inside capture; the publisher expands basenames first. Prior PID 279812 stopped before its first queued input because a basename failed this guard, after successfully showing Create Character. Its terminal 1 and independent successful postflight (17:11:37.379Z) are retained separately under `20261015-darkstone-town`, archive SHA256 `6aefcd4d36ea7af60b0d112730f40f2d648581af465862daefaff0688fae3351`. No rendering/source fix was required. The wrapper's generic interactive summary remains `interactive-unreviewed` / gameplay `not-attempted`; the explicit visual assessment and landmark samples are in `capture-review.json`, not a fabricated dashboard result. Darkstone still has no candidate-corpus manifest ID.

### Paired backend candidate, source preparation only

`tools/darkstone-paired-validation.js` prepares one normal build rooted at main `9e9020159` (including completed-call telemetry `99932f66b`), then separately bounded software and WebGL arms. This is a new source/module candidate, never a reinterpretation of the prior c7e/04ede run. Production source must match that base exactly; harness changes are isolated. The build records the exact WASM, generated region-map JS, and combined WAT SHA256 values. Both arms pass the resulting module pin to the existing checkpoint wrapper and require HTTP/actual-Module/disk identity plus the same 15 fixture files. The wrapper still defaults to old 04ede when no explicit `--module-sha256` is supplied.

After a runtime grant, stage a **fresh owned** full remote checkout `/home/user/wa-darkstone-paired` at the immutable controller commit, using scoped exec/file API. Copy the already pinned dependency tree and fixture from `/home/user/wa-darkstone-validation` into this new checkout; do not mutate that checkout or donors. Keep source/build/evidence remote; no local dependencies, full build, or payload copies. The controller compares every regular dependency file to the prior baseline and checks its count; pin browser top-level files from the same receipt, including executable. Record Chrome version and fresh Boat TTL externally. No enumeration/chmod of inaccessible extension directories.

External config (actual immutable commit and fresh API TTL substituted before launch):

```json
{"root":"/home/user/wa-darkstone-paired","out":"/home/user/darkstone-paired-evidence","baseline":"/home/user/darkstone-town-2-evidence/preflight.json","baselineSha256":"8cc2c682d23240c6b614122881d7fe48efa6ed8b3f76c429d8d4035a75f1285d","dependencyReference":"/home/user/wa-darkstone-validation","commit":"IMMUTABLE_40_HEX_COMMIT","archiveAfter":"FRESH_BOAT_API_UTC"}
```

Invoke the checked-in controller through outer `setsid --wait timeout --signal=TERM --kill-after=10s`: build uses 1260 seconds (internal normal `bash tools/build.sh` limit 1200), each arm 600 seconds (internal probe 480). Phases are `build`, `software`, `webgl`, and `postflight`, followed by the absolute config path. Run a separate `postflight` after build and each arm before the next phase; preserve terminal and independent receipts, including failed phases. `postflight` also works after a build failure that wrote preflight but no successful build receipt. It checks idle, source/dependencies/browser/external files, all seven donor module hashes, fixture identity, and successful build artifact hashes when present. Donor tracked physical files and checkout identities are captured at preflight; sparse omissions are explicit. Any survivor must be handled through recorded owned process identities and rechecked before handing off. No concurrent build/browser/server or public hosting.

The seventh module is `/home/user/wa-ne-context-native/build/wine-assembly.wasm`, SHA256 `9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e`; the earlier six remain preserved. The old 04ede checkout and its source are also covered by the external baseline. No binary is overwritten in a donor.

Each arm starts the proven menu prefix to Create Character, then use exported `routeCommand(name, captureDirectory)` for the five visually gated commands `name`, `create`, `select`, `slot`, `accept`. Inspect the resulting screenshot before publishing the next command; stop on unexpected screens. Use the existing queue and actual `validateQueuedSteps` before atomic temp-file rename. Follow Town with the same before / 5-second idle / held ArrowRight 5 seconds / release 2 seconds / settled screenshots and collector samples. `routeCommand` emits absolute screenshot paths to avoid the retained earlier basename rejection. The two arms have independent fresh browser profiles and evidence directories, so Arden is created through ordinary UI in each.

Qualification: compare advancing natural-fence **renderEndpointId**, **completedFenceSequence**, **d3dimSoftwareDrawCallsCompleted**, **d3dimFallbackSoftwareDrawCallsCompleted**, and (WebGL) **draws**, **drawCalls**, **errors**, all fallback reasons and **glRenderer** at matching scene landmarks. Completed-call deltas establish native software path execution; screenshots independently show the resulting scene and control response. WebGL `draws` deltas establish actual WebGL submissions; nonzero software fallback must be reported, not hidden. Do not request speculative pixel-store telemetry. Main slice ownership is explicit; collector `childThreads` lists known child IDs/states but does not sample their renderer counters. If main-only evidence cannot identify an advancing owner, retain unknown instead of attributing child rendering to main. Original-27 membership remains unknown; no manifest candidate ID is invented.

Offline validation: `node test/test-darkstone-paired-controller.js` checks own-checkout/immutable-commit/config guards, seven preservation pins, every route command against the actual probe validator, relative screenshot rejection, and main-owner/child-limitation collector serialization. Syntax and diff checks pass. This section records preparation, not a build or runtime result.


Controller review hardening: immutable source admission now reads `git ls-tree -r -z COMMIT` and compares physical file/symlink bytes to each committed Git blob SHA1; an index/status check cannot substitute. The baseline receipt itself is SHA256-pinned (`8cc2c682d23240c6b614122881d7fe48efa6ed8b3f76c429d8d4035a75f1285d`, independently recovered from the Town archive) before trusting its inventories. Build, wrapper, probe and server use the reviewed FIFA `runChild` owned-PGID TERM/KILL cleanup pattern, including descendants surviving normal parent exit, signal/timeout receipts and remaining-process checks. The nested checkpoint wrapper no longer inserts a separate GNU timeout process group. Server binding is explicitly `127.0.0.1`, readiness requests have 1-second abort deadlines, and all child environments remove inherited `WA_*`, `WINE_*`, `NODE_OPTIONS` and `NODE_PATH`. Independent postflight remains required even after cleanup. Offline tests cover physical tampering hidden with assume-unchanged, symlink target tampering, environment filtering, a surviving descendant after normal exit, a TERM-resistant timeout requiring KILL, and spawn failure. These are local synthetic child-process tests, not a remote build/browser/game run.

### Paired result: Town camera control with owning-backend evidence

Both arms completed the same ordinary Warrior Arden route to labeled Town with blue mana HUD. For each, before/5-second idle captures preserve road/gate geometry; holding ArrowRight for 5 seconds rotates those scene landmarks; released/settled captures preserve the new orientation. Agent and root independently reviewed actual software and WebGL PNGs. This qualifies **ordinary Town camera control** with the backend evidence below; it does not qualify locomotion, combat, audio, FPS or rendering by child threads. Original-27 membership remains unknown.

Fresh source `fadaff08a3088d242a6e648e2f99c19eaad341fe`, based on main `9e9020159`, was staged into `/home/user/wa-darkstone-paired`. Normal build outer PID 294612 completed with child status 0 at 17:30:34.893Z; independent postflight 17:31:12.020Z passed. Resulting module is 1,806,119 bytes, SHA256 `9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e`; generated map JS `23615dbc2b7ac3832186beb25da29f85b6e475480894dddf3fd1e7ccdb5d3820`; combined WAT `c14c1159eb3c03c581c38717f42b0d97df3fded4cc34e300c83199cefe868101`. The same normal-build bytes served both arms. HTTP-loaded and actual owned Module identities matched the disk module, and all 15 fixture files remained unchanged. This does not change the earlier c7e/04ede run's unknown backend finding.

| Landmark | Software main slice / natural fence | Completed native software draws | WebGL main slice / natural fence | WebGL draw submissions |
| --- | --- | ---: | --- | ---: |
| Before | 28854 / 644281 | 5955181 | 30060 / 219114 | 136339 |
| Idle | 31652 / 645806 | 6050361 | 32606 / 221766 | 146738 |
| Held ArrowRight | 34242 / 647551 | 6158316 | 35109 / 224816 | 158212 |
| Released | 35848 / 648494 | 6212953 | 36674 / 226316 | 163388 |
| Settled | 44200 / 654993 | 6563789 | 43432 / 235741 | 191793 |

These are cumulative counts from **main render endpoint 1**, API legacy, at naturally completed fences. Software has advancing `d3dimSoftwareDrawCallsCompleted` and zero `d3dimFallbackSoftwareDrawCallsCompleted`; counters attest completed native software call paths, while the screenshots independently show the resulting scene. WebGL has advancing actual `draws`, zero direct/fallback software completion counts, zero `errors`, zero aggregate `fallbacks`, and zero at all six `fallbackDraw*`/`fallbackClear*` sites in the observed landmark samples. **`declinedClears` remains 1** throughout: do not claim every GPU operation was accepted. The observed renderer string is `ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`; this run did not report SwiftShader, and the string is not a separate hardware certification. Child tid 1 is listed active and tid 2 exited; their renderer counters were not sampled or attributed to main.

Software outer PID 295780: terminal 0 at 17:35:11.081Z, independent release 17:35:27.571Z. WebGL outer PID 298325: terminal 0 at 17:39:58.989Z, independent release 17:40:18.368Z. Both show no timeout, interruption or remaining owned-group processes. Every independent postflight passed idle plus seven donor module/source, owned immutable source, dependency, browser, fixture and built-artifact pins. Root independently checked terminal/release receipts. TTL was explicitly extended and verified to 18:29:45.323Z before this work; no new runtime was started after the paired arms, and the lane was handed to Outlaws.

Full evidence remains remote at `/home/user/darkstone-paired-evidence` and recovered locally at `/home/user/wine-assembly/scratch/runs/20261015-darkstone-paired/evidence.tar.gz`: **19,509,108 bytes**, SHA256 **`25252b50372c11589f30439d0a13ab39b09576b5844c1855721c26a429c2aa8f`**. The archive includes every transition/landmark PNG, console/probe logs, atomic commands and done receipts, build output and hashes, owned-process/cleanup receipts, preflight/postflight inventories, `capture-review.json`, `root-software-review.json` and `root-webgl-review.json`. Named PNGs and API receipts are also available in the local run directory. Recovery used scoped file API chunks with final hash verification. Automatic wrapper summaries intentionally retain generic `interactive-unreviewed` / `unknown` / `not-attempted`; the explicit reviewed findings are in `capture-review.json` and this report, not a fabricated candidate-corpus dashboard result.

### Next bounded locomotion check: bundled instructions (source only)

The original installed `readme.txt`, section IV, line 209, explicitly assigns the **left mouse button** to movement and contextual actions. Line 227 assigns left/right arrows to camera rotation, corroborating the limited claim above; line 241 assigns Backspace to the walk/run toggle, and line 210 describes Ctrl+left click as changing speed. The pinned `dconfig/keyboard.txt` likewise maps `RUNMODE` to `KEY_BACK` and camera rotation to `KEY_LEFT/KEY_RIGHT`. No WASD assumption or hidden control is needed. Readme SHA256 `33bae7bcb704dd156dc58c3d407f3b7ee4e62874554dc0fd240ff1b6ecb0ba3c`; keyboard config SHA256 `e4a9a5e4b4b352cd98d5a51692258465a7696ee21d7c7d882b671fae4a41f661`. Both are part of the unchanged 15-path installed fixture.

After a future explicit runtime grant, reproduce the ordinary Town route and review a fresh unrotated scene. Select a nearby visibly empty road point, away from the character, gate, HUD and interactive objects, then use one trusted left `canvasclick` with no modifiers. In the reviewed before screenshot, a candidate is approximately CSS (570,630), fraction (.596,.653) of the measured input rect; this is a visual reference to re-evaluate, not permission for a blind coordinate. Capture before, idle, then short intervals after the click (e.g. 0.5/2/5 seconds) with owning-endpoint telemetry. Compare the character's feet and position relative to fixed gate/road features, accounting for a following camera, to distinguish actual displacement from animation/camera rotation. Do not press arrow keys or toggle run mode during this check. If clicking targets an object or changes a menu, retain that outcome and stop; do not label it locomotion. No movement input was performed for this audit, and no new renderer or queue change is required.

### No-rebuild locomotion controller, awaiting runtime grant

Run the unchanged, already built `/home/user/wa-darkstone-paired` at **fadaff08a**, module **9b57583c…**, with fresh output `/home/user/darkstone-locomotion-evidence`. Stage only `tools/darkstone-locomotion-preflight.js` as `/home/user/darkstone-locomotion-preflight.js` and the committed `docs/fixtures/darkstone-locomotion-preservation-20261015.json` as `/home/user/darkstone-locomotion-preservation.json`, checking their immutable commit bytes. Manifest SHA256 `e1c22622ec990a7ec88ff55b7b65d0e8f7199cb88af44b758f4e319d83b682dc` anchors 166 physical evidence/source files from the paired archive, Outlaws invoke archive, and FIFA five-file source admission. The preflight also verifies the eighth donor `/home/user/wa-ne-invoke-native/build/wine-assembly.wasm` SHA256 `d6187fedf42d597311446e527d586b74a06db4f7f5eaaa6b51e483c5cc06603b` and its immutable source `0768448d67a727a64370c55738346ccb2d8eaeae`. FIFA evidence `/home/user/fifa98-controller-evidence-1` and four helper files under `/home/user/fifa98-controller-helper-1/tools` receive fresh physical before/after manifests; staged FIFA source is e5c7a2f720b32bb9b330df2e3d9a9b2204370e75. No donor/source/helper/evidence is mutated.

Use the previous paired config with `out` changed to `/home/user/darkstone-locomotion-evidence`, immutable game `commit` still fadaff08a, and a fresh verified TTL; save as `/home/user/darkstone-locomotion-config.json`. Exact phases after coordinator grant:

```sh
node /home/user/darkstone-locomotion-preflight.js prepare /home/user/darkstone-locomotion-config.json /home/user/darkstone-locomotion-preservation.json
node /home/user/wa-darkstone-paired/tools/darkstone-paired-validation.js postflight /home/user/darkstone-locomotion-config.json
setsid --wait timeout --signal=TERM --kill-after=10s 600s node /home/user/wa-darkstone-paired/tools/darkstone-paired-validation.js webgl /home/user/darkstone-locomotion-config.json
node /home/user/wa-darkstone-paired/tools/darkstone-paired-validation.js postflight /home/user/darkstone-locomotion-config.json
node /home/user/darkstone-locomotion-preflight.js postflight /home/user/darkstone-locomotion-config.json /home/user/darkstone-locomotion-preservation.json
```

Run each phase to terminal success before the next. `prepare` pins and copies only prior `preflight.json` and `build.json` into the fresh evidence root and labels both as **borrowed unchanged build provenance, not a new build**. The unchanged controller then revalidates the original seven donors, immutable game source, dependencies/browser, fixture, module/map/combined-WAT, HTTP and actual loaded Module, with its reviewed environment and process-group cleanup. The separate preflight adds the eighth module/source and retained evidence checks. Preserve both independent postflights before handoff.

Use the proven visible menu/Warrior Arden/party route, inspect actual Town before choosing ground. Then capture `move-before.png`, read-only owning endpoint sample, wait 5 seconds, `move-idle.png`, another sample. One trusted unmodified `canvasclick` at a freshly reviewed empty road point is already a down/up pair. Capture at roughly 0.5, 2 and 5 seconds after it, with samples; allow a second visible road target only if the first path ends normally and new pixels support the next selection. Keep camera keys untouched. Compare character feet relative to gate/road/tree landmarks, accounting for following-camera translation, and distinguish meaningful displacement from idle animation. A generic menu/camera image alone is insufficient. Use the existing actual queue validator and atomic command publication; no renderer/queue changes or rebuild. Local `test/test-darkstone-locomotion-preflight.js` covers manifest pinning, borrowed-receipt provenance, fresh-output protection, and mutated receipt rejection. Syntax/diff checks pass; no locomotion runtime result is claimed here.


Locomotion admission correction: the first c295 preparation stopped before seeding evidence or launching a browser because the preserved Outlaws checkout intentionally lacks `apps/abe.md`. Failure receipt is retained locally in `20261015-darkstone-locomotion/prepare-api.json`; an independent paired postflight at 17:56:15.285Z passed idle and original pins. The corrected extra preflight uses exactly the **5062 records** in the verified native archive member `/tmp/wa-ne-invoke-native-20261015/postflight.json`, SHA256 `b7fb1a9f32c673de998ca9e9713036224a23955d82f67a374632a7b5ab5d4d25`, commit 076844. Each admitted physical file must match both its retained SHA256 and the immutable commit's Git blob; files outside that admitted inventory are explicitly listed without reading absent docs. No mutable skip-worktree flags decide admission. The owning fadaff game checkout still requires its full immutable tree. Tests cover retained hash mismatch, immutable blob mismatch, physical tampering and omission of a non-admitted absent document. No game/backend failure is inferred from the initial preparation rejection.

### 18:01–18:10Z locomotion evidence; session ended at queue deadline

The corrected **1676ee825** admission passed and outer PID **316037** started at 18:01:08.223Z using the unchanged fadaff runtime and borrowed normal-build **9b57583c…** module. This was not a fresh build. The ordinary Warrior Arden/party route reached Town. `town-before.png` and the five-second `town-idle.png` show the same character relation to the road, trees and gate. After reviewing the live scene, a trusted left click at normalized canvas `(0.596,0.653)` (page approximately 570.24,630.20) moved the character along the road: the following camera kept the character near center while tree bases and the gate shifted relative to the feet. `move-0500ms.png`, `move-2000ms.png`, `move-5000ms.png`, `move-settled.png` and `post-move-idle.png` show the resulting stable location. The first captured post-click frame was already settled; no claim about movement duration or animation cadence follows.

A second reviewed clear-road click `(0.601,0.368)` (page approximately 574.94,439.82) changed the character's facing and position relative to the gate/tree bases again. `second-0500ms.png`, `second-2000ms.png`, `second-5000ms.png` and `second-settled.png` preserve that second path and settled view. Both clicks used the measured 940×668 displayed canvas rect at (10,194), with trusted mouse down/up and geometry receipts. No camera arrows, speed toggle, guest writes or hidden controls were used. Root independently viewed the idle and two settled images and found the target-dependent landmark shifts consistent with locomotion and a following camera. This adds ordinary ground-click locomotion evidence to the prior camera-only result; it does not establish combat, audio, FPS, children, or corpus membership.

Main legacy render endpoint 1 progressed at natural fences:

| Landmark | Slice / completed fence | WebGL draws |
| --- | --- | --- |
| Town before | 19369 / 193349 | 84187 |
| Town idle | 21571 / 194934 | 92071 |
| First path, 2 seconds | 42456 / 208684 | 163837 |
| First settled | 45947 / 212512 | 172489 |
| Post-movement idle | 71110 / 236464 | 230249 |
| Second settled | 75937 / 241045 | 246792 |

At these samples, errors, aggregate fallbacks, all six fallback sites and direct/fallback completed software draws remain zero. **Declined clears remains 1**; not every GPU operation was accepted. The renderer string remains the paired run's Intel/Mesa ANGLE string. Child render ownership is unmeasured. The wrapper confirms actual loaded Module matches **9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e**, disk module unchanged, and all 15 fixture paths unchanged.

**The session as a whole did not finish successfully:** the probe's internal queue deadline closed the page at 18:08:34.898Z, child status 1; outer 316037 exited 1 at 18:08:34.928Z, with no remaining owned-group processes. The proposed extra `final-idle.png` and quit command were not executed. Do not infer a final-idle screenshot or terminal success from the earlier complete movement samples. Independent paired postflight at **18:10:11.740Z** and extra postflight at **18:10:23.870Z** both exited 0, with no active processes and all source/dependency/browser/fixture/eight-donor and prior-evidence/FIFA preservation checks passing. The extra helper retained a Git alternate-object-store nesting warning; physical admitted-file and immutable-blob checks passed. Runtime was explicitly released to the queued FIFA lane; no rerun was performed.

Recovered full archive: `/home/user/wine-assembly/scratch/runs/20261015-darkstone-locomotion/evidence.tar.gz`, **14,554,298 bytes**, SHA256 **56acbc258d810f764e91edcc0644e45816d4ebd668f53b8f7174e1c6f2476087**. Remote tree is `/home/user/darkstone-locomotion-evidence`, archive `/tmp/darkstone-locomotion-evidence.tar.gz`. It includes PNGs, atomic commands, logs, borrowed provenance, immutable source inventories, both independent postflights, failed admission and release receipts under `recovery/`. The original failure is now named `failed-prepare-c295-api.json`; corrected `prepare-api.json` is separate. Later local analysis `landmarks.json` and any root review are outside this archive. Recovery used 2,500,000-byte file-API chunks, concatenated and SHA256-verified. The remote evidence tree was frozen after recovery for FIFA preservation.

External helper `/home/user/darkstone-locomotion-preflight.js` SHA256 `f8ab1b9b9539be5c1d80bcbb8d75300aad3b1f191a5d80ef8f2a1502aa9c8fa0`; config `/home/user/darkstone-locomotion-config.json` SHA256 `535596b906c6c48a151f7cc8d14593c65025e26269b92e62b30016447b1876f6`; preservation manifest remains `e1c22622…`. Exact local stage/queue/recovery scripts and API receipts remain alongside the archive; the committed controller/recipe plus archived command files reproduce the procedure after a new coordinated grant and fresh output path.

Root's later local `root-movement-review.json` independently hashes/reviews `town-idle`, `move-0500ms`, `post-move-idle` and `second-settled`. It is **separate from the sealed archive**. It also records visible foreground geometry clipping/occlusion; the movement evidence does not imply visually flawless rendering. Keep that review alongside the recovered archive rather than modifying the remote evidence during FIFA's preservation window.

### Source-only foreground obstruction audit

**Finding: unresolved visual defect versus close-camera obstruction; no renderer fix justified yet.** Retained paired `software/town-before.png` and `webgl/town-before.png` both show the same large wooden gate face crossing the lower-right foreground. Their `town-held-right.png` views both show the crossbeam spanning in front of the scene after rotation. This makes a WebGL-only origin less likely, but shared guest transformation/state handling could still be wrong. Rotation timing differs between arms, so those images are not identical-pose pixel comparisons. The locomotion run has no corresponding software image at its first/second road destination. Its first destination exposes a conspicuous solid black triangular region at lower left, plus angular foreground edges; the pixels alone cannot distinguish uncovered background, the back of geometry, near-plane clipping, or incorrect geometry/state. Do not relabel that region as expected game behavior.

The audited renderer is the **actual captured fadaff08a commit**, extracted with `git show`, not the potentially different shared working files. Relevant paths:

- `lib/d3dim-gpu.js` `_describe` reads actual guest depth enable/function/write, blend factors, cull, alpha function/reference, texture and viewport clip fields. `_draw` retains negative RHW, replaces zero/nonfinite RHW with 1, clamps unused depth only for lines or both depth-test/write disabled, and forwards depth/cull/blend/alpha/scissor state. It does not implement a camera-obstruction fade or remove nearby gate geometry.
- `lib/d3d9-fixed.js` transformed-vertex shader reconstructs homogeneous W as `q=1/rhw`, maps screen coordinates and depth to GL clip coordinates, then multiplies `gl_Position` by q. GPU near/far clipping follows that input. This is a concrete place to compare a captured suspect triangle, not evidence that its math failed here.
- `src/09ab-handlers-d3dim-core.wat` `$d3dim_draw_tl_triangle_dp` (line 7406 at fadaff) and `$d3dim_exec_draw_near_clipped` use `$d3dim_clip_tl_polygon` (7334) with near/far planes and `$d3dim_interp_tl_clip_vertex` (7246), before native spans. The DrawPrimitive path has explicit zero-RHW and constant positive out-of-range depth compatibility paths. Those exceptions and shared transformation/state handling remain possible comparison points; the retained evidence does not show that Darkstone invoked them for the foreground object.

Existing owning endpoint counters establish completed drawing, **not correctness of per-triangle state**. The collector did not retain foreground vertices, primitive ordering, bound texture/alpha values, depth/cull state or a draw-level framebuffer. Zero errors/fallbacks and the single declined clear cannot localize the black region. No concrete failing input has been identified, so no speculative renderer change or synthetic “Darkstone regression” test was added. No build, browser, remote writes or camera changes were performed for this audit.

**Next useful action:** under a future coordinated grant, reproduce the exact first road click in the software arm at the unchanged initial camera and capture before/settled/idle with a clean early quit. Compare it with the retained WebGL first destination, matching gate/tree/feet pose rather than elapsed time. If the black region differs at the same pose, capture one bounded frame's owning draw inputs/state for that foreground region and reduce the differing triangle to an existing D3DIM test fixture; only then implement a demonstrated defect. If both backends agree, use a reference run of the same demo on an independent compatible implementation at the same pose to separate shared emulator behavior from original game obstruction. Agreement alone is not visual correctness.

Bundled readme lines 223–228 document F9 default, F10 top-down, F11/F12 tracking, left/right rotation and up/down zoom. These are possible later diagnostic controls, **not a workaround or evidence that this view is correct**. Keep the original pose evidence; do not change the default camera to hide the obstruction. Audio, FPS/performance and touch input remain untested, as do combat and child-render ownership. The bounded follow-up should prioritize the missing same-pose software comparison, not expand into those coverage gaps.
