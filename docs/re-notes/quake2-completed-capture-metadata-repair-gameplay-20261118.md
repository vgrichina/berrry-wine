# Quake II completed capture metadata, 2026-11-18

Run: `scratch/runs/20261118-quake2-completed-capture-metadata-repair-gameplay/`.
The completion metadata repair passes the locked build, focused renderer and
admission tests, and old/new real Chrome canvas contract checks. **New native
GL qualification and the affected Quake II original remain unproved.** No
original was launched, and no movement, fire, enemy consequence or ordinary
Quit is claimed. Two new-renderer native fixture scopes were permanently
preempted by the declared 1.52 GB disk reserve before qualification.

## Cause and repair

The prior sealed original was read offline only. Its first post-consent
capture had `writerHeld: true` at request, no retained pixels, and
`content: already-displayed`. The extra admission fence could not distinguish
that request history from an unsafe held mutable read. Prior world commands
already used five-second play freshness; their thirty-second rejection text
was a separate, previously corrected diagnostic defect.

The renderer now freezes `rendererWorkAtReadback.before` and `.after` around
the existing validated immutable read. It retains the original request-time
states, publication identity and display/request/readback timestamps. Admission
accepts this additional route only when both states explicitly contain false
writer, GDI-paint and repaint holds. Missing or partial states do not suffice.
Existing ordinary-publication and retained-publication paths remain valid.
The old request-state path now also requires all three explicit false fields,
instead of accepting an empty object's vacuous `every` result.

No hold is released, work scheduled, frame invented or live pixel fence removed
by this change. Existing owner/process/instance, output geometry, opaque-pixel,
publication replacement, poison, read-error and cancellation checks remain.
Completed arrays remain private copies. The callback census review records
this synchronous metadata change; it does not claim general callback ownership.

## Evidence and test limits

An actual x86 native GL Worker fixture, served from Git
`f6962ba5b1cf2829a66f5cc4d80b293c30719b37` with module SHA-256
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`,
reproduced the exact old failure. A passive fixture-only wrapper armed the
first capture inside its next ordinary `beginWorkerGuestSlice`. While held,
the ticket remained pending with no bytes; after natural release it completed
publication 12 without changing its display timestamp. Both validators reject
that old metadata because completion states are absent. The actual owning
`gl-gps` endpoint/publication receipt is retained in `interleavings.json`.
The complete host consent image was personally reviewed; consent had a matching
independent UP with physical zero. This baseline did not test enemy behavior.

Twenty-three focused renderer/admission tests pass, including the added
clean-service same-publication path and held/read-error/replacement negatives.
The real Chrome old/new canvas check passes the same contract and five negative
cases per version, with immutable output copies and unchanged timestamps.
That check uses browser canvases and modeled holds; **it is not a new native
GL Worker qualification**. The controller, actual five-second play/thirty-second
menu gesture-body checks, and callback census regression pass. The first
controller invocation used a relative output path and failed locally; the
absolute-path invocation passed. The first build required a lifetime hash
review, the next found its missing version field, and the corrected locked
build passed. Failed logs are retained, not relabelled successes.

The new native fixture scopes closed at 11:58:59.356 UTC (1,518,305,280 bytes
free) and 12:01:16.517 UTC (1,519,292,416 bytes). Both closures were permanent;
no later endpoint or replay followed. The old task's two-scope cap was initially
inherited, then explicitly corrected to three scopes for this task's required
old/new comparison and one externally preempted attempt. The original absolute
600-second aggregate deadline was not extended. No further native fixture or
original is authorized by this run's sealed qualification result.

## Runtime, resources and cleanup

All 67 registered media/control input hashes remain unchanged. The intended
new runtime is the pinned f696/a600 graph plus only the renderer metadata
module; exact hashes and relevant binary patches are retained. No state,
configuration, media, clock, solver, focus or polling changes were made.
Executing child module recovery and physical GPU execution remain unknown.
The original's prepared operator still uses 1,750 ms independent fallback,
at most 1,500 ms holds, five-second play and thirty-second menu freshness.
It was not exercised on Quake II in this run.

Published `2a1afa6c4` browser transients keep profiles, caches, crashes and
temporary files in private tmpfs. Raw whole-display XWD stays in memory.
Native supervision, independent disk guards, actual child waits and browser
cleanup receipts are retained. All three native scopes have joined their
supervisors, browsers, displays and enclosing launchers; profiles and displays
are gone. The browser-only contract also joined Chrome and removed its tmpfs
workspace. An independent finite sampler covers offline work through sealing;
its final minimum is recorded in `result.json`, without inferring history
outside its sampling interval. No RAM gate or foreign cleanup was used.

Git is the source archive. Evidence includes exact pins, relevant binary diffs,
the unique changed renderer input, operator seals/recovery recipe, selected
complete screenshots, closed-scope metadata and actual waits. `result.json`
is written last. Box ID null; state `NOT_CREATED`; expiry null; stop receipt
null. No agents, workers, boxes, Python, Wine reference run or deployment were
created. Ownership is released after publication and this worker stops.
