# GL/D3D startup crash sweep after waveOut correction, 2026-11-07

Twelve current-runtime startup windows across six registered originals reach
their 20-second harness deadlines with no classified escaped crash,
unimplemented API, guest exit, setup failure or external timeout. The full raw
logs also contain no crash/RuntimeError/Error marker. Reviewed endpoint output
matches the preceding sweep's checkpoint pattern. No new reproducible emulator
failure was established, so no production patch or speculative clock change
was made. Cooperative GLTron remains an unresolved startup blocker; threaded
Forsaken's black endpoint does not establish a persistent regression.

Evidence: `scratch/runs/20261107-graphics-post-audio-crash-sweep/` (ignored).
This uses the named six-app union and passed controls from
[the post-allocator sweep](graphics-post-allocator-crash-sweep-20261107.md).
That predecessor predates the audio correction and supplies controls, not
current-runtime acceptance. No historical27 census, new accounting framework,
guest configuration change or extra gameplay execution was performed.

## Tested composition and command

The staged source is main **5c54c4bb895ee3e3c23a4b7501811deae5bb2fa2**,
including published waveOut idle-gap fix **ac1bcecee**. The relevant tracked
runtime diff is empty. `new-lib_wininit-boot.js.patch` preserves the existing
untracked dependency. `source-commit.txt`, `relevant-source.patch`,
`owned-helpers.patch`, `runtime-pins.json` and `media-refs.json` provide recovery
from Git plus exact helper patches and existing media path/size/SHA-256
references. No source tree or media archive was created. Later concurrent main
commits are not substituted for the tested composition.

All twelve actual standard-module reads match: 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The actual loaded `lib/host-audio.js` reads match 211,499 bytes, SHA-256
`e2ae7f782e7fbeb246471acfb3a93d7ae80eec9b195e44f02072310e81373d15`.
`analysis.json` retains each loaded audio-host observation, not just a local
file hash. All 1,590 observed JS/JSON/WASM reads match staged/native pins.
Remote preflight and postflight verify all 3,629 staged pins and 162 native
dependency pins. Both WASM modules were retrieved; compatibility was not run.

Registered media closures are complete and hash-matched: Quake II 67 paths,
Quake III 307, GLTron 92, Hexen II 16, Heretic II 1,826 and Forsaken 873.
Renderer, CLI, scheduler and standard-module controls match their predecessor
hashes; the corrected audio host differs as intended. Fresh native headless-GL
and real WGL create/MakeCurrent/red-readback controls pass remotely.

Node v24.22.1 and native `@node-3d/glfw` 7.4.1 / `@node-3d/webgl` 6.0.3 use
Mesa llvmpipe LLVM 20.1.2, WebGL 1.0, GLSL 4.50 on display `:0`. GL context
observations, bridge results, loaded native binaries and their hashes are
retained. Quake II/III, GLTron and Heretic II create native GL in both modes.
Hexen II remains before GL. Forsaken uses its registered software Direct3D
route. This is not browser WebGL or physical-GPU evidence.

The existing tool ran once, one heavy runtime at a time:

```sh
node tools/crash-sweep.js \
  --apps=quake2_demo,quake3_demo,gltron,hexen2_demo,heretic2_demo,forsaken_demo \
  --modes=coop,threads --headless-gl --jobs=1 --seconds=20 \
  --stuck-after=0 --no-build --jsonl=<run>/actual/sweep.jsonl
```

The retained preload selects the existing `--png-canvas` CLI option before
argument parsing. PNGs are actual composed display output, not selected raw
textures. Other passive observers retain module reads, native context and
existing scheduler/bridge results. No input, private handler or alternate
clock was used. The original CLI clock/budget defaults remain unchanged.

## Outcomes and inspected output

All twelve full logs explicitly report `[max-seconds] stopping after 20s`.
`ok` means that bounded harness outcome, not guest completion or playability.
`analysis.json` classifies raw crash, unimplemented, guest-exit and setup
markers independently of image content; the tool separately records external
timeouts. All those failure categories are empty.

| Original | Cooperative | Threaded | Personally inspected composed endpoint |
| --- | --- | --- | --- |
| Quake II | ok/content, 20.6 s | ok/content, 20.6 s | Both original Game/Multiplayer/Options/Video/Quit menus with console text behind. |
| Quake III | ok/content, 20.6 s | ok/content, 20.5 s | Both original Arena Single Player/Multiplayer/Setup/Demos/Cinematics/Exit menus. |
| GLTron | ok/blank, 20.5 s | ok/content, 20.6 s | Cooperative uniform black; threaded colored Game/Video/Audio/Quit menu. |
| Hexen II | ok/content, 20.3 s | ok/content, 20.4 s | Both accelerated-version notices with OK focused; no dismissal, world or GL startup. |
| Heretic II | ok/content, 20.7 s | ok/content, 20.7 s | Both textured original Main book menus. |
| Forsaken | ok/content, 20.6 s | ok/blank, 20.4 s | Cooperative Single Player menu over textured 3D backdrop; threaded uniform black. |

All twelve PNGs were inspected in two ordered contact sheets; original PNGs and
individual SHA-256 reviews are retained. The reviewed menus show no newly
observed visual regression at these checkpoints. This is not an equal-progress
pixel-parity assertion. GLTron PCM is silent in both modes (cooperative reaches
the 4 MiB cap); the other cases have no PCM bytes. No audio-quality conclusion
follows. Threaded selection alone does not prove auxiliary guest work for
titles that create no guest threads; scheduler receipts preserve that distinction.

## Black endpoints and retained progress evidence

The retained [Forsaken threaded investigation](forsaken-threaded-black-20261107.md)
was read first, and its 10-second black, 20-second menu, corridor movement and
fire/ammunition captures were inspected again without rerunning gameplay.
That run measures black primary/back targets during continuing allocation and
conversion, then new geometry and nonblack target output in the same process.
The fresh sweep ends at main EIP **0x004cd2cb**, with its preceding batches
progressing through **0x004cd2f2..0x004cd340**. This is inside the same retained
`0x4cd2c2..0x4cd40e` conversion loop, not a newly established stuck EIP or lost
compositor output. It supports the known progress-phase explanation. Sparse
sweep observations cannot prove every operation correct or the precise clear
that began this interval. No persistent regression or scheduler fix is justified.

Cooperative GLTron's fresh main samples still progress through the known decoder
work (`0x7a71b7`, `0x7916b7`, `0x7ac752`; final `0x7917cf`). Its black endpoint
is consistent with the retained
[audio-service](gltron-audio-service-20261107.md) and
[clock-budget](gltron-clock-budget-20261107.md) evidence. The latter already
adopts ac1bcecee, observes 50 actual pumps and 40 correctly eligible completions,
and pairs all 40 with callback/semaphore grant and header resubmission before
the next publication. Every full publication gives runnable main 4,000 retired
blocks. The retained 80-second black capture and boundary analysis were
inspected; this task does not repeat that census or claim its observations are
new sweep measurements.

The remaining causal boundary is the CLI's unconditional outer-batch time
charge before the audio pump, and the resulting decoder-work/playback capacity
ratio. A correction requires an explicit emulated CPU-time/idle-deadline model
and a work-preserving slice-partition regression. Neither a smaller tick nor
another broad original run would establish that model. The idle-gap correction
is tested, but it has not fixed cooperative GLTron menu startup. No new
incorrect completed primitive was demonstrated here.

Exact retained run IDs are
`20261107-graphics-post-allocator-crash-sweep`,
`20261107-forsaken-threaded-black`, `20261107-gltron-audio-service` and
`20261107-gltron-clock-budget`. `retained-progress-refs.json` records hashes of
the consulted unique evidence; `black-progress-alignment.json` retains fresh
deadline-adjacent registers. No broad gameplay repetition was performed.

## Verification, recovery and shutdown

Existing crash-sweep regressions pass 20/20; comparison tests pass 2/2.
waveout-audio, waveout-callback-function-wasm, wave-callback-scheduler and
batch-clock tests pass. Runtime pin/load audits, full raw-error inspection,
retrieval verification and own-run validation pass. This is documentation-only
work against the pinned module with `--no-build`; no new production build or
fail-before/pass-after repair is claimed. The global evidence checker reports
seven unrelated containment errors and older missing/invalid records; this
run has no checker findings. Unregistered apps remain investigation evidence,
not unrelated candidate-corpus completions.

All **72 remote references / 58 unique contents / 21,132,348 referenced bytes**,
including twelve raw logs, twelve compositor PNGs, PCM, both modules and unique
native binaries, were retrieved and size/SHA-256 verified before shutdown.
Large logs are losslessly gzip-compressed. Local and remote launch free disk
exceed 5 GB; local free space stays above 8 GB. Recovery uses Git SHA, relevant
diff/new-file patches, exact runtime/module pins and existing media references.

One UUID-idempotent fresh box **bx_38zwh4es** was created at 23:27:29Z with
original expiry **2026-11-07T23:52:29.188Z**. A detached independent 25-minute
watchdog and separate normal-stop delegate were armed before allocation and
observed alive during the sweep; retained maximum heartbeat gap is 0.784 s.
After verified retrieval, explicitly delegated normal stop
**stop_d97e44a67fca3ae8** completed **2026-11-07T23:34:12.362Z**,
forced=false, error=null. The box is **archived**, current expiry null;
archive retention is unknown. `normal-stop-confirmed.json` is the receipt.
Both lifecycle delegates exit zero and their supervisor has no remaining
children. Remote cleanup finds no owned live runtime and removes its temporary
directory. The exact local board watcher is closed. No browser, profile,
control port or held input was created; no box was resumed/deleted and no
public deployment occurred.

This bounded changed-runtime sweep is complete. No newly reproducible crash
needs repair. Cooperative GLTron's documented clock-model boundary remains;
Hexen II post-notice startup is untested. Startup absence of crash and retained
menus do not establish full playability, browser parity, FPS, audio quality or
full27 completion.
