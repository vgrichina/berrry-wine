# Enigma historical runner repairs: independent rejection, 2026-10-24

Do not integrate the combined candidates. The terminal adapter stops the actual
runner correctly, but its transformed supervisor does not propagate failure to
its caller. Its actual complete finalization writes a terminal receipt containing
`reason=capture-byte-limit` and child `returncode=1`, then reaches end of file
and exits **0**. A shell `supervisor && dependent` executes the dependent command.
Expected: failing supervisor exit and no dependent execution. This historical
exit behavior predates the adapter; it remains an end-to-end gap in the proposed
terminal-rejection path, rather than a newly introduced runner regression.

No repair or main integration was performed. FindFirst's offline behavior passed;
this verdict rejects the requested combined integration, not that matcher.
No guest, WASM/native instantiation, build, browser, acquisition, public deployment,
worker launch, box operation or runtime acceptance occurred. Box ID/state/expiry:
none assigned. Legacy box labels in the fixture receipt are historical source
literals, not observations. Lifecycle remains coordinator-owned.

## Exact bindings and review

Base donor/main at assignment: `f879fd0cd81d918ea54a18b1b222fae25dd6d618`.
Terminal candidate: `ca285950d409fe8a18c65831a2d619e01c6667b0`.
FindFirst candidate: `455f3ba3e30a3eedef9a3ce984c1fb0321f9541a`.
All 38 focused source/report/evidence blobs were compared byte for byte against
their named Git revisions before testing. Historical snapshots and transitive
VFS sources were independently compared with immutable Git revision
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`. The runner is 685960 bytes,
SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Historical VFS hash is `4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e`;
adapted actual VFS equals accepted main
`542ecac68e15882d9f5455e89c2c92198d3e3042b53b599b29706a6668fcb3b1`.
Original supervisor SHA256 is
`73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73`.
Adjacent `identities.json` binds exact candidate files and producer seals.

Both focused suites executed successfully in this relocated review tree, under
fresh MemAvailable admission, Node heap256MiB and CPU/wall60 seconds:

```sh
timeout 60 bash -c 'ulimit -t 60; exec node --max-old-space-size=256 test/test-enigma-findfirst-compat.js'
timeout 60 bash -c 'ulimit -t 60; exec node --max-old-space-size=256 test/test-enigma-terminal-capture-guard.js'
```

Their actual outputs are adjacent. These include original-source rejection,
wrong source/anchors/order/stale receipts, malformed/oversized/reclassified
supervisor receipts, seven capture mutations, VFS end-anchor mutation,
disabled behavior and unrelated-error preservation. The capture suite checks
the actual final main error handler retains the denial and sets child exit1.

Independent `composition-review.js.gz` additionally exercised **real Node module
compiler hooks**. The base compiler captured the full runner instead of executing
it, while actually compiling and loading the transformed historical VFS and
original capture module. Only the renderer/guest interfaces in runner fragments
were mocked; the codec was the hash-verified standing real pngjs dependency.
The capture module's original pngjs require was routed to that exact dependency.

Both FindFirst, terminal, quietFS and terminal, FindFirst, quietFS work, followed
by the original capture preload. All four other permutations reject before
runner entry. The compiled runner equals terminal(quiet(original)); the compiled
VFS equals accepted main. Relocated `__filename` references execute correctly.
The unchanged real VFS literal/wildcard/path/metadata oracle passes. Real PNG
success preserves pixels; first encoded-byte rejection preserves original error
identity, publishes the durable raw receipt with inode/directory fsync, produces
no successful PNG/log and makes zero subsequent main.run calls. Reverting both
injected catch rethrows makes two main.run calls and historical FAILED logs,
which the independent no-next-run oracle rejects. Original signature, dimensions
and frame guards execute unchanged; source equality also preserves pixel and
cumulative guards. Results and transformed source hashes are in
`composition-result.json`.

The independent fixture development history is retained under task `ops/`:
an initially omitted capture-install environment, an observer read included in
the receipt I/O trace, and stale fragment indices after mutation were corrected
in the review harness. Candidate/oracle source and guards were not weakened.

## Minimal unchanged rejecting reproducer

Run from the published review tree:

```sh
timeout 60 bash -c 'ulimit -t 60; exec python3 test/test-enigma-supervisor-denial-independent.py'
```

Expected result for this rejected candidate: **exit1**, with JSON showing actual
supervisor `exit:0`, `dependentRan:true`, receipt child returncode1 and the precise
terminal rejection. The test restores byte-exact candidate adapter and original
supervisor from the adjacent sealed gzip snapshots, calls its real supervisor
transform, and executes its actual helper, polling loop and complete finalization
through end of file in a child Python interpreter. Child process/clock interfaces
are mocked; receipt publication is real. It invokes no historical launch,
watchdog kill, native setup, guest or box operation. The shell AND-list tests the
actual interpreter exit, without swallowing it. A test-only appended failing
exit control returns1 and prevents the dependent command. It is not a candidate
repair. `supervisor-result.json` retains expected/actual and the control.

The runner-level guarantee therefore passes, while caller-level supervisor
failure propagation fails. A caller that inspects every receipt can identify the
failure, but exit status alone currently permits dependent execution. No source
fix was attempted under this review assignment.

## Publication, resources and remaining prerequisite

Only this review, its minimal reproducer and review evidence are committed to
`task/enigma-runner-repairs-independent-integrate-oct24`. Candidate production
files were removed from the review checkout before staging. No shared lock or
main mutation is needed for rejection. Exact commit and verified remote SHA,
final diff, command/test history, accounting and cleanup are retained in
`/tmp/enigma-runner-repairs-independent-integrate-oct24/ops/` and the append-only
root board. `ops/result.json` is written last.

Initial projected allocation was43240109/67108864 bytes; the review checkpoint
was28432710 bytes including full external session/events, positive SQLite/history
growth, future allowances and8MiB reserve, with projected host free3625160704
bytes. Per-file24MiB, Node heap256MiB, MemAvailable805306368 minimum and CPU/wall60
limits apply. Read-only donors/tools are standing inputs. Prior trial receipts
remain; no history was reset. Final accounting supersedes the checkpoint.

Next use is the offline rejecting command above. Before a combined guest attempt,
the coordinator must assign a bounded supervisor failure-propagation repair and
independent acceptance, restore the complete exact historical runtime closure,
provide fresh resource/runtime allocation and lifecycle, and validate actual
filename-bearing mount argv with the canonical parser. This offline task has no
mount argv. Old supervisor cutoff/box labels are expired; do not execute its old
guest recipe. PNG startup/menu/gameplay remain unaccepted.
