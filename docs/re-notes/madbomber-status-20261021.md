# Mad Bomber focused status — 2026-10-21

Ordinary registered browser gameplay is qualified on exact main
`0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb`: original menu, Enter to One
Player, Space starts bombs, ordinary mouse moves buckets, catch splash and
score 0 → 1 → 3. Two bounded 60-second gameplay windows in headed Chrome
151.0.7922.108; score 1 visible by 5.337s, score 3 by 6.891s in the second.
The first path missed and stayed at score 0. Final images show Press Fire
after a lost bucket. No blocking browser failure; resource404/autoplay
warnings are preserved. FPS, audio quality, sustained play and full completion
remain unqualified.

See [browser report](madbomber-browser-gameplay-20261021.md) and
`scratch/runs/20261021-madbomber-browser-gameplay/` for reviewed captures,
actual served-module hashes, exact source/asset identities and cleanup.
Canonical module728e1de8 was reused after current browser/build-source
comparison, not rebuilt. Both owned browser/server sessions exited 0 and
all owned PIDs/port8080 are absent. Same bx_j693sabt is left RUNNING for the
coordinator, expiry19:06:34.564Z; source/deps/originals/evidence remain staged.
Coordinator owns shutdown; this record is the worker handoff.

Prior CLI acceptance remains valid at72e7a30d, producer045a6e6:
[CLI report](madbomber-current-main-gameplay-20261021.md) and
[independent review](../reviews/madbomber-gameplay-integration-20261021/README.md).
Its old bx_jh469zy9 was snapshot-stopped16:38:49.912Z by coordinator.
