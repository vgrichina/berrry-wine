# SuperTux native Pause controller — offline, 2026-11-08

`tools/supertux-native-pause-controller.cjs` composes the retained native
`input.pulse`/`key` and `bound-input` admission/identity helpers. It requires a
reviewed paused observation for the exact admitted capture, at most 12 seconds
old, with exact process/Worker/module/renderer pins. Each command performs
Escape100, the bounded ordinary action (including intended 100–200ms actions),
then Escape100. Every DOWN has an independently prearmed UP. Each subsequent
phase checks live identity and waits for actual prior transport completion.

Cancellation, stale/missing observations, changed owners/modules, rejected or
late transport, persistence failure, and replay close the controller with sticky
UNKNOWN. Cancellation permits only already armed UP. Real command/completion
timestamps and original pending input promises remain available through
`commands`, `pending`, and `settle()`. Transport completion leaves native Pause,
grounding, and survival UNKNOWN; a new actual observation is required for the
next command. Short actions do not establish that death is prevented.

Evidence: `scratch/runs/20261108-supertux-native-pause-controller-2251/`.
`driver.cjs` is the retained, hash-pinned actual numbered gzip command consumer;
the focused test executes it against actual Node child owners. Its accepted
dependencies are retained by PATH+HASH, with no repeated game controls. A small
`browser-integration.patch.gz` integrates the persistent controller and shutdown
cancellation into the retained prior browser driver; `integration-check.cjs`
applies it in memory and checks CommonJS syntax without launching it or storing
a source copy. Initial checks exposed an incorrect script wrapper and a missed
shutdown insertion; both failures and the corrected check are retained.

Validation: focused controls passed with 16 actual Node children, including
pending DOWN with independent UP, late DOWN/UP, rejection, cancellation during
resume/action, exact command ordering, replay, fresh/stale/missing/future
observations, and owner/module replacement. All children reached awaited close
with drained stdio; late fixture promises and input helpers were settled.
The required `flock /tmp/wine-build.lock bash tools/build.sh` passed.
Fixtures establish controller/transport behavior only: no game Pause, grounded
state, gameplay node clear, or progress was demonstrated here.

No browser, Chrome, game, remote service, box, or other agent was launched.
Box: NONE; state NOT_CREATED; expiry null; stop receipt not applicable.
Next: a separately authorized visible run may use this composition with fresh
actual paused/grounded review and the existing lifecycle/custody requirements.
This single task authorizes no original retry.
