# Ricochet Xtreme 1.4 build 75

Local fixture: `test/binaries/candidates/reflexive-ricochet-xtreme/game/`.
The wrapper-free executable SHA-256 is
`9f8c00daccb9dfff9806229fd1f427d85c22ce0581e94f7ca6939f0dc00e5bd8`.
Acquisition and installer provenance are in `reflexive.md` and the ignored
fixture's `.candidate-source.json`.

## Cold loading is active decompression

2026-09-29: the isolated committed runtime at `8f9f66a8` reaches the main
menu without runtime changes. The earlier 35/60-second splash captures were
premature. A 300-second run with 200,000-block batches reaches the animated
menu (Play Game, Statistics, Options, Exit Game).

Pass `--dll-seed=IFC22.dll` and mount the entire game directory. The bundled
IFC22 library provides the imported CImmMouse symbols. The game needs both
`DATA.dat` and its three `.red` archives. Use `--no-close` in CLI probes.

```sh
node test/run.js --no-build --wasm=build/wine-assembly.wasm \
  --exe=test/binaries/candidates/reflexive-ricochet-xtreme/game/Ricochet.exe \
  --dll-seed=IFC22.dll '--vfs-include=**/*' --no-close \
  --quiet-api --quiet-blocks --batch-size=200000 \
  --max-batches=100000 --max-seconds=300 --png=ricochet-menu.png
```

Repeated EIPs in `0x004e4aXX`/`0x004e51XX` during the Reflexive logo belong
to bitstream/codebook decoding, not a clock wait. `--trace-fs` proves forward
progress through different resources: company logo, fonts, level art, menu
textures. The game builds `c:\data\cache\...` `.frm16`/`.seq16` files as it
loads. At the menu there are 351 generated cache files totaling 15,316,024
bytes; the largest is 616,356 bytes. These are useful local prepared assets,
but are too large in aggregate for the browser's localStorage save mechanism.
Do not classify the splash alone as a hang or introduce a timing workaround.

## Verified interactive gameplay route

Use a controlled CLI session (`--control=8128 --max-seconds=900`) to inspect
the menu and inject input with `node tools/ctl.js -s :8128 ...`. The game
tracks mouse movement separately from button messages: send
`cmd mousemove:X:Y`, then `cmd mousedown:X:Y`, allow several batches, then
`cmd mouseup:X:Y`. A bare synthetic `click` without a preceding mouse move
does not update the game's pointer position and may leave the menu unchanged.

1. Main menu: Play Game at `(445,55)`.
2. Select Player: Anonymous Guest at `(320,234)`.
3. New Game Options: first thumbnail, Round 1-1, at `(75,170)`.
4. Wait for the entrance animation: the station rises, the bricks appear,
   and the round timer starts. This is real animation, not missing assets.
5. During play, `cmd relmousemove:180:0` moves the shield right;
   `cmd relmousemove:-200:0` moves it left. Normal mouse down/up launches
   the ball. DirectInput-only `di-mousedown` was not sufficient to launch.

The 2026-09-29 controlled session reached ball flight, destroyed bricks,
nonzero score, and a later out-of-bounds penalty. In a frozen comparison,
`relmousemove:-200:0` followed by 120 batches moved the shield from about
`x=340` to `x=130`; `relmousemove:220:0` followed by 50 batches moved it back
to about `x=285`. The clock and debris continued advancing. No API traps,
guest patches, runtime fixes, or CPU/timing workarounds were needed.

Evidence retained locally:

- `ricochet-300.png`: main menu.
- `ricochet-game.png`: Round 1-1 entrance.
- `ricochet-gameplay-before.png`: active ball/brick destruction.
- `ricochet-gameplay-left.png` and `ricochet-gameplay-right.png`:
  shield response to opposite relative mouse inputs.
- `ricochet-control.log`: control commands and batch numbers.

The tested runtime was compiled once with `node tools/build-compile-wat.js`;
its SHA-256 is
`1a04201bd45329d62ab65513f768fdfd8396f55b443db471a2f7c459406a21b2`.
These results are CLI gameplay acceptance, not a speed measurement.

## Preparing the local cache

The cache remained at 351 files / 15,316,024 bytes after entering and playing
Round 1-1. It can be exported from a live controlled session using the existing
save-bundle API (the controller evaluates host diagnostics, not guest code):

```sh
node tools/ctl.js -s :8128 eval '(()=>{const r=process.mainModule.require.bind(process.mainModule);const b=r("../lib/save-bundle").exportBundle({appId:"ricochet_xtreme",vfs:ctx.vfs,patterns:["c:/data/cache/**/*"]});r("fs").writeFileSync("ricochet-cache-menu.zip",b);return b.length})()'
node tools/save-bundle.js ricochet-cache-menu.zip --verify
node tools/save-bundle.js ricochet-cache-menu.zip \
  --extract=ricochet-cache-extracted
```

The verified bundle is 15,596,892 bytes, SHA-256
`0502ccc4efe325bd2a5b95b713c7651484132840c5d7d1d77e4dbdde37d6b49c`.
Save patterns require the drive prefix; `Data/Cache/**/*` alone matches no
files. Extraction verifies member SHA-256 values and produces
`vfs/c/data/cache/...`; copy that cache tree into the local fixture's
`game/data/cache/`, preserving its paths, then regenerate the candidate's
browser inventory. These generated local assets are not committed.

The normal save mechanism should persist only small actual settings/profile
files. Anonymous Guest created `c:\ricochet.cfg` (161 bytes, `[Options]`
screen size/color/controller settings); it created no named-player save in
this route. Do not put the 15 MB asset cache into browser localStorage.

## Browser acceptance

2026-09-29: verified the normal `ricochet_xtreme` launcher entry in headless
Chrome with the guest Worker enabled and GPU/WebGL presentation, using the
matching isolated `8f9f66a8` source/artifact and prepared cache. The browser
loaded 358 data files, reached the main menu, accepted Play Game / Anonymous
Guest / Round 1-1, and rendered the complete level. Ordinary browser mouse
movement moved the shield left and right. A held normal left click launched
the ball; subsequent captures show score 3, speed 8, destroyed bricks and
debris. **No `relativeMouse` registry override is needed** for this route.

The driver used `tools/web-input-probe.js --app=ricochet_xtreme --threads
--gpu`, extended only in a temporary diagnostic wrapper to wait until the
blue Play Game lettering appeared before clicking. Fixed early input times
were unreliable on this loaded machine: menu loading and the round entrance
animation both outlasted short waits. Wait for the menu, then wait for the
bricks and running round timer before launching. This is not a performance
measurement; the host load was high throughout.

Browser evidence in ``:

- `ricochet-browser-menu3.png`: menu from the final acceptance run.
- `ricochet-browser-options2.png`: round selection.
- `ricochet-browser-entrance3.png`: complete level and running timer.
- `ricochet-browser-launched3.png`: ball launched, nonzero score and missing bricks.
- `ricochet-browser-left3.png` / `ricochet-browser-right3.png`: opposite mouse
  movement changes the shield's position during active play.
- `ricochet-browser3.log` and `ricochet-browser3-console.log`: input route and
  browser log; no guest API traps or JavaScript runtime failures.

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

## Fixed-route EMMS benchmark acceptance (2026-09-30)

The fallback host `fast-near-9tb-1` (i9-9900K, Node 20.11.1) runs the frozen
EMMS before/after WASMs without extra V8 flags. Use the registered app, prepared
local cache, `--no-threads --branch-clock --batch-size=200000`,
`--tick-ms-per-batch=200 --wall-clock-ms=1790673326000 --max-batches=5500`.
The main menu is visible at batch 2400. Move/down/up at batches B/B+1/B+100
for Play Game `(445,55)` at B=2500, Anonymous Guest `(320,234)` at B=3000,
Round 1-1 `(75,170)` at B=3500, and ball launch `(320,450)` at B=4400.
Then relative movement -150 at 4700, +250 at 4900, and another held click
at B=5000. The earlier ten-batch holds left the game in round selection;
the hundred-batch holds reach the complete round and score 3.

A separate diagnostic module counted 36,270 executions of compiled EMMS,
including 16,331 over the measured 4500..5500 gameplay window. This is
coverage, not a speedup measurement. Captures at 2400/2900/3400/4200/4600/5400
and the end prove the menu sequence, level, launched ball, and changed bricks.
Local evidence: `ricochet-census-0`.
The isolated remote harness is `/home/vg/emms-app-bench`; both timing arms
must run there, rather than comparing this host's CPU times with BOX2.

The uninstrumented before/after/after/before comparison completed all four
5500-batch runs. Total process user CPU was 100.18/99.35s before versus
99.67/99.11s after: means 99.765 versus 99.390s (-0.38%). The gameplay
window was 21.142/20.892s before versus 21.127/20.987s after: means 21.017
versus 21.057s (+0.19%). Both changes are smaller than the same-build spread;
there is no measured meaningful speedup or regression. All seven screenshot
checkpoints are pixel-identical across all four timed runs. Summary and raw
logs: `summary.json`.
These are the frozen EMMS-only comparison builds, preceding the subsequent
main-branch micro-op trace changes and IR-kind renumbering.

## Cache timestamps on remount (2026-09-29 follow-up)

The loading screen can recur even with all 351 decoded cache files present.
Guest cache validation compares exact 64-bit last-write times: calls to
`0x452330` at `0x45ea4f` and `0x45ea6b`, then low/high comparisons at
`0x45ea73` / `0x45ea77`. A mismatch branches to regeneration at `0x45eade`.
After generation, `0x45ec0b` / `0x45ec23` copy source time onto the cache.
The disk helper `0x454fc0` calls GetFileTime through IAT `0x51d1dc` at
`0x45500e`.

Copying bundle bytes into the fixture discarded those timestamps. VFS mounts
then initialized times from the current host clock, invalidating the cache.
The original menu bundle retains exact FILETIME metadata: 347 cache files use
`{lo:265692960, hi:31281240}`; four Round 5 add-on caches use
`{lo:2090469120, hi:29475155}`. The former is the original archive mount time,
not the host timestamp of the later extracted cache file.

Local inventories now carry optional creationTime / lastAccessTime /
lastWriteTime fields through both browser and CLI mounts. Preparation merges
an ignored `.wine-assembly-file-metadata.json` sidecar keyed by fixture-relative
URL. This Ricochet fixture restores all 351 cache records from the original
bundle and the original common last-write time on DATA.dat and the three RED
archives. Re-running `--prepare` retains this metadata. `test-asset-parts.js`
verifies alias mounts, cloned metadata, invalid-value rejection, and exact
source/cache GetFileTimes equality without reading lazy archive bytes.
Runtime cache-hit acceptance after this change is recorded separately by the
root investigation; the metadata unit test alone is not gameplay evidence.

## Current browser gameplay and observer viewport repair (2026-11-11)

One fresh private browser session on main `02d373b5d385` with module
`75ecda5701c15f6fe2c269455ead4e15457b90653733df15d35674b08e8849d5`
followed Play Game → Anonymous Guest → Normal / Round 1-1. The actual backend
was guest Worker / DirectDraw with `canvas-nearest` browser presentation;
the shell's WebGL selector does not establish the presentation backend.
Full captures 24 and 26 show ordinary mouse movement taking the paddle from
the left toward the center. Capture 26 has score 0 and intact lower-right
bricks. A balanced ordinary left click of 500 ms launches the ball; capture
28 shows the silver brick near page pixel `(417,419)` missing, speed 18,
one remaining ion sphere, and “Out of bounds penalty”. Score remains 0;
this proves a brick consequence, not a retained positive score or a completed
round. Evidence: `scratch/runs/20261111-ricochet-xtreme-current-paddle-score-0700/`.

This run also exposed a control failure in its diagnostic attachment: default
`puppeteer.connect()` applies an 800×600 viewport to existing pages. The
original driver's screenshot retained its 1024×768 expectation while the live
canvas shrank to x=10..470, so the attempted `(490,265)` menu click landed on
the log pane. The full screenshots alone hid that mismatch. Restoring the
original viewport recovered the same game session; the next mouse move
highlighted Play Game and the next click opened Select Player.

Use `connectObserver` from `tools/ricochet-browser-observer.cjs` for a second
diagnostic client. It passes `defaultViewport: null`; enumerate/read pages
through that connection and disconnect when done. The Chrome regression
test reproduces the default viewport reset and verifies that the repaired
attachment preserves viewport dimensions and canvas hit coordinates.
No guest-state writes or emulator changes were needed. All unique evidence
was retrieved and hash-verified before normal shutdown; box `bx_6qh8h23q`
was archived unforced under stop `stop_646bd6b42c16f5c0`.
