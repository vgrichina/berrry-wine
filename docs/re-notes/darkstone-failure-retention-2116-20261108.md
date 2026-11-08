# Darkstone upstream UNKNOWN retains the profile

The exact 2105 automatic failure path could delete `chrome-profile` and publish
`cleanup.json` after startup `Runtime.evaluate` timed out, provided Chrome then
closed and its output drained. Terminal retirement did not resolve the earlier
operation. Historical 2105 and 2054 artifacts remain unchanged.

`tools/darkstone-browser-driver.cjs` now carries a sticky upstream failure through
the selected SHA guarded driver. Every rejected CDP request latches failure before
returning to its caller, including background worker requests and requests made
during shutdown. Automatic failure/deadline closure and failed shutdown evidence
reads also latch failure. The actual top-level rejection handler persists closure
before shutting down. After terminal wait, compressed stream EOF and network
handle closure, a final gate checks the latch and existing client/runtime fault
files before allowing profile removal, cleanup publication or a quit ACK.
A late CDP response cannot clear the failure; transport admission remains closed.
Normal legal 55,000 ms quit remains eligible. Production timeouts are unchanged.

Evidence: `scratch/runs/20261108-darkstone-failure-retention-2116/`.
The focused controls compile the actual 2105 consumer and run its send/evaluate,
message handler, close, execute and outer failure handler with a real Node child
and inherited stdout/stderr writer. Only CDP observations are substituted. The
prior adapter is read directly from Git `2a83f628d1ac15d705e97b7247dce59e97420d16`.
The prior implementation reproduces profile deletion after startup timeout,
shutdown evaluate timeout and a client fault arriving during drain. The repair
retains the sentinel profile bytes, suppresses cleanup/quit ACK, and refuses a
new request in each case despite actual exit 0 and log EOF. The repaired startup
case waits the actual 20,000 ms evaluation timer and then delivers a late response
to the actual message handler. Other fault cases accelerate only test timers.
The positive case uses the real transport's legal 55,000 ms default and consumer
ACK, once, after child terminal wait and inherited writer EOF; no synthetic quit
ACK is used. Existing sticky UNKNOWN/noReplay and finite drain controls also run.

The actual 2105 trace has314 owned tasks and314 actual terminal reaps, but remains
incomplete. Task 7535 / start 17834 / TGID 6629 / PPID 6533 first appears at custody 2439,
already at PTRACE_EVENT_EXIT 1541 (2440); GETEVENTMSG confirms exit 0 (2441), followed
by WNOWAIT before-reap 2445 and terminal reap 2446 / status 0. No fork/clone parent
event names 7535 anywhere in the retained journal. Cancellation is empty. The
last consumed 6629 clone event names 7474 at 2121; nearby 7536 and 7537 have their own
separate parent events. Neither group membership nor PPID identifies 7535's
creating task. There is no supported causal kernel change from these bytes:
retain irreversible retirement and failclosed unresolved lineage. Kernel code
is unchanged. Startup timeout cause remains UNKNOWN; its relationship to this
missing lineage is unproved. Q2 2052 successfully starts the same kernel 5371233b,
so these results do not establish universal startup failure.

The exact de53 pair remains unchanged: characters.lpl 1,342,324 B SHA256
2c78a17064029385dee4206c9314673debb4de05205ae63d2ff144b9e6081546;
game641d_6af0de53.sav 3,204,341 B SHA256
cb2ca8093b2ffe45133cda87e3eea9ceafad66fd82246684ec40dd97306e66fc.
Historical 35/35 is not a postreload reading. No game, Chrome, remote, box,
subworker, guest write, media/module copy, source archive, peer edit, old-run
deletion, configuration change or deployment occurs in this task.
Box NONE / NOT_CREATED, expiry NULL, stop receipt NA. Local commands have independent
timeout deadlines. Sampled /home free space remains above 1,500,000,000 B; no RAM gate.

Validation and publication results are recorded below before release.
Full27, parity, audio and FPS remain open. A future separately authorized
original may qualify startup and normal quit; this task does not launch it.

Validation: 34 focused tests and 81 existing GLTron checks passed. The locked
full build passed, producing canonical 2,184,500 B and compat 2,187,146 B wasm.
The initial build's active peer lifetime-review mismatch is retained in
`build.log.gz`; `build-2.log.gz` records the passing build after the peer refresh.
No peer source or census entry was edited. The final writer fixture creates the
inherited writer at shutdown, so even the real 20-second timeout case waits
for child exit and subsequent writer EOF. Earlier passing fixture iterations
are retained with their own logs.

Recovery records the exact Git base plus a small binary diff of only the three
owned source/test/note paths, with a reverse-apply check. Existing helper, module,
media and exact save paths are referenced by SHA and size. Every regular run
file is inventoried without an extension filter; gzip originals are independently
read through gzip and zlib CRC validation, and logger producer receipts are
compared against recovered bytes. The inventory's own row is explicitly unhashed.
