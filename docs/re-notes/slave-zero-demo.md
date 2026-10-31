# Slave Zero (demo)

Accolade/Ronin Entertainment, 1999, third-person mech shooter, Direct3D.
**Registered as `slave_zero_demo` (candidate `slave-zero-demo`, local
only).**

## Source and layout

- archive.org `SlaveZeroDemo`, `SlaveZeroDemo.zip` (sha1
  881fdbf2d7e239e7986be34f8fbc1e19199e1326). The readme says the demo "may
  not be copied, distributed, transferred or sold", so it is a local ignored
  fixture only.
- The zip is an InstallShield 5 Setup tree. File group `DEFAULT` of
  `data1.cab` is the whole game; the manifest unshields it into
  `installed/Slave Zero/` and copies `InstData/GameData/INSTSUPP/szHardware.ini`
  beside the exe (the installer writes it there; without it the renderer
  probe has no hardware table). No installer run needed.
- Run `SlaveZero.exe` with the working directory `C:\Slave Zero`
  (`exeGuestPath` `c:\slave zero\slavezero.exe`). It LoadLibrary's
  `d3d.dll`, `wgamescript.dll`, `winputkbm.dll`, `wdsound.dll` and
  `a3dapi.dll` from its own folder.

## Runtime requirements found

- **Real msvcrt.** The app declares `dlls: ['binaries/dlls/msvcrt.dll']`.
  With the built-in WAT CRT it stopped at `_putenv` (now implemented,
  51ef79adc) and then `_strdate`; the real DLL avoids that whole tail. The
  CLI finds `test/binaries/dlls` on its own, so the CLI never showed it.
- **~15000 live DirectDraw surfaces** in the demo level (tiny textures plus
  their mip levels). It exhausted the 8192 DX object slots and then the 63 MB
  DIB arena (whole 4K pages per surface). Fixed in c758a6742: `$DX_MAX`
  16384 and heap storage for plain textures and mip levels when the arena is
  full.
- **A3D.** `a3dapi.dll` CoCreateInstance's the A3D class whose server
  `a3d.dll` is not shipped. CoCreateInstance fails with REGDB_E_CLASSNOTREG
  and the game continues with DirectSound. In the browser the guest-main
  Worker's failure path left EIP on the CoCreateInstance thunk (it only set
  EAX and popped ESP), so the thunk re-ran on the caller's stack and the
  guest trapped `unreachable` at a heap EIP. The CLI had this fixed for
  Pirates!; both now share `DllLoader.failComDllYield`.
- **"AudBuffer error in lock"** (wdsound.dll): an intermittent modal box.
  Historical NEW GAME failure, not gameplay. The local DLL emits this message
  when its buffer pointer is null, before calling DirectSound Lock; see the
  lifetime investigation below. A contract-correct emulator cause remains
  unproven.

## Headless route

`node test/run.js --app=slave_zero_demo --quiet-api --max-batches=2600
--batch-size=200000` reaches the front-end menu. In 640x480, NEW GAME is at
(320,153).

## 2026-10-31: close/wait contract investigation — hold remains

Source examined at `a0ca585db8394b27a29665386730305da0b2384d`, with the
same `lib/thread-manager.js` and `test/test-thread-manager.js` as requested
baseline `d880bd6e1`. No production or tracked test changes. Evidence and
replay script: `scratch/runs/20261031T1705Z-slave-zero-lifetime/`
(`provenance.json`, `characterize.js`, `characterize.json`, test logs and
`wdsound-disassembly.txt`). Source and relevant local fixture SHA-256 hashes
are in the provenance file. No guest module was executed in this investigation.

The held `4a3f01ad5ee348315452deca1b8435362a7b643c` is not an ancestor of
main and was not applied. The Oct 12 messageboard assertion that Windows
keeps the closed-event wait pending is unsupported. Microsoft documents
[WaitForMultipleObjects](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitformultipleobjects)
as having undefined behavior if a waited handle closes while the wait is
pending. That case cannot establish that permanent unsignaled replacement,
WAIT_FAILED, success, or any particular timeout is correct. Retaining an object
and completing a wait are separate questions.

### Current emulator behavior

The scratch probe calls the unchanged manager methods; mocked register exports
are used for `checkMainYield`, rather than a guest interpreter. An unsignaled
three-event wait remains pending before final closes. After final closes,
`resolveWait` returns index zero for both wait-any and wait-all; cooperative
main completes with EAX zero and drops the correct 20-byte frame. This follows
from `closeSyncHandle` removing the handle mapping and `waitSingle`'s legacy
unknown-handle success fallback (wait-all likewise treats unknowns as ready).
It reproduces a mechanism compatible with the historical report, **not the
present game crash or a defined-use regression**.

The review and probes also distinguish these cases:

- Final close clears the table, name and reference count. Recycled slots get
  another handle. A stale SetEvent, ResetEvent or CloseHandle does not mutate
  the replacement, and a post-close wait does not consume its signal.
- Partial named-reference close leaves the remaining reference usable.
  Ten thousand create/close iterations reuse one slot with unique observed
  handles, at most one mapped object, and zero final references/mappings.
  The allocator's eventual numeric wrap was not tested.
- Once `_pollParkedWait` consumes an event, `parkedWaitDone` retains the
  result across closes and reuse. The probe retains index one and leaves a
  replacement signal intact. `_runWorkerThread` delivers that retained result
  through `_completeWorkerWait`; this was source-reviewed, not a live Worker
  transport replay.
- Ordinary local waits do not register object-lifetime references. Timeout
  clears poll state; thread exit does not close unrelated process handles.
  Cooperative APC cancellation bypasses normal completion via `apc_wake_wait`.
  Named-authority waits have a separate cancellation protocol. Nested callback
  waits retain frame/epoch completion receipts and retire them on owner exit;
  those receipts are not retained synchronization objects.
- Nested cooperative single-event waits explicitly reject a generation closed
  while pumping siblings. Nested Worker waits resolve exact issued handles
  through `guest-rpc.js`'s shared table, then fall back to the broker if they
  no longer resolve. These paths do not provide a common pending-close
  lifetime protocol or a Windows guarantee for that case.

### Guest teardown evidence

Read-only disassembly of the local `Scripts/wDSound.dll` (preferred image base
`0x10000000`; these are original VAs, not runtime addresses) shows:

- Thread entry `0x10006290`, passed to `_beginthread` at `0x10006798`, caches
  the mutex at object `+0x5c` and copies the three handles at `+0x50/+0x54/+0x58`
  into its own stack array. `0x10006304` waits on that array, wait-any, INFINITE.
  Index zero reaches refill `0x10006ba0` via `0x10006356`.
- Teardown `0x10006420` calls stop `0x100068a0`, waits on the mutex, releases
  and closes that mutex, releases the stream/notification objects, then closes
  the three events at `0x10006486/0x10006493/0x100064a0`. This routine has no
  thread join. It calls base release `0x10001b90`, which releases and zeros
  DirectSound buffer `+0x28` (or alternate buffer `+0x44`).
- Refill calls buffer-lock wrapper `0x100018b0`. The error-string references
  at `0x100018c8/0x10001915` follow null tests of `+0x44/+0x28`. The real
  DirectSound Lock virtual calls occur later at `0x100018f8/0x10001945`.
  The dialog alone therefore does not demonstrate a failed Lock HRESULT.

This is consistent with the historical closed-wait/refill-after-release story.
Static code does not establish the current runtime ordering, whether a signal
had already satisfied the wait, or whether an earlier emulator defect caused
the teardown. Closing the events while that wait is pending would itself fall
under the documented undefined case. No valid-use causal regression and
corrected behavior pair was established, so production remains unchanged.

Validation: `test-thread-manager.js`, `test-guest-rpc-nested-wait.js` and
`test-sync-object-name.js` pass, plus the scratch characterization. The existing
supplemental `test-thread-wait-zero-timeout.js` fails before its assertions:
the constructor reads `opts.callbackLifecycleTrace` before defaulting omitted
options. Its eight checks pass with a scratch subclass supplying `{}`; that
adapter does not repair or change production. Both logs are preserved.
No build was run for this documentation-only result. No browser, heavy CLI,
native input, gameplay screenshots or new gameplay qualification. Boat
ID/state/expiry: N/A. The fixture remains local and excluded from the public
desktop selection.

Next evidence needed before a production edit: a current ordinary execution
trace identifying the exact wait invocation, acquisition/completion, close,
buffer release and refill ordering, with an emulator violation before any
guest undefined operation. If that reveals a real lifetime bug, its boundary
includes WAT wait entry/APC abandonment, manager completion/timeout/exit,
Worker shared-table acquisition and broker/continuation ownership—not merely
`closeSyncHandle`. Do not broaden this hold into a scheduler change without
that causal trace. NEW GAME, movement and firing remain unverified.

## 2026-10-31: current browser NEW GAME trace — different first failure

Run `scratch/runs/20261031T1720Z-slave-zero-current-trace/` executed published
main `9eff3d3722e4b7c289afa0d1bc2a5828ba1c902a`, after Evolva's new
17:21:45 FULLRELEASE and independent Chrome/crashpad/profile process gate under
lifetime FD9. The current sources matched Evolva's tested full-build manifest;
module SHA-256 was
`078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`.
No old build, production edit, tombstone patch or additional build was used.

The single original/default-Worker, normal-clock WebGL execution ran
17:24:15–17:28:55 UTC. Reviewed captures `10-after-cutscene.png` and
`12-native-new-game-enter.png` show the native main menu and NEW GAME
difficulty menu. Native focus/intro Escape, NEW GAME click and Enter were
used. Before the next intended difficulty-selection input, the guest Worker
was already gone; the input gate withheld that command. No player movement,
look, fire or gameplay screenshot was reached. `14-post-worker-loss.png`
shows the retired app, not gameplay. There was no AudBuffer dialog in the
captured trace.

### Actual audio ordering

`console.jsonl`, `input-state.jsonl` and extracted `audio-ordering.json`
preserve API entries, stack-array identities, manager signal/resume records,
DirectSound calls and voice closure. These are observed browser broker/log
delivery order, not a global instruction timestamp. In this live Worker path,
API entries **do** forward arguments and COM names; the preparation's concern
about the separate secondary logger did not describe these observed entries.
API exits/HRESULTs and exact atomic acquisition timestamps remain unavailable.
Repeated waits have no unique invocation counter; the nearest preceding entry,
array pointer and parked snapshot bound the observations below.

- Audio thread 1: the parked snapshot identifies wait-any/INFINITE array
  `0x7e78ffb8`, events `0xe0005/0xe0006/0xe0007`, 20-byte frame.
  At 17:25:56.365 the last wait entry returns to runtime `0xa6a30a`
  (wDSound original `0x1000630a`, after the wait call). Stop signals
  `0xe0007`; the manager delivers result **2** before the three event closes.
  Entries 1394–1416 then show mutex close, notification release, event closes,
  buffer `0x08224fe8` release, voice `0xb0003` close and thread exit.
  The refill Lock/Unlock pair precedes this final wait; no refill after this
  buffer release is recorded.
- Audio thread 2: array `0x7e28ffb8`, events
  `0xe0001/0xe0002/0xe0003`, buffer `0x08224fd0`, voice `0xb0002`.
  Entries 2343–2366 show wait, stop signal `0xe0003`, manager result **2**,
  then event closes, buffer/voice release and exit. The intervening worker
  `WaitForSingleObject(0x0e000000, INFINITE)` parks; the mutex closes before
  the manager's resumed/result-zero record. This is a pending-close mutex
  case, not evidence that Windows required a different result. No earlier
  defined-use emulator violation was established.

Thus this execution does not reproduce the proposed multiple-event
close→index-zero→refill-after-buffer-release failure. It supplies real
signal/completion/close/release ordering instead of another manager probe.
The pending-close hold remains; `4a3f01ad5` must not be ported.

### First observed terminal boundary

`15-retained-stop-state.json` retains the actual final main-Worker
`sliceDone` receipt, sequence 7078: `EIP=0`, `yield=0`, `trapped=null`,
`prevEip=0x94af24`, `prev2Eip=0x94afcc`, `ECX=EDX=0`,
`EAX=0x074ff96c`, `ESP=0x074ff92c`, `EBP=0x40`. The host's existing
zero-EIP/zero-yield branch retires the process; its stored exit code is zero.
That host classification does not establish a successful guest exit.

The loaded `d3d.dll` base was `0x945000`, preferred base `0x10000000`;
the last blocks map to original `0x10005f24/0x10005fcc`.
Read-only `d3d-final-block-disassembly.txt` shows the texture mip upload loop:
`0x10005fc9` calls surface `GetAttachedSurface` with caps `0x401000`,
`0x10005fcc` loads the next surface and loops to `0x10005f24`, and
`0x10005f46` calls surface Lock through `[vtable+0x64]`.
The final registers and block sequence match a null next surface/vtable
reaching an indirect null call, rather than a return from this routine.
This is the narrow terminal-path inference supported by the receipt and
disassembly; the GetAttachedSurface HRESULT, exact source surface, descriptor
and output slot were not traced. An invalid guest use, exhausted/short chain
or earlier emulator failure cannot yet be distinguished.

Next dependency is that exact GetAttachedSurface→output→next Lock boundary,
including texture creation descriptor/mip count, interface generation,
HRESULT, output pointer and reference ownership. If a valid nonterminal mip
lookup fails, extend `test-directdraw-mip-chain.js` / attachment tests with
the captured descriptor: verify each declared mip's dimensions/caps/interface,
successful lookup AddRef lifetime, terminal NOTFOUND/output-zero and allocation
failure behavior. Do not substitute a guessed chain, null guard, slot-zero
alias or audio scheduler patch. `regression-proposal.json` records the proposal;
no tracked test or production change was made.

Validation: all 168 original-fixture, 362 current source and 866 tool/compiler
hash pins match before/after; all 347 successful HTTP responses have matching
server file hashes. All 368 HTTP responses, including 404s, carry COOP
`same-origin` and COEP `require-corp`; isolation/default Worker and stable
1024×768 geometry were checked before input (`defaultViewport:null`). Native
events are trusted. Trace is bounded and did not reach its log cap; logging,
read-only Worker sampling and WebGL readbacks can change scheduling, so this
is not a timing benchmark or a proof that the intermittent audio failure cannot
occur. Minimum free disk was 2,600,890,368 bytes. Syntax/hash/evidence checks
and documentation diff checks passed; no new build or guest rerun.

Completed quit, durable Python `Popen.wait`, PID-start-qualified absence of
all owned runtime processes, closed server/CDP ports, deleted owned profile,
empty held-input set and free browser lock are preserved in
`full-release-proof.json`; FULLRELEASE was published at 17:29:35 UTC.
No signals were needed. Boat ID/state/expiry: N/A. The causal emulator defect
and native controlled gameplay remain unproven; this run's first observed
terminal dependency is the mip-surface lookup/null-call path above.

## 2026-10-31: mip observer — successful samples, earlier fatal boundary

Evidence: `scratch/runs/20261031T1737Z-slave-zero-mip-surface/`.
This investigation made **no production or tracked test change**. The original
failing lookup from slice 7078 above remains unresolved; the new execution did
not reach that NEW GAME path. Neither a null guard nor the held `4a3f01ad5`
was applied.

The single diagnostic/default-Worker browser attempt ran
17:47:23–17:49:50 UTC on published main
`2dc6457f4b885b653b7cf06f706cda3b6345a84b`, module SHA-256
`078d81cba6ab755d6a05e5e234a259df9e867ecc8848899705a45739fab0e9a9`.
It followed current Evolva FULLRELEASE 17:44:49. Published remote HEAD and
Evolva's tested source/compiler/module hashes matched under lifetime FD9;
an independent whole-Chrome/global-crashpad/profile PID/start scan was clear.
No stale source image or extra build was used.

`observer.cjs` was installed through CDP before Worker Wasm instantiation.
It wraps the existing logging imports, reads entry arguments and exit EAX,
and preserves the original hooks, guest memory/registers and return values.
Creation records retain the supplied descriptor, creator interface, complete
initial chain and backing pointers. Lookup records include caps, source,
output, interface vtable and before/after reference counts. A bounded ring and
failure records limit retention. This instrumentation adds overhead and can
change scheduling; this is not a timing or untouched-host comparison.

There is a diagnostic limitation: decoding **named** APIs directly from a
SharedArrayBuffer view throws in this Chrome. The scratch mock unit check
used an ordinary ArrayBuffer and missed it. The observer catches these errors
and still calls the original logging hook. Its COM-ID branch does not use
that decoder: CreateSurface, QueryInterface, GetAttachedSurface and Lock
records remain available. The exact executed observer hash and capped error
list are preserved; no corrected observer was substituted for this execution.

### What the mip records establish

The last sampled main-Worker counters are 13,646 CreateSurface exits and
1,589 GetAttachedSurface exits, including backbuffer and mip retrievals;
the failure list is empty. These are cumulative calls, not simultaneous live
objects. Sampling retained 627 distinct call records, including 35 attachment
lookups and 52 creations, rather than every call. See
`sampled-mip-calls.json`, `mip-observation-summary.json` and
`successful-native-mip-example.json`.

One concrete texture creation (observer sequence 4611) supplied DDSURFACEDESC2
size 124, flags `0x21007`, width/height 64, mip count 7, caps `0x405008`,
caps2 `8`, word `+120=1` (DDSD_TEXTURESTAGE unset), and 16-bit ARGB1555 masks
`0x7c00/0x03e0/0x001f/0x8000`. Its creating DirectDraw4 interface is identified
by captured QueryInterface IID `0x9c59509a`; the chain initially contains
64/32/16/8/4/2/1 square levels with distinct backing storage.

At sequence 4618, source `0x08334d50` (slot 1466, 32×32, Surface4 vtable
`0x004777fc`) requests caps `0x401000`, with extension words zero. HRESULT is
DD_OK and output is `0x08334d58`, slot 1467, 16×16, with the same vtable.
The child's shared reference count rises from 1 to 2 and its acquired
auxiliary-view count is 1. The immediately following Lock (4619) returns
DD_OK with a 124-byte descriptor, dimensions 16×16 and pitch 32; Unlock
(4620) also succeeds. This establishes successful acquisition and immediate
use, not full subsequent release/lifetime correctness or the original failed
lookup. The game did not request a terminal attachment in these retained
samples. Allocation-failure state at the original failure is still unknown.

### Earlier first failure and remaining boundary

Reviewed captures `02-intro.png`, `06-story-progress.png`,
`08-after-cutscene.png` and `09-native-story-escape.png` show the native intro
and scripted city/mech scenes. They are **not controlled gameplay**. Trusted,
balanced focus/intro Escape inputs were sent. Before the next observation,
the guest Worker retired and the input gate withheld that command.
`console.jsonl` records the original MessageBox call:
`Slave Zero Fatal Error` / `PassMessage: null gatewaycallback: node 16f0c28,
command 2`, followed by ExitProcess code `0xdcdcdcdc`. The dialog text was
logged, not captured in a reviewed dialog screenshot. The retained last slice
is sequence 5657 with yield 15, not the earlier slice-7078 zero-EIP mip
receipt. `15-retained-stop-state.png` shows the retired desktop.

Thus no defined-use causal regression or corrected pair was obtained. Source
review finds candidate boundaries—silent child-allocation truncation and
finite auxiliary-interface allocation—but neither is tied to an actual
failed lookup. The next mip investigation still needs the **original failing
invocation's** descriptor/count, source generation, HRESULT/output,
allocation state and ownership through the next Lock. The successful sample
above must not stand in for it. This attempt also exposes an earlier native
PassMessage failure whose triggering call/order would need capture before
expanding into that separate boundary. No scheduler, renderer, guest fixture,
INI/save/memory/clock or worker/audio override was introduced. NEW GAME and
native movement/look/fire remain unverified.

Validation: the unchanged `test-directdraw-mip-chain.js` and
`test-directdraw-enum-attached.js` pass under inherited FD9 after another
independent browser-process gate; the scratch observer mock and syntax checks
pass with the decoder limitation above. All 168 fixture, 362 source and 866
tool/compiler pins match before/after; all 344 successful HTTP responses
match their server-file hashes and all 365 responses carry COOP/COEP.
Default Worker/isolation and 1024×768 geometry (`defaultViewport:null`)
were checked before input. All 15 captured native events are trusted and
balanced. No new full build was needed for this findings-only result.

Explicit quit, durable Python waits and `full-release-proof.json` establish
all owned runtime/supervisor/helper processes absent, both ports closed,
profile absent, held inputs empty and lifetime lock available; no signals
were needed. FULLRELEASE was published at 17:50:44 UTC. Minimum monitored
free disk was 2,504,740,864 bytes. Boat ID/state/expiry: N/A. No retry,
public deployment or successor worker was launched.


## 2026-10-31: PassMessage producer and actual deferred-dispatch boundary

Findings-only run `scratch/runs/20261031T1804Z-slave-zero-passmessage/`
started from published `c95f363a99ed838afdfcd61ca1484447ea115e36`, after
Evolva's 18:04:56 NEWFULLRELEASE, published-source readback and an independent
whole Chrome/crashpad/profile PID/start gate under lifetime FD9. The executed
module SHA-256 was
`bfb6ef7c5a20ce2f439a02c64e2ed94df2543f6ebd7ba03f7b0e0de275a955b6`,
matching Evolva's tested source/compiler/module manifests. There is no
production change or defined-use oldFAIL/newPASS repair from this task.

### Original guest contract

Cheap original disassembly preceded the browser. EXE SHA-256 is
`41ddb7507f2f2c279f9e96b3a8b0b8fb6af55cdca551cef67af294ec21a9a74e`.
The exported `PassMessage` is `0x41b920`. It reads controller, command and
message arguments, handles the disabled flag, checks the message, then loads
controller `+0x50` at `0x41b998`. A zero value calls the fatal formatter at
`0x41b9a6`; otherwise `0x41b9b9` dispatches through that callback. Thus this
message is an explicit guest invariant check, before an indirect callback,
and is not itself a failed emulator callback lookup.

`CreateController` (`0x41bb00`) resolves the script module through
`0x41cc30`, invokes its gateway at module-record `+0x24` with command zero,
and records the returned controller's module at `+0x4c` (`0x41bb6e`). Script
registration calls LoadLibraryA (`0x41ce1a`) and GetProcAddress (`0x41ce89`)
for `<SCRIPT>_Gateway_Callback`, storing the export at module-record `+0x24`.
The original wGameScript constructor (`0x10001230`) allocates/zeros its
controller, initializes its links and writes `0x10001000` into controller
`+0x50` at `0x1000126e`. Its exported WGAMESCRIPT_Gateway_Callback is that
same address. All 103 scanned script DLL callback setters have HIGHLOW
relocation coverage for their callback immediates. These static contracts do
not prove the failed node was constructed successfully or remained live.

Read-only source review covered GetProcAddress in
`src/09a0-handlers-base.wat`, relocation processing in
`src/08b-dll-loader.wat`, `lib/dll-loader.js` and the heap implementation in
`src/10-helpers.wat`. No generic export/relocation/heap violation was proved.
No source ownership was expanded; the held audio patch, null guards and slot
aliases were not applied.

### One current native diagnostic: earlier audio fatal, then PassMessage

The sole original/default-Worker, normal audio/clock WebGL run lasted
18:16:10–18:21:57 UTC. HTTP isolation and actual inner 1024×768 geometry with
`defaultViewport:null` were checked before input. Reviewed captures
`03-native-intro-escape.png`, `04-native-story.png` and
`06-after-cutscene.png` show the native intro and scripted city/mech scene,
**not controlled gameplay**. Read-only capture `07-first-failure.png` shows
the native main menu with NEW GAME highlighted and a Slave Zero Fatal Error
taskbar entry. This proves menu display, not NEW GAME activation or gameplay.

The first captured fatal was **AudBuffer error in lock**, at 18:17:44.530 on
guest thread 2. `first-failure-worker-state.json` preserves its full probe
and stack. With wDSound runtime base `0xa64000`, the stack contains
`0xa6591c` (original `0x1000191c`), the return following the normal buffer
`+0x28` null-error call, and refill/thread return addresses
`0xa6abf8`/`0xa6a35b`. The actual DirectSound Lock call is later at original
`0x10001945`. This is consistent with the pre-Lock null-buffer branch,
not a failing Lock HRESULT. The object words read at 18:19:11 were captured
later, while other guest threads continued, and cannot substitute for the
object's state at the earlier branch. This probe did not establish the exact
cross-thread acquisition, signal, close, release and refill order. It supplies
no valid-use basis for the held pending-close repair.

A trusted balanced Enter at 18:21:15.998 was intended for highlighted NEW
GAME. At 18:21:16.580 the main thread instead reported
`PassMessage: null gatewaycallback: node 3da1cf8, command 2`, followed by
ExitProcess `0xdcdcdcdc` at 18:21:17.295. Because the audio fatal was already
open, the input recipient and NEW GAME activation are not established. A
subsequent command was withheld by the missing-Worker input gate; no further
input or retry followed. `10-post-fatal.png` is the retired desktop.

The PassMessage stack fixes a more precise boundary than the previous run:
`0x409ac9` calls `0x405c10`, which drains the guest's deferred controller
queue at `0x45325c`. It obtains the queued node from `[queueEntry]`, calls
`PassMessage(node, 2, message)` at `0x405c2e` (captured return `0x405c33`),
then frees the queue entry. Pending entries are created at `0x405be0`, stored
on `0x453260`, and transferred to `0x45325c` at `0x405c44–0x405c54`.
At the fatal, node `0x3da1cf8` has callback zero, parent `0x18`, sibling
`0x845004`, ID `0x3da13ac` and a binary/non-name prefix. These are malformed
controller contents; this is insufficient to distinguish a stale queue
pointer, guest lifetime violation, earlier corruption or allocator defect.
The captured stack and original code establish this dispatch route, not the
node's allocation/free history or its cause.

The scratch observer copies SharedArrayBuffer-backed bytes before decoding.
Its real shared WebAssembly.Memory mock verifies named API decoding, changing
node/fatal capture and preservation of existing hooks, state and returns.
It samples only existing host/API boundaries and cannot establish causal
scheduling between Workers. Tree walks cap at 512 nodes per boundary and
retention at 4096; the failed node was not in the retained earlier tree
samples, which does not prove it was freed. The console listener truncated
the main-thread fatal at 24,000 characters. The complete early fields,
320-word stack and node were extracted without inventing the missing tail
in `passmessage-fatal-extracted.json`; its recent-call prefix is explicitly
partial. `[PASSMESSAGE-FATAL]` is the observer's label for **any** fatal
MessageBox, including the earlier audio error, not evidence of PassMessage
by itself.

The retained pre-exit sample has 1,666 successful attached-surface lookups
and no observed mip failure. These include non-mip attachments and cannot
explain the original slice-7078 EIP-zero lookup/next-Lock failure. That
original invocation and its allocation/output/reference state remain
separately unresolved; this run did not reproduce it.

### Validation, release and next boundary

Observer shared-memory mock and syntax checks pass. All 367 HTTP responses
carry isolation headers; all 346 successful response hashes match the served
files, with source/module hashes joined to launch pins. All 168 original
fixture pins and the executed module remain unchanged; all 13 native events
are trusted and balanced. Another worker edited eight source files and one
compiler/census file after launch. The shutdown identity check correctly
rejected current-checkout equality, after closing browser/server and removing
the profile, so it did not write its usual cleanup summary. The separate
validation preserves that drift and verifies actual served bytes against the
original launch manifest rather than claiming the checkout stayed unchanged.
No full build was run for this documentation-only result.

Durable Python waits reaped controller, monitor and supervisor. Independent
`full-release-proof.json` at 18:22:38 verifies all recorded runtime processes
and helpers absent, whole actual Chrome/crashpad/profile gate clear, ports
43917/40965 closed, profile gone, inputs empty and lifetime lock free; runtime
shutdown needed no signals. The separate own board watcher was then stopped
with PID/start qualification and reaped (terminal 143). Minimum monitored free
disk was 2,425,290,752 bytes. Boat ID/state/expiry: N/A. No public deployment,
extra browser, worker, agent or successor was launched.

The next PassMessage boundary is the **specific deferred node's** enqueue,
constructor/callback write, removal/destruction/free and subsequent command-2
dispatch, correlated by pointer and allocation generation. Capture the queue
entry and both queue heads, not only the controller tree; a full fatal record
must survive Worker retirement without console truncation. The earlier audio
boundary still needs the exact handle invocation/completion/close and buffer
release/refill ordering before any guest undefined operation. These missing
histories prevent a proved generic emulator repair. Native menu display is
verified; NEW GAME activation and controlled movement/look/fire are not.

## 2026-10-31: Audio allocation and wait lifetime, bounded diagnostic

Findings-only evidence is in
`scratch/runs/20261031T1832Z-slave-zero-audio-lifetime/`. No emulator source
was changed: no meaningful defined-use oldFAIL/newPASS was established.
The earlier thread-2 **AudBuffer error in lock**, original `0x1000191c`,
remains the first captured fatal. Neither the later deferred command-2
PassMessage nor successful mip calls explain that fatal or the separate
original slice-7078 failure. Controlled gameplay remains unverified.

### Original allocation and teardown contract

Original wDSound requests a `0x88`-byte stream object at `0x10004fb4`, calls
operator new at `0x10004fb9` through `0x1000962c`, then constructs it at
`0x10006390` and initializes it at `0x100064b0`. The constructor zeros normal
buffer `+0x28`, alternate buffer `+0x44`, stream `+0x48`, notification
interface `+0x4c`, events `+0x50/+0x54/+0x58`, mutex `+0x5c` and state `+0x64`.
The audio thread starts at `0x10006290`; its wait-any/infinite call is at
`0x10006304` and returns to `0x1000630a`. Index zero acquires the mutex at
`0x10006348` and calls refill at `0x10006356`. Refill calls buffer lock at
`0x10006bf3`. The null-buffer
error call is `0x1000191a`, returning to `0x1000191c`, before the actual
DirectSound Lock call at `0x10001945`.

Stop is `0x100068a0`. Teardown at `0x10006420` has no thread join: it acquires
and releases/closes the mutex, destroys the stream, releases notification
state, and closes the three events at `0x10006486/0x10006493/0x100064a0`.
Base cleanup releases the normal buffer at `0x10001bcb` and zeros `+0x28`
at `0x10001bce`. This static order permits a pending-close lifetime question;
it does not establish what happened in the failing execution. A signal
acquired before close can be delivered later, so delivery time alone cannot
prove a wrong wait result.

Source review covered ThreadManager waits/retained completions/close,
guest RPC and Worker completion, host audio notifications and DirectSound
handlers. The current manager removes a closed handle's mapping and has an
unknown-handle success fallback, but a close while a Windows wait is pending
does not define the required result. That case supplies no valid-use repair
contract. The held `4a3f01ad5`, guessed guards and slot aliases were not used.
Evolva's async INI files and callback census were preserved.

### Sole diagnostic and its limit

After Evolva's published `025bd909148a4202aa9099151c0b0a03fdda3c8b` and
18:44:06 NEWFULLRELEASE, the supervisor reread its final tested overrides and
source/compiler/original manifests, verified remote main, and independently
checked the entire actual Chrome/crashpad/profile PID/start gate under
lifetime FD9. This run served the **final** module
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
It used the original default Worker, normal audio/clock and native WebGL,
inner 1024×768 with `defaultViewport:null`. Isolation was checked before the
trusted balanced launch click. Those three mouse events were the only input;
there was no in-game key, click, Enter or attempt to dismiss a fatal.

The 18:45:12–18:46:36 diagnostic stopped automatically at its 48 MB evidence
limit. Unrelated heap traffic dominated retention: 98,105 allocation records
and 68,550 frees among 173,253 Worker records. This was an observer capacity
failure, not a new emulator failure. No fatal record was captured. Personally
inspected `00-firstlaunch.png` shows fixture loading, not menu or gameplay;
later startup/audio events do not substitute for a reviewed gameplay image.
There was no second browser attempt.

The trace does preserve stream initialization at `0x19bb54c`, `0x19b4b94`
and `0x3da7d84`. Matching HeapAlloc returns are size `0x90`, thread 1 sequence
23146, 23479 and 46547 respectively; no free of those addresses was captured.
For `0x19b4b94`, buffer `0x8224fe8`, events `0xe0005/0xe0006/0xe0007`
and mutex `0xe000001` appear before CreateThread (thread-1 sequence 49979).
Thread 2 first observes that object at sequence 4 with state 2 and those
fields intact. These are initialization observations, **not** the missing
first-fatal invocation/generation. No actual CRT small-block allocation/free
record was observed; the observer's static unlock-frame method was tested
only in its mock. Cross-Worker observation clocks are not an instruction
order proof. `audio-ordering.json` and `stream-allocation-events.json`
preserve the bounded analysis.

### Observer verification, release and remaining boundary

The scratch observer copies shared bytes before decoding and preserves
existing hooks, state and results. Fatal records use chunked CDP bindings,
independent of console truncation and Worker retirement. A real shared
WebAssembly.Memory mock passes named decoding, full fatal reassembly,
allocation/address-reuse generation and unchanged hook/results/bytes/registers.
The page observer also preserves exact Promise identity and results. A
focused test against unchanged ThreadManager passes the valid-use sequence:
unsatisfied wait, stop-index-2 signal/acquisition, close after completion,
then exactly one retained delivery. This is observer validation and a
passing valid-use case, not an emulator oldFAIL/newPASS.

All 352 HTTP responses carry isolation headers; all 331 successful responses
match served pins. All 168 original fixture, 362 source and 866 compiler
identities, plus the executed module, stayed unchanged. Observer installation
and transport report no errors or incomplete chunks. The large raw event log
was losslessly gzipped with SHA-256 roundtrip verification; `RECOVERY.json`
contains the exact recovery command. No full build was run for this
documentation-only result.

Independent release at 18:48:22 verifies all recorded runtime PID/start
identities, supervisor and helpers absent; whole actual Chrome/crashpad gate
empty; ports 44649/39235 closed; profile gone; input held set empty; FD9 lock
free. Durable Python waits reaped the processes without runtime signals.
The own board watcher was separately PID/start-qualified, stopped and reaped
(143). Minimum monitored free disk was 2,437,419,008 bytes. Boat ID/state/expiry
are N/A; no deployment, agents, workers or successor were launched.

The next bounded boundary is still the **first audio fatal**: retain relevant
stream allocation/free generations and same-invocation acquire, signal,
wait acquisition, retained completion, delivery, close, buffer release and
refill. Filter unrelated heap emission before another diagnostic; tracking
every heap return exhausted this run before the required branch. Only if
audio order is defined and noncausal should investigation move to the exact
deferred node's `0x405be0` enqueue, heads `0x453260/0x45325c`, `0x405c2e`
dispatch, constructor callback `+0x50`, destruction and free generation.
Postfatal effects remain insufficient evidence for a generic emulator patch.

## 2026-10-31: Filtered audio observer and first-fatal reservation

Evidence is in `scratch/runs/20261031T1900Z-slave-zero-filtered-audio/`.
The observer correction is scratch-only; it establishes no emulator cause.
Unrelated heap events are filtered before transport. Their counters and last
16 events remain available, while unidentified allocation candidates occupy
at most 128 address histories, each holding at most 16 events. Identified
stream objects retain their address history through candidate eviction;
promotion emits the retained allocation/free/reuse history. Exact allocation
addresses take precedence over older containing allocations. Relevant original
audio callsites, stream snapshots and synchronization operations remain
observable. A separate first-fatal channel bypasses the normal 4 MB payload
budget and preserves the full 512-word stack, registers, arguments, stream
snapshots, recent events and bounded retention diagnostics in chunked durable
CDP records.

The real shared WebAssembly.Memory test uses an actual Wasm `i32.load` reader
with fixture-controlled register getters and drives 240,000 unrelated HeapAlloc/
HeapFree hooks plus 3,000 unidentified candidate allocations. The complete
test, including relevant allocation/free/reuse and first-fatal transport,
emits 100,773 bytes, retains 128 address histories and a 16-event unrelated
ring, and preserves existing hooks, exact results, guest bytes, registers and
WebAssembly.instantiate Promise identity. A separate 5,000-call saturation
test fills the ordinary payload budget and still reassembles the complete
first fatal. The CRT small-block unlock path remains mock coverage until
actual execution records that path; neither test supplies actual CRT events.

The page observer preserves original Promise identity and associates nested
acquisition, retained completion and delivery fulfillment with a wait identity.
Its unchanged-ThreadManager test signals stop index two, acquires it once,
retains the completion across repeated polls, closes only after acquisition,
and delivers exactly once. This is a passing valid-use case, not an emulator
oldFAIL/newPASS. Same-page invocation order and same-Worker event sequence
are usable ordering evidence; cross-Worker clocks alone remain insufficient.

### Actual run: intro stop completions, menu activation, unresolved exit

After Evolva native-combat's published `e875d370578dee0318b75bceb51b0238fca21e28`
and 19:10:25 NEWFULLRELEASE, the supervisor independently checked the entire
actual Chrome/crashpad/profile PID/start gate under inherited lifetime FD9.
Launch free disk was 2,626,441,216 bytes, meeting the original 2.6 GB reserve.
It reread both predecessor source/compiler/original manifests and the prior
168 Slave Zero fixture pins; all matched. The executed final module remained
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
No build or emulator source edit was needed for this diagnostic.

The sole run used the original default Worker, normal audio/clock and native
WebGL, inner 1024×768 with `defaultViewport:null`. HTTP isolation was checked
before the trusted launch click. Personally reviewed `01-startup.png` and
`02-intro-or-menu.png` show scripted intro scenes. Balanced Escape reached
the native menu (`05-native-menu.png`). A click at guest (319,153) acquired
pointer lock but did not visibly activate the selection; balanced Enter then
opened the Easy/Medium/Hard menu (`09-enter-result.png`), proving NEW GAME
activation in this run. After accepting highlighted Easy, the render endpoint
closed at 19:16:24.833 and the 19:16:42 capture gate found no guest Worker.
That gate refused the capture. No level, controlled movement/look/fire,
MessageBox, first-fatal record or terminal exit/trap snapshot was captured.
The exit's code and cause remain unknown.

The new trace retains exact HeapAlloc histories for stream objects
`0x19bb54c`, `0x19b4b94` and `0x3da7d84`: size `0x90`, thread-1 heap-generation
sequences 22325, 22597 and 44522 respectively. These generation counters are
separate from emitted record sequence numbers. No actual CRT small-block
record was captured. `stream-lifetimes.json` preserves initialization and
`actual-stop-order.json` contains the full selected page/Worker records.

The same-page ordering for the two running intro streams is concrete:

| Stream | Signal stop event | Acquire index 2 | Retain | Delivery fulfilled | Close mutex | Close events |
| --- | --- | --- | --- | --- | --- | --- |
| `0x19b4b94` | 2110 | 2113 | 2114 | 2119 | 2125 | 2127/2129/2131 |
| `0x19bb54c` | 3048 | 3051 | immediate delivery | 3054 | 3062 | 3064/3066/3073 |

Numbers in this table are **page observer sequence numbers**, not timestamps.
The corresponding wait identities are 16248 and 30580. This proves stop
acquisition before event close in these invocations, rather than an invented
post-close index-zero refill. It does not make all later audio use defined:
page sequence 2132 waits on already-closed cached mutex `0xe000001`; sequence
3068 resolves the `0xe000000` mutex wait after its close. For the latter,
Worker-thread-3 sequence 1045 returns the pending sentinel `0xffff`, and its
sequence-1047 API-exit snapshot has yield reason 1 and the mutex missing.
Subsequent calls also pass the now-zero object mutex field. These are actual
closed-mutex/pending-close observations, not a valid-use oldFAIL/newPASS or a
reproduction of the earlier pre-Lock null-buffer fatal. No held patch, null
guard, slot alias or scheduler repair was applied. The condition for moving
to the deferred node investigation was not established.

### Remaining retention limit and release

Heap noise no longer exhausted the 48 MB controller limit: transport retained
3,998 Worker records, 3,238 manager records and 6,413,725 payload bytes, with
no transport errors or incomplete chunks. However, frequent ordinary audio
calls exhausted the main Worker's separate 4 MB normal payload budget. Later
main-thread API records, including a possible terminal call, were suppressed.
The first-fatal reservation remained available but was unused because no
MessageBox was observed. Consequently this is not a complete actual
buffer-release/refill history at the historical first fatal. The next
observer boundary is to filter routine non-stream audio status traffic before
that budget, preserve lifecycle transitions independently, and reserve the
terminal ExitProcess/trap record as well as MessageBox. Do not infer a new
emulator cause from this run's exit or from incomplete/postfatal effects.

All 368 HTTP responses carry isolation headers; all 347 successful response
hashes match served pins. The 168 original fixture, 362 source and 866 compiler
identities and executed module stayed unchanged. All 13 native events are
trusted and balanced. The flood/saturation/unchanged-manager units, syntax,
HTTP/hash checks and documentation diff checks pass; no full-build claim is
made for this documentation-only publication.
The raw Worker and manager logs were losslessly gzipped with SHA-256
roundtrip verification; `RECOVERY.json` records exact reconstruction commands.

The diagnostic explicitly quit at 19:17:26. Durable Python waits reaped the
controller, monitor and lifetime wrapper; supervisor and all recorded runtime
identities are absent. Independent release at 19:17:58 verifies the whole
actual Chrome/crashpad/profile gate empty, ports 42109/40441 closed, profile
gone, inputs empty and FD9 lock free. Runtime shutdown needed no signals;
the separate owned board watcher was PID/start-qualified and stopped.
Minimum monitored free disk was 2,330,177,536 bytes. Boat ID/state/expiry are
N/A. No public deployment, extra browser, agent, worker or successor was
launched. This remains findings-only: controlled gameplay and a defined-use
emulator cause are unproved.

## 2026-10-31: terminal reservation — first audio fatal captured

Evidence: `scratch/runs/20261031T1931Z-slave-zero-terminal-lifecycle/`.
This is a single bounded diagnostic and a documentation-only result. There
is no emulator patch or defined-use oldFAIL/newPASS. The requested terminal
after NEW GAME/Easy remains unresolved: this execution encountered the earlier
audio fatal while leaving the intro, before reaching that menu. No retry was
made, and controlled gameplay was not established.

### Observer correction and verification

The scratch observer filters routine non-stream DirectSound status, frequency,
mixing and spatial calls before snapshots, emission and the ordinary 4 MB
budget. Stream allocation/free histories, object changes, relevant wait/close/
release calls and host transitions bypass that budget. MessageBox and terminal
snapshots have separate transport: ExitProcess entry, host exit/thread exit,
and outgoing Worker error, trapped, exit-yield or zero-EIP receipts. Terminal
records preserve registers, the 512-word stack, stream snapshots, bounded
history and recent events before forwarding the original operation. Full
terminal records are not recursively embedded in the recent-event ring.
The existing 128-address/16-event history bounds and 16-event unrelated ring
remain; at most eight distinct terminal reasons are retained per instance.

`observer-test.cjs` uses real shared WebAssembly.Memory and an actual Wasm
reader. It drives 240,000 unrelated heap events, 3,000 allocation candidates
and 100,000 non-stream status calls. A separate 5,000-call saturation case
exhausts ordinary logging, then verifies allocation/free, wait/acquire,
mutex release/close, six terminal snapshot types and complete first-fatal
chunk reassembly. Existing hooks, exact results, guest bytes/registers,
postMessage forwarding and instantiate/manager Promise identity are preserved.
The new test fails against the previous scratch observer at routine-status
emission; the corrected observer passes. Transport is 717,839 bytes in the
flood case and 7,082,778 bytes with saturation and reserved snapshots.
The unchanged-ThreadManager focused test also passes stop-index-two
acquisition, close after completion and exactly one retained delivery. This
tests the valid-use boundary without choosing semantics for pending close.

### Actual first fatal and same-invocation ordering

The sole browser ran 19:34:24–19:35:09 UTC on published main
`e2a73b33a23a27c9fae7d581ca045e434cf36572`, which includes input
`7d3458055077dcc56645416732192237612b7f33` and accepted findings `8c69b3abf`.
It followed CURRENT Kingpin NEWFULLRELEASE 19:25:02 and an independent
whole-Chrome/global-crashpad/profile PID/start gate under inherited lifetime
FD9. Source/compiler/module pins matched the predecessor's tested build;
no new build was needed. Module SHA-256 remained
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
The run used the original default isolated Worker, native WebGL, normal
audio/clock, inner 1024×768 and `defaultViewport:null`. HTTP isolation was
checked before trusted launch input. Original assets, INI, saves, guest
memory and registration were not patched.

Personally reviewed startup and city-intro captures precede a balanced
Escape at 19:35:08. `03-native-intro-escape.png` shows a dark transition with
a HUD; it proves neither a menu nor player control. At 19:35:08.925, audio
Worker thread 2 records **AudBuffer error in lock**, title **Slave Zero
Fatal Error**. `fatal-2-104.json` preserves the complete stack and registers;
the host window metadata also records the fatal title. The reviewed
`first-fatal.png` is dark and does not display legible dialog text. Further
input was withheld and the controller stopped automatically at this fatal.
No NEW GAME/Easy, movement, look or firing input followed.

The loaded wDSound base is `0xa64000`. Stack words 261, 264 and 280 contain
`0xa6591c`, `0xa6abf8` and `0xa6a35b`, mapping to original
`0x1000191c`, `0x10006bf8` and `0x1000635b`: the null-buffer error path,
refill return and audio-thread refill caller. The final observed stream
address is `0x19b4b94`, with buffer `+0x28` and mutex `+0x5c` both zero.
No actual DirectSound Lock entry occurs between its last cached-mutex use
and the fatal. This is the original pre-Lock fatal, not a failed Lock HRESULT.

`actual-first-fatal-order.json` retains the exact selected records. Page
observer sequence numbers establish this order for **wait identity 1651**:

| Event | Page sequence |
| --- | --- |
| Three-event wait observed pending, all handles present | 1242 |
| Stop event `0xe0007` signaled | 1251–1252 |
| Mutex `0xe000001` closed | 1259–1260 |
| Events `0xe0005/6/7` closed, same wait still parked | 1261–1266 |
| Missing-handle fallback acquires result zero | 1267–1269 |
| Result zero retained, then delivery fulfilled | 1270–1273 |
| Cached closed mutex used by audio thread 2 | 1274 |

The wait is wait-any/INFINITE, guest array `0x7e78ffb8`, with a 20-byte
frame. Its Worker sequence 94–97 records entry and pending yield; sequence
99–102 records the subsequent closed-mutex call; sequence 104 is the fatal.
Unlike the preceding run's stop-index-two completions, this invocation
remains pending through event close and later obtains index zero. These are
same-page and same-owning-Worker orders, not cross-Worker clock causality.

Main-Worker records independently retain exact HeapAlloc size `0x90` for
`0x19b4b94`, heap generation 22597, and successful HeapFree generation 58352
(emitted sequence 956). Main sequence 952–955 records buffer `0x08224fe8`
release and voice `0xb0003` closure immediately before that free. The secondary
observer first saw the same address with matching initialized buffer/events/
mutex, but its local generation has `allocation:null`; no actual CRT
small-block event or exact later reuse generation was captured. Malformed
fatal object words must not be labeled a proven replacement allocation.

This execution now reproduces the pending-close→index-zero→refill/null-buffer
failure path. **Closing a handle while its wait is pending is already the
undefined case described above.** No emulator violation before that boundary
was established. The trace therefore does not authorize the held lifetime
patch, a scheduler change, null guard or deferred-node repair. The next
concrete boundary is before page sequence 1261: determine why original
stop/teardown closes the events without wait completion or thread join, or
identify a separately defined-use emulator violation that initiated teardown.
Post-close symptoms cannot select a Windows-correct repair. The separate
post-NEW GAME mip-surface terminal path remains unresolved.

### Evidence integrity and full release

All 365 HTTP responses carry isolation headers; all 344 successful responses
match served hashes. All 168 original fixture, 528 source and 866 compiler
pins and the executed module match before/after. Five native events are
trusted and balanced. Worker transport retains 1,116 records and 2,465,548
payload bytes, without incomplete chunks, observer errors or a budget stop.
The actual terminal reservation was not exercised because this run stopped
at MessageBox; its terminal coverage is a unit-test result.

The executed controller's screenshot basename reused `first-fatal.json` for
image metadata. `fatal-2-104.json`, raw event log and durable chunk records
remained intact. The metadata was preserved as `first-fatal-screenshot.json`
and the canonical fatal restored from the per-thread record; independent
chunk reassembly matches its full stack/objects/text. `first-fatal-recovery.json`
records this diagnostic defect and recovery. The executed observer/controller
were not silently substituted or rerun.

Durable Python waits reaped controller, monitor, lifetime wrapper and owned
board watcher. Independent release at 19:36:05 verifies all 19 recorded
runtime PID/start identities, supervisor and helpers absent, whole actual
Chrome/crashpad/profile gate empty, ports 40985/33129 closed, profile gone,
inputs empty and FD9 lock free. No runtime signals were needed. Launch free
disk was 2,564,648,960 bytes; monitored minimum was 2,529,902,592 bytes.
Boat ID/state/expiry: N/A. No deployment, extra browser, agent, worker or
successor was launched. Focused observer/source tests, identity/HTTP/evidence
checks and documentation diff checks pass; no full-build claim is made for
this documentation-only publication.

## 2026-10-31: preclose initiator recovered from retained callers

Evidence: `scratch/runs/20261031T2013Z-slave-zero-preclose/` (`review.py`,
`findings.json`, selected owning-thread records and original disassembly).
This read-only review narrows the missing boundary without another browser
attempt. Input main was `7c510cfe06582313faa2ce6ff2deccaf2a95f0ad`, containing
accepted `0d2c79f484ba38f91b5f6b43c97c544206bf36e8`. The retained 1931Z
findings, first-fatal order, observer tests and raw 1,116 Worker / 1,292 page
records were reviewed before deriving these findings.

### Original destruction dispatch precedes both stops

The retained main-Worker stack at sequence 912 has enough outer callers to
identify an original destruction path. With the recorded DLL base `0xa64000`,
the reconstructed chain is:

| Original location | Meaning and retained support |
| --- | --- |
| EXE `0x41b9b9`, return `0x41b9bc` | Calls the plugin callback at object `+0x50`; the return is stack word 43 at main sequence 912. |
| DLL `0x10007e14`, return `0x10007e19` | Forwards to command dispatcher `0x10007f10`. |
| `0x10007f82`, call `0x10007f86`, return `0x10007f8b` | The original jump-table entry for command `0x837` loads message `+0x18` and calls `0x10005ea0`. Sequence 912 retains EBX=`0x837` and this return. |
| `0x10005ea0`, return `0x10005eb5` | Dereferences the supplied handle and invokes its deleting destructor with argument 1. The handle is `0x1a00bbc`, outer object `0x1a00aec`. |
| `0x10003b40` / `0x10003b60` | Outer deleting destructor calls stop helper `0x10005340`, return `0x10003b70`; helper calls stream stop `0x100068a0`, return `0x100053d6`. |
| `0x10003b7d`, return `0x10003b7f` | Outer destructor invokes the stream's deleting destructor through outer object `+0x10`. |
| `0x10006e00` / `0x10006e20` | Stream deleting destructor calls teardown `0x10006420`, return `0x10006e50`; teardown calls stop again, return `0x10006428`. These nested returns occur in main sequence 925. |

This is a reconstruction from same-owning-thread stacks and byte-verified
original instructions, not a complete function entry/return recording.
In particular, stack word `0x10009b18` is the destructor's installed SEH
handler, not another initiating caller. Other code-looking words deeper in
these stacks must not all be interpreted as live frames.

The original DLL SHA-256 is
`62340d97042917cd8c5163ec6ae02bbb1b4ecde835d35bd46667e1fc443c2c18`;
the EXE is
`41ddb7507f2f2c279f9e96b3a8b0b8fb6af55cdca551cef67af294ec21a9a74e`.
All 436 selected disassembly lines match current original DLL bytes, including
the switch-table target for `0x837`. The original EXE at `0x41b920` writes
the command from EBX into message `+0`, clears `+4`, and calls the callback.
The retained message pointer is `0x074ff9b4`; its full contents and generation
were not captured. The producer above this EXE dispatch remains unknown.
The balanced Escape near this transition does not prove that producer.

### Defined preclose outcomes and completion limit

Main sequences 912–924 show the first stop: mutex acquisition returns zero,
normal-buffer Stop returns HRESULT zero, and ReleaseMutex returns one.
Stop's original state-2 branch calls stream virtual method `+0x24` at
`0x100068df`, writes state zero at `0x100068e5`, optionally invokes a callback
at `0x100068f8`, and releases the mutex. Those virtual call/return boundaries
are not observed by the API-only logger. Host `voice_stop` returns zero;
the page observer separately records stop-event signaling. Current unchanged
`lib/host-audio.js` routes voice stop through `notifyStop`, which signals
registered `0xffffffff` stop offsets. This source path is consistent with
the signal, without supplying its missing native call stack.

The second stop, within teardown, acquires the same mutex (925–928) with
the stream already in state zero. Original `0x100068bb` then skips to
`0x10006904` and returns one **without releasing that acquisition**. Teardown
immediately acquires the mutex recursively (929–932), releases once
(933–936), then closes it (937–938). The page's own sequence 1255–1260
independently records recursion count 0→1→2→1→closed. This acquisition
imbalance follows original control flow; it is not evidence of an emulator
mutex defect or a thread join. Neither original stop nor teardown waits on
an audio-thread handle. The thread's original normal exit is `_endthread`
at `0x10006373`, reached after the wait-loop exit; thread 2's completion
before this teardown is not recorded.

All twelve retained API entry/exit pairs from 912 through 955 have one
matching exit and no pending yield. Notification Release (940–941) returns
reference count **one**, then events close (943–950); base normal-buffer
Release (952–955) returns reference count zero. These counts are not
HRESULTs. The stream belongs to main's recorded HeapAlloc generation 22597
at `0x19b4b94` and successful HeapFree generation 58352 at sequence 956.
The audio Worker's exact allocation/reuse generation remains unobserved;
no replacement allocation is inferred from the later damaged object.

The earliest precise missing initiator boundary is now **entry and producer
of command `0x837` through EXE `0x41b920` / callback `+0x50`**, with the
message and outer-handle generations and caller above return `0x41b9bc`.
Within that dispatch, the remaining preclose boundaries are stream method
`+0x24` and optional callback return, then audio-thread normal completion
versus the destructor's second stop. A future bounded observation should
record those entries/returns and object generations on their owning thread,
alongside the existing wait identity and terminal reserve. Successful API
results and the original deleting-destructor path explain how teardown was
entered; they do not establish why its producer requested destruction or
prove all preceding emulator operations correct. No defined-use emulator
violation, production repair or controlled gameplay is established here.

### Verification and runtime scope

The scratch review asserts original pins, switch target, selected instruction
bytes, caller stack positions, allocation/free generation and all twelve
balanced API outcomes. It passes. The predecessor's retained flood,
saturation, first-fatal transport and unchanged-manager tests were reviewed;
the observer was not changed. A copy of the unchanged-manager focused test
also passes on current main (acquire stop index two, close after completion,
one retained delivery). The flood/saturation observer test was not rerun.
No new build was necessary for this
documentation change. Reconciliation finds five changed files among the
1931Z 528 source pins and three among 866 compiler pins (listed exactly in
`findings.json`); the module remains `d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
The old browser evidence applies to its recorded revision, not a new run of
current main. No browser, server, monitor, input or runtime lock was started
or acquired; CURRENT SiN's runtime was left untouched. Boat ID/state/expiry:
N/A. This is the permitted bounded missing-boundary result; post-close
index-zero/null-buffer symptoms supply no new cause or patch authorization.

## 2026-10-31: bounded producer trace — entry still missing

Evidence: `scratch/runs/20261031T2135Z-slave-zero-producer/`.
The original `0x837` producer and the first defined-use generic emulator
violation remain **unidentified**. No production code or guest bytes changed;
no lifetime patch, forced thread completion, New Game or movement result is
claimed. The accepted original DLL/EXE hashes in the preceding section remain
unchanged across all 168 fixture files.

One browser allocation ran 21:37:43–21:41:39 UTC on main
`5efa420458517d3eacbab60f27946e9cdef80a8d` (documentation descendants of the
assigned `78f63a919`). All 528 source and 867 compiler pins matched the
released Icewind predecessor. The actual uncached HTTP response was 1,898,762
bytes with module SHA-256
`d39f362187ce89abda47fa53bca6bb6576badd8d21b78e44c6fbad973d1636d8`.
No compilation or download was needed.

The copied driver initially omitted the current page's `?candidates` opt-in.
Consequently its selection silently remained Notepad, which it launched.
The retained selector record and startup screenshot establish that harness
error; changing renderer order alone did not fix it. Native Stop All, then
navigation to the local candidates route, an explicit selector/isolation/
Worker/WebGL gate, and native Launch started Slave Zero in the same browser
and original deadline. There was no second browser allocation. The reviewed
`03-intro.png` and `04-native-intro-escape.png` show the original intro; the
single Escape down/up is balanced and does not establish a destruction
producer. New Game was not reached.

### Owning-thread observation and retention limit

The scratch observer used the existing block-entry EIP trace import, with
narrow EXE and per-audio-Worker ranges. Its main-thread routine command
`0x420`/`0x3ea` traffic exhausted each address's 48-sample cap before the
first destruction dispatch. It therefore retained **no direct `0x837`
entry**, caller, message contents or outer-handle allocation generation.
Main sequence 1377 still carries the accepted destruction stack, command
`0x837`, message `0x074ff9b4` and return `0x41b9bc`; this is supporting context,
not a newly observed producer. No additional disassembly/API-pair inventory
was performed.

The observer map was later filtered to reserve samples for `0x837` through
read-only register/stack reads. That late change produced no retained `0x837`
record and does not repair the missing earlier capture. An attempted CDP
observer live edit was rejected because Chrome no longer supports
`Debugger.setScriptSource`; it changed no script or guest state. These
attempts and their limits remain in the run directory.

Thread 2 does have a direct record at original `_endthread` call
`0x10006373`: sequence 1172, followed by its own `host-exit_thread` terminal
1173 and exit receipt 1174. Its observed object is `0x019b4b94`, with no
allocation generation in that Worker's observer. The first fatal instead
belongs to thread 3 and object `0x019bb54c`. Neither equal addresses in another
run nor cross-Worker timestamps join those lifetimes. In particular this
normal exit does not prove thread 3 completed before its destruction.

The complete first fatal is `fatal-3-1016.json`: **AudBuffer error in lock**,
512 stack words, owning registers and retained lifecycle context. Its chunks
were fully reassembled with no pending transport fragments. The preteardown
`first-fatal.png` was reviewed; further guest input was withheld. The executed
snapshot writer overwrote `first-fatal.json` with screen metadata; the unique
fatal receipt, event log and reserved chunks preserve the full original
record. Recovery code fixes this filename collision. No post-close damaged
object or wait index is used to select a repair.

The first missing causal boundary remains entry to **EXE `0x41b920` and
callback `+0x50` for command `0x837`, with the actual caller above return
`0x41b9bc`, message storage lifetime and outer-handle generation**. Next are
the stream virtual `+0x24` return and optional callback return, and the
matching audio object's generation/normal completion versus destruction.
Original second-stop acquisition imbalance remains original behavior, not
an emulator mutex finding.

### Tests, recovery and release

The executed observer passed its 240,000-event heap flood, unrelated-call
filter, saturation, first-fatal/terminal reserve, shared-memory read-only and
Promise/result identity tests. The prior observer rejects the added direct
producer-hook assertion. A stronger recovery test then injected 5,000 routine
producer entries before `0x837`: the executed capped observer fails to retain
the required entry; `observer-recovery.cjs`, filtering before the cap, passes
including saturation and terminal checks. This is a **diagnostic observer**
oldFAIL/newPASS, not an emulator regression or a browser-qualified fix.
`recovery-driver.cjs` also opts into candidates, checks the exact selection
before Launch, and separates fatal receipts from screenshots. Neither
recovery file was browser-executed. `RECOVERY.txt` records the next bounded
observation recipe; no further runtime was launched.

`full-release-final.json` at 21:43:00 UTC verifies all 22 recorded OWN
PID/start identities absent, whole Chrome/global crashpad empty, ports
37023/46339 closed, profile gone, inputs released and FD9 free. Controller,
supervisor, monitor, board watcher and six adopted-child waits completed with
zero status; Chrome exited without a signal. Source/compiler/original pins
were unchanged at teardown. Minimum observed runtime free space was
2,597,023,744 bytes. Icewind could independently acquire the runtime after
the explicit NEWFULLRELEASE. Boat ID/state/expiry: N/A. This task stops at
the missing producer boundary; a generic production repair is not justified.
