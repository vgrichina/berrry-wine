# RENDER-PERF-GATE

Adds a repeatable test of the accepted renderer's byte-identity overhead. The
production renderer and four existing acceptance oracles are unchanged from
`d9012a86a91c13dbe70dbcc4dceff2d7895c18a4`. Baseline: 16 existing tests pass and
the performance fixture is absent. Candidate: those 16 plus four new tests pass.
This repairs a coverage gap; it does not change renderer behavior or defaults.

Run from the repository root with installed Node:

```sh
NODE_OPTIONS=--max-old-space-size=128 node --test test/test-d3d9-rgba-performance.js
NODE_OPTIONS=--max-old-space-size=128 node tools/d3d9-rgba-benchmark.js > rgba-performance.json
```

`results.json` retains exact source/dependency/oracle SHA-256 pins, 42 operation
count rows and 30 timing rows. The accompanying logs retain baseline and final
acceptance. The coordinator receives the exact tested tree and publication SHA
in the task's external `ops/result.json`; this branch is not integrated into main.

The fixture calls exported `Bridge.call`, the actual command queue's owned-copy
path and `D3D9RenderWorker.create/execute`. Only the final device is a recording
sink. Every RGBA byte, reuse versus fresh identity, definition versus resident
reference, retirement under budget pressure and bounded LRU residency is checked.
Cases cover same-source hits, alias views, identical replacement ArrayBuffers,
an interior change outside the former sparse fingerprint, the final source byte,
full changes, equal bytes at a relocated pointer, unsigned allocation-epoch
rollover, and a three-level working set with space for two cached levels.

Deterministic budgets apply to 16x16, 32x32 and 64x64 BGRA8 textures. For N source
bytes, a hit performs exactly N source reads and N immutable-snapshot reads,
one scan, zero source copies, zero decodes and one cache reuse. A mismatch at
offset k performs exactly k+1 comparison pairs; changed pointer/epoch metadata
bypasses the scan. Misses allow three N-byte U8 allocations (RGBA, source copy,
owned command RGBA), two N-byte logical copies, plus fixed payload allowances.
The unchanged small-draw payload accounts for 5632 allocated/sliced bytes and
4096 `set` bytes; ceilings retain 512 bytes of fixed headroom. Hit allocation
does not grow with texture size. Extra actual scan, copy and allocation canaries
are rejected; exception and success paths restore all instrumentation hooks.

Instrumentation runs only during synchronous producer submission. The original
typed-array `every` executes its original predicate; callbacks count source
reads and temporary proxies observe actual snapshot index reads. Constructor,
`slice` and `set` hooks count U8 backing allocations and logical copy bytes.
Other typed-array allocations, decoder indexed loads/stores, sink copies,
hardware memory traffic and asynchronous backend work are explicitly outside
these counters. Instrumented durations are never used for performance claims.

Native timing runs without these hooks. Each row has five repeated batches of
eight submissions, bracketed by unchanged same-source controls; warmup samples
are discarded. Fixture creation, input changes, fences and full pixel assertions
are outside the timed span. Cold submissions use fresh fixtures with a separate
seeded unchanged control. Churn rotates three levels, so every changed draw
misses while each bracketing control hits. Raw control spread remains in the
report; there is no wall-time CI threshold.

For example, this host's 64x64 same-source mean was about 0.196 ms/submission,
with unchanged control batches ranging from about 0.167 to 0.270 ms. Both arrays
contribute 32768 identity-byte reads, while U8 allocation stays at 5632 bytes,
the same as for the smaller sizes. Some miss timings are lower than hit timings
because a hit scans all bytes while an early mismatch bypasses most comparisons;
these noisy microbenchmarks do not establish a useful renderer optimization.

These bounded synthetic textures and recording device exclude real game working
sets, GPU upload, browser structured cloning, scheduling, frame pacing, compressed
formats and large textures. No browser, GPU, VM, Wasm/compiler, game or test box
was used. No game speedup is claimed and no default is optimized from this run.

Initial fixture failures were retained externally: the first fixed allowance
omitted constant-bank copy costs, and the first retirement expectation assumed
immediate eviction despite a two-level resident budget. The final gate accounts
for observed fixed payload work and uses a one-level resident budget for the
invalidation cases; churn separately checks two-level LRU behavior. Existing
acceptance oracles were never edited.
