# Independent GL output namespace acceptance: REJECT

Candidate `c9f8f28cf8d5760db9330bbf86a8923a78df569b`, tree
`5119206356e0da0a6ae57fc62e5a6981195f7ee9`, parent/main at assignment
`ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd` is rejected. No main integration
or affected merged-tree execution is authorized after this rejection.

The first behavioral challenge runs the exact pinned production runner
`test/fixtures/gl-transient-accounting/remote-run.py`, SHA256
`a520830a87b04086cd1994b9513e43314df91942b18295c4d8227bde69eba6ab`,
through the existing `test/test-gl-runner-output-namespace.py` parameterization.
It executes the complete entry: immutable inventory, admission save, next
pre-child checks, supervised startup and child, logs/receipts/result environment,
collector and final accounting. It does not extract runner functions or replace
its accounting, save, execute, finalization, or collector implementations.

After admission is saved, the unchanged reproducer creates
`ops/output/node-startup.log` as a symlink to an initially empty, task-owned file
outside the synthetic runner root. The next checks allow it. The production
`(E/(name+'.log')).write_bytes(out)` follows the link; the collector's `is_file`,
`stat`, and `read_bytes` also follow it. The target acquires 4096 allocated bytes.
The collector reports its 2358 content bytes and correct SHA256 while the runner
reports `accountingComplete: true`, `completeBytes: 139264`. Every observed scan
equals the independent allocated-block count **inside** the runner root; the
escaped target is absent from those totals and projections. This is a concrete
output-accounting and collection defect, not an assertion that target bytes were
lost from the outer task allocation. The outer controller accounts for both.

The accounting helper deliberately charges symlink blocks without following
targets. It pins the mutable subtree root identity, but not the identities/types
of evolving descendants. Changing that longstanding helper behavior is not a
repair in this task. The narrow repair scope is the runner's mutable output
file I/O and collector's output traversal/type contract. A future fix must fail
closed on substitution/escape without excluding output bytes or weakening the
required ops/source/fixture guards; race-aware protection also needs review.

`test/test-gl-output-namespace-independent.py` is the unchanged failing repro.
Its final assertion rejects the candidate after recording the successful escape.
`test/test-gl-output-namespace-controls.py` independently verifies a normal full
entry's collector names, content lengths, SHA256, receipt count, ownership and
cleanup, counted atomic temporaries and final receipt bytes. A new exact single
production mutation renames the `invocation-start.json` save; both children and
accounting still complete, but the new collection assertion rejects it. This
proves the collection challenge checks actual production filename routing.

The existing parameterization still substitutes task/executable constants,
remote capacity and a fixed clock. Its Python fake workload is bridged to the
installed `/usr/local/bin/node` resolving to Node v24.18.1, with
`--max-old-space-size=512`, through the real unchanged supervisor. Startup first
records executable, version, flags, environment and inherited limits; DATA/AS
are unlimited, CPU 90 seconds and FSIZE 24 MiB. The following lightweight Node
child writes a controlled result with **zero** observation entries. Neither
Puppeteer nor Chrome loads, and the production remote v24.22.1 executable/probe
is not qualified. The exact real remote startup and actual 42+42 framebuffer
test remain separately admitted prerequisites. Historical GL remains **0/42 +
0/42**; this review establishes no gameplay or browser qualification.

All seven candidate source pins and retained receipt hashes passed verification.
The old unchanged `remote-run-before.py` SHA256
`3ccde695a00edd757c05d7f1ec3d5d646d4b26baf4e60ea0abdcd3e5da901f4c`
and its existing own-admission failure receipt were reused, not rerun. Retained
40 fault, two child-failure, 27 accounting, nine existing omission and six new
omission groups remain implementation evidence, with their original fake-child
qualification. The harmless final-entry-clock variable rename is qualified in
the donor checkpoint; final-child-outcomes/output-omissions bind final hashes.
Broader new faults, permission/unknown/finalization/primary-exception challenges
and merged-tree checks stopped at the first concrete rejection. Their exhaustive
independent acceptance is not claimed.

The donor's intermediate package-final execution receipt was overwritten by its
corrected same-name run. Its original diagnostic survives; the evidence is not
lossless original execution history. No packaging/test rerun was done solely
for that incident. This task retained two setup incidents: a controller was
initially routed to the Git-command wrapper, and clearing skip-worktree for new
candidate files absent in the base index failed. Corrected bounded preparation
then passed; neither incident changed production source, limits or trust.

Recovery commands, run under the task's admitted pool/supervisor:

```
python3 test/test-gl-output-namespace-independent.py  # expected rejection
python3 test/test-gl-output-namespace-controls.py     # expected pass
```

Source is unchanged on the independent rejection branch, whose parent is the
exact candidate. The commit adds only these two focused tests and this review's
evidence. The tested source tree is the candidate tree; the committed tree adds
review tests/evidence only, verified by recursive tree mapping. No merged main
tree exists for this rejected candidate. Dedicated trusted SSH, normal task
push and exact remote ref verification are required for the evidence backup.

Enigma native and Alien source ownership, dirty root, Claude idle, HeroesII
laptop and actual CivII/Maelstrom/platform/SSH/resume denials are unchanged. No
Boat query, staging, guest, browser, Wasm, canonical compile, service, deployment,
credential or trust change occurred. No workers were launched. No box is assigned
to this task. Supplied GL `bx_bwf4vkqh` and Enigma `bx_xw8d895f` remain coordinator
owned; no state/expiry refresh was queried. Supplied shutdown is 2026-10-27
00:20Z; this task does not stop, resume or otherwise change their lifecycle.
