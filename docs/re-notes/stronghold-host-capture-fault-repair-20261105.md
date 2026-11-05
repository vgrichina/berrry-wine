# Stronghold passive host capture fault repair, 2026-11-05

This offline assignment follows `54add0d4a307cd7eb3645a17c4bcf75ef62e34cb`
and `38ed29dbea718425e87845f5eb12db010ea059d7`. Evidence belongs to
`scratch/runs/20261105-stronghold-host-capture-fault-repair/`.

The original's earliest passive host report is terminal at frame 0, sequence
0: `stale/unknown host capture`. The serialized factory correctly uninstalled
its hooks. The Node controller persisted the report without rejecting, so the
later command-13 unknown scene at step 10,304 was only the first surfaced
failure. The original did not stop immediately on the earlier fault.

Before any shared source mutation, the published two-case replay reproduces
that behavior, and the new real-controller/serialized-factory regression fails
with `Missing expected rejection`. Neither fixture launches Chrome, advances
guest instructions, forces rendering or drives timers.

The repair keeps the factory and its exact stale/frame-zero capture
guard unchanged. Pre-frame screenshots are explicitly unbracketed until
an ordinary observed renderer return produces a frame. Terminal host reports
are persisted and rejected, with the earliest error latched through later
commands and normal cleanup. Deferred capture grants no presentation or
readiness, and no frame is synthesized to satisfy capture.

The controller validates token, capture and link reports, including terminal
statuses whose fault field is null, and latches evaluation failures. The
composed command, step and mouse boundaries check the passive observer before
delivery; command/review checks also consult the synchronous fatal latch.
Cleanup checks for an earlier terminal report before uninstalling, preserves
the first error, and still restores hooks. No factory, host, native observer,
driver dependency or renderer source was changed.

I personally inspected the retained step-10,304 capture. It shows the sword
and shield background, “Not available in the demo”, and numbered red, yellow
and blue circles; it does not show a complete setup or world. Existing input:
`scratch/runs/20261105-stronghold-review-ack-original/browser/route-native-boundary-8.png`,
SHA-256 `0b8f94943db27b249f9e1a50171fbdcc44397cf9046ba397081c79f0ab72bb59`.
Its exact opaque RGBA game region `[10,194,860,668]` hashes to
`25ffd65fb0eb87ae71b33ca8c491cbea0f8766cfc30b57c6bed099328bcb5ab4`,
distinct from both current diagnostic identities. That explains `unknown`;
an exact match may identify only a partial setup observation. Preset, Start,
world and completed presentation remain unproved and unauthorized.

The complete 574,480-pixel game region differs at 370,618 pixels from the first
registered partial setup and 395,267 from the second; maximum channel deltas
are 116 and 190 respectively, with no alpha differences. These are distinct
exact observations. No tolerance, alignment, mask or inferred opacity model
is introduced. `partialsetup-inputs.json` records all three existing paths and
hashes without copying the captures.

The final production helper and composed source pass 21 real-controller and
serialized-factory cases: direct frame-zero rejection, deferred first capture,
ordinary produced-frame capture, stale/foreign/pending/failed capture, owner
replacement, terminal deadline, first discovery during cleanup, evaluation
loss, screenshot failure and a frame change during screenshot. The actual
composed next-command, step and all mouse transports reject before delivery.
The full local contract suite retains 42 release negatives, personal review
and successful-ACK ordering, frozen cadence, active-input/full-rest guards,
native history, all existing caps and readiness exclusions. The exact third
partial image has seven changed-game-pixel negatives plus opacity, geometry,
scene-precedence, arrival-cap, terminal and readiness checks.

The final full composed entry checks 2,429 filesystem rows and 2,429 actual
HTTP responses with plain Puppeteer injection, independent public/native
spawn prohibitions and zero Chrome. Nine public-entry stale manifest,
prior-pair and changed-byte negatives pass. The route-recognition suite passes;
the unchanged independent synthetic host pipeline passes its
failure/async/cleanup/bounds cases and 24 structural join negatives. No
original instructions or game/browser runtime were used in this assignment.

Shared source mutation began at 01:21:35Z, after BOTH FINAL runtime AND file
RELEASES: MDK `5b72401a77b3afb5c57d93a77b305c1666d9a20e` and Return Fire
`533e8faad7bee6f29e123acf3e9febe5b1b40b84`. The independent read-only verifier
confirmed exact normal Chrome exits (code 0, null signal), Chrome/Node/flock
PID/starttick absence, all five HTTP/DevTools ports refusing connections,
exact profiles absent with no users, and the external runtime flock free.
`dependencies-cleanup-independent.json` retains those checks. Neither
MDK nor Return Fire files were edited. Box ID/state/expiry: NA; shutdown
ownership stays with coordinator.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passes, including
the final rerun after cleanup propagation was added. Both builds are finished.
They reproduce the existing canonical module pair unchanged:
`e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`
and `66b37bd76da5a7b49c063b4eb0d44c898aaf00ff41e000a6fbd87c01edc136c8`.
The accepted 2,429-row closure, five named amendments, 1,856 unchanged media
rows and all retained helper hashes remain enforced. No blanket rehash or
historical admission was added.

Next prerequisite: separately authorize any future original against its exact
published closure and finite runtime contract. The prior original is terminal
and cannot resume. This repair supplies no new original authorization, preset,
Start, world, completed fade, operation-to-upload identity or fresh-pixel
proof. The assignment ends after this tested publication, with no successor
or game attempt. Publication SHA and remote identity are in `publication.json`.

Git is the source archive. Evidence records commit identity, relevant binary
diff and owned new-file patches, plus existing input paths and SHA-256. No
source snapshots, tars, copied modules/media, npm, worktrees, subworkers,
boats, deployment or successor game attempt are part of this assignment.
