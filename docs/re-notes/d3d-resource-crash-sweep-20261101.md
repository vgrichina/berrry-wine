# D3D resource crash sweep, 2026-11-01

Blocked at the exact-revision prerequisite before any test subprocess started.
The checkout initially reported main
`00072255dd3d38df6e4d87935da9b1d9a7f17dd7`, as requested. Before execution,
the coordinator advanced shared main to
`e58f596a4b33fe72d28ed79ab3fd2a34b4558281`. The runner's first assertion
(`run.py:13`, branch main and HEAD equal the requested revision) raised
`AssertionError`. This is an assignment prerequisite failure; no test harness,
dependency failure or production crash was observed.

| Requested test (`test/`) | Result |
| --- | --- |
| `test-d3d-root-lifetime.js` | NOT RUN: exact HEAD prerequisite |
| `test-d3d-render-lifetime.js` | NOT RUN: same blocker |
| `test-d3d-device-enumeration-lifetime.js` | NOT RUN: same blocker |
| `test-d3dim-execute-buffer-lifetime.js` | NOT RUN: same blocker |
| `test-d3dim-texture-release-arena.js` | NOT RUN: same blocker |
| `test-d3d9-depth-release.js` | NOT RUN: same blocker |

All six entrypoints and their canonical compiler/render harness were inspected.
They use native Node/Wasm and the repository's JavaScript canvas, with
`fonts: 'none'`; enumeration reads `notepad.exe`, and depth release reads
`calc.exe`. Both fixtures exist. None requires a browser or heavy runtime.
The prepared runner specifies sequential `timeout 120s node --require
<run>/capture-module.cjs test/<name>.js` commands. It never reached them.
No earlier sweep test, REP test or REP diagnostic was executed.

Evidence is ignored under
`scratch/runs/20261101-d3d-resource-crash-sweep/`. `first-failure.log` records
the runner assertion; `result.json` records six unexecuted tests and zero
captured modules. `head-diff.txt` shows the intervening commit changes only
`TODOS.md` and `ops/STATUS.md`. Their contents were not edited by this worker.
The exact HEAD condition was preserved despite that documentation-only diff;
no checkout, reset, alternate tree or gate bypass was used.

`inputs-before.json`, `inputs-after.json` and `unchanged.json` pin 1,167
source/compiler/host/helper/test/fixture/build files, unchanged across evidence
collection. `source-vs-main.json` confirms all 1,163 tracked inventory files
match the requested revision. The remaining four are the two ignored fixture
executables and two ignored build modules. The existing primary build is
2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
Full per-file identities, including the compatibility build, compiler and
fixtures, are retained in the inventories. No test module was compiled or
instantiated, and no new canonical build verification is claimed.

`environment.json` records Linux x64 Node/V8 identities, environment overrides,
free disk and pre-existing shared-tree status. Free disk remained above 2 GB
(about 2.53 GB). No production, test, compiler, census or foreign WIP file was
changed. Publication validation is documentation-only `git diff --check`.
No boxes were assigned or accessed: box ID/state/expiry and lifecycle are N/A.

Next: coordinator scopes a new exact revision or explicitly accepts identical
test inputs across documentation-only HEAD movement, then authorizes the six
still-unexecuted tests. No gameplay, full27 or all-app crash-free conclusion is
supported. This worker stops after publishing this prerequisite blocker.
