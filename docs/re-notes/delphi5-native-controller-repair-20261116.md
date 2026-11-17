# Delphi native controller completion and capture qualification

2026-11-16. This assignment runs generated native USER fixtures only. No original
installer, installation, credentials, IDE, samples or original Quit is claimed.
Evidence: `scratch/runs/20261116-delphi5-native-controller-completion-repair/result.json`.

The preceding controller slept until 2500 ms before beginning its observation,
leaving only 500 ms for checks, durable records and scheduling inside the fixed
3000 ms aggregate. It now observes the actual modal transition immediately after
the independently armed physical release. Quit waits for the parent's actual
native process completion and pipe drain, without requesting a retiring endpoint.
A diagnostic preparation exposed and retained that exit/socket ownership race.
The 500 ms confirmation, 1750 ms physical UP and 3000 ms aggregate limits remain
unchanged. Physical UP timestamps now record the returned acknowledgement,
rather than the time immediately before sending its request. Freshness remains
5 seconds for gameplay and 30 seconds for menu/install/Quit evidence, with the
consumption deadline also capped by evidence expiry.

The final run recorded the following actual times, including durable evidence
publication before the completion measurement and final aggregate assertion:

| Native intent | Confirmation | Physical UP ACK | Aggregate |
| --- | ---: | ---: | ---: |
| First modal OK | 244 ms | 392 ms | 448 ms |
| Second modal OK / native Quit | 255 ms | 377 ms | 523 ms |

Another preparation exposed Python interpreter startup exceeding the existing
150 ms release-prearm check before any DOWN. The release helper now forks from
the single-threaded controller into a separate process, avoiding a second
interpreter import/startup. Its prearm check, absolute 1400 ms fallback and all
three immutable action limits are unchanged. The parent actually joins that
process and drains both pipes before accepting its physical UP evidence.

The old fixture passed the same title and text to both MessageBoxA calls. Its
identical pictures cannot establish whether the second capture was stale.
Contrary to the preceding report's description, the retained old second frame
shows a generated dialog, not a blank teal image. This repair gives each real
guest-created dialog distinct strings and checks its native generation, title,
full-frame dimensions, rendered content and different PNG hash. Capture records
also compare native context before and after PNG publication. Personal review
of the two complete frames is recorded separately from automated fixture reviews.

Native scene identity alone did not guard paint changing while an intent waited.
The CLI now accepts an optional complete-frame SHA-256 inside a native intent and
checks it during both preparation and consumption. This controller supplies it
on every intent. Existing native clients retain their protocol; this qualification
requires the stronger paint guard. The published desktop ready-loop repair
`c8f308b84` is preserved without edits.

The historical post-UNKNOWN generic fixture teardown request is removed. All
controller requests, including cleanup, check the permanent terminal latch before
identity checks or network access. A failed action drains its already armed
finite release before publishing UNKNOWN; no release can bypass the published
latch. Fixture errors also latch permanently. Remaining live fixture processes
are terminated by their owned host process group, never by a teardown endpoint
request. Host termination is explicitly distinct from native guest Quit.

A later preparation also refused before capture/input when the previous fixed
fixture port belonged to another worker. It sent no request to that listener.
Fixtures now obtain an OS-allocated free local port once, and retain the exact
PID/start-token/socket ownership check against an intervening bind. There is no
automatic replacement or endpoint retry after a refusal.

Qualification includes actual queued focus, owner and paint changes with
unconsumed cancellation; stale paint at binding and at a later intent; and
capture/bind/retry attempts after UNKNOWN with unchanged request ledgers.
Independent deadline watchdogs are armed before native process launch. Native,
release helper, watchdog and supervising checks retain actual waits and pipe EOF
evidence. No box, shared build-output reader, source archive, module dump,
foreign WIP, installer media mutation or clock override is used.

The runtime helper now defaults to qualification and closes its sealed source
and module descriptors on success or failure. An original pipeline requires the
separate explicit `--original` option and its existing review gate in a subsequent
assignment. Git plus the owned binary patch and new-file patches reconstructs the
tested sources; the canonical compiler builds their module directly into sealed
owned memory.

Final checks and publication are recorded in the evidence result. The v2
preparation retained a desktop regression timing refusal at 3424 ms against its
unchanged 3300 ms test ceiling; it launched no native fixture or original.
That failure is not rewritten into success by later passing runs.

Final evidence is in `final-qualification-v8/`. The old Git host's real queued
paint fault consumed stale input; its expected-red trace is in `paint-baseline/`.
The repaired host cancelled the queued paint, focus and owner faults without
consumption, and rejected both stale-paint binding and later-intent submission.
All five permanent UNKNOWN cases recorded zero later requests. Three selected
full-frame screenshots were personally reviewed: the first and second native
dialogs, and the deliberately changed paint used by the rejected intent.

The required full-flock build passed after the native CLI and fixture changes.
Only the Python release-process startup implementation changed afterward;
the final focused runtime tests cover that change. The compiler/build inputs
and native CLI/fixture bytes remained unchanged. A preparation that hit its
unchanged 180-second compile watchdog is also retained, with actual TERM wait
and both pipe EOFs; it launched no native fixture or original.

Next: a separately assigned original trial installation using the qualified
controller, ordinary original media and fresh personally reviewed scenes.
