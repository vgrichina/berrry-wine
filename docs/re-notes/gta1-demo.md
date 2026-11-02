# Grand Theft Auto: original 24-bit DOS demo

## Authentic time service identified; initialized bridge fixture prerequisite, 2026-11-02

The follow-up to `511a76fc39347a96a19cc82226e578a2251b9190` identifies
the authentic DOS/4GW time conversion in **already retained original progress**.
The requested full bridge boundary fixture remains **unimplemented and
unexecuted**: its initialized callback/descriptor closure is missing from the
retained evidence. No original replay, guest fixture, test/build, clock change,
source correction, optimization or sandbox operation occurred in this task.
The calibration coverage gap is still open; no causal emulator defect is
established, and 241,463 remains only the old representative fixture's count.

Static evidence is in
`scratch/runs/20261102-gta1-authentic-clock-bridge-fixture/`:
`static-audit.py`, `static-verification.json`, `STATIC.md`, six bounded
unrelocated code windows/disassemblies, and terminal/lifecycle records.
The executable SHA remains
`2f1cedfb95254b2f1a8913f1aeac7a915966cb42c70c9c96b14b8861fbf78c9f`.
Exact 16-byte retained instruction matches establish file-to-code offsets
`0070 → file+9B10`, `0080 → file+1F674`, `0088 → file+2C854`;
these are file offsets, not guest memory mappings. There are 16, 49 and 53
exact progress-sample matches respectively. Other samples can contain runtime
patches and are not asserted to match the on-disk bytes.

At retained dispatch **10,933,327**, `0070:0D01` has low DI=`005A`.
Its addr16 CS-override jump reads slot `2D` at `CS:06CE`; the embedded word
is **1441**. `INC AH` at `0CF0` makes this the AH=2Ch slot.
The `1441` handler checks kernel data `DS:15` bit 0 and `DS:34 == 15h`;
its fast branch reads the BIOS tick words at `0040:006C/006E` and performs
integer MUL/DIV arithmetic with constants **3323, 60500 and 605**. This
branch does not call the host AH=2Ch formula or read PIT counter ports.
The other branch falls back through `0D06`, so initialized flags matter.

For ticks below 8,192, the high tick word and `SHR 13` correction are zero.
Independent integer arithmetic is `q,r = divmod(tick*3323,60500)`:
seconds are `q`, hundredths `r//605` in the bounded domain here. This gives
DX=`004C/0062/0104/0161/0203` at ticks **14/18/19/36/37**.
All 23 retained application times agree at their stamped or preceding tick.
This identifies a specific conversion; it does not equate its general
rounding with the earlier rational PIT model.

Retained live `0070:145D`, `1481` and `1490` samples match the executable
instruction bytes exactly. At dispatch **20,105,140**, `1481` has full
EAX=`00000001`, ECX=`0000EC54` (60,500), EDX=`0000E6F8` (59,128):
`36*3323 = 1*60500 + 59128`, then `59128//605 = 97`.
Thus the retained service itself explains `DX=0161`; the old host55 fixture's
`0162` does not demonstrate an emulator time defect. This sample is still
before the nominal tick-37 boundary and proves no DH=2 return or calibration RET.

The precise missing prerequisite is an authenticated initialized bridge state:

- `A8:906` callback-table selector and its type/target records. Authentic
  `0088:0BE4` dispatches through them. Retained samples identify outgoing
  `0080:0E34` and nested `0088:08D4`, but do not capture the table memory or
  descriptor caches. Calling the conversion directly would skip that marshalling.
- `A8:7E4` vector classification, the saved vector-21 target/type at
  `A8:924+21h*8`, `A8:1224/1228` context allocator, `A8:7E2` stack selector,
  and their descriptor/page-map closure. Restore58 contains none of these tables.
- Kernel `DS:15/34` guards and linked `DS:996/99E/F52` frame/nesting state,
  plus the `0040` BIOS-data alias. Zero-filled guesses could choose host
  fallback or an invented callback route.

`STATIC.md` retains the prepared 18→19 and 36→37 fixture contract, unchanged
550,000 dispatches/tick, tickScale=1, irqSchedule=true, and the 1,200,000 billed
dispatch cap **per arm**. It specifies full service/restore58/IRETD12 register
and BIOS/PIT observation, DH2, INC/CMP/JE, result `104786B8`, RET, independent
count identities and negative controls. Static host55/divisor/stale-second
discriminators pass; **runtime negative controls and observer parity have not
run**. No substitute ToyVM test was added.

**Next correctness action toward original gameplay:** reconstruct and
authenticate the initialized DOS/4GW callback/descriptor closure from its
embedded initialization, or obtain a separately authorized checkpoint containing
it; then execute the bounded authentic fixture with parity and negative controls.
Another original run is not the next action authorized by this task.
Both execution prerequisites are not yet satisfied at this static closeout:
matrix handle 6415 published `69fa4b52c1573344e2aee5f7fdff41f21822a4c8`
and released its resources; accumulation handle 68617 owns shared execution.
Its terminal result, exact release and helper cleanup remain pending. Shared
source/tests/build/runtime ownership was never acquired. Only this note and
ignored static evidence changed; foreign WIP is preserved, local disk remained
above 2 GB, and no box was created or resumed.

## Retained pre-return cause: finite seconds wait, fixture coverage gap, 2026-11-02

Static evidence: `scratch/runs/20261102-gta1-pre-return-state-cause/`
(`analyze.py`, `arithmetic-audit.json`, bounded original/relocated disassembly).
Inputs are published `84e604d851a75b0f217cfdb5669c752b7d2bd307`'s
`20261102-gta1-headroom-original-resume/{RECOVERY.txt,result.json,verification.json,
original-frame-audit.json,remote/ring.json,remote/fixture-results.json}` and
the retained original executable. **No new guest execution occurred.**
The evidence establishes incomplete calibration; it demonstrates no causal
interrupt, count, or clock defect that justifies a source change.

The original's SHA-256 remains `2f1cedfb95254b2f1a8913f1aeac7a915966cb42c70c9c96b14b8861fbf78c9f`.
LE page-map index 275 contains `00 01 14 00` (data page 276); embedded-MZ
base `38D64` + data-page offset `72C00` + `275*1000` gives file page
`1BE964`. Offset `65D` gives file **1,830,849**. Its 50 function bytes
match the existing fixture exactly after the one recorded result relocation
at `10196686` (object 2 + `2CD6B8` → `104786B8`). Relevant instructions:

| Address | Original bytes | Meaning in the captured 32-bit code segment |
|---|---|---|
| `10196665` | `31 C0 88 F0 89 C3` | Zero full EAX, copy DH into AL, copy full EAX to EBX |
| `1019666F` | `31 C0 88 F0 39 C3 74 F4` | Compare full EBX with zero-extended seconds; repeat at `1019666B` while equal |
| `10196677` | `31 F6 88 C3` | Zero full ESI, retain the changed seconds in BL |
| `1019667B` | `B4 2C CD 21` | Ask DOS for time; return to `1019667F` |
| `1019667F` | `46 38 F3 74 F7` | Increment full ESI, compare BL with DH, repeat at `1019667B` while equal |
| `10196684` | `89 35 B8 D6 2C 00` | Store full ESI; relocated operand is `B8 86 47 10` |
| `1019668A` | `5E 5A 59 5B C3` | Restore ESI/EDX/ECX/EBX, then near RET |

There is no division, multiply, 16-bit count truncation, or threshold on ESI
in this function. DL hundredths do not enter either comparison. Seconds
59→0 also break equality. The retained caller return `10196C0F` agrees with
the original indirect `FF D0` at `10196C0D`; it does not prove that callback
returned. Static caller operands are unrelocated in the disassembly artifact.

All 23 retained application-return samples restore the complete captured
GPRs and EIP. The authentic `0088:06FD` tail is
`1F 07 0F A1 0F A9 66 61 66 83 C4 06 66 CF`: segment pops, POPAD,
ADD ESP,6, IRETD. At tick 36, restore-frame offsets `+12/+24/+28/+32/+36`
hold ESI=`000020CB`, EBX=`00000001`, EDX=`00000161`, ECX=`00000000`,
EAX=`00002C01`. Offsets `+46/+50/+54` hold EIP=`1019667F`,
CS slot=`000102E0`, EFLAGS=`00000246`. After IRETD, CS=`02E0`,
EIP=`1019667F`, ESP=`1047B6D0`, SS=`02E8`, D32=1 and
stack mask=`FFFFFFFF`; restore ESP was `1047B696`, exactly 58 bytes earlier.
Thus the live bridge's temporary ESI is not the calibration count, and the
CS-slot high word is not part of the loaded selector.

An independent count identity holds for **all 17** retained second-phase
samples: saved ESI = tail-hit number − **3,371** − 1. Hit 3,371 is the
tick-19 first-phase return with EBX=0, DH=1; the following instructions
clear ESI and set BL=1. At tick 20, `3865−3371−1=493`; at tick 36,
`11767−3371−1=8395`. These samples are before `INC ESI`, so the latter
would become 8,396 before comparing equal seconds. Full-width count and
restoration agree with the instruction sequence. The fixture's 241,463
polls are its own bridge's count, not an expected original count: its last
saved ESI is 241,462, then the terminating increment stores 241,463.

**The first demonstrated fixture/original coverage mismatch is in time's
hundredths, not the loop arithmetic.** At the first application return
(tick 14), actual EDX=`0000004C` means second 0, hundredths 76. The host
`tools/toyvm/dos.js` AH=2Ch formula `ticks*55` would give `004D` at tick 14;
no integer tick in 0..37 produces `004C`. At tick 36, actual `0161` means
1.97 seconds, while that host formula gives `0162` (1.98). The successful
fixture actually observes this host path and preserves its seeded upper
EDX=`3456`; original upper EDX is zero. Those different inputs are not
evidence of lost high halves.

Independent integer PIT conversion, `floor(tick*65536*100/1193182)`, gives
76 centiseconds at tick 14 and 197 at tick 36, matching those original
values. Every counted original sample matches this conversion at its labeled
tick or the preceding tick. A restore sample is later than its time query;
the retained observer stamps only restore time, while `dos-loop.js` advances
the clock at scheduled handbacks. This numerical agreement does **not**
identify the original service's implementation or prove a conversion defect.
The retained original reports only 498 host INT21 services against 12,227
bridge-tail visits; bridge visits cannot be equated with host AH=2Ch calls.
The fixture uses representative bridge scaffolding, not the original complete
DOS/4GW service path, so its host-service assertions cannot fill this gap.

Both conversions still give DH=1 at tick 36 and DH=2 at tick 37. The
independent expected low words are:

| Query tick | Host `ticks*55` DX | PIT-derived DX |
|---|---|---|
| 18 | `0063` (0.99) | `0062` (0.98) |
| 19 | `0104` (1.04) | `0104` (1.04) |
| 36 | `0162` (1.98) | `0161` (1.97) |
| 37 | `0203` (2.03) | `0203` (2.03) |

The original ended at dispatch **20,313,713**, **36,287** before the nominal
tick-37 boundary `37*550000=20,350,000`. Its last observed calibration pair
was earlier, at 19,800,613; final `0070:4335` is an interior bridge snapshot,
not a frozen DH or a failed IRETD. Neither an original result store nor RET
was captured. There is no valid wall-time or original poll-count prediction
from the representative fixture, and no acceleration fix follows.

**Next concrete correctness task:** a separately authorized, bounded
non-original instruction fixture should isolate the authentic DOS/4GW
time-service/bridge path and compare it with the existing representative
fixture at the 18→19 and 36→37 boundaries. Record full INT21 entry GPRs,
service-time tick/PIT phase and actual service route, returned ECX/EDX,
complete restore58/IRETD12, then `INC/CMP/JE`, result store `104786B8`
and RET. At tick 37 expect ECX low16=0, EDX low16=`0203`, stored result
= pre-increment ESI+1, preserved caller GPRs and the full caller return EIP.
Use unchanged default dispatch/clock semantics and at most **1,200,000 billed
dispatches per boundary arm**; initialized boundary states must be labeled
fixture setup. The decisive
missing observation is a query serviced at/after tick 37 returning DH=2,
followed by that value surviving the authentic bridge and breaking equality.
If it returns DH=1, locate the first divergence at service/restore/comparison
before editing source. This requires runtime ownership and validation in a new
task; it is not authorization to replay the original here. Only after that
coverage is resolved should an owner authorize another bounded original run.

This task owns no source/tests/build/runtime resources and changed no code.
Only foreground static tools and a board watcher ran; their actual waits and
watcher cleanup are retained. No new box was assigned: predecessor box
`bx_tm2x67p8` remains recorded stopped, expiry `2026-11-02T05:19:00.950Z`;
coordinator lifecycle was untouched. Local free disk remained above 2 GB.

## Headroom resumption: validated observer, authentic startup reaches tick 36, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-headroom-original-resume/`, including
retrieved `remote/` evidence. **Exactly one authentic original attempt ran.**
It stopped at the shared 120-second wall deadline before an observed calibration
function return. The inspected final PNG shows DOS/4GW copyright text only;
there is no player scene, gameplay, walking/driving, FPS or audio evidence.

Signed-accumulation then matrix-headroom terminal exit0/turn.completed,
result/final and exact AUTHOR RELEASE were consumed; all eight reported helpers
were independently absent. Matrix cleanup reclaimed zero bytes. Fresh local
free space was about 2.04 GB, below this assignment's 2.4 GB execution admission,
so no local tests/build/game ran. The explicitly authorized sandbox fallback
used temporary box **bx_tm2x67p8**, expiry **2026-11-02T05:19:00.950Z**.
Its initial free space was 57,349,754,880 bytes. SSH/SCP were rejected by the
API key; permitted command-API transfer verified all **11,054** snapshot files.
Snapshot source main is `d9ee9b1957262944a1673295770a590a07ea5755`; later local
main includes unrelated documentation. No local repo copy/branch/worktree,
download, worker, browser, source/GL/guest-byte/clock change or optimization
was used. The sandbox skill supplied the lifecycle workflow.

The predecessor's interrupted validation is now complete. Actual retained-ring
installation plus the current task-wrapper composition passes its lost-callback
negative and successful composition, with all RAM/global parity. Ordinary
IRETD, stack-page-fault/task delivery, mapped instruction, read-only absent-page/
device negatives, ring overwrite and DOS accounting pass. Interrupt word-register
and successive native checkpoint/batch/held-open-stdin regressions pass.
Whole/rollover/same-second observed/unobserved pairs match all **44,302,336 RAM
bytes by hash and all 59 exported globals**. Whole calibration finishes at tick
37, 20,350,037 dispatches and count 241,463; rollover stores seven polls and the
same-second negative preserves its sentinel. The independent compressed-stream
audit decodes all **484,487 whole**, seven rollover and 243 negative complete
58-byte restore / 12-byte IRETD records. No full-RAM output is repeatedly dumped.
The exact source archive passes `flock /tmp/wine-build.lock bash tools/build.sh`;
Git-history-only checks use their logged standard source-archive fallback.
Node is v24.22.1 versus the predecessor's v24.18.1. All 95 runtime/support pins
match the tested snapshot; ToyVM source pins match the predecessor unchanged.

The route was **GTA.BAT → K.EXE → actual generated DINO.BAT → DEMO24.EXE**.
Each of three Enter taps followed inspection of its freshly retrieved PNG:
English flag selected, English / Press Any Key, then Startup / Run GTA selected
with Keyboard control. The batch contains exactly `demo24.exe\r\n`, SHA-256
`5980340dfa79147f5be7b713d35804b6e25d8ecd1084d6ab22e51929a6dbf0cc`.
Both actual compiler results are the accepted 346,132-byte ToyVM module
`7bfe7f97ff11b0bd1e91134828563dc5c0c96aab182f2d1e24b7cec01ca1cdf0`.
Default 550,000 dispatches/tick, tickScale1 and irqScheduletrue are recorded for
both sessions. No later input was sent and there was no second original attempt.

The OS child was actually waited with **exit0 after 120.272640 seconds**, inside
the independent 130-second cap. No host deadline signal, disk or log termination
occurred. K exited0 after 622,692,735 dispatches, 1,132 ticks / 62.184815 guest
seconds and 64.604825 session wall seconds, including checkpoint reviews.
DEMO24 remained unexited after **20,313,713 dispatches**, 9,941,584 handbacks,
**36 ticks / 2.028616 guest seconds**, and **54.800403 session wall seconds**.
Final CS:IP is `0070:4335` inside the DOS bridge, not a captured fatal exception.
Its default exitCode0 is not a guest exit. Session setup and compiler time belong
to the shared outer budget. These instrumented timings are not throughput/FPS
qualification. Original-run free space stayed at least 57,068,957,696 bytes.

All 28 fault-entry callbacks now retain absent-PTE CR2 walks; all 56 legacy
task-gate/backlink events remain. All 28 trampoline IRETD pairs match their
complete frames and expected stack advance. The ring retains 36 complete sparse
DOS-bridge restore/IRETD pairs; 17 directly capture high return EIP **1019667F**,
five `1019666F`, and one `10196665`. Earlier bridge samples belong to other
startup callers. Every retained restore tail matches its IRETD12 and completed
return. Actual CS slots can contain a nonzero high word; the loaded selector is
their low16. Stack advancement uses each pair's actual stack-width mask; an
initial offline audit's blanket 16-bit assumption was corrected, without another
guest run. At the latest calibration sample (tick36 / dispatch19,800,613), the
full return is `02E0:1019667F`, saved ESI=8,395, saved EBX=1, EDX=353 and ECX=0:
BL and DH are both 1, consistent with the original seconds-comparison wait.
The calibration RET/stored result was **not observed**. Tick37 fixture behavior
does not fill that missing original evidence or prove the final bridge is stuck.

The unchanged archive and full 117-file / 17,078,619-byte media closure match
before/after. All recorded remote helpers/groups are absent with actual waits;
96 retrieved evidence files match their hashes. This task explicitly owned the
temporary box shutdown: stop operation completed and state **stopped** at
**2026-11-02T04:34:33.615Z**, after retrieval. Coordinator-owned boxes were untouched.
Next work is static review of this retained pre-return state before any separately
authorized original continuation; this assignment stops at its one-attempt limit.

## Post-calibration original assignment: disk abort before launch, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-original-post-calibration/`.
**Zero original executables ran.** The authorized single original attempt did
not start: the required disk guard aborted prerequisite validation below
2,020,000,000 free bytes. There is no new startup, calibration-return, menu,
player-control, FPS or audio evidence. The accepted `3b3ae84c` calibration
fixture remains a fixture, not original gameplay.

MDK presentation `47d4a082` then rectangle `b50eb7b0` terminal/result/final
and exact AUTHOR RELEASE were consumed before claiming this note, scratch
directory and serialized execution. All 364 recorded predecessor helpers were
independently absent. Earlier activity was static only. The original archive
hash and full 117-file / 17,078,619-byte media closure matched existing pins.
All 95 other accepted source/support pins matched; the main Wine wasm changed
through the published GL work, and is not the module loaded by ToyVM. All 96
pins against the newly recorded input still match after the interrupted work.

Scratch copies extend the retained ring's stack capture to 58 bytes and compose
the legacy task wrapper with the current installed ring wrapper. The actual
task-gate/NT-return composition fixture passes with its fault callback retained
and all RAM/exported-global parity. Ordinary IRETD, stack-page-fault/task
delivery, mapped instruction, read-only snapshot negatives, ring overwrite,
and actual DOS COM accounting fixtures pass. These are synthetic fixtures.

The unobserved authentic-instruction calibration arm finished at tick 37,
20,350,037 dispatches and count 241,463, with unchanged default clock and the
accepted ToyVM module `7bfe7f97ff11b0bd1e91134828563dc5c0c96aab182f2d1e24b7cec01ca1cdf0`.
The observed arm and a locked project build then ran concurrently. Their disk
guards recorded minima of **1,997,266,944** and **1,997,656,064** bytes,
respectively, and terminated both process groups with SIGTERM. Both direct
children were actually waited with status -15. The build was interrupted
during its early gates; it did not report a source/compiler defect or pass.
Observed whole-loop parity, complete-frame audit, rollover and same-second
validation did **not** finish. Partial compressed frames are retained as
incomplete evidence and must not be described as accepted validation.

Free disk recovered after termination, but the abort was latched in `STOP`;
there was no retry, original launch or foreign-artifact cleanup. No
`ORIGINAL-STARTED` marker exists. The prepared 120-second shared-wall /
130-second OS-cap original driver was never invoked. No per-original ticks,
calibration result, causal guest fault/wait or fresh image exists for this task.
No ordinary menu/player input was sent. No ToyVM source, guest byte, clock,
optimization, GL source or generated bundle changed in this assignment.

Next action requires resource headroom and renewed serialized ownership:
finish validation of the prepared observer and all complete 58-byte restore /
12-byte IRETD frames before any original. The original result remains unknown;
the single-attempt assignment stopped at its explicit resource boundary.
Actual waits, direct PID/group absence and strict-SSH docs-only publication are
retained. A transient build descendant zombie was absent on the later direct
check. Own board watchers are actually stopped and waited before final release.
Box ID/state/expiry N/A; coordinator lifecycle unchanged. No browser, download,
alternate executable, worker or public deployment occurred.

## Original calibration instruction fixture: clock contract passes, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-calibration-clock-fixture/`; durable test:
`node --expose-gc test/test-toyvm-gta1-calibration-clock.js`.
**This is a fixture, not an original game run or gameplay evidence.** No ToyVM,
guest media, generated bundle, clock rate, or optimization changed. MDK WebGL
`71fb8fb279` then readpixels `6e0fdcd3d` terminal/result/final and exact AUTHOR
RELEASE were consumed before claiming tests/build/runtime; all 461 recorded
helpers were independently absent. Earlier work was static research only.

The embedded MZ at `38D64` names LE `3B80C`. Its page map (index 275) derives
file offset 1,830,849 for the authentic **50 bytes at `1019665D..1019668E`**.
The preceding byte is RET, not the function entry. The one internal fixup at
`10196686` targets object 2 + `002CD6B8`, giving the actual result address
`104786B8`. `static-original.json` retains source/relocated hex and the unchanged
DEMO24 SHA-256. The test embeds these relocated bytes and needs no game media.

The [Microsoft MS-DOS Encyclopedia, Function 2Ch](https://www.pcjs.org/documents/books/mspl13/msdos/encyclopedia/section5/)
specifies binary hours/minutes/seconds/hundredths, with hardware-dependent
hundredths accuracy. The original code waits for DH to change once, then counts
queries through the next change, including the terminating query. Equality
comparison also permits seconds 59→0. ToyVM currently computes AH=2Ch from
`ticks * 55 ms`; its separately reported PIT guest seconds use
`65536 / 1193182`. The fixture checks these actual representations separately.

The representative setup executes paged 32-bit code at the original high EIP,
a high linear SS base with SS.B=1, an actual 32-bit INT 21h gate into a 16-bit
handler, a nested PUSHF/far CALL into the existing host DOS service, and the
**original 14-byte `0088:06FD..070A` restore/IRETD tail**. The intervening bridge
scaffolding is synthetic; this does not execute the whole original DOS/4GW
bridge or its setup. IF is initially clear; this isolates the software-interrupt
clock contract from timer IRQ handlers. A separate real task-gate/page-fault
fixture exercises fault delivery and NT backlink return.

At unchanged defaults (550,000 dispatches/tick, tickScale 1, scheduled clock),
both whole-function arms start at tick 0 and finish at **tick 37**, with exactly
**20,350,037 dispatches**, **241,463 stored polls**, and preserved EBX/ECX/EDX/ESI.
The return pops the full high EIP and restores the expected stack. The first
seconds transition occurs at tick 19; the counted interval ends at tick 37.
These are 2.03224354 reported PIT guest seconds, versus DOS time 00:00:02.03.
This demonstrates finite calibration under the current clock, not a stall or
an architectural defect. Fixture wall times are not original-game throughput.

The observed whole arm retains **all 484,487 complete interrupt returns** as
92-byte records: dispatch/tick/return metadata, full 58-byte restore frame,
6-byte nested DOS frame, and 12-byte IRETD frame. Every call is checked during
execution and independently decoded from the compressed stream afterward.
In particular, the restore frame contains full EIP at +46, CS at +50 and EFLAGS
at +54; the prior original's 48-byte capture could not contain that full EIP.
The original `1019667F` high-word inference therefore remains an inference;
the fixture does not retroactively fill missing original evidence.

An explicitly initialized checkpoint crosses seconds 59→0 at tick 1091 in
300 normally billed dispatches, stores 7 polls, and restores its registers.
A 10,000-dispatch same-second negative leaves the result sentinel unchanged;
its last call is explicitly recorded as in flight. Both cases retain clock
defaults. All three observed/unobserved pairs match SHA-256 over all
44,302,336 VM memory bytes and all 59 exported `mget_` globals. Missing-page and
device snapshots also preserve that state.

The retained prior `ring.cjs` was tested in the **actual installation order**:
save the legacy task target, install ring, then assign the task wrapper. Calling
the pre-ring saved target reproduces **zero ring fault callbacks**, while both
legacy task events and two IRETD attempts still execute. Capturing the current
wrapped target instead retains the fault-entry callback, absent CR2 page walk,
and both task events; after the fault handler maps the page, IRETD completes.
All RAM/globals match unobserved execution in both configurations. The missing
old callback is thus caused by wrapper replacement, without a ToyVM change.

Focused fixture, retained-ring composition, interrupt word-register regression,
independent frame audit and mandatory locked build pass. An initial build gate
caught a synthetic task-code address coinciding with the main emulator's pinned
region base; the fixture uses a different guest address and was revalidated.
Initial static entry/tail-bound mistakes and evidence naming corrections are
retained separately; they are not guest failures. No emulator fix is warranted.

Next bounded gameplay action requires a **separate original-run authorization**:
one authentic GTA.BAT→K→actual DINO→DEMO24 attempt at unchanged clock defaults,
with a proposed 120-second shared budget/130-second OS cap, complete restore
frames and correctly composed task observations. Record per-executable ticks
and stop at the first post-calibration/menu checkpoint or cap. Reaching tick 37
is a measured checkpoint, not a promise derived from fixture speed. Inspect the
fresh image before any menu input; if a player scene appears, perform one brief
walking/driving input with before/after captures. This task ran no original,
browser, download, workers or deployment. Box ID/state/expiry N/A; coordinator
lifecycle unchanged.

## One bounded diagnostic: paging advances, then DOS-second calibration wait, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-bounded-startup-diagnostic/`. Exactly
**one diagnostic original**, unchanged ToyVM/guest bytes; no emulator fix or
optimization. Input source is the 96 accepted pins from `beb78a56`; current
main also includes later documentation. Drawable `181f4295`, GTA startup
`beb78a56` and accumulation `df747405` terminal/result/final and exact AUTHOR
RELEASE were checked before taking runtime FIRST; all 134 recorded helpers
were independently absent. No GL files were edited.

The ignored `ring.cjs` adds host-only bounded observations: 128 sparse progress
records, 64 stack records, 64 actual IRETD pairs, per-executable wall/guest
accounting, and ordinary-RAM CR2 walks. It reads no guest paging APIs and writes
no guest state. Before GTA, real-instruction fixtures compare all guest RAM
and every exported `mget_` global against unobserved execution for ordinary
IRETD, an IRETD stack page fault/task delivery, and a mapped task instruction.
Snapshot absent-page/device negatives, ring overwrite and actual DOS COM
session accounting pass. Initial fixture address/cache-setup mistakes were
corrected and their failed logs retained. The final observer and locked project
build pass before the original; no shipping source/test/bundle changed.

Actual route: GTA.BAT → K.EXE → its actual generated DINO.BAT (`demo24.exe`)
→ DEMO24.EXE. Each of the three Enter inputs followed visual inspection of
its fresh language/confirmation/Run GTA PNG. The child was actually waited:
exit **0 after 85.22195 seconds**, inside the independent 90-second cap;
no host/disk/log termination. The shared 85-second budget includes review
pauses. K's session used 56.07456 wall seconds / 62.18482 guest seconds and
622,692,735 dispatches, exiting 0. DEMO24 used 28.38276 wall seconds /
**1.193689 guest seconds**, 11,953,102 dispatches / 5,359,678 handbacks,
ending at `0088:06F5` on wall-clock expiry. Session wall time starts after
module creation; compiler/module preparation is included in the outer budget.
These are diagnostic timings, not an uninstrumented throughput comparison.

All **28 actual `3D98:8190` IRETDs** have captured `66 CF` instruction bytes,
complete 12-byte return frames and before/after states. Every completed return
matches its frame's CS/EIP/EFLAGS, original interrupted CS/EIP, unchanged SS
and expected SP+12. Each CR2 target walk is present before and after IRETD;
28 distinct pages and 26 fault sites are serviced. The independent legacy
observer retains all 56 task-gate/backlink-return events. **Limitation:** its
later wrapper assignment superseded the ring's task-entry wrapper, leaving
that separate fault ring empty. Thus independent CR2 target walks *at fault
entry* are missing; successful standalone fixtures did not test this wrapper
composition. Error words and task states remain, but they cannot substitute
for those missing walks. No second original was used to repair this capture.

The stack observer counts 9,428 visits to `0080:0DE5/0DF2`; first and sparse
later samples retain return IP `0F2B` and argument words `0008,7D98,00A8`.
The `0088:0BE4` original bytes are a callback-chain dispatcher, so `0008`
is not by itself a DOS AH service number. Twenty-one unique original-byte
anchors establish its file bias `02C854`. Sparse samples traverse 79 distinct
DEMO24 CS:EIP sites, including completed callback/interrupt bridges, after
paging progresses into application code.

The final `0088:06F5` bridge restore frame provides stronger evidence:
interrupt `21h`, saved EAX=`00002C01`, ECX=0, EDX=`0000010F`, EBX=1 and
ESI=`544` (1,348). DOS AH=2Ch returns time; 21 recorded ticks × 55 ms =
1,155 ms, exactly seconds=1 / hundredths=15. The captured low 16 bits of the
return EIP are `667F`. Of the original LE code-object candidates with that
low word, only `1019667F` follows `INT 21h`; its original sequence is
`MOV AH,2C; INT 21h; INC ESI; CMP BL,DH; JE` back to the query. The preceding
loop first waits for the seconds value to change, then counts polls through
another second and stores the count. **The high return-EIP word was outside
the 48-byte capture: `1019667F` is a unique static inference, not a fully
captured address.** Saved BL=DH=1 and ESI=1,348 agree with that calibration
wait. This distinguishes observed initial page-loading progress from the
later guest time wait; it demonstrates no architectural transfer fault.

The current clock reaches DOS second 2 at tick 37, corresponding to
20,350,000 dispatches with these defaults; this run ended at tick 21.
Next demonstrated action is a real-instruction fixture of this original
calibration loop and DOS-time/dispatch-clock contract through the seconds
transition, including observer-wrapper composition and complete interrupt
frames. Do that before proposing any emulator change or separately authorized
original experiment; neither larger budgets nor clock acceleration are
qualified here. The reviewed final PNG is DOS/4GW text only: no startup
completion or gameplay claim. The exact 117-file / 17,078,619-byte closure,
archive and all 96 accepted pins match before/after; both actual module hashes
remain the accepted `7bfe7f97…ca1cdf0`. Helpers are actually waited and checked
absent before release. Disk abort remains 2,020,000,000 bytes, no RAM gate.
Box ID/state/expiry N/A; coordinator lifecycle unchanged.


## Static startup reconstruction after segment repair; no demonstrated next defect, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-startup-after-task-return/`. This is
**static analysis, with zero guest launches and no emulator changes**. The
five requested retained artifacts from `20261102-gta1-segment-cache-transitions`
were analyzed before claiming shared access. The note/build claim followed
MDK2 drawable commit `181f4295f`, terminal exit 0, final/exact AUTHOR RELEASE,
and independent absence checks for all 92 recorded helpers.

`analyze.py` checks actual original bytes against the retained states;
`static-analysis.json` records input hashes and every task pair. The embedded
MZ at file `038D64` names LE header `03B80C`; its page-data start is `0AB964`.
The actual LE page map and internal fixups reproduce all twelve captured
single-page, nonempty 32-bit instruction windows using code/data object bases
`10083000`/`101AB000`. Another 87 segment-code anchors match, with the first
handler's relocated `PUSH 0090` → `PUSH 3DA8` recorded explicitly. Targeted
disassembly preserves original operands separately from relocated runtime bytes.
Fourteen empty fetch windows and one partial, cross-page fetch remain explicit
capture limitations; static file bytes do not prove an instruction executed.

At the first fault, `0080:3EBF` is `CMP byte ES:[BX+DI],AL`:
`ES.base=10184EA0`, BX=1 and DI=0 account exactly for CR2=`10184EA1`.
The enclosing original function compares a finite byte-signature table. Its
target is the application's Watcom runtime entry page. An independent walk
of that first fault's target page was not retained, so its complete original
PTE state is still unproven.

All 28 outgoing TSS saves agree with captured GPRs, CS/EIP, ESP, EFLAGS and
CR3. Original handler bytes explain the rewritten TSS: copy 104 bytes, clear
TF/IF/RF with `FFFEFCFF`, put CR2 in saved EBX, substitute
`SS:ESP=0280:0FFC` and `CS:EIP=3D98:809F`, restore busy descriptor types,
then execute NT IRET at `809B`. Each retained rewrite and completed return
agrees. The handler task's next saved EIP, `809C`, contains a jump back to
`7F6E`; its repeated entry is expected guest control flow. The `809F`
trampoline's static success path calls `61AA`, restores the interrupted
context, and prepares IRETD at `8190`. That final IRETD was not captured
individually for every pair.

The faults cover **28 distinct CR2 pages at 26 instruction sites**, with 21
zero and seven two error words. Two observations establish local progress:

- At `02E0:101850FF`, REP STOSD advances EDI from `101C12F0` to `101C2000`
  while ECX falls from `400` to `BC`: exactly `344` dwords / `D10` bytes.
- At `02E0:101A4145`, an absent code PTE first prevents fetch. The next fault
  there has a present code PTE and complete relocated instruction bytes;
  the instruction now faults on its data write at `101B67B0`.

The final 32-instruction window enters `0080:0DE5`, calls `B1AA`, traverses
its zero-argument counter branch, restores its frame and returns at `B210`.
Final AX=`43BC`, DX=`00A8` agree. Final `0080:0DF2` is `ADD SP,2` after that
return, not evidence of a stuck polling loop. The next static call is
`0088:0BE4`; final stack arguments and subsequent execution were not retained,
so assigning a specific requested DOS service or blaming its implementation
would be speculation.

The retained 85-second limit is shared across K, checkpoint pauses and
DEMO24; DEMO24's report records only 52.89 seconds, 19,085,948 dispatches and
8,927,401 handbacks. Paged execution deliberately decodes one reached
instruction per host step. These facts permit a budget/cost hypothesis; they
do not prove the remaining barrier is speed. The retained final PNG was
visually inspected again: DOS/4GW text only. Startup completion, gameplay and
the exact earlier `0070:42C5` PUSH causal identity remain unproven.

**No coherent architectural defect is demonstrated.** No ToyVM/test/bundle
edit or unchanged original retry was made. Fresh checks match the archive,
DEMO24, exact 117-file / 17,078,619-byte closure and all 96 accepted ToyVM
source/test/bundle pins. Prior full ToyVM regressions and executed bundle
parity are retained results on those unchanged pins, not newly run suites.
The static assertions and mandatory locked project build pass for this
note-only publication; this does not qualify a new GTA execution.

Next experiment requires a separate assignment explicitly permitting a
diagnostic-only authentic route with the same finite budgets and PNG review
before input. Capture per-executable wall/guest time, sparse CS:EIP progress
samples, bounded stack arguments at `0080:0DE5/0DF2`, target CR2 walks, and
before/after state around the trampoline's actual `3D98:8190` IRETD. Use a
fixed ring written at boundaries, independent of the exhausted segment-change
cap. Distinguish advancing startup, guest waiting and misexecution before
proposing a source fix or larger budget. This plan does not authorize another
run in the completed assignment. Helpers are actually waited and checked
absent before author release; disk abort remains 2,020,000,000 bytes with no
RAM gate. Box ID/state/expiry N/A; coordinator lifecycle ownership unchanged.


## Coherent segment-cache transitions; bounded original remains at startup, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-segment-cache-transitions/`. Code input
`0bc353ddaf7d4e4384d0bd05aa88a2341c477000`, followed by MDK2 documentation
`b92ab6980` and coordinator documentation `7a2a58a10`. Shared source/build/test/
runtime was claimed after MDK2 accumulation terminal/result/final, exact AUTHOR
RELEASE and independent absence checks for all 47 reported helpers. No MDK2/GL
or foreign WIP was edited.

All six ordinary segment caches now start with usable real-compatible metadata.
Explicit real data/stack paragraph loads retain usable hidden limits, access
rights and size attributes while replacing the base. They neither consult the
GDT nor invalidate a cache because PE is clear. A formerly unusable cache gets
real-compatible metadata on an explicit real load; changing PE/PG alone leaves
it unusable. Real CS transfers establish paragraph base, 64K limit and code
rights while preserving the cached default-size contract. SS.B remains
independent of CS.D: a real MOV SS no longer derives stack width from CS.
VM86 loads instead establish fixed 64K, 16-bit, DPL3 caches for all six segments,
including paragraph zero. VM86 no longer bypasses the existing task-installed
paged segment/fetch checks. CR0 mode changes continue to preserve cached state;
protected null and restricted caches cannot be laundered by a mode-bit change.

Architecture references: Intel [80386 PRM 10.3](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s10_03.htm),
[14.5](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s14_05.htm),
[15.1](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s15_01.htm),
[15.3](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s15_03.htm) and
[Intel SDM volume 3A](https://www.intel.com/content/dam/support/us/en/documents/processors/pentium4/sb/25366821.pdf)
3.4.3, 9.9 and 15.1–15.2. `design.txt` records the cache-model choices and scope.
This repairs load/transition state; it does **not** implement the emulator's
complete nonpaged protection contract or replace permissive direct protected
MOV validation. The real/unreal negative tests load restricted descriptors,
execute real-mode transitions and reloads, then exercise authoritative faults
on paged reentry. They are not full nonpaged-real exception-delivery tests.

The exact retained instruction sequence, after a real task gate and backlink
IRET, fails on saved old source at PUSH with TR=0058/#SS. It passes with the
repair, retains TR=0028, writes the expected dword and leaves ESP=0100.
Four dispatch variants execute all data-segment loads/reads, two independent
SS widths, real far CS reload, descriptor-table mutation after load, limited/
read-only/expand-down/null negatives, formerly-null real reload and actual
VM86 IRETD entry, stack/load behavior and an A32 offset beyond 64K. Fault cases
check saved restart EIP and no partial write. Full paging (including task-switch
commit/fault repair and uopOnly/uop/treeFold), foundation's 192 protection
combinations, read-only diagnostic/capture negatives, runner input, 36 actual
call-gate/RETF cases, timer and 11 CPU-detection cases pass. Both regenerated
live bundles execute the COM/task/cache/diagnostic tests and match all 45/44
embedded modules. Mandatory `flock /tmp/wine-build.lock bash tools/build.sh`
passes on the exact final code. An initial added-helper parenthesis error was
caught before runtime and corrected; its failed check remains in evidence.

Exactly **one changed-source authentic GTA.BAT → K.EXE → actual generated
DINO.BAT → DEMO24.EXE run** followed those checks. Each of three Enter inputs
followed visual review of its fresh language/confirmation/startup-menu PNG.
Archive/K/manifest identities and exact 117-file, 17,078,619-byte closure match
before/after. All 96 source/test/bundle pins match; both actual compiler results
are 346,132 bytes, SHA-256
`7bfe7f97ff11b0bd1e91134828563dc5c0c96aab182f2d1e24b7cec01ca1cdf0`.
Read-only observers retain loaded module hashes, task/TSS/page-walk state and
segment state without changing guest results.

The OS child finished naturally with **wait 0 after 85.1326 seconds**, below the
independent 90-second cap; no host/disk/log termination occurred. The shared
85-second runner budget expired: K exited 0 after 622,692,735 dispatches;
DEMO24 remained unexited after 19,085,948 dispatches, final `0080:0DF2`.
There were 28 completed interrupt-task-gate/backlink-IRET pairs, including the
previous #PF at `0080:3EBF`, CR2 `10184EA1`, and later page faults. There was
no fatal #SS/#DF shutdown in this bounded run. The exact earlier `0070:42C5`
PUSH was not observed, so its causal identity remains **unproven**. The segment
context-change capture reached its 256-event cap before the task gates; full
task events and the final 32 paged instruction states are retained separately.
No fault JSON/PNG was produced because no fatal exception occurred.

The final `after.png` was visually inspected: DOS/4GW copyright text only,
**no gameplay**. SHA-256:
`95331a6e4b3bf33bac6b10a39dddb4e9d680a8b986d2263cbc83d27d5a758758`.
Next work is static analysis of the retained later startup/task/page-fault and
polling state before a separately authorized bounded continuation. The wall
clock boundary is observed; the cause of remaining startup work is not proved.
No unchanged retry or second original was attempted. Own helpers are actually
waited and independently checked absent before exact author release. Evidence
retains disk minima with unchanged 2,020,000,000-byte abort threshold, above the
2 GB floor; no RAM gate. Box ID/state/expiry N/A; coordinator shutdown ownership
is unchanged. This single assignment stops after publication and release.

## Commit-aware 386 task gate and backlink return; later cache blocker, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-commit-aware-task-switch/`. Input
`eb21f6b73c2762b00533d5e94d49f6694264fa8f`; shared source/build/test/runtime
was claimed only after MDK2 integer-color author release, terminal result/final
and independent absence checks for all 68 helpers. No MDK2/GL files were edited.

Paged execution now implements **386 IDT interrupt/exception task gates and
protected NT IRET**. This is a complete transfer for these routes, including
outgoing dynamic TSS save, incoming TR/CR3/LDTR/GPR/EFLAGS and all six hidden
segment caches, descriptor accessed/busy writes, backlink, NT, CR0.TS and
32-bit exception error-word delivery. NT IRET uses the backlink regardless of
operand width, releases the outgoing busy bit and clears its saved NT. Static
TSS CR3/LDTR fields are preserved on save. CLTS now clears TS; paged x87/WAIT
access observes #NM rather than silently executing through task-switched state.
Incoming 386 EFLAGS reserved bits are normalized. Direct far CALL/JMP task
switches, 286 task switches and nonpaged task switches remain explicitly
unsupported. This is not a claim that every 386 task-switch route is implemented.

The architectural boundary is explicit: target checks, complete TSS-image
staging and outgoing writes are restartable in the old context. Publication
of incoming registers/TR/CR3 establishes a new checkpoint. Subsequent LDTR,
segment, accessed-bit, instruction-limit and error-stack faults belong to the
incoming EIP and cannot undo the outgoing save, busy/backlink or CR3 transition.
Each completed cache load is preserved before the next faultable reference;
unloaded caches do not inherit outgoing metadata. Normal paged data/stack
accesses and instruction fetch enforce these authoritative caches after a task
switch. Fault repair uses a real nested task and IRET to reload the interrupted
TSS; it never resumes a partially executed host transfer. Diagnostic reads retain
actual TSS bytes and PDE/PTE walks without changing guest paging state.

Design follows primary Intel [80386 PRM 7.1](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s07_01.htm),
[7.5](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s07_05.htm),
[7.6](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s07_06.htm),
[7.7](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s07_07.htm),
[9.8](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s09_08.htm),
[CLTS](https://www.scs.stanford.edu/05au-cs240c/lab/i386/CLTS.htm)
and Intel SDM volume 3A 7.3–7.5. The retained design records differences between
the old PRM summary table and its detailed exception descriptions; incoming
invalid segments use #TS, with #NP/#SS for the relevant absence checks.

Validation executes real LTR/INT/IRET, two independently mapped CR3 spaces and
both directions of return. Saved old paging-exec rejects the boot-to-DOS-exit
COM at the task gate; new code exits normally and reads the distinct mappings.
Four dispatch variants cover outgoing save rollback (including a split-page
partial write), incoming split-TSS page failure, incoming-address-space page
fault and segment-fault repair, committed IRET faults, descriptor/gate/busy/
presence/limit/privilege negatives, incoming cached-segment access faults and
error-word success/failure. Software INT does not invent an error word. Both
IRET operand widths and uopOnly/uop/treeFold execute real transfer COMs. Guest
#NM → CLTS → IRET retries the actual incoming x87 instruction; WAIT/EM/MP/TS
and CPL3 CLTS negatives are included. Full paging/foundation/diagnostic/input/
call-gate/timer/CPU-detection regressions and mandatory locked build pass. Both
regenerated live bundles actually execute the suite and match their 45/44
embedded modules. No browser was used.

Exactly **one authentic GTA.BAT → K.EXE → generated DINO.BAT → DEMO24.EXE run**
was made, after the initial complete checks/build passed. Original archive,
K.EXE and all 117 files (17,078,619 bytes) match before/after. Each of the three
Enter inputs followed visual inspection of its new checkpoint PNG. The shared
3-billion-dispatch/85-second budget and independent 90-second host cap were
retained. The child exited naturally with status 1; actual wait was 48.038 seconds,
with no host deadline, disk or log termination. The final fault PNG was visually
inspected: DOS/4GW copyright text only, **no gameplay**.

Actual task evidence (`task-events.json`) now proves the diagnosed gate was
crossed: #PF at `0080:3EBF`, CR2 `10184EA1`, TR `0208`, TSS `158000`, switched
to TR `0218`, TSS `159000`, `3D98:7F6E`, SS `0280`, ESP `0FF8` after its
zero error word. Backlink is `0208`; outgoing state is saved and incoming
NT/TS are set. The guest handler consumed the error and rewrote the old TSS,
including return CS/EIP `3D98:809F` and SS/ESP `0280:0FFC`. Its real NT IRET
at `3D98:809B` completed, returning TR `0208`, clearing NT and releasing
`0218` busy. The host did not skip the original fault or manufacture this
redirect. Both tasks used CR3 `160000`; two-address-space coverage comes from
the instruction regressions, not an invented GTA CR3 change. Original #PF
causation remains **unproven**.

The later stop is #SS(0) at `0070:42C5` (PUSH), SS `0110`, SP `0104`, CR0
`80000011`. Its #SS and #DF IDT entries are invalid type zero, ending in
386 shutdown. A separate real-instruction probe (`transition-blocker.json`)
reproduces the architectural dependency after a successful task return:
disable PG/PE, load SS in real mode, re-enable PE/PG without reloading SS,
then PUSH. Existing `pm_cache_ss` invalidates the hidden cache during the
real-mode load; reentry leaves it invalid, so the new authoritative access
check raises #SS. That cache-transition defect is tested; its precise causal
identity with the authentic late #SS has not been independently captured.
**Next work is coherent real/protected segment-cache transitions**, followed
by a separately authorized authentic run. No second run was attempted here.
The authentic source pins and loaded module hashes are retained; afterward a
small incoming-EFLAGS reserved-bit correction was validated by the full suite,
both bundles and locked build, without replaying GTA.

One initial full-suite process hit the 2,020,000,000-byte abort threshold at
2,014,588,928 free bytes, above the unchanged 2 GB floor. It was terminated,
actually waited and checked absent. Space recovered after exit; explicit GC
between completed VM fixtures allowed the same assertions and disk guard to
pass. No RAM gate was used. Initial fixture/census failures and their repairs
remain in evidence. One final runner-input repeat expired its existing 150 ms
sequence deadline before the second callback; an unchanged repeat passed, and
both logs are retained. Source/build/test/runtime helpers are actually waited and
checked absent before author release. Box ID/state/expiry N/A; lifecycle and
shutdown remain coordinator-owned. This assignment stops at the new tested
cache-transition dependency.

## Tested task-register prerequisite; full switch still required, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-386-task-switch/`. Input paging repair
`3aa3341292467482795f23da0c0a052ec186470f` and diagnostic
`09fc2dacdf2b1095f00e08ddbf8612d2192a915c`. Serialized source/build/runtime
was claimed after the previous author release. This assignment implements a
**prerequisite, not interrupt task switching**. There were **zero GTA launches**,
no new gameplay capture and no fault bypass. The retained diagnostic PNG was
visually inspected again: DOS/4GW copyright text only. Actual incoming/outgoing
GTA TSS contents and their address-space walks remain uncaptured.

Two concrete initialization defects were found while checking the switch's
starting state:

- Guest LTR previously only assigned TR and cached its descriptor. It left the
  descriptor available (`89h`), consistent with the retained outgoing TR state.
  LTR now validates selector/GDT bounds, available system TSS type and presence,
  writes the busy bit and publishes the hidden TR cache after that write. Both
  286 and 386 available TSS types work; busy, wrong-type, local, null, out-of-table
  and absent selections fail without replacing the prior TR. Descriptor type
  precedes presence, and instruction privilege/mode checks precede a memory
  operand read. Paged faults use the existing architectural delivery path;
  nonpaged rejections retain explicit protected-transfer stops. General operand
  segment-limit enforcement remains the existing memory-access contract.
- Native `runDos` and `LiveRun` both initialized FLAGS with the 8086 reserved
  `F002h` mask even after configuring a 386. This set 386 NT as well as IOPL
  and reserved bit 15. They now use the configured CPU's reserved-bit mask with
  IF set: actual PUSHF observes `0202h` on a 386, while 8086/186 retain `F202h`.
  This correction does not prove that the original GTA #PF was caused by NT.

Intel's primary [80386 LTR specification](https://www.scs.stanford.edu/05au-cs240c/lab/i386/LTR.htm)
requires the busy update without a task switch. The new tests also protect the
distinction between initialization and switching: LTR neither reads/writes the
TSS nor changes CR3, flags or CR0.TS. An unmapped TSS and even a zero limit may
be loaded by LTR; the minimum TSS limit is a **task-switch** check. Descriptor
DPL and selector RPL do not restrict CPL0 LTR.

Protected NT IRET previously followed an ordinary stack return. It now stops
explicitly before consuming a frame: a paged unsupported-nested-task error,
or the existing nonpaged `unsupportedSystem` stop. Both 16- and 32-bit operands
preserve EIP, ESP, flags, TR/cache and stack bytes. Ordinary and VM86 returns
keep their existing paths. This preserves an honest unsupported boundary;
it does not implement the backlink return required by
[Intel's IRET specification](https://www.scs.stanford.edu/05au-cs240c/lab/i386/IRET.htm).

The precise remaining implementation dependency is the task-switch **commit and
fault context protocol**, plus incoming task validation/loading. The retained
synthetic `commit-probe.json` executes real paging accessors with two page
directories: linear `10000000h` reads `11112222h` through CR3 `20000h` and
`33334444h` through CR3 `23000h`. After staging a new TR/CR3/EIP and an outgoing
save, a forced page fault restores the old TR/CR3/EIP and undoes that save under
the existing instruction checkpoint. Establishing an explicit new checkpoint
preserves the incoming state and save instead. This is a **primitive probe**,
not a task-switch instruction test or original-game page walk.

As required by [Intel 80386 PRM §7.5](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s07_05.htm)
and [§9.8.14.1](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s09_08.htm), a future
switch must distinguish outgoing-context validation/save failures from incoming
TSS/segment-load failures. Both `step` and `exception` currently assume one
restart context. Adding register assignments to `deliver` alone would let the
generic rollback restore the wrong task, or let exception escalation retain the
outgoing return IP. A complete change must define the commit boundary, perform
the outgoing save and busy/backlink/NT/TS bookkeeping, load/validate incoming
CR3, LDTR and all segment caches, deliver the error word in the new task, and
implement the reverse nested IRET with tests of faults on both sides. The
task-gate entry remains explicitly unsupported. No partial switch was shipped.

Validation: saved old source fails actual LTR's busy assertion (`89h` versus
`8Bh`) and the entry PUSHF assertion (`F202h` versus `0202h`); corrected source
passes seven LTR COM executions across four dispatch variants and uopOnly,
uop and treeFold. Four variants each pass 35 focused initialization/negative/
nested-return cases, plus native and LiveRun entry PUSHF on three CPU models.
Synthetic paging fixtures now explicitly configure the VM's 386 flag mask,
in addition to the decoder level; all prior paging-copy assertions remain.
Full paging, foundation, diagnostic failure capture/negatives, runner input,
CALL gates/RETF, protected timer-vector and CPU detection pass. Both regenerated
live bundles execute the LTR, paging and entry-flag programs, pass negatives,
and match all 44/43 embedded source modules; the browser-shaped Node smoke test
passes. LiveRun initialization is also executed from the main bundle; it is
intentionally absent from the separate JIT worker bundle. Mandatory locked full
build passes. No browser session was used.

The evidence retains initial failed fixture/guard checks and their corrections,
old/new source comparisons, command waits, disk samples and the exact remaining
dependency. The new COM fixture restores real-mode SS before DOS exit; the
initial stop guard's boolean-mask error was caught and repaired. Monitored
commands enforce abort at 2,020,000,000 free bytes, above the unchanged 2 GB
floor, with no RAM gate. Helpers are actually waited and checked absent at
handoff. Box ID/state/expiry N/A; coordinator shutdown ownership is unchanged.
Next: implement and validate the full commit-aware switch before any new
authentic GTA run. All assigned source/build/runtime ownership is released
after publication; this single assignment stops here.


## Paged COM regression repaired: fixture return path, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-paging-com-regression/`. Input diagnostic
code `09fc2dacdf2b1095f00e08ddbf8612d2192a915c` / final
`63db955841b17f46cf8da77e3215a24a05191a42`. Work began after MDK2
`dd93bf341a7a40c8d8ef2676c92696b025b5bd59` terminal result/final and exact
00:07:11 author RELEASE; all eleven reported helper PIDs were independently
absent. Only the paging test and this note changed.

The failure was an invalid **test fixture return to DOS**, not a wrong copy
expectation or an observed paging-store error. The COM loader copies bytes to
physical 10100 without relocation. Retained actual COM disassembly and the
instruction-boundary memory trace establish:

- REP MOVSD copies 16 KiB from linear 40000 through 10000000..10003FFF to
  physical pages 30000, 50000, 60000 and 70000. Physical 500B0 initially has
  the correct 76543210.
- The scalar store at CS:EIP 0008:023B writes 12345678 across linear
  10000FFE: physical 30FFE..30FFF receive 78 56 and 50000..50001 receive
  34 12. The guest repair handler reinstalls PTE 14004 = 50007.
- After CR3 = 16000, PTE 15000 = 60007 makes the load at 0008:0290 read
  physical 60000. The following store at 0295 records **76543210** at 71008.
- PTE 15008 = 10007 maps the alias store at linear 10002501 to physical
  10501, patching the called MOV immediate to 01020304. Later guest stores
  at 02BD and 02C7 write 44B89090 at physical 60FFC and C3112233 at
  physical **50000**, respectively. With CS.base = 10000, call offset
  0FFF0FFE fetches linear 10000FFE through physical 60FFE/50000 and returns
  EAX = 11223344. Physical **500B0 is not the intended patch address**.

The old fixture then cleared PG and PE while retaining the 32-bit CS cache,
far-jumped to 1000:0800, and supplied `B8 00 4C CD 21`, intended as
`MOV AX,4C00; INT21`. With CS.D still set these bytes instead form
`MOV EAX,21CD4C00`. It ran through unrelated bytes, including an unhandled
INT0/IRET path and CS 0046, before finding an accidental DOS exit. The retained
trace places **both** extra writes after paging is off: 71008 changes from
76543210 to 76543211, then 500B0 changes from 76543210 to C3112233. Thus the
old `exited=true/code=0` was insufficient to establish the intended exit path.
`old-trace-events.json`, `old-final-memory.bin`, `old-watch-sites.json` and
`baseline.log` retain that behavior; corrected trace/memory are separate.

The repair follows the real-mode transition sequence in Intel's
[80386 PRM §14.5](https://www.scs.stanford.edu/05au-cs240c/lab/i386/s14_05.htm):
leave paging from identity-mapped code, clear CR3, enter a 16-bit protected
code segment and load real-compatible 64K data/stack descriptors before clearing
PE and far-jumping to the 16-bit DOS exit. Restore the real IVT and segment
registers. The test now requires CS.D = 0, CR0 = 10, CR3 = 0 and the exact
1000:0817 return IP immediately following its intended INT21. No emulator
behavior or browser bundle was changed.

All original copy assertions, including 500B0 and 71008, remain unchanged.
Additional assertions protect all 4096 source dwords and every previously
unchecked intentional overwrite: 30FFC = 56783210, 50000 = C3112233,
60FFC = 44B89090, 10501 = 01020304, plus the existing 60000 = 98765432
user-write result. This repairs execution rather than excusing corrupt bytes.
The original complete suite fails before the change; the corrected suite
passes all four dispatch variants and the uopOnly/uop/treeFold options, with
8440 dispatches per paged COM. Paging itself still uses its existing checked
instruction path; these options do not imply new paged tier support.

Paging foundation (three dispatch variants / 192 protection cases), retained
exception diagnostic negatives and real failing-COM JSON/PNG capture, complete
runner input regression, 36 CALL-gate/RETF cases and protected timer-vector
regression all pass. Both unchanged live bundles execute the corrected COM and
pass diagnostic negatives, with exact parity for all 44/43 embedded modules;
the browser-shaped bundle smoke test also passes. Mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Per-command disk
monitoring enforces abort 2,020,000,000 bytes / floor 2 GB without a RAM gate;
actual waits and cleanup are retained in the evidence directory.

No original GTA replay, task-switch implementation, fault suppression or
partial-success claim. This fixture failure does **not** establish a cause for
GTA's original #PF at 0080:3EBF / CR2 10184EA1. The next task-switch prerequisite
remains the complete architectural contract described below, including actual
incoming-TSS and page-walk validation, outgoing busy bookkeeping, precise
pre/post-commit faults, backlink/NT/TS, error push and nested-task IRET.
Box ID/state/expiry N/A; shutdown remains coordinator-owned. No helpers remain
at handoff; all assigned paths and serialized source/build/test/runtime are
released after publication.

## DEMO24 first paged exception: retained state, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-task-gate-state/`. This follows published
`4f805136102a54c2cd09aa0b24fb651a46b49438` and its author release. The retained
reported helper PIDs were independently absent before source/runtime work.

The new diagnostic API attaches `pagingException.chain` to fatal exception-delivery
errors. Each attempted vector retains its input error/return IP, software/external
origin, CS:IP/SS:ESP, CR0/CR2/CR3, IDTR/GDTR, cached TR, raw gate/target/current-task
descriptors and instruction bytes, followed by the delivery failure. Inspection
walks ordinary backed RAM without calling architectural paging accessors: no
CR2/error changes, A/D writes, rollback, or device reads. Missing/device-backed
bytes are explicitly unavailable; captured descriptor bytes are not a validity
verdict. Native `--fault-json=PATH --fault-png=PATH` writes failure evidence before
rethrowing; `--trace-fault` also prints the structured chain. A PNG from this path
is the failure surface, not a successful runner report.

**One** changed-diagnostic original session ran authentic `GTA.BAT -> K.EXE ->
actual generated DINO.BAT -> DEMO24.EXE`, with the unchanged 3-billion dispatch
budget, shared 85-second runner deadline and independent 90-second OS cap.
The three live captures showed flags/English selected, English/Press Any Key,
and Startup/Run GTA selected/Keyboard; each received one Enter. K.EXE exited 0.
Generated DINO retained exactly `demo24.exe\r\n`, 12 bytes, SHA-256
`5980340dfa79147f5be7b713d35804b6e25d8ecd1084d6ab22e51929a6dbf0cc`.
DEMO24 was opened twice by its ordinary loader. No bypass or original retry.

`fault.json` establishes **one delivery attempt**, not a nested #GP/#DF chain:

| State | Actual value (hex) |
| --- | --- |
| Vector / error / origin | #PF 0E / 00000000 / processor fault, neither software nor external |
| CS:EIP / SS:ESP | 0080:00003EBF / 00C0:00001F38 |
| CR0 / CR2 / CR3 | 80000011 / **10184EA1** / 00160000 |
| IDTR base / limit | 000011C0 / 07FF |
| GDTR base / limit | 00110010 / 3FFF |
| TR selector / cached base / limit / access | 0208 / 00158000 / 006F / 89; cache valid |
| IDT[14] linear = physical | 00001230 |
| IDT[14] raw bytes | `6D 43 18 02 00 85 00 00` |
| Selected descriptor, GDT[0218], linear = physical | 00110228 |
| Target descriptor raw bytes | `6F 00 00 90 15 89 00 00` |
| Current TR descriptor, linear = physical | 00110218 |
| Current TR descriptor raw bytes | `6F 00 00 80 15 89 00 00` |
| Faulting instruction linear = physical | 0013CAFF |
| Instruction bytes | `26 38 01 74 07 C7 46 FA 00 00 EB 02 46 46 8B 5E` |

Error 0 reports a supervisor read of a non-present page. The IDT entry lies
inside the IDTR limit and is a present system task gate (type 5), DPL 0. Its
selector 0218 chooses the GDT, is non-null and in bounds. The target descriptor
is a present available 386 TSS (access 89), base 00159000, byte limit 006F,
which exceeds the 103-byte minimum. The outgoing descriptor is also recorded as
available (89), matching the current cached access; this is evidence to audit,
not a claim of correct busy-state bookkeeping. The incoming TSS contents,
segment state and complete task-switch validity were **not** captured/validated.
The unsupported error alone was insufficient; the retained bytes now establish
which structural checks pass and which checks remain unknown.

Intel's [80386 PRM §7.5](https://www.read.seas.harvard.edu/~kohler/class/aosref/i386/s07_05.htm)
and [§9.6.2](https://www.read.seas.harvard.edu/~kohler/class/aosref/i386/s09_06.htm)
require a task switch for this exception-gate mechanism, with outgoing-state
save, incoming TR/CR3/register/segment loading, busy/backlink/NT/TS handling,
exception error push and nested-task IRET. Failures before and after committing
the new task have different contexts. A correct implementation must validate
those states, including current-task busy bookkeeping and paging faults during
switching. This exceeds a bounded gate-validation repair. **No task-switch
hardware, partial success, fault suppression or replacement handler was added.**
The next gameplay prerequisite is that complete architectural contract, plus
validation of the actual incoming TSS and source page-walk state; this run does
not prove the initial #PF itself is an emulator bug.

The fatal PNG was inspected: DOS/4GW Professional Protected Mode Run-time 2.00
copyright text only. No gameplay, walking/driving, player control, audio or FPS
claim. Child `exited=false`; its default `exitCode=0` is not a guest exit.
Host actual wait **1**, naturally after **63.157190 seconds**, with no deadline
signal. `runtime-wait.json`, `fault.json`, `fault.png`, reviews/answers, overlay,
exact EXEC requests and both actual module identities are retained. Both modules
remain ordinary SHA-256 `03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`.
Archive, K.EXE and all 117 fixture files / 17,078,619 bytes match before/after
with exact closure and unchanged manifest; no fixture/configuration was altered.

Focused diagnostics pass with a real faulting COM, JSON and PNG before throw,
#PF delivery failure escalating directly to #DF, absent/unreadable/device-backed
descriptors, invalid target bounds, software privilege rejection, saved fault IP,
IDT error word, and unchanged CR2/error/memory on inspection. The same real COM
capture fails on saved pre-change runner/paging source because failure JSON is
absent. Both regenerated bundles pass actual faulting-COM execution, diagnostic
and privilege checks, and exact parity for all 44/43 embedded source modules.
Paging-foundation passes all three dispatch variants and 192 protection cases.

**Regression limitation:** the full `test/test-toyvm-paging.js` run fails its
existing DOS COM copy assertion at physical 000500B0: actual C3112233, expected
76543210. Saved pre-change paging code reproduces the exact failure, including
in an isolated COM run; a probe also observes 76543211 at 00071008 versus expected
76543210. This failure is retained, not relabeled as a pass or repaired by
weakening assertions. The preceding four-variant scalar/fetch, system-read,
VM86 restart, physical-bus and trace-entry tests ran through before that failure.
This is a separate unresolved paging regression relevant before future gameplay
qualification. No full paging-suite pass is claimed.


The complete native checkpoint/batch input regression, 36 actual CALL-gate/RETF
cases and protected timer-vector regression also pass. The mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` passes in full. These results
qualify the diagnostic change, not task switching or the failing COM copy test.
No hardware behavior was changed. Both live bundles are regenerated from these
sources. The original-tested source is retained through its loaded-module pins;
the final bus-error diagnostic attachment was checked synthetically without
another original.

The independent disk guard used abort 2,020,000,000 bytes / floor 2 GB,
without a RAM gate, and its retained samples cover the complete original run.
Cleanup found that guard 173425 had terminated with actual tool wait 143 before
final validation/publication; its last sample was 2,288,599,040 bytes available.
Later guarded-command wrappers checked the floor at entry, but continuous
abort coverage after the last sample is not established. No breach is recorded;
cleanup measured 2,264,391,680 bytes available. The orphaned board watcher 173426
was explicitly terminated and independently absent; its actual wait is unknown
because its parent was gone. All tracked test/build/publication commands were
actually waited. Guard, watcher and original are absent; no own helpers remain.
Box ID/state/expiry N/A, coordinator lifecycle unchanged. No browser, boat, binary
download, registry change, deployment, workers, MDK2/GL edits or foreign WIP
adoption occurred. Evidence, commands, actual waits and recovery are retained
outside git; all assigned paths and serialized runtime are released at completion.

## Original batch handoff: child reached, task-gate boundary, 2026-11-01

Evidence: `scratch/runs/20261101-gta1-original-batch-handoff/`. Implementation began after
Constructor `995c90daf` terminal/final, exact author release and independent
absence of its ten helpers. Only the five assigned paths changed.

The native runner now accepts the authentic `GTA.BAT`: `cd gtados`, `k.exe`,
`call dino.bat`, `cd ..`. The bounded interpreter supports `@echo off`, `REM`,
`CD`, `CALL file.bat`, and explicit EXE/COM commands with literal arguments.
Called batches are read from the current overlay when reached. Guest writes,
working directory and sibling data remain visible under one mounted root.
Commands share a finite dispatch budget and absolute wall deadline, including
input and VM setup; checkpoint indices remain global. External commands use
separate VM instances, as the existing prerequisite runner does; resident and
hardware state do not carry over. Unsupported syntax fails with batch/line/text.
No expansion, redirection or general shell emulation was added. K.EXE remains
the default; no registry change, synthesized batch or executable bypass.

One original session used 3-billion dispatches, an 85-second runner deadline
and independent 90-second OS cap. Each live PNG was inspected before its
individual Enter: 200,006,543 dispatches showed four flags/English selected;
400,000,001 showed English / Press Any Key; 600,000,005 showed Startup / Run GTA
selected / Keyboard. K.EXE exited 0, then its actual generated DINO.BAT ran.
Before interpretation the observer retained **12 bytes**, `demo24.exe\r\n`,
hex `64656d6f32342e6578650d0a`, SHA-256
`5980340dfa79147f5be7b713d35804b6e25d8ecd1084d6ab22e51929a6dbf0cc`.
The generated command selected DEMO24.EXE with no arguments in GTADOS; the
child log confirms two opens of `C:\GTADOS\DEMO24.EXE`. Full overlay bytes,
including the 32-byte `temp.ini`, are retained outside git.

`exact-exec.json` records K.EXE's actual INT 21h requests: overlay-load
`C:\GTADOS\dos4gw.exe` (AL=3), and `C:\COMMAND.COM` (AL=0) with the exact
nine-byte tail ` del test` (no `/C`), returning AX=2 without transfer. This did
not prevent K.EXE's normal exit or handoff. The batch's external launch is a
runner action, not an invented guest EXEC.

The first new observed stop is **`unsupported 386 task-gate transfer`**, in
`paging-exec.js` exception delivery. K.EXE exit 0 is distinct from child
`exited=false` and host actual wait **1**, naturally after **49.347195 seconds**.
No deadline signal or unchanged original retry occurred. No final child PNG,
report, exception vector, IDT descriptor or terminal CS:IP was retained: the
exception propagated before CLI capture. Reviewed images establish launcher
input only, **not gameplay**. Next: capture the failing paged-exception state
and determine the required gate behavior; the error does not prove gate validity.

Archive `76f1e1da5c898f755597b86357c4d77b7447cb483673a23d10d34f40cfe03ec9`,
K.EXE `8fd02d556e06f3258a6ca516ccf675e7aafbf313bd3c575e12dd0f8e5c67d48f`,
and all 117 files / 17,078,619 bytes match before/after with exact closure.
Both actual compiled modules retained ordinary SHA-256
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`.
The original-tested runner is retained verbatim. Final index/deadline corrections
were tested synthetically without another original. The real guest batch test
fails on the saved old runner. The repair passes overlay/config/executable,
sibling-data, arguments, CALL, budget/deadline and input checks. Existing input/keyboard
regressions, both regenerated bundles/module parity and locked build pass.
Success-test allowances cover PNG/VM setup; explicit deadline tests remain.
Disk abort 2,020,000,000 bytes / floor 2 GB, no RAM gate. Box ID/state/expiry N/A;
coordinator lifecycle unchanged. Commands, reviews, failures and recovery are retained.

## Successive original input: startup launch handoff boundary, 2026-11-01

One authentic default `GTADOS/K.EXE` session used published
`37791d8f1f0a3072bbce209796f65923ae3810ce` after its terminal/final,
author release and helper absence were checked. Evidence:
`scratch/runs/20261101-gta1-successive-native-input/`.
Exact archive SHA-256 `76f1e1da5c898f755597b86357c4d77b7447cb483673a23d10d34f40cfe03ec9`,
K.EXE SHA-256 `8fd02d556e06f3258a6ca516ccf675e7aafbf313bd3c575e12dd0f8e5c67d48f`
and all 117 files / 17,078,619 bytes matched before and after, with exact closure.
All 230 source/support pins stayed unchanged. No assets, binaries or sources
were changed; no build or original retry was performed.

Each live PNG was inspected before writing its individual stdin answer. All
checkpoints shared one VM, 3-billion-dispatch budget, 85-second runner deadline
and independent 90-second OS deadline; thresholds were spaced 200 million
dispatches apart:

| Capture | Actual dispatches | Reviewed screen | Answer |
| --- | ---: | --- | --- |
| `checkpoint-00.png` | 200,006,546 | Language backdrop/logos; flags not yet visible in this live frame | Empty line, allow animation |
| `checkpoint-01.png` | 400,000,001 | British flag and pointer, Choose Your Language | Enter |
| `checkpoint-02.png` | 600,014,708 | English / Press Any Key | Enter |
| `checkpoint-03.png` | 800,000,004 | Grand Theft Auto Startup; Run GTA selected; Control: Keyboard | Enter |
| `after.png` | Final | DOS/4GW / Startup V2.40 text | No further input |

This establishes successive ordinary menu responses, **not gameplay**.
After Enter on Run GTA, K.EXE returned `exited=true code=0` at
`0549:26EB`, approximately 822.6 million dispatches / 199,168 handbacks.
Later scheduled checkpoints were never reached. Host actual wait was **0**,
with elapsed supervisor time **26.707862 seconds**; no deadline termination
was needed. The CLI reports 25.19 seconds and 82.15 guest seconds; these are
separate clocks, not the OS runtime. No walking/driving/player-control claim.

The concrete new boundary is the startup launch handoff: the run created
`temp.ini` and `dino.bat` in the guest overlay and returned without gameplay.
The original root `GTA.BAT` runs `k.exe` then `call dino.bat`; running K.EXE
alone does not execute that subsequent original batch command. The report also
lists missing `C:\COMMAND.COM` and no gameplay child EXEC. Static DOS runtime
inspection shows only limited `COMMAND.COM /C executable` resolution, with no
general batch interpreter. The exact generated batch contents and EXEC request
were not captured, so neither the missing shell nor aggregate decoder give-ups
are established as the cause. Next: inspect the generated overlay and exact
handoff, then support the original batch route faithfully, retaining K.EXE as
the default entry rather than substituting DEMO24.EXE.

Actual ordinary compiled module: SHA-256
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`,
343,736 bytes; the observer returned bytes unchanged and recorded loaded JS
identities in `actual-module.json`. Paired captures, timed reviews/answers,
full report, identities and actual waits are retained. The active guard kept
abort 2,020,000,000 bytes / floor 2 GB, with no RAM gate. Minimum free space was
2,306,699,264 bytes. Supervisor actual tool wait 0, guard wait 0 and watcher wait -15;
all four PIDs are directly absent and no own helpers remain. No box was assigned
(ID/state/expiry N/A); lifecycle ownership remains with the coordinator.
Note/runtime ownership is released after publication; this assignment stops.

## Successive native input primitive, 2026-11-01

Run `20261101-toyvm-successive-checkpoint-input` extends the published one-shot
primitive to an ordered sequence in one VM. This is synthetic COM validation;
no GTA original was run and no gameplay progress is claimed here. The earlier
16.83-second GTA report followed by a supervisor SIGTERM at 90 seconds was a
host stdin lifetime defect, independently reproduced with a tiny BIOS reader
whose parent kept stdin open after answering. Closing readline and pausing the
stream alone left Node's pipe read referenced. The completed reader now pauses
and unrefs stdin; each new prompt refs it again. The CLI exits naturally and
allows unrelated pending timers/output to finish, without `process.exit`.

Use `runDos({ exe, budget, seconds, checkpoints: [{ at, png, pause }, ...] })`.
The array has at most 64 entries with strictly increasing finite nonnegative
`at` dispatch thresholds below a finite `budget`. A nonempty schedule requires
positive finite `seconds`. Each pause runs at the first live handback at or
beyond its threshold; the PNG is written before the callback sees the frozen
snapshot. Snapshot `index` and `at` identify the schedule entry. If a handback
crosses several thresholds, captures/callbacks run in order at that handback
before more guest work. Allow enough dispatches between checkpoints for the
guest to consume the preceding tap and render its response.

`pause(snapshot, signal)` returns a `parseKeys` string (for example `enter`),
`''` to continue without input, or `null` to stop. Ordinary keys are queued once
only after the answer and before continuation. Callback errors propagate; the
abort signal is closed on every outcome. All pauses and guest execution share
the original dispatch budget and wall deadline. A deadline stops pending input
without delivery. Guest termination prevents later callbacks. The schedule is
copied before execution so callbacks cannot extend or reorder it.

The old `checkpoint: { at, png, pause }` option remains supported. Supply either
option, never both. Result `checkpoints` lists reached pauses, including an
unanswered/stopped pause; `checkpoint` remains the first reached pause or null.
`runDosWithPre` applies the sequence only to the target executable.

For native inspection, repeat flags in matching order:

```sh
node tools/toyvm/run-dos.js program.exe --dispatches=1b --seconds=60 \
  --checkpoint=200m --checkpoint=400m \
  --checkpoint-png=scratch/runs/your-run/first.png \
  --checkpoint-png=scratch/runs/your-run/second.png --report
```

At each printed prompt, inspect its captured PNG and enter the next ordinary
key string on one line. EOF stops the session. Send a line only after its
prompt; extra lines sent together are not a queued input script. Optional
`--checkpoint-keys=enter --checkpoint-keys=space` supplies fixed answers in
schedule order; use an empty value for no input. PNG and fixed-answer flags
must each be absent or repeated exactly once per checkpoint. Thresholds are
absolute dispatch counts within this same session, not fresh budgets.

Validation covers ordered BIOS consumption and make/break pairs, captures
before each answer, no premature input, empty/no-input state equivalence,
budget bounds, shared deadline, EOF at a later prompt, terminal/callback errors,
one and two answered prompts with deliberately held-open stdin, and pending
work draining on natural CLI exit. Both regenerated bundles execute the changed
primitive and match every embedded source module. Exact unchanged GC source
and VBE test hashes reuse the accepted 178-assertion, DAC/retrace and bundle-GC
evidence recorded by `20261101-toyvm-gc-checkpoint-coherent-build`; that unrelated
GC validation was not rerun. Focused tests and the mandatory locked build are
recorded in this run's logs.


## Native checkpoint onward: English confirmation, 2026-11-01

One default original `GTADOS/K.EXE` session used the published checkpoint
primitive from `a416f0142fb251e464ddc8ffa8ffb348c44479a8`, after its
launcher exit0/final, author release, published ancestry and actual helper
absence were verified. Evidence:
`scratch/runs/20261101-gta1-native-checkpoint-onward/`.
Fresh archive SHA-256 `76f1e1da5c898f755597b86357c4d77b7447cb483673a23d10d34f40cfe03ec9`,
K.EXE SHA-256 `8fd02d556e06f3258a6ca516ccf675e7aafbf313bd3c575e12dd0f8e5c67d48f`
and all 117 files / 17,078,619 bytes matched the manifest with exact closure.
Fixture and pinned source bytes remained unchanged afterward.

The retained language-menu evidence set `--checkpoint=200000000`. The live
handback was **200,006,546 dispatches / 56,211 handbacks**. `before.png`
was captured and visually inspected before input: Choose Your Language,
texture, BMG/DMA logos, all four flags and the English pointer were visible.
The earlier note incorrectly said the flags/pointer were absent; inspection of
the actual retained PNG confirms they are present. Only then was `enter` supplied once through supported
checkpoint stdin. `after.png` visibly reads **English / Press Any Key**.
This establishes a menu response, not gameplay or player control.

The same session reached its original **1,000,000,000-dispatch** bound,
213,525 handbacks and 99.86 reported guest seconds. Guest `exited=false`,
CS:IP `0080:0070`; the report says budget spent. The next concrete boundary
is another input-waiting menu after the supported one-shot checkpoint has
been consumed. No second key, original retry or alternative executable was
used. Eight aggregate decoder give-up sites do not establish occurrence
order or cause of this boundary; no causal decoder claim is made.

The identity observer returned ordinary compiled bytes unchanged: actual
module SHA-256 `03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`,
343,736 bytes, with loaded JS pins recorded in `actual-module.json`.
No source edits or project build were performed. An independent process
guard enforced stop 2,020,000,000 bytes / floor 2 GB without a RAM gate.
The CLI printed its final report after 16.83 seconds but remained alive with
stdin open. The independent supervisor enforced its 90-second OS deadline;
actual host wait was **-15 (SIGTERM)**, collected at 90.112 seconds including
poll/termination overhead, with direct process absence verified. This host
termination is separate from the guest's earlier budget stop and non-exit.
`runtime-wait.json`, paired captures and review records are retained.
No boxes were assigned (ID/state/expiry N/A). Next: separately authorize
a supported further live input opportunity; do not infer gameplay from this
English confirmation. All ownership is released after note publication.

## Combined GC/checkpoint implementation, 2026-11-01

Run `20261101-toyvm-gc-checkpoint-coherent-build` resolves the generated-bundle
dependency below by adopting both repaired sources/tests and regenerating both
live bundles together. Every embedded module now matches current source after
the bundler's shebang normalization. Both bundles pass real COM execution,
once-only checkpoint Enter in guest memory, no-input state equivalence,
session bounds, stop, deadline and terminal checks, plus 74 GC assertions each.
The unchanged native checkpoint/capture/CLI and keyboard PASS evidence from
`20261101-gta1-checkpoint-capture-fix` is reused with exact source/test hashes.
The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` passes in full.

This supersedes the publication blocker below. No original GTA was run here
and no gameplay result is claimed. After implementation publication and author
release, the next GTA worker may test the original using this checkpoint API.
No boxes were assigned (ID/state/expiry N/A); no shutdown action was taken.

## Generic native checkpoint implementation tested; bundle gate blocked, 2026-11-01

The released runner/test WIP from `f2fd12a5f` is adopted and repaired in
`scratch/runs/20261101-gta1-checkpoint-capture-fix/`. The earlier first-failure
entry below is historical. Checkpoint captures now use the shared
`screenSurface().text` and `.geom`, including the VESA framebuffer geometry.
The stdin controller removes its abort listener on EOF as well as on answers.
Constructor's four GC source/test/live-bundle WIP paths remain untouched and
excluded from this change.

**Publication is blocked.** The required
`flock /tmp/wine-build.lock bash tools/build.sh` returned 1 at browser-bundle
reproducibility. Both live bundles embed `run-dos.js`; after normalizing the
bundler's shebang removal, that is the only embedded module that differs
from the working sources. Each generated bundle needs the checkpoint runner
update, but both paths were explicitly excluded by this assignment. No build
gate was bypassed, no unchanged build was retried, and no checkpoint code was
committed. The source/test WIP is retained with exact recovery copies.
No new original GTA process was launched; the sole actual original outcome
remains the earlier English language-selection screen documented below.

Use `runDos({ exe, budget, seconds, checkpoint: { at, png, pause } })`.
The optional checkpoint runs once at the first **live handback** at or beyond
`at`; it does not split a guest block or run after a terminal handback.
It writes the optional PNG before awaiting `pause(snapshot, signal)`.
The snapshot includes dispatch/handback counts, console text, the shared
surface description, PNG path and delivery state. Returning a `parseKeys`
string delivers ordinary `pushKey` taps once; an empty string continues
without keys; `null` stops before another guest step. Callback exceptions
propagate. The signal aborts when the callback completes or its deadline
expires, so an interactive controller can release its resources.
The result's `checkpoint` is null if never reached; otherwise it records
the keys and `delivered`/`stopped` state. A timeout leaves delivery false and
sets `ranOutOfTime`. The original session, dispatch budget and wall deadline
continue across the pause; no second guest or renewed budget is created.
Require `0 <= at < budget`, finite budget and positive finite `seconds`.

CLI example (use an appropriate checkpoint for the executable):

```sh
node tools/toyvm/run-dos.js program.exe --dispatches=200m --seconds=60 \
  --checkpoint=100m --checkpoint-png=scratch/runs/your-run/before.png \
  --png=scratch/runs/your-run/after.png
```

At the prompt, enter comma-separated named keys such as `enter`, or send EOF
to stop. `--checkpoint-keys=enter` supplies a fixed answer without stdin;
`--checkpoint-keys=` continues without keys. `runDosWithPre` applies the
checkpoint to the target executable only, after the prerequisite.

Focused real synthetic COM tests pass: capture exists before input, decoded
text and VESA PNG content matches the shared renderer (including an explicit
blue pixel at 640x480), exactly one Enter reaches guest memory and one
make/break pair reaches the hardware queue, no-input guest state and dispatch
counts match the control, and continuation retains the session bound.
The changed-input fixture permits at most eight dispatches of final-block
overshoot, justified by its straight-line block length, instead of comparing
different guest paths for exact equality. Explicit stop, pause deadline,
terminal-before-checkpoint, synchronous/asynchronous callback errors, invalid
answers, CLI fixed/stdin keys, EOF and held-open stdin deadline all pass.
`focused-final.log` and `build.log` retain actual check results.

## Checkpoint implementation first focused-test failure, 2026-11-01

Source implementation was started after Constructor's explicit release, on
main after `c515da25d`. The uncommitted WIP is in `tools/toyvm/run-dos.js`
and `test/test-toyvm-runner-input.js`; the four Constructor GC source/test/
generated-bundle WIP files were not edited or staged. No code is published
by this attempt. Evidence: `scratch/runs/20261101-gta1-checkpoint-implementation/`.

The proposed generic API is `runDos({ ..., checkpoint: { at, png, pause } })`.
At the first live handback at or beyond `at`, it writes a capture and awaits
`pause(snapshot, AbortSignal)`. A key string queues ordinary `pushKey` taps
once; null stops; continuation retains the same session and original bounds.
The proposed CLI is `--checkpoint=DISPATCHES --checkpoint-png=PATH` with
stdin key-string/EOF control, or `--checkpoint-keys=KEYS`. A checkpoint
requires a finite dispatch budget and positive finite `seconds`.
These interfaces remain **unfinished and unqualified**.

The first focused native synthetic COM test failed at line 47: the tapped run
retired **20,002** dispatches and the no-input control **20,003**, against the
test's exact-equality assertion. Earlier assertions passed: the callback ran
once after its requested threshold, a PNG existed before input, guest memory
recorded exactly one Enter (count 1, ASCII 13), the BIOS key queue was consumed,
and the hardware queue contained one make/break pair `1C 9C`. A PNG signature
check does not establish that the image depicts the correct surface.
The changed keyboard branch can end at a different instruction boundary;
the bound test needs an explicit permissible final-block overshoot rather
than assuming different guest paths retire identical counts.

Static review also identifies a capture bug requiring repair: `screenSurface`
returns an object with `.text` and `.geom`, but this WIP compares the object
to the string `'text'` and recomputes geometry. Use the shared surface result
for both console and graphics capture before relying on screenshots.
The remaining default-equivalence, explicit-stop and pause-deadline tests did
not run. CLI/EOF, capture content, terminal-before-checkpoint and error paths
still need validation. No unchanged retry was attempted under the assignment's
first-failure rule. Mandatory locked build was not run; free space reached
2.161 GB after the failed test, but that does not override the latched stop.

There were zero original GTA1 launches, no fresh archive/executable pin check,
no actual original module or paired input images, and no new language/menu/
gameplay result. The exact 117-file archive and executable pins below remain
prerequisites for a future original run. No browser, boat, download, registry,
deployment or alternate executable was used. Box ID/state/expiry are N/A.
The independent 2 GB disk monitor stayed above its floor; actual helper waits
and WIP recovery pins are retained in the run directory. Next: repair the
identified WIP issues, complete meaningful focused tests, pass the mandatory
locked build with admitted headroom, then publish code before any authorized
single original investigation. All paths and serialized ownership are released
after this note is published.

## Checkpoint-input repair second resource boundary, 2026-11-01

The fresh assignment after `741117e0a117a752038b82c2488dcf1194232022`
passed its entry disk check at **2,046,525,440 bytes available**, but its
independent guard subsequently measured **1,990,922,240 bytes**, below the
unchanged **2,000,000,000-byte** floor, during static read-only preparation.
The guard latched a stop and the task stopped without an unchanged retry.
Constructor still owned serialized source/build/runtime; its release had not
arrived. No runner/shared-source edits, test, build, fixture verification or
original GTA run started. Checkpoint input remains unimplemented, and there
is no new language-selection or player-control evidence.

Evidence is retained in
`scratch/runs/20261101-gta1-checkpoint-input-repair-run2/`: `disk.jsonl`,
`STOP`, `guard.py`, `guard-cleanup.json` and `verification.json`.
The guard actively terminates registered task-driver process groups with
TERM followed by KILL on a breach, rather than merely exiting. No registered
driver or game children existed at this boundary, so that termination path
was not exercised. Its board watcher was terminated and actually waited
with status -15; the guard's actual tool wait was 0, and both PIDs were
directly verified absent. Box ID/state/expiry and actual module identity
are N/A. No foreign deletion, RAM gate or floor reduction occurred.

Only this blocker note is published. A future assignment needs sustained
headroom above its required floor and Constructor's exact release before
implementing and testing the supported native checkpoint API, building, and
attempting the single bounded default original run. No code commit or
gameplay/full-corpus acceptance is claimed here.

## Checkpoint-input repair entry prerequisite, 2026-11-01

The checkpoint-input implementation assignment following
`19ce5388af57045694e051b0cd2f723213f5531e` stopped at its first resource
prerequisite. Initial `df -B1 /home` reported **1,985,933,312 bytes available**,
below the assignment's unchanged **2,000,000,000-byte** floor. The task explicitly
requires stopping at a failed prerequisite without an unchanged retry. No
source edits, test process, build, fixture verification or original GTA run
started. The native runner still lacks the supported checkpoint input path
described below; language selection and player control remain unverified.

Evidence is in `scratch/runs/20261101-gta1-checkpoint-input-repair/`:
`df-initial.txt` and `prerequisite.json` retain the measurement and stop boundary.
Only this blocker note changed. No game/driver children existed to abort, and
no background disk guard was started after the failed synchronous entry check.
No foreign files were deleted, no floor was lowered, and no RAM gate was used.
Box ID/state/expiry and actual module identity are N/A because nothing ran.
The next assignment needs disk headroom above the same floor before beginning
the runner implementation, focused tests, mandatory build and eventual single
bounded original run. There is no new screenshot or gameplay evidence.

## Language-selection input boundary, 2026-11-01

The follow-up to `124d0bda1745b544faeafbb6f23f087fac23d6ae` stops at
the ordinary native runner's missing **post-menu keyboard staging** primitive.
No original was launched in this follow-up. The retained 640x480 screenshot
was visually inspected again: the pointer selects the English flag on
**Choose Your Language**. English selection, input response and gameplay
remain unverified. There is no after-input screenshot because no input was sent.

Inspection of the unchanged `tools/toyvm/run-dos.js` establishes the boundary:

- `keys`/`autoKeys` options are declared near line 326 and CLI parsing is near
  lines 1399–1400. `Machine` copies `keys` and queues make/break scancodes in its
  constructor (`tools/toyvm/dos.js`, lines 863 and 903). Thus `--keys=enter`
  supplies a key before startup, with no after-menu timing guarantee.
- The execution loop near line 827 supports scheduled mouse clicks and memory
  dumps, but exposes no keyboard schedule, stdin control channel, pause/resume
  control or caller-provided slice callback. Its `beforeSlice`/`afterSlice`
  hooks near lines 671–675 are internal instrumentation. `runDos()` returns
  the machine after the run, so that return value cannot stage a key during it.
- `--auto-keys=enter` enables repeating automatic input. Its graphics reader
  (`dos.js:1995`) samples every 4096 polls and answers after matching sampled
  screen hashes. It is neither a one-shot command nor confirmation that this
  particular menu is visible. Scheduled clicks do not establish keyboard
  navigation support for GTA's language menu.

The keyboard device already has `Machine.pushKey(scan, ascii)`,
`keyDown()` and `keyUp()` (`dos.js:2484` onward). The precise next dependency
is a supported native runner control path that invokes these between slices
after a reviewed menu checkpoint, captures the resulting frame, and permits
bounded continuation of that same session. For this menu the first intended
ordinary action would be Enter on the selected English flag. No source change,
prototype interception, alternate executable or automatic key rotation was
used to work around this boundary. A separately authorized runner improvement
or supported interactive environment is needed before the next original run.

Evidence: `scratch/runs/20261101-gta1-language-selection/` retains
`verification.json`, `identity-before.json`, `actual-files.json`,
`runner-input-inspection.json`, `before-retained.png`, `baseline-startup.log`,
`baseline-actual-module.json`, accepted test evidence and lifecycle records.
The copied image/log/module record are explicitly from the previous startup,
not a new execution. All **117 files / 17,078,619 bytes**, exact file-set closure
and the retained archive SHA-256 match the current manifests. All 230 previous
source/support/manifest pins match; current registry and candidate manifest
identities are also pinned. Fresh evaluation of actual `DESKTOP_APPS` finds
46 entries and no GTA; no candidate-corpus GTA1 entry is present (GTA2 is a
different candidate). This remains
an unqualified local original, with no redistribution grant or publication.

The retained actual module remains
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`;
no module was compiled or executed here. The 95 accepted ToyVM regression
source/test/support pins still match, so their existing VBE/DAC/retrace/bundle
results are reused without rerunning tests or the build. The previous seven
aggregate decoder give-up sites remain limitations: their ordering, execution
significance and causal relationship to menu progress are unknown. They do
not establish a crash or explain the language checkpoint.

Runtime/source/build access was serialized and read-only, GTA first while
Constructor remained static. An independent guard kept the unchanged
2,000,000,000-byte `/home` floor, without a RAM gate or foreign deletion.
Only own guard/watcher helpers required shutdown; actual waits and direct
absence are recorded separately from guest exit (N/A: zero originals).
Box ID/state/expiry are N/A. No new before/after runtime comparison, gameplay,
FPS or audio claim is made. All ownership is released after publication.

## Exact recovery and first default startup, 2026-11-01

The original default `GTADOS/K.EXE` route reaches a visible **Choose Your
Language** screen on ToyVM. This is a language menu, not gameplay or accepted
player control. No keys or mouse inputs were supplied and no second original
was launched. The next bounded task is ordinary language selection, followed
by inspection of the resulting screen before choosing further supported input.

Input handoff: `bd27914459f3501ee823b8122af23b1d9cd90129`,
[local DOS action dependency note](local-dos-action-replacement-nov01.md).
This was the sole selected distinct title. Fresh inspection of the actual
`DESKTOP_APPS` array still finds no GTA entry. No registry changes were made.

Evidence and recovery helpers are retained in
`scratch/runs/20261101-gta1-original-recovery-startup/` (ignored).
`recovery.json`, `actual-files.json`, `identity-before.json`,
`actual-module.json`, `command.json`, `startup.log`, `startup.png`,
`lifecycle.json` and `verification.json` preserve the actual identities,
execution and cleanup. The image was visually inspected: four language flags,
the English pointer, BMG/DMA logos and yellow language-selection text render
at 640x480. No intro, driving, walking, input response, FPS or audio is claimed.

### Original payload and recovery recipe

The sole HTTPS download was the exact URL in
`test/dos-game-corpus/manifest.json`:

```text
https://archive.org/download/gta-1997/Files/Demo%20-%20Liberty%20City%20-%2024%20Bit%20-%20High%20Res%20Version/gta24.zip
```

Retain only the ignored local fixture; this demo has no recorded redistribution
grant. `test/binaries/dos-games/gta24.zip` is exactly **9,531,378 bytes**,
SHA-256 `76f1e1da5c898f755597b86357c4d77b7447cb483673a23d10d34f40cfe03ec9`.
There is one archive copy. Curl used normal certificate verification,
HTTPS-only redirects, a size cap and finite connect/overall timeouts; its
actual OS wait was 0. No broad search or compilation container was used.

Extract that archive into `test/binaries/dos-games/gta1-demo/`, preserving its
`GTA24/` directory. Before any startup, verify every size/SHA-256 against
`test/toyvm-dos-corpus/files/gta1-demo.json` and require exact file-set closure:
**117/117 files, 17,078,619 bytes**, all matched before this run and afterward.
`recover.py` records the complete guarded acquisition/verification recipe and
refuses an existing destination; do not overwrite or redownload retained files.

Important executable identities:

- `GTADOS/K.EXE`: `8fd02d556e06f3258a6ca516ccf675e7aafbf313bd3c575e12dd0f8e5c67d48f`.
- `GTADOS/DEMO24.EXE`: `2f1cedfb95254b2f1a8913f1aeac7a915966cb42c70c9c96b14b8861fbf78c9f`.

The catalog's default entry follows original `GTA.BAT`: `cd gtados`, `k.exe`,
`call dino.bat` (the last batch is empty). The existing native runner mounts
the executable's parent directory. It was invoked directly on **K.EXE** with
empty arguments/environment additions; DEMO24.EXE was never substituted.

### Actual startup and limits

`command.json` retains the exact command: ordinary
`tools/toyvm/run-dos.js`, default tailcall hardware/options,
`--dispatches=200000000 --seconds=60 --trace-fault --trace-entry=16
--report --text --png=.../startup.png`, plus a scratch-only identity observer.
An independent supervisor enforced a 90-second OS deadline and a 1.9 MB output
cap. The actual run finished in **2.7707 seconds**, with **3,829 log bytes**.

The process OS wait was **0**, while guest `exited=false`: there is no guest
exit code. The actual stop was **budget spent**, at `CS:IP=0080:0070`, after
200 million dispatches, 56,211 handbacks and 19.97 reported guest seconds.
The video report names VBE mode 101h, 640x480; that observation does not
qualify VBE 2.0 or subsequent gameplay. No terminal guest failure message was
visible. The ordinary runner also reports seven decoder give-up sites,
including `0080:85F1`, bytes `0F 21 F3 ...`, base `0x148370`, counted 17 times.
These aggregate diagnostics do not establish first-occurrence order or a cause
of the menu checkpoint; unsupported decoding remains a concrete limitation to
inspect before trusting later progress. No failure was retried or alternate
executable/hardware configuration attempted.

The scratch identity observer checks actual source pins, hashes the ordinary
compiler's returned bytes before guest execution and returns them unchanged.
Actual module SHA-256:
`03495d5463de5ee69a82104a0d37d35e7ce9d2662c26f5d06278312c159e080b`,
343,736 bytes. WAT SHA-256:
`29bdf4e754aa46d8e2f083b5bbb8e9fb9c9f2725c4b2503a25b11786234dfbc0`.
This is the existing ToyVM module generated in memory by its ordinary runner,
not `build/wine-assembly.wasm`. Loaded JS identities and source checkpoint are
recorded; all pinned source/support/manifest files stayed unchanged. No source,
test or build changes or project build were needed for this note-only task.

### Ownership and lifecycle

The coordinator's 21:40:26 UTC board entry verified both prior DOS-pool author
releases, launcher terminal0 and direct helper absence. GTA claimed serialized
runtime/source/build first; Constructor remained static during execution.
Independent disk guards sampled `/home` against the unchanged 2,000,000,000-byte
floor, with no RAM gate, guard reduction or foreign-artifact deletion. Recovery
reserved archive, full extraction and evidence margin before downloading.

Own download/game/guard/watcher processes were actually waited and directly
verified absent; process waits remain distinct from the unexited guest.
The fixture was not modified by guest overlay writes. Box ID/state/expiry are
N/A, with no browser, boat, EULA or deployment work. All assigned paths and
runtime ownership are released after publication. No further original is
authorized by this completed single-startup assignment.

## Native ToyVM checkpoint prerequisite (2026-11-02)

`tools/toyvm/checkpoint.js` provides synchronous `snapshot(vm)` and
`restore(vm, checkpoint)` for a stopped native VM built with
`makeVm('tailcall', { exportAll: true })`. Supply both the emitted WAT and
bytes when creating a fresh instance. Restore requires identical module and
WAT SHA-256, complete native global ABI, full memory length and table length.
The caller must own the VM at a host boundary with no active WebAssembly call.
The schema accepts trusted data records; it is not a deserialization security
boundary for executable getters/proxies. Binary V8 serialization is one
local evidence format, not a portable or trusted persistence format.

The primitive copies all linear memory (including raw segment selectors,
hidden descriptor caches, register file, decoded arena and paging maps),
every numeric native global (including lazy flags, IRQ boundary and x87
state), and every handler-table slot. Function names resolve to the
destination instance's own exports. It does not materialize flags, reload
selectors or clear decoded state. `exportAll` also includes same-line
global declarations, previously missing three REP decline counters.
Invalid identity, shape, type and handler records are validated and staged
before any destination writes.

`node test/test-toyvm-native-checkpoint.js` runs real LGDT, MOV CR0, far
transfer, DS/SS loads, FLD/FLDZ/FCHS, overflowing ADD, STI, JO and memory store. A held IRQ and real STI
arm the IF-enable boundary before capture.
The GDT changes after DS is loaded: correct replay must retain its old
hidden base and take the overflow branch. Literal expected operands, RAM
locations, selectors, bases and x87 values supplement complete-state parity.
The test covers same/fresh exact-module instances, full destructive rollback,
non-default/null table slots, sparse and late invalid inputs, and separate
lazy-flag/cache corruptions. `--old-snapshot=irq`, `cache`, `x87` and
`program` expose distinct failures of the profiling snapshot/seed path.
Evidence: `scratch/runs/20261102-gta1-native-checkpoint-implementation/`.

This is **not a complete persistent DosSession/device checkpoint**. Host
devices, scheduler, filesystem/session state, CodeCache JavaScript metadata
and mutable lexical state in imported callbacks/runner hooks require explicit
capture APIs and a supported exact entry boundary. The native state primitive
does not capture those objects. No original GTA startup or gameplay run is
authorized or launched by this task; original startup count here is zero.
The next prerequisite is complete persistent native DOS session/device state
with explicit runner boundary capture, before a separately authorized
initialized entry/replay experiment.

## Persistent cooperative DOS-machine checkpoint (2026-11-02)

The accepted native primitive in `c3850962b9` passed its actual native tests;
its result explicitly excluded host devices and continuation state. The
host layer now provides `createMachineRunner(options)` and
`resumeMachineRunner(archive)` from `tools/toyvm/run-dos.js`. A runner owns a
Machine, DosSession and native VM, and `step()` returns at the actual
DosSession handback. After a successful step, `capture()` returns a checksummed
binary V8 archive; `restore(archive)` rewinds that same runner. Fresh recovery
reconstructs the runner from the captured fixture/options recipe, builds the
exact module and restores before any guest step.

The archive holds native RAM/globals/table plus the complete connected host
data graph: VGA/console/palette, keyboard/held keys, timers/PIC/PIT, sound/DMA/
OPL/GUS, memory managers, open files and shared file records, queued events,
DosSession scheduling/progress and CodeCache programs/maps/repair plans and
arena metadata. Typed views into VM memory are rebound to the destination
buffer. Shared objects and cycles stay shared, including program indices,
file records and OPL operator references. Machine, DosSession, CodeCache and
runner-state roots are restored in place. The imported port functions keep
their original Machine reference; console methods are reconstructed by
explicit named binding. Arbitrary callback closures are rejected.

Module bytes, emitted WAT, actual ToyVM JavaScript sources, optional Terminal
font and the complete fixture/name/arguments/options/file bytes are hashed.
Restore validates archive integrity, identity, the host graph, supported
configuration, native ABI/globals/table and destination root descriptors
before the first write. A changed source file after module load also rejects.
This is a trusted local archive format, not a hostile deserialization boundary
or a cross-V8-version interchange format.

```js
const fs = require('node:fs');
const { createMachineRunner, resumeMachineRunner } = require('./tools/toyvm/run-dos');
const runner = await createMachineRunner({
  image: fs.readFileSync('fixture.com'), name: 'FIXTURE.COM', budget: 1000000,
  files: [['DATA.BIN', fs.readFileSync('data.bin')]],
  sessionOptions: { intFast: false },
});
runner.step(); // or repeatedly step to the desired genuine paused handback
fs.writeFileSync('checkpoint.bin', runner.capture());
// Later, in a fresh process with exactly the same ToyVM sources and font:
const recovered = await resumeMachineRunner(fs.readFileSync('checkpoint.bin'));
recovered.step();
```

The supported runner is cooperative and uses explicit dispatch budgets/input
schedules. It does not import the legacy `runDos()` tracing, capture scoring,
wall deadlines, async tiers, audio sinks or instrumentation closures. Only the
canonical tailcall/exportAll 386 module is supported. It accepts captured
flat DOS file names/bytes and guest-created files; host filesystem mounts,
subdirectory mounts, live JIT/tree/uop installers and arbitrary hooks are
rejected. Existing legacy `runDos()` sessions cannot be retroactively saved
with this API. A separately authorized GTA startup must use a supported
runner/fixture and may require directory-image support first; this prerequisite
has launched no original GTA and changes no clock or optimization semantics.

Validation and persistent recovery evidence:
`scratch/runs/20261102-gta1-dos-machine-checkpoint/` (see `RECOVERY.md`).
The deterministic COM fixture pauses at the genuine INT 21h/AH=3Fh stub with
a live IRET frame, open file at offset 1, queued keys, a CLI-held timer and
partial DAC/PIT writes. Literal oracles require file bytes `BC`, key `1E61`,
RGB `11,22,33`, PIT reload `1234`, video byte `7`, self-modified result `2222`,
`CHECKPOINT OK` output and DOS exit `42`. Same-runner destructive rollback,
fresh-runner restore and a fresh Node-process recovery all finish at 216
dispatches/79 handbacks with matching complete state. Captures on both sides
of the DOS service pass. Fourteen corrupt/incompatible archive cases reject
atomically; unsupported callbacks, mounts, installers and a frozen destination
also reject. The native-only snapshot control instead exits with `0`, failing
the independent exit oracle. Native checkpoint and runner-input regressions
and the locked full build pass. Both generated DOS browser bundles were
regenerated after the build correctly rejected stale copies.


## Authentic persistent batch integration and deadline boundary, 2026-11-02

`createBatchMachineRunner()` / `resumeBatchMachineRunner()` now execute captured
real batch files with explicit CALL frames, external-command continuation and
a nested DOS file tree. They use the canonical native factory and actual DOS
services, including nested INT 21h EXEC. Each external command retains its
connected VM, Machine, DosSession and CodeCache roots on same-runner rollback;
imports keep their Machine binding. Fresh restore reconstructs those bindings.
Child schema/source/fixture/options, launch budget and completed-state totals
and files are checked before live mutation. This extends the earlier flat-file
factory; its synthetic test alone never established authentic GTA coverage.

The focused test uses DOS writes to generate a called batch and pauses during
a nested child's real DOS read with its EXEC parent live. Independent oracles
require bytes `OK`, DOS child exit 42, persisted `*`, argument `go`, RGB
11/22/33 and video byte 7. Same/fresh/fresh-process, completed-batch and earlier
command rollback pass, including connected-root identity. Fifteen malformed,
source, fixture and schema cases reject atomically; wrong file bytes fail the
exit-42 oracle. Native/full-machine/input and DOS file/rename/temp regressions,
regenerated browser bundles and the locked build pass. Evidence and recovery:
`scratch/runs/20261102-gta1-authentic-batch-integration/`.

Exactly one authentic boot followed **GTA.BAT -> K.EXE -> actual generated
DINO.BAT -> DEMO24.EXE**. Three Enter taps followed fresh inspected menu
captures. K exited 0 after 622,692,729 dispatches; the generated batch is exactly
`demo24.exe\r\n`, SHA-256
`5980340dfa79147f5be7b713d35804b6e25d8ecd1084d6ab22e51929a6dbf0cc`.
A complete persistent DEMO24 checkpoint at its first initialized handback
(19 child dispatches, F000:0121) survives fresh-process restore, with full
native/host graph and batch-state parity. The subsequent bounded continuation
also restored it successfully. Defaults remain 550,000 dispatches/tick,
tickScale 1 and irqSchedule true; no guest/source/clock optimization was made.

**The next unmet contract is final persistence within the outer deadline.**
The continuation wrote a fresh DOS/4GW frame and module/WAT artifacts but
did not finish its final checkpoint/result before the 130-second supervisor
killed it (actual wait -9). No final archive or final JSON exists. Its pending
clock/calibration/fault-observation rings were not persisted. Consequently no
final guest tick, calibration result store/RET, first-fault entry or gameplay
progress is claimed. The timeout establishes no causal guest defect and led
to no source fix or replay. The usable retained handoff is the initialized
DEMO24 entry checkpoint, preserving all preceding menu/batch progress.
Next work must validate bounded capture and observation persistence with
non-original deterministic tests before any separately authorized continuation.

## Bounded finalization and advanced persistent handoff, 2026-11-02

The deadline diagnostic first read the retained driver and supervisor. The
120-second check occurred **before** each guest step; module/WAT and PNG writes
then preceded checkpoint capture, gzip, write, disk verification, media checks
and final JSON. The prior PNG was durable at 123.154943 seconds and the outer
kill occurred at 130.382087 seconds. There was no reserved finalization interval
or capture-stage receipt. Those facts do not identify a guest fault, calibration
return or checkpoint defect, and the lost final state cannot be reconstructed.

Before authentic restoration, a deterministic real generated-CALL/nested DOS
EXEC fixture exercised pending read/open-file offset, DTA/FindFirst, file tree,
arguments, devices and connected session state. Its additional 117 deterministic
files match the pinned media's file sizes and total 17,078,619 bytes. Complete
capture and independent **uninstrumented** fresh-process restoration passed the
literal child-exit 42, parent-exit 7, file, DAC and pixel oracles. SIGKILL after
writing/fsyncing half an actual temporary archive preserved the previous archive
and durable observation; an independent fresh restore still passed those oracles.

A fresh exact-source runner then restored the retained DEMO24 entry **without a
guest step**. Timing-only in-memory capture instrumentation kept canonical disk
sources and the native module unchanged; uninstrumented fresh-process capture
verified complete native/host/child/batch parity. Independent leaf phases on the
own test boat measured:

| Phase | Entry, seconds | After continuation, seconds |
| --- | ---: | ---: |
| Native snapshot | 0.0124 | 0.0143 |
| Connected DOS/device/session/cache graph | 1.7190 | 2.0166 |
| Child serialization | 0.0191 | 0.0884 |
| Child envelope/hash | 0.0532 | 0.1188 |
| Batch serialization | 0.0277 | 0.0307 |
| Batch envelope/hash | 0.0784 | 0.1507 |
| Gzip | 1.3242 | 1.3278 |
| Atomic write/fsync/rename | 0.1087 | 0.1252 |
| Disk read/gunzip/equality verification | 0.2138 | 0.2578 |

Total capture, including validation and stage-receipt overhead, was 2.5244
seconds at entry and 3.0903 after continuation. Independent fresh verification
at entry took 2.8716 seconds. These measurements establish the tested contract;
they do not establish which phase consumed the predecessor's unobserved tail.
No emulator source repair or guest execution optimization was justified or made.

After focused checkpoint/native/full-host/input/files/rename/temp, earlier-command
and terminal restoration tests and the locked build passed, exactly **one actual
continuation, zero boots**, restored the original entry. A 60-second guest cutoff
reserved another 60 seconds for finalization under the unchanged 120-second
runtime/130-second OS caps. Observations were atomically persisted during the
run and before capture. Finalization, independent uninstrumented fresh-process
restoration and complete-state parity finished at 69.598 seconds; the supervisor
returned actual 0 at 69.924 seconds, with its child group absent.

The advanced handoff retains DEMO24 child dispatch **20,313,713**, cumulative
643,006,442, tick **36**, CS:IP **0070:4335**. Defaults remain 550,000 dispatches
per tick, tickScale 1, irqSchedule true, with the pinned GTA.BAT -> K.EXE ->
generated DINO.BAT -> DEMO24.EXE history intact. Calibration was observed but
neither result change nor return was observed. The inspected final frame is
DOS/4GW text; no player scene, native movement or gameplay is claimed. Post-
handback fault fields are preserved observations, not a first-fault-entry claim.

Use the **advanced** archive for later separately authorized continuation:
`scratch/runs/20261102-gta1-checkpoint-deadline-diagnostic/remote-evidence/continuation/complete.checkpoint.gz`.
Compressed SHA-256:
`b0316de8010e5d259e76a9a6078a12dfbcd73d4dffc8919c126d62cd0d2a7c0b`;
decoded SHA-256:
`634b21af85a824572fc12168f05292f534831c890f6ff4d649989ac2f7aae4fe`.
The original entry and earlier archive remain intact. Recovery, atomic stage
receipts, exact-source closure, diagnostic attempts, full test evidence and the
fresh verifier are in that run's `RECOVERY.md` and `remote-evidence/`. Restore
with Node v24.22.1 and the recorded exact ToyVM source/dependency recipe; do not
replay boot or change clocks to recover this progress.

## Saved tick36 continuation: repeated stack-fault entry, 2026-11-02

Evidence: `scratch/runs/20261102-gta1-calibration-return-trace-recover/`.
No emulator source, guest bytes, clock or dispatch policy changed. Query13619's
actual terminal0/result/final/exact release and cleanup were consumed first;
failed55739's static scripts/descriptors were preserved read-only.

Static original bytes define the decisive boundaries: DOS-time returns at
`10196665/1019666F/1019667F`, terminating `INC ESI; CMP BL,DH; JE` before
`MOV [104786B8],ESI` at `10196684`, and near RET at `1019668E`. The RET oracle
is the full saved stack dword, same CS and ESP+4; the fixture's 241,463 polls
are not an authentic count oracle. Both retained clock formulas predict
DX=`0203`/DH=2 at tick 37, nominal child dispatch 20,350,000, which is 36,287
billed dispatches beyond this entry. Full 58-byte bridge frames and 12-byte
IRETD frames were prepared for observation without inferring high EIP from
low words.

Before advancement, independent uninstrumented fresh native/host/child/batch
parity passed. The observer left **all RAM and all 249 native globals** unchanged
and preserved complete checkpoint parity. It reads backed RAM and exported
state around ordinary `runner.step`; it installs no hooks and calls neither
paging read/probe nor the flags materializer. Literal split-page/device/missing-
page/A20 controls passed. Two scratch preflight diagnostics are retained: an
incorrect test expectation about 24-bit address aliasing, then an accessor-name
mismatch. Both preceded any guest step; correction touched scratch only.
Focused native/full-host/batch same/fresh/fresh-process, input, files/rename/temp,
terminal/earlier-command tests and the locked build passed (root 24599, actual 0).

Exactly **one continuation, zero boots**, used the demonstrated 60-second guest
cutoff plus 60-second finalization reserve. Atomic observations preceded capture;
runtime 68.0951 seconds, OS 68.1665 seconds actual 0/group absent. The complete new
checkpoint passed independent uninstrumented fresh-process full-state parity.

The trace distinguishes handbacks from forward progress: **2,229,173** successful
`ran` steps, all starting and ending at **0070:4335**, all with zero billed
dispatches and post-step vector12; SP changed on every step. Sampled SP changes
are the 16-byte exception-frame decrement modulo 65,536. IRQ count stayed 109,
host interrupt-service count 622, child dispatch 20,313,713, cumulative 643,006,442,
and ticks 36. No calibration-site, DOS-time service, restore58, IRETD12, result
change or RET event was observed. Result `104786B8` stayed 0. The actual frame
remains DOS/4GW text only; there is no player scene, movement input or gameplay.

Saved instruction bytes at the IDT12 target decode as `PUSH CX; MOV CX,104C;
CALL 52D8; POP CX; far JMP 0088:0030`. The cached SS is already invalid at entry
(`pm_ss_valid=0`, SS=`CC20`, cached base=`CC200`, mask=`FFFF`); each observed
step re-enters the same stack-fault target without reaching the call. This is
an observed repeated exception-entry loop, not progress toward the tick 37
calibration boundary. **The remaining control-flow question is which preceding
protected-mode segment/task transfer first invalidated SS, and whether that
transition followed the original DOS/4GW path correctly.** This checkpoint
already starts after that transition; post-step metadata cannot identify its
first cause. No repair or further waiting follows from this evidence.

New diagnostic-state archive: this run's
`remote-evidence/continuation/complete.checkpoint.gz`, compressed SHA-256
`15963ec4f5534e735223cbe32d187b29ba21d949791d1f4a4979ab0a631174f0`,
decoded SHA-256
`e6a94373d3b2794a0c917e6460d8fe31d75679b5f12360b1dacd38e588b55b82`.
The advanced entry `b0316de8` and original archives remain intact; all 93 recovery
source hashes remain exact. `RECOVERY.md` records no-step restoration and the
bounded trace. Do not reboot, repeat menus, extend runtime or change clocks to
escape this saved loop. Any first-transition investigation needs separate
bounded authorization and earlier evidence, with an independent regression
before a demonstrated source repair.

All 91 remote evidence members and compressed/decoded archive hashes were
retrieved and verified before delegated shutdown. Boat `bx_stcqex2q` is STOPPED
at `2026-11-02T09:13:22.478Z` (original expiry `10:01:41.939Z`); all five roots
and child groups and all own local helpers are absent. `/home` remains above
2 GB free. This publication changes documentation only.

## First-invalid-SS investigation: bounded valid-state checkpoint, 2026-11-02

**The first invalidating transfer remains unlocated; no emulator repair is
demonstrated.** Run `20261102-gta1-first-invalid-stack-transfer` statically
audited the retained observations and exact segment/task/exception sources,
then used one authorized continuation from the original authentic DEMO24 entry
(`b0dcbd0d`, child dispatch 19). Neither invalid-SS checkpoint was resumed.
Original archives, executable, batch route and default 550000/tick1/IRQtrue
scheduler remained unchanged. No boot or menu replay occurred.

Independent no-step full native/host/child/batch parity passed. Raw observation
preserved every RAM byte, all 249 native globals and the complete checkpoint
graph. One scratch-only missing `u32` export was corrected before any guest
step. Full paging/segment/task/exception, native/full-host/batch same/fresh-process,
input/files/rename/temp tests and the locked build passed (actual 0, 127.375 s).

The **single 60-second observation stopped at its cutoff**, without observing
SS validity loss or post-step vector 10/11/12/13. It executed 3,703,625 runner
steps, observing 57 TR changes, 4,979 SS-cache changes and 1,129 mode changes.
Final state is `0080:B1CA`, child dispatch **8,640,320**, cumulative 631,333,049,
tick 15, IRQ 45, host services 558; SS=`00A8`, base=`145E20`, valid=1,
limit=`88BF`, access=`92`, mask=`FFFF`. The live SS descriptor bytes are
`bf88205e14920000`. Observation is at ordinary runner boundaries: paged steps
reach one instruction; nonpaged slices can contain multiple instructions.
Host-thrown/delivered exceptions need not publish a post-step vector, so the
zero vector counter is **not proof of an exception-free interval**. Bounded
before/after instructions, descriptors, hidden caches, TSS/gates and stack bytes
are retained; there is no invented first-fault or first-transfer record.

Intel's [MOV SS rules](https://pdos.csail.mit.edu/6.828/2018/readings/i386/MOV.htm)
require rejection before publishing a bad ordinary SS load. In contrast,
[task switching](https://pdos.csail.mit.edu/6.828/2018/readings/i386/s07_05.htm)
can commit the incoming task before segment validation fails. With the retained
late GDT limit `3FFF`, selector `CC20` is out of bounds: an ordinary load requires
`#GP(CC20)`, incoming task validation `#TS(CC20)` (plus EXT when applicable).
The historical table at the actual load is still unknown. The permissive
`sset`/`pm_cache_ss` path is a candidate, not a demonstrated GTA1 cause.

The exact remaining cause is the SS reload/task-cache publication between this
proven-valid checkpoint and child 20,313,713's invalid `CC20` state. Earlier
retained `0088:0932`/SS=`00A8` at child 20,236,090 records a selector, not hidden
validity. No extension or second continuation was performed. Final pixels are
DOS/4GW text only, with no player scene or native movement response.

The new complete checkpoint is this run's
`remote-evidence/continuation/complete.checkpoint.gz`, packed SHA-256
`ffecce96774562b1616c8557e69c47cea85cb7588565e0928b7005b39ca86d9d`, decoded
`e09593792461838513897ca1d3af3ba10ae8ca30d6a903fc7122cce37723b903`.
It passed independent fresh-process full-state parity. Finalization completed
at 71.722 s; OS wait 71.807 s, actual 0/group absent, within the 130 s ceiling.
Recovery instructions and source pins are in this run's `RECOVERY.md`.
All 75 evidence members and both checkpoint hashes were independently verified
locally before delegated box `bx_h74rb4w6` shutdown; STOPPED at
`2026-11-02T10:02:28.337Z` (original expiry `10:49:57.721Z`). All four remote
roots/groups are absent. This publication changes documentation only.

## Advanced valid-stack interval: actual exception observation, 2026-11-02

**SS remains valid at child dispatch 16,342,016; the first invalidating
publication is still unlocated.** Run `20261102-gta1-valid-stack-interval`
continued exactly once from the preceding complete `ffecce96` checkpoint at
child 8,640,320. It stopped at the 60-second cutoff without observing validity
loss or an actual segment/stack exception. The remaining checkpoint interval is
**16,342,016–20,313,713**, a difference of 3,971,697 child dispatches. No known
invalid-loop checkpoint, boot or menu route was replayed. The original 93-source
closure, executable, full native/host/DOS/child/batch state, authentic
GTA.BAT → K → generated DINO.BAT → DEMO24 route and default
550000/tick1/IRQtrue scheduler were preserved.

Scratch diagnostics now record actual `exception`, delivery, IRET and task-switch
entry/return/throw boundaries and the two paging exception catches. Two canonical
JavaScript modules are compiled in memory with read-only callbacks; disk sources
and the native module remain exact. Records pair old/new SS hidden caches with
raw descriptors, TSS/backlink and IDT gates, instruction/stack bytes, arguments,
thrown objects and native pending state. They do not infer delivered exceptions
from post-step vector metadata alone. Nonpaged native slices can still contain
multiple instructions; no exact triggering instruction is claimed without one.
The new valid checkpoint bounds the next search; it does not prove every
intermediate hidden publication inside a native slice was valid.

Before stepping, an uninstrumented fresh process proved full checkpoint parity.
Observer reads and callback paths preserved every RAM byte, all **249** native
globals and the complete checkpoint graph. Separate plain/instrumented processes
also ended with identical native states and full nested DOS/batch graphs across
retained literal segment/task/exception and exit/file/pixel fixtures. Controls
exercised 46 delivery attempts, eight delivery throws, seven task-switch throws,
one IRET throw and 20 exception catches, including actual #PF attempts. Thus the
new exception paths were exercised independently of the authentic run.

The authentic continuation observed **3,851,998** runner steps, 13,994 SS-cache
changes and 129 mode changes, with no TR change. Actual successful deliveries
were vector `1C` **43** times and vector `21` **6,911** times; 20,776 IRETs
returned. There were no observed thrown/caught exceptions or actual vectors
10/11/12/13/14 during this continuation. Dedicated first-relevant and
first-validity-loss records remain null; neither a first-fault record nor a CPU
defect is invented from that absence. Observation covers runner boundaries and
the instrumented JavaScript boundaries, with the native-slice limitation above.

The saved state is `0088:06DE`, child **16,342,016**, cumulative **639,034,745**,
tick **29**, IRQ **88**, host services **601**, TR=`0208`, CR0=`80000011`,
CR3=`160000`. SS=`00A8`, base=`145E20`, valid=1, limit=`88BF`, access=`92`,
mask=`FFFF`; live descriptor bytes remain `bf88205e14920000`. Next instruction
bytes begin `66b90e00000067f366a5`. Final pixels remain DOS/4GW text, with no
player scene or movement response. No emulator repair is demonstrated or made.

Complete checkpoint:
`scratch/runs/20261102-gta1-valid-stack-interval/remote-evidence/continuation/complete.checkpoint.gz`,
packed SHA-256
`474d79ff5d1e95b59b8ed241b1afed2a739ac39a5db033f85560d3bfb41f0ebd`,
decoded SHA-256
`3025889af65de6e13a21f165edd8bdb013155cb68a6ba937a1911733c9d74df9`
(50,127,563 packed / 137,531,909 decoded bytes). Independent uninstrumented
fresh-process full-state parity passed before finalization ended at **68.604 s**;
OS wait **68.725 s**, actual 0/group absent, within the 130-second ceiling.
All focused paging/segment/task/exception, native/full-host/batch same/fresh-process,
input/files/rename/temp checks and the locked build passed. Run `RECOVERY.md`
retains the exact source pins, observer controls and recovery instructions.
The single continuation allowance is consumed; further stepping requires new
bounded authorization from this advanced valid checkpoint.

All **98** remote evidence members and compressed/decoded checkpoint hashes were
retrieved and independently verified locally before delegated shutdown of own
boat `bx_d4y2wjpr`. It is **STOPPED** at `2026-11-02T11:24:30.765Z` (original
expiry `12:08:20.092Z`). All four remote roots/groups are absent. Temporary local
disk pressure blocked launches before stepping; the coordinator reclaimed
released artifacts, and retrieval left more than 2 GB free. This publication
changes documentation only; the improved observer and complete recovery graph
remain in the ignored run directory.
