# Independent renderer performance gate review: REJECT

Candidate `a742e90d848f5e7fd98d384e2447466f0ec4119d`, tree
`85cd41da3d9f9b4c76a634dc3dc9ab8ba3a16918`, is unchanged. The original
16 immutable/ABA/source-identity tests and four performance tests pass (20/20).
This branch adds only this review and an intentionally rejecting reproducer.
No production renderer or existing oracle was modified; no main integration.

The instrumented path is real: exported Bridge submission, owned queue copies,
and render-worker endpoint, with a recording final device. Its counters observe
actual calls and snapshot reads, rather than calculate an expected answer.
However, those hooks do not provide the requested regression coverage.

| Actual producer mutation | Result at 16/32/64 squares |
| --- | --- |
| Indexed loop reads every source byte again, retaining a checked checksum | Accepted; extra 1024/4096/16384 source reads are invisible |
| Module-captured native Uint8Array constructor copies the source, retaining checked bytes | Accepted; extra N-byte copy and backing allocation are invisible |
| `new Uint8Array(new ArrayBuffer(src.length))`, retaining its backing store | Accepted; extra N-byte U8 backing allocation is invisible |

Each mutation is injected at the actual producer source-view site in
`lib/d3d9-host.js` through an isolated CommonJS module load. Production files on
disk remain untouched. Before the rejecting assertion, every mutant passes all
14 candidate operation-budget and exact-pixel/key/invalidation/LRU cases at each
size: 126 accepted rows in total. Separate hit probes verify that the extra work
executed and that source copies/checksums and final pixels are correct. All nine
hit probes report the same 5632 allocated U8 bytes and zero source-copy bytes as
the unchanged producer. The misses are not decoder accesses or sink copies.

The helper also resets `globalThis.Uint8Array` to the constructor captured at
module load. A throwing measurement entered with an existing constructor proxy
discards that proxy. It must restore the value present on entry. Ordinary native
global/prototype restoration, own method descriptors and snapshot identity do
restore after an actual producer error.

Positive controls show that bypassing the hooked `every` call is rejected by
the read budget, and that removing cache identity checks is rejected by the exact
RGBA assertion even when operation-budget assertions are independently bypassed.
The semantic oracle therefore remains useful despite improved broken-cache counts.

Run the unchanged candidate tests:

```sh
NODE_OPTIONS=--max-old-space-size=128 node --test --test-concurrency=1 test/test-d3d9-rgba-performance.js test/test-d3d9-immutable-rgba-snapshot.js test/test-d3d9-rgba-generation-independent.js test/test-d3d9-rgba-source-identity.js test/test-d3d9-byte-identity-acceptance.js
```

Run the review reproducer (expected exit 1, 13 tests: 3 pass, 10 fail):

```sh
NODE_OPTIONS=--max-old-space-size=128 node --test docs/reviews/render-performance-independent-oct26/reproduce.js
```

The ten failures are nine missed real-work regressions and one constructor
restoration failure. This file intentionally lives outside the ordinary test
suite. Its finally blocks restore module-cache entries and globals, even on
the expected failures. Repair should preserve the existing semantic checks and
make these reproducer assertions pass; no production optimization is requested.

The accepted exact-revision donor evidence is reused, with all 38 manifest files
verified. Its 42 count rows cover cold/hit/sparse/full/relocated/epoch/churn cases.
Its 30 timing rows cover all three sizes, five repeated batches of eight draws,
bracketed by unchanged controls with raw spread. Source inspection confirms
warmup, input mutation, pixel assertions and fences are outside timing; timing
has no CI threshold. This review repeats no timing run and claims no game speedup.
The counters' documented exclusions for other typed arrays and hardware traffic
do not explain the three missed source/U8 operations above.

Final original tests use one test worker plus its parent, each with a 128 MiB
heap cap. The initial original run left Node test concurrency unspecified;
it is historical evidence, not claimed to meet the four-heap concurrency limit.
The serial rerun passes all 20 tests. Initial diagnostic/read-bound incidents,
a resolved missing candidate object leaf, and an externally interrupted watcher
are retained in the incident receipt rather than relabeled compliant.

External evidence: `/tmp/render-performance-independent-oct26/ops/result.json`,
`original.log`, `rejecting-reproducer.log`, `reuse-and-identity.json`, publication,
resource and incident receipts. The identity receipt verifies 141 unchanged
renderer/dependency/helper/oracle files against candidate Git blobs. Raw reports
and this reproducer are retained on the task branch. No browser, GPU, VM, Wasm,
native compiler, guest or test box was used; box/expiry are null and lifecycle
remains coordinator-owned.
