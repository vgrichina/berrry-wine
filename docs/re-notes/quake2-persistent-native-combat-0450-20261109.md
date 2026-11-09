# Quake II persistent caller engagement attempt, 0450

**Guard/door objective not achieved.** One fresh original reached its main menu
using the persistent caller. Its first passive binding sample cannot decode any
of the three actual binding strings. This unexpected UNKNOWN was terminal:
there was no gameplay input, later capture, second original or retry. The WIP
and first-failure evidence are preserved.

Evidence: `scratch/runs/20261109-quake2-persistent-native-combat-0450/` (R).
Read the 0435 caller, 0425 failure, 0415 observer and 0350/0325 gameplay notes.
Personally inspected the retained armor100HP/25armor, outdoor46HP and death
PNGs; paths, SHA-256 and sizes are in `prior-reviewed.json`. They are prior
evidence and establish no new gameplay for this attempt.

The 722-provider closure uses published caller/composition
`1473c5952a52d5d2b4546b93a0d462b64fe5c6cd`, the exact passive reader from
`c58857772`, and custody directly from published
`4341b87723a7d56bc98223215cca4cdc878fcae2`. CPU SHA-256 remains
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`
(2,185,596 bytes). Both all-caps observation flags, pre-CPU/pre-DllMain
zero-entry barriers, and work/ACK/close/hold/freshness limits are unchanged.

Fresh actual composed-driver preflight passed without Chrome or an original.
Fifteen prior focused/build log paths were rechecked by exact stored size and
SHA before reuse. The prepared run-specific controller starts concurrent stdout
and stderr drains, awaits OWNED_INPUT_READY, flushes the explicit start on one
retained PIPE, then retains that same writer for commands. Its launch-started
record proves transport spawn only.

The fresh offline lifecycle regression uses this actual prepared controller
and task's launch/request branches with the production caller. The explicit
Boat adapter runs real local interpreters and children instead of a remote
browser. Open-pipe setup plus a numbered command/ACK passes; EOF during a
pending command is sticky terminal and produces no ACK or later command.
Both cases retain actual waits and distinct stdout/stderr EOFs, including the
adapted remote parent and interpreter. No box, network or game is used by these
fixtures. Closing the writer is terminal; it is never reopened.

Source recovery is the exact Git base plus `closure-recovery.patch.gz`
(84,797 uncompressed bytes), covering relevant uncommitted hunks and the small
untracked providers. Media/modules are referenced by existing path, size and
SHA in the manifest. No source/media/module archive is made. Native source
lifetime remains REVOKED, all-writers and edict ABA UNKNOWN, and historical
shutdown causes UNKNOWN. No production code change, peer edit, agent/worker,
local browser, rebinding, guest write or deployment was used.

## Concrete first failure

The caller passed OWNED_INPUT_READY and the flushed explicit start, and retained
the same writer through readiness and its sole no-input cleanup command.
`original-controller/transport-started.json` proves transport spawn only.
The actual remote strict startup receipts separately establish both all-caps
flags and zero execution entries before release of the parked DLL load, with
trace `[1,0x400000,0x500000]`. The startup capture's Worker and renderer modules
both match CPUa320. The startup PNG was personally inspected: main menu, no
guard, operated door or gameplay progress.

`review/startup-binding.json` retains the exact point sample. The overall reader
status is SNAPSHOT and its five-word attack reads are equal, all zero. But the
individual live binding results for engine keys13/133/200 are all explicitly
`UNKNOWN sparse/outside direct window`, text=null:

| Engine key | Actual string pointer | Live binding |
| --- | --- | --- |
| 13 (Enter) | `0x08ff1a10` | UNKNOWN |
| 133 (Control) | `0x08ff1f30` | UNKNOWN |
| 200 (Mouse1) | `0x08ff1630` | UNKNOWN |

The concrete cause is the reader's supported-address boundary:
`tools/quake2-passive-attack.cjs` requires `va+n <= 0x04000000` in `direct()`;
`binding()` immediately returns UNKNOWN for these pointers instead of reading
or translating them. Thus the published reader cannot establish this run's
actual bindings. Config defaults Enter=`+attack`, Control=`+movedown` do not
resolve the live result, and no rebinding or guest write was attempted. Physical
keys are all released in this sample. Neither the zero latch nor the menu PNG
proves attack consumption or weapon effect. This is a specific reader coverage
blocker; no attack delivery or game simulation defect is inferred.

The sample was captured at 04:55:05Z and its unknown binding results were
personally inspected before the local terminal record at 04:55:46Z. The only
numbered command is `cleanup-only`, action=quit, on the same retained writer.
No hold, keyDown, later PNG or capture command followed the UNKNOWN. The existing
automatic native keyboard preflight predates original launch and is not gameplay.
The retained startup PNG SHA-256 is
`fbe0e49ee0e81ea3ef9c5bcbe3d938c0e7092b35a5b0b08b1aced89b69fadf5c`.

## Cleanup, evidence and release

The no-input quit failed at 04:56:06.596Z: Browser.close ACK, TERM and KILL,
terminal=null, drained=false, elapsed19,867ms under the nested19,862ms cap,
normal=false. There is no successful numbered quit ACK. The local caller actually
waited1 with separate stdout/stderr EOFs; its launch transport waited-9 and its
request transport waited1, also with distinct EOFs. Sticky remote revocation
was delivered and the existing supervisor drained its owned descendants. These
cleanup failures remain failures; historical shutdown causes remain UNKNOWN.

Kernel evidence has 188 owned identities and 188 actual terminal reaps, verified
against 1,818 journal events and their before-reap witnesses. Drain is complete,
command EOF true, and remaining/unreaped/unresolved sets empty. Actual remote
supervisor wait1 and each pipe EOF are retained separately from kernel waits;
its receipt still says remoteCustody UNKNOWN. The census records ports36375/
43765 closed, all tracked runtime identities absent, no profile FD writers,
input writer absent and runtime lock free. Untraced/nonleader/all-writers and
edict-ABA coverage are not upgraded. Local lifecycle/watchdog actually waited0
with separate EOFs; the local runtime lock was verified free. The board watcher
actually waited-15 with separate stdout/stderr EOFs and complete gzip logs.

Both exact prerequisite releases were observed in order: Super0445 at04:49:04Z,
then Warcraft0445 at04:52:44Z. Only then was this box created. Its immutable
UUID is `11a3284d-63fb-42d3-9faa-219a6cad9c36`; the independent observable
25-minute watchdog was prearmed before finite-TTL1496 creation. Box
**bx_nteu4dds** had initial expiry **2026-11-09T05:18:06.327Z**. All47 remote
regular artifact rows/640,531 row bytes were retrieved, deduplicated (39 newly
stored contents), and verified by stored SHA/size and GNU gzip CRC/decompression
before delegated normal archive. Final state **ARCHIVED**, stopped
**04:57:13.409Z**; receipt **stop_479d99a7075aa948**, completed
**04:57:13.430Z**, forced=false, error=null. Final archiveAfter=null; expiresAt
was not returned. The PHYSICAL_DRAINED release was posted at04:57:39Z.

No production code changed. Routine offline inspection errors (ambiguous short
custody SHA and a deduplicated receipt's physical filename) were corrected in
this assignment; neither was treated as a resource occupancy or runtime failure.
The prepared controller's actual offline lifecycle regression passed before
creation. Free /home stayed above1.5GB. Final validation covers retrieved SHA/
sizes/gzip CRC, PNG chunk CRC/IDAT, strict startup, pointer diagnosis, zero
gameplay commands and no later captures, actual kernel waits, distinct EOFs,
archive receipt and local drain. Evidence remains ignored; only this note is
committed. Next is offline support for passively reading these real sparse
binding pointers with identity/translation validation, followed by a separately
authorized fresh attempt. This single task stops after publication.
