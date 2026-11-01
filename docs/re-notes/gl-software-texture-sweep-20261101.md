# Software GL texture coverage — 2026-11-01

Both unchanged fixtures passed against actual WAT software-rendered pixels:

| Fixture | Result | Elapsed | Pixel assertions |
| --- | --- | --- | --- |
| `test/test-gl-software-mipmap.js` | PASS, exit 0 | 5.671 s | 8 |
| `test/test-gl-software-texgen.js` | PASS, exit 0 | 5.633 s | 9 |

Mipmap coverage includes level-zero fallback, magnification, rho 2/4 selecting
levels 1/2, non-mipmap filtering, nearest mipmap filtering, level-zero re-upload,
and missing-level fallback. Texgen coverage includes disabled and S-only controls,
both sphere-map normals, `glTexGenf`/`glTexGenfv`, texture attribute push/pop,
and texture-unit isolation. No assertion failed; neither invocation trapped or
crashed. These results qualify these two fixtures only: no full-suite, gameplay,
GPU, or general crash-free claim follows.

## Gate and identity

Run: `scratch/runs/20261101-gl-software-texture-current-gate/` (ignored).
The bound predecessor was `redline-primary-movement-nov01`, worker
`01a195cf-fdc3-7d21-9351-16ac9792d028`. Its fresh worker `final.txt` and
`result.json`, plus the 06:40:56 UTC explicit runtime/source/build RELEASE,
were inspected before acquiring the lane at 06:41:09 UTC. The recorded current
main source snapshot was `1b6e5fdb7d6a37c12b4dd633279fb7db2c2e6ba5`.
The stale pre-repair baseline from the earlier zero-test sweep was not used.

The accepted locked build from `20261101-tachyon-flight-gated` was reused:
all 4,390 source input hashes and all 122 recorded non-scratch runtime-read
hashes matched, together with the canonical module and generated mirror.
No accepted selected-fixture result was found in the existing run-result search.

* Canonical module SHA-256:
  `330b120d64cfd4aebdd945c99a95022dbd97db7ee6962d7ec534c24da466011b`.
* Generated mirror SHA-256:
  `c0385b96ae59ed1820f29b4bfa547490cef9b7f172bbc0c4265d3e2dadbaae93`.
* Both actually instantiated harness modules: 2,025,649 bytes, SHA-256
  `e992f0f3fb8578688a93887030f6f7b58c5245e4925d46bab2d20c3dd732a157`.
  Every non-custom section matches the canonical module exactly; the canonical
  build additionally carries 37 bytes of custom metadata.

## Execution and evidence

The original entrypoints ran sequentially on local Node v24.18.1, each under
`timeout --signal=TERM --kill-after=5s 120s`. An unchanged, copied scratch
observer recorded module bytes at `WebAssembly.instantiate` and file-read
identities; it forwards the original calls and does not replace WAT exports or
pixel assertions. The original render helper compiles the canonical WAT closure
and instantiates shared 512 MB memory. The assertions call `gl_sw_observe` and
`gl_sw_emit_triangles`, then read the software DIB centre pixel directly.
The JavaScript canvas presenter is incidental; these are actual WAT pixel
results, not test doubles or a GPU draw.

The run directory contains compressed fixture logs, actual instantiated modules,
88 unchanged recorded reads per fixture, before/after source manifests,
`identity-before.json`, `verification.json`, `test-results.json`, gate evidence,
accepted build-log copy, publication evidence, cleanup evidence, `final.txt`, and
`result.json`. All 4,390 source hashes remained unchanged. No source, test,
compiler, or repository helper was edited. No box was owned (ID/state/expiry:
N/A). Own test processes/groups and the board watcher were checked absent;
free disk remained above 2 GB. No additional runtime work is required for this
coverage assignment.
