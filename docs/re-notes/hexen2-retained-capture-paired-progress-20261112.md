# Hexen II retained capture and API timeout blocker — 2026-11-12

The run-local CDP helper now retains an overdue read's original request ID and
promise, and accepts its eventual result without resending input or issuing a
second capture. Actual native-browser regression passed with a screenshot reply
delayed 21 seconds. **Original gameplay did not advance:** the first attempted
Enter was rejected by the outer command API because the caller supplied a
2,964-second timeout to an endpoint accepting only integers from 1 through 600.
The browser command directory was empty and its final native input evidence was
empty. This is a caller integration defect, not a guest or emulator failure.

Evidence: `scratch/runs/20261112-hexen2-retained-capture-paired-progress-1025/`.
Parent `20261112-hexen2-dialog-bootstrap-paired-gameplay-0953/RESULT.md`,
`RECOVERY.md`, browser/binding helpers and relevant Hexen notes were read.
Parent evidence and saves were preserved. This note does not supersede the
parent's qualified SoftwareGL chamber/attack-alive observation or its unresolved
WebGL screenshot result. An observation deadline is not guest termination.

## Retained-result qualification

Only ignored run helpers changed; emulator production sources did not change.
`cdp.cjs` records each sent ID and its method. A read's 20-second observation
deadline records a pending observation while retaining its map entry and original
promise. The original response settles that promise. There is no retry. An
unknown input ACK remains terminal at 20 seconds. The immutable runtime deadline
rejects pending work and closes the actual runtime; late replies after closure
cannot restore admission. Capture identities are still read before and after
the screenshot, and postbinding identity checks remain strict.

`retained-test.json` proves a 20.5-second delayed original screenshot result,
one send, the same promise, hard-deadline rejection and terminal unknown input.
`ack-test.json` proves one queued command and one exact numbered ACK after
21 seconds. The run-local file-ACK client observes the original command through
the runtime deadline, with no second publication.

`offline-native-3` exercises the actual generated native MessageBox-before-GL PE,
production browser and Workers. At the real CDP receive boundary, the first
screenshot response was held for 21 seconds. `delayed-production-capture-validation.json`
checks exactly one send, one observation deadline and one late success for
CDP ID 43. That first returned image was blank and was **not** accepted as a
painted notice. A distinct later passive `notice-painted.png` contains the full
notice and OK button. Only after review did a trusted balanced Enter create the
first GL owner; `gl-born.png` shows its blue rectangle. The native modal negatives,
module-byte mismatch and nine postbinding replacement controls passed. The
fixture also completed the planned Up+Control chord and normal cleanup.

Attempt 1's capture retention passed, but its Enter client failed before queue
publication at the inherited 55-second ACK-limit validator. Its terminal
transport was not reused. Attempt 2 refused the changed helper's stale pin before
Chrome launch. Both attempts remain recorded. Attempt 3 used refreshed pins and
the corrected file-ACK client. Fifteen schema/action forms, stale refusal and
sticky post-effect regression, real-child cleanup controls, and five focused
input/Worker tests passed. No production build was necessary.

## Fresh original run and precise blocker

Source remains pinned to published
`8a834a3dc7affc8c6e53245beab56e87a32b81e8`, with module SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The actual guest module was recovered and matches. Original installed root
`glh2.exe` SHA-256 remains
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
Sixteen existing manifest/media references were retained; no guest analysis,
extraction, patches, substituted DLL, media/configuration/save edits or forced
guest calls were used. Git and relevant source/helper patches are the source
recovery mechanism; there is no source/media archive.

The independent observable 55-minute watchdog was armed before allocation.
The provisioning process actually joined with exit 0 and both EOFs; 615 remote
file/manifest/deadline hashes and staged imports passed before browser launch.
WebGL was requested first to revisit the parent's failed observation point.
`review/webgl/startup.png` shows the full original GLHexen2 informational notice.
No GL owner exists before dismissal, so this is not active WebGL qualification.
SoftwareGL was not launched in this attempt.

At 10:30:19Z, the caller submitted its first intended Enter using the remaining
runtime interval as the outer API's `timeoutSeconds` (2,964). HTTP 400 arrived
without a detached process identity. Custody closed; there was no request replay.
After ordinary runtime closure, an effect-free `python3 -c 'pass'` schema
validation request with that timeout returned HTTP 400, `invalid_timeout`, and
an explicit allowed range of 1 through 600. Its complete response is retained
in `timeout-schema-diagnostic.json`; it was not the original command.
The failure is caused by conflating the API command timeout with the longer
read-observation deadline. Local CDP/file-ACK success did not qualify that API
envelope. The failed original caller remains preserved rather than silently
rewritten as a successful run.

Terminal inspection before cleanup found zero published browser commands and
zero input receipt files. The sole subsequent browser command was ordinary
`terminal-quit`, with exact successful ACK; final native input events are `[]`.
No current original courtyard/ramp/chamber, attack, enemy damage or kill claim
is made. No owning renderer, FPS, physical GPU, parity or audio claim follows
from this pre-GL notice or any raw draw counter.

## Recovery and shutdown

37 remote artifact references / 32 unique gzip blobs were compressed on the box,
retrieved, and checked for encoded/raw SHA-256 and size before normal stop.
`check-evidence.py` passes and repeats retention-control, zero-input, module,
provision and lifecycle checks. `RECOVERY.md` explains reconstruction within
an owned evidence directory. Parent artifacts are untouched.

Box `bx_9qu4abv8` was allocated at 10:27:14Z with initial expiry 11:22:13.414Z.
The browser's actual parent joined with exit 0 and both EOFs; Chrome exited 0,
its controller/Chrome PIDs were absent, and its owned profile was removed.
Local manager and independent watchdog also have actual parent waits with
exit 0 and both EOFs. Evidence verification preceded shutdown. Normal stop
`stop_a2229d4dffbe91e4` completed unforced, without error; final state is
**archived at 10:32:12.060Z**, expiry null. No box remains running for this task.

Next: qualify the complete API publication/observation boundary with an
effect-free delayed-result control before another original launch. Publish a
command once within the API's valid envelope, then retain and observe its exact
identity/numbered ACK through the actual runtime deadline using read-only polls.
Do not stretch `timeoutSeconds` past 600 or replay this rejected command.
Then repeat paired original scenes and attack earlier, including Up+Control on
approach where the reviewed scene permits it, before waiting for lethal spider
contact. The gameplay objective remains open behind this caller blocker.
