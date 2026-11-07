# Installed World Circuit: startup menu reached, command publication race

Run: `scratch/runs/20261107-world-circuit-date-driving/`.

**Published DOS get-date and BIOS configuration services passed original GP
startup. The original manual challenge accepted its documented answer, and
Quick Race reached the Keys/Joystick selector. Driving remains unverified:
the run-specific command helper failed while publishing an Enter release.**

The [immediate predecessor](world-circuit-installed-driving-20261107.md),
[installation recovery](world-circuit-timestamp-install-20261107.md), and
[original media references](world-circuit-v103-source-20261107.md) apply.
All 63 registered files, including installer-written `f1gp.$$$`, were verified
against `test/toyvm-dos-corpus/files/world-circuit-v103.json`. Installed GP.EXE
is 332840 bytes, SHA-256
`b29f8154cfd435796df01da9e4a0e6209a70613da95f7fd128f5e84edf26bf15`.
No installer, media recovery, or unchanged DOS/BIOS control was repeated.

## Actual invocation and reviewed screens

Runtime Git: `5c54c4bb895ee3e3c23a4b7501811deae5bb2fa2`, with relevant diff
and 200 exact runtime/helper/installed-file pins retained. The registered native
cooperative ToyVM runner launched `C:\MPS\GPRIX\GP.EXE /c`, current directory
`mps/gprix`, default devices/clocks. Node v24.22.1, V8
13.6.233.17-node.58; native ToyVM WASM SHA-256
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`,
generated WAT SHA-256
`378adbe534e0aa4c1e039f1580a179c5b5023d9440afabdfb08fb78cb6912aec`.
No browser, guest patch, private handler, injected state, or direct config edit.

Reviewed captures under `retrieved/output/`:

- `installed-start.png`: rendered car backdrop and **Can't find sound file**.
  DOS trace records four failed opens of `XCREDIT.BIN`; registered files contain
  A/B/R variants but no X variant. Enter was acknowledged down and up and the
  intro continued. This is not proof of missing source media or a DOS defect;
  original hardware-configuration provenance remains a separate unresolved issue.
- `startup-menu-wait.png`: original English manual protection prompt, page 137,
  paragraph 1, line 1, word 9. The original English manual scan was retrieved
  from [this PDF](https://www.bestoldgames.net/download/games/formula-one-grand-prix/formula-one-grand-prix-manual.pdf),
  hashed in `manual-source.json`, and printed page 137 rendered and inspected
  as `manual-page137.png`. Its ninth word, `accompany`, was entered normally
  with separate acknowledged releases; no protection bypass was used.
- `after-manual-answer.png`: **STARTUP MENU**, Quick Race highlighted.
- `quick-race-up.png`: original Quick Race **Please select control method**,
  Joystick selected. Acknowledged Left down/up selected **Keys**, visible in
  `select-keys-up.png`. No hardware setup UI was invoked in this run.

The original README describes Quick Race; previously retained original technical
booklet/manual OCR documents menu arrows/Enter and A/Z/angle-bracket driving
controls. Acceleration and steering were never attempted. Main Menu, cockpit,
passive race motion, speed response, FPS, audio quality and parity are not proved.

## Concrete stopping condition: UNKNOWN release, no replay

Commands 0–32 have exact ACKs. Command 32 pressed Enter to confirm Keys;
its ACK records Enter held. Command 33 was the independent Enter UP.
The helper opened `commands/33.json` with `open('x')` and then wrote JSON,
while the driver polled file existence and immediately parsed it. The driver
observed the file before publication finished and threw:

```text
SyntaxError: Unexpected end of JSON input
  at JSON.parse (<anonymous>)
  at main (.../drive.cjs:26:16)
```

The terminal command file is complete, but there is no command-33 ACK. Its
outcome remains UNKNOWN. No further input, release retry, changed-implementation
invocation, or additional allocation followed. This invocation's UNKNOWN is
separate from the predecessor's older UNKNOWN. I reused a helper whose
non-atomic publication made this race possible; that was a harness mistake.

The exception handler calls `releaseKeys()` before its failure capture and exits.
Its later error record overwrites the capture's same-named `failure.json`, so
terminal held-key state is not independently available; do not substitute the
last ACK for proof of a release. The final inventory confirms PID 6276 absent.
The inspected terminal `failure.png` still shows the Keys selector. There was
no emulated CPU fault, unsupported opcode or unhandled BIOS/DOS service through
command 32. No emulator correction or synthetic primitive test is warranted
by this infrastructure failure.

Next prerequisite is atomic, complete command publication before a driver can
see a numbered JSON file, with a concurrent-reader regression. A future original
run requires new authorization because this task stopped on UNKNOWN; it must
not replay the uncertain command. Investigate original sound setup only through
its actual UI and demonstrated DOS semantics. Do not rename/substitute X assets.

## Evidence and shutdown

All 208 terminal references (12,023,327 bytes) were retrieved and size/SHA-256
verified, and all 200 runtime pins matched before normal shutdown. The driver,
commands, ACKs, failure, module, unique captures and memory are retained.
`RECOVERY.md`, exact source SHA, relevant binary diff and owned-new-file patches
retain recovery without a source archive. Media remain referenced at existing
paths/hashes. No candidate-corpus manifest entry exists for this installed title;
evidence stays in these investigation notes rather than attaching to another game.

One fresh UUID created **bx_rep4etf4**, initial expiry
**2026-11-07T23:52:08.806Z**. Launch checked 8,982,495,232 free bytes on `/home`.
Detached supervisor, observable independent 25-minute watchdog and normal-stop
delegate were armed before allocation. Verified retrieval triggered delegated
normal stop **stop_0518f45e96045837**, completed
**2026-11-07T23:30:38.675Z**, `forced:false`. Final state **ARCHIVED**, expiry
null. Both delegates exited zero and supervisor ended with no remaining child.
No resume, delete, forwarded port, browser profile, source archive or public
deployment. This single bounded task ends at the command publication failure.
