# Independent tiny-fixture kernel acceptance

ACCEPT candidate `89d1a07ab71e22eeb9da6c1cf4e550905714161a` for the
restricted tiny-fixture accounting/confinement boundary. This justifies later
caller integration work; it does not qualify a browser, browser profile, or a
production workload. No candidate implementation was changed.

On 2026-10-28 the exact production `supervise_accounted.py` adapter and its
SHA-pinned supervisor ran first on fresh Boat `bx_wc3aaxdc`, through the
supported Boat exec API. Python was 3.12.3, libfuse/fusermount3 3.14.0,
Landlock ABI 4. The guest initially had no seccomp filter; successful confined
fixtures demonstrate compatibility with the candidate's unchanged default-deny
filter. All nine staged Python files subsequently matched their input hashes.

Eight new independent checks passed, in this order:

1. Production entry with defaults: five written bytes, 12288 live/peak bytes,
   zero open handles, successful child and cleanup.
2. Unsafe accounting backend selection rejected before setup.
3. Existing mountpoint setup failed closed, retaining `FileExistsError` and
   proving no mount remained.
4. Open-unlinked inode retained while another file existed: 24576 peak,
   12288 final live, 8193 cumulative bytes; final descriptor release reclaimed it.
5. Replaced inode retained through duplicated descriptors and a further write:
   24576 peak, 12288 final live, 8193 cumulative bytes; replacement content intact.
6. Write/truncate/shrink/regrow/rewrite: 16384 live/peak, 8194 cumulative bytes.
7. Cumulative quota error caught by the fixture, followed by delete and another
   file: further write rejected and final stop reason remained the quota error.
8. Own-sandbox path write, descriptor reopen, memfd and IPC creation rejected;
   writable file mmap rejected; ordinary accounted write still succeeded.

The fresh outer guard reported exit 0, no resource stop, 67764224 bytes peak
aggregate Python RSS, 0.5871 seconds wall time, and all children gone. Every
adapter result had zero remaining mounts and zero open handles. A separate
post-run inspection found no remaining task mounts or other task processes.
Remote task allocation was 98304 bytes. Fixtures were at most 8194 cumulative
bytes, well below the 1 MiB ceiling.

Unchanged predecessor evidence is reused: 18 new checks, 13 diagnostic checks,
and 147 coordinator-verified payloads. This includes authoritative backend
death, missing status, supervisor identity, inherited writable descriptor,
syscall-denial and Landlock-only rejecting controls. They were not replayed.
The inherited archive is 130236 bytes, SHA-256
`19a4531c600eb939c0c12bfe5035fde714e3a05f171b94fabda3aab800fa50fd`.

Source review agrees with the observed scope: WRITE payload bytes and positive
truncate growth are cumulative; live allocation charges 4096 bytes per inode
plus rounded dense payload; unlinked/replaced storage survives to final handle
release. Backend failure remains authoritative even if caught by guest code.
The failure latch means the run remains rejected after deletion; it is not a
promise that every metadata operation stops immediately. Landlock confines
writes; reads and ordinary anonymous RAM are outside filesystem accounting.
Python RSS is separately guarded, and kernel allocation is not inferred from
filesystem counters or claimed to be a production profile memory bound.
The legacy supervisor combines fixture stdout/stderr; outer API/guard streams
are separately retained. No syscall policy was broadened.

Canonical receipt and distinct diagnostics are under
`scratch/usage-watch/toyvm-kernel-accounting-independent-accept-oct28/`.
The task branch contains only these independent tests and documentation.
The messageboard exceeds the task's file-size cap; coordinator publication is
required, rather than attempting an append that cannot meet that cap.

Boat lifecycle remains coordinator-owned: leave `bx_wc3aaxdc` available (API
state `idle`, no stop requested), execution cutoff 22:50 UTC, handback by
22:51 UTC, coordinator shutdown 22:52 UTC, expiry 22:58:15.483 UTC. No browser,
main push, public deployment, other game work, or worker launch occurred.

Fixture-path correction: the initial independent run used an empty
`/tmp/fixtures` staging base outside the owned task directory. Its temporary
children were removed. The corrected fixture base is inside the task root;
all eight affected checks passed again. Original evidence is retained. The
empty old base is retained with a 4096-byte task charge because prior ownership
was not proven; no mount or process remains there.
