# Software GL raster and multitexture — 2026-11-01

Both original, unchanged fixtures passed against actual instantiated WAT and
software DIB pixels. No assertion failed; neither invocation crashed or trapped.

| Fixture | Result | Elapsed |
| --- | --- | --- |
| `test/test-gl-software-raster.js` | PASS, exit 0 | 3.877 s |
| `test/test-gl-software-multitexture.js` | PASS, exit 0 | 3.804 s |

Raster retained the original asymmetric geometry, Y direction, translated
modelview/projection order with PROJECTION selected, both windings with default
culling disabled, explicit back-face culling and polygon attribute restoration,
and near-plane rejection/clipping assertions. The stored opaque red sample was
`0xFFFF0000`; the opposite winding painted more than 150 green pixels. The
near-straddling floor sample at `(VP/2, 3*VP/4)` retained RGB `0x00FF00`.
The
fixture also retained its original sampler, texture, depth, alpha, scissor,
blend, fog, lighting and far-plane assertions. No assertion was weakened or
geometry replaced. The fog assertions inside this unchanged raster fixture ran;
the separate lines/fog fixtures were not rerun.

Multitexture retained independent unit-1 coordinates, MODULATE and REPLACE,
enable push/pop, alpha testing after unit 1, border coordinates and channel
bounds, per-texture border state, invalid-sampler preservation and deletion
reset. Exact left/right controls include pink `0xFFFF8080` on both halves with
unit 1 disabled, pink/dark blue `0xFF000080` under MODULATE, and
white `0xFFFFFFFF`/blue `0xFF0000FF` under REPLACE. Four queued triangles were
replayed through the native worker entry point: the original assertions require
captured red-border `0x7FFF7F7F` and blue-border `0x7F7F7FFF` pixels on both
halves despite later setters. These assertions all passed.

## Gate, prior results and build identity

Evidence: `scratch/runs/20261101-gl-software-raster-multitexture/` (ignored).
Preparation before the gate was scratch only, with no tests, builds or note
edits. DarkReign2 worker `01a19615-8d76-7902-973e-211aa0130a2b` supplied fresh
worker `final.txt`/`result.json` at 08:07:25 UTC and an explicit 08:07:19
runtime/source/build RELEASE. The lane was acquired at 08:07:51 UTC; baseline
current main was `d9aca1952251236c2090144ffad7ca63977a8c10`.

The lines/fog and texture-sweep notes were read first. Searching existing
run-result, verification, final and reverse-engineering notes found an older
raster exit-0 report in `20261031T0443Z-land-seven-topics`, but no accepted
matching-current-input identities for that result, and no accepted exact
multitexture result. It was therefore insufficient for reuse. Mipmap, texgen,
lines and the separate fog fixture were not rerun.

The accepted locked build from `20261101-dark-reign2-native-mip-implementation`
was reused: all 4,392 accepted source hashes and 141 accepted actual-read hashes
matched, together with the production module and generated mirror. All 4,444
files in this run's broader input snapshot remained unchanged. No build was
needed and no source, fixture, compiler or repository helper was edited.

* Production module SHA-256:
  `dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
* Generated mirror SHA-256:
  `c0385b96ae59ed1820f29b4bfa547490cef9b7f172bbc0c4265d3e2dadbaae93`.
* Raster fixture SHA-256:
  `d1422b0002a7bf35228a3b5a40bf03bc6ed905a457817e118e9dc00bcf0840fe`.
* Multitexture fixture SHA-256:
  `901a78f94ac7c2e781d9a5ef67d9760dfb8d038e3b26a96964fa4be2bdcf049d`.

## Actual modules and execution limits

The actual raster module is 2,027,021 bytes, SHA-256
`9857210e2104c84e713cd28cfd6d9f721f75d8e5efac42cc7657de92729cbf0a`.
Its only differing non-custom section is exports: the original fixture adds
`border_sample_test`, `key_sample_test` and `decal_combine_test`.

The actual multitexture module is 2,027,043 bytes, SHA-256
`afd0d7de118bd88f6d234e9eda8d686f987210abbbe30481d2b5244b8b07b107`.
Its function, export and code sections differ because the original fixture adds
`border_set_test`, `border_ptr_test`, `tex_slot_test` and the
`queue_enable_test` function, which sets `gl_sw_worker_ok` to zero for the
original deterministic queue replay. Every production function body remains
byte-identical in both modules; all production exports retain their indices.
Both actual modules omit the production build's 37 bytes of custom metadata.
Neither actual module is byte-equal to production.

The original entrypoints ran sequentially on local Node v24.18.1 under
`timeout --signal=TERM --kill-after=5s 120s`, using the byte-identical accepted
read-only forward-only observer from the lines/fog run. It retained actual
instantiation bytes and 88 unchanged file reads per fixture. The unchanged
render helper compiled the WAT closure with each fixture's original extra WAT,
instantiated shared 512 MB memory, and the assertions read software DIB pixels.

Evidence includes full original fixture copies (exact assertions), compressed
original stdout/stderr, exit codes and elapsed times, actual modules, loaded
reads, before/after manifests, accepted build log, gate, verification, cleanup,
publication, final.txt and result.json. Own test PIDs/groups and watcher were
checked absent; no temporary file or box was owned (ID/state/expiry N/A).
Free disk stayed above 2 GB. This establishes these two bounded fixtures only:
no gameplay, GPU, full27 or general crash-free claim follows. Held algorithms
were not exercised separately. No further runtime work is required here.
