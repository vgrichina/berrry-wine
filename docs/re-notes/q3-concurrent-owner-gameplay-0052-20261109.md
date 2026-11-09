# Q3 concurrent capture probes: menus reached, gameplay unverified — 2026-11-09

The sole fresh original produced nine personally reviewed menu screenshots and
eight numbered ACKs, but no in-world movement or firing. This task reports a
concrete runtime/lifecycle blocker, not completion of gameplay or a published
code repair. Evidence: `scratch/runs/20261109-q3-concurrent-owner-gameplay-0052/`.

The new instrumentation from `8f4053d5f` was present in the actual composed
initializer and actual runtime. All nine screenshot requests received raw
responses; all 36 concurrent PAGE/guest/render-owner/GL-producer reads returned
with matching sessions. Their numbered requests, send returns, responses,
lifecycle generations and bounded values are retained in
`actual-run-analysis.json.gz` and the recovered completion log. Actual captures
were 165, 217, 264, 314, 359, 399, 453, 499 and 543. Response intervals were
1127.118, 184.680, 15486.186, 840.681, 204.640, 3153.993, 111.428, 211.110 and
3869.633ms respectively. This original did not reproduce historical343's
missing screenshot reply.

For screenshot264, page265, guest266, render267 and producer268 returned while
capture was pending. The same recorded adapter/bridge/context owner0 reported
WebGL with `control:null`; producer draws advanced270407→270499,
completed311188→311324, presentation797→798 and writeSeq797→798. Other captures
also retain actual advancing or unchanged counters. These receipts distinguish
the producer from the legacy null control and precede the raw capture response;
they do not prove browser compositor completion, guest input acceptance or
gameplay. Missing lifecycle events still cannot prove continuity. No GPU or
emulator cause is assigned.

There is a significant first-UNKNOWN handling failure. The local Boat launch
client PID735363/start223384924 returned SIGPIPE, actual wait−13/EOF, at
01:12:12.275Z. The remote runtime continued. This failure was noticed late,
after later menu commands had been sent. Only the initial startup capture
predates that launch transport failure. The later eight ACKs/captures remain
diagnostic observations and cannot qualify this as a first-UNKNOWN-compliant
attempt. No claim of transport continuity is inferred from the continuing
remote browser. The cause of SIGPIPE is unresolved. After recognition there
were no further inputs, captures, original retries, second life or second box.

The reviewed route was main menu → CHOOSE LEVEL/Q3DM1, followed by ordinary
Enter, Tab, click and arrow choices. An ArrowDown produced a visible focus border
around Q3DM7; ArrowUp returned it to Q3DM1. All reviewed frames remained menus.
The subsequent `menu_wrap` request was refused before queueing because it could
not fit the immutable run/cleanup deadlines. It dispatched no input. No failed
command was replayed and no native input, clock, screenshot options, caps or ACK
implementation was changed.

The immutable runtime cap fired01:18:40.340Z. Its browser-close path did not
produce a terminal-browser receipt. Kernel custody then hit the unchanged
cleanup deadline: `TimeoutError('immutable cleanup deadline')`, complete:false,
317 actual reaps from350 recorded tasks,33 missing waits, command-log EOF:false.
All retained317 reaps have earlier PID/start before-wait witnesses in the
3652-event journal. These missing terminal events remain missing. Later physical
absence does not repair custody. Historical143, untraced clones and nonleader
UNKNOWN remain unchanged.

Remote runtime PID6571/start13622 and prelaunch PID6570/start13602 each have
actual parent wait1/EOF. The launch parent PID5907/start8868 is absent. A separate
postmortem verified all353 recorded identities absent, ports37593/44687 closed,
no runtime FD holders, input writer lock absent and runtime lock drained. The
closed profile was retired outside the evidence roots; no profile cache,
source tree, repeated media or module archive was copied. This is a physical
drain receipt, explicitly not a successful historical custody drain or normal
browser close.

Before box stop, all143 remote regular evidence files were accounted for;
133 unique retained files total3250762 stored bytes. Independent SHA256sum,
stored/original sizes, GNUgzip CRC and exact-file coverage passed; no incomplete
gzip streams were found. The box was stopped promptly after evidence recovery
and physical checks, with the custody failure explicitly retained as the stop
basis. **bx_74fcszqf is archived**, stopped01:22:12.233Z. Stop
**stop_4ec176eaed70bd18** completed01:22:12.252Z, forced:false/error:null.
Initial finite TTL1499s archiveAfter01:33:58.706Z; final archiveAfter:null,
no separate expiresAt returned. Independent watchdog PID733912 and its allocation
parent have actual wait0/EOF. Physical runtime release was posted01:22:29Z.

Allocation followed SuperTux0046's explicit01:08:11Z ARCHIVED/DRAINED release and
an exact board ownership check. Local final barrier preceded allocation, and
the identical remote barrier preceded the original claim:918 canonical providers,
101798806bytes, manifest SHA256
`a63955a1a75907ed48c7bde04bdd2a096d41792d555dddee69960e09c458a123`.
Tested Git was `ba5c62c38eb44048e4eff73d648d10cd0a91a9bb`, relevant tracked WIP
empty. The graph includes the screenshot helper, producer-ready provider and
four current library additions. Actual CPU was2185596bytes, SHA256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
production URL used threads with WebGL renderers, observation flags default OFF.
Marker SHA256 remains byte-identical
`1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d`.
Accepted nine real transport controls and PATHHASH proofs were verified/reused;
the actual composed initializer compiled offline. No production code changed,
so no new build or code-test claim is made.

The first barrier-inspection helper used the wrong directory; its reader was
corrected before inputs and the identical-barrier proof retained. A helper named
inspect.py also shadowed Python's inspect module during exception reporting; it
was renamed. The first physical-check helper had an escaped-bytes syntax error
before execution, corrected before the successful check. These are run harness
errors, not claimed production repairs. Git SHA plus small run-input patches
retain source identity. No workers, local heavy runtime, peer box access, peer/old
deletion, RAM gate or public deployment occurred; free /home stayed above1.5GB.

Next work must address prompt observation of launch-client failure and the
retained bounded-custody shutdown failure before any separately authorized
original. This task stops with archived evidence and concrete blockers;
movement/firing/death remain UNVERIFIED.
