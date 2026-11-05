# Recovered Conan magazine demo: ordinary installation

Task `NEW-GAME-CONAN-DEMO-20261010`; evidence:
`scratch/runs/20261105-conan-recovered-installer/`.

The recovered Herni Vyber 23 demo installer ran through ordinary installation
and displayed **“Conan Demo has been successfully installed.”** Guest license
acceptance is observed. The wizard's normal exit and game launch were not
established. This is installation progress, not gameplay, and no emulator
Win32/x86/rendering/input defect was demonstrated.

## Media and execution

Verified the existing file in place, without another media copy:
`scratch/game-media/conan-demo-20261105/ConanPC-Demo-from-Herni-Vyber-23.exe`,
126741363 bytes, SHA-256
`73038ac99299abc8d5e0cef28d83324e6b493fecdbd21fd65964919376fa3007`.
This is the recovered magazine-disc demo; historical installer size/hash remain
unknown and historical equivalence is not claimed. Read the recovery receipt
and `scratch/runs/20261105-conan-reconstruction-preflight/result.json`.
The known archive-listing exit 2 was not repeated.

After Aranna1710 and Shadow1800's exact FINAL releases, plus AOE3 prerequisite1830's
source-only FINAL relinquishing its unused slot, independently verified 298
recorded PIDs absent, 117 ports refused, 26 profiles absent, four locks free,
and no heavy runtime. No boxes were created, resumed, stopped, or deleted.

Tested source commit: `fdceb86b4d531c5744d52bb201d98e0959303e78`.
The relevant tracked-source binary diff is empty; all 301 recorded source
hashes remained unchanged. The actual browser-compiled module was 2173299 bytes,
SHA-256 `10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031`,
matching the fresh locked build. Compatibility module:
`eb59d32227cc18233f93c7b757e0700f9558f0a31af7e3d38090669d4fc15158`.

No registered Conan route existed. A private documented `--before-load`
`wineApps` setter registered only this installer and its guest filename;
there were no guest patches, forced states, acceptance shortcuts, registry
version substitutions, or shared source edits. Chrome 151 on Linux used the
Worker guest backend and SwiftShader/WebGL. This was one browser/guest session,
started 17:16:22 UTC, with a nine-minute outer guard and the production
seven-minute ordinary-input queue deadline.

## Observed sequence

All twelve saved screenshots were personally inspected. Ordinary trusted
browser mouse presses/releases reached guest WM_LBUTTONDOWN/WM_LBUTTONUP and
caused these visible transitions:

1. Select Language → select U.S. English → OK → welcome.
2. Next → default destination `C:\Program Files\TDK Mediactive\Conan Demo`.
3. Next → EULA with I Reject selected and Next disabled.
4. Ordinary I Accept → Next enabled; ordinary Next → Start Installation.
   This establishes `acceptedInGuest=true` under the owner's 2026-10-18
   authorization. Evidence: `eula.png`, `accept-selected.png`, `after-accept.png`.
5. Next → file installation in a second guest Worker. Three progress captures
   show advancing animation, data, and music copies.
6. `installation-state.png` shows the successful-installation page. It also
   states that the demo requires DirectX 9.0 or higher. This statement is not
   evidence that a subsequent game launch has failed or that DX9 is absent.

A read-only observation of the existing owned page recorded 106 host-VFS
entries and 31 entries under the installation directory, totaling 156126585
bytes. This is an observed inventory, not comparison against an independently
known complete installation manifest. `installed-summary.json` retains paths,
sizes, and SHA-256 values; `inventory-before-finish.json` includes registry
changes and the original observation response. No installed game-data tree
was copied out.

The real executable is:

`C:\Program Files\TDK Mediactive\Conan Demo\Conan.exe`

1630208 bytes, SHA-256
`c343ef6a51a88c5b01a3c3e1511035359d25336fbe010123bd2e02962b77df56`.
Its unique small executable module was recovered as `installed-conan.exe` for
static inspection, not launched. Direct imports include KERNEL32, USER32,
GDI32, ADVAPI32, DINPUT8, d3d9, and DSOUND; see `installed-conan-imports.txt`.

## First blocker and limits

The added observer called `puppeteer.connect` without `defaultViewport:null`.
The installed Puppeteer source defaults to 800×600 and applies that viewport
when attaching to an existing page (`src/cdp/BrowserConnector.ts:32`,
`src/cdp/Page.ts:125`, `src/common/util.ts:37` in the resolved puppeteer-core
package). This observation connection therefore was not geometrically passive.
The existing screenshot driver and attached observer had different viewport
settings.

Consequently the attempted Finish click at 17:23:10 used a live input canvas
of 640×484 with a 460×348 CSS rectangle at (10,214), whereas the inspected
1000×800 screenshot showed a 660×602 rectangle at (10,160). The reused fractions
landed at page (283.7,485.8), not the screenshot's Finish button near (402,630).
Guest input did arrive, but normal Finish activation was not demonstrated.
This is an observer/runner geometry error, not a proved emulator input defect.

At 17:24:00 the fixed ordinary-input queue expired. A subsequent queued
Enter/quit request was not consumed: no `after-finish-enter.png` exists and
those inputs must not be claimed. The probe recorded `ordinary-input queue
deadline`, exited 1, and closed Chrome normally at 17:24:01.271 (code 0).
Its normal final readout did not execute; the earlier independently saved
inventory remains the installed-state evidence. No second original session
was attempted.

Next: make observation attachments geometrically passive (`defaultViewport:null`),
verify screenshot and input geometry agree, and budget inventory/Finish before
the input deadline. A separately authorized continuation can reproduce ordinary
installation from the verified media, retain the genuine installed state,
register the identified game executable with its actual files/working directory,
and diagnose its first launch. DX9 and gameplay behavior remain untested.

## Validation and cleanup

- Current production boot helpers resolved the installer DLL graph and mounted
  SYSTEM_DATA_FILES. All five bitmap fonts including Terminal.fon, the
  substitution map, and all selected subset font files were read successfully.
- All 70 distinct direct installer imports have current API-table entries and
  handlers; none of those handler bodies calls the unimplemented-API trap.
  This does not qualify future dynamically extracted code.
- Production queued-input validator controls and syntax checks for the eight
  prelaunch private scripts passed. `flock /tmp/wine-build.lock bash tools/build.sh`
  passed. No production fix or emulator regression was needed or committed.
- `runtime-cleanup.json`: caller/probe/Chrome absent, both HTTP/CDP ports refused,
  profile removed, four locks free, over 7 GB free. The board watcher was
  separately terminated before FINAL release. Box ID/state/expiry: not applicable;
  coordinator lifecycle ownership and laptop Heroes II were untouched.

Evidence uses the exact Git SHA, relevant binary diff, and owned new-file
patches; no source-tree archives or repeated installer copies. This task has no
candidate-corpus entry, so no unrelated dashboard candidate was attached.
