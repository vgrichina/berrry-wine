# Redline: distinct offline/native provision evidence

**Provision collision repaired; original side-door gameplay not attempted.**
The single native fixture failed before endpoint publication or input:
`DevToolsActivePort` remained absent through the unchanged 100 × 100 ms poll.
The first browser failure was recorded at **17:22:06.206Z**, after 10,043 ms.
There are no new gameplay or fixture screenshots to review.

The old generated provision collision is reproduced: native completes its
remote barrier, then the shared exclusive receipt fails with EEXIST. Seal/plan
uploads are not reached; the offline artifact survives unchanged.

`tools/redline-provision-evidence.py` prefixes command and receipt labels with
`offline-provision-` or `native-provision-`. Runtime paths, generated command
bytes, provider pins, transfer order, exclusive writers and exceptions retain
their existing behavior. The adapter restores callbacks after success/failure
and refuses unknown phases. The causal bounded-custody repair is reused without
CPU changes, deadline changes or repinning.

Evidence: `scratch/runs/20261109-redline-distinct-run-side-door-1702/`.
`collision-control.log` reproduces the actual old offline-then-native failure.
`provision-order-final/result.json` records the corrected actual provision
sequence using byte-checked upload and memory-backed media transport seams,
with the real generated assembler and startup barrier. Both barrier artifacts
are retained; duplicate writes still fail. A transport failure prevents
seal/plan uploads. Callback restoration and invalid phases also pass.

`offline-launch/result.json` validates the actual generated remote parent,
staged production controller and owning caller at the original 120-second
bound. DRIVER_PREFLIGHT exits before server/Chrome; missing ACK is expected.
All seven tasks were reaped, with a distinct parent wait and separate EOF;
their identities were independently checked absent. The original composition
also passed preflight without starting Chrome/gameplay.

Focused checks and `flock /tmp/wine-build.lock bash tools/build.sh` passed.
Primary/compatibility CPU hashes remain `3e491c08…` / `ecb45716…`.
An initial test-directory import error is retained, before generation/allocation.
Recovery uses Git plus small source/input patches and media/module references.

Both Q3-raw1648 (`6d90a3ea1`) and Pawn1655 (`64f689fb1`) final published releases
preceded allocation. Independent rereads verified their unique evidence,
actual reaps, parent waits, physical drain, normal archived stops and immutable
watchdog joins. `independent-peers-verified.json` binds the ordered releases.

Native provision completed, including seal/plan uploads; its distinct barrier
receipt agrees with the preserved offline receipt. Every command/receipt
destination was checked before the fixture.
The actual generated caller validated **904 providers / 149,109,334 bytes in
127.517 ms**; browser-side provider validation and all four HTTP pins passed.
The closure repair therefore survived native composition. Chrome then failed
its existing pre-endpoint gate, before CDP connection, readiness or comma input.

`final-exact-state.json` records the first failure and secondary cleanup limits.
All **129 owned tasks were actually reaped**, with no remaining/unreaped task;
the generated parent actually waited and retained separate stdout/stderr EOF.
Custody remains **incomplete**: Chrome thread 6680 has unresolved autoattach
lineage. Its first registration at 17:22:16.131Z is **after** the first browser
failure, so it does not establish the startup cause. Browser termination was
SIGKILL; its owning receipt reports `streamEOF=false`. The fixture watchdog
joined code 1, separately from this task's successful box watchdog. Empty
streams remain invalid evidence; browser EOF and native Chrome cause remain
UNKNOWN. Physical recovery found no owned survivor, profile process or FD
holder; the known server port 46447 was closed and the profile was removed.

One fresh box **bx_scycq86g**, UUID
**d8135138-f3c4-4fbf-adc4-e99d8f79aef1**, followed an independently observed,
prearmed immutable 25-minute watchdog. Initial expiry was
**2026-11-09T17:45:55.700Z**. After **64 unique artifacts** were retrieved and
independently SHA/size/gzip-CRC checked, delegated normal unforced stop
**stop_29af41076b1c8e22** completed **17:23:02.998Z**. Final exact API state is
**ARCHIVED**, `archiveAfter=null`, `expiresAt=NOT_RETURNED`. The box watchdog
actually joined zero with separate EOF and unchanged configuration hash.

Code is published on main at **921583acd**. No later input/capture, original,
retry, deadline extension, local Chrome, worker, deployment, resume or delete
followed the terminal failure. Free `/home` remained above 1.5 GB.
Next: diagnose Chrome's pre-publication startup using the preserved native
custody/startup timestamps; retain the existing bounds. Closure validation and
evidence relabeling are no longer the blocking gates. Final published RELEASE STOP.
