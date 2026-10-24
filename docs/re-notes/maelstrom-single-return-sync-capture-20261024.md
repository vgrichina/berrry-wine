# Maelstrom: single CheckSockets return capture remains unresolved

Exactly one original guest ran on `bx_rfd49qx6`, using the corrected single
trace PC `0040e12a`. The actual owned argv passed
`tools/maelstrom-startup-divergence.py --check-argv` after checkout and again
immediately before guest launch: startup `BATCH_SIZE=1000`. The unchanged
42,000-batch ceiling stopped observation while the guest was parked inside
select. **No CheckSockets return record was captured. Its EAX, current-frame
missing slots, packet metadata and selected branch remain unknown.** Neither
timeout nor positive readiness nor SDL_net's internal errno retry is selected
from missing records. No second guest or observation extension occurred.

## Observed stopping boundary

The full [raw output](maelstrom-single-return-sync-capture-20261024/output.log)
and [terminal](maelstrom-single-return-sync-capture-20261024/terminal.json) retain
617,354 API calls and 42,000 batches in 9.840 seconds. The supervisor completed
naturally after 10.018 seconds with host return zero; this is not guest normal
exit. No trap, wall timeout, output guard or admission rejection occurred.

| Observation | Value |
| --- | --- |
| Historical startup-path counter `406378` | 1 |
| Sync entry counter `40e000` | 1 |
| RunFrame counter `4019a0` | 1 |
| PollEvent return counter `40287d` | 3 |
| Select return counter `7a3362` | 972 |
| Select thunk counter `075040f8` | 22,370 |
| Requested `40e12a` trace records | 0 of at most 16 |
| Final EIP / ESP / EAX | `075040f8` / `074ffb18` / `53000001` |
| Last observer batch / yield | 41999 / 8 |

The unchanged passive observer retained four parked-select samples at batches
36165, 36175, 36185 and 41999. The parked stack begins with the authentic
select CALL return `007a3362`, followed by `53000001`, a read-set pointer, two
zero pointers and a timeval pointer. Its timeval is `(1,0)`; its read set has
count one and socket `53000000`. These are pending-call observations, not
completed select results. Final EAX is not a CheckSockets return value.

The positive startup counter reestablishes startup reachability after the prior
five-PC startup-budget failure. It does not establish packet acceptance. The
972 return hits do not establish 972 Sync iterations. As documented in the
accepted [Sync diagnosis](maelstrom-sync-loop-cause-20261024.md),
CheckSockets can retry select on errno 4; that errno is not captured here.
The precise unresolved predicate remains the return from CheckSockets and the
current-frame barrier state at that return. The actual finite observation ends
at the parked select thunk; no production repair or permanent-hang claim follows.

## Exact configuration and evidence

Immutable donor `9ffbb83a66eec3fe0548535889e1a4c0221ccb56` was verified at its
remote task branch with the user-supplied dedicated strict SSH configuration.
Its accepted seven rejecting controls are reused unchanged. The owned command
matches its single-return argv exactly except allocation-path relocation from
`/tmp/maelstrom-sync-packet-return-capture-oct24` to this task root. The
[identity receipt](maelstrom-single-return-sync-capture-20261024/recipe-identity.json)
binds the full argv and byte-identical preload, observer and PNG capture helper.
The supervisor changed only owned allocation, box, deadlines and lifecycle text.

The only trace address is `40e12a`, the true return after the original CALL at
`40e125`, before `ADD ESP,8; TEST EAX,EAX; JNE 40e19f`. The intended zero successor
is `40e131`. None is claimed observed by a missing trace. The six historical
count PCs remain counters, not added trace/break/watch PCs. The trace is armed
from batch 36163, limited to 16 records and memory
`esp:384,0x41f9d8:128,0x420658:12` (at most 8,384 raw snapshot bytes; actual zero).
The 42,000 batches, 200ms clock and complete P/arrow/space/PNG input schedule
remain unchanged. No forced network/readiness/input change occurred.

The [actual command](maelstrom-single-return-sync-capture-20261024/command.json)
is the supervisor-consumed command; its remote JSON hash was matched before
launch. Module SHA256 is
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`, historical
source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI291/layout
`9a3bc9149d58209c`. Canonical runner SHA256 is
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
No current-main module or build fallback was used.

The byte-identical 247-file closure manifest totals 17,027,463 bytes. All files
were rehashed remotely before launch. The original tree has 48 files and
2,794,170 bytes; all original hashes were checked locally and remotely. EXE
SHA256 is `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5`,
SDL `02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373`,
SDL_net `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95`.
The canonical parser validated the actual tree mount before checkout, and the
remote canonical tree expander enumerated and hashed all 48 guest mappings,
including `Docs/Ambrosia_Software,_Inc._FAQ.txt`. No per-file comma mount was used.

Ordinary UID1000, Node24.22.1 and pinned pngjs7 passed the retained preamble,
font, codec/pixel identity and rejecting PNG controls. The passive observer
fixture, resistant-descendant TERM/KILL/reap control and 131,072-byte output
guard control passed. Full stdout/stderr was retained without truncation.
All three PNGs are retained and visually inspected: the menu is visible at
30000; the later images are black/starfield frames. They do not establish
gameplay. The [analysis](maelstrom-single-return-sync-capture-20261024/analysis.json)
keeps unknown return/packet fields explicitly null. The evidence seal list binds
the complete raw output, terminal, command, PNGs and compact gate receipts.

## Resources, recovery and handback

Initial combined admission was 50,708,949 / 67,108,864 bytes, including owned
checkout/Git, remote closure, helpers/evidence, transfer overlap, full external
session/launcher histories, positive SQLite growth allowance, future growth and
8MiB reserve. Installed tools and read-only inputs were separately identified.
Both hosts retained at least 2,982,150,144 bytes after projected incremental
growth; individual files remained below 24MiB. Immediately before launch,
remote MemAvailable was 7,226,318,848 bytes, above the 2,684,354,560-byte gate.
The guest used fixed shared 512MiB linear memory, Node heap512, CPU90/wall60.
Cheap helpers used the retained heap256/CPU60/wall60 recipe.

Capture accounting charges 245,344 API-response bytes plus a conservative
500,000 other capture bytes, totaling 745,344 / 1,048,576. No new disassembly
was generated; narrow retained instruction excerpts remain below 64KiB.
The guest output was 6,508 / 131,072 bytes. Actual cleanup reports
`remainingGroup=false`, no reaped residual descendants and `taskNode=[]`.
The watchdog's TERM then KILL path is retained for fault/timeout/end; natural
completion needed neither signal.

Recovery root `/tmp/maelstrom-single-return-sync-capture-oct24` retains setup,
transfer, accounting, collection, packaging and publication receipts. The
committed manifest and recipes reference the standing originals under
`/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6`, historical
module under `/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build`,
and original capture setup `/tmp/maelstrom-select-return-capture-oct24` read-only.
Git does not preserve those ignored binaries; recovery requires the named exact
inputs and hashes, not recompilation or reacquisition under this task.

`bx_rfd49qx6` was handed back RUNNING, API state `idle`, health `ok`, expiry
`2026-10-24T10:02:43.642Z`. Coordinator owns shutdown at 09:57. No box stop,
resume, create or snapshot command was issued. The worker used one bounded guest
only, no browser, build, acquisition, repair, main merge, deployment or worker
launch. Root tracked/index/refs and donors remained read-only; shared board was
append-only. Publication commit/remote verification and final resource/cleanup
receipts are retained at task root and recorded on the board. Ops result is
written last, then this worker stops and returns ownership.
