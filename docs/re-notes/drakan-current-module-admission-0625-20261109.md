# Drakan exact current-module admission, 0625

The demonstrated [0618 pre-Worker failure](drakan-current-flight-0618-20261109.md)
is repaired for the actual selected current module:
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
2,185,596 bytes. The older
`4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3`,
2,184,500 bytes, remains admitted and freshly tested separately.

Evidence is `scratch/runs/20261109-drakan-current-module-admission-0625/`.
Git base is `ece4e9d08e62517387056d8463c2717022b2acad`; Git plus the small
owned binary patch and run-input patches is the source recovery authority.
Modules and installed media are recorded by existing path/hash, without copies
or archives. No Chrome, game, original action, physical input, box, deployment,
agent or additional Codex worker was launched. Production guest Workers below
are Node worker_threads executing the complete module and synthetic x86.

## Exact bytes and owner propagation

`host.js` now admits just these two SHA-256/length pairs from its existing
private actual-compile WeakMap. Boolean opt-in must still precede selected
compilation. The snapshot remains unshared, private and independent of the
public source-loader buffer; its view offset and length are preserved. There
is no canonical refetch, supplied-Module authentication, substituted current
CPU, configuration change or default observer hashing/byte retention.

`lib/drakan-observer-worker.js` independently verifies the same exact pairs.
GuestThreadHost derives its owner digest by hashing its actual retained bytes;
the production guest Worker independently copies, verifies and compiles those
bytes. An unrelated supplied Module is ignored on this path. WorkerBinding
also verifies its actual bytes and uses that digest for its native owner and
adapter authentication, rather than claiming 4b45 for every instance. The
post-hash setup check still refuses an already-released or retiring owner.

The original [2140](drakan-browser-observer-optin-2140-20261108.md),
[2105](drakan-observer-worker-integration-2105-20261108.md) and
[2127](drakan-release-promise-2127-20261108.md) contracts remain in force:
actual Module/memory/instance/main-Worker identity, native process/epoch and
invocation identity, exact32 finite observation, active state1 and enclosing
CALL/RET completion, original action start/deadline, freshness, one-use refusal,
and actual release callback Promise settlement/error. No observer input poll,
down injection or guest write was introduced. Only four production JS files
and their four required whole-file census hashes/review reasons changed; no
native custody, Quake2 or Warcraft provider was edited.

## New evidence

Before changing production, `old-actual-gates` reran the actual retained 0618
failure harness, suppressing only its old output-file write. Artifact, explicit
source and artifact-fallback each compile a320 and fail the strict 4b45 gate
before Worker construction; late opt-in and shared input are also refused.
`old-browser` separately records the original test's hardcoded hash failure;
that assertion failure is not the causal production reproduction.

Current tests use existing `build/wine-assembly.wasm` directly:

- Native passive adapter: **54 PASS**, including real native run/import/chain,
  fusion and precompiled CALL/RET, unarmed parity, native owner invalidation,
  exact-down state1 and all enclosing returns. This ran on a320 before admission.
- Browser host/owning Worker: **20 PASS**. Actual compile/start/observe methods
  in the existing offline VM realm feed production GuestThreadHost/WorkerLink
  and guest-worker. Artifact/source/fallback provenance, no refetch, late opt-in,
  wrong bytes, shared buffers, stale Module/Worker/memory, source view offset and
  mutation after compilation, altered caller bytes, cap/future/expired starts,
  native stage12, asynchronous success/rejection, setup failure and retirement
  are covered. Source-loader output and layout boundary are synthetic; this is
  not a browser source-compiler execution claim.
- Worker integration/release: **60 PASS**, with browser dependency-loading
  cases enabled. Includes wrong actual bytes before instantiation, unrelated
  supplied Module, another admitted digest falsely claimed as owner, native
  consume/returns and all original negatives. Delayed success/rejection and
  synchronous throw during stop/deadline/retirement/setup/expired/unavailable/
  constructor failure join actual callback settlement exactly once. No unhandled
  rejection occurs; busy-slice release remains independent.
- Worker imports: **11 PASS**. `flock /tmp/wine-build.lock bash tools/build.sh`:
  **PASS**, all gates and both artifacts; current output remains exact a320.

Legacy 4b45 was not found as an existing local module file. The separate
`legacy-in-memory.cjs` recipe reads Git commit
`093990bdd671f31570bb15e4c6022d335d73e1d5` into an in-memory compiler VFS, uses
the canonical compile and layout-section helpers, and asserts the complete
4b45 SHA-256 and length before testing. It never changes build artifacts or
writes source/module copies. Against the new production providers, the same
browser suite passes **20**, and Worker integration/release passes **60**.
These legacy results are separate from a320 qualification.

Retained failures include one browser run without native completion, the first
legacy recipe's incorrect compiler-result property, and the first build's
expected refusal of four stale whole-file census hashes. The browser diagnostic
was improved; no deadline/freshness limit was relaxed and no production semantic
change was made to obtain the subsequent pass. No cause is inferred for that
single completion failure. Every command has a prearmed finite parent watchdog,
actual wait and separate drained stdout/stderr; gzip evidence is independently
reread for integrity. Final source patches and provider identities are sealed.

Box ID **NULL**, state **NOT_CREATED**, expiry **NULL**, stop receipt **NULL**.
Free `/home` remained above 1.5 GB at sampled checks. Next is a separately
authorized original run with fresh live/media identity and its real ordinary
input/release caller; this task claims only offline current-module compatibility.
Single-task STOP after the explicit-path commit and authenticated main publication.
