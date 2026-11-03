# Alice wind crossing: static trajectory diagnosis (2026-11-03)

The retained attempt establishes entry into the steam/basin and a later underwater
state, but cannot establish where Alice first touched the wind or whether she rose
and then fell. The authentic `speed -1` trigger is a **thermal**, with reversed,
reduced gravity while its flag is active. It is not a fixed upward launch impulse.
Launch position, lateral alignment and forward travel remain the first variables
to observe. There is no reproducer of an emulator acceleration defect.

This single-task investigation used original files and retained evidence only.
No guest, browser, campaign, restart, boat operation, guest write or production
change occurred. Coordinator board entries at12:54:17/12:54:29 confirmed the
cap reread, observed one live predecessor worker and authorized this static
successor. Evidence and executable recovery recipe are in
`scratch/runs/20261103-alice-wind-trigger-trajectory/` (not committed).
The predecessor publication is `967773795fbcdbb96ca4bd896a6de9ae9816f411`.

## What the captures actually observe

I personally reviewed `approach_wind_gap.png`, `ordinary_wind_jump.png` and
`wind_observe.png`, and read their receipts and the original visual-review ledger.
At30418 Alice is on/over the near wooden approach, facing the visible steam and
far-side structures. At30698 the steam largely obscures her and the camera is
below the upper crossing. At30938 the view is underwater, beneath stone geometry.
The last image cannot uniquely identify which overhang or which side of the jet
she is under. Camera coordinates are not player coordinates.

| Commands | Retained observation |
|---|---|
|189/190 down D+W;191 step80;192/193 release;194 step80|Approach image at30418, after diagonal approach and neutral execution|
|198/199 down W+Space;200 step180|No intervening launch/contact/apex image|
|201/202 release both;203 step100|First jump image at30698, **100 steps after release**|
|207 step240, no new movement keys|Underwater image at30938, **340 neutral steps after release**|

These are controller step counts, not measured guest simulation seconds. The
receipts' frozen tick setting is200ms, but that does not prove one simulation
frame per controller credit. No duration, distance, speed or jump-apex calculation
here converts credits to guest seconds. The late images neither prove nor exclude
a transient lift or a missed landing during the unobserved interval.

## Exact original geometry and its limits

Fresh parsing of FAKK42 (12-byte header,20 lump descriptors) reproduces all368
entities and every retained plane, side, brush, model and shader record exactly.
Model4 comprises brush843, six axial planes: its translated bounds are its actual
box, not merely a conservative model AABB:

`x[-5192,-4984], y[5020,5132], z[-320,96]`, origin `(-5088,5076,-112)`,
`trigger_accelerate`, `speed -1`, `spawnflags 8`.

South means decreasing y. Adjacent original emitters are
`(-5093.44,5052.36,-291.64)` and `(-5102.40,5057.60,-281.60)`; their visible steam
is a landmark, not a precise outline of the contact volume.

| Original brush | Exact or explicitly sampled geometry |
|---|---|
|219, near plank|x[-5092,-5056], y[5152,5280]; top z=-120 at y5280, rising to z=-88 at the south nose y5152|
|218, far plank|x[-5092,-5056], y[4828,4892]; north tip y4892 has top z=-104|
|403, basin water|x[-5440,-4608], y[4736,5376], z[-384,-320]; shader `textures/liquid/tower2`, contents0x20000020|
|415, basin floor|x[-5456,-4592], y[4720,5392], z[-400,-384]|
|616, south rock shelf|At x=-5074: z[-175.7117,-140.4551] at y4960; z[-212.0925,-119.8832] at y4928|

The plank centerline is **x=-5074**,18 units from either side. The previously
suggested trigger-center x=-5088 is only4 units inside the plank's west edge.
This is a useful ordinary alignment correction, not a measured Alice position.
Near plank nose to trigger north face is20 world units. The two wooden tips are
260 units apart; the south rock can provide a nearer landing than the far plank.
The trigger ends at y5020,128 units before that far wooden tip. These dimensions
explain why staying over the jet and choosing the exit direction matter; they do
not prove a required jump range or a collision-free swept path.

The water surface and thermal bottom both lie at z=-320. Below that level,
the player's origin can be outside the wind even while a body hull still overlaps
its boundary. Basin water extends well north, south and east of the thermal.
An underwater frame therefore fits falling out of its sides, through its bottom,
or under the south shelf after passing the jet. It cannot distinguish them.
The scene's matching steam/water/stone makes this basin the supported visual
identification; there is **no recovered exact player x/y/z, heading, launch
height, contact history or entry trajectory**. Assigning those from the screenshots
would be an estimate, not an original-file fact.

`vertical-brush-samples.json` records point sections of all840 world brushes,
including solid/playerclip and water. It excludes mesh/mover collision and player
hull expansion, and makes no claim to reconstruct the underwater camera pose.

## Original thermal implementation

Addresses below are preferred original `fgamex86.dll` VAs (base0x10000000), not
runtime addresses or proposed trace points. Full original disassembly and decoded
constants are retained in this run.

- Registration at0x1010df80 ties `trigger_accelerate` / `TriggerAccelerate` to
  factory0x1010dfe0, constructor0x1010e450 and event table0x101b6328.
  The event table connects the trigger-effect event to0x1010e050 and `speed` to
  setter0x1010e3e0. Constructor default200 is superseded by the BSP speed event;
  constructor response mask is entity spawnflags XOR0x1c (8 becomes0x14).
  No claim about undocumented flag names is needed to establish this path.
- At0x1010e0bf the effect explicitly compares speed bits with -1.0. For a
  client/player it removes the pending `clearthermal` event, multiplies entity
  vertical velocity (`+0x80`, vector starts `+0x78`) by0.9 if above50, or by0.95
  if below-50, sets player-state flag0x10000, and posts `clearthermal` after0.1.
  Repeated contact refreshes this event. It does not set a positive launch speed.
- The original event description says `Clears the PMF_THERMAL flag (not for
  scripts).`; handler0x100e0090 clears exactly0x10000. In movement0x100612a0,
  when that flag is present, the state gravity field (`+0x30`) is temporarily
  multiplied by **-0.25**, movement substeps execute, then gravity is restored.
  Thus the complete mechanism does supply upward acceleration while thermal
  state is active; damping alone would be an incomplete interpretation.
- Movement0x1005f1a0 additionally damps horizontal state velocity by0.95 under
  the thermal flag when its checked horizontal wish components are both zero.
  Neutral execution can change the trajectory. Event0.1 is a guest-defined
  delay, not proof of an observed real-time interval in this run.
- The other speed branch at0x1010e2de adds direction times speed to velocity.
  It is not the map's -1 special case. No original script toggle, lever or
  cinematic prerequisite for enabling model4 appears in the two map scripts.

These facts make a late/low or off-center entry, a lateral exit, or travelling
beyond the jet before enough height was gained all plausible. They do not select
one cause. The images also leave open ordinary collision/ledge contact and a
brief successful lift followed by a fall. Holding Space is the authentic
`+moveup` binding; the original readme documents it as jump/swim up. It does not
document an extra glide key required here. An unobserved key requirement is not
an evidence-backed diagnosis.

## Bounded ordinary next attempt, only after separate authorization

Use the ordinary opening and first gnome route already retained; do not restore
a synthetic position or call scripts. At the crossing, align with the **middle
of the narrow rising plank**, face its southward axis toward the steam/landing,
and approach its visible nose with W in2/4/8-step increments, releasing and
capturing immediately after each increment. Do not insert an80-step neutral wait
before inspecting footing. The plank nose, rather than the early screenshot's
unknown point along the plank, is the intended launch landmark.

For one initial jump, press W+Space and capture after2 steps while held. Review
before each additional2/4/8-step increment. Keep this first contact/lift observation
to at most32 held credits; after release capture immediately and after2/4/8
neutral credits, with at most64 total credits from initial press. These are
controller bounds only. Stop upon submersion, death, loss of recognizable footing
or failure to locate Alice; no blind continuation or automatic retry. If an
early image clearly shows ascent in the jet but insufficient forward clearance,
a separately bounded, reviewed continuation can target the south rock/plank.
Do not coast240 neutral credits without observation.

The question this resolves is: **does Alice leave the plank airborne and rise
while still centered in the steam, or does she fall/exit laterally before lift is
visible?** Observe that before selecting a new heading or hold length. No exact
numerical heading is recovered from the old turn inputs. No engine implementation
work is justified unless a separate scoped reproducer establishes faulty behavior.

After a reviewed south landing, the original route turns east along the landing
near y4760, crosses the second dialogue boundary x[-4776,-4760], y[4576,4936],
z[-136,144], then follows the timber passage toward the knife altar
`(-3978,4326,-168)` (`Item_WeaponPickup_Knife`, `altar_knife.tik`, `knife_cat`).
Let all natural dialogue/pickup cinematics finish. This is static availability,
not a proven traversed route, knife ownership or combat success.

## Identities, checks and recovery

| Original file/member | SHA256 |
|---|---|
|demo/pak0.pk3|14ce74568458078f51f5b4f42a65c5a5888c01c487bbf8c064f541039a306556|
|maps/d_gvillage.bsp|4d2435f126831467d52f23722823b5486b6e9ce2f9149bd2f5e06cca94457855|
|maps/d_gvillage.scr|c9f5c008e4ea35f1ead0e83bbdfcdc86801bcb7bfa0779481748e5430cf4738e|
|maps/cinematics/gvillage_rabbit.scr|00554179a0786cbc1e2e15f1c399e6f766513c7fba5f4957cda582a52a218c63|
|default.cfg|fa3a595ec886b92e96a4a572ac51a93516b462c9d48dfa35258f453001150e8e|
|demo/fgamex86.dll|42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c|
|demo/cgamex86.dll|2fc6c957d8f554ff296271c9c50ec6aa3b5f72531061bf8a23af8d219e6d8c24|

All6054 predecessor archive payloads were freshly checked against the full
manifest; selected captures, commands, ledger and receipts were copied from
verified archive bytes into this run. The three local predecessor receipts differ
only by one added trailing newline; archive copies match the published hashes
exactly. No predecessor artifact was overwritten. Original parsed geometry equals
the retained arrays, and the file sizes/hashes and constants are retained as JSON.
No production code changed, so no build or game test was run for this document.

`RECOVERY.md`, `full-manifest.json`, `checks.json` and `predecessor-verification.json`
in this run retain reproduction/check instructions and local artifacts. No boat
is assigned to this worker. Recorded predecessor bx_3uvpk4nf is STOPPED, original
expiry2026-11-03T13:59:05.938Z, snapshot retained, shutdown owner
alice-wind-knife-native; its state was read from released evidence only.
Runtime lifecycle ownership remains with the coordinator; no boxes were touched.
