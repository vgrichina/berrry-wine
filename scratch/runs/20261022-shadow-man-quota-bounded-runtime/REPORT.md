# Shadow Man: authority deadline before normal child fork

**BLOCKED_NAMED_EVENT_AUTHORITY_BEFORE_FORK. One original Setup attempt,
zero observed forks, zero child preloads/loads/screens/exits.** The first concrete
blocker is the real launch error at raw output byte offset 57914:

```
[spawn] ShellExecute "C:\WINDOWS\TEMP\_ISTMP1.DIR\_INS5576._MP" failed: Authority deadline exceeded; operation outcome unknown; client is unusable
```

Parent PID 32431 loaded original Setup (PE entry 00407b43), extracted
`_INS5576._MP` (557056 bytes), zdatai51.dll and _wutl951.dll, and called WinExec
for that payload. The unchanged observer records **WinExec EAX=0**, followed by
MessageBoxA `Setup Initialization Error`, text ending `Error 111`. Its visible
text says insufficient memory; this is the parent installer interpreting launch
failure, not proof of host or guest memory exhaustion. The inspected
[parent PNG](raw/parent-32431.png) shows that error above the original preparing
InstallShield dialog and splash. It is explicitly **parent evidence**.

`namedEventEnvironment()` is evaluated before the call to `fork()` in the exact
runner. The real observer fork wrapper has zero fork rows, there is only the
parent preload/module instance, and external /proc samples show only PID32431
in the guest process group. Thus no child startup is established. The observer's
process_spawn wrapper does not capture the shell route; absence there is not
used as proof. No return33/readiness claim, fake callback or substituted screen.
No child merge callback ran. The exact underlying authority-worker exception
was not retained; root cause beyond the explicit deadline remains unqualified.

The retained observer is an unconditional Node preload that exclusively opens
`parent-${process.pid}.jsonl`. The named-event authority creates a Node Worker
without overriding execArgv and suppresses its error event. A same-PID preload
collision is therefore a source-level concern, **not an experimentally verified
cause in this task**. No observer repair, extra fixture, harness expansion or
second guest attempt was made.

## Bound, identity and termination

Actual tmpfs type and exact 150994944-byte/16384-inode quota passed. Fixed active
files/directories measured **85024432 logical / 85536768 allocated bytes**, below
100663296. Even the larger allocated value plus the full hard quota and untouched
16777216 reserve totals **253308928 < 268435456 bytes**. Actual quota peak/final
use was **106459136**, leaving **44535808**. Raw log has **zero ENOSPC**. This
was not storage exhaustion and no cap was enlarged. Ordinary full-write ENOSPC
enforcement is reused from the coordinator's recorded successful fixture; this
task verified the actual mount and cheap real Node fork inheritance.

See [mutable-paths.md](mutable-paths.md) and [preflight.json](preflight.json).
All mutable outputs, inherited temp paths, sockets, cwd defaults, parent full
VFS/registry exports and observer files were confined to the same quota. The
quota itself was not ingested into parent VFS. No payload omission, sparse
write, truncation, altered exporter, fork-depth assumption or transport change.

The exact [command/environment](raw/command.json) uses first/only parent
`--max-seconds=55`, parent and recursively inherited real ticks and explicit
ShowWindow/UpdateWindow/ExitProcess tracing, no fixed ports or guest-page-stats.
External aggregate watchdog owns process group32431, TERM by58s/KILL by59s,
and includes all descendants. Actual OS parent exit **0**, elapsed
**56.3711265 seconds**, remaining owned live processes **0**. The runner stopped
at its 55s limit (raw byte30148130); guest ExitProcess was not observed. OS0 is
not installer success. Guest exit code and child OS/guest exits are unknown.

The first parent launch error was identified during post-run log inspection.
The retained observer stops at child boundaries only; the external watchdog
did not detect this parent error immediately and the parent continued until
its 55s bound. This limits the requested first-error stopping behavior; it did
not trigger a retry or a longer run. All output was retained without truncation.

All **243** pinned staged-runtime/codec/original/support files match pre/post.
23 originals total73339636B; Setup73728B SHA256
`5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`.
Historical module1878971B SHA256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
Reviewed host13bb92cd2e1bc060ff908722843d1e97a439b1a4, candidate30bdd15,
source0a130dc; closure a0236c reused. This is new-host/old-module compatibility,
not source-equivalent canonical compilation. Main324cc4f was not modified.

## Evidence, cleanup and handback

Full raw output **30158569B**, SHA256
`3d22cf623165fa5005d57c539fed79575e8315cc81093eeb717ed30b4e2303a0`,
is preserved locally and remotely. Retrieval used bounded chunks; hashes and
offsets are recorded. Local evidence includes exact parent preload/WinExec/
MessageBox trace, both matching PNGs, full registry, export manifest, API
receipts, command, process observations and allocation/seal receipts. The
remote parent full VFS retains **80 files/75603833B** including generated
payloads; no binary/media was retrieved locally. See [RECOVERY.md](RECOVERY.md).

Attempts: original Setup **1**, forks **0**, child preloads **0**, guest input/
licence Accept **0**, retry **0**, acquisition/recovery/build **0**. Two incidental
inspection errors are disclosed: a local attempt to read an intentionally
unretrieved large log before chunk retrieval, and one handback Python syntax
error corrected before any cleanup ran. Neither reran the guest. No source
edits, merge, deployment, laptop, agent/worker or compute lifecycle action.

Owned process group is clean. Fixture temporary directory alone was removed;
runtime evidence, exported VFS, originals, module, support and inert ISO remain.
Box **bx_495585da** is left **RUNNING** (API idle, health ok, stop null), expiry
**2026-10-22T20:13:56.453Z**. Coordinator owns shutdown19:50UTC and receives
handback before19:40. No stop/delete/resume/new/fork command was issued.
Task is complete at the concrete blocker; no replacement task or retest.

Publication encountered one local Git failure: the focused donor lacks an
unrelated apps/abe.md blob, so normal git commit could not build its full tree.
The immediately following push initially published only unchanged base a0236c
on the new task branch. Evidence was then appended using tree plumbing that
preserves every existing subtree ID; no missing blob was fetched and the remote
branch was advanced normally, without force. This was a publication error,
separate from the two disclosed inspection errors and the one guest attempt.
The Ops artifact containment check has zero errors/missing artifacts; its one
schema exclusion is intentional null candidateId for unregistered Shadow Man.
