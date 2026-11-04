# Stronghold setup render completion: original contract, offline 2026-11-04

The repeated bounded-arrival failures are observations inside original drawing,
not evidence of completed setup. The current helper recognizes two exact partial
images; each newly encountered partial image fails closed. Replacing that list
with a general fade recognizer is **not justified by the retained evidence**:
the observer records scene ownership and setup return, but omits the original
fade amount, direction, timing and draw/presentation completion. No helper or
test implementation changes are made. This investigation supplies the original
cause and the specific missing next observation, rather than another whitelist.

Entry reference: `d5d2e95aaf2d7b05a36e28a9f1e727d3322410c8`,
[predecessor report](stronghold-setup-transition-onward-20261104.md),
[original-game notes](stronghold-crusader-demo.md), and the retained runs below.
Evidence: `scratch/runs/20261104-stronghold-setup-render-completion/`.
All new work is offline: static original-EXE disassembly, retained PNG/report
inspection, pure arithmetic checks, mock transport tests and the required build.
No browser, original executable/game runtime, box, heavy runtime
lock, worker, deployment, asset/clock/configuration change or new gameplay run.

## Original native contract

Addresses below are original guest VAs, verified against the existing executable:
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
2,699,264 bytes, SHA-256
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
The audit pins 23 instruction byte sequences; disassembly is retained in the run.

* Scene-20 registration at `0x424bb0` passes draw callback `0x4292c0`.
  The setup routine returns at `0x4292b6`; that is a different completion event
  from the draw routine's return at `0x42a20e`.
* Setup writes refresh flag `[0x175f9fc]=1` at `0x42913b`, fade amount
  `[0x692e18]=32` at `0x42915f`, and direction `[0x690e54]=-3` at
  `0x42916f`. Its `timeGetTime` call at `0x4291c4` stores `[0x6921b8]`.
  Thus setup return explicitly leaves a fade to perform.
* Draw samples `timeGetTime` at `0x4292c7`, then calls background/sprite drawing
  `0x455240` at `0x429301`, before updating the fade. At `0x429313`, a nonzero
  refresh flag skips fade advancement. The refresh path clears that flag at
  `0x4297aa`.
* For negative direction, `0x42932f–0x42935e` subtracts the stored timestamp
  from the **entry** time, applies signed multiply `0x99999999`, high-word
  arithmetic shift by four and sign correction, and adds the result to fade.
  For ordinary nonnegative small elapsed values this is truncation of
  `-elapsed_ms/40`. On reaching zero it clamps fade to zero and clears direction.
  This is the entering setup fade endpoint. The positive-direction branch
  instead increases fade to 32 and clears manager field `[0xd1375c]`; 32 is
  consequently not a universal setup-ready value.
* Crucially, `0x429ae8–0x429aee` samples time again and overwrites the timestamp
  on the normal draw path, even when the preceding fade change rounded to zero.
  This occurs before further updater/text/widget work and the final return.
  The next fade increment therefore uses the gap from this late sample to the
  next draw entry, not total time spent rendering the preceding frame.
  Sub-40-ms gaps lose their residual every draw. Repeating 16/32-ms gaps can
  leave fade unchanged indefinitely; expensive rendering before the timestamp
  refresh does not itself guarantee fade progress. This is an original-code
  mechanism, **not a finding that these actual runs had those gaps**.
* Drawing is composite. `0x4293cf` passes fade to `0x46a880`; its panel/sprite
  path reaches `0x469a00` and the RGB565 lookup renderer `0x44f6e0`.
  Other subregions use transformed amounts, including
  `32 + trunc((fade-32)/2)` near `0x429403`, `0x429446`, `0x4294f4`.
  A screenshot can interrupt separate background, panel and text operations.
  Arbitrary linear blending of complete screenshots is not an established
  original rendering invariant.

The transition also has an input-feedback consequence. While advancing an active
fade, `0x429321` sets `[0xd138b0]=1`. Widget drawing at `0x4e9ee0–0x4e9ef3`
uses this to clear hover feedback `[0x995674]`. The main loop resets
`[0xd138b0]` at `0x576c56`; a zero sampled just after that reset does not prove
fade completion. Preset hover `0x42d850` needs mode 99 and nonzero hover feedback
to set description `[0x69332c]`. Activation `0x42d880` independently needs mode
99 and no pending preset `[0x69165c]`; choice 1 queues the pending action and
clears native press edge `[0x1bd26a4]`. Updater `0x42db40` checks the native edge
before applying through `0x42e490`. Draw calls the updater at `0x429b1b` only
under the mode-99 gate. Scene 20, callback return, a drained host input queue,
visible text or a description alone therefore supplies no input permission.
Fade completion is a visual transition condition, not proof of those independent
activation/application preconditions.

## What the actual captures prove

Both PNGs were personally viewed. Both show partial/translucent setup panels
over the shield/swords background. The later report's Human/Lord, Deathmatch,
10000/10000 and CrusaderDemo labels are clearer; this does not establish a
monotonic fade sequence across different native histories.

| Retained run | PNG / report under its `browser/` | Final native boundaries / PC | Remaining to 50M |
| --- | --- | --- | --- |
| `20261104-stronghold-quiet-rpc-original-gameplay` | `route-native-boundary-8.png` / `preset-attachment-80.json` | 40,092,338 / `0x44f7d8` | 9,907,662 |
| `20261104-stronghold-setup-transition-onward` | `route-native-boundary-10.png` / `preset-attachment-133.json` | 39,098,384 / `0x45550a` | 10,901,616 |

PNG SHA-256 respectively:
`f48150b6dea1489b67978949eadbd702b8865985648ce57a62e12297778a652d`,
`6e73425ddafb362c96280e2f174e7737ded8b3d8b101d0c2c74a5b48bda93d0c`.
Decoded report-content SHA-256 respectively:
`6b96a5eff33886a7952cb7f3814e8943707415d8f39912966e99eafcf1563107`,
`bca28c6137ab143ffb841ce873754c94a6c887c505e12b7c89c47bb8a0642495`.
Reports are read through the existing retained/gzip mapping; nothing is copied.

The audit binds each capture to its report's own epoch, owner slot 0/endpoint 1,
step count, SHA, monotonic continuous boundary history and preceding ACK. Both
have setup-return followed by callback-return and custom-path completion; in
the onward run those occur at 22,783,070 and 22,789,897 boundaries. Captures have
scene/current request 20, mode 99, manager4 `0xffffffff`, saved 0; manager8 is
142643/144135. Their final ACKs have no queued/active/last input and mask zero.
These are useful ownership/release facts. They contain none of the fade/time
fields above, no complete draw return and no associated presentation fence.
The final PCs are inside different pixel loops: `0x44f7d8` in RGB565 lookup
rendering and `0x45550a` in sprite/RLE copy (`mov ax,[esi]`). Neither is a
completed setup-frame witness. A host ACK/capture can expose ongoing drawing.

Both full retained reports are already `command-failed`, with fault null and
pending empty. Terminal status still prevents another command. They must not
be turned into live prefixes or used as permission to resume. Original known
scene recognition retains precedence; the two partial hashes grant only
`setup-transition-observation`, never setup readiness or preset/Start input.

## Budget result and next observable condition

**It is undetermined whether the unchanged 50M-boundary/360-second continuous
history can reach complete setup.** The retained record establishes neither
success within that bound nor impossibility. The isolated initialized
800×600 render fragment's 1,441,804-boundary cost is not a bound on the actual
remaining composite draws, refresh work, timestamp gaps or input readiness.
Six or seven such fragment costs fitting the remaining space proves nothing
about actual completion. Frozen 16-ms host steps and ACK counts do not reveal
the two native `timeGetTime` samples per draw. No remaining-headroom argument
can replace those samples. The clock must remain original.

The concrete next condition, in a separately authorized original attempt, is a
same-owner, same-epoch, continuously counted observation of actual draw entry,
fade update, timestamp refresh and draw return. Read only `[0x692e18]`,
`[0x690e54]`, `[0x6921b8]`, `[0x175f9fc]`, `[0xd138b0]` at those points, together
with scene/request/mode and existing input/pending state. Record entry and late
`timeGetTime` results so the discarded-residual mechanism can be confirmed or
ruled out. Observe the initialized refresh clearing, subsequent negative fade
updates, then fade=0/direction=0 followed by the complete draw return
`0x42a20e`. Associate the resulting normal presentation and real captured
pixels with that same draw; the precise presentation fence still needs mapping.
A zero input-suppression flag before drawing or a fade value sampled midway
through drawing is insufficient. Preserve capture/ACK ordering, no queued
input, original clock/assets/config, first fault and all existing caps. If that
condition does not occur before the cap, stop with the actual last phase;
do not restart counting, increase caps or assume one more frame will finish.

Only those paired native observations and independently reviewed real partial
and complete pixels could justify a bounded transition observation predicate.
It would still end at observation, with unrelated/mutated scenes, stale or
foreign ownership, terminal histories, wrong temporal order and exhausted
budgets rejecting. Preset readiness/application would need its own existing
review and native checks. This task provides no runtime authorization.

## Validation and preservation

`audit.cjs` checks the actual two partial captures against the original unknown
classifier and current observation-only helper; 14 one-pixel mutations and
three unrelated actual scenes reject. Twenty-four report mutations cover
owner/epoch, fault/pending/terminal status, mismatched pixels/steps/epoch,
nonmonotonic history and missing setup return; two actual terminal enqueue
attempts reject (43 negative controls total). These are evidence-audit controls,
not a proposed general recognizer. Pure arithmetic checks model the pinned
signed multiply/shift: 1,000 alternating 16/32-ms gaps retain fade=32; 32 gaps
of 40 ms reach zero. Those are synthetic mathematical controls, not invented
native traces. Initial audit byte-pin typos were corrected against disassembly;
the final audit passes and the earlier failure log is retained.

`test/test-stronghold-local-runtime.js` passes, including its composed entry,
independent spawn prohibition, zero Chrome spawns, private transport/flock,
terminal/ownership/input/cap/readiness and retained partial-image regressions.
`flock /tmp/wine-build.lock bash tools/build.sh` passes. No native initializer
or game-execution test was run. Exact Git SHAs, relevant binary diff and this
new file's patch are in the run; existing media/modules are referenced by path
and SHA only. No source snapshot, tar, media copy or module copy was made.
Box ID/state/expiry: NA. Coordinator retains runtime shutdown ownership.
