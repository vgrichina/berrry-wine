# Blobby Volley 1.0

## Decisions API experiment (2026-10-08)

`tools/blobby-decisions.js` launches an isolated browser and drives player one
using paired screenshots and OpenAI Decisions API choices (gpt-6-luna).
Run with `OPENAI_API_KEY` configured or `--key-file=PATH`; `--smoke` uses
scripted actions without calling the API. Defaults to a 30-second trial;
`--seconds=N` bounds it to at most 300 seconds, with one request in flight.
Each run saves screenshots, actions, API latency/usage and result metadata.

Reviewed smoke evidence: `scratch/runs/blobby-decisions-1791500971553/`.
Reached a solo match against ADAM; 22 scripted actions moved/jumped the red
player.

Live API trial: `scratch/runs/blobby-decisions-1791502287718/` used
gpt-6-luna for 29 successful decisions (34,533 input tokens), with median
583 ms, mean 702 ms, p95 1,495 ms and maximum 1,747 ms request latency.
Reviewed final observation `frame-0029.png`: red player trailed ADAM 0–5.
A fetch failed on the next iteration; the run is recorded as failed, with
the partial gameplay evidence retained. This proves API-to-input integration,
not strong play. The 150 ms observation delay plus inference latency makes
actions stale; a subsequent experiment should measure smaller images and
shorter action holds, or explicitly compare stepped play to live play.
Earlier `blobby-decisions-1791500930694` stepped startup then switched to live;
all subsequent frames were identical over its two-second loop. The controller
now launches live from the start and rejects identical start/end frames.
This experiment does not establish match-winning ability.

Binary: `packages/freeware/blobby-volley/volley.exe`, image base `0x00400000`.
Delphi/VCL, German UI. Registry entry `blobby_volley` in `lib/apps.js`; the
network match is DirectPlay over the virtual LAN (`src/09d4-dplay-net.wat`).

Companion files mounted with it: `graph.pak`, `sound.pak`, `text.pak`,
`Instructions.txt`, and `settings.dat` — which we ship deliberately, and which
`persistFiles: ['c:\\settings.dat']` lets the guest overwrite per browser
profile. **A person who has played once is running their own copy, not ours**
(`wine._vfsPersistence.restored` says which).

## settings.dat — full format

117 bytes, no header, no version field. Derived by disassembling both ends, not
by inference:

- reader `0x00446420` (inside the function entered at `0x00446237`)
- writer `0x004469fe`

They are field-for-field mirrors: the same globals in the same order with the
same lengths, reader calling `TStream.Read` (`[ebx+0x4]`) and writer
`TStream.Write` (`[esi+0x8]`).

The "stock" column is what the game itself wrote when we captured the file
with `--save-vfs`; where we now ship something different, both are given.

| off  | len   | global      | meaning                                   | stock value |
|------|-------|-------------|-------------------------------------------|---------------|
| 0x00 | 0x18  | `+0x978208` | 6 dwords: p1 left/right/jump, p2 same     | `A D W  ← → ↑` (we ship `← → ↑` twice) |
| 0x18 | 0x04  | `+0x978204` | **language index**                        | 1 |
| 0x1c | 0x08  | `+0x978220` | **CONTROL, one dword per player**         | `0, 1` (we ship `0, 0`) |
| 0x24 | 0x01  | `+0x978228` | **sound on/off**                          | 1 = on |
| 0x25 | 0x0d  | `+0x978234` | ShortString[12] player 1 name             | `09 "Spieler 1"` |
| 0x32 | 0x0d  | `+0x978288` | ShortString[12] player 2 name             | `09 "Spieler 2"` |
| 0x3f | 0x04 **+ N×0x3c** | `[this+0x30]+0x1774` | **result-table count, then N records** | 0 |
| 0x43 | 0x0d  | `+0x97cdcd` | ShortString[12] **network session name**  | empty → `game <0..99>` |
| 0x50 | 0x04  | `+0x97cddc` | **network screen's CONTROL** (0 kbd / 1 mouse) | 0 |
| 0x54 | 0x1f  | `+0x97cde0` | ShortString[30] **host IP address**       | empty → `0.0.0.0` |
| 0x73 | 0x01  | `+0x978287` | **player 1 colour index**                 | `00` = red |
| 0x74 | 0x01  | `+0x9782db` | **player 2 colour index**                 | `03` = green |

**`0x3f` is a count, not a dword, and it is the one field that makes the file
variable-length.** `0x43e83c` (load) and `0x43e88c` (save) are a
`TStream.Read`/`Write` pair over a fixed array of **100 records of 0x3c
bytes** at `[this+0x30]+0x04`, with the live count at `+0x1774` (which is
exactly `4 + 100*0x3c`). The loop is `for i := 1 to count` reading `0x3c`
bytes at `+ i*0x3c - 0x38`. The count is 0 in the stock file, so every offset
after it is fixed *only* for a file that has none — **anything seeking past
`0x3f` by a literal offset is wrong the moment a player has results saved.**
The record layout itself is not decoded; we never write one.

Evidence for the three renamed fields, none of it inference:

- **`0x978204` is the language.** Every use is an index into a table of text
  objects: `mov eax,[0x978204]` / `mov eax,[eax*4+0x9781fc]` / `mov esi,[eax]`
  / `call [esi+0xc]` — a virtual `GetString`, at `0x44a49a`, `0x44a500`,
  `0x44a8e5` and more. That is the main menu's `ENGLISH PLEASE` entry.
- **`0x978228` is sound.** `0x4424ce` is `cmp byte [0x978228], 1` / `jnz` over
  a `PlaySoundA(buf, 0, 7)` — winmm IAT slot 1 at `0x44f6f8`, flags
  `SND_ASYNC|SND_NODEFAULT|SND_MEMORY`. 36 call sites reach that gate.
- **The `0x97cd…` trio is the network screen**, matching Instructions.txt
  §3.2.2 field for field. `0x97cde0` is seeded at `0x44a46e` from the literal
  `07 "0.0.0.0"` at `0x44a6dc` when its length byte is zero — an IP address.
  `0x97cdcd` is seeded from `"game "` (`0x44abe4`) + `Random(100)`, a session
  name. `0x97cddc` is the network screen's own **CONTROL** choice, not a
  provider index: `0x44a8dc` uses it to pick the label text
  (`[0x97cd8c] + it + 7`), and the network match copies it into the *local*
  player's CONTROL dword (see "Network matches override CONTROL" below).

**A truncated file is legal.** The reader re-checks `Position < Size`
(`0x40ece8` = Position, `0x40eccc` = Size) before four of the groups — after
`0x24`, after the two names, after `0x3f`, and after `0x54` — and bails to
`0x4465ec` when the file ends. Fields past the cut keep their compiled-in
defaults, so a preset only has to carry the bytes it wants to change.

Per-player stride is `0x15 * 4 = 0x54` bytes (`imul eax, index, 0x15` then
`[edi+eax*4+base]`), which is why the two colour bytes are `0x978287` and
`0x9782db`, and why the name bases are `0x978234` and `0x978288`.

### CONTROL: `[player*4 + 0x978220]`, 0 = keyboard, 1 = mouse, 2 = computer

Read off the branches in the per-frame input path, not guessed:

- `0x00444392` — `cmp dword [edx+esi*4+0x978220], 0` / on equal, indexes the
  key-state table at `[ecx+edx+0x97ce35]` with the player's configured key →
  **keyboard**.
- `0x004443e3` — `cmp dword [eax+esi*4+0x978220], 1` / on equal, compares
  against `[ecx+0x97d220] shr 1`, half the screen width → **mouse**.
- `2` → **computer**, from the missing-file fallback at `0x0044667a`
  (`mov dword [eax+0x978220], 2` / `mov dword [eax+0x978224], 1`) and
  **confirmed in-game**: with `--control=keyboard,computer` the player-two
  label on the match screen changes from `Spieler 2` to **ADAM**, the AI's own
  name. That is the cheap oracle for this field — the label, not a memory read.
- `0x32` → **remote**: the network match writes it into the other machine's
  player (see below). `4` is compared against a coordinate somewhere and is
  still unidentified; it is *not* the remote marker.

### Any VK is a legal player key

`0x004421dc`, the WM_KEYDOWN handler, writes the key-state table straight from
the message with no whitelist and no range check:

```
004421fc  movzx ebx, word [ecx]                  ; the VK, whatever it is
004421ff  mov byte [edx+ebx+0x97ce35], 1
00442210  mov [eax+0x97d21e], dx                 ; and the "last key" word
```

and the per-frame input path reads it back indexed by the *configured* key
(`0x0044beee`, `mov dl, [ebx+edx+0x97ce35]`, with `[eax+0x2c/0x30/0x34]` the
player's left/right/jump). So a player key may be **any** virtual key, not
only the ones the options screen offers.

Nothing in a match claims `Enter` for itself, either: every in-match read of
the last-key word is an any-key test (`0x00448c16`, `cmp word [...], 0` / `ja`,
cleared again at `0x00448cc1`), not a comparison against a specific VK. The
one place a specific key is compared is the lobby's ESC (`0x0044b63e`,
`cmp word [esi+0x97d21e], 0x1b`).

That is what makes the touch remap below safe.

### What we ship, and why

`packages/freeware/blobby-volley/settings.dat` keeps the game's **stock** key
assignment — player one `A`/`D`/`W`, player two `← → ↑` — with the single
change that **player two is the computer, not the mouse**
(`tools/blobby-settings.js --control=keyboard,computer`, since 2026-09-21;
before that `keyboard,keyboard`). A solo launch is then a game against ADAM,
and a network match is unaffected, because both network entry points
overwrite CONTROL for the match (see "Network matches override CONTROL"
below). Player two's keys still matter: they are what the network guest
drives its blob with.

**The phone pad sends only the key set of the player this machine owns.**
It used to send both (`A`+`←`, `D`+`→`) on the theory that each machine
applies only its own player's set. That is true on the wire and wrong in a
solo match, where both blobs are keyboard players reading one keyboard: one
thumb walked both blobs. Reported 2026-09-20 as "I control 2 players".

So there are two layouts in `lib/apps.js`: `touchControls` (player one:
`A`/`D`, jump `W`) and `lanClientTouchControls` (player two: `←`/`→`, jump
`Space`). `touchControlsForSeat` in `lib/browser-shell.js` picks between them:
before any room, and at the host seat `10.0.0.1`, this machine is player one;
at any other seat it is player two. The room hands out the seat
while the game is already running, so the shell rewrites that running app's
record and calls `TouchControls.sync` again. The guest's state is not touched.

Since 2026-09-21 that room is the star room (`room: 'auto'`, see
docs/virtual-lan-party.md), and there seat `10.0.0.1` goes to whoever went
online *first*, not to whoever hosts the DirectPlay session. The usual order
(the host picks NETZWERKSPIEL first, the guest joins from the list) keeps the
two aligned. If the searcher goes online first, the touch layouts are
swapped. The keyboard is unaffected, because the shipped settings.dat gives both
players the arrows.

**On a touch device only, player two's jump moves from `↑` to `Space`**
(`touchPatches` in `lib/apps.js`, applied by `applyTouchPatches` in
`lib/browser-shell.js` after the persistence restore, so it patches the
player's own saved copy and leaves everything else in it alone).

Both layouts carry the menu keys, `↑`/`↓` on the pad and `Enter` on the
`Jump` button, so no menu key may belong to any player: if one did, pressing
it would move a blob. Stock player two jumps with `↑`, so the patch moves that
jump to `Space`. Once it has, `↑`, `↓` and `Enter` belong to nobody, and
each layout's single `Jump` button (`W`+`Enter` or `Space`+`Enter`) jumps only
its own blob while still confirming menus.

The first version of this patch moved the jump to `Enter`. That fit the older
pad, which sent both key sets anyway. It is wrong for the per-seat pad,
because `Enter` then jumps the green blob in every solo match.

Only player two moves, and only when `TouchControls.shouldInstall()` is true:
a desktop player keeps the stock arrow jump, and two people at one keyboard
keep two distinct key sets. `test/test-blobby-touch-keys.js` checks the
gating, the seat choice (including that the two layouts share no movement key
and that no menu key is a player key), and, the part that needs a real match,
that `Space` actually lifts the blob. A key can be legal without being wired
to anything.

That last claim is the one worth measuring rather than assuming, and
`test/test-blobby-vlan.js` now does, with the host holding a key belonging to
the *remote* player:

```
run A   idle drift -67.6px   →   0.0px while the host holds player two's key
run B   idle drift -115.6px  →   0.0px
```

The idle control is not optional: a released blob walks back towards its serve
position on its own, and the first version of this check held `RIGHT`,
measured −125px of that homing drift and "failed" a machine that was ignoring
the key perfectly.

The pad also carries `DOWN`, and the `Jump` button carries `Enter`, for the
menu rather than the match: a phone tap does not activate a menu item at all,
the menu is arrow+Enter driven, and its selection does **not** wrap past
`ENDE`. Without that button a phone cannot leave the main menu. A
`mouseJoystick` can do none of this — it emits no key events at all
(`lib/touch-controls.js:33`) — which is why the multi-VK form exists in
`lib/touch-controls.js` (a `dpad` direction, or a button's `vk`, may be a
list; the keys are pressed and released together).

Verified on a 375x667 touch viewport, 2026-09-20
(`tools/web-input-probe.js --app=blobby_volley --query= --viewport=375x667
--touch --lan=solo`): tapping `SPIEL STARTEN` on the canvas does nothing,
tapping the `OK` button starts the match, and holding the pad's right edge
walks the blobs right.

### Network matches override CONTROL — a stored COMPUTER is harmless

Both network entry points save the two players' CONTROL dwords, overwrite
them for the match, and put them back afterwards:

```
host   0x44b689..  mov eax,[esi+0x97cddc] / mov [esi+0x978220],eax   ; P1 = network CONTROL
                   mov dword [esi+0x978224],0x32                      ; P2 = remote
                   call 0x44ba9c / call 0x4453d4 (host match) / restore
guest  0x44b87b..  mov eax,[ebx+0x97cddc] / mov [ebx+0x978224],eax   ; P2 = network CONTROL
                   mov dword [ebx+0x978220],0x32                      ; P1 = remote
                   call 0x44ba9c / call 0x44bad4 (guest match) / restore
```

`--count` hit `0x44b6b0`/`0x44b718` once on the host and `0x44b93a` once on the
guest. **These globals are `this`-relative, not absolute**: `esi`/`ebx` is the
game object (`0x7e170004` in our runs), so P1's CONTROL lives at runtime
`0x7eae8224`, which is also the `buf=` `--trace-fs` shows for the 8-byte
settings.dat read. `--dump=0x978220` reads zeros and proves nothing.

Measured 2026-09-21 with `settings.dat` from `--control=keyboard,computer`,
`--dump=0x7eae8224:8` at exit of the gate: solo reads `00 00 00 00 02 00 00 00`
(P2 = computer); in the match the host reads `00000000 00000032` and the guest
`00000032 00000000` — the stored COMPUTER is gone on both machines. The green
blob went `478.7 -> 628.5 -> 351.1` on the host and `-> 628.6 -> 437.5` on the
guest: right under one key and back under the other, a key-driven blob, not
the AI. (The final positions disagreed, the same way the stock settings fail
that check at load 30-50; that is a separate flake.)

The earlier "do not preset COMPUTER" verdict here was wrong. Its evidence,
`478.7 -> 527.1 -> 591.1`, is byte-identical to the void pre-`--real-ticks`
batch-clock sample, where no key reached the guest at all, so it measured the
clock, not the AI.

### Colour: `0x0044a2c0(this, edx=player, cl=index)`

Not a control setter, despite taking a player index — its 8-arm jump table at
`0x0044a2ee` assigns an RGB value and then recolours the sprite frames:

| index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| RGB | `ff0000` | `ff7f00` | `ffff00` | `00ff00` | `00ecff` | `0000ff` | `ff00c0` | `ff00d8` |

Shipped `00`/`03` = the red and green blobs on screen. Values above 7 fall
through to the default arm.

## Controls in a network match

`Instructions.txt` §3.2.1/§3.2.2: each side's network settings screen has its
own CONTROL point, and "the host always gets the keys and colour you specified
for player one" / "the client always gets the keys … for player two".

**The client is driven by player two's configured KEYS, not by the mouse** —
`test/test-blobby-vlan.js` measures exactly this, and 2026-09-20 it was shown
to hold *across a remap*, which is the part that makes it a fact about the
file rather than about the arrows. Green went 478.7 → 584.3 → 533.2 under
`D`/`A` with a temporary A/D/W file, and 478.7 → 527.1 → 488.3 under
`RIGHT`/`LEFT` with the shipped arrow file, both screens agreeing each time.

So the keys travel with the settings file, and the mouse never reaches a
network client at all.

### Two processes, two clocks — why the gate flaked, and it is not the game

`test-blobby-vlan`'s "and saw it come back" went red in roughly three runs of
five: the guest held player two's LEFT key and its blob moved *right*. None of
the obvious causes survived contact with the logs (2026-09-20):

- **Not a dropped key.** `run.js` logs every input it applies, and all four
  landed: `keydown 39 @1799`, `keyup 39 @2083`, `keydown 37 @2159`,
  `keyup 37 @2466`, each with a matching `[ctl]` ack. The LEFT key was held
  for 156 batches across the capture.
- **Not the wire.** The ledgers match end to end — guest sent 2151 DATA frames
  and the host received 2138; host sent 152 and the guest received 152 — at a
  steady ~90 frames per 100 log lines, with no backlog.
- **Not a point being scored.** The scoreboard rows are byte-identical between
  the `before` and `right` captures (`png-diff --region=0,0,640,60`), and the
  only change by `left` is a 4x4 box at the top of the picture: the ball.

What the pictures actually show is that the blob was never being steered at
all. Measured with `tools/png-color-box.js` over the capture series:

```
before        2733 px   centroid 478.7   box 454..503 x 329..399 (50x71)
right         2391 px   centroid 527.1   box 500..555 x 340..399 (56x60)
left          2391 px   centroid 591.1   box 564..619 x 340..399 (56x60)
host-idle     2736 px   centroid 475.5   box 451..500 x 329..399 (50x71)
```

478.7 → 527.1 over 281 batches is 0.172 px/batch; 527.1 → 591.1 over the next
375 is 0.171. **One constant rate across the whole experiment**, indifferent to
which key was held — about 7 px/s, a seventh of a walk — with the sprite frozen
in one frame (`56x60`, the *same* 2391 matching pixels in two captures 375
batches apart, against `50x71` at rest), and then a snap back to the serve spot.
A frozen frame sliding at a fixed rate is dead reckoning, not a simulated blob,
so the key had nothing to steer and the sample is void rather than wrong.

Why it is being dead-reckoned is already written down in our own tree, at
`test/run.js:3411`: *two emulator processes in one room cannot share a
batch-driven clock*, because a batch is not a unit of time and each process
runs them at its own rate. In that run the host retired **34628** batches to
the guest's **3194** — at 200 ms/batch, ~6900 s of guest time against ~640 s,
a 10x divergence — and anything either side decides by elapsed time is decided
against a clock the other does not share. The gate never passed `--real-ticks`.

**The same disease bit the lobby, one layer up.** The guest's "take the first
session" keys were scheduled at batch 1000/1040, but the session list is filled
by a frame that arrives in *wall-clock* time. On a box at load 41 the guest ran
176 batches/s, so batch 1040 landed about six seconds in, before the host had
answered; the guest pressed ENTER on an empty list, never sent `JOIN_REQ`, and
five lobby checks went red with a completely healthy host. Those keys are now
sent from the arrival of the reply (`.. arrived dpl ENUM_REPLY` in the *guest's*
log — the host's own "I answered" line says nothing about the far side) over the
control channel. Cause, then effect.

The gate now also refuses to measure a void sample: two captures one hold apart
with no key down, and the blob must be standing still before a hold counts,
retried up to three times, with the sprite box printed so a frozen frame is
visible rather than inferred.

That check earned its place on the first run with it. The blob *was* standing
still (`0.0px`, rest sprite `50x71`), so the sample was sound — and it exposed
a second variant of the same latency, one where the two screens do **not**
agree:

```
host   478.7 -> 527.1 -> 546.3
guest  478.7 -> 478.7 -> 546.3
```

The guest held its own player's RIGHT key, the host saw that player move to
527.1, and the guest's own screen still showed it at the serve spot. So the
machine the key was pressed on is the one running *behind*: its view of its own
player lags the host's by more than a whole hold. That is the 14x send
asymmetry (host 152 frames against the guest's 2151) landing where it hurts,
and it is the same clock divergence seen from the other end. Do not read
"both screens agreed" from the earlier run as a general property — in that run
they did, in this one they did not, and neither tells you the blob was steered.

### `--real-ticks` is the fix, and it is now part of the gate

The documented remedy for two processes in one room turns out to fix every
symptom above at once. Measured 2026-09-20, same box, back to back:

| | batch clock | `--real-ticks` both sides |
|---|---|---|
| RIGHT hold | +48.4 px | **+150.1 px** |
| LEFT hold | +19.2 px (the wrong way) | **-278.1 px** |
| host vs guest | disagreed mid-hold (527.1 / 478.7) | identical at every point |
| idle "homing drift" | -67.6, -115.6 px | **0.1 px** |
| host DATA frames sent | 152 | **1890** |
| send asymmetry | 14x | **1.2x** |
| gate | 2 checks red | **all checks passed** |

The ledger is the mechanism: the host was sending state 152 times while the
guest sent 2151, so the guest's screen was updated at a fourteenth of the rate
it was reporting at, and everything it drew of its own player between those
updates was extrapolation. On the shared wall clock that collapses to 1.2x and
the blob travels three times as far under the same hold, because it is now
being *steered* for the whole hold instead of coasting.

Two things worth keeping from that table. The feared cost did not appear —
a hold moves the blob **further**, not less, so `MOVED_PX` was never in danger.
And the **"homing drift" was itself a clock artifact**: it is 0.1 px now. The
idle control in the stray-key check was built to subtract a phantom. It stays,
because it costs one capture and documents the trap, but it is no longer
load-bearing.

The batch *rates* still differ by 11x (host 36558 batches, guest 3216) and that
no longer matters, which is the whole point: time stopped coming from batches.
`--real-ticks` is now passed unconditionally by `test-blobby-vlan.js` rather
than being an env-var opt-in — a test that runs two emulators in one room has
no business on the batch clock.

Every number here was taken at load 24-91 on a 34-user box. Pixel positions and
frame counts are load-immune; batch rates are not, and are quoted only to show
they stopped mattering.

### The live browser pair: closed, it was the settings file

This used to read "in a live browser pair the client responded to **neither**
arrows nor mouse, while the host's A/D/W drove red -- unresolved". Re-measured
2026-09-20 against the shipped file, `node test/test-web-blobby-rtc.js` is
**20/20**, including the two checks that are exactly the old complaint:

```
PASS  the HOST can move its own player (the half that was stuck)
PASS  the GUEST can move its own player
PASS  both screens agree where player one is / where player two is
```

The cause was the one this file already listed as a candidate: that pair ran
against a `settings.dat` whose player two was on the **mouse** with the old key
set, and the mouse never reaches a network client. The shipped file has neither
property now. No browser-path input bug was ever involved, which is worth
stating plainly because "the browser eats the client's keys" was the working
theory for a while and it was wrong.

Two things measured on the way that are worth keeping:

- **The browser never had the CLI's clock problem.** `host.js` hands the guest
  a wall-clock `get_ticks`, so two tabs share time by construction, and the
  single-tab match's ledger is symmetric (298/301 against 301/298) where the
  CLI's was 152 against 2151. The fix in the section above is a *headless*
  harness fix; nothing about it applies to the browser.
- **Lobby discovery is intermittent.** One run in two, neither page saw the
  other (`.vln-peer` never appeared inside 60s) and the test then threw
  `TypeError: Cannot read properties of null (reading 'click')`, which buries
  the diagnosis in a stack trace. That is now instrumented rather than fixed:
  on the timeout both pages are photographed as `*-no-peers.png` and the run
  prints whether `.vln-lobby` is open, which separates "the fixed key script
  landed on the wrong menu entry" from "the lobby opened empty" -- opposite
  bugs that the old failure could not tell apart. The lobby, RTC, wire and
  dev-server files were clean in git at the time, so it is not someone's
  half-finished edit.

#### Lobby discovery: what the mechanism read says, and what is still open

Read end to end 2026-09-20 without reproducing it. **Three hypotheses died on
the source, and they are the obvious three:**

- *The two pages compute different presence keys.* They cannot. Both derive it
  from the executable name alone -- `lib/browser-shell.js` passes
  `{exe: app.lan.exe}` and nothing else, and `scopeFor()` takes no room or
  secret here -- so the key is a constant per app.
- *The two pages are the same user, so `peers()` filters each other out.*
  `peers()` does drop `userId === this.userId`, and `tools/dev-server.js`
  hands out identity by cookie, but the test opens each page in its own
  browser context, which is its own jar. The one way to mint two ids in one
  jar is two `/api/*` requests racing before either response lands, and
  `joinNetwork` awaits `whoami()` before anything else. The injected agent-hub
  client cannot do it either: `/api/agent/*` is routed *above* `handleApi`, so
  it never calls `identify()`.
- *One poll threw and the lobby stopped looking.* `tick()` catches, renders
  `lobby error: ...` and re-arms unconditionally; a transient miss self-heals
  within `POLL_MS`, which is why a **persistent** 60s failure is the thing to
  explain and a flaky one is not.

**The navigation hypothesis is also weak, measured.** The keys were sent on a
flat 20s timer after a boot check (`runningApps.length > 0`) that only means
the app object exists -- but the menu is in fact up within a poll interval of
it, so the 20s was ample. Ruling that out needed a signal for "the menu is
drawn", and `lit` is not it: Blobby's menu is a night beach whose commonest
colour is `#14130a`, dimmer than the threshold, while the court is 92% lit.
*Variety* separates them -- before the menu the window is one flat colour
(`#008080`, 100% of a CLI capture at batch 30), the menu carries ~3000 -- and
that is what `menuDrawn()` in the test samples for.

Three runs green after that, at load 10.2, 17.8 and 47.5, so the flake is
still unreproduced. What the test now does instead of guessing:

| gate | separates |
|---|---|
| `menuDrawn()` before any key | a key that arrived before there was a menu |
| `.vln-lobby` open on both sides | navigation failed vs discovery failed |
| on failure, each page's own `whoami()` + `publishers(key)` | same user vs nobody published vs published-then-filtered |

That last one is the decisive read and the reason it has to come from inside
the page: the dev server prints exactly this on every `/api/*` call, and this
test constructs it with `quiet: true`, so the server-side copy is not there
when it is wanted.

The measurement that settles it: reach the client's settings screen, read
`[0x978220+4]` out of guest memory to see what CONTROL actually holds there,
then hold player two's keys and watch the blob. Note that the browser pair was
run *before* the remap, against a file whose player two was on the arrows and
on the **mouse** — which is one candidate explanation on its own, and the
shipped file no longer has either property. Check
`wine._vfsPersistence.restored` before reading anything into a repeat: a
player's own persisted `c:\settings.dat` still carries the old values.

## The host's picture froze mid-match: a cross-thread send at the wrong point

Symptom (2026-09-22, live browser pair): a match played, then the **host's**
screen stopped changing for good and ignored every key, while the guest ran on.
It was not controls and not a hang. The game thread draws each frame by calling
`0x442a5c` → VCL `Synchronize` (`0x411f50`), i.e.
`SendMessage(ThreadWindow [0x44e648], 0x8FFF, 0, self)` to the main thread. The
callback `0x4428a8` BitBlts dirty rects from the bitmap canvas onto the form
canvas (form `[[0x44df48]]`, canvas `[F+0x220]`, hwnd `0x10002`).

Our cooperative scheduler delivered that send wherever main's last slice had
stopped. One landed inside `TControlCanvas.FreeHandle` (`0x41e9c4`) after its
`ReleaseDC` (`0x4068a0`) and before `mov [ebx+0x5c],0`. The paint's
`CreateHandle` (`0x41e918`) then adopted the still-cached, just-released
FDeviceContext. From then on every BitBlt went to a dead HDC and returned 0,
and the surface flush count stayed at 4824 forever.

Win32 delivers a cross-thread send only while the receiver is inside
GetMessage/PeekMessage/WaitMessage/MsgWait* or its own SendMessage. That is
now enforced: the scheduler sets `incoming_send_pending` on a receiver that is
not at a message call, and those calls then stop on their own thunk with
yield 17 so the send is delivered there (`test/test-cross-thread-send-timing.js`).

## The frame-limiter spin on the game thread

The game runs on spawned thread T1 (start `0x403a00`); main sits in
MsgWait at `0x4069c0`. In a match T1's frame limiter is a pure clock spin at
**`0x445242`**:

```
0x445242  call GetTickCount          ; thunk 0x406228, IAT 0x44f608
          mov edx,[ebp+8] / mov edx,[edx-0x24]
          mov ecx,[ebp+8] / mov ecx,[ecx-4]
          add edx,[ecx+0x978230]
          cmp eax,edx
          jb  0x445242                ; return landing 0x445247
```

No other API and no stores in the loop, so `$clock_spin_step` qualifies it
(same caller, same ESP, same value, <=64 blocks between reads) and parks with
yield 14. The menu loop (`0x4476fc..0x447864`) and the other limiter at
`0x44c287` Sleep instead and never trip it.

The park used to do nothing for a *cooperative thread*: the scheduler cleared
yield 14 one turn later and re-ran T1, which re-read the same millisecond, hit
the one-park-per-millisecond latch and spun out its slice; and a pending yield
14 made `parkedThreadDelay` report "not idle", so the host never slept.
`--count=0x445247` saw 25,063 hits over a 700-batch match. Now `runSlice`
sleeps the thread to the park's own deadline (`get_spin_deadline_ms`, clamped
to 1..50ms) via `sleepUntil`; `--no-clock-park-sleep` is the old arm
(`test/test-thread-clock-park-sleep.js`).

Measured on box 3, 700-batch match route (boot, SPIEL STARTEN, play), user CPU:
**4.5s / 4.46s new vs 117.9s / 120.3s old**, identical guest API counts. The
match frame varies run to run in *both* arms (menu frames are identical); that
jitter predates this change and survives `--wall-clock-ms`.

## Ruled out

- **Stale persisted settings** as the cause of the dead client. Both live pages
  reported `restored: 0` and their `c:\settings.dat` bytes were the shipped
  ones.
- **Agent input exclusivity** (`lib/agent-remote.js` `setInputBlocked`). Both
  pages reported `{"exclusive": false}` while the client was unresponsive.
- **"The match is hung."** Both guests were `running: true` at `eip 0x4069c0`
  with `yield 7` (message_wait) and climbing frame counters. A ball hanging in
  mid-air is Blobby's waiting-for-serve state; the server jumps into it.
- **The 8-arm table at `0x44a2c0` as a control selector** — withdrawn, it is
  colour (above).
- **Presetting a host IP.** §3.2.2 says an empty address makes the client search
  its own subnet, and our DirectPlay answers that broadcast on the segment, so
  the empty field is already correct.

## Reproduction

```bash
# two processes, one room, a real match (the gate)
node test/test-blobby-vlan.js

# the browser pair
node test/test-web-blobby-rtc.js

# what a live page has mounted
node tools/ctl.js --hub=<hub> --token=<tok> -s <id> eval \
  '(function(){var w=window.__wineInstances[0];var o={};for(const[k,v]of w._helpCtx.vfs.files)if(/settings/i.test(k))o[k]=Array.from(v.data.slice(0,32));return JSON.stringify({f:o,restored:w._vfsPersistence&&w._vfsPersistence.restored});})()'
```

Capture a settings.dat the game itself wrote with `--save-vfs`; that is how the
shipped copy was made.

## Tool commands behind the numbers above

```bash
node tools/find_string.js packages/freeware/blobby-volley/volley.exe "settings.dat"
node tools/find-refs.js   packages/freeware/blobby-volley/volley.exe 0x00446990
node tools/find_fn.js     packages/freeware/blobby-volley/volley.exe 0x00446444,0x00446a2d
node tools/disasm_fn.js   packages/freeware/blobby-volley/volley.exe 0x00446420 130
node tools/disasm_fn.js   packages/freeware/blobby-volley/volley.exe 0x004469fe 150
node tools/disasm_fn.js   packages/freeware/blobby-volley/volley.exe 0x0044a2c0 60
node tools/dump_va.js     packages/freeware/blobby-volley/volley.exe 0x0044a2ee 32
```
