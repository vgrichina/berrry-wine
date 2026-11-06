# Aranna inner handler and release consumer, 2026-11-06

One improved original remained at Main Menu after an ordinary balanced click on
the personally inspected Single Player label and balanced Enter. No gameplay
movement or second gameplay response was obtained. The newly measured boundary
is an accepted **frontend selection-down handler followed by a rejected
left-up query and selection clearing**. It does not identify a Single Player
action, and does not demonstrate a documented emulator divergence to repair.
Production source and guest bytes were unchanged.

Run: `scratch/runs/20261106-aranna-inner-transition/`. This extends the evidence
in [complete listener](aranna-complete-listener-20261106.md), published
`73d155b61`, and [menu input](aranna-menu-input-cause-20261106.md).
Retained caller/dispatcher/predicate disassemblies describe guest instructions
as emulator test evidence; dynamic invocation records establish the claims below.

## Actual call and data provenance

`original-transactions.json`, `inner-transition-report.json`, and
`selection-release-boundary.json` retain the complete invocation tree and selected
raw snapshots. Every admitted invocation has its actual return PC and stack
pointer, with its parent still open until all children return.

The click was delivered by the ordinary harness at page point
`(340,355.9936)`, from canvas fractions `(0.5,0.2852)`. That delivery is distinct
from guest acceptance. Actual callback 219 entered WndProc `0x414f7c` with
HWND `0x1000e`, WM_LBUTTONDOWN, wParam 1, lParam `0x00970190` = **(400,151)**.
Callback 243 delivered WM_LBUTTONUP with wParam 0, lParam `0x012c0190` =
**(400,300)**. Both returned at `0x41742e`, SP `0x074ffc98`, EAX 0.
These different actual coordinates were preserved. No cursor repair or
coordinate-causality claim follows from them.

Under down callback 219:

| Invocation | Measured behavior |
| --- | --- |
| 230, `0x41818a` | `left_down`; context `0x074ffd1c`, selected slot at +0x118 initially zero. |
| 238 → 239 | Predicate calls actual inner `0x43b388` on candidate `0x08609d40`. Snapshot of its first pointer, `0x09e0f9d6`, contains **frontend**. Query data at argument+0x0c points to the copied **left_down** string. |
| 239 → 240 | Actual dispatcher `0x43b49e`, object `0x0868cec8`. Its first pointer `0x09e0fa46` contains **selection_down**. Discriminator +8 is 1; binding data +0x10/+0x14/+0x18/+0x1c is `0x004bccac/0/0x090b2bcc/0x004c47c3`. |
| 240 → 241 | Actual indirect call at `0x43b4ac`: data read at `0x0868cee4` supplies target **0x004c47c3**, with argument `0x0868ced8`. Actual return `0x43b4af`, SP `0x074ffa34`, EAX **0x08af0f01**, AL=1. |
| 240 → 239 → 238 | Same result returns at `0x43b3d6`/`0x43a562`/`0x4182e3`, with their respective admitted stack pointers. |
| 230 completion | Returns candidate `0x08609d40` at `0x417a65`, SP `0x074ffb38`; end snapshot shows context+0x118 now **0x08609d40** (serials 2578 → 2728). |

The second indirect site was also exercised in the original: invocation 226,
under dispatcher 225, calls actual target `0x4b9240` and returns at
`0x43b4d5`, SP `0x074ffa48`, EAX `0xffffff00` (AL=0).

Under up callback 243, consumer 244 at `0x417d14` returns 1 at `0x4179b5`.
Consumer 245 at `0x41818a` receives **left_up** and starts with the stored
candidate at context+0x118. The observed conditional edge with fall PC
`0x4181ce` selects `0x4181ce`, rather than its target `0x418241`.
It calls predicate 246 on candidate `0x08609d40`, then inner 247 at
`0x43b388`. The actual query snapshot now contains **left_up**, and the same
object still identifies itself as **frontend**.

Inner 247 returns **0x09c7b100 (AL=0)** at `0x43a562`, SP `0x074ffab8`;
predicate 246 returns that result at `0x418218`, SP `0x074ffae8`. No admitted
dispatcher/indirect child occurs within this specific inner invocation; their
independent budgets remained available. Consumer 245 then selects actual edge
`0x41823d` rather than target `0x41824d`, clears context+0x118 from candidate
to **zero** (serials 2765 → 2801), and returns EAX 0 at `0x4179d6`,
SP `0x074ffb38`. This measures the release consumer, not merely a queued input
or an entry hook.

The actual wrapper target and bound member data are known. Read-only
`actual-wrapper-readonly.txt` shows `0x4c47c3` loading receiver adjustment and
tail-jumping through the binding's first word; `actual-selection-readonly.txt`
shows the `0x4bccac` routine's conditional state reads and eventual AL=1.
The tail jump and those internal branches were **not dynamically observed**.
Their static instructions are not proof those branches ran. The next useful
measurement is the actual wrapper tail jump/member execution and lookup/action
routing from `left_down`/`left_up` to the intended menu button, including the
relevant state reads. Calling the accepted candidate “Single Player” remains
unsupported.

## Observer controls and original review

The run-only observer adds bounded, invocation-owned inner (16), dispatcher
(17), indirect (18), and transition/release consumer (19/20) events, copied
object/argument/string data, and selected conditional edges. Each kind reserves
ends independently of the existing 256-detail quota. It matches actual returns
using PC **and** SP before admitting subsequent calls. It omits the prior heap
and pack diagnostic transformations; allocator/free-list coverage was not
repeated. Imports/exports and the fixed 536870912-byte memory were preserved.

`flock /tmp/wine-build.lock bash tools/build.sh` passed (`build.log`). Generated
ordinaryAPI and actual owningWorker controls passed on **both shipped modules**:
eight baseline/observer cells, four observed routes with **197 complete calls
each**. Types 1–5, both indirect sites, nested returns, transition call, actual
conditional edges and slot clearing were exercised. Saturating the old detail
quota retained the new ends; deleting an actual indirect end was rejected.
Baseline versus observed architectural comparisons preserve GPRs, lazy flags,
live FLD1/FLDPI x87 payload and environment, thread state, real reserve/SEH fault
state, ordinary/buffered mouse input, recenter behavior and normal DLL startup.
Existing proven controls were retained. `controls/results.json` has no errors;
its SHA-256 is `268c7dc929bafb6b59abd6c28e1f585f4d8c83d81f8b0e0c0d61d3551c3d1a68`.

| Module | Shipped baseline SHA-256 | Observed SHA-256 |
| --- | --- | --- |
| standard | `41d3ed6a2b52b46d25550dd54f582c574a7acc48f2024c3e01f878bdafbe470f` | `a84f0a9ab65856b3aa4df6d05d013dd2bd1874e409fe5cee21ce63161758d972` |
| compat | `2c94cba0b6138e51d2d69ed19f938f2cb6abd7b83cd3cc0363ce232119cbaf7a` | `8928e047cf9539d07fa8d15b631963ca22bae7d3a2e23a13a76a2856f4a77156` |

The sole original selected the pinned standard observer and ran approximately
05:46:07–05:52:59 UTC. Ordinary balanced Accept/Escape inputs passed the EULA
and intro; then the inspected menu click and balanced Enter left Main Menu
visible. Personally reviewed captures include `startup.png`, `after-accept.png`,
`opening.png`, `after-intro.png`, `main-menu.png`, `after-single-player.png`,
and `after-enter.png` under `original/`. The last two show Main Menu, without
player gameplay. `terminal.png` was also reviewed: it is the launcher after
ordinary quit, not a gameplay capture. FPS and audio remain unknown.

Normal quit completed with child and Chrome exit 0. The lifecycle fully drained
**3106 rows; 274 starts and 274 matched ends; zero incomplete transactions**.
New kinds admitted 43/8/9/2/2 calls, below each 128 budget. The old broad detail
quota reached 256 before the click as expected; it does not support an absence
claim. No extra original, held retry, guest modification, forced branch, draw
result change, deployment or box was used.

## Reproducibility, scheduling and limitations

The exact tested source is `c26fd774f0add6718228d7ac5d6d6015fb708e0e` plus
`preoriginal-source.binarydiff` and the relevant new-file patches named in
`preoriginal-source.json`. `tested-inputs.json` and post-original closure checks
guard current source, modules, observer/helper dependencies and all **28 existing
media paths and SHA-256 hashes**. Module metadata retains exact transformed
source diffs. Git is the source archive; no tree archive or media copy was made.

Ordered predecessors were KKnD0400 FINAL05:06:29, AoW0410 FINAL05:28:21, and
D3D0430 FINAL05:39:36. Independent cleanup checked 231 absent PIDs, 12 refused
ports, six absent profiles, four free locks and no heavy process. A gate-helper
limitation must remain explicit: its first pass omitted AoW's sixth, run-local
profile and began the locked build; that profile was independently found absent
at 05:41:50, then the corrected complete check passed before controls or browser
runtime. `cleanup-profile-addendum.json` preserves the timing limitation. The
immutable gate **05:41:24.466491–06:26:24.466491 UTC** was not restarted.

An initial observer compile failed on an obsolete inherited pack anchor, before
tests; removing that unrelated diagnostic transformation resolved it. A harness
wrapper initially exited without launching a browser because it lacked main
module identity. `original-harness-attempt1/` and
`harness-entrypoint-correction.json` retain that empty invocation; after fixing
the run-only wrapper, helpers were repinned before the sole original. The
ordinary command deadline was 1200 seconds, longer than the planned 660-second
run and 720-second hard bound; neither timer fired. No guest failed result was
suppressed or altered.

Final cleanup and artifact hashes are retained in `final-cleanup.json` and
`artifact-hashes.json`; `result.json` is written last after review/publication.
No assigned test boxes: ID/state/expiry N/A, with no lifecycle action. The
measured boundary above is the handoff; no production emulator repair is
justified by this evidence.
