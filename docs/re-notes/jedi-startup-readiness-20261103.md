# Original Jedi: WinExec readiness and ordinary movie completion

The original installed launcher now waits for child startup readiness before
returning from WinExec. One ordinary Play session completed the original intro
and reached the engine's **New Player** screen in both children. No player name,
gameplay movement/look/fire, level selection or movie bypass was injected.
Gameplay remains unverified. The duplicate engine launches remain: a separate
CLI cross-process FindWindow visibility gap is now established.

Evidence and recovery recipes are under
`scratch/runs/20261103-jedi-startup-readiness/`. This continues
[jedi-authentic-launch-path-20261103.md](jedi-authentic-launch-path-20261103.md).
Exact Alice release06:14:46 then GL release06:40:25 preceded production edits,
build and execution. No predecessor boat was resumed or stopped.

## Original calls and primary contract

Scratch-only provenance/instrumentation was prepared before the gate opened.
Unchanged Jedi.exe SHA256
`ab3c7c41153284aa9632fae871296ce266d2323defb5a20c987356d082ede1a1`
contains two legitimate WinExec calls through IAT42a7c8, both show5:

- `402a0f`, return `402a15`: unsigned EAX<=31 skips the virtual call;
  success calls `[vtable+0xcc]`, then continues at `402a24` into registry lookup.
  The actual vtable41d338 dump resolves that method to412259. Its normal return
  at412271 is consistent with traced previous PC412270 at402a24. Success does
  not return from the Play handler.
- `402c0a`, return `402c10`: unsigned EAX>=32 reaches402ca7; lower values show
  the original launch error. Its command uses the unchanged installer registry
  Executable and original file/path guards.

The retained [period MSDN WinExec reference](https://techshelps.github.io/MSDN/WINBASE/devdoc/live/pdwbase/prothred_36w3.htm)
requires waiting for the child to call GetMessage or for a timeout; the
[current Microsoft reference](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-winexec)
also describes this. Neither specifies the timeout duration. The repair's
10-second finite deadline is implementation policy, not measured Win98 timing.
No native Windows execution is claimed. `CONTRACT.md`, `static-provenance.json`
and the original disassembly retain the exact source and full SHA provenance.

## General runtime repair and controls

The WAT handler parks its existing stdcall frame on yield9 while host-private
startup state is pending. Retrying that frame never forks again. First child
GetMessage entry signals readiness through existing process transport,
independently of API logging. Child process exit or the finite deadline also
releases the wait. Errors and nCmdShow retain their prior behavior. Distinct
invocations, including identical commands on a reused completed stack, still
launch independently. Existing thread-exit notifications retire abandoned waits
before stack-slot reuse. Browser beforeRun/onExit callbacks retain the ordinary
launch queue and account for GetMessage occurring before beforeRun.

The prepared actual-handler test fails on the old code at the intended ESP
assertion: it pops12 bytes immediately. The repaired handler passes delayed and
early readiness, timeout, exit, unrelated-child readiness, independent identical
calls, one launch per parked frame, failed launch codes, show5, legacy-host
returns, other-thread retirement and retired-stack reuse. CLI/browser routing,
WinExec/VFS, GetMessage hook/teardown, Win16 WinExec/exec and census regressions
pass. The final `flock /tmp/wine-build.lock bash tools/build.sh` passes. Earlier
build stops for the new continuation census entry and epilogue spelling were
retained; the gates were satisfied without weakening them.

Before any guest executed, no-guest controls ran actual authority/client Workers:
unobserved and process-only preload passed; the deliberately invalid inherited
Worker argv guard failed as intended. Two actual no-guest forks proved distinct
observer controller ports with unchanged guest command arguments. The ordinary
session's two actual children used8144/8145;8143 belonged to the parent. Effective
parent/child argv, full original pins and compile/instantiate inputs were
recorded. The preload returns immediately in Node Workers. This diagnostic port
isolation is separate from WinExec readiness. During the run, only the host
ReadFile debug-log switch was disabled in both children to bound repetitive
logging; its exact request/results are retained. No guest state or argv changed.

## Ordinary Play result and remaining cause

One original launcher execution began06:44:16 UTC. A reviewed launcher screenshot
preceded the sole renderer click320,284. Both WinExec returns are traced at the
original return PCs with EAX33. The corresponding GetMessage readiness waits
completed after1273.635ms and1218.206ms. Thus readiness changed return timing but
did **not** eliminate the second legitimate original call.

The original engine calls FindWindowA at50eade, return50eae4, searching class
`wKernel` and title `Jedi Knight`. Those exact original strings also name its
created window. The first child creates that window before its GetMessage
releases the parent; nevertheless the later second child's same lookup returns0
and it creates another matching window. Original disassembly shows that a
nonzero result branches to512880 with argument-1. In this CLI
transport each OS child has a separate renderer: `lib/host-window.js` reconciles
only contexts sharing that renderer. Its authoritative no-match cannot see the
other OS process. This is the next established duplicate-handoff cause; it
requires general process desktop/window publication and lifetime handling,
not command deduplication or suppressing either original WinExec. Browser hosts
sharing a renderer are not covered by this CLI failure claim. The Microsoft
[FindWindow contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-findwindowa)
describes matching top-level windows by class and title.

Reviewed live captures show original intro footage and its closing promotion
card. The retrieved final PNGs for **both** children show the
original **New Player** name/difficulty screen. Movie completion is established;
the many zero-byte EOF reads from unchanged splash.smk are not an established
movie blocker. Bounded samples locate the reads in original smackw32.dll's
4061a9 ReadFile call, runtime9fa1a9, return9fa1b0, at offset1948808. No ReadFile or
codec patch was made. No profile name was entered before the finite session
ended. Next work is the general CLI window-visibility repair, then ordinary
New Player/profile continuation toward gameplay in a newly authorized session.

## Identity, bounds and shutdown

All28 original installed pins/39900850 bytes match before and after, including
JkDemo.exe `0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`.
Actual parent and both children verify those originals and accepted76-key
registry before PE loading. Genuine DSOUND.VXD/DDHELP remain file-only original
prerequisites; DDRAW/DSOUND retain the existing builtin policy and exact1024-byte
VFS guard files. Captured children preserve every original registry value and
add only Demo `Version` string`0.1`; this guest-generated delta is retained.
The parent final registry remains unchanged. No shortcut or path guard changed.

Fresh source seal covers4158 inputs. All219 staged runtime files match before
and after. Three actual process compile/instantiate receipts verify the fresh
2081604-byte canonical module SHA256
`75379b0954be582cbeb9df8b40477c5e0b67292fa8833577ebcc7a8e798aaa80`.
The source-seal SHA256 is
`98ba7ec82f0865b2e7bcd45d0588737ed218754617c1441d310f72da256e6f9e`.
The outer finite deadline ended the135.349s session with harness status-9;
this is not a claimed ordinary engine exit or guest crash. No gameplay or
historical27 acceptance is claimed.

All64 retrieved members match compressed and original byte/full-SHA manifests;
archive2481898 bytes SHA256
`aec1c44a9a7dbc36423eba2dc0fa9dcf198a42c9a63726045f33ce7948689cac`.
Own boat`bx_5h7fdgqj`, original expiry07:13:14.778Z, shutdown owner
`jedi-startup-readiness`, was recorded before use. After verified retrieval and
scoped helper/controller absence, original-task delegated normal stop
`stop_6b0d45ee9b89f8cd` completed06:50:06.388Z, error:null, forced:false,
STOPPED with normal snapshot retained. No assigned box remains running.
