# Independent four-namespace acceptance

PASS for candidate `545a51f4a11ac2e88293ac2c8dcc6be3b9ceb124`, backend 12321 bytes,
SHA-256 `d129d1a4d42d9dd4077941927fa57220a32580667a1fef226de11dec2a411171`.
The five production inputs were read-only and match `current-dispatch.json`.
`acceptance.json` is the canonical result and provenance manifest.

The unchanged `rename-type-reproduce.py` ran first, with the explicit absolute
candidate backend argument. Both mismatches preserved namespace and accounting
and returned EISDIR/ENOTDIR. This independent run satisfies boundary-first ordering;
the predecessor's procedural caveat remains recorded rather than reused as proof.

Required groups passed: rename-type 156/9 mutants; cycle 14+24/16 oracle controls/
4 mutants; removal 14+168/12 oracle controls/9 mutants; READDIR 870 original,
7329 independent wire observations, 10 corrupted-state EIO cases and 7 mutants;
24 four-repair interactions. The original READDIR adversarial gate also passed.

New `interleaved.py` derives expected namespace, inode lifetime, payload, open
handles, cumulative writes, peak/live accounting and allocation cursor from its
declared operations. It compares the full modeled state after each step and
independently encodes READDIR records. Sixteen sequences exercise both rename
opcodes, payload variants, cross-parent moves, type errors, cycle errors,
nonempty removal, open-unlinked file reads, final release and reclamation.
All 688 state checks pass. Four independently corrupted source copies are rejected,
with their first counterexamples and source hashes in `interleaved-results.json`.

Copied suites were byte-exact before the two documented identity-only changes in
`suite-provenance.json`: owned dispatch path and candidate report identity.
Historical identities in original fixtures/receipts are provenance only. The
behavioral oracles remain unchanged. Generated source-copy mutants are reproducible
from the committed suites and remain private alongside raw operation captures.

Recovery: preserve this directory, the dispatch/admission files and the private
task root `/tmp/toyvm-four-namespace-independent-combined-accept-oct29/`, especially
`ops.py`, `limit_contract.py`, startup receipts and `e/`. `execution-receipts.json`
records exact argv, owned cwd, per-operation admission and raw capture hashes.
Use the original shell with unchanged inherited hard DATA and invoke `ops.py`
directly. Never nest its configurator inside capped children. Reuse these passing
groups while candidate pins remain unchanged. If a changed candidate requires a
new assigned run, inspect supported entrypoints first and begin with the retained
reproducer plus the explicit backend argument. The independent READDIR entrypoint
expects `gate-results.json`, produced by `accept.py` as `results.json` and copied
without changing its contents.

Scope: direct `Backend.handle` only. Caller remains OLD; caller pin integration,
full CLI/confinement qualification and coordinator integration review remain gates.
No FUSE mount, kernel, browser or gameplay claim. No box was assigned or created.
Coordinator owns messageboard publication; publication receipt is supplied
outside Git after remote verification. No production, main or public deployment
change was made.
