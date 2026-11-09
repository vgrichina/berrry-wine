# Nox labeled native staff pickup and door-directed action

Run `scratch/runs/20261109-nox-labeled-command-target-2255/` establishes native
Force of Nature Staff of Recharge pickup, equipment, and one supported
LEFT/150ms action toward a separately reviewed visible wooden door. The returned
image shows green firing particles and HUD charge **3 → 2**. The northeast door
remains visibly intact; target damage, destruction, an enemy hit, and a later
gameplay outcome are not established. Jack's health bar appears full in that
returned frame. Gameplay ended there with ordinary planned close.

The original route was Network → Host → Conjurer/default Jack → Chat Area →
Bunker/Arena. A different spawn required following the torch corridor through
the sword/armor rooms to the central four-flame chamber, then its southwest
door into the blue-flame staff chamber. The retained 1925 evidence supplied
route and pickup references, recorded by path, size and SHA in
`retained-route.json`; old images were not copied into this run.

The native hand cursor and explicit `PICK UP / Force of Nature Staff of Recharge`
label were reviewed before the pickup. The next returned frame shows the staff
in Jack's hands and the staff HUD with charge 3. Inventory confirms the staff
in its top-right slot and in the character portrait. The Arena floor item
subsequently respawned while the equipped staff persisted. Permanent removal
is not claimed.

| Evidence under `review/` | Reviewed observation |
| --- | --- |
| `step-031-staff-hover.png` | Native pickup identification and hand cursor |
| `step-032-staff-native-pickup.png` | Staff held, fist replaced, charge 3 |
| `step-033-inventory-staff.png` | Inventory and portrait equipment |
| `step-036-door-aim.png` | Cursor on visible northeast door; charge 3 |
| `step-037-staff-fire-door.png` | Green particles, charge 2, door still intact |

Every one of the 38 returned original images, including startup, was separately
model-viewed before dependent input. The task-local builder in `command.py`
creates unique bounded labels and IDs, verifies the retrieved PNG SHA against
its capture record, and uses that returned label and identity for the next
review. `native-shot-receipt.json` retains the actual command, identity admission,
and native mouse receipt: LEFT at normalized `[0.69, 0.35]`, requested hold
150ms, independent release. No further gameplay or capture followed that image.

Code `c3f2602b70a16a0b67cd59cbbf80899f9ae0b708` was pushed to main before
allocation. The generated Nox consumer now rejects missing, non-string,
malformed, oversized, reserved `undefined`/`null`, and duplicate capture labels
before review reads, live observations or native input. This prevents the
previous movement-then-undefined-capture failure. Shared providers and other
lanes were not edited. The custody adapter and provider are byte-identical to
accepted lineage repair `ca5880f0114978186b13eda5c0ee40ad457d7be0`.

The locked build, three native-input tests and all 27 generated-consumer controls
passed. Seven label-negative controls assert zero mouse presses, startup-only
screenshot count, and no protocol after terminal failure. The task builder's
47-command retained route also passed the actual generated consumer against the
offline Node browser peer, checking every returned identity against the next
review and the supported LEFT/150ms receipt. Offline post-action waits were
zero; requested input holds were retained. This is consumer-flow proof, not
Chromium or guest gameplay proof.

Both phase manifests were sealed and independently reread before the sole
allocation: 858 pins each. All 862 staged inputs passed remote verification.
The single changed native fixture passed with zero original launches and
148 owned/148 reaped tasks. Only then did the single original start. Both Chrome
exits, consumers and actual parent waits returned 0, with separate stdout/stderr
EOFs. Original custody completed with 340 owned/340 reaped, no failure,
cancellation, remaining tasks or unresolved lineage. Independent cleanup found
both ports closed and all named processes and profiles absent. Native browser
was Chrome 151.0.7922.108 / V8 15.1.206.16.

`retrieval-verified.json` independently checks all 488 remote artifact entries,
397 unique contents, by SHA-256 and size, plus gzip and PNG CRCs, with zero
content errors. A further unique-content reread preceded the sole delegated
normal stop. Box `bx_mdcvk7mm` is archived; receipt
`stop_22870acf805d5de1` completed unforced at 2026-11-09T23:19:17.437Z.
Watchdog UUID `dc63a907-5ac5-4203-a6ed-acdf20842bf5` retained its immutable
deadline 2026-11-09T23:30:32.487461Z; initial API expiry was
2026-11-09T23:30:33.648Z. Its supervisor recorded actual wait 0 and separate
output EOFs. Independent API reads confirmed archived state and the exact
completed stop operation, with unchanged watchdog configuration. An initial
post-stop receipt GET used the wrong `/stop` endpoint and returned 403; that
request was not retried. The operation's returned `/stops/<receipt>` status URL
provided the successful independent receipt. This happened after gameplay,
retrieval and shutdown; no subsequent game protocol was sent.

Recovery uses the recorded exact Git commits, `code.patch`, generated provenance
patches, `run-inputs.patch`, phase manifests, original-media paths/hashes and
retained unique modules/logs/captures. No source-tree or media archive was made.
The requested pickup and reviewed charge/target result are complete. Destructible
target impact would require a separate future task. No owned live box remains;
this single-task worker stops after publication.
