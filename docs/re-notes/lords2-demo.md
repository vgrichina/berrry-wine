# Lords of the Realm II original playable Windows demo

## Scoped GetParent rejection candidate (2026-10-15)

The captured `USER.46 GetParent(0x1446)` trap is a failure-contract defect:
[Microsoft GetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getparent)
specifies NULL on failure; the primary
[Wine Win16 adapter](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/user.exe16/window.c)
implements `GetParent16` through the ordinary GetParent operation. This does
not establish a Win16 GetLastError requirement. The candidate rejects only
unallocated narrow indices for GetParent, returns NULL through the existing
Pascal far-return epilogue, and preserves strict generic `win16_h32` conversion
and other HWND query behavior. Allocated nonwindow/stale mappings continue
through the existing window lookup, which returns NULL. No guest handles or
object fields are replaced.

The unexpected CWnd field remains unexplained. Original segment3:e1f8 calls
CWnd::GetWindow(GW_CHILD), saves the returned object pointer, and at3:e2d0
passes it to CWnd::GetParent. Segment5:84e0 reads HWND from ES:BX+0x14;
captured ES:BX was007f:889c and the actual GetParent argument was0x1446.
The object bytes and their writer were not captured. The return path through
CWnd::FromHandle (segment4:8f36/4:a776), or later object corruption, remains
an investigation lead. Normal invalid-HWND rejection does not prove that
object provenance correct or establish successful installation/gameplay.

Source-only validation: the tiny regression compiles the actual argument,
handle conversion, query and Pascal-return functions in a bounded fixture;
0x1446, the first unallocated slot, and0xfffe return NULL with restored CS:IP
and consumed far frame/argument. Generic conversion and another HWND query
still trap. The identical test against the pre-change function traps on
0x1446, providing a negative control. The full ABI regression additionally
covers child/popup/top-level relationships, allocated nonwindows and stale
mappings, and register preservation; it is prepared but not yet executed.
No full build or original-demo replay was performed for this candidate.

### Native validation completed (2026-10-15 16:25 UTC)

The preceding source-only status is superseded for build/conformance only.
Root-granted PID242059 ran the exact immutable candidate
`d56df2dbdbc3fadc4c078dd339a244b478dfeb98` in its dedicated remote checkout,
16:24:11.377–16:24:43.244Z, terminal0. The normal build and all five tests
passed. The canonical module is1,803,860 bytes, SHA256
`e26a751567f63a0bb6abbea8a69111842d41e8705158ccf425394d4ac591745d`.
Full ABI assertions include actual0x1446 rejection, NULL/low/sentinel values,
allocated nonwindow and stale mappings, valid child/popup/top-level behavior,
CS:IP/ESP restoration and EBX/EBP preservation; generic translation and other
queries remain strict. The tiny test and existing window-handle-map,
GetParent-owner and task-args/MMSYSTEM conformance tests all passed.

The full ABI harness injects test exports and therefore executes a distinct
module, SHA256`7b405d603359c3612ce536af1393a87c3674dc5eac25c5e3b002594db758c343`.
Other transformed module hashes are recorded in their individual logs, not
attributed to the normal-build canonical module. Git emitted an alternate
object-store depth warning during setup; physical tracked blob verification
and every normal build gate still passed. No source was changed to suppress it.

Independent postflight16:25:13.745Z confirmed idle, all6,581 candidate source
files and6,527 historical source files unchanged, and all held937/a948/04ede/
0dbf modules preserved. A further16:25:24.696Z check verified43 dependency
pins plus59 loaded module identities. The exclusive lane was released.
Recovered14 artifact hashes verified: remote
`/home/user/lords2-getparent-evidence-1.tar.gz`,1,344,195 bytes, SHA256
`abf2fcac33b373fc14faae1a88ec2598012d76f278ced50f98528941e3f30733`.
Local evidence is `scratch/runs/20261015-lords2-original-preflight/getparent-evidence/`.
The build/test output, canonical snapshot, source inventories and independent
postflight remain together; this is conformance evidence, not gameplay.

Prepared `tools/lords2-getparent-original-replay.js` on task branch
`task/new-demo-refill-20261015` at`7bc69e414` as a separate source-only
controller, excluded from this API integration. It requires the exact new canonical e26a module, immutable d56
source/build/dependency receipts, fixed renderer8c34 and diagnostic hostfb9ee;
it never passes the new module through the historical937 guard or swaps source.
Only the existing exact-image-gated Install and System Test Yes are permitted,
followed by the unchanged bounded20-second observation and90/120-second limits.
Changed images stop before input; later prompts receive no answer. Original
181-file payload, all source/dependencies and four held modules are checked
before/after. This new canonical original-demo replay has not run.

### Current-main integration scope

Prepared against main`30b4dabc707ab53173f96c016201d77eabc0719b` using the
production change and two tests from`a24fcaf5d`, plus the native report from
`7bc69e414`. Runtime controllers are excluded. The resulting Win16 API file
is byte-identical to the natively tested d56 candidate; actual-function tiny
regression also passes on this integration source. No local full build ran.

The e26a native proof belongs to d56, not the newer main host/runtime. Main
adds cross-process scalar SendMessage routing in`src/09a5-handlers-window.wat`
and differs in these ten host/CLI files: `host.js`, `lib/dll-loader.js`,
`lib/guest-thread-host.js`, `lib/guest-worker.js`, `lib/host-window.js`,
`lib/process-boot.js`, `lib/process-send-broker.js`, `lib/thread-manager.js`,
`lib/thread-send-waits.js`, and`test/run.js`. Those changes include transport,
lifecycle and cooperative callback ownership work independently coordinated
by root. The renderer, WATX compiler and include manifest match the tested
candidate. This integration does not claim a native rerun of that combined
main runtime or any completed original-demo System Test/gameplay.

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

Source-only trap mapping: using child arena0x160000 maps EIP1a84eb to
original `_setup.exe` segment5:84eb (`push si`) after a prologue that calls
segment1:030c. Previous2 EIP160329 maps to that stack-allocation helper's
`mov sp,ax; push dx; push bx; retf`; ESP1e8530 and EBP853c are consistent
with segment9's data/stack. `system-test-ne-trap-map.txt` retains output from
`node tools/ne-disasm.js _setup.exe --arena=0x160000 5:0x84e0,1:0x30c 40`.
This is a consistent mapping hypothesis, not a proven captured segment map
or a diagnosis that PUSH itself failed: the log lacks the child's segment
table, full registers, stack bytes and WASM trap stack.

Existing diagnostics audit: cooperative ThreadManager catch logs err.message,
EIP/ESP/previous blocks then retires the child; it does not retain err.stack.
`--trace-sched` gives compact scheduling state, and test/run.js callstack dumps
are invoked for T0 paths. Native worker trap logs contain more registers, but
switching to that backend would change this original cooperative route.
A bounded trap-time diagnostic should retain the existing child's WASM stack,
registers/segment bases and a small stack slice without changing execution or
supplying a return value. No such diagnostic runtime has yet been authorized
or executed, and no emulator repair is justified by the current data alone.

Prepared crash-only cooperative diagnostics in `lib/thread-manager.js`: the
existing `_log` now retains an8192-character exception stack, integer
registers, CS/SS/DS/ES selectors and CS/SS bases, plus at most128 translated
stack bytes. Missing/throwing exports, sentinel/out-of-bounds translations,
and a throwing logger cannot suppress the existing `_markThreadExited` call.
The actual `runSlice` catch test exercises these failure controls and confirms
exitCode1/retirement/cleared running handle. It passes against the task source,
the same catch on current main, and the exact historical host; the new test
belongs to the unit tier and the full tracked filename-tier gate passes.

`tools/prepare-lords2-crash-diagnostic.js NEW_OUTPUT_FILE` reconstructs only
this catch on historical03641536 source. Original ThreadManager SHA256
`02265fbcd48b5fd4c8e38b7025d7c067ac558f773168e761c5e2c4f5eb993b08`
matches the physical runtime receipt. Prepared diagnostic195365bytes SHA256
`fb9ee11f21b5e7bd409141deda6d9a59782b98752e60f6b15fb67730e3921642`.
The rollback wrapper accepts it as an optional fifth argument, verifies both
exact JS identities, retains both originals, and restores renderer and
ThreadManager in `finally` before verifying every baseline source file.
The original controller still permits only reviewed Install/System Test Yes;
the updated crash guard stops at the thread trap. No diagnostic replay has
run; a separate sole-box review/grant and fresh preflight remain necessary.

### Exact diagnostic replay — 2026-10-15 16:02–16:06Z

Granted PID229101 ran16:02:39.743–16:03:10.815Z, controller terminal0,
guest failure. Fresh16:02:39.430Z source/payload/compiler/module checks passed;
Install delivered batch407415 and screenshot-gated System Test Yes delivered
batch1311955. The updated guard stopped at the same trap immediately, with no
later input. Personally reviewed `stop.png` is teal desktop. Independent
16:03:35.036Z verifies all6527 baseline sources,181 originals,142 compiler
pins and937 module unchanged, both historical JS files restored, active `[]`.
Fifty artifacts individually verified under
`scratch/runs/20261015-lords2-original-preflight/crash-replay-evidence/`;
archive1206626bytes SHA256
`02603ccc54e0eaf94813945886cfe090c5c2975d8615da18cdd308471258b25a`,
remote `/home/user/lords2-crash-replay-20261015.tar.gz`. The derived
`crash-detail.json` retains the actual diagnostic from output.log.

Captured CS005f/base1a0000 and SS=DS=ES007f/base1e0000 confirm original
`_setup.exe` segments5 and9. Full128-byte stack starts `f9845f004614`:
far return005f:84f9 and first argument1446. That return follows the original
USER.46 GetParent call at5:84f4, after loading CWnd.m_hWnd atES:[BX+14h].
BX889c identifies the CWnd object; its bytes are outside the bounded captured
stack slice, so the origin of1446 remains unproven.

The actual WASM stack maps9712=`$win16_h32`,10119=`$win16_hwnd_query`,
9969=`$win16_user`,10295=`$win16_dispatch`,792=`$win16_far_transfer`,
795=`$th_call_far_imm`,11881=`$run`. This was checked without compilation:
the pinned include closure wrapped in `(module ...)` has270 imports and12660
definitions, matching the binary's12660 definitions; all1916 inline export
indices match the binary with zero mismatches. The module has no name section
and no retained combined.wat; an initial unwrapped scan was rejected because
it counted nested macro functions. The wrapped/binary check is authoritative.
WASM offset15ec1d is byte00 (`unreachable`) inside function9712, specifically
the branch where h16-minus100 exceeds the allocated handle count. The actual
1446 argument exceeds even the4096-entry maximum, so this is handle rejection,
not a failed PUSH instruction or a completed compatibility test. No global
handle conversion relaxation or guest-memory change has been made.

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
