# FIFA 98: Road to World Cup demo

Recovery and first bounded startup, 2026-10-15, task
`USER-FIFA-DEMO-20261012`, owner `/root/new_game_refill_after_lords`.
Attract-mode rendering observed; player-controlled gameplay remains unverified.

## Original package and eligibility

Existing corpus entry `fifa98-demo` records the original Windows demo:
`https://archive.org/download/FIFAWC98/FIFAWC98.zip`, archive SHA-1
`922b626954495cc441cbe9bd9f88f6727bdf69ac`. The historical board records
16,109,580 archive bytes. The archive is not present in this checkout and its
hash was not reverified today. Recovery uses the existing corpus fetcher on a
granted remote host: `node tools/fetch-candidate-corpus.js --id=fifa98-demo`.
Do not download on the coordinator host.

The ready-to-run original tree is
`test/binaries/candidates/fifa98-demo/installed/fifa98`. The committed
[inventory](../fixtures/fifa98-demo-inventory.json) pins all 231 observed files,
23,411,290 bytes, including `FIFARTWC.EXE` (1,436,160 bytes), `EACSND.DLL`,
`UK.SKU`, and complete AUDIO/COMMON/FEPACK/INGAME trees. Both executable and
DLL pass PE32/i386 signatures. The existing browser manifest has 230 payload
entries; the registry supplies the executable separately. Their union exactly
matches the tree. No README, text licence, or installer exists in this tree.
The existing corpus licence classification remains proprietary, local-only,
with no redistribution grant; no publication is authorized.

The October 12 w4 claim is historical. Root explicitly reassigned it after the
Claude fleet stopped; prior WIP was untouched. Registration recovery commit
`949333e1f4e7f71d1461c7f774f4b0ba21d11827` expressly states no new gameplay
qualification. Audit of current `DESKTOP_APPS`, TODOS, full-text board,
reverse notes and retained run filenames found no FIFA 98 gameplay evidence.
It is absent from the public desktop list. This is an eligible unqualified
Windows demo, distinct from the separately requested console FIFA Street.

## Repeatable read-only preflight

```sh
node tools/fifa98-preflight.js /absolute/path/to/test/binaries/candidates/fifa98-demo
```

This reads and hashes the original files, rejects missing/extra files,
symlinks, duplicate paths, inconsistent VFS paths and size/PE mismatches, then
compares every byte hash with the committed inventory. It neither modifies
the fixture nor launches anything. `--inventory` prints an inspection report;
it is not permission to replace the committed original pins after a mismatch.
Manifest SHA-256:
`31400c955692e4323ae363a895d2e53879a596eb868ee1640e918334fe4ad909`.

## Next serialized runtime action

No runtime was granted to this lane. On the next coordinator grant, inventory
the remote candidate first and reuse it only if the full preflight matches.
If absent, transfer the pinned original tree and existing manifest or recover
from the corpus recipe; verify hashes before launch. Keep all runtime work on
the designated temporary box with independent idle/resource checks.

The existing private app `fifa98_demo` launches original `FIFARTWC.EXE` with
working directory `c:\fifa98` and guest EXE path
`c:\fifa98\FIFARTWC.EXE`; `requiredFiles` is true. Use the registered app,
not a bare EXE with missing assets. First bounded startup command:

```sh
node test/run.js --app=fifa98_demo --no-build --wasm=/home/user/wa-fifa98-startup/build/wine-assembly.wasm --quiet-api --max-seconds=90 --max-batches=6000 --batch-size=100000 --png=scratch/runs/UNIQUE-FIFA98-RUN/startup.png
```

The outer remote controller must preserve stdout/stderr, exit status, actual
source/WASM hashes, manifest/fixture identity and environment in that run's
folder. This first command deliberately sends no input: capture the actual
startup checkpoint before selecting controls. Inspect any original licence
screen and stop for the existing user decision policy rather than accepting
it. A runtime contract failure is a concrete blocker to report, not permission
to change guest state or bypass it.

After an ordinary menu is visible, read its controls/options and use ordinary
clicks/keys to start a match. Exact menu coordinates and player controls are
unknown; do not prelabel guessed inputs as pass/shoot/sprint. Require a live
pitch/HUD, an identifiable controlled player or ball responding to input, an
idle comparison, then a second input response. Save before/after captures and
input receipts; distinguish AI motion or camera changes from player control.
Only then add verified touch controls and record reviewed match gameplay.
Record FPS separately if measured. Startup/menu screenshots cannot complete
this task. Publish `result.json` last using the ops evidence schema and exact
candidate ID `fifa98-demo`; no fixture or bulk screenshots enter Git.

## Validation

Source preparation passed original 231-file hash/manifest/PE validation and
JavaScript syntax checks. No build, browser, VM, install, media download,
remote execution, or gameplay capture occurred. Runtime compatibility and
ordinary menu/input routes remain unknown.

## Prepared remote controller

`tools/fifa98-remote-startup.js` pins source
`7405b3f4803855e6d2e25506c74afab0d2184af9`, the actual build source of admitted
module `04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`.
It creates its own `/home/user/wa-fifa98-startup` checkout from the remote IW
donor, never changes the donor, and uses that source's region-map mirror.
Every physical source file is checked against `git ls-tree -r SOURCE` before
and after launch, independently of the mutable index. All six retained donor
modules (937/a948/04ede/0dbf/e26/ca90) are hash-checked before preparation and
before/after execution, including the NE arena module at
`/home/user/wa-ne-arena-native/build/wine-assembly.wasm`. Dependencies reuse
the Darkstone node_modules tree; all 2,394 file hashes are checked against its
retained preflight receipt, itself pinned to SHA-256
`52d6d80b272fa670ef0a6c781bb4f3e7d8484d333bf0b2199a9ed106178faa30`.
No dependency installation or compilation is permitted by this controller.

Stage the three tools and committed inventory with relative layout preserved
under a separate controller directory, using scoped Boat exec/file APIs only.
After the root grant and independent idle/TTL check:

1. Run `node tools/fifa98-remote-startup.js --prepare` on the remote box. It
   refuses an existing destination, checks the admitted donor module, creates
   the exact source checkout and copies that module. No game runs here.
2. On the coordinator, `node tools/fifa98-transfer-fixture.js FIXTURE_ROOT`
   is a local plan only. With a transfer grant, append `--upload`: it uses
   `/home/user/.ascii/boat exec bx_9ef2wdsw` and explicit Node file operations
   to copy the 232 pinned files (231 payload files plus browser manifest).
   Chunks are bounded at 48 KB, final file hashes are verified, matching files
   are reused and mismatches stop without overwrite. Interrupted partial files
   remain visible for review rather than being silently replaced.
3. Run `node tools/fifa98-remote-startup.js` remotely under an outer
   `setsid --wait timeout 180s` envelope. It refuses pre-existing evidence,
   verifies idle/source/module/dependencies/fixture/free-space, then launches
   the registered game with explicit `--no-build --wasm=...`, a 90-second CLI
   guard and 120-second process-group timeout. The child starts in its own
   process group; its exact PID/PGID and terminal status are retained. Timeout
   or controller termination sends group SIGTERM, then SIGKILL after three
   seconds. Normal parent exit also cleans up surviving group descendants,
   with a bounded final process-group census. Independent idle is still
   required before releasing the lane. Inherited WINE/WA/NODE runner overrides
   are cleared and the matching region map is explicit. No inputs are sent.
4. Run `--postflight` in a separate remote invocation after the controller
   terminates. Recover `/home/user/fifa98-startup-evidence-1` before releasing
   the slot; inspect startup PNG/log and retain terminal failures. Publish ops
   `result.json` only after review. The controller leaves review pending.

Source checks passed JavaScript syntax, plan-only original inventory, and an
actual execution of the transfer helper with the Boat API mocked to isolated
temporary files: all 232 files transferred identically across multiple chunks,
the second pass reused them, and a changed existing file stopped transfer.
Actual small Node subprocess tests additionally passed normal exit-status
preservation, timeout of a TERM-resistant parent/descendant group, and cleanup
of a surviving descendant after normal parent exit. A mocked immutable-tree
test accepted original source and rejected changed physical bytes without
consulting the index.
No remote preparation or launch has occurred. Root must approve this immutable
controller revision before granting execution; a source-prepared route is not
an admitted live run.

## First startup receipt: attract-mode match, no input

Root granted controller revision `dc4b89b4db97ddf50124c3f076d0ad2f5ce255db`.
The staged controller SHA-256 was
`f37f3bc4e4f3dd3c771725129fd5025d4abe05dc683640a55c786975fcb9ac7e`.
The existing original fixture was transferred with the reviewed scoped Boat
exec helper; all 232 files including its manifest matched their pins. No
download, installer, licence choice or guest modification occurred.

Remote wrapper PID **277353** started at **17:06:08.133 UTC**. Controller
277358 launched CLI PID/PGID **277368** from the exact 7405 source with admitted
04ede module and matching map. It stopped normally at its 90-second guard:
1129 batches in 90.777 seconds, terminal status 0, no signal or forced cleanup.
Final terminal timestamp **17:07:39.786 UTC**. No input was sent.

Reviewed `startup.png` is a 640×480 rendered stadium/pitch, England 0 / Italy 0
at 00:00, “Tele Cam” and **“Demo Match”**, with officials running onto the
pitch. This is attract-mode match presentation. It is neither a menu nor
evidence of player control, and does not qualify the new-game lane. There is
no measured FPS. The log reports the Glide software backend, but this capture
does not independently qualify the rendering backend. The log also reports
554 abandoned critical-section parks; this is a retained counter, not an
established failure diagnosis.

Independent postflight at **17:07:56.250 UTC** passed: no active runtime
processes; all **6620 immutable source files**, **2394 dependencies**, **231
fixture files** and **six donor module hashes** unchanged. The runtime slot
was released. The local 60-second attach client timed out while the detached
run continued normally; subsequent terminal receipt proves its exit. Git
reported alternate-object-store nesting warnings, but immutable tree/physical
file checks passed before and after the run.

Recovered evidence:
`scratch/runs/20261015-fifa98-startup/evidence.tar.gz`, **1,845,227 bytes**,
SHA-256 `8603a25c34274f2b98eca81076631484c89a7854853860be52cd7d53c3fdabb1`.
All ten archived artifact hashes verified locally before image review.
Screenshot SHA-256:
`20a19e12a83a97f4f4703acf88c1635392f79966330e5d3a604fa1fa1f12475b`.
Run metadata labels this `startup-attract-demo`, with `gameplayQualified:false`.
The ops evidence checker found no invalid metadata or missing artifacts; its
sole containment failure is the pre-existing unrelated October 2 Zuma run.

Next action: prepare one ordinary key/menu observation to leave attract mode,
then inspect the resulting original controls/menu before selecting a match or
claiming player response. Exact menu route remains unknown. No input follow-up
was granted or executed as part of this startup receipt.

## Persistent browser/menu preparation after startup

Original `COMMON/FCENG.BIN` contains “Demo Match” at file offset `0x3b31`,
“Pause Menu” at `0x6407` and `0x6412`, and “Resume Match” at `0x6def`.
These are original interface labels, not keyboard bindings. The bundle has
no README or keyboard instruction document. The original executable's input
imports and message dispatcher were inspected, but that audit did not
establish a game-action mapping and supplies no reason to alter guest state.

The authored [Eric Dysinger FIFA 98 FAQ v1.02](https://www.cheatcodes.com/guide/faq-fifa-road-to-the-world-cup-98-pc-11899/),
sections 2 and 8, documents Escape for the pause menu, 1 for controller
selection, arrows for running, S for passing, D for shooting, A for lobbing,
and W for sprinting. This is an external PC guide, **not bundled instructions
or proof of this demo's behavior**. It supports one ordinary Escape observation
after the attract scene is re-reviewed; the actual demo response must be
inspected before further controls are used.

`tools/fifa98-browser-checkpoint.js` prepares a persistent, private browser
session without changing any file in the 7405 production checkout. It shares
the admitted source/module/fixture/dependency preflight, additionally pins the
Chrome files, and checks the actual HTTP module plus all 232 fixture paths.
The WebAssembly compile observer records the module object owned by `wine`;
its identity must equal 04ede before queued input is sent.

The helper derives a separate probe overlay from immutable Darkstone helper
commit `fc435473c71e7e5e7890b15482e6ecfe69048535`, verified against SHA-256
`f50ddeb743b8596da508c84f1abc0262ee9e1b22317fc106c259d8ac390ca973`.
Its only textual change adds ordinary `KeyS/KeyD/KeyA/KeyW/Digit1` to the
existing queue whitelist. Count, time, screenshot-containment and input
validation remain intact; raw commands and arbitrary queued eval are rejected.
The read-only renderer observer is separately pinned. The server is loopback
only on port 8321. Browser/source helpers are separate from the tested checkout.

Initial steps send **no input**: wait 90 seconds, capture `idle-a.png`, wait
three seconds, capture `idle-b.png`, then attest the owning module. The
420-second ordinary-input queue remains available so successive clearly
visible menus can be inspected without restarting the game. The browser
process group has a 480-second bound; use an outer `setsid --wait timeout 520s`
envelope. Server and browser groups have bounded TERM/KILL cleanup. The
controller may finish normally via `{ "quit": true }` in the next numbered
queue file; retain independent idle/postflight checks afterward.

After reviewing both idle captures and the actual module readout, the first
proposed command is one Escape press held 500 ms, release, a three-second
wait, and a fresh `escape-menu.png`. Inspect that result. Root authorized
autonomous ordinary visible match/controller/menu navigation within the
bounded session; that does not authorize unseen key sequences, licence
acceptance, or guessing hidden controls. Pause for review if any licence
choice appears. Input receipts and fresh screenshots remain mandatory.

For eventual gameplay evidence, first select a clearly identified human
controller through the original UI and reach a normal match. Capture an idle
interval, a held direction, a release interval, then the opposite direction
with the same identifiable player/ball. A changed animation or camera alone
does not count. Verify a pass or shot only after the actual controls match the
guide/UI. Keep this prospective route separate from the completed no-input
attract receipt; no browser or player-control claim has yet been made.

Preparation checks passed exact-base overlay verification, all permitted
ordinary keys and quit, rejection of raw/eval/F11/outside screenshots/too many
steps/excessive waits, initial no-input plan, JavaScript syntax and whitespace.
Only source preparation occurred after release of PID277353.

## Browser menu receipt, 2026-10-15

Controller commit 8119f6d1f4c9b17125e50a22be748970011376be ran in the
private persistent browser under wrapper PID 287054, probe PID/PGID 287083.
Fresh admission at 17:19:28 verified immutable 7405 source, dependencies,
original fixture, Chrome and all seven preserved modules. The owning browser
module was 04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17
(1,803,941 bytes). Actual outer bound was 650 seconds, child bound 480 seconds.

Two initial no-input captures showed the automated Demo Match advancing.
Queue 0 Escape opened Main Menu. Visible clicks then selected Match Select,
Friendly, and the team-selection checkmark (England versus Italy). Controller
Select showed four blank rows with left/right arrows, no named controller and
no visible continuation checkmark. One first-row left-arrow click and one
Enter press did not visibly assign a controller or advance. This establishes
ordinary menu input response, **not player-controlled gameplay**. Blank rows
alone do not establish failed device enumeration; source diagnosis remains.
Queue receipts 0 through 5 record those actions; queue 6 requested normal quit.
No licence choice, guest-memory write or engine change occurred.

Probe exited 0 at 17:25:37.992Z with no surviving group processes. Wrapper
287054 exited 0. Independent postflight at 17:25:54.287Z passed idle, immutable
source/dependency/fixture/seven-module pins and browser/helper identity.
Evidence is retained locally in scratch/runs/20261015-fifa98-browser and
remotely in /home/user/fifa98-browser-evidence-1. Recovery archive
/home/user/fifa98-browser-evidence-1.tar.gz is 4,661,792 bytes, SHA-256
2b2253fba1d3aacd754353807832f20c65b8b7a6f971220abf5b3c5d15516832.
It includes all menu captures, ordinary-input receipts, module identity, logs,
terminal and both postflights; artifact-hashes.json enumerates 38 artifacts.

Next step: inspect retained API/log evidence and original controller assets
before proposing another bounded ordinary observation or a semantic API fix.
No additional runtime is authorized by this report.

## Controller selection source audit and proposed observation

The retained console confirms Enter keydown/keyup (0x0d) and the menu mouse
messages reached the guest. Its four HTTP 404s name only build-info.js and
favicon.ico. Asset-cache messages stringify as [object Object], so this log
cannot prove which original controller sprites were decoded. Original
FEPACK/FCONTROL, CONTAROS and IGCNTROL ALL/PAK files are present and pinned;
IGCNTROL's compressed bytes include a keyb resource marker, not evidence of
its successful decoding. FCENG.BIN includes console-platform text as well as
PC labels; do not infer PC controls from all its strings.

The original PE's static imports include GetAsyncKeyState, GetKeyState,
GetKeyboardType and WinMM joyGetNumDevs/joyGetDevCapsA/joyGetPosEx. There is
no static DirectInput import (dynamic resolution remains possible). The
GetKeyboardType calls at guest VA 0x457c95/0x457ca0 only select a Japanese
layout for type7/subtype0xd01..0xd04. Admitted7405 returns enhanced type4 for
flag0; the call does not test whether a keyboard is attached.

Controller initialization at 0x4340a8 builds lists at 0x58d1cc and 0x58d1e8.
At 0x434141..0x43416c it inserts record0x58d204 with byte4=1/byte6=1 and
sets count0x58d1c1=1, before calling joystick discovery at0x4341e4. It also
adds a second type2 record after0x46f5c4, whose original body returns1.
Those record-type meanings are inferred, not proven controller identities.
The WinMM path at0x492f80 stores joyGetNumDevs in0x5ccfa0 and returns it;
zero skips its joystick loop. Zero joysticks alone cannot explain all rows
being empty, and no API change is justified.

Assignment moves records between the two lists: 0x433cb8 searches an
unassigned slot, and0x433d0c/0x433d1a transfer its selected record from
0x58d1e8 to0x58d1cc. The0x433f1c path compares available slot/list counts
and fills slot record pointers before iterating callbacks. These paths
prove additional assignment state exists, but static inspection has not yet
identified the ControllerSelect rendering/activation caller or actual live
list contents. Existing disassembly is retained as controller-source-disassembly.txt
in the recovered local run.

Proposed narrow observer tools/fifa98-controller-state.js reads980 bytes
from those source-derived guest records/lists plus joystick count. It first
requires the owning04ede module, imagebase0x400000, and exact initializer
bytes at0x434141; every guest byte uses the host's guest-address translator.
It performs no guest write, import wrapping, timer, pause or input. A changing
shared-memory snapshot is explicitly not atomic. Unit checks verify read
bounds, unchanged memory, and rejection of wrong module/signature/unmapped
addresses. This observer has **not been enabled in a controller or executed
on the remote original**.

Candidate next run, after source review and a new runtime grant: same pinned
browser/source/module, capture this snapshot once at MainMenu and once at
ControllerSelect, alongside existing screenshots and unchanged ordinary
menu route. Compare init/count/list headers and slot pointers; retain exact
bytes for source interpretation. If records exist and slots are assigned,
follow presentation/assets; if initialized records never reach the lists,
follow initialization/list operations. Do not fabricate devices or force
assignment. Additional input requires a documented activation handler or
clearly visible usable control.

## Reviewed-route controller-state capture preparation

tools/fifa98-controller-checkpoint.js is a separate source-only controller.
It uses fresh /home/user/fifa98-controller-evidence-1 and
/home/user/fifa98-controller-helper-1 directories and refuses overwrites.
It keeps immutable7405/04ede, seven donor checks, all fixture/dependency/Chrome
pins, private8321, the480-second child and independent postflight requirement.
Initial90-second/3-second captures remain input-free. The actual owning module
and initial scene must be reviewed before submitting commands.

reviewed-route.json records exactly five queue entries: Escape/main-menu
screenshot/state sample; MatchSelect click0.22,0.145; Friendly click0.84,0.295;
team checkmark0.952,0.825/controller screenshot/state sample; quit. Submit
numbered entries only after the corresponding scene matches the reviewed
route. There are no controller-arrow, Enter, Digit1 or gameplay inputs.
The original probe key whitelist is retained. Its sole overlay change adds
one exact evalfile path for the pinned safe observer. The observer's wrapper
catches exceptions and labels every sample nonAtomic; malformed receipts or
missing/failed samples are explicit in controller-state-samples.json. They
do not prevent normal process cleanup or imply a negative device finding.

Pending root runtime grant, stage the following exact files in a new
/home/user/fifa98-controller-capture-v1 helper tree, preserving relative paths
and refusing differing existing files. Hashes:

- tools/fifa98-controller-checkpoint.js: 1c825986e0b33e68d151ec6759dbd226648f4543acfba27d1985528d76a2c67f
- tools/fifa98-controller-state.js: 02eb7b1cfb13b62c0929b0354898f1e568e66203d95c151f5bfc0904436da282
- tools/fifa98-remote-startup.js: 133ae513de4b08daccd2f69d7fa9c0ec5baf37108742f518bbccdb3a87fcb5ce
- tools/fifa98-preflight.js: 5e4b68eaa4a1f3fb5b215398fd5d9d74bf415b05c2113c4b629fbc1bcf438bdc
- docs/fixtures/fifa98-demo-inventory.json: 5a7a2cb7bcd23bc3e5a31df9fec649c611d737599d2a9893c711d2735daaadab

Launch via scoped Boat exec only:

```text
boat exec bx_9ef2wdsw --detach -- setsid --wait timeout 650s node /home/user/fifa98-controller-capture-v1/tools/fifa98-controller-checkpoint.js
```

No build is invoked; only the admitted module is served, HTTP-hashed and
attested against the owning WebAssembly module. After terminal, independently
call this helper's exported startup preflight, verify all Chrome/probe/state
and wrapper hashes, preserve a new postflight receipt, and recover the whole
evidence directory plus archive hashes before releasing the runtime.

Tests: controller wiring uses the actual immutable probe validator, confirms
exact route/two snapshot positions and initial no-input, rejects changed
source hashes and unauthorized eval paths/keys/excessive waits/counts, and
executes the safe wrapper's missing-identity/throw paths. The raw observer
tests verify980-byte bounds, unchanged memory and mapping/signature rejection.
No remote staging, launch or guest observation occurred during preparation.

Environment correction: the private server and browser probe now share one
filtered environment object. Both strip WINE_*/WA_*, NODE_OPTIONS and
NODE_PATH and use the pinned Chrome path. The staging manifest above reflects
the corrected controller hash; no remote files have been staged.

## Controller-state capture receipt, 2026-10-15

Exact e5c7a2f720b32bb9b330df2e3d9a9b2204370e75 controller ran under
wrapper307000 at17:46:35.019Z; probe307029 exited0 at17:49:57.358Z.
Owningmodule04ede was attested before ordinary input. Each current screenshot
was reviewed before the next approved route entry: Escape/MainMenu,
MatchSelect, Friendly, team checkmark/ControllerSelect. Queue4 quit normally;
no controller-arrow/Enter/Digit1 or other additional input was sent.

Both980-byte snapshots passed module/imagebase/originalcode guards and are
explicitly nonAtomic. At both MainMenu and ControllerSelect, init=1 and
recordCount=2; the available list has count2/head0x58d204/tail0x58d210.
The linked records retain tags/subtypes1/1 and2/2, ordinal0/1; joystickcount0.
The assigned list count remains0. In mode0, slot pointers change from all0
to[0x58d204,0x58d210,0,0], while assignedcount0/unassignedcount4 persist.
Other modes retain zero slot pointers. Thus initialized records exist and
reach menu slot pointers. Missing enumeration alone cannot explain the
blank rows; no joystick API change is justified. These bytes do not prove
record meanings, presentation correctness or player assignment.

Reviewed ControllerSelect screenshot remains four blank rows with paired
arrows and no continuation button (SHA-256
f5b2e9ab3863754f4e0e0ce5d94a824ab24c31c27a81ba8332a4b4a3e280541b).
Next source work follows the presentation/activation consumer of those slots
to distinguish eligibility from omitted icon/resource rendering. Do not infer
that an invisible populated row authorizes a guessed control.

Independent17:50:16.560Z postflight passed active[], immutable7405 source,
dependencies, fixture, all seven prior donor modules, Chrome and helper pins.
It additionally verified Outlaws wa-ne-invoke-native module d6187fedf42d5973
and Darkstone wa-darkstone-paired module9b57583c1ca8887f, all6644 Darkstone
source rows plus generated map/build artifacts, and108 retained evidence
files unchanged against fresh admission. Wrapper terminal0 and no surviving
probe group were independently confirmed. Runtime was explicitly released.

Local evidence: scratch/runs/20261015-fifa98-controller. Remote evidence:
/home/user/fifa98-controller-evidence-1. Archive .tar.gz is4,802,204 bytes,
SHA-256 b273b9ce6838c6f16064893b2369a3e9641ec62fb7232ee95373b84d482cfff8,
with36 enumerated artifacts. Raw samples, route/input receipts, captures,
source/pin pre/postflights and interpreted capture-review are retained.
No gameplay, FPS, audio or renderer/backend qualification follows.

## Original horizontal activation gate and prepared follow-up

Original-code proof bytes and hashes are recorded in
fifa98-controller-activation.json against EXE901b23b4. ControllerSelect setup
0x44ce40 calls0x43e928 and connects drawing callbacks0x44d038/0x44cfc0 via
0x43e900. This iterates a separate UI-record list at0x5aef60; available
device records and mode-slot pointers alone do not prove a visible UI record.
The setup changes flags on the named layout objects before these callbacks.

Screen handler0x44cb58 dispatches event0x63 at0x44cd76 through0x43e808 to
0x43e494. When the matching UI record is absent,0x43e6cf extracts the
direction nibble. At0x43e701, test bl,0x0c requires horizontal movement;
otherwise it returns. Passing the gate creates a UI record through0x43e1dc,
then calls assignment0x433cb8 at0x43e793 and invokes drawing callbacks.
The first device's keyboard dispatch table at0x52d70c selects0x433480.
Its original scan table0x52d664 maps0x48/0x50/0x4b/0x4d to1/2/8/4;
the last two are Left/Right arrow scan positions and satisfy the gate.
The poll reads the game's key-state table through0x456794. This is concrete
source support for a horizontal keyboard activation test, not a claim that
the current emulator correctly delivers those states.

The blank idle rows can therefore be consistent with the original waiting
for horizontal keyboard activation. Earlier mouse clicks and Enter did not
exercise this path. A missing-resource/rendering defect is not established,
and no input API or joystick patch is justified by current evidence.

Prepared --assign-left mode keeps the reviewed route and unchanged observer,
but uses fresh /home/user/fifa98-controller-evidence-2 and
/home/user/fifa98-controller-helper-2. After the ControllerSelect before
screenshot and sample, its next proposed command holds ArrowLeft500ms,
releases, waits2s, then captures controller-left.png and the same980-byte
read-only snapshot. The final template command quits. Initial no-input
scene/module verification and review before each menu transition remain.

Root authorized continued ordinary navigation in the same bounded session
if a visible assignment enables continuation. Inspect that screen before
using its actual control. If a normal match is reached, compare idle versus
held/released/opposite arrows on an identifiable player and test guide-backed
S/D only when appropriate. Assignment mode adds only KeyS/KeyD to the
original queue key whitelist; no extra action is prequeued, no blind key
sequence, licence choice or forced assignment is authorized. Queue420s,
child480s and outer650s limits are unchanged. NonAtomic/failed samples stay
explicit; more than the three planned snapshots require review of their
labels rather than treating the exact-count completeness flag as proof.

Pending new runtime grant, stage the same five-file set from this new commit
under /home/user/fifa98-controller-assign-v2. Controller SHA-256:
c166bebd0edcf52ed931f7196b48a203ea4fc58da7336319f487e5aacab2df40
Other four file pins remain those above. Launch:

```text
boat exec bx_9ef2wdsw --detach -- setsid --wait timeout 650s node /home/user/fifa98-controller-assign-v2/tools/fifa98-controller-checkpoint.js --assign-left
```

Fresh admission and independent release must additionally preserve the new
Outlaws d6187 module and Darkstone9b575 source/map/build/evidence, as in the
307000 receipt, plus any later admitted donors. No remote staging or launch
has occurred for this follow-up. Tests cover both modes' actual validators,
fresh paths, exact one-arrow sequence, unchanged observer, initial no-input,
permittedS/D and rejectedA/W/Digit1/F11/foreign eval paths, and all prior
time/path/count/environment guards.

## External preservation preparation for the queued activation run

The reviewed e9f browser controller and its five-file staging set remain
unchanged. tools/fifa98-preserve-external.js is a separate read/hash-only
receipt helper (SHA-256 54b0827e6953a112889170345ad799efffabde7572fab2ce347c3256bda45236). It never launches a process or touches
guest state. Capture accepts hash-pinned JSON manifests, selected array keys,
explicit file pins and evidence/helper directory roots; validates existing
pins before taking a snapshot; hashes symlink targets without following them;
deduplicates identical paths and rejects conflicting pins. Verify rechecks
every captured file and writes a fresh receipt. Source/evidence rows are
bounded to30000 and directory recursion to20. Existing output is never
overwritten. Tests cover manifest/source/symlink tampering and fresh output.

The prior verified external-admission receipt can supply preserved Darkstone
source/map/build/evidence and extra donor rows: remote
/home/user/fifa98-controller-evidence-1/external-admission.json, SHA-256
e31eb3cd257377166619aef9834971270f070edc2c74d3890dbae7ef83acd5c9, keys
extra, darkstoneSource, darkstoneArtifacts, darkstoneEvidence. This is only
the prior baseline. The current corrected locomotion source manifest and
fresh evidence/helper roots must be added from the explicit release receipt
before admission; absence of a running process is not that release. Keep
Outlaws076844/d6187 source/module pins and any later donor receipt current.

A capture configuration has manifests:[{path,sha256,keys:[arrayKey]}],
pins:[{path,sha256}], roots:[absoluteDirectory]. Omitting keys requires the
manifest itself to be an array. Run the separately staged helper with
--capture CONFIG ADMISSION, then --verify ADMISSION POSTFLIGHT after the
normal browser terminal and independent idle check. This preservation check
supplements the controller's immutable source/dependency/fixture/module and
Chrome checks; it does not replace those or attest gameplay. No remote
reads, staging or capture were performed while preparing this helper.

## Original keyboard assignment observed (2026-10-15 18:20 UTC)

Reviewed e9f461 controller with c6e79c external preservation ran as wrapper
323637/probe323682, exact source7405b3f and admitted04ede module. The ordinary
Escape > Match Select > Friendly > team confirmation route reached Controller
Select. One ArrowLeft held500ms and released made a keyboard sprite and
`Config. 1` appear on England's side. Three guarded read-only nonAtomic
samples (MainMenu, ControllerSelect, afterLeft) show global assigned count
0→0→1, mode0 assigned0→0→1 and unassigned4→4→3. Existing keyboard/mouse
slot pointers persisted. This directly supports the original horizontal
activation gate; neither missing enumeration nor missing keyboard artwork
explains the initial blank rows.

One ordinary Enter held100ms and released did not advance after2000ms.
The input log shows VK0x0d delivered. No player-controlled match was reached;
next source work follows the original continuation/confirmation handler.
Do not replace controller state or add enumeration stubs. Samples remain
nonAtomic and establish only the captured fields, not all state transitions.

Probe terminal0 at18:20:58.181, no process-group survivors. Separate
postflight18:21:20.237 found active[] and preserved6620 source,231 fixture,
2394 dependency files, original7 module pins, Chrome/overlay pins and6893
external rows including current Darkstone locomotion evidence and Outlaws
native donor. Recovery verified all43 artifacts. Remote evidence is frozen:
/home/user/fifa98-controller-evidence-2; archive5637101 bytes, SHA-256
abcaed78878554925005d33c4893a6ec9e44865597943b0a6a08b18ed9be6ae7.
Local recovery: scratch/runs/20261015-fifa98-activation (archive, extracted
raw receipts, decoded-samples.json, capture-review.json and result.json).
controller-left.png SHA-256
bc57ed404ed36e62c0f3280d2da65af1a4768f151c2f7b7ccb46b40660584d65;
controller-confirm.png SHA-256
ac3b0b3c0f83d411f61431f8f80b6bcd74417215008a87e7be517b916d56ba26.
