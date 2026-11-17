# Conan restored capacity: neutral helper preparation failure, 2026-11-17

Actual `/home` available space was about 2.04 GB after the coordinator's
reserved-capacity adjustment, above the unchanged 1,500,000,000-byte floor.
This fresh local Chrome used its own `/dev/shm` profile and temporary directory
under the established independent disk-floor/deadline watchdog. The watchdog
did not fire. No old runtime was queried or reopened.

Preparation failed before the release helper or game shell was ready. The
neutral page raised `ReferenceError: owner is not defined`. An offline VM
reproduction identifies the preceding dependency failure: the neutral page
loads `renderer-input.js` without `region-map.generated.js`, so
`installInputHandlers` throws while reading `_regionMapInput.BASE`, before
creating `owner`. Loading the pinned region map permits initialization in the
offline check. This is a run-specific preparation defect, not a proved Conan
or display-correction defect. The tested driver is preserved unchanged; no
runtime retry, capture, guest launch or input followed the failure. The one
authorized original remains unused.

The planned runtime retains published `b063d11ee` plus only published
`da9ac26cc:lib/host-imports.js`, retained module SHA-256
`87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009`, and
the established media/app-config references. These are preparation pins,
not claims that the game loaded them. Existing display regression and locked
build proof are referenced without repeating compilation. No product source
changed. Git SHA and relevant uncommitted binary diff are retained; no source
archive or media copy was made.

Chrome -15, driver 1, watchdog 0, supervisor 1 and keeper 1 have actual waits
and both pipe EOFs. Supervisor reports `clean:true`, controller failure,
empty owned scope and empty child list. Outer helper returned 0 after its
actual keeper wait; that does not convert the failed driver into success.
Unique custody files were retrieved and hash-verified before removing only
this task's disposable custody/profile directory. No box was created:
ID/expiry null, state NOT_CREATED, stop receipt not applicable.

Evidence: `scratch/runs/20261117-conan-restored-capacity-visible-player-gameplay/result.json`.
Next: correct and validate the neutral page's dependency loading before a
separately authorized preparation attempt. Visible menu, New Game/Warrior,
movement, second response and native Quit remain unproved. All freshness,
owner, release and lifetime deadlines remain unchanged.
