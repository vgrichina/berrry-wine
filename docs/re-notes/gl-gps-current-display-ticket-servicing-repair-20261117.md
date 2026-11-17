# Initialized current-display capture servicing, 2026-11-17

Evidence: `scratch/runs/20261117-gl-gps-current-display-ticket-servicing-repair/result.json`.
Git and the relevant binary patch identify source; no source archive or original
game media is involved.

## Causal defect and repair

`requestCurrentDisplayCapture` already permits an unchanged, complete displayed
publication. Its immediate path nevertheless defers when a guest slice is
executing. Previously only a later repaint consumed that deferred request. A
clean slice never creates repaint damage, so its completed boundary left the
ticket pending indefinitely even though the same ordinary publication remained
available. This is a servicing defect, not evidence of source-pixel corruption.

The host's existing `_presentAtBoundary` now services this specific request when
the live host queues, including shared DirectDraw dirtiness, are empty. The
renderer also requires no writer, paint, composition, scheduled repaint or
deferred repaint. Requests armed with pending host damage continue to require an
ordinary later publication. No guest work, flush, render, repaint, timer, idle
request or artificial frame is introduced. A serviced unchanged publication
retains its original number and displayed timestamp and is labeled
`already-displayed`; it is never a new engine-frame claim.

Host stop and known GPS producer errors/retirement now fail only the matching
owner's pending current-display ticket and invalidate that owner's retained
display receipt. They preserve foreign tickets and completed immutable bytes.
Late rejected GPU opens/kicks cannot fault a replacement generation; stale frame
callbacks retain their existing bitmap-close behavior.

Retiring a GPU endpoint can itself schedule an ordinary desktop composition
after the layer detaches. A later generic display observation of that new
publication remains legitimate. It does not carry an initialized GPU join and
the native producer binding must refuse it. Pending native tickets still fail
immediately on retirement; completed immutable captures retain their old bytes.

## Authored native proof

The authored x86 PE uses real Win32/OpenGL imports, actual guest and render
Workers, a real WebGL GPS endpoint, and ordinary compositor publication. Its
draw-once variant continues its natural Peek/Translate/Dispatch loop after
initialization. A one-shot observer arms the public capture at the next natural
slice entry, without scheduling that slice or changing its budget or clock.
The timer variant draws through native SetTimer/USER delivery. The original
unbounded drawing variant remains available as a separate stress case.

On published production `9a95ce374`, the draw-once held request remained pending
for 3,000 ms across more than 100 clean completed slices; the endpoint was then
permanently closed. The candidate consumed the same case through the new service
event: publication 5 was retained unchanged, capture took 284 ms and the full host
screenshot took 98 ms. The independent analytic oracle checked all 172,800 source
pixels and all 788,640 presentation pixels with zero mismatches. Earlier captures
with a fractional viewport are retained as development evidence, not substituted
for this full literal comparison.

A separate actual context-loss run observed the native executor's explicit
`gpu-stream-webgl: context lost` error 693 ms after `WEBGL_lose_context`, caused
by its next ordinary native timer draw. The display receipt was invalidated and
a late capture failed. Explicit host shutdown failed an in-flight ticket; actual
guest/render Worker target-destruction events and normal retirement, browser
wait, native wait, watchdog waits and pipe EOF were recorded separately. Explicit
host shutdown is not native Quit.

The final result records the exact published Git/module/helper identities and
selected final captures, plus focused and canonical-build outcomes. Development
overlay results do not qualify published source by themselves.

## Limits

One original unlimited draw-loop stress run completed an ordinary later native
publication in 2,234 ms but its independent host screenshot became permanently
UNKNOWN. That case does not establish pixel loss or qualify bounded host delivery
for an unbounded producer. The clean-publication repair does not accelerate
guest execution or throttle native rendering to conceal this limit.

The touch cursor and all host UI remain visible. Canvas-only authority still
refuses an intersecting overlay. No original GLTron invocation or input is
authorized by this work. Shared USER confirmation repair and exact native input
positives/refusals remain prerequisites for a later original; no historical
UNKNOWN endpoint is queried, rebound or replayed.
