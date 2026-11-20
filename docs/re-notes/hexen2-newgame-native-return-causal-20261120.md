# Hexen II New Game native deadline: retained causal boundary

Evidence: `scratch/runs/20261120-hexen2-newgame-native-return-causal-repair/`.
Run-local `analyze.cjs` verifies retained inventories and source hashes, then
derives the timing without connecting to or resampling the closed original.
No runtime repair or gameplay qualification is claimed.

The original's first Enter returned from the owning worker's PeekMessageA
(apiKind 2, PM_NOREMOVE) at 1795174439002. The qualified animated receiver used
GetMessageA (apiKind 1, removing). These are distinct observed USER paths.
The receiver does not establish the failed original's consumer behavior.

For the second Enter, controller prepare began at 1795174458377; page guard
prepare had completed by 4458406. `preparedAt` is sampled after guard.prepare
returns, not at its exact timer origin. The controller's original deadline was
4458877; the guard's own deadline was no later than 4458906. Neither origin is moved.
Final whole-root capture ran from 4458414 through 4458713 (299 ms).
Post-capture focus checks and synchronous retention finished at 4458795,
another 82 ms. The capture and retention thus consumed 381 ms. Physical DOWN
applied at 4458822: 445 ms of the controller budget had elapsed, leaving
55 ms (at most 84 ms of the guard's budget). The last status at 4458867 still had
DELIVERY_PENDING, token zero, and no native USER return. Independent trusted
UP arrived at 4458926. This proves substantial pre-DOWN budget pressure;
it does not prove why the worker did not dequeue within the remaining time.

The retained request log timestamps `issue` before running the socket fence.
In particular its 4458414 Input.dispatchKeyEvent entry precedes 381 ms of
capture/retention; it is not an actual socket publication timestamp. Treating
that entry as actual send would incorrectly blame 408 ms on native delivery.
The final retention record bounds publication from below; no exact actual-send
timestamp or post-DOWN owning-worker poll trace was retained.

The exact served guest-rpc.js SHA is
`11799447281dd4e7b812cfeafac8495d834a34060ec947701acaa34fa7448219`.
Its check_input fast path returns zero locally only for no open input event,
published INPUT_PENDING zero, and no periodic 100 ms scene sample. Otherwise
it performs synchronous brokerCall without a render fence. input_validate and
input_consumed also bypass render fencing and sample the owning actor's USER
context. The exact served browser-native-input.js issues a token only when
dequeued(event) runs inside the owning check_input scope. A physical event,
page status, or socket ACK cannot manufacture that token.

The missing boundary is the owning CPUWorker's post-DOWN check_input/dequeue
and blocking state, correlated with queue publication and PeekMessage cache/
filter state. The retained data cannot distinguish a worker busy executing a
frame, a worker waiting for host/render completion, a queue publication delay,
or an original USER cache/filter path. Source permits these distinctions but
does not select one. No specific queue/order defect is established. Optimizing
PNG encoding or moving work before genuine prepare without an actual-worker
old-fail/new-pass proof would be a speculative change here.

The prior native, seven race, nine focus, 23 offline, legacy and strict proofs
are reused by verified SHA; no unchanged calibration was repeated. No deadline
was widened, capture omitted, held region touched, or consumption fabricated.
No new runtime, endpoint request, original replay, or test box was created.
Movement, living enemy consequence, and ordinary Quit remain unproved.
This task stops at the precise missing causal boundary, leaving implementation
7bca66241 unchanged. Box ID=null, state=NOT_CREATED, expiry=null, stopReceipt=null.
