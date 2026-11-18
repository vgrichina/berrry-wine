# CLI memory child handoff; UT welcome only

Evidence: `scratch/runs/20261118-cli-memory-child-handoff-ut-gameplay/`.
Implementation `4f3c72fe6`, exact command-line correction `cc007fc73`; both
were committed with explicit owned paths and immediately strict-pulled/pushed.
Focused tests and locked builds passed before those commits. The final clean
published runtime is `cc007fc738c2932bd5219de16fd26cbbad51b6df`, with module SHA-256
`a1b157f7d9e800ac8739ddb0a31755f2738bc080d8f31146b2a31562663a8a64`,
2,418,928 bytes. It excludes the held worktree timer and renderer changes.

The CLI now supports `--spawn-processes --child-transport=memory` for its
existing actual child-process route. Default disk transport is preserved.
Memory mode forks a real Node child emulator, sends the installed executable
and writable C: snapshot through private Node IPC, and receives a completion
delta. It writes no executable copy, VFS tree, registry snapshot or media
bundle to disk. The writable namespace includes bytes, empty directories,
file names, attributes, FILETIMEs, C: volume context, registry and INI state.
Readonly drives carry the normal source-owned mount recipes and identity pins;
children reopen and verify those original sources without exporting their
bytes. Unsupported mutable drives, unowned readonly mounts and redirected
pipe children fail closed in memory mode.

Versioned IPC chunks are sequenced, bounded per chunk and checked against the
announced size/digest and launch-owned token. Wrong ownership, order, duplicate
completion, malformed metadata and incomplete EOF are rejected. Child startup
restores the mutable namespace before installed-DLL discovery and initializers,
retains the explicit/inherited cwd, and preserves the actual raw command-line
case, quotes and spacing in GetCommandLineA/W. The current startup buffers
support ASCII raw lines up to 383 bytes and parsed arguments up to 200 bytes;
larger/non-ASCII memory launches are explicitly refused instead of truncated.

This is a fork-time snapshot with completion merge, **not** a concurrently
shared filesystem. A complete normal guest exit, including a nonzero guest
exit, may merge only after the actual native child exits and both output
pipes close. A guest exit message alone is insufficient. Changed paths merge
only if their parent baseline bytes/metadata remain unchanged and no parent
handle remains open. Unrelated parent paths/registry keys survive. Source,
volume, registry and directory conflicts reject the delta. Normal VFS methods
and overlay hooks are used. A refused later write restores original entry
identities, bytes, metadata, directories and registry, with watcher delivery
deferred until commit. Irreversible third-party hook side effects are outside
that transaction; an exceptional rollback failure explicitly reports
`partialApplied` and stops the parent. Guest process handles retain the existing
virtual IDs; optional native-child receipts record their actual OS PID mapping,
native exit and pipe EOFs. Cancellation waits for the actual child and discards
its delta. Normal early parent guest exit waits for its child host before
retiring the remaining desktop authority.

The valid baseline PE fixture on the old published graph reached the actual
spawn route and failed at the prohibited disk snapshot boundary when host
`wa-child-` directory creation was denied. It did not execute a child. The
fixed tests compile ordinary parent and child PEs with clang/dlltool/ld, use
normal guest WriteFile to install the embedded child and payload, and execute
that installed child through ordinary CreateProcess/ShellExecute. The child
reads the parent's bytes in its inherited cwd, checks exact ANSI/Wide command
lines, writes a receipt and deletes a stale file. The parent observes the real
exit before reading the merged receipt/deletion. Tests cover exit 23, normal
early parent exit, nonzero child exit 71, TerminateProcess with exit 87, and
ShellExecute. A real source-owned authored ISO control also passes inherited
empty D: cwd, volume identity, readonly-write refusal, installed early DLL
initializer, C: output and registry merge. Real child startup rejects wrong
owner, truncated transport and malformed metadata before PE execution.
Actual-VFS negatives cover bytes/metadata/open-handle conflicts, unsafe and
duplicate paths, invalid times/whiteouts, directory/file collision, registry
conflict, and second-write/second-open refusal without partial mutation.

The complete final published suite passed, with real native waits and pipe
EOFs. Existing spawn-process, child-process-object, VFS-export and child
observation tests passed. `locked-build-final.log` and
`locked-build-raw-final.log` are successful locked builds. Earlier fixture
authoring errors, an earlier incomplete-test join defect, interrupted builds,
and an intermediate disk-preempted verification are retained and are not
represented as successful qualification. The final truncated-IPC test joins
actual exit, disconnect and both pipe EOFs explicitly: Node's parent-initiated
disconnect can omit its aggregate `close` event.

One genuine UT scope began at **2026-11-18 11:00:11.207 UTC**, with install
1200 / total 2400 / final Quit-cleanup reserve 300 seconds recorded beforehand.
The normal media loader materialized only its selected Setup.exe input; it
mounted the unchanged unique CD1 ISO on default D: and used fresh volatile C:.
No prior partial overlay, VFS tree, save-vfs or registry snapshot was attached.
The default intended destination remained `C:\UnrealTournament`. The actual
original Setup reached its welcome page, personally reviewed in
`original/setup-welcome.png`.

The first ordinary Next attempt was **NOT SENT**. Its independent release
helper did not deliver its arm line within the fixed one-second arm deadline.
The controller disarmed it and closed UNKNOWN at
**11:01:04.311 UTC**. The late helper subsequently exited zero with actual wait
and both output EOFs; it saw the disarm and sent no release/input request. No
DOWN dispatch record or Next receipt exists. Local filesystem cancellation
started at **11:01:04.407 UTC**; no later endpoint request, replay, extension,
installer retry or forced callback was made. The native CLI, supervisor and
outer owner exited and drained; the supervisor recorded no survivors. Their
zero host exits describe cancellation cleanup, not successful installation.
The normal temporary Setup.exe input was removed after the real native wait.

Consequently **UT installation completion, Finish/Run, original child launch,
gameplay and ordinary Quit remain unproved**. No installed application manifest
could be observed or hashed, so the audit records it as null rather than
inventing an installed filesystem. Durable installation remains **OPEN,
separately**. No game extraction, filesystem fabrication or guest callback
injection was used. The failure is the finite input-release preparation
boundary; it establishes no new UT compatibility defect.

The disk guard preempted two earlier owned verification/build scopes at
1,590,902,784 and 1,543,438,336 bytes. After the second guard had stopped them,
shared `/home` free space was observed at 823,689,216 bytes: the task cannot
claim the global 1.5 GB floor held throughout preparation. No genuine original
was running then; owned compilation/build work was stopped and no foreign
files were removed. Space recovered before original admission. A fresh finite
100 ms disk guard covered the original and its drains; its final minimum and
receipt are retained separately. Source/ownership audits and every referenced
blob of both genuine disk partials, plus the ISO's whole hash and inode,
verified unchanged after runtime closure. The ISO remains 649,633,792 bytes,
SHA-256 `e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`.

Exact Git patches for both owned commits, relevant foreign/binary diffs,
module/source hashes, actual waits and explicit custody gaps, the selected
welcome PNG and recovery recipe are in the run. The sealed result is written
last. One interrupted intermediate verification could not retain the wait for
its then-current descendant; final published qualification has complete case
receipts and all recorded runtime PIDs were absent at offline audit. Tool PTY
boundaries and the initial interrupted board watcher do not expose separate
stream EOF flags; those are explicitly unknown. No agent, worker, box, Python,
Wine, deployment or held-title action was invoked. Box ID, expiry and stop
receipt are null; state is NOT_CREATED. Ownership is released and the worker
stops after sealing, without further runtime endpoints.
