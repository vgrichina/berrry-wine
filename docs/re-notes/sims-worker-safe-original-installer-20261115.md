# Worker-safe original Sims installer — 2026-11-15

This task has one fresh authorization for the ordinary owner-selected Nova
four-disc installer, `D:\Setup\Setup.exe`, SHA-256
`fe95a9fc8b2cdb5add76fbd326b1a11801eaa43c7d908f20cbdf413fd4d8dfde`.
The [predecessor](sims-original-installer-after-ft-20261115.md) consumed its
attempt before guest startup: its PID-only mapped-host evidence hook collided
in the desktop authority Worker. It did not reach an initializer or installer
UI, install files, invoke genuine FT, or perform native Quit.

The corrected capture naming includes both PID and Worker thread ID. The new
focused host-only test requires the exact original recipe's source and mapped
host preloads. It checks the authority and client Workers' live observations,
exact preload hashes and nonempty actual native mappings, a desktop snapshot
round trip, and both Worker exit events. Separate generated ordinary DllMain
controls must also run with both hooks and `--spawn-processes`; neither test
establishes original installer progress.

Evidence belongs in
`scratch/runs/20261115-sims-worker-safe-original-installer/`. Preparation is
LIGHT until Q3 latency and TIM margin explicitly release source, build and
runtime, and their direct waits, EOF and process/group absence are personally
verified. The earlier Sims release's 205 named waits and 216 absent PIDs/groups
have been personally checked, including all four direct lifecycle waits.
Historical ancillary UNKNOWN stays UNKNOWN.

The intended ordinary route retains the unchanged selected COMCTL32 and the
genuine companion's installed-name mount before initialization, published in
`fe7e6219f`. Unsupported thunk directions remain guarded. Current qualification
must cover committed HEAD plus the whole owned change, preserve foreign WIP,
pass the full locked build and focused controls, and be published before the
one original. That run uses real ticks/default scheduling, 900 native seconds,
a prearmed independent 920-second watchdog and 180 seconds reserved for native
cancel/Quit. Each input requires a personally reviewed current complete scene,
a new intent/nonce, a finite 80–1400 ms hold and independent UP within 1750 ms.
Written UNKNOWN permanently closes input; no replay or second original.

## Current qualification

Both full locked builds passed: the unmodified shared tree, and complete
committed HEAD `fad918f0ec5db90539048f45ddc0014dd1284234` plus the whole owned
test. All eleven inherited foreign operation-5/data-span/census paths remain
byte-exact; none was adopted into this change. The canonical runtime module
comes from the committed-HEAD build, excluding that unrelated WIP.

The exact-preload authority test passed. Actual observations identify the
authority as thread 1 and the client as thread 2, each with both expected
preload hashes and nonempty mapped-host receipts. A snapshot round trip
completed and both Workers were joined by ordinary host close. Their exit
events report code 1 from deliberate `Worker.terminate()`; the test process
exits zero. Omitting either preload is rejected before a Worker is created.
The mapped-host hook's SHA-256 is
`0b556a8f4ea3407f50a90ebc6824ad454bb234362b6fe9706fb0e65880231f2b`.

Fresh qualification also passed 24 policy tests, 12 HTTP controls, all three
ordinary DllMain file-read controls with the exact two preloads and
`--spawn-processes`, 13 actual native transport controls, and twenty
FT/LS32/NE/lifecycle/GDI/native-Quit regression suites. The closure names 172
actual waits with both EOF and verifies 230 observed PIDs/groups absent.
The deliberately orphaned fixture release remains UNKNOWN. Q3's sealed
85-wait/277-PID release and TIM's 236-wait/238-PID direct closure were also
personally verified before this task took the runtime.

The qualified test and this preparation were published on main in
`a30b71d01319966199754dc2812465f61d1a6e4d` before the original. No box or worker
was created.

## One ordinary original: real UI and bootstrap files, then child failure

The single authorized run began at 09:11:19 UTC. The ordinary Setup reached
its genuine Sims splash, InstallShield progress window and error dialog:
“The InstallShield Engine (iKernel.exe) could not be launched. (0x80040154)”.
Both selected complete screenshots were personally reviewed; the initial
capture is `result-installer-start.png` in the evidence run. This is real
installer UI, beyond the predecessor's authority startup failure.

Setup created its engine directories and installed a native 614,532-byte
`C:\Program Files\Common Files\InstallShield\Engine\6\Intel 32\IKernel.exe`,
then invoked it with `-RegServer` through ordinary CreateProcess. The retained
overlay index SHA-256 is
`209641d4b739f61d44a2c6b4085995e16699912d9e06e5a44d617afb6e85d9b2`;
the installed engine blob SHA-256 is
`985eb55ecb750da812876b8569d5f1999a30a24bcc54f9bab4d3fc44dfedb931`.
`native-output-manifest.json` names their existing recovery paths. These are
actual bootstrap installation consequences, not a completed game installation.
The exact partial overlay remains in place.

The child reached selected COMCTL32 DllMain but failed with
`Missing NE image COMMCTRL` at EIP `0x5d85d2`; the parent reported
CoCreateInstance `0x80040154`. The parent had the explicit genuine installed-name
COMMCTRL mount. At published source `test/run.js:4266`, `spawnVfsChild` exports
writable VFS state and supplies `--vfs-tree`, but does not forward the explicit
parent mounts. `lib/vfs-export.js:54` deliberately skips lazy provider entries.
The demonstrated next prerequisite is child propagation of the resolved
explicit system-file mount before initialization, while retaining the lazy
media exclusion. No source fix, fake installation, registry fabrication or
unsupported thunk change was made after this consumed original.

The main splash's native title was empty, while the visible owned progress
and modal windows had titles. The current controller requires a nonempty title
matching the main HWND, so it could not honestly bind this scene. No binding
or input was attempted. Native Cancel/Quit was therefore not achieved; fixing
that guarded untitled-main/modal case is a separate demonstrated prerequisite.
Genuine FT execution was not measured, and no game or household was reached.

## Closure and next work

An independent 920-second watchdog was armed before launch. On the concrete
failure, host cancellation sent SIGTERM; cleanup did not finish, so the verified
owned process group received SIGKILL. Native exit was -9, watchdog, supervisor
child and launcher exits were zero, all with actual waits and both EOF. This
was host shutdown, not native Quit. All 3,160 launch pins remained unchanged,
as did the eleven foreign WIP paths. Startup mapped-host receipts cover both
parent and child Workers. Their exit source-consumption inventories remain
UNKNOWN because of forced termination; pinned hooks and startup receipts do
not substitute for those missing exit observations.

The sealed runtime release names 183 actual waits with both EOF and verifies
245 observed PIDs/groups absent, the board watcher stopped and both locks free.
Its SHA-256 is
`b508c54e77afdb1977d3c7d152be5cbfe6da7122d5e30d4bd2fb0ab4c67d0c4f`.
Source/build/runtime were explicitly released to the next worker. Historical
and fixture ancillary UNKNOWN records stay UNKNOWN. No second original or
unchanged retry occurred. Box ID and expiry are null; state NOT_CREATED and
stop receipt NOT_APPLICABLE.

Next: qualify explicit child-mount propagation and guarded binding of this
observed UI, publish necessary changes, then obtain fresh authorization for
another original. The current attempt is permanently consumed and closed.
