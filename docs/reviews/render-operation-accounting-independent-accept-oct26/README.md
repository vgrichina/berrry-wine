# Independent review: REJECT

Candidate `58317122c69c9ad0ff8486e14326909c90041dcc`, tree
`fa63d6b72b6f15c777565dfa19eb3d57d193a97a`. Source/fixture evidence tree
`20adcd822c61e1f3d7125d693d1094630faef8a1` includes the candidate unchanged
and this independent reproducer, results and logs. Production is not repaired here.

Two substantive defects prevent acceptance:

1. `measure` in `tools/d3d9-rgba-benchmark.js` recognizes a source view only
   when its byte offset is one of the original starts and its length equals
   the whole texture. A real additional indexed scan through two half-length
   subviews therefore consumes every source byte but reports zero extra
   `indexedSourceReads`. The unchanged budget accepts it at 16/32/64 square
   textures (1024/4096/16384 extra byte reads). The independently calculated
   checksum and exact rendered RGBA prove execution; no producer counter or
   mutant-name matching is used. This is indexed JavaScript work, rather than
   opaque native builtin work.
2. `instrument` in `tools/d3d9-operation-observer.js` preserves a computed
   member receiver only for a `CallExpression`. A computed tagged-template
   receiver becomes an unbound function after `observer.read`. With the
   actual loaded renderer containing `receiver['tag']\`\``, native execution
   returns 17 and successfully draws; observed execution loses `this` and
   returns -1 with a TypeError. The parser accepts this syntax; it does not
   reject it as unsupported grammar. This is an observer-induced semantic
   change, not an operation budget rejection.

Run from the repository root, with installed Node and no compilation:

```sh
NODE_OPTIONS=--max-old-space-size=128 node --test --test-concurrency=1 docs/reviews/render-operation-accounting-independent-accept-oct26/reproduce.js
```

Expected result on this candidate: **10 pass, 4 fail**, exit 1. Three failures
are the subview scans; one is the receiver defect. The nine passing operation
wrappers independently verify each original scan, captured lexical U8 copy,
and ArrayBuffer-backed allocation at all three sizes, check its real output
and exact measured byte excess, then assert the specific budget diagnostic.
The tenth passing control checks ordinary receiver/evaluation order, derived
constructor/new.target behavior, optional-key suppression, throwing argument
evaluation and explicit nonterminal optional-chain rejection.

The original suites pass **20/20**, including immutable snapshot, ABA,
source identity and exact-byte controls. Candidate focused tests pass
**16/16**, including accessor/descriptor restoration on success and throw,
and native/observed equivalence for the existing fixture paths. The original
independent `render-performance-independent-oct26/reproduce.js` remains
byte-identical and reports **4 pass, 9 fail**, exit 1: the nine original
mutants now reject at the earlier budget gate. This is not a green 13-test
suite. Its four passing controls retain suppression fail-closed, broken
identity semantic rejection and error/global restoration checks.

The pinned source hashes, donor result and identity/reuse receipts are retained
in `results.json` and external ops receipts. Coordinator-verified production
and evidence seals are reused; no duplicate seal packaging or timing runs.
Existing 30 timing rows remain historical evidence, not a speedup claim.

Observer scope remains synthetic synchronous BGRA8 producer submission, not a
general profiler: arbitrary native work, other typed arrays, device/sink work,
and unsupported grammar are outside the existing coverage. Bundled Acorn and
Node inspector are required. The new failures occur within parsed JavaScript
indexed-read/receiver behavior and require source fixes plus fresh acceptance.
No main integration, deployment, browser/GPU/VM/Wasm/compiler/Boat execution,
or test-box lifecycle action was performed. Coordinator owns lifecycle;
no box was assigned. External evidence and resource/incident receipts:
`/tmp/render-operation-accounting-independent-accept-oct26/ops`.
