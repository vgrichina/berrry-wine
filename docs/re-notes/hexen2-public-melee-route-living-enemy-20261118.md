# Hexen II public melee route, 2026-11-18

The concrete static finding is a missing distinction between default bindings,
registered bindings, actual guest attack consumption, and enemy consequence.
No runtime defect is established.

At immutable graph `34c794d549c4ad71dfe40c1647e4ffd0c7a4f8af`, the registered
`hexen2_demo` launches original `installed/glh2.exe`. Its registered
`lib/hexen2-modern-controls.ini` binds Ctrl to `+crouch`, Mouse1 to `+attack`,
and W/S/A/D to movement. `Hexen.rc` executes default.cfg, then config.cfg,
then autoexec.cfg. The manifest merge preserves the registered control files;
persisted config restoration follows mounting. HTTP 200 receipts for both
registered control URLs in the previous closed run establish delivery, not
the final active guest bindings.

The previous native-pause task's `ordinary-bindings.json` explicitly says its
source is unchanged pak0.pak default.cfg. Default Ctrl attack and A lookup do
not establish active overrides after config.cfg. Three independently released
Ctrl gestures therefore establish transport, not three consumed attacks.
Mouse1 is the attack binding in both default and registered controls. The
previous ordinary Quit0 and native Pause/resume evidence stand; enemy damage
and defeat remain unproved. This finding does not retroactively recover an
alive attack pose or enemy hit in any closed scope.

The pinned public browser route is canvas mousedown -> handleMouseDown ->
physical button mask and input queue; window-capture mouseup -> handleMouseUp
clears the mask and queues release. The window handler stops propagation, so
a document-only ledger can miss UP. Trusted window events, transport ACKs,
and physical neutral state remain separate from guest consumption and damage.

Public Raven source preserved at videogamepreservation/hexen2 commit
`eac5fd50832ce2509226761b3b1a387c468e7a50` explains the next boundaries:
H2W mouse transitions become Key_Event; bound +attack/-attack alter in_attack;
the command button bit feeds button0; H2MP W_WeaponFrame checks attack readiness
and W_Attack selects the class weapon. Paladin weapon1 uses gauntlets. The
released gauntlet routine traces 64 units forward with downward/upward fallback
traces and calls T_Damage only for a damageable intersection. Weapon animation
alone is insufficient hit proof. These H2W/H2MP sources are explanatory public
source, NOT authenticated to the registered demo executable/progs.dat. No exact
demo range, timing, damage value, or binary equivalence is claimed. No bundled
executable/progs.dat disassembly or game-state inspection was performed.

If runtime eligible, use the same coherent immutable graph and module
`1504acf2ea5cac3ec3b8c627f4edc64c564e62ad37c06928f288bd8ae83b4f37`
(2,418,470 bytes). Inspect public native controls where practical. Choose each
finite gesture manually from a personally viewed whole frame, use independent
UP, retain ordinary Pause only as previously proved, and reserve ordinary
Escape/menu Quit/Y. Use Mouse1 for attack; establish an alive attack and visible
enemy injury/collapse separately. UNKNOWN permanently closes that runtime
scope, with no replay or endpoint request. No clock/save/state edits, solver,
OCR, autoplay, guard waiver, Wine, deployment, or broad unchanged build.

All new planning/output is owned tmpfs while disk recovery is incomplete.
The prior combat hold belongs to the recovery worker for retrieval. Runtime
eligibility and final evidence disposition are recorded separately after that
worker's actual messageboard completion and a fresh disk sample.

## Fresh scope and exact closure

Recovery worker RELEASE STOP at 16:57:59 UTC was read before admission.
Actual prelaunch free space was 1,527,668,736 bytes. One original scope was
launched at 16:58:16 with the unchanged retained operator and fixed deadlines.
The independent watchdog sampled 1,493,262,336 bytes and wrote disk-floor
cancellation at 16:58:35.703. No manual command, key DOWN, Mouse1, attack,
Pause, gameplay movement, or ordinary Quit was sent. There is no runtime replay.

The unchanged startup helper did not observe the cancellation immediately:
16 CDP startup requests were issued after the watchdog cancellation, including
passive evaluation and auto-attachment. Its startup wholeframe completed at
16:58:38.365; the command loop observed cancellation at 16:58:38.423 and closed.
This is an explicit cancellation-latency limit, not a claim of zero requests
after the disk event. No operator command or endpoint request was sent after
the cancellation was personally observed. The saved wholeframe, reviewed
offline after closure, shows teal desktop and Starting Hexen II; it does not
establish the native menu, actual WebGL executor, or living play. The closed
scope was not queried again. No guard waiver or runtime repair was authored.

Browser/Xvfb/Openbox/watchdog waits exited 0 with both output EOFs. Supervisor,
enclosing launcher, and invoker child waits exited 1 for cancellation, with
both EOFs. Host cleanup is not ordinary Quit. The outer invocation also returned
1; its tool receipt is retained separately. Containment reported leaked=false.
Final owned PID verification and evidence disposition are in verification.json.

Enemy damage/defeat and ordinary Quit in this fresh task remain UNPROVED.
Previous accepted native Pause/resume and ordinary Quit0 remain historical
proof only. No code changed, so no build, code commit, or broad unchanged
qualification was warranted. No box was created: ID null, state NOT_CREATED,
expiry null, stop receipt null. All original foreign tmpfs holds remain untouched.
