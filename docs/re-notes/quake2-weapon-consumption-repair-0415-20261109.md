# Quake II passive attack input repair, 0415

The concrete defect was observer coverage: the actual 0105 chain's page reader
reports physical keys 37–40 only. Its held samples cannot show Control or Enter,
their live bindings, or the engine attack latch. The native input helper already
sends correct Enter/Control codes. No delivery or game-consumption defect was
established, and no bindings changed.

Evidence: `scratch/runs/20261109-quake2-weapon-consumption-repair-0415/` (R).
`base-sha.txt` records the exact starting Git commit; `relevant.patch` contains
the small owned changes, including new files. Original executable and config
are referenced by path/size/SHA in `inputs.json`, not copied. Retained disassembly
windows are small text extracts from that installed executable.

## Mapping and delivery traced offline

The registered app mounts `lib/quake2-modern-controls.ini` as
`c:\baseq2\config.cfg`, after original defaults. It specifies ENTER `+attack`,
CTRL `+movedown`, MOUSE1 `+attack`. Saved config can override first-launch
defaults; these text bindings alone do not certify a run's live bindings.

`tools/quake2-native-input.cjs` sends native CDP keyDown/keyUp with Enter/VK13
or Control/ControlLeft/VK17. `lib/renderer-input.js` converts those DOM codes
to Set-1 0x1c/0x1d in queued WM_KEYDOWN/UP lParam. `host.js` check_input calls
the actual renderer takeInput, preserves lParam separately, and returns the
packed message; the guest message pump dispatches it to the game window.
Host physical state and queue consumption are distinct from game execution.

Installed `quake2.exe` SHA-256 is
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
Its MapKey at 0x42fe10 reads the lParam scan byte and the table at 0x44d398:
scan 0x1c maps to engine key13, scan 0x1d to engine K_CTRL133, **not VK17**.
Key_Event at 0x419650 consults key bindings at 0x4d6c60, distinguishes menus
and gameplay, and queues plus/minus command strings with the engine key.
Registration at 0x408122/0x408134 connects `+attack`/`-attack` to
0x407930/0x407940. Those wrappers pass 0xac13a0 to KeyDown/KeyUp
(0x407650/0x4076e0): two down-key slots, timing words and state at +0x10.
KeyDown sets state bits 1/2; release clears held and sets bit4.
At 0x407de0, command construction tests state bits 1/2, sets usercmd byte+1
bit1 and clears the impulse-down bit. The disassembly establishes this static
dependency; a passive latch sample does **not** witness that instruction
executing or a usercmd reaching server/weapon simulation.

## Retained 0350 evidence and limits

`retained-input-audit.json` rehashes the selected retained command/sample files
against that run's retrieval manifest. There are 18 retained command files,
two forward/Control commands (`enter-low-breach`, `crawl-inner-tunnel`), and
two Enter commands (`menu-game`, `easy-start`). Sampled physical key IDs are
exactly 37,38,39,40. The Enter commands selected menus; they do not establish
gameplay attack. Neither Control ACKs nor advancing slices prove crouch or
attack consumption. No new numeric attack state was recovered from those
arrow-only samples. The original ended at HP0/death; cause remains UNKNOWN.
The observed-weapon and covered-control notes read for this task concern TR2;
their observer identities and consumption conditions are not Q2 authority.

## Small production repair

The composition now wraps the actual retained chain with
`tools/quake2-passive-attack.cjs`. The retained evidence files stay immutable.
Existing capture/admit/progress still own scene freshness, identity checks,
failure closure and all command budgets. The wrapper adds one bounded page
evaluation to captures and existing held samples; it adds no sampling loop.

The reader checks the existing process, endpoint, Worker, module, renderer and
canvas object tokens plus epoch, and requires the link's memory to equal the
process's SharedArrayBuffer-backed memory. Memory and buffer identity are
retained across samples. Seven canonical executable/table windows are checked
against the installed SHA-authenticated file before interpreting addresses.
Only conservative direct guest pointers are read; sparse, non-ASCII and
unterminated binding strings are explicitly UNKNOWN. Each string is capped at
128 bytes. The executable, mapping and ownership failures return UNKNOWN.

Capture binding JSON and held sample JSON now retain physical Enter/Control
alongside arrows, the live bindings for engine keys13/133/200, and two raw
five-word attack-latch reads with held/impulse-down bits. Unequal reads are
UNKNOWN. Equal reads are snapshots, with **consumption and weaponEffect still
UNKNOWN**: asynchronous changes/ABA and intermediate events can be missed.
No guest export, Worker command, poll counter, private guest write, rebinding,
clock, synthetic action observation or CPU execution is introduced. Snapshot
fields are diagnostic evidence, never an automatic fire/damage qualification.

The independent physical release timer and all failure paths are unchanged.
Both strict preCPU/preDllMain flags and the complete zero-entry DLL barrier
remain byte-identical. Work20s, ACK22s for quit, cleanup30s, hold50–2000ms and
existing freshness limits remain unchanged. Source lifetime REVOKED,
all-writers/edict ABA UNKNOWN and full27/parity/audio/FPS remain open.

## Validation and stop

`node tools/quake2-passive-attack.test.cjs` runs actual old/new production
readers against explicitly authored shared-memory data: oldFAIL omits Control
and attack, newPASS retains keys/bindings/latch. It verifies no shared-memory
writes, canonical scan mapping, sparse pointers, changed executable and
equal-looking owner/memory negatives, and serialized capture/progress calls.
Actual native hold functions feed actual production renderer key handlers and
takeInput for Enter/Control, including failures after DOWN, sampling and UP;
each attempted DOWN receives UP, and failed UP remains UNKNOWN.

The existing keyboard lParam regression and all eleven Node-only composed
driver scenarios pass, including review refusal, partial input, sticky failure,
pending work cancellation, close caps, actual process waits and separate EOFs.
`flock /tmp/wine-build.lock bash tools/build.sh` passes on the final code.
Logs are in R. Fixtures establish reader and host-delivery behavior; no actual
game input consumption, shot, damage, kill or new gameplay is claimed.

Entire task is offline with no browser, box, game/runtime, agent/worker or
deployment. Box ID/state/expiry/stop receipt: NOT_CREATED / not applicable.
Free /home remained above 1.5 GB. Git base plus patch provides source recovery;
there is no source/media/module archive. Next is a separately authorized combat
attempt using reviewed gameplay pixels and live attack snapshots, with effect
qualification only from evidence actually obtained. Single-task STOP.
