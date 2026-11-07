# Aranna natural animation completion, 2026-11-07

No emulator mismatch was demonstrated and no emulator implementation was changed.
Read-only disassembly corrects the previous diagnostic's interpretation of
animator byte `+0x7e`: it behaves as a consumed pose-dirty flag, cleared by the
pose-update exit, rather than an animation enable that must remain set. Its
sampled zero does not explain missing completion. A generated native-i386/WASM
control found no difference in the nearby x87 comparison/branch patterns or the
indirect C++ callback convention. Natural title completion remains unexplained;
world gameplay remains unverified. Earlier menu/Choose Hero evidence is accepted.

Evidence and reproducible diagnostic inputs are in
`scratch/runs/20261107-aranna-animation-completion/`. This follows the completed
[EULA/title diagnostic](aranna-eula-title-diagnostic-20261107.md); it does not
repeat its corrected EULA route or infer a clock defect from clock-read ratios.
No original was launched, no box was created, and no guest memory, configuration,
assets, state, or completion signal was changed.

## What the retained evidence actually proves

The predecessor's resolved snapshots retain animator `167032084`, frontend
receiver `150089148`, clip fields `+0xc4=13`, `+0xd4=13`, `+0xd8=0`, `+0xdc=1`,
pending-clip byte `+0xe4=0`, and binding
`[0x4c0236,0,150089148,0x4f3cab]` at animator `+0xf4`. Frontend state is 4 with
neither an immediate nor delayed pending request. The advancing guest clock
does not measure the `float dt` actually passed to this animator.

The retained observations contain actual frontend execution at `0x4bccac` and
branch-edge observations at `0x4bccbf`/`0x4bccca` during completed transaction
298, at 05:15:49.436Z. The transaction's outer wrapper returns at `0x43b4af`.
`retained-title-executions.json` preserves these records and their arguments.
These are positive observations of the input/frontend path, not instruction
traces inside the animator. In particular, event 74 reports branch edges; its
fall/target fields must not be presented as a callback-entry probe.

The observer transforms retained by the preceding runs probe frontend/state
admission and wrapper paths. They do not probe `0x69b615`, `0x69deb8`,
`0x6a4bd7`, `0x69b048`, `0x4f3cab`, or `0x4c0236`. Thus a missing callback
record cannot prove that the callback was never invoked. A binding still present
in two snapshots cannot establish its invocation history either.

Personally inspecting the retained images also corrects a predecessor reporting
error: `original/response-11.png` is teal desktop, but
`original/response-12.png` shows the title over stone doors again. Response 12
SHA-256 is `330d41b9883271405b69e7d4fc45b67e301133c7c55a511e26d897ec5688151a`.
This does not establish why presentation changed, or establish menu/gameplay.
The original files remain in the predecessor run; no duplicate media/capture
archive was made.

## Static lifecycle, distinguished from observed execution

Addresses below come from the existing demo executable
`scratch/game-media/aranna-demo-20261105/extracted/DSLOA.exe`, SHA-256
`fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589`.
Bounded read-only disassemblies are retained with this run. These establish code
paths, not that each path executed in the retained original.

| Boundary | Behavior established by disassembly |
| --- | --- |
| `0x4bf1bb` | Tests/sets the frontend's one-shot `+0xe4`, calls `0x4be043`, then constructs and installs the completion binding through `0x69b012`. Repeated title input need not restart this path. |
| `0x4be043` | Requests clip 13 through `0x69b244`, clears the existing binding through `0x69b027`, and calls `0x69b615` with zero `dt` before the new binding is installed by its caller. This ordering alone does not prove an early-completion race. |
| `0x69b244` / `0x69b3d1` | Records requested clip/flags and a pending byte. Clip 13 has special request handling. Pending work is accepted only after readiness checks; `0x69b615` clears pending only on success. |
| `0x69b615` | Processes a pending clip, checks the resource/clip table and readiness, passes its `dt` through `0x6aaa55`, and can call the separate update function `0x69deb8`. It does not use `+0x7e` as a general time-advance gate. |
| `0x69deb8` | Tests other gates (`+0x78`, `+0x7c`, override/dirty/resource conditions), updates pose state, and sets `+0x7e` on changed paths. |
| `0x69e7d0` / `0x69f1bf` | The pose body can skip when `+0x7e=0`. The common exit unconditionally executes `and byte [ebx+0x7e],0`; children can inherit the flag immediately before it is cleared. Zero is therefore an ordinary possible post-update value. |
| `0x6a6a11` / `0x6a4bd7` | Resource/phase routines advance time and produce status masks, including endpoint handling. They contain x87 compare/status/parity branches. Their invocation and inputs for this title animator were not observed. |
| `0x69b048` | Dispatches the binding at `+0xf4` through its adapter pointer, passing binding address and payload. The static caller connecting natural clip completion to this dispatcher remains unidentified. |
| `0x4f3cab` / `0x4c0236` | Adapter computes receiver plus adjustment and calls the member pointer. The installed frontend member requests state 5 through `0x521f84` with zero delay. |

The resource manager pointer at animator `+0xe8` is `147347508` in the retained
snapshot. Its pointee, active phase/list, clip readiness result, status masks,
and actual `dt` history were not retained. A nonpending clip request with clip
number 13 does not supply those missing values. Neither a Win32 timer fault nor
an x87 branch fault follows from these snapshots.

## Generated CPU controls

`generate-fixture.py` authors a small assembly fixture from independent expected
CPU semantics. No guest bytes are copied into it. The same linked code/data run
as a native i386 Linux ELF and as a generated PE loaded by the emulator;
`check-fixture.cjs` checks each against explicit expected condition bits and
results. The native run is an independent CPU oracle, not a native Windows or
original-game reference.

The 126 cases cover less/equal/greater/unordered, negative, signed-zero, and
small finite values, with `TEST AH` masks `0x05`, `0x41`, and `0x44`. They check
x87 C0/C2/C3, parity/zero, actual `JP`/`JNP`/`JNE` branch results, and stack TOP
after pop. Both intervening `FSTP` and contiguous
`FNSTSW AX; TEST AH; Jcc` shapes are used.
The generated indirect member-binding control independently checks nonzero
receiver adjustment, payload, exactly one call, and restoration of ESP through
the cdecl adapter/thiscall `RET 4` combination.

All cases pass on native i386 and on both tested WASM binaries, with
`set_x87_pipeline4_fusion` and `set_x87_affine_fusion` set to 0 and to 1 before
decoding. These are toggle configurations, not a measured count of fused-handler
entries. Results retain exact module/fixture/ELF hashes. The original's actual
retained owning module is SHA-256
`e7d6617cecdf3275db05454763c07cad7e6eb557afc2a14ca3413d960328fd31`;
its source/binary provenance remains the predecessor's pinned closure and
observer-transform ancestry, not the current checkout's build. This run records
the current checkout SHA, runtime file hashes, relevant dirty/new runtime patches,
and generated input patches without archiving any source tree.

The focused existing `test/test-x87-compare-eflags.js` and
`test/test-x87-dc-fcom-alias.js` also pass. The locked build and its final result
are recorded in `locked-build.log` and `validation.json`. These controls exclude
the tested instruction/calling-convention mismatches; they are not an
old-implementation-failing regression and do not prove whole-emulator or game
correctness. No repair is claimed.

## Precise remaining evidence

A causal explanation needs an unmodified original's bounded owning-CPU history
for this animator, starting before the one-shot title request: entry/return of
`0x69b615` with actual `dt`, pending/readiness decisions, the resolved manager's
phase/rate/status evolution, and the natural caller/event leading to `0x69b048`.
The binding installation and any dispatch must be ordered against those events,
with adapter/member entry and resulting state request recorded. This separates
no update, resource not ready, phase not reaching its endpoint, missing script
dispatch, and incorrect CPU/callback execution. The exact first divergence then
needs independent CPU/API semantics or a native reference before a repair.

Another EULA/clock-read run or uncorrelated callback-delivery test would not fill
this gap. No fresh original run was spent without that observation plan. No
runtime is assigned or left running by this task; predecessor box `bx_ean6556p`
was already archived with verified cleanup. A transient shared-disk drop below
2 GB was reported on the messageboard; large allocation was avoided and the
coordinator restored headroom before further work.
