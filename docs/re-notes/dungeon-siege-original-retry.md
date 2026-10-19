# Original Dungeon Siege retry preparation

Source-only preparation on 2026-10-19. No original retry has run. All 37
extracted files (206,866,962 bytes) were freshly SHA-256 verified in both the
shared tree and recovery root. The ordinary app remains `dungeon_siege_demo`,
launching its original `DungeonSiegeDemo.exe` with no guest patches or injected
acceptance state. Existing acceptance evidence remains in
`scratch/runs/20261019-dungeon-siege-authorized-acceptance-2`: ordinary click
163,432, EULA returned 1, then the original snapshot call trapped. The original
terms and before/after images still match their recorded hashes. No persistent
acceptance state survived that crash; inspect the new EULA before ordinary input.

`tools/dungeon-siege-retry-preflight.js` performs data/source inspection only.
It checks both copies of all originals, acceptance evidence, the validated
module `7c1a12e8bc4b238e8caff2cc81adf85117dc630178cafc1f393a46ef60fc3b23`,
the actual production native dependency graph and disk admission. The root
normal build now matches that candidate; all eight compiled tests already passed
and are not repeated by this recipe.

The actual static native closure is BinkW32.dll, Mss32.dll and ole32.dll.
The prior launch warned that ole32 was absent. Its authentic local fixture is
`test/binaries/explorer98/dlls/ole32.dll`, 790,528 bytes, SHA-256
`bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d`.
This identifies the existing local Explorer98 fixture; this preparation has not
independently established its upstream distribution or licensing provenance.
The preflight refuses the former silent missing-native fallback. It also inventories
original mfc42/msvcrt/comctl32 fixtures, with hashes, without forcing their load:
they are not in Dungeon Siege's current startup graph. Additional dynamic
dependencies remain possible and would be a real next observed boundary.

The root owner can establish the missing ordinary fixture alias, without copying
or modifying original bytes:

```sh
ln -s /home/user/wine-assembly/test/binaries/explorer98/dlls/ole32.dll /tmp/wa-recovery-20261014/test/binaries/dlls/ole32.dll
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-preflight.js
```

Only after a fresh sole-runtime grant and successful preflight:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-controller.js 20261019-dungeon-siege-snapshot-original-1
```

The controller uses the previous ordinary launch settings (`--no-threads` retains
cooperative guest threads), a 90-second guest budget, 105-second graceful deadline
and 120-second outer process-group kill. Logs cap at 4 MiB and total evidence at
64 MiB. Admission must exceed 2,885,681,152 bytes: 2 GiB plus 128 MiB base reserve,
64 MiB output and 512 MiB transient headroom. The stop floor stays 2,214,592,512
bytes; the transient reserve is admission-only. Disk/output violations kill the
guest process group independently of its event loop. No automatic retry.

This is first-game observation, not an installation or persistence qualification.
There is deliberately no `--save-vfs`; full original-mounted VFS export could
need over 200 MiB and would require a larger admission. Original assets and prior
evidence stay intact. Fresh PNGs, logs and registry export capture this observation;
modified in-memory files will not survive it. Output captures are not gameplay
proof. The controller records source/original/native/module pins before launch
and checks them plus process-group absence afterwards.

Use ordinary control commands from the root during the run:

```sh
node tools/ctl.js -s :8141 png /home/user/wine-assembly/scratch/runs/20261019-dungeon-siege-snapshot-original-1/eula-before.png
# Inspect the current image; only if it is the same genuine EULA:
node tools/ctl.js -s :8141 click 163,432
```

Record input response and inspect a fresh after image. User authorization already
permits this ordinary Accept input. Do not assume that prior coordinates apply to
a changed dialog. Write acceptance/result receipts only from observed evidence.

Build storage estimate was about 24.36 MB for wasm/compat/combined products and
22.48 MB for retaining prior canonical wasm/combined, within a 128 MiB output
allowance; the completed root build's measured receipt supersedes that estimate.
The retry needs no new build and only small source/controller files plus evidence.

## Authorized original retry result

Run `20261019-dungeon-siege-snapshot-original-1` used the exact candidate above.
The genuine EULA was visually reviewed and ordinary Accept click163,432 delivered
at batch2715213. EAX1 followed, then the original game thread and game window.
The previous CreateToolhelp32Snapshot fail-fast did not recur in this run; there
was no API trace proving the individual snapshot calls, so this observation does
not replace the eight compiled semantic tests.

The next concrete boundary was the game's `Dungeon Siege Demo Critical Error`
MessageBox: resource read error for `C:\demo.ds`, last error `0x00000017`, at
batch2715249. The text is established by `output.log`; the associated screenshot
is white, not a rendered error dialog. The original `Demo.ds` remains 196,629,356
bytes with SHA-256 `fdb7396ac9823e70d104147b145e2725640a9795bb3b2f5d2f5de55c12bd6505`.
No cause (corrupt original, emulator read semantics, compression or other) is
established by this error alone. No menu or gameplay was observed.

An ordinary control quit stopped the run after that boundary: exit0,82.359 seconds,
no guard trigger, no surviving process group, all recorded pins unchanged, minimum
free disk2,931,118,080 bytes. Registry70 entries and finalPNG exported; no VFS export
by design. Initial PNG was pending during startup but answered at batch5, and
later controls responded; the initial delay does not establish a deadlock.
The last error-side EIP `0x07500cb0` is a host API thunk; final thread EIP
`0x00634ab9` belongs to original DungeonSiegeDemo.exe, preferredbase0x00400000,
RVA0x00234ab9, a jump to0x00634a41. Neither is asserted to be the failed read site.

The run folder contains sealed `acceptance.json`, `observation.json`, original
terms, PNGs, logs, registry, controller, before/after pins and artifact hashes.
There is no exact Dungeon Siege entry in the candidate manifest, so no dashboard
`result.json` was attached to an invented or unrelated candidate. This follows
the Ops investigation-only rule for unregistered candidates. No automatic retry
or additional native test was run.

## Source-only resource-read audit

The registered local manifest names `Demo.ds`, guest path `c:\Demo.ds`, size
196,629,356. `getAssetFiles` merges this manifest into the registered app and the
runner's `addFile` lowercases drive/path lookup while retaining the basename.
There is no `--lazy-ranges` in the launch: despite the download-policy label,
the actual CLI mount uses `setLazyFile` with a synchronous whole-file
`fs.readFileSync` callback, not a range cache or asynchronous byte provider.
`requiredFiles:true` would reject a missing host file before guest execution.

A source-only check used the production `VirtualFS` class, the same `setLazyFile`
callback and original bytes. Opening `C:\demo.ds` against `c:\Demo.ds` succeeded,
reported the full expected size, loaded exactly once, and read all196,629,356 bytes
in1MiB chunks through EOF with the original SHA-256. Receipt:
`scratch/runs/20261019-dungeon-siege-retry-preparation/resource-vfs-source-check.json`.
This excludes a basic case/path/size/provider mismatch in that JavaScript route.
It does not test guest scatter-buffer mapping, the WAT ReadFile wrapper or resource
decoding. No guest or native module was executed for this source check.

The actual run had `--quiet-api` and no filesystem tracing, so its log does not
contain the last read handle, offset, requested/returned count or API result.
Error23 comes from the game's displayed internal-info field; this alone does not
prove a failing Windows ReadFile or identify which operation set it. The inspected
ordinary VirtualFS read path uses error30 for read faults, and this route has no
range provider to attribute a fill failure to. Original archive bytes are intact.

The discriminating next observation, requiring a new root grant, is the same
original launch with built-in `--trace-fs` plus
`--trace-api=CreateFileA,ReadFile,SetFilePointer,SetFilePointerEx,GetFileSize,GetFileSizeEx,GetLastError,SetLastError,CloseHandle`
and `--trace-api-paused`. Enable API logging through ordinary control immediately
before accepting the visually reviewed EULA. Keep the same4MiB log cap,64MiB
output allowance,512MiB transient admission and90/105/120s deadlines. Stop at the
first resource error. Filesystem lines provide handle/path/offset/count; API lines
provide return values and LastError operations. Successful full reads would move
the investigation to guest decoding/mapping; failed or short reads would identify
a concrete range for an isolated semantic test. This is proposed, not run, and
is not an identical uninstrumented retry.

## Prepared trace controls (not run)

The controller now accepts `--trace-reads`, installing only the selected API
filter above plus MessageBoxA, initially paused, and two caller frames for
ReadFile/GetLastError/SetLastError. The existing API logger records caller return
addresses on both main and cooperative threads; filesystem lines include path,
handle, offset, requested/returned bytes, thread and batch. A caller return is the
instruction after the call, not a claim about the exact failing instruction.

Confirmed from current runner source: `{action:'trace-api',on:true}` updates current
and future thread API logging. Control `eval` exposes `ctx.trace`, the shared Set
used by main and cooperative threads; adding `fs` enables filesystem-category
logging. There is no dedicated `trace-fs` control action. `--trace-api` additionally
sets `_debugReadFile=true` even when paused, so some startup read diagnostics can
still print. Preserve the complete raw log within the4MiB cap; do not filter or
discard these records. The filesystem category itself starts disabled, and all
API trace logging starts paused. Startup with tracing has not been measured.

After fresh root runtime grant, the exact proposed launch is:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-controller.js 20261019-dungeon-siege-resource-trace-1 --trace-reads
```

Capture the genuine EULA to that run's `eula-before.png` using ordinary `ctl.js`,
then visually review its title, terms and actual button position. Only after that
review invoke:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-trace-control.js 20261019-dungeon-siege-resource-trace-1 arm-reviewed eula-before.png
```

The helper validates the screenshot/run identity, records the reviewed screenshot
hash and both control replies, and never sends a click. A failed/timeout reply
is terminal for that control sequence, with no automatic retry; inspect the receipt
and stop instead of sending input. After a successful arm, send the ordinary Accept
click at the position just reviewed, retaining its response. Stop at the first
resource error, capturing log and PNG before ordinary quit. `disarm` is available
to pause API/category output, but legacy worker debug-read output may remain until
quit because that worker-local flag is independent of the category Set.

Planning estimate: up to2,000 selected calls at roughly500 bytes each is about1MiB;
actual call volume is unknown, and the raw4MiB cap is authoritative. Prior ordinary
run emitted11,801 bytes, but that does not measure trace volume. No payload hexdumps
or unfiltered API logging are enabled.64MiB total evidence and the same disk and
wall-time limits remain. The root's soft-deadline-then-disk/output hardkill correction
is included: a prior graceful quit request cannot suppress a later safety kill.
Original/core source remains unchanged; only diagnostic controller/helper/docs changed.

## Authorized read trace result

Root integrated the recipe and admitted run
`20261019-dungeon-siege-resource-trace-1` using its controller at source503d3938a,
with measured32MiB output allowance (prior evidence684,032 allocated bytes;
4MiB rawlog,16MiB for at most8 PNGs,4MiB metadata,8MiB margin). Admission was
2,852,126,720 bytes, freshfree2,860,699,648;512MiB transient and hardfloor unchanged.
This supersedes the64MiB planning allowance for this particular run only.

The genuine EULA was visually reviewed. Shared filesystem tracing armed at
batch955513 and API tracing at955613, both control replies successful. Ordinary
Accept click163,432 arrived at1317223. Separate `acceptance.json` retains this
actual acceptance and screenshot/terms hashes. No guessed or automated input.

The raw trace records the resource open and only one resource ReadFile:
handle0x7000000a, offset0, requested/returned0x314 bytes, guestbuffer0x08a00000,
callerreturn0x00429917. The following seek requests distance0x0b9c4f60 with
FILE_CURRENT, callerreturn0x0042bc5d. Legacy read/seek API handlers did not emit
return lines, so the returned seek position and ReadFile BOOL are unknown; the
filesystem's full header count is explicit. No directory-region host read appears
before the error. Raw filesystem lines print synchronously while API lines buffer,
so line order across these channels is not treated as precise operation ordering.

The original game itself calls SetLastError(23) at0x00628d70, return0x00628d76.
Static original disassembly identifies the exact branch:0x00628d62 calls
CRC routine0x0041317f with seed0, a buffer and length `[esi+0x9c]`, then0x00628d6a
compares its result against `[esi+0xd8]`; mismatch sets23. The game's later
SetLastError at0x00628e71 propagates it. This attributes23 to guest validation,
not directly to an observed failed host ReadFile.

The original Tank header gives region offset0x0b9c4f60 (194,793,312),
length0x1c040c (1,836,044), ending exactly at file length196,629,356.
Expected CRC at header0x50 is0x6fdb45eb. The source-only
`tools/dungeon-siege-resource-audit.js` pins both original EXE and resource hashes,
uses the original EXE CRC table at0x006f6468, and independently computes the same
0x6fdb45eb over that region. The original region therefore passes this checksum;
the guest buffer and guest-computed checksum were not captured. Runtime file
materialization/virtual-memory reads or CRC execution remain to discriminate.
The source's reserve/commit/loading paths need further inspection before blaming
a specific implementation; no guest patch or next run is authorized by this result.

Ordinary quit after the concrete error finished exit0 in60.598s, no guard trigger,
no remaining process group,3,281pins unchanged, minimumfree2,859,626,496.
Full rawlog15,559 bytes,24sealed artifacts, registry70 entries and finalPNG retained;
no VFS export. Error and final PNGs are blank white/offwhite, not gameplay.
The close of snapshot0xf8000001 is now explicit in the trace. No retry followed.

## Directory-buffer dataflow and next capture plan (source only)

Original function0x00628d07 passes the file handle, header-derived base
`[esi+0x94]` and length `[esi+0x9c]` to0x0062949f. It constructs a file-slice
object with vtable0x006f6d58 via0x0042bbee, then a virtual buffer via0x006292fb.
This path uses VirtualAlloc/VirtualProtect, not MapViewOfFile. The inner virtual
buffer stores allocation base at+8, length at+0xc, and slice object at+0x14.
The outer CRC owner is4bytes earlier than that inner object. At the CRC owner,
the pointer used by the checksum is `[esi+0xc]`, also copied to `[esi+0x3a4]`.
The exact owner/member offsets must be retained separately; they are different
objects passed through `lea ecx,[esi+4]` at0x00628d19.

Flags in the inner buffer select eager fill0x00629654 versus deferred access.
The eager fill computes a destination from allocation base plus requested offset,
commits/protects where necessary, calls slice vtable+0xc (0x0041cc51) to seek, then
vtable+4 (0x0042bc65) to call ReadFile. The seek helper adds the stored slice base
to its supplied relative offset and forwards the caller's origin. Consequently,
the constructor's observed FILE_CURRENT seek is not sufficient to infer a wrong
actual read offset: the fill path can subsequently perform an absolute seek.
The first header read's stack explicitly includes0x006296ff, the fill return;
no directory fill ReadFile appears before CRC mismatch in the current trace.

Next proposed capture, requiring separate preparation/review and runtime grant:

1. Keep ordinary original launch/EULA acceptance and bounded read traces; add
   VirtualAlloc,VirtualProtect and IsDebuggerPresent/GetVersionExA/GetSystemInfo
   where needed to observe the flags and return values controlling loading.
2. Stop the original at comparison0x00628d6a using the existing debugger breakpoint,
   without modifying guest instructions or state. Record EAX (computed CRC), ESI,
   EDI, expected `[esi+0xd8]`, length `[esi+0x9c]`, pointer `[esi+0xc]`, inner
   virtual-buffer fields and current file cursor. Match the expected length exactly;
   refuse unbounded dumps.
3. Through existing read-only control eval, capture that1,836,044-byte guest buffer
   with address translation checked per guest page, recording unmapped/sentinel
   translations rather than silently reading host-contiguous memory. Return at
   most3MiB JSON/base64 and decode it into the run folder. Compare its CRC/hash and
   first differing byte against the original region. The existing
   `--trace-at-mem` scalar/sample mode is useful, but its whole-buffer mode assumes
   contiguous WASM backing and cannot establish this comparison safely.
4. Stop after the diagnostic capture without another game retry. The existing
   interactive breakpoint waits for debugger input; prepare an explicit controller
   completion/termination path before execution rather than pretending HTTP quit
   alone will resume that prompt. Preserve pre-stop evidence even if no final
   registry export occurs. The existing outer deadline remains authoritative.

Budget: less than3MiB capture response plus1.84MiB decoded buffer, roughly30KiB
page metadata,4MiB capped raw log and existing PNG allowance. This fits the measured
32MiB reserve with its8MiB margin; keep512MiB transient admission and disk floor.
No implementation cause is asserted yet. Guest buffer mismatching the valid file
region would point to loading/mapping; identical bytes with different guest CRC
would isolate instruction/CRC execution. Nothing in this plan authorizes patching
original file bytes, forcing eager mode, or changing reported OS/debugger state.

## Implemented CRC breakpoint preparation (source only)

`--capture-crc` now installs the existing debugger breakpoint0x00628d6a and the
paused read trace. The runner's debugger exclusively owns stdin in this mode;
ordinary EULA controls still use HTTP. The controller recognizes the real debugger
prompt, starts exactly one capture helper, then sends debugger `q` after a complete
diagnostic (including a diagnostic containing unmapped holes). This stops before
executing the comparison branch again. It does not send guest input or continue
guest execution. A rejected/failed capture terminates the group, with no retry.
Debugger quit uses the existing process-exit path, so final registry/PNG exports
are not expected; retain the EULA/after-accept captures and input receipts first.

`tools/dungeon-siege-crc-capture.js` uses self-contained direct-window/DIB/existing
packed-PTE interpretation with bases from the generated RegionMap. It calls neither
JavaScript g2w nor WAT g2w/guest_to_wasm. In particular it cannot invoke the WAT
missing-page path, SEH, lazy DIB access or commit backing. It only reads memory,
register getters and the existing VFS handle Map. The breakpoint EIP, exact
original region fields, owner and precise live slice-handle cursor are checked.
Each guest page is translated separately; sparse noncontiguous pages are copied
from their actual backing. Missing pages retain guest address,length,PTE in the
receipt, EAX and fields remain available, and only genuinely mapped fragments are
saved. No complete buffer or CRC is fabricated when holes exist.

The HTTP response is capped at3MiB with10s deadline; the controller bounds that
helper at12s. Successful complete capture saves1,836,044 bytes in `crc-buffer.bin`
and its SHA-256/CRC, EAX, header expectation, page mappings and cursor separately.
A hole capture saves `crc-mapped-fragments.json` and metadata, never a zero-filled
`crc-buffer.bin`. Raw4MiB logs,32MiB total outputs,512MiB admission transient,
unchanged2,214,592,512-byte stop floor and90/105/120s run bounds remain.

The pure-JS check `node tools/check-dungeon-siege-crc-capture.js` passes scattered
PTE/full-content capture, unchanged guest memory/PTEs/cursor, wrong EIP/length
refusal, missing-page evidence without synthetic bytes, missing cursor refusal,
split debugger-prompt handling, success versus failed-capture completion, and
HTTP success/hole/rejection/overflow paths. It runs no guest/native module/server.

Exact proposed command after coherent-bundle review and a fresh runtime grant:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-controller.js 20261019-dungeon-siege-crc-buffer-1 --capture-crc
```

Capture/review `eula-before.png`, then arm with the existing trace helper for that
run ID; send the ordinary Accept click only after successful arm and visual review.
Capture completion is automatic at the debugger boundary; no extra game input.

The preflight now also compares physical tracked `src`, `lib`, `host.js` and
`test/run.js` against qualified runtime tree13bbe1266 for module7c1. The current
root with integrated RTC sources and old7c1 module correctly refuses; source-only
preflight also observed free2,848,251,904 below2,852,126,720 admission. A coherent
qualified source/module bundle and fresh disk check are prerequisites, not an
invitation to run mixed sources or quietly change the module pin. No runtime was
performed for this preparation.

Root review follow-up: the capture path literal has two source backslashes,
evaluating to one separator. A real production VirtualFS mount/open yields the
same exact code units `[99,58,92,100,101,109,111,46,100,115]`; the apparent four
backslashes were tool-output JSON escaping, not a path defect. The committed
check now uses the production lazy mount/open/seek record and proves a deliberately
malformed two-separator record fails. Its lazy loader throws if diagnostic reads
try to materialize the file. `innerBuffer` explicitly records the embedded-object
address `owner+4`, while `innerFlags` reads the DWORD at that address. This is not
a pointer dereference: original0x00628d19 uses LEA, and0x00629314 writes the inner
object's flags at offset0. The slice remains at inner+0x14 (owner+0x18).

## RTC-qualified bundle readiness

The next capture preflight now pins runtime source
`7c9434f1f202c00044f2edd6c7b3e331740b9960`, primary module
`7fd02a77ec01e5e18065d112b1da434886a0dba3fcadd7ff043d1e2ddca41f33`
and compatibility module
`a72bbc3829f2ed562ecfb0692bdc2861778b0a0e479806af885e19619a2e0640`.
Root qualified this pair with normal build, fullx86 293/0 for each module and
Worker checks; this preparation does not rerun those native tests.

Reviewed13bbe→7c943 runtime diff contains only RTC additions in host.js,
host-imports/worker-imports/signatures, header import and CMOS byte-port dispatch.
Region declarations and generated map are unchanged (map Git blob
`8d420a4bf9f9aa343d6ea4d33876d35d70443ada`), as are Toolhelp, ThreadManager,
filesystem, app registration and test/run.js. Physical root runtime matches7c943.

All37 original hashes in shared/root, prior EULA evidence/native fixtures,
original resource CRC and the complete pure-JS capture checks passed again.
Receipts are `rtc-preflight.json` and `rtc-original-resource-audit.json` in
`scratch/runs/20261019-dungeon-siege-retry-preparation`.
That preflight was **not ready solely for disk admission**: free2,852,065,280 bytes
was61,440 below the strict greater-than2,852,126,720 threshold. No runtime started.
The same proposed `--capture-crc` command above remains subject to fresh admission
and an explicit sole-runtime grant; Army's consumer retains priority.

## First CRC capture attempt: breakpoint not observed

Authorized run `20261019-dungeon-siege-crc-buffer-1` used coherent7c943/7fd/a72,
controller427a1a906 with the grant-required250ms disk polling. Fresh admission
passed at2,858,545,152 bytes. Genuine EULA inspected, filesystem/API traces armed
at1225198/1225287, ordinary Accept at1539797. The explicit
`--break=0x00628d6a --break-once` is present in preserved `launch.json`.

The debugger never reported the breakpoint or emitted its prompt. The game reached
the same SetLastError23/resource-error boundary. The capture helper was consequently
never invoked: **no guest buffer or page-hole evidence exists from this attempt**.
Ordinary HTTP quit stopped at that first concrete failure; no automatic retry.
Guest exit0/controller exit1 (`captureComplete:false`), guardsnone, process group
absent, all pins unchanged,71.652seconds, rawlog15,635bytes. Minimum free disk
2,242,883,584 stayed above the2,214,592,512 floor. Registry/finalPNG exported because
execution never entered debugger quit. Actual EULA acceptance is recorded separately.

This is a diagnostic-harness failure, not a successful CRC capture. Source review
shows the debugger's `$run` check and folded-region side exits compare block-entry
EIP; the chosen cmp0x00628d6a follows `add esp,0xc` at CRC return0x00628d67 within
that block. Argument resolution, break-once behavior and all active execution paths
remain under source inspection before changing the observation method. No optimizer
mode, guest bytes or runtime source was changed, and no identical retry followed.

## Corrected capture boundary (source-only, supersedes earlier capture commands)

The selected address was an interior instruction, not an established instrumentation
bug. `test/run.js` parses the single numeric `--break` using `parseInt(s,16)`,
arms `set_bp` at batch0 and restores it after DLL load. `--break-once` suppresses
re-arming after a hit; it does not prevent the first arm. No thread filter or
benchmark-chain breakpoint option was requested. `src/13-exports.wat` checks EIP
at the run-loop block boundary and derives chain/tier guards from the breakpoint.
The folded-region side exit in `src/07c-block-exec.wat` likewise checks interior
**block entries**, not each instruction. The CALL decoder in `src/07-decoder.wat`
ends the decoded block, and `th_call_rel` saves its next address before branching.

Original bytes at00628d62 are `e8 18 a4 de ff 83 c4 0c 3b 07 74 0c`:
CALL0041317f returns to00628d67 (`add esp,0xc`), followed by CMP00628d6a.
The corrected breakpoint is **00628d67**, before stack cleanup; EAX retains the
computed CRC and ESI the owner. The helper does not depend on ESP or comparison
flags. Controller and helper now agree on this return boundary and refuse the old
interior EIP. Original bytes, runtime source/module and optimizer settings remain
unchanged. No compiled breakpoint behavior is newly qualified by these JS checks.

`node tools/dungeon-siege-resource-audit.js` verifies the original executable hash,
exact CALL/following bytes, signed displacement to0041317f, return00628d67 and
the unchanged original resource CRC6fdb45eb. The complete pure-JS capture suite
passes, including old-EIP refusal both locally and in the mocked HTTP reply,
scattered pages, holes, unchanged memory/cursor and debugger completion. The prior
failed attempt and its23-artifact seal remain intact; no captured CRC is available.

Next proposed command, **only after a fresh sole-runtime grant and admission**:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-resource-audit.js
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-controller.js 20261019-dungeon-siege-crc-return-1 --capture-crc
```

It retains the coherent7c943/7fd/a72 preflight,37 original hashes, strict admission
free>2,852,126,720,250ms hardfloor2,214,592,512,90/105/120second deadlines,
4MiB rawlog/3MiB response/32MiB total output and512MiB transient reserve. Inspect
the actual EULA, use `arm-reviewed` with its screenshot, then ordinary authorized
Accept. The helper captures read-only at the return block entry and issues debugger
quit; stop on first failure with no retry. Runtime remains ungranted for this recipe.

## Corrected return capture result

Authorized `20261019-dungeon-siege-crc-return-1` ran the exact1e8 tools against
coherent7c943/7fd/a72. Actual EULA screenshot `eula-visible.png` was reviewed;
filesystem/API traces armed at1379886/1379958, ordinary Accept at1382627.
The original CRC return00628d67 stopped at1382663 (post-threads), then the
ordinary debugger prompt at1382664 invoked the read-only helper and debugger quit.
No instruction after this return boundary was deliberately continued.

ESI owner0862be7c, innerFlags0, buffer08a10000, length1,836,044, pageSize4096,
slice08683644. All449 pages have PTE0 and all1,836,044 bytes are reported as
unmapped holes; mapped fragments are an empty array. **No guest buffer bytes were
captured or synthesized.** EAX CRC96e4949a differs from expected6fdb45eb. A separate
source-only calculation using the original CRC table gives96e4949a for1,836,044
zero bytes (andfb5037c2 forFF bytes). This matches the zero-fill hypothesis; it is
not a substitute for captured bytes. The immutable original directory CRC remains
6fdb45eb. `crc-comparison.json` records that distinction explicitly.

The live slice file handle7000000a is at194,794,100 = directory offset194,793,312
plus788-byte header. The trace contains that full header read and constructor's
relative seek, but no payload ReadFile before the CRC. Cursor position alone does
not establish a seek bug: the eager-fill routine would seek absolutely before
reading. The next source question is why the reserved buffer was never committed
and populated before CRC, including default unmapped-access/SEH behavior.

Guest/controller exit0, capture helper success with holes, guardsnone, all3289pins
unchanged, process group absent;57.162seconds, rawlog14,910bytes, minimum free disk
2,600,574,976. Debugger quit intentionally bypasses finalPNG/registry export.
Actual EULA acceptance is separately recorded, with no gameplay claim. The21-file
artifact seal and observation SHA
`74e93fefbf5e2b1de0a14f625f745c594e69c8f9cc39bfe015259d712e739f89`
are retained in the run folder. Runtime released; no retry or guest/core changes.

## Reserved-buffer and original exception-filter source proof

The captured innerFlags0 selects the lazy path in the immutable original:

- At0062939d, flags bit4 is clear, so006293a6 produces AL0. The arithmetic at
  006293a8..006293c4 produces flProtect1 (PAGE_NOACCESS), type2000 (MEM_RESERVE).
  Call006293c7 through VirtualAlloc IAT006f5188 reserves the buffer. This is a
  disassembly/dataflow inference from captured flags, not a recorded allocation
  API entry. At0062944e bit1 is also clear, skipping eager fill00629654.
- Constructor00629281 registers0062978e at006292ae via0041465b into the original
  filter list at00768b9c. Caller00628bd8 installs an FS:[0] registration with
  guest handler00409ef0 and scope table006fb2f0. Active scope1 at006fb2fc is
  `{enclosing:0,filter:00628cb0,handler:00628cbf}`; filter00628cb0 calls00414699,
  which walks the registered filters and returns the first nonzero result.
- Filter0062978e accepts access violationC0000005 or guard-page80000001, finds
  the registered buffer containing ExceptionInformation[1], checks write access,
  then calls00629765. That helper aligns the fault offset to the captured4096-byte
  granularity, bounds the page to buffer length and calls00629654. The fill routine
  commits with VirtualAlloc(type1000,protect4), applies VirtualProtect, seeks the
  slice absolutely through0041cc51, and reads real file bytes through0042bc65.
  A successful fill returns filter value-1 (CONTINUE_EXECUTION). No resource bytes
  or decoder results are supplied by an emulator shortcut in this route.

Default `$fault_unmapped` is0 in `src/01-header.wat`. Dungeon's current app entry
has neither page-fault option, and CLI `FAULT_NULL_MODE` resolves to0 without an
explicit override. `src/03-registers.wat` `$g2w_slow` treats a missing packed PTE as
authoritative and calls `$g2w_miss`; mode0 clears/returns NULL_SENTINEL without
SEH. `$gl8` then reads that zero byte. This is consistent with all449 missing PTEs,
no payload ReadFile, and the exact zero-fill CRC. It does not imply file corruption
or a seek implementation bug.

The already-supported `reservedPageFaults: true` app capability selects mode5 in
both CLI and browser/Worker setup. Mode5 calls `$seh_fault_sync` for a reserved
miss outside API/reentrant fault handling, runs the original FS:[0] handlers,
retranslates a page committed by a handler, and preserves interrupted CPU/decoded
stream/page state. It retains bounded/filter limitations: unhandled, nonreturning
or uncommitted cases may still return the sentinel; this is not complete arbitrary
access-violation semantics. No global-default change is proposed.

Proposed correction for root review: add only `reservedPageFaults: true` and a
brief source-evidence comment to `dungeon_siege_demo` in `lib/apps.js`. This
registers a general supported guest capability; do not pass a diagnostic mode
override, force the original eager path, or alter guest bytes. First validate the
existing native `test-fault-reserved-sync.js` (mode0 negative, reserved vs
unreserved, search/continue, CPU/stream restoration) and
`test-fault-reserved-page-cross.js` (actual guest commit/decommit filter and
cross-page read/write retranslation). These tests were inspected, **not run** in
this source-only follow-up. They do not alone prove the original file-I/O filter:
the next bounded original capture must show actual payload reads, populated PTEs,
and the original directory bytes/CRC6fdb45eb. Preserve first failure if it instead
reveals an unsupported filter behavior. A changed app registration requires an
explicit coherent source-pin update and runtime grant before that observation.

## Registered capability and pending bounded controls

Source commit5441ffb94 adds only `reservedPageFaults: true` plus its evidence
comment to Dungeon's app entry. It is based on reviewed main462f44b2f; runtime
diff versus qualified7c943 is exactly `lib/apps.js`. Compiled source remains
identical, so the exact7fd/a72 module pair is retained without rebuilding it.
The preflight now distinguishes the validated module source7c943 from the expected
candidate runtime5441ffb94 and refuses the old registration. Root preflight was
run source-only: originals/native/module pins passed, but readiness correctly
failed with runtimeDiff `lib/apps.js` before root integration.

`check-dungeon-siege-page-faults.js` loads both browser and CLI registries and
compares them against7c943: only this capability changes; every other app entry,
asset and serialized launch preference remains identical. It passed, as did the
complete capture checks. The two existing reserved-page native tests now accept
`--compat`, selecting `tailCalls:false` through the existing canonical compiler;
test semantics remain unchanged. No native controls have been run for this change.

`dungeon-siege-seh-controls.js` is the proposed sole-runtime outer controller:
four sequential jobs (reserved-sync tail/compat, page-cross tail/compat), each with
fresh>2,852,126,720 admission,250ms floor2,214,592,512,180second outer process-group
deadline and4MiB rawlog cap. It stops after the first failed job, checks group
absence and hashes all present tracked runtime/test/tool files plus both canonical
modules before/after. Four capped logs need16MiB; pins/receipts/controller fit
the remaining16MiB output allowance. Compilation is in memory; no canonical
module output is overwritten. The512MiB transient reservation remains unchanged.
The whole-controller mocked tests passed all four job sequencing, nonzero-exit
stop, disk/deadline/log group kills and environment sanitization.

After root review/integration and explicit runtime grant:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-seh-controls.js 20261019-dungeon-siege-seh-controls-1
```

Only after all four controls pass and root grants the original observation:

```sh
node /tmp/wa-dungeon-thread-oct19/tools/dungeon-siege-retry-controller.js 20261019-dungeon-siege-crc-reserved-1 --capture-crc
```

The latter keeps90/105/120seconds,32MiB total,4MiB rawlog,3MiB response,
250ms disk check, fresh admission, visible reviewed EULA/ordinary Accept,
pure read-only PTE capture and debugger quit. No `--fault-null`, optimizer option,
guest patch or global fault default changes. Source readiness is not runtime
qualification; failed original SEH/I/O behavior remains a terminal result.

Root review added a32MiB **aggregate** output guard, checked every250ms, before
each job and at child completion. It counts the whole run directory plus positive
file growth under render-helper's `test/output`, without following symlinks.
Child TMPDIR/TMP/TEMP point to the run's guarded `tmp` directory. Mocked aggregate
run output and render-output growth both kill the process group and prevent the
next job. Existing files are preserved; no output cleanup occurs automatically.

Source closure verification: `test/render-helper.js` stores compiled extraWat
Buffers in its process-local `harnessWasmCache` Map; `test/compile-src.js` calls
`compileClosure` with an in-memory VFS, and `tools/watx.js` reads the vendored
compiler into a VM with no filesystem API exposed to it. There is no compiled
module cache/temp-file output on this path. The two tests call neither renderer
screenshot writer nor any filesystem write. Expected new disk cost is the run's
pins/metadata plus four raw logs (<=16MiB), all bounded by32MiB; the separate
512MiB transient reservation conservatively covers unrelated observed disk dips,
not a claim that the test writes a512MiB module or that all external use is bounded.

## Reserved-page native controls qualified

Authorized sole-runtime `20261019-dungeon-siege-seh-controls-1` used reviewed
controller e0880dfe on root task9cd1069e3, runtime/test content5441ffb94. All four
jobs passed: reserved-sync tail and compat, page-cross tail and compat. Each
canonical-compiler extraWat module ran its actual guest SEH controls; no normal
module rebuild or original game was executed. Per-job elapsed2.855/2.994/2.781/
2.868seconds, exits0, guardsnone, all process groups absent. All3255 runtime,
fixture/tool and canonical-module pins were rehashed unchanged after every job
and again at sealing. Minimum free disk3,105,017,856bytes;17 artifacts total
544,435bytes before the seal itself, temporary directory empty.

`validation.json` SHA
`97148cb334ee5cac5d768247de906b0b72f4dd458839705d42c126fc17e70397`
and artifact hashes preserve the four raw logs and receipts. This qualifies the
existing synchronous reserved-page and page-crossing controls in both dispatch
modes, not the original game's file-I/O filter or gameplay. Runtime released;
the separately granted bounded original `crc-reserved-1` capture remains next.
