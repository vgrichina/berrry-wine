# Deus Ex demo: saved crate footing reaches the adjacent low wood

Fresh ordinary Load of **count8/time01:11:54** restored the genuine
`CrateUnbreakableSmall1` footing. One ordinary jump followed by the remaining
forward movement reached stable footing on the adjacent low wooden BSP.
The new immutable native **count10/time01:14:11** pair preserves that position.
Upper-stack access, exit traversal, ladder use and FPS remain untested.

Evidence: `scratch/runs/20261104-deusex-saved-footing-onward/`. This note follows
`deusex-closer-support-20261104.md` and the shared `deus-ex-demo.md`; neither
previous note was edited. No production source changed or build ran.

## Historical runtime and fresh reload

Created fresh `bx_2uwms7qx` with
`boat --no-update --json new --from deusex-closer-support-20261104 --ttl 3600`.
Identity, expiry and coordinator shutdown ownership were recorded before use.
The old stopped box was never resumed. The existing staging was reused without
rebuilding or replacing its source or module with current main.

Runtime remains Git `a504fa248caaecbbb042b65e9ae5384a340ade26` plus the
nine-file binary diff in the supported-stack run, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
The 458-entry inherited provision manifest was checked, excluding old helper
entries and the deliberately replaced checkpoint copies; all remaining inputs
matched. The final manifest check also verifies both replacement checkpoint
files. Actual executed/recovered canonical module SHA256:
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
Only this module exists in the historical closure. A second compatibility
module was absent, so both-module recovery is not claimed or substituted.
Chrome151.0.7922.108, original SoftDrv/default guestWorker, three original guest
workers and 1024×768 captures were retained.

Copies of the preceding run's read-only `recovered/native-save-export/0.bin`
and `1.bin` were mounted at the exact manifest destinations
`c:\save\save0001\saveinfo.dxs` and `c:\save\save0001\00_training.dxs`.
The original count7, old count8 and new count8 bytes all remain unchanged;
`immutable-saves-after.json` verifies all six original files. No media was copied
into evidence. Current-main WIP was excluded from execution.

Inspected `03-load-dialog.png` displays count8/time01:11:54. Native Enter
restores the unique named JCDentonMale0 at
`(7060.70508,-1711.76660,47.07167)`, yaw212591, Physics1, height43 and zero
velocity (`04-count8-crosscheck-observer.json`). Inspected `05` shows actual
gameplay. Both small crates initially match the previous save's transforms.

Before movement, ordinary Escape → Save Game → Enter produced count9/time01:12:36.
Its whole native VFS outputs are immutable in `recovered/reload-save-export/`.
Read-only original-format decoding in `fresh-reload-native-decoded.json`
independently confirms the exact restored location and
**Base=CrateUnbreakableSmall1**. This checks the reloaded game's support rather
than relying solely on the input save or a screenshot. The observer retains its
typed object array, named Core exports and owning-worker JS/Wasm return-boundary
reads; only its expected checkpoint position/yaw changed, with fixtures rerun.

## One jump and stable wood support

Original bindings confirm C/Z turn right/left, X ducks and V looks down.
The original decoded BSP node8353 (`Brush1741`, cargo01) has a horizontal top
at Z32, a diamond centered near `(6992,-1684)`. Its original vertices and source
path/hash are retained in `low-wood-bsp-reference.json` and `source-record.json`.

| Ordinary action | Observed result |
| --- | --- |
| C800ms, release; Z150ms, release | Stationary crate footing, actual yaw225237 toward the low wood. |
| Hold X500ms before takeoff | Physics1, height16, centerZ20.13181, zero velocity; crouch consumed on the crate. |
| Space+Up220ms; release Space; capture; retain Up500ms; release Up | Sole jump. 21 airborne samples, maximum sampled positive Vz226.85522 and center apex67.12268. The screenshot adds elapsed time to the nominal forward hold; timestamped native events are authoritative. |
| Settle1800ms; then1652ms between geometry samples | Identical `(7030.04102,-1690.93933,52.80000)`, Physics1, height16, zero velocity. |
| Release X; stationary checks and native V views | Standing centerZ79.80000, feetZ36.80000, unchanged XY and zero velocity. |

The trace changes from Physics2 to Physics1 near the end of descent and then
continues forward at crouched centerZ52.8 before stopping. It does **not** prove
that first airborne contact already lay inside the BSP top polygon. The decisive
result is the final stable support, after the authorized jump and forward motion.
The final center is close to the diamond's east edge, not a full-radius inset
landing. Feet remain4.8 above the nominal BSP top; no zero-gap claim is made.

Inspected `17`, `19`, `21`, `23`, `24`, `27`, `31` and `32` establish settled
gameplay, the wooden top and adjacent metal crate. `26` is a transient teal frame
and proves nothing; `27` is the actual subsequent underfoot image. `16` is only
flight evidence. The final native save records Physics1 and **Base=LevelInfo0**,
consistent with BSP support rather than either small crate. The final player is
inside the decoded wood-top boundary and above it, with both metal crate tops
at incompatible support heights.

Small0 changes between the pre-jump and post-traversal geometry reads, from
`(6997.22461,-1707.74158,49.35019)` to
`(6985.17920,-1700.61560,49.35019)`. Its exact movement/contact instant was not
sampled; the changed transform is preserved in the new save. Small1 remains at
`(7061.31006,-1701.65759,-13.14719)`. No pickup/drop, floor-jump replay,
guest memory write, injected game call, teleport, cheat or game/config edit ran.

## Preserved native checkpoint and handoff

Ordinary Escape → Save Game → Enter writes count10/time01:14:11. Whole unedited
outputs and exact original destinations are in
`recovered/native-save-export/{0.bin,1.bin,manifest.json}`, read-only locally
and remotely. The intermediate count9 pair is separately preserved read-only;
later VFS saves did not overwrite either exported pair.

| Native file | Size | SHA256 |
| --- | ---: | --- |
| saveinfo.dxs | 34577 | `0c545c8f1bec6f5f02645f18ca1d9de99d4883a4e62aee49043d289b6803dc41` |
| 00_training.dxs | 3232627 | `088c4cc350e6cdae6471f32d398927448d2e44ecec0df5ec548ad6c964cbfb4b` |

`new-save-native-decoded.json` records count10, saveTime4451, exact standing
location above, BaseLevelInfo0 and both final small-crate transforms. This new
count10 has **not** been fresh-reload tested. Future work should mount copies,
verify its fresh restore, and then measure the next support from the changed
layout; no further traversal was attempted here.

`check.py` passes107 recovered unique files/full SHA256, the actual tested module,
observer positive/rejection and geometry fixtures, count8 fresh-load/native-Base
crosscheck, one positive-Vz jump, stable wood/native-save crosscheck, six unchanged
prior checkpoint files,40 trusted balanced native events,13 sequential completed
requests (maximum14 steps, bound64),21 PNG dimensions and process/port cleanup.
The full browser segment lasted236.197 seconds. The initial copied geometry
fixture still expected count7; updating that fixture to the actual count8 fixed
it before browser launch. A later recovery request incorrectly named nonexistent
export files2/3; the export contained exactly files0/1, which were recovered
without rerunning gameplay. No runtime/game failure or emulator repair occurred.

Browser closed at2026-11-04T01:43:26.231Z; held inputs empty, controller/browser
PIDs absent and port8123 closed. Handed back `bx_2uwms7qx` **RUNNING/idle**,
expiry2026-11-04T02:38:30.273Z, **shutdownOwner=coordinator**. No worker
stop/delete/resume occurred. Runtime source identity, relevant binary patches,
tested helper sources and recovery instructions remain in this run; Git is the
source archive. This worker stops after publishing this note, with no successor.
