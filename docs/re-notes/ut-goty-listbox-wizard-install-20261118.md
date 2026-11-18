# UT GOTY subclassed listbox capture

Run: `scratch/runs/20261118-ut-goty-listbox-wizard-install/` (ignored evidence).

The unchanged original installer has a live listbox 0x1000c, class 4,
id 1017, whose actual procedure is Window.dll + 0x1235. Its retained native
storage contains one item, English (International). The former observation
getter rejected this real guest subclass solely because its procedure was
not the native procedure. This is the confirmed cause of the capture refusal.

The repair adds a read-only native-listbox-storage-v1 contract. It observes
retained storage and explicitly records the current procedure and paint owner.
It does not claim that retained strings equal a subclass's virtual LB_GETTEXT
results. Guest dispatch, callback ownership, and painting remain unchanged.
Other common control guards remain native-only. Generation, actor, procedure,
memory stability, class, absent-state and owner-draw restrictions still apply.

An authored ordinary installer-style listbox reproduces the old native capture
refusal and passes after repair (87 ms). Focused tests cover read-only memory,
real subclass identity, procedure sentinels, owner-draw strings, missing state,
retirement and reused HWND generations. Existing common-state and parent-first
paint regressions pass, as does the locked build.

Native modal pointer Next and a separate fresh Cancel produced owning
native-button-dispatch-return receipts and independent UP acknowledgements.
Cancel exited normally with code 0 and actual waits/both pipe EOF. Keyboard
Enter instead reached UNKNOWN at its immutable deadline; that scope was closed
without replay. Ordinary browser trusted Next also reached the guest callback,
but the subsequent whole UI was incomplete. These limits are retained in the
run; they are not installation success claims.

Published repair: `d95d86750` (strict pull and push succeeded). The fresh original
native scope using retained module SHA-256
`15dad7370e66f19628a314809c929ef5e00c86436013be7b3167dc96901746b2`
passed reviewed capture of the complete welcome, including the actual subclassed
listbox. Its ordinary pointer Next reached the guest: the runtime log records
creation of the license-page controls. The receipt, however, returned
`CANCELLED`, `handlerApplied:true`, `native delivery context changed`,
`noReplay:true`. Independent UP acknowledged release. No later runtime endpoint
was requested; filesystem cleanup completed with actual native/supervisor/watch
waits and both pipe EOF. This is not ordinary Cancel or a qualified license-page
capture.

A separate fresh ordinary production browser imported the same read-only ISO,
used normal Workers and a normal writable session overlay, and verified actual
Worker module bytecode. Its startup whole page displayed the complete original
welcome. A subsequent whole-page capture lost all installer controls before any
browser input. No unreviewable target was clicked. The requested entry cwd was
D:\\; the host VFS observation at startup was d:\\system\\, so inherited-root
context is not asserted for this browser route. Browser closure and watchdog
have actual waits and pipe EOF.

The bounded next blockers are native delivery-context invalidation across this
real Next transition and browser presentation disappearing while idle. Install
was not pressed, required expanded space is unknown, and the pre-install gate
remains closed. No installed game or original startup is claimed. There were no
boxes, Wine reference, state injection or media duplication. Exact identities,
binary delta, recovery paths and evidence limitations are in the final run
result.
