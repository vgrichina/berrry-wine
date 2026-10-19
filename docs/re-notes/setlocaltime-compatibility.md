# SetLocalTime virtual calendar

Source task based on main `9c522d88962456badb51409a7180d7d41e87463a`.
Original Mad Bomber evidence is retained by the LockFile task in
`scratch/runs/20261019-madbomber-original-remote-v2`: its packed CRT resolves
LockFile/UnlockFile, then fails to resolve SetLocalTime and returns FALSE from
its initializer. This change does not establish an original-game pass.

SetLocalTime already has immutable API id 627. Its fail-fast handler is now
implemented, and the explicit kernel32 export manifest adds emulator ordinal
593 without changing any existing ordinal or API id. The generated PE export
body is regenerated. Dispatch and hash generators leave their mirrors unchanged.

The handler gathers a read-only 16-byte guest SYSTEMTIME, releases its span,
returns BOOL, and pops one stdcall argument. Invalid/null input returns FALSE
and ERROR_INVALID_PARAMETER (87); success preserves LastError. Day of week is
ignored. Calendar fields are validated before changing state, including month
length, leap years, milliseconds and supported years 1601..30827.

The existing wall_clock import gains mode 4; its signature does not change.
A process-owned calendar object holds an offset from the existing late-bound
calendar policy. GetLocalTime, GetSystemTime, FILETIME, current timezone bias,
CRT consumers of those APIs, and CMOS sample that object. Cooperative workers
share it; real workers use the existing synchronous import broker. Other guest
processes remain isolated. No operating-system clock call is made. get_ticks,
real_time_ms, RDTSC and elapsed-time/audio timing policies are unchanged.

Microsoft specifies conversion using the bias at the current time, including
the current DST setting. Setting across a DST boundary can therefore require a
second call. This is intentionally different from resolving the target local
date's own timezone offset. See [SetLocalTime](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-setlocaltime)
and [Local Time](https://learn.microsoft.com/en-us/windows/win32/sysinfo/local-time).
This is guest-only virtual time with no Windows privilege/token model or host
SE_SYSTEMTIME_NAME authorization; it does not implement SetSystemTime or
SetTimeZoneInformation. Existing host timezone rules remain the zone policy.

Validation: `node test/test-set-local-time.js` and `node test/test-cmos-rtc.js`
pass without a build, guest or OS Worker. The new host suite covers invalid
inputs with unchanged clock, leap day/century, time progression, FILETIME,
fractional timezone, DST two-call behavior, isolated processes, cooperative
workers, production browser context reconstruction and unchanged elapsed clocks.

Prepared controls, **not yet executed**:

- `node test/test-set-local-time-native.js --wasm=PATH --sha256=HASH`: exact
  production module, authentic x86 API dispatch/GetProcAddress by name and
  ordinal, BOOL/LastError/stdcall, calendar getters, NULL/invalid dates,
  noncontiguous two-page input and repeated gathered-span release. No compiler
  or test-only wasm exports. Run against both normal tail and compat modules.
- `node test/test-set-local-time-worker.js`: actual OS Worker synchronous RPC
  setter/getter with main-thread and CMOS visibility. No guest or implicit build.

A normal build and these controls require coordinator runtime allocation.
Original Mad Bomber validation must then use the original executable/CRT and
an independently reviewed bounded run. No public deployment is authorized.

## Prepared remote controls, 2026-10-19 02:57 UTC

Controller/plan commit `504d6f77365cfa6d22f6f16e983020c7d8dc3fbe` is staged at
`bx_rqnkhrnr:/tmp/wa-setlocaltime-oct19`. Source selection reuses the audited
Dungeon build closure, including `test/run-all.sh` and `fonts/Terminal.fon`.
All 3,148 source and 27 pngjs files verified; no original binaries or modules
were staged. The clone used permitted HTTPS through Boat exec, and source
checkout/dependency copy stayed inside the remote host; no SSH/scp/push API.
Command receipts: `cmd_ihrxa0bjxptq`, `cmd_iloxpxjpfl1h`.

Remote plan `/home/user/setlocaltime-stage-1/plan.json` matches local
`scratch/runs/20261019-setlocaltime-prepared-1/plan.json`, SHA-256
`044758ed9eababd2f38931fae4aec62d5d063256c53c3e334467d994b860dd51`.
The local folder also retains `remote-staging.json`. Free space was
48,564,961,280 bytes. The temporary box expires at 03:05:06 UTC unless the
coordinator changes its lifecycle; no lifecycle change was made by this task.

After a separate sole-runtime grant, the exact ready command is:

```sh
WA_SETLOCALTIME_GRANT=20261019-setlocaltime-controls-1 node /tmp/wa-setlocaltime-oct19/tools/setlocaltime-controls.js /home/user/setlocaltime-stage-1/plan.json 20261019-setlocaltime-controls-1
```

This runs the normal build, exact tail module, exact compat module, and actual
OS Worker controls, stopping on the first failure. It requires the shared
exclusive runtime lease. Limits remain 180 seconds per job, 250 ms monitoring,
4 MiB logs per job, 32 MiB aggregate evidence, 128 MiB build growth, 512 MiB
transient reserve; admission must exceed 2,986,344,448 bytes and the hard floor
is 2,214,592,512 bytes. Source-plan and controller mock failure controls pass.
No build, native control, real Worker or original game has run at this stage.
