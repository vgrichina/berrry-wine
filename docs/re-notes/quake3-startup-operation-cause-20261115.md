# Quake III startup operation attribution, 2026-11-15

Pre-original qualification passed; no new original has launched. Evidence belongs to
`scratch/runs/20261115-quake3-startup-operation-cause/`.

The original qualified by `dd42351da84be1e99602e36df4b6ca9f02ae9899`
and reported by `8e8241de015dab19946212051df5620da136fdd9` stays closed.
Its `Runtime.evaluate` UNKNOWN occurred before reviewed menu, host consent,
capture ticket, original input or native Quit. Teardown is not native Quit.
Its missing prelaunch stdole2.tlb pin remains a historical omission.

## Established boundary before a new original

The helper's `connection()` allocates real CDP IDs and starts a three-second
timer for each operation. An expiry rejects every outstanding operation and
permanently closes the logical route. The original failure identifies only
`Runtime.evaluate`, not request ID, session, target or expression.

The last original `startup-gl-observations.jsonl` entry is timestamped
1794701869453; failure is timestamped 1794701872486. That GL snapshot had one
actual WebGL2 context, zero frontend draws/presents, zero draws and zero
transfers. The loop next waits 25 ms, reads PAGE_READ in the page session,
then reads the GL snapshot in the render Worker session. Either evaluate
could have timed out. Temporal proximity does not identify which one, and
does not establish a blocked page loop, vanished Worker, failed expression,
slow pending operation or broken transport. No unchanged rerun is warranted.

`peekKeyDownState`, called by PAGE_READ, reads host input maps; inspecting its
source does not establish a blocking guest call. There is no causal basis to
remove this check, change a game renderer, enlarge the timeout or retry UNKNOWN.

## Passive observer

`tools/quake3-startup-observer.cjs` records connection-local sequence and CDP
request ID, method, session, target, expression label/SHA-256/length, operation
start and deadline, response latency, exception presence, late-response and
terminal status. Target attach/detach/destruction, context lifecycle and ordinary
page lifecycle events are metadata only. It retains outstanding identities
after detach so a late response cannot be attributed to a replacement target.
It never serializes expression source, response values, exception text, script
source, game memory or payloads. It sends no CDP operation, game input, ticket,
capture or page state write. A broken log sink cannot change transport behavior.

The optional WebSocket wrapper preserves wire bytes, listeners and native
return values. Its fallback deadline is explicitly anchored to wire-send;
the helper registers its timer immediately before that send. This fallback
cannot claim the helper's exact timer-registration time or terminal decision.
Explicit terminal attribution is separate from elapsed deadline: an expression
exception is a response, and crossing a deadline alone is not proof of a
transport UNKNOWN. Tests distinguish these cases.

After personally verifying Chips and Rodent actual waits, EOF, heavy release
and absent PIDs, this task explicitly adopted the released
`tools/quake3-browser-controller.cjs`. A passive wire wrapper alone could not
name the helper's actual terminal trigger. The connection now supplies its
operation start, unchanged nominal three-second deadline, timeout trigger ID
and terminal decision to the observer. No request parameters, input policy,
queued-input or capture qualification assertions were removed. The qualification
reader additionally accepts this run's directory, retaining all original
certificate/hash and actual-module checks; this permits fresh current-module
evidence rather than substituting the old c5d48 module.

The helper also skips failure screenshot and Browser.close command attempts
once the connection is terminal, preserving the existing process teardown.
Host bootstrap's one three-second capture transaction now starts before passive
checks and includes post-capture validation, rather than timing screenshot alone.
These changes do not establish or repair an emulator/game startup defect.

Five focused observer/helper checks and the existing helper focused suite passed.
The locked full build passed in 39.378 seconds. Real Chrome operation controls
passed: expression exception with live transport; a genuinely pending slow
expression resolving inside the unchanged bound; ordinary Worker progress;
busy page execution while browser transport remained responsive; vanished and
replacement targets; socket loss while pending; and late response after terminal
UNKNOWN without another query or revived route. Observer controls sent zero
Input/capture commands. Byte-preservation and broken-sink checks prove the
observer itself issues no additional CDP operation.

The first combined qualification control ended at its correct 30-second personal
host-review expiry: the worker missed its manual review handoff. No original
launched and no deadline changed. The subsequent separately bounded control uses
fresh evidence in `chrome-qualified-v2`. Its actual Chrome host screenshot was
personally viewed (purple synthetic canvas, visible full-page consent strip and
button), then a nonce/hash-bound host-only review was supplied while fresh.
This is synthetic route qualification, not an original menu or gameplay claim.
The complete second combined control passed with native queued key and Mouse1
consumption, retained immutable pixels, passive negative controls and terminal
UNKNOWN assertions. The original-qualification guard passed on that fresh
certificate and exact current helper/test/module. The personally viewed
queued-native control PNG is a purple rectangle on teal, with no original game.
The current module is 2,202,536 bytes, SHA-256
`f866c8a9247f51fabd296b012d5b963c51afb97fc29f786b22798c39d4e2cff0`.

## Dispatch and remaining gates

Chips then Rodent actual runtime/source releases were verified before heavy work.
The source/module
closure must use the current published cursor work, rather than old c5d48 bytes.
The existing original-qualification guard pins the old control report directory
and exact helper/test/module bytes. A current-module requalification must retain
all queued-input, immutable-capture and terminal-UNKNOWN assertions; it cannot
reuse old module evidence as current evidence.

Before any diagnostic original: run real Chrome operation controls, focused
tests and locked full build; publish explicit owned paths; pin the complete
registered and known autoimport closure including stdole2.tlb; check actual
served hashes and actual module. One registered original only, unchanged args,
cooperative 10000, actual WorkerWebGL, real ticks, fixed 1800/1820 deadline and
irreversible 180-second Quit reserve. No restart, rebind, UNKNOWN query/retry,
game configuration override or fixture gameplay claim is allowed.
