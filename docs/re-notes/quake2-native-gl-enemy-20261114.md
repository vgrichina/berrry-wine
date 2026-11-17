# Quake II original native GL encounter — 2026-11-14

Run: `scratch/runs/20261114-quake2-native-gl-enemy/`.

The original registered `quake2_demo` reached GAME → Easy, the opening room,
the slatted passage, and the next tan industrial room. Living soldiers and
incoming damage/death were reviewed. Three finite aimed Mouse1 bursts and one
finite Enter attack pulse were delivered, but **no distinct outgoing hit,
defeat, or attack-triggered onward-door consequence is established**. The
native Quit confirmation completed with exit 0. This is a bounded gameplay
blocker report, not full acceptance; Full27 remains unproved.

## Exact route and recovery

The registry, media and bundled controls were unchanged. Startup was exactly
`+set vid_ref gl +menu_main`, with authentic `gamex86.dll`, `ref_soft.dll` and
`ref_gl.dll` preloads. No console/map command, forced guest call, authored
state/config/AI/score write, tracking, autoplay, software fallback, extension,
second game process, network download, box or deployment was used. The native
game created its own entering save; after deaths, ordinary Enter and the
native Load Game → ENTERING Outer Base selection restored it in the same
process. No external save bytes were supplied or edited.

The retained Q3 native-recovery recipe supplied these exact manifest hashes:

| Input | SHA-256 |
| --- | --- |
| `package.json` | `3ed55cf48ef3a1a00e7971ea528b9b2c991decbbf8917901310d59f3808e936f` |
| `package-lock.json` | `125ea670ef6333b93d4375ed558fc42c24af2da9a4fbe2ed49e929ee519e0976` |

`npm ci --offline --prefix scratch/runs/20261114-quake2-native-gl-enemy/native-deps --no-audit --no-fund`
returned 0. All 162 retained provider pins matched size and SHA-256 before and
after execution. Actual runtime `createRequire` resolution from
`lib/headless-gl.js` selected this run's private `@node-3d/glfw` and
`@node-3d/webgl`. Root dependencies were untouched. The private `node_modules`
was removed only after postflight verification; the package/lock, 162 pins and
offline recovery recipe remain.

All 68 registered media/control/manifest inputs were present and pinned; no
installer extraction or media recovery was needed. Principal hashes:

| Input | SHA-256 |
| --- | --- |
| `quake2.exe` | `2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b` |
| `baseq2/gamex86.dll` | `11fd73be2887a6c567517dbbf74c2f5040c3636e4863befd1ade9f4537e52d60` |
| `ref_gl.dll` | `d07b419749584220eb7748c781e181880a7919f38cf50e48b7c1e1f35772efcc` |
| `ref_soft.dll` | `da4fd68c47a68712a8790aad3abb6a6b43355d0fc9d922fffea17998a421dbe7` |
| `baseq2/pak0.pak` | `cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09` |
| `lib/quake2-modern-controls.ini` | `afb166910b596b204e1c11f93ff4972999804d18299bde134d6380a51587e3b3` |

Under the heavy lock, all 317 accepted source pins and the built module matched
the accepted SuperTux reuse chain, whose full locked build log is
`scratch/runs/20261114-supertux-original-consequence/build.log`. No new full
build was run. Actual loaded WASM SHA-256 was
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
Launch HEAD was `8c12efe999c1cf2a0079f427cf61416dee5ad129`.
Launch pins, relevant dirty Git hunks, new runtime input and new controller
patches are retained; Git supplies source recovery, with no source archive.
Postflight checked 317 accepted source files, 68 media inputs, 162 provider
files and 103 observed loaded files with zero drift. Observed loaded files
outside the accepted manifest are not represented as accepted build inputs.

The first native preflight passed: llvmpipe LLVM 20.1.2, WebGL 1.0. This run
did not repeat the earlier Q3/Hexen II resize failure and does not fix it.
Native execution recorded 4634 presents/readbacks and `gl_sw_enabled=0`.
The llvmpipe provider is not a physical GPU or performance claim.

## Reviewed gameplay and input limits

The one fresh runtime used `--headless-gl --real-ticks`, default 1000-block
batches, cooperative scheduling, fixed `--max-seconds=1200`, and an independent
1220-second watchdog armed before launch. It took its fair heavy-lock turn
after SuperTux enemy and TIM direction; the subsequent SuperTux worker queued
behind it. Native launch was 13:45:50Z; stats report 1119.247 seconds and
961108 batches before native Quit. No deadline was extended.

The bundled ordinary bindings were inspected before launch: W/S forward/back,
A/D strafe, Enter/Mouse1 attack, Space jump, Ctrl/C crouch. Keyboard turns and
relative look were used. The native main menu was reviewed near shutdown,
including the Options selection, but Customize Controls was not opened and no
settings were changed. Bundled bindings alone do not prove guest action
execution for every pulse.

Selected reviewed scenes include:

- `loading-boundary-review.png`: first textured world, blaster, crosshair, 100HP.
- `opening-advance-released.png`, `support-clear-released.png`,
  `slatted-entry-released.png`: movement around the support and into the passage.
- `corridor-exit-review.png`: first native death with a soldier over the player.
- `ramp-progress-review.png`: raised opening-room floor beneath red sky.
- `inner-end-approach-released.png`, `soldier-aim-review.png`: living soldier at
  the far doorway, then close beside the player at 88HP.
- `aimed-burst-consequence.png`, `second-burst-consequence.png`: two aimed
  Mouse1 pulses; soldier remains upright or bent, with ambiguous blood effects.
  The bent pose does not establish a distinct pain reaction or defeat.
- `soldier-settled-consequence.png`: player dead, soldier still alive.
- `final-end-opening.png`: onward tan room beyond the slatted passage.
- `final-onward-room.png`, `final-soldier-aim.png`: next approach with a living
  soldier. A third Mouse1 burst and Enter attack pulse follow reviewed targets.
- `final-enter-consequence.png`: native player death, soldier still alive.
- `native-confirmation-current.png`: actual QUIT? Y/N confirmation.

Navigation initially confused the near and far ends of the slatted passage;
later scenes distinguish the tan room from the opening room. Some short pulses
had little or no observed effect, and immediate captures sometimes preceded
the final camera change. Later released/settled views were inspected, without
promoting ACKs to movement or attack proof. Close melee and slow manual review
left too little living time to establish a hit. No causal generic emulator
defect was isolated, and foreign NE/render/host WIP was untouched.

The controller admitted 68 manually chosen scene-bound decisions, including
62 finite key/mouse pulses. Independent UP timers were armed before DOWN.
Both capture-to-submission and review-to-submission admission limits were
30000 ms: observed maxima were **28093.304 ms** and **605.165 ms**. Capture
time comes from completion of the actual PNG write, not a refreshed review.
Each reviewed capture SHA and runtime PID/start token was bound to a one-use
capture identity. A new review could not reuse it.

One later respawn request was positively rejected as `INVALID`, reason
`capture expired; NOT_SENT`; it had no DOWN arm or delivery. A fresh full-scene
capture and distinct intent then proceeded against the same runtime identity.
The expired intent remains preserved. The command helper initially waited for
nonexistent DOWN receipts on this refusal and timed out; the parent refusal
receipt, rather than that timeout, establishes NOT_SENT. No UNKNOWN was
cleared or replayed. Receipt totals: 211 ACK, 62 PAIR_ARMED, one INVALID.

The runtime used stdin inputs with controller PID/start-token and scene
checks. It did **not** use `guarded-bind`/`guarded-input` for these gameplay
commands; native queue/device/window epoch lease validation is therefore not
proved by this run. Separate owner/guard regression passes do not establish
that the live route used those guards. This is an additional qualification
limit for any stronger acceptance claim.

Observer counts show 59 key DOWN deliveries, 58 key UP deliveries, and three
mouse DOWN/UP pairs through `takeInput`; all 59 key UPs reached the renderer.
These host input/guest-delivery observations are separate from Quake's internal
attack consumption. No living attack pose or distinct outgoing hit is claimed.
Final Y UP was acknowledged and reached the renderer, but the guest exited
before consuming that last queued key-UP.

## Tests, shutdown and missing requirements

Fresh/expired-capture-with-fresh-review, duplicate identity, new capture/new
intent, wrong target, independent prearmed UP and terminal UNKNOWN controls
passed. The expiry/identity cases passed before launch. A final prelaunch
release fixture failed because its fixed 80 ms sleep observed the timer before
its receipt-flush/finally completion. That failed output is preserved. The
fixture was corrected to wait for completion and passed during the run; the
runtime controller was not changed or relaunched. This ordering is explicit,
not an all-prelaunch-pass claim. Three actual normal/deadline/signal lifecycle
fixtures, current input-owner and guarded-input tests also passed. Native
preflight passed on its first attempt. All 79 individually selected manual
PNGs passed CRC, IDAT inflation and SHA-256 checks; they are not an automated
frame series.

Native Escape → Quit → Enter showed QUIT? Y/N; Y completed native Exit 0.
Actual runtime wait was 0 with separate stdout/stderr EOF. Watchdog actual wait
was 0, reason runtime-terminal, with no deadline signals. The launch child and
outer supervisor child also have actual wait 0 and separate EOFs. The watchdog
inherited launch stdout/stderr, so its own separate EOFs were **not captured
independently**. The detached outer process's own wait and auxiliary watcher
wait remain UNKNOWN; their absence is not substituted for actual waits.
All five recorded runtime/watchdog/supervisor/outer PIDs were absent, the heavy
lock was released, and the watcher was signalled TERM. No box was created:
ID null, state NOT_CREATED, expiry null, stop receipt N/A. Disk remained above
the 1.5 GB requirement; no RAM gate or foreign cleanup was used.

Missing gameplay requirements are a distinct outgoing enemy hit/defeat or an
attack-caused onward-door consequence, with living aimed execution and a
reviewed released outcome. Stronger lifecycle/input qualification also needs
actual live native owner-lease use and independent watchdog stream EOF capture.
No full acceptance or repeat attempt is implied. The one bounded task stops
with these requirements and evidence preserved.
