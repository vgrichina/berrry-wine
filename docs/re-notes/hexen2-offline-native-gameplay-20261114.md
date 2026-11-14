# Hexen II offline native recovery and gameplay — 2026-11-14

Run: `scratch/runs/20261114-hexen2-offline-native-gameplay/`.

Exact local native dependency recovery succeeded without network access. The
retained Q3 `package.json` and `package-lock.json` matched SHA-256
`3ed55cf48ef3a1a00e7971ea528b9b2c991decbbf8917901310d59f3808e936f` and
`125ea670ef6333b93d4375ed558fc42c24af2da9a4fbe2ed49e929ee519e0976`.
`npm ci --offline --prefix scratch/runs/20261114-hexen2-offline-native-gameplay/native-deps --no-audit --no-fund`
returned 0. All 162 provider files matched the retained Q3 native pins in both
size and SHA-256 before use. `NODE_PATH` points only to this run's private
provider directory; `createRequire` from `lib/headless-gl.js` resolves both
`@node-3d/glfw` and `@node-3d/webgl` there. Root dependencies were untouched.

The first native preflight failed its right-edge resize assertion. An unchanged
second preflight passed, preserving both outputs. This repeats the Q3 preflight
instability; it does not establish a fix. Native renderer reported llvmpipe
LLVM 20.1.2 / WebGL 1.0. The emulator's SoftwareGL flag remained 0 in observations.

Under `/tmp/wine-heavy-runtime.lock`, all 317 accepted emulator source closure
files and module hash matched the accepted SuperTux build. No new full build
was needed. The actual loaded module was observed as SHA-256
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
Launch HEAD was `bcd802d24f7241f5108322b9f1ffefe86457a0cd`; relevant dirty hunks
and untracked runtime input are retained as Git patches. All 18 media/manifest/
control pins passed, including registered `glh2.exe` SHA-256
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The registered startup registry, media and controls were used unchanged.

The one original run uses `--headless-gl --real-ticks`, default 1000-block
batches, cooperative scheduling, fixed `--max-seconds=1200`, and an independent
1220-second watchdog armed before native launch. It waited behind SuperTux and
TIM2. Native menus reached Single Player → New Game → Paladin → Apprentice.
The runtime reported 1141.176 seconds; its actual parent wait completed about
1144 seconds after launch following native Quit; the fixed
1200-second limit was not extended and no second process launch occurred.

Current bindings were read before launch: W/S move, A/D strafe, Mouse1 attacks,
Ctrl crouches. Older Ctrl attack observations were not reused as current input.
Each decision requires a fresh reviewed full-scene capture, with a one-use
SHA-bound review and 30-second admission limit. Finite movement/look/attack
commands were recorded before launch; independent UP is armed before DOWN.
The controller preserves UNKNOWN receipts and never replays them. Six finite
input tests, three actual child/watchdog lifecycle tests, the new fresh/expired/
one-use review test, and current native owner/guard tests passed.

Licence scope remains runtime/API observation and emulator source only: no
guest reverse engineering, disassembly, extraction, patch or substitute DLL.
No box, download, deployment, other worker or foreign source change occurred.
Full27 remains unproved.

## Observed result and limits

The first native route reached the courtyard at health 79, then traversed the
ramp, skull door and chamber. `chamber-entry-released.png` shows two living
spiders at the doorway. The next chamber scene shows health 68; later views
show 37, 3 and native death at 0. No attacks were fired without an identified
visible target. One ordinary Mouse1 respawn returned to the courtyard at 74
within the same process and deadline. This was a native gameplay respawn,
not a second runtime launch.

The second approach reached the chamber at 54. `return-pursuers-review.png`
shows a foreground spider at right and health 26. A finite relative aim
(+150,+100) and 1000 ms Mouse1 pulse was submitted toward that visible spider;
motion, DOWN and independently prearmed UP all have successful CLI ACKs.
`aimed-spider-consequence.png` shows player death at 0 and a living spider.
**No distinct enemy pain/hit, corpse, kill counter or outgoing damage/kill
consequence was observed.** Neither a living attack pose nor living execution
of that final attack is proved: health could have reached zero between the
reviewed target frame and actual input consumption. CLI ACKs alone are not
claimed as guest gameplay success.

The live native Options → Customize Controls screen was inspected read-only
(`native-bindings-review.png`): Mouse1 attack, W/Up forward, S/Down backward,
Left/Right turn, A/D strafe, C/Ctrl crouch. No assignments or settings were
changed. Some short movement/back-menu pulses had no immediate visible effect,
and some turn corrections overshot. Subsequent scenes were inspected rather
than treating injection ACKs as traversal proof. No generic emulator defect
was isolated or changed.

There were 50 manually chosen decisions, 46 finite pulses and 155 command ACKs,
with no terminal UNKNOWN receipt. All decision captures are retained with
review descriptions and hashes; they are manually reviewed scenes, not an
automated capture series. Review-to-submission age was at most 1.082 seconds.
Capture-to-submission age was measured separately: maximum 35.581 seconds for
the safe ramp relative-look correction; the admission gate bounded review age,
not capture age. This limitation is explicit. Native input consumption counted
44 key DOWNs, 43 key UPs, and two mouse DOWN/UP pairs. Final Y release reached
the renderer and was acknowledged, but the guest exited before one last
key-UP consumption; no consumed native UP is claimed for that edge.

## Native shutdown and retained evidence

Native Escape → Quit → Enter showed `PRESS Y TO EXIT`
(`quit-confirmation-review.png`). Y DOWN/UP were acknowledged and the guest
exited 0. Runtime actual wait 0 has separate stdout/stderr EOFs; watchdog
actual wait 0 reports runtime-terminal, with no deadline signal. The detached
supervisor's launch child and the outer supervisor child both have actual
wait 0 and separate EOFs. The heavy lock was released and all five recorded
runtime/watchdog/supervisor/outer PIDs were absent. The detached outer process's
own wait status was not obtained; its absence is not substituted for that
status. The auxiliary messageboard watcher was terminated; its original parent
wait is likewise unavailable.

Postflight rechecked 18 media, 317 accepted source and 162 native provider pins
with zero drift. All 68 loaded accepted source files matched; 36 other observed
loaded files were hashed and rechecked against their current bytes, without
claiming they belong to the accepted source manifest. The actual module hash
matched. Native GL recorded 7475 presents/readbacks and `gl_sw_enabled=0`;
this is native provider execution using llvmpipe, not a physical-GPU or
performance claim. The first-preflight resize failure remains unresolved.

The result index names 56 selected, manually inspected PNGs. PNG chunk CRC,
inflation and SHA-256 checks passed. Only two redundant passive loading
snapshots were removed; no decision scene was removed. Compact logs, JSON,
source/module pins and Git patches retain recovery evidence. The private
native `node_modules` is removed after its successful postflight verification;
its exact retained manifests and offline recovery recipe remain. Root
`node_modules`, media and foreign source WIP were untouched.

Goal status: traversal, two living encounters, incoming damage/death, exact
offline provider recovery and native Quit are established. Outgoing enemy
damage/kill and living attack execution remain missing. No new box was created:
box ID null, state NOT_CREATED, expiry null, stop receipt N/A. No further
runtime is authorized by this completed single bounded task. Full27 remains
unproved. A separately assigned future encounter attempt would still need
visible aim and a distinct outgoing consequence.
