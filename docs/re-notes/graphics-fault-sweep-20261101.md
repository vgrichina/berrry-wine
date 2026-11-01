# Graphics and fault native sweep, 2026-11-01

Five assigned harnesses passed; the threaded REP matrix failed its first case.
All six ran sequentially on exact main
`c2835c991da9624a112dacf4e095ef26d5dc7308`, tree
`910dbf41b9f35bdeb037f58d3ad214f8017342c0`. Evidence run:
`scratch/runs/20261101-graphics-fault-sweep/`. No production or test source
was edited. The previous seven-test sweep was not repeated.

| Test in `test/` | Exit / seconds | Result |
| --- | --- | --- |
| `test-d3d-device-creation-oom.js` | 0 / 5.172 | PASS: D3D2/3/7, 24 allocation failures and 24 valid retries; no partial publication, heap/object leaks, retained creator or slot consumption; ABI checks. |
| `test-d3d9-shader-retention-oom.js` | 0 / 4.520 | PASS: three final-allocation failures clear output, preserve refs and release both temporaries without IR leak/double free; valid retry/readback/release. |
| `test-seh-unhandled-terminates.js` | 0 / 0.165 | PASS: unhandled guest stops once at EIP 0/yield 2; a continuing raise storm yields to the host. |
| `test-unhandled-exception-filter.js` | 0 / 4.645 | PASS: setter chaining/clear, vectored registration/removal and stack cleanup, null pointer/record survival. Printed exception reports are asserted input paths. |
| `test-fault-reserved-page-cross.js` | 0 / 4.331 | PASS: dword read/store retranslate when a synchronous filter decommits the first page. |
| `test-rep-movs-fault-restart.js --matrix` | 1 / 4.825 | FAIL: first of 80 cases, `w1/df0/source/k0/cold/aligned/plain/mode3/threaded`; handler called 7 times, expected 1. Remaining 79 cases were not reached. |

The REP failure also reproduced without the evidence preload using
`node test/test-rep-movs-fault-restart.js --width=1 --operand=source --completed=0`
(exit 1, 4.768 seconds). Both runs compiled module SHA-256
`364f592ab6d8e9fd2f8816046427616e09064cc8ccc6a3e6fbf4b8c1d2656126`.
The last handler observation reports EIP/ExceptionAddress `0x40e000`
(4251648), whereas the REP prefix is at `0x40e00c` (4251660).
The pre-REP marker ends at 2 instead of 1; the post marker is 1. The repaired
page is mapped, guest EIP ends at 0, and there are no unhandled guest exits.
This is a reproduced restart correctness failure, not a native trap or hang.
The log explicitly describes its saved context as the **last** handler entry;
it does not establish the contents observed at the first of seven entries.

Source inspection supports a production limitation rather than a missing
dependency or stale build: `src/05b-string-ops.wat`'s `$rep_movs_mem` element
loop does not stop after `$gl8` redirects execution on a mode-3 miss, and
`$rep_movs_do` publishes register progress only after the complete copy.
`src/03-registers.wat`'s `$g2w_miss` explicitly documents that asynchronous
mode 3 returns sentinel scratch and allows the faulting operation to complete.
The observed block-entry EIP also cannot provide precise REP restart. These
facts explain the repeated dispatch and block rewind; they do not establish
that every matrix case fails. No actionable native crash was reproduced, so
the conditional crash-repair path was not invoked. Precise REP restart remains
unrepaired and needs a separately scoped source/decoder/accessor design and
regression work; no assertion was relaxed or failure reported as success.

All harness prerequisites were reviewed before execution. These are synthetic
native tests with 512 MiB shared Wasm memory, canonical WATX source compilation
and existing setup exports/allocation injections. The termination harness
loads the existing build and notepad fixture. The filter test uses the render
helper's default bundled fonts; every required font was present. The
page-crossing test selects `fonts: 'none'`. Canvas uses the repository's pure
JavaScript raster implementation. There were no dependency failures, heavy
runtime skips, browsers, boats, games, downloads or benchmarks. Every process
had a 120-second timeout; no process timed out. Only the default threaded REP
engine was selected; optimized engines, zero-count and alternative handlers
were not run.

Linux x64 Node `24.18.1`, V8 `13.6.233.17-node.50`, default engine tiering;
no `WINE_*` environment overrides or `NODE_OPTIONS`. `run.py` records commands,
times and disk checks in `outcomes.json`; the evidence-only preload
`capture-module.cjs` copies/hashes bytes then forwards unchanged arguments to
native `WebAssembly.instantiate`. Captured module identities:

| Test suffix | SHA-256 |
| --- | --- |
| d3d-device-creation-oom | `a49542126ec6da0a094d233a933c04450e0f2dcdbce88b85f3d84fb49de36822` |
| d3d9-shader-retention-oom | `b76228f6f13cac92ae20e4b227363b45e15444d38a30352e2492d5d1756e6dab` |
| seh-unhandled-terminates | `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf` |
| unhandled-exception-filter | `64668e162d8151b05d58802e603fb451549374d1a949e4228585c7b7e0c329a6` |
| fault-reserved-page-cross | `3083c0cf810567c1e6ab39f409602a30a05572bf173f639cf5aea702a9fbd812` |
| rep-movs-fault-restart | `364f592ab6d8e9fd2f8816046427616e09064cc8ccc6a3e6fbf4b8c1d2656126` |

`inputs-before.json` / `inputs-after.json` match without changes. All 369
tracked inventoried source/compiler/host/helper/harness/font files match the
requested Git revision. The broad inventory also hashed foreign untracked
`lib/wininit-boot.js`; it was untouched. The assigned REP harness is itself
untracked, so its result is **local harness against exact-main production**,
not proof that the harness belongs to that revision: 23472 bytes, SHA-256
`dd1cb1ccc3e64f20b81adb1e6bf8f1895e1f46276125a76afc2b6e03047be019`.
Its unchanged bytes are preserved as `rep-harness-original.js`. The ignored
notepad fixture is 53248 bytes, SHA-256
`e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340`,
preserved as `notepad-fixture.exe`.

`canonical-stamped-identity.json` verifies the existing 2025029-byte build
against fresh canonical compilation plus the build's region-layout section:
byte-identical SHA-256 `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`,
layout `3a03507bae8914c0`, matching the generated JS mirror. This compilation
check is not a new full build-gate pass. Evidence includes individual logs,
captured modules, `modules.jsonl`, prerequisites, environment, source comparison,
the reduced REP observation and reproduction scripts; all remain ignored.

Documentation-only publication uses `git diff --check`; no build gate or
census was changed. Free disk remained above 2 GB (minimum recorded about
2.53 GB). No boxes were assigned or accessed: ID/state/expiry and lifecycle
are N/A. This assignment ends with five passes and one precisely bounded
failure; gameplay, full27 coverage and all-app crash freedom remain unproven.
