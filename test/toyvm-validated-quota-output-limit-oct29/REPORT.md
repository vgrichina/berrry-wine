# Actual production CLI output-limit observation

Candidate: `5a88ca099b962e946160afd2d4d71a950bf46db3`.
Task branch: `task/toyvm-validated-quota-output-limit-oct29`.

Exactly one invocation of the unchanged production `qualify_accounted.py`
used its argparse entry point and synchronous FUSE adapter on fresh Boat
`bx_s27fnfzu`. The five source files matched `source-pins.json` locally and
again remotely before invocation. No source patch, replacement backend,
guest mount parser, browser, game, fork workload, or retry was used.
The guest mount argv was empty.

The confined workload issued four deterministic 512-byte stdout writes and
exited. Limits were output 1024 bytes, CPU 2 seconds, wall 5 seconds, RSS
134217728 bytes, live 32768, write 65536, file 16384. The external observer
read process identities from `/proc`; the confined workload did not.

Observed output-control PASS: production CLI exit 1, `accepted=false`, child
exit 0, `stopReason="output limit"`. The supervisor detects overflow using
an extra byte, truncates retained output to 1024 bytes, and the caller rejects
the result based on the stop receipt. This is rejection despite successful
child exit, not silent success. Captured bytes are deterministic `X` bytes.

The authoritative final receipt records filesystem live/peak 4096, written
0, open handles 0, no accounting failure, successful unmount (exit 0), server
exit -15, no remaining mounts, and `cleanupComplete=true`. Independent
identity checks found no remaining observed/backend-owned identities. The
8-second outer guard took no safety action. Backend CPU was 0.058519 seconds,
wall 0.04292214 seconds and peak RSS 34340864 bytes.

Raw API response, original CLI stdout/stderr and the final runtime receipt
are retained in `evidence/`. `remote_test.py` is the actual external observer
and reproducible single-invocation fixture. Do not rerun against the same
work directory. The creation receipt lists the transferred source paths;
the original cancellation receipt is pinned in the dispatch.

Limitations: this observes the output gate only. Full resource enforcement,
browser execution and gameplay acceptance remain unknown. Browser allowance
remains CPU 35.353183, wall 101.495550694, captures 1. Initial helper/policy
inspection had a missing `python` alias and a UTF-8 slice decode diagnostic;
Python 3 and replacement decoding resolved those without production execution.
The supplied source directory had no Git metadata; the initial identity check
failed before initialization. An isolated repository was then initialized
using the supplied read-only object stores, without clone/fetch/bulk checkout.
These procedural diagnostics are retained; no full-resource acceptance is
claimed. Per-operation admission and local child supervision records are
retained, but they are not proof of all unobserved resource controls.

Lifecycle: task explicitly delegates preservation and snapshot-stop before
handback. The final lifecycle receipt establishes actual `stopped` state and
`snapshotAvailable=true`, snapshot completed at 04:08:15.851 UTC and stopped
at 04:08:15.885 UTC. The original finite expiry was 04:37:47.428 UTC.
The oversized shared board is delegated to the coordinator via the separate
publication note. No main integration or public deployment is authorized.
