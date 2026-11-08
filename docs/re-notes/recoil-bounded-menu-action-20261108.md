# Recoil bounded menu action, 2026-11-08

Run: `scratch/runs/20261108-recoil-bounded-menu-action/`.

**Objective incomplete; new native Resume transition boundary established.**
The sole fresh default `user` / Medium / Software original stopped alive at
health **76**. No power control was identified, no objective counter/text
increment, force-field removal or onward access was demonstrated. The prior
0/4 remains historical; this run did not obtain a fresh statistics reading.
There was no gameplay fire, death, restart or demonstrated emulator divergence.

The run implements and tests one admitted Resume → ordinary action → independent
UP → Escape operation, replacing the separate admissions responsible for the
[predecessor's](recoil-menu-assisted-objective-20261108.md) 14.873-second exposed
gap. It also establishes why host input composition alone is insufficient:
the first sampled living HUD appears **1.261–1.324 seconds after Resume starts**
in the three longer transactions with sampled HUDs. Early C and action DOWNs
precede that observed transition. A locally tested repair now waits for a
fresh, identity-checked living HUD before sending gameplay keys. That repair
was never hotpatched into the original and has **no original-game acceptance**.

## Tested original and control scope

The source closure is published
`d7c1f187fe4eaaa0fde0879a9684a7c75599526a`, including protocol `663f1c139`.
Published Git bytes were staged individually; the WAT closure compiled in an
in-memory VFS. Actual recovered Calc and original Worker module SHA-256 is
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
All **728 runtime pins** match their Git/artifact providers. Peer WIP was
excluded. The existing untracked `lib/wininit-boot.js` has an explicit patch;
Git SHA plus patches provide source recovery, without a source/media archive.
No tracked production code was changed and no emulator fix/build-pass claim
is made. Later peer changes to `lib/render-worker.js` are outside this closure.

The real registration has **106 manifest entries + executable = 107 originals**,
plus the manifest: **108 pins / 76,019,820 bytes**. Size/SHA and staged pins all
match. Empty, missing and duplicate registrations, a wrong staged EXE hash and
the predecessor's invalid zero-file report are rejected. All **113** local
HTTP fixture/dependency checks pass. Executable SHA remains
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.

Before allocation, real Chromium tests qualify the compound transaction,
trusted mouse/key events, independent releases despite a **1.1-second slow
sampler**, and partial-delivery failure without replay. A delayed Resume ACK
also cannot cause a late action DOWN after Escape. A visibly moving generated
target changes position while menu-held fire requests produce **zero input**.
The driver refuses fire from menu backdrops; this is a deliberate unsupported
targeting path, not accepted defense. The same native composition runs through
the actual published Calculator Worker and native Edit → Copy menu. This
qualifies the production menu/input path, not Recoil's transition semantics.
The unchanged owner/module/image/freshness, independent-release and sticky
UNKNOWN controls retain their exact helper hashes and predecessor evidence;
they were not exhaustively rerun. All **24 original commands** have contiguous,
exact successful ACKs, with no original UNKNOWN or replay.

The original uses the registered `?debug&threads&app=recoil_demo` route, natural
opening, Software Canvas2D, process 1000 / endpoint 1 / slot 0, document epoch
`fb0da83a-1548-4859-b2e6-306f0a67d095`. There is no owning D3D render-worker
endpoint; toolbar WebGL is not backend evidence. Fresh screenshots guide each
menu selection and route action. The loading display captured here shows
1.3 Destroy Rocket Sites; it is not a fresh capture of the 1.1 power-control
brief documented by the preceding route attempt.

## What happened and what the bounds mean

`original/opening-end.png` shows a living tank, health **95**, HUD **00:00:22**,
the wreck ahead, beach enemies and a road above the cliff. Native Escape opens
the menu. Absolute pointer movement does not place the game's software cursor;
relative positioning and current pixels are required. The first compound
attempt misses Resume: its seven sampled frames remain menu. Its command name
does not imply movement. A small correction produces visibly illuminated Resume
in `resume-correct.png`; subsequent transactions keep that reviewed placement.

The next **1.1-second** transaction still samples only menu pixels. It does not
establish a living steering response or total absence of simulation during the
transition. A **2.4-second** transaction captures living forward progression:
`held-1794124979046.png` and `held-1794124980091.png` show the wreck approaching
the left side, HUD **00:00:50 → 51**, health **77**, and incoming cyan fire.
It returns visibly to the native menu. The turret remains raised following
Resume's mouse aim carry; the early 60-ms C pulse does not establish centering.

An Up+Left approach and later stationary Left scan attempt to expose the earlier
cliff-side ramp. Their sampled first HUDs occur at **+1,281 ms** and **+1,261 ms**;
the maximum forward window's first HUD is **+1,324 ms**. These are sampled upper
bounds on first visible HUD, not exact simulation-resumption instants. The
left scan's final live frames show **health 76, timer 00:00:54 → 55** and the
cliff/concrete wall, with the turret still raised. No useful left-turn angle,
ramp entry or power control is established. A separate compound holding C
through the transition also lacks a confirmed centering consequence in the
next active view. The monitor saves arrow-held canvas images, so the C-only
transaction has no saved active image. No repeated aiming or attack is inferred.

For all six compound attempts, the timer is armed before Resume DOWN. Escape
DOWN occurs at **+1,101 ms** for the two short windows and **+2,401–2,403 ms** for
the four long windows; attempted keys are independently released before it.
Escape UP follows about 80 ms later. In the original v1, `holdMs` is a planning
parameter: a long transaction can physically hold its action key about 2.32
seconds, inside the declared 2.4-second overall dispatch window. It is not
claimed as an exact 2,000-ms physical hold. The repaired v2 additionally caps
each action key's hold separately.

The menu is visibly captured at **+1.853–1.862 seconds** for the short windows
and **+3.104–3.147 seconds** for the long ones; post-capture identity validation
finishes by +3.474 seconds. These observed native menu images, rather than the
Escape ACK alone, close each interval. The dispatch cap is not a universal
guarantee of guest input consumption or exact ACTIVE duration. There is no
separate slow Resume/action/Escape admission between those observations.

Across the long wall intervals held in menus, the readable HUD advances only
from about 50 to 55 and health from 77 to 76. This is consistent with the
predecessor's supported displayed-timer exclusion. Exact health at menu entry
and exit, actor freeze and complete simulation pause remain **unproven**.
Blurred cached backdrops are not independent pause evidence.

## Local repair and remaining work

After shutting down the original, `compound-v2.cjs` adds a visible phase gate
before C or action DOWN. It uses two full owner/module reads around a read-only
native canvas image, hashes/saves that image, rejects a probe older than 250 ms,
and recognizes only the tested 640×480 live HUD with a timer and nonempty health
bar. The independent overall release/Escape timer remains armed throughout.
Late or absent HUD confirmation, changed identity, stale images and partial
UNKNOWN cannot send late gameplay DOWNs. Unsupported dimensions and the retained
prior death image fail closed. It does not identify targets or qualify fire.

Actual Chromium tests use a clearly labeled generated phase fixture displaying
captured menu/HUD images after a delayed mouse transition. C/Up DOWNs occur only
after the identity-checked positive image; trusted UP/Escape and released
states pass despite a slow sampler. Focused timing regressions cover delayed,
absent, late and stale confirmation, identity failure and partial delivery.
These tests qualify the local repair's behavior, **not a second original run**.
The original's pinned v1 bytes remain unchanged. The repair is integrated into
the separate `browser-run-v2.cjs`, with a guard requiring explicit new pins
before launch. That driver must be newly staged and qualified against Recoil's
actual native transition before extending the route, opening R/O/M panes or
targeting a control. Its integration has a syntax check; its phase module has
the Chromium tests above. No additional original was allocated here. Full27,
parity, audio and unmeasured FPS remain open.

## Lifecycle and evidence

All **365 remote artifacts / 36,515,325 bytes** were retrieved and independently
rehash-verified before normal stop. Captures, per-command receipts, phase timing,
runtime pins and final verification live in the run directory. The initial
post-quit inventory asserted before all PIDs disappeared; its failure is
retained. A later read-only observation and settled inventory establish all
**15 PIDs absent**, HTTP/CDP ports refused, profile/writer lock absent, and
observed arrow/mouse release. All local browsers are drained.

The independent observable **25-minute watchdog** and normal-stop child were
armed before the sole UUID-idempotent allocation. Both exited 0, and the
supervisor ended with no children. Box **`bx_qe4ugwc6`** is **archived**, stopped
**08:07:25.078Z**; final expiry is **null**, initial expiry **08:21:36.448Z**.
Receipt **`stop_4de58d7aad8021c5`** completed **08:07:25.099Z**, **forced=false**,
error null; `final-stop-receipt.json` retains the final GET. No resume/delete,
old-box action, deployment, guest state/clock edits or live harness patch
occurred. Disk stayed above 5 GB.
