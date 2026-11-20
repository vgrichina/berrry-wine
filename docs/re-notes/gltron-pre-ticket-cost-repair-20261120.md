# GLTron immutable attestation and bounded pre-ticket retries

Evidence: `scratch/runs/20261120-gltron-pre-ticket-cost-repair/result.json`.

The source regression fails on the old binding at the unchanged five-second
PREBIND deadline. The candidate prepares immutable attestation before PREBIND,
retrieves module bytes once per actual Worker/script/instance incarnation, and
reuses that proof only within the bounded pre-ticket intent. Every arm still
reads the live page owner, output, context references, publication and paint
readiness. Separate intents and post-capture validation retain actual Worker
instance and renderer endpoint reads. Context lifecycle events, new wasm
scripts, retirement, replacement and hidden output invalidate admission.
No scene pixels, publication timestamps or readiness results are memoized.

The deterministic cost regression uses the measured 594 ms identity and 158 ms
bytecode request costs. Old source expires before its third arm. New source
prepares in 1346 modeled ms, reaches all three arms, and sends zero Worker
identity or bytecode requests inside PREBIND. Eighteen focused invalidation
cases pass, including renderer replacement and invalidation between positive
NOT_READY arms. This is a source regression, not a browser latency benchmark.
The existing native-input, capture and real-child controller regressions pass;
the full `flock /tmp/wine-build.lock bash tools/build.sh` exits zero.

The fresh original uses the exact f696 runtime, a600 module and 92 existing
media pins with the existing three passive observer overlays. Shared RPC and
native-input source are read-only. Four fresh main-menu/current-display
captures pass using the repaired binding. The selected complete browser images
were returned for personal review. Host fullscreen consent succeeds. Two
expired local release windows refuse before guest input; a subsequent timely
Enter opens the visibly reviewed GAME submenu. A further Enter selects START
GAME with independently joined UP and physical neutral. The existing release
ordering and deadlines were retained; no release-window extension was made.

The next, distinct round-pause intent exhausts the original five-second window.
It observes publications 373 through 385, reaches readiness once, then receives
66 positive pre-ticket NOT_READY arms for held/in-flight paint. Across the
observed window, all 172 subsequent requests are Runtime.evaluate on the page
session: zero Worker requests and zero module-bytecode requests. No capture
ticket or Space DOWN is issued. Thus the repeated identity/bytecode cost is
removed, but ordinary paint readiness remains a newly evidenced dependency.
The deeper reason for that held-paint interval is unknown. This scope closes
permanently; there are no later endpoint requests or unchanged static campaign.
Two turns, pause/resume, visible round outcome and ordinary Quit are unproved.

Supervisor and independent watchdog join with both EOFs; the supervisor reports
`leaked:false`. Browser, Xvfb, Openbox and release children have actual waits.
The outer tool returns 143 separately from the saved supervisor exit 1 and
watchdog exit 0; its signal cause is unknown. Runtime disk monitor minimum is
1,793,978,368 bytes. Selected screenshots, compact request/reply joins, unique
receipts, owned patches and recovery references are retained; no bytecode
payloads, media copies or source-tree snapshot are retained.

No box was created: ID, expiry and stop receipt are null. No agents, workers,
Python, Wine, public deployment or Windows reference run were used.
