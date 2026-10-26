# Ricochet detached transport cleanup repair

Repairs candidate `3a332fcc5f50232fa276a350eba3ca63af9c50e9` on a task branch
only. Original independent rejection `1ae56c108a93baf9e058f90bb65e15b2245838cf`
and its exact failure observation are preserved in `original-rejection/`.
Main integration and fresh independent acceptance remain outstanding.

Each real subprocess request now has its own Linux subreaper process. It adopts
orphaned descendants across setsid/double-fork, signals only its direct children
through identity-bound pidfds, and repeats adoption/kill/reap until no child
remains. A private EOF control pipe requests cancellation and also detects caller
exit. The owner cleans up on direct transport exit as well as cancellation;
transport failures remain failures. No global subreaper state or arbitrary
process-group/PID census is applied to the importing controller. Unsupported
ownership primitives fail closed. The owner runs the helper's exact embedded
program with `sys.executable -S -c`; no source surrogate or separate runner is
assembled. Read-only request generation, envelope checks, bounded pipes, at most
four active requests, immutable file checks and atomic destination publication
are unchanged. No accepted detached-child contract was narrowed.

## Verification

The exact unchanged `accept.py` and `local_transport.py` from the rejection were
run first against the real read.readfile -> work.read_executor -> helper path.
Only the final local argv seam substitutes an offline subprocess; original
read-only Boat argv/quoting is checked as data and never executed. Both same-group
and detached children are now absent at return plus50ms, with destinations
unchanged. Because direct exit7 now triggers immediate cleanup, these cases fail
closed before250ms rather than waiting for held pipes until the deadline.
`process-final.output` records0.07775s/0.08062s. Its helper differs from the final
source only in a comment; `focused-closeout-results.json` binds final helper hash.

Existing focused subprocess/deadline test04 and denial/no-retry test08 pass.
New test09 covers setsid, double-fork, immediate parent exit, a live parent at the
250ms deadline, successful responses leaving detached children, and an unrelated
sibling that must stay alive. Final live-parent deadline returned0.25742s;
all recorded descendants were reaped, not merely zombies. Two independent
omission challenges reject when either subreaper adoption or descendant signalling
is removed. These are expected rejecting mutations, with exact altered hashes;
the repaired helper is restored after each challenge.

The standalone four-request regression uses the same production adapter/default
executor and actual generated metadata, starts exactly four pending chunk calls,
and verifies deadline, no queued tail, unchanged destination, private-temp removal
and absence of all four transport identities. It returned0.52972s for a500ms
deadline. The lightweight stdlib-only fixture uses explicit `-S`; its exact argv
and final test manifest are retained. It avoids unrelated unittest suite imports
while preserving all assertions and the same concurrency. Prior unchanged byte
integrity/envelope groups and donor eight groups are reused; their disclosed
missing pool-ancestor measurements are NOT retroactively resource accepted.

## Resources and incidents

All tests acquired one128MiB execution-pool permit; all Git acquired both permits
before `/tmp/wine-ops-production-git.lock`. The task supervisor measures its own
RSS plus every launcher ancestor up to (excluding) the already-resident Codex
client and all tracked descendant identities, including detached descendants.
Pool and invoking shell are included. It enforces physical128MiB tests/256MiB Git,
CPU90s, wall120s, file24MiB, output2MiB, excerpt8192. Git alone receives
RLIMIT_DATA512MiB in its subprocess, never the parent, client or Python tests.
No Node was executed and no Node startup receipt is asserted.

The four-request successful complete physical peak is132120576B<134217728B.
Other focused and omission groups have their actual limits/peaks/commands in
receipts. The unittest-based four-request command exceeded the physical limit;
all three enforced stops and the first negative-harness resource stop are retained.
The resolved standalone harness removes unused imports/process overhead, with
no cap increase or unchanged denied retry. Admission initially double-counted
already-materialized peer bytes as future growth; the original failed receipts
and corrected measured projection are retained. Initial readonly excerpt overruns
and all parent incidents remain qualified. See `incidents.json`.

Allocation96MiB includes selective source, isolated .git, outputs, publication,
launcher events/session, positive WAL growth once, future24MiB and reserve8MiB.
Readonly standing donor inputs/tools are excluded; no links hide bytes. Admission
uses host768MiB + shared child pool256MiB +64MiB future growth per resident client
once; resident RSS is already deducted from MemAvailable and no individual client
cap is inferred. Prospective320MiB is an estimate only for any unlaunched client.
Prepublication full projection45850624B<=100663296B and projected host free
2985742336B>=2982150144B passed. Later closeout is in ops/publication receipts.

The isolated Git parent is the exact candidate, fetched readonly locally with
no broad checkout. Existing parent evidence is retained in the index with
skip-worktree; missing runner blobs are not requested. Only supplied verified
local source/fixture files are materialized. Seven final source/fixture hashes
are in `input-pins.json`. No game semantics, guest/browser/Wasm compile, Boat,
SSH runtime, service/restart, deployment, workers or refill occurred.

## Reproduction and handoff

Use the supplied immutable fixture closure and repaired source from this branch.
For the unchanged rejecting reproducer, put accept.py/local_transport.py plus
input-pins.json and the original checkpoint under TASK/ops, with source under
TASK/repo; the script derives paths and remains byte-identical to the rejection.
It exits zero after recording observations, so require both rejectedCandidate
fields to be false rather than interpreting exit status alone.

Under fresh full admission, run focused commands through the shared pool:

```
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- python3 -S TASK/ops/manage.py test focused python3 -S TASK/repo/test/test-boat-capture-readback.py ReadbackTests.test_04_owned_blocking_subprocess_is_killed ReadbackTests.test_08_real_transport_failures_no_retry ReadbackTests.test_09_detached_transport_ownership
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- python3 -S TASK/ops/manage.py test four python3 -S TASK/repo/test/test-boat-capture-readback-four.py
```

The resource wrapper has this task's paths/admission ownership; a fresh reviewer
must supply its own admitted wrapper rather than reusing stale fleet accounting.
No box is assigned or operated. Historical Ricochet box bx_ex22dvm8 is only
ROOT-reported STOPPED (unqueried), original expiry2026-10-26T22:31:02.949Z.
Coordinator lifecycle ownership is unchanged. No live fixture descendants remain
at handoff; final identity scan is retained in ops/cleanup.json.
