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

Fresh original outcome and exact publication/module identities are recorded in
the final run result. No Wine reference, state injection or media duplication
was used.
