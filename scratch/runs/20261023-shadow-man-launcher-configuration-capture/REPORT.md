# Shadow Man launcher/configuration capture — blocked before guest

**First blocker:** the single supported retained-session stream stopped on
`parent-vfs/program files/acclaim entertainment/shadowman/data/movie/dream_2.avi`
with Python `http.client.IncompleteRead` inside `upload_stream`. No retry or
replacement transport was attempted. The helper labelled it “Destination upload
IncompleteRead”, but that wrapper also encloses source-generator reads: the
preserved exception does **not** distinguish truncation of the snapshot body
from the PUT response. No HTTP status or underlying partial-read byte count was
preserved. Do not claim an API authorization/capacity failure or a guest failure.

One restore attempt failed after 215.881366s. The 1,845 completed file receipts
cover **153,820,597 bytes**. `restore-first-error.json` reports 176,266,007 bytes
because its counter includes the next member's declared size before upload;
that is not a successful-transfer byte count. The failed member was expected to
contain 22,445,410 bytes. Fresh destination inspection found it **absent**, with
exactly 1,845 restored files and no unreceipted partial original. Of 2,083
expected files / 186,399,681 bytes, 238 files remain incomplete/untransferred.

Every completed receipt freshly matches the accepted old restored manifest,
then every corresponding destination byte was independently rehashed. See
`restore-comparison.json`, `transfer-files.jsonl`, `retained-integrity-api.json`
and `handback.json`. All retained immutable files/directories were made read-only
at handback; no original content was changed.

## Identities and closure

Source is exact main `58e90870a40a541a4083cae5e987ca8de31889e6`; the isolated
thin index preserves all 8,279 base paths. The root lacked the requested commit
object, so the already-accounted streamed-runtime donor supplied its exact base
commit and 308 tree/commit object entries. No lazy fetch, alternates change,
donor/root HEAD/index/config edit, or whole history copy occurred.

The retained runtime donor supplied 158 paths; each local SHA256, Git blob and
base index entry was checked before transfer. All 23 retained PNG codec files
were checked locally. The 27 original main-pinned data files / 692,498 bytes
and `tools/ctl.js` were staged in the same closure, without an incomplete
158-only gate. `ctl.js` uses builtins `fs`, `path`, `http`; its pin is in
`ctl-pin.json`. No local Node process, default npm/compiler path, compilation,
build, reinstall, native optional DLL injection, source fix, or registry spoof
was used.

The canonical module was reused locally, never recovered/rebuilt:
1879387 bytes, SHA256
`ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`.
The complete staged immutable closure/receipts comprises 217 files, all freshly
destination-rehashed. See `stage-receipts.json`, `gate-tools-final-upload.json`,
`runtime-manifest.json`, `codec-pins.json`, and the accepted data manifest.

The actual restored registry is 17088 bytes, SHA256
`d7143f29d29576cd015ec875264028fa70795d0f18de457e31927048081d9de3`.
The actual restored original D3DConfigUtility is 573440 bytes, SHA256
`850c69cfa4a0d610072a67763d54179bc4cdc58875560ce5ede33bfa44d19fe0`.
MSS32 and DSETUP were not among the completed 1,845 paths; their accepted
required identities remain in the installed mapping, and they must not be
represented as restored or admitted:

* MSS32: 328704 bytes,
  `09e2dec3d1e996571fb2c95e5de393410d486f1728c86473b550282edd83588c`.
* DSETUP: 135680 bytes,
  `5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f`.

The accepted offline review is retained in `accepted/`: COMCTL32#17 maps
InitCommonControls and named OLE32 StringFromGUID2 has a system fallback.
Those warnings were not treated as fatal; this task never reached a loader.
Native DSETUP#11 and the MSS32 declared seed remain mandatory.

## Gates, attempts and limits

Measured precheckout local admission was **66,191,360 bytes**, including all
five reused whole donors, 18MiB tools allowance, 1MiB selected root inputs,
7MiB own checkout/evidence/temp allowance and an **8MiB reserve inside 64MiB**.
Host free was 6,282,838,016 bytes, above the 2,982,150,144-byte floor. Final
actual allocation and protected metadata are checked by `verify.py`.

Before publication, `admission-finishing.json` refines that accounting: the
native-review donor contributes all actually accessed evidence and Git metadata
(1,417,216 bytes), instead of charging its unaccessed worktree artifacts. Other
four donors remain charged whole. Measured host tool executables are 20,471,808
bytes inside a raised22MiB allowance; selected root inputs/metadata receive2MiB.
Own checkout/temp/publication retains7MiB and reserve retains8MiB. Revised whole
projection is **64,794,624 bytes**, below64MiB; final actual is in verification.

Fresh box API info/exec passed before guest mutation: ordinary UID/GID1000,
Node24.18.1, 49,083,469,824 bytes free, fresh target absent. The pre-copy
immutable projection was 280,050,899 bytes below 2GiB. Fixed allowance was
96MiB; the intended hard tmpfs was 896MiB, with 32MiB reserve inside total
1GiB mutable. All staged immutable/fixed copies were covered by this bounded
projection; every local material transfer also checked the whole local gate.

Actual final allocation: immutable **172,122,112 bytes**, fixed **655,360
bytes**, empty mutable directory **4096 bytes**, remote free **48,907,792,384
bytes**. No tmpfs was mounted, no original VFS/registry clone was made, and no
process-input/export overlap was created. The full overlap hash gate and all
fresh fixtures were **not executed**, because restoration failed first.

The compile guard, forwarding/rejection fixtures, dependency checker (including
ctl), external watchdog, ownership-at-mount/write-probe preparation and exact
recipe were staged/adapted. They are preparation artifacts, not a passed
qualification. In particular this task did not yet consume the canonical
module through WebAssembly.compile, run a PNG fixture, or qualify Worker/child
command dependencies. `preguest.py` and `launch_once.py` were never invoked.

The repository evidence-containment checker ran offline on the test box with
only builtin fs/path/crypto dependencies: exit0, zero errors/missing/invalid.
No Shadow Man candidate exists in the current candidate corpus, so no unrelated
candidate or `result.json` was invented; zero dashboard records were scanned.
This checker does not qualify runtime dependencies, rendering or input.

**Complete gate FAIL CLOSED. Zero guest invocations, zero live PNG/capture
attempts, zero input dispatches, zero Configuration actions, zero game launches.**
There is no UI, gameplay, successful guest exit or capability claim. Local
restore process exited 1; OS guest exit and guest ExitProcess are not applicable.
No owned guest group was created; final Node process list and owned groups are
empty. Failed restore attempts: **1**. Retries: **0**.

## Box ownership and publication

Assigned **bx_vufrds5w** remains **RUNNING** (API `idle`, health `ok`, stop
null), freshly checked after the failure. Expiry
**2026-10-23T01:36:17.590Z**. Handback is before01:15; coordinator owns the
01:20 checkpoint/shutdown. No stop/delete/resume/fork/public deployment or
worker launch was performed. `box-final.json` is the actual state receipt.

`RECOVERY.md` identifies retained state and supported recovery boundaries.
`publication.json` records the evidence commit and independently queried remote
branch SHA. No main merge. This single task stops at this blocker.
