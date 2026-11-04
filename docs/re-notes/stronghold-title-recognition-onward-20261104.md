# Stronghold title recognition and one original onward attempt, 2026-11-04

The demonstrated title mismatch is repaired. The one fresh original diagnostic
accepted its real title capture, obtained personal review, and sent the original
balanced Enter sequence. It reached a visibly recognizable original main menu.
The retained main-menu exact recognizer then returned `unknown`, causing the
original driver to stop at its first unexpected transition. No menu selection,
Custom Game gesture, preset, scenario Start or gameplay input followed. Original
callback/scene20/setup history and visible gameplay remain **UNKNOWN**.

Evidence: `scratch/runs/20261104-stronghold-title-recognition-onward/`.
Inputs: published local runtime `c09293e27` and owning observer `321b8adc0`.
The attempted candidate is explicitly NEW shared main
`7b639c4a62c407dde18fedc2a6088390d5b345ae` plus the recorded owned patches,
not the historical cffc/580f runtime. Attempted and final patches are separate.

## Measured mismatch

I personally inspected the original reference and rejected local PNG, then
compared decoded RGB pixels. Both are 1200×900 screenshots. Their complete
reported geometry is identical: canvas native800×600, output860×668 at(10,194),
nearest scale, DPR1, destination860×645 at local(0,11). The original exact
500×250 RGB crop at(200,300) hashes to `aec74ca5…`; the rejected local crop
hashes to `dbb5e3a89f1372c93e13dd1c03aafabb6032b3d329e6a1b874a7fdc1309330ff`.
This is not a shifted crop or viewport change.

359 of125,000 pixels differ (0.2872%); the sum of per-pixel maximum-channel
absolute differences is4075. All differences fall on screenshot columns332/547
or row527. The heading, name field, Start Game label and dialog frame remain
visible and otherwise identical. Original Chrome151.0.7922.71 and local
Chrome151.0.7922.108 differ, as do the emulator modules. This sparse sampling-line
pattern is consistent with raster sampling differences; there was no controlled
same-module browser/renderer A/B, so a particular renderer/version cause is
**not established**. `reference-environment-comparison.json` records the measured
geometry and actual versions rather than attributing the difference to a guess.

## Repair and retained safety

`tools/stronghold-title-recognition.cjs` retains historical exact title/intermediate
and menu classification, then compares an unknown title against the original
sealed reference PNG. It checks screenshot dimensions and opaque crop pixels.
Every crop pixel contributes: at most500 changed pixels and6000 maximum-channel
absolute error in total, with each50×50 tile limited to100 changed pixels and
1800 error. There is no alignment search, rescaling, excluded strip, new accepted
whole-image hash, or unconditional acceptance. The limits are narrow margins
around the measured359/4075 difference; shifted images and removed text reject.
The original reference PNG's full SHA-256 is checked before comparison.

Explicit composition replaces only the original helper's `titleScene` function;
its exact original source SHA-256 is checked. All original title input, telemetry,
presentation, document/renderer/canvas identity, whole-game freshness, drained
controls, review receipt, complete64-step ACK and bounded transition logic remain.
The unchanged30-helper closure still compiles. Historical evidence was not edited.
`prepare` composes the existing local runtime and owning observer, replacing only
the entry's title-helper call with this checked wrapper.

The local contract is renewed for **this assignment only**:
`stronghold-title-recognition-onward user task`, absolute Chrome18:05Z and
cleanup18:08Z. Actual hostname, boot ID, PID/start ticks, UID, checkout, executable,
run, manifest, module hashes and fresh random nonce bind the release. Original
and current authorization, finite360-second browser,60-second bootstrap and
40-second command deadlines, plus full360+180-second start reserve, remain.
The old assignment does not authorize this contract. No leased box ID or TTL is
invented. The coordinator retains box lifecycle ownership.

## One fresh result

The actual inherited local flock was free before launch and held through normal
closure. Actual filesystem pins and164 independent full HTTP body/hash/header
checks passed. All1856 original media references match, including EXE
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
The run contains path/hash references only, without media/module copies.

| Attempted existing module | SHA-256 |
| --- | --- |
| normal | `78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664` |
| compatibility | `99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f` |

Chrome launched once. I personally viewed the selector before Launch and each
requested title review before dependent input, plus all nine run PNGs. Five
input-free observations reached7424 steps and the title. The repaired recognizer
accepted the fresh title with the same measured359/4075 visual difference.
After the capture-bound review and identical fresh game-output/identity check,
the original keyboard path delivered messages256,258,257. The client reached7552
steps with controls drained. The fresh next capture visibly shows Stronghold
Crusader, Crusader, Historical Campaigns, Castle Builder, Multiplayer, Custom
Scenarios and Demo V1.1.

The unchanged menu patch at(190,344),220×30 expects
`af17c4f3210918760eb2fb7fac479fd40d6ef68f6d0c976d9bd46ca493903073`;
the new capture hashes to
`bc70b3603ff1d98602c803d4848170a0c77c8fdb90febd5564837e5b235fd6bb`.
Compared with the actual historical menu reference,29 pixels differ, with464
maximum-channel error. I personally reviewed the `unknown` capture as that
visible menu; the receipt preserves the classifier's `unknown` result. The
original title driver then failed with `first unexpected title transition:
unknown`. No guard, review, readiness or scene label was overridden, and no
retry or hot modification occurred.

118 consecutive complete64-step ACKs reach7552, and all1038 actual served-file
pins match. Pre-first-script owning observer installation is retained; no Custom
Game attachment qualification or callback history is claimed. The original
slot0/endpoint1/thread1 requirements, navigation16384/route4096/arrival3072 caps,
original balanced543292 Custom Game gesture, exact historical-shell RGBA check,
first plus at most3 further256-step input-free samples, and scene20/fault/cap/
deadline stops remain unchanged and were not reached by this attempt.

Chrome825114 exited0 normally at17:39:39Z, Node825046 exited, and HTTP41277 refused
a fresh connection. The local lock was released, and the board notified the MDK
worker at17:39:55Z. The old cleanup field `boxLeftRunning` is legacy; the separate
local closure proof records box ID/state/expiry **NA**, no surviving local PIDs,
and closed HTTP. No remote boat/API/box SSH, allocation, deployment or box
lifecycle action occurred. The coordinator owns future boxes/shutdown.

## Validation and handoff

Focused tests exercise the real rejected and original PNGs, exact historical
intermediate recognition, shifted/cropped/wrong-scene/nonopaque negatives, and
the actual original title helper's review/freshness code. They verify that bad
review, changed tick, foreign Worker target and changed game pixels reject
before Enter; the accepted path reaches the original Enter call. The actual
new run title is accepted offline and its new menu blocker remains closed.
Local contract tests include29 negative contracts, a real foreign process,
actual composed-entry guards,30-helper compilation and unchanged caps. Owning
observer executable fixtures pass on both modules. The locked full build passes.

Git SHA plus relevant binary diff and owned new-file patches preserve source;
no source/media/module snapshots or tars were made. The original driver's close
snapshot held duplicate run evidence only: every file was verified against the
canonical browser directory, its manifest retained, and duplicates removed.
The closed Chrome profile was removed. Small SHA/size seals preserve unique
logs/captures and module/media path/hash references.

Next concrete prerequisite: repair the demonstrated original main-menu visual
recognition mismatch offline before a separately authorized fresh attempt.
This assignment stops at that first actual onward blocker after publishing the
tested title repair. No gameplay claim is made.
