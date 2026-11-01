# Local DOS RPG replacement: bounded eligibility blocker (2026-11-01)

No title selected and no original launched. The ordered pool was exactly
`ultima4`, `arena`, `daggerfall`. All three are absent from the freshly loaded
46-entry public `DESKTOP_APPS`, and all three current ToyVM file-list closures
match their recorded sizes and SHA-256 hashes. Each is nevertheless excluded
by this assignment's rule that previously qualified titles and backend variants
do not count as new games.

| Candidate | Actual manifest root and current closure | Exact eligibility blocker |
| --- | --- | --- |
| ultima4 | `test/binaries/candidates/gog-free-ultima-iv/installed`: 150/150 files, 890,868 bytes | [Existing note](ultima4-gog.md#2026-10-05-original-overlay-ordinary-overworld-movement-accepted) records accepted ordinary overworld East/West/idle movement on 2026-10-05. Running the same original through ToyVM would be a backend variant. |
| arena | `test/binaries/candidates/gog-free-elder-scrolls-arena/installed`: 386/386 files, 52,534,276 bytes | [Existing note](elder-scrolls-arena-gog.md) records ordinary dungeon right/left/idle and forward/reverse movement, independently reviewed on 2026-10-05 (session31636). A different backend does not restore new-title eligibility. |
| daggerfall | `test/binaries/candidates/gog-free-elder-scrolls-daggerfall/installed`: 1,660/1,660 files, 541,032,586 bytes | [Existing note](daggerfall-gog.md#2026-10-07--ordinary-dungeon-movement-after-mutable-save-mount-repair) records accepted ordinary dungeon forward/reverse/idle movement on 2026-10-07. A ToyVM startup would again be a backend variant. |

There is **no missing file dependency in these three current ToyVM manifests**.
The missing prerequisite is an eligible, not previously qualified title within
the authorized pool. This is a bounded task-eligibility failure, not global pool
absence or a claim that any original cannot run. No broader search or download
was performed. The current `test/binaries/dos-games/` tree contains only
`constructor-demo/`; none of these three titles has a second fixture there.
The actual candidate roots above were checked rather than assuming DOS-game
directory aliases existed.

Evidence is in `scratch/runs/20261101-local-dos-rpg-replacement-nov01/`:
per-file actual hashes, executable identities, full public desktop list,
manifest/note snapshots and source hashes, gate and lifecycle records. The
three historical run directories cited by the existing notes are currently
absent locally; this audit preserves the tracked accepted-note evidence and
does not claim to have re-reviewed missing historical screenshots. No new
screenshot, guest boundary, guest exit, OS game wait or gameplay result exists.
Current fixture byte equality does not independently prove every Arena entry
was in the original package; its note explicitly records older inventory issues.

Input was main `77a0cea8828c82b262e17e71b4c60234abd2f4e6`. Exact Constructor
author release, worker terminal0/final, and coordinator's direct cleanup review
were read before this audit. Runtime/source/build were never claimed or mutated.
Accepted sequencer repair evidence was reused; no broad tests or build ran.
No fixture, save, recovery recipe, registry, TODOS or STATUS was edited.
Box/state/expiry: N/A; no game/native runtime helper requires shutdown.

Next is coordinator-owned: supply a distinct authorized candidate pool containing
an original title without prior accepted player control. No successor was
dispatched and no unchanged original retry is proposed.
