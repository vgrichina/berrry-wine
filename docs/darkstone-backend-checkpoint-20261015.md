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
