# Redline observed key delivery and gameplay attempt — 2026-11-09

The sole authorized native run failed before CDP admission or key delivery.
At **09:26:33.805Z**, the production caller failed to read
`native-fixture/chrome-profile/DevToolsActivePort` with ENOENT after its existing
100 × 100 ms startup polling loop. Original Redline, comma/period holds,
capture ACKs, side-door entry and vehicle progress were not reached. There is
no new delivery report, failed hold receipt or key dispatch/response clock:
the hold observer was never called. No later input, capture or runtime retry
was attempted. No timing limit or cap was increased. Chrome's retained stderr
later announces its DevTools listener at port 42159; the cause of delayed
startup is not established by these observations.

Small run-input integration corrections were implemented in
`scratch/runs/20261109-redline-observed-key-gameplay-0924/`: include
`tools/redline-key-delivery.cjs` in the 753-provider closure, pin the production
caller and observer exactly to `d81e7524bd793d71af55f726cbda46a4dc05fa88`,
require the exact Q3 0912 and Q2 0900 archived/drained releases before create,
and preserve the existing fixture invocation deadline and 95/120-second
supervision caps. The actual generated invocation passed an offline inert
execution; production closure preflight passed without Chrome. Five unchanged
startup/fixture providers matched the accepted source base, and accepted helper
proofs were SHA/size checked and reused. The independent retrieval verifier
was corrected for this actual early-startup failure: it records missing input
evidence and abnormal Chrome exit instead of assuming a normal key failure.
No production code, shared host/WAT/custody or peer launch client was changed.

The actual native fixture controller launched the tracked production caller.
Pre-Chrome HTTP pins and the identical local/remote source barrier passed.
The preCPU/preDLLmain owner/module/instance/endpoint/slot admission was not
reached and has no new PASS claim. Flags and identity semantics were unchanged;
native lifetime remains REVOKED, all-writers and edict ABA remain UNKNOWN.

Failure cleanup joined caller exit 1 and its independent watchdog exit 0 with
separate stdout/stderr EOF. Chrome's actual exit was SIGKILL, with stream EOF;
shutdown records `actual Chrome exit missing` and terminal status. This is not
ordinary joined quit. Native custody recorded **152 owned tasks and 152 actual
reaps**, complete command EOF, no unresolved lineage or remaining tasks.
Independent no-input filesystem/socket cleanup removed the leftover profile
only after custody completed and verified ports 43921 and 42159 closed, no
profile processes and no writer locks. These absence checks are separate from
actual wait evidence.

Box **bx_fxbq6peg**, immutable UUID
**63fe41f0-f079-4e9b-8640-59e24075229e**, had initial expiry
**2026-11-09T09:48:45.584Z**. Its immutable 25-minute watchdog was observably
armed before creation. All **22 artifacts** were independently retrieved and
SHA/size verified, including **eight gzip CRC checks**, before delegated normal
box shutdown. Stop receipt **stop_b1519e6df3660c1e** completed without force at
**09:27:54.647Z**: **ARCHIVED, PHYSICAL_DRAINED**. Final `archiveAfter` is null;
`expiresAt` was not returned. The allocation watchdog and lifecycle supervisor
actually exited 0, with separate pipe EOF. Runtime release was published on
the shared board immediately after archive confirmation.

Evidence uses Git base d81e7524b, small binary patches for relevant uncommitted
source (including the retained untracked boot helper) and run inputs. No source
tree, media or module archive was made. Logs were gzip streams from their first
byte. Free `/home` remained above 1.5 GB. No local heavy browser, additional box,
agent, worker, public deployment, Heroes II or Claude edits occurred.

Validation passed: offline generated-invocation assertions, production closure
preflight, independent artifact/custody/cleanup verification, reverse application
check of the small untracked-provider patch, and
`flock /tmp/wine-build.lock bash tools/build.sh`. Accepted unchanged source
proofs were reused without a duplicate qualification run.

Next work is an offline diagnosis of the production DevTools startup deadline
and failure cleanup before any separately authorized native attempt. New key
delivery diagnostics and personally reviewed original gameplay remain pending
behind this concrete runtime blocker. SingleTaskSTOP.
