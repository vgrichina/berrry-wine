# Army Men CMOS RTC consumer and source candidate

Base `a9dd8b27eb0246d7bddce2c6959071e2d2aa8122`, isolated branch
`task/army-cmos-rtc-oct19`. This source candidate follows the sealed canonical938
white startup described in `army-men-remote-launch-preparation-20261019.md`.
It does not change the installed original, its bundle, or its launch route.

CPUINF32's helper10001ccc selects register0 via OUT70 and reads IN71.
Calibration10001d33 waits for a changing seconds value, samples RDTSC, waits
for another change, subtracts samples, divides by1,000,000 and rounds the MHz
value (10001ed4 onward). Existing `$th_rdtsc` derives cycles from guest
milliseconds times200000, i.e.200MHz, with a64-cycle same-tick monotonic floor.
The CLI's pinned calendar advances by batchTicks, coherent with guest ticks.
No RDTSC implementation change is needed for these units. A real consumer
calibration result still requires a granted native run.

The byte-only WAT path calls synchronous host `cmos_io`. Index and register
state live in a process object shared through `processSharedCtx`. OS Workers
take the generic synchronous guest-rpc path; the browser broker uses the main
host table and the CLI's per-thread tables share this same object. The import
has an i32 result even for writes so index selection cannot be reordered.
The source-only broker fixture exercises that production route without an OS
Worker or wasm. Actual Worker and x86 execution remain unqualified.

Calendar sampling uses the same late-bound `ctx.wallNowMs` and local timezone
as GetLocalTime, including CLI pinned date/UTC policy. Reads never advance time.
The NMI bit is retained in the index latch and masked from register selection;
there is no NMI source/delivery claim. Wider port accesses retain existing
floating-high/ignored-write behavior. Byte input reuses the existing store8,
so upper EAX and flags are preserved; new x86 fixtures await execution.

The [DS12885/DS12887 datasheet](https://www.analog.com/en/ds12885/datasheet)
defines the register contract: B selects BCD/binary and12/24-hour representation;
SET inhibits calendar transfer; A's UIP is read-only; C latches periodic, alarm
and update flags independently of enables and clears on read; D reports valid
time. The implementation provides these polled behaviors. UIP is an explicit
millisecond approximation: asserted during the last millisecond before the
next second, with an instantaneous boundary transfer, not a cycle-accurate
oscillator. SET holds a calendar snapshot until cleared. Alarm history scans
at most the latest25hours; ordinary and wildcard multi-day UTC jumps are tested,
but an older match omitted by exceptional timezone/calendar jumps is not
replayed. Calendar writes, oscillator stop/reset, interrupt enable, square-wave
enable and automatic hardware DST modes fail explicitly. There is no IRQ
delivery, full RTC programming or motherboard CMOS configuration claim.

Host tests cover stable reads, NMI selection, BCD rollover into2000, binary and
12-hour time, SET, UIP/read-only status, RAM, periodic/alarm/update flags,
read-clear across worker contexts, calendar-policy rebinding/timezone, and
synchronous RPC ordering. Host/RPC, worker-import tests, JS syntax, WAT parens,
logical operands, test manifest, import signatures and diff checks pass.
No build, x86 fixture, OS Worker or original game run has occurred for this
candidate. Generated import signatures total282 on this base; combined root
integration must regenerate alongside the separate LockFile import.

Independent source review caught the browser `getImports` adapter dropping
`opts.cmosRtc`, which the direct context-sharing test missed. The adapter now
passes the process device through, and a VM fixture calls the real method for
both main/cooperative contexts, checking shared index/RAM/read-clear state and
separate-process isolation. RTC flag sampling now starts at device creation,
so an initial status read includes elapsed time before first port access.
Both regression cases pass host-only; no browser was launched.

After the first source checkpoint, the owned worktree was narrowed to the
source/lib/tools and relevant test/docs closure:248452KiB to38252KiB. All9
checkpoint changed-file hashes matched before/after; no untracked WIP existed.
This is a source-review checkout, not a complete normal-build checkout.

Next allocation should first build an isolated candidate with normal gates,
then run x86-ops and `test/test-cmos-rtc-worker.js` with recorded module identity.
The latter uses a real OS Worker and the production RPC broker without a PE;
it is written and syntax-checked, but has not been executed.
Only after review should one immutable original Army consumer bundle use that
candidate. Its expected improvement is leaving CPUINF32's clock polling; any
new screen, failure, or game controls require fresh observation. No automatic
game retry is scheduled.

## Remote preparation and first build gate stop

Fresh sandbox `bx_rtue4bvt` received source through normal HTTPS git clone/fetch;
`pngjs@7.0.0` was installed through npm in `/home/user/army-cmos-deps`.
No original binaries were transferred. Exact sourceff594c8 was clean and runtime
source matched reviewedd711; Node24.18.1, free49,088,155,648. Missing original
`test/binaries/notepad.exe` means the existing full x86 suite cannot run there.
New focused native fixture uses deterministic kernel32-native-fixture8704B,
SHA256`6c26eefe8a3fed5bd0d8d9b8c7c3fa0de6daeb5e68d86065ef7bcf9098f833c3`.
It checks byte immediate/DX I/O, upperEAX/CF, stationary clock polling and
200MHz RDTSC delta, with optional actual x86 OSWorker. This is separate from
the required full x86 regression, not a replacement. Syntax only so far.

Granted remote normal build stopped at the first gate failure after4.291s:
callback ownership census reported changed whole-file pins for host.js,
lib/host-imports.js and lib/worker-imports.js. Exit1, no guard, no module,
minimum free49,088,081,920, source unchanged, group19343 absent/controller19304
exited. No subsequent test ran. API receipts/log retained under the local and
remote `scratch/runs/20261019-army-cmos-remote-validation` directories.

Scoped census review compared all three files to basea9dd: additions are only
the synchronous CMOS device/import, process-shared key, and browser option
forwarding. They introduce no guest callback, invocation owner, continuation,
EIP write, exception restoration or retained guest context. Existing producer
classification/reason/ownership remains unchanged; only those three SHA pins
are updated. The census is still an inventory, not a runtime ownership claim.

Controller admission was corrected before retry:2GiB +128MiB baseline
+512MiB transient +128MiB output =768MiB above2GiB. The first remote run's
49GB free satisfied either threshold, but its recorded640MiB threshold remains
preserved honestly. Output cap128MiB/log4MiB, hard stop2GiB+64MiB unchanged.
Build deadline180s, tests60s, owned group termination and absence checks.
No automatic retry. Complete normal build prefix is available through
`tools/army-cmos-precompile-gates.js`, stopping before concatenation/compilation.

The complete prefix subsequently passed on exact1552b9517 remotely in32.985s,
including all normal gates through frozen layout checks. Tracked source stayed
clean and neither canonical nor compat module existed afterward. Receipt
`precompile-api-receipt.json` is retained locally. A future separately granted
build uses a new `build-r2` job name; exclusive-create logs preserve the first
failure, and all `build-*` jobs retain the180s build deadline. No retry yet.

## Granted remote build and focused native results

Root granted the new allocation on exactebc222252. Normal `build-r2` passed
all gates and compilation in26.154s. The two produced modules were:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| Primary tail-call dispatch | 1872080 | `7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33` |
| Compat trampoline dispatch | 1874653 | `a72bbc3829f2ed562ecfb0692bdc2861778b0a0e479806af885e19619a2e0640` |

`test-cmos-rtc-native.js --worker` passed against each explicit module,
including immediate/DX port reads, high EAX/CF preservation, a stationary
clock polling loop, externally advanced clock boundaries and200MHz RDTSC
delta. Its actual OS Worker executed the immediate-port program through the
production synchronous broker. Primary142ms, compat152ms. The separate
`test-cmos-rtc-worker.js` actual OSWorker shared-device check passed in96ms.

All four jobs exited0 without guards, source unchanged, groups absent. Fresh
postflight checked controller/child PIDs22343/22382,22936/22975,23059/23098 and
23155/23194 absent. Minimum across jobs49,063,313,408 bytes. The12 remote text
evidence files (11 seal entries plus artifact seal) were recovered through
permitted API exec output, and all11 content hashes independently matched
locally. The first build failure remains in the same evidence directory.

Runtime released. These are focused native/RPC results, not full x86-suite,
browser, original Army startup or gameplay qualification. Remote notepad.exe
is absent. No old canonical/module/original was changed; no SSH or binary
transfer was attempted. Full `test-x86-ops.js` with its existing original
notepad fixture remains required before integration to main, under a fresh
local allocation. Root owns integration and original consumer scheduling.

## Local full-regression preparation

`tools/army-cmos-local-validation.js` requires an exact current root HEAD and
fresh grant. Its preparation mode writes only a small readiness receipt;
initial stale-head attempts refused before writing, and the first correct
9ec162f38 preparation honestly reported insufficient admission. Root then
losslessly compressed/preserved old combined.wat independently to recover
space. The controller accepts its absence and will rename the existing build
directory, preserving whatever old modules actually remain without copies or
hardlink overwrites.

Measured remote new-build total is24,362,790 bytes: combined20,616,057,
primary1,872,080, compat1,874,653. Aggregate28MiB cap leaves4,997,338 bytes for
all logs/receipts. Per-job logs2MiB, build180s/tests60s,128MiB baseline plus
512MiB transient plus28MiB outputs requires fresh free>2,847,932,416; hard stop
2,214,592,512 unchanged. Checks apply during and after jobs. Root original
notepad is absent; existing shared original53248B SHA256
`e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340`
will be linked only if absent, after admission. Both full x86 runs explicitly
set WINE_ASSEMBLY_WASM to prevent implicit builds, and freshly built module
hashes must equal the remote native-tested pair before either run.

First granted local attempt passed admission but failed before child spawn:
`rename(root/build, evidence/prior-build)` returned EXDEV. No build/test or
fixture link occurred; both old module hashes remained exact. Terminal error
and filesystem inode/device observations are retained in the local run folder.
The controller now preserves the directory as a unique `build-prior-<run-id>`
sibling under the same root parent. No cross-device copy fallback or automatic
retry. A new evidence run ID and fresh grant/admission are required.

## Local normal build and complete x86 suite pass

Root additionally reviewed the original fixture path crossing the filesystem
boundary: the controller now creates an absent-only symlink to the verified
shared original, checking target SHA before/after. Source1fc4dd526,
controllerSHA`f3c0088fe2f0e0fedd2f21c2d941a08ca9b5f2d68cd1f57edc20d8ac358fbe6f`.
Granted run `20261019-army-cmos-local-validation-r3` used root
`9ec162f38a3caaf95b849b95371cd606fa941529`; relevant production sources and
test-x86-ops exactly matched remote candidateebc222252.

Normal build passed in20.653s, producing exact remote-tested7fd02a77/a72bbc38
module hashes above. Existing **full test-x86-ops.js passed293 checks,0 failures
on each module**, primary67ms and compat72ms. Both explicitly named the module
and used the existing original notepad fixture, not the synthetic RTC fixture.
No guard fired; aggregate output24,369,883 bytes before final seal, minimum
free2,835,910,656. Tracked root source stayed unchanged. Controller2803698 and
groups2803734/2804445/2804481 freshly absent;9 artifacts sealed.

Old7c1a12e8/0c8bafc4 modules remain exact in root sibling
`build-prior-20261019-army-cmos-local-validation-r3`; root's lossless old
combined.wat gzip and receipt remain at
`scratch/runs/20261019-rtc-prior-combined`. The verified original symlink target
is `/home/user/wine-assembly/test/binaries/notepad.exe`, SHAe7b01ab8 above.
The earlier EXDEV attempt remains separately preserved. Runtime released.
RTC now has full x86 plus focused native/Worker coverage; original Army
consumer startup/gameplay still requires a separate coherent bundle and grant.
# Installed consumer v4 source-only readiness

Source-only debugger correction for a future same-run handoff: interactive
`w ADDR` previously set the WASM address and sampled its value but did not set
the configured width or `watchActive`. With `--watch-byte=0`, the first check
after continuing could re-arm and replace the original baseline, losing the
first write. The handler now sets `watchAddr` and calls the existing
`activateWatchpoint()`, which applies byte/word/dword size, establishes the
baseline and marks it active. Explicit interactive arming takes effect
immediately even when the command-line watch was delayed; invalid/zero addresses
retain existing non-arming behavior. This changes debug instrumentation only.

`tools/test-debugger-watch-arm.js CHECKOUT` extracts the actual activation,
interactive handler and first-write detector into a VM fixture. Byte/word/dword,
JS-sampled mode, explicit arming before a delayed batch, invalid/zero addresses,
and the old-handler negative control pass. The initial fixture lacked the
prompt's `reason` variable and was corrected before the successful check.
No native/guest run has validated this change yet; sealed v4 remains untouched.

The new same-run handoff is implemented in
`tools/army-men-debugger-handoff.js` and bounded controller
`tools/army-men-installed-dynamic-watch.js`. Start with
`--break=0x43c7ee --break-once --watch-byte=0 --watch-value=0 --watch-log --watch-stack`.
At the actual debugger prompt, verify EIP, read the current EBX CString object
using `d ADDR:4`, then read that object's actual buffer using `d POINTER:64`.
Require a terminated installed-directory path beginning with byte 0x43. Only
then send `w POINTER`, require an acknowledgement with current value 0x43, and
send `c`. The helper issues only debugger read/watch/continue commands; no eval,
fixed allocation or guest-data write. Full prompt/command receipts are retained.
`--control-stdin` is deliberately absent so its JSON reader cannot compete with
the debugger readline input; normal quit uses the existing HTTP control endpoint.

The controller stops on the first qualified watch C-to-NUL transition and stores
the raw record plus pointer/path proof. Missing prompt within 30 seconds or an
invalid handoff is terminal; outer 60/75/90-second and existing 28 MiB output,
4 MiB log, 512 MiB transient admission and disk floor remain unchanged. A watch
record identifies a block boundary, not an exact store. No gameplay inputs are
automatic. Chunked transcript tests cover current-pointer discovery and reject
wrong EIP, NUL path, mismatched watch acknowledgement and unexpected prompts.
These checks pass; real breakpoint/watch delivery remains pending.

Immutable `/home/user/army-men-local-stage-v5-20261019` is derived from fully
reverified v4: 1,596 unchanged files hardlinked, only the runner debugger fix,
controller/helper and provenance metadata differ. Original 433-file installed
VFS, registry, native DLLs and module 7fd are unchanged. Runtime base remains
7c943, with explicit debugger source commit
`21d473f999e170d5e97c39291fb2975f448b6697`; runner SHA is
`527d845ca17212367b6467d45d3b1f168f5d82b848fce6faf52d1947eada81ce`.
The 1,600-file manifest is
`a0cb58ccf67fed0f35cf05f771766bc35d3c46ed99dd05180bd39c1d00a1d821`,
controller `0c6f5430a6fcc1fe05ae99bbfca0bca43622d27d636641d6309b731464ed4c49`,
helper `2d7bf1f458e557e247df739737629039c835d0526f380363d51f0cb9f8e2c1e8`.
Added allocated file bytes are 966,656, excluding directory metadata. Source
closure (95 modules/39 static inputs) and five-native-DLL checks pass; readiness
receipts are in `scratch/runs/20261019-army-men-dynamic-watch-preflight`.
Fresh free at 01:51:21 UTC was 3,087,433,728 bytes, requiring recheck at launch.

Pending separate runtime grant, the command is:

```sh
node /home/user/army-men-local-stage-v5-20261019/controller.js /home/user/army-men-local-stage-v5-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-dynamic-watch-v1 --root-runtime-granted
```

No native run, build or original game retry was performed during this preparation.

The separately granted qualified byte-watch v1 completed with an **unavailable
attribution** result. Evidence is sealed in
`scratch/runs/20261019-army-men-path-watch-v1`. The candidate watch address was
0xe43df0, but this run had no clean boundary identifying that allocation.
Only two trace records appeared: AVI CString at 0xe43cd0 and screens/green
CString at 0x10744a0, both clean. There was no WATCHPOINT hit record and no
qualified C-to-NUL transition. Neither a writer nor absence of corruption is
established. The difference in boundary coverage/allocation addresses is observed;
its instrumentation cause is not yet established.

The menu was captured and visually inspected, then normal quit issued because
qualification was unavailable. No Boot Camp click or other gameplay input was
sent, and no automatic retry followed. Exit 0, no guards, minimum free
3,097,890,816 bytes, all pins unchanged and controller/child freshly absent.
Original prior Boot Camp failures remain valid; this diagnostic does not replace
them or establish gameplay. Finish remains unobserved and prior licence
acceptance remains true.

The renewed, separately granted path-boundary-v2 observation succeeded in
capturing the selected instruction. Evidence is sealed at
`scratch/runs/20261019-army-men-path-boundary-v2`. Three trace records at original
EIP 0x43c7ee show valid `43` (`C`) leading bytes in **both** the native fullpath
stack output and normalized CString: base directory at batch 4 (heap 0xe43df0),
Audio at batch 5 (heap 0x1074500), and Campaigns at batch 557 (heap 0x1136478).
The latter is the same campaign buffer address observed with a leading NUL at
SetCurrentDirectoryA in the prior run. Cross-run address equality is corroborating
context, not proof of an identical live allocation across runs.

This observation rules out a leading-NUL result at these particular fullpath /
CString-assignment / slash-normalization boundaries. The bad write is later for
the observed route; no general correctness claim about those implementations is
made. Menu was inspected before the ordinary Boot Camp click; the guest again
reported `.AMM does not exist`. State and frame were captured and normal control
quit sent on that first failure. Exit 0, no guards, minimum free 2,504,474,624
bytes, all input pins unchanged, child/controller freshly absent. No gameplay,
Finish click or automatic retry. Next source-only task follows the cached CString
lifetime from this clean boundary to `_chdir` and identifies a later write.

Source lifetime review after the clean boundary: game 0x43c7ee reads the
CString length, copies the still-separate stack fullpath to a second stack
buffer, appends the search suffix and invokes its native MFC file-finder object
before destroying that temporary. The directory cache retains the CString at
record+0x14; cache lookup 0x43c404 returns that pointer and 0x43c600 passes it to
native `_chdir`. No deliberate drive-byte zeroing appears in this game path;
that is not proof of a particular aliasing or MFC defect.

Next source-only watch plan uses the first base-directory allocation rather
than a moving Campaigns allocation: retain the same single 0x43c7ee trace and
add `--watch-byte=0xe43df0 --watch-value=0x0 --watch-log --watch-stack`.
This candidate address has been observed repeatedly, but attribution requires
a **same-run** boundary record proving `*[EBX] == 0xe43df0` with leading `43`.
An address mismatch invalidates attribution; do not call another allocation's
change the path corruption. The existing WAT watch checks each block; captured
EIP/prev_eip and stack locate the writer's block, not necessarily the exact
store instruction. A no-hit result remains unavailable. No memory is patched.

`tools/army-men-installed-path-watch.js` preserves the v4 manifest, both plan
sources, all disk/log/output/deadline guards, and original state. Proposed run
is `20261019-army-men-path-watch-v1`, pending a separate grant. The test
`tools/test-army-men-path-watch-plan.js RUNTIME` executes the actual runner's
watch-check function with mocked exports: a filtered 0-to-C change updates the
previous value, then C-to-NUL emits the correct transition and stack once.
It passes without guest execution; native watch delivery is still untested for
this path. Stop on the first qualified bad write / first guest failure, preserve
the raw record and do not automatically retry.

The separately granted path-boundary-v1 attempt stopped at the controller's
initial `fresh disk admission` assertion before evidence-directory creation or
child spawn. Immediate follow-up at 2026-10-19 01:41:01 UTC measured
2,530,099,200 free bytes (bavail 617,700, block size 4,096), below the unchanged
2,847,932,416-byte admission threshold. This is a follow-up measurement, not an
in-assertion sample. There was no guest PID, no trace observation and no automatic
retry. The unused runtime allocation was released. A small terminal preflight
receipt, exact controller copy and artifact seal were subsequently retained in
`scratch/runs/20261019-army-men-path-boundary-v1`. This is a capacity admission
failure, not a breakpoint or game compatibility result; the reviewed observation
plan remains unexecuted.

Granted campaign trace v1 completed and is sealed at
`scratch/runs/20261019-army-men-installed-campaign-trace-v1`. Menu image was
visually reviewed; control receipts show trace-on at batch 1256 and normal
Boot Camp click at batch 1257. Native CRT reaches
`CreateFileA("BootCamp.cpn", GENERIC_READ, share=3, OPEN_EXISTING)` and receives
`INVALID_HANDLE_VALUE (0xffffffff)`. No successful campaign read is shown.
Immediately preceding SetCurrentDirectoryA argument dumps have a leading NUL
byte followed by `:/program files/the 3do company/army men demo/campaigns/`;
the base and Maps path buffers likewise start `00 3a 2f`. These are empty C
strings despite retained path bytes. No SetCurrentDirectoryA return value is
printed, so do not claim a specific error code for that call. The new evidence
narrows investigation to original directory construction / drive acquisition,
before campaign parsing. Original campaign and map files remain unchanged.

Source-only producer follow-up: the observed SetCurrentDirectoryA return site
0xddc5c7 is native MSVCRT `_chdir` (original 0x780095b6 entry, call returns at
0x780095c7). Game 0x43c600 supplies a cached directory CString. Cache producer
0x43c760 calls native `_makepath` via IAT 0x66db8c, then native `_fullpath` via
0x66db90 at 0x43c7c9, copies the result into the CString and invokes slash
normalization 0x43c8c0. That normalization replaces backslashes through MFC's
CString SetAt, then appends a trailing slash when needed. Native `_fullpath`
RVA 0x1dabe calls GetFullPathNameA at original 0x7801db12 and returns its output
buffer without changing the drive letter. Native `_getcwd` RVA 0x6f05 obtains
GetCurrentDirectoryA at original 0x78006f56 and copies the returned string.
The corresponding original disassembly excerpts are retained in the source audit.

The trace identifies the empty directory argument but does not yet identify
which producer first wrote its NUL drive byte. Candidate boundaries are the
GetFullPathNameA/current-directory output, native copy, CString assignment and
SetAt normalization. No general source fix is justified yet. A future diagnostic
should capture these boundary buffers without guest mutation; the campaign
parser is downstream of a proven file-open failure, not the current root-cause
claim. No extra guest run was performed for this source follow-up.

The smallest next observation is one original instruction boundary, 0x43c7ee,
immediately after slash normalization returns. `EBP-0x234` still contains the
native `_fullpath` output on the stack; `*[EBX]` is the separate CString buffer
after assignment and normalization. Capture 64 bytes of each plus the CString
pointer with existing flags:
`--trace-at=0x43c7ee --trace-at-limit=8 --trace-at-mem=ebp-0x234:64,*ebx:64,ebx:4`.
One address avoids the existing multi-address trace fallback to batch size 1.
Eight hits cap the producer records; no API tracing or memory patch is required.
No hit means instrumentation unavailable, not an inferred control-flow result.

If both first bytes are NUL, narrow upstream to `_fullpath`/GetFullPathNameA;
if only the CString first byte is NUL, narrow assignment/copy-on-write/SetAt;
if both are nonzero, the corruption is later. These are conditional diagnoses,
not a claim that either buffer has already been captured. Native MFC42 ordinal
5856 (game IAT 0x66d93c, export RVA 0x60517) is CString SetAt: it calls its
copy-on-write helper, reloads `[this]`, reads index and character stack arguments,
and writes exactly one byte at buffer+index. The game's slash loop passes `/`
and the matching backslash index, so it does not intentionally zero drive byte 0.
No SetAt substitution or bypass is proposed.

`tools/army-men-path-boundary-plan.js` describes this single-point observation;
`tools/army-men-installed-path-boundary.js` retains all v4 pins and prior bounded
controller guards. Proposed unique run is `20261019-army-men-path-boundary-v1`.
The source-only test `tools/test-army-men-path-boundary-plan.js RUNTIME` evaluates
the actual runner expression resolver in a VM with synthetic separate stack and
CString memory; it passes and verifies the three expressions and the hit cap.
Syntax checks pass. This validates parsing, not native breakpoint delivery;
that existing mechanism's earlier unreliable case remains an explicit limitation.
No runtime has been consumed for the plan. Source GetFullPathNameA forwarding
uses four arguments and a 20-byte stdcall return adjustment; its host writer
returns the path character count. Insufficient-buffer semantics remain outside
this observed 260-byte/short-path route and are not asserted as the NUL cause.

The guest again creates its Error dialog with `ERROR: .AMM does not exist`.
Trace was paused, structured state and frame captured, and normal control quit
issued without more game inputs. Exit 0, no guards, minimum free space
3,159,851,008 bytes, all pinned files unchanged and controller/child groups
freshly absent. No gameplay or installer Finish claim.

Trace limitation discovered in the actual raw log: selected startup events
appear despite `--trace-api-paused`. `--trace-api-mem` prevents the quiet-log
optimization (`test/run.js` requires an empty TRACE_API_MEM list for it), so
the intended startup isolation was not fully effective. The raw log is retained
uncropped; the explicit trace-on/off receipts still delimit the reviewed click.
Any future narrowed trace must account for this interaction rather than claiming
that the paused option alone suppressed all startup records.

The subsequently granted v4 observation is sealed in
`scratch/runs/20261019-army-men-installed-rtc-v4`. Original Army Men reached its
640x480 main menu (Boot Camp, One Player, disabled Multi-Player, Options, Quit),
clearing the prior CPUINF32 RTC calibration stall. First and later screenshots
were inspected before the visible Boot Camp click at (176,180), delivered at
batch 1428. That click produced the first concrete guest failure:
`ERROR: .AMM does not exist`. The log records creation of an Error dialog;
the settled snapshot has visible hwnd 0x10003 and focus 0x10004, yield reason 7.
The framebuffer still displays the menu, so the screenshot alone does not show
the error text. Normal control quit was sent when the log failure was identified;
no further gameplay input or retry followed. Gameplay is not demonstrated.

Prepared next trace (source only, no grant consumed):
`tools/army-men-installed-campaign-trace.js` retains the v4 manifest/source/module
checks and 60/75/90-second, 28 MiB output, 4 MiB raw log, 512 MiB transient
reserve and unchanged disk floor. It pins and copies its separate trace plan.
The trace flag is `--trace-api=FindResourceA,LoadResource,LockResource,fopen,fgets,fclose,_chdir,_getcwd,_fullpath,CreateFileA,ReadFile,SetCurrentDirectoryA`,
with `--trace-api-paused`; no host wrapper, breakpoint, deduplication or cropped
log is used. The existing `--trace-api-mem=Name:ARG:LEN` syntax reads arguments
by zero-based index on entry. Selected bounded dumps are FindResourceA name
arg1/64, fopen name arg0/128 and mode arg1/8, `_chdir` arg0/128, CreateFileA
arg0/128 and SetCurrentDirectoryA arg0/128. CRT args are cdecl but use the same
entry stack argument locations. These are entry dumps, not returned fgets data.

After independently reviewing a captured main menu, pipe the output of
`node tools/army-men-campaign-trace-plan.js --reviewed-menu-click` into the sealed
runtime's `node tools/ctl.js -s :8143 pipe`. This sends trace-on, waits for its
actual response, then sends the visible Boot Camp click. Keep both raw receipts.
On the first stable response/failure, similarly send the `--pause` output, capture
snapshot and frame, and quit. The helper never sends commands by itself.
`tools/test-army-men-campaign-trace-plan.js RUNTIME` passes using the actual ctl
client against a mock HTTP server, verifies command order and response handling,
checks selected production parser/control syntax, and executes no guest.

The original 1,486-byte campaign is 45 lines including the final empty line,
maximum line 93 bytes, below the original reader's 255-byte bound. This is a
source workload measurement, **not an expected count of trace-visible fgets**.
The v4 log confirms MSVCRT loaded at 0xdd3000 and EXE imports patched to DLL #4.
Production `patch_caller_iat` resolves named exports to authentic code unless
listed in `native_override_export_api_id` or `crt_override_api_id`; neither list
includes fopen, fgets, fclose or `_chdir`. Original MSVCRT export RVAs derive
guest targets fopen=0xdfa013, fgets=0xdfb80e, fclose=0xddb106 and `_chdir`=0xddc5b6.
These are resolver-derived bindings, not a live IAT dump; the prior run did not
capture IAT memory. Export-table evidence is `crt-binding.json` in the audit.

Therefore builtin CRT API-name tracing is not expected to observe this route's
fopen/fgets calls. Their filters are harmless fallback coverage. The useful
observations are FindResourceA/LoadResource/LockResource and native CRT's lower
CreateFileA, ReadFile and SetCurrentDirectoryA imports (all verified in the DLL).
Native buffered fgets may aggregate many campaign lines into one ReadFile; do
not mistake absent fgets records or low read counts for failed parsing. The
4 MiB raw log limit remains authoritative; abnormal overflow is a terminal,
explicitly truncated observation. No filtered excerpt replaces the retained log.
Successful campaign open/read byte counts would move attribution toward native
CRT/token/structure handling, while failed paths or immediate EOF isolate file
access. Lower-level tracing alone may not fully resolve a parser defect; report
that limit rather than inferring missing data. No additional runtime yet.

Proposed unique run: `20261019-army-men-installed-campaign-trace-v1`, using the
same immutable v4 bundle. Controller SHA-256 is
`145ef07e7f3fb97965c46c1e9b6dda4230deec4b403be27f1f2b4a258022d35d`;
trace plan SHA-256 is
`26459356c485e3bcf282b156d97f33cf66fade73e9bfc90ec23efba8a3a9ec31`.

Read-only follow-up (`scratch/runs/20261019-army-men-amm-source-audit`) establishes
that the installed `maps/bootcamp.amm` is present: 617,160 bytes, SHA-256
`d2258ee1967f1449c64aacb6128ea29de3ef4e8767c7b30e1af8941383c45635`.
`campaigns/bootcamp.cpn` is 1,486 bytes, SHA-256
`2c2196405eb5b93dcf8c72c7ad222bb7870569d282d94a8e94c54fce943cdcfd`,
and contains the explicit `MAPFILE BootCamp` directive. These remain the original
payload hashes. The authentic installed shortcut cwd and registered App Paths
both point to the installed Army Men Demo directory.

Original EXE disassembly at 0x4133df selects `Campaigns`, calls 0x44d3c0 with
`BootCamp.cpn`, then chooses first scenario/mission. Its basename pointer is
`*[0x5f1b00] + 0xd4 + 0xd0 + 0x65` (offset 0x239). At 0x4134bd it appends
literal `.AMM`, selects `Maps` through 0x43c900 and checks the name at 0x43d970.
The suffix-only error supports an empty parsed basename, not missing original
map bytes. The error handler 0x413270 composes `ERROR: `, filename and
` does not exist`; CreateDialog itself succeeded.

Campaign loader 0x44d3c0 first tries FindResourceA with type 10, then
LoadResource/LockResource, falling back to `fopen` when resource lookup fails.
Its parser loop 0x44d590 reads lines through 0x44ea30; the file branch calls
`fgets` at 0x44ea98 and dispatches recognized tokens through 0x44e790.
Directory selection 0x43c900 selects `./` then the requested directory via
0x43c600 and the imported `_chdir`. Static inspection cannot establish whether
the live campaign file open, line reading, or token processing failed. The
existing quiet log does not record those return values.

The next discriminating observation should use existing filtered API/host
tracing for FindResourceA, LoadResource, LockResource, fopen, fgets, `_chdir`,
CreateFileA/ReadFile/SetCurrentDirectoryA and their filesystem host calls,
with unchanged original state and guard limits. If API returns are insufficient,
break at original 0x4133fd after campaign loading to inspect 0x5f1b00 and the
first mission basename before filename construction. No source patch, fabricated
asset, or further game run was performed for this attribution.

Controller/child exited with code 0, no guard reason, minimum free space
2,237,140,992 bytes, all 1,599 input pins unchanged and no process-group survivors.
Fresh review also checked controller and child PID absence. The transient free
space drop approached but did not cross the unchanged 2,214,592,512-byte floor.
Prior licence acceptance remains true and installer Finish remains unobserved.
Next investigation is read-only attribution of the expected AMM filename and
installed asset lookup; this observation does not authorize another game run.

After the local normal build and both full x86 suites passed (293/0 each),
`tools/prepare-army-men-rtc-consumer.js` prepared the unique local bundle
`/home/user/army-men-local-stage-v4-20261019` from the fully verified v3 stage.
It links 1,578 unchanged files and writes changed tracked source from integrated
commit `7c9434f1f202c00044f2edd6c7b3e331740b9960` plus tested primary module
`7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33`.
All prior v3 hashes were rechecked after staging. The 433 installed VFS files,
persisted registry and explicit original/native fixture provenance remain fixed.
Finish remains unobserved; prior actual licence acceptance remains true.

The 1,599-file manifest is
`3b8314c8c4195c8c4c1e4b7a82fb0d42f3b81ebce718d58e1a12bbd3da42b0d9`;
controller SHA is
`26880f1f141669d73b7a4dd19b5c3ca746249362f5c9250704eeabffa7ce0a23`.
Source preflight checks 95 modules and 39 static inputs with no failures;
native production resolution checks all five required DLLs with no missing
dependency. Optional GL/skia dependencies remain absent for this CLI mode.
Additional allocated file bytes, including the manifest, are 7,303,168
(directory metadata excluded). Readiness evidence is in
`scratch/runs/20261019-army-men-rtc-consumer-preflight`.

The new controller preserves 60-second guest / 75-second soft / 90-second hard
limits, 4 MiB log cap and 2,214,592,512-byte hard floor. Output reserve is 28 MiB,
with a separate 512 MiB transient admission buffer and 128 MiB baseline reserve:
fresh free space must exceed 2,847,932,416 bytes, checked again immediately
before spawn. Prior white-run log was 6,130 bytes and its PNGs were 2,060 bytes
each; these compressed white images do not predict gameplay capture size.
Five 640x480 RGBA PNGs plus the log cap and metadata suggest roughly 12 MiB
minimum useful budget; 28 MiB retains margin for larger displays. Planned
captures are at most four reviewed intermediate images plus final PNG, registry
and input receipts, without duplicate VFS/launch exports. Output guard applies
to all evidence. At 01:15:12 UTC fresh free was 2,860,130,304 bytes; earlier
transient readings were lower, so this is not a future admission guarantee.

Pending separate runtime grant, the exact command is:

```sh
node /home/user/army-men-local-stage-v4-20261019/controller.js /home/user/army-men-local-stage-v4-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-installed-rtc-v4 --root-runtime-granted
```

Use the authentic installed shortcut target, cwd and empty arguments. Observe
the first screen, then only visible ordinary menu / Boot Camp controls if reached.
Stop at the first failure; no automatic retry or game-specific patch. No guest
was executed during this staging step and no gameplay claim is made.

### Dynamic watch v1 result (2026-10-19 01:59 UTC)

The granted v5 run reached the debugger at original boundary `0x43c7ee`.
Actual same-run object `0xe43da0` pointed to `0xe43cc8`; the 64-byte read
contained the clean 51-byte path `C:/program files/the 3do company/army men demo/avi/`
and NUL. The ordinary debugger `w` acknowledged byte baseline `0x43`.
After `c`, batch 5 reported that byte changing to zero. At observation time,
EBX was `0x1079ab8` and stack text described `screens/green`; EIP `0x43c7ee`
is an observation boundary, not an identified store instruction. This proves
a same-run byte transition, not corruption: the AVI CString may have been
released or reused. Establish its lifetime and `_chdir` consumption before
attributing the earlier empty-directory failure to this transition.

The controller requested ordinary HTTP quit immediately. The guest then sat
at a debugger prompt; the controller only sent debugger `q` while handoff was
incomplete, so normal quit did not terminate it. The unchanged 90-second hard
deadline killed the group. Postflight reports `signal: SIGKILL`, first reason
`qualified-watch-transition`, minimum free 2,421,628,928 bytes, zero changed
input pins and no survivors. This is a cleanup failure despite useful evidence.
No menu input was sent, no PNG was produced, and gameplay was not demonstrated.
Prior actual licence acceptance remains true; installer Finish remains unobserved.

Evidence: `scratch/runs/20261019-army-men-dynamic-watch-v1`, 15 sealed artifacts,
342,617 bytes before manifest; manifest SHA256
`7cf83404774e64bcb1ccca35837803e0fb58e98eba64a2d054a306c93c0b95ad`.
Raw output, full debugger command/response receipts, qualified transition,
launch pins, and terminal/process review are retained. Controller PID 2870541
and guest/group 2871230 were freshly absent. No automatic retry.

Source-only cleanup follow-up: the controller now recognizes debugger prompts
also after handoff and sends one ordinary `q` when stopping. A chunked transcript
regression covers the watch prompt after HTTP quit, ignores stale earlier
prompts, and prevents duplicate quit. Existing handoff tests and controller
syntax pass. The sealed v5 bundle and failed-run controller remain unchanged;
this source correction has not been run against a guest or staged for retry.

### Correction: outer directory validator intentionally clears failed paths

Read-only disassembly of the original wrapper `0x43c710` supplies a concrete
alternative to lifetime corruption. It calls `0x43c760` at `0x43c723`, checks
EAX, then retries with the other base at `0x43c73a`. If both checks fail, the
path at `0x43c74d` pushes zero character, loads ECX=`record+0x14`, pushes zero
index, and calls known CString::SetAt thunk `0x46fb0e` at `0x43c754`.
That intentionally zeros the leading drive byte. The wrapper returns zero,
but its caller `0x43c320` still links the record and returns `[record+0x14]`
at `0x43c3e8`; `0x43c600` checks the pointer, not its first byte, before passing
it to native `_chdir` at `0x43c618`.

The earlier statement that no deliberate drive-byte zeroing appears was too
broad: the inner producer does not do so, but this outer failure branch does.
The dynamic watch does not itself prove which store executed; its later sampled
EIP must not be labeled the writer. This static path explains why an alive
cached CString can be empty without destructor/free corruption. The immediate
next discriminator is the actual directory file-finder outcome and whether
this same CString reaches SetAt(index=0,char=0), followed by `_chdir` consumption.
Do not substitute files or patch the game to skip validation. Original wrapper
disassembly is retained in `scratch/runs/20261019-army-men-amm-source-audit/directory-validation-wrapper.txt`.

### File-finder semantics and next discriminating observation

Original EXE IAT `0x66d948` is MFC ordinal2770, RVA `0x26d52`
(CFileFind::FindFile); `0x66d944` is ordinal2781, RVA `0x26f7b`
(FindNextFile). The suffix at `0x48927c` is exactly `*.*`.
Original MFC import descriptors confirm FindFile calls FindFirstFileA through
`0x5f49817c`, then native MSVCRT `_fullpath` through `0x5f49805c`.
Either INVALID_HANDLE_VALUE from the first API or NULL from `_fullpath`
returns false. The next method swaps its lookahead/current buffers, calls
FindNextFileA through `0x5f4982c0`, and returns that API result. The game
requires both FindFile and FindNextFile to be nonzero before accepting the
path. This agrees with the lookahead semantics in Microsoft's
[CFileFind documentation](https://learn.microsoft.com/en-us/cpp/mfc/reference/cfilefind-class?view=msvc-170):
FindNextFile may return zero while the current entry is the last match.

A pure-JavaScript query using the pinned v4 VirtualFS and all 433 original
names/sizes, without reading asset bytes or starting a guest, enumerated
base/AVI/Campaigns/Maps/screens-green patterns. Their result counts were
24/4/4/20/36; each first result was `.` and next was `..`. Thus the intended
patterns should pass this two-result check in the current VFS. This is not
proof of actual guest arguments, memory translation, native return values,
or live enumeration state. No generic compatibility defect is established,
so no speculative API or game patch is warranted.

Retained read-only evidence: `filefinder-vfs-query.json`,
`native-mfc-findfile.txt`, and `native-mfc-findnext.txt` in the source-audit
scratch directory. The source-only plan in
`tools/army-men-directory-validation-plan.js` combines narrowly selected
FindFirst/Next/Close, GetFullPathName and SetCurrentDirectory API parameter
captures with three host-return traces and one eight-hit instruction trace
at `0x43c754`. At that pre-call boundary ECX identifies the current CString,
`*ECX` its bytes, and ESP contains index/character. Correlate that same pointer
with later `_chdir` consumption; distinguish initial enumeration failure,
fullpath failure, and exhausted lookahead. Native MFC/CRT internals are not
claimed to be emulated API logs. Startup tracing is intentional; the existing
4 MiB raw log/28 MiB output and runtime limits remain mandatory. No extra menu
input before visual review and no dynamic AVI-to-BootCamp causal claim.

Plan syntax and source protocol checks pass against actual v5 runtime.
These are source checks, not native conformance tests. No guest execution,
new bundle, or runtime retry occurred; root review and a separate allocation
are required before converting this plan into an observation.

### Immutable v6 directory-validation consumer ready, not executed

`/home/user/army-men-local-stage-v6-20261019` preserves the coherent v4 source
7c9434f1, original runner903d9d56, tested module7fd02a77, all433 installed VFS
entries, registry and native DLLs. No debugger breakpoint or watchpoint is
needed, so this deliberately uses the original v4 runner rather than the v5
interactive-w change. Only controller, plan and identity are newly written;
1,597 other files are unchanged hardlinks, with 282,624 additional allocated
file bytes including the new manifest (directory metadata excluded). Both
prior and new manifests were fully checked. The new 1,600-entry manifest is
`11dfd4910afd5eae286220b1aa6de77c8326541a37e793619f5cfb61428ae88a`.
Controller SHA256:
`42a2ec58c02c1e728a07369aaa1d4c6814ac997d692908925f29917a324e9b42`.
Plan SHA256:
`84bb379481ed5ebc5721dd83245ccbfc34e885a9bf6ba911a8eb985e73b4f2ed`.

The controller is the earlier bounded observation controller with exactly the
reviewed directory-validation flags and an explicit original-runner pin.
Control stdin remains JSON and HTTP8143 supports ordinary reviewed input;
there is no debugger stdin handoff. It retains60/75/90s deadlines,4MiB raw log,
28MiB output,512MiB transient reserve, fresh admission2847932416 and250ms
hardfloor2214592512. Source/native preflight passes95modules/39statics/5DLLs.

The plan test executes the actual runner pointer-expression parser on
synthetic ECX/ESP memory, actual API-memory argument parser, actual host-name
parser, and actual production host-wrapper block with synthetic functions.
All three selected host functions preserve arguments/returns and emit return
logs. Existing WAT handlers call these merged host functions; native MFC/CRT
routes into those Win32 handlers, not the builtin fopen family. This verifies
trace setup, not guest forwarding execution or the compatibility outcome.
Eight original43c754 captures maximum; API/host events have no separate count
limit, so the existing4MiB log guard stops excessive output instead of silently
truncating a reported success. Raw logs remain uncropped.

Readiness receipt: `scratch/runs/20261019-army-men-directory-validation-preflight/ready.json`.
Pending root review and separate grant, exact unique command:

```sh
node /home/user/army-men-local-stage-v6-20261019/controller.js /home/user/army-men-local-stage-v6-20261019 /home/user/wine-assembly/scratch/runs/20261019-army-men-directory-validation-v1 --root-runtime-granted
```

No runtime was started. No prior AVI-to-BootCamp attribution is assumed.

### V6 first allocation: pre-spawn admission refusal

The granted directory-validation-v1 attempt exited1 at the initial fresh disk
assertion (`controller.js:26`) before creating an output directory or spawning
a guest. No screen, API trace, or compatibility result exists for this attempt.
The assertion did not record its exact free-space sample. A separate immediate
follow-up at02:08:17 UTC found3,023,462,400 bytes free consistently for `/home`,
`/tmp`, and the bundle using statfs and df, above admission2,847,932,416.
That later value does not invalidate the earlier refusal or prove its cause.
The receipt explicitly distinguishes the two observations; no automatic retry
or threshold relaxation occurred. Root received the runtime release.

Failure receipt: `scratch/runs/20261019-army-men-directory-validation-v1/admission-failure.json`.
All original/source/module identity remains the same; the next attempt, if
separately granted, must use a new unique run directory and fresh admission.
