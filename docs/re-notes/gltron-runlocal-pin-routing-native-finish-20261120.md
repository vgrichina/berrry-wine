# GLTron exact run-local pin routing, 2026-11-20

Run: `20261120-gltron-runlocal-pin-routing-native-finish`.

The preserved loader redirected every relative helper import into its closed
source run. The native-init adapter now names the current run's `pin.cjs` by
its exact absolute filename. `tools/gltron-qualified-run-loader.cjs` compiles
retained, SHA-256 checked sources under their actual filenames. Relative
imports resolve only within that declared source set; missing dependencies,
wrong paths, extensionless guesses and corrupt inputs fail closed. Nothing is
installed in the old run and no repository/source-tree copy is used.

The current run pin selects `74781b` common code in memory. The Hexen controller
uses committed `5c1f662bd` bytes, excluding the concurrent manual-context WIP.
The served runtime remains the `f6962ba5` graph with the existing 2,418,710-byte
module `a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`.
Archived input identities and all 92 media references were checked before use.
The prior release helper's actual-child old failure/new READY, independent UP,
EOF and host-consent evidence is referenced unchanged.

Actual compiled lazy native-init preflight reproduces the old pin ENOENT and
executes the corrected pin body, controller bind and bootstrap exports with
local fixture returns. It also compiles the actual retained WebAssembly module
and inspects imports/exports. This establishes import closure, not native USER
consumption.

The sole authored browser scope reached a missing declared startup helper,
`readiness.cjs`, before host consent, native init or key dispatch. Its disk
boundary permanently closed; no original or replacement scope was launched.
The initial preflight missed this startup import. The final preflight now
checks every declared startup and lazy helper before browser execution,
including the exact `readiness.cjs` → `diagnostics.cjs` chain and the latter's
qualified repository binding. An omission regression proves refusal before
any module executes. Actual absent/wrong-pin controls also refuse.

The four loader regressions and thirteen inherited release/group controls
pass. Per-key native consumption, independent key UP, order, focus-target,
mixed ACK, cancellation and original gameplay remain unqualified. Group and
release WIP is preserved; this change does not claim native gesture success.
