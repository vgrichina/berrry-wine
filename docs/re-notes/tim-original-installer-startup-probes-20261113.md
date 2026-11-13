# TIM original INSTALL.COM startup probes — NO_NATIVE_RESULT

The original installer has a reachable **DOS FCB file-search boundary**, not a
demonstrated fatal BIOS/input/hardware gap. Its first ordinary menu uses text
mode 3 and INT 16h scan codes. The relevant BIOS services already have handlers.
No production code was changed: FCB search is a file-service boundary outside
this task's narrow input/hardware repair condition. It must be addressed or
measured before calling the entire installer path supported. No native installer,
screen, installed configuration, game or L1 result is claimed.

Evidence: `scratch/runs/20261113-tim-installer-probes-1640/`. Read alongside the
[original DOS launch contract](incredible-machine-original-dos-launch-contract-20261113.md)
and `scratch/runs/20261113-tim-bios-palette-1600/README.md`. Prior MZ, EXEC, CD,
bitmap and palette WIP remains untouched. Final HEG identity palette equivalence
still holds; this installer path provides no new reason to add video features.

## Bytes and address convention

Only the borrowed image's 30830 original INSTALL.COM bytes were read, via
read-only `pread` calls over its already recorded FAT cluster list, trimming the
last cluster to EOF. SHA-256 was verified again:
`a2a609fa8aab61e950c00e3b59f98edf03a26ff183665eb813a3a60b94cfa531`.
The borrowed image remains `/dev/shm/wine-owner187-tim-disk.img`; its inherited
full-image SHA-256 is
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.
This task did not reread/hash the entire image, extract the archive, copy media,
or read another original resource. All 104 predecessor seals from the static0910
and BIOS1600 manifests passed, including BIOS1600's current source hashes.

Every offset below is a COM **file offset**. At ordinary PSP:0100 entry, CALL at
0 pushes 0103h; POP AX / SUB AX,3 leaves 0100h, so JZ at 7 is not taken.
Files 9..13 push CS+10h and IP=0014h and RETF. The resulting code segment is
PSP+10h: internal offsets now equal file offsets. At 14..21, DS=SS=that segment,
ES=PSP; CS:00cf stores the segment. PSP command-tail scanning at 23..50 checks
for `m`/`M` and sets 6285 if found. We neither supply that switch nor use its
manual hardware-selection bypass as evidence for ordinary detection.

At 61..76, SP=9830h and BX=(9830h+0110h)>>4=0994h; AX=4A00h/INT21 resizes
the PSP allocation. Its carry is not checked. CALL79→00ee enters Smart Start.
This is ordinary original code, not a packed COM entry or a guessed menu entry.

## Ordered startup and hardware decisions

| Reachable call site | Exact dependency and branch |
| --- | --- |
| 00f6→5c58 | Open literal `INSTALL.COM` through 45e7 (DOS3D); seek/read its last four bytes through 4638/44b5 (DOS42/3F), require `RES:`, then read preceding DWORD=7840h and seek there. Open/signature failure returns zero; 00fc→03fc→00c8 exits. This is an actual early file requirement. |
| 5ce1 onward | Read NUL title into7811, split `TIM.EXE` into stem7802 and extension pointer7800. Read metadata into65a0..65a2 and659c. Original metadata is disk count1, graphics mask02h, sound maskFFh, then bytes `00 35 0c 00`. Probe optional `VOLUME.001` (template65c7); missing file is accepted. No game resource volumes are opened here. |
| 011c→45e7 | Open `RESOURCE.CFG`. Missing-file branch015b sets both previous selections73f2/73f3 toFFh and continues. Present file gets two one-byte reads and close; startup does not require a hand-authored CFG. |
| 0167→11ad→112d | Sound detection unless original manual switch6285 is set. MaskFFh enables candidates. Results only mark/filter choices; lack of a device is not a return-to-DOS branch. |
| 0172→1917→15ee | Initial request (3,4), then ordinary VGA candidate (8,80h) at198a. 15ee indexes mask table62f2, samples BDA equipment bits via1868, and calls1633. Initial mask04h may probe CRTC3D4/3D5 and model bytes via1880; VGA mask80h reaches1666: AX1A00h/INT10. ToyVM returns AL1Ah/BL08h; 16a5 accepts BL08h, 169f returns8. Thus candidate1994..197c marks choices. Lower candidates at199e onward are fallbacks when VGA detection fails. |
| 0186→4009; 0189→156a | Allocate a 2000h-byte buffer through DOS48; install INT24 critical-error handler through DOS35/25. Neither is a new video feature. |
| 018c→432a; 0193→4408; 0197→48df | Set mode3, display page0, cursor shapeFF00h, query current mode and fill text memoryB800 directly. 48df is text fill, not a mouse reset. |
| 019e→46cb | DOS19 gets current drive; DOS47 gets current directory into73f4. |
| 01a6→353a | Original disk/file-search probe described below. Drive scan01bc→46f3 uses DOS36 for drivesC: onward; first two iterations return0 directly. Missing drives terminate/filter the scan, not installer execution. |
| 0257→1bef; 025a→13b3 | Compact marked graphics/sound choices. No input occurs in these filters. |
| 0280→05d6 | With second argument0, construct current-directory TIM.EXE path and DOS3D-open/close it (066f/067e); absence returns0 at068d, affecting a menu item. The later interactive branch0691 requires a nonzero second argument and is not this startup call. |
| 02b0→0f22 | Draw Smart Start menu through095a and0dca; then0f8f→4336 performs first ordinary blocking keyboard read. |

Sound details: 112d tries 14cd (38A/38B timer), 1440→5e7a (SB base scan
220h..260h then210h), 1483 (388/389 timer), 1125→4b0b (330/331),
1557 (INT15/C0 table), and1517 (model bytes, conditional INT15/C0).
1440 changes **in-memory original code** at5e98 to `b8 00`; the third byte is
already00, replacing the final CALL with MOV AX,0 for this probe. This is the
installer's own instruction, not a host patch. CPU/code-cache coherency across
that store remains unexecuted. SB startup uses bounded helpers5dd6/5df4 and5f28;
unbounded siblings5e13/5e28 are not called by the inspected detector. The MPU
path also has an ordinary DOS2C time wait4b32..4b3f, whose progression needs
runtime confirmation if that branch is entered. Negative probes feed selection
bits and fallback choices; no proof supports making every device present.

## Exact FCB boundary before the menu

353a builds a stem-derived wildcard, calls33be withFFFFh to fill wildcard
positions, resets disk state via4730/DOS0D, and calls47df with search attribute0Ah.
47df→4771 builds an **extended FCB** at6486: FFh prefix, attribute byte648c,
drive648d, eight-byte name648e and three-byte extension6496. It searches attribute08h
first, then02h if needed. The actual first wrapper is446e:

```
4473  mov ah,1Ah; mov dx,645Ah; int21h   ; output DTA
447a  mov ah,11h; mov dx,6486h; int21h   ; FCB FindFirst
4484  xor ah,ah; ret                    ; caller consumes AL
```

DOS `int21Call` has neither AH11h nor AH12h; both return false without register
or DTA mutation. 4487 contains the adjacent FCB FindNext wrapper, but startup
353a calls FindFirst only. Existing DOS4E/4F searches are a different interface
and cannot be cited as support for this FCB call. Five pure prototype tests
confirm the actual handlers, including unchanged registers for11/12 and a
supported empty keyboard read that sets `blockedOnKey`.

For this first call4771 leaves AX=0003h after the three-character extension
loop. Setting AH1Ah then11h preserves AL03h; an unhandled IRET therefore returns
03h, not a DOS FCB result. 35de tests that nonzero and returns0 at35e4, rather
than taking48a0's DTA attribute read. Main uses this result to hide/filter its
disk-dependent copy/backup choices at01fd..021d. It does **not** exit and does
not prevent the ordinary text menu/input path. This is a demonstrated file
compatibility gap; a fatal startup blocker would be an unsupported inference.

A future FCB repair needs genuine extended-FCB attributes, wildcard/drive
handling, FCB-format DTA results and AL00h/FFh status, plus independent
first/next search state. Do not route the existing4E result buffer to this
caller or hardcode a TIM result. This task did not claim/edit dos.js because
no missing input/hardware handler was demonstrated.

## First reviewable dependency and remaining boundary

Menu draw0dca uses text primitives43aa (INT10/AH02 cursor, AH09 character and
attribute) and direct text stores through491a/4991/4a15. 4336 issues
INT16/AH00, saves returnedAX at6456, and returns the **scan code AH** inAL.
0f9f..10ed dispatches scan codes for Escape, Enter, Tab/Down/Space, Up and
number keys. No mouse service is required by this inspected first menu path.
An empty key queue is an ordinary wait, not evidence of missing hardware.
No keys, menu answers, configuration or guest state were injected.

After a real user Play decision, the earlier launch contract still applies:
main success returns through0080, constructs TIM.EXE, shrinks again and calls
DOS EXEC at00c3..00c6. This task did not execute that branch or the LZ91 child.

Reproduction uses `trace.py`'s explicit named ranges (recorded in code-bytes.json),
`check.py` and `prototype.test.js` in the run directory. The final byte check
verifies 33 slice hashes,16 direct CALL targets,16 rejected call-displacement
mutants,12 exact byte pins and104 predecessor seals. Prototype tests pass5/5.
They instantiate no Machine and run no CPU/VM/WASM/guest. An initial test import
path error was corrected before the final passing run. Source provenance is
exact Git plus relevant binary diff and full patches for new helpers/document;
there is no source archive. Docs-only validation is diff-check and strict
pull/push. Every analysis/test process had GNU timeout TERM30s/KILL+2s armed
before execution; no persistent runtime watchdog or box was created.

Next actionable work is the FCB file-service boundary and, under a later runtime
assignment, ordinary read-only floppy/writable-C installation with real user
choices, self-modifying-code coherency, first text-screen/input capture and
installed-output hashes. Current evidence supports static calls and prototype
responses only. Box **NONE**, state **NOT_CREATED**, expiry **null**, stop receipt
**N/A**. No network/media staging, full image copy, build, native installer,
browser, screenshot, game, worker or box operation occurred.
