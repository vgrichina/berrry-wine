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
