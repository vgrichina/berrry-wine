# Redline menu click: relative-input boundary — 2026-11-09

**Offline causal boundary; no production fix justified and no Training success.**
The1120 command really sends the pictured Training Levels CSS point, but
`pointerLocked:false` does not establish that absolute mouse motion reaches the
guest. The1105 helper's unlocked branch chooses ordinary absolute delivery on
that condition alone. Its previous generated-service controls proved CDP
submission, not the downstream browser/renderer path.

Personally inspected1120 `review/menu.png` shows Start Up, Training Levels at
CSS481/538 and the software cursor over highlighted New Game. The resulting
`review/training-selection.png` shows the campaign grid, cursor over Stadium
City. The mouse receipt records trusted unlocked move481/538 and DOWN at
11:10:19.770/.771Z, pointerlockchange at.771, and locked UP at.921; no intervening
movement. The hold receipt retains150ms and independent release. These facts
are unchanged; ACK2 does not prove Training selection.

## Production path and missing native fact

`lib/browser-input.js` `canvas.onmousemove` calls `wantsRelativeMouse` before
forwarding hover. When true while unlocked, it drops that absolute move.
`redline_demo` has no explicit relativeMouse registry value, so the bridge
consults renderer auto detection: recent repeated guest SetCursorPos or a
cached exclusive DirectInput acquisition hint. Neither actual auto signal,
cache value, transform nor guest software-cursor state is retained at the
Training move. The subsequent automatic lock request establishes relative
intent at DOWN, not an observation of the immediately preceding hover branch.

DOWN requests lock and calls `renderer.handleMouseDown`, which publishes the
button and updates the renderer's Win32 cursor. It does not generate DirectInput
axis motion. Acquisition suppresses locked motion until release; there is no
such motion in the receipt anyway. UP uses the renderer's virtual cursor and
balances the physical button. Setting that Win32 cursor does not establish the
position of a software cursor maintained by guest DirectInput polling.

Thus there is a concrete sufficient mechanism for the mismatch: the move can
be suppressed while DOWN still reaches a software cursor left over New Game.
The retained native evidence does **not** prove that mechanism actually fired,
or identify whether recentring, DI acquisition, their cache, or guest input
consumption caused the native result. Removing the prelock gate would reintroduce
absolute displacement into recentring games; changing buttons, adding synthetic
DI displacement, or writing a guest cursor is not justified by these facts.
No renderer, bridge, helper, registry, host or WAT change is made.

## Supported ordinary delivery, with its prerequisite explicit

Starting from a **fresh reviewed Start Up capture that is already locked**, the
existing ordinary route is small relative motion (`dx:0,dy:24`, within24-count
limits), capture and review, then a150ms `cursorOnly:true` click only when the
pictured software cursor is actually over Training Levels. Each motion needs a
new review; no count-to-menu-position mapping is assumed. The click reuses the
last submitted CDP point, introducing zero extra displacement. This describes
delivery support, not a proven way to reach Training.

There is no retained supported way to obtain that locked Start Up prerequisite
without a possibly consequential first button press. This task does not invent
one, execute an alternate menu/fallback, reuse the failed campaign grid, force
lock, or claim a complete successful native route. A future native attempt must
first resolve that acquisition prerequisite and pass the whole actual fixture
before original. Native lifetime remains REVOKED.

## Offline checks and evidence

Evidence: `scratch/runs/20261109-redline-menu-lock-transition-repair-1140/`.
`routing.cjs` runs the actual1120 generated execute/send definitions and real
transport/menu/mouse/relative helpers into the production DOM bridge and real
renderer handlers. Only DOM/CDP services and guest exports are fixtures; no
browser, box or guest is started. Fixture setup uses ordinary renderer input
and public guest SetCursorPos controls, never private guest-cursor writes.

Five controls pass: unlocked auto-DI and recentring suppress absolute hover
and yield DI axes[0,0] despite a balanced button pair; the absolute control
produces real DI motion; locked relative motion produces[0,24], then a fresh
review and cursor-only click add zero displacement. The locked click control
also passes. This reproduces the source routing boundary, **not** native menu
consumption. There is no production oldFAIL/newPASS claim.

Twelve existing actual-generated controller/transport/helper controls pass,
including review/current-lock admission, locked absolute refusal, unlocked
relative refusal, bounded wait, both lock transitions, independent UP after
DOWN failure, sticky first failure and no later input/capture after failure.
Six focused suites (menu selection, lock gate, latch, auto detection, relative
input and clip-edge counts) and `flock /tmp/wine-build.lock bash tools/build.sh`
pass. The final-ready/successful SystemExit(0) guard and whole-fixture-before-
original requirement are untouched; prior proof references are rehashed.
Git base, relevant production zero diff, small new-input/note patches, file
hashes and retained evidence references are recorded; no source/media/module
archives or copies. Free home remains above1.5GB.

No box created or contacted. Prior1120 bx_zmrpm83m / UUIDdf8a2f5b-3eb8-4ff7-
9ccd-3abb0165c5ec remains retained UNCONTACTED: ARCHIVED/PHYSICAL_DRAINED,
stop_55ad83ebff98fc33, initial expiry2026-11-09T11:31:58.731Z; no new stop receipt.
No agents/workers/deploy or shared-client/custody/Q2/Q3/hostWAT/HeroesII/Claude
edits. Concrete blocker: no observed relative-mode/software-cursor state at the
native move and no proven safe locked-Start-Up acquisition route.
NativeREVOKED; all-writers/edict ABA UNKNOWN. SingleTaskSTOP.
