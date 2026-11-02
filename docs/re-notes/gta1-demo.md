# Grand Theft Auto: original 24-bit DOS demo


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
