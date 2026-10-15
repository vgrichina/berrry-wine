# Lords of the Realm II original playable Windows demo

2026-10-15 current status: original setup and one Install click executed;
candidate/control/restored validation proves the narrow ownership repair.
One reviewed System Test Yes now reaches a guest-thread crash; no licence
answer, gameplay screenshot or qualification. Initial acquisition-only status is superseded by the dated
runtime evidence below. Owner `/root/new_demo_refill`;
task `NEW-GAME-LORDS2-DEMO-20261015`.

Selected after checking current main `8597f6329` registry, corpus, TODOs,
reverse notes and retained board: no previous Lords II lane or qualification.
AVP2 and Silver already have reviewed movement and were excluded from fresh
qualification. Many other registry titles are local candidates, not public
desktop apps; their presence alone does not exclude them. This selection does
not claim that the entire existing candidate pool is blocked.

## Original media and identity

Source: <https://archive.org/details/LordsoftheRealmII_1020>, original package
<https://archive.org/download/LordsoftheRealmII_1020/lorddemo.zip>.
The [catalogue](https://www.dosgamesarchive.com/file/lords-of-the-realm-ii/lorddemo)
also distinguishes the playable Windows demo from the nonplayable `lords2tr`
trailer. Actual package contents, rather than the catalogue label, establish
the chosen format:

- `lorddemo.zip`: 7,522,232 bytes, SHA1
  `6c5ef78db77389da8ec4a0d54a576a0eb0526a48`, SHA256
  `afef0f0dd7012c46f483ab09d785431ba5813c2080d8468a52e8ec32c745f49d`.
- Outer `lorddemo.exe` is an original DOS ZIP self-extractor, SHA256
  `02845e9043dcb74dfa7016992d5b03ee42fddd63c829f8fcd583f73c8c7aad0e`.
- Its `L2DEMO.EXE` is another ZIP self-extractor, SHA256
  `3429ae27a800e7fbfd341aeac4cb93c29dd495056ac33952aef03af71cd5c35e`.
- Nested distribution: 181 files, 14,382,323 bytes. Complete hashes and executable
  headers: `test/candidate-corpus/lords2-demo-files.json` (relative to `original/`).
- `SETUP.EXE`: NE Windows executable, 31,168 bytes, SHA256
  `c9844241cf6594050cb4cdde5b04d4f994dfa6da83a3c5538dab16e792aa49b7`.
- `FILES/LORDS2.EXE`: PE32/i386, 718,848 bytes, image base `0x400000`, SHA256
  `c83df505c4be850c10425f1770090ba3ca31fa6b87d8bce2cde3c66ae11dd0dc`.

Original README identifies Sierra's demonstration and says to expand with
INSTALL.BAT then run SETUP.EXE. INSTALL.BAT only invokes `L2demo.EXE -d`;
static ZIP extraction retained the same bytes without running either wrapper.
SIERRA.INF says `CanInstallDOS=No`, `WinVer=395`; its original setup copies
FILES into the selected destination and writes program-manager/Windows registry
entries. GAMETIPS.WRI describes the playable six-county map against the Knight,
population management and player-created armies. It is not a cinematic trailer.

The README includes warranty terms. LANGUAGE.INF contains Accept/Decline
strings; this does not establish whether setup will present a licence dialog.
No prompt was executed or answered. Preserve any actual licence prompt and
stop for the existing user decision rule. Do not synthesize installed registry
state or bypass setup based solely on loose FILES availability.

## Recovery and next ordinary route

Remote-only source fixture is `/home/user/lords2-original-20261015` on
`bx_9ef2wdsw`. Local payload was not restored; local free space was 2.25GB.
`tools/acquire-lords2-demo.js` verifies the pinned outer archive; then
`tools/inspect-lords2-demo.js` validates/tests both nested ZIPs and records all
original hashes. Use new destinations; scripts refuse overwriting prior runs.
The generic corpus recipe mirrors those two extraction stages. Its browser
preparation describes the original setup tree, not an installed game.

Registered private app `lords2_demo_setup` points to
`test/binaries/candidates/lords2-demo/original/SETUP.EXE` and the candidate's
generated browser manifest. It is absent from DESKTOP_APPS. The canonical
candidate directory and generated metadata are staged in the isolated source
root `/home/user/lords2-preflight-source` (not in a full runtime checkout).
`tools/prepare-lords2-demo.js` verified all181 originals then used the production
browser-manifest generator:180 support files, SETUP.EXE excluded, each URL
`original/<relative>` and each guest path `c:\\<relative>`, no doubled prefix.
API `cmd_xfofmvybmfsq` passed at15:02:46.795Z. Registration does not claim local
fixture availability or successful launch.

After coordinator reviews this manifest, stage the original tree at that
canonical path, prepare the manifest and verify every file against the inventory.
Use the existing reviewed module with recorded source/module hashes. First
ordinary setup observation: 90-second guest limit, 120-second external watchdog,
640x480, normal renderer input only. Capture before clicking; stop at any licence,
restart/system-install decision or unsupported API. Export actual installed tree
and registry only if ordinary setup completes without an unanswered decision.
Register the captured installed LORDS2.EXE route afterward.

For gameplay, a separately granted 180-second bounded run should reach the
original map through ordinary UI, capture baseline, then select an actual county
and adjust a visible population/tax control or create/move an army according to
GAMETIPS. Capture the concrete state change and reviewed map screenshot, plus
input receipts. An intro/menu, timed animation or selection highlight alone
does not qualify. Performance, audio, combat and public deployment remain separate.

## Bounded original setup controller

`tools/lords2-setup-first-launch.js ROOT PAYLOAD NEW_OUTPUT` is prepared for
an explicit exclusive grant. Use historical runtime ROOT
`/home/user/jedi-knight-checkout`, PAYLOAD
`/home/user/lords2-original-20261015/original`, and a new output folder.
It requires the exact142 compiler closure pins in
`army-men-setup-compile-pins.json` and module SHA256
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
It hashes every physical tracked runtime source before and after; no current-main
equivalence is inferred from that historical module or source HEAD.

The controller mounts all181 original files under `C:\\L2SETUP` and runs original
SETUP.EXE with that cwd and empty arguments. It uses explicit cooperative
`--no-threads`, `--no-build`, 90-second guest limit and120-second process-group
watchdog. No guest input is sent. Screenshots/snapshots are sampled every10s;
licence, restart or crash text triggers capture and cooperative quit. Log output
is drained, retained up to8MiB and omitted bytes counted. This detector cannot
guarantee recognition of image-only prompts, but no input will answer them.

Actual child handoff capture, final VFS and registry export are retained.
Children are not replayed automatically. Any captured child needs separate
header/argv/cwd/registry review and a new runtime grant. All original source
files, compiler/module and VFS originals are checked after termination, along
with owned process-group absence. Independent host postflight is still required.
Source validation covered NE header acceptance, malformed header/missing fixture
rejection,181unique paths,142pins, correct cwd and JS syntax. No guest has run yet.

### First ordinary startup observed

Controller182296/API `cmd_ynyylsxxzysr` ran15:06:30.200–15:08:01.784Z,
exit0; guest terminal15:08:01.601Z, no signal. All6527 physical tracked
historical runtime files,181 originals and canonical937 module were unchanged
in independent15:08:40.337Z postflight, active runtime processes `[]`.
It reaches the actual Sierra Main Menu with Install/Register/Read Me/Test
buttons. Reviewed640x480 sample1 SHA256
`7b30f3795a63c5e75f4d3fdd74abf6fb5c6f43addbd86844950f638e3c9a5bad`.
No input, child handoff, installation or gameplay. The GUI's Sierra logo is
visibly striped; no cause is inferred from this installer observation.
21evidence artifacts were recovered and individually verified under
`scratch/runs/20261015-lords2-original-preflight/setup-evidence`;
archive607604bytes SHA256
`debe53955f608474eb4a6c60154c7a9ccdbbb4a68e02b83f9062a5d9f5dd32dc`.

`tools/lords2-setup-install-click.js` prepares the next separately granted
observation: restart exact original setup, wait for the first10-second capture,
require that image's SHA256 to equal the reviewed menu, then send exactly one
ordinary renderer `click:509:147` to Install. A differing menu stops without a
click. Record `input-event.json`, wait five seconds, capture and quit. The same
90/120bounds, crash/licence/restart stopping and all identity/postflight checks
apply; no further prompt, licence or restart is answered. The image hash is a
conservative input gate, not a gameplay test. This second controller is not yet run.

### Install click and system-test observation

Second controller184351 ran15:10:02.374–15:10:17.962Z, exit0. Exact menu
gate passed; the request at15:10:12.669Z has an actual control reply confirming
`click509,147` delivered at batch421665. The five-second screenshot shows only
the Sierra background. Snapshot at batch647857 shows System Test Results
hwnd0x18016 `(0,20,661,460)` and System Test hwnd0x1804a `(77,186,487,109)`
visible, with Main Menu hidden. The inner dialog is fully onscreen; the results
window's21px right clipping cannot explain complete absence. No licence or
restart answer, installed game, child handoff or gameplay resulted.

Guest T1 was active at EIP0x12ff40/yield6; this does not prove system-test
completion or a deadlock. The5s observation advanced226192batches without
a completion message. Source comparison against current origin/main found
only five compiler differences for the OemKeyScan/API change; renderer/window/
paint JS hashes match the physical historical source. No stale paint-fix gap
was found. Diagnosis must distinguish actual pending paints/test readiness
from compositing order before changing production code.

Independent15:11:20.924Z postflight:6527source files,181originals and937module
unchanged, active `[]`. Fifteen artifacts were recovered/verified under
`scratch/runs/20261015-lords2-original-preflight/install-evidence`, archive
600739bytes SHA256
`ec2ca5844e82ae68bc1af1c044754dd0fc754041e9deda435a1506d9eda105ba`.

Prepared `tools/lords2-setup-system-observe.js` retains the same reviewed-image
gate and single Install click, then records distinct1/5/10/20-second snapshots
and PNGs. It uses existing `--dump-backcanvas`, `dump-windows`, `dump-children`
for both observed dialogs, and `dlg-dump:all` to retain labels, rectangles and
pending-paint state. These commands are present in the actual test harness;
no full memory dump, repaint request or additional UI input is sent. It quits
after20seconds or an earlier licence/restart/crash stop under the same90/120
bounds. This third controller awaits a separate grant.

### Owned dialogs painted but covered by the background

Third controller186773 ran15:15:01.482–15:15:32.143Z, exit0. All four phases
were captured. Both System Test and System Test Results backing canvases are
fully painted at20s while the desktop screenshot contains only Sierra's
background. The System Test asks whether to perform the test before installing;
Yes/No remain unanswered. The results canvas contains a default Phantasmagoria
template, so its Passed labels are not completed-test evidence.

The existing dump-windows output gives the decisive ownership/order chain:
background0x18001 z22; hidden MainMenu0x18002 owner0x18001 z16;
visible Results0x18016 owner0x18002 z17; visible SystemTest0x1804a
owner0x18002 z20. `Win98Renderer._raiseWindowGroup` traversed only visible
owned windows. Raising the root therefore skipped the hidden intermediate
owner and left its visible owned dialogs underneath the background. The
candidate repair traverses hidden owners without raising/showing them, keeping
visible descendants above the root. This changes generic owner-group ordering,
not guest state, setup controls or compositor painting.

`test-renderer-hidden-owner-group.js` exercises the real renderer prototype:
the original code fails the visible-owned-dialog assertion; candidate passes
hidden intermediate ownership, sibling order, unrelated/child preservation,
descendant activation and owner-cycle termination. Syntax/diff checks pass.
The existing canvas-based shell z-order test cannot load missing `pngjs` in
this sparse environment and remains pending; no dependency installation,
WASM build or original runtime validation of the repair has occurred.

Independent15:16:02.679Z postflight:6527source files,181originals and937module
unchanged, active `[]`. Forty-five artifacts individually verified under
`scratch/runs/20261015-lords2-original-preflight/system-evidence`, archive
750263bytes SHA256
`77b7d679914245e8b7c6c33e6de3b5a55a6ef9446722d8d7842ff66dafd8608c`.
Reviewed images: `after-install-20000.png`,
`after-install-20000_back_98378.png` and `after-install-20000_back_98326.png`.
Next: independently review/test the generic ordering repair, then compare the
same bounded original route against unchanged control and restored candidate;
the expected result is the actual unanswered System Test visible on desktop.
Any further system-test choice remains a separate user/coordination decision.

### Original candidate/control/restored validation — 2026-10-15

The subsequent paired validation completed successfully: PID197137 ran
15:26:27.391–15:28:00.287Z, exit0. All three phases used the unchanged original
SETUP.EXE route, 181 original files, historical physical source and pinned
937466db module above; only renderer bytes varied. No build occurred.
Candidate/restored renderer SHA256 is
`8c34a51954925d41ccd2afab30900feda5810751fb0fc386b6ef20c59b6dfad3`;
control is `840e361f9e91abfc760e148552999e6a038d52137c419e54e69f2b83f8e196e9`.
The focused regression passed candidate/restored and failed the intended
visible-owned-dialog assertion on control. Existing renderer shell-dialog
and actual-canvas shell-desktop-zorder tests passed in all three phases.
This supersedes the pending canvas/runtime checks recorded above and below.

Each phase matched the reviewed setup-menu PNG before its sole Install click.
Actual input delivery was logged at batches400762/352661/403992 for
candidate/control/restored. At20seconds, personally reviewed candidate and
restored desktop PNGs are identical SHA256
`692cfd926d23bbf25df17faf6292ba4ddf6d5da4a69a2eaee32a60005772c190`:
the actual System Test prompt is visible over the results window. Reviewed
control reproduces the covering Sierra background, PNG SHA256
`918f665e218e1d072fbb658b0e5704ecd54890c560a95996f1067f55c1bf3621`.
All phases exited0 with zero omitted log bytes and no surviving guest group.
The wrapper restored original renderer bytes; independent15:28:35.663Z
postflight verified all6527 original source files,181 payload files and module
unchanged, active `[]`. The remote lane was explicitly released.

Recovered149 artifacts have individually verified sizes/SHA256 under
`scratch/runs/20261015-lords2-original-preflight/pair-evidence/`.
The retained archive is2720356bytes SHA256
`c6db69157ae0c16d998fad4735d5067bce7656dc726253a735d5a573c31938a1`,
recoverable from `/home/user/lords2-owner-pair-20261015.tar.gz` on bx_9ef2wdsw.
Each `candidate`, `control`, and `restored` subdirectory has the reviewed
`after-install-20000.png`, full output, physical source manifest, identity,
terminal and postflight; scoped dashboard result records were published last.
The top-level result is the original pair supervisor receipt.

The generic composition repair is validated, but gameplay remains unqualified.
The System Test Yes/No question remains unanswered, and the bottom question
line clips in its109px dialog. This is a separate geometry issue, not a reason
to broaden the owner-order repair. No further blocker is established before
that untouched question; the default Phantasmagoria/Passed results template
still does not prove a compatibility test ran or installation completed.

Source-only follow-up localizes clipping to STATIC0x1804b/id1000: its captured
client-relative rectangle is(56,18),313x48, inside a481x82 dialog client.
It ends at client y66, leaving16px below; enlarging the outer dialog alone
would not enlarge that control. Captured text wraps the first sentence into
two lines, then has a blank line and final question. Four13px lines need52px,
consistent with the visible bottom clipping, but the responsible layout/font
calculation is not yet identified. No speculative geometry fix was applied.

Prepared `tools/lords2-setup-system-test.js` for a separate reviewed grant:
require the exact fixed renderer, reuse original menu/Install gate, match the
reviewed20s System Test PNG, then issue one Yes click at510,235 to run the
original compatibility check. Capture1/5/10/20s after that input, then quit;
no later UI input is possible. Existing90/120s bounds, physical identity,
payload pins, log cap, registry/VFS capture and cleanup checks remain.
Licence/restart/crash text stops observation early. The controller is source
only: no compatibility-test answer has yet been delivered.

`tools/lords2-system-test-rollback.js ROOT PAYLOAD FIXED_RENDERER NEW_OUTPUT`
wraps that controller for the next separately granted run. Before changing
source it checks original840e/fixed8c34 renderer bytes, the142 compiler pins,
937 module,181 originals and actual runtime canvas/renderer dependencies.
It retains the original renderer and full physical-source manifest, swaps
only renderer.js, and invokes the reviewed controller with a130s outer bound.
Its `finally` restores840e and independently rechecks every tracked source,
compiler/module and original payload, even after a controller failure.
External fresh-idle preflight and terminal/independent postflight remain
required under the sole-box protocol. No source preparation grants runtime.

### System Test Yes — 2026-10-15 15:43–15:45Z

Granted wrapper922bb72c7/controller6bd4b7e8b ran as PID212340,
15:43:50.243–15:44:41.252Z. Fresh15:43:45.758Z preflight verified6527 physical
sources,181 originals,142 compiler inputs,module937 and idle `[]`.
Original setup/Install and fixed renderer were unchanged from the reviewed
pair. The exact reviewed System Test PNG matched, then one Yes510,235 was
requested15:44:20.804Z and actually delivered at batch1335520.

The next log records `ThreadManager` Thread1 crashed at EIP0x1a84eb,
ESP0x1e8530, `unreachable`; previous EIP0x1a84eb, previous2 EIP0x160329.
All setup-child windows disappear; personally reviewed1s and20s PNGs show
only teal desktop. No later prompt or completed compatibility results were
observed. The Phantasmagoria template remains no evidence of test completion.
Harness terminal0 and wrapper completed=true describe controller completion,
not guest success. The old crash detector missed this ThreadManager wording;
it observed the remaining bounded20seconds with no further input. The source
guard now recognizes it; there has been no rerun of the updated guard.

Independent15:45:18.868Z postflight confirms renderer840e restored and all6527
sources/181 originals/142 compiler pins/module937 unchanged, active `[]`;
the slot was explicitly released. Zero log bytes were omitted. All57 retained
artifacts individually verify in
`scratch/runs/20261015-lords2-original-preflight/system-test-evidence/`;
archive1147135bytes SHA256
`cce09a81484ebd4a755e36271d5d28e29dae1c0f007eb1d24685d8f9782d2b5a`,
remote `/home/user/lords2-system-test-20261015.tar.gz`.
The `system-test` child directory holds the reviewed failure PNGs and logs.
Next work is source/log diagnosis of the specific child-thread trap, not an
automatic retry, alternate prompt answer or gameplay qualification.

Read-only recovery of original-generated `windows/temp/setupl.dll` yields
152208bytes SHA256
`8819c5194e10d954833bcbd8b7b65b289df5efb04394168fc3e3a57aea41211a`.
Existing `tools/ne-dump.js FILE --dialogs` identifies NE dialog145 as
328x218DLU, MS Sans Serif8pt, with the literal Phantasmagoria default text.
The prompt itself is not a resource caption named System Test in that dump.
Recovered `_setup.exe` is NE528080bytes SHA256
`7dbf696d4f08464ca1e187686368fe89c5b71b3162c094f463d0e5ec4eaca567`;
both artifacts and `setupl-dialogs.txt` are retained in the same preflight run.
These were read from saved VFS files without guest execution. Win16 dialog
font-unit handling is a source lead, not a demonstrated root cause.

Prepared source-only `tools/lords2-owner-group-pair.js` for separate exclusive
grant: require exact original renderer840e361f and candidate8c34a519 bytes,
then run candidate/control/restored phases with the unchanged20s original
observation controller. Each phase runs the actual focused regression (old
control must fail its intended assertion) and existing canvas-based shell
z-order test before the original route. No build, guest state override or
additional prompt answer occurs. Each phase records physical source hashes,
module/payload identity, actual Install input, window/backing-canvas frames,
terminal and process-group postflight. The wrapper restores original renderer
bytes in `finally` and rechecks every original tracked source file. Each guest
has90/120limits and each controller invocation130s; tests have15s guards.
Failure stops the pair instead of proceeding to another phase. This pair has
not run. Full1944 tracked-test filename tier validation passes with the new
regression classified as unit; the sparse checkout itself intentionally lacks
many unrelated test files, so validation used only a temporary filename tree.

Validation: Node syntax/registry assertions and diff checks pass. The existing
candidate browser-manifest regression passed its645-file fixture, stable
prepare/reuse, sidecar exclusion and save-preservation checks. The CLI corpus
test could not load `compile-src` in the sparse checkout; no compilation or
guest execution was attempted, and that runtime test remains pending.
All181 original hashes rechecked unchanged at15:01:38.759Z, with no runtime
processes present. The first postflight command had a newline quoting error;
the corrected read-only check passed and did not modify the fixture.

Acquisition API `cmd_zv8i2qpyppms` exited0 at14:57:24.841Z; nested inspection
`cmd_ibmmovp2wqlf` exited0 at14:58:00.126Z. All three archives pass 7z CRC testing.
Evidence recovered through exec API into
`scratch/runs/20261015-lords2-original-preflight/`: receipts, all inventories,
original README/SIERRA.INF/LANGUAGE.INF/GAMETIPS and listings. No SSH, guest,
build or browser process was used. These are source evidence, not runtime results.
