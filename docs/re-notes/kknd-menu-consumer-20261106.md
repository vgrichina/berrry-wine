# KKnD menu consumer after the proven mouse poll

Run: `scratch/runs/20261106-kknd-menu-consumer/`. Predecessor boundary:
[`kknd-options-click-20261106.md`](kknd-options-click-20261106.md), commit
`1ae7869caf6760b56790fbd8ed36ebebcf098472`. Original EXE SHA-256:
`b2e1a476bfe766edf802c9fa4d0fed2ed841a8d1b50e1a8ee27ceae33afe5d8a`.
All addresses below are original preferred-base virtual addresses, from read-only
disassembly. No guest patch, state write, or emulator defect is established.

## Static consumer chain

`0x427ed0` polls the physical mouse. Its final edge calculation at
`0x42810e..0x428139` uses completed current state `0x475880` and previous
`0x4758a4`, writes pressed/released to `0x475884/0x475888`, then copies 32 bytes
to `0x475858`. The callable getter `0x427eb0` copies **current `0x475880`**,
not that latter buffer. The cursor script calls it at `0x43a521` into its stack.

On a collision event `-2`, cursor code `0x43a712..0x43a760` forwards pressed
mask `0x10` as event `0x5e7` and released mask `0x10` as `0x5e8` to the event's
target. The target must be nonzero and `0x472bf0` must be zero. This last global
is the guest's fade/input inhibition flag (`0x408390` sets it during its wait).
Global `0x4779ec` separately gates both cursor polling and button handling.

The collision path is guest code: `0x426a50` calls `0x404c30` to build spatial
buckets and `0x404e20` to test sprite collision descriptors. Sprite `+0x58`
points to descriptor lists, `+0x5c` to category masks/callbacks. The tests at
`0x405030..0x40509a` reject non-overlapping rectangles using signed comparisons
and strict overlap (equal edges do not overlap). Callbacks `0x41ad80` and
`0x41ada0` enqueue `-2`; the latter requires recipient task `+0x28` to include
`0x40000000`. Read actual descriptors and tasks before interpreting a painted
button as an eligible collision target.

Common button coroutine `0x432d30` waits for `0xc0000000` (queued event or
timer). It drains its queue and records `-2` as hover bit `0x10`, `0x5e7` as
press bit `4`, `0x5e8` as release bit `8`, and `0x5f8` as cancel bit `1`.
Cancel returns zero; `0x4779ec != 0` restarts waiting; a press enters the
pressed animation at `0x432e24`. **It does not require a release bit here.**
It then has two waits for mask `0x50000000`, at `0x432e49` and `0x432ec4`.
These wake on a queued event (`0x40000000`) or animation completion
(`0x10000000`, produced by `0x426e90`). Each phase drains events, checks cancel,
and advances/returns success with its local noncancel flag still set. Thus
this is not a simple Win32 button down/up rectangle test.

The Return candidate script `0x432190` invokes the common coroutine with
animation table offset `0x348` and sends `0x5f8` to main menu task `0x477350`
on success. The main menu's dispatch tables map that event to `0x431be7`:
single-player closes only when `0x477358 != 0`; other modes bypass that check.
The menu-open path at `0x4319e0` sets `0x477358` to one only when guest global
`0x46c300 == 1`, otherwise clears it. Retain that upstream value too; its
presence alone does not establish an emulator defect.
`0x432290` instead sends `0x5f3` to the confirmation-dialog path `0x431cbd`;
do not identify Return from its setup y offset alone. Sprite origins and
collision descriptors must be read to tie the actual hovered task to its label.

## Discriminating observation prepared before launch

After all three ordered releases and independent cleanup checks, pin Git SHA,
relevant WIP binary diff, original media hashes, actual HTTP sources/modules,
and the owning instantiated Worker module. Use the existing diagnostic hit
counters (no guest breakpoint or patch), with slot zero at press-consumer
branch `0x432db3` to retain the pressed task in EBP. Count cursor event transfer,
button phases, success, and main menu close/check branches. Read task queues,
wait/event flags, sprites, collision descriptors and inhibit globals alongside
those counters before/during/after one balanced ordinary click at the previously
reviewed Return location. Preserve the distinction between global branch counts
and a task-specific press snapshot. Counter mode adds diagnostic overhead.

Task allocation at `0x443840` uses 0x44-byte records. Task `+0x40` names its
cooperative context; context `+8` points to the saved stack (`0x402a40`). The
observer retains this stack to identify the exact coroutine continuation and
caller. It also reads the type-0x1e asset table through `0x475708`, including
the label-animation entries at offsets `0x348/0x354/0x360/0x33c/0x36c/0x378/0x384`.
Match those pointers to the actual pressed task's text sprite rather than
assigning a label from its y offset.

The observation separates: no cursor edge transfer; no eligible collision target;
press delivered to a different task; inhibited button; stalled animation/wait;
successful button with ignored main-menu close condition. Stop on the first new
failure. No unchanged replay, coordinate search, guest writes, or routing repair.
Selection, commanded displacement against fixed terrain, and a second ordinary
response remain unverified until personally reviewed evidence establishes them.

Counter addresses must be block entries: the two wait-setup observations use
`0x432e44/0x432ebf`, returns from the preceding animation setter calls.
The wait-push sites `0x432e49/0x432ec4` can be interior instructions on their
first execution; a zero counter at those sites would not prove a stall.

## Bounded runtime result: observer attachment failed before Return

The exact Legacy, Disciples, and Help releases were checked in order, with
independent PID/port/profile cleanup. Local runtime window was
11:44:14–12:29:14 UTC; cleanup finished at 11:47:19. One original browser reached
the Evolved mission and Options by ordinary input. Six trusted input pairs and
six completed release receipts balance; terminal buttons are zero. Sixteen
original media files still hash identically. No source/module drift occurred.

Tested Git SHA: `b75a0dfac95c4bd428e077b3190fe96034c31c4b` plus the retained
`prelaunch-source.binarydiff`. Actual served and instantiated standard module:
`220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2`.
The owning slot 0 / endpoint 1 / thread 1 identity still passed at shutdown.

**First new failure:** command 16, `menu-on`, at 11:46:28.683 UTC failed with
`TargetCloseError: Protocol error (Runtime.evaluate): Session closed`.
The helper's `owner()` probes every retained guest-worker CDP target. It finds
the live owner, then probes a closed sibling session and rejects before calling
`initialize()`. The terminal identity collector independently retains both the
live owning instance and that closed-session error. Its per-target error handling
allows the valid owning module to remain proved. The consumer attachment has no
such handling. This is an observation-helper defect, not an emulator defect.

**No Return click was issued, counters were not armed, and no new guest-consumer
condition was observed.** The original failure is neither repaired nor newly
attributed. No guest writes, emulator changes, coordinate search, restart,
selection, commanded displacement, or second gameplay response occurred.
The helper stopped and closed its browser automatically on this first failure.
Personally reviewed `game-options-game.png` and `terminal-game.png` show Options;
`gameplay-ready-game.png` clearly shows the original terrain and units.

The pure mock observer control passed task/continuation/queue/read-only checks,
but covers `initialize()` only and missed closed-session owner discovery.
Before a separately authorized session, control-test owner discovery with a live
owner plus a closed sibling, retain strict unique live owner/endpoint checks,
and then use the prepared consumer observation. Do not rerun routing or mouse
poll investigations. There is no documented API/CPU defect justifying a repair.

All 13 owned PIDs are absent, both loopback ports refuse, the profile is removed,
all four locks are free, and free disk exceeds 2 GB. No boxes were assigned.
Evidence: `failure-boundary.json`, `terminal-executor-identity.json`,
`balanced-release.json`, `capture-review.json`, `final-cleanup.json`, and the
source/media/HTTP/module pins in the run directory. No full build was rerun:
this change is documentation only; the current compiled modules were verified.
