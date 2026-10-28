# GLTron original recovery independent acceptance — REJECT

Candidate: `a80fd96b969a2ac80f30fdf6793d92f23ed9a860`,
`refs/heads/task/gltron-original-win32-recovery-oct28`.
The candidate implementation, supplied tests, and report remain unchanged.

The exact production `verify` CLI accepted the retained 3,658,814-byte original
SHA-256 `8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3`.
Coordinator verification of all 92 extracted files (4,968,893 bytes), 95
artifacts, inventory, license and closure hashes is reused unchanged. This
acceptance did not download, extract or execute the original installer/game.

## Decisive counterexample

The acceptance contract requires that a failed stage cannot publish inventory.
The exact production `analyze` CLI publishes `inventory.json` before static PE
closure validation. An owned fixture containing only the retained original
`gltron.exe`, its exact original listing line, and a byte-identical owned copy of
the original installer demonstrates this without executing any PE. All fixture
bytes pass the candidate's hash, size, manifest and Adler32 gates. Actual
`/usr/bin/objdump -p` then reports the real imports; SDL.dll, libpng.dll, zlib.dll,
sdl_sound.dll and MSVCR70.dll are absent from the deliberately reduced fixture.
`analyze` exits 1 with `unresolved non-system static imports`, but an inventory
has already been published. No CLI success was observed or inferred.

Cause: `analyze()` calls the writing `inspect_payload()` at line 248;
`inspect_payload()` writes inventory at line 216. Import validation and its
failure occur later, at lines 250–276. Integrity validation of extracted bytes
passes; closure validation fails after publication. The original full payload's
reported zero unresolved imports is not disputed by this reduced fixture.

Repair scope for a fresh worker: separate inventory validation from publication,
or stage outputs privately until all acceptance gates for the operation pass.
Keep failure diagnostics explicitly distinct from accepted outputs. Preserve the
unchanged counterexample and independently reaccept the repaired production CLI.
This report does not modify the candidate or authorize integration.

## Results and reproduction

Durable evidence directory:
`/home/user/wine-assembly/scratch/usage-watch/gltron-original-recovery-independent-accept-oct28`.
`evidence/challenges/decision.json` records 26 checks: 25 passed, one rejected.
`evidence/challenges/closure-failure.stderr` retains the actual traceback;
`evidence/challenges/closure-failure/{inventory,closure}.json` retain the
premature inventory and failing closure. The minimal extracted counterexample
is the single retained PE and exact listing line in that directory. The original
installer copy is retained there only to satisfy the immutable production hash.

Run the unchanged independent script under the supplied task-local supervisor:

```sh
python3 "$TASK/ops/guard.py" independent-challenges python3 \
  "$REPO/test/gltron-original-recovery-independent-accept-oct28.py" \
  "$REPO/tools/recovery/gltron-original-win32-recovery-oct28.py" \
  "$ORIGINAL_TASK/payload" "$TASK/evidence/FRESH_DIRECTORY"
```

Use a fresh owned output directory; stop after its decisive decision. The script
returns zero for a completed acceptance experiment; inspect `decision.json` for
ACCEPT/REJECT. A zero supervisor exit is not candidate acceptance.

The first behavioral group used the exact production `verify` CLI followed by
the unchanged supplied hash/size/absent-sentinel and listing reproducers. New
production CLI wrong-hash and empty-input extraction controls rejected before
tool logs or extraction destinations appeared. Oversize uses the metadata gate:
creating a file over the candidate's 12 MiB archive bound would violate this
task's equal 12 MiB file cap. No limit was raised.

Independent exact-stage controls rejected aggregate/member bounds, malformed
size, unsupported version, missing terminator, traversal, absolute/drive paths,
case collisions and link-like records before dependent sentinels. Normalization
accepted a correct literal dump filename and rejected missing/extra members,
symlinks, size excess and wrong checksum before inventory. These isolated stage
controls are not represented as full production extraction of the actual
original. The decisive closure test uses the actual production CLI and actual
installed static parser, without mocked verification, listing or tool output.
Five unchanged passing focused regression receipts are reused; only the two
supplied boundary cases needed at initial acceptance were rerun.

## Resource and scope limits

Task-local wrappers preserve 128 MiB group physical RSS and Python DATA,
256 MiB DATA only for Git, CPU 90 s, wall 120 s, file 12 MiB, stream capture
2 MiB and evidence 8 MiB controls. Admission charges three 64 MiB worker
reservations and 24 MiB coordinator reservation above the 2,982,150,144-byte
host floor. Task accounting includes checkout, fixtures, evidence, session and
positive WAL growth, plus 8 MiB reserve and 16 MiB prospective allowance.
Canonical receipt records final measurements. First policy-reading terminal
responses exceeded the requested 8192-byte terminal ceiling before the owned
wrapper was established; no blanket claim of perfect limit compliance is made.
All subsequent supervised operations retain separate stdout/stderr and cleanup
receipts. Physical RSS is sampled; sub-sample concurrent peaks remain an
observation limit.

No runtime, Wine, browser, module compilation, Boat allocation, public deployment
or main publication occurred. No boxes were assigned; lifecycle ownership stays
with the coordinator. Full GPL text is not separately bundled. Dynamic imports,
guest API support, registration and gameplay remain unknown. Source repair and
fresh independent acceptance precede integration; original-game qualification
then still requires an authorized runtime with the actual game and API closure.

The shared messageboard exceeds this task's file-size cap. Its publication note
is handed to the coordinator; no doomed append or limit relaxation is attempted.
