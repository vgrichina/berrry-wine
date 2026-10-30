# Independent retained mounted-rename acceptance

Input commit: `d9423bef0804604f94f5c8f6ba01656328f19a59`.
Decision: ACCEPT_RETAINED_SCOPED_EVIDENCE. No runtime replay or production edits.

Run from the repository root: `python3 -B test/toyvm-mounted-callback-retained-independent-accept-oct30/oracle.py`.
The task used the supplied ops.py supervisor and its unchanged limit_contract.
`pins.json` records exact SHA256 and byte counts for every supplied input artifact and five production sources. `commands.json` records the passing command, enforced limits/admission sample and log location. `report.json` is its exact stdout.

The earliest applicable boundary is the retained CLI invocation: exact pinned qualify_accounted.py, --rename-evidence 16, and byte-identical fixture passed as Python -c. The oracle does not import or execute that runner, fixture or the prior verify.py. Production sources are hashed first. Backend.record_rename_callback AST establishes exactly opcode, unique, inode, errno and callbackCount; the serializer maps them to op, unique, ino, -error and self.rename_callbacks. The request header unpacks op/unique/ino before handle(), and recording occurs after handle() with the result error. The opt-in guard records RENAME (12) and RENAME2 (45); it counts all such callbacks, not each attempted rename syscall. Caller wiring forwards the optional evidence limit to the pinned synchronous-FUSE backend. Destination parent is not serialized.

Six syscall outcomes (21,20,2,20,22,0) preserve the original snapshot digest. Independent expectations reconstruct inode identities, modes, sizes and bytes. The valid move transfers inode 5 and file-original bytes from file to dir/moved,file without altering any other row. Its source parent inode 1 and destination parent inode 2 are tied to the initial/final payload tree. The sole callback is opcode 12, unique 2162, source-parent inode 1, errno 0, count 1. This supports one valid cross-parent callback; the other six are kernel-only outcomes with no backend callback coverage.

Checks cover checkpoint/report/payload consistency, source pins, accounted bytes/inodes/handles and resource bounds, retained FUSE mount ownership, empty remaining mounts/processes, successful unmount and expected server termination. The retained Boat API receipt reports bx_eyhtr684 snapshot completed/verified at 2026-10-30T02:09:06.929Z and stopped at 02:09:06.966Z, TTL 1800 seconds (created 02:05:43.900Z). No box was accessed or changed by this task; lifecycle ownership remains with the coordinator.

Six independent in-memory corruptions must fail for exact named reasons: missing callback; duplicate callback; wrong final destination tree even with matching expectedTree/checkpoint; manifest source-pin drift; residual cleanup process; failed snapshot. These test evidence acceptance, not production mutants. No original evidence file is changed. A first oracle implementation error (class name) is documented in commands.json; the passing run supersedes it.

Limits: this is offline acceptance of retained observations, not a new independent runtime observation. Before/after snapshots establish the recorded tree behavior, not concurrent visibility guarantees. The retained lifecycle receipt is not a current API query. Browser/gameplay acceptance and backend callback coverage of all six kernel-only cases remain open. No public deployment is authorized or performed.

Recovery: retain this directory with the input directory and pinned production sources at the input commit. Restore this task's commit/branch or apply the coordinator handoff recovery.patch to that commit, then run the command above. No Boat, Node, browser or runtime replay is needed. The external completion receipt records publication SHA and exact remote verification; its messageboard-note.txt is for coordinator append because the shared board exceeds the worker cap.
