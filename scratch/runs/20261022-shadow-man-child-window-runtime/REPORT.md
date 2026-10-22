# Single original attempt: child module and window call; visible UI unproved

**CHILD_MODULE_AND_WINDOW_CALL_CAPTURED; STOP_BOUNDARY_BEFORE_VISIBLE_UI.**
The one original Setup attempt ran on the assigned bx_495585da at
2026-10-22T19:15:11–19:15:15 UTC. Both normal children actually forked,
executed the inherited guarded observer, instantiated the historical module,
and ran guest APIs. The unchanged observer stopped the installer at its first
nonzero-command ShowWindow return. Its child-owned PNG was inspected: **a
640×480 solid teal canvas, with no visible installer window, text or dialog**.
This is real child capture evidence with a precise visual limitation, not a
successful visible installer screen. No second attempt or harness expansion.

## Process and window evidence

| Role | Node PID | Guest PID | Actual evidence |
| --- | --- | --- | --- |
| Original Setup parent | 54020 | main | module instance, two real forks, WinExec returns 33/33, Node exit 0 |
| Installer `_INS5576._MP` | 54028 | 4004 | preload, module instance, Setup window creation, ShowWindow return, PNG, Node exit 1 |
| Cleanup helper `C:\_ISDEL.EXE` | 54035 | 4008 | preload, module instance, guest ExitProcess(0), Node exit 0, PNG |

Installer image is 557056 bytes, SHA256
`a8657371f03e2e66db951c3dcd3aeb42c576894908ca2eb1b3806aa0404cb083`.
Helper is 27648 bytes, SHA256
`b5dc0feb738a91ce3cfa982647fe2779787335c6c2c598d5b49818565d7c3e84`.
Per-process argv, real ticks, temp environment and inherited preload are in
`exit.json`, `raw/command.json`, and each PID-owned JSONL. Each real fork row
pins the historical module hash. Module-instance imageBase=0 is sampled at
instantiation before executable loading; subsequent guest API calls and
instruction addresses establish that the original child executed.

Installer CreateWindowExA created `InstallShield_Win`, title `Setup`, returning
HWND65537, then `ISINSTALLSCLASS` with `C:\SETUP.INS`, returning65538. Later it
created `ISBarCls`, title `Bar`, HWND65544 (style1073741824, a child control).
ShowWindow(65544,5) returned0. That return means previously hidden, not failure.
The inherited observer immediately wrote stop-request.json and a child PNG,
then threw its intentional `authorized first-boundary stop` exception. The
runner labels this exception CRASH at batch6156, EIP0x0045971d. It is a
diagnostic stop, not a discovered emulator trap or installer incompatibility.
The first shown control is insufficient to establish a visible top-level UI;
that is the precise limit of this authorized observer/run. No error dialog
was observed. Earlier LoadLibraryA return0 rows are retained, but the guest
continued to window creation; no unsupported fatal-cause attribution is made.

Installer Node exit callback records1; no installer guest ExitProcess occurred.
Helper guest ExitProcess argument0 and Node exit callback0 are observed.
The external supervisor reaped parent OS status0. Child OS wait statuses/signals
were not independently reaped by the supervisor; Node callback codes are
reported separately. Both child-owned PNGs are blank and byte-identical.
The inspected parent PNG shows Shadow Man/InstallShield preparation only and
is never substituted for child evidence.

The external process-group bound was 60 seconds; measured aggregate elapsed
**3.967719863 seconds**, reason first-child-show-window, PGID54020. It allowed
normal cleanup/export semantics while terminating only the owned group, then
confirmed no live member. Handback independently confirmed the group absent.
The parent and children inherited --real-ticks and explicit
ShowWindow/UpdateWindow/ExitProcess trace flags through --pipe-child-args;
the first and sole max-seconds option was55. Full exact command/environment
are retained. No input, licence Accept, selective helper suppression or retry.
Runner merge rows were 0 writes/81 deletions/0 keys for diagnostic-stopped
installer, then 0 writes/0 deletions/70 keys for helper; these are callback
results, not installation success. Existing parent-lifetime child cleanup
was preserved; no premature-parent-exit blocker was established before capture.

## Bounds, identity and preservation

Coordinator authorization is `allocation-authorization.json`. Actual findmnt
and statvfs confirmed the existing mount is tmpfs, **419430400 bytes (400MiB)**.
Fixed active files: 85024432 logical / **85536768 allocated bytes**, below96MiB.
The authorized ceiling remains96MiB fixed +400MiB quota +16MiB reserve =
**536870912 bytes (512MiB)**. Actual fixed allocation + hard quota + reserve =
**521744384 bytes**. This concerns accounted runtime filesystem allocation,
not a 512MiB RSS/wasm-memory ceiling. New diagnostic scripts/logs are physically
inside tmpfs and counted by its quota. All mutable parent/recursive-child VFS,
registry, logs, PNG, cwd and TMPDIR/TMP/TEMP use the same quota. Original media
remain outside ingestion/quota; no fixed ports or guest-page-stats were used.
Unchanged 243 pins and source predicates reuse the predecessor's accepted real
fork/temp/socket inheritance fixture. No offline gate was rerun.

Peak sampled quota use **152092672 bytes**; exact between-sample high water is
unknown and bounded by the actual419430400-byte hard quota. Complete output.log
is131063 bytes, sealed before retrieval; it contains **zero ENOSPC**, no parent
launch failure or authority deadline. This claim covers the complete captured
log, not hypothetical later execution. No memory/compatibility success claim.

All **243 pins passed before, after and at handback**. Reviewed host
`13bb92cd2e1bc060ff908722843d1e97a439b1a4`, candidate30bdd15, source0a130dc,
retained closure `a0236c978074ece58495c9eab7db6168e27e71b4`.
Historical module1878971 bytes SHA256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`;
original Setup SHA256
`5656e87da0641c9dcfcd0ee8949ce72b3fa6a7d0e8b1fd985a16f6bd6c34ce52`.
This tests historical-module compatibility, not a new canonical compilation.
Observer SHA256
`66197d9fe2d83d51e646c596ef747694f8faecc9b6e5b489cd1404fb842d2fad`;
only OUT pathname changed from predecessor guarded observer. ROOT and every
instrumentation mechanic were retained and byte comparison verified.

Before reclaiming old tmpfs, all **115 files/75048974 bytes** were copied
normally into recovery and every hash compared, then source rechecked before
removing only those old tmpfs copies. The earlier93-file inactive copy was
preserved untouched. The partial predecessor export is not a full source.
New attempt **101 files/76434347 bytes** was also copied normally and all hashes
compared, leaving new tmpfs intact. Final recovery allocation1029808128 bytes
<2147483648; conservative cross-device projection1030823936. Host free
48026771456 bytes >2982150144 floor. All guest payloads stayed remote; only
830318 bytes of root diagnostic files were retrieved, no binary/archive payload.

No production/source/authority/thread-manager/runner edits, compilation,
download/recovery/repack, public deployment, laptop action, merge, fetch,
new compute, other worker, input or lifecycle mutation occurred. Local whole
allocation and protected root/donor Git seals are recorded in the bundle.
One local inspection `tail` invocation failed due to brace-expanded multiple
files; JSON inspection replaced it. No effect on run. Publication uses the
known tree-preserving evidence-only commit method to avoid unrelated absent
blobs; no forced push or implicit fetch.

Counts: **1 original attempt; 2 forks; 2 child preloads; 2 child module
instances; 1 installer nonzero ShowWindow boundary; 2 child PNGs; 0 visible
child UI proven; 0 retries; 0 workers; 0 lifecycle mutations**.
Evidence-only verifier includes3 rejection controls. Box left **RUNNING**,
API idle/health ok/stop null, expiry2026-10-22T20:13:56.453Z. Coordinator owns
shutdown19:50 UTC; ownership handed back before19:40. Task ends here.
