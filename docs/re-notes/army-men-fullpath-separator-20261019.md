# GetFullPathName directory separator compatibility

Source candidate base: main `cdc48b24d16fffd53a1ff8972b206d08212ce9d3`,
which follows60f403b4e with a TODO-only update. Isolated branch
`task/army-fullpath-separator-oct19`; no unmerged LockFile source included.
Ownership is restricted to VirtualFS.getFullPathName and its host import.

The original Army directory-validation-v2 observation is sealed separately
in `scratch/runs/20261019-army-men-directory-validation-v2`, manifest
`e9dfb850f15bf3dfbeb28832022216587756ac48c6952c7800acb486c0f66a76`.
It captures a GetFullPathNameA input ending Campaigns/, followed by the game's
FindFirstFileA pattern campaigns*.* without a separator, failed enumeration,
then a leading-NUL cached directory passed to native _chdir. The original
SetAt instruction trace had zero hits; exact dynamic store attribution remains
unavailable. No claim that the earlier AVI transition proves this campaign path.

## Contract and scope

[Microsoft GetFullPathNameA documentation](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamea)
specifies successful length excluding NUL, required capacity including NUL,
and a zero file-part pointer for a directory result. It does not require the
path to exist. The shared host import serves A and W in TCHAR units.

[Wine's Windows path conformance tests](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/path.c),
`test_ValidPathA` lines129–137, explicitly compare a trailing-backslash input's
full result including that separator and require NULL filePart. This supplies
the trailing-separator evidence not explicit in Microsoft's prose. No original
application binary or alternative assets are used in the new tests.

The fix changes API display semantics only: normalize slash spelling before
resolving an API path, preserve an explicit final separator, and represent a
drive root with its backslash. Canonical VFS lookup still uses the unchanged
_resolvePath/_normPath functions; existing case-folding policy is retained.
On short buffers, return required TCHAR capacity before writing output or
filePart. On successful directory-form output, set filePart to zero; for a file
result retain the pointer into the output, scaled for ANSI/UTF-16. Empty inputs
retain their existing failure behavior. This is not a complete Windows path
normalization overhaul (case retention, device namespace and per-drive CWD
limitations remain outside the scoped change).

## Validation and pending runtime

`node test/test-full-path-name.js` passes pure-JavaScript production host imports
using16KiB ArrayBuffer memory, no WebAssembly instance: A/W explicit separators,
mixed separators, roots, parent traversal, relative/nonexistent paths, sufficient
and exact-short/zero capacity, output sentinels, optional and directory/file
file-part pointers, and composing Campaigns/ with *.* for enumeration.
`node test/test-vfs.js`:46 passed,0 failed. Syntax check passes.
The sealed old v4 VirtualFS negative control returns C:\work\campaigns without
its slash, demonstrating the regression that the new test detects.
The first test draft compared a Uint8Array to Buffer with strict equality;
that test-only representation mismatch was corrected before all checks passed.

No build, native guest, browser or original Army retry has run on this candidate.
Root must review/integrate the disjoint filesystem hunks and qualify an immutable
consumer before any claim that this fixes BootCamp gameplay. Original files and
historical bundles remain untouched.

## Paired original consumer ready (not run)

Immutable `/home/user/army-men-local-stage-v7-20261019` uses historical7c943
source/runner903d and module7fd, plus this scoped filesystem JS candidate
`afeabfd0e06f70b03ab1c8627abacaf76cb1dd66`. Maincdc48 filesystem base and v6
filesystem were byte-identical SHAca27bf7e, so the candidate is exactly these
reviewed hunks on the prior consumer. No src/ABI or WASM change is required;
this is explicitly a paired historical baseline, not currentmain's module.
The candidate filesystem SHA is
`04f5fd5fa989f416826eb19fe38227bf26a9433d11c921f11bc5f95496dc5fbf`.

All1,600 staged entries rehashed,1,597 unchanged hardlinks. Added allocated
file bytes434,176 including manifest, excluding directory metadata. Priorv6
also rehashed unchanged. Manifest:
`b22f8986ce3428e776b34736cb4fe217b373f15511385e090986fc09c6b447a8`.
Controller:
`e43ad070c53ac17dd9ca0ca9dc0d76890e03b42847d5ad5b8a5328408be170d1`.
Unchanged trace plan:
`84bb379481ed5ebc5721dd83245ccbfc34e885a9bf6ba911a8eb985e73b4f2ed`.

Source95modules/39statics and native5DLL preflights pass. A/W regression tests
also pass directly against the staged runtime; actual trace expression,
API-memory and host-return wrapper tests pass. No native execution occurred.
The unchanged trace plan captures the selected API/host returns and eight
possible43c754 boundaries; no debugger breakpoint/watch is used. Same limits:
60s guest/75s soft/90s hard,4MiB raw log,28MiB output,512MiB transient reserve,
fresh admission2,847,932,416 bytes and250ms hardfloor2,214,592,512 bytes.
Readiness is `scratch/runs/20261019-army-men-fullpath-consumer-preflight/ready.json`.
Pending explicit root grant:

```sh
node /home/user/army-men-local-stage-v7-20261019/controller.js /home/user/army-men-local-stage-v7-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-fullpath-observe-v1 --root-runtime-granted
```

### First v7 allocation: admission refused, no guest

The granted fullpath-observe-v1 attempt exited1 at controller line28's initial
fresh disk admission assertion before output creation, source preflight or
spawn. No child/session or game compatibility result exists. The assertion
has no exact failed-sample value; separate follow-up statfs at02:15:14 UTC
reported2,995,687,424 bytes for allthreepaths, and df2,995,683,328. Those later
readings exceed admission2,847,932,416 but do not explain the earlier refusal.
Failure receipt: `scratch/runs/20261019-army-men-fullpath-observe-v1/admission-failure.json`.
No automatic retry, threshold change, or original/source alteration. Root was
notified of release; another allocation needs a unique directory and fresh check.

### Paired v7v2 result: separator fix validated, game still blocked

Root launched unique fullpath-observe-v2/session98620 with the unchanged
reviewed controller. Guest2897500/controller2896813. Menu first.png was
visually reviewed before ordinary BootCamp click176,180 at batch499.
Actual searches now contain campaigns\*.* and maps\*.*; FindFirst returns
6a000008/6a000009 and each subsequent FindNext returns1. The Campaigns
SetCurrentDirectoryA buffer114a950 starts43 (`C`) and contains the full path.
This validates the separator/directory-validation behavior against the original
program. No SetAt trace hit was observed.

Nevertheless snapshot202350 reports the game's Error dialog and the raw log
still says `ERROR: .AMM does not exist`. The framebuffer PNG remains the menu;
no gameplay is shown. This trace does not include campaign fopen or chdir
return, so successful campaign opening is not proven. Normal HTTP quit exited0
with no guard reason, minfree2,989,023,232, all1,600pins unchanged and freshly
absent groups. Prior licence acceptance remains true; Finish unobserved.
Evidence16artifacts447,430bytes, manifest
`ad4488adcf92a901d5eca7b3aa0719d77b21a27a6d2a5f69ef4db99622d2a732`
in `scratch/runs/20261019-army-men-fullpath-observe-v2`. No retry.

Separate source-only reproduction points to a second defect: with cwdc:\work\
and an existing c:\work\campaigns directory, `_resolvePath('C:/work/campaigns/')`
returns c:\work\work\campaigns and directory lookup fails, whereas the equivalent
backslash absolute path resolves correctly. Drive-relative detection currently
runs before slash normalization. This does not retrospectively prove the
untraced chdir return; it supplies a generic canonical-resolution regression
for a separate source fix and subsequent observation.

### Separate canonical slash-classification fix (source only)

Root authorized `_resolvePath` ownership after the paired separator result.
Normalize slash spelling before the existing drive-relative/root/UNC decision,
not after it in _normPath. This one-line behavior change keeps C:/dir absolute
and /dir rooted, while C:dir remains drive-relative. The new regression first
failed on the unmodified function with c:\work\work\campaigns, then passes
against the fix. It verifies generic mixed slashes, same/different drive-relative
paths, roots, UNC spelling equivalence, chdir to a real mounted directory,
relative file opening there, and failure for genuinely missing directories/files.
The existing canonical UNC representation is retained, not claimed fully corrected.

Validation: new slash test PASS; A/W API tests PASS; existing VFS46/0 and adopt
PASS. Requested lazy suite:49PASS/2FAIL identically on candidate and pre-change
HEAD. Both failures construct a ThreadManager prototype without its threads
map, then hit `threads.values`; they are unrelated to path resolution. Baseline
was loaded from git HEAD into a test-only Node module cache without modifying
production files. Raw baseline/candidate logs are retained at
`scratch/runs/20261019-army-men-slash-source-tests`. An initial third lazy failure
was sparse checkout missing host.js; adding exact host.js and test/run.js removed
that environmental failure. No scheduler fixture was silently patched. This
existing suite includes its real Worker/compiled-adapter check, which passed;
no original game or normal build was executed. New test's missing-file assertion
uses VirtualFS's internal zero failure (not Win32's external INVALID_HANDLE_VALUE).

The first GetFullPathName fix remains a separate coherent commit; this second
fix has no consumer runtime qualification yet and must not be labeled a BootCamp
success. Root integration/review controls further runtime allocation.

### Paired v8 ready; runtime grant still required

Immutable `/home/user/army-men-local-stage-v8-20261019` retains historical7c943
runner903d/WASM7fd and original433state/nativeDLLs, with candidate28a2e9035
filesystemSHA`ba7e94aec476e403c6db8802fd2da724a06eab45b16eee8eb7d0be223b3d287d`.
Manifest`ce42e21b5c95fc55ccbc7c9820ac3c28de6f817f9e826f2d0486b19dc354c82c`;
controller`f1ccf470639ef3bf909f1b42295f0eccdec7760b2da9a10cebd05e55b1c2ed12`.
All1,600pins checked,1,596 unchanged hardlinks,438,272 newly allocated file
bytes including manifest (directory metadata excluded). V7 preserved unchanged.
Staged A/W and slash chdir/relative-open tests pass, source95/statics39/native5
preflights pass, and actual trace-parser/host-wrapper synthetic tests pass.

The plan adds selected CreateFileA/ReadFile plus fs_set_current_directory host
returns and existing --trace-fs to the previous directory observation. This
captures actual resolved file paths/handles/read results and directory success,
not merely numeric native-CRT pointers. Existing4MiB log cap stops excess output;
no cropped-log success claim. No debugger breakpoint, no automatic menu input.
All60/75/90 deadlines,28MiB output,512MiB transient admission and hardfloor remain.
Source-only receipt `scratch/runs/20261019-army-men-slash-consumer-preflight/ready.json`.

```sh
node /home/user/army-men-local-stage-v8-20261019/controller.js /home/user/army-men-local-stage-v8-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-slash-observe-v1 --root-runtime-granted
```

The earlier lazy suite's real Worker/compiled-adapter cases were execution,
not pure-JS source inspection; they passed with no peer runtime, but they had
not received a separate runtime grant. Future source-only runs must exclude
such bundled cases unless explicitly allocated. They were not repeated during
v8 staging. The two49/2 baseline failures remain explicitly unresolved.

### V8 original BootCamp scene reached

Granted v8 session48323/controller2908921/guest2909615 passed fresh admission.
`first.png` now shows the textured original main menu; after visual review,
ordinary BootCamp click320,180 was delivered at batch384. `after-click.png`
and `bootcamp.png` show the welcome sign over rendered terrain and game HUD.
Snapshot740 reports main game focus, yield0, and no Error window. No movement
input was sent; this qualifies scene entry, not player-controlled gameplay.

Actual log10877 changes to the canonical Campaigns directory; host return1.
BootCamp.cpn opens as70000028, then yields0x5ce(1486)bytes and EOF. BootCamp.AMM
opens as7000002d, with subsequent actual map reads. The selected read trace
reports copied bytes, not a separately logged final ReadFile error; downstream
original scene progression corroborates successful campaign/map processing.
Normal quit exited0, no guards, minfree2,274,381,824, all1,600pins unchanged,
groups freshly absent. Historical7c943/7fd plus scoped JS fixes remains the
accurate runtime identity; this was not a currentmain WASM run. Prior actual
licence acceptance true, installer Finish unobserved.

Evidence `scratch/runs/20261019-army-men-slash-observe-v1`:17artifacts,
4,343,609bytes before manifest, rawlog3,103,579bytes uncropped; manifest
`6e5aa56b55f605568df29532c576f98efbe562270172f87ba91a9ef192349b9d`.
No retry. Next ordinary movement observation should remove broad filesystem
and ReadFile tracing to avoid audio streaming log volume.

### Proposed exact root ledger replacements (root files not edited)

Replace the Army TODO status and Next fields with:

```text
status: active (generic path fixes reach original BootCamp scene; player movement pending)
Next: Original BootCamp welcome/terrain/HUD reached in sealed 20261019-army-men-slash-observe-v1 after GetFullPathName separator and VFS slash-classification fixes. Campaigns chdir succeeds, BootCamp.cpn opens and yields1486bytes, BootCamp.AMM opens/reads. Normal quit0, no guards, all1600pins unchanged. Runtime is historical7c943/7fd plus scoped JS candidates; no player movement claim. Prepare bounded ordinary movement proof from original readme controls with reduced traces, then separate runtime grant. Source branch task/army-fullpath-separator-oct19; evidence manifest6e5aa56b. Prior licence accepted; Finish unobserved.
```

Replace only the Army sentence in the latest ops/STATUS current entry with:

```text
Army Men generic path fixes now reach the original textured BootCamp welcome scene with terrain/HUD; actual campaign directory/open/read and map open/read observed, normal quit and input preservation verified. Player-controlled movement remains pending; next bounded observation uses original documented controls, without broad audio/file-read traces. Historical7c943/7fd paired runtime is distinct from currentmain qualification.
```

Other lanes, prior historical status entries, and shared/root pinned files
remain root-owned. The stale v5 dynamic-watch allocation is terminal and should
not be presented as current work.

### Next movement proof, source-only plan

The installed original readme.txt, July1998, explicitly documents Numpad8 for
forward movement, Numpad2 backward and Numpad4/6 turning. Space/left-click fires,
Enter toggles map-scroll mode, and Escape opens options; those are not movement
substitutes. After normal observed menu/BootCamp entry, retain before/after
frames around a bounded Numpad8 keydown/keyup (VK104), using ordinary control
commands, then inspect Sarge/terrain/minimap change. Stop on failure; no memory
writes, timed game workaround or undocumented sign-dismiss input. If the welcome
sign prevents a defensible movement comparison, report that limitation instead
of claiming success. No next consumer or runtime has been launched yet.

### V9 movement consumer ready, no runtime grant yet

Immutable `/home/user/army-men-local-stage-v9-20261019` retains V8 runtime,
originals and historical module unchanged. Only controller/plan/identity differ:
1597 hardlinks, 282624 added allocated bytes excluding directory metadata.
Manifest `738fd64e33e4f5bdb6a7d461a74941ebab59ae152d5fdf4b03bbe9a20f507525`;
controller `8da0bab81381fbca3a2c3a0f901969e5781e19a6823fec6d8bcf73a7688561af`;
plan `1f8d1f977815d71a98e5366f1b6112899f7b54cd5a80c3897d387a72ac52f78f`.
Source and native dependency preflight passed without guest execution; receipts
in `scratch/runs/20261019-army-men-movement-preflight`. Pure JS mocked movement
ordering/release tests pass, including failed down acknowledgement and wait.
Only `--trace-input` remains; broad file/audio/API traces are removed. All
60/75/90s, 4MiB log, 28MiB output, 512MiB transient and disk guards remain.

After separate grant, unique controller command:
`node /home/user/army-men-local-stage-v9-20261019/controller.js /home/user/army-men-local-stage-v9-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-movement-v1 --root-runtime-granted`.
Review first menu image, ordinary BootCamp click, then review BootCamp scene.
Only then invoke staged `army-men-movement-plan.js BUNDLE OUT --bootcamp-visually-reviewed`.
It records before frame, Numpad8 down, 750ms wall hold, keyup, after frame and
snapshot. Actual command acknowledgements are retained; 750ms is host time,
not claimed guest elapsed time. A finally block releases after failed down
acknowledgement/wait, and command failure requests ordinary quit. Controller
deadlines remain the outer guarantee if control delivery fails. A preexisting
movement receipt refuses repeat input. No menu coordinate or sign dismissal
is automated. Compare reviewed frames before any movement claim; stop and quit
after this one sequence. Original readme SHA256:
`751885d6cd7f5da91dd260413d0efbef42a881c0d09b84704992cc289045ad47`.

V9 movement-v1 was granted, but the exact controller refused initial fresh
disk admission at line28, exit1, before creating its evidence directory or
spawning any child. No movement/menu input occurred and no retry was made.
The guard remains free>2847932416. The assertion does not record its exact
failed sample; `scratch/runs/20261019-army-men-movement-v1/admission-failure.json`
records a separate subsequent statfs observation, not the failed instant.
This is an admission refusal, not an original-game compatibility result.

### V9 movement-v2: control response, rendering qualification remains partial

Root launched the identical sealed controller after fresh admission in unique
movement-v2, session44277/controller2919475/guest2920162. Reviewed actual menu,
clicked BootCamp320,180 at2628, and reviewed settled welcome/terrain before
input. Numpad8 down104 at3510 and up104 at3548 were acknowledged. Before3505
shows Welcome; after3552 shows Obstacle Course instructions. This supports
control-driven proximity/scene progression, but the overlay obscures Sarge
and the surrounding scene becomes vertically striped. No clean visible
soldier movement or correct terrain rendering claim is made. Root separately
reviewed both images and agrees this result is partial.

Normal quit0, no guards, minfree2260598784, all1600input pins unchanged,
survivors[] and both PIDs freshly absent. Rawlog499913bytes (reduced trace);
20artifacts2483001bytes before manifest, retained at
`scratch/runs/20261019-army-men-movement-v2`, manifest
`735697be9e720943ab28f923158b2a494e460c9c6cec28f94bb573f159321113`.
V1 refusal remains separate. Historical runtime and Finish-unobserved limits
remain unchanged. No additional input or retry was sent.

Next source-only plan: another separately granted ordinary scene observation
can use documented Numpad4/6 turning and Numpad8 forward to leave sign proximity,
with explicit releases and a frame after each bounded input. Readme and the
observed obstacle sign agree on those controls. Do not use arbitrary dismiss
keys. Determine whether stripes persist with the sign absent; if it remains
obscured or corrupted, preserve that result rather than declaring gameplay.

### V10 sign-exit readiness (source only)

New immutable `/home/user/army-men-local-stage-v10-20261019` preserves V9 and
all original/runtime inputs, with1597hardlinks and282624addedallocatedbytes.
Manifest `f569a85008b17bb46a5f8555ec1b98ac73495768229adc169f664be361d3e099`;
controller `899094eab4573684050e36e736169d492007a6b244b1be79021c341e32c284f8`;
helper `e67dbf2fd24d6d1b56429859c82d9ac27eeef84f3b10ca01f1f9e4b939fb6883`.
Source95/statics39 and native5 closure preflights pass (no guest execution),
receipts `scratch/runs/20261019-army-men-sign-exit-preflight`. Pure JS tests
exercise both steps, down/wait/release failures, and actual extracted admission
expression at threshold-1/equal/+1. Both admission assertions now report the
numeric sampled free bytes, strict threshold and reserves in the error.
All thresholds, pins, output and time limits remain unchanged.

After a separate grant, unique command:
`node /home/user/army-men-local-stage-v10-20261019/controller.js /home/user/army-men-local-stage-v10-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-sign-exit-v1 --root-runtime-granted`.
Visually review normal menu and BootCamp first. Invoke staged helper with
`BUNDLE OUT turn --scene-visually-reviewed` for documented Numpad6/VK102 right
turn250ms wall time. It releases and captures a frame. Inspect that frame,
then only if appropriate invoke `BUNDLE OUT forward --scene-visually-reviewed`
for documented Numpad8/VK104 forward750ms, again release/frame/snapshot.
Forward requires a successfully released turn receipt; each step refuses a
repeat. No automatic second step, sign-dismiss key or extra control is sent.
Stop at first failure or after the one two-step observation. Assess whether
the sign clears and terrain/soldier are visible without stripes; input
acknowledgements alone still do not prove correct gameplay.

V10 remote staging: temporary boat `bx_rqnkhrnr`, same absolute bundle path,
was populated through the independently documented Files API
https://docs.boat.dev/api/reference/agent/create-upload-url (POST upload-url,
then raw PUT), using only the existing configured CLI token. No SSH, credential
change, public host or exec-encoded binary transfer. The initial mistakenly
composed URL returned404; the official /api/v1 route returned200, upload200.
Signed URL remained private and was removed after use. A source-only archive
admission first refused before writing; later freshfree2916249600 allowed
compression. Archive51202502bytes SHA256
`1aaacf4e31524305dc3aa668b2e47740fe15251cc495ab8a5fc4d9fec3cb8643`.
Remote command `cmd_zukrwo62mihp` verified archive, extracted absent-only path
and rehashed all1600entries, changed[], exact f569a850 manifest. Free remote
49151197184bytes; extracted bundle140560KiB, Nodev24.18.1. Remote archive
retained; redundant local transfer archive hash-verified then removed, all
local bundles unchanged. Runtime output parent directory was prepared. No
guest, native preflight, build or runtime executed. Same reviewed controller
command above is ready on this boat, pending sole-runtime allocation. Boat
expiry reported by root03:05UTC; do not assume availability after expiry.

### V10 remote original: sign clears, terrain rendering failure persists

Granted command `cmd_fnsqfnms0l2a`, controller18694/guest19384 on bx_rqnkhrnr.
Reviewed menu then normal BootCamp320,180 at2268; reviewed welcome scene before
Numpad6 turn. Key102 down2996/up3021, frame3025: welcome overlay disappears,
Sarge and HUD are visible, but severe diagonal striping spans the terrain.
Root independently reviewed the frame. Stopped at this meaningful failure;
forward was NOT sent. This establishes a visible control response and persistent
rendering defect outside the sign, not clean gameplay qualification.

Normal quit0, no guards, rawlog449547bytes, minfree49145659392, all1600pins
unchanged, survivors[], fresh ps bothPIDs absent (`cmd_fzuwo5rhi0ag`). Evidence
recovered with documented download-url+GET API, archive1483489bytes SHA256
`b0439c2539e7eb2ce9f0cf42d7b5c36f2b7ece72150f8971975295d7318eea2c`,
verified before extraction locally to
`scratch/runs/20261019-army-men-sign-exit-remote-v1`. Historical runtime and
Finish-unobserved qualifications retained. Runtime released; no retry.
Next source-only work must identify the actual rendering/API path from existing
logs/source before testing any overlap-scroll/pitch hypothesis; screenshot
appearance alone does not justify a renderer patch.

### Rendering attribution and bounded next trace, source only

The original PE imports DDRAW.dll!DirectDrawCreate and GDI32!StretchBlt.
V10's input-only log contains no surface/Blt/pitch records, so it cannot
identify which operation produced the corruption. Inspect the historical
V10 source, not the newer main Surface implementation: DirectDraw Blt starts
at src/09a8-handlers-directx.wat4999, BltFast5764, Lock6575. BltFast's unkeyed
path copies rows in increasing order with `$memcpy`; the helper uses WASM
memory.copy (overlap-safe within one row). Cross-row overlap remains a
hypothesis requiring actual same-surface source/destination rectangles. The
keyed helper preserves a forward scalar loop for overlapping rows. StretchBlt
uses GDI surface descriptors and its separate blit path (09a4 line3003).
None of these source observations yet connects the original turn to a defect.

Historical runner --trace-dx supplies decoded rectangles/surface metadata,
but it also enables host Lock/Unlock/Present tracing from startup. The
trace-api pause control does NOT gate this category; only a static batch
window gates it. Turning that broad flag on would not honor a live reviewed
turn boundary. The next first discriminator therefore uses only selected
--trace-api-paused entries for Blt/BltFast/Lock/Unlock/Flip, StretchBlt/BitBlt,
and unresolved <ord>. COM dispatch normally resolves ordinal IDs to names
before filtering. The helper enables API tracing, sends documented250ms
Numpad6, releases, pauses tracing, then captures after-frame/snapshot. It
attempts pause even after enable/input/release failure and ordinary quit on
failure. No extra movement, host trace, surface export or guest patch.

API memory specs capture receiver/source wrapper bytes and RECTs at entry.
Important limits: Lock's entry DDSURFACEDESC is not its returned pitch; the
historical table has nargs5/no typed-out descriptors for these COM methods,
so BltFast's sixth flags argument is not promised by the ordinary formatter.
This first trace discriminates actual API path and same-surface rectangle
relationship; it must not claim full DX metadata or correct pitch. A native
body bypassing logged entry points remains unobserved. Raw startup leakage
and all raw output are preserved, not silently filtered. Same4MiB log/28MiB
output and60/75/90 guards stop any unexpected volume; expected call count is
unknown before measurement, and trace overhead may alter progress rate.

New `army-men-render-trace-plan.js` and matching controller are source-only,
not yet staged/launched. Tests execute the actual historical memory-spec
parser and trace-api control handler with synthetic state, verify all named
API entries, and exercise normal/error cleanup ordering. Tests PASS with no
guest/WASM/Worker execution. Original V10 consumer and evidence remain intact.

V11 staged source-only beside V10, both locally and on bx_rqnkhrnr at
`/home/user/army-men-local-stage-v11-20261019`. Manifest
`16b731e683d2033c597de880fa8afeb38425705003a61a37d6133bd30713d8ac`;
controller `ae395ad1cc656e36a39d149b5e9f137d3f75bee87f60a2e700c82e20a595d2ea`;
helper `c9c644e2da1721bfaeea2035db245208e20e848cc8daa62981016392c8e9fa21`.
All1600hashes match,1597hardlinks and282624allocated new bytes excluding
directory metadata; V10 pins verified before/after. Only three source files
were uploaded via independent Files API (archive4898bytes,
SHA16277a2a2e3cca36d440b17b6b3ef9ef2f39e7ff149025d35e89f6687b581d61).
Remote staging cmd_nfdbaitmy4ix and verification cmd_prqdp5mxwxbc passed;
free48769445888, output parent present, unique output absent and port8143
not listening at02:48:24UTC. Recheck port/admission at allocation; Dungeon
owns next runtime slot. No guest/native preflight/runtime was launched.

After grant only:
`node /home/user/army-men-local-stage-v11-20261019/controller.js /home/user/army-men-local-stage-v11-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-render-trace-remote-v1 --root-runtime-granted`.
After observed menu/BootCamp, invoke staged helper
`army-men-render-trace-plan.js BUNDLE OUT turn --scene-visually-reviewed`.
No forward step. Capture, normal quit, retrieve raw evidence and inspect the
actual selected API/RECT records before attributing or fixing terrain damage.

### V11 terminal startup log-cap, no turn observation

Granted remote cmd_kx6fdilkaxly/controller26947/guest27636 passed1600pins,
free48743530496 and port8143 clear. It hit the unchanged4MiB log cap after
4.8seconds, before first screenshot request or any menu/turn/helper input.
SIGKILL/log-cap, received4205278bytes; retained raw4194296bytes, with the
over-cap tail intentionally not retained by the existing guard. No trace-api
toggle markers. Startup trace contains5324Blt,688Lock,687Unlock,3Flip entries;
these do not establish the turn's rendering path. Pins unchanged, survivors[],
minfree48739008512. Fresh ps/controller+child and port8143 clear confirmed in
cmd_xmtr20m9gc87. No retry. First later screenshot request correctly failed
ECONNREFUSED and download404; no image existed.

All13artifacts4488519bytes recovered through documented Files API to
`scratch/runs/20261019-army-men-render-trace-remote-v1`, sealed manifest
`1d98026eb9f5d7e96e6e10d1e67426060c559de359c134065529c5d04098773a`.
Archive152544bytes SHA4deef68d28a65b90af85b1882d59ff70a3817eb4207495f6a55b4a6195aa8e00.
Exact tracing defect found in both historical/current runner: initial
apiLogOff predicate ends `!TRACE_API_MEM.length`, so memory specs defeat
TRACE_API_PAUSED and leave the WAT logger on. COM dispatch itself correctly
checks api_log_on and resolves ordinal names. The prior parser/toggle mocks
did not exercise this initial predicate interaction; new regression must.
No renderer change or original-game result follows from this failed trace.
