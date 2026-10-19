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
