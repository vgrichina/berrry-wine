# Registered Tunnel, Twist and Boids browser coverage, 7 November 2026

Run `20261107-graphics-tunnel-twist-boids` stopped at a concrete scene-coverage
blocker: ordinary cooperative WebGL Boids showed cyan terrain boundaries but
no recognizable colored flock in six reviewed captures across two launches.
The semantic cause is unknown. This is **not a twelve-configuration pass** or
a demonstrated emulator defect. Seven configurations have reviewed moving
scenes, one Tunnel Worker observation is viewport-disqualified, one Boids
configuration has bounded startup/terrain-only evidence, and three WebGL
Worker configurations were not launched. No emulator code was changed.

The exact runtime source is main commit
`52a33e7bdaeb82fa5d96c7fc745291b8a9ad4eea`, plus the recorded
`dirty-source.patch` and `new-source.patch`. Existing dirty changes affect two
GL browser tests; recorded new files include the unwired WININIT helper and
existing test/tool work. These are recovery inputs, not fixes made by this
investigation. Git supplies the source archive. No source/media archive was
created, and original game media was not copied into evidence.

All three ordinary `lib/apps.js` registrations were used without manifest
changes. Their complete manifests resolve to 40 unique original input paths,
5,192,145 bytes, including `test/binaries/dx-sdk/bin/tunnel.exe`, `twist.exe`
and `boids.exe`. Paths, manifest objects, sizes and SHA-256 values are in
`registered-pins.json`. Shared SDK assets retain their existing provenance,
including the previously documented Viewer aliases; nothing here reclassifies
those files as original Viewer scene assets.

Both local and fresh-box locked full builds passed. Standard module SHA-256:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Compatibility module SHA-256:
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
Both modules were verified before runtime staging, matched the fresh build,
and were downloaded and SHA-verified before shutdown. Every recorded main
instantiation and posted guest/render Worker module receipt matches the
standard module. This establishes current-source identity independently of
the earlier CLI startup result.

The retained October 31 CLI software startup module
`8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`
still has unknown compiled-source provenance. Its observations remain intact;
they establish neither current browser/Worker coverage nor historical27
membership. No membership archaeology was performed.

One fresh UUID-idempotent box, `bx_y95bqb7h`, ran one browser guest at a time.
The helper used an observer viewport of 1100×820, device scale 1, ordinary
registered startup, and captures at approximately 15/30/45 seconds. It closed
each browser and waited for personal review before the next original launched.
There were no injected guest keys, clicks, state/configuration writes, clock
changes or callback manipulation. Scheduler/backend selection used the host's
ordinary controls. Samples precede screenshots while execution continues;
counters are interval evidence, not exact screenshot/frame alignment or FPS.

| App | Backend / execution | Host slices, first → last | Reviewed scene / owning evidence |
| --- | --- | --- | --- |
| dx_tunnel | software / cooperative | 1221 → 4008 | Gray textured tunnel rotates; yellow/black radiation signs change placement. No owning GPU object. |
| dx_twist | software / cooperative | 1467 → 4483 | Rounded textured object rotates and changes deformation. No owning GPU object. |
| dx_boids | software / cooperative | 3142 → 8704 | Colored triangular flock changes grouping and orientation over cyan terrain boundaries. No owning GPU object. |
| dx_twist | software / guest Worker | 1050 → 3123 | Textured object changes silhouette and visible face. Guest endpoint 1, slot 0, advancing slices/RPC activity. |
| dx_boids | software / guest Worker | 1635 → 6351 | Colored flock and terrain move. Guest endpoint 1, slot 0; render endpoint 1 requests software, completed software draws 163145 → 628259, fallback software draws 0. |
| dx_tunnel | WebGL / cooperative | 1066 → 3325 | Tunnel orientation and signs move; owning D3DIMGpu draws 1243 → 4130, errors/fallbacks 0. |
| dx_twist | WebGL / cooperative | 1053 → 3228 | End face, radiation band and twisted silhouette change; owning draws 1211 → 3912, errors/fallbacks 0. |

Direct software completion counters are unavailable for the cooperative paths
and retained-mode Worker paths; visible scene changes and owning scheduler
progress are recorded without inventing draw counts. Software Worker identities
were read from the owning app's guest link, alongside its module-post receipt.
Each accepted case has three inspected compositor captures with stable
presentation geometry. All ten executions ended their observation still
running, with no recorded escaped trap, unimplemented-API trap or page error.
This is bounded crash evidence, not unrestricted crash freedom.

The first software Tunnel Worker observation visibly moves and records guest
endpoint 1, slot 0, but its supplemental Puppeteer observer attached with the
default viewport and changed page presentation. Its fixed-viewport
qualification is rejected. `observer-incident.json` and all three captures are
preserved. The observer was corrected to `defaultViewport:null`; subsequent
Twist and Boids Worker captures retain stable geometry. The planned Tunnel
replacement was not run after the Boids scene blocker. The invalid observation
does not fill that configuration's acceptance gap.

Cooperative WebGL Boids initially showed only sparse cyan polygon boundaries
at 15/30/45 seconds. Owning draws advanced 43 → 79 → 115 and submitted
triangles 10396 → 20782 → 31168, with errors/fallbacks 0. A separate ordinary
launch extended observation to 60/90/120 seconds, without changing guest
state or time. It again showed only cyan boundaries, with draws
144 → 215 → 287, triangles 39622 → 60018 → 80790, and host slices
140 → 209 → 281. The terrain boundaries change slightly; no recognizable
flock is visible. The final original-resolution capture was also inspected.

Submission counters do not prove flock visibility. The software launches and
these two WebGL launches have different unmodified startup clocks and scene
phases; their captures are not a same-frame native or backend oracle. No
Win32/x86/graphics semantics violation has been established, so there is no
speculative fix or claimed failing-before regression. The next concrete work
is bounded passive observation of the owning Boids camera/frustum, completed
triangle geometry and presentation, followed by a semantics-grounded
reproduction if an emulator violation is demonstrated. WebGL guest Worker
Tunnel, Twist and Boids remain unlaunched by this run.

The browser reports `Chrome/151.0.7922.108`. Its box launcher identifies itself
as BetterChromium and forces `--use-gl=angle --use-angle=swiftshader` and
`--enable-unsafe-swiftshader`; `/dev/dri` is absent. The WebGL renderer string
reports Intel/Mesa. Both observations are retained in
`retrieved/provider-environment.json` and per-case state; the string is not
physical-GPU evidence. This is software WebGL coverage. Node is 24.22.1;
installed package details are in `retrieved/npm-installed.json`.

The response audit matches all 1,699 recovered successful response bodies
against pinned closure or exact Git bytes, with zero mismatches. DevTools
could not return 138 individual response bodies; those deliveries are not
independently hash-certified. Optional/UI lookup 404s and readback performance
warnings remain in logs. Pre/post closure checks do not erase these limits.
All 1,395 runtime pins plus 166 supplemental Git paths pass postflight.
`npm install` removed two stale native-GL root dependency declarations from
the remote lock metadata; the exact patch and updated lock pin are retained.

Focused checks passed: `test-d3dim-lit-alpha.js`,
`test-d3dim-execute-buffer-slots.js`, and `test-d3dim-gpu-fallback-counters.js`.
There was no production change requiring a new regression. The coverage ledger,
named-case audit, visual reviews, source patches, response/module audit and
blocker record are in the owned run directory. Thirty original compositor
captures across ten executions were personally inspected.

All 161 recovered runtime artifacts (5,456,107 bytes) and both unique modules
were downloaded and SHA-verified before the explicitly delegated normal,
nonforced shutdown. The waiting review-gate drivers were ended with SIGTERM
after browser/profile cleanup, without launching the remaining cases.
Postflight finds all 16 named processes absent, no live browser/run processes,
three refused HTTP ports, no profiles, empty input queues and no held buttons.
The box was created at 09:17:44 UTC with expiry 09:57:44 UTC; it is confirmed
archived at 09:35:29.882 UTC, expiry now null, stop completed with
`forced:false`. No stopped box was resumed. Box custody returns to the
coordinator with no active runtime. `/home` remains above 2 GB free.

FPS, audio, reference parity, complete scene correctness, historical27
membership and full-corpus completion remain unqualified. No public deployment
or nested worker was used. Evidence is published through `result.json` last,
as a named investigation with no unrelated candidate attachment.
