# Redline menu caller: CSS jumps became guest mouse counts — 2026-11-09

The original 0955 Training click **consumed `[-303,-231,0,128]` as native mouse
state**, rather than selecting the photographed Training button. The
run-specific click helper always sends absolute CSS positions; after Pointer
Lock the real browser bridge forwards their differences as unscaled guest
mouse counts and routes button events through the virtual cursor. This is a
caller protocol defect. The correction stays in a Redline-only helper and
small run-input caller patch; shared clients/host/WAT/custody remain untouched.

Exact retained caller/helper/browser/renderer/app source pins and six PNG hashes
match. New Game requests CSS `(481.95,326.41)` at rect `(0,34,945,855)`, backing
`640×480`. Trusted events show unlocked move/down, lock acquisition, then up.
Its visible result is the mission chooser. **Its native mouse buffer contains
zero movement and button128**: this success does not validate absolute cursor
placement. Back subsequently requests `(784.35,769.3)` while locked, producing
`(303,443)` counts; `back-menu.png` remains the chooser. Escape returns to Start
Up, but the retained event state is still locked.

Training requests `(481.95,538.45)`. At 09:58:14.758Z its trusted locked move is
`(-303,-231)`, with frozen DOM anchor `(481,326)`. At .761Z the owning original
mouse-state buffer is **`[-303,-231,0,128]`**; subsequent samples are zero motion
with button128, then release0. Guest WM_LBUTTONDOWN/UP at .788/.909Z independently
carry client `(322,225)` (`lParam14745922`); associated nonclient point is
`(325,248)`. Training-result and terminal menu-down PNGs show Start Up with the
game software cursor near the top-left, outside every menu button. Win32 and
private game cursor positions differ and must not be conflated. Exact private
coordinates and original menu handler implementation are unavailable. Down's
three wholly-held VK40 highs/release0 do not establish menu-selection handling.

`tools/redline-menu-selection.cjs` refuses absolute targets while locked. For
an explicitly requested `cursorOnly` click it uses the caller's last submitted
CDP point, preserving **zero displacement**, and reuses the established native
helper's 150ms independent release. Missing lock/position or an invalid hold
fails before effects. A down failure still attempts up and propagates. The
run-input `prepare-caller.cjs` recovers exact Git caller922fae307 and adds only
current lock/last-CDP-position arguments at its existing mouse callsite;
`native-mouse.cjs` connects the new helper. Existing owner admission, freshness,
identity, deadline, input bounds and first-failure terminal gates stay intact.

**Supported ordinary selection recipe:** with a fresh reviewed Start Up screen
and pointer lock, use the existing `relative` action (at most24 counts per axis)
to move the **visible game software cursor** onto Training Levels. Derive each
step from its reviewed hotspot and game-image scale; review progress after each
bounded step. Once the cursor/hover is visibly inside Training, submit
`{"action":"click","cursorOnly":true,"point":[0.5,0.5],"holdMs":150,
"waitMs":1000}` with the fresh review reference and a new result label. The
point is a placeholder; the adapter clicks the last CDP position without moving.
Review the actual Training list before targeting Vehicle Training. Unexpected
cursor motion or any failed/unknown result is terminal. No absolute target jump,
Down fallback, or resumed 0955 stream is permitted. This recipe has not been
native-tested. The initially considered unlocked-only shortcut is explicitly
rejected: zero native motion on successful New Game makes it insufficient.

The composed offline test executes the **actual old/corrected caller mouse
branch with real helpers**: oldFAIL is exactly the unwanted coordinate jump;
newPASS sends move/down/up all at the previous CDP point. Focused refusal/release
tests and real browser-bridge/relative-input regressions pass. These establish
protocol correction, not native Training/world/vehicle progress. The required
locked build passes. Shared free disk briefly falls to1499844608B after build
(below1.5GB); the deviation was reported and later observed restored above
1.5GB. Unique logs are gzip streams; evidence is independently SHA/size/CRC
reread and patches reverse-check. Evidence,
recipe JSON, source recovery and checks are in
`scratch/runs/20261109-redline-menu-input-cause-1010/`. Before any separately
authorized runtime, integrate/re-pin the full unchanged dependency closure plus
new helper/caller inputs and run its required fixture; no launch is performed here.

No box, Chrome, guest, agent, worker or deployment was created: box/state/expiry/
stop = null/NOT_CREATED/null/null. Prior bx_n6m3yphy /
UUID257e096f-24ad-4df8-9520-0d65f924d3c3 remains ARCHIVED/PHYSICAL_DRAINED;
unforced stop_65b7f445cf93d6e8 completed10:01:10.317Z, initial expiry10:17:38.402Z.
Original first actual failure remains terminal. Native lifetime REVOKED;
all-writers/edict ABA UNKNOWN. SingleTaskSTOP.
