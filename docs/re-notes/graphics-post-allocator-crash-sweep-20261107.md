# Current-module GL/D3D startup crash sweep, 2026-11-07

Twelve serial startup windows across six registered originals reached their
20-second harness deadlines without a classified escaped trap, unimplemented
API, guest exit, setup failure or external timeout. Two final composited
captures are black: cooperative GLTron and threaded Forsaken. Those cases
remain visually unqualified. No reproducible emulator defect was established,
so no speculative production repair or new build was made.

Evidence: `scratch/runs/20261107-graphics-post-allocator-crash-sweep/` (ignored).
Work started after [Heretic II followthrough](heretic2-texture-followthrough-20261107.md)
released its files at `1815b027c`. The existing
[native GL sweep](graphics-gl-backed-sweep-20261107.md) and
[expanded sweep](graphics-expanded-crash-20261107.md) provide the named
six-app selection and registered media manifests. This is their union, not an
inferred historical27 census. No gameplay was repeated.

## Exact source and runtime

Source is main `5e0c96c0d6c4ca730a9d92a3da8366989ceb04b0`, explicitly adopting
allocator repair `ef2709a76` and the current source/module closure. The relevant
tracked source diff is empty; `new-lib_wininit-boot.js.patch` preserves the
existing untracked runtime dependency. Owned helper patches, runtime pins and
existing media path/size/SHA-256 references supply recovery without archives.
Concurrent edits after staging are not part of the tested composition.

All twelve actual standard-module reads are 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
Both standard and compatibility modules were recovered; compatibility was not
executed. All 1,590 observed JS/JSON/WASM reads match runtime/native pins.
Preflight and postflight match all 3,629 staged pins and 162 native dependency
pins. The complete registered app closures contain Quake II 67 paths, Quake III
307, GLTron 92, Hexen II 16, Heretic II 1,826 and Forsaken 873, without missing
files or manifest hash mismatches.

Node v24.22.1, display `:0`, `@node-3d/glfw` 7.4.1 and `@node-3d/webgl` 6.0.3
use Mesa llvmpipe LLVM 20.1.2, WebGL 1.0, GLSL 4.50. Native headless-GL and
real WGL fixed-function creation/MakeCurrent/red-readback controls pass remotely.
Passed predecessor capture/native/input controls are reused. There was no new
admission framework, changed guest setting, binding, registry or clock.
Both launch floors exceed 5 GB; shared local free space remains above 9 GB.

## Serial outcomes and inspected captures

The existing registry sweep ran once, with one heavy runtime at a time:

```sh
node tools/crash-sweep.js \
  --apps=quake2_demo,quake3_demo,gltron,hexen2_demo,heretic2_demo,forsaken_demo \
  --modes=coop,threads --headless-gl --jobs=1 --seconds=20 \
  --stuck-after=0 --no-build --jsonl=<run>/actual3/sweep.jsonl
```

The retained external preload selects the existing `--png-canvas` CLI option
before argument parsing, retaining composited displays rather than selected
raw textures. Other observers retain logs/module reads, native context and
existing bridge/scheduler outcomes without changing guest behavior. No guest
input, private handler or original replay was used.

| App | Cooperative | Threaded | Personally inspected final compositor capture |
| --- | --- | --- | --- |
| Quake II | `ok/content`, 20.7 s | `ok/content`, 20.6 s | Both original Game/Multiplayer/Options/Video/Quit menus, with console text behind. |
| Quake III | `ok/content`, 20.9 s | `ok/content`, 20.5 s | Both original Arena Single Player/Multiplayer/Setup/Demos/Cinematics/Exit menus. |
| GLTron | `ok/blank`, 20.5 s | `ok/content`, 20.5 s | Cooperative uniformly black; threaded original colored GLTron Game/Video/Audio/Quit menu. |
| Hexen II | `ok/content`, 20.3 s | `ok/content`, 20.3 s | Both original accelerated-version notice with OK focused; no dismissal or GL/MIDI startup. |
| Heretic II | `ok/content`, 20.5 s | `ok/content`, 20.5 s | Both textured original Main book menus. |
| Forsaken | `ok/content`, 20.4 s | `ok/blank`, 20.4 s | Cooperative original Single Player menu over 3D backdrop; threaded uniformly black. |

All twelve captures were inspected. Sweep exit zero is not twelve visual passes.
The whole raw-log audit contains no escaped crash, unimplemented API,
RuntimeError or Error line. `ok` denotes the harness deadline outcome; it is
not guest completion, gameplay or broad crash freedom. GLTron's PCM is silent
(cooperative reaches the 4 MiB recording cap); other cases have no PCM bytes.
No audio quality or performance conclusion follows.

Quake II, Quake III, GLTron and Heretic II each create native GL and return
nonzero WGL creation/MakeCurrent results in both modes. Hexen II stops before
GL; Forsaken retains its registered software Direct3D route. Neither the
factory nor this Node sweep establishes browser WebGL or physical GPU coverage.

Quake II, Quake III, Hexen II and Heretic II have no observed auxiliary guest
threads. Their threaded cases establish backend selection only. GLTron's guest
Worker executes two slices, 10 synchronous and two local RPCs. Forsaken's two
retained threaded workers execute 16,931 and 5,972 slices. These include parked
work, not throughput measurements. Cooperative auxiliary instances also exist
for GLTron and Forsaken. Unequal progress and the two black final captures do
not identify a WAT/JS cause or establish reproducibility. The earlier native
sweep already retained a blank threaded Forsaken endpoint; that historical
observation does not prove the same cause here.

## Recovery, checks and lifecycle

All 72 remote references / 59 unique contents, 22,099,007 referenced bytes,
including twelve complete raw logs, twelve PNGs, PCM, both modules and seven
native binaries, were recovered and SHA-256/size verified before shutdown.
Large individual logs are losslessly gzip-compressed; no source/media archives
were created. Native/runtime postflight and loaded-read audits pass.
The existing crash-sweep regressions pass 20/20 and comparison tests pass.
An initial nonexistent focused-test filename and unavailable local Pillow
contact-sheet attempt are retained; neither executed a guest or altered evidence.
Captures were subsequently inspected directly. This is documentation-only work
using the pinned module with `--no-build`.

The repaired Heretic II detached supervisor, observable immutable 25-minute
watchdog and separate normal-stop delegate were armed and verified alive before
the one UUID-idempotent allocation. Both children exit zero with durable terminal
and supervisor records after confirmed normal stop. Box `bx_vtxye6sp` was created
at 21:55:20Z, original expiry **22:20:20.420Z**. Following verified retrieval,
explicitly delegated stop `stop_4d7e1a79703e8063` completed at
**22:01:51.761Z**, forced=false, error=null. The box is **archived**;
current expiry is null and archive retention is unknown. Ownership returns to
the coordinator; no resume/delete or public deployment occurred.

Remote terminal cleanup finds no owned live runtime process and removes the
owned temporary directory. No browser, profile, control port or held input was
created. Owned local lifecycle processes and board watcher are closed.

Next concrete gaps are passive, progress-aligned compositor/presentation
discriminators for cooperative GLTron and threaded Forsaken, and post-notice
Hexen II startup if separately requested. Current-menu results do not establish
gameplay, visual parity, FPS, audio, historical27 membership or completion.
