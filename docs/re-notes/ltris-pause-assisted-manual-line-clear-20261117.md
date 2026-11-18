# LTris pause-assisted attempt, 2026-11-17

The line-clear goal remains open. One newly authorized original sequence reached
the Normal level 0 New Game screen. The Start Game click was consumed, but its
following whole capture still showed that menu. No gameplay board, line clear,
score consequence, or ordinary Quit was observed in this attempt.

Evidence: `scratch/runs/20261117-ltris-pause-assisted-manual-line-clear/result.json`.

The subsequent Pause request exceeded the unchanged 500 ms absolute transport
bound (about 505 ms including termination/drain bookkeeping). No response headers
were observed. This is terminal actual UNKNOWN, with no consumption claim and no
endpoint query or replay afterward. The independent physical UP returned ACK;
its helper has actual wait and both EOFs. The unchanged 1750 ms fallback fired
about 0.4 ms after due, with UP ACK about 60 ms after due; strict completion
within 1750 ms is not claimed. The operator rejected a later capture
locally at the sticky closed check without contacting the endpoint. The Pause
review's description of an empty board was mistaken: the personally viewed
`boardstart.png` shows the Start Game menu. That correction is explicit in the
evidence rather than rewriting the original operation record.

The missing enclosing parent-wait/EOF problem was repaired for this attempt by
using the existing `tools/toyvm/durable-launcher.py` custody implementation and
removing the transient launcher's fork/inherited-stream outer-wait claim.
Small native Node normal/error processes returned 0/7 with actual command and
watchdog waits and separate stdout/stderr EOF records. The original's enclosing
command and watchdog also have those records, with no deadline fired or adopted
children remaining. After terminal UNKNOWN, the owner sent SIGTERM to the exact
owned native process group; the native host returned 0 with both EOFs. This is
owner shutdown, not guest Quit. The predecessor's missing waits remain UNKNOWN.

The runtime reused exact Git `b29ef843aee74fe366aac3698704e3238797ed9e`,
module SHA-256 `533c599a144837890b6b45f6cbace2e52e9b4f48a3a8dd08b4261cd20223b1a1`,
the published `ad27fc08f` loader, and all 43 existing media references. The
persistent prepared operator and earlier native keyboard/Pause proof were
reused. No production source was changed, runtime defect proved, new build
claimed, or broad qualification repeated. Git plus relevant binary diffs and
patches for the small run inputs preserve source provenance.

No second original, solver, OCR, board memory, placement script, autoplay,
configuration/save/clock/state edit, media copy, archive, box, worker or deployment
was used. Foreign WIP and the LMarbles controller owner were preserved. Box ID
and expiry are null, state NOT_CREATED, stop receipt NOT_APPLICABLE. Home free
space stayed above 1.5 GB at recorded checks.

The concrete blocker is terminal input UNKNOWN before a reviewed gameplay board.
Further original gameplay requires renewed authorization. Release/stop.
