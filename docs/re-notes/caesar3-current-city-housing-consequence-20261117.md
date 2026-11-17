# Caesar III: personal image review exceeds gameplay freshness

Evidence: `scratch/runs/20261117-caesar3-current-city-housing-consequence/result.json`.
The new original allowance was not used. No housing, road, population, food,
or native game Quit consequence is claimed by this investigation.

The preceding authentic run reached Aventine and an ordinary city showing
Dn 2000 / Pop 0. Its housing attempt failed before intent creation: capture
started at 1794900084.226, completed at 1794900084.292, personal review was
recorded at 1794900094.0673296, and refusal occurred at 1794900094.2141666.
The actual capture took 66 ms; capture-to-review took 9841 ms.

A fresh authored native USER fixture reproduced the boundary using the
published integrated graph `ae70a5473036d0edaf49c111a756de9dcbfe2ab5` plus the
recorded owned helper/test patch. It used the real threaded interpreter,
ordinary ticks, native captures and owner receipts, without private guest
state inspection. The complete 800x600 PNG was returned in the capture tool
call itself and personally inspected. Capture began at 1794901392.485 and
completed at 1794901392.545 (60 ms). The immediately following combined
review/intent command recorded review at 1794901402.5847552: 10099.8 ms after
capture began, or 10039.8 ms after capture completed. It correctly closed
the endpoint before creating any intent or sending DOWN. There were no later
endpoint requests, rebinds or replays. Native and watchdog processes were
actually joined; cleanup does not establish native game Quit.

The helper now supports one explicit `review-intent` command. It records the
supplied personal review of the retained complete image, then runs the existing
single finite intent. It preserves the original capture clock, the 5 s gameplay
and 30 s menu limits, actual native confirmation within 500 ms, independent
prearmed UP within 1750 ms, and immutable capture within 3000 ms. It performs
no recapture, input batching, automatic review or replay. Twelve read-only
controller startup measurements ranged from 155.7 to 237.1 ms; combining review
and intent removes one helper startup and one external tool turn. The personal
fixture shows that this improvement is insufficient for the current image
transport/review round trip.

The new diagnostic modes never authorize an original. Working qualification
overlays only this worker's leased files onto the selected immutable published
graph. Native fixture wait records are now atomically published, correcting an
observed partial-JSON read race; host cleanup is recorded separately from normal
native completion. Focused fixtures cover a fresh combined gameplay intent,
printable DOWN/CHAR and independent UP, native Escape completion, delayed
capture refusal, and real elapsed stale-image refusal with zero later requests.

Progress requires a demonstrated personally reviewed complete-image-to-DOWN
route below five seconds. The measured delay is outside the capture encoder
and the helper's preflight; another original cannot fix that delay. The original
allowance remains unused, and no old permanently closed endpoint may be queried
or reused. No source/config/media/clock change, box, public deployment, or
freshness exception was introduced.
