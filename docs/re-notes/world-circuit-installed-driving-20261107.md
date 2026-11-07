# World Circuit installed startup: DOS get-date boundary

Run: `scratch/runs/20261107-world-circuit-installed-driving/`.

**Installed v1.03 passed the published BIOS configuration fix, then stopped at
DOS INT 21h AH=2Ah (get system date), before a menu. That generic DOS service
now has a tested implementation. The original game was not rerun after this
correction; Quick Race, acceleration and steering remain unverified.**

## Authentic fixture and exact runtime

All 63 registered `world-circuit-v103` files were size/SHA-256 verified against
`test/toyvm-dos-corpus/files/world-circuit-v103.json` before launch, including
the original installer-written `f1gp.$$$` hardware configuration. GP.EXE is
332840 bytes, SHA-256
`b29f8154cfd435796df01da9e4a0e6209a70613da95f7fd128f5e84edf26bf15`.
The [installation recovery notes](world-circuit-timestamp-install-20261107.md)
and [original media pins](world-circuit-v103-source-20261107.md) apply unchanged.
No installer, media recovery or unchanged DOS/BIOS control was repeated.

The native cooperative ToyVM runner launched the registered installed bytes
with `/c` at `C:\MPS\GPRIX\GP.EXE`, current directory `mps/gprix`, default
devices and clocks. No executable, configuration or guest state was edited.
There was no hardware setup UI or game input in this invocation.

Runtime Git: `fd948930ff9dca10beb624e7ffcd11e570df5412`, with relevant diff and
200 exact runtime/helper/installed-file pins retained. Native module SHA-256:
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`;
generated WAT SHA-256:
`378adbe534e0aa4c1e039f1580a179c5b5023d9440afabdfb08fb78cb6912aec`.
Backend: Node v24.22.1, V8 13.6.233.17-node.58, native ToyVM WASM; no browser.
`retrieved/output/identity.json` and `runtime-pins.json` identify the actual run.

## First actual missing primitive and correction

After 8,342,823 dispatched operations, GP stopped with no CPU fault, missing
file or unsupported opcode. The first unhandled service was `21:2a`, once:

```text
6AAE:7568  mov ah,2Ah
6AAE:756A  int 21h
6AAE:756C  mov [02AA],dl
6AAE:7570  mov [02AB],dh
6AAE:7574  mov [02AC],cx
```

Input AX=2A23, BX=CX=DX=0, DS=5F48, ES=F000. The service returned false,
leaving AX/CX/DX unchanged. The next instructions directly store the requested
day, month and year. Exact call/return trace, registers and disassembly are in
`session-ack-0.json`, `first-boundary-disassembly.txt` and the verified terminal
memory image. The inspected `retrieved/output/installed-start.png` is black;
it is neither a menu nor driving evidence.

The generic implementation returns binary year in CX, month/day in DH/DL and
weekday in AL (Sunday=0), preserving AH and unrelated registers/flags. This is
the [Microsoft MS-DOS get-date contract](https://www.pcjs.org/documents/books/mspl13/msdos/dosref33/).
It derives the date from the existing virtual tick clock and the DOS epoch,
1980-01-01, using the same 55 ms/tick as existing AH=2Ch. UTC calendar arithmetic
avoids host timezone/DST differences. There is no title-specific branch,
injected date or game-private handler. Host wall time does not advance a paused
machine's date; no new checkpoint state is introduced. Set-date and RTC calendar
services are outside this change.

`test/test-toyvm-dos-date.js` fails before the fix on the missing service and
passes afterward in Node and both shipped browser bundles. It checks binary
fields, Sunday numbering, the tick immediately before midnight, month/year
rollover, leap/non-leap February and unrelated register/flag preservation. A
native COM fixture executes INT/IRET and stores the returned date and preserved
carry in guest memory. The mandatory locked build passed. An initial unit-test
register adapter omitted the required interrupt return frame; its TypeError is
retained separately, and the corrected adapter establishes the meaningful
fail-before/pass-after result. No game success is inferred from these tests.

## Recovery, input and lifecycle

`RECOVERY.md`, source commit/diff, owned new-file patches and runtime pins allow
recovery without a source archive. Original media remain referenced by existing
path/hash. Terminal evidence includes the tested module, memory, captures,
commands, logs and the 63 unchanged mounted-file captures emitted by the driver.
All 78 terminal file references (8,382,028 bytes) were retrieved and size/SHA-256
verified, with all 200 runtime pins unchanged, before normal shutdown. The game
PID 5745 was confirmed absent. No DOWN/UP commands were sent; command 0 has an
exact ACK, held keys are empty, and this invocation has no UNKNOWN or replay.
The predecessor's unknown Enter UP remains separate history and was not replayed.

One fresh UUID created **bx_efmdrdgy**, initially expiring
**2026-11-07T23:46:47.052Z**. Launch checked more than 5 GB free on `/home`.
Detached supervisor, normal-stop delegate and observable 25-minute watchdog
were armed before allocation. After verified retrieval, normal stop
**stop_1e58a4ae21d6bf2d** completed at **2026-11-07T23:22:30.765Z**,
`forced:false`. Final state **ARCHIVED**, expiry null. Both delegates exited
zero; supervisor ended with no remaining children. No resume, delete, profiles,
forwarded ports, source archives or public deployment were used.

Next: a separately authorized installed GP run with the get-date implementation,
then the ordinary startup/Quick Race controls from the original README/manual.
Actual acceleration and steering response still need reviewed screenshots;
passive scene motion, gameplay parity, FPS and audio quality are not established.
