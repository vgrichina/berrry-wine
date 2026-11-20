# GLTron PREBIND: static fixture passes; worker scheduling exhausts original window

Evidence: `scratch/runs/20261120-gltron-prebind-static-gate/result.json`.
This investigation establishes a narrower cause of the parent's third capture
timeout. It does **not** establish a repair, an oldfail/newpass regression, or
original turns, pause/resume, round outcome or Quit.

The fresh localhost headful native GL fixture used the exact f696 graph,
a600 module and 92 media pins referenced by
`20261120-gltron-software-live-turns-round/prepared.json`. The parent module,
media and fixture are referenced, not copied. The same three passive execution
observer overlays were applied. Actual guest export/function-location/module
joins and software executor/native publication joins passed for every intent.
Only the runlocal fixture app selector needed adapting to `live_input_fixture`;
the production binding, deadlines and admission guards were unchanged.

Three separate current-display intents passed on the unchanged draw-once
fixture. They retained publication **12**, displayed at **1795144967619**, and
requested new tickets at **1795144972538**, **1795144988532**, and
**1795145005775**. Each has its own nonce. The last is more than 30 seconds
after the original display publication. All report `already-displayed`, real
canvas readback, no held writer, and no retained publication pixels. There was
no forced repaint, fake timestamp or borrowed pixel buffer. The only injected
input was trusted host fullscreen consent with independently armed UP; no guest
gameplay input was sent. The selected whole frame was personally inspected:
yellow triangle on the intact blue native client, browser fullscreen.

The old timeout is more specific than expensive attestation after PREBIND:
the repaired parent already moved that attestation before the five-second
deadline. Its final intent first returned readiness at 1795142593633. Its next
two synchronous pre-ticket arms positively returned `NOT_READY` for
`held/in-flight paint`, with publications 204 and 207. These were genuine
continuing publications, not a static/no-publication condition. There was no
ticket to poll, fail, cancel or reuse. The final arm expired before ticket
creation and permanently closed the old scope, with zero guest DOWN.

`parent-final-timing.json` and `parent-worker-scheduling.json` join exact parent
request IDs and console boundary nonces. During the three capture attempts,
six worker identity evaluations consumed **3564 ms** of request-to-reply time.
Their bodies consumed approximately **7.1 ms** total according to Chrome's
console timestamps. Thus most of this cost occurred **before expression body
entry**, at worker scheduling/dispatch, rather than executing the identity
predicate. Six redundant module-bytecode requests added **948 ms**. The source
repeats the entire `readLive()` sequence after every positive pre-ticket
`NOT_READY`; that cost consumes the original fixed startup window. The last
arm then arrived after the deadline. Bytecode recovery alone is not a proved
complete cause or a demonstrated fix. The producer/worker scheduling mechanism
behind those delays remains unknown.

No missing native-publication gate or defective static-ticket lifecycle was
reproduced. Caching unchanged module incarnations could remove measured
redundant work, but would not by itself remove the demonstrated worker wait;
no speculative shared-helper or runtime edit was made. Active RPC-fence WIP,
foreign files, held paths and immutable original sources were untouched. There
was no oldscope replay or later request to either closed parent scope.

The fresh fixture and independent finite watchdog both joined successfully;
browser, display, release and supervisor waits retain both EOFs. Browser tmpfs
was removed after joined cleanup. Runtime minimum free disk was 1,504,464,896
bytes; later free space approached the floor, so no original was launched.
Exact PNG gzip restoration was verified before unlinking redundant large PNG
encodings; selected view PNGs preserve every decoded pixel. Logs retain module
references instead of repeated bytecode payloads. The runlocal evidence checker
passes. No production code changed, so no code-build claim is made.

No box was created: ID, expiry and stop receipt are null. No workers, agents,
Python, Wine, Windows VM or deployment were used. Host cleanup is not ordinary
Quit. Original gameplay and the deeper worker scheduling cause remain open.
