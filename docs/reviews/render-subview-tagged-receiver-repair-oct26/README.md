# Source-range accounting and computed template-tag receiver repair

Candidate: `6ad4cfed7d6c6904f96658fe01c89af9c626d514`.
Source/fixture tested tree: `45226508cbd7d9182deb4fdea90e97c280748938`.

The unchanged independent reproducer first returned **10 PASS / 4 FAIL**.
Three extra full-source indexed scans through two half views escaped the
16/32/64-square budgets, and a computed template tag lost its receiver
(native probe 17/draw 1 became TypeError/draw -1).

The helper now intersects U8 views and individual indices with the fixture's
source byte ranges on the measured backing buffer. Nested subviews, captured
constructor views, aliases and views straddling range boundaries are accounted
without counting unrelated bytes or out-of-bounds indices. Copies through
constructors and slices use the same range intersection. Slice start coercion
runs once in native order, including negative offsets.

The AST observer retains computed template tags as references, preserving their
receiver along with object/key/getter/substitution order, exceptions and native
template-object identity. Unsupported computed optional references/chains,
suspending or direct-eval optional keys, and value reads from computed `super`
fail explicitly. This is a scoped test observer, not a general JavaScript
profiler; opaque native operations and other typed-array classes remain outside
the established coverage.

Results on the repaired source:

| Check | PASS | FAIL |
| --- | ---: | ---: |
| Unchanged independent reproducer | 14 | 0 |
| Original suites (immutable RGBA, ABA identity, budgets) | 20 | 0 |
| Existing focused operation-accounting suite | 16 | 0 |
| New range/tag regressions | 21 | 0 |
| Older raw review suite, expected measured budget rejection | 4 | 9 |

The older nine failures are real indexed/copy/backing-allocation budget
rejections; they are not reported as green 13. Its suppression, broken identity
and restoration controls still pass. New regressions also verify descriptor,
snapshot-source and observer-scope restoration after an actual template-tag
throw. The renderer's real 4096-byte scratch recovery allocation is observed and
rejected by the warm budget before a subsequent normal warm draw passes.

`lib/d3d9-host.js` remains byte-identical (SHA-256
`3519e4ffeee513a1ba106ac25c77cadab7ffbe492eb61f70f5b4f7fbb38db22c`).
Both review reproducers, original tests and all budget ceilings are unchanged.
The existing 30 timing rows and identity seals are reused from the accepted
exact-renderer evidence; no timings, browser/GPU/guest runs, production renderer
changes, speedup claim or main integration were performed.

Reproduce the focused checks with Node:

```sh
node --max-old-space-size=128 --test --test-concurrency=1 test/test-d3d9-subview-tagged-receiver.js
node --max-old-space-size=128 --test --test-concurrency=1 docs/reviews/render-operation-accounting-independent-accept-oct26/reproduce.js
```

This directory retains baseline/repaired/original/focused/new/raw logs and
`controls.json`. Full resource, identity, publication and cleanup receipts are
in `/tmp/render-subview-tagged-receiver-repair-oct26/ops/result.json` and its
evidence manifest. Initial inspection/read-limit qualifications and development
failures are retained in `incidents.json`; final compliant gates do not erase
those incidents. No test box was assigned or accessed; lifecycle remains with
the coordinator. Root tracked files/index/refs and the donor stayed readonly;
only the root append-only coordination board was written.
