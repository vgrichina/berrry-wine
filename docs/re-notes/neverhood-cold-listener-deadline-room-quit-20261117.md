# Neverhood cold child listener deadline

Evidence: `scratch/runs/20261117-neverhood-cold-listener-deadline-room-quit/result.json`.
The published `a853b016b` game-drawn Quit implementation is unchanged. No runtime
repair or new canonical build is claimed. Its native Quit, owner/stale/cancel,
650 ms reply, exit-settlement and locked-build proofs were checked by hash.

Fresh authored cold processes used the failed original's exact sealed runtime
source inventory, retained `5a417895` module, existing 651,438,080-byte CD,
guard preload and populated installer state. The installed-path fixture replaces
only the launcher and NHC executable records with authored programs; the other
56 installed files, registry and pending WININIT remain intact. It exercises
ordinary Play/CreateProcess, parent guest ExitProcess, child USER input,
independent UP and child native Quit with actual waits and both EOFs. Correct
child readiness was published within the unchanged 3,000 ms bound. Real delayed
constructor, wrong-port child, unrelated listener occupying the intended port,
child cancellation and late-readiness controls fail with zero child HTTP/input.
Constructor authority/client failure retirement also passes. Earlier harness
syntax/fault-placement mistakes are excluded, not counted as negative proofs.

The one authorized original used the normal installed shortcut target and exact
same sealed source/module/media pins. Whole launcher pixels were personally
reviewed before the ordinary kind=install Play click. The independent watchdog
was observable before launch. Play's aggregate clock began at
1794937779344.242 ms. The actual child was spawned at +679.758 ms; its bootstrap
began at +871.758 ms. The child independently validated the expected port,
parent, executable, module and sources by +2170.758 ms. Its authenticated desktop
hello returned normally. It bound the correct localhost port 45433 at
+3407.758 ms; the readiness publication timestamp was +3408.758 ms. The
controller had already latched UNKNOWN at its original deadline. No child
attestation HTTP, child capture, game input, room consequence or Quit followed.

This run distinguishes deadline expiry from wrong listener identity. From child
bootstrap to listener binding, the main thread accumulated 490.328 ms of CPU
execution and 1549.628 ms of runnable scheduler wait during 2536 ms of elapsed
time. The launch-local worker freshly read and hashed every CD byte; its scan
took 1349 ms, including 454.522 ms of CPU execution and 880.067 ms of runnable
scheduler wait. These are passive per-thread counters, not timeout extensions
or substitute readiness. They establish substantial scheduling delay on this
invocation. They do not identify the competing workload or prove that every
historical cold failure has the same cause. The earlier combined
`late/wrong listener` error alone cannot establish a port defect.

No speculative runtime change was made. Fresh byte validation, live provider
identity, once-only preparation, authenticated hello/USER ownership and all
500/1750/3000 ms and 15/30 second guards remain intact. UNKNOWN is terminal;
there was no second original or later request. Host cancellation collected
actual parent, child, helper, owner and watchdog waits with both EOFs and an
empty outer scope. Cleanup is not game Quit. No box was created.

The concrete blocker is correct-child readiness exceeding the fixed deadline
under observed runnable scheduling delay. Nursery interaction and original
game-drawn Quit remain unproved. Further work needs an authored reproduction
that accounts for this measured scheduling delay and demonstrates a specific
safe remedy; another original requires separate authorization.
