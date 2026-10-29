# RENAME parent validation counterexample

Candidate: `5cf7cfc01864d6a2b94a9a3b1fe6e1533f214bca`.
Pinned backend: 12321 bytes, SHA-256
`d129d1a4d42d9dd4077941927fa57220a32580667a1fef226de11dec2a411171`.
All five production identities come exclusively from the dispatch and match
before and after execution; see `source-pins.json` and `results.json`.

The first valid cross-directory file move through real `Backend.handle(12, ...)`
passed. In a separate fresh Backend, the first invalid-parent case returned
success (`b''`, no errno), instead of the internal consistency expectation
`ENOTDIR` (20). It removed `file` from directory inode 2 and added `moved` to
regular-file inode 4's `names`, pointing to source file inode 3. The regular-file
parent was initially empty; every fixture was created through CREATE/MKDIR
under a legitimate directory. No malformed topology was installed during setup.

The rejection snapshot therefore failed preservation. Only `nodes` changed:
two namespace maps changed; inode identities, data, modes/types, links and open
counts were otherwise preserved. `next`, `live`, `peak`, `written`, `handles`,
`failure`, limits and root were unchanged. Snapshots deepcopy every Backend
instance variable except `operations`, exactly as the accepted CREATE/MKDIR
reference does. The operation counter increased by one and is reported separately.
The exact historical reference hash is provenance, not a production pin.

RENAME/op12 is `<Q newdir>` followed by `old\0new\0`. RENAME2/op45 adds
`<II flags, padding>` before the names. Both binary layouts were inspected and
constructed with zero flags/padding; only op12 was invoked before the stop.
The rejected expectation is an internal direct-callback consistency contract;
these requests can exceed kernel-reachable cases. There was no FUSE mount,
kernel, Boat, browser or gameplay validation.

Behavioral testing stopped at this first counterexample. RENAME2 execution,
root-source and source-directory variants, source regular/missing parents,
destination missing parents and conditional source-copy guard controls were
not executed. The four previously accepted groups and six-guard candidate
acceptance were not rerun. This diagnostic makes no candidate acceptance claim.

To reproduce from this task tree (once, on the unchanged pinned candidate):

```sh
python3 -B test/toyvm-rename-parent-validation-contract-oct29/reproduce.py
```

Exit 1 is the observed production counterexample, not a passing suite. The
original execution used the dispatch-pinned task supervisor and supplied startup
receipt: inherited parent DATA hard limit infinity, parent soft DATA 128 MiB,
Python child DATA 128 MiB, Git child DATA 256 MiB; unchanged physical memory,
disk, CPU, wall, file and capture controls. `execution-receipt.json` retains
the fresh admission and observed exit. Private raw output remains under
`/tmp/toyvm-rename-parent-validation-contract-oct29/e/`.

Remaining gate: coordinator-assigned parent validation repair, then independent
validation of the changed candidate and remaining cases. Production, caller pins,
main and deployment were untouched. No test box was assigned.
