# Recoil menu-assisted objective attempt, 2026-11-08

Run: `scratch/runs/20261108-recoil-menu-assisted-objective/`.

**Force-field objective incomplete.** One fresh watched original demonstrates
native menu entry/Resume, a bounded HUD-timer pause observation, and a practical
review/control limit. It ultimately aligns the uphill ramp while alive, but
the next hold's first frame already shows player death. No power control was
identified, no force field was removed, and no onward access or objective
counter/text consequence was demonstrated. No restart followed death. No
emulator mismatch or production change was established.

The accepted beach-enemy destruction remains foundation in
[native objective](recoil-native-objective-20261108.md) and
[current gameplay](recoil-current-gameplay-20261107.md). The
[previous route attempt](recoil-forcefield-objective-20261108.md) supplies the
known uphill route and power-control brief. This original followed ordinary
Software → OK → Game → Start → New Game, default `user`, Medium, and the natural
opening. The fresh loading display captured here cycles to “1.2 Missile
Control”; it is not claimed as a newly captured 1.1 power-control brief. R/O
statistics were not reopened in this run; the prior 0/4 is not a fresh counter
measurement. The last living score here is 0.

## Native menu review: supported scope and limits

The installed `game/docs/index.html` was read. It explicitly documents Escape
calling the In-Game Menu, **not simulation freeze**. Early after the living HUD
appeared, `original/living-hud.png` shows health **94**, timer **00:00:26**,
incoming cyan fire and beach enemies. A native 100-ms Escape press/release
opens the blurred scene and then the menu with Resume. An explicit **8-second
idle request** follows; its screenshot is `original/menu-idle.png`.

`menu-observation.json` records these personally read HUD comparisons:

| Living captures | Wall seconds | HUD timer | Health | Menu-entry input to mouse Resume |
| --- | ---: | --- | --- | ---: |
| `living-hud` → `resume-settled` | 78.693 | 26 → 45 | 94 → 83 | 59.144 s |
| `resume-settled` → `live-two-settled` | 93.438 | 45 → 75 | 83 → 67 | 61.768 s |
| `cliff-left` → `route-resumed` | 57.117 | 142 → 154 | 23 → 20 | 43.659 s |

The wall-minus-HUD differences (59.693, 63.438 and 45.117 seconds) approximately
match the native menu intervals, allowing for transitions and whole-second HUD
readings. This supports exclusion of menu time from the displayed game timer.
The tank resumes alive after each interval. **Exact health at menu entry/exit
and actor simulation pause remain unmeasured.** The menu can retain a cached
blurred backdrop; unchanged background pixels are not independent actor-pause
evidence. Health falls across the enclosing active/menu intervals. These data
do not establish complete simulation or health freeze. Menu review was used
within this observed scope; no guest clocks/state were edited.

There are two concrete control limits. Escape opens the menu but a second
native Escape does **not** Resume (`key-resume-settled.png`). An ordinary
relative mouse move and independently released left-button selection do Resume.
That menu pointer also carries into the aiming view: `resume-settled.png` and
`route-resumed.png` show a high reticle and upward turret. Native C restores a
level view aligned with the chassis (`centered.png`, `route-centered.png`).
Resume may still show transitional menu pixels in its immediate capture; a
subsequent capture establishes the actual resumed HUD. No static menu image
was treated as proof that the tank remained paused indefinitely.

## Navigation, defense and death boundary

Fresh pixels guide each action; no coordinate script was replayed. A short
forward/right arc starts around the wreck. `past-wreck.png` shows health 51
and a grey scout near the reticle. A single **1.8-second primary burst** is
attempted as ordinary defense against that visible threat. This is not an
objective attack or a new accepted destruction. Its first passive held frame,
`held-1794123649616.png`, already has the scout left of the reticle; later
`held-1794123650776.png` shows it farther left. Cyan fire alone proves neither
a hit nor a kill; no score/destruction consequence is established. The
capture-to-dispatch interval allowed the moving target to depart. No further
combat burst was sent without a newly aligned target.

`cliff-forward.png` reaches the steep cliff base, health 30. Left turns expose
the side but subsequently overshoot toward the beach. Smaller right corrections
and the native M wireframe map resolve the orientation. Health remains 20
through several views, then 19. `scan-right-two.png` clearly exposes the uphill
paved ramp and red/green posts at the right; a **220-ms Right** correction moves
the ramp ahead in `ramp-aligned.png`. These posts are not identified as the
power control or independently proven to be the objective force field.

The last living capture is **07:44:20.209Z**, health **19**. The first passive
frame of the final forward hold, `held-1794123875082.png`, is already the burning
player tank and Load Game / New Game / Quit menu at **07:44:35.082Z**.
`ramp-advance.png` is also death, despite its command-derived filename. The
exact death instant and killing projectile/actor are unmeasured. There is no
demonstrated living forward response and no causal attribution to that hold.
The final exposed capture-to-first-held-frame interval was **14.873 seconds**.
Menu review did not solve that interval; this run failed to reach the ramp
earlier in active gameplay than the previous attempt. No further gameplay
input followed recognition of death.

## Runtime and evidence qualification

The runtime uses published Git blobs from
**`1e2bdf191574fc11b8a03515cab866c46d305f1e`**, excluding active peer WIP.
The unchanged, hash-checked compiler compiles the published WAT closure in an
in-memory VFS. Actual CDP-recovered Calc and original modules match
**`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`**.
This is a qualified published closure, not a claimed passing shared-WIP build.
No tracked code was changed, so no new shared-tree build was required.

All **727** runtime pins pass their Git/artifact providers. The real registration
has **106 manifest entries + executable = 107 originals**, plus the manifest:
**108 pins / 76,019,820 bytes**, all matching size/SHA and staged pins. The prior
invalid zero-file success report remains preserved and withdrawn. Empty,
missing, duplicate registrations and wrong staged executable SHA regressions
pass; all **113** local HTTP fixture/dependency checks pass. Corrected Git-byte
HTTP lengths and closure helpers are reused. Executable SHA remains
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.

Real-Chromium generated tests retain exact owner/module/freshness identities,
the 120-second capture-age bound, independent release, partial delivery and
sticky UNKNOWN closure. Native Escape, relative motion, trusted Resume-style
mouse press/release and subsequent Escape composition pass locally. A delayed
650-ms sampler cannot extend either 100-ms Escape or mouse hold; released key
and mouse states are checked. These are separate admitted operations; no atomic
Resume → movement/fire → independent release → Escape operation was qualified
or available in the staged driver. Actual Calc qualifies the staged runtime. All
**42** original numbered commands have exact successful ACKs, with no original
UNKNOWN or replay. The sole allocation precheck initially ran before the armed
records existed; it made no API request. Both independent records were observed
before the sole UUID-idempotent allocation.

The original is Chrome **151.0.7922.108**, V8 **15.1.206.16**, 1024×768,
cross-origin isolated, Threads enabled, unchanged registered
`/index.html?debug&threads&app=recoil_demo`. Rendering is software page Canvas2D,
with no owning D3D render-worker endpoint; toolbar WebGL is not backend proof.
Process 1000 / endpoint 1 / slot 0 and document epoch
`f87d887c-d235-44a9-aaf9-deb808d599a7` retain the observed owner chain.

All **581 remote artifacts / 47,692,701 bytes** were retrieved and independently
rehash-verified before stop. The initial post-quit inventory asserted before
all PIDs disappeared; its exact failure is retained. Later read-only observation
and settled inventory confirm all **15** PIDs absent, HTTP/CDP ports refused,
profile/writer lock absent and inputs released, without browser/input replay.
Local browsers are drained. The independent prearmed **25-minute watchdog**
and normal-stop child exited 0; the supervisor ended with no children.
Box **`bx_jegnryx3`** is **archived**, stopped **07:46:01.624Z**; final expiry is
**null**, initial expiry **07:58:20.884Z**. Receipt
**`stop_726617078a4744d1`** completed **07:46:01.647Z**, **forced=false**, error
null; `final-stop-receipt.json` retains the final GET. Disk remained above 5 GB.
No resume/delete, RAM gate, guest patches, forced settings or deployment occurred.

Git plus explicit patches provide source recovery; no source/media archive was
made. All 136 original PNGs pass CRC/IDAT and capture-hash checks.
`evidence-check.json`, `scene-review.json`, `menu-observation.json` and
`death-boundary.json` retain checks and qualified conclusions. Next work needs
a locally qualified shorter resumed-view/target/steering decision interval,
then a fresh living approach to identify and act on the actual control. The
current 120-second admission freshness ceiling is not a survivability or target
tracking guarantee. Full27, parity, audio and unmeasured FPS remain open.
