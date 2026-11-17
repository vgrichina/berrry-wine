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
