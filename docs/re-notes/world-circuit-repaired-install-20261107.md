# World Circuit: repaired original installer reaches file timestamp service

Run: `scratch/runs/20261107-world-circuit-repaired-install/`.

**Installation remains incomplete. No installed corpus entry, Quick Race or
driving is verified.** This bounded run passed the preceding handle-reuse
failure, then stopped at a new generic DOS service gap. That service now has a
tested implementation; the original installer was not rerun after this fix.

The preceding worker published `9b6361644` and terminated before this worker
started. The original [source/media pins](world-circuit-v103-source-20261107.md)
and [passed floppy/path/child EXEC controls](world-circuit-floppy-mount-20261107.md)
were reused. Runtime source was Git
`9b6361644b8ba9e30794e9f03a5f7f7bfcfc4f75`, with the relevant diff and 140 actual
runtime/helper/media hashes retained in the run. Native module SHA-256 was
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`;
Node v24.22.1, V8 13.6.233.17-node.58. Default devices and clocks were retained.

## Authentic installation and exact next failure

Disk 1 was mounted as genuine A:. Ordinary keys selected Full Game Installation,
source A:, and the original default destination `C:\MPS\GPRIX`. No source files
were renamed into C:, synthesized or patched. INSTALL created the directories
and EXEC'd original MPSCOPY. The child now opened the installed master index
with handle 5, below its CRT's limit 20, and began decompressing `F1GP.001`.
No later disk prompt appeared, so no disk change was performed.

The first unpacked asset, `ACREDIT.BIN`, received six writes of 4096 bytes and
one of 2887 bytes: 27463 bytes total. The preceding open returned handle 8 and
each write returned its requested count. The next call was:

```
guest return address 21AC:05D7
INT 21h AX=5701 BX=0008 CX=3621 DX=0036
service result false; unhandled 21:57; AX remains 5701
```

Retained boundary memory disassembles at 21AC:05C6 to argument loads into BX,
CX and DX, `mov ax,5701`, then `int 21h` at 05D5. This is the file timestamp
setter, not another file-open failure. No guest DOS success/error return was
implemented for it. The trace's `flags` field records live CPU flags rather
than saved IRET result flags; it must not be interpreted as observed return CF.
There were no CPU faults or other unhandled services. The reviewed screenshot
shows authentic installer streaming progress, not gameplay.

Six commands (0–5) received exact ACKs. Command 5 reported a closed boundary;
the pinned driver then released all held keys and exited. An already queued
independent Enter UP command 6 received no ACK because that driver had exited;
its outcome is recorded UNKNOWN, with no replay or further input. The terminal
inventory verified PID 7173 absent. This run does not claim a clean all-ACK
input sequence.

## Generic correction and tests

DOS AH=57h now gets and sets packed last-write time/date on open files, reports
invalid selectors (AX=1) and handles (AX=6), and denies timestamp mutations on
read-only floppy volumes (AX=5). Metadata survives close/reopen, shared handles,
directory searches and native checkpoints. Existing immutable FAT handles retain
their original disk metadata across disk changes. A timestamp-only edit of a
host corpus file creates a guest overlay and preserves the host bytes. Unstamped
C: files retain the existing deterministic FindFirst date/time defaults.
The contract follows Microsoft's [MS-DOS Encyclopedia, Function 57H](https://www.pcjs.org/documents/books/mspl13/msdos/encyclopedia/section5/).

The new regression failed before the fix. Final checks passed in Node and both
shipped browser bundles, including the exact observed timestamp arguments, error
returns, close/reopen, shared handles, read-only media and immutable host files.
A real native DOS child writes a file, sets its timestamp, closes it and exits;
its timestamp survives checkpoint restore. Original-media hashes, existing DOS
file/device, path and rename tests, native machine checkpoint checks, and the
mandatory locked build passed. Exact logs are retained in the run.

## Preserved outputs, recovery and lifecycle

All six partial C: files are retained with SHA-256/size inventory in
`partial-output-hashes.json`. Four setup files match their original FAT sources;
`MPSLABS.$$$` matches original packed `F1GP.001`. The newly unpacked asset is:

```
ACREDIT.BIN 27463 bytes
5fe1b3c900871a695131181aedc7ddf2cd08cfb88448c22a581a725f055d8d28
```

No GP.EXE exists in these outputs, so no installed entry was registered.
`RECOVERY.md` records the source commit, patches, runtime pins, original image
paths and retained unique outputs. Git remains the source archive; no source
or media archive was created.

One fresh UUID created **bx_8r3hm8cv**, initially expiring
**2026-11-07T23:28:01.683Z**. Detached observable 25-minute watchdog and normal-stop
delegates were armed before allocation; launch checked >5 GB free. All 42 terminal
file references (5882154 bytes) were retrieved and hash/size verified before
normal stop **stop_6b40886e85acc8d2**, completed **2026-11-07T23:04:01.028Z**,
`forced:false`. Final state **ARCHIVED**, expiry null. Both delegates exited zero;
supervisor ended with no remaining child. No ports, browser profiles, resume,
delete or public deployment were used.

Next: a separately authorized original installation run with AH=57h implemented,
following only its disk prompts; hash actual completed entry/support files and
record recovery before corpus registration, then use original UI for Quick Race
and accelerating/steering evidence. This task ends at the traced failure and
tested generic correction.
