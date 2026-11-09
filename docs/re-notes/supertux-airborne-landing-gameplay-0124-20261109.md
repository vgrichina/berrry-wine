# SuperTux: stale native menu admission must close the original

The one fresh original reached the world map, but did not enter the first
level. Landing beyond the first pillar, onward gameplay, and the exit remain
unverified. The run reproduced a production composition defect: a stale menu
action escaped as a refreshable refusal instead of reaching the driver's
terminal close handler. The composition now wraps failed ordinary bound
actions with a sticky UNKNOWN while retaining the original cause. The generic
retained transport and all input choices, freshness/ACK limits, and controller
caps are unchanged. No second original was attempted.
The new client server started, but no review-page gameplay choice or airborne
neutral settle was reached.

Evidence: `scratch/runs/20261109-supertux-airborne-landing-gameplay-0124/`.
The exact fresh `world-map` image was captured at **01:55:17.757Z**, SHA-256
`762cf867eef41d26dde1802dc1e23f73f8cd45d48965e963669a826d7e400498`.
The attempted `map-down` command was prepared at age **12,000.421 ms**,
already outside the unchanged 12-second limit and missing the 8-second aim.
The original ACK says `refused-before-dispatch`, `effects=0`,
`refreshRequired=true`, `Error: stale scene refused`. No ArrowDown was sent.
The menu helper incorrectly assumed a new capture existed and reported ENOENT.
There were no later game inputs or screenshots. An ordinary quit request was
also refused before dispatch because the generic transport permits only a
capture after that refusal. The resulting lifecycle failure is the repair's
concrete native reproduction, rather than an artificial gameplay fixture.

`runBoundAction` now removes the refreshable error code from the thrown wrapper
and preserves it on `cause`. The actual composed ordinary action calls this
wrapper, so the numbered consumer writes its first-failure record and throws
to the existing driver close handler immediately. A later command cannot be
admitted. Pause-controller error propagation remains unchanged.

`menu-failure-focused-02` exercised the actual composed `execute` function and
retained numbered consumer: stale menu admission caused zero effects, no
success/refresh ACK, and a sticky first failure; a following command caused
zero effects. A normal ArrowDown still produced its unchanged key pair and
fresh capture, with zero pending physical input. Generic identity failure
retained its original cause. This was an offline Node fixture, not another
browser or original. The initial fixture omitted `root` from its VM context;
that pre-input harness failure is retained. The corrected final test passed.
The locked build passed, with CPU SHA-256 unchanged at
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.

Before allocation, unchanged 0116/0046 accepted controls were verified and
reused by PATH+HASH. The exact singular `key Enter 100` menu payload ran through
the actual composed executor offline; plural `keys` failed before dispatch.
The corrected final local and remote barriers matched **1,424 providers /
61,368,843 bytes**, manifest SHA-256
`3ca41ae03490faa816c512c6025ae795844119034c8a50eaa0fb7afc006d9153`.
The original used the published **82d028903** client/controller/composition,
current CPU a320, and observation OFF. The production repair was made only
after the original failed; it was not loaded into that original.

Q2's exact archived/physical-drained release was posted at **01:50:42Z**.
Its historical wait/EOF UNKNOWN limits were preserved. Our release watcher
actually waited 0 and its tail was awaited. A redundant pre-allocation release
check tried to exclusively create the watcher's already existing receipt and
failed with FileExistsError. It was corrected to validate the existing receipt
and write a separate check. No box or input existed at that preparation error;
the failure, corrected proof, and corrected source patches are retained.

An independent watchdog was prearmed at **01:51:20Z**, immutable UUID
`cb884f68-9b8b-48ac-abdc-3b76a93612cf`, deadline **02:16:20.506Z**.
The sole box **bx_vffc4fdv** was created at **01:52:15Z**, TTL **1,445 seconds**,
initial `archiveAfter=02:16:20.500Z`; `expiresAt` was not returned. The original
started at **01:53:34.325Z**. After failure, an independent Browser.close request
received ACK and socket EOF; its Node child actually waited 0 with stream EOF.
The socket also emitted an ErrorEvent, retained verbatim. Verified PID/start
custody cancellation then terminated the original. Normal driver/client close
is UNKNOWN; the independent close receipt does not substitute for it.

Custody verified **346 owned identities / 346 actual reaps / 3,961 events**,
including before-wait witnesses. The kernel parent actually waited **1**, the
outer parent **0**, and the local Boat launch **0**, all with EOF. Ports
**44623, 38729, 8787**, writable run FDs, profile, writer/input lock, and runtime
lock were drained. The empty stale review-client lock was removed only after
all kernel-owned identities were absent and its port was closed. That initial
strict drain failure and subsequent successful proof are both retained.
Sixty-two recorded local identities were absent and all 36 recorded command
waits had actual wait/EOF receipts. Transient remote menu subprocesses used
`subprocess.run`, but individual PID/start receipts were not captured; no claim
of complete historical child identity accounting is made. Historical
status-143, nonleader-exec, untraced-clone, and external-signal limits persist.

All **569 remote regular files / 429 unique transports** were initially
retrieved with stored/original SHA-256 and size verification. The strict first
recovery failed on a truncated gzip; the corrected recovery preserved exact
original bytes without inventing footers. Two original client gzip streams
(empty stderr and a header-only stdout) retain UNKNOWN original CRC. Retained
outer transports passed independent SHA-256, sizes, GNU gzip CRC, and exact-set
verification before normal box stop. All other retained original gzip streams
passed CRC.

Unneeded Chrome vendor component/profile cache downloads unexpectedly inflated
recovery. Free disk temporarily fell to **1,463,513,088 bytes**, violating the
1.5 GB floor. Only **37 owned unneeded cache transports / 48,219,651 bytes**
were removed, after stored/raw SHA, size and CRC checks and a recorded inventory;
game providers, captures, logs, and tested CPU modules were excluded. The
remaining **392 transports** passed independent verification. Free space was
restored above 1.5 GB. This dip is not claimed as compliant operation.

The box was **archived at 02:02:18.138Z**; stop receipt
**stop_69e9d70ec73faf7b** completed at **02:02:18.157Z**, `forced=false`,
`error=null`. Final `archiveAfter=null`, `expiresAt` not returned. Watchdog
788979 actually waited 0, tail 788980 waited -15, their streams closed, and the
supervisor tool was awaited 0. Physical runtime release was posted at 02:02:58Z.
Git SHA plus small owned patches preserve source; no source/media/module
archives, peer box access, peer deletion, agents, RAM gate, or public deployment
were used. Next gameplay requires a separately authorized original and fresh
personal review submitted early enough for the unchanged 12-second bound.
