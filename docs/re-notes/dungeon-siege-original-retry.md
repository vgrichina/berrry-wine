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
