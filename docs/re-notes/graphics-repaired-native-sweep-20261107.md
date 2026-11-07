# Quake II and GLTron original gameplay with native GL and threads — 2026-11-07

Evidence: `scratch/runs/20261107-graphics-repaired-native-sweep/`.
Both registered originals reached inspected ordinary gameplay using the supported
`--headless-gl --threads` route on current main. This closes the two menu-only
followup gaps in [the repaired-original replay](graphics-fixed-gl-originals-20261107.md).
No new emulator failure was demonstrated; no production code changed.

## Identity and prerequisites

The tested checkout was main `74c0ef3aeac845d871114a804faa258524cce4cb`,
including shader repair `aaaf6e370` and presentation repair `36a212cac`.
`runtime-pins.json` records 606 individual inputs, including complete original
Quake II (67 paths) and GLTron (92 paths) closures. All registered hashes
matched. The relevant tracked source patch is empty; the existing untracked
`lib/wininit-boot.js` is retained as its own binary diff. Git plus these patches
is the recovery recipe; no source/media archive or repeated media was created.

All four original processes actually read standard WASM SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). Both standard and compatibility modules were recovered;
the compatibility module was not executed. The runtime manifest and
`retrieved/identity-postflight.json` pin loaded modules and source independently.

One fresh UUID Idempotency-Key created box `bx_jb7v82vs` at 06:38:00Z,
with original expiry 07:13:00Z. No earlier box was resumed. Native packages
were installed separately from the pinned runtime package files:
`@node-3d/glfw` 7.4.1 and `@node-3d/webgl` 6.0.3. Their normal installation
scripts supplied native binaries. There was no access/403 hold or retry.
Node v24.22.1 used display `:0`, Mesa llvmpipe LLVM 20.1.2, WebGL 1.0,
GLSL 4.50. The 162 dependency pins and Node binary hash are retained in
`retrieved/native-pins.json`; nine native binaries were individually recovered.

Before originals, native clear/readback returned `[255,0,0,255]`, GL error 0,
then zero live contexts. `test/test-headless-gl.js` and the real WGL regression
passed, including actual fixed-function shader creation, MakeCurrent and red
readback. Local clock-domain/release mutation tests and CLI fault key-release
cleanup passed. Two older source-extraction test fixtures did not pass:
`test-cli-tick-ms-input.js --source-only` expects an outdated DispatchMessage
marker, and `test-input-consumption-state.js` omits `require` in its extracted
VM context. Those failures are retained, not presented as emulator faults.
Actual original control snapshots below independently establish input delivery
and release. An attempted nonexistent test filename also remains in the raw
preparation log; it did not execute a test.

An early preflight ran before the last large Quake II PAK upload completed and
failed with FileNotFoundError before launching a guest. The complete 607-file
transfer ledger then finished; the subsequent fresh preflight matched every
pin before originals. Neither guest media nor guest configuration was edited.

## Bounded serial startup

```sh
node tools/crash-sweep.js --apps=quake2_demo,gltron --seconds=20 \
  --headless-gl --modes=threads --jobs=1 --stuck-after=0 --no-build \
  --jsonl=<run>/actual3/sweep.jsonl
```

| Original | Startup result | Personally inspected startup display |
| --- | --- | --- |
| Quake II | `ok`, 20.5 s | Original Game/Multiplayer/Options/Video/Quit menu |
| GLTron | `ok`, 20.5 s | Original colored Game/Video/Audio/Quit menu |

Both native WGL context creation and MakeCurrent returned nonzero. Raw startup
logs, exit records, native loaded objects and captures are retained. Signature
`ok` and similar wall times are not used to establish gameplay or performance.
The sweep completed before either controlled gameplay run started.

## Inspected gameplay and owning route

Followups used unchanged `test/run.js`, `--app`, `--headless-gl`, `--threads`,
`--png-canvas`, `--real-ticks`, batch size 200000, bounded harness deadlines and
ordinary keyboard down/up commands. Read-only control observations inspected
host objects; no guest state, assets, bindings or configuration was forced.

**Quake II:** Return opened Game, then Return selected Easy. `world01.png`
shows the textured first-person room, blaster and health 100. Paired W moved
into the room (`moved.png`); paired Right changed the view (`turned.png`).
Ctrl was paired but did not establish firing. Paired Enter did: the held
`firing-held.png` shows weapon recoil and orange impact sparks compared with
`fired.png`. No ammunition decrease is claimed for the blaster.

At the frozen final observation, all 12 key edges had been dequeued, routed
and dispatched, known host queues were empty, and Return/Ctrl/Right/W physical
and async down states were false. The owning window `0x10001` layer reported
`api: opengl`, `WebGLBackend`, llvmpipe, and advancing surface write sequence
2621 to 3267. The actual displayed layer's native GL object supplied the
provider strings, rather than a separate capability probe.

The scheduler backend was `worker`, but Quake II created **zero auxiliary
guest threads** in this session. This proves gameplay under the real-worker
backend selection, not concurrent guest CPU execution for this single-threaded
observed path. No artificial guest thread was introduced.

**GLTron:** Return opened Game and Start Game; the arena initially displayed
`GAME IS PAUSED`. Paired Return released the pause. `gt-moving.png` shows the
cycle and growing trail. Paired A changed the minimap trail direction and
arena view. A closer second ordinary round retained `gt-pair-before.png`,
`gt-pair-left.png` and `gt-pair-right.png`: the player trail acquires distinct
left and right corners after paired A/S, with corresponding views. The
original `scripts/config.lua` maps player-one left/right to a/s. A natural
collision/result sequence is retained; no player victory or survival claim
is based on it. Old round-result text remains visible during the second
round, and distant black outlines/trail shadows are not a parity judgment.

GLTron had a genuine guest Worker: scheduler slot 1, handle `0xe1000`, Node
worker thread ID 3, two completed execution slices, 10 synchronous and 20
asynchronous RPCs. It was chiefly parked; no sustained worker throughput or
audio claim follows. The displayed window's layer itself reported OpenGL /
`WebGLBackend` / llvmpipe, surface write sequence 838 to 1873. Final input
observations counted all 24 edges dequeued/routed/dispatched, empty known
host queues and released Return/Escape/A/S physical and async states. Guest
post-queue and SDL-consumption snapshots remain unknown; visible turns supply
the gameplay evidence.

Both controlled originals exited 0. Their terminal records are strictly
serial: Quake II ended 10.735 seconds before GLTron launched. All 35 recovered
PNG references were personally inspected in contact sheets; the key paired
world captures were also inspected at original size. PNG CRC/IDAT decoding
passed. The loaded-read audit matched 523 reads, including all four original
module reads, with no unmatched reads, bridge errors or escaped trap/API
failure. There was no demonstrated API/shader/CPU mismatch warranting an
emulator repair or an old-behavior-rejecting production regression.

## Recovery, cleanup and limits

Recovery verified 124 references / 119 unique hashes, including raw startup,
crash/exit/scheduler/control logs, unique captures, both WASM modules and nine
native binaries. Fresh postflight matched all 606 runtime and 162 native pins.
`validation.json`, both retrieval-verification files, native objects, control
snapshots and `capture-reviews.json` retain the checks. No code changed, so
no new build was required for this documentation-only publication.

Remote cleanup found no owned live runtime process, closed control port 18123,
no owned listening Unix socket, removed owned temporary directories, and no
browser/profile created. After evidence recovery, explicitly delegated normal
shutdown completed at **06:44:54.020Z**, nonforced, error null. Box
`bx_jb7v82vs` is **archived**, stoppedAt 06:44:54.003Z, no active expiry.
No box ownership remains outstanding. Local free disk was above 2 GB at
preparation and final verification; no foreign evidence was removed.

These are scoped Node native GL startup and gameplay observations. Browser
WebGL/hardware GPU parity, audio, FPS, level completion, historical27 and broad
crash freedom remain unqualified. Cooperative gameplay and Forsaken were not
repeated. Next useful work is the already identified matched-state Quake III
torch investigation or deeper original gameplay; neither menu-only gap remains.
