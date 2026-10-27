# Independent compiler lexical reuse acceptance — 2026-10-27

**ACCEPT candidate `1cf9788cc3ac807027206c39fcbf1d2771599845` against baseline
`0bbff116aa79f55e7a8ba9afaf3122e5f0a0a110`, within the production primitive-string,
build-scoped lexical-range contract.** A real reduction of repeated source scans
justifies considering a separately authorized, freshly admitted changed-source
canonical build under the unchanged 90 CPU / 120 wall controls. This acceptance
does not authorize that build, establish sufficient savings, qualify any module,
or permit replay of the unchanged rejected build.

Historical 105.48018 CPU rejection remains binding; emitted modules remain
**UNQUALIFIED**. Complete unique invocation CPU remains **UNKNOWN**. The trusted
supervisor SHA-256 `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`
and its actual guard were not changed.

## Independent evidence

Source/report/diff/publication and the production scanner, location registry,
context creation, include traversal and error handling were read before the
first behavioral test. Candidate file SHA-256 and Git blobs were independently
checked against the immutable candidate. `ops/pins.json` also binds the exact
compiler excerpt recipe: inclusive lines 67–125, original order/endings. Candidate
manifest SHA-256 `487ed0d5a09fe15043a11cf70ffa0e1304194ceda453756fbbe26a45b06d44d0`
was checked; its coordinator-verified unchanged payload groups were reused.

The unchanged `watx-compiler-frontend-reuse.test.js` ran FIRST, on its SMALL
fixture with the actual production CLI and compatibility transform. Exact
tail/compat/named bytes, complete failure stderr and all 68 comparisons passed.
No production source tree was compiled. No full module was instantiated.

An additional 125 comparisons used the actual baseline tools recovered by local
`git archive` from the pinned commit, rather than treating candidate no-reuse
as the sole baseline. Complete compile results were compared against both
baseline and candidate no-reuse, including all diagnostics, stages, error
locations, binary bytes and region output. Normalization preserves undefined,
typed-array type and elements, and every result key; it removes VM realm
prototype differences only. Cases include trailing atoms/strings/parens, quoted
parentheses, comments in heads, lexical versus include/type error precedence,
include order/cycles/alias deduplication, in-place VFS deletion/change/readdition,
filename changes after cache hits and failures, macros/header macros/regions,
name/shake/tail options, reversed order and mutation of previous result containers.

Additional actual CLI checks compared baseline bytes/errors with default reuse
and `WINE_WAT_FRONTEND_REUSE=0`. Named/plain calls ran in reversed order, with
two invocations in each process and changed source on the second invocation.
Every default invocation created a distinct initially empty scope; each artifact
within that invocation used its own scope consistently. No-reuse and baseline
created zero scopes. A movable-region shake fixture and missing-include failure
also matched. Preloads replace only the small source-closure supplier and observe
calls; compiler/transform/validator/results remain real. Tiny CLI modules undergo
their normal production validation, not guest execution.

Direct production-source instrumentation verified successful lexical scans do
not register filenames or change location state. Two compilations created four
distinct parser contexts, with scanner calls staying at one; total head-helper
calls rose from two to three because header work still runs. Fresh descriptors
retain current filenames after identical-text cache hits (`alpha:3:1`, `beta:3:1`),
and changing source under `alpha` updates the location to `alpha:4:1`. Lexical
failures carry the current filename on every attempt and do not enter the cache.
Mutating one returned form or result does not contaminate the next compilation.
Frozen list/range mutation rejects; the only range fields are start/end/head.
An intentionally unsafe cache that discards source after the first line was
**detected by the same full-result oracle**. The donor's unsafe filename-only
cache mutation was also detected by the unchanged first test.

`check-watx-provenance.js` passes: all 23 required files match and CHANGELOG is
sealed. Affected production and five macro-body regressions pass. No broad replay,
full build, main integration, Boat, browser, guest or worker launch occurred.

## Safety and cost interpretation

The exact-string Map avoids filename collisions and distinguishes transformed
compatibility text. The compatibility VFS remains a transformed copy. Successful
scanner/head output depends only on source text and immutable character tables;
the successful scanner has no location-registration side effect to preserve.
Failed scans are not cached. Includes and later mutable compiler work still run.
Primitive strings come from the actual production byte-to-text boundary. Mutable
objects masquerading as strings, user-supplied malicious cache implementations
and concurrent mutation of compiler internals are outside this acceptance.

The private scope retains each distinct successful source string and its frozen
range/head objects until that build invocation releases the scope. It retains
original and changed compat strings together; it is not an eviction cache and
does not promise a memory reduction. In production the scope covers two artifact
compilations plus optional names; standalone default `compileClosure` does not
create persistent reuse. Function bodies, ASTs, contexts, macro/type maps,
declarations and region allocators remain per-call. Static review and the
mutation/context/location observations support this boundary.

Actual tiny workload: four compilations fell from 20 scans / 4460 code units to
8 scans / 1866 code units, with 12 hits. Reversed in-process samples measured
no-reuse 22.969/37.076 ms CPU and reuse 16.793/19.113 ms CPU; RSS samples ranged
71,741,440–84,307,968 bytes. These are noisy small-fixture observations, **not a
full-tree speedup or memory forecast**. The first outer guard recorded peak RSS
173,957,120 bytes, wall 0.853 s and conservative supervisor CPU 3.201891 s; that
CPU value is not complete unique invocation CPU. All operations retained distinct
stdout/stderr and cleanup receipts under the same CPU/wall/file/output limits.

Three harness incidents were preserved, not treated as candidate defects:
cross-VM TypeError prototype matching; an overly broad head-call-count assertion;
and shake correctly rejecting an all-fixed-region fixture. Only affected or
unfinished checks ran after correction. The 125 completed comparisons and six
completed repeated-invocation CLI cases were reused. Corrected scripts can also
run from scratch using the recipe below. Initial terminal-output, remote-config
and directory-block-accounting incidents are recorded in `ops/incidents.md`.

## Portable recovery

The branch contains all three independent scripts, the unchanged original test,
the small fixture, candidate source and a compact complete acceptance summary
under `test/fixtures/airstrike-compiler-reuse-independent-accept-oct27/`.
On an owned machine with both pinned commits available, recover only baseline
tools and the two libraries using local `git archive` (no fetch/clone required):

```sh
git archive 0bbff116aa79f55e7a8ba9afaf3122e5f0a0a110 tools lib/dispatch-trampoline.js lib/wat-manifest.js > baseline.tar
mkdir baseline
tar -xf baseline.tar -C baseline
node --max-old-space-size=512 test/watx-compiler-frontend-reuse.test.js --evidence="$EVIDENCE/production-first"
node --max-old-space-size=512 test/airstrike-compiler-reuse-independent-accept-oct27.js --baseline="$BASELINE" --fixture="$EVIDENCE/production-first/fixture.json" --evidence="$EVIDENCE/independent"
node --max-old-space-size=512 test/airstrike-compiler-reuse-cli-isolation-oct27.js --baseline="$BASELINE" --fixture="$EVIDENCE/production-first/fixture.json" --evidence="$EVIDENCE/cli"
node --max-old-space-size=512 test/airstrike-compiler-reuse-locations-oct27.js --evidence="$EVIDENCE/locations"
```

Set `BASELINE`/`EVIDENCE` to owned absolute directories; this recipe does not
authorize execution without resource admission. On this host use the retained
owned `ops/run.py` wrapper, execution pool and Git lock, not bare commands.
Its Git DATA limit applies only to Git subprocesses. Node startup was verified
with `/usr/bin/node` v20.20.2, `--max-old-space-size=512`, exact sanitized environment,
CPU 90, file 24 MiB, DATA/AS unlimited and unchanged supervisor physical RSS limits.
The heap flag is not a total-process memory cap.

Canonical external manifest: `/tmp/airstrike-compiler-reuse-independent-accept-oct27/ops/receipt-manifest.json`.
It binds original diagnostics, candidate/baseline/test pins, checkpoints,
publication, cleanup, resources and recovery archive. Immutable donor objects
are accessed through flattened read-only local views, with recovery identities.
The task branch is the remote backup of the report/reproducers; ignored evidence
has a separate compressed recovery archive in the launcher's scratch directory.
No box was assigned; future lifecycle and build decisions belong to the coordinator.
