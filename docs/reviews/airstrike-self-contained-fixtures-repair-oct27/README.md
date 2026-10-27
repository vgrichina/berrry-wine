# Self-contained Airstrike fixture repair

Candidate parent: `a6a5cda53242adba9738a30811cee60fa696548a`.
This patch changes only the two offline tests, their six pinned historical inputs
and fixture documentation/manifest. The production controller and bridge retain
their accepted byte identities, recorded in `dependency-manifest.json`.

The integration failure is retained in `original-missing-closure-receipt.json`.
Its missing dynamic reads/subprocess inputs are now versioned under
`test/fixtures/airstrike-caption/`; no startup logs or guest assets were copied.
Every original assertion AST and the original reproducer bytes are unchanged.
Both test classes now clean their temporary output directories via unittest
cleanup, including assertion failures. Historical JSON path fields are inert.

Validation from a separately copied, standalone sparse tree, unrelated working
directory and explicit clean environment: first the unchanged height-8 attack
through actual Controller CLI and Bridge.run, then the remaining three interior
tests and all ten Console obscuration tests. All 14 tests pass. The actual normal
route emits the original expected sequence and observes normal Quit in the
offline protocol fixture; this is not guest/gameplay acceptance.
Independent 32 geometry cases and unaffected eight producer controls are reused
from the exact accepted production pins. Ten fixture-affected controls were rerun.

The dependency manifest binds every repository input's path, bytes and SHA-256;
imports, dynamic reads, subprocess argv, configuration, image, standard-library
runtime identity, source operation inventory and publication footprint. The
read-only audit observed precisely ten declared source/data inputs, no predecessor
access, no repository writes and clean temporary outputs. Three absent Python
cache lookup attempts are recorded separately. The audit observer's rejected
external-data control passed. Its CPython hooks are validation instrumentation,
not an OS sandbox or a required repository dependency.

Retained incidents: initial oversized displays; two observer directory-open
cleanup failures (missing openat dir_fd and implicit CLOEXEC handling); one
footprint scan/atomic-rename race that interrupted the incomplete interior group;
and a manifest check that initially counted missing optional pyc lookups as data.
Original streams and receipts are preserved, with no test assertion weakening.
Passing groups were checkpointed and not rerun for packaging corrections.

`causal-diagnostics.json.gz.b64` losslessly encodes bounded original worker
scripts, command/environment hashes, inherited limits, admission receipts,
supervision, failed setup, distinct stdout/stderr and cleanup results. Decode with
base64, gzip, then JSON; each member contains its original base64 bytes/hash.
Fixture files themselves are versioned directly and need no decoder.

Run either test directly with `python3 -B` from any working directory. Only the
four Python sources plus the six declared fixture files and Python's standard
library are needed. No ops sibling, donor tree, Node, guest, build or deployment
is required. Independent acceptance of this relocated fixture patch is required
before integration. This is a sparse report branch: never merge the whole orphan
tree. Integrate only the accepted four source/test paths and fixture directory,
preserving main ownership and the pinned production bytes.
