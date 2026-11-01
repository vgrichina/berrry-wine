# Software GL packed points/lines and ortho fog — 2026-11-01

Both original, unchanged entrypoints passed against actual instantiated WAT
software-rendered pixels:

| Fixture | Result | Elapsed |
| --- | --- | --- |
| `test/test-gl-software-lines.js` | PASS, exit 0 | 3.498 s |
| `test/test-gl-software-ortho-fog.js` | PASS, exit 0 | 3.588 s |

Lines coverage includes packed points and lines, point size and invalid-size
handling, horizontal/reversed/vertical/diagonal/shallow/degenerate lines,
endpoint exclusion, line width and attribute restoration, smooth interpolation,
flat provoking-vertex colour, additive strip joints, near-plane shortening and
rejection, line depth testing, and double-valued clear depth. Fog coverage uses
the production encoder under glOrtho: eye z=0 remained red `[255,0,0]`, while
z=-0.9875 produced the expected halfway blend `[159,32,32]`.

No assertion failed and neither selected invocation crashed or trapped. These
results qualify only these fixtures; they do not establish actual-game, GPU,
full27, or general crash-free qualification. Accepted mipmap8/8 and texgen9/9
at `ea9b18ae9` were not rerun. Held algorithms were not exercised separately.

## Gate and identities

Evidence run: `scratch/runs/20261101-gl-software-lines-fog/` (ignored).
The bound predecessor was `redline-cutscene-skip-movement-nov01`, worker
`01a195e4-a16f-74d0-b993-e84bdcca3ecc`. Its fresh worker final/result files
(06:59:30 UTC) and explicit 06:59:26 runtime/source/build RELEASE were inspected
before lane acquisition and the 06:59:49 UTC source snapshot. Current main was
`a6dba873df94fb2b0c8a59d690cdddfcaa7555e8`. Preparation before the gate was
scratch only. Searching 2,735 existing run-result/verification/note files found
no accepted result for either exact selected fixture.

The accepted locked Tachyon build, also accepted by the texture run, was reused:
all 4,390 accepted source hashes and 122 accepted actual-read hashes matched,
along with the module and generated mirror. An additional 51 foreign untracked
source-tree files were pinned separately and left untouched. All 4,441 pinned
files remained unchanged. No build invocation was necessary.

* Canonical module SHA-256:
  `330b120d64cfd4aebdd945c99a95022dbd97db7ee6962d7ec534c24da466011b`.
* Generated mirror SHA-256:
  `c0385b96ae59ed1820f29b4bfa547490cef9b7f172bbc0c4265d3e2dadbaae93`.
* Actual instantiated module in each fixture: 2,025,649 bytes, SHA-256
  `e992f0f3fb8578688a93887030f6f7b58c5245e4925d46bab2d20c3dd732a157`.
  Every non-custom section equals the canonical build; the canonical build
  additionally contains 37 bytes of custom metadata.

## Execution and cleanup

The original entrypoints ran sequentially on local Node v24.18.1 under
`timeout --signal=TERM --kill-after=5s 120s`. The existing forwarded read-only
observer was copied byte-for-byte from the accepted texture run. It records
file reads and actual WebAssembly instantiation bytes without replacing WAT
exports or assertions. Both fixtures recorded 88 unchanged actual reads.
The unchanged render helper compiles the canonical WAT closure and instantiates
shared 512 MB memory; assertions inspect software DIB pixels directly.

The run contains compressed original output, both actual modules, loaded-read
identities, before/after source manifests, accepted build-log copy, gate files,
prior search, test results, verification, cleanup, publication, final.txt and
result.json. No source, test, compiler, or repository helper was edited. Own
test processes/groups and watcher were checked absent; no temporary files or
box were owned (box ID/state/expiry N/A). Free disk remained above 2 GB.
No further runtime work is required for this coverage assignment.
