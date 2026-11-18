# UT GOTY: CLI memory-only handoff prerequisite fails

Evidence: `scratch/runs/20261118-ut-goty-memory-store-install-gameplay/`.
This is explicitly a **memory-only route**. Durable installation remains an
**OPEN, separate outcome**. Genuine UT Setup and the original game were not
launched: the required authored installer/application handoff failed first.
Neither genuine partial disk overlay nor the unique CD1 ISO was written or
copied. No full VFS/media bundle was exported.

The clean published graph is Git
`5dc1e3a489e47bba7a924a19f56efcfe9c26583e`, including payload-reuse commit
`f55de39b8`. Compiling its Git objects in memory produced module SHA-256
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`,
2,418,710 bytes. The CLI and runtime modules were loaded from those exact Git
objects without adopting held worktree changes. Its local test support modules
were separately checked byte-for-byte against that revision. Shared foreign
runtime diffs, including the held timer work, remained unchanged.

The authored ordinary PE installer initially confirmed that its installation
path did not exist. Through CreateDirectoryA/CreateFileA/WriteFile it installed
an embedded ordinary child PE at `C:\MemoryInstall\child.exe` (6,433 bytes)
and `C:\MemoryInstall\payload.dat` (4 bytes). It reopened both through ReadFile
and compared every byte with the embedded originals. That check passed. The
retained manifest records the matching sizes and SHA-256 hashes; only the small
authored inputs/executables and logs are retained, not a VFS snapshot. The child
program is authored to read the installed payload and create a read receipt.

The same installer then used ordinary CreateProcessA, WaitForSingleObject,
GetExitCodeProcess and ShellExecuteA against the installed child. On the public
CLI default, CreateProcessA returned TRUE with handle `0x000e3001`, its wait
returned zero, and ShellExecuteA returned 33. Neither call actually started the
child: its debug/read receipt was absent, the VFS contained no child receipt,
and no emulator child fork occurred. The installer deliberately exited 42 to
report this failed handoff. The enclosing Node process exited zero; that zero
is **not** a successful application-handoff result. There was no crash or
runtime UNKNOWN and no later endpoint/replay/extension.

The missing boundary is concrete. Although `lib/overlay-store.js:10` describes
`memoryStore()` as the default CLI backend, `test/run.js` has no call to that
function. Its overlay attachment at line 6446 is guarded by `OVERLAY_DIR` and
constructs only `nodeDirStore`. Without that option, writes live in the ordinary
volatile VirtualFS, with no attached memory-store journal. The executed process
did not load `lib/overlay-store.js` at all.

Actual ordinary CLI child execution is opt-in through `--spawn-processes` (or an
app's equivalent setting). That transport unconditionally calls
`saveVfsToHost(vfs, inDir)` at `test/run.js:4335`, then starts the child with
`--vfs-tree` at line 4367 and `--save-vfs` at line 4372 before merging its output
back. Those are native disk snapshots, not an in-memory store/session handoff.
Readonly media source-context forwarding does not remove the writable snapshot.
No public option selects a memory-only alternative. This path was audited,
not executed: taking the full snapshot would violate this task's restriction.
No fake filesystem, guest injection, forced callback, extraction, configuration,
registry/save patch, extra memory setting or RAM gate was used.

Thus the bounded cause is a missing supported CLI memory-only application
handoff, before UT admission. This is not a new UT Setup failure or evidence
about its game compatibility. No runtime repair was attempted or published;
native/browser old-fail/new-pass repair claims and a locked code build do not
apply to this documentation-only change.

Install 1200 / total 2400 / final Quit-cleanup reserve 300 seconds were declared
before the authored launch. No UT clock started. The authored control had its
own fixed 30-second CLI cap, 50-second supervisor cap and 60-second cleanup cap.
Its real runtime was 13 batches / 0.031 seconds after loading. The independent
100 ms disk watchdog remained active through preparation, native exit,
supervisor wait, both output EOFs and board-watcher cleanup; its observed minimum
was 1,863,434,240 bytes, above the 1,500,000,000-byte floor. Its independent
finite deadline was not reached. Native supervision recorded no survivors;
all recorded owned PIDs were subsequently absent. Actual prepare, supervisor,
guard and board close/EOF receipts are retained. The terminal tool returned
exit zero for the controller; it does not expose separate stream EOF flags for
that outer boundary, which are not claimed.

Whole-file verification after closure confirmed both genuine disk partials'
indexes and every referenced blob unchanged, including their inodes. The unique
649,633,792-byte ISO remained SHA-256
`e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`.
Recovery/source-mount recipes, exact Git and relevant binary diffs, module and
artifact hashes live in the run. No UT installed manifest or completion,
startup/gameplay images exist because UT was never admitted. The authored
volatile installed state was lost when its CLI process exited; the retained
authored inputs can regenerate it, but it is not a persistent installation.

No browser, agent, worker, test box, Python, Wine, deployment or held-title work
was invoked. Box ID, expiry and stop receipt are null; state is NOT_CREATED.
After publishing this note and sealing `result.json` last, ownership is released
and this task stops.
