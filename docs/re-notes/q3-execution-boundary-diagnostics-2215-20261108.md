# Q3 execution-boundary diagnostic — 2026-11-08 22:15Z

Added `tools/q3-execution-boundary.cjs`, an explicitly enabled Node preload for the **actual retained** `scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs`. It leaves that consumer and its helpers byte-for-byte unchanged. No original retry was performed or authorized here.

Read the [accepted latency analysis](q3-owner-capture-latency-2203-20261108.md), its [original report](q3-gl-readiness-gameplay-20261108.md), and the referenced retained consumer, bound-input, trace, transport, observer and producer helpers. This is boundary instrumentation, not another bottleneck investigation or a causal fix. The 11,152 ms renderer span and final pending page evaluation remain distinct observations.

For a separately authorized invocation, prepend the following environment/Node options to the existing invocation, keeping all its existing environment and arguments:

```sh
Q3_EXECUTION_BOUNDARY_OUT=/absolute/new/run/execution-boundary.jsonl.gz \
node --require /home/user/wine-assembly/tools/q3-execution-boundary.cjs \
  /home/user/wine-assembly/scratch/runs/20261108-q3-gl-readiness-gameplay/browser-run.cjs
```

The output parent must already exist. The preload refuses another consumer path and refuses an existing output file. Without the environment opt-in, requiring the tool only exports its functions. This command is usage documentation, not authorization to run it. Future staging must include the new tool as an explicit pinned input.

Only the genuine PAGE_READ, RENDER_READ and WORKER_READ evaluations are wrapped. Entry is emitted by the first executed JS statements, using a nonce-scoped console CDP event; exit/error is emitted around the original expression, which executes once. The returned value/error and CDP options are preserved. Diagnostic events are intercepted before the consumer's console logger. The record contains original expression SHA, CDP request/session, actual console executionContextId, runtime monotonic entry/exit, and returned document/owner/context/module-object tokens. Those tokens are diagnostic observations, never substitutes for the existing binding or independent module-byte checks.

The existing Node-side `trace.snapshot` deadline hook synchronously copies a bounded ring without sending another CDP request or joining the stalled page. Ring capacity defaults to 64 (hard maximum 128), owner-token payloads are capped at 4,096 characters, and at most eight snapshots are written as concatenated gzip members from the first byte. A process-exit snapshot also uses that allowance. Evictions and observer errors are explicit. The file can be recovered after an outer command deadline even when an evaluation remains unresolved. An externally killed process cannot supply a final snapshot; previously written members remain recoverable.

No-entry means **entry unavailable**, including response-without-marker. Entry without exit means **entered; exit unavailable**. Console event delivery can lag JS execution: host send/receive timestamps are not execution times, and no cross-process clock subtraction is made. Queue residence is explicitly null. Same-evaluation runtime monotonic duration describes the synchronous owner expression only. This smallest boundary can distinguish received execution entry/exit from an unresolved CDP request; it cannot prove that a missing entry was queued, or measure an original GPU stall. Renderer batch/opcode/native GPU and page frame-consumer instrumentation remain absent. No fabricated GL readiness, timing or completion is added.

Offline validation uses the exact retained expressions in Node VM contexts and the genuine retained `transport.consume`, `bound.hold` and admission chain. Synthetic registry/endpoint/CDP event fixtures are explicitly fixtures: no browser, game, hardware renderer, real input or remote runtime is exercised. Controls cover execution entry/exit/error, interrupted execution with partial entry, no entry, response without entry, token correlation, ring/output bounds, unchanged input forwarding, work-deadline and error closure, late result without successful ACK, duplicate/no replay, closed chain, and independent key release while the passive sample is pending. The initial throwing-global-getter VM fixture did not throw; its failure is retained, and the corrected throwing-map fixture passes. The focused test and required `flock /tmp/wine-build.lock bash tools/build.sh` pass.

Evidence: `scratch/runs/20261108-q3-execution-boundary-diagnostics-2215/`. Every log uses gzip from its first written byte. Evidence records original/stored SHA-256 and sizes with independent reread/decompression CRC checks, exact Git base plus owned-file patches, and existing media/module PATH/HASH references without copies. The first background board-watch attempt exited before staying armed and left an empty file; that fact is retained explicitly. A foreground observable 3,600-second timeout was armed before final verification and stopped afterward. Disk samples initially crossed below the required floor; writes were held and the coordinator restored headroom by losslessly compressing its owned closed system logs. Only sampled floor compliance is claimed.

No host/census/Drakan/Q2, timeouts, backend, configuration, guest clocks or readiness rules changed. Full27, parity, audio, FPS and WebGL gameplay remain open; accepted SoftwareGL torch evidence is preserved. Next: use this opt-in only during a separately authorized run, then inspect actual boundary records before choosing further probes or a repair.

Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop receipt **NA**. Single-task worker; no agents spawned.
