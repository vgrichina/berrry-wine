# Diablo II fresh-scene attempt — 2026-11-06

**Town and ground-click movement remain unverified.** One authorized current-main
registered `diablo2_demo` original reached the Barbarian character-name screen.
The next name-field click was refused before dispatch because its reviewed
capture was 12.440 seconds old, exceeding the new 12-second limit. The harness
closed the browser on that refusal. No input was replayed, no name was entered,
and no second original was launched. No emulator defect was established.

Evidence is `scratch/runs/20261106-diablo2-fresh-scene-town/`, continuing
`GLD3D-CORPUS-27-20261006`. This is an honest harness-limited outcome, not a new
title or a full-corpus qualification. The preceding attempt and recovery inputs
remain in [the current-backend note](diablo2-current-backend-20261106.md).

The run-local harness now checks capture age before and after reading the current
app immediately before dispatch. It requires one running registered Diablo II
guest Worker in an isolated page, together with the existing personally reviewed
capture hash. The atomic numbered ACK transport, claimed IDs and terminal handling
of unknown input remain intact. Nine existing transport controls pass. Four tiny
scene controls exercise the same admission function: 24.945-second stale refusal
with zero effects, current-scene success with one effect and atomic ACK, absent-app
refusal, and aging past the limit during the current-app read. A fixture assertion
initially used the wrong ACK property; its correction and distinct second control
queue are retained. No original ran before the controls passed.

I personally reviewed startup/title, main menu, Single Player response, class
selection and selected Barbarian/name-field captures. The first post-click image
still showed the menu; a read-only wait then showed class selection, without
repeating the click. Accepted Single Player and Barbarian inputs used reviewed
captures aged 9.638 and 9.142 seconds, with current running-app checks. The name-field
click was attempted too late: the guard rejected it at 23:15:05.876 UTC before its
dispatch callback. Its numbered request has no success ACK and was never resent.
The required town before/idle/click/settled sequence does not exist. Future work
needs a fresh capture whenever review-to-dispatch approaches the limit; this run
does not justify weakening the guard or assigning an emulator cause.

The tested source is main `4c179853d9d17cb795c6649d9d981064d77f592b`, plus the
recorded relevant diff and untracked `lib/wininit-boot.js` patch. All 25 genuine
installed files match the existing fixture hashes (135,378,002 bytes). The unused
installer remains absent and was not required. All 590 exact source, shell,
module, transport and media pins pass remotely before launch and locally after
retrieval. No source/media archive, guest memory/config/save edit, installation,
substituted media or production code/build change occurred. Only this note is
committed; run-local harness inputs and patches remain evidence. Local runtime and
source/module freezes were respected.

The actual loaded standard Wasm SHA-256 is
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`.
Four live Worker bytecode captures match it, and the unique module was retrieved.
Compat `41b0c704c91ba6fc7e4a6645d9421bf7fd3a23139b0b538b576e1e1b85527dd6`
was provisioned only. All 194 successful pinned static/bundle HTTP responses
match their bytes. Remote media were not hashed again after execution; local pins
remain unchanged. Chrome is 151.0.7922.108, V8 15.1.206.16, isolated default guest
Workers, 1024×768 viewport and 640×480 game buffer.

The actual render owner is Worker `68AF316BD9118B1265CFD37DDD6262C5`, endpoint 1,
legacy/WebGL. Adapter draw submissions advance 4,515 → 19,659 and completed fence
sequence 2,124 → 4,255 across reviewed startup/menu/class pixels. Owner control
observations agree and report zero errors; both completed software counters are
zero. These are actual owning-adapter draw submissions, not just a requested
backend. Town rendering, physical GPU completion/timing, FPS, audio, native Windows
and a second backend were not qualified.

Fresh boat `bx_a7rqyaj8` was created with a UUID Idempotency-Key persisted and
fsynced before creation, initially expiring 2026-11-07 00:13:16.985 UTC. Original
start was 23:13:38.164 UTC; Chrome exited zero without a signal at 23:15:06.013.
Unique logs/captures/module were retrieved before delegated normal stop. The
pre-stop inventory found both private ports refused, profile and writer lock
absent, Chrome absent, but the Node controller still live while pending CDP
timeouts drained. Its independent final exit was not observed. The completed
boat stop provides the final lifecycle cleanup: `stop_adc42012946e1f10`, completed
23:15:22.362 UTC, `forced=false`, `error=null`; API state `archived`, stopped at
23:15:22.342, active expiry null. Original/review/retrieval/normalstop took 104.198
seconds, within 35 minutes. No renewed HTTP403, automated flag, lifecycle retry,
resume or Den attempt occurred. Local disk stayed above 2 GB.

Recover using the exact Git SHA, relevant/untracked/owned-input patches and the
existing installed-media path/hash references in `runtime-pins.json`, as detailed
in `recovery.txt`. Preserve the reviewed images and unique module. The concrete
remaining dependency is a separately authorized original whose fresh-scene
review/dispatch cycle reaches character creation and then proves town movement.
