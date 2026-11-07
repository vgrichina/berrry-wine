# World Circuit v1.03: authentic installation completed, BIOS query next

Run: `scratch/runs/20261107-world-circuit-timestamp-install/`.

**The original Full Installation completed. Installed GP.EXE stops before Quick
Race at BIOS INT 15h AH=C0h. That generic service now has a tested implementation;
the original game was not rerun after the correction. Driving remains unverified.**

Predecessor `87101594a` was published and terminated before this invocation.
Its unacknowledged Enter UP remains UNKNOWN and was not replayed. This fresh
invocation was separately authorized. Previously passed original FAT12, drive,
path, child EXEC, handle-reuse and timestamp controls were reused.

## Authentic installation and preserved payload

Runtime Git was `87101594a5903d4569de0dab26928537eb53d7f3`, with relevant uncommitted
hunks and 140 exact source/helper/media pins retained. Native module SHA-256:
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`;
Node v24.22.1, V8 13.6.233.17-node.58. Default devices and clocks were retained.
The [original media pins](world-circuit-v103-source-20261107.md) and
[floppy controls](world-circuit-floppy-mount-20261107.md) apply unchanged.

Original INSTALL.EXE ran from genuine A: disk1. Ordinary keys selected Full Game
Installation, A:, and `C:\MPS\GPRIX`. The original requested disk B at 32% total
and disk C at 70%; only then were original DISK02.IMA and DISK03.IMA inserted
into A:. The reviewed `copy-disk-c.png` shows **Hard Disk Installation SUCCESSFUL**.
Original hardware setup retained default PC speaker; reviewed `hardware-confirm.png`
shows **Configuration File Written**. No source rename, payload synthesis,
guest patch, direct config edit or installation bypass was used.

Actual active C: outputs comprise 63 files, recorded in
`installed-active-hashes.json`. Entry and launcher:

| File | Size | SHA-256 |
| --- | ---: | --- |
| gp.exe | 332840 | `b29f8154cfd435796df01da9e4a0e6209a70613da95f7fd128f5e84edf26bf15` |
| full.bat | 55 | `efc984c7678faf142a57530df1e2a4b0f09aaf4576929e2372e8096db3553551` |

`full.bat` runs `playscr test.scr xintro.bin 0+`, then `gp /c`. The native probe
launched actual installed GP.EXE with `/c` at `C:\MPS\GPRIX`; no executable
bytes or configuration were modified. The corpus registers `world-circuit-v103`
with that entry and all 63 active installed files, explicitly without gameplay
qualification. Hashes and RECOVERY.md were recorded before registration.

The output capture helper retains historical files after guest deletion.
MPSLABS.IDX and MPSLABS.$$$ were absent from the final guest tempFiles map;
they remain in evidence but are excluded from the registered corpus. The initial
GP probe mounted the retained 65-file directory, including those two historical
files; `output3/installed-inputs.json` records that exact set. No missing-file
failure occurred at this boundary. A live memory download changed while later
installer commands ran: the mismatch is retained, with no command replay.
Every installed file verified, and a separately named terminal memory image
was subsequently retrieved and verified after the driver stopped.

## Exact next emulator failure and correction

GP dispatched 8,326,052 native operations, then stopped on its first unhandled
service, with no CPU faults, missing files or injected game input:

```
6AAE:77B9  mov ah,C0h
6AAE:77BB  int 15h
6AAE:77BD  mov al,es:[bx+5]
6AAE:77C1  test al,10h
6AAE:77C3  jnz 77CE
6AAE:77C5  mov byte ss:[08B7],1
```

Input AX=C003, BX=4CDE, CX=0000, DX=0003, ES=0108. Service returned false;
AX and BX were unchanged, and `unhandledFn` recorded `15:c0` once. No BIOS
success/error result was implemented, so the old trace's live flags do not
establish a guest return CF. The preceding DOS calls selected C:, obtained its
current directory/DTA and DOS version, and returned normally; exact arguments
and returns are retained in `session3-ack-0.json` and `output3/first-boundary.json`.
The reviewed `native-gp-start.png` is black, not a menu or driving frame.

The caller immediately reads feature byte 1 and tests bit 4, the keyboard
intercept feature. The generic BIOS correction installs an AT-compatible
configuration table at F000:E6F5, length 8, model FC matching F000:FFFE,
feature byte 60h (cascaded PIC and RTC), other feature bytes zero. It returns
ES:BX, AH=0, preserves AL and clears carry in the saved IRET flags. It does
not advertise a keyboard intercept, DMA3 disk transfers, external-event wait,
EBDA or MCA. This follows the system configuration table / INT 15h C0h contract
in Phoenix's [System BIOS technical reference](https://bitsavers.org/pdf/ibm/pc/ps2/bios/System_BIOS_for_IBM_PC_XT_AT_Computers_and_Compatibles_198908.pdf).

`test/test-toyvm-bios-config.js` failed before the fix and passes with Node and
both shipped browser bundles. A real native DOS fixture executes INT/IRET,
reads the returned table and records the saved carry/status/pointer in guest
memory for assertions. Existing floppy/handle/timestamp/child EXEC/checkpoint
controls and the mandatory locked build passed. Corpus generation/check and
focused corpus regression were also run; logs are retained. No original-game
success is inferred from the fixture.

## Recovery, input and lifecycle

RECOVERY.md names the original media, exact Git SHA plus patches, runtime pins,
actual installed bytes and active-file hashes. Corpus payloads under
`test/binaries/dos-games/world-circuit-v103/MPS/GPRIX` are hardlinks to verified
installed evidence bytes; no source or media archive was created. Git remains
the source archive. Reconstruct the active 63 files from retained outputs and
verify hashes before using the corpus. Keep the stale setup files only as evidence.

Installer commands 0–29 and game command 0 all have exact ACKs. All nine Enter
presses have independent UP acknowledgements, final held keys are empty, and
installer quit command 29 was acknowledged. The game probe used no keys.
The terminal inventory verified game PID 9345 absent; the installer had already
acknowledged quit. Fresh invocation UNKNOWN count
is zero; the predecessor's UNKNOWN remains unchanged.

One fresh UUID created **bx_c6u9fekt**, initially expiring
**2026-11-07T23:35:02.218Z**. Detached observable 25-minute watchdog and normal
shutdown delegate were armed before allocation; launch checked >5 GB free.
All 272 terminal file references (47,398,870 bytes) were retrieved and SHA-256/
size verified before delegated normal stop **stop_f6c8618ae24d9890**, completed
**2026-11-07T23:15:59.367Z**, `forced:false`. Final state **ARCHIVED**, expiry
null. Both delegates exited zero and supervisor ended with no remaining child.
No browser profiles, ports, resume, delete or public deployment were used.

Next: a separately authorized installed GP run with the generic BIOS configuration
service, then ordinary startup/Quick Race/Main Menu controls and reviewed
accelerating/steering evidence. This bounded task ends at the exact traced
BIOS failure with its tested generic correction.
