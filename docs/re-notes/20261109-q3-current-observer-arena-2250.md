# Q3 current observer: offline gate passes; remote wrapper cwd fails first

Evidence: `scratch/runs/20261109-q3-current-observer-arena-2250/`.
Code `a9d727ebfafa2769e227035666d58cf622b3a24f` is published on main.
The live result is **harness failure**, not a reviewed fixture or arena result.
Original Quake 3, alive arena, movement and firing remain unverified.

The current preparer now seals `phaseLayout` in both the provider manifest and
its seal. Each phase names its generated prepared directory, execution boundary
and current consumer output directory. Generated runtime boundary seams are
checked during preparation. The fixture consumer publishes absolute image and
capture-metadata paths with review readiness. The new read-only
`tools/q3-phase-observer.py` follows that sealed layout, checks terminal markers,
compares capture identity and image SHA, and permits exclusive review publication
only for an exact image/identity with a clear separate model review. It performs
no browser, input or capture protocol work.

Offline verification executed real current preparation, compiled the actual
current generated consumer and checked its output/gate against the layout, then
exercised the actual input service and Python observer together. Positive review
admits one input; wrong SHA, wrong identity, unclear review, terminal and changed
image admit none. Obsolete-path publications refuse. The existing actual service
controls pass (five review cases), and current foreign-closure controls pass
(27 refusal cases, real CLI/relative caller/preflight, no browser). The required
`flock /tmp/wine-build.lock bash tools/build.sh` passes. The old default
`q3-current-module.test.cjs` fails because it expects an obsolete prelaunch
provider; the explicit foreign-route test confirms that default refusal and
passes today's route. Accepted transfer-only tests were not rerun. No local
Chrome or workers were started.

Before allocation, all 946 provider pins and five phase manifests were separately
reread. Manifest SHA is
`f33edf7f0caf5547cb80a3dba4a1ab5312551842b1b5f84e6fe6f17934bb962a`.
Recovery records exact Git plus a 49,417-byte patch for eight owned generated/run
inputs. Existing provider/media bytes are path/SHA references with tracked
recovery mappings or a reference to the retained prior patch; no source/media
archive was made. The accepted bounded HTTP provisioner transferred and verified
950 final files, including the actual pak, and both remote phase barriers passed.

The **first live failure** was the task-local observer invocation at
2026-11-09T22:56:48.592Z. Boat executes commands from `/home/user`; my wrapper used
`runpy.run_path('tools/q3-phase-observer.py')`, resolving to
`/home/user/tools/q3-phase-observer.py`, outside the checkout. The offline tests
covered the helper and consumer but missed this actual remote wrapper/cwd. The
failed command and original first-terminal marker are retained unchanged. No
model review was returned, no input was armed, and no original was admitted.
There was no retry, dependent input, operator capture, quit or guard extension.

**The strict terminal-stop invariant also failed.** The observer failure was
recorded locally without immediate coupling to native cancellation. Autonomous
fixture startup continued: its one screenshot began at 22:56:51.535Z and finished
at 22:56:51.785Z, after the first failure. Explicit native cancellation was
published at 22:57:11.917Z. The provisional first-terminal marker's
`noLaterInputCapture` field is an intent, contradicted for autonomous capture by
the retained transport and capture timestamps; it is not acceptance evidence.
Actual transport contains zero Input requests and zero Browser.close requests.
Postmortem model inspection of the recovered image shows a red stepped triangle
on black with white page surroundings; it authorizes no later input and does
not qualify a working reviewed fixture. No successful gameplay claim is made.

All 163 owned native tasks were reaped. Three parent receipts retain actual waits
and separate stdout/stderr EOFs. A separate reread verified 54 unique recovered
artifacts by stored and original SHA/size; gzip and PNG CRC checks pass before
shutdown. Exactly one delegated normal stop archived `bx_4w352ebj`, UUID
`891d81eb-9a1c-45ae-92e9-39f83c0bad88`, at 22:57:55.357Z. Stop receipt
`stop_53ee6e1b3c4a70db` is completed, forced false, error null, independently
reread through the API. Initial expiry was 23:20:37.240Z; final archiveAfter is
null. The independently observed immutable watchdog deadline was
23:20:38.009834Z. Its real parent wait returned zero with separate EOFs and its
config hash is unchanged. No owned box remains live; /home remains above 1.5 GB.

Next authorized attempt must use absolute remote helper paths, test the actual
wrapper from `/home/user` offline, and connect observer failure directly to the
owning native cancellation path. This task stops at its first live failure;
there is no second box or original attempt here.
