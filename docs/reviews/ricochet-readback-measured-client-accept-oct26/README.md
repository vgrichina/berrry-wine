# Independent Ricochet readback acceptance: REJECT

Candidate `3a332fcc5f50232fa276a350eba3ca63af9c50e9`, branch
`task/ricochet-bounded-capture-readback-repair-oct26`, was verified against its
exact trusted-SSH remote ref and six Git blob identities. The supplied local
files also match all six SHA256 pins. `0c1ecb9f` in the donor publication receipt
is the intermediate implementation commit, not the final candidate.

## Blocking result

The actual `read.readfile()` default executor path imports the exact pinned
`work.py` and helper. Only `work.python_argv` is replaced by an offline local
transport. Its original argv builder is still called and checked for exact
read-only Python command quoting; no Boat command is executed.

The `detached-child` transport forks a child that calls `setsid()`, holds the
inherited pipes and sleeps for three seconds; the direct transport parent exits
7. With a caller monotonic deadline 250 ms away, the adapter returns
`ReadbackError: readback deadline` in 0.250066 s. At return plus 50 ms, child
3230584 is still live with process group and session both 3230584. The helper
has canceled its job, but `_ProcessJob.cancel()` kills only the original process
group, which does not include this child. The test explicitly killed this
fixture-owned survivor. The destination remained unchanged.

This is an actual offline subprocess reproduction of the requested orphan-child
boundary, not evidence that real Boat currently creates detached children. The
same-group pipe-holding control terminates successfully. A repair must either
supervise every owned descendant across session changes, or establish an
explicitly accepted narrower transport contract; this worker changes neither
production source nor that contract. Source publication to main is stopped.

`checkpoint.json` and `process-confirmed.output` contain the result; `accept.py`
and `local_transport.py` are the unchanged final reproducer. The harness exits
zero after *recording* `rejectedCandidate: true`; that is a completed review,
not a passing candidate. `sourcePublicationAllowed` is false.

## Completed checks and reuse

The first behavioral group used the real adapter/default executor/helper and
the byte-exact 401056-byte PNG, SHA256
`9e6b81e080cfa6476fdd76ef4093217b43567e37f9d9f7fcd69cc021d1541d88`.
It completed 90 chunk requests plus two metadata requests, max four active,
with the caller's remaining monotonic deadline passed unchanged. A symlink
destination was replaced atomically; its target contents remained unchanged.

Independent adversarial groups rejected truncated envelopes, a consistently
wrong metadata digest, inconsistent stat size, denial without retry/fallback,
actual growing and replaced sources, preserving existing destinations. Actual
subprocess responses completed out of offset order and still reconstructed the
identical PNG with max four active jobs. The same-group pipe/deadline control
returned in 0.250197 s and had no live child after 50 ms. No guest commands,
capture, input, browser, Wasm compilation, Boat API, service, or box operation
was performed. No remote performance or gameplay claim is made.

Reuse the unchanged donor's eight passing groups and parent's serial/cmd
validator evidence. No game/guest or unchanged parent group was rerun.
Additional acceptance and affected merged-tree checks stop at the rejection;
main integration/publication and gameplay remain unperformed.

## Reproduction and limits

Use the exact six files in `input-pins.json` from the pinned candidate. Recover
only these local files into
`/tmp/ricochet-readback-measured-client-accept-oct26/repo`, and place these scripts
and the pin manifest in its sibling `ops` directory. Keep the fixture unchanged.
The controller fixture loads the helper relative to its real production path.
The original candidate source is not included in this standalone evidence branch.

Under fresh task admission, run each group through the required execution pool:

```
python3 /home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py --slots 1 -- python3 /tmp/ricochet-readback-measured-client-accept-oct26/ops/manage.py test boundary python3 /tmp/ricochet-readback-measured-client-accept-oct26/ops/accept.py boundary
```

Substitute `integrity`, then `process` for both occurrences of the group label.
Reuse existing exact-pin completed groups rather than repeating them. The
process group loads the checkpoint from earlier groups. No external transport
is invoked. The harness kills only its own fixture child after preserving the
failed cleanup observation.

Tests used Python, not Node. The configured test physical limit was128MiB,
CPU90 seconds, wall120 seconds, file24MiB, captured output2MiB, excerpt8192 bytes.
Recorded supervisor-plus-descendant peaks were92483584,99909632,61513728 bytes
for boundary/integrity/confirmed-process respectively. The initial sampler did
not include the pool ancestor, so these are **not complete launcher-inclusive
aggregate measurements** and do not establish full resource acceptance. The
corrected subsequent Git sampler includes that ancestor. Git uses both pool
permits before the exclusive Git mutex,256MiB physical aggregate, and512MiB
RLIMIT_DATA applied only to each Git subprocess. No Node/V8 or parent DATA cap
was applied. Exact commands and inherited limits are in receipts.

Own allocation96MiB includes selective files, isolated Git, evidence, session,
launcher events, positive WAL growth once, publication, future24MiB and reserve
8MiB. Standing readonly donor/tool bytes are excluded. Fresh admission applies
host768MiB+CivII768MiB+shared child pool256MiB+64MiB per resident client future
growth once; resident RSS is not charged twice. All four clients are launched,
so there is no prospective320MiB client charge. No individual RSS cap is inferred.
The disk gate retains2982150144 bytes after all conservative remaining task
growth. See final accounting for actual measured closeout.

The first immediate post-SIGKILL sample falsely classified a same-group child
before asynchronous signal delivery. That result/script is preserved. Only
the corrected50ms observer distinguishes the accepted same-group control from
the persistent detached child. Initial local excerpts exceeded8192 bytes;
incidents are retained, with no runtime capture gate changed. A subsequent
sampler-edit indentation error stopped before Git execution, was corrected,
and is retained in incidents. Prior erroneous individual128MiB admission stops,
real RAM/access denials, donor incidents and historical game evidence remain
qualified and unchanged.

No box is assigned or queried. The old Ricochet box is ROOT-reported STOPPED;
its historical ID is`bx_ex22dvm8`, original expiry2026-10-26T22:31:02.949Z.
Lifecycle ownership remains with the coordinator. Main was not read, merged or
pushed because acceptance rejected first. This is a standalone minimal evidence
branch, not an adoption of the candidate source tree.
