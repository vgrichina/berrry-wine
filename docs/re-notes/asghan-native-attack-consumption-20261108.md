# Asghan: native attack input reaches guest polls; outgoing consequence unresolved

The unchanged registered software demo consumes Ctrl+Up during a reviewed
contact-range attack window. **Outgoing sword damage, enemy defeat and pickup
remain unproved.** This run closes the input-delivery question, not the combat
consequence question. No demonstrated emulator mismatch warrants a repair.

Evidence: `scratch/runs/20261108-asghan-native-attack-consumption/`.
Tested main SHA: `924096418d11b668ca0341b101133d32cb96370c`.
Recovered executing guest Worker module SHA-256:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
Only this note changes in Git; run helpers and evidence remain ignored.

## Controls and actual input consumption

Read `CLAUDE.md`, the current browser-action handoff, and shipped `readme.txt`
sections 3–4. The documented controls are hold Ctrl for stance, Ctrl+Up for
fast attack, Ctrl+Left for swipe and rotate, and Space for action/pickup.
The run used title → Enter → visible NEW GAME → Enter → settled pier,
then reviewed Up/Left movements toward the same visible orc and barrel.

The released native browser driver, independent release timer, exact ACKs,
owner/window/canvas/module binding and 120-second scene freshness gate were
retained. Before the original run, trusted native Alt, Alt+Up and Ctrl+Up
DOWN/UP consumption passed against the actual production Calc Worker.
Generated owner/window/module/image/stale/UNKNOWN negative controls passed.

There was no suitable existing bounded Worker-return recorder. A run-local
CDP observer was installed before the production Worker instantiated the
unchanged module. It forwards the existing `WebAssembly.instantiate` call
and wraps its actual host input imports using `Reflect.apply` exactly once.
It preserves receiver, argument values, returned value/promise and original
exception identity; its recording failures cannot replace production results.
Receiver/result/exception/exactly-once checks and actual production Worker
native-input qualification passed (`observer-qualification.json`). It makes
**zero additional input polls**, writes no guest memory and changes no clocks,
scheduler, executable or setup. Observation has overhead; this is no speed test.

`get_key_down_state` returns, including Worker-local shared-bitmap/cache
answers, were observed at the actual imported-function boundary. The sweep
of keyboard keys plus `di_keyboard_buffer` calls is consistent with the
DirectInput keyboard path in `src/09a8-handlers-directx.wat`; attribution to
that named guest API is a source-based inference. The measured facts below
are actual import results, not inferred browser dispatch or stance pixels.

| Reviewed attack | Native hold | Guest returned down | Guest returned released | High returns since preceding capture |
| --- | --- | --- | --- | --- |
| `contact-fast`, Ctrl+Up | 04:45:17.337–19.337 UTC | Both `0x8000` at 17.472, 135 ms after DOWN | Both zero at 19.520, 183 ms after UP | Ctrl 18, Up 8 |
| `contact-swipe`, Ctrl+Left | 04:45:36.516–38.516 UTC | Both `0x8000` at 36.533, 17 ms after DOWN | Both zero at 38.550, 34 ms after UP | Ctrl 16, Left 7 |

The counters count import returns, not frames or distinct physical presses.
Native DOWN/UP ACKs completed within 1–2 ms; independently armed releases
were attempted at their scheduled deadlines. The full transition rows,
counts and pulse receipts are in `attack-consumption.json`, recovered state
files and `recovered/original/final-consumption.json`. The observer reports
one instantiation, zero errors and zero dropped transition rows.

## What the reviewed images establish

`approach-orc.png` shows the orc beside the barrel, ahead-left of Asghan.
`close-range.png` shows that forward movement instead takes Asghan onto
the raised edge beside the rock wall, with the orc lower and left.
`face-target.png` follows a left turn: the orc's axe reaches Asghan and
red ground marks accompany a shorter hero health bar. This establishes
contact reach for the enemy; it does not establish the hero's sword alignment.

One two-second fast attack follows that current reviewed capture. In
`contact-fast-during-900.png` the sword extends across the orc's head/upper
body in projection; the orc subsequently remains standing and armed in
`contact-fast.png`. Sword motion and blood are insufficient to attribute
damage. One documented swipe-and-rotate then addresses the oblique contact
angle; `contact-swipe.png` still shows a standing, armed orc. No disappearance,
loot, inventory/counter change or clearly attributable hit reaction was observed.
No visible pickup was selected, and Space was not sent blindly.

Displayed green pixels at screenshot row 666 measure **160 → 130 → 100 → 90**
in `face-target`, `contact-fast`, `contact-swipe` and the final capture.
These are hero-bar pixel widths, not private health values or enemy damage.
There was no death/restart joined into the sequence. After these two distinct
attack attempts, attacks stopped. The final capture is labelled `native-menu`
after an Escape request, but **no menu overlay is visible in that image**;
it is not menu-success evidence. Chrome then closed normally.

The remaining measured gap is target alignment/vertical contact on the raised
edge and attribution of an outgoing consequence, despite Ctrl/direction being
returned down together during the hold. Missing Ctrl/Up delivery does not
explain these attempts. The evidence does not establish whether the sword
missed, damage occurred without a visible reaction, or additional guest combat
rules applied. Do not repeat these poses as success. A future attempt needs
a reviewed same-plane target directly ahead, or a visible actionable pickup
with a before/after object or inventory consequence.

## Identity, preservation and shutdown

All 120 fixture files, 30,448,512 bytes, match the immediately preceding run's
path/size/SHA-256 references. No install, native setup edit, alternate executable
or media archive was used. All 712 runtime pins match before launch and after
closure. HTTP responses independently match 69 originals, including `_start.exe`,
both required DLLs, manifest and native setup outputs; 51 paths have no recorded
HTTP request. Staging is not described as consumption of those 51.

Every one of 13 bound captures retains the same process 1000, actual guest
endpoint/Worker/instance/module, page renderer, canvas and visible process-owned
**Win Alis** window identity. The route remains software/DirectDraw presented
through `CanvasRenderingContext2D`, with no owning 3D Worker/context. No GL-only
readiness gate was used. This supplies no GL/D3D, FPS, audio or full-playability
claim.

`verify.cjs` passes: 13 exact command ACKs, 10 pulses, 12 balanced trusted
native DOWN/UP pairs, zero UNKNOWNs, 40 CRC-decoded PNGs, stable capture owners,
actual attack-poll transitions and unchanged media. All **183 remote references,
14,017,036 bytes**, were retrieved and independently SHA-256 checked before
normal box stop. Chrome exit 0; controller/Chrome PIDs and both ports absent;
profile/writer lock removed; no held keys. Source recovery records the Git SHA,
relevant binary patches, owned-input patches, recovered module and original media
references, without any source-tree archive.

Fresh UUID-idempotent box **bx_8t63hy52** had an independently observable
25-minute watchdog armed before allocation. Normal stop receipt
**stop_251149051c2cca22** completed at **2026-11-08T04:46:38.400Z**,
`forced=false`; final state **archived**, expiry **null**, initial expiry
**05:08:40.693Z**. Both lifecycle delegates exited 0 and the supervisor has no
remaining children. Disk stayed above 5 GB. No RAM gate, old-box resume/delete,
nested worker or public deployment occurred.
