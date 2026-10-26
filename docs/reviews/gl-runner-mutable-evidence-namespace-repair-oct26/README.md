# GL runner mutable output namespace repair

The published runner rejected its own admission output before Node startup.
The byte-pinned unchanged fixture reproduces that failure locally. Historical
qualification `ccc3be6c8a0c6cdb2db327070be81e77eead3760` remains WebGL1 **0/42**,
WebGL2 **0/42**, with no Node startup, compilation or browser invocation.

The repaired entry point creates `ops/output` before constructing the ledger.
Only that subtree and the existing `tmp` are declared transient. The complete
task root still accounts for every allocated block, including output directories,
JSON, logs, atomic `.new` files and child results. Existing 1024MiB task ceiling,
future projection/reserve and required inventory guards are unchanged. Required
`ops/pins.json`, `ops/inputs-manifest.json`, runner, source and fixtures stay
immutable. The supervisor (including detached descendant ownership) and the
framebuffer oracle are unchanged.

All runner saves, log writes, `PALETTE_GPU_EVIDENCE`, result reads and checkpoint
reads now use `ops/output`. Finalization records integrity and accounting outcomes
independently: required-input faults produce a refusing final receipt with unknown
bytes, preserving the primary exception. Successful finalization includes its own
receipt's allocated blocks and checks again after the final replacement. The
bounded stabilization loop fails closed after three attempts.

`test/fixtures/gl-transient-accounting/collect-evidence.py TASK_ROOT` supplies the
matching collection inventory: output filenames, sizes, hashes and cleanup receipt
identities. The operational historical collector under
`/tmp/gl-required-version-published-api-qualification-oct26/ops/collect.py` used
flat `ops` reads, `*-receipt.json` enumeration and `invocation-start.json` checks.
It must remain historical. A future transport adapter must use **ops/output** for
all three operations and verify returned lengths/hashes; required inputs remain
under **ops**. No production checked-in caller outside the retained fixture used
this contract. The new collector and full-entry tests establish the updated
contract without changing historical evidence or touching any Boat.

Local verification runs the complete production entry code, not extracted check
functions: actual initial input hashing, real harmless ELF/version commands,
first ledger samples, admission save, pre-child check, actual supervisor callbacks,
log/receipt writes, result environment handoff/read and final integrity/accounting.
Only task-root/executable constants, a fixed clock, synthetic remote capacity and
the child workload are local fakes. `/usr/bin/true --version` replaces executable
version probes; real supervised Python children replace Node work. No Node,
Chrome, WATX, wasm instantiation, guest or canonical compile is executed. The local
outer supervisor uses actual resource admission and actual physical measurements.
Fake 42+42 observation arrays test result wiring only and are **not runtime evidence**.

Completed groups and exact hashes are in `checkpoint.json` and
`consolidated-receipt.json` beside this document. The baseline fails before a child;
the repaired entry succeeds with evolving outputs. Forty fault cases cover
mutation, deletion, truncation, replacement and mtime changes to required ops
pins/manifest and source/fixture at admission and startup-receipt boundaries.
Two child-exit failures verify cleanup and known final bytes. Existing 27 accounting
tests and nine omission controls remain; six new full-entry omissions reject loss
of transient wiring, save/log/result routing, or accidental whole-ops exclusion.
At every observed normal scan, ledger bytes equal the independent complete-tree
allocated count, including atomic temporary files and final artifacts.

Incidents retained in the compact receipt: initial copied sparse-index entries
did not materialize worktree files; explicit bounded checkout-index fixed that.
Initial accounting tests hit their simulated remote floor using actual local free
space; only the test's default remote disk fixture is now deterministic, while
explicit negative floor tests and real outer admission remain. Two inexact
omission mutation attempts stopped at their assertion after a new variable name
duplicated the old mutation substring; a local variable rename restored the exact
single callback mutation. Early policy/evidence tool excerpts exceeded the requested
8192-byte excerpt bound; subsequent excerpts were bounded. No enforced resource or
platform limit was raised or bypassed, and no actual access denial was retried.

Initial ordinary `write-tree` refused an absent unrelated historical evidence
blob in the minimal repository. The bounded correction uses `write-tree
--missing-ok`, verifies the entire recursive before/after entry mapping changes
only owned paths, and verifies every changed blob against the actual file bytes.
Unrelated blobs retain their exact identities and are already on the remote base;
no unrelated archive is copied or fetched. The resulting exact tree is committed
with `commit-tree -p` against the pinned base and published by normal task push.

Recovery: start from exact main `ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd`, tree
`fc94bfbe7ed6e499bf3d8a55bdb7d88e9dbc4bd2`. Recover only the changed paths from
this task branch, preserving every unrelated tree entry. Retain the unchanged
`remote-run-before.py` SHA256
`3ccde695a00edd757c05d7f1ec3d5d646d4b26baf4e60ea0abdcd3e5da901f4c`.
Run `python3 test/test-gl-runner-output-namespace.py`,
`python3 test/test-gl-runner-output-namespace-omissions.py`,
`python3 test/test-palette-disk-accounting.py` and
`python3 test/test-palette-disk-accounting-omissions.py` using an admitted physical
128MiB whole-tree supervisor and one local pool permit. Reuse unchanged passing
groups. Git uses both permits before the shared lock, physical256MiB and DATA512MiB
only on the Git subprocess; dedicated trusted SSH configuration remains unchanged.

This is one implementation task, with **independent acceptance still required**.
After acceptance, the coordinator owns any integration and separately admitted
exact Node startup plus real unchanged 42+42 framebuffer runtime gate. No main
integration or gameplay claim is made. Alien and Enigma ownership, dirty root,
Claude idle, HeroesII laptop ownership and actual CivII/Maelstrom/SSH/resume/platform
denials are preserved. No workers/refill, public deployment, services, credentials,
keys, trust or permissions changed.

Boat `bx_bwf4vkqh` was not queried, staged, executed, extended or stopped here.
Last supplied state RUNNING; expiry `2026-10-27T00:32:36.350Z`. Coordinator retains
shutdown ownership at `2026-10-27T00:20Z` via existing watcher3321712, unchanged.
