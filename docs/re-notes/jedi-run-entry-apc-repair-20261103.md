# Production run-entry service guard

The retained opt-in REP debugger candidate rejects unsupported asynchronous service states
at the start of the real production `run()`, before attribution, budget,
queue, CPU or guest-stack effects. The retained exported-entry/ABI guard,
REP element continuation, fault preflight/restart and overlap support are
included in the candidate. **No production code is published.** Final static
review found that its compiler adapter also rejects existing standalone test
closures, so it is not ready to land. The candidate and complete patch are
retained in the ignored run directory; all14 shared code/test paths were
restored to committed main and released. A production exclusive controller,
all-writer protection and original Jedi gameplay remain unqualified.

Run: `scratch/runs/20261103-jedi-run-entry-apc-repair/`.
Interrupted predecessor: `20261103-jedi-export-writer-entry-repair`, thread
`01a1a27e-32bb-7fe0-83d6-2c4b9aeae686`, exact base
`c4db43b81be052cb8cfea7d596edc951220433d8`. Its capacity termination was not a
code failure. Current committed host changes through `64d4033a9` were staged
from Git, excluding shared foreign WIP; all final owned sources match the
recovered tested copies. Alice's landed host census seal is preserved.

## Entry contract and evidence

The predecessor's actual `run(0)` queued-APC case changed shield100 to80,
health bits to4198604 (the interrupted return PC), and ESP by minus12 before
any guest instruction or callback body. It now traps with those values and
the pending service unchanged in the tested candidate. The guard precedes the first global assignment
in `$run`; it does not repair damage or consume a queue to decide admission.

Armed entry rejects an alertable-sleep mark, Win16 task bootstrap, active
audio/timer callback state, or an eligible main-thread animation live list.
An alertable mark is conservatively rejected even with an empty queue or a
different resume PC: a producer may enqueue concurrently. Ordinary unarmed
service code is unchanged. In particular, a zero-block grant by itself does
not suppress native service writes.

`test/test-protected-run-entry-candidate.js` invokes the production function
without replacing its body. Setup uses the actual `SleepEx`, `QueueUserAPC`
and `ReadFileEx` handlers, the animation live-list helper and the production
bound audio callback export. Callback addresses name the unchanged notepad
PE entry; no callback body is created or executed. Nine states pass:

| Tested state | Rejected before effects |
| --- | --- |
| Shared user APC inbox | Yes |
| Two queued user APCs, preserving FIFO links | Yes |
| Private ReadFileEx completion | Yes |
| Mixed private IO/shared user queues | Yes |
| Empty alertable sleep | Yes, conservative rejection |
| Alertable mark with a different resume PC | Yes, conservative rejection |
| Animation live-list service entry | Yes; stale-HWND case |
| Win16 bootstrap entry | Yes; no boot body executed |
| Aborted active audio callback cleanup | Yes |

Every rejection preserves all2277 mutable globals, GPRs, lazy flags, stack,
vitals and the SHA256 of the complete512MiB linear memory, including queues.
After disarming, the same user/IO services build their ordinary callback
frames, empty/mismatched marks retain ordinary behavior, animation removes
the stale entry, and aborted audio cleanup clears its ordinary active flags.
A safe armed `run(0)` still succeeds. The ordinary SysAnimate32 regression
also passes real RLE8 playback, notification, seek, transparency and close.
This does not independently qualify Win16 boot or isolated timer callbacks.

Canonical build module SHA256:
`c81c34d8e5580b84f4c1378b2ade9fbb96f93aa766c07356bf394acad7d9b14c`.
One additional locked full build passed, two total including the predecessor:
`timeout600 flock /tmp/wine-build.lock bash tools/build.sh`.
Each native suite had a300-second outer timeout. The original APC case was
rerun separately and passed. Seven predecessor suites are reused with full
payload SHA checks and exact source matches for the eight retained runtime/
compiler files: exported-entry coverage, generated ABI,19 REP cases, bulk and
absent rejection, scalar CALL, fault restart and decoder overlap. These are
reused passes, not new whole-module equivalence claims.

The new compiler dependency initially exposed two test-harness packaging
omissions: the sealed render graph and its executable cache-control fixture.
Their failure logs are retained. The graph now seals
`tools/protected-writer-entries.js`; fixtures copy it and test invalidation
and changed-code execution. All35 protocol and10 executable cache controls
pass after repair. Production compilation inputs did not change after the
passing full build; only these test harness files changed.

## First remaining unsupported writer; runtime stopped there

The next probe used the **candidate's canonical built artifact**, with no transformed WAT
or manufactured guest code/handler. Notepad's original entry at `0x4010cc`
starts with `PUSH EBP` (`0x55`). With an absent stack destination and
trap-on-unmapped mode2, an armed `run(1)` rejects after committing ESP:

```text
before ESP: 0x40000004
after ESP:  0x40000000
error:      RuntimeError: unreachable, unmapped store to 0x40000000
EIP:        0x4010cc unchanged
flags and shield/health: unchanged
```

`first-remaining-writer.json` and `scalar-fault-frontier.log` retain this
failure. `$th_push_r` decrements ESP before `$gs32` reaches the unmapped trap;
that scalar path is unchanged by this repair. No runtime case, repair, resume
or damage restoration followed. Scalar fault preflight/architectural restart
is the next boundary to address. Source-level export inventories and this
service guard cannot establish a universal writer barrier. Host memory views,
sibling instances, input/scheduler ownership and original gameplay remain
outside the evidence.

## Additional static publication blocker

After runtime stopped at the scalar fault, final static review of compiler
call sites found existing standalone module users such as
`test/test-mci-cdaudio-no-media.js`, `test/test-callback-invocation-tokens.js`
and `test/test-win32-ne-arena.js`. They pass an inline source and empty VFS
to `compileClosure`, without the full production include tree or debugger
global. The retained adapter unconditionally calls `protectClosure`, which
throws `protected export contract requires $rep_store_step` on such inputs.
`static-standalone-closure-blocker.json` proves that rejection without invoking
the compiler or executing Wasm. This is a compiler API compatibility defect,
not a packaging timestamp discrepancy. The export policy needs an explicit,
tested distinction between canonical runtime closures and standalone modules
without creating a bypass for the runtime. No fix or additional native case
was attempted after the first remaining runtime writer.

The passing full build and focused native suites remain valid evidence for
the retained candidate, but do not make that incompatible adapter publishable.
Only this investigation note is committed; the candidate's source, new tool,
regression, harness updates and complete patch remain recoverable locally.

## Recovery and delegated lifecycle

Before using the existing allocation, actual state was idle with verified
snapshot and original expiry `2026-11-03T18:52:34.954Z`. The predecessor's
owned helpers were absent. No new box or subworker was created. Its archive
was recovered first to `/home/user/jedi-recovery.tar.gz`:11661969 bytes,
SHA256 `ef890e4e9f409f90e2ee0be459edd747b8c4761f81cf6ca41adb53deba0b630d`;
all142 payload sizes/fullSHA passed locally. All15852 staged predecessor
inputs were reverified before the declared continuation overlay. Final
source verification covers15859 effective inputs.

The continuation archive is5480896 bytes, SHA256
`fcd5db3704157445238e51f156e7c944ee30c00a5bd011f033495de001550d48`.
All66 payload sizes/fullSHA and all14 owned source files were verified locally
before STOP. Logs, compiled modules, source/input pins, fixtures, scripts and
both initial harness failures are retained in `retrieved/`; the preceding
142-payload archive and original source/input archives remain local too.
`RECOVERY.md` in the ignored run directory gives the reconstruction order.

Heavy runtime ended at18:12:40.606Z and was released at18:13:04Z. All eight
known predecessor/continuation supervisors were absent and8123 was closed.
The task explicitly delegated normal STOP for `bx_h69pvr7n` after recovery.
`stop_cbbaab3a52ae2cb7` completed with `error:null`, `forced:false`;
actual state is **stopped** at18:13:54.757Z. The final snapshot completed and
was verified at18:13:54.719Z. There is no active expiry. Custody returns to
the coordinator; no resume, deletion, successor, deployment, foreign boat or
original Jedi run is assigned here. Local free disk remained above2GB.
