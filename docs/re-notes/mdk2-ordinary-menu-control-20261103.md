# MDK2 ordinary menu/control — 2026-11-03

**Result: reviewed original New Game → Medium → controlled tutorial gameplay.**
Up/Down moved Kurt between the starting platform and the floor grid; Space
entered and exited sniper view. This establishes the bounded route on the
explicit software renderer, not general hardware/browser compatibility.

Input source: `1537186c32f27229f67d20798f6c2d16a5524556`, containing the
tested production revision `856be29429f5921cf89a437556c3436b685d7ac5` and
WGL implementation `20fed4877`. Evidence is in
`scratch/runs/20261103-mdk2-ordinary-menu-control/` (ignored).

This is one fresh, serialized original-game task. Alice's local lifecycle
receipt establishes normal STOPPED at 23:18:41.431Z before this allocation.
Owner cleanup had restored over 8 GB decimal free. The coordinator policy
was reread with its cap of two production workers. No subworkers or successor
were launched; the predecessor MDK2 box was not resumed.

Fresh runtime `bx_a9f4vb8k` has TTL 3600 and original expiry
`2026-11-04T00:20:25.206Z`. The original dispatch delegates normal shutdown
to this worker only after full local recovery of unique evidence and both
modules, and a completed verified snapshot.

Source was provisioned directly from the exact Git commit with a depth-one
fetch. `source-identity.json` and `relevant-source.patch` record the source
identity and relevant tracked delta; no source-tree tarball was made.
The pinned original media was transferred only into the isolated runtime.
All 29 original hashes passed there before launch. Evidence references local
paths and hashes, including executable
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`,
manifest `a0c90df1480e9e81c5734dca97a8e8b308c3709e87964433fe1f4df5875c6316`
and the original 88-byte config
`87261f003683d21f366e28e3c37c89d85804e69daaa2348b17da15bfe8e902ba`.
No executable, game memory, configuration or mandatory check was patched.

The canonical module actually compiled and instantiated by PID 9911 is
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
The compatibility module remains
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
The three WGL prerequisites reuse the predecessor's accepted native,
actual queued Worker and WebGL1/2 evidence with negative controls. This
task makes no new production changes and does not repeat those tests.

The first launch used a background shell under a finite exec request. That
request reported a timeout; the first control step later disconnected,
the Node exit observer recorded code 1, and no driver exit receipt was
produced. The original partial gzip and exact receipts are preserved under
`game-launch-first/` and local first-failure records. A supported detached
Boat exec started the replacement driver in the same fresh allocation.
The native-provider context-zero failure from the predecessor remains a
separate environment failure; this task explicitly uses the software renderer.

The replacement command is recorded verbatim in `game/command.json`.
It uses registered `mdk2_demo`, batch size 100000, frozen control, ordinary
input and an internal 2400-second wall guard. Every individual step request
is at most 64 batches and is acknowledged before the next. The initial
5 ms/batch clock preserved the startup route; at batch 1439 the ordinary
harness clock control changed it to 20 ms/batch without changing guest
configuration. Early Enter/pointer inputs occurred while the copyright
transition remained visible; they are preserved rather than called a
completed menu interaction.

Reviewed route:

- Batch 394: Interplay logo.
- Batch 1034: original MDK2 logo/copyright screen.
- Batch 1503: fully readable main menu, controller icon selected, New Game.
- Batch 1520: ordinary Enter opened Select Difficulty, Medium highlighted.
- Batch 1537: another Enter closed the difficulty dialog and began loading.
- Batches 1857–3905: Hectic comic loading screen.
- Batch 4417: comic intro. Escape advanced to the in-engine dialogue at 4498.
- Batch 4773: Jim Dandy title card; subsequent Escape advanced the cutscenes.
- Batch 5816: Kurt at the Jim Dandy doorway.
- Batch 6622: Alien Minecrawler, Edmonton, 9:05AM title card.

- Batch 7134: tutorial room, Kurt and health 100. Escape opened Paused at
  7153; Enter selected Continue at 7172.
- Batch 7236: idle baseline at the circular platform. Num 8 down/DI-down,
  held for 64 batches, DI-up/up ended at 7303 without visible displacement.
  That exact unsuccessful binding test is retained; no cause is inferred.
- Batch 7370: Up-arrow down/DI-down held for 64 batches moved Kurt off the
  platform onto the yellow floor grid, with the tutorial dialogue visible.
- Batch 7389: Space down/DI-down held for 16 batches switched to the first
  person sniper frame, reticle and **Sniper Bullet** HUD. Another Space at
  7408 restored third person.
- Batch 7475: Down-arrow held for 64 batches moved Kurt backward onto the
  circular platform. These complementary movements and reversible mode
  changes were visually reviewed against the idle baseline and input log.

The ordinary control transcript has 314 sequential requests, 166 step
requests, maximum step 64, and 7475 acknowledged completed batches.
`control-verification.json` checks matching replies and completed counts.
The frozen input commands acknowledge queueing; subsequent completed steps
and dispatch records establish delivery. At the terminal checkpoint one
window key-up remained queued although the DirectInput release had executed.
The terminal fault-status read reported no failure but **armed=false**; it
is not evidence from an armed fault latch. Successful captures, normal exit,
and the observed control route are the evidence for this result.

Ordinary quit was acknowledged; PID 9911 exited 0, reason null, after
1263.122 seconds. All 29 original media hashes passed again locally and
on the runtime. No synthetic gameplay, injected game calls, replacement
executable, configuration edits or check suppression was used.

All 106 recovered files, including the first failed launch evidence and BOTH
canonical/compatibility modules downloaded from the runtime, passed full
SHA-256 verification. The named snapshot
`mdk2-ordinary-menu-control-20261103` was saved; the runtime snapshot was
completed and verified at `2026-11-03T23:44:06.874Z`, and latest snapshot
`00f7dfd6-c958-42c1-8ce2-10caf0046634` completed at 23:44:11.920Z.
An exit-on-failure shell verified recovery, module hashes, normal process
exit and completed/verified snapshot before issuing STOP. Actual normal
nonforced STOPPED time is `2026-11-03T23:44:35.584Z` (operation completed
23:44:35.605Z), error null. `lifecycle.json` records runtime release.

This task is complete. No successor was launched. Further game coverage,
such as shooting/jumping or a browser renderer run, requires a separately
assigned task; it is not implied by this bounded menu/movement/sniper result.
