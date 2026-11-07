# World Circuit: atomic publication and BIOS keyboard intercept fixed

Run: `scratch/runs/20261107-world-circuit-atomic-driving/`.

**Atomic command publication and the generic BIOS keyboard intercept now have
tested fixes. The fresh original reached the Phoenix cockpit and demonstrated
the missing keyboard route before its fix; original acceleration/steering remain
unverified.** No motion or speed reading is claimed as controlled driving.
The box was already normally stopped when the coordinator extended this task
to implement the intercept; there was no second original invocation.

The [predecessor](world-circuit-date-driving-20261107.md) remains authoritative
for its own command 33: UNKNOWN, never replayed or converted to success.
This run used a separate UUID box, fresh installed GP invocation, command
directory and sequence. Its command 33 ACK does not amend the predecessor.

## Actual helper correction and regression

The predecessor's run-specific `command.py` embedded Python which opened the
final numbered command with `open('x')`, then wrote JSON. The replacement
`atomic_command.py`, called by this run's actual `command.py`, serializes first,
creates a unique hidden temporary file **inside the command directory**, writes
the complete payload, flushes, fsyncs and closes it, then hard-links it to the
numbered JSON name. The same-filesystem link exposes the complete file atomically
and refuses an existing destination. The temporary name is removed in `finally`.
There is no overwrite, replacement of an old command, retry, or parse-error
recovery that would disguise UNKNOWN as success.

The serial driver still consumes exact sequence IDs in order. Work targets,
per-command 30-second work bounds and overall driver deadline remain in place.
For physical key presses, the helper atomically publishes sequence N+1 UP
**before** publishing N DOWN; the reader waits for N before reading N+1.
Thus release is independently armed before DOWN becomes visible and executes
without another controller round trip. Standalone DOWN is rejected. Publication
or ACK failures raise and stop the caller; bounded batches use checked subprocess
returns. Failure screen/status and exception summary now have separate names.

Before allocation, `atomic-regression.log` passed four focused tests:

- Three independent concurrent readers each parsed all 64 commands containing
  256-KiB payloads, with thousands of successful reads and no partial JSON.
  While fsync was deliberately paused, no numbered command existed.
- Eight simultaneous writers for one ID produced one success and seven
  collisions. The winning bytes survived another duplicate publication attempt.
- Injected fsync/link failures left no numbered file or temporary file;
  unserializable JSON was rejected before creating a file.
- UP publication preceded DOWN; sequence/scan/work/deadline fields were retained;
  a colliding UP prevented DOWN publication.

`atomic-regression-final.log` additionally covers write, flush and close failures
and reproduces the predecessor's empty-final-file visibility. All six tests pass.
Python compilation, Node syntax check and the locked repository build also pass.
The helper remains run-specific, with exact recoverable new-file patches retained
under this run; no general transport framework or emulator workaround was added.

## Fresh original and reviewed evidence

Runtime source Git: `2e17a7f47e161d01ae68bc2a55840eada2ae9df5`, plus retained
relevant diff. All 63 registered installed files matched
`test/toyvm-dos-corpus/files/world-circuit-v103.json`, including installer-written
`f1gp.$$$`. The unchanged installed GP.EXE is 332840 bytes, SHA-256
`b29f8154cfd435796df01da9e4a0e6209a70613da95f7fd128f5e84edf26bf15`.
The native cooperative runner invoked `C:\MPS\GPRIX\GP.EXE /c`, current directory
`mps/gprix`, default devices/clocks. No installation or already-passed BIOS/date
control was repeated. All 200 runtime pins passed before and after the run.

Actual Node v24.22.1, V8 13.6.233.17-node.58; native WASM SHA-256
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`,
generated WAT SHA-256
`378adbe534e0aa4c1e039f1580a179c5b5023d9440afabdfb08fb78cb6912aec`.

Reviewed captures in `retrieved/output/` establish:

| Capture | Observation |
| --- | --- |
| `installed-start.png` | Original car backdrop and sound-file error; dismissed with normal Enter. |
| `manual-prompt.png` | English manual page 137, paragraph 1, line 1, word 9. |
| `after-manual-answer.png` | Original accepts `accompany` and displays STARTUP MENU, Quick Race selected. |
| `quick-race-up.png`, `select-keys-up.png` | Quick Race control method; normal Left selects Keys. |
| `keys-confirm-up.png` | Phoenix circuit overview and OK selection. |
| `phoenix-ok-up.png` | A second sound-file error, dismissed normally. |
| `race-sound-dismiss-up.png` | Original Phoenix starting-grid cockpit, neutral, 000 MPH. |
| `grid-countdown.png` | Red starting lights, still 000 MPH. |
| `green-accelerate-A.png` | Changed scene and 042 MPH; not proven to result from A. |
| `steer-left-comma.png`, `steer-right-period.png`, `steer-left-angle.png` | Continued scene progression, 035/026/018 MPH; no attributable steering response. |

The actual manual prompt was checked against the retained authentic English scan
and its printed page 137 before typing normally. Manual PDF SHA-256
`61ca7d846d7016a7b522107b04c879e36da4d043bd2a12362ad3ef7ccaff854b`;
`manual-reference.json` names its existing retained path and source URL. No bypass.
The installed original README describes Quick Race; the manual specifies A/Z,
angle-bracket steering and Space. Bounded A, comma/period scan-code steering and
the literal `<` character were attempted, each with prearmed UP and exact ACKs.
Neither ordinary manual controls nor their resulting speed prove control here.

The unresolved sound issue includes failed opens of both `XCREDIT.BIN` and
`XSOUND.BIN`. Dismissing their dialogs permits the cockpit, so it did not block
this test. No original setup writes were investigated or attributed to a DOS
fault in this run, and no asset substitution, renaming or direct config edit
was used. Its separate setup-provenance investigation remains open.

## Original failure: INT 15h keyboard handler never sees scans

Retained original memory installs vector 15h at **89fe:041e** while vector 09h
remains **f000:0109**, the default BIOS entry. Read-only disassembly in
`keyboard-intercept-disassembly.txt` shows:

- **89fe:041f** compares AH with 4Fh. Other functions chain through the saved
  INT 15h vector; AH=4F enters the keyboard path.
- **89fe:0430–0456** selects DS=2842h and uses the make/break scan code in AL
  to set/clear the corresponding bit at DS:04a0h + (scan >> 3).
- The A bit is at linear **288c3h**, mask 40h; comma/period are at **288c6h**,
  masks 08h/10h. These bits are clear in the retained memory after the paired probes.
  Down ACKs separately show held keys with no IRQ1 delivery or keyboard-port reads.

`keyboard-boundary.json` records the actual cockpit observations: INT 16h counts
stop at AH=00:17 and AH=01:212194; IRQ1 deliveries remain zero; reads of ports
60h/61h/64h do not appear. Hardware make/break bytes accumulate instead of being
delivered (36 before driving probes, 48 at the final capture). BIOS keys also
accumulate. The game progresses through its timer/render loop without seeing
these physical transitions.

The tested original runtime's `Machine.keyboardIrq()` in `tools/toyvm/dos.js`
immediately returns zero
unless vector 09h is hooked. `keyDown` queues BIOS and hardware input, but there
is no path from that default BIOS keyboard entry to the guest's AH=4F intercept.
The advertised BIOS configuration also explicitly omits keyboard-intercept
support. This source and original-handler evidence identifies a missing BIOS
keyboard route, rather than a need to force guest control state or patch GP.
It explains why acknowledged host key transitions cannot establish driving.

## Generic BIOS fix after the original was stopped

The coordinator's 23:42:14Z message explicitly extended this bounded assignment
with the BIOS correction and meaningful native regression. The original box had
already completed normal stop at 23:41:18Z. It was not resumed or replaced.

`tools/toyvm/dos.js` now installs real IRQ1 BIOS instructions at **f000:0300**.
They save registers, read port 60h, set AH=4F and CF, execute an ordinary guest
INT 15h, pass its returned AL/CF to the BIOS continuation, acknowledge the PIC,
and finish with native IRET. An installed INT 15h intercept now makes IRQ1
eligible even when INT 9 remains at the BIOS default. Custom INT 9 handlers keep
their own hardware route; the new BIOS route is restricted to real mode with
the conventional PIC mapping and honors IRQ1 masking. The firmware's system
configuration capability byte changes from 60h to 70h for the implemented hook.

The hook contract is CF set to accept the returned scan in AL, CF clear to
ignore it, as documented in the [Ralf Brown interrupt reference](https://raw.githubusercontent.com/cirosantilli/ralf-brown-interrupt-list/master/inter61a/INTERRUP.C).
The default INT 15h/AH=4F service accepts without altering AL. BIOS insertion is
deferred while an intercept owns the default keyboard route: input cannot leak
to INT 16h or the BDA before the hook decides. Provenance accompanying each
hardware byte prevents duplicates, including keys queued before hook installation.
The BIOS continuation ignores break codes, handles extended prefixes and modifier
state, and uses returned scan codes for US-layout character translation after a
remap; unchanged input retains the frontend-supplied character. Outstanding BIOS
IRQ provenance is stacked so a reentrant hook cannot replace its caller's input.

Focused native `test/test-toyvm-keyboard-intercept.js` first failed on the old
implementation: **zero guest make callbacks, expected one**. After the fix it
passes ordinary guest-installed handlers which accept, drop, remap A to B, and
chain to the previous BIOS vector. It verifies real IRQ1 delivery, incoming
CF=1/IF=0, make/break ordering, a guest-maintained held-state byte, no duplicate
BIOS key or break character, returned AL translation, and restored registers,
SP and CF/IF/DF after IRQ IRET. An extended-arrow case checks all four E0/make/
E0/break bytes. Node and both generated browser bundles also pass focused
capability/masking/deferred-insertion/custom-handler checks.

Broader focused checks pass held-key/live input, CLI DOS keyboard polling,
serial/batch runner input, BIOS configuration, DOS date, 8042/A20, browser bundles,
and DOS machine checkpoint/restore. These checks exposed a preexisting empty-view
ROM initialization error in CLI/batch construction; `installIvt` now waits for
`setMemory` when the initial view has length zero, with regression coverage.
The first concurrent checkpoint test rejected changed source identity while edits
were underway; rerunning after the implementation stabilized passes. Both browser
bundles were regenerated and the locked repository build passes.

The original invocation predates this implementation. Next is a newly authorized
fresh original using the published fix, ordinary menus and independently armed
releases, with actual make/break/bitset evidence and reviewed acceleration and
steering consequences. The conditional same-box pre-input-error authorization
was not used for this post-input discovery or to revive the stopped box.

All commands 0–51 have exact ACKs, zero UNKNOWN. Command 51 quit the driver;
its ACK records empty held keys. PID 5961 is absent. During the original there was no unsupported
service, decode failure, CPU fault or guest patch. Driving, audio quality,
performance and parity remain unverified.

## Evidence recovery and delegated normal stop

All 278 terminal references, 14,021,590 bytes, were retrieved and SHA-256/size
verified before stop. The 63 identical output copies of installed media were
subsequently removed locally only after byte comparison; `media-dedup.json`
maps their recorded hashes back to the existing fixture. The remaining unique
logs, captures, commands/ACKs, memory and module are retained. `RECOVERY.md`,
exact Git SHA, relevant diff, owned-new-file patches and runtime/helper pins
retain recovery without a source archive or repeated media bundle.

One UUID created **bx_npt89m7a**, initial expiry **2026-11-08T00:00:42.114Z**.
An observable detached supervisor and independent 25-minute watchdog were armed
before creation. Verified retrieval triggered delegated normal shutdown:
**stop_70f0daa01eba8f56**, completed **2026-11-07T23:41:18.321Z**,
`forced:false`. Final state **ARCHIVED**, expiry null. Both delegates exited
zero; supervisor ended with no remaining child. No resume, delete, extra box,
forwarded port, browser profile, archive or public deployment. This single
bounded task stops at the demonstrated keyboard-intercept boundary.
