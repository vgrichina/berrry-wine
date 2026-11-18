# UT GOTY owned wizard selection repair — 2026-11-18

Evidence: `scratch/runs/20261118-ut-goty-owned-wizard-install/` (ignored).

The original installer reaches the genuine `D:\System\Setup.exe`, with inherited `D:\` working directory. This task reused the existing 649633792-byte CD1 ISO, SHA-256 `e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`, through normal read-only media import. Previous scopes stayed closed.

Passive USER assignment tracing established the blocker: the modal root was real top-level HWND `0x10001` (parent/owner zero, style `0x90c80ac0`), but a nested modeless WS_CHILD page `0x1000a` was adopted by CreateDialogParamA while main was zero during initialization. Focus correctly resolved to the root; reviewed capture rejected `main.topLevel`. This was USER state, not renderer surface classification.

The general repair excludes WS_CHILD from both initial CreateWindowExA main adoption and the native-helper CreateDialogParamA fallback. ShowWindow explicitly permits absent main: `wnd_is_effectively_visible(0)` returns true as the ancestor-walk terminator and cannot answer whether an existing main is visible. Parent/owner, retained application DLGPROC, generation, process/thread and lifetime guards remain in place. No guest HWND, focus, registry, INI or installer patch is used.

An ordinary authored modal dialog creates Static wrappers and nested child dialogs before showing its root. The old module reproduces the wrong child main in native and normal browser guest-worker launches. The repaired module selects `0x10001`, retains the child parent chains, and produces whole native and browser screenshots. Browser actual worker bytecode is SHA-verified. Focused USER tests also preserve genuine owned-popup promotion; the full authored native/browser regression checks absent-main ShowWindow. Targeted callback reviews retain the ownership census gates.

Native capture qualification measured 141ms on the initial fixture and 440ms on the repaired nested fixture. Published finite controls keep a 3000ms observation window and 30-second menu review freshness, selected before the original launch from these measurements; 3000ms is not an owner mandate. The authored Next pulse exposed a separate 500ms confirmation timeout; independent physical UP was acknowledged and that scope closed without endpoint replay. No authored input success is claimed.

The final original result and publication receipts will be appended after the tested repair is published and the affected original is exercised. Installation/gameplay remain unproven at this publication stage.
