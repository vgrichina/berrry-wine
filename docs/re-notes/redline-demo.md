# Redline (Accolade / Beyond Games, 1999): original single-player demo recovery

## Backend failure retained: upload returns zero after successful surface creation (2026-11-01)

Run `20261101-redline-backend-first-failure` makes **two original CLI
invocations**. The second retains **two complete resource-723 sequences**,
98 selected records, **zero observer errors and zero drops**. The first
observed failing backend operation after the selected BTF load is the call to
**upload/conversion routine `0x453de3` at `0x450e1f`**: its return at
**`0x450e24` is EAX 0**, and the executed failure successor is **`0x450e28`**.
No generic emulator defect is proven; no production or test repair is made.

Both sequences establish the preceding successes and the resulting failure:

- Metadata name `skymorning.tga`, live BTF lookup index **390**, query return
  **AL 1 at `0x45084b`**, and executed successor **`0x450857`**. The upper
  EAX bytes retain other values; only AL is this query's boolean result.
- The actual alternative TGA query returns index -1 and **AL 0 at
  `0x45088a`**. The live filename returns to `skymorning.btf`; selected BTF
  load **`0x4508c9` is 1**, followed by `0x450956`.
- Format helper **`0x450ff4`**, its actual branches and return are retained.
  Return **`0x450c2b` is 9,749,320**, a nonzero format pointer, and executes
  **`0x450c3f`**. This helper is not a backend exit.
- **CreateSurface returns DD_OK (EAX 0) at `0x450db6`**, then executes
  `0x450de0` and `0x450deb`. The two created surface pointers are
  **136,458,864** and **136,463,448**. The requested descriptor is 128×128,
  RGB565, 16 bits, size 124.
- Upload returns zero at **`0x450e24`**, takes **`0x450e28`**, then
  `0x450e44`, the **true epilogue `0x450fe4` with EAX 0**, bank return
  **`0x4181d5` with EAX 0**, and **`0x4181d9`**.

**Exact remaining observation limit:** the upload routine's internal calls and
first failing guard are outside the retained `0x45084b–0x451118` window.
Static original disassembly identifies GetSurfaceDesc return `0x453ec3`
(HRESULT ignored by the guest), CreatePalette return `0x454009`, SetPalette
return `0x454043`, Lock return `0x4540bc`, and Unlock return `0x4552fb`.
Their actual selected HRESULTs and successors are **unobserved**. The retained
descriptor after upload contains size 124 and otherwise zeros; this does not
establish which API failed or authorize a descriptor/version repair. There is
no third original invocation. Saved initial names remain context; `searchName`
is the live filename, and returned query frames' reused locals are omitted.

The first original exits 0 in **91.233 seconds**, but its scratch consumer
records every archive scan block while selection is active: its 768-record
quota fills before the backend, with **3,160 drops**. The second and final
original tests the proven scratch retention correction, excluding archive
internal scan blocks while retaining lookup results, query/backend/helper
blocks and bank returns. It exits 0 in **68.479 seconds**. Both inspected
PNGs still lack textures; the second PNG SHA-256 is
`bbc8eee19ceb8a61e4242738da63be6f71719b221f5123b563454a382efd5941`.
No texture or gameplay qualification is claimed.

Before originals, actual async instantiation and synchronous
`WebAssembly.Instance` pass the complete emitted synthetic helper call/return,
failure guard, true epilogue and bank path with **`run(80)`**. The old observer
fails the same helper-return regression. The corrected second filter also
retains the complete path after **10,001 active archive-scan callbacks**.
Actual emitted callbacks are individually checked against whole shared
**512 MB** memory hashes and clock values; parked control/parser/eval,
invalid-parent and late-retention checks pass. Synthetic fixtures do not
execute original game bytes. The existing trace setter's global disabling of
chaining and the micro-op tier is explicit; no breakpoints, instruction
counters, forced stepping, budget-one execution or guest state writes occur.

Rune's fresh final/result and **05:37:27 runtime/source/build release** precede
original execution, registration tests and this note edit. All **4,389** source
inputs and **70** fixture hashes match before/after. All **65 content pins**
match in both original copies. The full fixture test's archival-inode
independence assertion fails after coordinator hardlink deduplication (58 shared
inodes); that failure is preserved, with no fixture or test edits.
Registration-only tests pass. The accepted locked build is reused unchanged:
module `baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`,
2,025,634 bytes, matching mirror, both actual module receipts and all
**127 actual loaded reads per invocation**. An actual child receipt is
**unavailable**; no child identity is inferred. Empty arguments,
`C:\\MAINDIR`, IFORCE2-only seeding, original fixtures, 100,000 blocks after
29,100 and clock 200 are unchanged. Startup free disk exceeds 2.3 GB for both
originals and remains above 2 GB. Outer PTY150/kill-after5, inner115 and child
TERM90/KILL95 guards are unused; owned runtime PIDs/groups/temp/watchers are
absent. Evidence is under `scratch/runs/20261101-redline-backend-first-failure/`,
with the final invocation under `second/`. Boxes: N/A; ownership none.

## Selected execution: BTF found and loaded, backend returns zero (2026-11-01)

Run `20261101-redline-selected-lookup-execution` makes **two original CLI
invocations**. The second captures **two matching resource-723 sequences** on
the actual cooperative guest thread, with zero observer errors or drops:

- The bank ID is **723**, its metadata name is **`skymorning.tga`**, and the
  actual selected lookup entry requests **`..\GameData\textures\skymorning.btf`**.
  Lookup `0x4eefeb` and direct-query return **`0x416f84`** both return **390**.
- The same query frame then returns **`0xffffffff` at `0x416f84`** while the
  live backend filename is **`skymorning.tga`**. Its boolean local at
  `0x416fc6` is zero, and the actual alternative-query return **`0x45088a`**
  has low byte zero. This is an executed TGA miss, rather than an inference
  from the offline archive listing.
- The filename returns to **`skymorning.btf`**. File-loader return
  **`0x4508c9` is 1**, followed by **`0x450956`**. The backend subsequently
  returns **EAX 0 at `0x4181d5`**, and the bank executes **`0x4181d9`**.

**The first failing operation inside the backend remains unobserved; no generic
repair is proven or made.** The scratch observer mistakenly treats helper entry
**`0x450ff4`** (called at `0x450c26`) as an exit and switches to the bank window
too early. The actual backend epilogue is `0x450fe4`. Also, the successful
query's `0x416f8d` block falls through its epilogue without a separately emitted
`0x416fc6` block: the initial BTF boolean, `0x45084b`, and `0x450855` successor
are not retained. The subsequent TGA alternative miss is retained. Saved
`name` fields describe the initial selected lookup; **`searchName` is the live
filename**. Query locals after that frame returns are reused stack bytes and
must not be interpreted as current query output. Both original invocations are
used; there is no third invocation or speculative repair.

The inspected second-run original PNG still lacks textures, SHA-256
`bbc8eee19ceb8a61e4242738da63be6f71719b221f5123b563454a382efd5941`.
The completed second invocation exits 0 in **69.451 seconds**. This observation
does not qualify textures or gameplay.

The first invocation stops on the disk guard: the async-only scratch preload
misses cooperative **`new WebAssembly.Instance`**, allowing unbounded ordinary
T1 trace output. Free disk briefly reaches **1,997,225,984 bytes**; immediate
lossless compression of owned logs restores it above 2 GB. Its driver repeats
the disk exception during cleanup, so no first-run `exit.json` is produced;
all owned runtime PIDs and groups are subsequently verified absent. The second
and final invocation tests the concrete diagnostic binding correction: intercept
both synchronous and asynchronous constructors before import capture, preserve
separate bounded per-instance records, and save selected records durably.
This is a scratch diagnostic correction, not an emulator repair.

Before either original, scratch checks exercise the actual preload, emitted
module, shared **512 MB** memory, actual parked control/parser/eval paths,
late **10,001** callbacks, invalid-parent rejection and whole-memory/clock
read-only behavior. Synthetic **`run(37)`** exercises actual callback-driven
window transitions. The second preload additionally tests the actual synchronous
constructor and emitted callbacks. These fixtures do not execute original game
bytes, and their coverage did not detect the two window limitations above.
Tracing explicitly disables chaining and the micro-op tier globally; no
breakpoint, counter, forced stepping or budget-one execution is used.

Rune's fresh final/result and **05:15:43 runtime/source/build release** precede
runtime and note edits; only scratch preparation occurs before that gate.
All **4,389** accepted source inputs, **70** original fixture files, registration
and **65 pins** match before/after. The accepted locked build is reused:
module `baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`,
**2,025,634 bytes**, with matching mirror and actual loaded-read identities.
Empty arguments, `C:\MAINDIR`, IFORCE2-only seeding, shipped fixtures,
100,000-block budget after batch 29,100 and clock 200 are preserved.
Outer PTY150/kill-after5, inner115 and child TERM90/KILL95 bound execution.
Evidence, raw selected records, exact limitations and inspected capture are in
`scratch/runs/20261101-redline-selected-lookup-execution/` (second invocation
under `second/`). All owned runtime PIDs/groups are absent. Box ID/state/expiry/
handback: N/A; ownership none. Production and test files are unchanged.

## Lookup trace preparation: direct query return identified; runtime disk gate closed (2026-11-01)

Run `20261101-redline-lookup-branch-cause` makes **zero original guest
invocations** and no emulator repair. The first causal execution gap remains
resource 723's actual lookup/alternative/backend return. At precondition capture,
free disk is
**1,998,544,896 bytes**, below this task's strict **2,000,000,000-byte** runtime
floor. Foreign artifacts are untouched; there are no owned expendable large
artifacts to recover that space. No texture qualification is claimed.

Offline original disassembly identifies an additional required return:
existence query **`0x416f22` calls `0x4eeede` directly at `0x416f7f`, returning
at `0x416f84`**. Observing only loader return `0x4eecc5` would miss this path.
The backend tests the query result at `0x450855`, with successors `0x450857`
and `0x4508a9`; its BTF-alternative query returns at `0x45088a`. The eventual
bank return is `0x4181d5`, with zero successor `0x4181d9` and nonzero successor
`0x41824a`. These are static addresses, not evidence of selected execution.

The existing emitted module and **actual CLI trace formatter**, extracted
unchanged from `test/run.js`, pass an offline synthetic x86 fixture with a
real shared **512 MB** memory and actual `g2w`. One **`run(37)`** emits real
register/flag/memory-dump lines with budgets **36, 35, 34...**, including the
executed EAX value `0x12345679`. It does not force instruction single-step or
host budget one. After **10,001** calls the formatter leaves the whole memory
hash and clock unchanged; the trace setter also leaves linear memory unchanged.
**Tracing globally disables chaining and the micro-op tier**, even with a
narrow range; this execution-tier effect is explicit. This fixture executes
synthetic bytes only, not original game code.

All **4,389** accepted build inputs, **70** original fixture files, module
`baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`
and region mirror match the preceding accepted run. Rune's final/result and
**05:03:21 runtime/source/build release** precede the synthetic check and note
edit. No build or production/test edit is made. The saved next-observation
plan starts at batch **29,100**, range **`0x4eec9b–0x4eefee`**, and specifies
selected-only staged narrow windows for the direct query, backend alternative
and bank return. **The staged preload/driver is not implemented or qualified**;
its actual bounded late-retention/read-only path must pass offline validation
before an original invocation. Evidence, emitted trace and the address plan
are in `scratch/runs/20261101-redline-lookup-branch-cause/`. Owned runtime
PIDs/groups: none. Box ID/state/expiry/handback: N/A; ownership none.

## Archive member: original bytes validated, selected execution still unobserved (2026-11-01)

Run `20261101-redline-archive-member-cause` stops after **one original guest
invocation**, with the exact observation gap preserved. No generic defect or
repair is proven. The inspected original gameplay PNG still lacks textures,
SHA-256 `ed66d12dab856c3c44ffd5e45cd088290612fe2aba75edb0b55bf275a9ecbd87`.
Production and test files are unchanged by this worker.

The original 71,788,765-byte `Redline.bgd` is parsed offline before runtime.
Version 2 has **4,872 members**; its directory ends at **142,375**, and cumulative
member lengths end exactly at EOF. Its SHA-256 is
`840dc1421e88708bb64de686e6a996e2638c27693b25ecdb54237824c64808aa`.
**`skymorning.tga` is absent. `skymorning.btf` is archive index 390**, length
**22,540**, stamp **908,059,166**, offset **16,813,431**. Its extracted original
bytes have SHA-256
`4ef0740fb44f4d354d9bf6fbd34280e5a507bd3f3fd45609e944b7a9e13cd981`.
Archive index 390 and resource-bank ID 723 are separate identities.

Disassembly establishes lookup `0x4eeede` uses the last backslash for the
basename, the last dot for the extension bucket, then case-insensitive name
comparison in original bucket order. For these original ASCII names the compare
is ASCII case-insensitive. It does not normalize forward slashes. The bucket
list is geo/btf/tga/wav/anm/mot/skl/gld/ggr/other; a name without a dot fails.
A separately implemented sequential parser and **9,747 lookup checks** verify
all original member names, uppercase Windows paths and selected negative cases,
plus an independent seek/read of member 390. Loader `0x4eec9b` uses the 20-byte
record's length +4 and offset +0xc. Static backend code queries the requested
TGA before considering its BTF alternative; a failed first lookup can reach a
zero return without a member read. **This is static control flow, not evidence
that resource 723 executed that lookup, alternative or return.**

The materially different scratch observer wraps natural filesystem imports:
open results, seek results, read results, close and selected filename-bearing
file output. It tracks archive positions and retains only overlap with the
selected member's physical byte range, comparing actual returned bytes with
the original member. It can recover an archive frame with EBP zero only after
validating archive self, index, length and offset; bank/backend recovery retains
the existing parent/ID/metadata checks. Its selected quota is independent of
unrelated calls. Offline tests verify late retention after 10,000 unrelated
reads, lazy-997 retry positions, invalid-frame rejection, unchanged returns and
whole shared-512-MB memory hashes. Actual preload/current-module bindings and
the real filesystem imports/VFS with the complete original archive pass; the
observed and unobserved VFS operations produce identical whole-memory hashes.
No guest entry is invoked in these offline checks.

The sole original invocation exits 0 in **56.614 seconds**. Natural import
counts are 333 `fs_create_file_result`, 17 `fs_create_file`, 15,812
`fs_read_file_result`, 623 `fs_seek_result`, 1,198 `fs_set_file_pointer`, 35
`fs_write_file_result` and 345 `fs_close_handle`. There are **zero observer
errors, zero drops and zero selected association records**. The final live
archive table has 4,872 members and its index-390 name/length/stamp/offset
exactly match the original parser. Resource 723 remains `skymorning.tga`,
with the same observed sentinel metadata. These are live data identities;
**they neither witness lookup execution nor establish backend absence or a
successful selected read**. There is no second invocation: no new causal
hypothesis or fix justifies repeating the missing association.

**Exact missing observation:** the actual resource-723 TGA lookup result at
`0x4eeede` / return `0x4eecc5`, including a miss before any natural host
boundary; then the actual `0x4eec9b` member/read output if reached, associated
with bank/backend return `0x4181d5` and its first zero/error guard. The prepared
offline evidence does not fill that execution gap. No runtime/source diagnostic
or speculative repair is added.

Rune's final.txt/result.json and **04:49:27 runtime/source/build release**
precede the fresh `flock /tmp/wine-build.lock bash tools/build.sh`, runtime and
this note edit. All **4,389** recorded inputs are unchanged through the run.
The actually loaded module is **2,025,634 bytes**, SHA-256
`baef4e5a70f43b5d87fe086b4f5bd5b583c833e8bf07239ef05749f222035136`;
all **130 actual loaded reads** match, as does the snapshotted region mirror.
The prior module was used only for explicitly labeled offline preparation.
Original registration/all 65 pins and all 70 fixture hashes pass before/after.
Empty arguments, `C:\MAINDIR`, IFORCE2-only seeding, shipped settings, batch
100,000 after 29,100 and clock 200 remain unchanged. No breakpoints, instruction
counters, guest state writes or substitutions are used. Outer PTY150/kill-after5,
inner120 and child TERM105/KILL110 guards are unused; all owned runtime PIDs
and the outer group are absent. Evidence and the prepared observer are in
`scratch/runs/20261101-redline-archive-member-cause/`.
Box ID/state/expiry/handback: N/A; ownership none.

## Selected loader observation: container/member association still missing (2026-11-01)

Run `20261101-redline-selected-loader-cause` **does not recover the selected
loader's first failing API or guest guard**. No generic repair is proven;
production and test files are unchanged. Both permitted original guest
invocations are exhausted, and both inspected gameplay PNGs retain the missing
textures, SHA-256
`ed66d12dab856c3c44ffd5e45cd088290612fe2aba75edb0b55bf275a9ecbd87`.

The previously prepared continuation now has an explicit offline PASS, rather
than an empty log. Its revised scratch observer separates selected calls,
CreateSurface, file calls, other backend calls and general calls. Method
counts remain uncapped; repetitive frame IsLost calls cannot consume those
quotas. Offline tests saturate every unrelated quota and retain late selected
ReadFile and CreateSurface entries. They also retain an entry without inventing
a return value when its exit hook is missing. Tests exercise the actual preload,
real API table, region mirror and address translator, and instantiate the actual
module with a real shared 512 MB WebAssembly.Memory without invoking a guest
entry point. Whole-memory hashes remain unchanged across observer calls.

The first invocation exits 0 in **64.826 seconds**, retaining **4,834 entries**
with zero observer errors. Its file quota fills at 4,096, principally early
container reads; 13,009 further file entries are dropped. CreateSurface has a
separate quota: **all 610 hook entries and their exits are retained**. Their
actual return sites are `0x453a3e` (328), `0x453cb2` (280), `0x451924` (one)
and `0x44da13` (one). No retained record recovers `0x4181d5`. In particular,
the sampled CRT ReadFile calls return at `0x55e9cc` with **EBP zero**, so a
longer linked EBP walk cannot recover their caller chain.

The second observer adds bounded, read-only recovery from the active stack for
that frame-pointer omission. A candidate must contain return `0x4181d5`, a
parent returning to the statically verified bank callers `0x417a0f` or
`0x418026`, the correct bank local at parent EBP-0x108, and matching resource
ID/metadata arguments. Offline tests recover a synthetic selected frame with
EBP zero and reject an invalid bank parent, with all memory unchanged. Repeated
ReadFile, SetFilePointer and CloseHandle calls instead retain the first eight
and rolling last eight records per API/caller; selected records are protected.

This invocation exits 0 in **62.155 seconds**, retaining **1,102 entries**,
again with zero observer errors. Its separate file quota retains 364 entries,
including **all 333 CreateFileA entries**, and all 610 CreateSurface entries
again have retained exits and the same caller distribution. Uncapped counts
include **15,812 ReadFile**, **623 SetFilePointer** and **58,830 IsLost** calls.
The rolling file samples are bounded, not a complete read history. The only
observed open/search names are `redline.bgd`, `Redline - Log.txt`,
`redline.exe`, `redline.cfg` and `*.rdm`; **none associates a read with
resource 723 / `skymorning.tga`**. Neither linked-frame nor validated stack
recovery yields a selected backend record. General records still drop 1,568
entries at their own quota; they do not consume file or CreateSurface capacity.

The live checkpoint still has backend vtable **`0x56fd40`**, +0x1c method
**`0x450729`**, and logical **444** / resource **723**, with null Texture2,
signed resident/group -1 and bank dimension/format sentinels -1. Surface
`0x08224458` is DX slot 1675, with 128x128/16-bit backing. **These observations
do not establish execution or absence of the selected backend, successful
selected file/API operations, or the source of its sentinel metadata.**

The exact remaining gap is the selected **container member -> active loader
frame -> first failing return/guard** association before CreateSurface.
Offline disassembly identifies archive lookup `0x4eeede` (return `0x4eecc5`)
and archive loader `0x4eec9b`: its 20-byte member record supplies length at +4
and file offset at +0xc before seek/read. The required next observation is
resource 723's actual member index, length, offset and read output, tied to
the bank/backend call returning at `0x4181d5`, then its first zero/error branch.
The current natural API samples do not supply that association; no HRESULT or
file result here is attributed to the selected upload.

Rune's final.txt/result.json and **04:28:15 runtime/source/build release**
preceded runtime and this note edit. All **4,388** recorded source inputs,
the module and region mirror match the accepted locked build; reuse is
recorded, with no code change requiring a new build. Both actually loaded
modules are 2,025,629 bytes, SHA-256
`985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
All **128 actual loaded reads per invocation** match their current or archived
observer identities. Original registration/all 65 pins and all 70 fixture
hashes pass before/after. Empty arguments, `C:\MAINDIR`, IFORCE2-only seeding,
shipped settings, batch size 100,000 after 29,100 and clock 200 are unchanged.
No instruction counters, breakpoints, guest calls, state writes or texture
substitutions were used. Outer PTY 150-second/kill-after-5, inner 120-second
and child TERM105/KILL110 guards remain finite and unused; owned runtime
processes/groups are gone. Evidence is under
`scratch/runs/20261101-redline-selected-loader-cause/`.
Box ID/state/expiry/handback: N/A; ownership none.

## Backend upload observation: selected failure still unobserved (2026-11-01)

Run `20261101-redline-backend-upload-repair` verifies the live backend identity
but **does not establish the first failing loader/API return for a selected
gameplay asset**. No generic repair is proven; production and test files were
left unchanged. The two original guest invocations are exhausted.

Offline disassembly maps backend `0x450729`, bank call/return
`0x4181d2/0x4181d5`, CreateSurface return `0x450db6`, upload returns
`0x450e24` and `0x450ebe`, GetSurfaceDesc return `0x453ec3`, and the
upload's four API error exits before its zero return. The existing API hooks
were wrapped read-only to capture arguments, HRESULTs, descriptor outputs,
natural frames, selected filename/metadata pointers, and cleanup return
locals. Synthetic tests cover actual preload/import/table/memory bindings,
relocated addresses, HRESULT pairing, whole-memory immutability and bounded
retention. Required exports/imports exist in the accepted actual module.

The first invocation retains **840 records**, with zero errors or drops:
280 GetSurfaceDesc, 280 Lock and 280 Unlock calls, all successful. They return
through the UI loader `0x453d09`, called from `0x417cfa`, and target UI
surfaces. **None exposes a selected backend frame returning to `0x4181d5`.**
This probe therefore supplies no HRESULT or output for the selected gameplay
upload, and does not prove that backend `0x450729` was executed or skipped.

The second invocation widens resource-call observation and directly reads the
live bank/backend at exit. Bank `0x0881b230` has backend pointer
`0x0094c124`, equal to the renderer global; its vtable is **`0x56fd40`**, with +0x1c method
**`0x450729`**. Thus the active method identity agrees with the static map.
Logical **444** still references resource **723**, `skymorning.tga`, with
null Texture2 and signed resident/group **-1**. This run's bank metadata
pointer is `0x01b6280c`; its surface is **`0x08224458`**, DX slot **1675**,
128×128, 16-bit RGB565. Its width/height/bpp/format metadata remain **-1**,
while bank status +0x50/+0x52 remain 1. The changed slot is an observed
allocation identity; it is not a claim of a different selected asset.

The second observer retains **5,000 records** and drops **56,136**, with zero
observer errors. Uncapped method counts are 610 CreateSurface, one
GetAttachedSurface, 58,830 IsLost, 329 QueryInterface, 280 GetSurfaceDesc,
543 Lock and 543 Unlock. Repeated frame IsLost calls consume the general
record quota before late resource details; the separately protected
`skymorning.tga` quota retains zero records because no matching backend frame
was recovered. No failed HRESULT is present in retained records. **This is
not a complete later creation/upload history and cannot identify the selected
surface's creation caller or exclude an unretained API failure.** Widening
this probe did not resolve the required causal frontier.

The checkpoint metadata is sufficient to explain rejection by classifier
`0x52b5c7`: square -1 dimensions still fail its unsigned size-range guard at
`0x52b602`, reaching the -1 return at `0x52b64c`. That is a static consequence
of observed data, not an observed instruction trace or its upstream cause.
Likewise, metadata writer `0x4181ec` is a possible loader-failure path, not a
return witnessed for this asset. **Next exact observation:** recover the
selected bank record's `0x4181d5` backend frame across natural file/container
loader calls before CreateSurface, with retention isolated from frame
IsLost calls; capture the first loader return/guest guard and actual API
output before selecting any repair. The scratch continuation observer is
prepared offline only; it has not run a third guest.

Rune's final artifacts and 04:08:37 runtime/source/build release preceded
runtime and this note edit. All **4,388** inputs, the module and region mirror
match the accepted locked build in `20261101-redline-pool-selection-cause`;
reuse is recorded. Both actually loaded modules are 2,025,629 bytes, SHA-256
`985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
Original registration/all 65 pins, all 70 fixture hashes and all **128 actual
loaded reads per invocation** match their recorded identities. The first
observer version is archived with its exact loaded hash. Both runs exit 0 in
**76.689 / 72.058 seconds**.
Both gameplay PNGs were inspected: missing textures persist; the first weapon
pose differs, while the second SHA-256 is the retained checkpoint
`ed66d12dab856c3c44ffd5e45cd088290612fe2aba75edb0b55bf275a9ecbd87`.
Empty arguments, `C:\MAINDIR`, IFORCE2-only seeding, shipped settings,
100,000 batch size after 29,100 and clock 200 are unchanged. There are no
breakpoints, instruction counters, guest calls or state writes. Outer PTY
150-second/kill-after-5, inner 120-second and child TERM105/KILL110 guards
remain finite; all owned processes/groups are gone. Disk stays above 2 GB.
Evidence is under `scratch/runs/20261101-redline-backend-upload-repair/`.
Box ID/state/expiry/handback: N/A; ownership none.

## Gameplay pool selection: unrealized logical textures hit the bind guard (2026-11-01)

Run `20261101-redline-pool-selection-cause` connects actual original gameplay
DrawPrimitive callers to their selected logical textures. **The first concrete
blocker is resource realization before pool admission:** all **366 retained
positive-ID draw records**, covering **177 logical assets**, have a null source
Texture2 pointer, signed resident index **-1**, pool group **-1**, and wanted
flag **0**. Their resource-bank records have width, height, bit depth and format
flags all **-1**, despite live surface pointers and bank status fields +0x50/
+0x52 both 1. No generic emulator defect is proven, so this change is evidence
and explanation only; it makes no production/test repair or texture substitution.

The original EXE was disassembled offline before running. Relevant guest paths:

- The manager is `[0x5b6d54]`. Its logical table has 16-byte records: Texture2
  pointer +0, signed resident +4, resource-bank ID +6, pool group +8, wanted
  +0xa. Its cached bound pointer is +0x20c; +0x218 selects direct versus pool
  mode. A pool object begins at `manager + 4 + group * 0x34`; its +0x2c array
  holds Texture2 interfaces and +0x30 holds surfaces. These are distinct from
  the logical source interface and the bank's surface pointer.
- `0x52b1dd` registers a logical texture. Flag `[0x592b34]`, read by
  `0x488e6a`, can defer immediate realization at `0x52b34e`.
  `0x488e56 -> 0x52b0c5` later runs the bank load sweep `0x4178f4`, followed
  by logical realization `0x52b0e9 -> 0x52b3f1`. Pool classification at
  `0x52b5c7` requires matching square dimensions and a supported size/format;
  failure returns -1 before source Texture2 QI. A successful source QI returns
  at `0x52b55e`, distinct from pool creation's `0x52dadb`.
- `0x52b814` marks wanted, but the same defer flag can skip its request call.
  `0x52b8b8` converts resident -1 to **-2** only when pool group is nonnegative.
  Frame flush `0x52babb` first checks pool mode and request count; it considers
  only -2 entries, selects a reusable pool slot through `0x52bfb6`, then calls
  **destination pool Texture2::Load(source logical Texture2)** at `0x52bc05`
  (return `0x52bc08`). Success assigns the pool resident index at `0x52bc7e`.
- Binding is `0x488e05 -> 0x52c392`. In pool mode, the signed resident test at
  **`0x52c48a/0x52c48c`** sends negative indices to the clear path
  `0x52c55e`. If cached texture +0x20c is already zero, **`0x52c568` exits
  without an API call**. A valid resident resolves the pool Texture2 array,
  compares the cache, and calls Device3::SetTexture at `0x52c504` only on a
  change. Thus untextured draws can coexist with a completely absent
  SetTexture dispatch, without any rejected binding HRESULT.

The natural draw frames establish the consuming ID rather than guessing it
from the last uploaded object. Actual world calls return to `0x457b21` and
`0x457afb`: their preceding bind at `0x45789c` selects the signed word stored
in caller EBP-0x40. The `0x4587a6` path instead selects the logical ID from
`[caller EBP-0x160] + 32 * signed_word(caller EBP-4) + 0x280a0`.
The first run exposed those real callers; the second observer used their
independently checked disassembly and retained the first two draws per
caller/game/selected ID. Four ID-zero draws are excluded from the positive-ID
result above. All selected draws observe pool mode, cached pointer zero and
request count zero. Combining these values with the straight-line bind code
identifies the negative-resident/zero-cache guard; it is not an instruction
breakpoint trace of each branch.

For example, draw 9,687 returns to `0x457b21` and selects logical **444**,
resource **723**, `skymorning.tga`. The bank points to surface wrapper
`0x08223270`, DX slot **1102**, with 128×128/16-bit backing, while its logical
texture pointer is null and resident/group are -1. Other observed selections
include `invisible.tga` (132), `dish43.tga` (221), and `gun2-nm.tga` (363).
Across retained draws the selected bank surfaces occupy **177 slots,
668–1766**, with no overlap with the observed Unlock destinations. The 543
successful Unlocks still target slots 338–658; their caller frames recover
**280 TGA filenames**, including launcher/menu/loading assets. None matches
these 177 selected gameplay asset names. Successful upload samples therefore
do not establish successful upload of the textures selected by gameplay.
This observer does not cover every Blt or later copy, and 16-byte surface-head
samples do not establish the contents of a whole texture.

The failure frontier is narrower now. The bank backend is installed from
`[0x591c64]`; constructor `0x44c900` installs vtable `0x56fd40`, whose +0x1c
entry is loader **`0x450729`**. Bank realization calls it at `0x4181d2`.
A zero return makes `0x4181ec..0x41823a` write the exact -1 dimension/format
sentinels observed at the draws. Loader `0x450729` creates the bank surface
at `0x450db3`, then uploads through `0x453de3` (return `0x450e24`, or the
mipmap branch). The upload routine obtains a surface description at
`0x453ec0` before Lock. **Next observation:** follow one selected asset such
as logical 444/resource 723 through this backend call, its actual destination
surface, GetSurfaceDesc output and the first upload/loader failure return,
then the classification at `0x52b5c7`. The current evidence does not identify
which loader/upload API or guest guard first fails; changing that code now
would be speculative. The two-invocation limit is exhausted.

Both original invocations exit 0 in **71.465 / 70.234 seconds**, reach batch
**30,700**, and produce the inspected original gameplay PNG SHA-256
`ed66d12dab856c3c44ffd5e45cd088290612fe2aba75edb0b55bf275a9ecbd87`.
Geometry and weapon silhouette remain visible with missing textures.
The run preserves empty arguments, `C:\MAINDIR`, IFORCE2-only seeding,
shipped settings/all 65 pins, batch size 100,000 after 29,100, and clock 200.
No snapshot command, breakpoint, guest call, state write or production
instrumentation was used. The bounded observer retains 895 / 1,257 records
below its 1,800 cap, sees 93,142 draws each, and reports zero errors.

Rune's required final artifacts and runtime/source/build release preceded
all builds, runtime, and note edits. A **fresh locked build passed** because
Rune changed the source input map. Both actually loaded modules are
2,025,629 bytes, SHA-256
`985ca2480931df88751db66dbee8527a6d9df9940949baafc6bc3a0b1a43e2dc`.
All **4,388 source inputs**, **70 fixture files**, and **128 actual loaded
reads per invocation** match their recorded identities. Original registration
checks pass before/after. Offline tests cover the signed marker, actual
preload/import/memory translation, real draw-frame ID mappings, source and
destination identities, negative residency, bounded retention, and unchanged
whole synthetic guest memory across hooks. The outer PTY uses 150 seconds /
kill-after 5, inner limit 120, and finite child TERM 105 / KILL 110; both runs
quit normally and all owned runtime processes/groups and the watcher are gone.
Evidence, drivers, disassembly, identity maps and PNGs remain under
`scratch/runs/20261101-redline-pool-selection-cause/`. Box ID/state/expiry and
ownership handback: N/A; no box was used.

## Binding chain: texture views exist, binding calls absent (2026-11-01)

Run `20261101-redline-binding-chain` advances the original route through
first-person batch **30,700** while observing existing API entry/exit imports
at normal instruction speed. The concrete new blocker is upstream of the
binding handlers: **no SetTexture, Texture/Texture2 GetHandle, Texture/Texture2
Load, or SetRenderState(TEXTUREHANDLE=1) dispatch is observed from launch
through this checkpoint**. Thus this run does not expose a rejected binding
HRESULT to repair. The exact guest decision that omits the binding remains
unobserved; no generic production/test repair is justified yet.

The observer resolves the existing signed `0xC0DE0000|api_id` COM marker
against the actual `src/api_table.json`, then pairs the existing name and exit
hooks. It records selected call arguments, guest return address, HRESULT,
output pointer/handle, wrapper vtable, DX slot, and surface DIB/dimensions/
format with small head/middle/tail byte samples. All DirectDraw/Direct3D
method counts remain uncapped. Detailed records have separate quotas of
2,048 binding and 12,000 resource records, so menu blits cannot consume the
binding quota. This requires no new runtime trace primitive, breakpoint,
counter, guest allocation, or state/register write.

The complete census includes **74,585 DrawPrimitive**, **18,557
DrawIndexedPrimitive**, **10,771 SetRenderState**, **543 Lock**, **543 Unlock**,
and **329 surface QueryInterface** calls. Of the render-state calls, exactly
one selects state 21: TEXTUREMAPBLEND=2/MODULATE, HRESULT 0, return
`0x4896e2`, on device slot **7**, state pointer **9,952,284**. The observed
slot is zero before and after that call. No state-1 call is filtered out by
change suppression: this observer inspects API arguments before the handler.

Resource evidence distinguishes texture views from upload destinations:

- **328** surface queries request IID_IDirect3DTexture2
  `{93281502-8cf8-11d0-89ab-00a0c9054129}`. All return HRESULT 0 at guest
  return address **`0x52dadb`**, yielding Texture2 views of surface slots
  **10–337**. For slot 10, surface pointer **136,450,128** yields texture
  pointer **137,568,280**, vtable **6,237,108**, over the same slot/DIB
  **474,525,696**, a 128×128 RGB565 surface. Its sampled bytes are zero.
- The **543** successful Unlock calls cover **280 distinct upload surfaces**,
  slots **338–658** with gaps; none overlaps pool slots 10–337. **531**
  Unlock observations have nonzero sampled bytes. For slot 338, return
  addresses include **`0x4552fb`** and **`0x4534da`**; the actual destination
  DIB is **5,891,764**, 64×64 RGB565, pitch 128, with head bytes
  `00 00 00 00 04 21 08 42`. This ties real guest writes to a destination,
  without assuming it was selected for a particular gameplay draw.

The retained **12,001** detailed records contain no observer errors and no
failed HRESULT. The resource quota drops **110,449** later detailed records,
predominantly repeated render-target Blt calls; their method counts survive.
Consequently this is not a complete per-blit source/destination history, and
absence of a later copy into a pool surface is **not** established. The
binding quota retains its sole relevant call and is not exhausted.

Static disassembly of the unchanged original EXE confirms that the observed
`0x52dadb` return follows the texture-pool QueryInterface. The successful path
stores the Texture2 interface through the array at pool-object **+0x2c**;
surface pointers come from its separate **+0x30** array. This is an identified
resource relationship, not proof that the subsequent residency/bind branch
ran. **Next exact observation:** follow the guest selection/transfer/bind
path consuming one of these pool entries for an actual first-person draw,
including its early-return condition and actual upload source/destination.
Do not substitute another frozen state snapshot or force a resource/state.

Offline tests exercised signed COM-marker decoding, entry/exit pairing,
HRESULT/handle outputs, synthetic object storage, read-only hooks,
separate quotas and uncapped counts. The actual preload was also exercised
with mock instantiation, the real API table, recorded mirror, host-memory
binding and `mem-utils` translation, without running a guest. One additional
offline hash assertion initially included the test fixture's own stack
rewrites; initializing identical arguments before hashing corrected that
test. Earlier mock-process loaded-read manifests are retained separately;
actual guest identity checks select only the recorded `test/run.js` PID.

The initial gate remained closed until Rune `01a19524` supplied final.txt and
result.json and released runtime/source/build at **03:38:20 UTC**. All
**4,387** runtime input hashes still matched the accepted locked build from
`20261101-redline-texture-snapshot`; its log/module/mirror were retained and
reused. The actual compiled module is the same 2,025,619-byte SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
All **128 actual loaded reads**, all runtime inputs and all **70 fixture
hashes** match after the run. Registration/full-original-65-pin tests pass
before and after. No source/test path was claimed or edited.

Exactly **one original guest invocation** ran, exited 0 in **58.761 seconds**,
and requested no child. It used the open PTY, outer timeout 150 seconds /
kill-after 5, inner 120 seconds and finite child TERM/KILL watchdog. Logs are
preserved; outer/guest PIDs and their process group are gone. Launch remains
`--app=redline_demo`, empty args, `C:\MAINDIR`, IFORCE2-only seed and shipped
settings; the retained budget changes to 100,000 after 29,100 while the clock
stays 200 ms/batch. The actual gameplay PNG was inspected: flat weapon/walls
and sparse HUD persist. Its SHA-256 is
`ed66d12dab856c3c44ffd5e45cd088290612fe2aba75edb0b55bf275a9ecbd87`,
matching the preceding inspected checkpoint. No second guest was spent.
Disk stays above 2 GB; box ID/state/expiry/handback are N/A, ownership none.

## Frozen texture snapshot: enabled stage, zero binding (2026-11-01)

Run `20261101-redline-texture-snapshot` resolves the preceding evaluator
failure and establishes the first concrete **checkpoint rendering blocker**:
the live device has no bound texture while texture modulation is enabled.
Why the binding remains zero is still unobserved; no production/test repair
is justified by this result, and the HUD's specific drawing path is not yet
identified.

At frozen batch **30,700**, the sole type-20 device is DX slot **7**. Its
state guest pointer is **9,952,284**, translated by exposed `g2w` to WASM
**5,831,708**. State +2824 contains texture slot **0**, which
`$d3dim_texture_entry_from_slot` explicitly rejects. Both render state
TEXTUREHANDLE (state +256+4) and the resolved texture entry are zero.
The eight stored stage-zero words are `[0,4,2,0,2,2,1,0]`: COLOROP
(type 1, state +2832+4) is **4 / MODULATE**. Legacy TEXTUREMAPBLEND
(+3936 and render state 21) is **2 / MODULATE**, also yielding effective
COLOROP **4** through `$d3dim_tss_load`. Thus the disabled-COLOROP ambiguity
does not apply to this frozen device state. The source's bound-texture helper
reaches slot resolution and returns zero, so this state cannot sample any
surface. A snapshot alone does not establish the state of every prior draw.

The same snapshot reads all **1,630 live type-2 surfaces**, including their
dimensions, bpp, pitch, DIB address, flags, key, stored/effective format,
full-span byte/pixel statistics and raw head/middle/tail samples. Every DIB
span is in bounds. **1,346** surfaces contain only zero pixels, **282** have
multiple raw pixel values, and **2** are uniform nonzero. Formats are 1,433
RGB565, 196 ARGB4444 and one ARGB8888. These counts do not identify an intended
draw resource; neither an all-missing-data explanation nor correct uploads
for the missing walls/weapon/HUD follows from them.

Representative directly read resources (DIB addresses are WASM addresses):

| DX slot | Dimensions | Format | Pitch | DIB | Nonzero pixels | Distinct raw pixels |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 10 | 128×128 | RGB565 | 256 | 474525696 | 0 / 16384 | 1 |
| 338 | 64×64 | RGB565 | 128 | 5891764 | 1894 / 4096 | 39 |
| 339 | 128×128 | RGB565 | 256 | 6074140 | 5859 / 16384 | 62 |
| 341 | 16×16 | RGB565 | 32 | 5982644 | 256 / 256 | 45 |
| 383 | 144×14 | RGB565 | 288 | 8876340 | 2016 / 2016 | 17 |

For example, slot 338's first bytes include `00 00 00 00 04 21 08 42`;
slot 341 includes raw values `1,44537,31794,48698`; slot 10's entire
32,768-byte span is zero. Full samples and capped distinct-value sets remain
in `resources-30700.json`. No decoder, exported resource helper, guest-scratch
allocation or state mutation was used. The existing bounded trace again
contains only `(16,0,0,0,0)` and `(29,21,2,0,0)`; it adds no texture-load or
nonzero-binding observation.

The outer Python driver loads **the recorded matching region mirror**, then
injects numeric DX_OBJECTS/DX_SURF_FMT bases into the read-only expression.
The evaluator uses only `memory`, `g2w` and `tickState`; it returns JSON for
the driver to save. Source-derived offsets, resolution rules and legacy
COLOROP override are retained in `offset-source-evidence.json`. Before guest
execution, synthetic-memory tests exercised the evaluator's `new Function`
bindings without `require`, relocated numeric bases, raw pixel reads, zero
binding, disabled stage and legacy override; whole-memory hashes confirmed
no writes. An outer-driver absolute-path mistake then failed **before CLI or
guest creation**. Its log was preserved, the path was corrected, and the
actual outer preflight/mirror lookup was validated before the sole guest run.

The original route and launch remain unchanged: `--app=redline_demo`, empty
arguments, `C:\MAINDIR`, IFORCE2-only seed and shipped DISPLAY choices.
At 29,100 the retained `set-batch-size:100000` changes the main instruction
budget to **100×** the default; the clock stays **200 ms/batch**. No
breakpoint/counter slowdown or additional player movement was introduced.
Space dequeue/dispatch reaches 10/9 with an empty renderer queue at 30,700.
The actual new PNG was inspected: first-person geometry, flat weapon/walls
and sparse HUD remain visible. Its SHA-256 is
`ed66d12dab856c3c44ffd5e45cd088290612fe2aba75edb0b55bf275a9ecbd87`;
it differs from the retained image, including the weapon pose, so this run
claims route/checkpoint reproduction rather than byte-identical output.

The initial dependency gate was honored: scratch-only offline work preceded
child-state worker `66028ecbb`'s final artifacts and 03:26:06 source/build
release; Rune's runtime had released at 03:18:19. Changed inputs required a
fresh mandatory locked build on `66028ecbb2aa48a3339e5cd4a6acbea60a09cd83`.
It passed and produced the same 2,025,619-byte module SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`,
matching the actual compile. The mirror SHA-256 remains
`3926a7a2bda6727de2852155e9764b24b8909001d1e2c6ba62e0eb4cab708b11`.
All **4,387** tracked source/test/tool/package inputs, all **70** fixture
hashes and all **126** actual loaded reads match before/after. The focused
registration/fixture test, including all original **65** pins, passes twice.

Exactly **one guest invocation** ran on an open PTY with outer 150-second
timeout / kill-after 5, inner 120-second limit and inherited finite child
guard; the host preload additionally records child streams before a
105-second TERM / 110-second KILL watchdog. No child was requested. Ordinary
quit exits 0 after **67.812 seconds**; recorded outer/guest PIDs are absent
and their process group is empty. Logs were retained before cleanup, disk
remains above 2 GB, and no box was acquired (ID/state/expiry/handback N/A).
No second guest was spent and no production/test path was claimed or edited.

**Next exact observation:** a normal-speed bounded binding call/HRESULT chain
through `SetTexture` and legacy TEXTUREHANDLE/GetHandle, tied to the device
and an actual intended surface/upload destination. This must explain the
zero binding before a repair or a resource/HUD-specific cause is selected.
Audio, sustained playability and browser rendering remain unmeasured.

## Texture/HUD investigation: missing state observation (2026-11-01)

Run `20261101-redline-gameplay-textures` reproduces the retained first-person
Stadium City image, but **does not prove a texture/HUD defect's first cause**.
No production or test repair was made. In particular, the flat-looking areas
cannot yet be classified as missing texture data, failed sampling, or intended
flat surfaces from the image alone.

The single diagnostic invocation reuses the reviewed original route and input
timings through Space-release at batch 30,700. The current and retained
`run2/space-released.png` were both inspected; they are byte-identical,
SHA-256 `462927bb36c33a890c4cee7cd3a68f9f238afe7990721e4fca2c64ba34eb3180`.
The new capture shows the same first-person weapon, crosshair and incomplete
HUD/detail. Space-down/up reached the focused `0x10017` window; the final
input-state reports dequeue/dispatch 10/9 and an empty renderer queue.
The diagnostic stops before the planned additional arrow inputs, so it adds
no new movement/fire evidence beyond the retained run.

A preload wraps only the existing `dx_trace` host import, retaining bounded
unique observations for kind 16 (texture resolution), kind 23 (Texture::Load
outcome), and kind 29 for TEXTUREHANDLE/TEXTUREMAPBLEND. It changes no guest
bytes or state and adds no breakpoint or block counter. Exactly two unique
records were observed through gameplay: `(16,0,0,0,0)` (slot zero, unresolved)
and `(29,21,2,0,0)` (legacy TEXTUREMAPBLEND MODULATE). There is no observed
Texture::Load outcome or nonzero texture-resolution record. This alone does
**not** prove that later draws never bind a texture: inspection of
`$d3dim_bound_texture_entry` in `src/09ab-handlers-d3dim-core.wat` shows that
COLOROP=DISABLE returns before kind 16 is emitted. The effective stage state
and resource contents remain necessary to interpret the trace.

The intended read-only device/surface snapshot failed at control request 43
with `require is not defined`, before reading the table. `controlEval` supplies
`memory`, `g2w`, `exports`, `tickState` and `ctx` through a `new Function`, but
not CommonJS `require`. Thus no resource-content snapshot exists in this run;
the attempted expression is preserved as `resources.js`, with its failed
response in `controls.json`. The driver requested ordinary quit after this
host diagnostic error, and the guest exited 0. The second invocation was
reserved for a justified post-fix run and was not spent on another diagnostic.

The next concrete observation is one frozen, read-only snapshot at the same
30,700 checkpoint: have the outer driver obtain DX_OBJECTS from the recorded
region mirror and insert that value into an expression using only the exposed
`memory`/`g2w` bindings; return JSON for the driver to save outside the evaluator.
For every live type-20 device, read its state pointer at entry +16, bound slot
at state +2824, stage-zero words at +2832, and legacy blend at +3936. For its
resolved surface and live type-2 texture candidates, read dimensions, format,
pitch, DIB pointer and raw pixel diversity/content. This distinguishes disabled
sampling or a missing binding from absent/uniform resource pixels without
calling a decoder that allocates guest scratch space. Until those values are
observed, choosing a generic graphics/resource transport repair is unsupported.

The original `--app=redline_demo`, empty guest args, `C:\MAINDIR` cwd,
IFORCE2-only seed, 59-companion manifest and shipped DISPLAY choices remain
unchanged. `set-batch-size:100000` at 29,100 is the retained **work-budget
adjustment**; the batch clock remains 200 ms. No clock, settings, memory,
register or DLL mutation was made. Audio, sustained playability and browser
rendering remain unknown.

Incoming Rune commit `af316dc21` changed `test/run.js` relative to the retained
4,385-input map, so accepted-module reuse was not permitted. A fresh
`flock /tmp/wine-build.lock bash tools/build.sh` passed on source HEAD
`ca66f37d182179489d245d2eadf006c6cafc4a1a`. It produced the same
2,025,619-byte module SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`,
confirmed by the actual WebAssembly compile observation. Layout remains
`ccbc5bf6dfb9610e`; mirror SHA-256 is
`3926a7a2bda6727de2852155e9764b24b8909001d1e2c6ba62e0eb4cab708b11`.
All 4,385 current recorded inputs remain unchanged before/after; all 126 actual
loaded reads match. The focused registration/fixture check passes before and
after, including the full original 65-file pins; all 70 fixture-map entries
remain identical.

Exactly one local guest invocation ran on an open PTY, with outer
`timeout --kill-after=5s 150s`, inner `--max-seconds=120`, and the existing
finite child guard inherited through `--spawn-processes`. It requested no
child and exited 0 in 55.604 seconds. Both recorded runtime PIDs are absent
and their process group is empty; no guest temporary export was created.
Free disk remains above 2 GB. No box was acquired: ID/state/expiry and
lifecycle handback are N/A, with no ownership retained. Evidence, build/test
logs, as-run scripts, module/read manifests, captures and verification are
retained in the ignored run directory. This is an exact diagnostic blocker,
not a renderer-cause claim or new menu/input qualification.

## Stadium City gameplay and controls reached (2026-11-01)

Run `20261101-redline-default-drain-gameplay` advances the original demo through
Stadium City selection, world loading and its opening cutscene to **first-person
gameplay with visible control responses**. Inspected 640×480 PNGs show the
weapon, crosshair, HUD strip, changed camera position after Up, changed viewing
direction after Right, and a firing effect while the left mouse button is held.
The rendering remains visibly incomplete: surfaces, characters, weapon and HUD
contain flat/untextured areas and missing detail. This is local CLI gameplay
evidence, not correct rendering, sustained playability or browser qualification.

Both serial runs remove **all nine block counters**, retaining only frozen
read-only snapshots of accumulator/time, CPU/stack and synchronization state,
plus existing input delivery observations. No breakpoint, clock override,
guest register/memory write, settings change or additional DLL was used.
Counters in the preceding investigation affected optimization/pacing; its batch
numbers must not be substituted for this run's observations.

### Default-budget drain and pump return

Run 1 retains the shipped CLI defaults: 1,000 blocks per batch and 200 ms per
batch. It follows DISPLAY unchanged → Play → Start Up → New Game → Stadium
City, then queues Enter-down at 29,100 and Enter-up at 30,100.

| Batch | Stored time `0x5b8740` | Accumulator `0x5b8744` | Input dequeued/dispatched | Inspected output |
| ---: | ---: | ---: | ---: | --- |
| 29,100 | 5,132,611 | 864,603 | 6 / 5 | Stadium City selection |
| 115,100 | 5,132,611 | 33,960 | 6 / 5 | Same selection |
| 125,100 | 23,822,601 | 0 | 8 / 7 | LOADING WORLD |
| 135,100 | 23,822,601 | 0 | 8 / 7 | LOADING WORLD |
| 155,100 | 29,210,203 | 687,506 | 8 / 7 | Opening 3D cutscene |
| 275,100 | 29,210,203 | 542,372 | 8 / 7 | Same cutscene frame |

The first fixed-time interval subtracts 830,643 = 25,171 × 33, averaging
9.65864 accumulator ms per batch. Between 115,100 and 125,100 the backlog
drains, the stored time advances, the two queued Enter events are delivered,
and mission loading begins. This establishes eventual catch-up completion and
pump return; no mutex or traversal repair was necessary. The final cutscene
frame alone is **not** counted as gameplay.

The second fixed-time interval drains only 145,134 over 120,000 batches,
averaging 1.20945 ms per batch. At the last observation, 16,436 more 33-ms
decrements remain. Extrapolating that interval requires about 448,445 additional
default batches / 124.5 seconds, before any subsequent elapsed-time addition.
The wall estimate uses the 33.321-second difference between the two capture
mtimes, including checkpoint overhead; it is not a throughput guarantee.
Run 1 already took 64.210 seconds. Continuing that same budget cannot fit the
120-second inner bound at the measured average, which justifies the next run's
documented instruction-budget adjustment.

### Final bounded run: budget adjustment and player input

Run 2 repeats the ordinary route at defaults through batch 29,100, then uses
the existing control command `set-batch-size:100000`: **100× the default main
block budget**, without changing the 200-ms batch clock. This changes work
per synthetic time interval, not guest configuration. It is not a claim of
100× wall-clock speed or a measurement against the preceding instrumented run.
The worker slice policy and all other launch options remain unchanged.

Enter-down is queued at 29,100 and Enter-up at 29,110. At 30,100 the accumulator
is zero, stored time is 6,000,001 and dequeue/dispatch is 8/7; the inspected
capture is LOADING WORLD. Batch 30,300 shows the opening cutscene. The original
Readme's controls explicitly document Space to skip cutscenes, Up for forward,
Right for turning and left mouse for fire. The retained `readme-text.txt` is
only a text extraction; the original file remains unchanged.

| Ordinary input | Held interval | Inspected capture after work |
| --- | --- | --- |
| Space | 30,300–30,500; release then 200 batches | `run2/space-released.png`, 30,700: first-person weapon/crosshair/HUD |
| Up (VK 38) | 30,700–30,730 | `run2/forward-held.png`: camera advances into the arena |
| Right (VK 39) | 30,730–30,760 | `run2/right-held.png`: view turns toward the blue-lit interior |
| Released arrows | through 30,790 | `run2/controls-released.png`: weapon, nearby vehicle, changed view |
| Left mouse | 30,790–30,810; release then 10 batches | `run2/fire-held.png`: firing effect; `fire-released.png`: effect clears |

The input dispatch trace records these keyboard and mouse messages reaching
Redline's focused `0x10017` window. Dequeue/dispatch advances from 8/7 before
Space to 17/15 at 30,820; the renderer input queue is empty at every captured
checkpoint. Accumulator samples during player controls stay between 527 and
1,102, with advancing stored time. Thus these captures include delivered
controls and subsequent rendered changes, rather than merely queued events.
No claim is made about audio, missions beyond this opening area, or a complete
texture/HUD implementation. The next useful investigation is the incomplete
texture/HUD rendering on this now-reachable gameplay route.

### Identity, bounds and preservation

The accepted locked-build module from `20261101-redline-catchup-runtime` was
reused because all **4,385** recorded source/test/tool/package input hashes
still match, before and after both runs. Its build-source commit remains
`bbfb46421afa71d0f3899f9dc3cd0ac2308183c8`; observation HEAD is
`cb0ac400b3af8a6ef3d838c7abdb3354791ad4c1`, with unchanged runtime inputs.
The accepted build log is copied into this run. Both actual WebAssembly compile
observations match retained `tested-module.wasm`, 2,025,619 bytes, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
Layout remains `ccbc5bf6dfb9610e`; the retained mirror SHA-256 remains
`3926a7a2bda6727de2852155e9764b24b8909001d1e2c6ba62e0eb4cab708b11`.
All 127 actual loaded-read hashes per run match the files after testing.

The launch remains `--app=redline_demo`, empty guest arguments,
`C:\MAINDIR` cwd, original EXE and IFORCE2-only seed, original 59-companion
manifest and shipped DISPLAY defaults. Full registration/fixture tests pass
before and after; all 70 host fixture hashes, including the full original
65-file extraction and package/archive pins, are unchanged. No production,
test or foreign WIP files were edited.

Exactly two local CLI guest invocations ran, each on an open PTY with
outer `timeout --kill-after=5s 150s`, inner `--max-seconds=120`, finite inherited
child guard and process-group cleanup. They finish by control `quit`, exit 0,
in 64.210 / 93.133 seconds, without timeout, trap or signal. No child was
requested. Both Python drivers, both outer processes and both Node guests
are absent; both process groups are empty. Disk remains above 2 GB. No box
was acquired: ID, state, expiry and lifecycle handback are N/A.

Commands, PTY/control logs, original-control text, actual inspected captures,
`analysis.json`, full source/fixture maps, loaded module/read manifests and
cleanup verification are retained in the ignored run directory. There is no
candidate-corpus ID, so the reviewed result remains investigation evidence
and is not attached to an unrelated dashboard candidate.


## Measured catch-up backlog (2026-11-01)

Run `20261101-redline-catchup-runtime` establishes the immediate reason the
ordinary CLI pump does not return during Stadium City selection: the main
thread is completing updates inside a large fixed-step backlog. Traversals
and callbacks return repeatedly; the accumulator decreases correctly. It has
not drained by the final observation. This is a measured local CLI cause,
not a mission-load fix or browser/WebGL qualification.

The required current-main locked build passed before the focused fixture test
and serialized runtime. Build-source HEAD was
`bbfb46421afa71d0f3899f9dc3cd0ac2308183c8`, following `18dd486c0` and incoming
`95b5a2440`. The actual compile inputs in both guest runs were the retained
2,025,619-byte `tested-module.wasm`, SHA-256
`168c61dae2861842948e5f9e29e4e18df93a6fab12c7d17f7dc85d75e34b7b55`.
Its layout is `ccbc5bf6dfb9610e`, matching the current mirror (SHA-256
`3926a7a2bda6727de2852155e9764b24b8909001d1e2c6ba62e0eb4cab708b11`).
The mirror copy, full source maps and actual loaded-read manifests are retained.
All 4,385 tracked source/test/tool/package input hashes were unchanged, as
were all 123 observed file reads in each guest run. No old module, historical
source overlay or identity bypass was used. Shared HEAD advanced through
unrelated documentation during observation; it is not substituted for the
recorded build-source identity.

Read-only counters were armed at original pinned-EXE addresses `0x49e6db`
(traversal entry), `0x49e8e8` (exit), `0x49e8d0` (callback return),
`0x53ad0e` (update return), `0x53ad1f`, `0x53ad29` (catch-up exit),
`0x53aa8a` (pump), `0x53aba3` (catch-up entry), and `0x53acff` (inner loop).
Frozen-boundary read-only snapshots record time, accumulator, registers,
stack, callback pointers, synchronization words and input queues. Counter
instrumentation changes interpreter optimization/pacing, so these batch counts
are diagnostic observations, not uninstrumented timing or browser throughput.

| Batch | Time at `0x5b8740` | Accumulator at `0x5b8744` | Update returns | Traversal exits | Pump entries |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 24,000 | 4,248,003 | 15,537 | 804 | 803 | 958 |
| 29,100 | 5,290,611 | 1,019,073 | 1,988 | 1,986 | 967 |
| 35,100 | 5,290,611 | 965,613 | 3,608 | 3,606 | 967 |
| 39,100 | 5,290,611 | 929,973 | 4,688 | 4,687 | 967 |
| 47,100 | 5,290,611 | 858,660 | 6,849 | 6,847 | 967 |

Across batches 29,100–47,100, 4,861 completed update returns subtract exactly
160,413 = 4,861 × 33. Traversal entries and exits each increase by 4,861;
callback-return count increases by 2,143,706. Catch-up entry remains 35,
exit remains 24, the inner-loop drain-exit remains 5, and pump remains 967.
Thus this interval is one progressing catch-up invocation, not one frozen
600-entry traversal. At batch 47,100 the actual EIP is `0x49e872`, DX 436.
The callback pointers sampled are `0x53aba3` and `0x52927a`.

Between batches 24,000 and 29,100, one additional catch-up entry updates the
stored time by 1,042,608 ms. Its effect reconciles exactly:
15,537 + 1,042,608 − (1,184 × 33) = 1,019,073.
The calculation uses 1,988 − 804 = 1,184 observed returns. The CLI's unchanged
default is 200 ms per batch. A large elapsed-time addition paired with slower
work completion explains the backlog on this route; no altered clock, budget,
register, guest memory or configuration was tested. At the last snapshot,
26,020 further 33-ms decrements would be needed if nothing else changes.
Whether the full backlog drains and the next elapsed-time addition permits
sustained pump progress remains unmeasured. No eventual mission load is claimed.

The static mutex ambiguity is also resolved locally: guest `0x5b81b0` contains
handle `0xe0002`. Its synchronization slot is type 3 (mutex), owner Win32
thread ID 1, recursion 1 throughout the snapshots. Worker emulator tid 1
(Win32 ID 2) remains at `0x4c2974`, waiting on that same handle; main continues
executing. This documents a worker waiting for main's owned mutex, without
establishing a circular deadlock. Main's nonzero diagnostic wait-handle field
is stale while its active state/yield 0 and progressing counters are observed.

The unchanged ordinary route opens DISPLAY at batch 11,000, accepts its
original defaults, then Play, Start Up and held mouse/Enter New Game. The
inspected batch-29,100 capture shows Stadium City mission selection. Enter
down at 29,100 and up at 30,100 stay in the renderer queue through 47,100;
observed dequeue/dispatch counts remain 6/5. The inspected final capture is
byte-identical to mission selection. It is a menu, not gameplay.

There were two actual guest runs, plus one Node preload-path failure before
CLI/module/guest creation (exit 1, 0.056 s). Guest run 1 ended cleanly after
batch 24,000 because the optional `input-state` diagnostic rejected a numeric
request ID; its startup measurements and error receipt are preserved. Guest
run 2 corrected the request ID to a string and completed the route above.
Both used open PTY/control-stdin, outer `timeout --kill-after=5s 150s`, inner
`--max-seconds=120` and ordinary `--spawn-processes` child guards inherited at
120 s. Both ended by control `quit`, exit 0 (10.462 / 17.209 s including
startup/control), without timeout, trap or signal. No guest requested a child.
All recorded guest/outer PIDs are collected and absent. No box was acquired;
box ID/state/expiry and lifecycle handback are N/A.

`node test/test-redline-demo-registration.js --fixture` passed before/after,
including full package, original archive and 65-file pins. The complete
70-file host fixture hash maps match. Original EXE/IFORCE2-only seed, empty
args, cwd and default DISPLAY route remain intact. Production and test files
were not edited. Evidence contains commands, full control responses, inspected
captures, build/test logs, module/source/mirror identities, quantitative
`analysis.json`, and exit/cleanup receipts. Free disk stayed above 2 GB.
No candidate-corpus ID exists; this remains investigation evidence, not a
dashboard pass. Remaining work is eventual drain/pump-return and subsequent
mission-load behavior under a separately scoped run; no further runtime was
launched in this assignment.

## Mission callback localization (2026-11-01)

Investigation `20261101-redline-mission-callback-cause` narrows the outstanding
work to the game's fixed-step catch-up path, but **does not establish the first
causal blocker**. It inspected the published `1dd8b642` run's actual Stadium
City capture, saved stack, input-state records and original pinned EXE using
existing disassembly/xref tools. No new guest invocation was made; there is no
new gameplay, browser or WebGL evidence. Production, tests and disk fixture
files were not edited.

The saved batch-52,200 EBP chain is coherent across five frames. Starting at
`0x074ffca8`, the return addresses are `0x43e726`, `0x529290`, `0x53ad0e`,
`0x53ab4d`, `0x5398c1`; saved EBP advances through `0x074ffcd0`,
`0x074ffce0`, `0x074ffcf0`, `0x074ffd18`, then outside the captured stack at
`0x074fff6c`. Original disassembly resolves the innermost calls as:

- `0x43e721` calls the UI traversal `0x49e6db`, returning at `0x43e726`.
- `0x52928b` calls that input/UI update `0x43e712`, returning at `0x529290`.
- `0x53ad08` calls the function pointer at `0x5b6d4c`, returning at
  `0x53ad0e`. This stack establishes the active callback path through
  `0x52927a`; the pointer itself was not sampled.
- `0x53ab47` calls the pointer at `0x5b6d48`, returning at `0x53ab4d`.
  The saved inner frame is in `0x53aba3`, the fixed-step catch-up function.

That catch-up function reads `WINMM!timeGetTime` at `0x53accf`, adds the
elapsed difference from `0x5b8740` to accumulator `0x5b8744`, and saves the
new time. While the signed accumulator is at least 33, `0x53acff` calls the
update callback, then `0x53ad0e..0x53ad1d` subtracts 33 and loops. This inner
loop contains no message pump. Only after it drains can the function return
through `0x53ab4d`, then `0x53ab8c` jump back to `0x53aa7d` and the ordinary
`PeekMessageA` loop at `0x53aa8a`. This is a concrete pump-return dependency,
not proof of excessive accumulated time or scheduler starvation.

The UI traversal is bounded by a signed 16-bit index below 600, with an
additional early exit when its remaining-live-entry count reaches zero.
Batch 42,200's EIP `0x49e8d0` is exactly the return site of the indirect
virtual call at `0x49e8cd`: at least that UI callback returned. Batch 52,200
has EIP `0x49e872` and DX 418 at the index-increment block. Neither sample
records the index at both times, the entry count, callback target, traversal
entry/exit counts or accumulator. Therefore neither a single traversal stuck
forever nor repeated completed traversals is demonstrated. The last dispatched
message being Enter-up does not establish an outstanding DispatchMessage call;
the captured call chain instead places execution in the pump's update path.

Message ownership is localized to the existing renderer queue: both saved
input-state records retain six later events, main is active with no wait,
and the focus/routed window is `0x10017`. This explains where delivery awaits
the pump, without proving why the pump has not returned. The worker's
`0x4c2974` wrapper calls `WaitForSingleObject`; its paired constructor calls
`CreateMutexA` and its release calls `ReleaseMutex`, **not SetEvent**. The
static global mutex object at `0x5b81b0` participates in a separate update
path at `0x53ad7d`, which acquires, calls the same update pointer, and releases.
The saved worker wait handle `0xe0002` cannot be mapped to that object or an
owner from these records: neither object contents nor the worker stack nor
ThreadManager mutex ownership was captured. No mutex deadlock is established.

The precise remaining runtime question is whether `0x5b8744` decreases across
completed `0x53ad0e` returns and reaches below 33 before another elapsed-time
addition, and whether `0x49e6db`/its callbacks return during that interval.
Existing `--count` diagnostics on the traversal entry, return block
`0x49e8e8`, callback-return block `0x49e8d0`, catch-up loop/exit and pump entry,
paired with read-only accumulator/index/stack/mutex-owner observations, would
distinguish those cases. The predecessor evidence cannot supply these missing
values; no speculative runtime fix was made.

Fresh execution stopped at a concrete identity prerequisite. Inspection began
on main `1810077ac3b4c26d5cdc723407dd8612f0082d77`, after Rune had released its
runtime. Incoming `95b5a2440` changed three previously loaded host sources:
`test/run.js`, `lib/apps.js`, and `lib/region-map.generated.js`. The retained
validated module still hashes to `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`
and carries layout `3a03507bae8914c0`; the current JS mirror carries
`ccbc5bf6dfb9610e`. The CLI's existing pre-instantiation guard refuses that
pair. Thus exact unchanged validated-build reuse is unavailable in this shared
checkout. No launch was spent on the known mismatch; no bypass, historical
source overlay, rebuild or guest mutation was performed. A matching validated
source/module/mirror set is required before collecting the missing runtime
observations. This host identity prerequisite is separate from the still
unproven guest cause.

Evidence includes original-EXE disassembly/IAT names, reconstructed stack,
saved queue/thread samples, current/prior source and module identities,
registration output and command/exit receipts. The inspected screenshot is a
byte-preserved predecessor capture, explicitly labeled as reused. The focused
`node test/test-redline-demo-registration.js --fixture` check passed; all 70
host fixture files match the predecessor's after-map. Documentation diff check
passed. No guest/child was created, no authentic VFS state was changed, and
no box was acquired (ID/state/expiry N/A). Disk remained above 2 GB. This is
an investigation-only record with no candidate-corpus ID or dashboard pass.

## Original local CLI progress (2026-11-01)

Run `20261101-redline-original-cli-progress` reached the original launcher,
DISPLAY dialog, Beyond Games splash, Start Up menu and mission selection.
The inspected mission-selection capture highlights **Stadium City**. Opening
that mission did not succeed within the bounded run: later ordinary Enter and
mouse input remained queued while the main guest kept executing. There is no
player-controlled gameplay evidence. This is local CLI compatibility evidence,
not browser, WebGL, authentic Windows installation or hardware qualification.
The older runtime-transfer restriction below concerns the remote lane; this
assignment explicitly authorized the existing local fixture.
The launcher visibly titles itself `Redline Demo - v0.90 1/19/99`; that observed
label is separate from the PE timestamp and the readme's January 28 date.

Tested shared main `d4b5757889c59a4bb17c9a3b47c9759fb62ace60`, a documentation
advance from requested `36592af3b884b95d2f14dc5474c5c541a1640e95`.
No source, test, helper, app registration or fixture edits were made.
`node test/test-redline-demo-registration.js --fixture` passed before and after:
the original package, all 65 original members and 60 game files retain their
pins, including EXE SHA-256
`fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`.
The host tree's full 70-file map (65 originals plus existing metadata/manifest)
also matches before/after. Launch cwd remains `c:\MAINDIR`, guest args empty,
and the sole app-local DLL seed remains original `IFORCE2.DLL`.

No loose CFG was supplied. The game itself generated `c:\maindir\redline.cfg`
in its ephemeral VFS through the ordinary route. A read-only snapshot is
retained as `guest-generated-redline.cfg`, 2,500 bytes, SHA-256
`aa7d4bd36cfef68c47737d26d613bc023f5125f3872ccd75c7a9ac5d4b1a60c5`.
It records `displaydevice 'display'`, `screenwidth 640`, `screenheight 480`,
`screenbbp 16`; it was neither edited nor fed into subsequent runs. No renderer,
DirectX, registry, dependency or installed-state override was used.

All three runs used an open PTY and this exact command, replacing `N` with
`1`, `2` or `3` and inserting the diagnostic flags listed below:

```sh
timeout --kill-after=5s 150s node \
  --require ./scratch/runs/20261101-redline-original-cli-progress/observe.cjs \
  test/run.js --app=redline_demo --no-build --wasm=build/wine-assembly.wasm \
  --quiet-api --quiet-blocks --no-close --max-seconds=120 --spawn-processes \
  --control-stdin --frozen \
  --png=scratch/runs/20261101-redline-original-cli-progress/runN-final.png \
  --tee=scratch/runs/20261101-redline-original-cli-progress/runN.log
```

Read `docs/cli-run.md`, the control implementation and both child launch paths
before launch. `--spawn-processes` enables actual ordinary child execution;
both child paths inherit `--max-seconds=120`, and the parent collects/kills its
children on exit. No child process was requested or spawned in these runs;
Play creates the game window in the same emulator. The outer 150-second process
group watchdog bounds even frozen think time (the inner guard pauses while
frozen). Each run ended through control `quit`, exit 0, with no trap, signal or
watchdog expiration. There were never overlapping guest trees; no guests remain.

The command channel accepts `{"action":"step","n":11000}` and
`{"cmd":"click:130:337"}`. Common ordinary route: step to batch 11,000,
click DISPLAY at (130,337), step 2,000, click Done at (127,331), step 1,000,
click Play at (132,281). The DISPLAY screenshot shows the original selected
Primary Display Driver (display) and 640x480x16; no selection was changed.

- Run 1: captured splash at 19,000 and Start Up at 24,000. A click on New Game
  at 29,000, Enter held for 50 batches, a mouse press held for 100 batches,
  and relative motion (0,-18) followed by a 1,000-batch press did not advance
  the displayed menu through 50,250. Exit after 72.616 seconds of run-loop time,
  191,656 API calls. This established an input symptom, not a deadlock cause.
- Run 2 was a focused diagnostic, adding `--trace-input --trace-input-dispatch`
  and `--trace-api=PeekMessageA,GetMessageA,DispatchMessageA,GetAsyncKeyState,GetCursorPos,IDirectInputDevice_GetDeviceState,IDirectInputDevice_GetDeviceData,WaitForSingleObject,SetEvent,ResetEvent --trace-api-paused`.
  At menu batch 24,000, move and press at (330,148), plus Enter down, step 100,
  then release mouse/Enter and step 5,000. API tracing was enabled only during
  that 100-batch hold. Both DirectInput device reads returned S_OK, and a
  read-only buffer observation found mouse button byte 0x80. At batch 25,525,
  six queued events drained and five entered DispatchMessageA. The inspected
  capture at 29,100 shows mission selection. Thus an unconditional input-polling
  failure is disproven; the simultaneous mouse/Enter sequence does not isolate
  which action selected New Game. Exit 28.410 seconds, 179,303 API calls.
- Run 3 added only `--trace-input-dispatch`, repeated that successful held-input
  route and visually reconfirmed mission selection at 29,100. Enter down at
  29,100, up at 30,100, then 5,000 batches did not open Stadium City. Next,
  move to (95,120), relative motion (-240,0) over ten batches, step 100, press
  at (95,120) for 2,000 batches, release and step 5,000, then another 10,000.
  Through 52,200, the mission-selection PNG remained byte-identical and six
  later events stayed queued: Enter down/up, motion, hit-test and button down/up.
  The earlier six dequeues/five dispatches never increased. Exit 49.443 seconds,
  192,774 API calls. Stopped here; no fourth invocation or source repair.

First demonstrated remaining route blocker: **Stadium City selection does not
progress in this bounded execution**. Read-only snapshots at 42,200 and 52,200
place main EIP at `0x49e8d0` and `0x49e872`; the latter is a 16-bit-index loop
over 600 UI entries, with indirect callbacks at `0x49e8cd`. The stack still
contains 5,132,611, matching the last observed guest tick after the earlier
input dispatch; the exact outstanding callback has not been identified. Thread 1 is
active at `0x4c2974`, yield 1, wait handle `0xe0002`; no held-critical-section
failure was printed. These observations do not prove an infinite loop,
scheduler starvation, missing DLL causality or a renderer defect. Startup also
warns that system `ole32.dll`/`shell32.dll` real-PE files are absent; do not
replace them or treat those warnings alone as the demonstrated cause.
The next causal assignment is to trace the mission-selection callback/dispatch
return and its 600-entry traversal, including loop progress and thread/event
ownership, using the preserved ordinary route and unchanged fixture.

All three actual WebAssembly.compile inputs were 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`;
the exact bytes are retained as `tested-module.wasm`. Accepted locked build
`20261101-thread-manager-options-land` (40.431 seconds, PASS, accepted commit
`9ba1c215c1766b39da747f386e0820f7399f6c93`) was reused. All 1,153 preceding
Rune source inputs plus both package files match before/after; all 66 tracked
actually read sources match that accepted build commit. The observer records
123 distinct reads including installed dependencies/media, unchanged afterward.
Selected SHA-256 identities: `test/run.js`
`69f1d0193b0fddd31660a95271afba4e52a71bf09eb73e29e93c1e6d277f30bf`,
`lib/apps.js`
`f95d5d6c37062a8c38accebed9ac6ae7d6d9589e8c482b5100bfc2a9f23b30c8`.

Ignored evidence directory: `scratch/runs/20261101-redline-original-cli-progress/`.
`commands.json`, `ordinary-inputs.json`, logs, snapshots, loaded-source/module
hashes, before/after fixture maps, disassembly and PNGs preserve the route.
Actually inspected launcher, DISPLAY, splash, Start Up, run 2/3 mission
selection and final blocker captures. Redline has no candidate-corpus ID, so
the investigation record has `candidateId: null` and is not a dashboard pass.
Documentation diff check and fixture checks passed. Disk stayed above 2 GB;
box ID/state/expiry/shutdown N/A, no box ownership acquired. No browser,
download, transfer workaround or public deployment was performed.

## Local candidate registration (2026-11-01)

The recovered original is registered as local-only experimental `redline_demo`.
Use the ordinary local `index.html?candidates&app=redline_demo` selector route.
This is static launch preparation; no browser, installer, game or gameplay was
executed. Public eligibility is unchanged. The earlier recovery report below
describes the media-only stage before registration.

Canonical ignored fixture: `test/binaries/candidates/redline-demo/`.
`original/MAINDIR/` contains all 60 unchanged original run files, including
both readmes, Mplayer support, I-Force files and the whole data container.
The other five extracted support files remain under `original/` with their
exact extraction-relative paths; installer TEMP/GROUP_PATH labels are not
mounted as invented installed Windows locations. All 65 candidate files are
independent byte copies, with no shared inodes or links to archival originals.
There are no generated settings or modified guest files.

The entry launches `original/MAINDIR/Redline.exe` as
`c:\MAINDIR\Redline.exe`, with cwd `c:\MAINDIR` and empty arguments, preserving
the original shortcut's relationship. The ordinary schema1
`.wine-assembly-browser.json` lists exactly the other 59 MAINDIR members with
explicit `c:\MAINDIR\...` paths and exact whole-file sizes. It retains the
three auxiliary EXEs as companions. It uses the current manifest validation
contract without an integrity bypass or a claim that its optional single-EXE
integrity format can describe this multi-EXE tree. Separate full-file checking
pins the package and all 65 extracted files against the table below.

Static import-table and printable dynamic module-name inspection of both
Redline.exe and IFORCE2.DLL found `IFORCE2` as the only game app-local seed.
It imports KERNEL32/ole32; printable module names also include user32/kernel32.
Redline's names otherwise match its system imports listed below. Therefore
the entry seeds only the original `IFORCE2.DLL`, using the host's existing
basename DLL policy. Mplayer's Url.dll/Rnaph.dll and installer DxDlg.dll are
preserved support files, not injected startup dependencies. Static inspection
cannot establish every dynamically constructed runtime dependency.

The native original DISPLAY selection / Play first-run flow remains intact.
No renderer, default selection, registry overlay, CFG, DirectX version
override or dependency injection was added. Whether original installation
side effects are necessary remains unknown; static extraction and a source
readme do not constitute installation or runtime evidence. DirectX 6 / 3D
prerequisites, rendered output, input, audio and gameplay remain unqualified.
Runtime access stays blocked pending authorized functioning transfer. Boat
ID/state/expiry: N/A; no box or runtime lifecycle ownership was acquired.

The original package is deliberately referenced, not duplicated:
`scratch/runs/20261031T2348Z-redline-original-recovery/RLSPDEMO.EXE`, with the
48,229,213-byte SHA-256 pin below. `.host/package-reference.json` records this
predecessor reference; `.host/inventory.json` and `inventory.sha256` retain
whole-file recovery pins. The predecessor's actual handoff is `RECOVERY.md`
(`RECOVERY.txt` does not exist). Its extraction/package/source files remain
unchanged. To recheck recovery and the actual registered fixture from repo
root, run:

```sh
node test/test-redline-demo-registration.js --fixture
```

The explicit fixture mode fails if media is missing. It verifies the package,
all candidate and archival whole-file hashes, exact 65-file set and 60-file
run tree, independent inodes, the canonical inventory digest, exact registry
entry and manifest, actual CLI resolver, browser-relative URLs/VFS paths,
ordinary loading policy (8 eager / 51 lazy; synchronous reads: 59 eager),
and checked-out local selector / public exclusion expressions. Without
`--fixture`, the test checks registry and selector behavior without requiring
ignored media. Evidence, static PE/string inspection, gate logs and recovery
instructions: `scratch/runs/20261101T0002Z-redline-local-registration/`.
The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passed, as did
the focused fixture check, file-policy / candidate-manifest tests, census
mutation tests and Rune registration regression. The reviewed census change
updates only the apps host-file SHA; all boundary/ownership fields remain
unchanged. `/home` remained above 2 GB free (over 2.56 GB at final build).

Static media recovery only, 2026-10-31. No installer, game, browser or runtime
was executed; no box was allocated or accessed. Gameplay compatibility remains
unknown. The recovery base is main `81f5df0c8966ef74e23bb0961cf8cc1e746d0efe`,
a descendant of requested `4efd707960b1b4bbbce2f77b11c9da84b7c8b305`.

Evidence and original media are retained in the ignored directory
`scratch/runs/20261031T2348Z-redline-original-recovery/` (called `R` below).
Before ownership, searched existing reverse-engineering notes, `lib/apps.js`,
`TODOS.md`, `ops/STATUS.md` and the append-only messageboard. No competing
Redline game ownership, qualified lane or hold was found. References to
Rendition's `redline.dll` concern a different component. The coordinator's
Redline task/status entry is this assignment. No registry or candidate files
were changed.

## Source and identity

Selected the standalone Windows package
[`RLSPDEMO.EXE`](https://archive.org/download/RedlineDemo/RLSPDEMO.EXE)
from Internet Archive's
[`RedlineDemo` preservation item](https://archive.org/details/RedlineDemo),
uploaded in February 2012 and attributed to Beyond Games / Accolade, 1999.
This is a credible preservation mirror, not a publisher-hosted download or
cryptographically authenticated publisher release. The item's description
discusses multiplayer; the actual Wise script explicitly names this payload
**Redline Single Player Demo**. Its executable and original readmes determine
the recovered build's identity.

[PCGamingWiki's preservation entry](https://community.pcgamingwiki.com/files/file/2800-redline-demo/)
separately identifies single-player `reddemo.exe` and multiplayer `reddemo_m.exe`
and links archived FilePlanet IDs 47170 / 47169. Those historical names are
leads, not a claim that `reddemo.exe` is byte-identical to `RLSPDEMO.EXE`.
[ModDB's demo mirror](https://www.moddb.com/games/redline/downloads/redline-demo)
bundles both demos in `redlinedemo.zip` (67,366,650 bytes; advertised MD5
`6e6712d976529fea06a6e266847f97fe`). That ZIP was not downloaded or verified.

Saved Archive metadata records the selected package as 48,229,213 bytes,
MD5 `ad55f1adc4b3a094b1576ff95956d777`, SHA-1
`57618ed347c2ee842ba5bfad391a04a14f70e5d4`.
HTTP range probes returned 206, total 48,229,213 bytes, last modification
2012-02-15 17:14:16 GMT and ETag `"4f3be7e8-2dfeb5d"`.

## Static extraction and installation boundary

The 65-member Wise file table was parsed from the first 65,536 bytes before
the full download. It advertises **91,645,042 expanded bytes**. Admission
reserved the complete package plus complete expanded payload and 3 MB for
helpers/evidence; the combined task limit is 200,000,000 bytes, and `/home`
must remain above 2,000,000,000 free bytes. No compilation archive was
downloaded. An unrelated 27.99 GB WizardWorks archive was identified through
metadata only; its archive listing returned HTTP 403 and it was not fetched.

REWise extracts original bytes without running the Windows installer.
`extracted/MAINDIR/` is the game's original run-file tree; `TEMP/`,
`UNINSTALL_PATH` and `GROUP_PATH/` retain installer support and website files.
These variable names are extraction labels, not literal installed Windows
paths. Static extraction does not perform the original installer actions.
The readme documents interactive double-click installation; additional
installer command-line arguments and any required installer cwd are unknown.

The original script sets the default directory to
`%PROGRAM_FILES%\Accolade\Redline Single Player Demo`. Its ordinary game
shortcut and finish-page launch target `%MAINDIR%\Redline.exe`, with empty
arguments and working directory `%MAINDIR%`. Therefore the corresponding
extracted-tree launch proposal is `Redline.exe`, cwd `R/extracted/MAINDIR`,
args empty. This is source-backed launch intent, not a successful launch.
The separate Mplayer shortcut targets `mplaynow.exe`; it is not the
single-player executable.

The script invokes the bundled `TEMP/DxDlg.dll` export `DirectXDlg`, creates
shortcuts, installation log and uninstall metadata, and offers desktop icon /
launch choices. `wise-script.log` retains the parsed original operations,
including the empty shortcut argument field and cwd. No installation replay,
registry/config fabrication, dependency replacement or patch was performed.

## Original prerequisites and ordinary first run

`MAINDIR/Readme.doc` and `Readme.rtf` identify a **January 28, 1999 single-player
and network demo**. They describe two training missions, Stadium City followed
by Yahoos, and multiplayer arenas MultiAirport / Triagonizer. This differs
from the Archive item's older multiplayer description. A numeric release
version for these actual bytes has not been established; the catalog's 0.90
label for another filename is not adopted as an executable version.

The original System Requirements section specifies Windows 95/98, AMD K6-2
233 or Pentium 200, 32 MB RAM, DirectX 6, compatible display and sound drivers,
and a 3D accelerator. It advertises 75 MB disk space, which is smaller than
the actual recovered run tree; use the measured sizes here for storage
planning. IPX LAN or TCP/IP is listed for multiplayer. The Installation
section calls its installer `REDLINEDEMO.EXE`; this name differs from the
mirror's `RLSPDEMO.EXE`, and no byte-identity claim is made for the former.
It says to follow the installer prompts and obtain DirectX 6 if missing.
The driver section says a DirectX installation requires a restart.

The documented first-run sequence is the original launcher, DISPLAY hardware
selection, then Play Redline. The launcher documentation recommends selecting
the primary display device for a combined 2D/3D card. It exposes resolution
and advanced options; none were selected or changed here. Then New Game
reaches the first mission according to the readme. These are instructions for
future ordinary use, not observed behavior. Arrow keys move/drive, Ctrl fires,
Space jumps on foot or brakes in a vehicle, and Delete/Page Down exits a
vehicle. The readme discourages editing `Redline.CFG`; no loose CFG is shipped
in this extracted tree and none was created. Any defaults inside `Redline.bgd`
remain untouched; its internal format was not unpacked.

Static PE imports of `Redline.exe`: `SHELL32`, `DDRAW`, `DINPUT`, `DSOUND`,
`WINMM`, `USER32`, `GDI32`, `ole32`, `WSOCK32`, `IFORCE2`, `ADVAPI32`,
`KERNEL32`. The bundled `IFORCE2.DLL` imports `KERNEL32` and `ole32`.
`DDRAW` imports include `DirectDrawCreate` / `DirectDrawEnumerateA`, and
`DINPUT` includes `DirectInputCreateA`. These are static import observations,
not a complete runtime dependency trace. Executable strings also state the
DirectX 6 and 3D acceleration requirements and name
`SOFTWARE\Beyond Games\Redline`; required initial registry values, if any,
remain unknown. No DirectX redistributable is present among the 65 members.
Authentic DirectX 6 installation and working 3D driver enumeration are the
first ordinary launch prerequisites to establish in any future runtime lane.
No native-DLL mapping or compatibility claim is made.

## Actual pins and validation

Recovered package SHA-256:
`e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c`.
Both catalog MD5 and SHA-1 matched the complete downloaded bytes.
`MAINDIR/Redline.exe` is a 1,828,864-byte PE32 i386 Windows GUI executable;
SHA-256 `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`.
Its COFF timestamp is 1999-01-28 02:05:18 UTC (a header field, not independent
release-date proof); preferred image base is `0x00400000`.

All **65 extracted files / 91,645,042 bytes** matched the pre-download Wise
table's paths and sizes. Every file's computed CRC32 matched the original
script, and REWise `-V` independently reported success for all 65 members.
The complete `MAINDIR/` run tree is **60 files / 91,406,857 bytes**, including
the original readmes, I-Force files, Mplayer support and 48 WAV files.
The main `Redline.bgd` container is 71,788,765 bytes; it was retained whole.
No original settings, bytes or filenames were modified.

`inventory.json` records path, size, SHA-256 and CRC32 for every file.
`inventory.sha256` uses sorted paths and canonical lines of the form
`SHA256`, two spaces, decimal byte size, two spaces, path, newline. Its
SHA-256 is
`08c55c1a9054ec7f0d8ceb717aa308d7bd338e7a542d3ffbde56965b353d82df`.
The full inventory is also pinned below so recovery does not depend on
ignored evidence surviving.

Evidence: `preflight.json`, `redlinedemo-metadata.json`, `range-metadata.json`,
`head-list.log`, `head-recheck.log`, `download-admission.json`, `download.json`,
`extract-admission.json`, `extraction.log`, `verify.log`, `wise-script.log`,
`redline-pe.txt`, `iforce-pe.txt`, `dxdlg-pe.txt`, original readmes and
`validation.json`. The DOC's printable strings were inspected statically;
neither document was opened in a GUI.

The first geo download and a sequential direct-server continuation were
terminated (own processes, exit 143) because of slow transfer. Four disjoint
HTTP 206 ranges completed the same file, with exact Content-Range/length
checks and final whole-file catalog hash verification. No second package
copy was retained. An attempted filtered extraction from only the head probe
failed with a parser/seek error and produced no payload; complete-package
extraction, full CRC verification and independent table checks passed.

At the completed extraction check, this task's logical files totaled
140,696,032 bytes and `/home` had 2,226,073,600 bytes free. Both download and
extraction had separate pre-write admission checks; downloads also checked
remaining extraction headroom while writing. Original predecessor files were
read only. No project build is required for this documentation-only commit.

## Recovery recipe

Use a newly owned, empty ignored run directory; never extract over an existing
fixture. Retain the whole original package, readmes and all run files. The
readme contains Accolade's copyright notice; no redistribution license was
established and no media was published.

Extractor: official REWise revision
[`c3d3b68903a90ec53ff7b0a4ae704adc6302814b`](https://codeberg.org/CYBERDEV/REWise/src/commit/c3d3b68903a90ec53ff7b0a4ae704adc6302814b),
source URL
`https://codeberg.org/CYBERDEV/REWise/archive/c3d3b68903a90ec53ff7b0a4ae704adc6302814b.tar.gz`,
1,724,088 bytes, SHA-256
`7f18fd53180cc4f9547fb62c232952b414b71e5c89286604751c898a91e447da`.
This task reused the existing verified source archive from
`scratch/runs/20261031T2253Z-rune-demo-media-resume/` without changing it,
copied its source/COPYING/README/Makefile into `R/rewise-source/`, and built a
small standalone extraction helper. Its local SHA-256 is
`8da810cf481dd17764854289aa28be727b34390e6d2b01e1320c8ca3668c6203`;
compiler-dependent helper identity is separate from game/package identity.
`extractor-source-pins.json` records every copied source file. The debug
variant built with `-DREWISE_DEBUG` supports `-z` for static script inspection.
No Windows installer or game code runs through REWise.

For fresh recovery, first recheck space. Allow at least 145 MB task headroom
for package, expanded payload, source and bounded evidence, while preserving
the 2 GB free-space floor and 200 MB task ceiling. Re-fetch the 64 KiB head
with HTTP 206 and confirm the exact expanded table before any full download.
Then use the stable package URL above; the metadata also advertises direct
server `https://ia801407.us.archive.org/19/items/RedlineDemo/RLSPDEMO.EXE`.
If endpoints change, read `/metadata/RedlineDemo` for current servers; require
the same package size and pins rather than trusting the filename.

Commands below assume `R` is that empty owned directory, the pinned source
has been verified and selectively extracted to `R/rewise-source/`, and fresh
download/disk checks have passed. Use bounded HTTP timeouts and size limits.

```sh
gcc -Wall -I"$R/rewise-source/src" \
  "$R"/rewise-source/src/{rewise,CP1252,print,reader,exefile,pkzip,wildcard,wisescript,wiseoverlay}.c \
  -o "$R/rewise" -lz
mkdir "$R/rewise-tmp"
curl --fail --location --max-time 60 --range 0-65535 \
  https://archive.org/download/RedlineDemo/RLSPDEMO.EXE \
  -o "$R/range-head.bin"
"$R/rewise" -l -p -t "$R/rewise-tmp" "$R/range-head.bin"
# Require 65 members / 91645042 bytes; repeat free-space admission.
curl --fail --location --max-time 600 --max-filesize 48229213 \
  https://archive.org/download/RedlineDemo/RLSPDEMO.EXE \
  -o "$R/RLSPDEMO.EXE"
# Require 48229213 bytes and package SHA-256 e9998c385851b7ef394a412a257a58c179711e4842df3a601ced545e0e8e3f7c.
sha256sum "$R/RLSPDEMO.EXE"
# Repeat free-space admission immediately before expansion.
mkdir "$R/extracted"
"$R/rewise" -x "$R/extracted" -p -t "$R/rewise-tmp" "$R/RLSPDEMO.EXE"
"$R/rewise" -V -p -t "$R/rewise-tmp" "$R/RLSPDEMO.EXE"
```

Compare every extracted path, size and SHA-256 with the table below.
The retained `R/check-media.py` additionally compares all original script
CRCs and recreates the canonical inventory digest. Its use in this run is
recorded in `validation.json`; that script is an evidence helper, not a
tracked runtime or app registration.

Next: preserve this fixture for a separately authorized ordinary installation
and first-run lane that establishes authentic DirectX 6 / 3D hardware support.
Installation side effects, generated settings, actual rendered output,
input, audio and gameplay remain untested. Runtime/Boat ID, state and expiry:
N/A; no lifecycle ownership was acquired.

## Complete extracted file pins

Paths below are relative to `R/extracted/`. All hashes are SHA-256.

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `GROUP_PATH/Accolade Website.url` | 51 | `fd1eca0f4e9d0aab1a7a2b01cebaf1f353d463c9fe845dad8f9f382eeda0f95a` |
| `GROUP_PATH/BeyondGames Website.url` | 54 | `44768e854571fd9092b9e6067dd89572d984fc032fa552467a087f480710313f` |
| `MAINDIR/IFORCE2.DLL` | 68608 | `13df61b255529952085af6812890ff824245479513a5a610b81cb5edca4a7ad1` |
| `MAINDIR/Mplaynow.ini` | 222 | `0b3350903136d46aa6395a4db2598ec144b108f38aab3d22aab833d8a0a18ecb` |
| `MAINDIR/Mplaynow/Mplayer/setup.EXE` | 1038780 | `d08aa48938b4577f4b6e93d1be3613266300ddef020cb37933d6bf3397ed9004` |
| `MAINDIR/Mplaynow/Mpnetsue.exe` | 10112 | `af605d85dd58e8f00c8970e28cfea4a92e8c9eb4842559b4172e9947a1fc69b8` |
| `MAINDIR/Mplaynow/Rnaph.dll` | 9728 | `a72e6d59937affc14ceaf55bd5663968c4e78c1399d45c55283552e23a8a86be` |
| `MAINDIR/Mplaynow/Url.dll` | 87552 | `b00a7034f2e34350f9c2efd402f786716994fee98d7ae26c9b0ff59dfa8c1fa5` |
| `MAINDIR/Readme.doc` | 89600 | `a31bb6fbe7086b6128c8f6af0a77e7e97625a947396c8eacbd15f04500ae6828` |
| `MAINDIR/Readme.rtf` | 65275 | `4b91a429ada240d65a3ddc577842766397abb026c817e8c9204dfcb44023b02c` |
| `MAINDIR/Redline.bgd` | 71788765 | `840dc1421e88708bb64de686e6a996e2638c27693b25ecdb54237824c64808aa` |
| `MAINDIR/Redline.exe` | 1828864 | `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e` |
| `MAINDIR/mplaynow.exe` | 273408 | `ae9577e276413b5635194521417f01919b799f33b287bcbaaa458ed99baada00` |
| `MAINDIR/redline.ifr` | 1217 | `b3e9f558349f50beff05b7f87efc0730b5f7e04e5516999a29bcf32b7140d82a` |
| `MAINDIR/wav/CrowdPanic2.wav` | 440378 | `f9a2680dbeda57031f497c98ae4ce56e53c24abc939c69c0306b80a16e624bf6` |
| `MAINDIR/wav/EnviroGrowl.wav` | 459566 | `e961f27ca0431eae28695111971b246c96efa5b0e0b9bac2666eb0f29106a47f` |
| `MAINDIR/wav/EnviroHall.wav` | 84090 | `38fb370728a5af3b8325effa05974baa331521aa568e2c2291b5dfb48f205aad` |
| `MAINDIR/wav/RantGrowl.wav` | 210160 | `7cb94ab93831f66d7b51c92e6fa4e6e3e3f6d9f9e132b6e118a202b6c85452b7` |
| `MAINDIR/wav/Stad1st_01.wav` | 633978 | `8cbb5a87e5b158404a24ec7add3f351b3c0ba2a2bc7552624079883556a27adf` |
| `MAINDIR/wav/Stad1st_02.wav` | 469382 | `19391bf8d8230a3943478560085f2dda6e77e83829df76e9ca10c3e140ac799f` |
| `MAINDIR/wav/Stad1st_03.wav` | 370394 | `b5495309afc9f345872093815e8c2415731e66fc91b29b6f7c3662359edb3c82` |
| `MAINDIR/wav/Stad1st_05.wav` | 937328 | `fdb32af0176127a1371e5648a7b9e55984dbd76f29885f4652073c3990a0e8cd` |
| `MAINDIR/wav/Tox5.wav` | 121614 | `db5874dcb6b12a48ea93cbafa3f3f35d452e0e918d3d488aab92bba84e679c6a` |
| `MAINDIR/wav/YahooIntro.wav` | 1503280 | `3b945517ba1373e3bf092bbfa04ba4c157b7093b5e86c593d99fd93f2695ed7f` |
| `MAINDIR/wav/flameboom.wav` | 101840 | `581a38591f569a1e14309326e0a3f4858eb2731644255acbe7d799e20d31d7f4` |
| `MAINDIR/wav/howlingchamber.wav` | 283838 | `da65e0c34b146776bdd2e250120e7077b305993f698ddc7130d8de98fa4fdab8` |
| `MAINDIR/wav/hub0.wav` | 1478300 | `a5f6244ae720a03cd58bad3bd9d8a012c89d17241bc1b38b82359956d292d1fa` |
| `MAINDIR/wav/hub0_1a.wav` | 281104 | `146421e0296f693c6149d2592122eb6f6bd5d0b5304325967d29fa5936d4a080` |
| `MAINDIR/wav/hub0_1b.wav` | 221042 | `9829322e53ef3e006a252d4df621e275adddc84ac2ff2d85374cf875c1b9f162` |
| `MAINDIR/wav/hub0_1c.wav` | 512144 | `4db534b2034689026f4dfaf2e517415ff9712faee460883a6cebbef16454e394` |
| `MAINDIR/wav/hub0_2.wav` | 317578 | `e076757e5c1cb1316c1de9428718cadc257065d12708a28455e576f4790dfe37` |
| `MAINDIR/wav/hub0_3.wav` | 133240 | `dfd54ea955d760baa4c0cbe9ea1cc848628d640d03aaaa04aecf41dde068b834` |
| `MAINDIR/wav/hub2.wav` | 143116 | `db0dd776bdc9d7199124113017dc6db3fe6ab7cc30214fec8c00d36972853b70` |
| `MAINDIR/wav/rumble1.wav` | 79178 | `d76441e1a2a13560ee59e8d93ac61bffc479c369ef629a82b8c7c3fb52b09ac7` |
| `MAINDIR/wav/stadSong2.wav` | 976712 | `afcd3138b42ad0eff7d2679b4612d7f22db420a438906984036b9c436abf4c8b` |
| `MAINDIR/wav/stadSong3.wav` | 941132 | `f4d10d9d2a9ff884f129dc1323a0b4ee33f5c77640fbd2ed70b9b6a0c133fa0b` |
| `MAINDIR/wav/stadium10.wav` | 82810 | `63069fbebe883e9ac9d5dc695304cae854a72107c6a836e2d047d43ccd480b18` |
| `MAINDIR/wav/stadium11.wav` | 59580 | `de140fd5224548b264cfb27c3a014da414a3e7699508b993a52c4ea641d40baf` |
| `MAINDIR/wav/stadium13.wav` | 39542 | `a92a4fbba37b5c2fa0b42f691d7a50c313283f89c533c484a0be8cd097df4fed` |
| `MAINDIR/wav/stadium14.wav` | 93182 | `4bda00558b16fded36c3ce05e9520fd11a5c2b67f437e926f33aa7902c6912d6` |
| `MAINDIR/wav/stadium9.wav` | 328782 | `17bcecc84f50f46666f7c70a979b3b1f1e389403df2daf1a82b25b01dfd8e771` |
| `MAINDIR/wav/windLoop.wav` | 203646 | `f02df070838380f1d0d863019074d837a069a212e5955b0113e93db5448727d1` |
| `MAINDIR/wav/yahoos1.wav` | 191992 | `2fd9a7d586d444d7f659452b0ddcd8ffe091bb268cad259c4d19003d90e4b4db` |
| `MAINDIR/wav/yahoos10.wav` | 285420 | `cfa5918fcc323907db3bf72137ed51ad6cc3648d9784de11391625898de2e21c` |
| `MAINDIR/wav/yahoos11.wav` | 125992 | `7b689566e1cc2b7620855b470b2a89faa68f6047daccebf2a0e550ab139e7d1e` |
| `MAINDIR/wav/yahoos12.wav` | 390534 | `eab2a77ce713df632edf5c79964d992cc1a99eacec07703e0174488877e8b8d4` |
| `MAINDIR/wav/yahoos13.wav` | 248852 | `d5f7ea6c9adc8d56fbcac71677d99100d7edadae113dae5782c12a2d779c288e` |
| `MAINDIR/wav/yahoos14.wav` | 206832 | `a7b73623cdeacfa1a9cbbf7d8f50eb400a9d48c7a135bf00cb98ed48048f49ac` |
| `MAINDIR/wav/yahoos15.wav` | 143336 | `337f6183f64c0816c37bedccbbf9e3c7cabecdf09ba94aad8c8c5b8e48de9c18` |
| `MAINDIR/wav/yahoos16.wav` | 96412 | `5466b8eb989f831fbf2c52f1ee53ee99c76f96a63c3de52a8d26df718baac6e6` |
| `MAINDIR/wav/yahoos17.wav` | 226276 | `7069447dff1a536f55b8d10ab693b78e66a7b163be3c3de72649c1c2e4c65b58` |
| `MAINDIR/wav/yahoos18.wav` | 197108 | `ef283b662a49fa1033bd3a3c0d5d154ead15e18f034c36b9f81dc8ac0830edff` |
| `MAINDIR/wav/yahoos19.wav` | 126488 | `b8bc5303b7c7c0e222e31260db7fc81de794f4ae845e370093b579577504b76b` |
| `MAINDIR/wav/yahoos20.wav` | 57720 | `fe43778dcb52faf2b1ffc0d57ee460ef28ef13526c254455f3ba075ab4ae73a1` |
| `MAINDIR/wav/yahoos3.wav` | 117780 | `2ec99501277ff7530c8c3725841a1c5e93f2d529972da5b17046966e87a5c7c1` |
| `MAINDIR/wav/yahoos4.wav` | 70020 | `722b8973ff8fa8a090f716fe86b5314e0dc7096b2671a1e4682e8316ae6314ca` |
| `MAINDIR/wav/yahoos5.wav` | 114552 | `ed88a8aa13a34bafc6fa85bf21ae989763db3c38f02543732b70b3045924adc7` |
| `MAINDIR/wav/yahoos6.wav` | 356360 | `4bd895a778ca10ab225a0992afcbc4b75ec4e56985cc74153d855ccfa382da64` |
| `MAINDIR/wav/yahoos7.wav` | 79664 | `575e8066556a5c21eb447efdceea496a25401b072862839f4dd5e46670fa2ba7` |
| `MAINDIR/wav/yahoos8.wav` | 341780 | `7d71097d71f41fa39a24a59d3ed3b7eae10f881f12933ace7c18143f9228e306` |
| `MAINDIR/wav/yahoos9.wav` | 325596 | `6dfb5560d7fc8d9a1a126419bb1a7e81ba2b0a91f3f267ce4484fe150169819a` |
| `MAINDIR/wav/yahoosexp.wav` | 935076 | `93836f5a2459875d684e218ae055d2b2798ad326d489c3e9106e3daa03916379` |
| `TEMP/DxDlg.dll` | 80896 | `a17daf20e9abcc519d0ecb53ce5dc8c37515e4eeffee2a89213b55991456a69d` |
| `TEMP/W32INST_PATH_` | 8704 | `3e0c4e282a232b65f22911a4ab25c7b8f84660dc52a2a2bc4f1a90892ad02472` |
| `UNINSTALL_PATH` | 148480 | `a2b6c24d41b3837f2979029c403a451d3946c4ab2cbf1e05e85066e39df551ec` |
