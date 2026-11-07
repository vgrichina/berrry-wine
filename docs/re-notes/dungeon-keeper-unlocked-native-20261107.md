# Dungeon Keeper automatic native motion without Pointer Lock, 7 November 2026

The native motion helper's unconditional Pointer Lock prerequisite was too
strict for the production automatic input path. It now permits bounded trusted
CDP motion when the unchanged automatic selector does **not** request capture.
A real production `dx_ddex4` guest consumed eight useful small moves without
Pointer Lock. This qualifies the input prerequisite, not Eversmile gameplay.
No original runtime was started; predecessor `8bc0f49cd` and archived box
`bx_mp72p7pt` were not replayed or touched.

Evidence is in `scratch/runs/20261107-dungeon-keeper-unlocked-native/`.
The source base is `50186e0b0733a0e08b04a74f8320380de97b22e2`, plus
`relevant-tracked.patch` and `relevant-new.patch`. Small run-specific helper
recovery is `owned-helpers.patch`. `source.json` references existing media by
path, length and SHA-256. There are no source/media archives.

The cause is established at the browser input boundary. In
`lib/browser-input.js`, `wantsRelativeMouse` passes `'auto'` when the app has no
explicit relative profile. `canvas.onmousemove` suppresses unlocked input only
when that selector returns true; otherwise it passes the mapped absolute point
to the normal renderer. `requestGuestPointerLock` also requests capture only
when that selector returns true. `lib/renderer-input.js` selects capture for a
recent recentering loop or acquired exclusive DirectInput mouse, with a 250 ms
hint cache. Hidden cursor, clipping and a guest's private relative-mode flag
are not capture signals by themselves.

The unchanged sample has no relativeMouse profile. Passive observation of the
actual production selector recorded `'auto'`, false, no recentering run and a
false capture hint. Its trusted center move and click reached the normal guest
consumer, with no lock request needed. The old helper then failed
`own released Pointer Lock required` at **14:51:05.019Z**, before sending any
motion. `before/` preserves that failure, its three trusted native anchor
move/DOWN/UP events, balanced release and empty final queue. This is a helper
admission defect; there is no evidence justifying an emulator input change.

`tools/dungeon-keeper-native-motion.cjs` now checks the production selector at
the physical anchor and before every proposed step. Unlocked input requires
an absent profile, false capture intent, a released mouse and the observed
native anchor. It refuses capture intent, lock changes, native-anchor changes,
geometry changes and coordinates outside the guest picture. The existing
locked path remains supported. Steps retain their bounds (1–32 steps, maximum
eight physical CSS pixels per axis, 20–100 ms intervals, nominal duration at
most three seconds, five-second dispatch deadline). Unlocked deltas describe
physical CSS pixels; the production bridge and presentation transform decide
guest coordinates. They are not injected guest counts. The diagnostic anchor
is saved before refusal so an original with different capture intent retains
its exact selection rather than silently taking another path.

`final/` qualifies the final exact implementation. I personally reviewed its
startup, anchor and motion-one immutable owner-scoped captures: red sprites on
a blue checkerboard with a white F12 caption. Two successive commands each sent
four trusted `(2,0)` mousemoves at 40 ms nominal intervals. Native coordinates
continued from `(352,434)` through `(368,434)` without a reset. The real
`renderer.takeInput` consumer returned all eight WM_MOUSEMOVE events for HWND
65537 at X **321,323,325,327,329,331,333,334**, Y=240. The difference from two
guest counts reflects the unchanged 684 CSS pixel presentation of a 640-pixel
canvas. Final Pointer Lock is null, profile absent, buttons zero and queue
empty. Consumer instrumentation calls the original once and returns its event
unchanged; there are no programmatic renderer input calls or guest-memory
writes. `after/` preserves the earlier successful revision; the final revision
only additionally saves capture-selection diagnostics before a refusal.

`final/native-controls.json` confirms stale/wrong-owner admission had zero
effects, wrong numbered ACK and UNKNOWN movement became sticky, and later
requests on those lanes were refused. Its independent UP was armed before
DOWN, attempted after 60 ms and acknowledged before a deliberately delayed
DOWN ACK. The main lane has exact numbered ACKs 0–3 (anchor, two motion
commands, quit); the anchor click also armed UP before DOWN. All 22 live
identity comparisons, reviewed-pixel hashes, timestamp-before-readback
freshness, live module checks, natural publication and terminal behavior stay
unchanged. No accepted PNG fixture matrix was repeated.

Focused native-motion tests cover bounds, successive physical anchors, locked
and automatic unlocked input, capture-intent refusal, explicit-profile refusal,
lock transitions, geometry changes and unexpected native motion. They and the
existing browser lock gate, automatic detection, relative latch and relative
input tests passed. The required `flock /tmp/wine-build.lock bash tools/build.sh`
passed for the final code (`build-final.log`). Executing guest/page module
SHA-256 is `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
`runtime-pins.json` retains the predecessor dependency/media closure, updated
owned helpers and the successor launcher; all 168 original media pins remain
unchanged. Final verification is recorded separately from the native baseline. The successor
driver enables the same passive selector/consumer observer for an original as
for the sample; the exact tested driver is recoverable from
`tested-browser.patch`. This last harness-only change was syntax/pin checked
without launching another guest.

All three local Chromes exited with code zero. Browser/server PIDs, debug/server
ports, profiles and writer locks were checked absent, with input released.
The successful `after` and `final` command sessions reported exit 143 after their retained
`TERMINAL ordinary completion`, normal Chrome close and exact quit ACK; the
cause of those outer session statuses is unknown. This does not establish a
browser failure or justify replay. Terminal custody is recorded independently.
Sampled free disk remained above 2 GB; no continuous guarantee is claimed.
The global evidence checker still reports the unrelated preexisting Alice
containment error and historical missing artifacts; the owned evidence
validator passes. Box ID/state/expiry are **not applicable**: none was assigned, created, resumed
or stopped; there is no box lifecycle ownership to return.

The next authorized original must first inspect the recorded automatic
selection and consumed native samples. The predecessor's guest flag at
`0x51b674` being 1 does not prove that host automatic capture was active. Its
lower-right software cursor after a single absolute anchor jump is consistent
with the documented guest delta interpretation, but the exact capture decision
was not recorded there. If the original reports automatic capture intent true
without lock, this helper deliberately refuses: trace the real recenter/hint
and request/lock/error sequence next. Do not force a profile, bypass the gate,
replay UNKNOWN input or infer gameplay from this sample.

An executable successor recipe is retained as `original-successor.cjs` in the
run. It verifies every SHA/length pin and the disk prerequisite by default,
and launches no original during verification. For a separately authorized,
already assigned deployment, stage the listed pinned paths individually at
their relative locations, together with `runtime-pins.json`; do not archive
source or duplicate media as evidence. In that deployed root run:

```sh
R=scratch/runs/20261107-dungeon-keeper-unlocked-native
node "$R/original-successor.cjs" --verify
# Use the assignment's immutable absolute deadline, bounded by its box expiry.
node "$R/original-successor.cjs" --launch "$BROWSER_DEADLINE"
```

The launcher clears fixture-only environment switches, uses the unchanged
`dungeon_keeper_demo` route, leaves box lifecycle to the coordinator and never
reuses an existing `original/` directory. Operate from another shell using the
retained `request.cjs`, with a unique ID for every command and personally
reviewed current immutable pixels. To anchor, use a reviewed ordinary click
with independent release; do not assume it acquires lock. Then issue bounded
`motion` steps with `review`/`reviewRef`, `label` and `waitMs`, as in the retained
`final/commands/1.json` and `2.json`; use newly reviewed original pixels and a
safe point rather than copying the sample's point. Inspect the helper's saved
anchor/selection and actual consumer evidence before interpreting progress.
Finish through a unique `quit` command, verify custody, and hand the assigned
RUNNING box back to its coordinator. This task does not authorize that launch.
