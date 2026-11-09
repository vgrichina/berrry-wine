# Quake II ordinary quit: custody retirement dependency, 0832

Production shutdown is **not repaired**. The concrete dependency is the shared
ptrace supervisor's synchronous journal service on the terminal-wait path.
Changing that provider is expressly outside this task. The executable offline
reproduction is `tools/quake2-joined-quit.test.cjs`; evidence is
`scratch/runs/20261109-quake2-joined-quit-repair-0832/`. No grace, escalation,
terminal classification, production provider or game behavior was changed.

## Exact historical trace and composition

The 0820 `browser-close.jsonl.gz` records close ACK at 08:21:41.659,
SIGTERM at 08:21:51.495, exit0 at 08:21:53.189 and drain at 08:21:53.772.
Its cap is 19827ms, elapsed 12113ms, normal false. That classification is
correct and remains unchanged.

The matching `custody.ndjson.gz`, rather than the receipt alone, establishes
active kernel retirement across the grace boundary: **393 records, 94 EXIT
stops and 93 actual reaps between ACK and TERM**. Chrome PID6970/start12403
has a clone event at 08:21:41.685 and fork-parent release at 41.775. Its
thread8523 exits at 50.278 and is reaped0 at 50.345. Other Chrome thread EXIT
stops continue across TERM (thread7062 at 51.519 through thread7019 at
53.018). PID6970's own EXIT stop is consumed at 53.049 and terminal wait0
at 53.158; the Node exit observer follows at 53.189. These are real ptrace
stops and terminal waits, not inferred waits from absence or an ACK.

`native_kernel_custody.py` performs journal write/flush/fsync synchronously for
each record, including before consuming stops, before releasing EXIT stops and
at terminal retirement. That serial service delays completion of group exit
and delivery to the driver's real ChildProcess observer. The driver composes
the unchanged close helper with approximately half of quit's remaining work
budget as grace and two bounded escalation phases. It cannot ACK ordinary
quit until real exit and separate stream closure have completed. Consequently,
supervisor service can cross the grace threshold while ordinary exit is
already progressing; the helper must then record escalation and reject quit.

Historical per-syscall latency was not captured. The journal proves the
retirement backlog and ordering; it does **not** isolate fsync from scheduling
or other per-record work, or prove that no other Chrome delay contributed.
Closing CDP earlier is not an established remedy: predecessor0244 already
tested a socket-close/callback candidate which still escalated. No such
speculative change is promoted here.

## Actual offline dependency reproduction

The new test runs the actual composed driver command loop, actual Python
`Caller.request`, numbered production transport and actual close helper under
the **unchanged production ptrace supervisor**. Only game startup, browser/CDP
and remote transport are inert fixtures. The browser substitute is a Python
process with 110 native threads. It ACKs the close protocol and initiates
ordinary exit; there is no Chrome, original PE, guest, module or media load.

The unpaced control completes normal exit, drain and numbered quit ACK. The
fault control adds 50ms per journal write after close begins, exclusively in
the test process, modeling slow supervisor journal service. It reproduces
ACK → TERM → exit0 → EOF → normal:false, and rejects quit without a reply or
successful cleanup marker. This is a deterministic dependency reproduction,
**not an oldFAIL/newPASS production repair or measured historical fsync replay**.
Both controls retain every actual wait, separate stdout/stderr EOF and complete
122-owned/122-reaped custody. The caller and supervisor are actually joined.
No guest CDP follows Browser.close. Each independent deadline watchdog is
armed before requests, stopped after joining and actually waited with separate
EOF; none fired.

The complete existing composition suite also passes: all 21 scenarios,
including normal quit, TERM/exit0 rejection, KILL, ACK stall, inherited delayed
EOF, pending capture cancellation, sticky first failure, motion/release checks
and independent cleanup. Its budget controls retain work20s, ACK22s and
cleanup30s. All 10 close-helper tests pass. The required locked build passes;
CPU remains 2185596 bytes, SHA256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

The staged-root invocation correction and the exact production preCPU/preDLLmain
ownership gate remain untouched. No new native qualification or gameplay
claim is made. Initial development runs caught a test initialization error and
two expectation errors; they are retained separately and excluded from final
acceptance. The first paced control remained normal and is also retained.

## Boundary and next work

Reducing synchronous supervisor service on EXIT/reap progress requires a
separately authorized custody change preserving durable identity evidence,
actual wait coverage and EOF. That is the concrete next dependency. Within
the owned driver/helper scope, extending grace, suppressing the recorded TERM,
or accepting exit0 after TERM would violate explicit task constraints.

Recovery records Git base plus a small patch containing the owned test/note;
historical traces are referenced by path/size/SHA instead of copied. Logs are
gzip and independently reread. No source/media/module archive was made.
Free /home stayed above 1.5GB. No shared host/WAT/custody, HeroesII or Claude
files were edited. No agents, workers, Chrome, boxes or deployment were used.
Box ID/state/expiry/stop receipt: **NULL / NOT_CREATED / NULL / NULL**.
Single-task STOP.
