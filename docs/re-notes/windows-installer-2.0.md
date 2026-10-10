# Windows Installer 2.0 for Win9x (instmsi.exe)

`test/binaries/candidates/windows-installer-2.0-win9x/sources/instmsi.exe`
(archive.org `instmsi_win9x`, md5-checked on download). It is the **Spanish**
build: the package's LastAuthor is `Alpha,Intel;3082` and its UI strings are
Spanish, though the Template is `Alpha,Intel;1033`. Task
WINDOWS-INSTALLER-REDIST-20261006.

## The chain

| process | what it does |
|---|---|
| instmsi.exe | IExpress: extracts to `C:\WINDOWS\TEMP\IXP000.TMP`, then `CreateProcessA(NULL, "...\msiinst.exe /i instmsi.msi MSIEXECREG=1 /m /qb+!")` and waits on it |
| msiinst.exe | unpacks msiexec.exe/msi.dll to `C:\WINDOWS\INSTALLER\INSTMSI0`, then `CreateProcessA("MsiExec.exe", "MsiExec.exe /regserver /qn")`, then `CreateProcessA("MsiExec.exe", "<msiinst path> /i instmsi.msi MSIEXECREG=1 /m /qb+! INSTALLSDB=1")` (argv[0] of that command line is msiinst's own path, a label only), waits + GetExitCodeProcess each; last runs the installed `C:\WINDOWS\SYSTEM\msiexec.exe /regserver` |
| msiexec.exe /i | the engine runs on its own thread; the main thread pumps the basic UI and services the engine's cross-thread "Invoke" requests (SetEvent + MsgWaitForMultipleObjects on the engine side). Custom actions RegExtension (`msiexec /D`) and RegDllServer (`msiexec /Y msi.dll`) are EXEs started from the engine thread |

`/qb+` ends with a modal "Windows Installer Setup completed successfully."
box (OK = control id 3001). Headless, press it: `--input=B:dlg-cmd:3001`. An
unanswered box looks exactly like a hang — the engine thread sits in
MsgWaitForMultipleObjects forever and msi logs `Invoke wait timed out`.

## What it needed

- **Real child processes** for an ordinary CreateProcess:
  `test/run.js --spawn-processes` (docs/design-anonymous-pipes.md). Without
  it CreateProcess reports success with no child, msiexec never runs, and
  msiinst exits 0 having installed nothing.
- **GetLongPathNameA** (api 4205). msi.dll binds it by name from KERNEL32 and
  its fallback is `SetLastError(1); return 0`, so every install failed:
  `Could not create LFN path for package` → `MainEngineThread is returning
  1619`, and the error dialog read "Err" (FormatMessage has no system text
  for 1619).

## Reading msi's mind

msiexec writes a verbose log: add `/L*v c:\msi.log` to its arguments (msiinst
passes extra arguments through), then `--save-vfs=DIR --save-vfs-suffix=.log`
and `iconv -f utf-16`. It names the failing step in plain words — that is how
the LFN failure was found after the API trace showed nothing wrong. The
engine thread's calls only appear with `--trace-api` and without
`--quiet-api` (`[API T1] …`, bare names); COM calls on WAT objects show as
`<ord>` there, decode the `0xC0DE0000|id` line before them in api_table.json.

## Route (CLI)

Stage snapshots are in `scratch/w5-msi/cap1` (after IExpress extraction:
msiinst stage) and `cap2` (msiexec stage), made with `--capture-launch`.

```
node test/run.js --exe=scratch/w5-msi/cap1/windows/temp/ixp000.tmp/msiinst.exe \
  --vfs-tree=scratch/w5-msi/cap1 --exe-guest-path='c:\windows\temp\ixp000.tmp\msiinst.exe' \
  --cwd='c:\windows\temp\ixp000.tmp' --args='/i instmsi.msi MSIEXECREG=1 /m /qb+!' \
  --spawn-processes --pipe-child-args="--input=1000000:dlg-cmd:3001,1250000:dlg-cmd:3001,..." \
  --quiet-api --quiet-blocks --stuck-after=0 --max-seconds=380 --max-batches=1000000000
```

Result (run `20261006T1340Z-instmsi-msiexec`): all three msiexec children exit
0, 13 files merged into C:\WINDOWS\SYSTEM (msi.dll, msiexec.exe, msihnd.dll,
msimsg.dll, msisip.dll, cabinet.dll, ...), msiinst exits 0. About 6M batches
for the /i child.

One run of the registry app does the whole thing: `node test/run.js
--app=windows_installer_20 --quiet-api --quiet-blocks --stuck-after=0
--max-seconds=1400 --max-batches=2000000000` (run
`20261006T1415Z-instmsi-boat-single-run`, on a boat: three nested 512 MB
guests). instmsi -> msiinst -> msiexec /regserver, msiexec /i with its custom
actions `msiexec /D` and `msiexec /Y msi.dll` as grandchildren (no more
1722), then the installed msiexec /regserver; every process exits 0 and the
installed files reach the top-level C:\. `--pipe-child-args` is forwarded
down the tree, so a `--input=B:dlg-cmd:3001` there reaches the msiexec that
shows the completion box; that run did not need it.

The installed `C:\WINDOWS\SYSTEM\msiexec.exe /?` starts and shows a box
reading "Err": FormatMessageA has no FORMAT_MESSAGE_FROM_SYSTEM text, so a
system message comes back as the generic "Error" (clipped). Not an install
problem; a Win98 system message table is its own piece of work.

## Browser

Registry id `windows_installer_20`, `spawnProcesses: true`: host.js starts
each CreateProcess as a visible in-page instance on a copy of C:\ and merges
its files back on exit (`VirtualFS.mergeChildFrom`; the registry store is
page-wide already).

msiexec /i used to end on "unexpected error ... 2761" (cannot begin
transaction: global mutex) at InstallInitialize. msi's own log comes out of
the page with IExpress args `/c:"msiinst.exe /i instmsi.msi MSIEXECREG=1 /m
/qb+! /L*v c:\msi.log"` (set from a `--before-load` probe on
`window.wineApps`) and a `--report-eval` that reads `c:\msi.log` from each
running app's `wine._helpCtx.vfs`. The engine thread (msi.dll `0x4c94d0`,
Win9x branch on `[0x547838]`) does `CreateMutexA(0, 0, "_MSIExecute")`,
`WaitForSingleObject(h, 3000)`, and later `OpenMutexA("_MSIExecute")`.
Wrapping `ThreadManager.prototype` from a probe showed the name arriving as
`""`: `readSyncObjectName` in `lib/mem-utils.js` accepted the buffer only if
it was `instanceof SharedArrayBuffer`, and a page that is not cross-origin
isolated has no such global while its shared wasm memory still hands one
out. Every named event/mutex/semaphore in such a page was anonymous. Fixed
by testing the type tag; `test/test-sync-object-name.js` covers it.

With that, msiexec /i finishes (InstallFinalize returns 1) and shows
"Windows Installer Setup completed successfully." (headless Chrome on a
boat, `?no-threads`).

The custom actions then logged Info 1722 and overlapped: msi.dll waits for
each custom-action EXE at `0x4b96d6` with
`MsgWaitForMultipleObjects(1, &hProcess, FALSE, INFINITE, 0x4ff)`, loops on
1 (pump, wait again) and reads GetExitCodeProcess on anything else. The wait
answered WAIT_TIMEOUT whenever nothing was ready at that instant, even for
INFINITE, so msi read STILL_ACTIVE as a failure and started `/Y` while `/D`
ran. An idle INFINITE wait now answers a message wake
(`$msgwait_idle_result`, shared by the handler and `$win32_dispatch`'s
direct path; `test/test-msgwait-infinite.js`), be3d5da3. Verified in the
browser (run `20261010T0150Z-instmsi-web-1722-fixed`): msi.log has no 1722,
RegExtension then RegDllServer each return 1, `/D` exits before `/Y`
starts. `/Y` still exits 0x80040200 (SELFREG_E_TYPELIB) but its action type
3154 carries msidbCustomActionTypeContinue, so msi ignores it.

The completion box belongs to the `msiexec /i` child instance, and
profile-web-frames' `--guest-click`/`--guest-key` go to the top-level
renderer and never reach it. An `--after-launch` probe that sends
`WM_COMMAND 3001` through that child's own `instance.exports.send_message`
(once its `c:\msi.log` shows InstallFinalize) dismisses it; then the child
exits 0 and merges 18 files back, msiinst runs `/regserver`, exits and merges
36 files into the top level, which exits 0.

## Open

- Why the CLI never showed 1722 before be3d5da3 is not established.
- An MSI-based corpus installer as acceptance (The Movies demo is deferred).
