# CLI CPU service clock

The CLI defaults to an aggregate virtual CPU clock. This repairs the old
publication-dependent charge: the same 4,000 retired blocks used to represent
200 ms in one outer batch and 2,000 ms in ten. Device cursor, waveOut eligibility,
GetTickCount and scheduler deadlines now use one service clock.

The model is `floor(totalRetiredBlocks * 1000 / blocksPerSecond) + idleMs`.
A block is the interpreter's existing retired basic-block unit, including
callback and loader work. It is not an x86 instruction or a hardware cycle.
The default is 5,000 blocks/second, preserving the previous nominal single
1,000-block, 200-ms slice capacity. It is deliberately independent of game
startup results. `--cpu-blocks-per-second=N` selects a different abstract CPU.
This change establishes accounting, not a claim that this default reproduces
any particular PC's speed or makes every game playable.

All guest threads share one aggregate service budget even when Node runs them
on separate host CPUs. Host parallelism does not create extra virtual cores.
A shared integer ledger banks wrap-safe deltas from each actual WASM instance's
`get_blocks_now`. Imports publish live progress before externally observable
host calls; export facades bank final progress, including nested execution. Native
`blocks_now` includes the active enclosing run budgets during recursive runs;
otherwise entering a nested run temporarily hid outer progress and the ledger
interpreted that regression as a 32-bit wrap. The outer prefix is saved and
restored alongside the existing budget, without changing guest contexts.
Workers use the same ledger for their local get_ticks import.
Export facades record time when an execution actually retires work. Sleep and
bounded-wait origins use that saved time, including Worker replies, so later
sibling service or delayed result delivery cannot postpone a deadline. Read-only
diagnostics retain the original execution time. Worker timer hints retain their
observation time and spin/vblank parks retain absolute native deadlines. Fractional ms
survive slice boundaries; clock reads and outer publications add no time.
This specifies time at service observations, not deterministic ordering of
races between parallel guest threads or deterministic external input delivery.

When all observed frames are blocked, the runner advances to the earliest
sleep, bounded wait, timer, spin, vblank or audio deadline. It gives runnable
siblings their existing turns first. The idle hint does not poll waitSingle
or waitMultiple, consume a semaphore, restore a callback frame, or run a parked
thread. Reserved grants, callbacks being offered and in-flight Workers forbid
idle advance. A complete pass with no retired work is required before idle
advance, so a late signal gets another ordinary scheduler poll. Unknown asynchronous states remain conservative. An empty message
poll can advance to the next observable millisecond; an indefinite object wait
with no device deadline cannot invent elapsed time. waveOut still requires its
own cursor eligibility; idle advance does not force a completion.

Service mode uses elapsed-time wait deadlines without legacy minimum-batch
poll floors or early timeout shortcuts. Zero-time origins remain valid wait
origins. Existing callback routing, wait completion, semaphore grants and round
robin policy remain owned by their existing implementations.

`--clock=batch`, an explicit `--tick-ms-per-batch=N`, and an explicitly registered
`cliTickMsPerBatch` retain the old batch contract. `--real-ticks` retains its wall
clock. Scripted startup dilation and gameplay benchmark clock mappings require
`--clock=batch`; they are separate time models. Runtime tick-ms changes require
that explicit batch selection.

Regression: `node test/test-service-clock.js` runs actual built WASM with the
same audio header, work and CPU state across 1/2/10/40 partitions, before and
after an identical idle wait. It covers main plus actual guest-worker transport,
shared clock reads, runnable sibling exclusion, earliest idle deadlines,
reserved grants, timed waits and non-consuming clock reads.
`SERVICE_CLOCK_BASELINE=1` selects the old policy and fails the same partition
assertion. The default test also invokes actual-WASM nested-run and actual CLI idle-boundary
cases. The nested counter test failed before the native fix (`10 -> 1`) and
passes with 1,007 total blocks. `SERVICE_CLOCK_CASE=worker` isolates real Worker
transport; `SERVICE_CLOCK_CASE=idle` isolates all-blocked deadline advancement.
Existing clock/audio/callback/scheduler/wait/grant tests are retained.
Evidence and original GLTron outcome: run
`20261110-gltron-partition-invariant-clock-repair-1740` (ignored artifacts).

Original/default GLTron remains unqualified. The repaired native-counter build
ran for 120 seconds in cooperative and real Worker modes; the final wait-origin
revision ran another bounded 120-second Worker check. All exited normally with
separate stdout/stderr EOF, accepted screenshot commands and full black
640x480 captures personally reviewed. They reached audio (48,942 accepted
cooperative callbacks; 33,074 in the final Worker run), but recorded zero scene
draws/vertices. No gameplay was observed. The accounting regression is repaired;
abstract CPU throughput and original startup/audio progress still need separate
investigation. Full27 remains open. No rate was selected from menu success.

## Real-time CPU/device alternative

`--real-ticks` is a separate, existing general policy: the guest CPU runs at
the interpreter's available host throughput, while guest timers and headless
devices use elapsed host time (1x unless an explicit time scale is selected).
It makes no emulated Pentium frequency claim and gives no throughput guarantee
on a busy host. It is suitable for measuring whether available execution can
keep up with a real-time device. It does not calibrate the abstract service CPU.
The deterministic service default and its aggregate 5,000-block rate remain
unchanged. No GLTron-derived rate is introduced.

An app-independent control exposed a defect in that alternative: the CLI bound
headless audio to `batchClock.batchTicks()` even when guest threads selected
wall time. One outer publication could consume 200ms of audio while the guest
observed only 100ms; ten publications could consume 2,000ms at the same elapsed
time. The repair binds shared audio to `guestClock.publish()`, the same selected,
non-consuming clock already published to guest threads. Batch and service modes
retain their existing source; real-time mode now also applies its selected
scale/startup mapping to device consumption and completion eligibility.

`node test/test-guest-clock-source.js` executes the actual CLI binding with
production host imports, actual built WASM and a 22,048-byte waveOut buffer.
It holds elapsed time and 4,000 retired x86 blocks fixed across 1/2/10/40 work
partitions. At 100ms a 22,050Hz stereo 16-bit device has consumed 8,820 bytes
and its buffer remains pending. The test also covers 3x time (completed), a
half-speed elapsed mapping (pending), and non-consuming batch reads. The
pre-repair binding fails the same clock equality assertion. The service-clock
partition, actual Worker, idle and nested-counter regression remains separate.
Evidence: `scratch/runs/20261110-gltron-independent-cpu-cost-cause-1820/`.

One original cooperative run with this repaired real-time alternative used a
predeclared 180-second CLI limit, 240-second total child deadline including
setup/cleanup, and independently prearmed 270-second watchdog. It exited zero
after 183.566 seconds, with actual parent waits, separate stream EOFs and no
pending command. No guest setting/media change or CPU-rate search occurred.
The original music refill returned 467 times; its first return had occupancy
157,312, exceeding the original 155,648-byte exit requirement. All 10,243
observed ring states conserve bytes: 1,944 decodes produced 7,962,624 bytes,
355 reads consumed 7,827,040, leaving 135,584. Decodes still cost
59,252–86,974 retired blocks; no decoder semantic repair was made or inferred.

Full 640x480 captures were personally inspected: the original main menu, GAME
submenu, then arena and yellow cycle with `GAME IS PAUSED`. Ordinary Return
down/up navigated and started the game. A late `keypress:13` emits WM_CHAR,
which did not unpause this SDL game; the final capture remains paused. Moving
gameplay/input qualification and Full27 remain open. A requested A character
arrived after normal CLI exit and was not submitted. The next input check is
ordinary Return down/up to unpause, then the game's turn controls. This run
establishes refill return and original scene/menu progress under the independently
specified real-time policy; it does not change or qualify the default service CPU.
