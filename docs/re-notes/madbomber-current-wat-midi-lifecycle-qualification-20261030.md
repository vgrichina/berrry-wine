# Current-main WAT MIDI lifecycle qualification: blocked

Candidate: `cd0612927f4bc6db7ee5f5c90ab323442fa5d341`.
The unchanged `test/test-midi-stream-lifecycle.js` SHA256 is
`3741e80b1f6035e0983e2d1c7b7c3d65e4100fc141a278374b16d4b099a29720`.
All 22 dispatch source/compiler pins matched before execution. The exact pins,
supervisor receipts, startup limits and original output accompany this note in
`test/madbomber-current-wat-midi-lifecycle-oct30/`.

The direct pinned baseline exited 1 at `test/test-midi-stream-lifecycle.js:156`:

```text
Compilation failed at stage EMIT: Unknown function '$mm_callback_begin' called in $fire_audio_callback_bound: no such import, builtin, or user function (typo or missing definition?).
```

The extracted production callback function calls this helper at
`src/13-exports.wat:3475`. A second call appears at line 3407. An exact-symbol
search of all 22 pinned inputs found those two calls and no definition. The
fixture extracts callback functions from `src/13-exports.wat`, register helpers
from `src/03-registers.wat` and lookup helpers from `src/10-helpers.wat`, but
does not supply this callback dependency. This is an extracted-fixture closure
failure; it does not establish a defect in the complete canonical module.

No source acquisition is authorized or needed by the original dispatch premise,
but these supplied inputs cannot provide this helper for a faithful wrapper
correction. No stub, invented implementation, oracle change or production edit
was made. The coordinator needs to identify and pin the helper's production
definition and authorize an extraction correction before qualification resumes.
Further missing dependencies may exist beyond this first compiler failure.

Actual outcome: **0 lifecycle cases executed**, compiled module bytes/hash
**unavailable**, API lookup/dispatch **not reached**, callback save/restore
assertions **not reached**. The pre-compilation registration checks do pass:
`midiStreamStop` exists, has one stdcall argument, and its ID equals its table
index. The expected registration is API 4593. Compilation fails before the
first `test()` invocation.

The requested `stop-no-notes` and `wrong-handle` mutation executions were
**not attempted**, because the baseline cannot compile. Neither is claimed
killed or compatible with this revision. `replay.js` supplies environment-setting
entry points to the same unchanged oracle, validates all 22 pins, and does not
modify extraction or assertions. It is retained as a replay control, not as
evidence of mutation rejection. No prior JS-only acceptance group was replayed.

The exact successful Node startup used `/usr/local/bin/node` (resolved Node
v24.18.1), `--max-old-space-size=192`, CPU 60s and file-size 12MiB. Inherited
Node DATA/address-space limits were unlimited; Git's DATA limit was not applied
to Node. The task supervisor enforces group RSS 512MiB, parent RSS 128MiB,
90s wall and 512KiB capture; Python uses DATA 128MiB, Git DATA 256MiB.
The 8MiB physical publication reserve remains allocated within the task's
24MiB physical allocation. Evidence remains below 1MiB.

No mount argv, Boat, guest, full canonical build, x86 execution, browser audio,
audible output or gameplay occurred. Mount validation is inapplicable because
no mount operation is used. No box was assigned; coordinator retains lifecycle
ownership. Root Git and donor object stores were read-only. This report is on a
task branch only and does not qualify current-main WAT MIDI lifecycle behavior.
