# Native input consumer confirmation, 2026-11-17

Evidence: `scratch/runs/20261117-caesar3-native-consumer-confirmation-repair/result.json`.
Git is the source archive; the run retains relevant patches and exact module identities.

The published baseline incorrectly acknowledged a guarded edge inside the host
`check_input` import, before native USER filtering and owner routing completed.
The same authored real x86 program, with an actual CPUWorker, proves false
confirmations from an excluding PeekMessage filter and a sibling thread. Neither
returned the edge to its native owner. Host application and queue removal alone
are insufficient evidence of native consumption.

The repair issues an opaque token for the exact queued object and immutable
intent. Native GetMessage/PeekMessage carry it through pending input and shared
queue flags. Before effects, validation checks the original owner, memory,
window/device identities, context and deadline. Confirmation requires the actual
owner's successful native USER return, completed stack frame, no fresh yield,
and matching HWND/message/wParam/lParam. The receipt includes the same nonce,
token, owner thread, API and removal provenance. A successful owner PM_NOREMOVE
return is valid raw-message consumption; it does not prove removal or dispatch.
Filtered/sibling polling, empty polling, asynchronous key state alone and unrelated
messages cannot confirm an intent. Browser/unarmed hosts issue no token.

Broader controls exposed a second concrete defect: ordinary
`resume_message_wait` cleared reason 7 but could retain the old yield flag before
re-entering GetMessage. The native handler could return EAX=1 with its complete
stdcall frame while inheriting that old flag, losing confirmation. Resumption
now clears only the old wait flag before the existing handler call. New callback
or handler yields remain refused. No additional guest call, service flush,
interpreter budget or deadline was introduced.

Confirmation lifetime and native MSG lifetime are distinct. Once a successful
Peek returned an edge, its cached native MSG remains retrievable by ordinary Get
across the confirmation deadline and independent physical UP. This cannot issue
a second confirmation, change the original timestamp, or survive memory/owner
retirement. Unconfirmed expired or cancelled edges are discarded before a guest
MSG write. Invalid PM_NOREMOVE cleanup matches the exact token under the queue
lock, so concurrent window purging cannot make it remove an unrelated successor. The authored delayed-Peek/Get control tests this with native execution.

The authored controls exercise ordinary title-style Peek/Get and pointer paths,
Get-only, PM_NOREMOVE, delayed removal, excluding filters, actual asynchronous
GetAsyncKeyState (0x8001), a nonconsumer, sibling polling, and bounded busy
interpreter work. Independent physical release and watchdogs are prearmed;
actual process waits and both EOFs are retained. Diagnostic host cleanup is
explicitly not native Quit. Existing queue/device/window/generation/focus/modal,
nonce/fresh-image, cancellation, retirement and transport refusals remain required.
The metadata-scope test now states handler application without claiming native
consumption while it deliberately suspends native polling.

The first original run's no-dequeue timeout remains unexplained. Its host handler
applied DOWN at 59 ms, no native message was observed, cancellation occurred at
500 ms, and independent physical UP occurred at 1419 ms. A bounded authored
GetTickCount workload reproduces that timing shape while its real CPUWorker
progresses; this is a discriminator, not evidence that the original used that
cause. Moving confirmation later cannot repair a missing native dequeue.
Therefore no fresh original was launched, the old UNKNOWN endpoint was untouched,
and title dismissal/city/Victory/Assignment2 food/native Quit remain unproved.
Further original work requires a material causal timing repair and full exact
CURRENT published Git qualification under the unchanged manual contract.

The media helper now inventories all files recursively before any future native
clock and compares the complete paths, sizes and SHA-256 inventory afterward.
The current 114-file inventory matches the retained postrun reference, but that
reference is not retroactive pre-run proof. No media, EXE, defaults, save or clock
was edited. No box, worker or public deployment was created.

Working sealed qualification passed all seven native pointer mappings, keyboard,
ten consumer cases, ten identity/lifetime unit cases, the exact reviewed controller
with authored native Quit, and permanent UNKNOWN with zero later requests. The
real broker scope test also checks token isolation on main and worker routes.
Canonical build, focused checks and final published Git/module identities are
recorded in the result. Authored Quit is not an original-game Quit claim.
