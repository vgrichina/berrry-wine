# Q3 menu: explicit relative caller, production routing unchanged

The offline controls demonstrate a caller protocol mismatch: a repeated
absolute click is not a relative cursor correction. No production input bug
was demonstrated. The new opt-in caller sends explicit bounded mouse counts
through the production `renderer.handleRelativeMouseMove(...,{guestCounts:true})`
entry point, then sends native CDP DOWN/UP without an absolute pre-move. It
does not write a guest cursor, menu index, button callback, configuration or
guest memory. Ordinary commands keep the original native mouse implementation.

The actual1345 evidence remains menu-only. Historical pointer-lock state,
movementX/Y, guest polling and menu selection were not recorded sufficiently
to prove its cause. The corrected caller is executable and tested offline;
it is not a claim that NEXT or world gameplay succeeded natively.

## Exact original observations and source review

Reviewed `ba66d97b22ede3e2cf626c13ea4bcb387f3127b4` and authenticated retained
actual1345 command3, mouse receipt and state through their SHA/size/gzip CRC.
The final PNGs remain `c8cdcb5e8843dfcb4e8f781f6818fe8519657271217af2c0373070438376dc08`.
The canvas backing store is640×480; its CSS rectangle is
left0/top34/width945/height855. Both arena-fight and server-next request
point[0.9,0.86], producing exactly(850.5,769.3) CSS pixels and150ms holds.
This is a point on the displayed NEXT artwork, not proof of guest hit-testing.

The production `lib/browser-input.js` suppresses absolute movement while an
explicit relative profile awaits capture, consumes movementX/Y as counts when
locked, and routes locked buttons at the virtual renderer point. Q3 has
`relativeMouse:true` in `lib/apps.js`. The renderer carries relative motion
into both the process-shared DirectInput state and the Win32 event queue.
`host.js` publishes its point to the broker; `lib/guest-rpc.js` serves that
point to the Worker. These files, the renderer constructor and native-mouse
source match their actual1345 pins and were executed without editing them.

The offline test uses the recorded canvas dimensions and a geometry-derived
aspect-fit viewport. In its absolute control the original point maps to
(576,447), inside NEXT. In its locked control a repeated coordinate yields
zero displacement. This distinguishes the protocols without assuming the
historical browser was locked or that CDP receipts prove guest consumption.
The inert DOM seam supplies motion fields; this is not a new native CDP test.

Original `demoq3/pak0.pk3`, SHA256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`, is
referenced in place. `vm/ui.qvm` was decoded in memory, never extracted or
copied:259652 bytes, SHA256
`6903548472c2d95898c71c979304e07fbe966e9db2d22db5d9c1ee4f8ddeb88f`.
Its original mouse export dispatches to instruction4439, adds dx/dy to cursor
words175608/175612, clamps to640/480, then tests active item bounds. The
Game Server NEXT constructor at48431 uses x640/y416, width128/height64,
flags272, id18 and callback47533. The active-menu key path at4375 delegates
to its menu callback or default key handler; successful Enter transport does
not identify the active item. No menu state was manufactured to test this.

The later [id Software UI source](https://github.com/id-Software/Quake-III-Arena/blob/master/code/q3_ui/ui_atoms.c)
and [VM opcode definitions](https://github.com/id-Software/Quake-III-Arena/blob/master/code/qcommon/vm_local.h)
were used to interpret the binary, not substituted for the original demo.
The [CDP protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json)
defines dispatchMouseEvent x/y as viewport CSS coordinates; they are not an
absolute Q3 UI cursor API.

## Executable correction

Offline control (no browser, server, guest game or box):

```sh
timeout 30 node tools/q3-menu-pointer-control.test.cjs \
  scratch/runs/20261109-q3-menu-pointer-routing-repair-1385/new-control.json.gz
```

For a separately authorized future original run, retain the original launcher,
admission, reviewed capture binding, numbered command transport and deadline
watchdog. Set `Q3_MENU_POINTER_CONTROL=1` and add
`--require tools/q3-menu-pointer-control.cjs` after the existing
`--require tools/q3-native-driver-composition.cjs` preload in the retained
browser-run invocation. Include the two new files in that run's source pins.
No lifecycle, custody, ACK, key or screenshot path is replaced.

An ordinary click command may additionally carry `relativeCounts:[198,3]`:

```json
{"id":"relative-next","action":"click","point":[0.9,0.86],"relativeCounts":[198,3],"holdMs":150,"waitMs":1000,"reviewRef":"fresh-reviewed-server","label":"relative-next"}
```

Counts must be chosen from that run's fresh reviewed cursor position; the
example is a small correction toward NEXT from the retained image, not an
automatic selection rule. `point` remains an in-bounds CDP button anchor.
The helper requires the existing lock on the owning canvas, exactly one
running original Q3 and released buttons. An unlocked page refuses before
motion. The original transport still requires a live reviewed capture and
all original timing/ACK checks. Missing lock or failed delivery is terminal;
there is no unlock/relock, synthetic menu, state injection or retry fallback.

## Verification and recovery

The focused test executes the actual composed `executeImpl` command body,
original native mouse source, actual DOM bridge, renderer input methods,
process-shared DirectInput accumulator, ordinary Win32 queue, host input reader,
the exact host publisher block and actual Worker import factory. Browser DOM,
presentation/window exports and unrelated capture/admission dependencies are
inert. There is no replacement menu adapter or authored menu success flag.

Old repeated-coordinate control FAILS the requested displacement with[0,0];
new explicit-count control PASSES with[198,2]. It also proves balanced real
button queue records, ordinary event parity, absolute-coordinate mapping,
pending-capture suppression, unlocked/invalid-count refusal and independent
UP when DOWN never replies. The actual numbered transport preserves its first
failure and refuses later input/capture without an ACK.

The locked build passed:
`flock /tmp/wine-build.lock bash tools/build.sh` under an independent240s
`timeout`, armed before invocation. Existing browser relative-lock-gate and
relative-mouse-input tests passed. The broader `test-worker-api-batching.js`
failed an unrelated dx_trace expectation (extra trailing null in present kind5);
its log is retained. The focused actual Worker mouse-import control passes.
Two offline setup assertions were corrected and recorded: absolute CSS flooring
maps y447 rather than448; QVM code has two zero alignment bytes. No runtime retry.
The verified1305 native fixture/cancellation proof was reused by reference to
`c7a905af4`; no qualification experiment was repeated.

Evidence: `scratch/runs/20261109-q3-menu-pointer-routing-repair-1385/`.
Initial Git base `fdc651cf5f819a917f2e52acad3fbfb19825d110`, small owned-file
patches, relevant source-diff and SHA/size/gzip-CRC manifest provide recovery.
No source tree snapshot, archive, media or module copy. Free/home stayed above
1.5GB. No shared client/custody/host/WAT/Q2/Redline/HeroesII/CLAUDE edits.

New box: NOT_CREATED; ID/state/expiry/stop receipt: not applicable.
Inherited actual1345 box `bx_8w34tbhg`, UUID
`25fdf3f2-f616-4e3d-a301-b9d496c0a624`, was not contacted: retained state
ARCHIVED/PHYSICAL_DRAINED, completed unforced stop
`stop_cc4d683a58df369d`, initial expiry2026-11-09T13:03:57.076Z,
final archiveAfter null, expiresAt NOT_RETURNED. No agents/workers spawned.
Next: only a separately authorized original run can establish guest selection
and world progress using the corrected caller. SingleTaskSTOP.
