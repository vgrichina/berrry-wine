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
