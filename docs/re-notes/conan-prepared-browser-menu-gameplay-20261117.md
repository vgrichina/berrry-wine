# Conan browser preparation stopped by disk floor, 2026-11-17

The independent watchdog stopped this task's new Chrome during endpoint
startup because actual `/home` free space crossed below 1,500,000,000 bytes.
The game driver never started. No page navigation, helper control, Conan launch,
game input or capture happened. The one authorized original remains unused.
No retry was made. Later measured free space was 1,096,732,672 bytes.

The earlier navigation exception was inspected offline: Puppeteer's CDP
`Page.navigate` protocol deadline expired at 20 seconds before `launchApp`.
It does not prove a shell or product defect. The prepared run-specific driver
separates a 120-second page-preparation deadline from the game budget and records
network and page milestones. It schedules neutral native key/mouse release
checks before game launch and retains the existing 500ms prearm, 1750ms release
ACK, 3000ms aggregate and 120-second capture bounds. Only its syntax was checked;
none of this new driver executed, so its readiness remains unproved.

The planned immutable runtime is published `b063d11ee` with only
`da9ac26cc8c56a161b044e3705873420aecadaed:lib/host-imports.js` substituted in
memory, the retained `87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`
standard module, and the established installed Conan media/app configuration
references. No source tree or media was copied. No product code changed.
Existing baseline-FAIL/final-PASS regression and locked-build evidence for
da9ac26cc is referenced and hashed, without repeating those checks. Rejected
CPU observer stays off; no draw fault or raster hypothesis was established.
All old UNKNOWN endpoints remain closed.

Published custody helper `44115957` was reused unchanged. New actual waits are:
Chrome -15, watchdog 0, supervisor 143, keeper 143, with both pipe EOFs recorded
at each boundary. The outer helper itself returned 0 after recording its keeper
wait. Supervisor `clean:false` and `Chrome endpoint startup failed` are retained;
its remaining process scope and children are empty. No driver wait exists because
no driver was spawned. Unique custody files were retrieved and hash-verified
before removing only this task's disposable profile/custody directory. No box
was created (ID/expiry null; stop receipt not applicable).

Evidence: `scratch/runs/20261117-conan-prepared-browser-menu-gameplay/result.json`.
Next: restore disk headroom through authorized cleanup, then prepare and review
the shell and independent helper before the still-missing visible Conan menu,
New Game/Warrior, player movement, second response and native Quit. Nothing in
this stop relaxes input freshness, lifetime or release requirements.
