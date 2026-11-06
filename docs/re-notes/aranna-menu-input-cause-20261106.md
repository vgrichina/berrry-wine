# Aranna: input reaches the menu window; selection boundary remains unobserved

`NEW-GAME-ARANNA-DEMO-20261010` remains at rendered Main Menu. The one original
run adds actual x86 callback execution and return evidence after trusted Single
Player input. It does not demonstrate player setup, movement, or gameplay. No
production emulator repair was selected. Persistent vertex-pack refusal is now
observed in the owning draw operation, separately from completed input callbacks.
FPS and audio remain unknown.

Evidence is `scratch/runs/20261106-aranna-menu-input-cause/` (ignored). Runtime
work began only after the ordered Conan0125, Reset0130, CapsFixture0135 exact
FINAL releases and independent cleanup verification. The immutable execution
gate is 2026-11-06T02:43:45.285236Z; its 45-minute deadline is 03:28:45.285236Z.
There were no boxes, subworkers, media copies, guest patches, forced branches,
CPU/state setters, error bypasses, or increased memory.

## Retained pressure is not recovered original gameplay

The final published [pressure-recovery note](aranna-pressure-recovery-20261106.md)
and fully drained original were reconciled before execution. Its 176 late OOM
notifications at 01:53:34.737–01:53:38.735Z comprise 88 reason-3 requests for
1,048,576 bytes and 88 final reason-1 refusals: 18,696 × 44, 34,408 × 22,
45,064 × 22. The earlier zero-notification statement was premature.
Generated 45,056-byte allocation recovery does not prove original recovery.
Matching charged size does not identify an owning call or establish menu
causality. Complete original free ownership remains unknown.
`retained-reconciliation.json` pins the existing logs, input records, state,
and personally reviewed Main Menu capture by path and hash.

## Delivery, focus and the actual route

Browser input converts CSS coordinates through canvas geometry and the actual
exclusive presentation viewport, then renderer input queues messages. Host
`check_input` selects process/window ownership; HWND-less keyboard messages use
the polling owner's live focus. Worker RPC preserves dequeued event metadata.
A dequeue log alone proves neither DispatchMessage nor callback consumption.

The generated harness initially omitted the normal threaded host's input
publishers while manually slicing workers. Messages consequently stayed queued
although immediate mouse state worked. Installing the same queue/key/mouse
publications used by `_runThreaded` fixed the harness. This is not an Aranna
production input-loss finding. Failed drafts are retained with that distinction.

The original's visible Dungeon Siege window was HWND `0x1000e`, process 1000,
800×600 at (0,0), and owning slice focus was the same HWND. The visible canvas
was CSS (10,194,660,568); exclusive viewport was (0,36,660,495) over native
800×600. The trusted Single Player click was page (340,355.9936), normalized
(0.5,0.2852), and the actual dequeued/down callback point was (400,151).
Down lParam was `0x00970190`; up was recentered (400,300), `0x012c0190`.
The pointer remained unlocked and the focused DOM element was CANVAS.

Owning worker 0 actually entered WndProc `0x414f7c` for mouse down/up at
03:00:35.164/03:00:35.332Z. Both returned at `0x41742e` with expected ESP and
EAX=0 (03:00:35.193/03:00:35.349Z). These are PC-plus-ESP return observations,
not host queue inferences. Enter down/char/up also entered and returned through
that WndProc. Reviewed `after-single-player.png` and `after-enter.png` remain
Main Menu with the cursor on Single Player.

The first observed menu-window routing decisions are now concrete:

- `GetWindowLongA(hwnd,-21)` returns object `0x074ffd1c`; execution takes the
  nonzero path from `0x414fa1` to `0x414fc2`.
- The predicate called at `0x413d71` returns AL=1; execution continues through
  `0x414fd5` to `0x414ff0`.
- The virtual prehandler through `[vtable+0xd8]` targets `0x476bda`, returns
  AL=0, and execution continues from `0x4150ae` through `0x4150b6`.
- Mouse down reaches `0x415a65 -> 0x41793d`; mouse up reaches
  `0x415780 -> 0x415a66 -> 0x41793d`. The ordinary cursor-update virtual call
  enters `0x659326 -> 0x414b08`. Actual GetCursorPos returns (400,151) on down
  and (400,300) on up; ordinary SetCursorPos(400,300) succeeds.

These decisions continue routing; they are not a proved Single Player hit-test
or acceptance. The down trace reaches event/listener traversal `0x4182b4`, then
string/lookup paths, and spends its 256-block prefix at `0x43a316`. Up reaches
`0x417993 -> 0x417d14`, then `0x41818a` and lookup paths, exhausting its prefix
at `0x43a30a`. Callback returns are observed independently after these prefixes.
The exact remaining boundary is the menu listener's button hit-test/selection
and any subsequent queued transition. Its result and required allocation have
not been observed. A callback returning zero does not prove rejection there.

No DirectInput create/configure/acquire/state/data/Poll API was observed in
this original interval; copied owning counters are zero. Aranna's observed
route here uses Win32 messages and cursor calls. Source semantics were checked:
immediate mouse state exchanges physical relative accumulators and reads live
buttons, buffered mouse retains ordered physical events, and acquired interrupt
mouse Poll returns DI_NOEFFECT without draining those buffers. Cursor warps
must not inject physical DirectInput motion. See Microsoft's
[buffered/immediate distinction](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416236(v=vs.85))
and [Poll contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee417913(v=vs.85)).

## Persistent refusal in the actual draw allocation

The original ran 02:57:44.927–03:05:06.163Z and exited normally. After stopping
owned workers and awaiting copied packet writes, the file has 16,038 rows:
16,037 page-array rows plus the directly saved module-identity row. There are
no incomplete/orphan/duplicate observer packets. `original-review.json` records
the fully drained counts, not an early zero report.

There are **7,808 scalar OOM notifications**, first 03:02:26.379Z, last
03:05:05.669Z: 3,904 reason-3 one-MiB reservation refusals paired with 3,904
reason-1 final refusals. Charged sizes/counts are 45,064/749; 18,696/1,495;
34,408/748; 18,536/692; 17,480/220. These uncapped scalar notifications continue
after the root observer reaches its 8,192-snapshot cap at 03:03:34.143Z.

Before that cap, the actual pack-zero hook records 2,038 failures, FVF 0x142:
1,408×32=45,056 bytes (419), 584×32=18,688 (837), 1,075×32=34,400 (419), and
579×32=18,528 (363). The first is paired in owning worker 0 with reason-3
1,048,576 then reason-1 45,064, followed by the real pack returning zero. The
private pack-operation tag is 1. The current dispatch is
`IDirect3DDevice7_DrawIndexedPrimitiveVB` (1377), observed guest block `0x65f8d8`,
stack return `0x65f8ff` (read-only disassembly locates the call at `0x65f8f9`); the mapped stack and owning allocator scalars are
retained. This identifies the actual allocation operation rather than inferring
it from equal size. All retained refusal snapshots have callback ID zero;
mouse and Enter callbacks have already returned. It does not identify an
allocation required by the still-unobserved selection/transition operation.

The later personally reviewed `late-menu.png` still shows Main Menu and missing
parts of its frame geometry. Rendering allocation pressure is established;
pressure causing the earlier selection failure is not. Source review finds
`d3dim_vb_draw_indexed_primitive` skips the draw when `packed` is zero, then
unconditionally writes EAX=0. The observer filters successful draw results, so
an exact nonnegative HRESULT and its guest consumer are not copied here. No
negative draw-result window was recorded. The next observer must retain that
owning return unconditionally, plus its guest continuation, rather than assume
that missing negative rows proves an error was propagated. This source boundary
has not been given a generated public DrawIndexedPrimitiveVB exhaustion control
or a production repair in this task. Read-only disassembly locates the caller
pushing the return at `0x65f8ff` into `0x41effe`; that static consumer accepts
nonnegative results and explicitly accepts `0x8007000e`. Its actual dynamic
branch is unobserved, so changing only the returned error would not establish
allocation recovery or menu progress. Complete free-span ownership remains
unknown. The existing bounded allocator recovery was not repeated or changed.

## Generated controls and observer limits

The locked canonical build passed (`build.log`). Same-closure generated baseline
modules were byte-identical to shipped standard/compat modules. Observer modules
preserve exact imports/exports, guest PE, memory size and normal CPU settings.
They copy scalars and already mapped storage using bounded nonfaulting reads;
they do not invoke guest translation, evaluate lazy flags, change fault/thread
state, materialize native registers, or repair allocation. Native block execution
is disabled by the canonical default and copied enabled/runs remain zero in the
controls and original. An unused native observer draft was removed rather than
changing that default.

`controls-6.log`, `controls/results.json` and `controls/pressure-results.json`
pass both standard and compatibility ordinary API/owningWorker comparisons:

- Actual held/released immediate mouse state and buffered DOWN/UP records;
  physical (23,30) relative motion and no motion caused by cursor warp.
- Real mouse/Enter callback entry and RET, GPR/nonvolatile and lazy EFLAGS
  equivalence, a live FLD1/FLDPI x87 stack with matching environment/TOP=6,
  and thread/yield results. The x87 payload values themselves were not copied.
- A real reserved page fault inside the mouse callback; the ordinary FS:[0]
  handler commits the page and the faulting write/read resumes with 0x12345678.
- Ordinary HeapAlloc exhaustion in fixed 512 MiB, live guard retention, exact
  refusal-snapshot versus scalar-notification coverage, and unchanged return,
  CPU/FPU/thread results. There are no incomplete observer packets.

The final observer records selected API outputs during callbacks and bounded
post-input windows even when unchanged or zero. It observes actual callback
entry/return, up to 256 subsequent block entries per selected input, scalar OOM
hooks and refusals inside the actual `$d3dim_pack_fvf_vertices` allocation.
A private operation tag distinguishes that owning pack allocation. The last API
ID alone is not a perfectly scoped allocation owner under nested callbacks.
Caps are 64 selected callbacks, 8,192 snapshots per module instance and bounded
buffer reads; fused/interior instructions are not a complete instruction trace.
Missing rows beyond coverage limits remain unknown.

A separate documented API mismatch is reproduced in both modules: queue DOWN at
(398,152), physically move to (421,182), then consume the callback. Its actual
GetCursorPos returns the queued point (398,152), before the guest's recenter.
Microsoft's [GetCursorPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorpos)
requires current screen position; the separate
[GetMessagePos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmessagepos)
returns the retrieved message's position. The shared host getter currently
prefers an active message snapshot. This establishes a generated API defect,
not its causality in Aranna. The original click and its actual cursor result
coincide, and its recentered up result is consistent with the recorded virtual
pointer. A broad getter change would also affect the historical MSG contract;
no unrelated production repair was made on this evidence.

## Reproduction and next observation

`preoriginal-source.json` pins source commit
`377f24255602f0002025caa14e9f6ae44b606dd4`, 1,197 relevant tracked input hashes,
all relevant uncommitted binary diffs and new-file patches. These inputs matched
the compiled-control closure before original launch. The 28 existing game media
files are referenced by path/SHA-256 in `media-references.json`, without copies.
The original selected standard observer SHA-256
`b4e29b02f628f2d049dcc2f13006be0becd545850e31206b7b3641074b90d3fe`;
compatibility control observer is
`c39541dbf2c91f16d9b99486509004a0edde87f72d4082a688b881fe97682d63`.
Closure SHA-256 is
`dba4d3b013cc1f620d76cf7ae984c28d428c88c4e8b239894f6dddcd72b215b4`.
Run-owned transform, compiler, fixture, browser driver, lifecycle and analyzer
sources are retained as small new-file patches; Git remains the source archive.

The next discriminating observation should retain the draw return at `0x65f8ff`
and the decision at `0x41f009`/`0x41f01d`, and start menu tracing at the actual event/listener
traversal and retain the button-selection/transition result rather than spend
another prefix on generic routing and string comparisons. Pair that owning
operation with allocator entry/result, reservation failure and owned free-span
provenance. If required allocation returns zero there, follow that allocator
boundary. Until then, neither persistent pressure nor input loss is established
as the reason Single Player remains on Main Menu. Do not replay unchanged,
borrow another module instance's free list, or mask pressure with more memory.

The sole original was closed through the ordinary quit command, all owned Wine
workers stopped, copied logs drained, and Chrome exited code 0. The terminal
capture was reviewed as the stopped desktop, not gameplay. Final cleanup and
publication records are in `final-cleanup.json` and `result.json`; no assigned
boxes existed (ID/state/expiry: N/A). No second original or unchanged retry ran.
