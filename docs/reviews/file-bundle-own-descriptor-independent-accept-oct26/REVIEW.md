# ACCEPT exact own-filename parser repair

Candidate: `3f5956fffd23ed03cdd22975b474e348c8b966ca` on
`task/file-bundle-own-descriptor-repair-oct26`.
Independent review branch: `task/file-bundle-own-descriptor-independent-accept-oct26`.

The added own-property check rejects the missing-own-f descriptors before any
inherited filename getter can run. Together with the existing two-own-key count,
own status/size checks and filename type check, a descriptor must have exactly
the own fields `{f,size}` or `{f,status}`. Valid own fields continue to work even
when prototypes contain conflicting values or throwing getters. The existing
duplicate-name reservation, body bounds and exact frame consumption remain intact.

All tests ran against the full exact candidate host.js and lib/file-bundle.js,
verified before and after execution against immutable Git blobs and SHA-256 pins.
No implementation or existing test was modified. The reproducer recovered from
`c5c22bc471b9b1842844b925edc4bbb5152d39fc` is byte identical to that review.

| Test group | Passed | Failed |
| --- | ---: | ---: |
| Unchanged independent reproducer | 9 | 0 |
| Unchanged supplied framing | 8 | 0 |
| Unchanged supplied own-descriptor | 4 | 0 |
| New independent descriptor/framing challenges | 8 | 0 |

The new suite uses real JSON wire frames and an actual writeBundle response.
It checks missing own fields with misleading second keys, inherited throwing
getters with zero observed reads, unused inherited size/status getters, explicit
same-realm prototype restoration in finally, prototype-like extra keys, valid
empty/special/Unicode/comma names, zero sizes, 404/413 descriptors, aliasing of
offset views, duplicate success/error combinations, every truncated view of a
small valid frame despite a complete backing buffer, trailing bytes and uint32
header boundaries. Server fixtures are small temporary files removed in finally.
413 wire descriptors are handcrafted; no large file is allocated to induce 413.

The retained rejected-baseline evidence is reused unchanged: the old reproducer
passed 7/9 and failed both inherited-f cases, framing passed 8/8, and the repair
author's focused suite passed 3/4. Provenance and hashes accompany the original
logs. The coordinator's prior verification of all 12 repair evidence payloads
is reused, not represented as a new full evidence audit. This review's own logs
and atomic per-group checkpoints bind the new exact-candidate executions.
Node emits its spec reporter here, including in retained files named .tap.

This acceptance applies to the ancestor-based candidate only. Remaining gates
are coordinator review, reconciliation with current remote main and the accepted
bounded-reader implementation, then relevant merged-source regression tests and
trusted remote-ref verification. Main was not merged or pushed. No service,
runtime, guest, gameplay, canonical compile, heavy arena or test-box operation
was used; no box was assigned and lifecycle remains coordinator-owned.

Only the new test and this review directory are published. Root worktree/index/
refs and all donors stayed read only, with append-only messageboard updates.
The streamed root-ref digest still matches the launch receipt. The isolated Git
database borrows flat immutable object leaves; no full history was fetched.

Incidents: initial instruction and combined test reads exceeded the 8192-byte
excerpt cap; subsequent reads were bounded. An expected absent destination path
returned an ls error before directory creation. Directly executing the supplied
root-ref digest Python file returned permission denied because it is not executable;
running it with installed python3 succeeded, with an unchanged digest. No access
control was bypassed, no test oracle changed, and no test failed in this review.
