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
