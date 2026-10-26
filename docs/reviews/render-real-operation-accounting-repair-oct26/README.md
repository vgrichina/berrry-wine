# Actual renderer operation accounting repair

Candidate: `d4f2fc687d8330db533e7336ea9a1c5585272b65`.
Source/fixture tested tree: `0a24eeed2d8dcf011e75cacbad6c28bb988e0dd8`.

The helper now observes ordinary computed source reads and constructor operations
in the exact loaded renderer script. Node's inspector retrieves that script,
including independently injected controls and captured lexical constructors.
Node's bundled Acorn parser supplies the AST; a separate test-only module compiles
the same expressions with observation around computed reads and `new` operations.
It neither substitutes producer decisions nor reads producer-reported counters.
The production renderer and existing test/review oracles are byte-identical.

The original U8 allocation/copy budgets are unchanged. Added indexed reads have
a separate exact budget: zero on hits, N decoder loads on BGRA8 misses. Direct
ArrayBuffer construction has a separate backing budget: zero on hits, at most
4096 bytes/three constructors on misses. The latter accounts for the actual cold
vertex scratch (two empty buffers and one 4096-byte growth), which the earlier
helper never counted. U8 views do not double-charge their backing allocation.

Entry-time global constructor descriptors, prototype hooks, bridge own method
descriptors and snapshot source identities are restored on success and failure.
Caller constructors and hooks are called through. Native timing uses the original
export without AST instrumentation; existing timing evidence is reused, not rerun.

Validation:

- Original 20 tests pass, including immutable snapshots, ABA/rollover, exact source
  identity, residency, queue ownership and the original performance fixture.
- Added 16 tests pass: all three real regressions at 16/32/64, normal/throwing
  accessor and descriptor restoration, AST evaluation-order/receiver/lvalue
  behavior, object-key conversion, and native/observed exact-pixel equivalence.
- All 42 operation rows pass. Warm U8 allocation remains 5632 bytes, with zero
  indexed source loads, source copies or backing allocations.
- The unchanged 13-test independent reproducer reports **4 pass / 9 fail**.
  Its nine mutants now throw at `runCounts`' actual budget, before the fixture's
  subsequent expected-acceptance assertion. These are retained as raw nonzero
  results, not reported as a green suite. The four remaining controls pass:
  suppressed instrumentation rejects, broken cache pixels reject, producer-throw
  restoration passes, and prior-global restoration passes. The unchanged baseline
  was 3 pass / 10 fail. Direct added tests verify each mutant's measured excess
  and rejection reason without that fixture's earlier acceptance precondition.

This is a scoped synthetic BGRA8 source-operation gate, not an engine profiler.
It counts ordinary computed reads, `new` construction, and the existing native
every/slice/set hooks. Other typed arrays, sink work and arbitrary native builtins
are outside the counters. Computed method receivers/lvalues retain their original
syntax. Terminal optional computed reads are supported; nonterminal optional
computed chains fail closed. The installed Node must expose its bundled Acorn and
local inspector script retrieval. No renderer optimization, new timing claim,
game/browser/GPU/VM/Wasm execution or main integration was performed.

Full evidence and recovery instructions are retained in
`/tmp/render-real-operation-accounting-repair-oct26/ops/result.json` and its manifest.
Initial diagnostic excerpt, allocation-category and intermediate fixture failures
are retained in `incidents.json`; final admission does not retroactively certify
earlier projections. This branch requires fresh independent acceptance.
