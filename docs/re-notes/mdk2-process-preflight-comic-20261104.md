# MDK2 process preflight and bounded menu attempt — 2026-11-04

**The run-only process preflight is fixed and tested. The live attempt stopped
at its first unexpected scene: Enter on the inspected New Game menu did not
produce a difficulty dialog in the resulting capture. Medium, opening-comic
Escape and the post-comic scene were not reached.** No retry, reload, second
browser or further guest input followed that result.

The reviewed source-backed handoffs were `fb257e361` (original comic controls),
`5a6307e99` (opening observation), and predecessor `719222b0b` (the command-text
process false positive). The original Escape release → StopScript → comic Done
→ lounge intro remains supported by original source, without new live
confirmation here. Later intro/tutorial chaining was never attempted.

Evidence is in ignored `scratch/runs/20261104-mdk2-process-preflight-comic/`
(RUN). Only this note is committed. Production code was not changed and no
production defect is inferred from this attempt.

## Corrected process preflight

`RUN/process-preflight.py` reads `/proc/PID/exe` and `/proc/PID/comm` and matches
explicit browser/Node identities. Command text is never a classification input.
The actual checker was tested locally and remotely with a live Python process
whose arguments contain Chrome paths, a real Node executable, and a live
process whose comm identity is `chrome`. The CLI rejected the latter and
accepted the decoy after it exited. Those tests do not launch Chrome.

All **50 comic-control, 42 native-menu and six actual-driver inspection-barrier
tests passed** on this run's copied helpers. The barrier suite executes the
actual copied driver's command function. The driver and control behavior were
unchanged from the predecessor, including its finite deadlines and guards.

The assigned `bx_85fyu4ug` independently passed actual exec at **04:55:45Z**,
with API idle, health ok and hydrated true; ownership and ACK were appended to
the messageboard. No lifecycle operation was used. The old box was not accessed.

The intact predecessor runtime and isolated `browser-deps` were reused at
`/home/user/wine-assembly/scratch/runs/20261104-mdk2-native-comic-escape/`.
No runtime restaging or dependency reinstall was necessary. Actual Puppeteer
**24.31.0** import and its launch function passed before Chrome. All **432 pins**
passed before launch and after closure. A short-lived private static server
verified the registered MDK2 entry, HTML MDK2/WebGL controls, COOP/COEP headers,
and both actual HTTP-served module hashes, then closed its port before Chrome.
`prebrowser-result.json` retains the actual registry and served identities.

Execution source remains Git **`1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`**.
The original executable/scripts/base input hashes are unchanged:

| Input | SHA-256 |
| --- | --- |
| `mdk2Main.exe` | `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1` |
| `data/scripts.zip` | `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8` |
| `data/base.zip` | `a8f3da86e66f4271bc9d876053ef04ec46b29a74f5397bf59f72fff90843216c` |
| Canonical module | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion module | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

## Actual bounded execution and first failure

One browser launched at approximately **04:56:25Z**. Its actual selector records
MDK2/WebGL/cross-origin isolation; instantiated module identity is canonical.
Startup used no input and reached the legal title at **3,072 steps**, within
4,096 steps and 180 seconds. Every fresh screenshot was personally VIEWed in
a completed separate tool call before approval and dependent action.

The tested selector handled the legal-title Escape envelope at 3,072 steps.
Subsequent individual 16-step observations showed opening wells and icons.
At **3,248 steps**, `native-selector-83.png` visibly showed the red highlighted
controller, readable **New Game**, and no legal overlay. That fresh image was
classified as a completed main-menu scene and approved for the selector's
normal Enter envelope. This classification describes the pixels; it does not
prove the original Lua freeze or completion callback had changed.

The selector's state check, tick, trusted Enter down, 16 steps, Enter release,
32 steps and fresh capture all acknowledged successfully. At **3,296 steps**,
`native-selector-86.png` still showed the main menu and New Game. **No Select
Difficulty dialog or highlighted Medium appeared.** This is the first concrete
unexpected runtime/inspection result and is preserved in
`first-runtime-inspection-failure.json`. The ACKs prove delivery and bounded
advancement, not successful native selection. The cause remains unresolved;
no guest state was read or patched to explain it.

The final image was personally inspected and approved with an explicit stop
reason before ordinary quit. No further Enter, Escape, step, click or other
guest input was attempted. The opening-comic helper was never invoked; no
comic-control ledger exists. Neither tutorial nor comic completion is claimed.

Validation found **94 contiguous matching successful ACKs**, **60 step commands
/ 3,296 steps**, maximum request 64, and **17 captures** with matching full SHA,
steps and chronological approvals. The selector reserved **224 steps / 38
commands**, within its 512/64/240-second limits. The native history contains
exactly balanced title Escape and New Game Enter; inspected queues were empty,
active input null, and mouse mask zero. No driver bootstrap, page or command
exception occurred. All **200 actual browser served-file checks matched**.
The browser ran approximately **254 seconds**, below its 20-minute cap.

## Recovery and handback

Chrome closed normally at **05:00:40Z**. Its PID and all browser/Node identities
were absent, and private HTTP port **37351** was closed. Unique recovery
completed around **05:01Z**, well before 05:38Z: **315 files / 8,326,092 bytes**
passed full size/SHA verification and a second stable remote inventory check.
This includes actual logs, captures, command/ACK records and final state.
Both actual module full hashes were checked against already retained identical
predecessor recovery files; `module-recovery-references.json` identifies them
without another redundant module copy.

`checkout-head.txt`, `relevant-uncommitted.patch`, `execution-source-delta.patch`,
`checkout-vs-execution.patch`, `owned-new-files.patch`, dependency references
and full artifact hashes preserve reconstruction. Git holds source; the runtime
uses the pinned Git commit plus its recorded empty execution-source delta.
The predecessor's `prepare.py`, `runtime-pins.json`, `staged-path-references.json`
and resolved Puppeteer lock preserve input recovery. This run stages only its
small helpers. No local media evidence copies or source/scratch/docs/binary
archives were created. No local heavy runtime, cheat, console, guest write,
config patch, worker, successor, deployment or other game was used.

Hand back **bx_85fyu4ug / RUNNING (API idle), health ok, hydrated true / expiry
2026-11-04T05:48:31.042Z**, with **shutdownOwner=coordinator**. The box remains
running; coordinator owns shutdown. Next work would need a separately
authorized attempt and an investigation of the visible-menu/native-selection
boundary before claiming Medium or attempting the original comic transition.
This single task stops here.

The final evidence checker reports no containment errors, missing artifacts or
invalid record for this run. Its first metadata check rejected the spelling
`failure`; the outcome was corrected to the supported `failed`, and that first
checker log is retained. Unrelated global evidence errors were left untouched.
No production build was required for this documentation-only commit and
ignored run-only helper changes.
