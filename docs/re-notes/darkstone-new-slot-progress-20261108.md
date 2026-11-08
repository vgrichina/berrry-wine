# Darkstone: new-slot restore and onward route, 2026-11-08

One fresh original session restored the previously earned new slot and personally
reviewed its **actual live inventory: Gold 1532, Victories 3+0, LIFE 28/35,
MANA 25/25, Food 91**. Two bounded native movements then carried the warrior
away from the saved stump/corpse, along the sandy route into a grassy fork beside
a rock and tree line. The onward inventory retained Gold 1532 / Victories 3+0 /
LIFE 28/35, with **Food 90**. Native **Save a Game → New Save** preserved that
onward position in another game-written named slot.

This is cross-session new-slot restoration and onward traversal, not another
combat victory or area transition. No new character, repeated gold pickup,
potion consumption, forced scene/state/clock/configuration or guest-memory edit
was used. No standing skeleton was visible on the reviewed route. The reviewed
28/35 LIFE did not require healing; panels were never treated as pause.

Evidence is ignored `scratch/runs/20261108-darkstone-new-slot-progress/` (R).
The [predecessor](darkstone-native-load-exit-cause-20261108.md), published in
`bc4cd7a8cc9f32bda0bca33808fc2f50fd98a2e7`, retained both original game-written inputs:

| Native input | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\dsave\characters\characters.lpl` | 1,342,084 | `d54321486e009fa7fb63a9d50cd66cd10f831bbfdd285f4288c2b85628234fd7` |
| `c:\dsave\games\game641d_6aefe8e0.sav` | 3,204,264 | `09ae0ed5035dd00f36087cd1040a071d5598049facc4086e70330f5e67aea987` |

R/checkpoint-provenance.json names the retained recovered original VFS artifacts.
Both source files and staged bytes were SHA-256 checked before and after the run.
Actual original-session read-only VFS recovery at **09:02:29.712 UTC**, before
native loading, independently matched both hashes. R/mounted-save-hash-verification.json
retains that check. Ordinary HTTP, composed manifest resolution/merge/normalization,
production `WineAssembly.loadFiles`, mounted hashes and native `*.sav` enumeration
passed locally before allocation. Registry and original manifest files were untouched.

## Qualification and personally reviewed route

The current module's real production guest/render Workers passed generated-fixture
readiness, exact identity/staleness rejection and trusted Chromium mouse/key
controls, including delayed, rejected and pending acknowledgements with independently
prearmed releases. Unknown results remained sticky and were never replayed.
The accepted lifecycle observer retained original receiver, arguments, return,
exception and once-only callback behavior. Observed/unobserved actual x86
ExitProcess(37), distinct UD2 trap and guest/render retirement matched EIP, ESP,
yield, trap, blocks and registers. Both local control browsers exited 0 with their
PIDs and profiles gone. Local heavy execution used `/tmp/wine-runtime.lock`.

One preparation error is retained: the generated-fixture server initially served
the raw manifest instead of the composed handler, failing its HTTP hash assertion
before Chrome existed. The run-local handler was corrected to compose the already
tested save manifest in both fixture and original modes. The passing controls
followed that correction; there was one original browser and no original replay.

The original sequence was native **Load a Game → sole selected new slot → OK**.
The slot preview showed 3+0 but was not used as reload-counter proof.
R/review/restored-inventory-request.png, taken after loading Ardyl and documented
**I**, establishes the live restored totals. R/restore-review.json records the
personal review. Documented **Space** closed the panel.

The first reviewed route target was clear sandy ground at canvas `(0.81, 0.45)`;
the second was visible ground at `(0.82, 0.45)`. Each native left hold was bounded
to 2,000 ms, with UP independently scheduled before DOWN. Passive captures followed
the first movement to its settled destination before admitting the second.
R/review/new-slot-world.png and R/review/route-ahead.png show the saved stump/corpse
left behind and the newly reached grassy path fork, rock and trees.
R/review/onward-inventory.png establishes the unchanged health/gold/victories and
Food 90. No additional encounter kill is claimed.

Documented Escape, native Save a Game and New Save wrote these outputs. Read-only
recovery at **09:06:33.697 UTC** retained them before browser closure:

| Game-written output | Bytes | SHA-256 |
| --- | ---: | --- |
| Updated `characters.lpl` | 1,342,092 | `dee39793c2f1a43bc5af205e428b9c604da1ba31d08e3e7f1fc4dddc9b6328ee` |
| New `game641d_6af03b8e.sav` | 3,204,264 | `3ad043582acc9f02426ef5700693fd39331c9889cd732aeecd37b1bae0dfaa67` |

R/recovered/original/native-vfs-saves.json names the hash-named binary artifacts.
The restored `game641d_6aefe8e0.sav` remained byte-identical. The new onward slot
was not reloaded. After Space, R/review/saved-onward-route.png personally confirms
the warrior still at the grassy fork. These observations establish native output
creation and visible location separately, without claiming another reload.

## Exact runtime, terminal evidence and shutdown

Published Git source was `35442d3d47d46a82a3c17499382a705177bb541f`.
All 432 tracked runtime inputs matched that commit; unrelated peer WIP and the
untracked `lib/wininit-boot.js` were excluded. R/source-recovery.json records the
exact commit, relevant `git diff --binary` (empty tracked patch), relevant
untracked-source patches and owned helper patches. Git is the source archive.
R/media-refs.json references existing media paths, lengths and hashes; no source
or media archive was made. All **524 staged runtime pins** matched after closure.
Actual guest/render module SHA-256 was
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Chrome was 151.0.7922.108; the owning legacy/WebGL render Worker reported WebGL 2
and ANGLE/Mesa Intel. Physical GPU performance is unclaimed.

The original had **16 exact successful command ACKs**, zero UNKNOWN commands,
11 independently released input pulses and 28 trusted events: six balanced mouse
pairs, five balanced key pairs and six moves. No held input remained. Console,
target lifecycle, module, owner, guest terminal and caller evidence are retained.
No original guest process exit, trapped terminal slice, Runtime exception or
target crash was observed. A helper `exit_thread` is retained separately.

The harness's explicit **finish-run** command requested ordinary completion at
**09:06:54.367 UTC**, then called Browser.close. Immediately before that request,
the registered game was still running. Chrome exited **0 / no signal** at
**09:06:54.472**. R/lifecycle-observations.json and recovered close/target/console
records preserve the actual boundary. There was no spontaneous owner removal.
The older spontaneous exit remains **unknown**; this browser shutdown supplies no
historical explanation or production-defect claim.

Box **bx_8zp5z56n** was allocated at **09:01:04.184 UTC**, initial expiry
**09:27:04.042**. Detached independent watchdog and normal-stop children were
observable before allocation; their immutable 25-minute deadline was
**09:26:04.193**, with browser deadline **09:24:03.878**.
All **193 remote artifact references / 18,686,006 bytes**, comprising
**161 distinct contents / 18,673,314 bytes**, were retrieved and independently
SHA-256 checked before normal stop. Both owned remote PIDs were absent, both
ports closed, and the profile and writer were gone. R/final-audit.json also passes
16 PNG CRC/scanline-decode checks, ACK/input/containment/helper-syntax checks and
unchanged input-save verification.

Normal stop **stop_41f390cbccd605e7** completed at **09:07:31.770 UTC**, with
`forced:false`, no error. The box is **archived**, stopped **09:07:31.741**,
expiry null. Both lifecycle children exited 0 and the supervisor has no remaining
children. Disk remained above 5 GB. No old box resume/delete, public deployment
or subworker was used.

Run-local artifact references and note whitespace pass. Darkstone has no candidate
corpus entry, so metadata is R/investigation-result.json without a corpus
attachment. The global evidence checker retains seven unrelated containment errors.
Only this note is committed; production code was unchanged. Next useful work is
a separately reviewed encounter beyond this grassy fork, optionally restoring
the newly retained onward slot with its updated character file. Its reload,
full27, parity, audio and FPS remain open.
