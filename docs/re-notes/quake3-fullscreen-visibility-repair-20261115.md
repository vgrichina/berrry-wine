# Quake III fullscreen/output visibility investigation, 2026-11-15

No general production defect was reproduced. No production correction or fresh
original was attempted. The missing evidence is the preceding original's final
failed fullscreen/output/occlusion operands. Its three-second screenshot UNKNOWN
and compositor cause also remain unresolved.

Evidence: `scratch/runs/20261115-quake3-fullscreen-visibility/result.json`.
The controller and native fixture diagnostics below are tested additions, not a
repair or evidence of menu, arena, frag or native Quit progress.

## Prior original remains closed

The complete retained image was personally reviewed: stone-texture startup,
host consent strip and desktop/debug chrome; no Q3 menu or arena.
`host-fullscreen-observations.jsonl` records a fully visible output immediately
after trusted host consent. Subsequent startup observations report ordinary
damage and held/in-flight paint, then `failure.json` reports
`startup owner/output not live and fully visible`. The final failed visibility
operands were not retained. The earlier body-level touch-cursor overlap cannot
identify that later cause: the existing guard already excludes ordinary elements
outside the actual fullscreen subtree. The production cursor is appended to
`document.body`, outside `#screen-wrap`.

Failure screenshot 1465 became permanent UNKNOWN after three seconds and
produced no recovered pixels. Neither original route was replayed. The measured
native shader status queries are legitimate work and warrant no rendering,
synchronization or deadline change.

## Added diagnostics

`tools/quake3-visibility-controller.cjs` composes the existing controller using
exact, fail-closed source anchors. Every passive page observation includes
selected output and fullscreen rectangles, backing dimensions, ancestor
geometry/styles and client bounds, intersecting light-DOM boxes and their
ancestors, pseudo-element metadata, top-layer elements, five hit-test stacks,
viewport/focus/pointer-lock state and all 256 physical key states. The original
owner receipt remains attached. A Runtime binding emits the operands before the
unchanged readiness predicate can throw. Missing bindings fail closed.

Hit testing supplements conservative painted-box detection because an element
with pointer-events:none can still occlude pixels. No cursor exception is added.
The diagnostic adds no canvas-pixel, guest-memory or GL-state reads and changes
no DOM, production styles, rendering options, input state, capture predicates,
protocol deadlines or independent release behavior. Metadata serialization and
extra DOM/style reads have a scheduling cost; zero perturbation is not claimed.
The only executable mode is synthetic native qualification; there is no original
launch mode in the run recipe.

## Actual qualification

Heavy work began only after explicit StarCraft mission213262 and Sims brush242527
source/build/runtime releases. Their receipts were personally verified:
325 StarCraft waits/PIDs and 29 referenced Sims wait files/87 PIDs, both EOF,
heavyReleased and all recorded processes absent. No worker or box was created.

Six focused tests and the released helper suite passed. Both locked full builds
passed. The current tested shared production module is 2,203,481 bytes, SHA-256
`eb1669a7d065664f8c3f0b3ae5649d9d222721b6c9903c125ef22aa5c21160ea`.
The final native fixture's tested Git HEAD is
`5329f9982bb4b3d926f421feab90d67a5b37ce17`; its exact foreign dirty hunks and owned
new files are preserved as binary patches beside the pins. Production source was
not edited, and unrelated NE/op5 work was neither committed nor adopted.

The final `native-controls-2/` run uses the actual index, CSS, renderer,
interpreter and GuestRPC with a small synthetic PE; no registered game launches.
Current source/module/media/autoimports/TLB/fonts, actual resolved executables,
native libraries, diagnostic compositions and all four historical comparison
sources were pinned before launch. Historical sources are explicit red controls,
never substituted for current qualification. All 119 HTTP responses were audited
(116 successful), source/module/dependency pins had zero drift, and runtime
errors were empty. The first successful fixture's narrower manifest omitted the
explicit Git executable and three historical comparison-source pins; it is
retained as limited evidence and does not replace the final complete run.

The final run retained 385 public operand observations. Actual controls passed:

- Native host consent with independent UP prearmed at a 1,750 ms fallback;
  full fresh consent image personally reviewed before the finite host click.
- Production resize, actual browser fullscreen exit/re-entry, browser viewport
  resize to 900×720 and restore; each settled output remained fully visible.
- Real ancestor clipping refused as `output ancestor clips canvas`; exact
  fixture style restoration restored visibility. Hidden, offscreen and replaced
  outputs, a painted pointer-events:none overlay, modal dialog and popover were
  also refused, including refusal before immutable ticket creation.
- Owner replacement and startup owner replacement remained refusals. Existing
  freshness, pending paint, held input, immutable-copy and ticket controls passed.
- Actual queued native key messages 256/257 and Mouse1 messages 513/514 were
  consumed by the current production interpreter. Independent UP children were
  actually waited with both EOF. Retained immutable captures stayed isolated;
  queued input performed no surface read, and no new capture occurred while held.
- Deliberate three-second UNKNOWN permanently closed its fixture route. Late
  arrival did not reopen it; operation logs show zero requests after terminal
  closure. Browser shutdown used independent host termination after closure.

Four personally reviewed final result-named fixture images are retained:
host consent, fullscreen current output, native key display and native Mouse1
display. Other screenshots were pruned with hash/size metadata. No source,
module/media archives, frame series or capture bundles were created.
Actual native/watchdog/supervisor/outer and release-child waits, both EOF and
absent recorded PIDs are retained in the runtime release receipt. Box state is
NOT_CREATED; ID and expiry are null, stop is not applicable.

## Remaining boundary

These controls do not reproduce the old original's failed transition. Successful
synthetic controls are not proof that every original transition is correct.
There is no warranted production change or conditional original authorization
triggered by this work. A production/native fixture must first reproduce the
specific refusal with its complete public operands and distinguish real
occlusion, output routing, clipping and owner/input state. The prior original's
screenshot-compositor UNKNOWN remains a separate missing cause. This bounded
task stops without another unchanged original.
