# Die by the Sword (demo)

Treyarch/Interplay 1998 demo in
`test/binaries/win98-games-a-d/Die by the sword demo-SW+Glide/`: `dbts_demo.exe`
(v. Feb 16 1998), the `Rlapi.dll` render-library front end (static import,
which imports `SIMFORCE.dll`), the Glide back end `rl3dfx.dll`, and `data/*.atd`
archives plus `moves/`. No installer. Registry id `die_by_the_sword_demo`
(localhost-only; `dlls` = rlapi + SIMFORCE), manifest written by
`tools/gen-win98-games-a-d-manifests.js` (28 companions, subdirectories kept).

Imports KERNEL32, USER32, GDI32, ADVAPI32, ole32, WINMM, AVIFIL32, MSVFW32,
Rlapi, DDRAW, DSOUND, DINPUT. No emulator change was needed to reach play.

## Route (headless, default 200 ms/batch clock)

| batch | action / screen |
|---|---|
| ~400 | "Die By The Sword - 3D Hardware Detection" dialog: 3Dfx Voodoo / Do Not Use 3D Hardware |
| 500 | click (200,134): "Do Not Use 3D Hardware -- Use Software Rendering Only" |
| 600 | click (534,119): OK |
| ~19900 | main menu: Tutorial, Quest, Arena, Tournament, Options, Quit (Arena/Tournament greyed) |
| 20000 | `keydown:40` (Down) to Quest, 20400 `keydown:13` (Enter): Loading screen |
| ~60000 | Quest level 1: textured wooden hut, Enric seen from behind |
| 62000-74000 | `di-keydown:87` + `keydown:87` (W held): Enric walks to the barred gate |

Evidence: `scratch/runs/20261006T040000Z-die-by-the-sword-demo-quest-walk/`.

## Input

- Keyboard is DirectInput buffered (`IDirectInputDevice::GetDeviceData` on the
  keyboard device, ~4.6 polls per Flip). Send both `di-keydown` and `keydown`.
- **Arrow keys do not move the player.** They move the sword arm (VSIM
  controls, see `readme.txt`): W/S/A/D-style keys walk, Keypad 4/5/6 attack,
  Keypad 1/2/3 defend, Insert/Home/PgUp specials. A run holding Up arrow
  shows a pixel-identical frame to the idle run, which looks like dropped
  input and is not.
- Menus take arrows + Enter, and Escape opens the in-game options menu.
- The menu mouse is DirectInput relative. An absolute `mousedown` at Quest's
  shown position landed on Options. Not investigated; keyboard is enough.

## Captures

- Use end-of-run `--png-canvas --png=` for the startup dialog. A mid-run
  `B:png:` at batch 400 gives the bare desktop because it does not composite the
  GDI dialog. Mid-run captures of the DirectDraw menu and level are fine.
- About 46 Flips per 6000 batches in the hut on the software renderer.

## Glide (the dialog's default)

"3Dfx Voodoo" is the selected entry, so a plain OK (what a user does) loads
`rl3dfx.dll`, which imports `glide2x.dll`. In the browser that made the logos
and menu black (DBTS-WEB-BLACK-20261006). It looked like a Threads or lazy-file
bug and was neither: every 2D screen is written through the LFB, and
rl3dfx+0x10001ff4 calls `grLfbLock(WRITE_ONLY, BACKBUFFER, 565, upper-left,
FXFALSE, &info)` with `info.size` never written (a stale `.wav` from its stack).
The handler rejected size != 20, rl3dfx gives up after ten failed locks
(`cmp edi, 0xa`), and nothing reached the screen. Retail glide2x only checks
`size` with the debug-only `GR_CHECK_F`, so the handler no longer checks it.

- Headless repro: `--screen=1280x900 --input=700:click:854:329` (OK on the
  default entry). Before the fix the census is ~150 `_grLfbLock` and no
  `_grLfbUnlock`; after it every lock has its unlock.
- The CLI `--png` does not composite the Glide layer, so a Glide frame stays
  black there even when it is drawn: verify Glide pictures in the browser.
- The software-rendering palette fades are real: each logo fades in and out
  through ~670 `SetEntries` from the BMP's own colour table (logo object +0x3a,
  6-bit triples built at 0x46ff1e, faded at 0x470066). The CLI's 200 ms/batch
  clock jumps over them, so a mid-run capture shows the initial grey ramp.

## Open / not evaluated
- `ole32.dll` is not in `test/binaries/dlls`, so its imports fall to WAT stubs.
  This did not block play.
- About 310 caught C++ `file_error` throws per run (EIP 0x516460), probably
  probes for optional files such as the separate VOICEDMO voice pack. Not
  investigated.
- Audio, FPS and Arena remain unevaluated. Native-browser movement was later
  evaluated below; the brief accidental Tutorial visit is not a Tutorial test.

## Native browser investigation (2026-11-02): transfer blocked before launch

Run `scratch/runs/20261102-die-by-sword-native-browser/` stopped at its first
concrete blocker, before starting Chrome, the local server, or the original.
For that attempt, browser gameplay remained **unevaluated**: there were no new movement,
sword-action, or gameplay screenshots. No unchanged replay was made.

Both ordered predecessor gates (Tachyon11018, then pixel-map6843) had actual
terminal completion, result/final records, exact AUTHOR RELEASE and absent
helpers before this task took the lane. All 7,230 accepted input hashes matched
pixel-map commit `3a49ef5e2e933c2f6db22c28d24915d25f3a1028`. Its module SHA256
`bdbe80167ac6970208664c1bb3241b667eabb4f7e25c6e18fbcdaedb8255cb5c`
was copied and verified, but **not executed**. The shipped readme and this note
were read first. Registry review confirmed `die_by_the_sword_demo` is absent
from public `DESKTOP_APPS` and present in `LOCAL_CANDIDATE_APPS`; its existing
fixture, 28-companion manifest and arguments were left unchanged.

At `2026-11-02T14:25:36.145Z`, remote transfer-verification command
`cmd_gdlakq6gvyuo` and the local transfer process exited 1. The worker had
mistakenly included its actively updated `local-disk.json` in the transfer
manifest: the guard rewrote that file between hashing and archiving. Retrieved
audit evidence verifies 3,931 of 3,932 transferred files match, with exactly
that one mismatch. All transferred source/original files and the module match.
The expected guard-file SHA256 is
`4f8a95872624343111c6813118b697a80a8ec6794e902e7ebeeaf8a95132cf1a`;
the transferred SHA256 is
`0e8427d92c48b914dae8a8c0ba964d5099de47c7385fa6354d75442b759382f4`.
This is a harness preparation failure, not a demonstrated guest failure.

The single fresh boat was `bx_42utwzw9`, TTL 3,600 seconds, original expiry
`2026-11-02T15:24:51.655Z`, recorded before use. Launch admission measured
2,509,291,520 free bytes, above the required 2.4 GB margin. Evidence was
retrieved and SHA256/size verified before the explicitly delegated shutdown;
STOPPED was confirmed at `2026-11-02T14:26:58.670Z`, with remote Chrome,
crashpad and scoped helpers absent, and both local helpers absent. Minimum
observed local free disk was 2,505,461,760 bytes. The final lifecycle and helper
checks are in `cleanup.json`. No downloads,
compilation container, guest patches, injected state, renderer override,
subworkers or public deployment were used.

Recovery: retain `first-blocker.json`, `transfer.log`, `preparation-pins.json`,
`accepted-inputs.json`, `runtime-inputs.json.gz`, the retrieved transfer audit,
`retrieval-verification.json`, `cleanup.json`, `result.json`, `final.txt` and
`RECOVERY.txt`. A future authorized attempt must exclude mutable guard/output
files from its immutable transfer inputs, refresh gates/hashes/disk admission,
and use a fresh finite-TTL boat. Follow the real hardware dialog and Quest menu
route, then review matched before/held-W/released/settled character movement.
Menu selection and idle animation still do not establish gameplay.


## Native browser recovery (2026-11-02): Quest movement demonstrated

Run `scratch/runs/20261102-die-by-sword-immutable-transfer/` corrected the
preparation failure within the gameplay task. The previous failure evidence is
retained as `prior-first-blocker.json`, `prior-transfer.log` and
`prior-failure-identity.json`. No original/browser had launched in that attempt.
This run launched the original once, with no replay, patches, injected guest
state, forced renderer, downloads or public deployment.

After ordered Tachyon58338 and GL65341 terminal/result/final/exact AUTHOR
RELEASE and helper-absence gates, all 7,233 accepted GL input hashes matched
commit `93793279ec4ddbddf4ad1154f35e7c1553e99bc5`. A locked local build exited
0; its coherent 2,069,384-byte module SHA256 is
`6d9563ff4a1c089c9d0ac4153748411990dc3c92f3a50e2509bbe9ffaaca30a7`.
`build-identity.json`, `snapshot-inputs.json` and `original-inputs.json` pin
source, compiler inputs and original/support files. The original executable
SHA256 is `88a7b9c6ecb98130f8207ac19c984fca57a844d0a62719aabd363e1a3759e85c`;
the unchanged 28-companion manifest SHA256 is
`ffd1b2b2d5348e599ca8657aa3c89baa89fe6338f58eb8a78f4d34a7f684a7d0`.
Registry inspection again confirmed the existing fixture is in
`LOCAL_CANDIDATE_APPS` and absent from `DESKTOP_APPS`.

The transfer names immutable runtime assets, the module, fixture/support
files, controller files and frozen input manifests explicitly. It excludes
mutable disk guards, commands, output/control JSON and logs. Each member hash
was calculated from the exact byte buffer added to the archive. The remote
verified archive identity, exact member set and member bytes before extraction,
then every extracted file: all 2,914 matched. Archive SHA256 is
`862aff488361d851d612418711542196d7800b6399d03618abcd03a79c21636b`.
See `immutable-inputs.json`, `transfer.py` and `transfer.json`. A rejected
`boat exec --detach --timeout` preparation command was corrected before any
original launch; `preparation-launch-argument-error.json` retains it.

Installed native Chrome ran headfully on the existing display. The shipped
controls were read first. Balanced native mouse input selected the visible
software option in the ordinary hardware dialog and pressed OK; the host
renderer setting was not changed. An initial menu Down/Enter entered Tutorial,
which was visibly recognized and exited through Escape, Quit and Enter. The
reviewed second route selected **Quest** (white highlight), then **Knight**
difficulty through the normal menus. This Quest starts in a rocky chamber;
the older headless note's hut and inferred menu selection should not be used
to identify this browser route.

The movement proof is a paired full-page/visible-canvas sequence under
`retrieved/`. Every listed pair was opened and visually reviewed:

| Phase | Full-page capture | Matching canvas capture |
|---|---|---|
| Before | `25-quest-before-W.png` | `25-quest-before-W-canvas.png` |
| W held | `26-quest-W-held.png` | `26-quest-W-held-canvas.png` |
| Released | `26-quest-W-released.png` | `26-quest-W-released-canvas.png` |
| Settled 2.5 seconds | `26-quest-W-settled.png` | `26-quest-W-settled-canvas.png` |

One trusted native W keydown requested a 3,000 ms hold and was balanced by
keyup after 3,378 ms including capture overhead. All 32 recorded native input
events were trusted and balanced.
The character strides forward; the close diagonal rock wall recedes, the
chamber opens up and a fire becomes visible to the character's right. After
release, the character stands while that changed floor/wall/fire arrangement
persists through the settled capture. This is visible displacement, beyond
idle sword animation. The released input snapshot contains W's WM_KEYUP
(`msg=257`, `wParam=87`); the settled queue is drained. Controller cleanup
records no held keys. `movement-review.json`, `capture-pairs.jsonl`, native
input records and per-capture state JSON preserve the evidence.

The result is limited to this short ordinary movement interval. A later
no-input observation (`27-neutral-after-W.png`) was black; the next
(`28-post-movement-observation.png`) showed the game's “Behind The Rockslide”
/ “Restart Game” screen. The cause of that transition is not established.
There was no observed runtime trap, and no restart or further gameplay input
was attempted. Sword action, sustained stability and level completion are
not demonstrated. The transfer also omitted the runtime asset
`src/api_table.json`: its fetch returned 404 and the browser used an empty
ordinal lookup table. That did not block this exercised route, but ordinal
import coverage is not established; future explicit transfers should include
that immutable runtime asset. Existing ole32 fallback and caught `file_error`
probe messages remain visible in the console evidence.

The controller and native Chrome exited 0; the local server closed and the
profile and remote browser/crashpad helpers were absent. No guest ExitProcess
code was observed: the controller closed Chrome while the game screen was
active. The single finite-TTL boat was `bx_3rfjgrcy`, original expiry
`2026-11-02T16:53:09.171Z` (recorded before use). The dispatcher's explicit
15:50:25 amendment replaced its original 2.4 GB admission condition with the
owner's >2 GB floor; the exact instruction is retained in
`disk-threshold-amendment.json`. Launch free disk was 2,354,966,528 bytes.

Recovery and closeout: retain `RECOVERY.txt`, `result.json`, `final.txt`,
`retrieved-manifest.json`, `retrieval-verification.json`, `cleanup.json`, the
paired captures and immutable manifests. All 200 retrieved evidence files were
archive/member-hash verified before the task-delegated shutdown. STOPPED was confirmed at 2026-11-02T16:07:40.269Z;
remote and local scoped helpers were absent. Minimum observed local free disk
was 2,293,895,168 bytes. Final lifecycle details are in `cleanup.json`. No
unchanged replay is needed to establish the demonstrated movement.
