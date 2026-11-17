# Half-Life 2 persistent launch owner and normal installer

Evidence: `scratch/runs/20261117-halflife2-persistent-owner-normal-installer-progress/result.json`.

The launch route now puts the unchanged actual-parent process supervisor under
a dedicated waiting process. That process pins this single-task Codex worker's
PID and kernel start token with a pidfd, verifies actual ancestry, clears the
inherited transient-thread PDEATHSIG only after pinning, and checks the death
race. It keeps the worker pidfd through its actual outer-child wait and both
pipe EOFs. A separately armed owner deadline watchdog precedes outer startup.
The outer retains its ordinary parent pidfd, scoped cancellation, native
600-second deadline and independent 620-second runtime watchdog.

The process tests actually return and reap a transient launcher, prove that the
healthy dedicated owner remains, and inspect the actual supervisor's live
parent pidfd in `/proc/PID/fdinfo`. Killing that dedicated owner must make the
supervisor observe its parent death and cancel its child. A subreaper witness
performs actual waits for the orphaned outer and owner watchdog. Separate tests
exercise the independent owner deadline. Native route tests use the real
DialogBox wizard, adapter signal cleanup, compiled sealed module and fresh
main/CPUWorker/OS-child inheritance; native wait, both EOFs and descriptor
release are required for normal completion and actual owner death.

The previous fully repaired wrapper, actor refusal, native-core and cleanup
proofs are referenced by hash rather than regenerated. Source composition is
explicit: base Git `70e85792eefac2489f655a415490f9e0a5c9297d` plus the exact
published Half-Life helper/component blobs. Every unchanged source must match
the previous repaired qualification map, and the compiled module must match
that proof. The owned component patch and Git identities recover the source;
there is no source archive. Later unrelated emulator changes are not claimed
as qualified by this run.

The prior UNKNOWN endpoint remains permanently closed. Normal installer input
still requires a newly captured complete image and personal review for every
finite intent. The actor/focus/modal/generation/context/target/nonce checks
and 500/1750/3000 ms deadlines are unchanged. Successful normal installation
and authenticated launch provenance remain prerequisites for any installed
game invocation. No box or additional worker is used.

Initial authored route attempts are retained as failures. One test expected a
CreateWindow line from a CreateDialog fixture. A second ran the dialog without
the original's control port, so the tight fixture loop deferred SIGTERM and the
outer's five-second grace expired, losing adapter-finally receipts. A third
supplied a native exit receipt without its required invocation token and was
refused at startup. The corrected authored command includes the original's
control/event-loop mode and a matching UUID receipt token. These are fixture
corrections, not evidence of a fault in the original installer.

Published route fix: `9945c2998002040fb5db955cf813258aa120dca9`. Both successful
authored native route source maps were compared to those published component
blobs byte for byte. This exact match reuses the completed route tests after
publication; it does not claim they were rerun under a later unrelated tree.

The one authorized unchanged original invocation then completed two personally
reviewed normal Next intents: Welcome and Internet Connection Required. Both
returned `native-button-dispatch-return`, consumed by actual native BUTTONs
`0x10011` and `0x10017`, with independent physical-UP acknowledgements and
aggregate completions below 500 ms. The full scene was freshly captured and
personally reviewed for each intent. Native logs then recorded creation of
Steam Subscriber Agreement and its normal Agree/Do Not Agree controls.

The next complete-scene capture failed closed with
`control.unsupportedClass` and `control.textUnavailable`. No agreement image
was obtained and no agreement input was sent. This is the measured next
boundary. The refusal reply does not identify its offending HWND or the
reason native text was unavailable; the exact underlying control/text cause
remains unproved. The tags alone do not establish an unsupported actual class
because the supported-control predicate also requires available text. There
is no original runtime or storage fault claim and no speculative admission
change. Further diagnosis needs a separately authorized run with native
refusal identities retained before the gate, followed by an authored faithful
reproduction. Active shared capture/runtime files were not changed.

The endpoint permanently closed on this refusal. There were ten HTTP requests,
two native DOWN edges, both followed by confirmed physical UP, and zero requests
after the UNKNOWN latch. No retry, replay, rebind, second original, successful
installation, installed game invocation or gameplay occurred. All original
native, adapter, outer, owner and independent watchdog waits completed with
both EOFs. The dedicated actual parent remained alive through join and its
worker pidfd owner remained healthy. The native exit is a SIGTERM host-cleanup
cancellation, not a native Quit. The installer allowance is spent.

Only the two named original screenshots are retained. Four duplicated normal
extraction outputs were replaced after closure by exact original-media stream
recovery recipes, with complete decoded-byte and CRC/SHA roundtrip verification.
Unique runtime output remains. The original EXE hash was verified again after
closure. No box was created; ID and expiry are null and stop is not applicable.

An additional authored route fixture explicitly sets inherited
`PR_SET_PDEATHSIG=SIGTERM` before executing the same owner. All three actual
process cases record inherited 15 and safely cleared 0, then prove healthy
survival, parent-death cancellation, or independent deadline cleanup. During
that diagnostic, a live `/proc/PID/fdinfo` descriptor closed between enumeration
and reading; the test now ignores such vanished unrelated descriptors while
still requiring a matching live parent pidfd. This changes test robustness
only. The original's sealed source graph and executed component bytes remain
those recorded under `9945c2998`, before this follow-up test edit.
