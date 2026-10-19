# LockFile implementation checkpoint

Baseline: origin/main 3c791a0231267d4bd5a2db3160ad830c40a869da.
Original run `20261019-madbomber-dbcs-retry` stops when the KERNEL32
LockFile name lookup returns NULL. API IDs 453 and 711 already exist.

The implementation must enforce locks, not just expose the name. Proposed
ownership is a stable file entry plus a separate open-file owner shared by
DuplicateHandle. Independent opens, including adopted child filesystems,
have separate owners. Closing the final duplicate removes its locks.
Process teardown closes all disk handles before shell snapshot handoff;
adoption itself must not release the still-running parent's locks.

Store unsigned offsets and lengths as BigInt. Reject ranges extending past
2^64, support ranges ending exactly there and locks beyond EOF. Unlock must
match one exact original region. Conflicts report ERROR_LOCK_VIOLATION (33),
missing unlock reports ERROR_NOT_LOCKED (158), invalid handles report 6.
Ordinary reads/writes through a different owner fail before modifying file
position, bytes, guest buffers, or invoking lazy providers. Scatter reads
must preflight the whole request. Memory mappings are exempt, per Win32.

Necessary prerequisite: handles currently resolve mutable path names on
each operation. Retain the opened entry instead; CREATE_ALWAYS must truncate
that same entry, and a rename/replacement must not retarget an existing open.
File entry references and lock state must remain out of serialized artifacts.

Conformance cases: exact/partial/adjacent overlap, repeated lock, exact
unlock and wrong owner, duplicate access and final close, close-source,
zero-byte ranges, offsets above 2^53 and 2^64 overflow, EOF, lazy provider
noninvocation, append writes, scatter read nonmutation, rename/recreate,
parent/child adoption, process teardown, and KERNEL32 export/stdio cleanup.
Source/JavaScript tests run locally only; compiled guest and real Worker
validation require a separate coordinator grant. No gameplay claim.

References:
- https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfile
- https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-unlockfile
- https://learn.microsoft.com/en-us/windows/win32/fileio/file-handles
- https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/file.c
- https://github.com/wine-mirror/wine/blob/master/server/fd.c

## Source implementation and validation

Implemented per-entry WeakMap lock tables and per-open owner tokens.
DuplicateHandle shares a token only for the current process; cross-process
disk transfer was previously an incorrect local alias and now fails error 6.
Pipe, console, mapping and other-object duplicate dispatch stays separate.
The existing process validator accepts -1 and real current-process handles.
Disk inheritance is not implemented by adoptFrom; child opens have independent
owners. CRT `_dup` carries the new argument; `_dup2` remains unimplemented.

Pending host reads reserve their full range across provider yields;
conflicting locks fail while that operation is outstanding. Completion,
failure, close, thread retirement and process teardown release reservations.
Process exit and WineAssembly.stop close disk handles and reject late opens,
so a retiring Worker cannot reacquire a lock. Adoption does not close a live
parent's handles. Mapped views bypass byte-range locks.

KERNEL32 names use ordinals 591/592 after the coordinator's reserved 588..590.
API IDs 453/711 remain unchanged. Loader image and 281-import mirror updated.

Passed without building wasm:

- `node test/test-file-byte-locks.js`: includes forced four-byte scatter runs,
  parent/child ownership, exact 64-bit ranges, append nonmutation, mapped-view
  exemption, and pending-read contention.
- `node test/test-vfs.js`: 46 checks.
- `node test/test-vfs-adopt.js`.
- `node test/test-vfs-lazy-entry.js '--filter=^(?!.*(?:scheduler retries|thread-owned reads|two real Workers|browser and CLI)).*$'`: 47 checks.
- Four changed WAT fragments balanced; generator freshness, JavaScript syntax,
  diff whitespace, and signature parity against the full source closure.

An initial unfiltered lazy suite could not load four sparse dependencies
(including the compiled Worker closure helper), before compilation. Two old
path-replacement tests expected an open handle to retarget a new file. They
now assert retained opened-entry identity and pass. The filter permits
explicit source-only runs; the normal full suite still runs every case.

`test/test-lockfile-handlers.js` is authored and syntax-checked, **not run**.
It covers BOOL/last-error/ESP, high offsets, DuplicateHandle and CRT `_dup`.
Full build gates, real Worker RPC, public GetProcAddress execution, native
Windows zero-byte/duplicate edge comparison, and original Mad Bomber replay
remain coordinator validation work. No gameplay or runtime compatibility
conclusion follows from the JavaScript checks.

Independent review corrections: unsupported cross-process duplication now
passes through CLOSE_SOURCE cleanup on failure, releasing the lock only when
no duplicate remains. FlushFileBuffers validates the retained opened entry,
so rename no longer makes a valid writable handle fail. Focused regressions
cover both final-owner and surviving-duplicate rejection, renamed flush, and
closed renamed handles. No native execution was added for these corrections.

## Current-main RTC reconciliation (2026-10-19)

Merged verified origin/main 462f44b2f into this isolated task branch. The clean
text merge retained a stale generated import count of 282: the complete current
include closure has 283 with both file locking and CMOS RTC. Regenerated the
mirror using tools/gen-host-import-sigs.js and verified --check.

Focused file-byte-lock ownership/range/lifecycle/I/O tests passed; VFS 46/0,
VFS adoption and CMOS host/broker/browser-import source contracts passed.
Initial checks encountered absent sparse-checkout tools and the RTC test's dib
module dependency; expanded tracked lib/src closure and reran successfully.
These are JavaScript checks, not native, OS Worker, browser or actual Mad Bomber
validation. Native handler and original-game qualification remain pending under
the one-runtime scheduler. No canonical module or original binary was changed.

## Surface4/7 main reconciliation and bounded qualification plan (2026-10-19)

Merged main 0ace954f93b5d7107fd1de1d61601a54609e4e5e, then the narrow
debugger-arm main update 6cfc0d936b2d44b4e6de69002f0aa8f9f203f61c in the
isolated task/lockfile-rebased-oct19 worktree. Regenerated dispatch, API hashes,
KERNEL32 image and import mirror; regeneration introduced no additional diff.
All 4590 main API rows remain identical, including the nine appended Surface
rows. LockFile/UnlockFile keep API IDs 453/711 and export ordinals 591/592;
the combined mirror remains 283 imports.

Source-only checks passed: file-byte-lock regression, VFS 46/0, adoption,
filtered lazy VFS 47/0 (same four compiled/Worker/browser exclusions above),
CMOS host/broker/browser-import contracts, API append-only and all four
generator freshness gates, hash lookup, 127 fragment balances, handler ESP,
logical-and normalization, Surface 78 call sites/UUID identities/fail-fast,
and 2025-test manifest membership. Review retained the existing owner-token,
entry-identity, failed-close-source and renamed-flush corrections. Pending
scatter reads rewind to their original position before parking, so the wrapper
reserves the full request again on retry. No new production defect was found
in this bounded review. Native zero-byte and duplicate semantics remain an
explicit conformance gap, not a result inferred from these tests.

Also verified all 140 retained original fixture file lengths and SHA-256 hashes
against launch-manifest.json, and the main debugger-arm source regression
(`node tools/test-debugger-watch-arm.js /tmp/wa-lockfile-rebased-oct19`).

The handler fixture now accepts --compat and omits fonts because it exercises
only file ABI. Syntax checked; neither mode has been executed. Proposed serial
qualification, requiring a fresh coordinator runtime grant:

1. Pin this task HEAD, all source inputs, existing canonical modules and the
   original fixture manifest before building. Use isolated outputs only; admit
   each job with enough reserve to keep at least 2 GiB free, stop on floor/log
   cap breach, and verify source/original pins and absent process groups after
   each job. No broad cleanup or canonical module replacement.
2. Run normal build gates and build in the isolated worktree (120-second hard
   bound). Then run `node test/test-lockfile-handlers.js` and the same command
   with `--compat`, separately (60 seconds each, 2 MiB logs). These test direct
   handlers/ESP/error values, not public name resolution or OS Workers.
3. Run the existing lazy fixture with
   `--filter=^two real Workers preserve I/O ownership` (90 seconds, 2 MiB log)
   against the combined source. This exercises real Worker adapters but does
   not yet assert LockFile RPC itself; a dedicated six-argument fs_lock_file
   Worker contention/unlock and five-argument duplicate fixture is still needed
   before claiming Worker lock qualification. Public GetProcAddress execution
   also remains a required check.
4. Only after those gates, replay original Mad Bomber using the complete argv
   and 140-file manifest retained in
   `/home/user/wine-assembly/scratch/runs/20261019-madbomber-dbcs-retry/`.
   Original root is `scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/`;
   preserve all DLL seeds, data mounts, guest C:\\MADBOMBER path and original
   bytes. Archive SHA-256 is
   f21ab59154fd434f0952daf84848af47bf50262b7317f2ca1dbf7f43cb213164.
   Reverify manifest hashes; replace only worktree/module/output destinations
   and add LockFile/UnlockFile to the bounded API trace. Retain the prior
   10-second guest, 15-second normal quit, 25-second hard stop, 2 MiB log limits
   and 2214592512-byte stop floor. Write a new run directory and result last.
   Success requires observing name resolution and progress beyond the former
   missing-LockFile stop; menu/gameplay/browser evidence remains separate.

No build, native fixture, Worker, browser or original executable was run for
this reconciliation. No claim of gameplay or merge readiness follows.

## Source-ready public export and Worker qualification

The pending test gaps above now have authored fixtures, still **not executed**:

- `test/test-lockfile-handlers.js` loads the existing deterministic KERNEL32 PE
  fixture, calls its actual GetModuleHandleA/GetProcAddress imports, resolves
  both case-sensitive names and emulator ordinals 591/592, then executes the
  returned thunks through the interpreter. It checks five-argument stack
  cleanup, both 64-bit halves, contention, wrong-owner unlock and invalid
  handles. Its prior direct-handler/CRT duplicate checks remain.
- `test/test-lockfile-worker.js` compiles the production header declarations
  and exports their actual imported functions. Two OS Workers use the real
  guest-rpc shared-memory transport and filesystem broker. Assertions exercise
  the sixth unlock argument, high range halves, the fifth duplicate argument,
  failed CLOSE_SOURCE with a surviving duplicate, and final-owner cleanup.
  Both fixtures support --compat. Neither adds replacement file operations or
  a mock RPC transport.

Microsoft's [LockFile contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfile)
documents exclusive nonblocking locks, second-open denial, beyond-EOF ranges
and mapping exemption; it does not specify zero-length overlap behavior.
Wine's [Windows conformance test, test_LockFile](https://github.com/wine-mirror/wine/blob/master/dlls/kernel32/tests/file.c#L2218)
is the explicit zero-length oracle consulted on 2026-10-19. Its unconditional
checks cover successful zero-length lock/exact unlock and a left-adjacent
nonzero range. Interior/right overlap denial is conditional on the detected
limited_LockFile behavior of older Windows. The native fixture therefore
asserts only that unconditional subset. The JavaScript regression's stronger
point-overlap policy remains the candidate's chosen behavior, not a universal
Win98 compatibility claim. No local native-Windows comparison has occurred.

`tools/run-lockfile-native.js` supersedes the earlier prose-only gate sequence:
normal build (120 seconds), handler/public-export tail and compat (60 seconds
each), then real Worker tail and compat (45 seconds each), serially. Every job
requires free space strictly above 2852126720 bytes; monitoring stops at or
below 2214592512 bytes. Logs cap at 2 MiB each, aggregate evidence plus isolated
build outputs at 32 MiB, checked every 200 ms. Detached job groups are killed on
deadline/cap/interruption and checked absent. A failed job stops the sequence.
Explicit coordinator grant, reviewed manifest SHA-256, exact task commit and
the `/tmp/wine-assembly-local-runtime.lock` exclusive lease are required.

Preparation pins present tracked source inputs in the task, shared host and
recovery worktrees, both existing recovery canonical modules (shared-host
module absence is also pinned), the complete pngjs dependency, and all 140
original Mad Bomber files. Newly built modules are pinned across later jobs.
Source-only guard tests check content changes/deletion/unexpected appearance,
caps/job bounds and name/ordinal/API-ID agreement. Syntax, 2026-test membership,
and 283-import freshness pass; compiled tests remain pending.

Only needed missing tracked paths were expanded after runtime release:
.gitignore, index.html, package metadata, fonts/Terminal.fon,
fonts/substitutions.json and the two committed toyVM browser bundles. The
bundles account for most of the approximately 44 MiB expansion; the other
roughly 124 MiB of omitted tracked data was not copied. pngjs is resolved from
the recovery worktree's pinned node_modules. No Army path-handling functions
or canonical modules were edited. This controller never launches Mad Bomber;
original replay remains a separate grant after native qualification.

## First native allocation: build gate rejection, no native execution

The granted exact five-job controller (SHA-256
583adce4cc2a16992ff138ca132a86439ca470fadb3dc0fc708a821a9d030c6c)
ran session 89820 with prepared manifest f4054a9e. Normal build stopped at the
callback ownership census after 1.954 seconds, exit 1: host.js and
lib/host-imports.js whole-file hashes still described main before the LockFile
teardown additions. No WAT compilation or native fixture was reached. There
was no guard breach; process group 2893836 is absent, lease removed, all 9912
pins unchanged, and the isolated build directory is empty and retained.
Minimum sampled free space was 2996908032 bytes; a subsequent observation was
2832879616, below admission. No retry occurred.

Evidence is retained in isolated
`scratch/runs/20261019-lockfile-native/`: five artifacts total 1717969 bytes,
plus artifact-seal.json SHA-256
d1401b04563ee64ca2b76bd6b89d121dbcc6cdfecca92744b78b2f5b9905dfcf.
The seal includes original manifest, 374-byte build log, build status, failure
result and postflight (changed [], group/lease absent, four jobs not run).

Source review of the two changed producers found exactly one added operation
each: synchronous closeAllDiskHandles before stop's asynchronous runtime
retirement, and before exit's host callback/snapshot handoff. The VFS marks
retirement first, rejects subsequent opens, and closes each live disk record;
closeHandle removes read reservations and releases locks at final duplicate
close. Neither cleanup method calls guest code or restores an invocation.
Adoption retains separate open ownership and does not retire a live parent.
The two census records now describe these reviewed cleanup boundaries and
retain ownership=pending for the existing unrelated callback families. The
production host.exit regression asserts release and rejected late opens before
onExit observes the VFS, while preserving the child's independent lifetime.
This is a source-only correction; fresh pins and another grant are required
before any new build or native attempt. The original failed bundle is intact.

## Full-path main reconciliation before the second allocation

Merged main 42aeaa128c4d44f1769764aaf8f3320e12350be3. Its production delta
touches only getFullPathName and fs_get_full_path_name, disjoint from byte-lock
ownership and I/O checks. The pending Army _resolvePath candidate was not
included. Full-path A/W regression, file-byte-locks including production exit
handoff, VFS 46/0, callback census 396 and controller source guards all pass.
The two reviewed teardown census records remain unchanged.

After asserting that build was a real empty directory, preserved it by rename
to `scratch/runs/20261019-lockfile-build-preserved/empty-build`; the adjacent
preservation.json records the operation. No failed evidence was changed or
deleted. A new build destination is absent, as required by the unchanged
controller. A fresh source manifest and unique output directory are prepared
for review; no new build/native execution is authorized by this source step.

## Second allocation: normal build passed, native admission refused

Root ran the reviewed v2 controller as sole runtime, session 42448. Normal
build passed all gates and compilation in 22.601 seconds, exit 0, process
group 2907251 absent. Minimum sampled free space was 2361241600 bytes, above
the stop floor; no guard fired. The next job's fresh disk admission refused
before spawning a native test. That failed admission sample was not recorded;
root's later 2960699392-byte observation is distinct and does not explain it.
All four planned native tests remain not run.

The retained production modules are:

- tail: 97c67d7abbff795cab66c547fd637b6e7f2081a5513dc9cd860738b6bea33985
- compat: b3a9e9513d56932ee7217154789774d92c289f50adc78ef1dbdfa15c8a164fb1

All 9913 original pins and both modules reverified unchanged; group and lease
absent. Isolated `scratch/runs/20261019-lockfile-native-v2/` has six sealed
artifacts totaling 1723573 bytes plus artifact-seal.json (SHA-256
c31153b885307bc6574d8f380e2366782da1eaa08374c4af9851877b16161e89).
Build outputs remain in place, unmodified.

`tools/run-lockfile-continuation.js` prepares six serial jobs without a normal
rebuild: the original four instrumented handler/Worker tests, then two 30-second
exact-production-module smoke tests. Instrumented handler tests compile the
same source with test-only exports; Worker tests compile production import
declarations. Neither is described as executing the retained production
modules. New `test/test-lockfile-public-binary.js` verifies and directly
instantiates each exact retained binary, resolves both exports by name and
ordinal through actual imported APIs, executes their public thunks, and checks
64-bit contention/unlock/error/ESP. Missing unrelated host dependencies throw
if reached; no file operation or transport is replaced. All six are authored
and syntax checked, not run.

The continuation pins both modules and permits source differences from built
commit b130b9445 only in qualification tools/tests and these notes. Its limits,
per-job admission, stop floor and global lease are unchanged. The 32 MiB
aggregate now includes both previous run directories, current continuation
evidence and retained build outputs. Original manifests and seals are pinned.
New main 509b620ef's disjoint _resolvePath slash-classification fix and its test
are deliberately not merged into this already-built candidate; no claim is
made for that combined source. Original Mad Bomber replay and gameplay remain
separate future work after conformance, not a consequence of a passing build.

## Native continuation passed (2026-10-19)

Root ran the exact reviewed continuation in session 96429, terminal 0. All six
jobs passed: instrumented handler/public tail 2.915s and compat 2.762s; real
Worker RPC tail 0.060s and compat 0.057s; exact production binary public API
tail 0.064s and compat 0.067s. The production smoke logs identify the retained
97c67d7a/b3a9e951 hashes. No guard fired, all six process groups are absent,
lease removed, and all 9930 pins reverified unchanged. Minimum sampled free
space was 2948763648 bytes.

`scratch/runs/20261019-lockfile-continuation/` contains 15 sealed artifacts,
1725166 bytes plus artifact-seal.json SHA-256
9d0330e39b27c466e416f5da5ec5b557cd97685d11542a42eb283945f064b951.
This establishes the bounded fixture contracts, not original-game behavior.
The next original Mad Bomber consumer requires its own prepared matching
runtime, original 140-file manifest, retained module pins and separate grant.

## Original consumer preparation

`tools/run-madbomber-lockfile-consumer.js` reuses the prior original launch
argv: all 140 mounts, original DLL seeds, guest C:\\MADBOMBER path and 10-second
cooperative CLI observation. It changes only the candidate worktree/module,
new output destination, adds LockFile/UnlockFile tracing, and explicitly seeds
the same shared MSVCRT dependency formerly found in the recovery tree's default
DLL directory. That file remains at its original physical path, 278581 bytes,
SHA-256 887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1.
No original executable, asset, DLL or guest input is modified.

All tracked font assets needed by CLI startup were expanded (about 8.5 MiB),
and their bytes must match committed Git blobs. stdole2.tlb is already present.
Source-only plan checks validate exact original mount/seed preservation,
timeouts/paths, no --input injection, all bitmap/substitute fonts and system
data dependencies. The source delta from built b130b9445 permits only the
qualification tools/tests and these notes; production runtime remains unchanged.

The prepared consumer retains the 2852126720-byte fresh admission,
2214592512-byte stop floor, 2 MiB log cap and 32 MiB aggregate including all
three prior run directories plus build/current output. Guest bound is 10s,
normal quit at 15s and hard process-group kill at 25s. Passive PNG/snapshot
requests occur at 5s and 9s. A separate grant and global lease are mandatory.
The original archive, 140 files, shared CRT, source and modules are all pinned.
Mad Bomber is still unregistered in candidate-corpus: resulting metadata is
investigation evidence kept in these notes, not a dashboard gameplay claim.
This consumer has not been launched.

### Initial original allocation refused before spawn

Root's exact consumer command returned 1 at the initial fresh admission check,
before creating an output directory or spawning a guest. The failed numerical
sample was not recorded. A distinct joint statfs observation at
2026-10-19T02:32:17.775Z reported 2928340992 bytes for both worktree and shared
root; it is not evidence of the failed sample or its cause. The refusal is
preserved at `scratch/runs/20261019-madbomber-lockfile-admission-refused/refusal.json`.
The original ef81a891 manifest is unchanged; controller bytes can be recovered
from be58482fe. No original execution or automatic retry occurred.

The controller now captures free space exactly once for pre-spawn admission,
including timestamp, cwd, root and the unchanged exclusive 2852126720-byte
threshold in any assertion error. Successful admission records the same sample
in launch.json. Source regression checks confirm one read for each decision,
refusal at/below the boundary and acceptance one byte above it. Other guards,
argv and runtime remain unchanged; a fresh manifest refreshes only this
reviewed controller pin, with a unique original-v2 output proposed for a new
allocation.

### Numeric v2 refusal and bounded source-only diagnosis

Root's unique original-v2 allocation refused before child/output creation at
2026-10-19T02:34:06.975Z: the exact freeBytes sample was 2277421056 against the
unchanged exclusive 2852126720 threshold, with expected cwd/root. There was no
guest run or retry. The subsequent source-only, single-process diagnostic
started at 02:35:08.951Z with space already low at 2523193344 bytes, before
requiring either controller. Free space was unchanged through requires,
manifest hash/parse, git HEAD, sourceDelta/git diff, argv construction and
module hashing. During read-only verification of all 10027 pins it increased
to 2730704896 bytes; swap use stayed at 638340 KiB. This does not support a
650 MiB allocation by those preparation steps in that observation.

A point-in-time read-only scan of large writable local process FDs found only
Codex database/session files, no guest/build writer. It cannot rule out hidden
external or transient writes. Root reports a host snapshot attempt from
02:33:57.259Z to 02:34:12.641Z, overlapping the numeric refusal. Snapshot-space
correlation is plausible but unproven. No cleanup, snapshot changes, threshold
relaxation or deeper box investigation followed.

The refusal, per-stage samples and review are sealed in
`scratch/runs/20261019-madbomber-lockfile-admission-refused-v2/`: three artifacts,
5184 bytes plus seal SHA-256
e73a33c6a2d7e3e03c59b6f0adab14a69fec6c249cd76085f8d5e23984826504.

`tools/prepare-madbomber-portable.js` prepares a read-only transfer inventory
for an assigned fresh-box directory after Dungeon qualification. It retains
exact 97c67d7a/b3a9e951 modules, candidate runtime source, 140 originals, pngjs,
shared CRT and archive/evidence hashes; only host paths have relocation
templates. It creates no box, performs no remote copy and runs no build/guest.
Root assigned `bx_rqnkhrnr:/tmp/wa-lockfile-rebased-oct19` for source-only
staging via HTTPS Git and the documented Files API. Remote controller path
adaptation, destination verification, coordinator review
and a separate runtime grant remain required. All evidence must return to the
durable host before temporary-box expiry. Dungeon paths must remain untouched.
