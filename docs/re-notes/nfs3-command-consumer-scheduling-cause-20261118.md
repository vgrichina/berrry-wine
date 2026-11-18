# NFS3 command-consumer scheduling investigation, 2026-11-18

No emulator scheduling, clock, or admission defect was proved. No runtime repair
was made. No fresh original was launched, and visible driving and Pause remain
unverified. Preparation ended at a concrete blocker: the normal-browser render
pressure control completed only 48 of the required 60 presents before its finite
70-second preparation cutoff. That scope closed UNKNOWN with no replay or later
endpoint request; its observed counterpart was never started.

Evidence: `scratch/runs/20261118-nfs3-command-consumer-scheduling-cause/`.
The final `result.json` records publication, checks, identities and cleanup.
This report does not reopen the original in report `44210b200`.

## Offline predicates and scheduling

The previous original's Up returned EAX=1 from `0x4c4fe0` at `0x4c4a70`
17 times. Its mode and player selector were zero, simulation cursor 328 and
sequence 332. Disassembly resolves the mode-zero destination to `0x4c5126`:
the signed comparison `(simulationCursor + lookahead) <= sequence0` returns 1;
otherwise it returns 0. Mode one returns 0, and modes two through four use a
different branch. Initialization sets the mode-zero lookahead to 4. Lead 4 is
consistent with that rejection, but the internal comparison's operands were
not dynamically observed. This is an offline predicate explanation, not a new
measurement of the exact taken instruction. The retained disassemblies and
`prior-gate-analysis.json` preserve the distinction.

The previous Right packets were admitted, extracted and consumed by the actual
selected-car path. Escape command 2 was present at counters 6562/6563 while the
consumer cursor was 6496; approximately ten seconds later that cursor was 6617
and the 32-entry ring was zero. The exact `0x4c33e5` lag-greater-than-16 discard
explains loss of those samples, but does not establish why servicing stopped.
The 28 observed Pause decisions returned EAX=0. Gear, binding and hold duration
are not established explanations.

The old native block observer changes dispatch by disabling chaining/uops and
records roughly 25.9 million callbacks. Its ten-second gap cannot be treated as
normal guest-worker performance. The new observer wraps actual native `run`
boundaries and existing `get_ticks`/`gpu_stream_kick` imports; it never enables
debug dispatch, invokes an extra guest poll, reads a read-and-clear sleep flag,
writes guest memory, or changes time. Rows are bounded and sampled at 100ms.
Aggregate run time includes synchronous host-import waits, so it is not CPU
time. Sampling cost excludes wrapper, aggregation and scheduling cost.

GetTickCount, timeGetTime and QPC share `host.get_ticks`; QPC scales milliseconds
by 1000 with a 1MHz frequency. They are not independent clocks. Browser workers
read an atomic tick published by the page's GuestThreadHost, normally every
4ms and subject to page scheduling. CLI threads publish per batch instead.
The host clock also deliberately holds time during runnable-worker boot and
adjusts its origin afterward; startup mapping can further transform elapsed
time. Consequently, a wall/guest delta difference alone is not proof of a
clock defect. Scheduler/host RPC/worker waits were inspected offline; no
defective branch was isolated. `--d3dim-render-owner` explicitly rejects CLI
`--threads`, so the cooperative CLI path cannot qualify the normal browser
guestWorkers route.

## Compiled controls

Real compiled i686 PE controls create a native thread, exercise real USER and
DirectInput, produce/consume a 32-entry ring, read real guest clock APIs, and
render through Device2. No fabricated guest poll or injected game state is
used. The pressure variant repeats drawing eight times and performs bounded
native arithmetic. Frozen sources are Git
`c9d0c2cf720cc13b962ea8b9c2565de0b480d319`; actual native module SHA256 is
`7d347a6a631ab77335a14935a533feb896be71aa2508fc5aa19b1e5df8f096ce`.
Other agents' shared runtime edits were excluded. Retained C sources, unique
executables, invocation scripts and identities provide recovery without media
copies or source archives.

| Native control | Observer | Guest elapsed ms | Produced/consumed | Max producer/consumer guest gap ms | Max lag |
| --- | --- | ---: | --- | --- | ---: |
| Light | off | 2910 | 59/59 | 184/444 | 1 |
| Light | on | 3218 | 59/59 | 171/511 | 1 |
| Pressure | off | 20215 | 180/177 | 451/1603 | 3 |
| Pressure | on | 13031 | 180/177 | 318/807 | 3 |

All four finished 60 frames and exited zero. Pixels matched exactly. The three
unconsumed pressure records were the matching pending tail when the fixture
finished; no divergent ring result was measured. Guest QPC elapsed agrees with
guest tick elapsed to one millisecond. On-minus-off elapsed was +10.6% for light
and -35.5% for pressure. These sequential measurements on a busy shared host
do not isolate observer overhead; their opposite signs prohibit a neutrality
claim or attribution of the earlier original's ten-second gap.
Native observed main-thread maximum wall gaps were 419ms light and 581ms
pressure. CLI termination does not flush the auxiliary worker's observer report;
the guest counters therefore do not supply independent auxiliary wall scheduling.

The normal-browser light pair used actual guest workers and software rendering.
Both reached 60 completed presents; all three inventoried native instances in
each scope matched module `7d347…`. Whole-page screenshots matched. Total
launch-to-checkpoint time was 38043ms off and 32065ms on (-15.7%). Main/auxiliary
observed maximum between-run gaps were 741ms/200ms. Main tick elapsed was
11153ms over 12418ms wall; auxiliary tick elapsed was 11459ms over 11459ms wall.
Startup worker clock holding was not separately instrumented, so this is not
a proved clock failure. Debugger module inventory occurred after measurement.

The browser pressure off control then reached only 48 presents by the cutoff.
Its UNKNOWN report records zero later endpoint requests. No observed pressure
case, game-field-reader qualification, or original followed. Earlier native
cooperative/incomplete controls, the incompatible CLI option preflight, an
overweight pressure fixture, and a sealed-loader preflight rejection are
retained as failures and excluded from the passing pairs above.

## Scope and completion

The new observer and focused regression are preparation tools, not an emulator
repair. The regression checks unchanged native return values, exactly-once
imports, bounded samples, read-only guest memory, no debug/read-clear calls and
actual WebAssembly instance identity. Focused checks, compiled controls and a
locked full build are required before publication.

The browser's existing guards are 500ms confirmation /15s game freshness,
whereas this task specified unchanged 800ms/45s and independent 800ms UP.
A coordinator board note at 03:10:36 permits retaining the browser guards.
No guard was changed and no original input was issued. Regardless of that
clarification, failed pressure qualification independently prevented the
authorized original. The original allowance and conditional repair allowance
remain unspent. Native USER/packet consumption in authored controls does not
prove visible NFS3 driving or Pause. Ordinary game Quit was not attempted.

The original 135 media pins, genuine chooser and module were rehashed unchanged.
Unchanged 70062/9191/0888 and observer proofs are reused only for their prior
routing, async-owner, loader and observer claims. Finite native supervision,
actual waits, both EOFs, independent watchdog receipts and owned-process cleanup
are retained. No box was created; ID, expiry and stop receipt are null. Only two
selected named whole control PNGs are retained. The task ends with the concrete
preparation blocker, ownership released and no held investigation.
