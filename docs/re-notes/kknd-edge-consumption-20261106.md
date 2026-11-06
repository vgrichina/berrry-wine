# KKnD edge creation and consumption

Run: `scratch/runs/20261106-kknd-edge-consumption/`. This follows
[the retained Return failure](kknd-response-collector-20261106.md), preserving
its actual task identity, verified owning Worker/module, closed-sibling handling,
and the distinction between host dequeue and guest consumption.

Source preparation is permitted while LegacySamplerStage1225 and then
DisciplesActionSchema1236 finish. Tests, builds, browser controls, and original
execution require both exact FINAL releases and independent PID/port/profile
cleanup checks. No production files are claimed during their freezes.

## Actual bridge reviewed

`lib/renderer-input.js::takeInput` dequeues the first event admitted by the host
owner predicate. Its existing pointer/press hold bookkeeping controls message
delivery timing; it does not create the guest's mouse edge words. The current
`peekAsyncKeyState` reads physical `_mouseButtonsMask`, preserving fix
`1912f8501`. Message position/button accessors retain the active queued snapshot.

`host.js::check_input` calls that shared dequeue, retains its event, and returns
the packed message. Its `inputEventScope` saves/restores both host and renderer
snapshots. `lib/guest-rpc.js` retains those snapshots per slot for subsequent
HWND/wParam/lParam reads. Its Worker fast empty-poll path only applies when no
event is open and the published queue is empty. Mouse-position caching and
physical async-key polling are separate from message retrieval.

`lib/guest-worker.js` creates the actual instance from the transferred compiled
module and broker imports. `GetAsyncKeyState` in
`src/09a5b-handlers-window-late.wat` returns the host result in EAX and performs
the stdcall stack cleanup. The GetMessage/PeekMessage paths in
`src/09a5-handlers-window.wat` cache/rout/filter the packed input and copy its
snapshot into MSG. None proves dispatch into the guest cursor coroutine.

No new Win32/x86 discrepancy has yet been established. Any implementation
repair requires a documented expected behavior and a focused regression that
fails first. No routing rewrite, synthetic guest state, guest memory write,
physical-state rollback, or repeated blind Return press is authorized.

## Passive discriminator prepared

The original executable is referenced at
`scratch/game-media/kknd-demo-20261106/installed/KKND.EXE`, SHA-256
`b2e1a476bfe766edf802c9fa4d0fed2ed841a8d1b50e1a8ee27ceae33afe5d8a`.
Read-only disassembly retained by the predecessor identifies:

- Poll entry `427ed0`, physical-left result `427f79`, initial edge calculation
  completed before the GetCursorPos return `42800b`, and final poll returns
  `422fb6/4230a4/423186`. Read raw previous `475878`, completed previous
  `4758a4`, current/pressed/released `475880/475884/475888`, and published copy
  `475858` together.
- Getter `427eb0` copies eight words from current `475880`. Cursor return
  `43a526` permits an exact read of its copied buffer at ESP+0x28, before later
  collision dispatch. This distinguishes an absent edge from a lost copy.
- Collision consumer `43a712/43a718` retains event EDI, event target +0c, copied
  press/release words, and inhibition globals. Forward branches `43a72e/43a752`
  and the existing button counters distinguish consumer dispatch from a
  task-specific press. Existing task/continuation/descriptor observations remain.

The existing `set_trace_eip_range` hook calls `host.log_eip` at decoded block
entries. Worker RPC normally batches those calls, so reading memory in the page
when a batch arrives would not identify memory at the traced instruction.
The run-local bootstrap instead wraps this existing import before instantiation
and reads the actual owning exports synchronously inside the Worker. Ordinary
imports call their original functions once, preserving answers and exceptions.
Rows are bounded, diagnostic overhead is explicit, and no guest code/data is
modified. Interior instructions may not be block entries; zero observations
there cannot establish absence. Call-return and conditional successor sites
provide the discriminating observations.

A run-only page gate delays only the initial Worker `init` message until its
diagnostic bootstrap is installed. It preserves the exact message and transfer
arguments; it never gates guest slices or input. The hook is disabled until the
existing strict unique owner and actual module proof pass, then attachment checks
the same verified remote instance reference, slot0/endpoint/thread1/512MB, and
the instance captured at instantiation. Source HTTP bodies and the actual module
remain independently hashed. Both gate and import wrapper require controls
before an original lifetime. No test or runtime result is claimed by this
preparation text.

## Result: physical held-state observation remains the first boundary

No emulator fix was made. One original lifetime reached terrain, units and
Options; one reviewed Return click left Options open. Selection, commanded
unit displacement, and a second ordinary gameplay response are **unverified**.
The passive trace works, but this attempt did not reproduce the predecessor's
current mouse mask `0x10`, so it does not explain that earlier failure.

Both predecessor FINAL releases and independent cleanup passed before controls,
locked build or runtime. Source/build identity was pinned at Git
`e1ead19c272cfa09b114ba3e6d00a8bf309b8cc0` plus
`prelaunch-source.binarydiff`, including the relevant untracked source's new-file
patch. No source tree or media archive was made. Own diagnostic helpers and this
note have new-file patches in the run. The retained predecessor evidence was
hashed before preparation and verified unchanged afterwards.

The sole original browser started `2026-11-06T13:08:49.571Z` and closed
`13:14:47.307Z`; cleanup independently passed at `13:15:04.149Z`, before the
immutable `13:52:07.246293Z` deadline. Actual owner remained slot0, endpoint1,
thread1, 512MB, at `http://127.0.0.1:39961/lib/guest-worker.js?v=dev`.
Debugger-recovered actual module SHA-256 was
`220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2`
(2,180,374 bytes), matching standard build and the reported owner. The extra
sound Worker was a sibling, not a substitute owner. Network response identity
has retained unverified initial Worker bodies; actual executor/module identity
is separately proven. No complete network-byte-identity claim is made.

The personally reviewed full-page captures show New Missions, Evolved / The
Walkover-Easy, briefing, terrain/units, Options, and unchanged Options after
Return and at termination. Some secondary canvas crops are black while their
same-command full-page PNG shows the menu; full-page PNGs are the reviewed
visual evidence. The actual Return point was native `(320,188)` after viewport
rounding, within `[237,178,410,199]`. Trusted down/up held 158.05ms. All seven
ordinary actions have balanced trusted edges and completed release receipts;
terminal physical buttons are zero. No additional gameplay action followed the
failed Return.

`consumer-after-immediate.json` contains 530 ordered Worker-local trace rows,
zero dropped rows, eight complete polls, and no guest writes or breakpoints:

- Left-button API results were `0,0,0,0,1,0,0,0`. At row318 the original
  `get_async_key_state(1)` returned `1`; the next guest block `427f79` retained
  EAX=`1`. Its `test ah,80h` did not observe the physical held bit. By `427fd0`
  current remained zero, so the physical-left branch had not created mask16.
- Cursor motion from `(320,433)` to `(320,188)` subsequently produced current
  bit1, pressed1, then released1. The eight final edge calculations match
  `current & ~previousCompleted` and `previousCompleted & ~current`. Published
  eight-word copies match the observed final poll state. These are movement
  bits, not evidence of a left-button edge or a working Return.
- Poll-entry gaps were 3.920, 2.405, 14.740, **489.225**, 2.645, 2.070 and
  3.795ms. The large gap exceeds the click's hold, but page and Worker clocks
  were not aligned. Attribution to debugger/diagnostic overhead, scheduling,
  or bridge latency is unproved; this is not a demonstrated stale-state bug.
- Getter `427eb0` ran eight times with ECX=`4758f8`; none was the cursor-specific
  return `43a526`. No cursor copied-buffer/target collision/press-forward
  observation occurred. Absence at interior non-block sites alone is not proof.
- Existing counter slots for cursor forwarding, button press/release and menu
  close stayed zero. Return task `5589a8`, continuation `4321d6`, animation
  table `348`, still waited at `432d56` with mask `c0000000` and empty queue.

Microsoft documents that GetAsyncKeyState's high bit reflects current physical
state and its low bit indicates a prior press; the low bit is unreliable.
A result of `1` alone does not establish a broken held-state implementation.
[Win32 GetAsyncKeyState documentation](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getasynckeystate).
The WAT handler preserved that observed result in EAX. Replaying a queued down
snapshot as async physical state would violate the required `1912f8501`
semantics. No documented Win32/x86 discrepancy or focused failing semantic
regression was established, so changing production would be speculative.

The next causal observation must correlate page physical-mask transitions and
broker entry/answer with a guest poll during that same held interval, then
observe the cursor-specific copied buffer and next consumer before reset.
That is a remaining measurement requirement, not permission for a blind repeat
or a routing rewrite. The predecessor's sampled mask16/no-forward boundary
remains unresolved separately from this attempt's absent held-state sample.

## Validation and cleanup

`flock /tmp/wine-build.lock bash tools/build.sh` passed standard and compat.
Focused checks passed: passive import answer/exception preservation and page
initialization gate; 16 strict owner/closed-sibling/live-error controls; command
envelope rejection controls; physical mouse drag-mask regression; 35 button
hold/snapshot assertions; real browser initialization gate and real
Wasm→JS→Wasm synchronous read callback. Existing command-envelope, reviewed-input,
actual-owner and unexpected-error guards remain intact. Run-local analyzer was
invoked once with a doubled path, corrected to its documented filename argument;
raw guest evidence was unchanged. No new harness/identity/page error files were
produced by the original run. The browser launcher exited143 after its completed
quit cleanup; cleanup and final capture were retained, rather than interpreting
that exit as gameplay success.

`final-cleanup.json` independently verified 25 owned PIDs absent, three ports
refused, two profiles absent, four locks free, and 4,138,217,472 bytes free on
/home. The 16 original media files (15,653,500 bytes) and authentic DDRAW pin are
unchanged. No boxes were assigned: ID/state/expiry are not applicable. Runtime
and file ownership are released on the final messageboard entry. Final run
`result.json` and `final.txt` are written last, after publication and evidence
validation. The published change is this note; executable diagnostics stay in
ignored evidence with source patches and hashes.
