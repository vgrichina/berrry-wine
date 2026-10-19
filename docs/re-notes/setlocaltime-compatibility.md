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

## Granted qualification result, 2026-10-19 02:58 UTC

The coordinator subsequently granted exactly the prepared four-job plan.
Boat command `cmd_jwll0pxj8h99`, controller PID 31569, ran 02:58:15.333 through
02:58:42.629 UTC and exited 0. Normal build passed in 26,410 ms; public native
tail and compat controls passed in 148/149 ms; the real OS Worker passed in
160 ms. All guards were null, source/dependency pins unchanged, and every
child group absent. Minimum free space was 48,535,990,272 bytes.

Tested production module hashes:

- tail: `b2fdf52732a3046c1b26468a335a6a9b32ea16fcda5d4f111977306be9729541`
  (1,874,305 bytes)
- compat: `7f2c7b478bf325bdf028314db3ab8c45c650ef3c1bf393c538a6976d1be5cab4`
  (1,876,878 bytes)

Independent postflight `cmd_1sfkaqtgmtd5` verified controller PID 31569 and
children 31586/32131/32142/32153 plus their groups absent, no runtime lease,
and all source/dependency pins unchanged. The lease's inherited kind string
was `dungeon-observer-controls`; this is inaccurate descriptive metadata only.
The actual SetLocalTime ownership was recorded on the messageboard before
launch. Nothing was repinned during the granted run.

Sixteen evidence files plus both exact modules were recovered through the
documented Boat Files API into local
`scratch/runs/20261019-setlocaltime-controls-1/`. All artifact and module hashes
verified against remote records. Recovery archive: 1,618,074 bytes, SHA-256
`925b9b8a2b64de70def1e53b1d8093dc83790dd3fbaf8a1d7a3b29e850419c75`.
`qualification.json`, `recovery-postflight.json`, `artifact-manifest.json`,
and `local-recovery.json` retain identities and verification; `build/` retains
both modules. Logs were inspected. These are API controls, not a run of a
registered original-game candidate, so no unrelated dashboard capture is attached.

Runtime is released. Original Mad Bomber remains untested with this candidate;
no game, visual, input, audio or performance qualification is implied.

## Original Mad Bomber candidate prepared, 03:02 UTC

Source controller `tools/run-madbomber-setlocaltime.js` is committed in
`5b323d5c2a7f3bc1de16d21a95109f85b6b9c270`, SHA-256
`100491144cd04383932c2499edb452ba58775773c889b9f5b9f31e4773a2177b`.
It preserves the prior portable consumer lifecycle, 10/15/25-second bounds,
2 MiB log limit, 32 MiB aggregate cap, admission and hard floor. It additionally
verifies the complete four-job qualification against source `504d6f773` and
the exact `b2fdf527` production module before starting any child.

The remote candidate stays at built source `504d6f773`; the two newly added
controller/check files are independently pinned. Existing original files remain
at `/tmp/wa-lockfile-rebased-oct19/scratch/portable/`: all 140 records and eight
DLL seeds retain their original hashes. The argv is unchanged except for the
qualified candidate wasm path. No original assets were copied. Seventy-seven
font links were added after verifying both the prior inventory hash and the
candidate commit's font blob. Source staging command `cmd_bg3sap4xqvb5` initially
failed at a cwd-relative Node require before any consumer; corrected absolute
requires completed staging in `cmd_uuoi2aztlk4x`. No guest execution occurred.

Remote manifest `/home/user/setlocaltime-madbomber-prepared-1/manifest.json`:
SHA-256 `31e428d8ff3ccda41c631957c5b7c1cde137ef06cd4163ea8e204836f0b0d6e9`.
Transfer inventory SHA-256:
`5733c84810d781f8468a0f4609626d5d15d729500066e6be460a9c8865d79793`.
All 3,405 pins verified; aggregate bytes 24,386,671 of 33,554,432; sampled free
space 48,321,077,248 bytes. The qualified-build identity deliberately replaces
the earlier `97c67d7a` module; its prior provenance remains in the transfer record.
Both JSON files were recovered/hashverified locally in
`scratch/runs/20261019-madbomber-setlocaltime-prepared-1/` through Files API
(archive 186,676 bytes, SHA-256
`2de5b54fa9839212d5453ee7875734e542bfa03b73a989d92d6670f4e226d10f`).

After a separate sole-runtime grant, exact ready command:

```sh
WA_LOCKFILE_RUNTIME_GRANTED=1 WA_LOCKFILE_MANIFEST_SHA256=31e428d8ff3ccda41c631957c5b7c1cde137ef06cd4163ea8e204836f0b0d6e9 node /tmp/wa-setlocaltime-oct19/tools/run-madbomber-setlocaltime.js --execute --manifest=/home/user/setlocaltime-madbomber-prepared-1/manifest.json --out=/home/user/wine-assembly/scratch/runs/20261019-madbomber-setlocaltime-1
```

Source argv/admission/qualification tests pass. Original run remains **NOT RUN**
at this preparation checkpoint; Army Men owns the current runtime slot.
