# Icewind Dale demo — local candidate

The official English demo is pinned in `test/candidate-corpus/manifest.json`
from Archive item `icewind_dale_eng_demo`. Its README expressly prohibits
copying/electronic distribution, so the extracted fixture stays ignored and
must not be deployed or rehosted.

## 2026-10-31 native local-session ordering and cleanup branch identified

Run `20261031T2210Z-icewind-session-order` reused the original retained 2058
installation and read-only CD2 mapping. One browser ran 22:11:54–22:14:42;
three balanced native Escape presses and one trusted Create Game click returned
to GAME MODE. Fresh failure/final captures are retained; this run did not capture
the brief CLEARING GAME DATA screen. **No Party Formation, character creation,
Prologue or tavern movement; no engine repair or build.**

Original disassembly and the fresh read-only trace narrow the cause beyond the
previous late, quarantined observer:

- Create Game calls initialization at `0x0068F058 -> 0x008D4143`. Its
  `SendMessageA(0x10001, 0x406, session, 0)` dispatches COM activation.
  `CoCreateInstance` succeeds: saved HRESULT zero, output `0x08221530`;
  the actual 53-slot object has the expected DirectPlay methods.
- The original provider-index-zero path skips `InitializeConnection` at
  `0x008D424D`, then marks initialization active at `0x008D42E2`.
  Create-session caller `0x0068F24C -> 0x008D5539` also skips `Open` at
  `0x008D581F` when provider index is zero, and sets local session flags.
  No InitializeConnection, Open or CreatePlayer call appears in this trace.
- The subsequent poll calls `GetSessionDesc(0x08221530, NULL, 0x7EDFFF7C)`
  with native return `0x008D4D12`. The saved result is `0x887700AA`
  (`DPERR_NOCONNECTION`) at `0x7EDFFF74`. It is retained in the still-active
  poll frame during cleanup's `Sleep(1000)`: matching entry return
  `0x008D48F9`, parent EBP `0x7EDFFF84`, parent return `0x008D4F2A`.
  This independently matches the original `EBP-0x10 = sizePtr-8` layout.
  The native comparison at `0x008D4F0A` takes cleanup at `0x008D4F25`,
  followed by DestroyPlayer(1), Close, and false return.

Thus an earlier failing initialization/Open call was **not** found: native
code deliberately bypasses both calls in this local path. The retained COM
object is nevertheless queried, and the valid outside-session result triggers
native cleanup. **This is not a defined generic API contract defect and is not
permission to change GetSessionDesc's result.** The remaining question is why
this original local path retains and polls that object. A generic repair still
requires an independently defined contract and focused oldFAIL/newPASS test.

The exact exported scratch observer passed cheap tests before launch: copied
shared views, `RegionMap.REGIONS`, unchanged guest memory, original log
return/receiver/error forwarding, COM/vtable resolution, filtering before the
bounded cap, and error containment. The shared-decoder oldFAIL/newPASS used an
explicit strict-browser decoder mock; Node itself accepts shared views. Browser
observer errors and dropped records were zero. Live memory is asynchronous:
the guessed `savedInitializeResult` in record 13 belongs to an expired frame
and is excluded. Only qualified active-frame reads support the result above.
The previous late armDesc/armSafe results remain quarantined.

All 1,106 original files and 27 CD2 joins matched, as did the prelaunch 528
source and 867 compiler pins. The uncached actual HTTP module was 1,898,762
bytes, SHA-256 `d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Exact geometry/input, 14 HTTP guard cases, five isolated-server statuses and
original read-only CD2 prerequisites passed. No guest edits, copies, reinstall,
manufactured markers, injected saves or API-result changes occurred.

Controller, supervisor, launcher, monitor, board watcher, attached inspection
helper and six adopted children were durably reaped with zero status; Chrome
closed normally. The stop-request sender exited one after an acknowledgement
timeout because the controller exited after capturing its final image without
writing the command acknowledgement; this is retained, not reported as a
successful sender wait. Final audit found all 23 owned PID/start identities
absent, whole Chrome/global crashpad empty, ports 44041/42313 closed, profile
gone, nine trusted events balanced, and lock free. Minimum free space was
2,562,224,128 bytes. A source-file change by the next worker after runtime
(`src/09a8-handlers-directx.wat`, OWN 22:14:49) is recorded separately from the
unchanged original inputs and loaded module. NEWFULLRELEASE was announced at
22:17:05; Boat ID/state/expiry N/A.

Evidence: `session-boundary.json`, `session-observer-latest.json`, exact observer
and tests, `native-*.asm`, `09-first-failure-before-teardown.png`,
`10-final-before-teardown.png`, `stop-request-wait.json`,
`full-release-final.json` and `RECOVERY.txt` in the run directory. The combined
recovery driver, previously unlaunched, was browser-tested in this run.

## 2026-10-31 original Create Game dispatched; creation still blocked

Run `20261031T2150Z-icewind-native` sent **trusted native Create Game
clicks in the unchanged original demo**. It reached the labelled
`CLEARING GAME DATA` progress screen, then returned to the labelled menu.
**Party Formation, character creation, Prologue DONE, unpaused tavern, and
paired floor-click movement were not reached.** There was one browser launch,
21:50:58–22:02:00, with six balanced mouse clicks within that session. No
production repair or build is claimed.

The previous optional-DOM-method correction passed cheap tests but still
omitted the renderer's exclusive presentation transform. Before any mouse
input, browser inspection found its proposed rectangle `(0,34,640,480)`
differed from the displayed native viewport `(22,34,979,734)`. The corrected
scratch helper requires an uncropped 640×480 native viewport and uses
`getPresentedRectClient()`. Its native `(480,175)` maps to CSS
`(756.25,301.6041666666667)`. The exact exported helper passed scaled-coordinate,
balanced-dispatch and ambiguous-crop refusal checks and was executed through
Puppeteer in the same browser. Actual DOM evidence records trusted mouse
move/down/up events; the native last-message data independently contained
`WM_LBUTTONUP` at `(479,174)`. The attached helper inherited FD9 pointing to
the lock inode while the original runtime supervisor retained its exclusive
flock. It did not acquire another lock or launch another browser.

Before the later diagnostic logging error, the native Create Game transition
already returned to the menu. Native session initialization performed the
compound-address sizing/allocation calls; a read-only return observation
captured `CoCreateInstance(CLSID_DirectPlay, IID_IDirectPlay4A)` returning
`S_OK` and output `0x08221620`. The existing API trace then recorded
`GetSessionDesc(NULL, size)` from native return address `0x008D4D12`, followed
by `DestroyPlayer(1)` and `Close`. No Party Formation transition was accepted.

Later instrumentation captured that query returning `0x887700AA`
(`DPERR_NOCONNECTION`), size zero, shared session state zero and session pointer
zero. The next native `LeaveCriticalSection`, return address `0x008D4D2E`,
exposed the saved HRESULT at `sizePtr-8`, consistent with the original
function's disassembly. The actual object's slots 6/22/24/38 resolve to
CreatePlayer/GetSessionDesc/Open/InitializeConnection as expected. No Open
call was observed. **This does not establish a generic API violation:** the
query result is valid outside an open session, and the first native caller
or ordering error that causes the menu return remains unknown.

Late scratch diagnostics had real failures: one helper syntax error, a
`TextDecoder` attempt on a shared view in a host-log observer, and an incorrect
`RegionMap.regions` lookup. The bounded replacement copies the view and reads
`RegionMap.REGIONS`. The logging failure happened after the original menu
return had been retained; later query results are explicitly quarantined from
claims about an uncontaminated first cause. No guest bytes or API return values
were patched. Optional missing music-file probes and directory-open errors
were retained without treating them as a repair contract.

The exact HTTP guard's 14 cases and isolated server's 200/400/404/416/500
checks passed. All 1,106 original pins, 528 source pins, 867 compiler pins, and
27 original CD2 joins matched before and after. The retained installation and
original C: paths plus read-only D: CD2 presentation were reused directly;
no reinstall, download, fixture copy, manufactured marker/volume, KEY/INI/BIF
rewrite, save injection, WININIT edit, or foreign cleanup occurred. Runtime
HEAD was `b7ea3fcc500ecd346dcf656a4c4f37c35b7fcadc`. The actual HTTP-loaded
module was HTTP200, uncached, 1,898,762 bytes, SHA-256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
Chrome 151 used isolated Worker/Threads, WebGL, native 1024×768 viewport,
default audio and normal clock. No FPS, audible-output, or gameplay claim.

After the preteardown failure capture, controller, supervisor, runtime launcher,
board watcher and monitor all completed durable waits with code zero. All 26
attached Node helpers were durably waited; two diagnostic helpers truthfully
exited one. Six adopted children were reaped, Chrome exited zero without a
signal, all 49 recorded own PID/start identities were absent, ports 37827/44305
closed, profile gone, all 24 trusted input events balanced, and FD9 free.
Minimum observed free space was 2,488,537,088 bytes; start reserve exceeded
2.5 GB and runtime remained above the 2.1 GB early-stop threshold. Boat
ID/state/expiry N/A. Explicit NEWFULLRELEASE was announced at 22:02:56.

Evidence and recovery: `session-boundary.json`, `10l-cocreate-result-returns.json`,
`10q-final-contracts-safe.json`, `10r-object-contract-vtable.json`,
`native-geometry.json`, `displayed-native-tests.json`, trusted-input and actual
HTTP receipts, reviewed captures, `full-release-final.json`, and `RECOVERY.txt`.
The original log is retained as `browser-console-before-safe.jsonl.gz` plus
`browser-console.jsonl`. `native-layer.cjs` preserves the tested input helper;
`recovery-browser.cjs` integrates it but that combined driver has not been
browser launched. Next: establish the first native session caller/order
between successful COM activation and the first session query/menu return;
require a defined contract and oldFAIL/newPASS regression plus build before
any generic production repair. Do not change the original installation to
bypass character creation.

## 2026-10-31 original optical scan and labelled native menu reached

Run `20261031T2137Z-icewind-optical` **executed the unchanged original demo's
optical scan and reached its labelled native menu**. Character creation,
Prologue DONE, tavern, and floor-click movement remain unverified: the first
Create Game click failed in this run's scratch coordinate helper before any
mouse event was dispatched. This is a harness failure, not an observed guest
disc failure or an emulator API violation. There was one browser allocation,
no retry, and no production change or build.

At 21:43:18, the actual guest called `GetLogicalDrives` with return address
`0x0043AD68`; the host returned mask 12 (C:/D:). Two `GetDriveTypeA` calls
returned to `0x0043ADFC`; the second host lookup reported type 5. The native
`GetVolumeInformationA` call returned to `0x0043AE65` and proceeded to
`FindFirstFileA` through the original MFC wrapper, return address
`0x00929F05`, for **`D:\cd2\data\iwdcd.2`**. Its VFS result was handle
1778384913, entry `iwdcd.2`, size 1. `original-optical-runtime.json` retains
these actual calls and results. Direct Win32 BOOL/handle return logs were
not captured; the successful volume branch is established by the subsequent
native marker lookup. There is no observed failing optical call to fix.
The intro then read the original `C:\CD2\data\MVEfile1.bif`; two ordinary
Escape presses reached the detailed GAME MODE menu with CREATE GAME, LOAD
GAME, MOVIES, and QUIT GAME labels. No character or gameplay is inferred
from that menu.

All 1,106 retained original files (1,079 installed files totaling 470,164,222
bytes and the 27 CD2 files), 528 source pins, and 867 compiler pins matched
before and after. The EXE/KEY/INI identities below are unchanged. The run
reused the retained native installation directly and presented the same
original CD2 URLs under read-only DRIVE_CDROM D:, preserving the original
C: paths. No reinstall, download, full fixture copy, marker/volume/KEY/INI
manufacturing, BIF expansion, save injection, WININIT edit, or foreign cleanup
occurred.

The exact executed response callback passed 14 cheap cases before launch:
optional HTTP404s, same-origin HTTP200 script, isolated/unisolated/missing
document, data/blob URLs, required asset/script/module HTTP failures, and
module hash mismatch. The scratch server additionally passed actual
200/400/404/416/500 requests with consistent COOP/COEP headers. It applies
headers before the static handler's success/error branches. In the browser,
`crossOriginIsolated=true`, normal Worker/Threads and WebGL were verified;
the previous optional404 guard failure did not recur. Audio/clock remained
default, with a native 1024×768 viewport. No FPS or audible-output claim.

Heavy work waited for the **current SlaveZero producer
01a193e2-c9b5's 21:43:06 NEWFULLRELEASE**, then independently checked actual
PID/start identities, whole Chrome/global crashpad, profiles, ports, inputs,
and the inherited FD9 lock. Runtime Git HEAD was independently captured as
`5efa420458517d3eacbab60f27946e9cdef80a8d`. The actual HTTP-loaded module
was independently hashed: HTTP200, no cache, 1,898,762 bytes, SHA-256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.

The sole browser ran approximately 21:43:11–21:44:51. At the first Create
Game request, the scratch helper treated the DirectDraw OffscreenCanvas
as a DOM canvas and threw `TypeError: c.getBoundingClientRect is not a
function`. The mouse never moved or pressed; input evidence contains only
the four trusted, balanced Escape key edges. The reviewed
`browser-failure.png` and `browser-final-before-teardown.png` genuinely
capture the labelled menu before teardown. `executed-browser.cjs` preserves
the actual driver. The retained `browser.cjs` now guards the optional DOM
method and falls back to the displayed renderer canvas and native client
rectangle. Cheap tests extract the exact helper body: oldFAIL1/newPASS3 for
OffscreenCanvas, DOM canvas, and absent native layer. **This geometry
correction has not been browser-executed.**

The controller has a durable wait with exit **1**, honestly preserving the
harness failure. Supervisor, runtime launcher, board watcher, and monitor
have durable successful waits; six adopted children were reaped. Chrome
exited 0 without a signal. Final audit found all 23 own PID/start identities
absent, whole Chrome/global crashpad empty, ports 43113/46145 closed,
profile gone, inputs released, and FD9 free. Minimum observed runtime free
space was 2,668,838,912 bytes. Boat ID/state/expiry N/A. Runtime release
was announced separately from pending documentation publication.

Recovery: `RECOVERY.txt`, `original-optical-runtime.json`,
`first-causal-failure.json`, `header-guard-tests.json`,
`layer-geometry-tests.json`, `runtime-git.json`, the actual HTTP module
receipt, and `full-release-final.json`. The next authorized task should
cheaply verify the native canvas coordinate helper, reuse this exact
original optical presentation, and perform native character creation,
Prologue DONE, then paired unpaused floor-click movement. Do not rerun
Setup or change the original KEY/INI to address a scratch geometry error.
The run's 44 artifact references and four screenshots pass existence and
containment checks; notes pass `git diff --check`. The global checker remains
non-green with 9 historical containment errors, 200 missing references, and
114 invalid records; none names this run.

## 2026-10-31 original optical scan identified; runtime stopped by harness

Run `20261031T2126Z-icewind-disc` **did not establish original-demo startup
or gameplay**. Static analysis found a missing prerequisite in the preceding
C-only presentation, and a cheap VFS test passed with the original CD2 tree
on D:. The sole browser attempt then stopped during asset loading because
this run's scratch HTTP response guard incorrectly rejected optional 404s.
No runtime disc-scan result, menu, character creation, Prologue DONE, tavern,
or floor-click movement is accepted. There was no retry or emulator change.

The unchanged original EXE's scan at `0x0043ACE7` calls `GetLogicalDrives`
at `0x0043AD62`, tests each assigned letter with `GetDriveTypeA` at
`0x0043ADF6`, and accepts only type 5 (`DRIVE_CDROM`). It calls
`GetVolumeInformationA(root, NULL, 0, NULL, NULL, NULL, NULL, 0)` at
`0x0043AE5F`. After a successful volume probe it concatenates the root,
`cd`, digit `2`, `\data\iwdcd.`, and digit `2`. Its call at `0x0043AF05`
reaches the MFC finder at `0x00929EC7`, which calls `FindFirstFileA` at
`0x00929EFF`. Thus this scan requires **`D:\cd2\data\iwdcd.2`**, not
`D:\data\iwdcd.2`. Disassembly and import/string references are retained
in `optical-scan.asm`, `find-wrapper.asm`, and `static-imports.json`.
This is a static necessary-condition diagnosis; the failing original guest
call has not yet been observed dynamically.

The predecessor supplied the 27 original CD2 files only at `C:\CD2\`.
C: reports fixed disk and is excluded by that scan; its original marker
does not satisfy the optical path. The new private app entry additionally
presents those same retained URLs below `D:\CD2\`, with D: recorded as
type 5 and read-only through the existing generic VFS interfaces. The
installed C: paths and native INI aliases remain present. No ISO, volume
label, serial, marker, KEY, INI, resource, save, or decompressed BIF was
manufactured. The prerequisite test verifies the old missing-path failure,
drive enumeration/type, root enumeration/chdir, original one-byte marker
`32` hex, successful marker lookup, and write-protect error 19. These checks
do not prove guest startup. No generic implementation violation was shown,
so no production API change or build was justified.

All 1,106 retained input files were freshly size/hash checked: the 1,079
installed files totaling 470,164,222 bytes plus all 27 original CD2 files.
The original EXE/KEY/INI pins recorded below remain unchanged. All 528 accepted source
and 867 compiler pins also matched before and after. No reinstall, download,
fixture copy, recovery inventory, WININIT edit, or foreign cleanup occurred.

Heavy work waited for the **fresh corrected Nox jump/action task's
21:30:16 NEWFULLRELEASE**, followed by an independent actual gate. The sole
attempt ran at approximately 21:30:42–21:30:44 with default Worker/Threads,
WebGL, audio/clock behavior, isolation, and a native 1024×768 viewport.
Crucially, `actual-http-loaded-module.json` hashes the actual browser response
body: HTTP 200, no cache, 1,898,762 bytes, SHA-256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
The runtime Git HEAD was not independently recorded; source/compiler and
loaded-module identities are byte-pinned instead.

The scratch listener wrongly required COOP/COEP headers on every HTTP
response. The optional `build-info.js`, favicon, and font-bundle 404s lack
those headers and set its closing flag. The inspected pre-teardown
`browser-first.png` shows the download window; its state has no guest windows,
`running=false`, and an empty drive trace. The queued Escape was never
processed; trusted-input evidence is empty. Exact guest entry-point execution
is unproven. There is no additional failure screenshot. The executed driver
is preserved separately as `executed-browser.cjs`. The corrected scratch
guard checks document isolation, retaining the independent mandatory loaded
module check; eight focused cases pass, including four failures of the old
guard. **The corrected driver has not been browser-executed.**

Supervisor, controller, board watcher, and monitor have durable successful
waits; six adopted children were explicitly reaped. Chrome exited 0 without
a signal. The final audit found all 20 recorded own PID/start identities
absent, whole Chrome/global crashpad empty, ports 39977/37637 closed, profile
gone, inputs empty, and FD9 free. Minimum observed free space was
2,802,823,168 bytes. Boat ID/state/expiry N/A. No FPS/audio/gameplay claim.

Recovery is in this run's `RECOVERY.txt`, corrected `browser.cjs`, mount
manifest, prerequisite/guard tests, and `full-release-final.json`. Reuse the
retained native installation; do not rerun Setup or legacy preparation.
Next requires a new authorized runtime allocation using the corrected guard
and original D: presentation, then an actual optical-call trace before native
character creation, Prologue DONE, and paired unpaused movement acceptance.
The 42 run artifact references pass schema, existence, and containment checks;
the notes pass `git diff --check`. The global evidence checker still reports
9 historical containment errors, 200 missing references, and 114 invalid
records, with no issue naming this run.

## 2026-10-31 original native installation complete; browser reports No Disc

Run `20261031T2058Z-icewind-install` completed a fresh ordinary installation
from the retained authenticated standalone ZIP. The inspected **Setup Complete**
screen says installation finished; its native Finish button produced guest
`[Exit] code=0`, followed by an explicit successful `Popen.wait`. The installed
destination contains **1,079 files totaling 470,164,222 bytes**. No legacy
preparation, host cabinet/BIF expansion, filtered KEY, rewritten configuration,
save injection, or emulator change was used. The prepared fixture, authored
state, and foreign WININIT prototype were not changed or reinventoried.

Before extraction, the ZIP's 645,596,503 bytes, SHA-1
`cc6345ae7decb43341bde25bb1302f422a42666c`, and SHA-256
`992b3d9054ff089f40dba40debd0fe902117c1a21f80d7e34678ae3313c9ff80`
were freshly verified. All 56 extracted files passed ZIP CRC checks and were
hash-pinned without transforming their contents. Heavy work waited for the
**current Nox direct-route successor's 21:03:51 NEWFULLRELEASE**, then independent
actual PID-start, whole Chrome/global crashpad, profile, ports, and FD9 checks.
That predecessor explicitly lacked durable wait receipts; this run checked
actual absence instead of treating the old 20:43:34 release as sufficient.

The documented bootstrap/replay commands below were reused with paths under
this run: `original-source/icewind_dale_eng_demo/Setup.exe`, `bootstrap/`, and
`installed-vfs/`. The original Setup emitted a 111-file capture and its
557,056-byte `_ins5576._mp`, SHA-256
`a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083`.
The engine and both emitted seed DLLs are pinned in `final-check.json`.
Only SHA-identical source/capture files were hardlinked to keep export space
available; the guest still decompressed its original cabinet itself.

The native Welcome, License, Recommended, CPU Speed, Destination, and Program
Folder choices retained their defaults. At batches 6,100, 12,100, 20,100, and
24,100 the inspected copy screens showed 24%, 41%, 64%, and 86%. The post-copy
DirectX 7.0a prompt was declined with its native No command, ID 7. At batch
30,201, `10-after-optional-directx.png` shows Setup Complete. The attempt to
clear Readme with `dlg-input-click:501` did **not** toggle its check; the
retained control dump and `11-finish-options.png` show it still checked, with
Run Game unchecked. Finish ID 1 at batch 30,213 requested the Readme shell
open and exited normally. No successful Readme launch is claimed. The
controller reported “guest exited while command pending 0” because natural
guest exit interrupted its requested 50-batch step; the guest Exit log and
durable exit-0 wait distinguish this from a deadline or synthetic success.

| Original installed file | Bytes | SHA-256 |
| --- | ---: | --- |
| `iddemo.exe` | 6,283,264 | `b94816d10029cb99c0315f175330c917be2fff298394e853e2764973d8d13af4` |
| `chitin.key` | 216,476 | `c04920810d6663f6e23779c16dadbed88408b4a0528fd79c686d81fd535f6292` |
| `icewind.ini` | 449 | `eec07e40a941ea22c9ebf19631250bac021ecc57cdb8b251b3506b2c004be9fb` |

The installer itself finalized the earlier 316-byte relative INI to
`HD0:=C:\Program Files\Black Isle\Icewind Dale Demo\`,
`CD1:=C:\Program Files\Black Isle\Icewind Dale Demo\CD1\`, and
`CD2:=C:\CD2\`. These are guest-written bytes, not a host correction.
All 27 exported CD2 files match the authenticated source sizes/SHA-256;
246 installed override files and the entire installed closure are pinned.
EXE/KEY match their retained original pins. The new output manifest is a
local pin with native-installer provenance, not an independently compared
upstream installed-tree manifest.

The optional fresh Chrome 151.0.7922.108 probe served those original installed
and CD2 files at their exported guest paths, with an isolated profile,
default Worker/Threads, WebGL, audio/clock behavior, and trusted balanced
Escape inputs. A private app-registry response changed only asset URLs,
guest paths, and working directory; no tracked registry or guest bytes were
edited. The native log reported **“No Disc Detected. Game Aborted.”** at
21:15:59. There was no accepted menu, character, Prologue DONE, tavern, or
movement, and no retry or save injection. Later gray frames are not gameplay.
The next investigation is the original CD2 optical-drive presentation and
native disc scan, preserving this KEY/INI/export. Do not assume that another
INI rewrite or a prepared KEY is required.

The accepted canonical module file stayed
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`;
all 1,395 accepted source/compiler pins matched before and after. No build
was needed because no emulator implementation changed. The browser-loaded
module hash was not independently captured. All installed closure hashes
still matched after the probe. No FPS or audible-output result is claimed.

### Space recovery and an ownership mistake

Safe net reclaim was **2,013,306,880 allocated bytes** after correction:
lossless gzip of stopped terminal transcripts and released completed-run
data, plus 277 SHA-verified hardlink replacements of identical retained WASM
files. Per-file original/decompressed SHA-256 and size pairs, original
timestamps/modes, and hardlink sources are retained in the run's receipts.
`RECOVERY.txt` and `recover-transcript.py` restore a selected compressed
original with hash verification, retain the gzip, and require more than
2.1 GB free after restoration. Hardlinked evidence must be detached by
verified copy/replace before future editing. No original package/fixture
was compressed or removed. Minimum recorded free space during compression
was 2,729,975,808 bytes; final runtime release had 2,873,475,072 bytes free.

The initial release filter incorrectly matched `NEWFULLRELEASE` as well as
explicit `RELEASE`. It compressed the **active Nox profile's**
`ActorSafetyLists/9.8200.9609/listdata.json`, a scope violation. Its original
and decompressed size/hash matched before replacement, but Nox's subsequent
own profile cleanup removed the directory and gzip, so that temporary file
is no longer recoverable here. No foreign process was signaled; the cause
of Nox's separately reported supervisor exit 143 remains unknown. The full
mutation audit and correction were announced on the board. Forty-eight
older files with uncertain release status were restored and hash-verified,
with their gzip archives retained. The filter was corrected to explicit
release records; restored storage and the profile incident are excluded
from the safe net reclaim above. Eighteen tracked evidence originals were
also restored byte-identically, retaining their gzip archives; their storage
is deducted from this final total. Guarded operations also stopped on an
absent target and a changed-size file without modifying those files.

The single combined runtime lasted approximately 10.5 minutes, within the
17-minute target. Extraction, bootstrap, engine, installed audit, and browser
controller have durable successful child waits; supervisor tool sessions
also returned 0. At 21:19, all 23 recorded own PID-start identities were
absent, whole Chrome/global crashpad was empty, ports 34721/40747 were closed,
the profile was gone, inputs were released, and FD9 was free. No runtime
signals were needed. Boat ID/state/expiry N/A. This NEWFULLRELEASE handed
the runtime to the waiting Nox successor; it is not a claim about later
foreign processes.

Recovery starts with this run's retained `installed-vfs/`, not the legacy
prepared fixture or the old partial exports. `runtime.py`,
`extract-original.py`, and the bootstrap `launch.json` preserve the exact
native install route. `installed-all-files.json`, `installed-closure.json`,
`original-cd2-joins.json`, `completion-reviewed.json`, `engine.log`, browser
console/input records, and `full-release-final.json` retain the evidence.
The run's 31 artifact references pass existence/containment checks, and the
notes pass `git diff --check`. The repository-wide evidence checker remains
non-green (9 containment errors, 200 missing references, 114 invalid records);
none names this run. Compressed historical originals require the documented
restore recipe before consumers expecting their former raw paths can read them.
Next: qualify the original CD2 browser mount, then require native character
creation, Prologue DONE, and paired unpaused floor-click movement images.

## 2026-10-31 original package recovered; installation awaits disk space

Run `20261031T2045Z-icewind-recovery` recovered the exact standalone original
package into its own ignored directory, without running the legacy fetch or
preparation recipe. The prior `8f72fa264` original-install absence findings
were reused; the prepared fixture was not inventoried again or modified.
No installed export was recovered and no guest ran.

The retained private file is
`scratch/runs/20261031T2045Z-icewind-recovery/icewind_dale_eng_demo.zip`:

| Check | Result |
| --- | --- |
| Size | 645,596,503 bytes, matching Archive metadata |
| SHA-1 | `cc6345ae7decb43341bde25bb1302f422a42666c`, matching the candidate manifest |
| SHA-256 | `992b3d9054ff089f40dba40debd0fe902117c1a21f80d7e34678ae3313c9ff80` |
| ZIP directory | 60 entries, 679,877,981 uncompressed bytes; no absolute or traversal paths |
| Original `Setup.exe` | 73,728 bytes; SHA-256 `5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52` |

Archive metadata and the source HEAD were checked before transfer. The public
download URL returned HTTP 500 before any bytes were received. The storage
host named by that item's metadata returned HTTP 200 and the expected length:
`https://ia600609.us.archive.org/33/items/icewind_dale_eng_demo/icewind_dale_eng_demo.zip`.
The successful transfer computed both hashes while writing a unique partial
file, fsynced it, and renamed it only after the expected size/SHA-1 matched.
Reading Setup.exe, README.TXT, and DirectX/dxsetup.exe from the ZIP also passed
their ZIP CRC checks; this is not a full cabinet extraction or install test.

The transfer started with about 3.40 GB available and retained at least
2,758,266,880 free bytes during transfer. At the extraction decision,
2,758,172,672 bytes remained. Full source extraction alone would leave
2,078,294,691 bytes, below the requested 2.1 GB early-stop threshold and
2.5 GB reserve. Source plus the historical 470,164,222-byte installed game
would leave only 1,608,130,469 bytes, before bootstrap capture/export overhead.
Consequently no source extraction, unshield operation, installer, build, CLI
guest, or browser was launched. The authenticated ZIP is the completed
checkpoint; original installed KEY/INI/CD2 closure and browser gameplay remain
unverified. Existing prepared assets/authored state and foreign WININIT WIP
were preserved.

Next: make at least another 2 GB available without deleting foreign work,
then extract this authenticated ZIP into a new ignored source directory.
Use the documented native Setup.exe bootstrap and guest-emitted
`_ins5576._mp` replay below, replacing all historical `/private/tmp` outputs
with unique run-local paths. Budget for the source, copied bootstrap capture,
and installed export together. Require actual Setup Complete, guest exit 0,
and hashes of the original installed KEY, installer-written INI, complete CD2,
override set, and served closure. Do not present cabinet extraction as an
installed export. Then apply the current browser-release/actual-process/FD9
gate before the native character → Prologue DONE → unpaused tavern route and
trusted balanced floor click with paired screenshots. No loading, menu,
paused HUD, or historical screenshot is new gameplay evidence.

Evidence: `source-metadata.json`, `source-routing.json`,
`direct-source-head.json`, `package-authentication.json`, `zip-directory.json`,
`checkpoint.json`, and the two recovery scripts in this run. No runtime lock,
profile, server, held input, or test box was created; Boat ID/state/expiry N/A.
The current Nox NEWFULLRELEASE was observed, but no runtime gate was consumed.

## 2026-10-31 original-browser prerequisite audit: blocked before launch

Run `20261031T2040Z-icewind-browser` inspected main input revision
`6ae0e926a61e7e6e0edb3d099c9a0ebaf16e91fc`. **No new browser gameplay or
movement acceptance was obtained.** The existing local fixture is the legacy
prepared asset set, not the intact original installation described below.
No browser, CLI guest, build, or acquisition was launched.

Cheap verification recorded SHA-256 and sizes for all 920 local files
(903,400,058 bytes). The registered `icewind_dale_demo` EXE plus its 919 file
entries all exist; every declared registry size matches. This is a local
inventory pin, not a new upstream-package comparison. The actual EXE is
6,283,264 bytes, SHA-256
`b94816d10029cb99c0315f175330c917be2fff298394e853e2764973d8d13af4`,
matching the existing acceptance pin. Asset identity prevents treating this
as an original-install route:

- Original `CHITIN.KEY` is absent. The registry maps the 181,980-byte
  `CHITIN-full.KEY` to `C:\CHITIN.KEY`; its SHA-256 is
  `6ce928886dbc5df2da1121d37b4b917698c63f54112f3626186ffd53605fe753`.
  The manifest explicitly prepares this altered key and 24 host-expanded BIFs.
- The 319-byte `icewind.ini`, SHA-256
  `feceb019b2d6945e85d0bedcb00367b9e5d5d65d722ad625ce4b81539eaf4e14`,
  contains the prepared `HD0:=C:\`, `CD1:=D:\`, `CD2:=D:\` aliases.
  It is not the original installed configuration quoted below.
- The historical `/private/tmp/iwd-profile-fixed-installed-vfs`, other named
  original-install exports, and original browser harness are unavailable at
  their documented paths. The candidate directory has neither the original
  package ZIP nor its unpacked installer tree. A bounded broader filename
  search found no additional Icewind key before it was explicitly stopped;
  this does not establish absence from every archive or remote machine.
- `test/test-icewind-dale-demo.js` reads and hashes the absent original key
  before it launches a guest. Its eventual `--app` route would still mount
  the prepared key. `test/test-icewind-dale-menu-web.js` tests sustained menu
  labels only and uses renderer input helpers; it does not establish the
  requested trusted browser input or movement. Neither test was run here.

Before considering another build, 1,151 preceding accepted build-input pins
from `20261031T2026Z-nox-browser` were compared: 1,150 match. Only
`index.html` differs while the current Nox worker owns its selector repair.
The existing WASM SHA-256 remains
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
This is a file/source comparison, not proof of a browser-loaded module. No
emulator failure was demonstrated and no implementation/test paths were edited.
Foreign `lib/wininit-boot.js` and `test/test-wininit-boot.js` remain untouched.

Recovery: recover the intact private guest-installed export, including its
original KEY, installed INI, full override set, and original CD2 layout, or
recover and authenticate the standalone original demo package and complete its
ordinary installer into a separate context. Preserve the existing fixture and
authored state. Do not reconstruct a key by reversing the legacy filtering or
inject saves/configuration to satisfy the route. Pin every file actually served
and use the existing original-tree import path before diagnosing a loader bug.
The manifest package SHA-1 remains `cc6345ae7decb43341bde25bb1302f422a42666c`;
it was not checked against newly acquired bytes in this run.

Only after that prerequisite is met, wait for **CURRENT
`nox-candidates-browser-gameplay-main-oct31` NEWFULLRELEASE** (or its explicit
terminal no-runtime release), then independently check FD9, whole Chrome,
global crashpad, PID starts, profiles, and ports before heavy work. This audit
did not consume that dependency or acquire FD9; no runtime/profile/port or
held input was created. Boat ID/state/expiry are N/A.

The next acceptance remains the ordinary native menu → authored character →
Prologue **DONE** → unpaused tavern, with reviewed before/after screenshots of
the same character moving to a distant floor click under trusted balanced DOM
input. Party Formation, loading, a paused HUD, NO DISC, and red log glyphs do
not satisfy it. Native save evidence counts only if the guest writes it.
Evidence is in the run's `registered-files.json`, `fixture-inventory.json`,
`prep-summary.json`, `source-parity.json`, and `lifecycle.json`; no screenshot
exists because no guest ran. Historical CLI movement below remains historical.

Legacy fetch and test (the fetch recipe requires `unshield`; this is not
evidence that the original installer works):

```sh
node tools/fetch-candidate-corpus.js --id=icewind-dale-demo
node test/test-icewind-dale-demo.js
```

## Original installer investigation

### Latest acceptance: original-installed gameplay and quicksave

The local FindFirstFile correction below passes a fresh launch of the clean
`/private/tmp/iwd-profile-fixed-installed-vfs`, not the diagnostic cache
export or legacy extracted fixture. Original EXE, INI, KEY, CD2 files, and
override resources were retained. No guest memory patch or host-expanded
archive was used. The game recreated its own cache during this run.

The single low-priority headless process used `--no-build --no-threads`,
`--control-stdin --frozen`, `--batch-size=200000`, `--time-scale=10`,
`--repaint-every=10`, and the internal `--max-seconds=900` guard. The game
was advanced in short stdio steps and explicitly quit at batch 1996, exit 0.
This is a functional result, not a performance measurement.

Inspected checkpoints:

- Batch 695: `/private/tmp/iwd-find-fixed-party.png`, created `codex` fighter.
- Batch 1095: `/private/tmp/iwd-find-fixed-load-1095.png`, native Prologue
  after guest expansion of the four area archives, no WED assertion.
- Done at (400,435) leaves the chapter and reaches the tavern. Hrothgar's
  opening conversation advances through Continue; Farewell closes it.
- Batch 1885: `/private/tmp/iwd-original-walk-after.png`, selected character
  beside the table at approximately (318,200). The preceding floor target
  at (400,260) was blocked by furniture and is not movement acceptance.
- Click (500,300), step 40: `/private/tmp/iwd-original-walk-confirmed.png`,
  the same character now at the destination with the camera unchanged.
- Q down at 1925, Q up at 1926, then 70 total batches:
  `/private/tmp/iwd-original-after-quicksave.png` at 1996 shows the tavern
  again and the game's **Quick-save successful** message.

The native `mpsave/000000001-quick-save` contains `icewind.gam` (3520 bytes,
`GAMEV1.1`, contains `codex`), `icewind.sav` (1670, `SAV V1.0`),
`worldmap.wmp` (8072, `WMAPV1.0`), `icewind.bmp` (23462), and
`portrt0.bmp` (1678). All five were exported and checked under
`/private/tmp/iwd-original-native-saves/program files/black isle/icewind dale demo/mpsave`.
The default session also contains `codex` in its 2416-byte GAM. This
supersedes the older claim that the numbered quicksave path was unavailable.

Fresh-process reload is now verified as well. The same CLI command mounted
the clean original installation first, then the full native save export with
a second `--vfs-tree`. No cache files were carried over. At batch 330,
`/private/tmp/iwd-reload-list.png` shows the numbered quicksave, its thumbnail,
and the character portrait. Load at (541,102) causes the guest to expand its
original CD2 archives again. A nearly stationary loading bar is not evidence
of a hang: the AR100A output handle advanced from 5,004,288 to 5,410,816 bytes
between batches 1230 and 1530, and AR100D was being written by batch 2330.

Batch 2830 reaches Party Formation with `codex`. Done at (552,432), batch
3030, restores the tavern at batch 3130, with the character at the saved
position near (500,300): `/private/tmp/iwd-reload-tavern.png`. Clicking
(452,330) and stepping 40 moves the character there, visibly confirmed in
`/private/tmp/iwd-reload-move.png`. The historical red `Paused for saving
game` log line remains visible but does not prevent this movement. The
process explicitly quit at batch 3170, exit 0. Shutdown still reports a held
main-thread critical section at `0x006c8f94`; this test does not establish
that all synchronization cleanup is correct.

Remaining limits: browser acceptance of this original VFS is not yet
verified. The Prologue narration body is still blank. Earlier shutdown
diagnostics report one abandoned parked EnterCriticalSection and one held
main-thread critical section; successful gameplay does not prove that
scheduler issue fixed. The legacy acceptance script below still mounts its
modified fixture and must not be cited as the original-install regression.

### Original-install browser probe: not accepted

The temporary `/private/tmp/iwd-original-browser.js` serves the same original
installation and native save export through range-backed providers. It uses
headless Chrome, cross-origin isolation, frozen stdio stepping, and a 900s
internal deadline. It does not mount the legacy fixture. The first harness
attempt omitted profile preparation and stopped on `VfsPendingError` for
`icewind.ini`. Calling the existing `mediaImport.materializeIniFiles` helper
before launch corrects that harness omission without changing file contents.

The subsequent probe still does not establish browser gameplay. After a
relaunch without premature Escape input, it creates `JigSawedME` and opens
the GUI archives and `data/mvefilel.bif`, but the captures at frozen steps
450, 750, and 910 remain gray. The window has no `_dxFrameLayer` at that
checkpoint. Main EIP is `0x008b68c5`; four cooperative secondary threads
exist, with final EIPs `0x005b3344`, `0x00437dd3`, `0x00437d49`, and
`0x0043d3eb`. Escape at steps 750 and 830 did not expose a menu. The last
capture is `/private/tmp/iwd-original-browser-menu.png` (despite the filename,
it is not a menu). The browser and its temporary server were explicitly
closed, exit 0. Rendering, intro progress, and input routing still need to be
distinguished before assigning a runtime cause; no browser fix is claimed.

### Original first-area load: false local file matches

On the Lobby3A build, the clean original-installed VFS completes character
creation through Sound and Name. The inspected
`/private/tmp/iwd-original-party-ready.png` at batch 695 shows the created
`codex` fighter. Accepting the party enters Starting Game, then the guest
itself expands the four original area CBFs into `cache/data`:

| Archive | Expanded Bytes | SHA-256 of Guest Output |
| --- | ---: | --- |
| AR100A | 6613876 | `4134c41a68425cb9a6c98fb5cbb146d6be9aa883aa76e626acb1c7a22ca330a6` |
| AR100B | 8898048 | `1e06cd252940e44040b55c48feae9ed72c0ca52491f71a2c723fbbf8ae269328` |
| AR100C | 6199168 | `87b4f35baba9403c1a5a0efb8f80fe2ed2b43efd604766522533609b5cbd05a1` |
| AR100D | 5072154 | `5bc21fcd750516e2e3f1d97bca9bb7fb9382c3de8fd24736ac6af4020926a648` |

A read-only, in-memory zlib comparison found every byte equal to the original
CBF payload's expansion. No reference output was mounted or substituted.
This rules out decompression corruption for these four files.

The run subsequently asserted at `Infinity.cpp:1763`, "Demand for WED file
failed"; the inspected screenshot is
`/private/tmp/iwd-original-first-load-1245.png`. The guest stack returns to
`0x006559cb`; resource object `0x4ff6c1d0` has locator `0x03600004`.
The original KEY resolves that locator to `AR1006.WED` in BIF 54,
`data/AR100B.bif`. Its expanded file contains the valid `WED V1.3` resource
at offset 23108, length 6586. The failing BIF object's stored path instead
names the nonexistent `override/data/ar100b.bif`.

`VirtualFS.findFirstFile` was allowing exact C-drive probes in absent
directories to match the same basename anywhere in the VFS, including the
real cache file. `createFile` already disallowed that fallback on C:, so
the two APIs disagreed about the existence of the override path. The new
regression fails before the correction; both APIs now reject missing local
paths while retaining exact cache access and the existing non-C media
fallback. VFS (30), lazy-entry (34), overlay (19), and ANSI/OEM filename
tests pass. This is a general path-lookup correction, not a game-specific
resource substitution.

### Earlier Lobby3A checkpoint: character generation reached

The targeted trace after the DP4 fix identified a second rejected interface:
`IDirectPlayLobby2_QueryInterface` at return address `0x008d3796` requested
`{2db72491-652c-11d1-a7a8-0000f803abfc}` (Lobby3A), not another DirectPlay4
interface. Its `E_NOINTERFACE` path released the lobby and abandoned setup.

Lobby3A now upgrades the same ANSI object to the SDK's 19-slot layout,
preserving all 15 inherited slots and appending ConnectEx,
RegisterApplication, UnregisterApplication, and WaitForConnectionSettings.
The signatures follow the [Wine DirectPlay lobby header](https://raw.githubusercontent.com/wine-mirror/wine/master/include/dplobby.h).
These four new operations remain explicitly unsupported, with argument
validation and no fabricated connection or registration success. Unicode
Lobby3 remains rejected. This is ABI support, not full lobby functionality.

The real-thunk `test-directplay4.js` regression passes for both DP4 and
Lobby3A, including identity, inherited slots, worker registry restoration,
HRESULTs, output clearing, and stdcall cleanup. The inherited lobby-address
suite also passes. Full build gates pass: native 1,076,563 bytes,
compatibility 1,077,027 bytes, layout `fc765043612db8cc`.

A fresh low-priority, frozen CLI run used the original install's complete
`/private/tmp/iwd-profile-fixed-installed-vfs`, without substituting the
EXE, INI, KEY, or compressed archives. The trace now reports Lobby3A QI
`S_OK`, followed by `IDirectPlay3_EnumConnections`. Inspected captures:

- Batch 300: `/private/tmp/iwd-lobby3-menu.png`, complete menu.
- Click (480,175), step 50: `/private/tmp/iwd-lobby3-create-game.png`,
  actual Party Formation with six slots, no session error.
- Click (145,145), step 20: `/private/tmp/iwd-lobby3-character-choice.png`,
  the native Create/Delete/Cancel dialog.
- Click (320,215), step 20: `/private/tmp/iwd-lobby3-character.png`,
  Character Generation with its initial Gender step and explanatory text.

The process was explicitly quit at batch 390, exit 0. This fixes the observed
Create Game blocker but is not gameplay acceptance. Next complete a character
and verify first-area loading, unpaused movement, and native session saving
using this original-installed VFS. Older acceptance below used the modified
legacy fixture and cannot establish those results for the original install.

### Earlier DirectPlay4 checkpoint

The pre-DP4 rejection recorded below is now fixed in compiled factory tests.
QueryInterface upgrades the same ANSI object to a generated 53-slot vtable,
preserving its 47 inherited entries and appending the six SDK tail methods.
`test-directplay4.js` loads a Win32 PE and calls the generated thunks through
the emulator dispatch loop, checking slot IDs, HRESULTs, output buffers, and
stdcall stack cleanup. It also checks restoration of the appended thread
vtable registry entry. The factory/identity suite passes 31 cases.

Synchronous local SendEx, send/receive queue queries, and cancellation of
pending queue entries are implemented. Async production/completion and public
group-ownership policy/notifications remain explicitly unsupported; both
ownership methods preserve state/output rather than report false success.
Cancellation tests inject pending entries and do not claim an async transport.
The earlier internal ownership storage is not a completed public contract.

The full build passed (native 1,076,220 bytes, compatibility 1,076,684 bytes;
layout `d36314e0fcee18b2`). A fresh frozen CLI run used only the original
installer's `/private/tmp/iwd-profile-fixed-installed-vfs`, with the same
EXE/cwd and no INI/KEY substitutions. The inspected menu at batch 300 is
`/private/tmp/iwd-dp4-menu.png`. Clicking Create Game at (480,175), then
stepping 100 batches, **still produces Cannot connect to the game session**;
the inspected capture is `/private/tmp/iwd-dp4-create-game.png`. The process
was explicitly quit at batch 400. This is not gameplay acceptance, and the
new result disproves treating the missing IID as the sole session blocker.
Next is a targeted COM/DirectPlay trace beyond the now-supported activation
request. Older checkpoints below describe their respective builds.

### Decoder overlap correction

The long install's exit counters reported roughly 101 million retired
blocks but only 127,641 invalidation calls. The retirement counter also
counts `page_publish` replacing overlapping entries; it does not prove
that the guest modified its code. The hot cabinet loop at relocated
`0x007b4d21` has ordinary interior branch targets. Alternating an outer
entry with an interior entry made the one-owner-per-byte cache continually
retire the other decode.

`decode_block` now emits an ordinary block end when it reaches an already
cached instruction entry, preserving that suffix instead of overlapping
it again. No guest address or cabinet format is special-cased. The focused
regression in `test-sparse-generated-code-cache.js` failed before this
change because the interior entry vanished after re-entering the outer
prefix. It now requires both entries to remain cached while alternating
them, and retains the subsequent shared-immediate rewrite check. Sparse
and cross-instance invalidation, page-chunk allocation, and 138 x86 cases
pass with this correction.

The actual clean installer run on this build passed inspected copy screens
at batch 8750 (30%) and 18750 (56%). Its next large stdio step did not
return a checkpoint for a long interval: a live process and CPU activity
were not sufficient evidence of installation progress. Final output did
establish a new stopping point at batch 27726: the installer left its
copy-progress UI and trapped on the still-unimplemented
`WritePrivateProfileSectionA`. The caller is `0x0041d366`, returning to
`0x0041d36c` in the emitted InstallShield engine. Process exit was 1,
not Setup Complete. Implement and test the real section-writing semantics
before another full installer acceptance; do not silently return success.
Use shorter step requests or a separately accessible control channel so
progress and orderly-stop commands are not queued behind a long step.

`WritePrivateProfileSectionA/W` are now implemented in `db04f9a8`: section
replacement/deletion writes the VFS file, retains an existing UTF-16LE file's
encoding, and reports invalid parameters, missing parents, and read-only
write failures. Single-key profile writes preserve the section-written keys.
The storage regression and full build pass. `test/test-profile-section.js`
also exercises both compiled WAT handlers with guest pointers, Unicode text,
NULL deletion/flush arguments, BOOL/LastError, and three-argument stdcall
cleanup. The original-installer acceptance below now passes; gameplay using
the installed game's original INI/CD layout remains unverified.

### Completed original installation

The clean guest-produced engine replay on the integrated profile-fix build
(1,073,129-byte WASM, layout `f73bfdc3f7f38137`) completed the original
installation. It passed the former profile-section trap, created shortcuts,
and displayed the compatible-DirectX reinstall question at batch 27750.
Answering No with `dlg-cmd:7` reached the actual **Setup Complete** screen at
batch 27800. Finish (ID 1) led to guest `[Exit] code=0` and a successful VFS
export at batch 27840. This is not a deadline-only or copy-progress acceptance.

The separate output is `/private/tmp/iwd-profile-fixed-installed-vfs`.
Its `program files/black isle/icewind dale demo` subtree contains 1,079 files
totaling 470,164,222 bytes. Read-only comparison with the existing
`installed-extracted/Recommended_compressed` reference found 1,076 identical
files, one changed `icewind.ini`, and two installer-created extras:
`readme.txt` and `uninst.isu`. All 640 sound-set WAVs are present. The original
`CHITIN.KEY` is byte-identical to the reference's original key, not the
legacy modified `CHITIN-full.KEY`. The installer itself wrote these aliases:

```ini
[Alias]
HD0:=C:\Program Files\Black Isle\Icewind Dale Demo\
CD1:=C:\Program Files\Black Isle\Icewind Dale Demo\CD1\
CD2:=C:\CD2\
```

No host decompressor or INI/KEY patch supplied the installed payload. The
export also retains the original `cd2` source tree. Next launch must mount
this entire VFS and use the installed executable's guest path and working
directory, retaining the original CD2 layout and compressed resources.
Do not substitute legacy expanded BIFs or the modified key as gameplay proof.

Inspected screenshots: `/private/tmp/iwd-profile-directx-question.png` and
`/private/tmp/iwd-profile-setup-final.png`. The latter shows Setup Complete.
Replay used `--max-seconds=3600 --control=8137 --control-stdin --frozen`.
This terminal closed stdin, so all wizard actions and checkpoints used HTTP.
Long step requests can exceed HTTP's 30-second response deadline while the
guest keeps running: inspect `/snapshot` credits until zero before issuing
another step. Independent file-size checks established continued progress.
The process priority was lowered during high host load; no benchmark was run.

Two follow-up observations are not covered by this install acceptance: the
Readme checkbox input issued a ShellExecute request before Finish, and VFS
export reported an empty `c:\windows` file/directory collision, preserving
the file as `windows.__vfs_file__`. Neither caused a setup error, but both
deserve separate investigation rather than being silently treated as correct.

### Original-installed game startup

A low-priority headless run mounted the complete exported VFS, loaded
`program files/black isle/icewind dale demo/iddemo.exe`, and set both its
guest executable path and working directory to that installed directory.
No INI, KEY, CD2, override, or compressed resource was changed or removed.
With `--batch-size=200000 --time-scale=10 --repaint-every=10`, Escape at
batches 100, 160, 220, and 280 skipped the intro sequences. The inspected
`/private/tmp/iwd-original-game-later.png` at batch 285 shows the full menu
with readable labels, not just background artwork.

Clicking Create Game at `(480,175)` at batch 300 instead produced
**Cannot connect to the game session**. The inspected error screenshot is
`/private/tmp/iwd-original-party.png` at batch 400; despite its filename it
does not show Party Formation. The run was explicitly quit at batch 450.
This differs from the legacy modified-fixture acceptance and remains the
next gameplay blocker. The error text alone does not establish whether
DirectPlay address creation, COM activation, or another step failed.

A subsequent selective DirectPlay/COM API trace stopped at the internal
180-second deadline at batch 200, before the Create Game click. It provides
no failing session API evidence. Note that `--trace-api=Names` also enables
unfiltered file-read/find diagnostics through `_debugReadFile` and
`_debugFindFile`, so even a nominally selective startup trace emits extensive
resource I/O. Next investigation should enable the relevant tracing at the
menu or suppress those independent file diagnostics while retaining the
DirectPlay/COM trace, then compare with the legacy route on the same build.

The follow-up frozen trace identified a concrete interface gap during menu
initialization, before Create Game: at `0x008d3680`, the executable calls
`CoCreateInstance(0x00997c50, NULL, 1, 0x00997c40, out)` with return address
`0x008d3686`. Decoding the original executable's GUID bytes gives
`CLSID_DirectPlay` and `IID_IDirectPlay4A`
`{0AB1C531-4745-11D1-A7A1-0000F803ABFC}`. The caller stores the HRESULT at
`[ebp-0x1c]` and tests it after `CoUninitialize`.

The current `dplay_query_interface_wa` intentionally rejects this IID because
only the 47-slot ANSI DirectPlay2/3 vtable exists. The compiled
`test-directplay-query-interface.js` now reproduces the exact factory request:
`E_NOINTERFACE`, cleared output, and no leaked temporary object. Its passing
negative test describes a missing feature, not working IWD gameplay. The
legacy fixture's earlier success does not establish that it still works on
this newer COM implementation; the original-installed error should not be
attributed to INI/KEY/CD layout without further evidence.

At that checkpoint, the next step was a 53-slot ANSI DirectPlay4 implementation. Its additional methods
are group-owner get/set, extended send, queue inspection, and cancellation by
message or priority, as defined in the
[Wine DirectPlay header](https://raw.githubusercontent.com/wine-mirror/wine/master/include/dplay.h).
Simply accepting the IID on the shorter vtable would permit calls past its
end. Ownership, queue state, cancellation, reference lifetimes, and all tail
stdcall contracts need coverage before changing the current rejection test.
The trace run was explicitly quit at batch 350; its inspected session-error
capture is `/private/tmp/iwd-original-dp4-error.png`.

Implementation has started with an internal ownership-storage prerequisite:
the local entity entry now retains an explicit owner ID. Assignment requires
a live group and a live player; transfer replaces that ID, player destruction
invalidates references to it, and group destruction/Close/slot reuse discard
old ownership. Compiled entity tests cover those transitions and failed
assignments preserving prior state. This is not yet `GetGroupOwner` or
`SetGroupOwner` API support: default selection, membership policy, ownership
notifications/migration, per-object session isolation, and public HRESULT
contracts still need to be established. No DP4 IID or additional vtable slot
has been exposed by this prerequisite.

Internal message storage now retains copied payloads, owner keys, sender and
recipient IDs, unsigned priorities, and non-recycled message IDs. Queries
count messages/bytes or find the oldest match independent of slot reuse;
cancellation is owner-scoped and separates send from receive entries. Storage
is bounded to 64 entries, 1 MiB per payload, and 4 MiB total. Close clears it
even when no entity table has been allocated. The compiled
`test-directplay-message-queue.js` covers those invariants, ID exhaustion, and
copies spanning non-contiguous guest-page backing. `Receive` now consumes
received entries through the public handler, with buffer-size negotiation,
peek, FIFO, explicit sender/recipient filters (including system sender zero),
and sparse destination copies. `GetMessageCount` reports received entries for
the caller's object. Final COM Release removes that object's messages without
removing another object's queue; non-final Release retains them. The compiled
test exercises those handlers and their stdcall stack cleanup. Receive's
copy/peek/filter behavior follows the
[Wine receive implementation](https://github.com/wine-mirror/wine/blob/master/dlls/dplayx/dplay.c).
The storage tests inject received entries directly. A separate compiled
`test-directplay-send.js` now exercises public Send-to-Receive delivery:
local unicast, broadcast and direct group membership, excluding the sender.
Each recipient gets copied bytes and its borrowed receive event is signaled
only after all copies exist. Capacity failure rolls back this send without
discarding prior messages or signaling events. Unknown flags fail, while
streams, security and asynchronous modes explicitly return unsupported.
Entity entries retain creator-object and event fields; sends require a local
sender belonging to the caller and do not silently join unrelated objects.
Close and final Release retire only the caller's entities/messages. Destroying
a recipient discards its unread messages but destroying a sender does not
retract already-delivered messages. Tests cover those transitions, two-object
cleanup, capacity rollback, copied bytes, event ordering, and recipient slot 31.
Provider/session initialization, network/session joining, anonymous sends,
SendEx and asynchronous completion still need implementation. Existing entity
enumeration/mutation methods also need a full session-isolation audit. The DP4
IID remained rejected at that checkpoint; see the latest result above. No new
gameplay pass is claimed.

The original `Setup.exe` successfully emits its InstallShield 5.5 engine
through guest execution. Replay that emitted engine, not a host-extracted
cabinet. The following frozen CLI route uses an isolated build and leaves
the legacy gameplay fixture untouched:

```sh
node test/run.js \
  --exe=test/binaries/candidates/icewind-dale-demo/icewind_dale_eng_demo/Setup.exe \
  '--vfs-include=**/*' --no-build --no-threads --quiet-api --quiet-blocks \
  --no-close --screen=800x600 --batch-size=100000 --tick-ms-per-batch=100 \
  --max-seconds=180 --control-stdin --frozen \
  --capture-launch=/private/tmp/iwd-original-bootstrap
```

Step 100 batches, then quit cleanly and wait for the capture to finish.
`launch.json` identifies the guest-produced
`windows/temp/_istmp1.dir/_ins5576._mp` (557,056 bytes), with its original
`zdatai51.dll` and `_wutl951.dll`. The 96-file capture includes the original
cabinet and CD2 source tree; those source files are copied, not decompressed
by the host.

```sh
node test/run.js \
  --exe=/private/tmp/iwd-original-bootstrap/windows/temp/_istmp1.dir/_ins5576._mp \
  '--exe-guest-path=C:\WINDOWS\TEMP\_ISTMP1.DIR\_INS5576._MP' \
  --vfs-tree=/private/tmp/iwd-original-bootstrap '--cwd=C:\' \
  --dll-seed=/private/tmp/iwd-original-bootstrap/windows/temp/_istmp1.dir/zdatai51.dll,/private/tmp/iwd-original-bootstrap/windows/temp/_istmp1.dir/_wutl951.dll \
  --no-build --no-threads --quiet-api --quiet-blocks --no-close \
  --screen=800x600 --batch-size=100000 --tick-ms-per-batch=100 \
  --max-seconds=300 --control-stdin --frozen \
  --save-vfs=/private/tmp/iwd-original-installed-vfs
```

At batch 300 the Welcome screen is visible. Send
`{"cmd":"dlg-input-click:1"}` and step 50 for the License screen; its Yes
button is ID 6. Accept that button and step 50 for Recommended setup.
Thereafter click ID 1 and step 50 at each of Setup Type, CPU Speed,
Destination, and Program Folder. The unchanged defaults install to
`C:\Program Files\Black Isle\Icewind Dale Demo`. At batch 750 the native
install progress window is visible; at batch 1750 it shows 11%, with
`iddemo.exe` (6,283,264 bytes), `dialog.tlk` (2,942,485 bytes), override
resources, characters, and the first area archive actually written by the
guest. At batch 3750 the progress is 18%; at batch 5750 it is 24%, with
284 files totaling 117,868,153 bytes under the destination (including the
in-progress archive). These screens and file sizes were inspected on the isolated
`6cada250` runtime. This is partial installation evidence, not yet a
completed-install or fresh-installed gameplay pass.

The 300-second internal execution guard stopped normally at batch 7177
inside the guest cabinet DLL (`EIP=0x007b4d3f`), and the VFS export completed
with process exit 0. This exit is a test deadline, not Setup Complete.
The destination contains 284 files totaling 142,198,393 bytes. Read-only
comparison against the legacy reference found 280 byte-identical files;
`Data/chranim.bif` is still partial (52,695,040 of 69,527,564 bytes), and
the original 316-byte `icewind.ini` differs from the legacy patched INI.
The other two files are installer-created `uninst.isu` and `readme.txt`.
The installed EXE SHA-256 is
`b94816d10029cb99c0315f175330c917be2fff298394e853e2764973d8d13af4`.

### Longer execution and interrupted-install replay

A fresh replay with `--max-seconds=1800` reached inspected progress screens
at batches 8750 (34%), 9750 (37%), 10750 (40%), 12750 (47%), 14750 (53%),
16750 (59%), 18750 (65%), and 20750 (79%). The internal deadline stopped
at batch 21190, `EIP=0x007b4edd`, still inside cabinet decompression.
It exited cleanly and exported `/private/tmp/iwd-original-complete-vfs`;
despite that directory name, this is **not a complete installation**.
Its destination has 302 files totaling 407,579,613 bytes, with 298
byte-identical to the legacy reference. The incomplete file is now
`Data/sndspell.bif` (21,606,400 of 22,416,309 bytes). The other differences
remain the unpatched INI and installer-created README/uninstall log.
No payload bytes were supplied by a host decompressor.

Directly replaying the engine from that export exits with guest code 4
before its wizard: `_ins0432.ini` and `_isenv31.ini` have been consumed.
Running the original `Setup.exe` again with the exported VFS succeeds and
emits a fresh engine under `_ISTMP2.DIR`, preserving the installed files.
This capture is `/private/tmp/iwd-rebootstrap` (426 files). Its engine
reaches the same wizard, but selecting Program Folder produces
`unInstaller setup failed to initialize. You may not be able to uninstall
this product.` Dismiss the native message box with `dlg-cmd:1`; unlike the
guest wizard buttons, `dlg-input-click:1` alone did not dismiss it.
This interrupted-install route is not a clean-install acceptance.

It also does **not** resume decompression: after 1000 additional copy steps
the wizard shows 11%, and the previously complete `Data/ar1000.bif` has
been replaced with an 8,632,320-byte partial file. The original partial
`sndspell.bif` is untouched. This probe was quit explicitly; its separate
`/private/tmp/iwd-original-reinstall-vfs` export must not replace the earlier
output. A subsequent completion attempt needs one uninterrupted run with
sufficient internal execution allowance, not repeated partial-VFS replay.

Next: require the actual completion screen and verify the complete output before
changing the fetch recipe or registry. Then test gameplay using the original
installed INI/KEY and CD2 layout. Do not reuse this partial directory as an
installed fixture or assume the legacy KEY/CBF modifications remain necessary.

## Legacy fixture preparation

The package is an outer ZIP containing an InstallShield cabinet and CD-resident
data. The fetch recipe extracts the `Recommended compressed` group and merges
the official `CD2/Data` tree into the local installed `Data` directory. Without
that merge the real executable renders its “insert CD in D:\” screen forever.

The fetch recipe rewrites the extracted portable `HD0:=.\` alias to the
installed layout used by the emulator (`HD0:=C:\`, `CD1/CD2:=D:\`). This
Infinity build's dot-prefix branch strips two characters from the original
`hd0:` resource path, producing malformed `C:\0:\...` paths; the absolute
installed aliases let it open `Dialog.tlk` and its BIF resources normally.

## Local-session startup

The original `IDirectPlayLobby2_CreateCompoundAddress` shim returned `S_OK`
and an output size of zero for every call. Infinity Engine uses the documented
two-call sizing pattern in its local-session initializer: first it supplies a
null address buffer and requires `DPERR_BUFFERTOOSMALL` (`0x8877001E`) plus the
required byte count, then it allocates that buffer and calls again. Returning
success from the size probe made the initializer abort, leaving Create Game to
show “Cannot connect to the game session.”

The handler now sizes and packs each `DPCOMPOUNDADDRESSELEMENT` as a GUID,
data length, and payload. `test/test-directplay-lobby-address.js` pins the null,
undersized, and successful-buffer cases independently of the game.

The localhost dropdown must also mount every archive marked as installed
(`location=1`) in `CHITIN.KEY`. The old menu-only 19-file manifest omitted
`BCSgen.bif` and later installed archives; once DirectPlay succeeded, the
installed-resource pass stopped at `ChDimm.cpp:817`, reported the CD as removed,
and terminated. The dropdown now mounts all 34 location-1 archives present in
the Recommended install.

## CD2 and first-area gameplay

The official package's `CD2/Data` directory supplies 24 compressed area/creature
BIFs, two movie BIFs, and `IWDCD.2`. Merely mounting those files under `D:` was
not enough: manifest mounting registered each file and immediate parent but did
not register the `d:\` drive root. Consequently `SetCurrentDirectory("D:\")`
and the game's `FindFirstFile("D:\\*.*")` disc scan failed even though
`D:\data\IWDCD.2` itself resolved. The VFS mount helper now registers the drive
root and every ancestor, and Win32/DOS `*.*` enumeration also matches
extensionless directory names such as `cd2`.

The CBFs are host-inflated once by local fixture preparation into normal BIFF
files. Its matching `CHITIN-full.KEY` changes the 24 expanded BIFs and two
direct movie BIFs from CD2 (`location=9`) to HD (`location=1`). The
retail-derived KEY also advertises 2,464 resources whose backing BIFs are not
in the official demo at all, including `SNDVO.bif`; leaving those entries
active made the loader run its six-pass, 200 ms CD poll forever for an archive
no disc in this package contains. The prepared KEY retains the 12,682
resources backed by the 60 installed/demo archives and removes only those
dangling entries.

NPC and narration audio that retail stores in `SNDVO.bif` is intentionally
loose in the demo. The dropdown mounts all 188 supplied `Override/*.wav`
replacements. Non-audio override resources are not bulk-mounted at startup:
some intentionally replace UI/game resources and activating the whole
directory before the demo's normal phase switch trips
`ChUIControls.cpp:6668`.

## Character-generation sound sets

The executable's `JigSawedME` window title is the official demo build's
internal name; it is unrelated to the Win16 JigSawed app elsewhere in the
corpus.

After the Appearance dialog, the demo clears panel 45 and dynamically creates
one control per directory returned by `FindFirstFile(".\\sounds\\*")`. With
only `Sounds/sndlist.txt` mounted, the directory scan produced no sound set,
the linked-list loop created zero controls, and the immediate lookup of control
0 returned null. The caller at `0x0069CDD1` then entered the assertion at
`0x00534341` (`ChUIControls.cpp:5945`).

The Recommended install contains 16 official sound-set directories with 40
WAV files each (15 MiB total). The localhost manifest now mounts all 640 files,
which creates those directories in the VFS and keeps Play usable after a set
is selected. The exact acceptance completes Gender, Portrait, Race, Class,
Alignment, Abilities, Skills, and Appearance, then requires the populated
16-set Sound panel after the formerly failing Appearance Done click.

The local acceptance skips the intro, requires the detailed menu frame, clicks
Create Game, requires the large transition to Party Formation, opens a
party slot, and drives character creation through the Sound panel. An error
modal or a generic menu-frame change can no longer satisfy the test. The CLI
capture must retain the menu labels and the Prologue title/buttons as real
light GUI-font glyphs; detailed stone artwork without dynamic text is a
failure, even if the same run later reaches gameplay.

`test/test-icewind-dale-menu-web.js` applies the same label-band gate to a
fresh, no-cache Chrome page and also requires the browser VFS to contain the
2,942,485-byte `Dialog.tlk` plus `Data/GUIfont.bif`. It keeps sampling the
actual 640x480 DirectDraw layer for another 30 seconds after the first complete
menu, so a transient first-good frame cannot satisfy the browser regression.
The repeated blank-label reports were not explained by a stale tab: a later
fresh-page report disproved that earlier diagnosis. Repeated exact Chrome runs
kept 738 label glyph pixels throughout the sustained sampling window; no
runtime change is claimed without a reproducible failing transition.

It then names the character `CODEX`, accepts the party, waits through the real
first-area resource load, and requires the native `PROLOGUE` chapter screen.
The chapter narration body is currently blank, but `REPLAY` and `DONE` render.
Pressing Escape hides this panel without completing it and exposes the tavern
under Infinity's `Paused for chapter text` lock—the exact state previously
misclassified as playable because the acceptance treated red status glyphs as
success. The corrected route activates `DONE`, captures the unpaused tavern,
clicks a distant floor point, and requires the created character's pixels to
move. Acceptance then requires the native multiplayer-session state at
`mpsave/default/icewind.gam` and verifies that its party bytes contain
`codex`; the old `NO DISC IN DRIVE D:` screen and a loading image can no
longer count as gameplay, and neither can a static paused HUD. The demo's Q
path did not produce a complete numbered save slot under emulation, so the
test does not mislabel that unavailable path as the persistence contract.

The app opts only authored state into browser persistence (`Characters`,
`Save`, and `MPSave`). A fresh-Chrome regression writes the native default
multiplayer session through the browser VFS, reloads the page, attaches a new
VFS under the same `icewind_dale_demo` app id, and verifies one restored
app-scoped entry whose bytes still contain `codex`. This covers the actual
multiplayer session path written during character acceptance rather than
treating temporary files as saved character state.

An exact browser run with cross-origin isolation and Threads enabled reached
Party Formation with four secondary guest workers. The manifest-driven CLI
acceptance reaches the first-area HUD and native default session save with the
same dropdown asset list.

## Call-form census (2026-09-29, box 1, uop-tier-design §15.1)

Window: batches 6000-6600, walking in the tavern. Measured with
`--handler-hist --edge-hist --uop-census` and analysed with
`tools/call-form-weighted.js`. As % of all block entries:

- The uop tier covers 76-77%.
- Guest indirect transfers are 0.69%.
- Loops declined for `call-indirect` have bodies of 1.3-1.4%.

Nothing call-shaped is worth a mechanism here.
