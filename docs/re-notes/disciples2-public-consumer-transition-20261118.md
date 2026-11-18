# Public cursor-consumer observations, 2026-11-18

Run: `scratch/runs/20261118-disciples2-public-consumer-transition-map-progress/`.
Code: `b6ab34125`. **The requested original-game outcome was not achieved.**
No input-readiness repair, New Quest, map action or ordinary Quit is qualified.

## New measured boundary

`tools/disciples2-public-consumer-observer.cjs` passively observes existing host
position reads, cursor changes, DirectDraw present/Flip calls, input polls and
idle notifications. The opt-in environment variable is
`DISCIPLES2_PUBLIC_CONSUMER_TRACE=/absolute/owned/prefix`.
The immutable runtime preload installs it without editing `test/run.js` or the
guard/controller. Disabled observation installs no import wrappers.

Each position read records its actual returned packed point and exactly one
public call-frame return word. The observer also records exported public USER
diagnostics and target HWND, owner, generation, memory/window identity and visible
lifetime. It does not inspect private game objects, invoke a guest API, advance
the clock, modify readiness or acknowledge delivery. `callbackReturn` remains
`unmeasured`; a public position read is not relabeled as a returned callback.
Idle notification arguments must be distinguished from the observing module's
thread ID, especially for a brokered foreign-thread call.

Storage is bounded to 64 move spans per import context, 512 rows per span, eight
queue headers per row, 4096 observations and 2250 ms per span. Prefix/tail rows,
seen counts, overwritten/missing counts and budget omissions remain explicit.
The observer writes at process exit. Subsequent move spans have independent
bounds, so early menu input cannot exhaust observation for a later transition.
These diagnostic bounds change no guard deadlines or release rules.

## Native authored controls

The production module was compiled from exact Git
`c96da5f522bb3268fdeda512c59c08aa9d99356f` plus the retained owned JS patches.
Its SHA-256 is
`cc4fb8225e07c1136c7e200484fb321827f20a756b71b599748237786fdc692a`.
Foreign WAT/JS WIP was excluded from the immutable runtime. The canonical locked
build also passed on the shared tree; its module is separately identified and
is not substituted for the sealed runtime module.

| Authored native application | Observed cursor caller | Result |
| --- | --- | --- |
| Nonempty timer pump, nested filtered callbacks | No new position sample | Returned callbacks, unchanged consumer counter; DOWN refused |
| Position read inside callback | `0x40244f` | Nested sample counter advances; caller consumer unchanged; DOWN refused |
| Position read after actual DispatchMessage caller continuation | `0x402cc7` | Consumer advances without any owner exhaustion; DOWN refused |
| Ordinary drain-then-sample caller | `0x402c90` | Real owner exhaustion, position sample, native-return DOWN receipt and independent UP |

The caller-continuation counters are authored x86 instructions after the actual
DispatchMessage return. This separates nested cursor activity from a real caller
consumer transition. It remains an authored application counterexample, not
proof of Disciples' application policy or a generic alternative readiness rule.

All four control variants passed with observation disabled and enabled; final
enabled controls passed on the final bounded observer. Actual sibling CPUWorkers,
nested callbacks, lifetime/owner reuse, exact queued DOWN identity, cancellation,
deadline, focus/owner refusals and independent release controls are retained.
The final local guard suite and full-module invocation/lifetime controls passed.
Ring overflow, 64 distinct move spans, public return-word provenance, import
replacement/delegation, exception preservation and unavailable exports are tested.
Five final synthetic active cost samples were 12.9–29.7 microseconds per import;
this is an observed synthetic cost, not a universal runtime bound.

One early nested control failed because the fixture armed before its authored
caller loop and sibling worker were running. The fixed fixture waits for its
own explicit telemetry precondition before starting the timed intent. That
fixture-only correction supplies no original-game readiness acknowledgement.
The failed attempt and all actual waits are retained.

## Sole diagnostic original and permanent closure

After focused tests, the locked build and strict pull/push, one new diagnostic
original was launched with the sealed module, default media, real ticks,
unchanged readiness, a 3600-second native limit, 300-second Quit reserve and
prearmed independent watchdog, inside finite `native-supervise` custody.
All 128 media hashes and the DLL graph passed preflight. No save was imported.

Whole frames were personally inspected. The original showed its loading screen
and then a black transition. No complete main menu was reviewed, no owner was
bound and **zero DOWNs/input tickets were submitted**. Public snapshots progressed
from batch 8098 to 48374; this is execution activity, not successful loading.
Its passive observer consequently contains zero move spans/consumer observations.
No original callback return, cursor/frame consumption or nonempty pumping fact
is established by this run.

At `2026-11-18T15:46:00Z`, the outer native supervisor received SIGTERM before
its recorded deadline. The sender is unknown. It terminated its owned process
tree. The original's actual native wait is exit 0 with both EOFs and an explicit
host-cancellation receipt; **this is not native Quit**. Its watchdog actual wait
and the durable outer-child wait are signal -15 with both EOFs. The intermediate
outer-parent wait and the driver's individual child waits were not recorded;
they remain unknown. The tool invoker returned 143. The outer custody receipt
reports no leaks, and an offline check finds every recorded owned PID absent.
Browser and display processes were not created; their waits are null.

This runtime scope is permanently UNKNOWN/closed. There were no endpoint
requests after closure, no replay, unchanged retry or second original. The one
diagnostic-original permission was used; no affected original was justified
because no production input-readiness repair was proved.

Static original-EXE inspection identifies the sole direct GetCursorPos import
call at `0x545e3d` (return `0x545e43`), called from the loop at `0x545d95` before
its individual PeekMessage query at `0x545dca`. This gives future observed
position reads a concrete public callsite to test. It is not dynamic proof that
the original reached that consumer after hover callbacks in this execution.

The historical original remains separate: callback return is unknown, and its
700-seen/683-retained-union/17-missing accounting still permits no absence
inference. No old closed endpoint was contacted or old fact promoted.

## Remaining boundary and recovery

The remaining original-game cause is **unmeasured**: startup was cancelled before
hover, and the external SIGTERM sender is unknown. A generic cursor-read release
would still need an invocation/lifetime-safe consumer proof; the nested control
demonstrates why cursor sampling alone is insufficient. No filter, owner-empty,
clock, private game state or receipt was forced.

The run retains exact Git, binary diffs, owned new-file patches, manifests,
selected named whole frames, unique authored inputs and the hash-verified module.
Git plus patches is the source archive. `RECOVERY.md` describes reconstruction;
there is no source-tree snapshot, media copy, frame series or capture bundle.
Selected tmpfs evidence was retrieved and SHA-verified before owned removal.
`result.json` is written last. Initial pre-runtime disk samples fell below
1.5 GB; peer-owned recovery restored headroom before native launches. No
continuous whole-task disk-floor claim is made.

No agents, Codex workers, Python, Wine reference, deployment or box was used.
Box ID null; state NOT_CREATED; expiry null; stop receipt null. Ownership is
released after evidence finalization, and this single-task worker stops.
