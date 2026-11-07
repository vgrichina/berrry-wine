# Registered saver rendering and motion, 7 November 2026

Run `20261107-graphics-saver-motion` tests original registered `scr_fallingl`,
`scr_geometry` and `scr_scifi`, each with its ordinary `/s` startup and original
registered media. The scope is named scene rendering, motion and bounded crash
coverage on browser software D3DIM and WebGL, in cooperative and guest Worker
execution. Historical 27-app membership remains uncertain.

## Source and runtime closure

The tested main revision is `3a006e140abb03641fce5af461c0f404d4bcaebc`, plus
`dirty-source.patch` and `new-source.patch` retained in the run. `source.json`
records their hashes and the new-file list. Git is the source archive; no source
or media archive was made. The fresh box reconstructed that revision using Git
and applied the explicit patches. This source cutoff precedes subsequent shared
main documentation commits.

`runtime-pins.json` records 1,372 source/runtime/input paths, sizes and SHA-256s,
including the complete available shared DLL directory and fonts. Response audit additionally
pins 11 Git-delivered UI images and `stdole2.tlb` in
`git-runtime-supplement.json`; their bytes match the recorded Git blobs. All 17
registered input entries match the coordinator's preflight pins. `binaries` is
the normal `test/binaries` alias. Executable imports, original DLL loads, actual
HTTP response hashes, compiled/instantiated module hashes and worker module posts
are retained. Builtin Win32 API imports remain distinct from original guest DLLs;
a missing optional DLL warning does not mean a substituted original scene.

The locked full build passed on the fresh box. Its standard module SHA-256 is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
the compatibility module is
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
Both unique modules were recovered and hash verified. The original postflight
found 1,383 unchanged pins and one explained `package-lock.json` change:
`npm install` removed two stale root native-GL dependency entries before testing.
`retrieved/npm-lock.patch`, `retrieved/npm-lock-pin.json` and
`retrieved/npm-installed.json` retain
the exact metadata change and installed dependency information; no package
version change is represented by that two-line diff. Environment: Node 24.22.1,
Chrome 151.0.7922.71 and Puppeteer 25.7.0, cross-origin isolation, one browser guest at
a time. WebGL provider evidence is ANGLE Vulkan SwiftShader, rather than a
physical GPU measurement.

## Capture method and an observer failure

`sweep.cjs` uses the ordinary registry launcher and thread toggle. It does not
write guest memory, seed saver settings, replace callbacks, change scene media,
or inject guest input. Each case records scene screenshots at approximately
30, 45 and 60 seconds after launch. The registered clock policy is retained;
there is no added frozen clock or CLI tick override. State is sampled before
each screenshot while rendering continues; counters describe progress across
the observation interval, not an exact frame-to-counter correspondence.

The initial six WebGL cases and six software cases run serially. A supplemental
Puppeteer observer intended to inspect guest Workers inadvertently applied its
default browser viewport during the first Sci-Fi threaded WebGL case, also
reaching the following Falling Leaves case. Sci-Fi's middle capture is teal,
and its last capture has a smaller layout. These captures and their receipts
are retained, and are excluded from the preferred fixed-viewport motion pairs.
Falling Leaves has three teal captures despite continuing draw receipts. The
observer was terminated. Existing owning render-endpoint receipts already
publish provider, version, backend, completed draws and software fallback counts;
the extra observer was unnecessary. Two serial same-box followups repeat only
these affected cases, without a second browser connection. This is a harness
failure during an observer intervention; the precise teal-presentation mechanism
was not isolated. No guest emulator divergence or repair is established by it.

## Reviewed named findings

All 12 preferred app/backend/execution combinations have three personally
inspected rendered captures, separated by approximately 15 seconds. Two affected
initial WebGL trials are retained separately; the preferred threaded Sci-Fi and
Falling Leaves evidence uses `viewport-recovery-webgl-*`. There were 14 original
launches in total, with no recorded escaped trap, unimplemented-API trap or page
exception. This is bounded startup/scene coverage, not crash freedom beyond it.

| App | Backend / execution | Host slice counter, first → last | Owning WebGL draws, first → last |
| --- | --- | --- | --- |
| scr_fallingl | software / coop | 4667 → 8948 | not exported on this direct software route |
| scr_fallingl | software / threads | 2425 → 4655 | not exported on this direct software route |
| scr_fallingl | webgl / coop | 483 → 563 | 141 → 279 |
| scr_fallingl | webgl / threads | 403 → 418 | 129 → 314 |
| scr_geometry | software / coop | 4648 → 9313 | not exported on this direct software route |
| scr_geometry | software / threads | 1975 → 4023 | not exported on this direct software route |
| scr_geometry | webgl / coop | 251 → 324 | 94 → 188 |
| scr_geometry | webgl / threads | 183 → 194 | 82 → 170 |
| scr_scifi | software / coop | 4178 → 8204 | not exported on this direct software route |
| scr_scifi | software / threads | 2034 → 3834 | not exported on this direct software route |
| scr_scifi | webgl / coop | 455 → 565 | 164 → 331 |
| scr_scifi | webgl / threads | 338 → 357 | 125 → 305 |

Host slice counters are execution observations, not frames, guest instructions
or FPS. Threaded samples additionally retain increasing owning guest Worker
slice counts and guest execution/RPC activity. Software runs select the software
backend, have no owning WebGL GPU executor and visibly render their guest DIB;
their direct WAT path does not export completed raster draw counts, so those
counts are unknown rather than zero. WebGL cooperative samples inspect the
owning `D3DIMGpu`; threaded samples inspect their owning legacy render endpoint's
`d3dStats`. Every preferred WebGL capture reports zero executor errors and
fallbacks. Threaded WebGL receipts additionally report zero completed software
and software-fallback draws, WebGL 2 and the measured SwiftShader provider.

**scr_fallingl**: Gold/green leaves and their shadows change position and orientation against fixed printed leaf motifs; dark silhouettes and edge/texture artifacts remain uncertified.

**scr_geometry**: Gold outlined polyhedra change orientation, spacing and extent around the same blue radial gradient; distant dark outlines change arrangement.

**scr_scifi**: Orange/yellow creatures change position and articulated pose over a fixed dune ridge and ground texture beneath the red sky; their cast shadows also move.

For Sci-Fi cooperative WebGL, successive scene-only changed-pixel bounds move
from `(351,629)–(492,730)` to `(309,608)–(445,712)` in the desktop screenshot;
the creature moves up/left relative to the unchanged terrain. The two pairs
retain 439,078 and 439,042 unchanged scene pixels. The threaded WebGL followup
shows the creature group changing articulated pose and placement over the same
ridge and ground features; its pairs retain 431,290 and 431,948 unchanged scene
pixels. These observations establish object motion relative to backgrounds;
pixel counts alone would not establish motion, timing or parity.

`visual-review.json` names all preferred captures and the two excluded trials.
`named-case-audit.json` maps each preferred case to its states, module receipts
and counters. `scene-pixel-observations.json` includes raw observations for every
trial, including the affected ones, which must not be interpreted as valid
motion comparisons. All 42 raw captures were inspected; 36 are the preferred
rendered series.

The response audit matches all 2,218 captured successful bodies to pinned
runtime/Git bytes, with zero mismatches; all 14 trials' instantiated main/posted
worker module receipts match the standard module. DevTools could not return 62
additional response bodies, including some original media/DLL responses. Those
individual delivered bodies are not independently hash-certified. Complete
server-side file closure and pre/post hashes are separate evidence and do not
remove this delivery-observation limitation. Optional/UI 404s and ANGLE readback
performance warnings remain in the retained logs.

Focused checks passed: `test/test-d3dim-lit-alpha.js`,
`test/test-d3dim-execute-buffer-slots.js`, and
`test/test-d3dim-gpu-fallback-counters.js`. No implementation change was justified;
there is no claimed emulator repair or new old-failing regression.

## Limits and recovery

The October 30 paired saver captures used guest threads off; their Sci-Fi
WebGL images did not establish motion. A separate dated October 31 note reports
motion on its older module. Neither dated report is substituted for this run's
current source and owning endpoint evidence.

Scene-object motion is evaluated relative to fixed background features, not
from wall-time screenshot changes or desktop/log differences. This run does not
establish FPS, correct timing, audio, physical GPU behavior, same-frame backend
parity, native Windows reference parity, all scene cycles, complete visual
correctness, or the historical 27-app census. Visible edge/texture artifacts and
dark silhouettes are retained rather than certified as correct.

Recovery uses the recorded Git revision, patches (including the npm lock metadata patch), existing input paths and
hashes, `runtime-pins.json`, retained modules and run-specific scripts. The
bootstrap helpers reference the existing Alice transport/admission helpers;
`remote.py` fixes the explicit fresh box ID through `boat-created.json` and uses
the persisted UUID create key. No stopped box is resumed and no public endpoint
is exposed. The task explicitly delegates normal nonforced stop after verified
evidence recovery. All 202 recovered log/capture/metadata files (16,632,634 bytes) and both tested
modules were hash verified locally before stop. `retrieved/postflight-reviewed.json`
records all 20 recorded PIDs absent, no live browser/helper processes, all three
HTTP ports refused, all profiles absent, and empty input queues with no held
mouse buttons or injected keys. The initial postflight assertion and its npm
metadata mismatch remain retained rather than overwritten.

Box `bx_nnxngyyn` completed delegated normal nonforced stop at
`2026-11-07T08:40:49.684Z`: state **archived**, active expiry `null`, stop
`stop_a2a06a1de0213979` completed with `error: null` and `forced: false`.
Its original scheduled expiry was `2026-11-07T08:57:41.844Z`. No stopped box was
resumed. Snapshot/box custody returns to the coordinator; no further runtime
work is assigned to this worker. Publication metadata precedes `result.json`,
which is written last.

Next work, if requested, is a generated presentation control for the observer-era
teal failure and a complete delivered-body observation method; ordinary named
scene motion is covered here. Timing, reference visual correctness and the
historical membership census remain separate unresolved questions. There is no
candidate-corpus manifest entry for these saver IDs, so this is a named-app
investigation, with no attachment to an unrelated candidate.
