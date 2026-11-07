# AVP2 asynchronous key recovery

Evidence: `scratch/runs/20261107-avp2-async-recovery/` (ignored).

Recovered the interrupted `avp2-async-world-2154` edits. Its retained event
stream ends after launching the local Worker regression and focused tests;
there is no allocation or original boot command, allocation artifact, result,
final message or release. The before/after local Chrome and driver PIDs and
ports are absent/closed, and the predecessor board watcher is absent.
`predecessor-lifecycle.json` and `predecessor-cleanup-audit.json` record this
audit. The reported launcher/session termination was 143. No retained signal
sender audit identifies its cause, or proves a cross-group SIGTERM. The
launcher has no kill instruction. The inspected Puppeteer cleanup targets its
owned browser PID group with SIGKILL, which does not establish the SIGTERM
sender. Historical process-group membership is unknown.

The production guest Worker regression executes ordinary x86 imports of
GetAsyncKeyState through the shipped host/Worker path. Before repair, trusted
Enter DOWN/UP with an undrained queue produced `0x8001, 0x8000`, despite physical
release. After repair, that case and the drained case produce `1, 0`; a held
key produces `0x8001, 0x8000`. The low bit remains a pressed-since-query latch,
consumed once. GetAsyncKeyState now reads the existing physical key state for
its high bit, independently of the queued message snapshot. Message ordering,
modifier ownership, physical reset and per-query consumption remain covered
by the focused 55 tests. The reviewed host-file census seal was refreshed;
callback ownership remains pending.

The permanent browser regression records PID, parent, process group, session
and start ticks and checks that Chrome owns a distinct cleanup group. Runs
are launched in detached, precisely owned sessions; no substring/group kill
of shared processes is used. A new locked build attempt stalled after the
region allocator printed success. Its exact Node PID 2738355 was waiting in
shutdown futexes; retained strace records this without attributing the earlier
worker interruptions. Only that verified owned PID received SIGKILL and the
build was rejected. The allocator exits normally with `--v8-pool-size=1`;
the complete locked build passed with that host-tool option (`build3-exit.json`,
exit 0). The focused 55 tests and two production browser Worker runs passed.
Code commit `74d173af4` was immediately pulled and pushed on main.

Run controller release checks retain trusted DOWN/UP, independent UP, owner
identity and sticky UNKNOWN. They retain `_asyncKeys` as diagnostic message
state and use the non-consuming physical high-bit accessor for release.
Neither an unconsumed low bit nor an older queued message means physical hold.
The qualified Gate, independent-UP and entry-identity helpers remain unchanged.

## One original Marine followthrough

The predecessor allocation/boot audit permitted one new UUID, `bx_pcy2gh6p`,
created 2026-11-07 22:03:55 UTC with initial expiry 22:38:55 UTC. The detached
observable watchdog's immutable 25-minute stop deadline was 22:28:55 UTC.
Local and remote launch floors exceeded 5 GB. Runtime closure, 619 pins and
18 referenced media bodies were checked; the existing collector `8453f67b4`
and qualified controls were reused. The actual compiled module remained
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
No second original was allocated or booted.

Reviewed captures progress from Single Player to Marine / Unwelcome Guests /
Normal, through the introductory conversation into a recognizable first-person
corridor with a Marine teammate, knife, health 100 and armor 050. The loading
screen was not evidence of a hung world. `intro-progress`, `after-strafe` and
`return-corridor` show bounded D/A strafes changing static corridor geometry
and returning to the corridor. All controller commands received SUCCESS;
independent UP left no held input and no sticky UNKNOWN occurred.

**Attack remains unproved.** Both bounded mouse pulses produced trusted DOWN
and UP and physical mask/high bit zero afterward. Retained event coordinates,
however, are `(0,0)` with an empty target for both pulses. The separate native
pointer move reached `(350,450)` on `screen`, but the long-lived Puppeteer
controller's distinct Mouse object retained its own `(0,0)` coordinates.
The post-pulse canvas-target assertion correctly failed, with a known ordinary
assertion exit (not UNKNOWN). No attack, hit or damage claim is supported.
No input was replayed after this discovery. The controller and original were
closed ordinarily. A future authorized original must aim using the same
controller Mouse object and verify its trusted target before claiming attack.

## Passive rendering boundary

`producer-original-draw-assets.json` retains natural legacy producer evidence:
565 accepted draw API calls, 62 GPU submissions, four covering GPU draws, and
zero texture references on sampled triangles. Sampled fixed-function stages
select diffuse color, with empty texture arrays. Native GL fences passed with
no fallbacks. The 91-entry VFS inventory was read through descriptors without
invoking lazy data accessors; pinned HTTP bodies completed. These observations
place the sampled plain-color output before texture sampling but do not
identify a faulty texture creation/binding operation. No WAT/JS rendering fix
is demonstrated, so none was made. The existing stage-zero SetTexture handler
was inspected read-only.

An earlier passive inventory accidentally accessed a lazy `.data` accessor and
raised a known `VfsPendingError`; its logs remain preserved. A subsequent
read-only descriptor inventory recovered evidence without replaying input.
The public legacy draw trace produced no usable supported call records and
is not evidence that assets or draws were absent. The personal review text
for `loading-current` originally mislabeled it as loading; the actual retained
image shows the interior conversation, as subsequent reviewed captures confirm.

Evidence includes exact source SHA, relevant binary diffs/new-file patches,
module hashes and existing media path/SHA references. No source or media
archives were created. The terminal SIGTERM sender remains unknown; the MW3
worker's exit 143 does not establish a common cause.

## Retrieval and delegated shutdown

All 142 inventoried unique artifacts (16,024,882 bytes) were retrieved and
verified by hash and size before the normal-stop request. Exact owned driver,
Chrome and late-controller processes were absent; ports 37637/35589 were
closed, profile absent, and held input empty. The separately owned local board
watcher was stopped only after its exact cmdline was verified. Both lifecycle
delegates exited 0 with terminal records; supervisor reports no remaining child.
The normal, non-forced stop `stop_a87926f01499d3cb` completed at
2026-11-07 22:18:14 UTC. Box `bx_pcy2gh6p` is **ARCHIVED**; its former expiry
was 22:38:55 UTC and the current API expiry is null. Custody returns to the
coordinator; do not resume or create another original under this task.

Next concrete work is a locally tested controller-coordinate fix before any
separately authorized attack attempt, plus an upstream texture creation/binding
trace that identifies an actual fault before changing rendering behavior.
