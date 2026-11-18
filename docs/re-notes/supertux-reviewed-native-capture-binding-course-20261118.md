# SuperTux reviewed native capture binding, 2026-11-18

Evidence: `scratch/runs/20261118-supertux-reviewed-native-capture-binding-course/`.

Commits `e22a60149` and `f86743427` repair the native-scene capture/bind
protocol. The old controller took its native snapshot and PNG in separate
requests; bind then encoded a later repaint and compared that new image's
hash with the reviewed image. The retained predecessor explicitly refused
`reviewed native paint changed` before creating an owner or DOWN. Its scope
remains closed and was never contacted in this task.

The new server action captures the full display and native context in one
synchronous dispatch. It retains the exact encoder bytes and issues an
immutable random capture identity, SHA-256, original times and a 30-second
expiry. Both wall and monotonic clocks enforce expiry. Bind verifies the
issued record and exact image association, the retained hash, current native
process/window generations, focus, modal, capture and physical state, all
native window metadata, and the original renderer/queue/actor/module/device
references. A changed reference cannot acquire a replacement authority through
matching public metadata. The existing permanent owner and consume-time
native checks remain in force. The legacy no-receipt route retains its hash
comparison. No pixel crop, mask, repaint freeze, timer change, review renewal
or input-deadline extension is used.

The controller verifies the saved whole PNG against its receipt and the
personal review hash before binding. Its existing 5-second game freshness,
30-second menu freshness, 500 ms confirmation, independent physical release,
3-second operation bound, sticky UNKNOWN and no-replay rules are unchanged.
LMarbles released controller ownership before these edits; common and
supervisor files were read-only. The `786dae2f8` SuperTux manifest regression
continues to pass.

Inspection during the first affected original found an additional mistake in
the new action: it omitted the ordinary queued PNG path's `renderer.repaint()` composite.
Its complete black PNG was not bound or treated as a usable game review.
A diagnostic legacy whole capture showed the animated title. Black alone does
not prove causation: the second original also had black startup/draw-phase
captures before later visible frames. The missing composite is independently
proved by the lazy-compositor native fixture and the ordinary PNG code path.
That scope closed permanently with zero owner/DOWN. Native, watchdog,
supervisor-child, outer and enclosing supervision waits all returned 0 with
both EOFs; cancellation is not ordinary Quit. The correction composites inside
the same before/after context and authority checks before encoding.

Actual native SDL/HTTP tests use an independently authored animated PE, real
SDL fills/flips, the production capture/bind/controller path and identical
input context across changing whole images. They cover genuine different
capture substitution, real 30-second staleness, process owner, focus, modal,
window replacement, queue replacement, real public USER mouse capture,
independent release after focus loss, and a genuine delayed consumed reply
that remains refused/UNKNOWN under the unchanged 500 ms bound. The final
composite regression suppresses incidental display composites and requires
the capture action to invoke the real compositor and return a nonblack whole
PNG. Ten cases passed in that suite. Its UNKNOWN fixture suffered a first-
capture ECONNRESET before input and a native SIGTERM teardown; those failures
are retained. A fresh finite UNKNOWN fixture passed separately with independent
UP and all actual waits 0/both EOFs. Earlier fixture assertion/interception
mistakes and their actual waits are preserved as failures, not hidden passes.
The receipt unit tests, 19 controller tests, manifest regression and required
locked builds passed. Each code commit was immediately strictly pulled/pushed.
The final build reproduced module
`0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5`.

All 789 original media/settings pins matched before launch. No media, settings,
save, game state, clocks or private memory were used to choose gameplay.
The 22 predecessor recovery archives and recipes and all holds remain intact.
Only this worker's closed test metadata was compressed, with disk roundtrip,
SHA/length/stability and recovery note before unlink; individual recipes are
retained. Actual disk observations briefly crossed the 1.5 GB floor during
qualification/preparation; no task-wide continuous compliance is claimed.
The first original's sampled minimum was 1,504,604,160 bytes. LMarbles then
reported a separate verified closed-log recovery restoring capacity.

The materially repaired second original is recorded separately under
`original-composite/`, with an unchanged 1200-second runtime and 180-second
Quit reserve, independent finite supervision, dedicated native exit receipt,
sealed source/module inputs and exact operational helper hashes. Its gameplay
and exit outcome follows. A genuine whole title capture bound successfully while
normal animation continued. Menu actions selected a new game, the introduction,
and the world-map node “Welcome to Antarctica”. Personally chosen finite Right
and Space inputs advanced along the ice and visibly earned one coin/25 points.
No life loss was observed. Several intentions expired before DOWN and remained
NOT_SENT. World-map course selection used the menu freshness class; actual
course movement/jumps used the unchanged five-second game limit.

A final run-local two-key intention was invalid: Right was consumed, then Space
was CANCELLED with “reviewed native scene changed”, because the first held key
changed the reviewed physical context. This is a real refusal, not harmless
repainting or a receipt failure. The run-local helper marked sticky terminal
failure and requested cancellation; no endpoint was contacted afterwards. Its
prearmed independent release acknowledged UP and exited 0 with both EOFs.
The definite CANCELLED reply is not an actual UNKNOWN, but the conservative
terminal closure was honored. No unchanged retry followed. No platform landing,
course completion, or ordinary Quit is claimed.

Native, watchdog, supervisor-child and outer actual waits were all 0 with both
EOFs. The independent native-supervise receipt reports exit 0/no leak. The
native exit receipt is explicitly .cancelled/SIGTERM with the invocation token,
not a native Quit. The enclosing run-local driver tool instead ended 143; its
final wait/disk/holder records were not written, and no successful enclosing
wait or continuous second-run disk trace is invented. The recorded native,
holder and enclosing PIDs are absent. The recovery recipe retains the original
module archive association; no temporary memfd is required for recovery.

The protocol repair is published and demonstrated on animated native input.
The requested full platform/course progress and ordinary Quit remain unmet.
There were no boxes, workers, Wine runs, Python calls or public deployments.
Final box ID null, state NOT_CREATED, expiry null, stop receipt null.
