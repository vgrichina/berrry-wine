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
ln -s /home/user/wine-assembly/test/binaries/explorer98/dlls/ole32.dll ole32.dll
node dungeon-siege-retry-preflight.js
```

Only after a fresh sole-runtime grant and successful preflight:

```sh
node dungeon-siege-retry-controller.js 20261019-dungeon-siege-snapshot-original-1
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
node dungeon-siege-retry-controller.js 20261019-dungeon-siege-resource-trace-1 --trace-reads
```

Capture the genuine EULA to that run's `eula-before.png` using ordinary `ctl.js`,
then visually review its title, terms and actual button position. Only after that
review invoke:

```sh
node dungeon-siege-trace-control.js 20261019-dungeon-siege-resource-trace-1 arm-reviewed eula-before.png
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

Measured trace output budget (2026-10-19): prior complete observation retained 20 files, 636835 logical bytes / 684032 allocated bytes, including 536028-byte runtime pins. Trace retains the 4 MiB raw log cap; reserve 16 MiB for up to eight 800x600 PNGs (2 MiB each), 4 MiB for pins/registry/control/metadata and 8 MiB additional margin. Total output cap and admission reserve are now 32 MiB, with no VFS export. The independent 512 MiB transient admission buffer and 2214592512-byte hard floor are unchanged. This is a measured output estimate, not evidence of a trace run.

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

## Resource CRC and lazy-page findings (2026-10-19)

Original resource-directory CRC comparison is at `0x00628d6a`, after the
CALL at `0x00628d62` to `0x0041317f`. The reliable block-entry observation
point is its return `0x00628d67` (ADD ESP,12), not the interior CMP.
The CRC owner is four bytes before its embedded virtual-buffer object:
owner buffer pointer `+0xc`, length `+0x9c`, expected CRC `+0xd8`;
inner allocation base `+8`, length `+0xc`, slice `+0x14`.

The actual return capture recorded EAX `0x96e4949a`, expected `0x6fdb45eb`,
buffer `0x08a10000`, length1,836,044 and 449 missing packed PTEs. No guest
buffer bytes were captured or synthesized. The original file region has CRC
`0x6fdb45eb`; independently applying the original CRC table to1,836,044 zero
bytes produces `0x96e4949a`. This supports a zero-read hypothesis rather than
corrupted original media. Slice handle `0x7000000a` was at194,794,100
(directory offset194,793,312 plus788-byte header); no payload ReadFile
preceded the comparison. The fill routine seeks absolutely, so that cursor
alone does not prove a seek defect.

Captured innerFlags0 takes MEM_RESERVE/PAGE_NOACCESS at `0x006293c7` and
skips eager fill `0x00629654`. Constructor `0x00629281` registers filter
`0x0062978e` through `0x0041465b`; the native FS handler `0x00409ef0`
uses scope table `0x006fb2f0`, active filter `0x00628cb0`. The filter
accepts C0000005/80000001, finds the registered buffer, aligns the fault
offset through `0x00629765`, commits the page, seeks via `0x0041cc51`,
reads through `0x0042bc65`, and returns CONTINUE_EXECUTION. The default
unmapped sentinel does not execute this file-loading path. The existing
`reservedPageFaults` capability enables mode5 synchronous guest SEH; it
retains eligibility, nesting and unhandled-fault limitations.

A capability-enabled original startup subsequently stalled in resolver
`0x004178eb`. The first-entry capture found a healthy SHFOLDER.DLL table
requesting SHGetFolderPathA(required) and SHGetFolderPathW(optional),
with present pages and normal string termination. Module `0x00400000`
is the loader's existing bare-DLL compatibility alias, not a proven handle
defect. It does not identify the later faulting iteration. Existing
`unmapped_trace` is reached after unsuccessful/skipped mode5 handling and
cannot recover the first pre-dispatch fault state. See the separate
[fault observer investigation](dungeon-siege-fault-observer.md).

### Further static addresses (Recovered from branch `task/dungeon-thread-snapshot-oct19`, Oct 2026)

- The game itself sets last error 23 on CRC mismatch (`SetLastError` at
  `0x00628d70`, propagated at `0x00628e71`); it is guest validation, not a
  failed host ReadFile. CRC table is at `0x006f6468`.
- `C:\demo.ds` Tank header: directory region offset `0x0b9c4f60`
  (194,793,312), length `0x1c040c` (1,836,044), ending exactly at file length
  196,629,356; expected CRC at header `+0x50`. `tools/dungeon-siege-resource-audit.js`
  recomputes `0x6fdb45eb` over that region from the original table.
- Directory load path: `0x00628d07` passes handle, base `[esi+0x94]` and length
  `[esi+0x9c]` to `0x0062949f`, which builds a file-slice object (vtable
  `0x006f6d58`, via `0x0042bbee`) and a virtual buffer via `0x006292fb`
  (VirtualAlloc/VirtualProtect, not MapViewOfFile). Inner buffer flags bit 1
  selects eager fill `0x00629654`; slice vtable `+0xc` (`0x0041cc51`) seeks
  relative to the slice base, `+4` (`0x0042bc65`) reads.
- Resolver `0x004178ad` (block `0x004178eb`) walks 12-byte records calling
  GetProcAddress (IAT `0x006f50a0`); LoadLibraryExA is IAT `0x006f52f0`.
- Ruled out: a blanket inability to run an MSVC `_except_handler3` scope filter
  that commits a reserved page and fills it with real ReadFile bytes under
  mode5 (native fixture passed, tail and compat). The capability-enabled
  startup stall is still unexplained. `$seh_fault_sync` runs each FS handler for
  up to 64 rounds of 1,000,000 blocks over at most 64 chain nodes, does not roll
  back guest memory on give-up, and is skipped (sentinel) at API depth > 0 or
  while already raising.
