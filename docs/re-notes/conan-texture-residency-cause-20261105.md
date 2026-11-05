# Conan D3D9 texture residency investigation

Run: `scratch/runs/20261105-conan-texture-residency-cause/`.
Predecessor: main `41f047cbf2b3c9a68291482b528e586094be2b9b` and
`conan-installed-state-gameplay-20261105.md`.

## Proven cause and repair

The WebGL backend accepted texture definitions only when a shader sampled
their stage. The host had already committed every bound definition to its
resident set on packet acceptance. A definition offered on an unused stage
was therefore lost, and its subsequent key-only use failed. This is reproduced
both by the genuine Conan execution and a generated production-queue fixture.

`lib/d3d9-backend.js` now retains all keyed pixel definitions, including unused
faces/mips, when executing their draw packet, after its releases and before
shader-dependent work. GPU uploads remain lazy. Reset also retires definitions
that never acquired a GPU composition. No memory budget, advertised capability,
guest control or queue callback was changed.

The ordered gate passed after Aranna1945 FINAL 18:31:58Z, legacyADD1955 FINAL
18:41:45Z, and AoE3repairedDXSETUP2005 FINAL 18:55:54Z. Independent cleanup
verified 374 absent PIDs, 146 refused ports, 38 absent profiles, four free locks
and sufficient disk before shared edits, tests, builds or browsers.

The preserved genuine installation remains at
`scratch/game-media/conan-installed-20261105/`, with 37 pinned files.
Read-only SHA-256 checks on 2026-11-05 matched the requested manifest
`adf7c78e9ab56519edd53479b2151f04e18496668dec450ba2af12cc0b90cd38`
and registry
`64969ff6f94d58b54431e18f937af3374bda5755e233ad62517840e1611d8de3`.
No installation, extraction or media copy was performed.

## Actual executor evidence

The shared process render Worker is `lib/d3d-render-worker.js`. Its neutral
endpoint constructs `D3D9RenderWorker.create()` from
`lib/d3d9-render-worker.js`, whose closure-owned `execute(command)` dispatches
WebGL DRAW to `D3D9Backend.Device.draw(command.payload)`. The production
`D3DCommandStream.createCommandReceiver` supplies ordered execution and reports
errors by device/generation/sequence. The host's empty resident map after a
queue error is not evidence that the owning render Worker's map was empty.

`passive-observer.cjs` installs bounded CDP conditional breakpoints on the
real executor entry and backend upload/residency/release sites. It records
offered dimensions/bytes, key history, generation/sequence, and the first
actual missing resident level. It does not wrap executor methods, mutate draw
packets, flush, inject guest callbacks or change guest state. Observed and
unobserved generated controls produced identical successful pixels; the
observer caught the intended device 1/generation 1/sequence 5 missing key.
A separate generated device reproduced unused-stage offer followed by failed
key-only sampling. See `generated-fixture.json` and `observer-validation.json`.

The one original diagnostic used the preserved genuine installation,
`defaultViewport:null`, ordinary Escape/New Game/Warrior keyboard controls,
and the existing production browser harness. The actual render Worker was
observed from sequence 1. Its first failure was device 136450064, generation 1,
DRAW sequence 5759, key `t106`, 512×512, requiring 1048576 bytes. Sequence 5756
offered all bytes, but no backend acceptance/upload occurred for this key.
No intervening release targeted it. Sequence 5757 released only `t42` and
uploaded other keys. Sequence 5759 attempted key-only sampling and found no
resident bytes while 59 other keys were resident. See
`after-warrior-trace.json` and `executor-residency-trace.json`; their bounded
first-failure record preserves key history and the recent ordered commands.

CDP recorded actual Worker script hashes and the actual 2173782-byte module:
`78a9e8d7563c94b1e002a688c5e65d4269946ab8dd9eb68aa3edf271f4cb1c24`.
The pre-repair backend hash was
`73db08446033c8923ed009740f576b734149c4a719d7850ddb92bf0df6b944ce`.
The unique compiled module is retained in the run. Source recovery uses the
recorded Git SHA, relevant binarydiff and untracked-file patches, not archives.

Personally reviewed captures show NVIDIA splash, the Conan menu, Warrior
difficulty selection, and Kordava LOADING at failure. None proves player
gameplay. The probe and Chrome exited normally with code 0; independent
`runtime-cleanup.json` verified PIDs, ports, profile and four locks released.

## Regression and single original retest

`test/test-d3d9-queued-texture-residency-web.js` exercises the production
receiver/executor on a real render Worker under both WebGL1 and WebGL2.
Before repair it fails with the same `texture not resident` error. After repair
it verifies correct readback pixels for queued unused-stage definitions,
caller-buffer mutation after posting, release-before-redefinition, unused mip
reuse, reset of never-sampled definitions, malformed-definition refusal and
continued rendering on another device after an expected queue failure.

The existing `test-d3d9-texture-residency.js` passes. The existing cube/LOD test
passes 8880 WebGL1/2 pixel checks across six faces, programmed/fixed shaders,
stage choices, filters, mip chains, resource aliases and keyed residency.
`flock /tmp/wine-build.lock bash tools/build.sh` passed, including all build
gates and standard/compat modules (2173782/2176428 bytes). Logs are
`regression-before.log`, `regression-after.log`, `existing-residency.log`,
`existing-cube-lod.log`, and `build-after-repair.log`.

Repair commit `72768dcf89631796103d7295c0546195fd867871` was immediately
published on main before the single original retest. The retest reused the
same pinned installation without installer execution or media copying. Its
actual loaded module matched the diagnostic module above; CDP confirmed the
actual render Worker's repaired backend hash
`0d6cea709b269d2c3e1461d6354bf822087f51543f57d39ee10ac61de57bcbdb`.

The repaired Worker retained `t106`'s 1048576 bytes at DRAW 4944, successfully
resolved its key-only reference at DRAW 4947, and released it at DRAW 5091.
Sequence numbers differ from the diagnostic because the menu/splash timing
differs. Observation started at sequence 1 and continued through DRAW 23001,
without an observed missing texture, observer error or logged queue error.
`causal-verdict.json` checks these facts against the preserved traces.

Personally reviewed retest captures progress from splash and New Game/Warrior
through Kordava LOADING into a rendered, narrated opening cinematic. One
ordinary Escape press/release during that cinematic did not establish player
control. `retest/final-scene.png` and `retest/last-before-close.png` show the
town panorama and story subtitles. **Player gameplay, movement, combat and
audio are not verified.** No further original launch was made.

The session was closed normally at 19:14:38Z after demonstrating the repair;
probe and Chrome both exited 0. `retest/runtime-cleanup.json` independently
verifies its Node/Chrome PIDs absent, both ports refused, browser profile absent
and four locks free. No boxes were used (ID/state/expiry: N/A).

Next evidence needed is ordinary player control after the opening cinematic.
The texture-residency cause has a failing-before/passing-after queued
regression and a successful genuine retest of the formerly failing key path;
the cinematic is not a gameplay acceptance result. Evidence, exact source
identities, relevant binarydiff/new-file patches and unique actual modules
remain under the named run. The genuine 37-file installation is preserved.
