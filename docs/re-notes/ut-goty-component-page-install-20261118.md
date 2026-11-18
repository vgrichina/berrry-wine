# UT GOTY component list observation

Evidence: `scratch/runs/20261118-ut-goty-component-page-install/`.

Fresh original `trace-components3`, using the unchanged unique CD1 ISO and
accepted `8e295597b` module with its matching Git region mirror, reaches the
component page through ordinary Next, I Agree and default destination Next.
Each has the accepted DialogBox callback-return receipt and independent UP.
Actual child `0x10030`, generation 48, id 8192 is class 4 with style
`0x52a00121`: LBS_OWNERDRAWVARIABLE without LBS_HASSTRINGS. Its procedure and
parent `0x1002f` procedure are `Window.dll`'s `0x10579235`. Retained native
state exists: count four, current selection zero, top zero, four empty native
string placeholders, and four opaque DWORD item-data values. These values
are not labels or checkbox states. The string-only observation getter returns
-1 by design; absent state is not the cause. Capture reproduces the original
unsupported-class refusal and closes the scope with no later endpoint.

The repair adds a separate read-only `native-listbox-opaque-storage-v1`
contract. It observes bounded DWORD item data and selection, pins actual
style/procedure/parent identity, and reads retained values twice. It neither
decodes these DWORDs as pointers nor dispatches guest messages during capture.
The string getter still refuses no-string owner-draw lists. Guest subclasses
and existing WM_MEASUREITEM/WM_DRAWITEM own painting; capture uses the actual
composed canvas. The general capture guard and input completion remain intact.

An authored list reproduces the actual style, guest subclass and guest owner,
with null, all-bits and non-address item data. Direct native and normal
CPUWorker execution reproduce old refusal and pass the new observation; the
real guest WM_DRAWITEM receives all four exact DWORDs, and whole canvas PNGs
show the guest's four labels. Tests cover read-only observation, changed data,
callback replacement, missing state, unsupported procedures, retirement,
identity/style/owner mismatch and fabricated text/check-state rejection.
The prior string-list test now explicitly distinguishes the opaque contract
from the still-refused string getter. Publication and affected original
installation results are recorded below when complete.
