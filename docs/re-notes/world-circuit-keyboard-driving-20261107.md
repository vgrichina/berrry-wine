# World Circuit: installed keyboard acceleration and steering verified

Run: `scratch/runs/20261107-world-circuit-keyboard-driving/`.

**The installed original consumes keyboard make/break scans after the generic
BIOS intercept fix, and visibly accelerates and steers.** This fresh run used
published fix `6522e9c49`; it does not reinterpret the predecessor's passive
motion or its predecessor's UNKNOWN command.

## Original route and identity

Runtime Git: `3607950b45c2921e3d956ca2ba821138fe029569`, with an empty
`relevant-source.patch`. All 200 runtime/media/driver pins passed before and
after execution. All 63 registered installed files matched
`test/toyvm-dos-corpus/files/world-circuit-v103.json`, including `f1gp.$$$`.
GP.EXE SHA-256 remains
`b29f8154cfd435796df01da9e4a0e6209a70613da95f7fd128f5e84edf26bf15`.
No installation, recovery, asset substitution, guest/config edit or private
handler invocation was performed.

The native cooperative runner invoked `C:\MPS\GPRIX\GP.EXE /c`, current directory
`mps/gprix`, with default devices and clocks. Node v24.22.1,
V8 13.6.233.17-node.58; native module SHA-256
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`,
generated WAT SHA-256
`378adbe534e0aa4c1e039f1580a179c5b5023d9440afabdfb08fb78cb6912aec`.

Reviewed original captures show the ordinary sound-error dismissal, English
manual challenge (printed page 137, paragraph 1, line 1, word 9), accepted
`accompany`, STARTUP MENU, Quick Race, Keys selection, Phoenix overview and
cockpit. The authentic retained manual PDF and its printed page 137 were
checked before normal typing. `manual-reference.json` records its existing
path, source URL and SHA-256
`61ca7d846d7016a7b522107b04c879e36da4d043bd2a12362ad3ef7ccaff854b`.
Its printed page 14 documents A/Z and left/right angle-bracket controls;
the physical comma/period keys were used without Shift.

The preexisting missing `XCREDIT.BIN`/`XSOUND.BIN` sound errors were dismissed
with Enter. Their configuration provenance remains a separate unresolved
issue; they did not prevent the observed driving.

## Guest consumption, paired releases and visible consequences

`keyboard-intercept-disassembly.txt` is derived from this run's retained guest
memory. The installed INT15 handler is **89fe:041e**; it checks AH=4F, selects
DS=2842h, and sets/clears the scan bit at DS:04a0h + (scan >> 3).
INT9 remains the generic BIOS IRQ1 entry **f000:0300**. Run-specific observers
only read registers/memory and record normal port/service calls. They neither
write guest state nor call the guest handler. Entry observations are sampled
at existing native handbacks, so not every cached entry produces an entry
event; the port-read/BIOS-continuation pairs and guest bit transitions remain
recorded for every driving make/break.

`keyboard-consumption.json` checks the actual paired scan observations, handler
bytes, game bitset and independent UP completion against commands/ACKs:

| Input | Commands | Make/break | Guest bit | Reviewed consequence |
| --- | --- | --- | --- | --- |
| A | 40–41 | 1E/9E | 288c3h, 40h | 006 MPH neutral baseline to 067 MPH, first gear; rev band and scene advance. |
| Left (comma key) | 42–43 | 33/B3 | 288c6h, 08h | Road stripe moves to the right of the cockpit; view turns left, 045 MPH. |
| Right (period key) | 44–45 | 34/B4 | 288c6h, 10h | Opposite view change: stripe returns left and the overhead structure shifts left, 023 MPH. |
| Z | 46–47 | 2C/AC | 288c5h, 10h | Brakes to 001 MPH, then 000 MPH with no keys held. |
| A from stop | 49–50 | 1E/9E | 288c3h, 40h | 000 MPH to 063 MPH, second gear, visible forward travel. |

Each DOWN capture has its corresponding game bit set; each UP ACK records
the bit clear and `heldKeys: []`. The actual BIOS continuation after the native
guest handler reports AH=4F and the matching AL make/break scan. Port 60h reads
and real IRQ1 deliveries increment from 36 before driving to 46 afterward;
the hardware queue is empty at the final release. Handler entry observations
also explicitly record A make/break and right make/break at 89fe:041e.

Reviewed files under `retrieved/output/` include:

- `neutral-countdown.png`: no held keys, 000 MPH, neutral; other cars leave.
- `neutral-green.png`: later no-key capture, 006 MPH. This passive motion is
  retained as a limitation of that baseline, not attributed to input.
- `accelerate-A.png`, `steer-left-comma.png`, `steer-right-period.png`: the
  first acceleration and opposite steering consequences described above.
- `brake-Z.png`, `neutral-after-brake.png`, `accelerate-from-stop-A.png`:
  stronger acceleration check from a reviewed 000-MPH baseline to 063 MPH.
- Matching `-up.png` captures and JSON retain the independently armed releases.

The road alignment changes together with the original's consumed opposite
steering bits establish steering; speed or scene progression alone is not
the evidence. No lap/checkpoint, sustained race completion, FPS, audio-quality
or parity claim is made.

## Checks, recovery and shutdown

The reused atomic helper's six concurrent-reader/collision/failure/release-order
regressions pass. The published native IRQ/INT15 regression passes accept,
drop, remap, chaining, extended scans, guest held-state and IRQ IRET restoration,
including Node and both browser bundles. Run-driver syntax/Python compilation,
installed63 verification, 200 pre/post runtime pins and own evidence checks pass.
The global evidence checker reports seven existing errors in other runs and
no findings for this run; no unrelated evidence was changed.
Production code was unchanged; the predecessor's locked build is documented
in [its note](world-circuit-atomic-driving-20261107.md).

Commands 0–51 all have exact ACKs; zero UNKNOWN, no replay. Every physical DOWN
had its separate UP atomically published first. Command 51 quits with empty
held keys; driver PID 5490 is absent. No unsupported service, guest CPU fault,
decode failure or changed implementation rerun occurred.

All **215 terminal references, 18,307,643 bytes**, were retrieved and size/SHA-256
verified before normal stop. Unique captures, logs, commands/ACKs, memory and
module remain in `retrieved/`. `RECOVERY.md`, source SHA, relevant diff,
owned-new-file patches, helper/runtime pins and manual/media references support
recovery without source archives or repeated media copies. No candidate-corpus
entry matches World Circuit, so evidence remains with this investigation note.

One UUID created **bx_kf9kw99a**; initial expiry
**2026-11-08T00:23:30.346Z**. Detached supervisor, independent 25-minute watchdog
and delegated normal-stop worker were observably armed before creation. After
verified retrieval, stop **stop_5efe570167d08258** completed
**2026-11-08T00:01:58.449Z**, `forced:false`. Final state **ARCHIVED**, expiry
null. Both delegates exited zero; supervisor has no remaining children. No
resume, deletion, second box, forwarded port, browser profile, archive or public
deployment. Free `/home` space stayed above the assigned 5-GB floor.

Next is further ordinary race progress if separately assigned. This bounded
keyboard-driving verification is complete and its resources are released.
