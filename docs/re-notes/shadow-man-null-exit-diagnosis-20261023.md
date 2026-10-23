# Shadow Man Beenden: modal ownership boundary established; zero writer unobserved

Offline diagnosis of retained run `20261023-shadow-man-settings-observer-repair-runtime`
(published b47634c719a289e2f1ab6e5067c0d8c1995c012a). No production repair.
The earliest proven incomplete execution boundary is the first synchronous
WM_COMMAND callback abandoned after opening Configuration. The final failure is
proven only as a sampled EIP=0 after ordinary Beenden/EndDialog, with last decoded
block 0x004015d4. Neither an indirect NULL call, a NULL RET, nor an escaped
continuation sentinel is established. The harness message is a classification,
not an instruction trace.

A specific, source-supported candidate is a split between restored caller
ESP/EIP and surviving modal-pump globals/stack frame. The final ESP fits that
candidate particularly well, but key registers and the final opcode are absent.
Treat it as the priority capture target, not an established cause or repair.

## Proven observations and their limits

The [retained log](shadow-man-null-exit-diagnosis-20261023/retained/session1-fixed-session.log)
contains these API entries (guest addresses as recorded, without assigning
unobserved x86 instructions):

| Entry | HWND/template | API ESP | saved guest return |
| --- | --- | --- | --- |
| DialogBoxParamA #172 | template 0x7a, original launcher | 0x074fff50 | 0x00402fd5 |
| EndDialog #173 | 0x10001 | 0x074fff30 | 0x00402937 |
| DialogBoxParamA #176 | template 0x7c, Configuration | 0x074fff20 | 0x00401504 |
| EndDialog #226 | 0x10006, Configuration OK | 0x074fff28 | 0x004022f6 |
| DialogBoxParamA #227 | template 0x7b, new launcher | 0x074fff18 | 0x004015d4 |
| EndDialog #228 | 0x1001c, ordinary Beenden | 0x074fff30 | 0x0040295e |

The first two command injections each end with `ABANDONED wndproc`, 64 rounds,
EIP 0x07500218 and yield_reason 15: original launcher WM_COMMAND/1024, then
Configuration WM_COMMAND/1. At the second boundary the log already contains
EndDialog(Configuration) and creation of the new launcher. These warnings prove
incomplete synchronous delivery; they do not prove which memory word later
caused zero execution. The after-OK snapshot still has both old dialogs visible
alongside the new launcher. Visibility alone is not guest frame liveness.

Beenden #228 precedes the input receipt for command 3 because `dlg-cmd` calls
`send_message` before logging its receipt (`test/run.js:8461` in the exact
runtime; locate by the branch text if line numbers change). The first zero sample
is at the same batch 2578996. It reports `dbg_prev_eip=0x004015d4`,
ESP=0x074fff6c, [0x074fff68]=0, [0x074fff6c]=0 and
[0x074fff70]=0x0040363e. The last word is only a retained stack value; it has not
been identified as an executed return address. No guest ExitProcess was observed.
OS -9 is external watchdog termination, not a guest exit code.

The observer JSONL's three `DialogBoxParamA` records labelled `return`, each
EAX=1, are host API-handler-exit hooks. The handler redirects to the initial
DLGPROC before the modal guest call finishes. These records do not prove normal
DialogBox/callback completion. See the retained JSONL and donor observer
`h.log_api_exit` wrapper.

## Exact source boundary

Source was recovered locally and verified by Git blob identity against actual
runtime 58e90870a40a541a4083cae5e987ca8de31889e6, not the host's differing working
copies. Admission manifests give origins, sizes and blob pins; nine source files
are checked by `check.py SOURCE_ROOT`. Main bb9c496e is the assigned docs successor;
module actually consumed was 1,879,387 bytes, SHA256
ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553.
The module and guest executable were not fetched or decoded here.

- `src/09c3a-dialog-runtime.wat:33` `$wnd_send_message_inner` saves caller
  EIP/ESP/GPRs and yield state, pushes a 20-byte synchronous callback frame,
  and drives bounded recursive `$run` calls. At lines 248–299 the 64-round
  path logs abandonment, checks invocation identity, leaves its sync depth,
  sets completion false and restores saved caller registers/yields. It does
  **not** roll back guest memory or modal-pump globals. This is the earliest
  proven incomplete callback ownership boundary in this session.
- `src/09a-handlers1-user.wat:2078` `$handle_DialogBoxParamA` saves the previous
  modal globals into its consumed argument slots at API ESP+4..20, records
  its return address globally, and keeps a 24-byte API frame under the initial
  callback frame. The current pump HWND/proc/return address change immediately.
- `src/09a-handlers1-user.wat:1418` `$handle_EndDialog` marks the matching active
  modal ended and yields; it does not itself complete the modal API's return.
- `src/09b-dispatch.wat:961` CACA0004 consumes any callback sentinel, and on
  modal completion reads the previous pump from **current ESP+4..20**, sets EIP
  to the captured `dlg_ret_addr`, and advances ESP by 24. Correct ESP ownership
  matters independently of correct invocation-token checks.
- `src/09b-dispatch.wat:1331` CACA0005 deliberately sets EIP=0 to stop the
  synchronous nested run. Normally the sender restores caller EIP afterward.
  Thus the mere presence of a zero writer in this source is not proof that it
  escaped in this run.
- `src/13-exports.wat:281` handles thunk-zone entries before updating
  `dbg_prev_eip` at line 311. `src/04-cache.wat` also updates it on decoded-block
  transfers. It identifies decoded-block context, not necessarily the last
  instruction or last WAT continuation that wrote EIP. `test/run.js` samples
  EIP after work and prints the NULL label if zero without a host exit request.
  It does not distinguish CALL/RET/JMP/continuation writers.

## Discriminating offline control, not guest reproduction

Run from this focused checkout:

```
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-null-exit-diagnosis-20261023/check.py .
```

Without the optional `.` argument the retained evidence checks are standalone.
Exit 0: exact trace order/frames/stack/real cfg verified, six corrupted-evidence
controls rejected, nine runtime source pins verified. The script is an evidence
validator and conditional frame arithmetic, not an emulator or x86 reproducer.

For the new launcher's recorded API frame F=0x074fff18, coherent completion
would consume that frame and produce ESP=0x074fff30. If instead the abandoned
sender has restored the original launcher's F=0x074fff50, the same CACA0004
arithmetic produces ESP=0x074fff68. A **hypothetical** subsequent plain RET
would then produce the observed 0x074fff6c; the coherent control would produce
0x074fff34. This is an exact numeric fit to the displaced-frame hypothesis.
It is not proof: the retained run does not expose the pre-send/restore ESP,
CACA0004 entry ESP, or bytes/terminator of the block at 0x004015d4. No RET opcode
is asserted at that address. The zeros sampled at 0x074fff68/6c are after the
failure and have no recorded write provenance. Other stack adjustments or
zero writers have not been excluded. Six rejecting controls establish validator
sensitivity, not production correctness.

## Exact missing observation and minimal next action

No further runtime action is authorized by this task. A separately assigned
capture should reuse the retained exact executable/module and prepared complete
VFS/registry under coordinator lifecycle ownership. Do not use the partial
479-file save-vfs export as input, repeat restoration/helper construction, or
change the configuration bytes to make a test pass.

The smallest useful next observation is to stop at **0x004015d4 before it runs**
after Beenden, retaining all GPRs including ESP/EBP, 0x80 stack bytes around ESP,
and 0x40 code bytes there from the actual loaded executable. Existing flags
`--trace-at=0x004015d4 --trace-at-limit=1 --trace-at-mem=esp-0x20:128,0x004015d4:64`
provide a starting point (confirm the existing argument parser on that revision).
This point is a recorded API continuation/last decoded block, not an assumed
faulting opcode. Existing break/small-run control should stop after its first
zero transfer; do not let another long run overwrite the failing frame.
If the breakpoint is not reached, retain that fact and capture the thunk writer.

To confirm or reject the ownership candidate, the same tightly bounded diagnostic
needs tuples at the sender's pre-call and restore boundaries and CACA0004's
completion boundary: EIP, ESP, saved old EIP/ESP, `dlg_pump_hwnd`, `dlg_ret_addr`,
SHARED_DLG_PUMP_HWND/ENDED, invocation token/root/depth, current thunk metadata,
ESP+0..24 and the original/new frame words. Capture the actual write that first
sets EIP=0: decoded opcode address/bytes and target source word for CALL/RET/JMP,
or the CACA continuation tag and restored caller state. These internal modal
fields are not all exposed by the existing runner; a bounded diagnostic hook
would be necessary if the existing breakpoint/register trace leaves ambiguity.
Do not invent fixed allocated WAT addresses to read them.

A captured resumed ESP=0x074fff50 with active frame 0x074fff18, followed by
CACA0004 completion at that wrong ESP and a decoded zero transfer, would promote
the candidate to a concrete defect. A correct modal ESP would reject this
candidate and focus attention on the recorded block's actual return/target or
an escaped synchronous sentinel. Only then design a focused positive/rejecting
native test and narrow production repair. No speculative source change here.

## Retention and handback

The genuine [50-byte grafix.cfg](shadow-man-null-exit-diagnosis-20261023/retained/session1-grafix.cfg)
is published with SHA256 0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d.
Configuration defaults 640x480x16 and enabled post-OK Spielen remain accepted
coordinator visual observations; persistence, Play and gameplay are UNTESTED.
The corrected historical separator/TAB diagnosis is accepted without reinvestigation.
The [donor recovery recipe](shadow-man-null-exit-diagnosis-20261023/retained/DONOR-RECOVERY.md)
is retained verbatim as historical state, not current box lifecycle authority.
Originals/module remain in the coordinator snapshot; Git retains this small
trace/config/recipe package, not the ignored installation or binaries.

Box bx_fn7pn7yg was already snapshot-STOPPED by coordinator operation
stop_428de72b6f35166b, completed 2026-10-23 03:03:34.606 UTC (task input).
Historical expiry was 2026-10-23T03:46:00.580Z. No box API or runtime contacted;
no resume/fork/new/exec/stop, build, worker launch, main integration or deploy.
Coordinator retains lifecycle ownership. Task stops at this precise evidence gap.

Final conservative whole-task measurement is in `measurement.json`: it includes
used donor evidence/Git/source, own checkout/Git, measured tool executables,
8MiB tool-library/temp/future-growth allowance and 8MiB reserve. The initial
8MiB combined tool allowance was provisional and smaller than the later measured
executables; the corrected envelope remains below 64MiB. Original admission
is retained, so this measurement limitation is explicit. Host floor passed.
