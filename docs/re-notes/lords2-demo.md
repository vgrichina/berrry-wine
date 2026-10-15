# Lords of the Realm II original playable Windows demo

2026-10-15: acquisition and static preparation only. No setup/game execution,
licence answer, gameplay screenshot or qualification. Owner `/root/new_demo_refill`;
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
