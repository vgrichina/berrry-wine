# Q3 instrumented WebGL attempt — 2026-11-08 22:48Z

**Stopped at browser startup; gameplay and GL execution remain UNKNOWN.** One
fresh box, one Chrome launch, zero guest launches or input commands, no retry.
I retained the old browser consumer's 100×100 ms DevTools readiness loop rather
than selecting the published readiness adapter. It failed with missing
`DevToolsActivePort` at **22:53:25.629Z**. This failed startup supplies no new
page/render/opcode/frame boundary or movement, firing or torch evidence.

The accepted execution preload was installed before the consumer. A run-local
adapter arranged `GLRenderHost.configureDiagnostics` at module assignment before
host-import construction, with synchronous partial export at existing page-owner
reads. Navigation never occurred, so diagnostic arming and owning module/backend/
endpoint qualification were **not observed**. The execution-preload exit snapshot
has no owner evaluations. Stuck-page retrieval remains unavailable/UNKNOWN;
the old renderer span2667 and PAGE419 remain separate, unreproduced observations.
No GPU completion, latency cause, native WebGL provider or gameplay claim follows.

Selected source: Git `629a84ab232f5f04980e33cd8403f8e185cc0ffa`, with exact kernel
blob from `dec33253ced7f76b850c63f7ad1137c7f214b1ef` (SHA-256
`fb670a47d4712aa44fd2fae3d2047587374c0e1c2bb4e927ff87572147dfcfff`).
All 927 providers verified remotely before launch. The three Q2 files came from
that exact committed object; no peer working-tree hunks were absorbed. The board
subsequently confirms publication; preallocation publication timing was not
independently recorded. Standard module `4b45bda5…`,2,184,500 bytes, was staged
but never qualified in an owning game Worker. Existing helpers/media and accepted
diagnostic artifacts are referenced by path/hash without identical control reruns.

New offline checks cover only the run adapter: the actual selected hold arms UP
before DOWN, releases while DOWN/sampling is pending, rejects overdue delivery,
and awaits actual UP completion with timestamps. Driver preflight passes without
Chrome/guest execution. Initial ambiguous-anchor and incorrectly expected
successful-overdue-DOWN fixture failures are preserved. No production repair or
code commit was made; no new production build was required.

Shutdown has two distinct outcomes. The native close consumer sent TERM/KILL,
observed Chrome exit code0, then reported **drained:false, normal:false** at its
30-second cap. Its error and unhandled-close traceback remain failures, not a
normal Chrome/drain claim. Later kernel custody recorded136 owned/136 reaped,
complete:true, matched pre-reap witnesses, command EOF and closed journals. The
runtime parent actually waited status1 with EOF. Final checks proved ports39539
and43899 closed, no evidence writers, no input/writer lock, and runtime lock
drained. The profile was retained and retired only after those checks. DevTools
stderr eventually names43899; its untimestamped listening line does not establish
the endpoint's publication time. Untraced-clone/nonleader historical limits remain.

All 205 final remote regular files were inventoried without name filters;
107 unique non-source artifacts,4,278,267 stored bytes, were independently
retrieved and reread for original/stored SHA-256,size and gzip CRC before stop.
Final recovery reused already retrieved hashes. A local mkdir error and premature
normal-role assertion sent no stop; lowercase API state initially caused an
observation-only false failure. The single stop was not repeated.

Box **bx_vpnvz8r6**, actual final state **archived**, `archiveAfter:null`;
`expiresAt` **NOT RETURNED**. Initial `archiveAfter` was
`2026-11-08T23:17:11.379Z`, finite TTL1499s. Normal box stop
**stop_02b88c9f7da7cda5** completed **22:56:29.706Z**, `forced:false,error:null`;
`stoppedAt:2026-11-08T22:56:29.687Z`. Durable UUID and observable immutable
25-minute watchdog preceded allocation; watchdog actual wait0 was recorded by
the same-shell EXIT trap. The independent board watcher was also awaited.

Evidence: `scratch/runs/20261108-q3-instrumented-webgl-gameplay-2248/`, gzip from
first stored log byte, exact Git plus small owned patches, exhaustive local
regular-file inventory with independent CRC/hash reread. Sampled /home free
space exceeded1,500,000,000B; no continuous-floor claim, RAM gate, source archive,
media/module copy, old-box access/deletion, local browser, other agent or deploy.
Next requires a separate assignment addressing the exact startup adapter and
terminal-drain integration before another original. This single task stops here.
