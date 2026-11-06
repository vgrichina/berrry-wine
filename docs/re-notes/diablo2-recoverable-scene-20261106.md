# Diablo II recoverable scene and town movement — 2026-11-06

**Town reached; ordinary ground-click movement demonstrated.** One authorized
fresh-boat original of registered `diablo2_demo` progressed through Single Player,
Barbarian selection, character name `BOAT`, loading, and town. Personally reviewed
matching town before/idle/click/after/arrival captures show the result of one
ordinary left click on open ground. The centered hero walks while the wagon and
torch shift approximately 125 screenshot pixels left and 31 up; the later idle
capture retains that terrain position. No Den, second original or second backend
was attempted.

Evidence is `scratch/runs/20261106-diablo2-recoverable-scene/`, continuing
`GLD3D-CORPUS-27-20261006`. Review `review/town-before.png`,
`review/town-click.png`, `review/town-after.png`, `review/town-final.png` and
`review/town-arrived.png`, plus their state/capture records and
`capture-reviews.json`. This supersedes the town limitation in
[the earlier fresh-scene attempt](diablo2-fresh-scene-town-20261106.md).

The run-local command consumer now distinguishes a guard-generated stale-scene
refusal before dispatch from uncertain execution. It consumes the stale command
ID and atomically acknowledges `status=refused-before-dispatch`, `effects=0`,
`refreshRequired=true`; the session and numbered queue remain available. A dispatch
marker prevents partial execution from taking that recovery path, even if an error
has the stale code. Partial/UNKNOWN commands remain terminal and cannot be replayed.
The existing 12-second scene limit, personally reviewed capture hash, current-app
check, ordered ACK transport and duplicate-ID exclusion remain in force.

Nine existing transport controls pass. Six focused recovery cases run the actual
`browser-run.cjs` executor with fixture CDP responses: stale zero effects, fresh
capture and new current-app-checked action on the same queue, consumed-ID rejection,
partial execution terminal handling, UNKNOWN no replay, and aging during the app
check. An initial fixture omitted its CDP session stub; the corrected second
fixture queue passes. No original ran before these controls passed.

The original itself proves the recovery: command 0 deliberately uses an expired,
personally reviewed startup scene and is refused with zero effects. Command 1
refreshes; command 2 successfully clicks Single Player after personal review and
the current running-app check, in the same live original and queue. Each later
scene-dependent action uses the latest reviewed capture. No refused input was
replayed. The immediate Single Player response still showed the menu; a read-only
wait exposed class selection. The name was initially blank after ordinary CDP
`insertText`. A small, separately tested, pinned run-local keyboard bridge sent
ordinary balanced CDP keyDown/text/keyUp events through the same guard and ACK
consumer, with a new command ID. After a read-only settling wait, `BOAT` was visibly
present. This is an input-harness adjustment, not an established production defect.
The later OK response was a distinct loading scene, followed by reviewed town.

Actual render owner `DFF1D0EC736BFF0CD48A7C7046174BF5`, endpoint 1, is legacy/WebGL.
Its adapter draws advance 5,455 → 53,807 from menu to arrival, and completed fence
sequence 1,924 → 7,863. Across town before → arrival alone they advance
46,593 → 53,807 and 6,384 → 7,863. Independent owner control observations advance
6,388 → 7,867, with error zero. Completed software and fallback-software draw
counters remain zero. These establish owning-adapter progress alongside reviewed
pixels; they do not establish physical GPU execution timing, FPS or performance.

The tested main source is `92dc49f6d32e211335728b8296cd267e42ba1b1f`, plus the
recorded relevant diff and untracked `lib/wininit-boot.js` patch. All 590 source,
shell, module, harness and media pins match remotely before and after execution,
and locally after retrieval. All 25 genuine installed files match the established
fixture hashes; media are referenced by existing path and SHA-256. All 195 pinned
successful HTTP responses/bundles match their bytes. Four live guest Worker
bytecode captures match standard Wasm
`6cd858302895de91df5af17e3a3742281e31f369ddb6528d7b96252b3423caac`;
the unique loaded module is retained. Compat was provisioned only. The keyboard
bridge's additional pin and admission are retained separately. Chrome is
151.0.7922.108, V8 15.1.206.16; isolated guest Workers, 1024×768 viewport,
640×480 game buffer. No production source/build/module change, local emulator
runtime, guest memory/config/save edit, source/media archive, substituted media,
benchmark, full27 qualification, audio or native Windows claim occurred.

Fresh boat `bx_j7q2dch4` was created only after its UUID Idempotency-Key was
persisted/fsynced. Initial expiry was 2026-11-07 00:19:53.747 UTC. The original
window began 23:20:18.194 UTC; Chrome exited zero and normal browser cleanup
completed 23:26:52.472. Both private ports refused connections, profile and writer
lock were absent, and a later process check confirmed both Node and Chrome absent.
All 172 inventoried run files were retrieved or matched to already retrieved
captures. Delegated normal boat stop `stop_2e1ec980b49c81cd` completed
23:27:24.252, `forced=false`, `error=null`; final API state is `archived`, active
expiry null. Start through confirmed stop took 426.058 seconds, within 35 minutes.
No HTTP403, held-operation retry, resume or relaunch occurred. Local free disk
remained above 2 GB.

Recover using the Git commit, relevant/new-file patches, owned-input and helper
patches, runtime pins, original media paths, unique module, captures and logs.
Git remains the source archive. Only this note is committed; the run-local changes
remain evidence. No production repair is proposed. The bounded town/movement goal
is satisfied; longer gameplay, combat and other routes remain unqualified. This
worker releases its files and boat ownership after publication and stops.
