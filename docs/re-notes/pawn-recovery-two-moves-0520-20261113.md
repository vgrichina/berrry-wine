# Pawn: recovered capacity, frozen owner guard refuses legacy route

Run `20261113-pawn-recovery-two-moves-0520` launched one current original and
personally reviewed its full, unobscured standard starting board. **No player
input was sent; two current player moves and native AI replies remain unproved.**
The concrete blocker was the prepared route's renderer identity contract:
the frozen input guard required a neutral shared Worker endpoint with a live
per-device consumer, while this CLI route creates the legacy asynchronous
software Worker. The guard was not changed or bypassed after launch.
This is a run-preparation/identity-verification failure, not an established
Pawn gameplay defect or a claim that its actual renderer failed.

The dependency launchers were identified by PID, command and `/proc` start
identity: dense0340 launcher886833 and offload0500 launcher901248. Offload's
completed exact6+9 recovery reclaimed22,786,048 allocated bytes and left
1,444,401,152 bytes at its game decision. Dense's completed shared replacement
then reported 6,811,648 additional bytes reclaimed against the intermediate
encoding (26,509,312 total against the original gzip allocation). Its protected
replacement and recovery files were read only. The old encodings' removal,
not a floor-poll loop, explains the capacity change. Outcome records and the
messageboard were captured; no foreign process wait/EOF was invented.

The actual supervisor, read-only owner probe and finite single-drag helper
were written, syntax-checked and frozen before the launch decision. The helper
requires current source/media pins, a fresh personally reviewed full board,
a legal player turn, completed native AI reply before move2, and an independent
process for mouse-up. UNKNOWN means no replay and runtime termination. None
of its input branches executed; their runtime behavior is not claimed tested.
No automatic move chain or historical startup matrix was run.

All prepared0450 source/media pins matched before freezing and again before
launch. Frozen main revision was `82241341c58251d8c49a8455e5eb9fcbfe738dad`;
current CPU file SHA-256 remained
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The prior canonical code/custom-section comparison is reused, not rerun or
claimed as newly compiled. The six original media files stayed at their
existing paths with matching hashes. Git SHA plus relevant binary diff,
inherited untracked Wininit patch, new helper patches and path hashes provide
source recovery; there are no source/media archives or copied media.

The actual decision and immediate prelaunch samples both measured
**1,515,134,976 bytes** available on `/home`, strictly above1,500,000,000.
Independent watchdog PID910998 published its observable600-second deadline
before runtime PID910999 was started. The unchanged registered Pawn command
selected the current module and software D3D9 backend, with no scheduled input,
normal startup and a1024x768 composited desktop.

Personally reviewed `starting.png` shows the complete starting position,
White at the bottom. The live guest had image base0x400000, nonzero EIP,
quit=false, device136454184, backend=software, and no bridge error. However,
`sharedWorker=false` and its per-device `workerConsumer` was absent. A second
read-only probe established `asyncSoftware=true`, `createRenderWorker` absent
and an asynchronous device. Static production wiring explains this exactly:
`test/run.js` supplies `ctx.createD3DRenderWorker`; `lib/host-imports.js` passes
that as `createSoftwareWorker`, while its neutral route instead reads
`ctx.createRenderWorker` and requires `ctx.sharedRenderWorkerEnabled`.
`lib/d3d9-host.js` stores the legacy consumer on the bridge, not the device.
The initial description of the observed route as synchronous was incorrect;
the detailed probe and the13 logged software render waits establish otherwise.
The bridge-level consumer was not inspected before shutdown, so full actual
Worker identity verification remains incomplete. Merely having a rendered
board was not used to override the frozen guard.

Ordinary control quit was followed by the actual supervisor parent wait:
runtime exited0 after35.557 seconds and92,047 batches, with separate stdout
and stderr EOF=true. Watchdog also waited0 with both output EOFs. Both owned
PIDs were absent afterward; no runtime remains. `final.png` matches the starting
board. No extra Present/repaint, board substitution, guest memory/config/clock/
AI write, original retry or production change occurred. Historical GetDC is
closed and was not reinvestigated.

Validation: Python syntax and JavaScript syntax passed; prepared source/media
identity checks passed; actual launch/deadline, full-board review, owner guard
refusal, ordinary quit and separate parent waits were observed. New evidence
files were SHA-256 sealed and independently reread. No production fix was made,
so focused production tests and the locked build were not required or claimed.

Next: freeze a guard that identifies the actual legacy software consumer on
this prepared route before a new authorized original, or deliberately prepare
a neutral route with its matching identity contract. Then review each fresh
full board and perform two separate legal player moves, each followed by an
actual native AI reply and independent mouse-up evidence. No game defect has
been established that warrants a production patch.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
This worker used only local processes; offload's stopped backup box remains
owned by its recovery task and was untouched.
