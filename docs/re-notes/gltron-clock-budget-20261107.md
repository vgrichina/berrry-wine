# Cooperative GLTron clock and runnable budget, 2026-11-07

The missing pump observation is repaired and locally exercised before one fresh
passive original. The exact traced boundary works: cursor eligibility,
function callback, semaphore grant, consumer execution and header resubmission
all occur before the next clock publication. Main receives its full configured
producer budget. No incorrect completion or runnable-selection primitive is
demonstrated, so no runtime source change or menu repair is claimed.

Evidence is `scratch/runs/20261107-gltron-clock-budget/` (ignored). This adopts
published `ac1bcecee` and reuses the ring arithmetic, decoder and callback
controls from the preceding investigations. One worker, one UUID, one original;
no nested workers, second original or changed game configuration.

## Observation placement and local production check

The previous wrapper tried `ctx.pumpAudioCompletions` inside `createAudioHost`.
That field is assigned later by `createHostImports`. The new `boundary.cjs`
wraps the returned host's **`pumpWaveOutCompletions` property**, before
host-imports copies it to the context. It wraps existing cursor reads and
records their results; it never asks for an extra cursor read. A context wake
accessor also preserves hooks assigned after factory return.

`test-placement.cjs` calls production `createHostImports`, opens the actual
22,050-Hz stereo 16-bit format, and submits one 22,048-byte request at clock
3,000. Three explicit production pumps observe no completion at 3,000 and
3,200, cursor 17,640 at 3,200, then completion at 3,400 with cursor 22,048.
The observed serial matches submission and completion, and the late-assigned
wake fires once. This passed before original launch. Missing hooks are not
treated as zero events: the original CLI uses synchronous function callback
admission in the pump, with its actual guest semaphore release traced below.

The original observer also wraps actual WebAssembly `run` calls, recording
instance identity, current guest thread, requested block budget, yield state
and `get_last_run_blocks` after return. Every original call is forwarded once.
Clock records come from the existing batch publication. Diagnostics neither
run extra guest slices nor change the selected clock or audio state.

## Same-request chain and actual execution budget

`boundary.jsonl` contains 631 records over the first 10,000 synthetic ms after
the first output submission: 50 complete publications/pumps, 42 submissions,
40 completions, 40 semaphore releases, 244 guest runs and 204 scheduler slices.
The initial publication is partial because observation begins inside its
consumer slice. Counts and negative findings apply to this explicit window.

The first two headers are submitted by instance 2 / guest T2 at clock
13,907,200. They have byte frontiers 22,048 and 44,096, and deadlines
13,907,449.977324 and 13,907,699.954649. Their callback owner is instance 1 / T1.

| Clock | Existing pump cursor | Request 1 decision | Execution before next publication |
| --- | ---: | --- | --- |
| 13,907,400 | 17,640 | Remains queued | Main retires four 1,000-block slices |
| 13,907,600 | 35,280 | Completes frontier 22,048 | Callback on T1 grants T2's semaphore; T2 resubmits header in 17 blocks; main retires four 1,000-block slices |
| 13,907,800 | 52,920 | Request 2 completes frontier 44,096 | Same grant/resubmission sequence and main budget |

The first chain is serial 1: completion record 23, guest semaphore release 24,
resubmission 26, T2 run return 27. The release grants handle 917509 to the
waiting consumer; its next selected run uses that grant and submits the reused
header. Addresses and handles identify this execution only.

`analyze-boundary.py` checks every observed queue entry against the cursor used
by the actual pump, every completion against its own due time, and every
completion's same-publication callback grant and consumer resubmission. All
40 pass; **zero early completions is now an observed result for this window**.
All 50 full publications give runnable main exactly 4,000 retired blocks,
with no wait yield at admission. Each consumer refill takes 17 blocks from
its requested 1,000-block slice. No missing wake or producer starvation by
runnable selection is shown.

## Clock policy and precise remaining primitive

`test/run.js` publishes `tickState.batch = batch`, resets intra-batch calls,
and pumps completions before execution. `lib/batch-clock.js` deliberately
defines `batchTicks()` from the outer batch count, default 200 ms per batch.
The cooperative path supplies one ordinary main slice and three interleaved
main slices, each 1,000 blocks. Thus this trace models only **20,000 main basic
blocks per guest second**, independently of host throughput or guest work per
block. At 88,200 output bytes per guest second, one 249.977-ms header permits
about 4,999.546 main blocks. This is a configured capacity ratio, not evidence
that the scheduler withheld an admitted slice.

Production browser behavior differs explicitly: `host.js`'s
`_beginGuestTickBatch` publishes elapsed host time in ordinary operation;
`_guestAudioClockMs` uses the scheduler deadline clock when active. Running
Web Audio voices use AudioContext cursor time. Frozen operation has separate
guest execution accounting. The CLI's deterministic batch clock is therefore
not an observation of browser elapsed playback time. These source semantics
explain why fast host execution cannot rescue the CLI capacity ratio.

The documented audio contract returns output buffers after playback or reset;
it does not guarantee a guest decoder an arbitrary minimum CPU budget before
playback advances. See Microsoft's [WOM_DONE documentation](https://learn.microsoft.com/en-us/windows/win32/multimedia/wom-done)
and [WAVEHDR flags](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-wavehdr).
No reset or premature completion is demonstrated here. Previous ring/decoder
evidence already establishes that consumption prevents the fill threshold;
repeating those censuses would not establish an incorrect clock primitive.

The remaining primitive is **the unconditional CLI outer-batch time charge at
the publication before the audio pump**, rather than callback or semaphore
delivery. A defensible correction needs a stated emulated CPU-time model:
which retired work charges time, how runnable sibling work is accounted, and
how an idle machine advances to device deadlines. A meaningful failing test
should hold that work constant while changing slice partitioning and verify
the chosen time/deadline invariant. Current tests intentionally specify batch
time; they do not specify a guest CPU speed or such an invariant. Neither a
smaller tick constant nor an audio-only alternate clock would prove that model
correct. No WAT/JS change is justified by this task's evidence.

## Verification, recovery and shutdown

Local production observation placement, waveout-audio, wave-callback-scheduler,
waveout-callback-function-wasm and batch-clock tests pass. Existing controls
remain referenced without rerunning their censuses. Fresh native GL/WGL checks
pass, and the mandatory locked build passes. Original startup still does not establish menu, ordinary play, audible
quality, both backends or full 27-title coverage.

Runtime Git SHA is `fd948930ff9dca10beb624e7ffcd11e570df5412`.
`relevant-source.patch`, the untracked wininit helper patch, owned helper
patches and `runtime-pins.json` retain the relevant deviations. Game media is
referenced by existing path/size/SHA-256 in `media-refs.json`; no source/media
archive was created. Standard module SHA-256 is
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`
(2,182,500 bytes). All 131 loaded runtime reads match pins; all 545 staged
file pins and 162 native dependency pins match before/after.

The original exits zero after 125.797 wall seconds, with final synthetic clock
59,721,600 ms. Whole-run observer counters are 298,609 pumps, 169,399
submissions and 169,397 completions. They are not equal-progress performance
comparisons. The wake-hook counter is zero because this CLI path has no
`wakeWaveCallback` hook; the actual callback/semaphore wake is observed directly
in the bounded chain, not inferred from that counter. Lifecycle samples add
2,058 paired callback admissions/returns with exact saved-context restoration
and 2,030 sampled grants consumed. These samples are not whole-run counts.

All six screenshot requests acknowledge. Seven PNG pixel inventories are
uniform; reviewed 5-second teal and 80-second black captures confirm no menu.
No gameplay DOWN/UP, UNKNOWN, replay or further original occurred. Encoder
geometry stays zero in samples. This remains an unregistered-app investigation
note rather than a candidate-corpus completion.

46 artifact references / 41 unique contents / 17,384,507 referenced bytes were
retrieved and size/SHA-256 verified before normal shutdown. Local and remote
launch free disk exceeded 5 GB. A detached independent 25-minute deadline
watchdog and normal-stop delegate were armed during provisioning and observed
before guest launch. The supervisor was launched before allocation; the
immediate first read of child arm files raced their creation and failed, with
both arm files verified on the next read. Heartbeats and immutable deadlines
are retained. No idle handoff was used.

Box `bx_c7sn7qub` is **archived**, current expiry null; original expiry was
2026-11-07T23:45:42.619Z. Normal stop `stop_0d6bb4b0e5ebd55d` completed at
2026-11-07T23:24:17.182Z, forced=false, error=null. Both delegates exited zero;
the supervisor has no remaining children. Guest processes were absent before
stop, with no held input, ports or profiles. No resume, delete or public
deployment occurred. This bounded task ends with the exact clock-accounting
primitive above; no menu repair, audio-quality, gameplay, parity or coverage
completion is claimed.
