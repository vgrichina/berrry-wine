# NFS3: repaired native chooser and D3D selection qualify; remote game EXE staging fails

The published thread-owner repairs `e6f4672ff` pass the ordinary native chooser.
A coherent production Worker catalogue → setup → page reload → setup run now
paints the chooser and lists **Direct3D Device 1**. In one fresh remote box,
ordinary dropdown selection, the utility's unsupported-card warning OK, and
setup OK produce the native D3D registry values. Race controls remain unqualified:
the remote staging helper omitted the registered game EXE, causing HTTP 404
before the game could load. This is a run preparation failure, not a demonstrated
new emulator defect.

Evidence: `scratch/runs/20261108-nfs3-owner-repaired-chooser-race/`. The preceding
[ownership repair note](nfs3-setup-zero-eip-cause-20261108.md) retains both
failing-before/passing-after regressions and traces. This task also read the
loader, Win9x registry, native setup and earlier renderer notes and the current
catalogue/setup/chosen-game registrations. No emulator or tracked helper code
changed here; this note is the only committed path.

## Production chooser and native selection

`bootstrap-final` is an unmodified production Worker run with the repaired module.
The second local `local/` run recovers actual instantiated Worker module bytes
through CDP, binds the live process/Worker/instance/module/document/canvas and
opens the native renderer list with an ordinary independently released mouse
click. The initial Software selection originates in the first setup invocation;
the second invocation reads it after full page reload. The native chooser is
painted and responsive, rather than the predecessor's blank window.

The same catalogue/setup/reload/setup route runs in fresh box `bx_p6w2zydz`.
Reviewed original-resolution images show Software Renderer and Direct3D Device 1
in the list. Selecting D3D displays the original warning that the card is not
supported by the game. Its ordinary OK returns to the chooser showing Direct3D
Device 1. Setup's own OK then writes:

| Value | Native value |
| --- | --- |
| 3D Device Description / 3D Card | Direct3D Device 1 |
| Thrash Driver | d3d |
| Group | D3D |
| D3D Device | 0 |
| Hardware Acceleration | 1 |
| Triple Buffer | 0 |

`retrieved/webgl/native-selection.json` and `setup-completed-state.json` retain
these writes. The process emits native `ExitProcess(1)` and leaves `runningApps`
empty. This is an ordinary utility termination, **not** an exit-code-zero claim.
The terminal PNG contains the shell Read Me over retained chooser pixels;
process termination is established by state/logs, not by that background image.
D3D persistence through the subsequent game reload/consumption is not accepted,
because the game executable never loaded.

All executed production modules are SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`
(2,182,452 bytes). Both repaired source fragments match the published Git blobs.
The recorded recovery base is `0a38cf48438096482d059c5d8f27c048474c83b9`;
`relevant-source.patch`, `source-files.json`, the served-response hashes and
`tested-runtime-pins.json` describe the actual closure, including relevant
uncommitted sources without archiving the tree. All 133 standing manifest
media files were freshly hash-verified by reference; that manifest excludes the
registered game executable. The browser is Chrome 151.0.7922.108, native viewport
945×889, real guest Workers. The local initial capture used 1000×800.

## First new dependency: the staged closure lacks the registered EXE

At 05:53:48.341Z the remote server returns 404 for
`/test/binaries/candidates/need-for-speed-3-demo/game/nfs3demo.exe`, followed by
its `.part000` fallback. The launcher logs `Unable to load ... nfs3demo.exe:
HTTP 404`. Preparation included the 133-file local manifest, but unlike the
predecessor's preparation recipe, omitted the registration's separate `exe`.
The already staged catalogue and setup executables do not imply the game EXE
was staged. The existing local original game remains intact, SHA-256
`0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad`.

The later driver error, `one-way readiness requires qualified native stage`,
is secondary: its capture wrapper tests `undefined !== 'none'` when there is no
running app. The earlier commentary that inferred an already attached renderer
was wrong and was corrected after retrieving the launch log. No owning D3D
context, module load, fallback or physical GPU is established. The run-local
`initial-renderer-regression.log` only demonstrates a separate guard precondition;
it does not explain this launch failure.

Before correcting preparation, `test-staged-native-route.cjs` recreates the
staged HTTP boundary using the current production registrations and pinned
closure. It fails specifically for `nfs3_chosen_renderer` with `404 !== 200`.
Adding the original registered EXE to the preparation closure makes all three
native registrations pass HTTP status, byte length and SHA-256 checks. The
corrected `runtime-pins.json` is explicitly **prepared, not remotely executed**;
`tested-runtime-pins.json` preserves the original failed closure. No failed
launch or input was replayed, and the stopped box was not resumed. A continuation
needs this complete closure and an early launch-success check before creating
an input chain, then a fresh authorized run for game consumption and controls.

## Validation, guards and shutdown

The actual NC retrieval and DestroyWindow ownership regressions pass again, as
does the native registration check. No source repair or new locked-build claim
is made; the executed module matches the predecessor's locked-build result.
The unrelated baseline BUTTON notification failure remains separate.

The local stale click refusal and one remote stale setup-OK refusal are exact
zero-effect ACKs followed only by fresh capture/review. Four remote physical
clicks use independent releases and current image/owner/module/freshness checks.
Seven remote commands ACK successfully (including one stale refusal); the game
launch is the first failed command, with a sticky closed transport and no retry.
No acceleration, steering or other game input occurred. There were no guest
patches, aliases, forced renderer/configuration/clock/RNG values or private
handler calls. The `webgl` output-directory label is inherited from the helper;
the launch URL contains no renderer override and does not prove a backend.

`analysis.json` verifies 1,064 complete HTTP responses against staged pins with
zero mismatches; all 18 PNG references pass CRC and zlib decoding (nine distinct
images, personally reviewed). Before stop, all 115 remote artifact references
(104 unique hashes) were downloaded and independently read/size/SHA-256 checked.
Remote Chrome exited zero; controller and Chrome PIDs, profile, writer and both
ports were absent, with all 724 tested pins unchanged. Both independent watchdog
children exited zero, and the supervisor has no children remaining.

The UUID-idempotent box was created only after local chooser qualification and
observable independent 25-minute watchdog arming. Final state is **ARCHIVED**,
expiry **null** (initial expiry 2026-11-08T06:15:38.189Z). Normal stop receipt
`stop_0d51fd80bfc717bb` completed at **05:54:45.263Z**, `forced=false`, no error.
The stopped box is not left billing. Disk remained above 5 GB; no RAM gate,
old-box resume, deletion, source/media archive, public deployment or nested
worker was used. Three-renderer timing, full27, audio and parity remain open.
