# Guarded printable USER input

Evidence: `scratch/runs/20261117-caesar3-native-printable-text-city-progress/result.json`.

The predecessor's original run confirmed physical C DOWN but left Caesar III's
name field empty. `TranslateMessage` deliberately relies on the browser's
printable character event. Physical DOWN is not a character receipt.

The CLI now accepts `keytext:VK:CHAR_CODE` as one finite guarded intent. It calls
the existing physical DOWN handler, then the existing browser character handler.
It never derives a character from a virtual key, changes translation, sets guest
text, or posts a guest command. Independent release still owns physical UP.

Both produced queue objects must match the exact DOWN/CHAR pair, including the
shared keystroke lParam. Each needs its own opaque token and an actual matching
owner USER API return, in order. The receipt remains pending after DOWN and
reports both native messages only after CHAR. Exact owner PM_NOREMOVE returns
remain valid; a subsequent removal cannot confirm the pair twice. Printable
proofs additionally require the bound main HWND, preventing a sibling HWND on
the same actor from claiming a character queued with HWND zero.

The initial qualified scope is explicit printable ASCII on a plain main guest
window, with no native modal, native edit, modifiers, menu interception, capture,
or other held key. Unsupported characters and native control routes refuse
before effects. Full existing focus, generation, actor, memory, queue, device,
invocation and immutable deadline checks remain in force. The printable handler
identity is pinned alongside the physical handlers in the owner snapshot.

Authored real x86 fixtures publish `DCU` after UP, one marker per native
DOWN/CHAR/UP callback. Publishing on UP deliberately preserves the strict pinned
scene while CHAR is pending; changing a caption on DOWN correctly refuses the
later character. Cooperative and CPUWorker CLI runs check exact callback order,
no translation duplicate, distinct native tokens, matching lParam, independent
release and unchanged 500/1750/3000 ms bounds. Separate real main and CPUWorker
owner execution exercises the production native broker and mismatched actual
character proofs. Guard tests cover cancellation, lateness, actor/thread/memory,
focus/modal/reuse, owner retirement, missing characters and reversed order.
The exact authored controller also reaches the public `DCU` consequence.

Original city, assignment consequence and native Quit require separate visible
evidence from the single authorized fresh invocation. The predecessor's empty
name field, failed Escape exit, missing native wait/EOF and unproved old timeout
cause are preserved as facts; this change does not reinterpret their filenames
or revive any old UNKNOWN endpoint.

The subsequent outer adapter reuses the GL worker's published
`ParentProcessSupervisor` at the actual command boundary (`exec python3 ...
supervised`). It pins that supervisor, the underlying Boids helper and the
Caesar helper to a chosen current published revision. Preparation remains 240 s;
the runtime and independent runtime watchdog remain 2400/2420 s. The prepared
handshake follows compilation, full authored qualification and (for an original)
all 114 recursive media hashes. Inner native timing and input limits are
unchanged. Later unrelated main publication may advance the branch without
refreshing the sealed source/module/helpers. Actual parent-process loss still
causes shutdown. This integration does not assign a historical signal cause.


The single fresh original at published `2639be4c01f6a7483fe3575d55fb430a3cdd9769`
passed exact source/module/helper/main/Worker/OS-child qualification and all 114
recursive media hashes before the runtime clocks. Caesar visibly accepted exactly
`C`: the DOWN and CHAR had distinct native tokens, matching HWND/thread/lParam,
and actual owner Peek PM_NOREMOVE returns. Confirmation took 88.867 ms,
independent UP 245.942 ms, and complete immutable observation 375.150 ms.
Personally inspected complete images then showed Assignment 1 — Aventine and
the actual city landscape (Dn 2000, Pop 0, Jan 500 BC).

The next housing selection failed the five-second gameplay image freshness
preflight, before its intent or physical DOWN was created. The controller
permanently closed the endpoint as UNKNOWN. No later endpoint request, rebind,
replay or second original was made. Housing, road, food consequences and native
Quit are not proved. Host cleanup is distinct: actual native wait returned zero
with both EOF and `hostCleanup: true`; outer actual wait and both independent
watchdogs returned zero with both EOF and no remaining owned processes. A zero
cleanup status is not a native Quit receipt. No box was created.
