# Disciples II demo

## Original and first preflight (2026-10-09)

`test/binaries/win98-games-a-d/Discipless2_demo-D3D.exe` is143,913,296bytes,
SHA256 `e37753c2319380a933fb105b28639d5cacb2ed429731f5ae53706f047c8d03b0`.
`file` identifies PE32 GUI Intel80386, four sections. Static ASCII strings
include `WiseMain`, the Wise0132.dll extraction CRC error,
`Disciples II Demo Installation`, and `Initializing Wise Installation Wizard...`.
These identify a Wise installer; exact engine version is not established.
`7z l` (7-Zip23.01) cannot open it as an archive. Do not treat that as a bad
installer or assume a CAB/InstallShield payload.

No Disciples II registration or qualified screenshot was found;
`disciples_demo` is the first game, not this candidate. Installed files and
manifest do not yet exist. No missing installed filename is established.

Pinned original was transferred and SHA256-verified on temporary bx_75agndxm at
03:46:00Z as
`/tmp/disciples2-original.exe`; receipt is
`scratch/disciples2-preflight-20261009/transfer.json` with remote checksum.
The next runtime step is installer inspection/extraction after the serialized
Black & White 2 browser finishes. No second emulator or benchmark is running.
Respect any installer approval/license decision rather than answering for user.

Prepared next step: `/tmp/disciples2-probe-installer.js` (SHA256
`46e74f0d6c8152020916ea79b5397a705b4a9b220cd5ed16c07d40f162326f0d`).
It refuses to run while BW2 browser189048 is alive, has a180second hard guard,
and captures the first visible installer window without button input. Syntax
and upload checksum checked; it has not executed the installer.

At 04:21Z the serialized handoff controller PID234050 was started on the
same temporary box. It waits for browser189048 and its Chrome process to
exit, requires the browser cleanup receipt, verifies the probe hash, then
starts that one bounded probe. It does not stop BW2 or click installer controls.
It expires at 05:12Z; pending handoff can be cancelled by creating
`/home/user/disciples2-queue-20261009/cancel` on the boat. Do not separately
launch the installer while this controller owns the queued start.
State/logs: `/home/user/disciples2-queue-20261009/`; local controller and
launch receipt: `scratch/disciples2-preflight-20261009/after-bw2.js` and
`queue-launch.json`. Controller SHA256:
`2402e54a823b35bfc2e91c28d72636c63abe89fae3936c76d126bc512d90ccc2`.

Static `tools/unimplemented-imports.js` audit against main420da0745 reports
70 imports and no missing/explicit fail-fast handlers. This excludes dynamic
imports and the extracted payload, and does not prove handler correctness or
successful installation. Raw audit and checked probe API contract are retained
in the same local preflight directory.

## 2026-10-09 ordinary Wise installer progression

Original Wise bootstrap reaches initializing splash, self-loads glc1.tmp at507000, then Welcome. Reviewed ordinary Next progresses through Choose Destination Location, Select Program Manager Group, and Start Installation; no agreement appeared. Captures/logs retained in runs20261009T0510Z-disciples2-welcome, 20261009T0511Z-disciples2-destination, 20261009T0512Z-disciples2-program-group and 20261009T0512Z-disciples2-start-install. The group-page probe's title matcher missed that page and exhausted a finite10000-batch budget; no guest hang inferred.

Installer272256 started05:12:49Z on bx_75agndxm with180s guard and ordinary Next on the reviewed Start Installation page. Output /home/user/disciples2-install-20261009; save-vfs targets /home/user/disciples2-installed-vfs-20261009. It was confirmed live at the next process check. Collect actual termination before claiming extraction or launch; no game screenshot yet.

### Installation completed; real DLL seeds and SmartHeap Toolhelp blocker

First install probe exhausted19000steps at82percent after28.7s (no crash). Corrected95000-step ceiling under unchanged180s wall guard completed installation after22350batches/39.24s. Installer272983/guest272993 terminal0 at05:15:01.307Z; reviewed Installation Complete in scratch/runs/20261009T0515Z-disciples2-installed. Exported128 files174933888B to /home/user/disciples2-complete-vfs-20261009/program files/strategy first/disciples ii demo. Original discipl2.exe SHAadba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8. Exact per-file hashes in scratch/disciples2-preflight-20261009/installed-files.json.

Bare game launch traps SHW32.DLL ordinal295 because auto-DLL resolution omitted the existing bundled DLL. Explicit --dll-seed=shw32.dll and --dll-seed=c4dll-r.dll (existing older Disciples registry convention) loads both originals and clears that trap. It then creates a hidden128x128 game window and NULL-calls EBX in SmartHeap at runtime008fffcd, return008fffcf, batch23; main EIP becomes0. Original SHW32 imagebase0a930000, loaded008f5000: original call0a93afcd. EBX was GetProcAddress(CreateToolhelp32Snapshot) result. Snapshot call arguments are TH32CS_SNAPHEAPLIST=1 and currentPID1000. The same routine looks up Heap32ListFirst, Heap32ListNext, Heap32First, Heap32Next. No rows exist for these five API names in current api_table. Implement actual snapshot/heap enumeration rather than altering game/DLL or returning invented success.

Control evidence: scratch/runs/20261009T0516Z-disciples2-game-crash and 20261009T0517Z-disciples2-hidden-window. SHW32 original112672B SHAad8bc0ccd5cde0bd22ea6a4c0b45756b28c0e5bc972f314e2714f06af64732cb retained locally with disassembly in scratch/disciples2-preflight-20261009. Missing ole32.dll warning is separately retained; not established cause of this observed NULL call. All game probes terminal; neither hidden window nor installer is gameplay qualification.

## Toolhelp candidate (2026-10-09)

The five dynamically requested APIs are now implemented in the candidate.
Snapshot handles capture the current modeled heap list; block enumeration reads
actual live public HeapAlloc/HeapReAlloc records, and HeapFree/HeapDestroy remove
them. Metadata is shared across guest instances, including snapshot CloseHandle.
The registry keeps only16 fixed bytes; its1024 buckets are allocated lazily.
Append the new region after existing declarations: inserting it beside HEAP_ARENAS
broke gap/pad placement, while append ordering passes all five shake layouts.

This models fixed live public heap blocks. Internal emulator allocations are not
presented as guest HeapAlloc records. Process/thread/module snapshot flags remain
explicitly unsupported rather than returning fabricated empty snapshots. Other
process IDs fail. The original NT-only HeapWalk/GetProcessHeaps error120 remains.

Regression control failed the real GetProcAddress lookup for
CreateToolhelp32Snapshot; receipt scratch/disciples2-preflight-20261009/toolhelp-control.json.
Candidate verifies heap identity, block sizes, cross-instance visibility and
closing, wrong-owner rejection, failed in-place realloc preservation, freed-block
removal, struct sizes, stdcall cleanup and snapshot immutability.
Primary structure reference: https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/ns-tlhelp32-heapentry32

All128 installed originals are now retained locally in
`test/binaries/win98-games-a-d/Disciples II Demo/installed`, with every SHA verified;
see scratch/disciples2-preflight-20261009/retained-installed.json.

Canonical build and six native suites passed on bx_75agndxm; module SHA256
`193ce17000338bbcdabbd65149a22409a461322b8f743473b1dc8df8a8295cc5`.
Evidence: run20261009T0535Z-toolhelp-heap-validation (29 artifacts).
Original candidate launch285866/285876 terminal at05:39:21Z exposes the next
SmartHeap DllMain trap: WriteProcessMemory, EIP009007AC/return009007B3,
process-1, destination07504F58, source074FDC6C, size5, written-count074FDC68.
The bytes begin E9 D3 BA 3F F9: an API-entry JMP hook. No success bypass: need
real guarded current-process writing and correct execution of a patched thunk.
Evidence: run20261009T0539Z-disciples2-toolhelp-candidate (5 artifacts, no image).
Prior control has no WriteProcessMemory trap; this is newly reached initialization.

### Next patching constraint

The target07504F58 is in the emulated thunk zone.
`08-pe-loader.wat` stores two metadata words (nameRVA, APIid) in each8-byte
thunk, and `09b-dispatch.wat` reads them directly. Merely implementing
WriteProcessMemory as a byte copy would replace metadata with E9 displacement
and dispatch garbage. A patched entry must execute guest code; restored original
bytes must resume the real API. Decode-time and cached/direct thunk dispatch
paths both need coverage, including CALL/JMP and Worker-shared state.

Original SHW32 helpers explain the patch lifecycle: A93B7C0 reads5 original
bytes using ReadProcessMemory into record+16; A93B780 constructs/writes the
5-byte E9; A93B800 writes the saved5 bytes back. A93BA30 (runtime900A30)
is the replacement allocator. Disassembly retained in
`scratch/toolhelp-20261009/smartheap-hook-disasm.txt`. This is a real
install/restore hook, not an instruction to suppress SmartHeap initialization.
A guarded process-copy helper can share range/handle validation with existing
ReadProcessMemory. Preserve output-count and code-cache invalidation behavior.

## Process writes and API-entry hooks (2026-10-09)

WriteProcessMemory now shares guarded whole-range copying with ReadProcessMemory;
invalid handles, unmapped/readonly pages and invalid output pointers fail. The
original current-process-only handle model is retained. Guest copies invalidate
local code and publish the process generation so workers retire stale code.
API-entry descriptors are saved separately before patching. Changed entries run
through the normal x86 decoder; restored bytes resume API dispatch. Metadata
readers (loader, worker continuation sync and diagnostics) keep original identity.

Canonical build/five native suites and extended descriptor/reload checks pass.
Control fails missing WriteProcessMemory; first candidate exposed stale worker
code after restoration, fixed with process-wide invalidation. Native evidence
run20261009T0549Z-process-memory-hooks (21 artifacts), module SHA256
`8a2b49d12dd1e5ab17f05fc280d2f22dfc78fdc6f0f4e462ac381ca236bbd3fd`.
No performance benchmark or gameplay qualification is implied.
API contract: https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-writeprocessmemory

Original game294198/294208 terminal05:52:51Z: WPM trap cleared, SmartHeap DllMain
returns0, then batch30 shows MEM_BAD_POINTER. Screenshot personally reviewed;
no button clicked. Candidate run20261009T0552Z-disciples2-process-memory-candidate.
Filtered trace294758/294768 terminal05:53:51Z retained in
run20261009T0553Z-disciples2-smartheap-trace. MessageBox caller008FE48C; frames
008F74B9 <-005764FF <-005A937E <-005F5FC0 <-00401EDA <-0040158E <-0040146C
<-00401297 <-00642006.

The trace reveals a separate real GetProcAddress bug: C4dll-R handle00A16000 is
asked for malloc, calloc, realloc, free and new/delete; six fresh thunks07504F58
through07504F80 are returned and patched. Original C4dll-R export names have no
malloc/calloc/free. The loaded-module branch resolves0 then incorrectly falls
through to global Win32-name lookup. A matched DLL missing an export must return
NULL/ERROR_PROC_NOT_FOUND. Fix this next; whether it causes MEM_BAD_POINTER is
not yet established. Static full export receipt:
`scratch/process-memory-hooks-20261009/c4dll-exports.txt`.

## Loaded-module export scope and rejected pointer (2026-10-09 06:01Z)

A matched loaded DLL now returns NULL/error127 for absent named exports instead
of manufacturing a global API thunk. Real named/ordinal exports and static
Win32 lookups remain covered. Control fails the fabricated malloc assertion;
canonical build and five suites pass. Evidence
`scratch/runs/20261009T0558Z-getproc-module-validation`, module SHA256
`4c605c13e28d8b40fd330b9771ec784f68dd8d8b8ab759b91ca3718224c5a49e`.

Original game297980 terminal05:59:39Z makes zero WriteProcessMemory calls,
but MEM_BAD_POINTER remains: this export fix does not solve the heap corruption.
Game evidence run20261009T0559Z-disciples2-module-scope-candidate.
Read-only EIP trace298834 terminal06:01:16Z identifies rejected pointer09150020;
SmartHeap masks its base header at0915000E withFFF8 and expectsCAD0, reads0.
Evidence run20261009T0601Z-disciples2-bad-pointer. Earlier trace reserves separate
64KiB arenas09140000/09150000, commits09150000+3000, then commits09149000+8000
and decommits0914A000+6000. The commit crosses the neighboring reservation.
Next inspect reservation containment and preservation of existing mapped bytes;
this ordering is a lead, not proof of the corruption source. No input, error
dismissal, gameplay or FPS qualification.

## Prefix-overlap corruption fixed (2026-10-09 06:10Z)

A focused native control reproduced the header loss even within one valid
reservation: commit an island at base+10000, write CAD00000 at island+12,
then commit base+9000 for8000. The old mapping changed backing and read0.
The commit walker handled starts inside an old map, but not a new prefix
entering one. It published an overlapping zero-filled backing.

The candidate splits at the earliest existing island before coalescing,
commits only uncovered portions, and disables coalescing for these pieces
so failure rolls back newly appended records without touching old mappings.
The split occurs after cleanup of diagnostic leaked mappings. Tests cover
header/backing preservation, unsorted islands, and out-of-memory rollback.
Canonical build plus five suites pass: virtual-map-split-rollback,
virtual-map-cross-instance, virtual-page-protection, virtual-map-split-commit,
virtual-reserve-gap. Run20261009T0610Z-virtual-prefix-validation, module
SHA256 f1fb7fbe157c1ed6a85b926a31678fb7e0b11299fdfa9c363c2ce41a35a6b418.

A separate existing virtual-decommit-zero failure (sizeless decommit alters a
neighboring allocation) reproduces with unchanged HEAD helpers as well as the
candidate; both results retained in run20261009T0608Z-virtual-prefix-initial.
Do not call the whole allocation test set green. Cross-reservation validation
and hot-path performance remain separate questions; this patch preserves
existing contents even under currently permissive commit-range semantics.

Original game305152/305162 terminal06:10:28Z clears MEM_BAD_POINTER atbatch30
and shows the main DisciplesII window; reviewed capture is blank, not gameplay.
Run20261009T0610Z-disciples2-prefix-candidate. Bounded further initialization
probe305323 started06:10:54Z, no input or approval acceptance.

Further initialization305323/305333 terminal06:11:56Z reaches the rendered
main menu atbatch3000 (61.854s, no input). Personally reviewed and sent as
Telegram photo962. Run20261009T0611Z-disciples2-initialization. This is menu
progress, not gameplay/FPS/audio verification. Follow-up306325 started06:12:43Z
replays the known startup then clicks Single Player at reviewed coordinate500,30;
180s guard and fresh output directory, no agreement acceptance.

Single Player306325/306335 terminal06:13:36Z opens the saga/quest menu via
ordinary500,30 click; run20261009T0613Z-disciples2-single-player reviewed.
New Saga306953/306963 terminal06:15:02Z shows the original demo restriction
"This feature is not available in this version." Run20261009T0615Z-disciples2-new-saga
reviewed and recovered after transient502 during boat snapshot, no rerun.
Next dismiss this normal dialog and choose New Quest (menu500,124).
No gameplay, FPS or audio qualification. All probes terminal; boat expiry06:16:08Z.

## Fork preflight (2026-10-09 06:22Z)

Old boat stopped at TTL; fork bx_kbtxb6tb expires08:17:09Z. Snapshot retains
original installed game and source but excludes build, /tmp and runtime packages.
Canonical rebuild reproduces f1fb7fbe157c1ed6a85b926a31678fb7e0b11299fdfa9c363c2ce41a35a6b418.
First terminal probe19348 fails missing test/binaries/tlbs/stdole2.tlb; restored
15088B SHA db456130e4b131aff27a6a3179464a28c9452f06eb6f2081d2aea38128d31895.
Second20315 runs guest but capture fails because pngjs is absent; restored
original pngjs7.0.0 package. Runs20261009T0619Z-disciples2-fork-fixture-missing
and20261009T0621Z-disciples2-fork-pngjs-missing preserve both harness failures.
No emulator regression inferred. Session21271 started06:22:41Z with600s guard,
keeps frozen guest alive between reviewed ordinary input commands to avoid
repeating initialization for each click. Source scratch/disciples2-quest-20261009/session-v3.js.

## Verified native gameplay (2026-10-09 06:43Z)

Full800x600 host canvas exposes all quest controls. Ordinary route: Single Player,
New Quest, The Search for Timmoria, Undead Hordes, default Warrior Lord and
Average difficulty, quest intro, Day1 income, default leader name Huun'reh,
story dialogs. Instantaneous CLI click leaves Day1 button pressed; WM_CHAR13
does not dismiss it. Separated mousedown/50batches/mouseup/200batches does.
An earlier keypress:ENTER string was invalid for this numeric-code CLI parser,
so it is not evidence that physical Enter fails. No guest writes/skips used.

Session27838/child27848 on bx_kbtxb6tb, terminal06:44:05Z. Select leader at320,300,
plot path at384,352, click same destination again using separate mouse edges.
Reviewed step15 shows20/20 movement; step19 shows16/20, leader out of capital
and camera following. Native player-controlled gameplay is proven; browser,
FPS and audio remain untested. Photos963/964 sent.

Run20261009T0643Z-disciples2-gameplay retains80 original artifacts (25.57MB),
plus source pins and capture/input scripts. Chunked copy verifies every hash.
Prior Day1 run20261009T0635Z-disciples2-day1 retains37 artifacts (12.62MB).
Host channel had intermittent502; no live game was restarted based on that
alone. A proc-fd control attempt failed ENXIO; it delivered no input.

Registration gap discovered: disciples2-demo is absent from
test/candidate-corpus/manifest.json, and lib/apps.js has only the first Disciples
demo, not DisciplesII. Do not attach this evidence to that different game.
Next add the correct local candidate and normal browser launch using the original
128-file installed tree, then validate browser route and measure gameplayFPS/audio.
The provisional run ID stays explicit until that integration is done.

## Registered browser route (2026-10-09 07:09Z)

Added local-only candidate disciples2-demo and app disciples2_demo, using the
unchanged original 128-file installation (hardlinks locally, no duplicated game
payload). Generated manifest has 127 support files; executable is separate.
Normal index.html?app=disciples2_demo&debug on temporary bx_kbtxb6tb launches
with lazy policy: 8 eager files (1,462,993 bytes),119 on demand (169,278,639 bytes).
The main guest and additional guest threads run in Workers. Default UI WebGL
setting is not evidence that this DirectDraw game exercises the D3D9 backend.

Browser controller38274 / Chrome38289 ran06:54:23.903Z to07:09:24.061Z;
immutable900s guard closed Chrome with code0. Module SHA256
f1fb7fbe157c1ed6a85b926a31678fb7e0b11299fdfa9c363c2ce41a35a6b418.
Ordinary trusted200ms mouse clicks reached Single Player, New Quest, Timmoria,
Undead Hordes, default Warrior Lord, intro, Day1, default leader name and story.
Several first clicks left controls pressed; a repeated click advanced them.
Cause is not yet established. Browser movement was not reached before the guard;
do not substitute the earlier native movement proof for browser gameplay.
FPS and audio remain unqualified. No guest-memory writes or config bypasses.
Run20261009T0709Z-disciples2-browser retains screenshots and command sequence.

Local-only selector, public-desktop exclusion, candidate/registry executable
match, support manifest and five DLL paths pass checks; CLI corpus dry-run is
ready. Broad test-debug-game-apps.js still fails the existing Jazz2 file.endsWith
TypeError, reproduced with unchanged HEAD apps. It is not an all-green suite.
Next diagnose ordinary browser release/input behavior, finish leader movement,
then capture gameplay presentation/FPS and audio evidence separately.

## Verified browser gameplay (2026-10-09 07:28Z)

Normal registered launch on temporary bx_kbtxb6tb now proves player control:
select leader, plot path, confirm move. Reviewed leader-selected.png shows20/20;
leader-moved.png shows16/20, leader outside capital and camera following.
All actions use trusted browser input; no guest-state writes. Story-dialog
clicks were batched along the previously reviewed route, retaining each capture.
Run20261009T0728Z-disciples2-browser-gameplay; Telegram photo967.
Controller50788/Chrome50800 started07:15:04.112Z, ordinary stop07:28:27.530Z,
Chrome code0; same f1fb7fbe157c1ed6a85b926a31678fb7e0b11299fdfa9c363c2ce41a35a6b418 module.

Increasing mouse hold200ms to1000ms does not eliminate menu repeat-click behavior.
Window capture observes both trusted edges. Renderer observation records both
handleMouseDown/handleMouseUp, with WM_LBUTTONDOWN513 and WM_LBUTTONUP514 queued;
the runtime input log reports both. Missing mouseup in the earlier document-only
observer was expected: the window capture handler stops propagation. Do not
infer browser event loss. Gameplay selection/path/move each advanced normally;
next input investigation should inspect guest message consumption and activation.

Thirty-second sample after movement:31 samples spanning30.10599s,2432 guest
presentation events (80.7813/s),1649 canvas uploads (54.7732/s). These are existing
WinePerf guestFrame/frameUpload counters, not a qualified game logical-frame
marker. No logical FPS, moving-scene performance or audio qualification claimed.
Debug log and host input observation were enabled during this diagnostic.

Harness failure retained separately: run20261009T0714Z-disciples2-browser-launcher-failure.
The first longer-click Chrome49470 received SIGKILL coincident with its remote
launcher45s timeout; controller49458 was explicitly closed07:14:32.616Z. The
replacement launches with detached child/stdin-out-err files and an immutable1800s
guard. Never classify this harness failure as a game crash or restart on502 alone.

## Menu first-click, logical frames and audio (2026-10-11, claude:1863)

**Menu repeat-clicks: fixed 22d835d4f.** Disciples II arms a menu button from
hover, worked out once a frame from the pointer position. A press delivered in
the same message pump as the move onto the button drew it pressed and did
nothing. Every first click on a new screen failed, and a second click (the
pointer already there) worked. Trusted browser clicks with a 1000 ms hold
failed the same way; the move before the press is what matters, not the press
length. A phone tap is always such a click. takeInput now holds a press that
follows a move to a new spot until the move has had an empty poll plus the
30 ms floor, mirroring the release hold. Browser A/B with instant, no-hover
clicks: before, Single Player and Load Saga stayed pressed; after, each
activates on the first click.

Separately, the **day-1 income scroll, the leader-name scroll and the story
dialogs' red seals need a held press** (a few frames down). A real click (~100
ms) gives that. ctl.js's instant `click` does not: use `cmd mousedown:X:Y`,
0.6 s, `cmd mouseup:X:Y`. The quest intro continues with Enter.

**Logical frames: `perf.logicalFrame` = 0x647da0, verifier 0x647df2.** Every
frame's stack is the WinMain loop 0x401297 -> 0x504700 / 0x4014cc -> screen
render (indirect, 0x54764e) -> the renderer's end-of-frame virtual 0x647da0
(vtable slot at 0x6c1af8). That method flushes the dirty lists and calls
Flip (return site 0x647df2) when page flipping is on. Clear Blt (0x647d7c), ~10
BltFast and one Flip make up each frame. Browser measurement (bx_deesf22z,
Threads, headful Chrome): select the leader, plot, confirm the move; over the
next 29.99 s the counter rose by 822, i.e. **27.4 frames/s**. The window
covers the walk (Move 20/20 -> 14/20, camera following) and then the leader
standing at the destination. WinePerf saw 836 presentation events and 946
uploads in the same window. The page did not report the verifier count
(metric verifier: false), so the verifier is unconfirmed.

**Audio:** Miles (mss32) streams through DirectSound, not waveOut (0 waveOut
handles). On the map the page's AudioContext is running at 44.1 kHz with two
looping DirectSound voices (stereo 16-bit 44.1 kHz, snapshot mode, playing).
Audibility and quality were not assessed: there was no listener on the boat.

Evidence: scratch/runs/20261011T1800Z-disciples2-input-fps-audio-claude1863.


## 2026-10-19: native module identity regression

The Safari launch report on build `02b41f09` showed `DllMain did not complete: module=0x8f5000 reason=0`. A local reproduction with the unchanged original EXE and five DLLs confirmed that this was a secondary rollback failure. SHW32 SmartHeap first returned FALSE from PROCESS_ATTACH: its PE-header validation rejected USER32's unmapped synthetic handle `0x5d110001`. KERNEL32 already exposed readable PE headers and passed the same check.

Static native modules now receive distinct, process-shared readable PE identity headers. Creation and publication use the DLL load lock; identity survives reference release and is reset for a new process. Real DLL precedence, native name/ordinal dispatch and explicit references are retained. Header-only native images have no guest entrypoint or imports. The existing KERNEL32 export image uses the shared header emitter. Startup rollback also preserves both the primary and cleanup errors instead of masking the original failure.

With this change, the same original DLL closure reports TRUE from all five DllMain calls and starts executing the EXE. This is a startup regression check, not a new gameplay or Safari verification: only the EXE/DLL closure was available locally; the headless run had no renderer. Evidence runs: `20261019-disciples2-dll-control`, `20261019-disciples2-dll-native-images` under root scratch/runs.

Validation: full candidate build gates pass; native image direct/sparse fixtures, cross-instance identity/reference release, allocation-failure retry, DLL rollback/completion and DirectX version chain (11/11) pass. The wide API suite retains four failures reproduced on baseline (older KERNEL32 identity expectations and manually inserted lifecycle-less DLL rows); the changed module identity and DSOUND ordinal cases pass. No deployment or full game rerun.

## November 12 current map and page-read limit

Run `20261112-disciples2-post-battle-healing-save-0510` used published runtime
`af0e208e9` / actual Worker `1165f15c…`, with all721 source/helper/media pins
verified. The original Canvas2D route reached day1 Huun’reh, and ordinary
plotted/confirmed eastward movement reduced Move20/20→16/20. The passive
capture after the northeast approach exceeded its20s controller budget;
there was no completed encounter frame or battle input.

A changed fresh attempt doubled the work budget to40s and sought a map save
first. The reviewed image after the disk-icon click still showed the map,
not a Save panel. Before the next Escape input, page-session `Runtime.evaluate`
for the exact `bound-input.cjs` PAGE_READ owner expression received no reply
for35s. Escape was never dispatched. This identifies the observed barrier
as a page-owner read, not proven Save serialization or Escape consumption.
No debugger stack was captured; the page, diagnostic getter, guest and protocol
causes remain unresolved. A larger timeout alone did not resolve it.

No new day, healing, recruitment, battle reward or native Save/load checkpoint
was established. The prior November7 victory remains its separate evidence.
MW3-specific guest mouse fields in the inherited helper were invalid for this
app and excluded; only generic viewport/renderer fields mapped clicks.
The request client's `oomKilled` flag is retained without a memory-cause claim.

The coordinator verified641 recovered references /559 unique raw hashes and
the full eastward-movement and unchanged-map images. Both actual runtime
parents exited1 with separate output EOF; both Chrome parents exited0/EOF.
The box stopped normally before expiry, with watchdog/manager/client wait0/EOF.
No production code or build was changed. `RESULT.txt` and
`retrieval-manifest.json` retain exact source, outputs and failed-request timing.
A fresh task prearms independent page/debugger observations before reproducing
the read, then resumes native menu/Save/day progression only if responsive.

## November 12 reproduced kernel OOM before the stalled read

Run `20261112-disciples2-page-read-stall-native-save-0534` establishes a cause
for its two fresh reproductions, not retrospectively for the inaccessible0510
box. Kernel logs show `CONSTRAINT_MEMCG` kills of owning-runtime Chrome
PIDs7813 and12523 at05:38:55Z and05:46:23Z, before the unanswered page reads.
Their anonymous RSS was approximately6.7 and6.6GB. `/user.slice` reached its
7,789,871,104-byte limit with swap disabled. The exact Chrome subprocess role
and allocation site were not captured; a page-renderer attribution is inference.

During the second stall, independent browser version/target requests continued
to answer. Trivial page evaluation, isolate lookup and debugger pause did not;
no paused stack arrived. The earlier normal rendering stack preceded the kill
and does not explain it. Increasing PAGE_READ timeout cannot recover the killed
process. The next task records process roles and allocation growth before OOM,
then repairs the demonstrated source or helper cause without weakening ownership
checks. A larger allocation alone would not prove a repair.

Native Escape did open the reviewed Options screen after five separately
reviewed story panels. Save, day change, healing and Load/movement remain
unproved. Source stayedaf0e208e9 / actual Worker1165f15c;724pins matched.
The coordinator verified550 recovered references /489 unique raw hashes,
the kernel kill records and the full Options image. Both runtime parents
exited1/EOF; Chrome parents exited0, and the box stopped normally before expiry
with owner/client/watchdog wait0/EOF. No production change or build was made.
Exact logs and failed CDP request IDs remain in the run's `RESULT.txt` and
`retrieval-manifest.json`.

## November 12 Chrome allocation repair and native day two

Run `20261112-disciples2-chrome-growth-native-save-0602` locates the growing
allocation and repairs it in published main commit `703015ea5`. The original
DirectSound long-ring snapshot fallback repeatedly decoded PCM and created
replacement Web Audio sources while AudioContext was suspended at time zero.
Stopping the old source at `currentTime + 0.005` could not retire its acquired
buffer while that clock remained frozen. Native allocation samples attributed
3,064 MiB of 3,408 MiB to `blink::AudioBuffer::AudioBuffer`, reached through
`BaseAudioContext::createBuffer`; the host path is `_decodePcm` / `playRing`.
Independent per-PID sampling identifies the growing subprocess as renderer8564:
885→4,340 MiB anonymous RSS over162 seconds. This connects the previous
reproduced memory-limit failure to a concrete producer; it does not establish
the inaccessible0510 box's cause.

The fix coalesces suspended refreshes only for the nonqueued looping snapshot
fallback. Resume rebuilds once from latest PCM at the current guest cursor;
Stop cancels pending work. The bounded small-ring queue retains its existing
behavior. A 2,000-refresh regression fails against exact `af0e208e9` and passes
with the repair; resume, scaled guest cursor, duplicate state event and Stop
cancellation are covered. Six focused audio suites and the locked full build
pass. Neither guest code, module admission nor repeated source/owner checks
were weakened.

The controlled repaired menu arm remained approximately400 MiB renderer anonymous
RSS over183 seconds; its native AudioBuffer sample was0.3125 MiB. The final
source then ran the original quest for almost20 minutes, with sampled renderer peak
781 MiB during actual gameplay. Its forwarding-only allocation observer counted
exactly two initial AudioBuffers through day two, and Wasm memory stayed512 MiB.
AudioContext remained suspended, so audible playback is not claimed.

The same surviving Canvas2D page completed Timmoria / Undead Hordes / default
Warrior Lord, the five individually reviewed story panels, Escape→Options,
native Save Game named `s`, and the **Game saved successfully** confirmation.
The complete native `c:\savegame\s.sg` is208,644 bytes, SHA-256
`ebfe38e5852b16c1c6bdefcb1d007abcda38877c4332944415ad6b5f527e12e8`.
Two independent passive reads match; its whole-save manifest is
`native-save-whole.json`. No partial save restoration or guest state writes
were used. Space opened the native End Turn confirmation, Enter accepted it,
the original game wrote AutoSave, and the Empire turn/message completed.
The separately reviewed `day-two-income.png` shows **Beginning day2**;
`income-two-accept.png` shows the returned map, day2 and Huunreh Move20/20.
Day1 also showed20/20; this run does not prove replenishment from spent movement.
The earlier candidate mouse controls did not advance the day; Enter on the map
opened chat and was closed normally. Only Space/confirmation earns the day claim.

Runtime was exact `af0e208e9` plus the audio repair, canonical Worker
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`,
registered original EXE `adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8`,
with parent724 pins through GitPinBytes; concurrent host-window/thread changes
were excluded. Final754 pins match after completion. All three browser parents
and their actual runtime parents exited0 with separate output EOFs; profiles,
ports and process lifetimes closed. Independent recovery verified837 references.
Box `bx_zfbgtfjv` stopped normally at06:36:12Z before its06:54:18Z lease;
independent GET confirms archived, expiry null, stop
`stop_39dce5560033bb34` completed / forced=false. The manager and independent
watchdogs have actual wait0/EOF receipts; the outer submitting tool exited143,
so no additional outer-client wait receipt is claimed. Next: native Load of the
preserved whole save and fresh movement; day-two saving, healing and combat
remain outside this run's claims.
