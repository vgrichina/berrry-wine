# Return Fire bunker calibration: blank capture terminal

**Correction (2055 investigation):** the retained command5 PNG is byte-identical
to the jeep-info PNG and independently decodes to a visible game window. The
blank model-review presentation contradicts the captured bytes. The historical
terminal decision below remains recorded, but guest window disappearance is
not established. See [the causal boundary investigation](20261109-return-fire-jeep-blank-transition-cause-2055.md).

Run: `scratch/runs/20261109-return-fire-bunker-entry-jeep-2045/`.
Tested Git SHA: `a5f4d260838790605c1c0d62acc046884eeaf7fd`.

Bunker entry and jeep flag retrieval remain **unverified**. Calibration stopped
at the first visible rendering failure: the returned screenshot after native
Right in the jeep information screen contained only the teal desktop background.
No game window, vehicle or movement-mode panel remained visible. The returned
state still reported a running original guest with no trap. This establishes
an unusable reviewed frame, not its cause, persistence or an emulator defect.
No production code was changed or causal repair claimed.

## Calibration and terminal boundary

Read CLAUDE.md and armored-flag1940. Shipped RFIRE.HLP documents per-vehicle
screen/vehicle movement mode, changed with Left/Right in vehicle information;
entry requires driving over the bunker until its light comes on, then pressing
a fire key. The jeep's directional beacon is distinct from entry confirmation.
Original media paths, sizes and hashes are retained in
`source-media-references.json`; short help excerpts and the home/road plan are
retained without copying the game media.

One native fixture passed before exactly one original launch. Seven original
captures were returned and model-reviewed in separate calls before subsequent
input. The six acknowledged commands opened Play, viewed/closed the A1 map,
selected the lower-right jeep with S, opened information with K, and pressed
native Right for 100 ms. `review/jeep-selected.png` separately shows selection;
`review/jeep-info.png` shows the jeep icons, grenade rows and bright left
vehicle-relative panel. These are not field movement evidence.

Command 5 (`jeep-screen-mode`) acknowledged successfully, but its separately
reviewed `review/jeep-screen-mode.png` was blank teal. It was treated
conservatively as the first visible failure. There was **no subsequent input,
capture, retry or quit**, and no guard or deadline was relaxed. The jeep was
never deployed. Entry light, underground return transition, actual movement
mode, flag exposure in this fresh original, pickup and return were not reached.
No helicopter attack or long armored attack was attempted.

The next investigation must explain the blank capture at native movement-mode
selection before resuming near-home entry calibration. A single frame cannot
distinguish transient repaint/compositor state from a persistent render or input
problem. This run does not justify a speculative shared-provider change.

## Source and validation

All 698 runtime inputs were independently compared with armored-flag1940;
providers, both compiled modules and original media matched, with only seven
run-local path substitutions. Relevant working-tree and provider-history diffs
were empty before pins. The actual recovered guest module SHA-256 was
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
`runtime-pins.json`, `relevant-source.patch` and `run-inputs.patch` retain exact
source identity and small run-specific inputs; there is no source/media archive.

Tracked composition fixture: 33 cases pass; collector: 129; native keys: five;
lifecycle: six; `flock /tmp/wine-build.lock bash tools/build.sh`: pass.
Routine offline lookup errors and a corrected lifecycle-test invocation missing
its output-directory argument are retained. The final audit verifies six ACKs,
seven captures and all 58 required original response bodies against consumer
completion SHA/size. It does not turn those checks into gameplay success.

## Closed lifecycle

Fresh box `bx_p7b6wwek`, UUID `a3a3df08-526c-40bb-8832-06d1cacfe525`, initial
expiry `2026-11-09T21:08:14.092Z`. The immutable independent watchdog was prearmed
and observable before creation, with deadline `2026-11-09T21:08:13.170243Z`.

After the terminal frame, read-only cleanup closed Chrome normally (exit 0,
no signal), then terminated the owned driver. Its actual parent wait returned
`-15` with separate stdout/stderr EOF. Driver/Chrome processes, both ports and
the browser profile were independently absent. This was cleanup, not guest quit.

All 138 unique-evidence references were retrieved with content deduplication
(113 retained paths), independently reread for SHA-256/size and checked for PNG
CRC/decompression **before** exactly one delegated normal unforced stop.
Final independent API state: **archived**, `archiveAfter: null`; no separate
`expiresAt` field was returned. Receipt `stop_19ec2c8bedbc4a5d` completed with
`forced: false` at `2026-11-09T20:47:00.318Z`. The actual watchdog wait returned
0 with separate stdout/stderr EOF, and its supervisor joined/reaped it. No box
was deleted or resumed. Free disk on /home stayed above 1.5 GB.
