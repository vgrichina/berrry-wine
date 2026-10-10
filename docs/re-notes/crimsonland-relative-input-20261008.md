# Crimsonland: ordinary relative pointer reaches controlled Tutorial gameplay

Run `scratch/runs/20261008T0105Z-crimsonland-relative-input` qualifies Tutorial
entry, keyboard movement and relative aiming in the original executable using
reference source f62ab3c9f and module
`4dc5ac2c477c71c64a42530562e4cf51e145bd966232e15330acfc01753d54de`.
Original EXE remains 93cdcdc8. The prior normal WinMain exit diagnosis stands;
this run used no Enter and made no production repair.

## Actual input route

The corrected `?app=crimsonland&debug&d3d9-renderer=webgl` route and reviewed
original launcher Play322,295/750ms reached the real main menu. Host and owning
render Worker independently reported neutral/WebGL. The actual HTTP module
response has the expected full SHA and complete stream receipt.

An initial actual desktop relative move landed on the log DIV: Pointer Lock was
false and CDP's pointer position differed from the desktop pointer. The passive
DOM listener recorded trusted client856,477, not a game-targeted move. Desktop
geometry showed screen870,670 for that point: viewport screen origin14,193.
Ordinary desktop mousemove232,643 correctly landed at page218,450 on the canvas,
but the DirectInput game cursor remained296,338 while unlocked. Neither move
was treated as a qualified menu target or followed by a Play click.

An ordinary desktop move310,531 and 750ms button hold clicked reviewed neutral
ground at page296,338, outside all menu targets, acquiring Pointer Lock. This
outside-driver input is retained in `neutral-capture-click.json`; desktop
placement/geometry receipts are retained separately from `commands.jsonl`.
No focus, cursor state, guest command, CPU state or return was forced.

Locked `xdotool mousemove_relative -- -90 130` produced a trusted CANVAS DOM
event with movementX=-90/movementY=130. The game-drawn cursor moved from296,338
onto PLAY GAME near218,450, visibly highlighting it. Only after reviewing
`locked-play-hover.png` did a 750ms desktop down/up open the Play submenu.
Locked relative -10,-18 then placed the cursor on highlighted Tutorial near
209,432, with “Learn how to play Crimsonland.” visible. The reviewed 750ms
desktop click opened actual terrain, player and aiming reticle.

## Player control evidence

`tutorial-before-movement.png` shows the player near351,459 and the instruction
to move using arrow keys. Ordinary browser ArrowRight held1500ms moved the
player right (near387,459 after release), shifted terrain and advanced the
lesson to picking up bonuses. Both held/released images and keydown/up receipts
are retained. ArrowUp2500ms then moved the player upward and scrolled terrain:
the 1000PTS bonus moved from roughly332,374 to332,547, while the player reached
roughly396,425. This is movement relative to terrain, not an animation-only
inference. The held shot is retained too.

Locked relative150,60 produced another trusted CANVAS event with exactly those
deltas and moved the aiming reticle from284,325 to412,376; the player orientation
changed toward it. `tutorial-aim-controlled.png` is the reviewed final scene.
The bounded DOM observer collected12 rows without reaching its128-row cap.
Some button-up events are absent from this document listener; the existing
host input trace records ordinary DOWN/UP pairs and menu transitions provide
the positive behavior evidence. No absence claim is made from DOM coverage.

Tutorial entry and player movement/aiming pass. Tutorial completion, combat,
shooting, long-session correctness, FPS, physical GPU and audio are unknown.
No owning DirectInput memory probe was needed to establish this positive route.
The preserved passive owning-exit observer emitted no rows in this run; that
is not used as an exception-absence claim.

## Harness, validation and cleanup

`relative-input.js` provides bounded shell-free xdotool argv, a fresh reviewed
scene gate, explicit target review for menu clicks, a25s deadline reserve and
passive trusted DOM motion collection. Browser desktop clicks use750ms and the
existing release-on-error helper. Tests cover invalid deltas, stale/missing
review, deadline reserve, target review, exact desktop argv, actual desktop
errors, passive listeners, bounded capture and listener removal. Node syntax
checks pass. Remote preflight authenticates530 pins/530HEAD/8GET/range/optional
404/drained streams. No local build, native test or local browser ran.

One remote browser ran01:03:30–01:07:08, before its01:08:30 guard. Ordinary quit
closed browser/server, Chrome exit0 and streams0. Independent01:07:21 checks
found driver31528/Chrome31546 absent, no Chrome, baseline sockets, all530 pins
unchanged and49.99GB free. All52 capture files were copied and SHA checked before
the owned prefix was removed01:07:54 and the slot released. Box bx_43wuxzx3 and
retained Antara Puppeteer are handed to root/queued Tiberian, expiry01:28:12.
Four existing optional asset request errors are retained without causal claims.

## Survival, frame counter and page frame rate (2026-10-10)

**CLI route (software D3D).** Use `--batch-size=200000 --tick-ms-per-batch=20`.
At the old 20000-block / 200 ms batches the game presents only about once every
100 batches, and the scripted route drifts.

| batch | input | result |
|---|---|---|
| 4000 | mousedown/up 311,134 | launcher Play |
| 6620 | `relmousemove:-55:110:10`, `di-mousedown`/`up` | main menu -> Play Game |
| 6770 | `relmousemove:-30:57:8`, `di-mousedown`/`up` | Survival -> gameplay by 7320 |

After that: hold `di-keydown:87` plus `keydown:87` to move;
`relmousemove:200:0:8` then a held `di-mousedown` aims and fires (tracer).

**Frame counter.** A frame is one `IDirect3DDevice8_Present` from `0x5e2da9`
(about 49 Begin/EndScene pairs inside it). On the headless CLI, the host-flush
series and `--present-distinct` see only every second `Present`, so count the
traced `Present` there.

**Two CLI traps:**
- Gameplay is **not run-to-run deterministic** under the software render
  worker. Pre-gameplay captures match exactly, but the first gameplay frame
  differs by 63 pixels and the post-move scroll by 98%.
- Gameplay batches cost ~3.5 s of wall clock each (render park), so a CLI
  frame window is only a few guest-seconds.

**Page (headful Chrome 151, WebGL, boat).** To take pointer lock, click
neutral ground, then move relatively. The game cursor moves about 1.36x the
probe's guest-pixel delta. Measured from PLAY GAME, the panel is Tutorial
+0 / Survival +68 in probe units; +96 overshoots onto empty panel. Survival
then plays: W scrolls, aim and held fire shoot, and the player dies at 0:30
game time, which matches real time.

**Rate:** 635 presents over 24.1 s = **26.3/s**, with the HUD at 28-30/s
during play. Audio context running at 44.1 kHz, non-silent.

Evidence: `scratch/runs/20261010T0515Z-crimsonland-cli-frames` (run-a/b, page/).
