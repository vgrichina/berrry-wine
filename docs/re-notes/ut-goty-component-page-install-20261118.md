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
from the still-refused string getter. The focused tests and final locked build
pass. Repair `0f544db09` was immediately strict-pulled/pushed successfully.
The tested/final module is byte-identical, SHA256
`b9b3ba8e195212293e955e778292aef27a0b73817179b12fc1620e272a3ecef9`.

Fresh affected original `original-install` uses that module, unchanged
`D:\System\Setup.exe`, inherited `d:\` cwd, the unique retained ISO SHA256
`e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`, and an
initially empty normal overlay. Ordinary Next/I Agree/default destination Next
all have real callback-return receipts and independent UP. Whole
`components-ready.png` shows the guest's four rows: Unreal Tournament Game,
Game Content, NetGames USA Stat Utils, DirectX. Actual displayed required space
is 670 Megabytes; the selected game row says "Installation is required."
Default component choices are preserved. Native row selection is not a
checkbox state, and no check state is inferred from opaque DWORDs.

Before any component Next or Install, a fresh whole capture 43.963 seconds
later (`components-final.png`) shows only the teal desktop. Its native dialog
and component metadata still report visible/live, unchanged generations 1/48,
focus `0x10002`, modal `0x10001`, main HWND zero. There was no intervening
input. This is an actual native presentation loss, with cause unknown, not a
retroactive explanation of the separate prior browser/cwd unknowns. The scope
closes UNKNOWN with no subsequent runtime endpoint or input. Install is not
pressed, no installed game/startup is claimed, and the overlay contains just
the normally created destination directory. No browser fallback was attempted.

Host free space at requirement review is 2,515,595,264 bytes, separate from
the guest's displayed 1023 MB. The scope's independent watchdog measures a
minimum 1,925,365,760 bytes, above the host floor. Filesystem cancellation after
closure has actual native/supervisor/watchdog waits and both pipe EOF, plus an
owner-complete record. The original enclosing launcher tool returns 143 and
does not retain an enclosing-owner wait/EOF receipt; that gap is explicit,
and complete cleanup is not claimed. The earlier three trace scopes retain
all four waits/EOF, including enclosing owner. No boxes were created.

Exact Git patches, module binary delta and verified reconstruction, media and
dependency recovery, selected captures, receipts, wait audit and limitations
are in the run's final `result.json`. Next work needs a bounded reproduction
of this native idle presentation loss before attempting further installer
input; the closed scope must not be reopened.

## Correction: idle presentation claim withdrawn

The ready and allegedly teal-only final PNG cited above have identical SHA-256
`3ebe8bf2648f25f47c95f6b4484f400253a67b854fdd180646d30063bb7ea79a`.
Fresh bounded tracing and decoded pixels retain the complete dialog. The
image viewer intermittently displayed those same bytes as teal-only; native
presentation loss and main-HWND causation are therefore not established.
See [the correction and original continuation](ut-goty-idle-dialog-presentation-repair-20261118.md).
