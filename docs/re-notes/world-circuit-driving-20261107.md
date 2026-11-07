# World Circuit DOS demo: keyboard consumption and driving boundary

Run: `scratch/runs/20261107-world-circuit-driving/`; owner Telegram177.
Tested source: `90e01588dec6ee9eece5b0744dbe5b6a69fe466d`, after the
[startup repair](world-circuit-startup-20261107.md). No production code changed.

**Ordinary driving remains unverified.** The original renders the start sequence
and later advances the scene without held input. The observed original loop
drains BIOS keystrokes; it does not consume hardware held-key state. This is
evidence for a demo limitation in this execution path, with no demonstrated
CPU/DOS/keyboard mismatch to repair. Automatic movement is not control proof.

## Original input path

Static inspection used retained startup memory before allocating a fresh box,
then checked the fresh session's memory. At **1a66:323b**, the original calls
INT 16h/AH=01, tests availability, calls AH=00 when a key exists, and returns
carry clear after consumption or carry set when empty. **1a66:324a** repeatedly
calls that routine while carry is clear, then returns far. It drains the
keyboard queue. The main segment calls this drain at **0110:e7f5** and
**0110:e951**; the following instructions do not dispatch on the key value.
The run retains disassemblies `segment-1a66.asm`, `main-f8b0.asm` and
`main-fa10.asm`, plus the underlying captured memory.

The runner's existing `Machine.keyDown` queues one BIOS key and a hardware make;
`keyUp` independently queues the break and removes the held entry. BIOS reads
consume `machine.keys` and update its BDA mirror. IRQ1 delivery requires an
installed INT 9 vector; the original retained **f000:0109**, the default vector.
The fresh run observed **269 INT 16h availability polls and four reads**,
**zero IRQ1 deliveries**, and **zero reads of ports 60h, 61h, 64h or 201h**.
All four supplied BIOS keys were consumed, while their eight hardware
make/break bytes remained queued. Thus the ordinary keys reached the guest;
there is no evidence that a missing runner release prevented driving.

## Documented bounded inputs and visual result

The [MicroProse DOS technical booklet](https://archive.org/details/f1gp-begleitheft)
lists A for acceleration, Z for braking, angle-bracket keys for steering, and
A+Space for an upshift. The [manual](https://archive.org/details/f1gp-handbuch)
describes K for keyboard/joystick mode. Their OCR was retrieved through Archive
metadata/download and retained. These 1993 retail references are candidates,
not proof that this 1992 demo supports interactive driving.

After reviewing the grid, the single session used:

| Input | Bounded work while held | Release |
| --- | --- | --- |
| A | 15 million dispatches | Separate UP, then 2 million |
| K, documented native mode request | 5 million | Separate UP, then 1 million |
| A, then Space | A alone 1 million, chord 5 million | Space UP, A held another 20 million; separate A UP |

K was consumed, but no visible mode selection was established. A and the chord
left the reviewed cockpit in neutral at 0 MPH, with no demonstrated gear or
acceleration response. No Escape/function-key survey, edited guest settings,
bindings, memory, clocks, forced control state or guest patch was used.
The drain evidence ended input probing; steering/braking probes would not
establish a held-control path here and were not sent.

The bounded passive continuation ended at **990,055,972 dispatches**. Captures
show the start lights progressing from dark to red, then the tower leaving
view, cars advancing and changed road/track framing. The final display reads
**neutral, MPH 004, lap 1, position 24**. This scene advance occurred after
all releases, without further input. No steering consequence or user-controlled
gear/speed/track displacement was demonstrated. No decode refusal, missing
file, trap, guest exit, stuck-detector stop or UNKNOWN command occurred.

## Fixture, validation and recovery

The same hash-pinned three-file native ToyVM fixture was used: original
`test/binaries/dos-games/world-circuit-demo/F1GP/{F1GPDEMO.EXE,ADLIB.CAT,XSOUND.BIN}`.
The registered EXE SHA-256 is
`5c88d286945690fc7340ce98aaab0ca51912e7b0cc1ed1f89754fa0e82721511`;
`media-refs.json` records all three paths, sizes and hashes. Static corpus checks
passed before allocation; **139 runtime/media/helper pins** passed before and
after execution. The actual module SHA-256 was
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`,
matching startup. Node v24.22.1/V8 13.6.233.17-node.58 ran the existing
`createMachineRunner`, `DosSession.step` and production PNG capture functions,
with default CPU/devices/clocks and empty guest arguments. Run-specific wrappers
only observed keyboard methods. Established runner/capture/lifecycle checks
were reused; driver syntax, ordered ACK/release validation, complete retrieval
hash/size validation and documentation whitespace checks passed.

Sixteen commands, including terminal quit, had exact ordered acknowledgments;
four physical DOWNs had four independent UPs. A local retrieval attempt first
encountered an already retained immutable file; the corrected retrieval verified
existing bytes and fetched missing files without replaying guest commands.
All **70 remote artifact paths, 61 unique contents, 2,159,921 bytes** were
recovered and SHA-256/size verified before requesting box shutdown. Intermediate
memory captures are retained separately. Git SHA, relevant binary diffs, helper
patches, media references and the actual module provide recovery; no source-tree
or media archives were made. The corpus has no candidateId, so this investigation
uses `run-summary.json` rather than an unrelated dashboard candidate.

One persisted UUID allocated **bx_3cvmp865** at **22:23:02Z**, initial expiry
**22:48:02.297Z**, with more than 5 GB free on /home. Observable detached
25-minute watchdog and normal-stop delegates were armed before allocation.
The task explicitly delegated shutdown. After recovery, the sole driver PID
5727 was absent, held keys were empty, and this CLI route had opened no ports
or browser profiles. Normal stop **stop_4c7857b59be1d06a** completed
**22:28:07.827Z**, `forced:false`; final box state **ARCHIVED**, expiry null.
Both delegates exited zero; owned watchers were closed. Custody returns to the
coordinator; the box was not deleted or resumed.

Next: preserve the demo limitation. An interactive-driving claim needs an
authentic demo entry/control path or separately authorized interactive media;
these retail controls alone do not justify an emulator change. No public
deployment, FPS, audio or parity claim is made.
