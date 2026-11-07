# Rune ordinary weapon pickup and swing — 2026-11-07

**The original demo now has reviewed native axe pickup and an armed attack
pose. Hit, damage and enemy consequence remain unproved.** This bounded run
did not encounter a visible enemy or establish a damageable target. Its final
rock-contact attempt shows an attack pose without a visible impact or damage
effect. No emulator mismatch was demonstrated and no runtime repair was made.
Evidence: `scratch/runs/20261107-rune-weapon-consequence/`.

## Runtime and controls

This explicitly adopts published main
`45e0e2c7b8cabfe36a4569badef31197d1aebe11`, retaining the already published
mounted-child CRT repair `0d7761601` and its cave movement/jump evidence. The
current recovered live module is **2,182,500 bytes**, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
`adopted-runtime.json` records the eight changed runtime pins since the previous
Rune run: both modules, renderer input, audio and four graphics libraries.
The complete original registered media closure remains **143 paths**, including
the **142 installed files** and **six shipped INIs**. The EXE remains 233,472
bytes, SHA-256
`dd1588a902952414917b8cfc65996d46ec0323dc7d298c5a23d5b2ccf70f7add`.
All media passed actual local HTTP size/hash checks before allocation; all
**603 staged pins** passed remote verification before Chrome and after exit.
All **539 successful served bodies** match their staged pins. There was no
request for the global MSVCRT DLL.

The shipped `Help/ReleaseNotes.htm` and `System/User.ini` were read before
action. They document W/A/S/D movement, Ctrl use, and Enter/left mouse attack.
`instruction-refs.json` records their existing paths and hashes. No game
configuration, private handler, clock, guest cursor or game state was changed.

The previous passing release, identity, transport, observer, deferred-closure
and deadline controls were reused by hash. Only the changed harness composition
was locally exercised against the current production guest/render Workers:
the added Ctrl key mapping and passive coordinate/target recording. Native
Ctrl DOWN/UP and a canvas-centre mouse pair passed with independently armed UP;
the local processes, ports, profile and writer drained cleanly. Original input
used the same CDP page session for movement and clicks, with explicit coordinates
on each click; there is no second Puppeteer Mouse object. All six original mouse
pairs were trusted, targeted the canvas, and landed within its actual bounds.

## Reviewed gameplay

The original Software Rendering wizard completed through ordinary Next, Next,
Run; passive loading reached the title arena, then Escape opened the menu.
Relative mouse hover visibly highlighted New Game and Easy before selection.
Known pointer misses and menu repositioning are retained with exact ACKs.

* `review/cave-loading.png`: standing unarmed Ragnar in the original cave.
* `review/approach-item.png` and `item-use.png`: W **1,000 ms** approached the
  item slab; Ctrl **150 ms** produced no distinct pickup consequence.
* `review/approach-blade.png`: another W **650 ms** visibly acquires an axe:
  it appears in the right hand, a weapon icon appears at bottom right, and the
  original tutorial explains axes' impact and effectiveness against hide/armor.
  This is ordinary proximity pickup, without an inventory/state shortcut.
* `review/axe-swing.png`: Enter **550 ms** produces an extended right arm and
  weapon attack pose. No target is present and this is not hit evidence.
* Subsequent reviewed turning, backing and strafing explored the cave edge.
  Two ordinary Escape-menu mouse repositions allowed further leftward turns
  within the bounded canvas input route. Nearby rocks sometimes occluded the
  avatar/camera. No enemy or damageable target was established.
* `review/approach-rock-target.png` and `rock-attack.png`: W **900 ms**, then
  Enter **400 ms**, tests the visible rock face. The attack pose changes, but no
  spark, blood, target reaction, damage or environmental consequence is visible.

All **36 command outcomes**, including quit, have exact ACKs: **zero UNKNOWN**
and no replay. There are **61 trusted native events**, **21 balanced independently
armed input pulses**, and no held input at exit. All **36 captures** were
personally reviewed. `input-and-runtime-audit.json` and `visual-review.json`
retain the checks and limits.

Actual game rendering is **software / CanvasRenderingContext2D**, with no active
GL contexts or game render endpoint. This does not extend GL/D3D coverage.
Audio, FPS, rendering/physics parity and enemy combat remain unqualified.

## Evidence and custody

One fresh UUID-idempotent box, **bx_w2pb77fu**, was created at
**22:34:13 UTC**, initial expiry **23:09:13.751 UTC**. The detached normal-stop
handler and **25-minute watchdog** were armed before allocation and observable
through heartbeat logs; the immutable browser/watchdog deadline was
**22:59:13.884 UTC**. There was one original invocation.

Quit ACK and Chrome exit **0** at **22:49:07.031 UTC** precede verified absence
of both owned runtime PIDs, closed HTTP/debug ports, removed profile/writer and
balanced input. The first immediate read-only custody guard caught the known
post-quit process-drain interval and exited with an exact assertion failure;
the subsequent post-drain inventory passes. This was not an unknown input or
a gameplay retry. Both outcomes are preserved.

All **401 artifact references / 329 distinct contents / 16,395,955 unique bytes**
were retrieved and SHA/size-verified before lifecycle handoff. They include the
unique live module, captures, console, command/ACK/release records and HTTP proofs.
Git SHA plus relevant tracked/untracked binary patches and an owned helper patch
provide source recovery; original media are referenced by path/hash. No source
or media archives were created.

The initial lifecycle handoff retained the box running under the task's
coordinator-owned shutdown rule and retired the original delegates after runtime
closure/retrieval. At **22:50:12 UTC**, the coordinator explicitly delegated
normal shutdown on the messageboard. A new detached supervisor/fallback was
armed. The coordinator then completed normal stop first, at **22:51:38.550 UTC**,
**forced=false**, stop **stop_1996a195dfa6acf4**. The worker's subsequent stop
request received **HTTP 400**; a read-only GET proved the box already archived,
with that completed stop and no error. The refused request was not retried.
Coordinator receipts are `coordinator-stop-result.json` and
`coordinator-stop-info.json`; `final-box-handoff.json` records **ARCHIVED**, expiry
**null**, retention unknown, coordinator custody. No resume/delete occurred.
All owned lifecycle processes and the messageboard watcher are closed; the
fallback retired after confirmed archived state. Earlier running-handoff records
are retained as superseded history.

Rune has no candidate-corpus entry, so this is investigation evidence, not a
result attached to another candidate. The next gameplay task needs a reviewed
ordinary route from the pickup chamber to a visible enemy or damageable object,
then an armed attack with a visible hit consequence. Another CRT repair or broad
movement/jump qualification is unnecessary. No public deployment was performed.
The global evidence checker retains seven unrelated pre-existing containment
errors; it reports none for this run. Focused media/input/ACK/runtime/custody
checks pass. This documentation-only change requires no code rebuild.
