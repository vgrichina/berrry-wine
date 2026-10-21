# Hock-A-Loogie (1995) — local candidate, static evidence only

TG103 registers `hock-a-loogie-1995` in the candidate corpus. **LOCAL ONLY:**
proprietary Viacom New Media original; no redistribution or public deployment
permission established. No guest execution, build, browser test, gameplay,
audio, performance, or compatibility validation has occurred. No app selector
entry is added: this bounded registration uses the separate candidate pool.

## Provenance and exact layout

The retained intake is
`scratch/runs/20261020-hock-loogie-original-intake-oct20/`, with `INTAKE.txt`,
`intake-result.json`, archive listings and `SHA256SUMS`.
The inventory SHA-256 is
`31230f2aa354498853120b39417e1385d5f218e623bdf15e4493b49b9db9dfa7`.
Source: <https://archive.org/details/Hock-A-Loogie-1995>, download
`https://archive.org/download/Hock-A-Loogie-1995/beavislg.zip`.
This is an archival distribution wrapper, not an authenticated publisher master.
Outer survey files date to December 1996; inner ZIP timestamps are 1995-09-21.
Version resources identify Viacom New Media, copyright 1995, Beavis & Butthead
Mini Game, text version 1.00, fixed file version 1.0.1.0, product 1.0.0.0 and
internal/original name `bbmini.exe`. The distributed name is `BBLOOGIE.EXE`.

| Payload | Bytes | SHA-256 |
| --- | ---: | --- |
| `beavislg.zip` | 1256578 | `e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b` |
| `distribution/BEAVISLG.ZIP` | 1254275 | `24da14e65b7a5418f9f4099a8ec6dcf6998004c350f365936b8d9ef0b6a3f05e` |
| `game/BBLOOGIE.EXE` | 223744 | `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4` |
| `game/SOS9502.DLL` | 84480 | `a706691cd04bc66fd290977fc5a863b99c004e06f8980b6fc8a04d2bc4f26b7e` |

Outer SHA-1: `68be591b75813f81409314ad1944d64927835be5` (the existing
fetcher enforces SHA-1; the focused test additionally enforces SHA-256).
Extract the outer archive into `distribution`, then
`distribution/BEAVISLG.ZIP` into `game`. Outer `PHTSURV.TXT` and `PHTSURV.HTM`
are distribution material, not game companions. The inner archive contains
39 files / 2224918 bytes: EXE, `BBLOOGIE.000`, `SOS9502.DLL`, and 36 AIFs.
All 38 companions must stay beside the executable. Exact names, sizes and
SHA-256 hashes are pinned in the new static regression test and intake listing.

The prospective fixture is `test/binaries/candidates/hock-a-loogie-1995/`.
It has **not** been installed/materialized by this task. The retained original
archive and extracted intake are reused; no redownload or durable binary copy
is needed. The test extracts only into a disposable directory and removes it.
The browser inventory recipe maps every companion to `c:\<filename>` and
excludes the separately loaded EXE. CLI `vfsInclude: ["**/*"]` mounts the
EXE's directory. Use `C:\BBLOOGIE.EXE` and initial guest cwd `C:\` together;
do not place companions under a different guest directory. Case-insensitive
Windows lookup must work. No registry seed or replacement DLL is prescribed.

## Static test and future runtime gates

Run from the task checkout (no build or guest execution):

```sh
node test/test-hock-a-loogie-local-registration.js --intake=/home/user/wine-assembly/scratch/runs/20261020-hock-loogie-original-intake-oct20
```

Without `--intake`, structural checks run and package checks explicitly skip.
With it, the test verifies the sealed intake, outer SHA-1/SHA-256, actual nested
extraction through existing fetcher helpers, all 39 payload hashes and generated
38-entry VFS closure. Negative controls cover registration/path/hash errors,
altered archive bytes, each missing companion, and a wrong VFS destination.
No network entrypoint is evaluated. Keep candidate-specific tests outside the
normal runtime matrix, as for other optional candidate fixtures.

The EXE is PE32 i386 GUI, image base `0x400000`, entry RVA `0x1366f`, subsystem
4.0. Static imports: USER32, WINMM, KERNEL32, GDI32, ADVAPI32, COMCTL32 ordinal
6. The supplied DLL imports KERNEL32, USER32 and WINMM, including waveOut,
multimedia timers, MIDI and thread APIs. EXE strings also name `sos32s02.dll`
and `DISPDIB.DLL`; neither is supplied. Whether these are optional Win32s paths
remains unknown. Prefer Windows 95/98 identity, investigate the selection path
if requested, and do not invent DLL substitutions. Registry strings include
`Software\ViacomNewMedia\BeavisAndButthead` and `LoogieHiScore`; they do not
establish a requirement to preseed anything.

Remaining gates, after a separate authorized runtime task and the existing
runtime/Boat 403 hold is lifted:

1. Launch unchanged original EXE with the full companion tree, explicit cwd
   and VFS; inspect dynamic DLL resolution, COMCTL32 ordinal 6 and SOS callbacks.
2. Prove startup and rendered GDI/DIB/palette output; record any exact API fault.
3. Exercise ordinary controls and a visible gameplay transition, not just a
   screenshot or idle window; verify scoring and persistence where applicable.
4. Verify audio/waveOut callbacks, timing/thread behavior and sustained play.
5. Qualify a local browser route, input, audio and measured performance before
   any broader compatibility claim or app-selector promotion.

Prospective direct command using retained intake (NOT executed; may auto-build):

```sh
node test/run.js --exe=scratch/runs/20261020-hock-loogie-original-intake-oct20/game/BBLOOGIE.EXE --exe-guest-path='C:\BBLOOGIE.EXE' --cwd='C:\' --vfs-include='**/*' --quiet-api --max-seconds=30
```

Publication/auth/trust holds are independent of these runtime gates and remain
in force. No fetch, push or access retries. **NO REMOTE BACKUP.** The local
registration evidence is `scratch/runs/20261020-hock-loogie-local-registration-oct20/`.
