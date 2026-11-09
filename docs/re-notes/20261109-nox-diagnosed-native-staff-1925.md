# Nox: native green staff pickup, equipment, firing and terminal defeat

Run: `scratch/runs/20261109-nox-diagnosed-native-staff-1925/` (ignored evidence).
Source: `0b0249309cd8fd4b8cbe43087c0c2ad26803de44`, including published startup
diagnostics `d5a984cc42b507d6d15f83e97a01224b7b062381`. No production source,
provider, media or pin edits were made by this worker. This note is the only
tracked change.

## Reviewed result

Original Nox reached Network → Host → Conjurer (Jack) → Bunker/Arena using
ordinary native mouse/keyboard input. Solo and King were not attempted. The
spawn differed from the 1750 run; ordinary movement found the blue-flame staff
alcove southwest of the four-flame central room. The 1750 floor-staff image
proved no equipment; this run establishes equipment explicitly.

Earlier left-click pickup attempts were followed by an inventory showing only
clothes. They are not counted as successful pickup. After a short right-button
step exposed the floor item, command 40 (`staff-floor-center`) produced a native
hand cursor and the yellow **PICK UP — Force of Nature Staff of Recharge**
label. Command 41 (`staff-native-pickup`), ordinary LEFT at that confirmed
hotspot, placed the green staff in Jack's hands and changed the weapon HUD from
fist to staff, with charge 3. Command 42 (`inventory-staff-equipped`), ordinary
I, showed the staff in the inventory's top-right slot with a red/gold border
and in the large character portrait. The floor pickup later reappeared in this
Arena session while the equipped staff persisted; permanent item removal is
not claimed. No V swap was needed.

Command 44 moved Jack with the staff out of the alcove into the blue chamber.
Command 46 (`staff-fire-door`), ordinary LEFT for 150 ms aimed at the northeast
wooden door, showed green firing particles and charge **3 → 2**. The door
remained intact. Command 47 (`staff-onward-door`), ordinary RIGHT for 1300 ms,
returned Jack's corpse, empty health and a native green **Jack [blue icon]
Jack** kill banner. This is visible firing and a terminal defeat consequence,
with self-defeat attributed by the native banner. The exact damage mechanism
(including any ricochet), an enemy hit, object destruction and onward victory
are unproved. Further gameplay stopped at this first observed death; no later
input, capture, retry or in-game quit was sent.

Key reviewed images, relative to the evidence directory:

| Capture | Evidence |
| --- | --- |
| Native item label | `review/staff-floor-center.png` |
| Staff held and HUD equipped | `review/staff-native-pickup.png` |
| Inventory and portrait equipment | `review/inventory-staff-equipped.png` |
| Movement out of alcove | `review/staff-onward-exit.png` |
| Firing, charge 2 | `review/staff-fire-door.png` |
| Terminal corpse and kill banner | `review/staff-onward-door.png` |

All 49 actual returned PNGs (startup plus commands 0–47) were inspected in
separate model/tool steps before the next input. Request records retain the
preceding capture SHA and written review. `first-runtime-failure.json` records
the final reviewed death and terminal boundary. All 48 command ACKs were OK.

## Startup diagnostics and exact current inputs

Both the one native fixture and the conditional one original startup succeeded
in Chrome 151.0.7922.108 / V8 15.1.206.16. No new native-startup-failure snapshot
was produced. The earlier 1915 failure still proves missing port readiness
after its bound; its underlying cause remains unknown. This run does not
select a startup causal repair and makes no DBus or ptrace explanation.

No runtime or final-pin generation began until RF1910 and Q31920 had both
published RELEASE STOP. Their published commits were respectively
`6e99b8d93d4ddb1f3a59683af63fb5333e11a530` and
`0b0249309cd8fd4b8cbe43087c0c2ad26803de44`. Independent API reads confirmed
their boxes `bx_c7rcqwab` and `bx_723dmktw` archived with completed unforced
stops `stop_6471f0691cc21189` and `stop_2ddc655a0d4b60bf`.

Actual source differences from the 1750 baseline were read before generation:
only `lib/gl-compat.js`, `lib/gl-render-host.js`, `lib/gl-render-worker.js` and
`tools/nox-current-driver.cjs` differed in the provider closure. The GL changes
add armed opcode-12 stage timing; Nox does not arm it. The Nox composer adds a
failure-time observation around the unchanged 100 × 100 ms startup readiness
bound and rethrows the original error. There is no added retry or relaxed
deadline. `reviewed-provider-delta.patch` and `provider-review.json` retain
this comparison. A routine offline comparison-path error was corrected to
the existing 1750 `generated/runtime-pins.json`; it did not authorize a repin.

The exact generated closure contains 776 files, including all 126 unchanged
original media identities and both freshly compiled modules. Module identities:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| Primary, actually loaded | 2186068 | `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18` |
| Compat | 2188714 | `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf` |

`source-sha.txt`, `working-tree.patch`, `current-plan.json`, generated pins and
small per-file patches preserve source identity. Git is the source archive;
there is no source-tree or media archive. Media were referenced by existing
path and hash, then individually staged with exact pins.

## Validation and lifecycle

- `node --test ops/browser-native-input.test.cjs`: 3 passed.
- `flock /tmp/wine-build.lock bash tools/build.sh`: passed, joined exit 0.
- Fresh generated-consumer `tools/nox-current-driver.test.cjs`: 13 passed,
  including source/media/module/repin refusals, missing port, early death 17,
  malformed port, ordinary input and drag failure. Offline Node peers only.
- Operational scripts passed syntax, exact two-release predicates, terminal
  marker and disk-floor refusal checks, and independent-watchdog actual-wait
  tests with separate stdout/stderr EOFs.
- Native fixture passed its no-original-selection boundary; Chrome exited 0,
  parent waited 0 with both EOFs, kernel reaped 149 processes, with none left.

One box, `bx_yvz9msca`, was created after an independently observable watchdog
was armed. Immutable watchdog UUID `6b723f2c-7816-4ebe-8d6e-247ed112eb6c` had
deadline **2026-11-09T20:11:34.878Z**; initial box expiry was
**2026-11-09T20:11:35.357Z**. The browser work deadline was two minutes earlier.
No deadline or guard was relaxed.

After reviewed game death, only process cleanup and evidence retrieval ran.
The identity-checked original custody supervisor received SIGTERM, and its
parent actually waited 1 with separate stdout/stderr EOFs. The kernel reaped
361 processes and reported none remaining or unreaped. All recorded fixture
and original process IDs were independently absent, all four ports closed,
and the stale owned original profile was removed only after absence. The
original Chrome normal-close receipt is absent, so normal Chrome exit is
unknown; box stop completion is independently verified.

Before requesting stop, 592 remote artifact references (483 unique SHA
identities; 16,341,759 referenced bytes) were recovered or matched to existing
local bytes, then independently reread for full SHA-256 and size, with gzip
CRC validation. All 49 actual PNGs passed chunk CRC and IDAT/zlib validation;
offline fake-PNG test sentinels were excluded. A second independent reread
preceded the sole delegated unforced normal-stop request.

Final independent API state: **ARCHIVED**. Stop
**`stop_587b7e1bbc3663bf`**, completed unforced (`forced:false`) at
**2026-11-09T20:08:51.218Z**; stoppedAt `20:08:51.186Z`. Final archiveAfter is
null and no expiresAt field was returned. The watchdog separately actually
waited **0**, both stdout/stderr reached EOF, and its supervisor reaped it.
No second stop, resume or delete was issued.

The original green-staff pickup/equipment and firing/defeat sequence is now
reviewable. A useful enemy hit and safe continued play remain unproved; any
further runtime must be a separately assigned fresh run, using an open firing
lane and a visible target rather than this closed-door firing position.
