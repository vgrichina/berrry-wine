# KKnD held input and original gameplay verified

Original Evolved / WALKOVER EASY gameplay passed: tanker selection, commanded
world displacement, and a distinct return command with visible movement were
personally inspected by `kknd-held-input-gameplay`. No emulator repair is
indicated by this run. Evidence is in
`scratch/runs/20261106-kknd-held-input-gameplay/`; `goal-evidence.json` contains
asserted guest/input correlations, not screenshot-derived coordinates.

This follows [the edge-consumption investigation](kknd-edge-consumption-20261106.md).
Its short Return press returned left-button result `1` once without observing
the physical held bit; an earlier collector observed current mask `0x10`
without cursor forwarding. Those remain distinct observations, neither proof
of an emulator defect. A missing high bit after release is expected.

## Personally reviewed gameplay

All image names below refer to full-page PNGs inside this run. The inherited
`*-game.png` crops have inconsistent dimensions and sometimes exclude the
tanker; they are not the proof used here. The claw hall and terrain remain
fixed while the same selected tanker changes world position.

| Action | Reviewed images | Guest evidence |
| --- | --- | --- |
| Select tanker after settled hover | `tanker-hover-ready.png`, `tanker-held-selection.png` | Selection event `0x5e7` targets task `5603284`; selected-list node `5167572` links that task to entity `7053380`; green health bar appears. |
| Command east to clear ground `(450,410)` | `move-ground-ready.png`, `move-after-held.png` | Event `0x5f4` targets the same task; entity position changes `(110592,372736)` to `(117697,369796)`. |
| Observe arrival, command west | `redirect-ground-ready.png`, `redirect-after-held.png`, `east-return-ready.png` | Arrival is `(151552,364544)`; subsequent westward positions reach `(86016,372736)`. This segment's event trace overflowed, so no missing-event conclusion is drawn. |
| Command east again, distinct return response | `east-return-ready.png`, `east-return-after.png` | Fresh zero-drop trace records `0x5f4` to the same task, data words `[2,151808,363776,0,...]`, then position `(86016,372736)` to `(94376,372736)`; tanker visibly turns and travels east. |

All reported positions belong to entity `7053380`, task `5603284`, sprite
`6808196`, player `2`, type `31`, id `15`. Camera stays `(36864,259072)`.
Coordinates are the original sprite's fixed-point words (scale 256); movement
is established from those guest reads, corroborated by personally viewed
captures. The first movement segment has 12 distinct coordinate pairs. The
later eastward command is a separately reviewed ordinary input and guest event,
not passive continuation of the initial order.

## Physical hold and consumption

Each gameplay press used ordinary DOM mouse down, an independent eight-second
release timer, and mouse up. `terminal-state.json` preserves trusted down/up
events with physical button values. `held-page.jsonl` reads the physical mask
before and after passive synchronous snapshots inside the actual owning Worker;
`held-worker.jsonl` preserves those snapshots with common epoch timestamps.
Original API answers and exceptions are forwarded unchanged. There are zero
guest writes or breakpoints.

| Zero-drop segment | Trusted hold | Guest left high-bit answers during hold | Same-owner snapshots during hold | Physical mask 1 observations during hold |
| --- | --- | --- | --- | --- |
| Selection | 8017.400 ms | 56 | 18 | 37 |
| First east order | 8032.260 ms | 40 | 16 | 33 |
| East return order | 8002.005 ms | 144 | 23 | 46 |

These segments also observe current and copied terrain held mask `0x10`, and
pressed input. Selection/order dispatch occurs shortly after physical release
in the retained trace; physical held polling, guest edge retention, dispatch,
and resulting movement are separate observations. No claim requires a high bit
to remain set after release. See `held-selection-observation.json`,
`move-observation.json`, `east-return-observation.json`, and `goal-evidence.json`.

The first warp-and-press reached the guest but did not select a unit. White
hover brackets alone were insufficient: the selected list was empty. Settled
hover subsequently produced original collision `-2` send/take messages carrying
the tanker task; the next press selected it. This establishes successful input
and gameplay without establishing an x86/Win32 discrepancy or an exact failure
cause for the earlier attempt. Generic UI cursor `43a521` is not the terrain
path: original terrain copying at `42b3ad` into `4758f8` was observed.

## Guards, evidence limits, and lifetime

Strict actual-owner/module, reviewed command envelopes, and closed-sibling
guards were retained. Actual bytecode and instance checks identify owning Worker
slot `0`, endpoint `1`, thread `1`, 536870912-byte memory; module SHA-256
`43a0097ab79e1e9102d6f12411485a359ebe10b03af5fcf22675b75ad701a081`.
The second mixer Worker was not substituted for the game owner.

Initial full trace and the long idle interval before westward redirection
exhausted the 10000-row cap. Overflow is explicit in their retained evidence,
not evidence of absent guest polling. Run-only observer checkpoints saved and
hashed the bounded old buffers before draining host arrays, then used sparse
observations in the SAME owning instance. The cap was retained; guest state was
never modified. The final selection, first displacement, and east-return
segments have zero trace and position drops. Ordinary invocation/observer errors
were corrected within the same browser lifetime; no browser relaunch or guest
reload was used.

All three ordered FINAL gates and independent cleanup checks passed before
execution. The immutable coordinator window was 14:27:55.215738–15:12:55.215738Z
on 2026-11-06, including cleanup. The one original browser ran
14:32:15.610–14:50:16.047Z. The launch wrapper exited 143 while its original
browser survived; the runtime lock holder was subsequently absent. Continuous
kernel lock coverage is therefore not asserted. The coordinator explicitly kept
successors read-only and verified the same browser alive. No competing runtime
was observed, no deadline extension was taken, and no new lifetime was started.

`final-cleanup.json` independently verifies 25 owned PIDs absent, three ports
refused, two profiles absent, four locks free, cleanup within the original
window, and 4.935 GB free on `/home`. No boxes were assigned or modified.
Production source freeze and physical semantics `1912f8501`, including message
snapshots, were preserved.

## Validation and recovery

Focused bootstrap, hold, strict owner/closed-sibling controls, physical drag,
35 button-hold controls, and a real browser/Wasm bootstrap fixture passed.
`flock /tmp/wine-build.lock bash tools/build.sh` passed standard and compatibility
builds before launch. `focused-checks.json`, control logs, and
`locked-build-result.json` retain the commands/results. No implementation change
was made, so no failing discrepancy regression or causal emulator patch is
claimed.

The tested source base is Git `1fdbb70c41ca3ac3eb9773fec609b7d368941406`, with
`prelaunch-source.binarydiff` retaining relevant uncommitted source, including
pre-existing untracked `lib/wininit-boot.js`. `prelaunch-source.json` pins 325
source/build files; all remained unchanged at final verification. Final Git
identity, relevant binary diff, new documentation patch and all owned helper
patches are retained as `final-source.*`, `final-new-doc.patch` and
`final-new-helpers.patch`. Git plus these patches is the source recovery recipe;
no source tree archive was made.

Original media remains at `scratch/game-media/kknd-demo-20261106/installed/`;
`KKND.EXE` SHA-256 is
`b2e1a476bfe766edf802c9fa4d0fed2ed841a8d1b50e1a8ee27ceae33afe5d8a`.
All 16 original media files and authentic DDRAW identity passed before and after
execution without copying media. All 55 pinned predecessor files remained
unchanged. To repeat the observation, recover Git plus recorded patches, use
the existing hashed media, run the retained controls/build, and invoke
`node scratch/runs/20261106-kknd-held-input-gameplay/browser.cjs --isolate`
under a newly authorized sole-runtime window. The retained `send.py`/`review.py`
protocol requires fresh personal screen review before each ordinary action.
This completed run requires no further runtime or emulator repair.
