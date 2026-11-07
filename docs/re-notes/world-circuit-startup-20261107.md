# World Circuit DOS demo: divide-fault startup repair

Run: `scratch/runs/20261107-world-circuit-startup/`.
Owner: Telegram177; corpus registration `e2af5ba302d601542e1c621cb7b4641cd5b2acc6`.

The original demo now renders a recognizable **320×200 cockpit, other cars,
track, sky and start lights** in native ToyVM. The reviewed image is
`retrieved/after-output/startup-fixed.png`; subsequent captures show the riding
banner disappearing and the lights changing. **Movement is unverified:** the
car remains in neutral at 0 MPH. No menu/help text or ordinary driving controls
were established. This is a startup/rendering result, not a playability claim.

## Original media and route

`node tools/toyvm-dos-corpus.js --check --only=world-circuit-demo` passed.
All three files matched the registered size and SHA-256 before allocation and
after execution. The mount root was the original
`test/binaries/dos-games/world-circuit-demo/F1GP`, containing only:

| File | SHA-256 |
| --- | --- |
| F1GPDEMO.EXE | `5c88d286945690fc7340ce98aaab0ca51912e7b0cc1ed1f89754fa0e82721511` |
| ADLIB.CAT | `99003e82ffec9f3dd7f7bc9ec938d43c4bd23557199fe3a4cdd7019b6471b66b` |
| XSOUND.BIN | `633b4d315ab84ba50c7b8ca2d64e72504dfbf235b8546d02ab085f88a7d12f27` |

The run used the existing `tools/toyvm/run-dos.js` exported
`createMachineRunner`, its `DosSession.step`, and its production frame readers
and PNG writers. A small serial run-specific driver controlled those existing
primitives; it did not emulate instructions or substitute a guest. CPU 386,
tailcall interpreter, normal default devices/clocks and empty guest arguments
were retained. No Windows/DOSBox wrapper, archive emulator, guest patch,
forced state, special handler, clock/configuration bypass or public deployment
was used. The separate box ran Node v24.22.1 / V8 13.6.233.17-node.58.

Initial runtime identity is commit `e2af5ba302d601542e1c621cb7b4641cd5b2acc6`
plus `relevant-source.patch`; `runtime-pins.json` records 139 actual inputs.
The repaired run is pinned by `runtime-pins-after.json` and
`fixed-source.patch`. Both runs emit the same native module SHA-256
`b6bacd0b52e72aea90a1ddad6016d07b59f4102de3dba720c66c5d3d855c9550`:
this repair changes the JS decoder's fault-IP operand, not the emitted handler
bodies. The actual native module is retained, alongside exact patches and
media references. No source-tree/media archives were made.

## First execution blocker and repair

The initial no-input startup reached a partly drawn cockpit with a corrupt
track area, then stopped at **0fc0:e25e**, after **16,482,828 dispatches**.
That byte (`63`) lies in a word table; treating it as a missing game opcode
would conceal the earlier control-flow failure. The cache also recorded
`0fc0:92d3`; a compile-time speculative refusal alone does not prove execution.

A bounded observational trace through the same runner stopped at the actual
undecodable entry at **16,482,626 dispatches**, before the stuck detector's
additional 202 dispatches. `retrieved/diagnostic/trace.json` preserves the last
200 entries, registers, stack words and instruction bytes; its memory and
frame match the original stopped boundary.

The trace exposes the real mismatch in the demo's original divide-error
handler at **1a66:1df4**. For example, `DIV word [0234]` at **0fc0:1b8d**
saved **1b91**, and `IDIV word [BP+14]` at **0fc0:9795** saved **9798**.
Those are the following instructions. The handler inspects the saved opcode,
computes its length, increments the saved IP, and IRETs. Given the wrong saved
IP, it resumes inside later instructions and eventually loses control flow.

`tools/toyvm/decode.js` unconditionally supplied the following IP to DIV/IDIV
and AAM-zero faults, retaining 8086 behavior even for CPU 386. It now saves the
first instruction/prefix byte on CPU 286 and later, preserving the historical
following-IP behavior on 8086/80186. The architecture basis is Intel's
[80386 Programmer's Reference Manual, section 14.7](https://www.css.csail.mit.edu/6.858/2014/readings/i386/s14_07.htm).
Both generated browser bundles were refreshed so the normal page receives the
same correction.

The focused regression failed before the fix (`CPU 286 DIV8`, saved 290 versus
expected 288) and passes afterward: **76 cases** cover CPU model, signed and
unsigned divides, register/memory forms, 8/16/32-bit operands, prefixes, zero
divisors, quotient overflow, real native IVT stack frames, dividend preservation,
and a guest handler skipping the failed instruction and returning through
IRET. AAM-zero fault operands are checked as well. This fixture validates CPU
semantics; it is not used as gameplay evidence.

Validation also passed the existing near-target tests, browser-bundle test,
generated-bundle freshness and the mandatory locked build:

```sh
node test/test-toyvm-divide-fault-ip.js
node test/test-toyvm-near-target-width.js
node test/test-toyvm-browser-bundle.js
NODE_OPTIONS=--v8-pool-size=1 flock /tmp/wine-build.lock bash tools/build.sh
```

## Repaired original and remaining boundary

The unchanged original passed the former failure point, reaching 30,000,001
dispatches with no decoder refusals and the reviewed track image. The bounded
same-session followthrough ended at **182,050,001 dispatches**, still without
unsupported decodes, missing files, a trap, guest exit or stuck-detector stop.
No UNKNOWN command occurred. Ten run/input commands and the terminal quit had
ordered acknowledgments. Two Escape pulses and one each of F1/F10 were ordinary
attempts to discover the original help/menu; each physical DOWN had its own
acknowledged UP, and the terminal held-key set was empty. None exposed help or
a menu. The final capture still shows neutral, 0 MPH and the starting grid.

No acceleration, braking, steering or gear-control mapping was inferred from
these exploratory keys, and no corresponding movement is claimed. The exact
remaining boundary is the stationary grid and unestablished original input
workflow. Whether this is a further emulator/device fault, demo behavior or an
unfound ordinary control is unresolved. Next work should trace the original's
keyboard/control consumption and discover its actual help/entry workflow,
then verify movement with independent releases. No FPS, audio or parity claim
is supported.

## Lifecycle and evidence

One persisted UUID-idempotent allocation created **bx_5zsj646x** at 22:08:37Z,
initial expiry **22:33:36.945Z**. Static runner/media checks preceded allocation;
free `/home` exceeded 5 GB. A detached supervisor prearmed the observable
25-minute watchdog and normal-stop delegate. The task explicitly delegated
normal shutdown.

All unique frames, native modules, trace/memory, logs and command acknowledgments
were recovered and SHA-256/size verified before requesting shutdown: 70 retained
remote artifact paths, 52 unique contents, 3,840,227 bytes including duplicates.
Both original driver PIDs were absent, held keys were empty, and this CLI route
opened no server ports or browser profiles. Normal stop
**stop_34a9c81180259773** completed **22:18:08.312Z**, `forced:false`; box state is
**ARCHIVED**, current expiry null. Custody returns to the coordinator; it was
not deleted or resumed. Both lifecycle delegates exited zero. Final local
watcher/lifecycle checks and heartbeat measurements are in `local-cleanup.json`.

The DOS manifest has `candidateId:null`, so evidence stays in this investigation
and `run-summary.json`; it is not attached to an unrelated dashboard candidate.
