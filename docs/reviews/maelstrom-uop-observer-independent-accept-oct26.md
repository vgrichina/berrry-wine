# Independent Maelstrom UOP observer acceptance, 2026-10-26

**ACCEPT the bounded opt-in source repair** at
`145e66c80606c1ab4f854cef0cfcff2f5d6364ac`, base
`44e344fdb26daab9a07210656597902ba27cb5f7`.
No implementation/helper was changed. This verdict does not authorize a canonical
build, game capture, merge, deployment, or runtime qualification.

The unchanged raw completion from batch 36170 reproduces baseline exit 1,
status 5/reason 3/mode bits 4. The same input on the candidate reaches status
2/event 1. This repairs admission of the observed completion, without claiming
that its uncaptured errno/caller fields were observed zero. See `baseline.log`
and `nine-groups.log` in the adjacent evidence directory.

All nine supplied compiled fixture groups and seven retained suites passed in
this independent checkout. The latter cover the non-UOP observer, source snapshot,
diagnostic rejection, original adapter, scalar/loaded anchors (3,748 cases),
status/event validation, and terminal callbacks (68 cases). An additional
independent executable test passed **13 groups / 4,348 assertions**. Logs,
per-command atomic checkpoints, source identities and bounded runner are retained.
The earlier 12-group independent run is also preserved.

## What the source and executable challenges establish

The transform pins the complete UOP compiler before applying an exact single-anchor
insertion in `uc_decode`, immediately after record initialization and address
storage, before operand setup and guest decoding. It calls production `uc_unsup`
and returns at CALL EDI `0x7a3364` and the supplied CRT base plus `0xc438`.
The native CRT base for the original loaded-image verifier remains `0x522000`.
Full-file SHA-256, Git blob and byte-exact compiler excerpts are in
`compiler-excerpts.json`.

The exclusion is **module-wide at those two exact addresses**, including warmup;
it is not conditional on an active observer invocation. That is the implemented
contract and prevents earlier compiled traces from hiding either boundary. The
one-shot native capture itself is invocation-owned. This review accepts this
explicit source-route tradeoff; it does not claim that unrelated executions of
those same addresses retain their prior compilation choice.

The independent small compiler-prefix module executes the actual transformed
prefix and actual `uc_unsup`. Across 1,028 address trials (257 around each
boundary, at two CRT bases), only the exact two addresses produce unsupported
records. Adjacent addresses and the former CRT location under relocation do not.
Poisoned records are cleared on every call. First-read compiler drift rejects;
read-once accessors cannot substitute later unpinned strings. Later source and
option mutation does not retarget generated output. Disabled transforms touch
neither source nor unused option getters.

Source inspection additionally follows the unchanged integration path:
`uc_form_loop` skips kind-zero successors and rejects an unsupported head with
reason 3; `uc_compile_locked` declines failed lowering. The engine's existing UOP
exit path resumes through `branch_end`. These integration observations are source
semantics, not execution of the full compiler or production dispatcher.

Only the six advertised fragments change. The UOP enable assignments remain
byte-identical; the observer adds a rejecting hook before the existing setter,
without setting UOP off. The native fixture executes production `uop_fast`
MOV/EXIT and genuine threaded register CALL, relative CALL, ADD and RET handlers,
using pinned `_errno` bytes and a controlled native `_getptd` body. UOP remains 1.
This combines a real Wasm transfer-handler test with a fixture decoder and fixture
branch continuation; it does not execute canonical UOP trace compilation.

Errno is loaded from the native returned EAX pointer, and caller/socket/timeout
from the owned frame, at RET before the following CMP. Independent genuine
threaded CALL/RET controls varied all four memory words through zero, one,
high-bit and all-one values and observed those exact words. Wrong target CALL
still performs its real stack/PC transfer but marks the observer rejected; it
does not repair the guest. After capture, corrupting memory/registers cannot
rewrite the historical record.

Token, thread, register bank, pre/post ESP, select return/result, phase,
completion count, active/fault/capped state and native register/return frame
were independently challenged. Stale owner state rejects; foreign owners are
inert and the original owner can subsequently capture. Supplied tests additionally
exercise nested relative returns below the frame, nested register-call rejection,
reentrant/wrong-token completion, early closure and terminal callbacks. UOP off/on
at each live observer stage permanently rejects; it never creates a successful
fallback record. Unsupported modes and disabled/inactive paths remain inert.

Independent byte mutations reject each pinned original binary. Every consumed
loaded CRT/SDL_net/executable anchor byte, relocated SDL_net operand, IAT,
module base and main image base was challenged; all wrong cases reject.

## Remaining gates

1. Install the complete six-fragment output together and complete a separately
   admitted canonical build, validation and instantiation for this exact source.
2. Qualify the full UOP compiler, optimization/trace entry and exit paths and real
   threaded dispatcher together, including warm traces, instruction boundaries,
   original loaded modules, mode switches and cross-thread ownership. The tiny
   prefix module does not establish these end-to-end properties.
3. Qualify authentic original `_getptd`/TLS/native CRT execution, loader state,
   sockets and the actual select invocation. The fixture native `_getptd` is a
   control, not evidence about the game's CRT state.
4. Obtain an authorized bounded authentic game observation before CMP for errno
   and caller. The original reason-3 capture remains unchanged and both values
   remain UNKNOWN. No gameplay claim or original-game capture was made here.

No box was assigned or queried; state/expiry are not applicable. The coordinator
retains lifecycle ownership. No canonical compilation, guest, runtime/SSH access,
service restart, deployment, main merge or worker launch occurred.

## Process qualifications and recovery

The initial pre-test receipt verified full compiler identity and Git blob, but
did not yet record byte-exact excerpt hashes. Those were recorded before the
expanded independent rerun; the initial ordering lapse remains disclosed in
`incidents.json` and is not retroactively claimed compliant. An incorrect local
origin URL in the setup script was corrected to the donor's actual origin before
any network operation; the corrected recipe is retained. Neither issue changed
the implementation or test oracle.

The isolated branch contains only this independent test and review/evidence.
Root worktree/index/refs and all donor repositories were read-only, with the
append-only messageboard exception. Resource receipts include focused checkout,
Git, generated fixtures, evidence/publication, launcher/session and positive
shared DB/WAL growth once, future growth and an 8 MiB reserve within 64 MiB.
Installed Node and compiler and standing source/binary donors are accounted
separately. All Node commands use a 192 MiB old-space ceiling, CPU 35/40 s,
wall 50 s, output 128 KiB and file 24 MiB guards; children were reaped.

See adjacent `RECOVERY.md` and `evidence-manifest.json` for exact paths, hashes,
commands and recovery. The coordinator's already verified 26 candidate evidence
payloads were reused by reference; this review independently verifies the tested
source pins and its own evidence rather than claiming a second 26-payload audit.
