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

No new original has run as of qualification. No box or worker has been created.
