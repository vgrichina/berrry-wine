# VB5 CCE: nested owned MessageBox and supervisor shutdown

Evidence: `scratch/runs/20261117-vb5-nested-owned-modal-install/`.

The preceding original pipeline remains permanently closed. Its retained public
snapshot showed MessageBox `0x10018` owned by live DialogBox `0x10012`, with no
main window. The previous scene validator refused `modal.ownerless`; the owner
was not zero. Its outer exit 143 also lost native/watchdog wait and descriptor
release records. Process absence established cleanup observation only.

The native MessageBox API now seals its creation against the active DialogBox
invocation. Actor-local native values retain both HWND generations, the owning
process/thread, the DialogBox callback and return site, and the MessageBox call
return site. The observation export independently checks the live common-modal
pump, actual USER class/owner/thread, original DialogBox invocation, callback,
generations and return sites. Destruction, retirement, reuse, actor changes or
callback replacement invalidate the seal. No title or application-specific
identity participates. Scene admission requires this chain to match the actual
public owner and MessageBox identities. Class 16 and a live owner alone confer
no new admission.

An authored PE calls MessageBoxA with YES/NO + QUESTION from its real DLGPROC,
then returns to the exact outer invocation. Real native BUTTON inputs exercise
the transition and subsequent main creation. Fault cases retain the existing
finite-input cancellation and permanent UNKNOWN behavior. A separate real CPU
Worker runs the same PE and reads the native seal through its actual export
channel, including owner/generation/actor/callback/retirement refusals and
return restoration. This does not claim that the CLI's main-instance focus
snapshot can capture an arbitrary Worker-owned GUI; that separate limitation
remains fail-closed.

The Python supervisor catches outer TERM/INT, preserves exit 128+signal, and
unwinds through native process-group termination, actual wait, watchdog pipe
drain/join and sealed descriptor release. Repeated shutdown signals cannot
interrupt that cleanup. Regular native log files are described as regular files,
without invented pipe EOF claims. Actual native/watchdog/outer fixtures cover
normal exit, TERM143, exceptions, timeout, native EOF and watchdog deadline.

Original media and the genuine same-package SetupAPI/CFGMGR32 staging remain
unchanged. Original execution now seals one exact published Git tree, including
all helpers; local overlays are allowed only for authored working qualification
and are rejected for any original launch. The final result records publication,
qualification, the one authorized fresh original outcome and its next boundary.

## Published qualification and original result

Material commit: `efcf47369966a1bcc1f0e8b0a2d74f99c1eca293`, published on
`main` with strict pull/push exit 0. The required canonical flock build passed.
Fresh qualification and the single original used that entire published Git tree,
without overlays, with module SHA-256
`2c7d23d9c735bdec75884528482e1b1d8c73334bd02c8d1f3b15850011b57093`.
The empty owned-helper patch and excluded worktree patch are retained; no older
native-core composition or shared WIP entered the original.

That exact module passed the nested native suite (positive plus nine refusal
cases), six actual CPU Worker cases, six supervisor shutdown cases including
truthful outer exit 143, and all existing DialogBox, ownerless, QUESTION,
controller, progress, mapping, context and button guard suites. Genuine
SetupAPI/CFGMGR tests passed in main, Worker and child execution, including real
image exports, INF/queue operations, retirement and sealed inheritance. Each
subprocess has its actual wait record. Earlier working-module results are not
substituted for these fresh published-source proofs.

The fresh NT4/defaults/real-tick original passed the former boundary. The public
snapshot and native seal agree on MessageBox `0x10018`, generation 24, owned by
live DialogBox `0x10012`, generation 18, process 1000/thread 1. The outer callback
is `0x1ab9a44`, outer return site `0x1ab9a3e`, and MessageBox return site
`0x1ab99b7`. Its personally reviewed create-folder Yes completed in 210 ms with
independent physical UP. The installer then displayed **installation complete**.
The flushed overlay has 258 records, including the 1,818,384-byte
`C:\Program Files\VB5CCE\VB5CCE.EXE` and seven sample `.vbp` files; the registry
export has 836 entries. This establishes installation output, not IDE or sample
execution. The native log also retains the unavailable `grpconv.exe` diagnostic
and held-critical-section-at-exit warning.

Final installation-complete OK had native DOWN `CONSUMED` and independent
physical UP ACK. Its mandatory post-click snapshot failed with connection refused
as the installer exited, so the controller wrote **PERMANENT UNKNOWN**. There
were no later HTTP requests, rebindings, stage-one launch, replay or second
original. IDE/sample/nativeQuit remain unattempted. The concrete next boundary
is reviewed-intent completion across a normal native process exit: it needs an
authored fixture and truthful native wait integration, preserving fail-closed
UNKNOWN for ambiguous exits. A closed endpoint alone is not successful completion.

The original native process was actually waited with exit 0; its output was in
regular files, with no pipe-EOF claim. The independent watchdog was actually
joined with exit 0 and both pipe EOFs. The supervisor tool session actually
returned 0, and `runtime-release.json` records all owned descriptors closed.
The TERM fixture separately retains actual outer exit 143 and all native and
watchdog joins. Process/port absence is corroboration only. Eight selected named
images remain, with hashes; redundant qualification/extraction images were
removed. No box was created: ID null, state NOT_CREATED, expiry null, stop receipt
not applicable. The old original pipeline remains closed.
