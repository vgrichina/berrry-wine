# Mad Bomber ordinary browser gameplay qualified

On exact main `0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb`, the registered
browser launch reaches the original menu. Ordinary Enter selects One Player,
Space starts falling bombs, and mouse movement moves the buckets. The second
of two bounded 60-second gameplay windows visibly catches bombs and advances
score 0 → 1 → 3. No blocking browser failure occurred. FPS, audio quality,
sustained play and full completion were not qualified.

## Actual browser route and observations

Headed Chrome `151.0.7922.108` on assigned Boat `bx_j693sabt`, Node
`24.18.1`, viewport 1000×760. The game client is 640×480 inside its normal
window. The box-local server was:

```
node tools/dev-server.js --port=8080 --isolate --no-agent-inject
```

The ordinary registered deep link was
`http://127.0.0.1:8080/index.html?app=madbomber&debug`. Exact-source
`lib/apps.js` contains the localhost candidate and its original file manifest;
`index.html` handles this URL through `shell.launchApp(wanted, ...)`.
The dropdown still displays Notepad in the debug screenshot, but the launch
log, titled Mad Bomber window, network EXE request and actual game establish
which registered app ran. No CLI runtime was used for these captures.
The registry's `threads:false` is honored; the browser log explicitly reports
single-threaded execution. No page/guest API replacement, memory writes,
engine patch, alternate EXE, observer injection or launch bypass was used.

The harness uses Puppeteer `page.keyboard` and `page.mouse` for real browser
input. Its page evaluation reads only DOM text and canvas geometry. A title-bar
click focuses the game before Enter. Scheduled actions and actual UTC receipt
times are retained in `commands/`, `inputs.json` and per-image JSON files.
These receipts alone are not evidence of guest consumption; the reviewed
rendered transitions and bucket positions establish the behavior.

* Window 1: 17:13:49.833–17:14:50.034 UTC, including final capture/close.
  Menu → One Player, bomb descent and bucket movement are visible. The aim
  misses; score remains 0. The final image says **Press Fire** with two buckets.
* Window 2: 17:15:21.127–17:16:21.324 UTC, including final capture/close.
  `catch-4600.png` at 17:15:25.852 (4.725 seconds) shows score 0 and the
  approaching bomb. `catch-5200.png` at 17:15:26.464 (5.337 seconds) shows a
  blue splash and score **1**. `catch-6800.png` at 17:15:28.018 (6.891 seconds)
  shows another splash and score **3**, with buckets moved left. Score 3
  persists at 10 seconds and in the final Press Fire image. Later misses lose
  a bucket; no full-game completion is claimed.

Screenshot names denote scheduled offsets, not exact sampling times. Input,
rendering and capture are asynchronous. The CLI timing was only a guide; the
second browser path was aimed from the first browser's observed bomb position.
Both harness processes exit 0 after their own 60-second window. Their total
lifetimes include browser startup and menu inspection. No third window ran.

## Identity and reuse

Before rebuilding, retained artifacts were inventoried and the accepted module
was found at the supplied Army provenance path and in the sealed Mad Bomber
archive. No build was needed or performed. The prior canonical build succeeded
at `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`; its sealed log, exit and source
manifest are retained here. The accepted CLI verifier was replayed: 63 seals,
7,451 prior source entries, 168 pins and 50 input acknowledgements pass.

The Git comparison from that canonical build to exact `0c0fa3e` contains only
docs/evidence/status and `tools/army-bltfast-observer.js` plus its preload test.
Those tools are not loaded by this browser route. All production/build and
browser-host inputs are unchanged, including `host.js`, `index.html`,
`lib/apps.js`, the region map, package lock and compiler closure. The remote
source projection includes all production source, browser assets, build tools,
tests and non-archival documentation; unrelated package binaries, scratch
evidence and archived reviews were excluded. All **6,908 staged Git blobs**
match the exact revision before and after execution. This is not a claim that
every historical evidence blob was materialized remotely.

The retained canonical module and both actual Chrome response bodies have
SHA256 `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes, served as `/build/wine-assembly.wasm?v=dev`.

The original archive remains unchanged at
`scratch/runs/20261020-madbomber-native-qualification/original-assets.tar.gz`:
SHA256 `b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef`,
3,069,702 bytes. It was verified and transferred without redownload. All
**140 originals + support MSVCRT + 27 boot files = 168 pins** verify pre/post.
`preflight.json` lists every hash. Exact-lockfile `PUPPETEER_SKIP_DOWNLOAD=1
npm ci --omit=optional` succeeded remotely; all 2,407 dependency file hashes
remain unchanged. Producer source remained frozen throughout execution.

## Diagnostics and limits

Both page-error arrays are empty. Full bounded console logs contain 552 and
528 events, below the 2,000-event cap. Each records 359 AudioContext autoplay
warnings, one deprecated mobile-meta warning and four resource-404 errors.
The 404s are `build-info.js`, the Mad Bomber shell icon and two favicon requests;
they do not prevent the observed launch/play. Generated build metadata was
not recreated merely to silence its optional request: actual source and loaded
module identity are recorded independently. Each network log has 143 records,
including eight aborted requests (build-info and EXE/DLL request paths), retained
without suppressing or reclassifying them. No missing required asset or runtime
trap was observed; the complete staged closure verifies. Audio quality and
autoplay behavior were not investigated or repaired.

Preparation-only mistakes are disclosed: the first source-comparison filter
misclassified scratch evidence and then the unrelated preload test; both were
corrected to the explicit accepted allowlist before staging/runtime. An initial
`boat exec --detach --timeout` combination was rejected by CLI argument parsing
before launch, then corrected. The full remote capture archive exceeded the
local transport's 16 MiB per-file cap, so no copy was made; a selected delivery
was created and recovered instead. No source/build/closure failure was bypassed.

## Evidence and running-box handoff

Run: `scratch/runs/20261021-madbomber-browser-gameplay/`. Fourteen selected
original PNGs, every input/DOM snapshot record, console/network/error logs,
source/build/dependency provenance and terminal/cleanup receipts are durable
on the task branch. `verify.py` checks seals, exact Git identities, canonical
reuse, loaded modules, closure/dependency receipts, input bounds and clean exits;
visual review remains explicitly manual. `result.json` publishes the reviewed
gameplay scene after artifacts. `RECOVERY.md` gives reproduction instructions.

The full 17,791,642-byte capture archive remains on the same box at
`/home/user/madbomber-browser/evidence.tar.gz`, SHA256
`5520cb4ee85c9b61f76600bb8c259e6a0d03320add0d66da97746d10daa4b8bd`.
Unselected extra screenshots remain there; acceptance relies only on the
durably preserved selection. The selected delivery was 5,847,801 bytes; its
receipt is retained, and the temporary local archive was removed after recovery.
No original or accepted prior archive was removed or duplicated locally.

All six owned harness/Chrome/server PIDs are absent and port 8080 is closed.
The SAME box is left **RUNNING**, API state `idle`, health `ok`, expiry
**2026-10-21T19:06:34.564Z**. Source, dependencies, module, original archive,
capture scripts and complete evidence stay under `/home/user/madbomber-browser`.
Coordinator owns shutdown and any next task. Handoff is before 18:45 UTC.
No workers, public hosting, deployment, main merge or unrelated changes occurred.
