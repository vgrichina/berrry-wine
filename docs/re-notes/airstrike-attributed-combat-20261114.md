# Airstrike original attributed-combat attempt — 2026-11-14

The single original registered `airstrike_pre6a` session demonstrated fresh
human-controlled firing, acceleration, turning and bombs, followed by actual
native menu Quit. **An attributable outgoing enemy hit or kill remains
unproved.** The close-range shot/bomb action was followed by `03–00` → `04–01`,
but collision and cannon fire remain competing causes of the red death. The
match ended with “Red Baron, by 4 point(s).” This is a bounded combat attempt
with missing attribution, not a successful human-kill qualification.

Evidence: `scratch/runs/20261114-airstrike-attributed-combat/result.json`.
The earlier restored run's `02–00`, wrecks and explosions are not reused as
progress. Full-27 coverage and browser parity remain unproved.

## Original controls, identities and score

The retained original release ZIP's `doc/airstrike.6` confirms Right raises
the nose, Left lowers it, comma accelerates, period shoots, Space drops a bomb
and Escape opens the menu. Read-only EXE inspection confirms the actual
SDL key table: comma 44, period 46, Left 276, Right 275 and Space 32. The
production renderer receives VK 188/190/37/39/32 respectively. An isolated
consumer of the exact original SDL 1.2.7 DLL verified DOWN events, held state,
UP events and released state, including Escape/Enter/Up for the menu. This
fixture was not an original-game launch. The controls were reviewed and
recorded before the first combat input.

The exact registered EXE/config/media remained unchanged. Production
verification reported 89 files, 4,072,418 bytes and 88 companion mappings.
The original config retained `nr_players 1`, sound enabled, 800×600 windowed,
alpha 2 and all original physics values. No download or media copy was needed.

Read-only original EXE inspection establishes index 0 as keyboard-controlled
blue, Blue Baron; index 1 is red AI. `411bb9–411bee` selects controller types.
The index-0 type pointer at `4316f0` names `blueplane`; index 1 at `43168c`
names `biplane`. No identity, AI, state or score was changed.

At original preferred addresses `4121a6–4121d9`, the displayed numbers are
`6 − 1 − lives[0]` and `6 − 1 − lives[1]`. At `4130b6–4130ea`, a missing
controller target decrements that plane's life without checking an attacker.
The first number counts blue losses (red's score); the second counts red
losses (blue's score). World collisions and other deaths can therefore score.
A score increase alone cannot establish an outgoing human hit. The retained
`rules-read.json`, `original-manual.txt` and `original-rules-disassembly.txt`
document this read-only analysis; no gameplay instrumentation was used.

## Visible combat and attribution

Selected full-scene screenshots are explicitly named in `result.json`.

- `flight01`: both original aircraft, `00–00`, five bombs each. Blue is near
  the right hill and red is above-left. Manual acceleration/turn pulses follow.
- `aim01`: `01–00` before any human shot. This is a blue loss, not human
  success. Several later flames/wrecks already existed before targeted fire.
- `a09` → `s09`: a fresh personally reviewed close enemy position, a finite
  period pulse and visibly outgoing blue bullets. The enemy moves away;
  neither an impact on red nor a human scoring consequence is established.
- `a15` → `s15`: blue and red are adjacent near the right hill at `03–00`.
  The operator chooses period plus Space for 1,000 ms. The original holds
  drop two bombs, so blue's counter changes five → three, not the one bomb
  intended in the observation text. `s15` displays `04–01`, wrecks/flames and
  a new red aircraft. Both sides have lost a life. The available sparse
  scenes do not distinguish a human bomb/bullet hit from collision/cannon
  damage. This is **ambiguous**, despite the second score increasing.
- `settled15`: the match settles to “Red Baron, by 4 point(s).” No human-kill
  claim is made from the outcome, red's prior damage or explosions.

Input descriptions contain the operator's contemporaneous aiming judgments;
those judgments are not proof of a projectile intersection. No plane tracking,
automatic aiming, action loop or solver selected or delivered gameplay input.

## Bounds, input and native Quit

The sole process used unchanged registered game arguments/config/AI/audio,
real ticks, default 1,000-block batches, no guest threads, a fixed 900-second
runtime and an independently prearmed 920-second watchdog. The immutable
750-second gameplay cutoff reserved 150 seconds for Quit. The original had
PID 3833667 and start token `272989295`; its owner was bound once after
personally reviewing the submitted full scene. The ordinary console drag
and focus click exposed the original 800×600 game without changing its mode.

Twenty finite operations consumed 31 unique nonce-tagged edges. Six explicit
NOT_SENT review-expiry refusals reserved another ten distinct unused nonces;
subsequent attempts used fresh captures and fresh intents. A separate initial
review-filename collision failed before arming or sending any input. There
was no UNKNOWN, rebind, nonce replay, native relaunch or deadline extension.
All combat scene ages at consumed DOWN were below five seconds (maximum
4.941097 s). Independent release children armed before DOWN, returned actual
waits with both EOFs and acknowledged release for every admitted operation.
The maximum consumption-to-release ACK interval was 1,583.751 ms; maximum
DOWN ACK latency was 4.645 ms. These are conservative ACK intervals, not
measurements of original guest SDL polling latency.

At elapsed 353.104 seconds the operator irreversibly entered Quit. Escape
first dismissed the winner screen into the game's next round at `00–00`;
this was the Quit-route input, not another process launch or further combat.
A second freshly reviewed Escape opened the native menu after its next
present. `qview3` shows the star at Resume. One Up wrapped to the last row;
`qselect` was personally reviewed with the star beside **Quit game**. Enter
selected that exact row. No debug/menu setting or host quit was used.

The native log records `[Exit] code=0` and 387.685 harness seconds. The
supervisor observed actual native exit 0 at elapsed 388.145 seconds, both
EOFs and no drain errors. Watchdog, supervisor and both outer process waits
also returned 0 with both EOFs. The watchdog exited on the actual native wait
without firing; the heavy lock was released. All four Quit operations were
before the gameplay cutoff, and no combat followed Quit-phase entry.

No box was created, resumed, deleted or used: box ID null, state
`NOT_CREATED`, expiry null, stop receipt `NOT_APPLICABLE`. No deployment.

## Controller change and validation

`tools/airstrike-controller.py` adds the original-control policy, a required
personally reviewed submitted scene before first bind, five-second combat
scenes, a per-DOWN immutable cutoff check and irreversible reviewed Quit
routes. It admits at most 1,500 ms requested pulses.

`tools/airstrike-guard.py` derives from the released shared Forsaken transport
without editing it. Its changes are the Airstrike header, comma/period
whitelist and a 1,750 ms independent fallback for admitted pulses, leaving
250 ms below the two-second release limit. A fit check rejects a pulse that
cannot finish before that cap. The shared helper was read-only until its
owner's release; tests and pins were frozen after that release.

The first killed-parent production regression failed: renderer UP occurred
at 1,996 ms but its ACK arrived at 2,012.805 ms. This was a controller margin
failure, not a demonstrated emulator fault. The original game was still
unlaunched. The own derivative's earlier fallback passed the rerun, including
physical renderer timing and ACK timing as separate assertions. The initial
red evidence and exact recovery patch are retained.

Validation passed before the original:

- Seven policy tests; 30 HTTP transport/control tests; six terminal tests.
- Eight canonical actual-production-CLI release regressions, including killed
  parent before scheduling, real slow fsync, normal finite pulses, late ACK,
  busy-server negative control, dropped ACK UNKNOWN/no replay and punctuation.
- Three production CLI guarded-input/owner/progress suites.
- Full `flock /tmp/wine-build.lock bash tools/build.sh` under the fair heavy
  lock, after LBreakout persistence900 and Quake2 guarded1200 actual terminals.
- Exact-original-SDL event/held-state/release fixture, local registration and
  the production 89-file/88-companion manifest.

The initial SDL fixture failed on normal DLL-loading yield 5. Its harness
was corrected to service the production loader, without suppressing yields
or changing guest results; the corrected original-DLL checks passed.

Source recovery uses Git, not source/media/module copies: tested base
`048c10e8de411e8b3976f908cefae86c4d0a5d86`, `runtime.patch`,
`new-runtime.patch`, operational-input patches and source/media/helper pins.
The actual loaded module SHA-256 is
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
All 339 preflight source pins, 90 media/manifest pins and 12 operational helper
pins matched after the run. Passive load receipts record 99 source loads;
additional tracked CLI helpers match the recorded Git base, and pngjs loads
are hash-pinned with the dependency lockfile. No source tree snapshot,
archive, frame bundle, Wasm copy or game-media copy was retained.

The remaining missing proof is an unambiguous human outgoing enemy impact or
causal scoring consequence. This task stops after this single bounded attempt;
there is no additional original run or acceptance task.
