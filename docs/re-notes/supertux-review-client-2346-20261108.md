# SuperTux compact native Pause review client

`tools/supertux-review-client.cjs` serves a local browser interface against an
already-running, ready retained SuperTux driver. Startup and page loads send no
driver commands. Fresh capture is an explicit button; each action requires a
new capture token, visible native Pause and grounding attestations, and a short
description of the reviewed geometry. Choices are left/right 100 ms, jump
100 ms, or left/right plus jump 200 ms. No choice is selected in advance.

The client verifies the image SHA, exact latest capture metadata, original
timestamp and successful numbered ACK. It writes the existing reviewRef and
observation protocol and calls the accepted PATHHASH transport. The unchanged
Pause controller remains responsible for owner/module pins, its 12,000 ms age
cap, independent UP, previous actual completion, and sticky UNKNOWN. Client
errors also persist a closed marker; restarting cannot reopen it. It never
rewrites capture times or removes driver failure markers. Do not remove the
client marker/lock to retry uncertain input.

The page exposes the original UTC capture deadline and runtime deadline read
from `ready.json`. It shows the server's actual capture-age sample and a
conservative current upper bound using elapsed monotonic browser time plus the
whole request duration, so transfer time is not silently omitted. This can
disable actions early on slow connections. The server/controller check actual
age again. Review checkboxes and geometry text clear after each result. There
are no keyboard shortcuts, automatic refreshes, routes, menu actions, quit
commands, or automatic image approvals. The image following an action is the
driver's next capture and requires another explicit review.

For a separately authorized future gameplay attempt, stage/pin this client with
the existing providers in the final startup barrier, establish native Pause
using the existing reviewed setup, then run on the same host as the driver:

```sh
node tools/supertux-review-client.cjs /absolute/fresh-runtime/run/original 8787
```

Open the printed URL, including its random token fragment. The listener binds
only `127.0.0.1`; use an explicitly arranged local port forward for a remote
driver. The retained helper paths are required and hash checked. A single-client
directory lock prevents a second CLI instance. Normal SIGINT/SIGTERM closes
the server and releases its lock; the runtime deadline closes it as well.
Closing the page/server does not stop the separately owned driver or box.
The existing request helper may take up to 30 seconds to report a missing ACK
after terminal driver failure. No further input is permitted during that wait.

This is a runnable browser interface, not proof that a person or model can
review gameplay within 12 seconds. Ground contact, native Pause, survival and
safe landing geometry still require actual visual review. HTTP/CLI behavior
and inline script syntax were tested; interactive browser rendering was not
qualified. The 2330 capture path's approximately 1.3 seconds and correctly
refused 17.641-second deliberation remain historical observations. Its local
launch status 143 retains cause UNKNOWN. This client owns no runtime launch,
so it does not fabricate a replacement PID/start/wait receipt for that run.

Evidence is `scratch/runs/20261108-supertux-review-client-2346/`. Final focused
tests exercise the runnable CLI and real HTTP commands, the accepted numbered
transport, actual retained binding chain and unchanged controller across real
Node children. Controls cover passive startup/GET/unauthorized POST, exact
single-use review, missing ground attestation, changed image, owner drift,
late actual DOWN ACK with independent UP, previous completion ordering, actual
12-second wall-clock expiry, and persistent refusal to refresh/reopen UNKNOWN.
All fixture children record PID/start, actual exit/close waits and stdout/stderr
EOF. Fixtures contain artificial pixels and module bytes; no native game or box
was started. Final focused tests and `flock /tmp/wine-build.lock bash
tools/build.sh` passed. Unchanged accepted controls are referenced by PATHHASH
in provenance rather than rerun. Earlier iteration logs are retained separately.

Logs are gzip from their first stored byte, with unique names. The inventory
records every run file's stored/original SHA-256 and size and gzip CRC, then
independently rereads the exact set. Source recovery uses the recorded Git SHA
and small owned patches, including new files; there are no source archives or
game-media copies. Free-space samples remained above 1,500,000,000 bytes;
this is not a continuous-floor claim. No peer/old files were deleted.

Offline only, no agents and no native original. Box ID/state/expiry: NONE /
NOT_CREATED / N/A; stop receipt: N/A. Q3's box was never accessed. Level exit,
unlock, audio, FPS and full-game playability remain unverified. Single task stops
after publishing these owned paths.
