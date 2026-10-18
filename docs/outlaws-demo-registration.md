# Local Outlaws original demo registration

`outlaws_demo` is a localhost app, matched to corpus candidate `outlaws-demo`.
It is absent from the public desktop. It preserves the original executable
`C:\OUTDEMO\oldemo.exe`, working directory `C:\OUTDEMO`, empty arguments,
automatic original DLL discovery and all 30 unique original Windows paths.
No registry import, replacement DLL, configuration edit or installer answer
is involved. The archive's identical `wdirnop.com`/`WDIRNOP.COM` records map
to one Windows name, with both records retained in the original extraction.

Recover using the existing [acquisition recipe](re-notes/outlaws-demo.md).
The archive is `outdemo_v2.exe`, 14,186,356 bytes, SHA256
`501f37aa475b6c27c87ce04e30b5207f91b81603cb376aaa9ffde1647a40e7b3`.
On this host the retained original payload is
`scratch/runs/20261018-outlaws-original-recovery/original/payload`.

```sh
node tools/verify-outlaws-demo.js --prepare /absolute/original/payload
node tools/verify-outlaws-demo.js
```

Preparation verifies all 31 original path/size/SHA256 records against the
tracked inventory before copying the 30 unique files into the ignored
`test/binaries/candidates/outlaws-demo/game/OUTDEMO` directory. It copies
only missing files, rejects differing existing bytes and retains over 2 GiB
free. It creates the ordinary ignored `.wine-assembly-browser.json` with 29
companion mappings; the registry supplies the executable. The verifier
accepts an alternate fixture path (second argument after the source for
`--prepare`, or its sole argument when verifying). It rejects missing, extra,
changed and symlink payload files and incorrect manifest mappings. No binaries
or run artifacts enter git. Existing original recovery evidence is retained.

After separately coordinated runtime admission, use `--app=outlaws_demo`
with the existing bounded controller, explicit pinned wasm, `--no-build`,
`--no-threads` and 60-second guest/85-second hard process-group guard.
The generic candidate smoke runner does not preserve this exact guest route;
its executable-list entry is inventory metadata, not route validation.

Registration has filesystem and pure JavaScript verification only. The
separate original direct route reached a reviewed main menu in
`scratch/runs/20261018-outlaws-original-fixed-lifecycle-observation/review.json`,
using canonical wasm SHA256
`a4a4bc6aef0f50a191d83acdd0857ff390537701adc381d81436845f20b969e3`.
`sample-2.png` and `final.png` show the main menu (SHA256
`36bd02ac04efd535cd6bdf496fb4fdd27dfcc825b7e600cb625669bec3b85d32`).
The observation exited 0 after 60 seconds without guest input. Attach any
dashboard record to candidate `outlaws-demo`, app `outlaws_demo`, preserving
the recorded direct route and actual source/module identity. The prior
observation originally had only `review.json` because no matching corpus
candidate existed then. After registration, its `result.json` was published
with a menu-only pass and the original direct-route identity. The separate
`20261018-outlaws-main-game-observation/result.json` records a failed ordinary
menu activation attempt: click and balanced Enter/Down inputs left the menu
visible, with guest consumption unestablished. Both records contain only
local artifact references and pass schema/containment checks with no missing
artifacts; the repository-wide checker still reports the unrelated historical
Zuma containment error. Gameplay, navigation, audio, FPS and browser
compatibility remain unqualified; this registration is not a public release.
