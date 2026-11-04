# Deus Ex blank world: capture ownership/freshness is the first unmeasured boundary

**No production rendering or input defect is proved.** The demonstrated driver
defect is that visual readiness can be approved without establishing which
renderer publication the PNG contains. A run-only repair now binds approval to
the latest capture, checks the owning actor Worker and visible process-owned
world window and displayed DOM canvas, records publication/input boundaries, and rejects stale, pending,
crossed or missing-owner evidence. It is tested offline against the exact
historical JavaScript contracts and the recovered driver's actual capture and
approval branches. These tests do not reproduce the live teal failure or prove
that input reached an engine tick. Another gameplay attempt is not authorized
by this result.

Evidence and executable repair live in
`scratch/runs/20261104-deusex-blank-world-cause/`. Existing captures, modules and
logs are referenced in place, not copied. Inputs are the feasible-region note
published at `fade2000a`, the supported-native-route note at `5f12207f`, and
`scratch/runs/20261104-deusex-feasible-region-native/recovered/`.

## Earliest observed divergence

I personally viewed `04-restored.png`, `05-left1.png`, and `06-left2.png` in the
recovered directory. Restored and firstpulse show the same crate room, ceiling
light, crosshair, health display and inventory HUD. Secondpulse shows a teal
application area with the world and HUD absent; the surrounding toolbar and
runtime log remain. This is invalid world evidence. Color does not identify its
cause or prove that the game rendered a teal frame.

| Boundary | Retained observation |
| --- | --- |
| Load/readiness | One Enter restores count14; actor sample at 04:00:44.678Z, screenshot/state completes 04:00:44.782Z; ACK3 at .783Z |
| First Left | Trusted down/up 04:01:05.349–.375Z; requested25ms, hold26ms, operation28ms; settled native response zero; valid image/state at 04:01:05.898Z; ACK4 at .899Z |
| Second Left | Trusted down/up 04:01:18.542–.568Z; requested25ms, hold26ms, operation28ms; actor sample at 04:01:18.981Z; invalid image/state at 04:01:19.037Z; ACK5 same millisecond |
| Stop | Invalid-image finding retained at 04:01:20Z; command6 at 04:01:35.583Z contains only quit |

The first zero native response precedes the first invalid image. The earliest
**observed** visual divergence lies after the valid firstpulse image and by the
secondpulse image, not necessarily at second keydown. There is no intervening
frame history. Actor sample and screenshot are sequential operations, not one
atomic world snapshot. State timestamps bound screenshot completion, not guest
frame generation. Both pulses retain exact location
`[7026.70458984375,-1707.887939453125,109.60284423828125]`, yaw250640,
Physics1, BaseSmall0 and velocity0. Instruction pointers differ across these
samples, and observer timers advance; this excludes a literally identical
serialized sample being replayed, but does not prove engine simulation/render
progress or that the observed actor is the viewport's current actor.

Six matching terminal ACKs complete, maximum6 steps, held keys empty.
All14 trusted DOM events balance. These establish driver completion and browser
event delivery. They do not establish event dequeue, shared key-bitmap reads,
simulation consumption, window ownership or presentation completion. The only
ArrowDown selects Load in the menu. No Down preparation, Up, Space, second
Load, guest write, save/export, correction or guard weakening follows.

## Exact historical contracts, not current-main inference

Retained canonical module: 1,898,260 bytes, SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`;
companion ABSENT in retained before/after checks. Source recipe remains Git
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus nine-file patch
`scratch/runs/20261104-deusex-supported-stack/historical-source.patch`, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
`retained-audit.json` verifies the recovered module, all52 recovered unique
files against their final manifest,453 manifest entries, ACKs/events and the
exact hashes of six relevant JavaScript files against provision pins. This is
local verification of retained evidence, not a new remote453-file inspection.
The historical patch changes nine WAT/API files; it does not change these JS
contracts. Its DirectDraw hunk changes attachment matching by creator version,
not capture ordering or keyboard timing. No module rebuild/substitution occurs.

The recovered `capture()` does exactly: owning-Worker actor sample →
`page.screenshot()` → page state. Its page state includes isolation, threads,
guestWorker existence, DOM events and log text. It records no renderer/window
identity, frame/write sequence, pending dirty state, active slice depth, queue
delivery or key-state publication. Its old capture test only checks this order
and screenshot-error propagation. `approve-ready` checks native support and the
hash of any named inspected PNG; it does not require the latest capture or a
new committed frame. That is a demonstrated observer/readiness defect, not
evidence that it caused the teal pixels or zero motion.

In the exact historical source:

- `lib/renderer.js`: `_workerPublicationHeld()` follows executing Worker slice
  depth. `repaint()` defers while held; `_repaintOnce()` composites the window
  stack; `_presentDisplayCanvas()` selects direct/filter presentation. The
  compositor can draw an empty desktop when no appropriate window is in its
  visible stack. Neither stack nor branch was recorded live.
- `host.js`: `_presentWanted()` includes DX dirty/lock-deferred/shared dirty and
  scheduled/deferred repaint. Presentation can await rAF or a slice boundary.
  A successful CDP screenshot is not a host presentation fence.
- `lib/renderer-input.js`: physical state and queued async message state are
  separate. `handleKeyDown/Up` enqueue; `takeInput` delivers. Unlike mouse
  releases, keyboard releases have no minimum-frame hold. Down/up can drain in
  one pump; a later physical-state read can see up. This is a possible boundary
  under a26ms hold, not a demonstrated failure or permission to extend it.
- `host.js` `_workerKeyBitmap()` and `lib/guest-rpc.js` `get_key_down_state`:
  the page publishes physical key bits; Workers can answer locally from that
  bitmap or cache while the appropriate event state is open. Renderer getter
  counts therefore include publication and DOM work and miss local Worker
  reads. They cannot be called guest-consumption counts.

The console has startup resource404s, normal thread creation, the startup
thread's recorded exit, and C++ throws while opening Load **before the valid
restored image**. No new console error identifies the later visual boundary;
the last retained entry is an asset-cache message at 04:00:27.699Z. Absence of
a pageerror file is not proof that every Worker/render endpoint was healthy.
Worker identity enumeration selects original slot0/tid1 and records the three
remaining guest Workers. It identifies the memory observer; it does not tie
the screenshot's visible surface to that actor or prove ownership stayed live.

## Tested minimal repair and executable handoff

The new `boundary-observer.cjs` wraps existing JS endpoints, forwards arguments,
receiver, return values and exceptions, and records only successful completed
composite/display calls, window/process ownership, pending flags, bounded key
dequeues and bitmap transitions. It reads shared DX dirty/lock state through
the original broker. It calls no guest export for painting/input and does not
force repaint, inject events, consume key press bits, pause/freeze, change a
clock or edit guest memory. The capture helper additionally reads the selected
Worker's slot/tid and actor before/after the single screenshot.

`prepare-driver.py` generates `recovered-driver.patch` and optionally the
executable driver from the exact recovered driver. To prepare a later
authorized run (do not launch it as part of this offline task):

```sh
python3 scratch/runs/20261104-deusex-blank-world-cause/prepare-driver.py --output scratch/runs/20261104-deusex-blank-world-cause/next-driver.cjs
```

Stage that generated driver as the run driver and the two new `.cjs` helpers
inside its existing `feasible-evidence/` directory. Reuse the predecessor's
remaining helpers and original runtime/media/save/config/binding pins unchanged.
The helpers use Node/Puppeteer already required by the original driver; there
is no new browser dependency or production asset to install. The driver loads
`OUT/capture-boundary.cjs` directly, so the new observer does not alter the453
HTTP/runtime pins. Record the new driver/helpers separately as run inputs.

Every capture writes `*-boundary.json`; the existing actor, PNG and state files
remain. Capture invalidates visual approval. `approve-ready` requires the latest
capture/hash plus successful boundary qualification and the original native
support check. A fresh publication, consistent owner and unchanged publication
counter across screenshot are necessary; a pending/held publication, old frame,
crossed publication or absent owner rejects approval. One PNG is retained even
when unqualified; no automatic screenshot retry or gameplay follows from that
failure. Existing human PNG inspection is still required. This conservative
gate can reject a valid busy frame: it must not be relaxed simply to obtain
another pulse. It does not synchronize browser compositor timing or establish
actor/viewport identity; those remain live observations.

Focused checks pass:33 boundary cases, including actual historical repaint and
input methods executed in Node VM fixtures; generated-driver syntax; actual
repaired capture/approval branch with fresh acceptance and stale/pending/missing
owner rejection; original queue/timing tests and retained evidence checks.
Fixtures demonstrate coverage of the observer boundary, not rendered pixels,
input consumption or live causation. Initial fixture failures (missing original
region-map dependency; approval-branch extraction/context errors) were corrected
in the offline tests only and retained in `prerequisite-failures.json`.
No production code changed, so no production build was required.

## Remaining discriminating live observation

For the next original attempt, retain these observations **before approving the
first preparation pulse**, then around its single postpulse capture:
the live world hwnd/process and owning Worker/actor, last completed publication
and its window surfaces, pending/held/DX state, actual key queue delivery and
published Left-bit transitions. If the world owner disappears, distinguish
window destruction/visibility/process replacement from a wrong observer. If
the publication does not advance or is pending, retain that boundary rather
than treating screenshot completion as a new frame. If an unchanged owning
surface is committed and the PNG still loses the world, investigate that
surface/display path. Even then, a teal committed frame alone does not prove
why rendering failed. If published Left changes but native motion stays zero,
the remaining missing observation is the owning Worker's actual local key query
and engine tick/viewport state during the hold; page counters cannot supply it.

This task makes those initial observations executable but cannot reconstruct
them retroactively. Stale/pending presentation, missing/wrong owning endpoint,
genuine guest/render failure and an unobserved short-pulse input interval remain
competing explanations. No geometry, point/duration chase or gameplay success
is claimed. No browser/heavy CLI/game, remote access, allocation, resume or
lifecycle operation ran. No box is assigned; bx_dzkgnet6's last retained state
was RUNNING/APIidle, expiry2026-11-04T04:42:08.886Z, with coordinator owning
shutdown. Its current state was not queried. Immutable count14 and original
guards remain intact. This single task ends after publication.
