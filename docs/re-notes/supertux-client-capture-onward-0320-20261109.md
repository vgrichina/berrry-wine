# SuperTux 0320: setup capture requested before readiness

The requested new coin/block consequence or onward exit was **not achieved**.
The one authorized original stopped at its first helper UNKNOWN. I submitted
the setup `menu` capture before the driver had published readiness. Its
unchanged 30-second ACK deadline expired at **03:22:26.108Z**. This was my
sequencing error; no emulator gameplay defect was established. No code changed.

Evidence: `scratch/runs/20261109-supertux-client-capture-onward-0320/`.
The numbered command inventory contains only `menu`, action `capture`, with
no consumed marker; `native-input.json` is empty. Native Pause was never
reached, and no gameplay action or review-client capture/choice ran.
There was no retry or subsequent worker input/capture request.
However, the already-running driver automatically made `startup.png` at
**03:22:33.420Z**, 7.312 seconds after the helper failure, before its consumer
observed sticky transport closure at **03:22:33.687Z**. Thus the strict
no-later-capture sequence was **not fully satisfied**. I personally inspected
that recovered PNG: black loading viewport, small white patch, and launch log;
no native menu, Pause, or gameplay consequence. Its SHA-256 is
`294fcf5bef67deaf3460ec60ea8a779e2578c21d08df8f053c985e6f96d7717a`.

Before allocation, a new tiny offline check exercised the production review
client, shipped page in a VM, and real HTTP. It verified that a separate setup
capture leaves this client's `current` empty and choices disabled, then used
the helper's explicit capture expression and reviewed choice expression.
The resulting command order was `capture`, then `pause-step`, with the exact
client capture reference. The 12-second bound stayed unchanged; no local
browser/game or route/detector/replay/retimestamp/freshness bypass was used.
This proves the offline client sequence, not actual native gameplay.
`offline-initial-sequence.json.gz` records it. Prior prepared checks and locked
build, including `df0932c1c` failure replies and airborne-only neutral settling,
were reopened and verified by exact SHA/size; identical tests were not rerun.

The exact Q2upstream0301 release was **03:16:04Z**, box `bx_m6w3a76f`,
receipt `stop_c41c040c0474c08a`. Providers were pinned to published Git
`0060f6935fbed715655c59cf4efa28b5141ee963`, including custody helper SHA
`fb670a47d4712aa44fd2fae3d2047587374c0e1c2bb4e927ff87572147dfcfff`;
concurrent offline edits were excluded. The new final manifest covers
**1,512 providers / 61,533,396 bytes**, SHA
`29a816e03799bec4abc226c2ed33a4672d83816158a30f0b42ece9e5dc04436e`.
CPU remained `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
native observation stayed OFF and existing caps stayed unchanged. Git commits
and small input patches preserve source; no source/media/module archive was made.

Independent watchdog UUID `e1f56dec-d15f-4b84-86b4-e5d5d4b2c483`,
PID **936115/start224166487**, was observable at **03:20:55.670Z** before
finite-TTL creation. Its immutable deadline was **03:45:55.555Z**.
The sole box **bx_nv58ujct** was created at **03:21:08.191Z**, TTL **1,487 s**,
initial `archiveAfter=03:45:55.052Z`; `expiresAt` was not returned.
The original execution began at **03:21:43.144Z**.

Automatic no-input cleanup received Browser.close ACK but required TERM/KILL:
`normal=false`, **26,008 ms** under the unchanged 30-second cap, terminal code
0 and drained streams. This is not normal browser-close acceptance.
Generic cleanup retained `pending="UNKNOWN; never replay"`; both physical
drain records separately report 0. Kernel custody verified **181 owned
identities / 181 actual reaps / 1,639 events**, including before-wait witnesses,
complete=true and no unresolved lineage. Kernel parent **6697/start17241**
actually waited **1**; outer parent **6694/start17231** waited **0**; both have
separate stdout/stderr EOF. The client exited 0 with both EOFs. Ports 36515,
42095 and 8787, writable run FDs, profile and locks drained. Historical
CLONE_UNTRACED/nonleader-exec/external-signal limitations remain UNKNOWN.

Recovery retained **74 regular files / 55 unique transports / 412,572 stored
bytes**. Original/stored SHA-256, sizes, independent reopen, GNU gzip CRC and
exact-set checks passed **before** delegated normal archive. Box archive
completed at **03:23:37.416Z**, receipt **stop_c8259d6d99763a57**,
`forced=false`, `error=null`, `stoppedAt=03:23:37.398Z`, final
`archiveAfter=null`. Local runtime and watchdog-supervisor wrappers actually
waited 0 with separate EOFs; watchdog waited 0 and board tail -15, both streams
closed. Recorded local identities were absent. Physical release was posted
at **03:24:16Z**, with the automatic-capture correction at **03:24:34Z**.

Free /home remained above 1.5 GB. No agents/workers, peer boxes, local browser,
heavy local execution, RAM gate or deployment. Full 27/parity/audio/FPS remain
open. A future separately authorized original must wait for actual readiness
before its first setup request, then reach Pause, explicitly request the review
client's initial capture, inspect it, and choose promptly. This single task stops.
