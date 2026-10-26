# Original Maelstrom / current UOP observer — 2026-10-26

**BLOCKED before observer start. Original-game errno/caller acceptance: false.**

The one authorized invocation loaded the pinned original executable and DLLs,
then failed at the diagnostic logger's first `loaded-before-validation` snapshot:
`ENOENT` opening `guest/native.jsonl.raw.jsonl` because its owned parent directory
had not been created. The runner stack anchors this at `nativeRaw`, line 5753.
The supervisor created `ops/guest/` for process evidence, which did not create
the separate `guest/` directory required by the raw/native observer output paths.

This is a capture-wrapper error introduced in this assignment. No native
acquisition guard was reached or rejected. `verifyLoaded` and
`nativeAdapter.start` were never called. Select completion/result, invocation
token/thread/register ownership, errno, native CALL/RET, caller and before-CMP
instruction observation are **UNKNOWN**, not zero. Loaded `_getptd` validation
is also unqualified. The DLL loader log records CRT base `0x522000` and SDL_net
base `0x7a2000`; it does not establish the requested original-game observation.

The exact accepted current-main tail was reconstructed once from all 140 pinned
Git blobs at `c6279bb936462834ccd9b51ea99a684a5befcda3` (128 source files,
20,713,733 source bytes plus 12 compiler dependencies). The accepted transformation
and compiler bytes were unchanged; build selection was restricted to tail only.
Its exact SHA-256 is
`fec642f6c711e57e1c4a3dfaeaff0e11be587c56fc64cde394ed7f54147b5988`,
1,884,180 bytes. A hash-verified copy is retained at
`/tmp/maelstrom-current-uop-original-errno-capture-oct26/ops/errno-latch.wasm`.
The first build process failed on an omitted pinned build.sh before transformation
or compilation; that incident is retained. Transform-only preflight then passed
and the actual compile completed in 3.19 seconds. No synthetic acceptance/native
case replay, both-backend requalification or production semantic change occurred.

All 250 staged inputs passed independent API hash readback. The actual canonical
mount parser enumerated and hashed all 48 original tree-mounted files, including
comma-bearing names. The original loader recipe, input schedule, batch1000,
max42000 batches, 200ms ticks, 512MiB heap/arena and max60 seconds were retained.
Diagnostic-only snapshots additionally targeted the loaded _getptd call and all
general registers, but failed before persistence. Original immutable assets and
historical donor trees remained unchanged.

Node v24.22.1 startup passed with --max-old-space-size=512, DATA/AS unlimited,
CPU90 and FSIZE25MiB. Git DATA512MiB applied only to Git subprocesses. Compilation
used CPU/wall300, guest CPU90/wall60; supervisor output bound131072. Guest
supervisor37238 / child37242 exited naturally1 after0.134s, no owned process or
remaining group. Exact process/environment/argv/limit receipts are retained.

Fresh local and remote gates passed before compilation and guest. Resource
accounting includes lstat directory/symlink metadata, owned Git, both phase trees,
API process artifacts, launcher/session, positive DB growth, shared WAL/SHM once,
future growth once and8MiB reserve inside64MiB. Initial gates that failed due to
the measured24.9MB WAL/SHM and duplicate archive are preserved. Compressed source
transfer, owned-object packing and serialized source removal/asset staging made
the actual operations fit; no resource cap was raised.

The recovery-only corrected supervisor creates `guest/` before Popen. Its syntax
and ordering were reviewed; it was not executed. The actual failed supervisor
and raw process output are preserved. There was exactly one guest attempt and
no retry. Any later invocation requires a new coordinator assignment.

Box `bx_vs4xtsz3` was handed back09:54:08UTC running (actual Boat API state `idle`,
health `ok`), with no owned guest/supervisor process. The coordinator owns
shutdown10:10UTC; expiry10:32:43.299UTC, guestCutoff10:00UTC, handback10:05UTC.
No stop/delete/resume, SSH/SCP, main merge, public deployment or worker spawn.

`evidence-manifest.json` binds compressed evidence and recovery recipe hashes.
`observation.json.gz` records the exact blocker; `collected/ops/guest/output.log.gz`,
`command.json.gz`, `terminal.json.gz` bind the actual invocation. The binary stays
outside Git and must be recovered from the retained exact copy, never a historical
substitute. Gameplay, screenshots, performance and other engines remain unqualified.
