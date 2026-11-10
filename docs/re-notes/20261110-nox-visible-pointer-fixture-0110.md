# Nox fixture publication repaired; native startup blocked visible validation

Code commit `510af8bfb79fdd4c27af45df4bbe858b3aabd4bb` is published on main. The two-path change is limited to
`tools/nox-current-driver.cjs` and its generated-consumer test. No observer,
shared provider, Q3 or LBreakout source was changed by this task.

The retained 0033 image shows the desktop Read Me with no fixture target.
The causal publication omission is now identified: `Win98Renderer` selects the
page's `screen-present` canvas and sets its logical canvas opacity to zero in
its constructor. The generated fixture painted only its own logical canvas;
it never called `_presentDisplayCanvas()`. Its 640×480 geometry and installed
observer therefore did not imply visible pixels. The new test loads the real
production renderer in a DOM context with `screen-present` and asserts that
constructor boundary before exercising the actual generated fixture.

The fixture now calls the production presentation method after painting and
requires its direct-canvas result. Before each image it waits two browser
animation callbacks, then checks computed opacity/visibility/display, center
hit testing, owner identity and a green target pixel. Each image binds a unique
fixture owner UUID and canvas ID, the exact commit and module hashes. Review
validation also rereads and hashes the image bytes before admitting the click.
The fixture remains an explicit DOM/renderer control with no game guest.

Evidence: `scratch/runs/20261110-nox-visible-pointer-fixture-0110/`.
The actual generated fixture passed publication, one native-helper click,
production renderer cursor movement and observer command/image binding in an
offline CDP peer. Foreign-owner and changed-PNG controls each failed before
any click, with zero protocol after terminal publication. Actual child waits
recorded separate stdout and stderr EOFs. The existing production observer
command control passed twelve image bindings. The locked build passed.
Two initial adapter failures (missing prefixture keyboard forwarding and
browser timers) were corrected by this same worker before the passing run.
The unchanged default suite was not repeated. Native-fixture tests are offline
controls and do not claim browser compositing or guest acceptance.

One fresh box was allocated for exactly one changed visible fixture and a
conditional original. All 862 staged inputs (108247609 bytes) were verified.
The generated native plan pins the code commit above and modules
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
and `ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.

The first live failure occurred before CDP admission or any fixture image:
Chrome did not publish `DevToolsActivePort` during the unchanged 100×100 ms
readiness bound. The diagnostic measured 10486.446 ms and found Chrome alive,
with no port file and empty stderr. No fixture installation, fixture click,
original launch, Jack/Bunker navigation or staff target impact was reached.
The startup cause beyond this observed boundary is unproved. The runtime's
first-failure handler immediately entered terminal shutdown without later
protocol/input/capture/retry/quit/extension. The external owning-cancel check
found its exact supervisor already absent. Kernel custody completed with
28 owned/28 reaped tasks, no remaining or unreaped tasks, complete fork lineage,
and actual parent wait 1 plus separate stdout/stderr EOFs. Named PIDs, port and
profile were independently confirmed absent/closed. No live retry occurred.

All 89 artifact references (85 unique contents,
1179736 unique bytes) were retrieved and independently reread by
SHA-256 and size, including gzip CRC validation, before the sole delegated
normal stop. Box `bx_xk729gjr` is archived, expiry null. Stop receipt
`stop_7e64008d38b91cfb` independently confirms completed, unforced at
2026-11-10T01:17:00.633Z. Prearmed immutable watchdog UUID
`b32e162a-70d9-4049-9b60-1ce378093655` retained deadline
2026-11-10T01:40:17.141Z; initial API expiry was 01:40:17.783Z.
Its independent supervisor recorded actual watchdog wait 0 and separate EOFs.
No owned live box remains; all prior boxes were untouched.

Exact Git plus small patches preserve recovery; no source archives or repeated
media copies were made. Home remained above 1.5 GB free. Next work requires
resolving the demonstrated native DevTools readiness blocker before a separately
authorized visible attempt. This single task stops here with the causal repair
tested and shipped, and its live validation explicitly incomplete.
