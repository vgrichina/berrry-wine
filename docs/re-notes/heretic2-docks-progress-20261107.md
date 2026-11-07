# Heretic II: interrupted original recovered, docks enemy contact

Run: `scratch/runs/20261107-heretic2-docks-progress/`.
Documentation only; no emulator repair or guest analysis/modification.

The original browser survived its worker launcher's abnormal termination.
Launcher 1939883 and its local child were reported absent after exit 143 at
10:43:47 UTC, without a final/result. That was **not** the original browser's
exit: read-only recovery found remote driver PID 6296 and Chromium PID 6308
alive on the assigned existing box `bx_pssg4x8s`. The launch receipt records
10:43:45.854582 UTC, `originalLaunches: 1`, `replayAllowed: false`.
No box was created/resumed and no original was relaunched during recovery.

## Reviewed ordinary gameplay

Read-only recovery found startup captured and the driver ready, with no prior
commands, pending inputs, sticky transport failure, or unknown command outcome.
A fresh numbered capture returned an exact acknowledgment before any input.
The predecessor's retained exact-driver Chromium preflight passed, including
the Heretic stock keys, forward/jump combination, trusted balanced delivery,
independent release, stale-scene handling and owner replacement guards.

The reviewed route was Main → Game → Easy → Raven intro → Space → loading →
docks. Every subsequent input referenced the latest inspected capture and
passed the existing freshness and owning-object checks. The stock registration,
arguments, original files/config and registered 1998 clock were preserved.
No console, map/cvar/save/config changes, guest-memory access or substituted
media were used. The licence remains personal private use; no deployment.

From the pier, forward movement exposed a rat beside Corvus; the initial
Control attack did not prove a rat hit. Turning toward the open waterside
walkway bypassed the earlier crate/closed-arch route. Near a fallen figure,
the game displayed “What has befallen my people?” This is a narrative trigger,
not an objective completion claim. The walkway leads to a lit passage and an
already open doorway with steps.

- `original/recovery-door-align.png`: a blade-wielding humanoid emerges directly
  ahead of Corvus at that doorway, arm raised; health is 75.
- `original/recovery-door-enemy-attack-held.png`: the humanoid remains close,
  holding its blade overhead; health is 58.
- `original/recovery-door-enemy-attack.png`: after the targeted stock Control
  hold, two bright red spell/contact effects overlap the humanoid's torso;
  Corvus is in an attack pose and health is 52.
- `original/recovery-enemy-followthrough.png`, `recovery-combat-settled.png`,
  and `recovery-combat-look.png`: after a separately reviewed, acknowledged
  Control follow-through, the doorway/adjacent paving is clear and health
  remains 52. No respawn, reload or second launch occurred.

These reviewed frames support visible targeted spell contact with the enemy.
No enemy health counter, death animation or corpse was captured, so a kill is
unverified. No objective completion, FPS, audio quality or parity is claimed.

## Identity and custody

Tested source commit: `dfcb4dada4e06862b8d6ed26ae567a77f50cbb50`.
`source-commit.txt`, `relevant-source.patch`, `untracked-runtime-inputs.patch`,
`owned-driver-inputs.patch` and `recovery-inputs.patch` retain the exact Git
identity and relevant source/driver differences. Git is the source archive;
no source tree or media archive was created. The original media remains at
`test/binaries/candidates/heretic-2-demo/installed`, referenced by member hashes.

All 1,825 originals and the 1,824-entry browser manifest were verified before
launch; all 2,463 staged runtime pins matched again after shutdown. Local
recovery rechecked every original hash. All 24 capture bindings retain the
same page/process/canvas/guest/render Worker owners. The actual guest and
owning GL/WebGL render Worker modules both match SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Chromium is 151.0.7922.108, viewport 1024×768, original canvas 640×480;
the actual owning renderer endpoint reports `api: gl`, `backend: webgl`.

All 24 numbered commands have exact successful acknowledgments, with zero
stale refusals or unknown outcomes. Final passive inspection found all keys
released, mouse mask zero and input queue empty. Ordinary transport quit
returned its exact acknowledgment; Chromium exited code 0, signal null at
10:53:23.549 UTC. All 14 recorded runtime/helper PID identities were absent,
HTTP 37467 and DevTools 39253 closed, profile removed and writer lock absent.
All 27 terminal PNGs passed chunk CRC and IDAT decoding.

Before the explicitly delegated normal stop, all 303 terminal files
(15,720,880 bytes), including unique logs/captures and the actual module, were
retrieved and SHA-256 verified. Stop completed nonforced at 10:54:14.298 UTC;
box state is **archived**, `archiveAfter: null`. Custody returns to the
coordinator; do not resume this box. The immutable final deadline remains
11:18:06.551481 UTC and the recorded browser deadline was never extended.

Shared `/home` fell to 1,880,686,592 free bytes after gameplay had closed and
retrieval had finished; this was reported immediately without new allocation.
Coordinator cleanup restored 2,388,164,608 bytes by final verification.
`recovery-verification.json`, `terminal-input-check.json`,
`terminal-retrieval-verification.json` and the box-state receipt retain the
checks. The global evidence checker still reports an unrelated preexisting
Alice reference outside its run; this run's prospective schema, containment
and artifact existence checks pass.

Next work, if assigned: follow the open doorway into the interior and capture
a conclusive enemy defeat or native objective interaction in a fresh authorized
run. This task's terminal `result.json` is written last.
