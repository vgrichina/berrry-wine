# KKnD closed target helper: controlled fix, new source-observer boundary

Run: `scratch/runs/20261106-kknd-closed-target/`. The failing predecessor
`20261106-kknd-menu-consumer/menu-observer.cjs` is preserved unchanged (hash in
`preserved-predecessor.json`). See [its consumer handoff](kknd-menu-consumer-20261106.md)
for the read-only original guest chain and pre-attachment failure.

The fresh helper skips only recognized closed CDP sessions during readiness or
owner evaluation, recording rejection stage, name, message and stack. Live
evaluation defects remain fatal. It requires exactly one live slot 0/thread 1,
the parent owning endpoint, 512 MB memory and actual instantiated module hash;
identity is checked again in the same evaluation that attaches diagnostic
counters. The fresh browser adapter preserves original readiness Error objects.
No guest code/state writes, production emulator changes, retries or restarts.
The new helper source is retained in `prelaunch-new-helpers.patch` and
`final-new-helpers.patch`; no predecessor files were edited.

All three ordered FINAL releases and independent cleanup passed before acquisition
at 12:15:09.609753 UTC (deadline 13:00:09.609753, including cleanup). Before any
browser, all 15 exact exported helper controls passed: closed before ready, on
evaluate, before/after the live owner; zero/duplicate owners; real VM ReferenceError
and non-lifecycle rejection; endpoint/module/attachment-identity negatives.
The preserved predecessor still fails its live-owner/closed-sibling control.
The passive consumer control and exact browser adaptation compilation passed.
Locked full standard/compat build passed. Tested Git SHA:
`0ae13a764ecbfb8e81b38ec6033301467d3f0e50`, tracked source diff empty, with owned
new-file patches retained. All 325 source/module pins and 16 original media files
match after execution. Both pre-navigation HTTP pins and all 114 successfully
read browser source responses match.

**First new failure:** the sole browser's retained source-response observer calls
`response.buffer()`, which rejected with `ProtocolError: Could not load response
body for this request. This might happen if the request is a preflight request.`
Its catch treats every body-read rejection as `actual browser source identity
failure` and closes the browser. It omitted URL/method/status/redirect information,
so the specific response and cause are unknown; the error text does not prove a
preflight. No recorded hash mismatch or emulator defect is established.

The actual served standard module and Worker CDP bytecode match
`220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2`.
The closing identity sample saw one instantiated slot 0/endpoint 1/thread 1,
but sampled before the parent running-app binding existed and its strict `pass`
is false. This is **not qualified owning-module identity**. Later terminal state
shows the running original app; personally inspected full/game captures show its
splash. No input, menu observation attachment, Return click, consumer evidence,
selection, commanded displacement or second gameplay response occurred.

Next boundary: in a fresh helper, record response URL, method, status, redirect
chain and body-read error before collection; control bodyless/redirect responses,
required-source body failures and real hash mismatches without weakening byte
identity checks. The current evidence cannot select a safe exception policy.
Then a separately authorized original session can use the controlled menu helper.
Do not replay routing or infer a guest CPU/API repair from this observation error.

Browser closed at 12:16:12.698 UTC; independent cleanup passed at 12:16:59:
14 absent owned PIDs, two refused ports, one absent profile, four free locks,
4.63 GB free, within the window. Holder SIGTERM/143 was intentional cleanup.
No boxes assigned (ID/state/expiry N/A). Evidence includes `failure-boundary.json`,
`closed-target-control.json`, `helper-checks.json`, `terminal-executor-identity.json`,
`source-postcheck.json`, `capture-review.json` and `final-cleanup.json`.
