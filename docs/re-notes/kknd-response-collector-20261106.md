# KKnD response collector

Run: `scratch/runs/20261106-kknd-response-collector/`. Predecessors unchanged:
[closed-target evidence](kknd-closed-target-20261106.md) and
[menu consumer observations](kknd-menu-consumer-20261106.md).

The run-local collector now records request/target/session identity, method,
status, redirects and exact errors; it retrieves required complete GET bodies
after CDP loading completion at their owning session. HEAD/204/304/redirects
need no body; OPTIONS is explicitly a non-source method, without inferring a
preflight or claiming it cannot carry content. Required failed transfers/body
retrievals stay **unverified**, with null hashes. Genuine mismatches and unexpected
live defects remain fatal. Both old `response.buffer()` listeners are removed
from the fresh adapter; predecessor files are preserved.

Before the original, the **exact exported collector** passed a minimal real
Chrome fixture covering GET, redirect chains, HEAD/OPTIONS/204/304, interrupted
transfer, controlled body-unavailability protocol rejection, genuine mismatch,
owning-Worker fetch and instantiated binary Wasm. Separate live-defect and
incomplete-lifecycle controls passed. The source fixture hash is
`b099cb6a87aff317cdda271892e5209d1a11021497e1d981335fb02f496b1f55`;
the instantiated fixture module is
`93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476`.
All 16 exported owner/attachment controls, passive observer, exact adapter compile
and locked full standard/compat build passed. Parent binding is awaited before
strict ownership; attachment checks the actual verified instance reference and
slot0/endpoint1/thread1/512MB together with counter setup. Closed sibling errors
are retained; live exceptions remain fatal. No guest state/code writes.

All ordered FINAL releases and independent cleanup passed before the immutable
12:33:12.970641–13:18:12.970641 UTC window. Tested Git:
`a3c3cd7b4661d23f9b513ee65a0892769954bfc3`, tracked source diff empty;
owned new helper/doc patches retained. All 325 source/module pins, 114 helper
pins, eight predecessor pins and 16 original media files remained unchanged.
Actual served and owning instantiated module:
`220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2`.
There were **128 verified response bodies, zero mismatches**. Four unverified
records describe two initial Worker requests whose page-start/Worker-response
lifecycle is split across sessions; linked metadata is retained, bodies remain
unverified. Actual owning Worker script source separately matches its immutable
pin through Debugger. No complete network/VFS-byte claim.

One registered original reached Evolved terrain/units, then Escape opened
Options. After personally reviewed captures and verified observer attachment,
one balanced Return click at native320,189 held 151.310ms. **First new failure:**
Options remained open. Over 225 retained samples, cursor press/release transfer,
button press/animation/success and main close counters stayed zero; global
collision, animation completion and non-inhibited button counters reached
735/252/735. One sample retained current mouse mask16, but sampled pressed and
released words were always zero. Sparse samples do not prove no transient edge.

Return task `0x5589a8` is identified by saved continuation `0x4321d6`, table
offset `0x348` and matching text animation, not its y coordinate. It remained
waiting at `0x432d56`, mask `0xc0000000`, final queue empty; its descriptor bounds
are native `[237,178,410,199]`, containing the click. Global collision counts do
not identify its actual collision recipient. `0x477358=0`, `0x46c300=0xffffffff`
and inhibition globals zero were retained, but the main close branch was never
observed, so its enable condition is not established as this failure's cause.
Next: observe the cursor's copied edge buffer and collision event recipient at
consumption, alongside previous/current poll state. No routing replay or blind
repeat is justified. No emulator repair is established.

No selection, commanded displacement or second gameplay response was verified.
Seven trusted balanced input pairs/releases passed; terminal buttons zero.
Browser closed12:36:57; cleanup12:37:08 passed 25 absent owned PIDs, four refused
ports, two absent profiles, four free locks and 3.96GB free, within the window.
Browser tool status143 is retained despite `CLOSED worker completion`; its cause
is unproved and is not a guest-crash claim. Holder SIGTERM143 was intentional.
No boxes (ID/state/expiry N/A), source archives, media copies or deployment.
Key evidence: `collector-control.json`, `collector-summary.json`,
`failure-boundary.json`, `consumer-final.json`, `consumer-analysis.json`,
`balanced-release.json`, `capture-review.json` and `final-cleanup.json`.
